#!/usr/bin/env node
// Single hook dispatcher. Security boundary: stdout contains only host-valid deny/block JSON decisions.
// HOST FAIL-OPEN LIMITATION: Claude continues a PreToolUse operation when a hook crashes, is missing,
// or is not executable. This dispatcher cannot change that host behavior. Consequently every in-scope
// PreToolUse internal error is converted to a normal deny decision instead of a non-zero hook failure.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inScope } from '../src/scope.mjs';
import { classify } from '../src/identity.mjs';
import { mainToolVerdict } from '../src/policy.mjs';
import { canonicalJson, parseDelegation, validateDelegationParams } from '../src/delegation.mjs';
import { computeFingerprint } from '../src/fingerprint.mjs';
import { ledgerPath, threadsPath, appendStarted, appendCompletion, appendInvalid, appendRecord, appendThreadBinding, findThreadBinding, verifyChain } from '../src/ledger.mjs';
import { decideStop } from '../src/stopgate.mjs';
import { protectedPaths, protectedToolVerdict } from '../src/protected-paths.mjs';

const binDir = path.dirname(fileURLToPath(import.meta.url));
const sourceTrustRoot = path.resolve(binDir, '..');
// Installed execution reaches this dispatcher only after the generated loader verifies all engine bytes.
const verifiedInstall = globalThis.__MIHVER_VERIFIED_INSTALL__;
const installedMode = Boolean(verifiedInstall);
const manifest = verifiedInstall?.manifest ?? {};
const overrideHome = installedMode ? undefined : process.env.MIHVER_FIREWALL_HOME;
const runtimeRoot = path.resolve(installedMode ? verifiedInstall.trustRoot : (overrideHome ?? sourceTrustRoot));
const canonicalRoot = path.resolve(installedMode ? verifiedInstall.canonicalMihverRoot : (process.env.MIHVER_FIREWALL_CANONICAL_ROOT ?? process.cwd()));
const home = path.resolve(installedMode ? path.dirname(path.dirname(verifiedInstall.trustRoot)) : (overrideHome ?? os.homedir()));
const protection = protectedPaths({
  home, trustRoot: path.resolve(manifest.trustRoot ?? runtimeRoot), canonicalRoot,
  installedPaths: Array.isArray(manifest.installedPaths) ? manifest.installedPaths : [],
});

const output = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
const deny = (reason) => output({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
const safePart = (value) => encodeURIComponent(String(value ?? 'UNKNOWN'));
const promptDir = (input) => path.join(runtimeRoot, 'runtime', safePart(input.session_id), safePart(input.prompt_id));
const baselinePath = (input) => path.join(promptDir(input), 'baseline.json');
const statePath = (input) => path.join(promptDir(input), 'stop-state.json');
const codexTools = new Set(['mcp__codex__codex', 'mcp__codex__codex-reply']);

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`, { encoding: 'utf8', mode: 0o600 });
}
function ledgerFor(input) { return ledgerPath(runtimeRoot, input.session_id, input.prompt_id); }
function threadStore() { return threadsPath(runtimeRoot); }
function extractThreadId(response) {
  // Exact Codex creation response shape: tool_response.threadId is the only
  // authority-bearing identifier. Nested values and JSON strings are data only.
  return typeof response?.threadId === 'string' && response.threadId.trim() ? response.threadId : null;
}

function preTool(input) {
  const protectedVerdict = protectedToolVerdict(input.tool_name, input.tool_input, protection, home);
  if (protectedVerdict) return deny(protectedVerdict.reason);
  if (classify(input) === 'MAIN_ORCHESTRATOR') {
    const verdict = mainToolVerdict(input.tool_name);
    if (verdict) return deny(verdict.reason);
  }
  if (!codexTools.has(input.tool_name)) return;
  const parsed = parseDelegation(input.tool_input);
  if (!parsed.ok) {
    appendInvalid(ledgerFor(input), input, parsed.detail);
    return deny(`${parsed.code}: ${parsed.detail}`);
  }
  const reply = input.tool_name === 'mcp__codex__codex-reply';
  const params = validateDelegationParams(parsed.meta, input.tool_input, canonicalRoot, { reply });
  if (!params.ok) return deny(`${params.code}: ${params.detail}`);
  if (reply) {
    const bound = findThreadBinding(threadStore(), input.tool_input.threadId);
    if (!bound || bound.role !== parsed.meta.role || bound.taskId !== parsed.meta.taskId ||
        bound.scopeHash !== parsed.scopeHash || bound.baseSha !== parsed.meta.baseSha) {
      return deny('DELEGATION_THREAD_AUTHORITY_MISMATCH: reply authority does not match a known bound thread');
    }
  }
  appendStarted(ledgerFor(input), input, parsed);
}

function postTool(input, failed = false) {
  if (!codexTools.has(input.tool_name)) return;
  // Calls lacking a STARTED record (invalid metadata or denied invocation) cannot mint receipts.
  const chain = verifyChain(ledgerFor(input));
  if (!chain.ok || !chain.records.some((r) => r.status === 'STARTED' && r.toolUseId === input.tool_use_id)) return;
  const fingerprint = failed ? undefined : computeFingerprint(canonicalRoot).fingerprint;
  const completed = appendCompletion(ledgerFor(input), input, failed ? 'FAILED' : 'COMPLETED', { workspaceFingerprint: fingerprint });
  if (input.tool_name === 'mcp__codex__codex' && !failed) {
    const threadId = extractThreadId(input.tool_response);
    appendThreadBinding(threadStore(), {
      threadId: threadId ?? null, role: completed.role, taskId: completed.taskId, scopeHash: completed.scopeHash,
      baseSha: completed.baseSha, sandbox: input.tool_input?.sandbox, sessionId: completed.sessionId,
      promptId: completed.promptId, startedAt: completed.startedAt,
    });
  }
}

function userPrompt(input) {
  const fp = computeFingerprint(canonicalRoot);
  writeJson(baselinePath(input), { sessionId: input.session_id, promptId: input.prompt_id, repositoryHead: fp.head, workspaceFingerprint: fp.fingerprint });
  writeJson(statePath(input), { blockCount: 0 });
}

function stop(input) {
  if (classify(input) === 'SUBAGENT') return;
  const baseline = readJson(baselinePath(input));
  // Missing baseline is treated as changed, so receipts are required rather than silently bypassed.
  const current = computeFingerprint(canonicalRoot).fingerprint;
  const chain = verifyChain(ledgerFor(input));
  const records = chain.ok ? chain.records : [];
  const state = readJson(statePath(input), { blockCount: 0 });
  const result = decideStop({
    baselineFingerprint: baseline.workspaceFingerprint ?? 'MISSING_BASELINE', currentFingerprint: current,
    records, sessionId: input.session_id, promptId: input.prompt_id,
    stopHookActive: input.stop_hook_active === true,
  });
  if (result.decision === 'block') {
    writeJson(statePath(input), { blockCount: (Number(state.blockCount) || 0) + 1 });
    const now = new Date().toISOString();
    appendRecord(ledgerFor(input), {
      protocolVersion: '1', sessionId: input.session_id, promptId: input.prompt_id, toolUseId: '', taskId: '',
      role: '', scopeHash: '', baseSha: '', startedAt: now, completedAt: now, status: 'STOP_BLOCKED',
      toolName: 'Stop', resultHash: '', reason: result.reason,
    });
    output({ decision: 'block', reason: result.reason });
  }
}

function settingsAffectFirewall(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.disableAllHooks === true || value.allowManagedHooksOnly === true) return true;
  // The human-owned manifest supplies the exact installed entries. Their absence or alteration
  // is therefore detectable even after ConfigChange presents only the new settings document.
  if (Array.isArray(manifest.ownedHookEntries) && manifest.ownedHookEntries.length) {
    if (manifest.ownedHookEntries.some(({ event, entry }) =>
      typeof event !== 'string' || !Array.isArray(value.hooks?.[event]) ||
      !value.hooks[event].some((candidate) => canonicalJson(candidate) === canonicalJson(entry)))) return true;
  }
  const walk = (node, key = '') => {
    if (typeof node === 'string') return /mihver-firewall|mihver_firewall|orchestrator-firewall/i.test(node) && /hook|command|mihver/i.test(key);
    if (Array.isArray(node)) return node.some((item) => walk(item, key));
    if (node && typeof node === 'object') return Object.entries(node).some(([childKey, child]) => walk(child, `${key}.${childKey}`));
    return false;
  };
  return walk(value);
}

function configChange(input) {
  if (input.source === 'policy_settings' || input.source === 'skills') return;
  if (!['user_settings', 'project_settings', 'local_settings'].includes(input.source)) return;
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(input.file_path, 'utf8'));
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('settings must be an object');
  } catch {
    process.stderr.write('MIHVER_CONFIG_CHANGE_DENIED: settings input is unreadable or malformed\n');
    process.exitCode = 2;
    return;
  }
  if (settingsAffectFirewall(settings)) {
    process.stderr.write('MIHVER_CONFIG_CHANGE_DENIED: settings change affects MIHVER firewall behavior\n');
    process.exitCode = 2;
  }
}

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }
if (!inScope(input.cwd, canonicalRoot)) process.exit(0);

try {
  switch (input.hook_event_name) {
    case 'PreToolUse': preTool(input); break;
    case 'PostToolUse': postTool(input, false); break;
    case 'PostToolUseFailure': postTool(input, true); break;
    case 'UserPromptSubmit': userPrompt(input); break;
    case 'Stop': stop(input); break;
    case 'ConfigChange': configChange(input); break;
    default: break;
  }
} catch (error) {
  // Host hook failures are fail-open, so every in-scope PreToolUse error must become a deny verdict.
  if (input.hook_event_name === 'PreToolUse') {
    deny(`FIREWALL_INTERNAL_ERROR: ${String(error?.message ?? error).slice(0, 240)}`);
  }
}
