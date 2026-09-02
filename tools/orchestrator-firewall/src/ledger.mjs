// Hash-chained receipt ledger. Security boundary: records are authored and correlated only by hook code.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson } from './delegation.mjs';

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const safePart = (value) => encodeURIComponent(String(value ?? 'UNKNOWN'));
export function ledgerPath(runtimeRoot, sessionId, promptId) {
  return path.join(runtimeRoot, 'runtime', safePart(sessionId), safePart(promptId), 'ledger.jsonl');
}
export function threadsPath(runtimeRoot) { return path.join(runtimeRoot, 'runtime', 'threads.jsonl'); }

export function readRecords(file) {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)); } catch { return []; }
}

export function verifyChain(file) {
  let records;
  try { records = readRecords(file); } catch (error) { return { ok: false, detail: error.message, records: [] }; }
  let previous = 'GENESIS';
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const { recordHash, ...unsigned } = record;
    if (record.seq !== index || record.prevHash !== previous || recordHash !== hash(canonicalJson(unsigned))) {
      return { ok: false, detail: `chain mismatch at seq ${index}`, records };
    }
    previous = recordHash;
  }
  // The adjacent head anchor makes removal of complete trailing JSONL records detectable.
  try {
    const anchor = fs.readFileSync(`${file}.head`, 'utf8').trim();
    if (anchor !== `${records.length}:${previous}`) return { ok: false, detail: 'ledger truncation/head mismatch', records };
  } catch {
    if (records.length) return { ok: false, detail: 'ledger head anchor missing', records };
  }
  return { ok: true, records };
}

export function appendRecord(file, fields) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const checked = verifyChain(file);
  if (!checked.ok) throw new Error(`refusing to append to invalid ledger: ${checked.detail}`);
  const seq = checked.records.length;
  const prevHash = seq ? checked.records[seq - 1].recordHash : 'GENESIS';
  const unsigned = { seq, prevHash, ...fields };
  const record = { ...unsigned, recordHash: hash(canonicalJson(unsigned)) };
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(`${file}.head`, `${seq + 1}:${record.recordHash}\n`, { encoding: 'utf8', mode: 0o600 });
  return record;
}

export function appendStarted(file, input, parsed, startedAt = new Date().toISOString()) {
  const auditHashes = {};
  for (const key of ['base-instructions', 'developer-instructions', 'model']) {
    if (input.tool_input?.[key] !== undefined) auditHashes[`${key}Hash`] = hash(String(input.tool_input[key]));
  }
  return appendRecord(file, {
    protocolVersion: '1', sessionId: input.session_id, promptId: input.prompt_id,
    toolUseId: input.tool_use_id, taskId: parsed.meta.taskId, role: parsed.meta.role,
    scopeHash: parsed.scopeHash, baseSha: parsed.meta.baseSha, startedAt, completedAt: null,
    status: 'STARTED', toolName: input.tool_name, resultHash: null,
    ...auditHashes,
    ...(input.tool_input?.threadId ? { threadId: input.tool_input.threadId } : {}),
  });
}

export function appendThreadBinding(file, binding) {
  if (!binding.threadId) return appendRecord(file, { ...binding, status: 'UNBOUND' });
  const chain = verifyChain(file);
  if (!chain.ok) throw new Error(`invalid thread authority store: ${chain.detail}`);
  if (chain.records.some((record) => record.threadId === binding.threadId &&
      ['BOUND', 'THREAD_BINDING_CONFLICT'].includes(record.status))) {
    return appendRecord(file, { ...binding, status: 'THREAD_BINDING_CONFLICT' });
  }
  return appendRecord(file, { ...binding, status: 'BOUND' });
}

export function findThreadBinding(file, threadId) {
  const chain = verifyChain(file);
  if (!chain.ok) throw new Error(`invalid thread authority store: ${chain.detail}`);
  const matching = chain.records.filter((record) => record.threadId === threadId);
  if (matching.some((record) => record.status === 'THREAD_BINDING_CONFLICT')) return null;
  return matching.find((record) => record.status === 'BOUND') ?? null;
}

export function appendCompletion(file, input, status, options = {}) {
  const records = verifyChain(file);
  if (!records.ok) throw new Error(records.detail);
  const started = [...records.records].reverse().find((r) => r.status === 'STARTED' && r.toolUseId === input.tool_use_id);
  if (!started) throw new Error('completion has no correlated STARTED record');
  if (records.records.some((r) => ['COMPLETED', 'FAILED'].includes(r.status) && r.toolUseId === input.tool_use_id)) {
    throw new Error('toolUseId already has a terminal record');
  }
  const stringified = JSON.stringify(input.tool_response);
  const resultHash = status === 'COMPLETED' ? hash(stringified === undefined ? 'undefined' : stringified) : hash(String(input.error ?? ''));
  return appendRecord(file, {
    protocolVersion: started.protocolVersion, sessionId: started.sessionId, promptId: started.promptId,
    toolUseId: started.toolUseId, taskId: started.taskId, role: started.role, scopeHash: started.scopeHash,
    baseSha: started.baseSha, startedAt: started.startedAt, completedAt: options.completedAt ?? new Date().toISOString(),
    status, toolName: started.toolName, resultHash,
    ...(started.threadId ? { threadId: started.threadId } : {}),
    ...(started.role === 'VERIFIER' && options.workspaceFingerprint ? { workspaceFingerprint: options.workspaceFingerprint } : {}),
  });
}

export function appendInvalid(file, input, detail) {
  const now = new Date().toISOString();
  return appendRecord(file, {
    protocolVersion: '1', sessionId: input.session_id, promptId: input.prompt_id, toolUseId: input.tool_use_id,
    taskId: '', role: '', scopeHash: '', baseSha: '', startedAt: now, completedAt: now,
    status: 'DELEGATION_METADATA_INVALID', toolName: input.tool_name, resultHash: hash(String(detail)),
  });
}
