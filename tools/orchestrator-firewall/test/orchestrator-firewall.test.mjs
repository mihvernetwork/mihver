import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { canonicalJson, parseDelegation, validateSandbox } from '../src/delegation.mjs';
import { classify } from '../src/identity.mjs';
import { computeFingerprint } from '../src/fingerprint.mjs';
import { appendCompletion, appendRecord, appendStarted, appendThreadBinding, findThreadBinding, verifyChain } from '../src/ledger.mjs';
import { decideStop } from '../src/stopgate.mjs';
import { inScope } from '../src/scope.mjs';
import { sha256 } from '../install/manifest.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const bin = join(repoRoot, 'tools/orchestrator-firewall/bin/mihver-firewall.mjs');
const installer = join(repoRoot, 'tools/orchestrator-firewall/install/mihver-firewall-install.mjs');
const roots = [];
const temp = (label) => { const root = execFileSync('mktemp', ['-d', join(tmpdir(), `mihver-fw-${label}-XXXXXX`)], { encoding: 'utf8' }).trim(); roots.push(root); return root; };
test.after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });

function runHook(root, input, extraEnv = {}) {
  const runtime = join(root, 'runtime-home'); mkdirSync(runtime, { recursive: true });
  return spawnSync(process.execPath, [bin], {
    input: JSON.stringify(input), encoding: 'utf8', cwd: root,
    env: { ...process.env, MIHVER_FIREWALL_HOME: runtime, MIHVER_FIREWALL_CANONICAL_ROOT: root, ...extraEnv },
  });
}
function pre(root, tool_name, tool_input = {}, extra = {}) {
  return runHook(root, { hook_event_name: 'PreToolUse', cwd: root, session_id: 's', prompt_id: 'p', tool_use_id: `u-${tool_name}`, tool_name, tool_input, ...extra });
}
function verdict(result) { assert.equal(result.status, 0, result.stderr); return result.stdout ? JSON.parse(result.stdout) : null; }
function git(root, args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function initRepo(label = 'repo') {
  const root = temp(label); git(root, ['init', '--initial-branch=main', '-q']); git(root, ['config', 'user.email', 'test@example.invalid']); git(root, ['config', 'user.name', 'Test']);
  writeFileSync(join(root, 'tracked.txt'), 'one\n'); git(root, ['add', '.']); git(root, ['commit', '-qm', 'seed']); return root;
}
const meta = (role, changes = {}) => ({ baseSha: 'a'.repeat(40), protocolVersion: '1', role, scope: 'tools/**', taskId: 'T-1', ...changes });
const prompt = (role, encoding = 'json', body = '') => {
  const json = canonicalJson(meta(role));
  const payload = encoding === 'base64url' ? Buffer.from(json).toString('base64url') : json;
  return `MIHVER_DELEGATION_V1:${payload}${body ? `\n${body}` : ''}`;
};

test('main-thread deny surface emits exact reason codes', () => {
  const root = temp('deny');
  const expected = { Read: 'MAIN_DIRECT_READ_DENIED', Grep: 'MAIN_DIRECT_READ_DENIED', Glob: 'MAIN_DIRECT_READ_DENIED', Edit: 'MAIN_DIRECT_WRITE_DENIED', Write: 'MAIN_DIRECT_WRITE_DENIED', NotebookEdit: 'MAIN_DIRECT_WRITE_DENIED', Bash: 'MAIN_DIRECT_BASH_DENIED', WebSearch: 'MAIN_DIRECT_RESEARCH_DENIED', WebFetch: 'MAIN_DIRECT_RESEARCH_DENIED', Agent: 'MAIN_NATIVE_SUBAGENT_DENIED' };
  for (const [tool, code] of Object.entries(expected)) {
    const output = verdict(pre(root, tool));
    assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(output.hookSpecificOutput.permissionDecisionReason, new RegExp(`^${code}:`));
  }
});

test('scope uses path segments and resolves symlinks into the root', () => {
  const root = temp('scope'); const outside = temp('outside'); const sibling = `${root}-other`; mkdirSync(sibling); roots.push(sibling);
  for (const cwd of [outside, sibling]) { const r = runHook(root, { hook_event_name: 'PreToolUse', cwd, tool_name: 'Read', tool_input: {} }); assert.equal(r.status, 0); assert.equal(r.stdout, ''); }
  const link = join(outside, 'into-root'); symlinkSync(root, link, 'dir');
  const r = runHook(root, { hook_event_name: 'PreToolUse', cwd: link, tool_name: 'Read', tool_input: {} });
  assert.match(verdict(r).hookSpecificOutput.permissionDecisionReason, /^MAIN_DIRECT_READ_DENIED:/);
});

test('bound scope fails safe for ambiguous cwd and excludes only unambiguous outside paths', () => {
  const root = temp('cwd-root'); const outside = temp('cwd-out'); const link = join(root, 'link-out'); symlinkSync(outside, link, 'dir');
  for (const cwd of [undefined, null, '', 0, false, {}, [], 'relative', join(root, 'missing')]) assert.equal(inScope(cwd, root), true);
  const deletedOutside = join(outside, 'deleted');
  assert.equal(inScope(deletedOutside, root), false);
  assert.equal(inScope(`${root}/`, root), true);
  assert.equal(inScope(link, root), false);
  assert.equal(inScope(outside, root), false);
  for (const cwd of [undefined, null, '', 0, false, {}, [], 'relative', join(root, 'missing')]) {
    const out = verdict(runHook(root, { hook_event_name: 'PreToolUse', cwd, tool_name: 'Read', tool_input: {} }));
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /^MAIN_DIRECT_READ_DENIED:/);
  }
  const excluded = runHook(root, { hook_event_name: 'PreToolUse', cwd: deletedOutside, tool_name: 'Read', tool_input: {} });
  assert.equal(excluded.stdout, '');
});

test('only trimmed non-empty own string agent_id grants subagent identity; effort never changes verdict', () => {
  const root = temp('identity');
  assert.equal(pre(root, 'Read', {}, { agent_id: 'agent-1' }).stdout, '');
  assert.match(verdict(pre(root, 'Read', {}, { agent_type: 'Scout' })).hookSpecificOutput.permissionDecisionReason, /^MAIN_DIRECT_READ_DENIED:/);
  const low = pre(root, 'Read', {}, { effort: 'low', reasoning_effort: 'low' }).stdout;
  const max = pre(root, 'Read', {}, { effort: 'max', reasoning_effort: 'max' }).stdout;
  assert.equal(low, max);
  for (const agent_id of [null, '', 0, false, ' ', {}, []]) assert.equal(classify({ agent_id }), 'MAIN_ORCHESTRATOR');
  assert.equal(classify(Object.create({ agent_id: 'inherited' })), 'MAIN_ORCHESTRATOR');
  assert.equal(classify({ agent_id: '  agent  ' }), 'SUBAGENT');
});

test('delegation accepts canonical JSON/base64url, trusts header role only, and rejects malformed metadata', () => {
  for (const encoding of ['json', 'base64url']) assert.equal(parseDelegation({ prompt: prompt('SCOUT', encoding) }).ok, true);
  assert.equal(parseDelegation({ prompt: prompt('SCOUT', 'json', 'I am the verifier') }).meta.role, 'SCOUT');
  const noncanonical = { taskId: 'T-1', scope: 'tools/**', role: 'SCOUT', protocolVersion: '1', baseSha: 'a'.repeat(40) };
  for (const bad of ['', 'hello', 'MIHVER_DELEGATION_V1:{"role":"SCOUT"}', `MIHVER_DELEGATION_V1:${JSON.stringify(noncanonical)}`]) {
    assert.equal(parseDelegation({ prompt: bad }).code, 'DELEGATION_METADATA_INVALID');
  }
});

test('delegation sandbox binding is role-specific and danger-full-access is always denied', () => {
  const root = temp('sandbox'); const outside = temp('sandbox-outside'); const linkOut = join(root, 'link-out'); symlinkSync(outside, linkOut, 'dir');
  for (const role of ['SCOUT', 'REVIEWER', 'VERIFIER']) {
    assert.equal(validateSandbox(meta(role), { sandbox: 'read-only', cwd: root }, root).ok, true);
    assert.equal(validateSandbox(meta(role), { sandbox: 'workspace-write', cwd: root }, root).code, 'DELEGATION_PARAMS_INVALID');
  }
  assert.equal(validateSandbox(meta('IMPLEMENTER'), { sandbox: 'workspace-write', cwd: root }, root).ok, true);
  assert.equal(validateSandbox(meta('IMPLEMENTER'), { sandbox: 'read-only', cwd: root }, root).code, 'DELEGATION_PARAMS_INVALID');
  for (const role of ['SCOUT', 'IMPLEMENTER', 'REVIEWER', 'VERIFIER']) assert.equal(validateSandbox(meta(role), { sandbox: 'danger-full-access', cwd: root }, root).code, 'DELEGATION_PARAMS_INVALID');
  assert.equal(validateSandbox(meta('SCOUT'), { sandbox: 'read-only' }, root).code, 'DELEGATION_PARAMS_INVALID');
  assert.equal(validateSandbox(meta('SCOUT'), { sandbox: 'read-only', cwd: join(root, 'missing') }, root).code, 'DELEGATION_PARAMS_INVALID');
  assert.equal(validateSandbox(meta('SCOUT'), { sandbox: 'read-only', cwd: linkOut }, root).code, 'DELEGATION_PARAMS_INVALID');
  assert.equal(validateSandbox(meta('SCOUT'), { sandbox: 'read-only', cwd: root, config: {} }, root).ok, true);
  assert.equal(validateSandbox(meta('SCOUT'), { sandbox: 'read-only', cwd: root, config: { sandbox_mode: 'workspace-write' } }, root).code, 'DELEGATION_PARAMS_INVALID');
  for (const value of ['never', 'on-request']) assert.equal(validateSandbox(meta('SCOUT'), { sandbox: 'read-only', cwd: root, 'approval-policy': value }, root).ok, true);
  assert.equal(validateSandbox(meta('SCOUT'), { sandbox: 'read-only', cwd: root, 'approval-policy': 'always' }, root).code, 'DELEGATION_PARAMS_INVALID');
});

test('STARTED and terminal receipts cover every role, failure, and immutable STARTED authority', () => {
  const root = temp('receipts'); const file = join(root, 'ledger.jsonl');
  for (const [index, role] of ['SCOUT', 'IMPLEMENTER', 'VERIFIER'].entries()) {
    const parsed = parseDelegation({ prompt: prompt(role) }); const input = { session_id: 's', prompt_id: 'p', tool_use_id: `u${index}`, tool_name: 'mcp__codex__codex', tool_input: {}, tool_response: { ok: true } };
    appendStarted(file, input, parsed, `2026-01-01T00:00:0${index}.000Z`);
    input.tool_input.prompt = prompt('VERIFIER');
    appendCompletion(file, input, role === 'SCOUT' ? 'FAILED' : 'COMPLETED', { completedAt: `2026-01-01T00:00:1${index}.000Z`, workspaceFingerprint: 'fp' });
  }
  const records = verifyChain(file).records;
  assert.equal(records.find((r) => r.toolUseId === 'u0' && r.status === 'COMPLETED'), undefined);
  assert.equal(records.find((r) => r.toolUseId === 'u0' && r.status === 'FAILED').role, 'SCOUT');
  assert.equal(records.find((r) => r.toolUseId === 'u1' && r.status === 'COMPLETED').role, 'IMPLEMENTER');
  assert.equal(records.find((r) => r.toolUseId === 'u2' && r.status === 'COMPLETED').role, 'VERIFIER');
});

test('STARTED receipts hash optional instruction/model parameters and REVIEWER completes', () => {
  const root = temp('audit-receipt');
  const tool_input = { prompt: prompt('REVIEWER'), sandbox: 'read-only', cwd: root, 'base-instructions': 'base', 'developer-instructions': 'dev', model: 'model-x' };
  assert.equal(pre(root, 'mcp__codex__codex', tool_input).stdout, '');
  const done = runHook(root, { hook_event_name: 'PostToolUse', cwd: root, session_id: 's', prompt_id: 'p', tool_use_id: 'u-mcp__codex__codex', tool_name: 'mcp__codex__codex', tool_input, tool_response: { threadId: 'review-thread', result: 'ok' } });
  assert.equal(done.status, 0, done.stderr);
  const records = verifyChain(join(root, 'runtime-home/runtime/s/p/ledger.jsonl')).records;
  const started = records.find((r) => r.status === 'STARTED');
  assert.equal(started.role, 'REVIEWER');
  for (const key of ['base-instructionsHash', 'developer-instructionsHash', 'modelHash']) assert.match(started[key], /^[0-9a-f]{64}$/);
  assert.equal(records.find((r) => r.status === 'COMPLETED').role, 'REVIEWER');
});

test('thread authority denies unknown, unbound, and relabeled replies', () => {
  const root = temp('thread-authority');
  const initial = { prompt: prompt('IMPLEMENTER'), sandbox: 'workspace-write', cwd: root };
  assert.equal(pre(root, 'mcp__codex__codex', initial).stdout, '');
  runHook(root, { hook_event_name: 'PostToolUse', cwd: root, session_id: 's', prompt_id: 'p', tool_use_id: 'u-mcp__codex__codex', tool_name: 'mcp__codex__codex', tool_input: initial, tool_response: { threadId: 'impl-thread' } });
  const mismatch = verdict(pre(root, 'mcp__codex__codex-reply', { prompt: prompt('VERIFIER'), threadId: 'impl-thread' }));
  assert.match(mismatch.hookSpecificOutput.permissionDecisionReason, /^DELEGATION_THREAD_AUTHORITY_MISMATCH:/);
  const unknown = verdict(pre(root, 'mcp__codex__codex-reply', { prompt: prompt('IMPLEMENTER'), threadId: 'unknown' }));
  assert.match(unknown.hookSpecificOutput.permissionDecisionReason, /^DELEGATION_THREAD_AUTHORITY_MISMATCH:/);
  const valid = pre(root, 'mcp__codex__codex-reply', { prompt: prompt('IMPLEMENTER'), threadId: 'impl-thread' });
  assert.equal(valid.stdout, '');
  const root2 = temp('thread-unbound'); const unbound = { prompt: prompt('SCOUT'), sandbox: 'read-only', cwd: root2 };
  pre(root2, 'mcp__codex__codex', unbound);
  runHook(root2, { hook_event_name: 'PostToolUse', cwd: root2, session_id: 's', prompt_id: 'p', tool_use_id: 'u-mcp__codex__codex', tool_name: 'mcp__codex__codex', tool_input: unbound, tool_response: { result: 'no id' } });
  const denied = verdict(pre(root2, 'mcp__codex__codex-reply', { prompt: prompt('SCOUT'), threadId: 'anything' }));
  assert.match(denied.hookSpecificOutput.permissionDecisionReason, /^DELEGATION_THREAD_AUTHORITY_MISMATCH:/);
});

test('thread extraction is top-level exact and conflicting bindings poison authority', () => {
  const cases = [
    [{ threadId: 'top', structuredContent: { threadId: 'nested' } }, 'top'],
    [{ structuredContent: { threadId: 'nested' } }, null],
    [{ content: [{ text: '{"threadId":"string-id"}' }] }, null],
    [{ result: 'missing' }, null],
  ];
  for (const [index, [tool_response, expected]] of cases.entries()) {
    const root = temp(`thread-shape-${index}`); const tool_input = { prompt: prompt('SCOUT'), sandbox: 'read-only', cwd: root };
    pre(root, 'mcp__codex__codex', tool_input);
    runHook(root, { hook_event_name: 'PostToolUse', cwd: root, session_id: 's', prompt_id: 'p', tool_use_id: 'u-mcp__codex__codex', tool_name: 'mcp__codex__codex', tool_input, tool_response });
    const records = verifyChain(join(root, 'runtime-home/runtime/threads.jsonl')).records;
    assert.equal(records.at(-1).status, expected ? 'BOUND' : 'UNBOUND');
    assert.equal(records.at(-1).threadId, expected);
  }

  const root = temp('thread-conflict'); const store = join(root, 'threads.jsonl');
  appendThreadBinding(store, { threadId: 'shared', role: 'IMPLEMENTER', taskId: 'T-1', scopeHash: 'scope', baseSha: 'base' });
  appendThreadBinding(store, { threadId: 'shared', role: 'VERIFIER', taskId: 'T-1', scopeHash: 'scope', baseSha: 'base' });
  assert.deepEqual(verifyChain(store).records.map((record) => record.status), ['BOUND', 'THREAD_BINDING_CONFLICT']);
  assert.equal(findThreadBinding(store, 'shared'), null);
  const oldest = join(root, 'oldest.jsonl');
  appendThreadBinding(oldest, { threadId: 'once', role: 'IMPLEMENTER' });
  // Simulate a legacy/pre-hardening store containing two BOUND records.
  appendRecord(oldest, { threadId: 'once', role: 'VERIFIER', status: 'BOUND' });
  assert.equal(findThreadBinding(oldest, 'once').role, 'IMPLEMENTER');
});

test('an IMPLEMENTER thread cannot acquire VERIFIER authority or mint its receipt', () => {
  const root = temp('thread-e2e');
  const create = (role, id) => {
    const tool_input = { prompt: prompt(role), sandbox: role === 'IMPLEMENTER' ? 'workspace-write' : 'read-only', cwd: root };
    assert.equal(runHook(root, { hook_event_name: 'PreToolUse', cwd: root, session_id: 's', prompt_id: 'p', tool_use_id: id, tool_name: 'mcp__codex__codex', tool_input }).stdout, '');
    runHook(root, { hook_event_name: 'PostToolUse', cwd: root, session_id: 's', prompt_id: 'p', tool_use_id: id, tool_name: 'mcp__codex__codex', tool_input, tool_response: { threadId: 'impl-thread' } });
  };
  create('IMPLEMENTER', 'create-impl');
  create('VERIFIER', 'create-verifier-conflict');
  const denied = verdict(runHook(root, { hook_event_name: 'PreToolUse', cwd: root, session_id: 's', prompt_id: 'p', tool_use_id: 'reply', tool_name: 'mcp__codex__codex-reply', tool_input: { prompt: prompt('VERIFIER'), threadId: 'impl-thread' } }));
  assert.match(denied.hookSpecificOutput.permissionDecisionReason, /^DELEGATION_THREAD_AUTHORITY_MISMATCH:/);
  assert.equal(verifyChain(join(root, 'runtime-home/runtime/s/p/ledger.jsonl')).records.some((record) => record.toolUseId === 'reply' && record.status === 'STARTED'), false);
});

test('delegated effort values have identical policy outcomes', () => {
  for (const effort of ['low', 'max']) {
    const root = temp(`delegated-${effort}`);
    const r = pre(root, 'mcp__codex__codex', { prompt: prompt('SCOUT'), sandbox: 'read-only', cwd: root, effort, reasoning_effort: effort });
    assert.equal(r.stdout, '');
  }
});

test('permission_mode values have identical policy outcomes', () => {
  const root = temp('permission-mode');
  const outputs = ['default', 'plan', 'bypassPermissions'].map((permission_mode) =>
    pre(root, 'Read', {}, { permission_mode }).stdout);
  assert.ok(outputs.every((output) => output === outputs[0]));
});

test('invalid delegation denies and creates no valid receipt', () => {
  const root = temp('invalid'); const r = verdict(pre(root, 'mcp__codex__codex', { prompt: 'bad', sandbox: 'read-only', cwd: root })); assert.equal(r.hookSpecificOutput.permissionDecision, 'deny'); assert.match(r.hookSpecificOutput.permissionDecisionReason, /^DELEGATION_METADATA_INVALID:/);
  const ledger = join(root, 'runtime-home/runtime/s/p/ledger.jsonl'); const records = verifyChain(ledger).records;
  assert.deepEqual(records.map((x) => x.status), ['DELEGATION_METADATA_INVALID']);
});

test('invalid metadata on codex-reply is denied and cannot create a receipt', () => {
  const root = temp('invalid-reply');
  const out = verdict(pre(root, 'mcp__codex__codex-reply', { prompt: 'bad', threadId: 'thread' }));
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /^DELEGATION_METADATA_INVALID:/);
  assert.deepEqual(verifyChain(join(root, 'runtime-home/runtime/s/p/ledger.jsonl')).records.map((record) => record.status), ['DELEGATION_METADATA_INVALID']);
});

test('dispatcher records FAILED (never COMPLETED) and fails closed on an in-scope internal error', () => {
  const root = temp('dispatch-failure');
  const start = pre(root, 'mcp__codex__codex', { prompt: prompt('SCOUT'), sandbox: 'read-only', cwd: root }); assert.equal(start.stdout, '');
  const failed = runHook(root, { hook_event_name: 'PostToolUseFailure', cwd: root, session_id: 's', prompt_id: 'p', tool_use_id: 'u-mcp__codex__codex', tool_name: 'mcp__codex__codex', error: 'executor failed' }); assert.equal(failed.status, 0); assert.equal(failed.stdout, '');
  const ledger = join(root, 'runtime-home/runtime/s/p/ledger.jsonl'); const statuses = verifyChain(ledger).records.map((r) => r.status); assert.deepEqual(statuses, ['STARTED', 'FAILED']);
  writeFileSync(ledger, '{corrupt}\n');
  const closed = verdict(pre(root, 'mcp__codex__codex', { prompt: prompt('SCOUT'), sandbox: 'read-only', cwd: root }));
  assert.equal(closed.hookSpecificOutput.permissionDecision, 'deny'); assert.match(closed.hookSpecificOutput.permissionDecisionReason, /^FIREWALL_INTERNAL_ERROR:/);
});

test('hash chain detects mutation, reorder, middle truncation, and final-record truncation', () => {
  const make = () => { const root = temp('chain'); const file = join(root, 'l.jsonl'); for (let i = 0; i < 3; i++) appendRecord(file, { value: i }); return file; };
  let file = make(); let lines = readFileSync(file, 'utf8').trim().split('\n'); const changed = JSON.parse(lines[1]); changed.value = 99; lines[1] = JSON.stringify(changed); writeFileSync(file, `${lines.join('\n')}\n`); assert.equal(verifyChain(file).ok, false);
  file = make(); lines = readFileSync(file, 'utf8').trim().split('\n'); [lines[0], lines[1]] = [lines[1], lines[0]]; writeFileSync(file, `${lines.join('\n')}\n`); assert.equal(verifyChain(file).ok, false);
  for (const count of [1, 2]) { file = make(); lines = readFileSync(file, 'utf8').trim().split('\n'); writeFileSync(file, `${lines.slice(0, count).join('\n')}\n`); assert.equal(verifyChain(file).ok, false); }
});

test('Stop gate enforces implementer, later fresh verifier, replay binding, stale state, and block cap', () => {
  const base = { baselineFingerprint: 'old', currentFingerprint: 'new', sessionId: 's', promptId: 'p' };
  const rec = (role, completedAt, extras = {}) => ({ role, status: 'COMPLETED', completedAt, sessionId: 's', promptId: 'p', ...extras });
  assert.equal(decideStop({ ...base, records: [] }).reason, 'IMPLEMENTER_REQUIRED');
  assert.equal(decideStop({ ...base, records: [rec('IMPLEMENTER', '2')] }).reason, 'VERIFIER_REQUIRED');
  assert.equal(decideStop({ ...base, records: [rec('VERIFIER', '1', { workspaceFingerprint: 'new' }), rec('IMPLEMENTER', '2')] }).reason, 'VERIFIER_REQUIRED');
  assert.equal(decideStop({ ...base, records: [rec('IMPLEMENTER', '1'), rec('VERIFIER', '2', { workspaceFingerprint: 'older' })] }).reason, 'VERIFIER_STALE');
  assert.equal(decideStop({ ...base, records: [rec('IMPLEMENTER', '1'), rec('VERIFIER', '2', { workspaceFingerprint: 'new' })] }).decision, 'allow');
  assert.equal(decideStop({ ...base, currentFingerprint: 'newer', records: [rec('IMPLEMENTER', '1'), rec('VERIFIER', '2', { workspaceFingerprint: 'new' })] }).reason, 'VERIFIER_STALE');
  assert.equal(decideStop({ ...base, records: [rec('IMPLEMENTER', '1', { sessionId: 'other' }), rec('VERIFIER', '2', { promptId: 'other', workspaceFingerprint: 'new' })] }).reason, 'IMPLEMENTER_REQUIRED');
  assert.equal(decideStop({ ...base, records: [], blockCount: 999, maxBlocks: 3, stopHookActive: true }).decision, 'block');
  assert.equal(decideStop({ ...base, baselineFingerprint: 'new', records: [] }).decision, 'allow');
});

test('Stop dispatcher never self-releases and records every blocked attempt', () => {
  const root = initRepo('stop-dispatch');
  assert.equal(runHook(root, { hook_event_name: 'UserPromptSubmit', cwd: root, session_id: 's', prompt_id: 'p' }).status, 0);
  writeFileSync(join(root, 'tracked.txt'), 'changed\n');
  for (let index = 0; index < 5; index += 1) {
    const r = runHook(root, { hook_event_name: 'Stop', cwd: root, session_id: 's', prompt_id: 'p', stop_hook_active: index > 0 });
    assert.equal(JSON.parse(r.stdout).decision, 'block');
  }
  const records = verifyChain(join(root, 'runtime-home/runtime/s/p/ledger.jsonl')).records;
  assert.equal(records.filter((record) => record.status === 'STOP_BLOCKED').length, 5);
  assert.equal(records.some((record) => record.status === 'STOP_UNRESOLVED'), false);
});

test('protected paths deny subagent writes and common Bash forms while documenting heuristic evasion', () => {
  const root = temp('protected'); const runtime = join(root, 'runtime-home');
  for (const file_path of [join(runtime, 'anything'), join(runtime, '.claude/settings.json')]) {
    const out = verdict(pre(root, 'Write', { file_path }, { agent_id: 'sub' })); assert.match(out.hookSpecificOutput.permissionDecisionReason, /^PROTECTED_PATH_WRITE_DENIED:/);
  }
  for (const command of [`rm -rf ${runtime}`, 'printf x > ~/.claude/settings.json', 'printf x > $HOME/.claude/settings.json']) {
    const out = verdict(pre(root, 'Bash', { command }, { agent_id: 'sub' })); assert.match(out.hookSpecificOutput.permissionDecisionReason, /^PROTECTED_PATH_BASH_DENIED:/);
  }
  // Known boundary: computed/obfuscated shell paths evade the heuristic; this is not an OS sandbox.
  assert.equal(pre(root, 'Bash', { command: "p='.cl'+'aude/settings.json'; eval write $p" }, { agent_id: 'sub' }).stdout, '');
  for (const tool of ['Edit', 'NotebookEdit']) for (const file_path of [join(root, '.claude/settings.json'), join(root, '.claude/settings.local.json')]) {
    const out = verdict(pre(root, tool, { file_path }, { agent_id: 'sub' }));
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /^PROTECTED_PATH_WRITE_DENIED:/);
  }
});

test('ConfigChange blocks firewall-affecting settings except managed policy and passes unrelated edits', () => {
  const root = temp('config'); const settings = join(root, 'settings.json');
  for (const value of [{ disableAllHooks: true }, { allowManagedHooksOnly: true }, { hooks: { PreToolUse: [{ hooks: [{ command: 'mihver-firewall hook' }] }] } }]) {
    writeFileSync(settings, JSON.stringify(value)); const r = runHook(root, { hook_event_name: 'ConfigChange', cwd: root, source: 'user_settings', file_path: settings }); assert.equal(r.status, 2); assert.match(r.stderr, /MIHVER_CONFIG_CHANGE_DENIED/);
  }
  writeFileSync(settings, JSON.stringify({ disableAllHooks: true })); assert.equal(runHook(root, { hook_event_name: 'ConfigChange', cwd: root, source: 'policy_settings', file_path: settings }).status, 0);
  writeFileSync(settings, JSON.stringify({ theme: 'dark' })); const pass = runHook(root, { hook_event_name: 'ConfigChange', cwd: root, source: 'user_settings', file_path: settings }); assert.equal(pass.status, 0); assert.equal(pass.stdout, ''); assert.equal(pass.stderr, '');
  for (const source of ['user_settings', 'project_settings', 'local_settings']) {
    for (const file_path of [join(root, `missing-${source}.json`), root]) {
      const denied = runHook(root, { hook_event_name: 'ConfigChange', cwd: root, source, file_path }); assert.equal(denied.status, 2); assert.match(denied.stderr, /unreadable or malformed/);
    }
    writeFileSync(settings, '{broken'); const malformed = runHook(root, { hook_event_name: 'ConfigChange', cwd: root, source, file_path: settings }); assert.equal(malformed.status, 2);
  }
  assert.equal(runHook(root, { hook_event_name: 'ConfigChange', cwd: root, source: 'skills', file_path: join(root, 'missing') }).status, 0);
});

test('delegation config rejects type confusion and nested overrides', () => {
  const root = temp('config-types');
  for (const config of ['sandbox_mode=read-only', [], null, { nested: { sandbox_mode: 'read-only' } }]) {
    const out = verdict(pre(root, 'mcp__codex__codex', { prompt: prompt('SCOUT'), sandbox: 'read-only', cwd: root, config }));
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /^DELEGATION_PARAMS_INVALID:/);
  }
  const initial = { prompt: prompt('SCOUT'), sandbox: 'read-only', cwd: root };
  pre(root, 'mcp__codex__codex', initial);
  runHook(root, { hook_event_name: 'PostToolUse', cwd: root, session_id: 's', prompt_id: 'p', tool_use_id: 'u-mcp__codex__codex', tool_name: 'mcp__codex__codex', tool_input: initial, tool_response: { threadId: 'config-thread' } });
  for (const config of ['sandbox_mode=read-only', [], null, { nested: { sandbox_mode: 'read-only' } }]) {
    const out = verdict(pre(root, 'mcp__codex__codex-reply', { prompt: prompt('SCOUT'), threadId: 'config-thread', config }));
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /^DELEGATION_PARAMS_INVALID:/);
  }
});

test('fingerprint is stable and covers tracked, staged, untracked lifecycle/content while honoring gitignore', () => {
  const root = initRepo('fingerprint'); const fp = () => computeFingerprint(root).fingerprint; const initial = fp(); assert.equal(fp(), initial);
  writeFileSync(join(root, 'tracked.txt'), 'two\n'); const edited = fp(); assert.notEqual(edited, initial);
  git(root, ['add', 'tracked.txt']); const staged = fp(); assert.notEqual(staged, edited);
  writeFileSync(join(root, 'new.txt'), 'a'); const added = fp(); assert.notEqual(added, staged); writeFileSync(join(root, 'new.txt'), 'b'); const content = fp(); assert.notEqual(content, added); rmSync(join(root, 'new.txt')); assert.equal(fp(), staged);
  writeFileSync(join(root, '.gitignore'), 'ignored.txt\n'); git(root, ['add', '.gitignore']); git(root, ['commit', '-qm', 'ignore']); const beforeIgnored = fp(); writeFileSync(join(root, 'ignored.txt'), 'secret'); assert.equal(fp(), beforeIgnored);
});

function installRun(home, mode) { return spawnSync(process.execPath, [installer, mode, '--home', home, '--repo-root', repoRoot], { encoding: 'utf8', cwd: repoRoot, env: { ...process.env, HOME: home } }); }
function installRunRepo(home, mode, sourceRoot) { return spawnSync(process.execPath, [installer, mode, '--home', home, '--repo-root', sourceRoot], { encoding: 'utf8', cwd: sourceRoot, env: { ...process.env, HOME: home } }); }

function installedFixture(label) {
  const home = temp(label); assert.equal(installRun(home, '--install').status, 0);
  const trustRoot = join(home, '.claude/mihver-firewall');
  const bookkeepingPath = join(trustRoot, 'manifest.json');
  const manifest = JSON.parse(readFileSync(bookkeepingPath, 'utf8'));
  const entry = manifest.installedEntry;
  const manifestPath = join(dirname(entry), manifest.manifestFilename);
  return { home, trustRoot, entry, manifest, manifestPath, bookkeepingPath };
}

function runInstalled(fixture) {
  return spawnSync(process.execPath, [fixture.entry], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: repoRoot, tool_name: 'Read', tool_input: {} }),
    encoding: 'utf8', cwd: repoRoot,
    env: { ...process.env, MIHVER_FIREWALL_HOME: temp('hostile-home'), MIHVER_FIREWALL_CANONICAL_ROOT: temp('hostile-root') },
  });
}

test('installed binding cannot be demoted and manifest/runtime drift fails closed before engine import', () => {
  const variants = [
    ['deleted', (fixture) => rmSync(fixture.manifestPath)],
    ['missing-fields', (fixture) => writeFileSync(fixture.manifestPath, '{}')],
    ['malformed', (fixture) => writeFileSync(fixture.manifestPath, '{bad')],
    ['executable-only', (fixture) => {
      const relativeEntry = `bin/${fixture.entry.split('/').at(-1)}`;
      writeFileSync(fixture.manifestPath, JSON.stringify({ ...fixture.manifest, files: { [relativeEntry]: sha256(readFileSync(fixture.entry)) } }));
    }],
    ['stale-root', (fixture) => writeFileSync(fixture.manifestPath, JSON.stringify({ ...fixture.manifest, canonicalMihverRoot: temp('stale-root') }))],
  ];
  for (const [label, prepareManifest] of variants) {
    const fixture = installedFixture(`installed-${label}`); prepareManifest(fixture);
    const result = runInstalled(fixture); const out = verdict(result);
    assert.ok(out, `${label}: expected denial; stderr=${result.stderr}`);
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /^FIREWALL_MANIFEST_INVALID:/);
    if (label === 'executable-only') {
      const status = installRun(fixture.home, '--status');
      assert.equal(status.status, 2); assert.match(status.stdout, /^DRIFTED/m);
    }
  }
  for (const [label, mutate] of [
    ['policy-tamper', (fixture) => writeFileSync(join(fixture.manifest.engineDir, 'policy.mjs'), '\nexport const mainToolVerdict = () => null;\n')],
    ['extra-engine', (fixture) => writeFileSync(join(fixture.manifest.engineDir, 'unlisted.mjs'), 'throw new Error("must not execute");\n')],
  ]) {
    const fixture = installedFixture(label); mutate(fixture);
    const out = verdict(runInstalled(fixture));
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /^FIREWALL_(?:DRIFT_DETECTED|MANIFEST_INVALID):/);
  }
});

test('installer dry-run is non-mutating and preserves unrelated settings/hooks in its plan', () => {
  const home = temp('dryhome'); const claude = join(home, '.claude'); mkdirSync(claude); const settings = { theme: 'dark', hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'third-party', timeout: 5 }] }] } }; const raw = JSON.stringify(settings); writeFileSync(join(claude, 'settings.json'), raw);
  const r = installRun(home, '--dry-run'); assert.equal(r.status, 0, r.stderr); assert.equal(readFileSync(join(claude, 'settings.json'), 'utf8'), raw); assert.equal(existsSync(join(claude, 'mihver-firewall')), false); assert.match(r.stdout, /third-party/); assert.match(r.stdout, /"theme": "dark"/);
});

test('installer fails closed on malformed settings without writes', () => {
  const home = temp('badsettings'); const claude = join(home, '.claude'); mkdirSync(claude); const file = join(claude, 'settings.json'); const raw = '{bad json\n'; writeFileSync(file, raw);
  const r = installRun(home, '--install'); assert.notEqual(r.status, 0); assert.equal(readFileSync(file, 'utf8'), raw); assert.equal(existsSync(join(claude, 'mihver-firewall')), false);
});

test('status reports DRIFTED when installed hooks remain but per-executable manifest is missing', () => {
  const home = temp('missing-manifest');
  assert.equal(installRun(home, '--install').status, 0);
  const manifest = JSON.parse(readFileSync(join(home, '.claude/mihver-firewall/manifest.json'), 'utf8'));
  rmSync(`${manifest.installedEntry}.manifest.json`);
  const status = installRun(home, '--status');
  assert.equal(status.status, 2); assert.match(status.stdout, /^DRIFTED/m);
});

test('status reports DRIFTED for a changed sourceCommit', () => {
  const fixture = installedFixture('source-commit-drift');
  writeFileSync(fixture.manifestPath, JSON.stringify({ ...fixture.manifest, sourceCommit: '0'.repeat(40) }));
  const status = installRun(fixture.home, '--status');
  assert.equal(status.status, 2);
  assert.match(status.stdout, /manifest source commit differs from the executable binding/);
});

test('status and runtime manifest validation stay in parity', () => {
  const mutations = [
    ['wrong protocolVersion', (fixture) => ({ ...fixture.manifest, protocolVersion: 'wrong' }), /protocol version/],
    ['wrong firewallVersion', (fixture) => ({ ...fixture.manifest, firewallVersion: 'wrong' }), /firewall version/],
    ['wrong sourceCommit', (fixture) => ({ ...fixture.manifest, sourceCommit: '0'.repeat(40) }), /source commit/],
    ['wrong content hash', (fixture) => ({ ...fixture.manifest, files: { ...fixture.manifest.files, [Object.keys(fixture.manifest.files)[0]]: '0'.repeat(64) } }), /file hash differs/],
    ['missing file entry', (fixture) => { const files = { ...fixture.manifest.files }; delete files[Object.keys(files)[0]]; return { ...fixture.manifest, files }; }, /unexpected manifest-tracked file observation/],
    ['extra unlisted file', (fixture) => { writeFileSync(join(fixture.manifest.engineDir, 'unlisted.mjs'), 'throw new Error("must not execute");\n'); return fixture.manifest; }, /unexpected manifest-tracked file observation/],
    ['wrong canonical root', (fixture) => ({ ...fixture.manifest, canonicalMihverRoot: temp('wrong-canonical') }), /different canonical MIHVER root/],
    ['wrong trust root', (fixture) => ({ ...fixture.manifest, trustRoot: temp('wrong-trust') }), /trust root/],
    ['wrong engine directory', (fixture) => ({ ...fixture.manifest, engineDir: temp('wrong-engine') }), /engine directory/],
    ['wrong manifest filename', (fixture) => ({ ...fixture.manifest, manifestFilename: 'wrong.json' }), /filename binding/],
    ['wrong installed entry', (fixture) => ({ ...fixture.manifest, installedEntry: join(fixture.trustRoot, 'bin/wrong.mjs') }), /executable path/],
    ['wrong validator hash', (fixture) => ({ ...fixture.manifest, validatorHash: '0'.repeat(64) }), /validator hash/],
    ['wrong validator version', (fixture) => ({ ...fixture.manifest, validatorVersion: 'old' }), /validator version/],
    ['null engine directory', (fixture) => ({ ...fixture.manifest, engineDir: null }), /engineDir.*invalid type/],
    ['numeric installed entry', (fixture) => ({ ...fixture.manifest, installedEntry: 7 }), /installedEntry.*invalid type/],
    ['array manifest filename', (fixture) => ({ ...fixture.manifest, manifestFilename: [] }), /manifestFilename.*invalid type/],
    ['object trust root', (fixture) => ({ ...fixture.manifest, trustRoot: {} }), /trustRoot.*invalid type/],
    ['invalid files type', (fixture) => ({ ...fixture.manifest, files: [] }), /file map/],
    ['invalid hash type', (fixture) => ({ ...fixture.manifest, files: { ...fixture.manifest.files, [Object.keys(fixture.manifest.files)[0]]: null } }), /file entry is invalid/],
    ...Array.from({ length: 10 }, (_, index) => [
      `wrong content hash ${index}`,
      (fixture) => ({ ...fixture.manifest, files: { ...fixture.manifest.files, [Object.keys(fixture.manifest.files)[index]]: '0'.repeat(64) } }),
      /file hash differs/,
    ]),
    ['null manifest', () => null, /top level/],
    ['array manifest', () => [], /top level/],
    ['numeric manifest', () => 7, /top level/],
  ];
  for (const [label, mutate, reason] of mutations) {
    const fixture = installedFixture(`parity-${label.replaceAll(' ', '-')}`);
    writeFileSync(fixture.manifestPath, JSON.stringify(mutate(fixture)));
    const status = installRun(fixture.home, '--status');
    assert.equal(status.status, 2, `${label}: ${status.stdout}\n${status.stderr}`);
    assert.match(status.stdout, reason, label);
    const runtime = verdict(runInstalled(fixture));
    assert.match(runtime.hookSpecificOutput.permissionDecisionReason, /^FIREWALL_(?:MANIFEST_INVALID|DRIFT_DETECTED):/, label);
  }
});

test('status never crashes on unreadable or non-JSON executable manifests and runtime fails closed', () => {
  for (const [label, bytes] of [['non-json', '{bad'], ['unreadable', null]]) {
    const fixture = installedFixture(`parity-${label}`);
    if (bytes === null) rmSync(fixture.manifestPath);
    else writeFileSync(fixture.manifestPath, bytes);
    const status = installRun(fixture.home, '--status');
    assert.equal(status.status, 2);
    assert.match(status.stdout, /^DRIFTED/m);
    assert.doesNotMatch(status.stderr, /ERR_INVALID_ARG_TYPE|TypeError/);
    assert.match(verdict(runInstalled(fixture)).hookSpecificOutput.permissionDecisionReason, /^FIREWALL_MANIFEST_INVALID:/);
  }
});

test('status reports validator generation drift instead of speaking for an older loader', () => {
  const fixture = installedFixture('validator-generation');
  const source = readFileSync(fixture.entry, 'utf8').replace(/"validatorVersion":"2"/, '"validatorVersion":"1"');
  writeFileSync(fixture.entry, source);
  const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
  const relativeEntry = Object.keys(manifest.files).find((name) => name.startsWith('bin/'));
  manifest.files[relativeEntry] = sha256(source);
  writeFileSync(fixture.manifestPath, JSON.stringify(manifest));
  const status = installRun(fixture.home, '--status');
  assert.equal(status.status, 2);
  assert.match(status.stdout, /different generation/);
  assert.match(status.stdout, /registered validator: hash=.* version=1/);
  assert.match(status.stdout, /current validator: hash=.* version=2/);
  assert.match(status.stdout, /re-run --install/);
  assert.match(verdict(runInstalled(fixture)).hookSpecificOutput.permissionDecisionReason, /^FIREWALL_MANIFEST_INVALID:/);
});

test('status notes orphaned artifacts when no owned hooks are registered', () => {
  const home = temp('orphan-status');
  mkdirSync(join(home, '.claude/mihver-firewall'), { recursive: true });
  const status = installRun(home, '--status');
  assert.equal(status.status, 0);
  assert.match(status.stdout, /^NOT_INSTALLED — orphaned firewall artifacts are present/m);
});

test('install/status/tamper/uninstall preserve third-party state and directly executable entry', async () => {
  const home = temp('installhome'); const claude = join(home, '.claude'); mkdirSync(claude); const third = { hooks: [{ type: 'command', command: 'third-party', timeout: 5 }] }; writeFileSync(join(claude, 'settings.json'), JSON.stringify({ theme: 'dark', hooks: { PreToolUse: [third] } }));
  let r = installRun(home, '--install'); assert.equal(r.status, 0, r.stderr); assert.match(installRun(home, '--status').stdout, /^INSTALLED/m);
  const manifest = JSON.parse(readFileSync(join(claude, 'mihver-firewall/manifest.json'), 'utf8')); const mode = (await import('node:fs/promises')).stat(manifest.installedEntry).then((s) => s.mode & 0o777); assert.equal(await mode, 0o755);
  r = spawnSync(manifest.installedEntry, [], { input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: repoRoot, tool_name: 'Read', tool_input: {} }), encoding: 'utf8', cwd: repoRoot, env: { ...process.env, MIHVER_FIREWALL_HOME: join(home, 'attacker-home'), MIHVER_FIREWALL_CANONICAL_ROOT: home } }); assert.equal(r.status, 0, r.stderr); assert.match(JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason, /^MAIN_DIRECT_READ_DENIED:/);
  const removedHooks = join(home, 'removed-hooks.json'); writeFileSync(removedHooks, JSON.stringify({ theme: 'dark', hooks: {} }));
  r = spawnSync(manifest.installedEntry, [], { input: JSON.stringify({ hook_event_name: 'ConfigChange', cwd: repoRoot, source: 'user_settings', file_path: removedHooks }), encoding: 'utf8', cwd: repoRoot, env: { ...process.env, MIHVER_FIREWALL_HOME: join(claude, 'mihver-firewall'), MIHVER_FIREWALL_CANONICAL_ROOT: repoRoot } }); assert.equal(r.status, 2); assert.match(r.stderr, /MIHVER_CONFIG_CHANGE_DENIED/);
  const installedSource = Object.keys(manifest.files).find((x) => x.endsWith('/policy.mjs')); writeFileSync(join(claude, 'mihver-firewall', installedSource), '\n// tamper\n', { flag: 'a' }); r = installRun(home, '--status'); assert.equal(r.status, 2); assert.match(r.stdout, /DRIFTED/); assert.match(r.stdout, /protection is NOT in effect/);
  r = installRun(home, '--uninstall'); assert.equal(r.status, 0, r.stderr); const after = JSON.parse(readFileSync(join(claude, 'settings.json'), 'utf8')); assert.equal(after.theme, 'dark'); assert.deepEqual(after.hooks.PreToolUse, [third]); assert.ok(readdirSync(join(claude, 'mihver-firewall/backups')).length >= 2);
});

test('installer ownership convention preserves forged marker outside prefix and collapses duplicate owned entries', () => {
  const home = temp('ownership'); const claude = join(home, '.claude'); mkdirSync(claude);
  const trust = join(claude, 'mihver-firewall'); const marker = ' # MIHVER_OWNER=orchestrator-firewall-v1';
  const forged = { hooks: [{ type: 'command', command: `${JSON.stringify(join(home, 'elsewhere.mjs'))}${marker}`, timeout: 10 }] };
  const owned = { hooks: [{ type: 'command', command: `${JSON.stringify(join(trust, 'bin/old.mjs'))}${marker}`, timeout: 10 }] };
  writeFileSync(join(claude, 'settings.json'), JSON.stringify({ hooks: { PreToolUse: [forged, owned, owned] } }));
  const r = installRun(home, '--install'); assert.equal(r.status, 0, r.stderr);
  const settings = JSON.parse(readFileSync(join(claude, 'settings.json'), 'utf8'));
  assert.equal(settings.hooks.PreToolUse.filter((entry) => entry.hooks[0].command === forged.hooks[0].command).length, 1);
  assert.equal(settings.hooks.PreToolUse.length, 2);
});

test('upgrade abort leaves old manifest and settings mutually consistent', async () => {
  const home = temp('concurrent'); const claude = join(home, '.claude'); mkdirSync(claude); const settingsPath = join(claude, 'settings.json');
  writeFileSync(settingsPath, '{"theme":"before"}\n');
  assert.equal(installRun(home, '--install').status, 0);
  const manifestPath = join(claude, 'mihver-firewall/manifest.json');
  const oldManifestBytes = readFileSync(manifestPath, 'utf8'); const oldManifest = JSON.parse(oldManifestBytes);
  const { install } = await import(`${pathToFileURL(installer).href}?concurrent-test=1`);
  await assert.rejects(install({ home, repoRoot }, { beforeSettingsRename: async () => {
    const concurrent = JSON.parse(readFileSync(settingsPath, 'utf8')); concurrent.theme = 'concurrent';
    writeFileSync(settingsPath, `${JSON.stringify(concurrent, null, 2)}\n`);
  } }), /changed concurrently/);
  assert.equal(JSON.parse(readFileSync(settingsPath, 'utf8')).theme, 'concurrent');
  assert.equal(readFileSync(manifestPath, 'utf8'), oldManifestBytes);
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  assert.ok(Object.values(settings.hooks).every((groups) => groups.some((group) => group.hooks[0].command.includes(oldManifest.installedEntry))));
  const validation = spawnSync(process.execPath, [oldManifest.installedEntry], { input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: repoRoot, tool_name: 'Read', tool_input: {} }), encoding: 'utf8', cwd: repoRoot });
  assert.match(verdict(validation).hookSpecificOutput.permissionDecisionReason, /^MAIN_DIRECT_READ_DENIED:/);
});

test('installed executable content address is derived from staged installed bytes', () => {
  const home = temp('content-address'); const r = installRun(home, '--install'); assert.equal(r.status, 0, r.stderr);
  const manifest = JSON.parse(readFileSync(join(home, '.claude/mihver-firewall/manifest.json'), 'utf8'));
  const logical = Object.entries(manifest.files).filter(([name]) => !name.startsWith('bin/')).map(([name, digest]) => [`src/${name.split('/').at(-1)}`, digest]);
  const aggregate = `${logical.sort(([a], [b]) => a.localeCompare(b)).map(([name, digest]) => `${name}\0${digest}\n`).join('')}installed-loader.mjs\0${sha256(readFileSync(manifest.installedEntry))}\n`;
  assert.match(manifest.installedEntry, new RegExp(`${sha256(aggregate).slice(0, 12)}\\.mjs$`));
});

test('source mutation after staging cannot change published content', async () => {
  const fakeRepo = temp('source-race'); const fakeTool = join(fakeRepo, 'tools/orchestrator-firewall'); mkdirSync(dirname(fakeTool), { recursive: true });
  cpSync(join(repoRoot, 'tools/orchestrator-firewall/bin'), join(fakeTool, 'bin'), { recursive: true });
  cpSync(join(repoRoot, 'tools/orchestrator-firewall/src'), join(fakeTool, 'src'), { recursive: true });
  git(fakeRepo, ['init', '--initial-branch=main', '-q']); git(fakeRepo, ['config', 'user.email', 'test@example.invalid']); git(fakeRepo, ['config', 'user.name', 'Test']); git(fakeRepo, ['add', '.']); git(fakeRepo, ['commit', '-qm', 'seed']);
  const sourceEntry = join(fakeTool, 'bin/mihver-firewall.mjs'); const stagedBytes = readFileSync(sourceEntry);
  const home = temp('source-race-home'); const { install } = await import(`${pathToFileURL(installer).href}?source-race=1`);
  await install({ home, repoRoot: fakeRepo }, { afterStaging: async () => writeFileSync(sourceEntry, '// concurrently changed source\n') });
  const manifest = JSON.parse(readFileSync(join(home, '.claude/mihver-firewall/manifest.json'), 'utf8'));
  assert.deepEqual(readFileSync(join(manifest.engineDir, 'dispatcher.mjs')), stagedBytes);
});

test('status warns when a superseded installed release is registered', () => {
  const sourceRoot = temp('superseded-repo');
  cpSync(join(repoRoot, 'tools'), join(sourceRoot, 'tools'), { recursive: true });
  git(sourceRoot, ['init', '--initial-branch=main', '-q']); git(sourceRoot, ['config', 'user.email', 'test@example.invalid']); git(sourceRoot, ['config', 'user.name', 'Test']); git(sourceRoot, ['add', '.']); git(sourceRoot, ['commit', '-qm', 'first']);
  const home = temp('superseded-home');
  assert.equal(installRunRepo(home, '--install', sourceRoot).status, 0);
  const settingsPath = join(home, '.claude/settings.json');
  const oldSettings = readFileSync(settingsPath, 'utf8');
  writeFileSync(join(sourceRoot, 'tools/orchestrator-firewall/src/policy.mjs'), '\n// newer release\n', { flag: 'a' });
  git(sourceRoot, ['add', '.']); git(sourceRoot, ['commit', '-qm', 'second']);
  assert.equal(installRunRepo(home, '--install', sourceRoot).status, 0);
  writeFileSync(settingsPath, oldSettings);
  const status = installRunRepo(home, '--status', sourceRoot);
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, /^INSTALLED/m);
  assert.match(status.stdout, /superseded release registered/);
});

test('abort after settings publication leaves the newly registered executable enforceable', async () => {
  const home = temp('after-settings-abort');
  const { install } = await import(`${pathToFileURL(installer).href}?after-settings-abort=1`);
  await assert.rejects(install({ home, repoRoot }, { afterSettingsWrite: async () => { throw new Error('simulated bookkeeping crash'); } }), /simulated bookkeeping crash/);
  const settings = JSON.parse(readFileSync(join(home, '.claude/settings.json'), 'utf8'));
  const command = settings.hooks.PreToolUse[0].hooks[0].command;
  const entry = JSON.parse(command.slice(0, command.indexOf(' # ')));
  const result = spawnSync(entry, [], { input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: repoRoot, tool_name: 'Read', tool_input: {} }), encoding: 'utf8', cwd: repoRoot });
  assert.match(verdict(result).hookSpecificOutput.permissionDecisionReason, /^MAIN_DIRECT_READ_DENIED:/);
  assert.match(installRun(home, '--status').stdout, /^INSTALLED/m);
});

test('importing installer has no lifecycle or import side effect', async () => {
  const home = temp('importhome'); const before = readdirSync(home); const oldArgv = process.argv; process.argv = [process.execPath, 'npm-lifecycle-placeholder'];
  try { await import(`${pathToFileURL(installer).href}?side-effect-test=1`); } finally { process.argv = oldArgv; }
  assert.deepEqual(readdirSync(home), before); assert.equal(existsSync(join(home, '.claude')), false);
});
