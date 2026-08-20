#!/usr/bin/env node
// MIHVER Night Runner - fresh-Claude single-task execution adapter. This module launches exactly
// one explicitly authorized task in an executor-owned temporary workspace. It does not plan
// queues, automate git worktrees, loop over tasks, or execute against main.

import { existsSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = dirname(dirname(moduleDirectory));
const requiredFlags = ['--print', '--output-format', '--permission-mode', '--no-session-persistence', '--tools', '--strict-mcp-config'];
const approvedTools = new Map(['Read', 'Write', 'Edit'].map((tool) => [tool.toLowerCase(), tool]));
const approvedPermissionModes = new Map([['acceptedits', 'acceptEdits']]);

function commandParts(options) {
  return Array.isArray(options.claudeCommand) && options.claudeCommand.length > 0 ? options.claudeCommand : ['claude'];
}

function executableResolver(command, options) {
  let attempted = false;
  let resolved;
  return () => {
    if (attempted) return resolved;
    attempted = true;
    const lookup = (options.spawnSyncImpl ?? spawnSync)(process.platform === 'win32' ? 'where' : 'which', [command], {
      encoding: 'utf8', shell: false, timeout: options.discoveryTimeoutMs ?? 10_000
    });
    if (lookup.error || lookup.signal || lookup.status !== 0) return undefined;
    const candidate = String(lookup.stdout ?? '').split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (!candidate) return undefined;
    resolved = process.platform === 'win32'
      ? join(dirname(candidate), 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
      : candidate;
    if (process.platform === 'win32' && !existsSync(resolved)) resolved = undefined;
    return resolved;
  };
}

function discoverWithResolver(options, claudeCommand, resolveExecutable) {
  const probe = (command) => (options.spawnSyncImpl ?? spawnSync)(command, [...claudeCommand.slice(1), '--help'], {
    encoding: 'utf8', shell: false, timeout: options.discoveryTimeoutMs ?? 10_000
  });
  let result = probe(claudeCommand[0]);
  let command = claudeCommand[0];
  if (result.error?.code === 'ENOENT') {
    // Windows npm shims are not shell:false executables. We resolve the native binary instead;
    // shell:true is deliberately excluded because DEP0190 makes arbitrary prompts injectable.
    const fallback = resolveExecutable();
    if (fallback) {
      command = fallback;
      result = probe(command);
    }
  }
  if (result.error || result.signal || result.status !== 0) {
    return { ok: false, reason: 'CLI_DISCOVERY_FAILED', error: result.error?.message ?? `claude --help ended with ${result.signal ?? result.status}` };
  }
  const helpText = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const missing = requiredFlags.filter((flag) => !helpText.includes(flag));
  return missing.length === 0 ? { ok: true, helpText, command } : { ok: false, reason: 'CLI_DISCOVERY_FAILED', missing, helpText };
}

export function discoverClaudeCli(options = {}) {
  const claudeCommand = commandParts(options);
  try {
    return discoverWithResolver(options, claudeCommand, executableResolver(claudeCommand[0], options));
  } catch (error) {
    return { ok: false, reason: 'CLI_DISCOVERY_FAILED', error: error.message };
  }
}

function containsOrEquals(parent, candidate) {
  const relation = relative(parent, candidate);
  return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation));
}

// Exported so the invariant can be tested independently of executor-owned mkdtemp.
export function inspectWorkspaceIsolation(repoRoot, workspace) {
  const repo_root = realpathSync(resolve(repoRoot));
  const workspace_dir = realpathSync(resolve(workspace));
  return {
    repo_root, workspace_dir,
    isolated: !containsOrEquals(repo_root, workspace_dir) && !containsOrEquals(workspace_dir, repo_root)
  };
}

function refused(taskDescriptor, reason, detail, workspace_dir) {
  return { status: 'REFUSED', reason, task_id: taskDescriptor?.task_id, detail, workspace_dir };
}

function normalizeTools(value) {
  const tools = value ?? ['Read', 'Write', 'Edit'];
  const list = Array.isArray(tools) ? tools : typeof tools === 'string' ? tools.split(/[\s,]+/) : [];
  return list.flatMap((tool) => tool.split(/[\s,]+/)).map((tool) => tool.trim()).filter(Boolean);
}

function terminateProcessTree(child, signal, taskkillSpawn = spawn) {
  if (!child?.pid) return;
  try {
    if (process.platform === 'win32') {
      const killer = taskkillSpawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore', shell: false, windowsHide: true
      });
      killer.on?.('error', () => {});
      killer.unref?.();
    } else {
      process.kill(-child.pid, signal);
    }
  } catch {
    // It may already have exited; close/error or the kill-grace bound completes the call.
  }
}

export async function executeTask(taskDescriptor, options = {}) {
  const descriptor = taskDescriptor && typeof taskDescriptor === 'object' ? taskDescriptor : {};
  let workspace_dir;
  let isolation;
  try {
    workspace_dir = realpathSync(mkdtempSync(join(tmpdir(), 'mihver-night-runner-')));
    isolation = inspectWorkspaceIsolation(options.repoRoot ?? defaultRepoRoot, workspace_dir);
    workspace_dir = isolation.workspace_dir;
  } catch (error) {
    return refused(descriptor, 'WORKSPACE_INVALID', error.message, workspace_dir);
  }
  if (!isolation.isolated) {
    return refused(descriptor, 'WORKSPACE_INVALID', 'workspace and repository must not contain one another', workspace_dir);
  }

  const repoRoot = isolation.repo_root;
  const claudeCommand = commandParts(options);
  const resolveExecutable = executableResolver(claudeCommand[0], options);
  const permissionMode = options.permissionMode ?? 'acceptEdits';
  const toolAllowlist = normalizeTools(options.toolAllowlist);
  const canonicalPermissionMode = typeof permissionMode === 'string'
    ? approvedPermissionModes.get(permissionMode.toLowerCase()) : undefined;
  const canonicalTools = toolAllowlist.map((tool) => approvedTools.get(tool.toLowerCase()));

  if (existsSync(join(repoRoot, '.project', 'STOP'))) return refused(descriptor, 'STOP_ACTIVE', '.project/STOP is present', workspace_dir);
  if (descriptor.authorized !== true) return refused(descriptor, 'UNAUTHORIZED', 'task descriptor is not explicitly authorized', workspace_dir);
  if (typeof descriptor.branch !== 'string' || descriptor.branch.length === 0 || descriptor.branch === 'main') {
    return refused(descriptor, 'MAIN_BRANCH_FORBIDDEN', 'branch must be present, non-empty, and not main', workspace_dir);
  }
  if (typeof descriptor.timeout_seconds !== 'number' || !Number.isFinite(descriptor.timeout_seconds) || descriptor.timeout_seconds <= 0) {
    return refused(descriptor, 'INVALID_TASK', 'timeout_seconds must be a positive finite number', workspace_dir);
  }
  if (!canonicalPermissionMode || toolAllowlist.length === 0 || canonicalTools.some((tool) => !tool)) {
    return refused(descriptor, 'INVALID_OPTIONS', 'permission mode and tool allowlist must preserve capability restrictions', workspace_dir);
  }

  let discovery;
  try {
    discovery = discoverWithResolver(options, claudeCommand, resolveExecutable);
  } catch (error) {
    discovery = { ok: false, reason: 'CLI_DISCOVERY_FAILED', error: error.message };
  }
  if (discovery.ok !== true) return refused(descriptor, 'CLI_DISCOVERY_FAILED', discovery, workspace_dir);

  let command = discovery.command ?? claudeCommand[0];
  const args = [
    ...claudeCommand.slice(1), '--print', '--output-format', 'json', '--permission-mode', canonicalPermissionMode,
    '--no-session-persistence', '--tools', canonicalTools.join(','), '--strict-mcp-config', descriptor.prompt
  ];
  const started_at = Date.now();

  return new Promise((resolveResult) => {
    let child;
    let stdout = '';
    let stderr = '';
    let timed_out = false;
    let stop_detected = false;
    let terminating = false;
    let escalated = false;
    let closeCode;
    let settled = false;
    let timeoutTimer;
    let stopTimer;
    let escalationTimer;
    let killGraceTimer;
    const killGraceMs = options.killGraceMs ?? 5_000;

    const finish = (fields) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearInterval(stopTimer);
      clearTimeout(escalationTimer);
      clearTimeout(killGraceTimer);
      const ended_at = Date.now();
      resolveResult({
        status: 'EXECUTED', task_id: descriptor.task_id, pid: child?.pid, ...fields,
        timed_out, stop_detected, stdout, stderr, duration_ms: ended_at - started_at,
        started_at, ended_at, command: [command, ...args], workspace_dir
      });
    };

    const requestTermination = (kind) => {
      if (terminating || settled) return;
      terminating = true;
      timed_out = kind === 'timeout';
      stop_detected = kind === 'stop';
      terminateProcessTree(child, 'SIGTERM', options.taskkillSpawn);
      if (process.platform !== 'win32') {
        escalationTimer = setTimeout(() => {
          escalated = true;
          terminateProcessTree(child, 'SIGKILL', options.taskkillSpawn);
          if (closeCode !== undefined) finish({
            outcome: stop_detected ? 'STOPPED' : 'TIMED_OUT', exit_code: closeCode,
            termination_uncertain: false
          });
        }, Math.min(1_000, Math.max(1, Math.floor(killGraceMs / 2))));
      }
      killGraceTimer = setTimeout(() => finish({
        outcome: stop_detected ? 'STOPPED' : 'TIMED_OUT', exit_code: null, termination_uncertain: true
      }), killGraceMs);
    };

    const launch = (launchCommand, originalError) => {
      try {
        child = (options.spawnImpl ?? spawn)(launchCommand, args, {
          cwd: workspace_dir, shell: false, detached: process.platform !== 'win32'
        });
      } catch (error) {
        if (error.code === 'ENOENT' && !originalError) {
          const fallback = resolveExecutable();
          if (fallback) { command = fallback; launch(fallback, error); return; }
        }
        finish({ outcome: 'FAILED', exit_code: null, error: (originalError ?? error).message });
        return;
      }
      const launchedChild = child;
      launchedChild.stdout?.setEncoding?.('utf8');
      launchedChild.stderr?.setEncoding?.('utf8');
      launchedChild.stdout?.on?.('data', (chunk) => { stdout += chunk; });
      launchedChild.stderr?.on?.('data', (chunk) => { stderr += chunk; });
      launchedChild.once('error', (error) => {
        if (error.code === 'ENOENT' && !originalError) {
          const fallback = resolveExecutable();
          if (fallback) { command = fallback; launch(fallback, error); return; }
        }
        finish({ outcome: 'FAILED', exit_code: null, error: (originalError ?? error).message });
      });
      launchedChild.once('close', (exit_code) => {
        if (settled || launchedChild !== child) return;
        closeCode = exit_code;
        if (terminating && process.platform !== 'win32' && !escalated) return;
        finish({
          outcome: stop_detected ? 'STOPPED' : timed_out ? 'TIMED_OUT' : exit_code === 0 ? 'COMPLETED' : 'FAILED',
          exit_code, ...(terminating ? { termination_uncertain: false } : {})
        });
      });
    };
    launch(command);

    if (!settled) {
      stopTimer = setInterval(() => {
        if (existsSync(join(repoRoot, '.project', 'STOP'))) requestTermination('stop');
      }, options.stopPollMs ?? 250);
      timeoutTimer = setTimeout(() => requestTermination('timeout'), descriptor.timeout_seconds * 1000);
    }
  });
}

const isMainModule = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMainModule) {
  const descriptorPathArg = process.argv[2];
  if (!descriptorPathArg || process.argv.length !== 3) {
    console.error('Usage: node scripts/dev/night-runner-executor.mjs <path-to-task-descriptor.json>');
    process.exit(1);
  }
  try {
    const descriptorPath = isAbsolute(descriptorPathArg) ? descriptorPathArg : resolve(process.cwd(), descriptorPathArg);
    const descriptor = JSON.parse(readFileSync(descriptorPath, 'utf8'));
    const result = await executeTask(descriptor, {});
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.outcome === 'COMPLETED' ? 0 : 1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
