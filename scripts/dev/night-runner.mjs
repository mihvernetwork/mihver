#!/usr/bin/env node
// MIHVER Night Runner — deterministic dry-run foundation. Pure planning logic (validateQueueStructure,
// planQueue) plus a thin CLI wrapper. See docs/development/NIGHT_RUNNER.md for the design this
// implements. This module performs no process-spawning, networking, or git operations anywhere —
// that is intentional: this version is a simulator/control-plane foundation only.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, isAbsolute, resolve } from 'node:path';

const TERMINAL_STATES = ['READY_FOR_HUMAN', 'BLOCKED', 'FAILED', 'STOPPED'];

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateQueueStructure(queueDocument) {
  const reasons = [];
  const doc = queueDocument && typeof queueDocument === 'object' ? queueDocument : {};

  if (typeof doc.queue_id !== 'string' || doc.queue_id.length === 0) {
    reasons.push('queue_id must be a non-empty string');
  }

  const limits = doc.limits && typeof doc.limits === 'object' ? doc.limits : null;
  if (!limits) {
    reasons.push('limits must be an object');
  } else {
    if (!isFiniteNumber(limits.max_runtime_seconds) || limits.max_runtime_seconds <= 0) {
      reasons.push('limits.max_runtime_seconds must be a finite number greater than 0');
    }
    if (
      !isFiniteNumber(limits.max_tasks) ||
      limits.max_tasks <= 0 ||
      !Number.isInteger(limits.max_tasks)
    ) {
      reasons.push('limits.max_tasks must be a finite integer greater than 0');
    }
    if (!isFiniteNumber(limits.per_task_timeout_seconds) || limits.per_task_timeout_seconds <= 0) {
      reasons.push('limits.per_task_timeout_seconds must be a finite number greater than 0');
    }
    if (
      !isFiniteNumber(limits.max_retries) ||
      limits.max_retries < 0 ||
      !Number.isInteger(limits.max_retries)
    ) {
      reasons.push('limits.max_retries must be a finite integer greater than or equal to 0');
    }
  }

  const tasks = Array.isArray(doc.tasks) ? doc.tasks : null;
  if (!tasks) {
    reasons.push('tasks must be an array');
  } else {
    const seenIds = new Set();
    tasks.forEach((task, index) => {
      const label = `tasks[${index}]`;
      const t = task && typeof task === 'object' ? task : {};

      if (typeof t.task_id !== 'string' || t.task_id.length === 0) {
        reasons.push(`${label}.task_id must be a non-empty string`);
      } else {
        if (seenIds.has(t.task_id)) {
          reasons.push(`task_id "${t.task_id}" is used more than once; task_id values must be unique`);
        }
        seenIds.add(t.task_id);
      }

      if (typeof t.branch !== 'string' || t.branch.length === 0) {
        reasons.push(`${label} (task_id "${t.task_id}").branch must be a non-empty string`);
      } else if (t.branch === 'main') {
        reasons.push(
          `task "${t.task_id}" declares branch "main" — main must never be used as a writable task branch`
        );
      }

      if (typeof t.authorized !== 'boolean') {
        reasons.push(`task "${t.task_id}".authorized must be a boolean`);
      }
      if (typeof t.human_gated !== 'boolean') {
        reasons.push(`task "${t.task_id}".human_gated must be a boolean`);
      }
      if (!isFiniteNumber(t.estimated_runtime_seconds) || t.estimated_runtime_seconds < 0) {
        reasons.push(`task "${t.task_id}".estimated_runtime_seconds must be a finite number >= 0`);
      }

      if (!Array.isArray(t.depends_on)) {
        reasons.push(`task "${t.task_id}".depends_on must be an array`);
      } else {
        const seenDeps = new Set();
        for (const depId of t.depends_on) {
          if (seenDeps.has(depId)) {
            reasons.push(`task "${t.task_id}".depends_on contains duplicate entry "${depId}"`);
          }
          seenDeps.add(depId);

          const depIndex = tasks.findIndex(
            (candidate) => candidate && typeof candidate === 'object' && candidate.task_id === depId
          );
          if (depIndex === -1) {
            reasons.push(
              `task "${t.task_id}" depends_on unresolved task_id "${depId}"`
            );
          } else if (depIndex >= index) {
            reasons.push(
              `task "${t.task_id}" depends_on "${depId}", which does not appear at an earlier index ` +
                'in the tasks array (the queue must already be in topological order)'
            );
          }
        }
      }
    });
  }

  return { valid: reasons.length === 0, reasons };
}

function refusedReport(queueDocument, stopSwitchActive, reasons) {
  const doc = queueDocument && typeof queueDocument === 'object' ? queueDocument : {};
  return {
    status: 'REFUSED',
    queue_id: doc.queue_id,
    limits: doc.limits,
    kill_switch_active: !!stopSwitchActive,
    reasons,
    tasks: [],
    summary: { total_tasks: 0, ready_for_human: 0, blocked: 0, failed: 0, stopped: 0 }
  };
}

function buildSummary(taskResults) {
  const summary = {
    total_tasks: taskResults.length,
    ready_for_human: 0,
    blocked: 0,
    failed: 0,
    stopped: 0
  };
  for (const result of taskResults) {
    if (result.final_state === 'READY_FOR_HUMAN') summary.ready_for_human += 1;
    else if (result.final_state === 'BLOCKED') summary.blocked += 1;
    else if (result.final_state === 'FAILED') summary.failed += 1;
    else if (result.final_state === 'STOPPED') summary.stopped += 1;
  }
  return summary;
}

export function planQueue(queueDocument, { stopSwitchActive } = {}) {
  const structural = validateQueueStructure(queueDocument);
  if (!structural.valid) {
    return refusedReport(queueDocument, stopSwitchActive, structural.reasons);
  }

  const doc = queueDocument;
  const limits = doc.limits;
  const tasksById = new Map(doc.tasks.map((task) => [task.task_id, task]));

  if (stopSwitchActive) {
    const tasks = doc.tasks.map((task) => ({
      task_id: task.task_id,
      branch: task.branch,
      final_state: 'STOPPED',
      history: ['READY', 'STOPPED'],
      retries_used: 0,
      reasons: ['kill switch engaged: .project/STOP is present']
    }));
    return {
      status: 'STOPPED_BY_KILL_SWITCH',
      queue_id: doc.queue_id,
      limits,
      kill_switch_active: true,
      reasons: [],
      tasks,
      summary: buildSummary(tasks)
    };
  }

  const results = new Map();
  const orderedResults = [];
  let tasksRun = 0;
  let runtimeUsedSeconds = 0;
  let limitTripped = false;
  let limitTrippedReason = null;

  for (const task of doc.tasks) {
    if (limitTripped) {
      const result = {
        task_id: task.task_id,
        branch: task.branch,
        final_state: 'STOPPED',
        history: ['READY', 'STOPPED'],
        retries_used: 0,
        reasons: [limitTrippedReason]
      };
      results.set(task.task_id, result);
      orderedResults.push(result);
      continue;
    }

    let blockedReason = null;
    for (const depId of task.depends_on) {
      const depResult = results.get(depId);
      if (depResult.final_state !== 'READY_FOR_HUMAN') {
        blockedReason = `dependency ${depId} did not reach READY_FOR_HUMAN (state: ${depResult.final_state})`;
        break;
      }
    }
    if (!blockedReason) {
      for (const depId of task.depends_on) {
        const depTask = tasksById.get(depId);
        if (depTask.human_gated === true) {
          blockedReason = `dependency ${depId} is human-gated; downstream tasks are blocked pending human sign-off`;
          break;
        }
      }
    }
    if (blockedReason) {
      const result = {
        task_id: task.task_id,
        branch: task.branch,
        final_state: 'BLOCKED',
        history: ['READY', 'BLOCKED'],
        retries_used: 0,
        reasons: [blockedReason]
      };
      results.set(task.task_id, result);
      orderedResults.push(result);
      continue;
    }

    if (task.authorized !== true) {
      const result = {
        task_id: task.task_id,
        branch: task.branch,
        final_state: 'BLOCKED',
        history: ['READY', 'BLOCKED'],
        retries_used: 0,
        reasons: ['task is not explicitly pre-authorized']
      };
      results.set(task.task_id, result);
      orderedResults.push(result);
      continue;
    }

    if (tasksRun + 1 > limits.max_tasks) {
      limitTripped = true;
      limitTrippedReason = `max_tasks limit (${limits.max_tasks}) reached`;
      const result = {
        task_id: task.task_id,
        branch: task.branch,
        final_state: 'STOPPED',
        history: ['READY', 'STOPPED'],
        retries_used: 0,
        reasons: [limitTrippedReason]
      };
      results.set(task.task_id, result);
      orderedResults.push(result);
      continue;
    }
    tasksRun += 1;

    // Each simulated attempt (the initial RUNNING and every RETRY's RUNNING) only ever runs for
    // min(estimated_runtime_seconds, per_task_timeout_seconds): a timeout-bounded attempt is cut
    // off at the timeout, so it never costs more runtime budget than that, regardless of how much
    // longer the task's own estimate says it would otherwise have run. The global runtime budget
    // is charged per attempt, not pre-charged as the full estimate up front, and is checked before
    // each attempt — so a task can be interrupted (STOPPED, cascading) between retries, not only
    // before its first attempt.
    const attemptRuntimeSeconds = Math.min(task.estimated_runtime_seconds, limits.per_task_timeout_seconds);

    let retriesUsed = 0;
    const history = ['READY'];
    let finalState = null;
    let reasons = [];
    for (;;) {
      if (runtimeUsedSeconds + attemptRuntimeSeconds > limits.max_runtime_seconds) {
        limitTripped = true;
        limitTrippedReason = `max_runtime_seconds limit (${limits.max_runtime_seconds}) would be exceeded`;
        history.push('STOPPED');
        finalState = 'STOPPED';
        reasons = [limitTrippedReason];
        break;
      }
      runtimeUsedSeconds += attemptRuntimeSeconds;
      history.push('RUNNING');
      if (task.estimated_runtime_seconds <= limits.per_task_timeout_seconds) {
        history.push('VALIDATING', 'INDEPENDENT_REVIEW', 'READY_FOR_HUMAN');
        finalState = 'READY_FOR_HUMAN';
        reasons = [];
        break;
      }
      if (retriesUsed < limits.max_retries) {
        history.push('RETRY');
        retriesUsed += 1;
        continue;
      }
      history.push('FAILED');
      finalState = 'FAILED';
      reasons = [
        `estimated_runtime_seconds (${task.estimated_runtime_seconds}) exceeds per_task_timeout_seconds ` +
          `(${limits.per_task_timeout_seconds}) after ${limits.max_retries} retries`
      ];
      break;
    }

    const result = {
      task_id: task.task_id,
      branch: task.branch,
      final_state: finalState,
      history,
      retries_used: retriesUsed,
      reasons
    };
    results.set(task.task_id, result);
    orderedResults.push(result);
  }

  return {
    status: 'OK',
    queue_id: doc.queue_id,
    limits,
    kill_switch_active: false,
    reasons: [],
    tasks: orderedResults,
    summary: buildSummary(orderedResults)
  };
}

// Re-export the terminal state list for potential reuse by callers/tests.
export { TERMINAL_STATES };

const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  const queuePathArg = process.argv[2];
  if (!queuePathArg) {
    console.error('Usage: node scripts/dev/night-runner.mjs <path-to-queue.json>');
    process.exit(1);
  }

  const queuePath = isAbsolute(queuePathArg) ? queuePathArg : resolve(process.cwd(), queuePathArg);
  const queueDoc = JSON.parse(readFileSync(queuePath, 'utf8'));

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const repoRoot = dirname(dirname(__dirname));
  const stopSwitchActive = existsSync(join(repoRoot, '.project/STOP'));

  const report = planQueue(queueDoc, { stopSwitchActive });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.status === 'REFUSED' ? 1 : 0);
}
