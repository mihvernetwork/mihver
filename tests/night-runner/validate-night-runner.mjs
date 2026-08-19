import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planQueue } from '../../scripts/dev/night-runner.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, 'fixtures');

function taskById(result, taskId) {
  const task = result.tasks.find((t) => t.task_id === taskId);
  assert.ok(task, `expected a task result for task_id "${taskId}"`);
  return task;
}

const fixtureNames = (await readdir(fixturesDir)).filter((name) => name.endsWith('.json')).sort();
assert.ok(fixtureNames.length > 0, 'expected at least one fixture in tests/night-runner/fixtures');

let checked = 0;
for (const name of fixtureNames) {
  const file = path.join(fixturesDir, name);
  const fixture = JSON.parse(await readFile(file, 'utf8'));
  const result = planQueue(fixture.queue, { stopSwitchActive: fixture.stop_switch_active === true });

  assert.equal(
    result.status,
    fixture.expected.status,
    `${name}: expected status ${fixture.expected.status}, got ${result.status}\n${JSON.stringify(result, null, 2)}`
  );

  for (const [taskId, expectedState] of Object.entries(fixture.expected.task_states ?? {})) {
    const task = taskById(result, taskId);
    assert.equal(
      task.final_state,
      expectedState,
      `${name}: expected task "${taskId}" final_state ${expectedState}, got ${task.final_state}`
    );
  }

  for (const [taskId, expectedRetries] of Object.entries(fixture.expected.retries_used ?? {})) {
    const task = taskById(result, taskId);
    assert.equal(
      task.retries_used,
      expectedRetries,
      `${name}: expected task "${taskId}" retries_used ${expectedRetries}, got ${task.retries_used}`
    );
    const retryCount = task.history.filter((state) => state === 'RETRY').length;
    assert.equal(
      retryCount,
      expectedRetries,
      `${name}: expected task "${taskId}" history to contain RETRY ${expectedRetries} time(s), got ${retryCount}`
    );
  }

  if (fixture.expected.reasons_contain) {
    for (const substring of fixture.expected.reasons_contain) {
      assert.ok(
        result.reasons.some((reason) => reason.includes(substring)),
        `${name}: expected result.reasons to contain a substring "${substring}"\n${JSON.stringify(result.reasons, null, 2)}`
      );
    }
  }

  for (const task of result.tasks) {
    if (task.final_state === 'READY_FOR_HUMAN') {
      assert.equal(task.reasons.length, 0, `${name}: READY_FOR_HUMAN task "${task.task_id}" must have empty reasons`);
    } else {
      assert.ok(
        task.reasons.length > 0,
        `${name}: ${task.final_state} task "${task.task_id}" must have a non-empty reasons array`
      );
    }
  }

  checked += 1;
}

console.log(`Night Runner validation passed: ${checked} fixtures checked.`);
