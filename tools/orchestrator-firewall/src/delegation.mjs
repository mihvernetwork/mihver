// Codex delegation contract parser. Security boundary: authority derives only from the exact first-line header.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function parseDelegation(toolInput) {
  const prompt = toolInput?.prompt;
  if (typeof prompt !== 'string') return { ok: false, code: 'DELEGATION_METADATA_INVALID', detail: 'prompt is missing' };
  const firstLine = prompt.split(/\r?\n/, 1)[0];
  const prefix = 'MIHVER_DELEGATION_V1:';
  if (!firstLine.startsWith(prefix)) return { ok: false, code: 'DELEGATION_METADATA_INVALID', detail: 'exact first-line header is missing' };
  const payload = firstLine.slice(prefix.length);
  let meta; let decoded;
  try { meta = JSON.parse(payload); decoded = payload; } catch {
    try { decoded = Buffer.from(payload, 'base64url').toString('utf8'); meta = JSON.parse(decoded); }
    catch { return { ok: false, code: 'DELEGATION_METADATA_INVALID', detail: 'payload is not JSON or base64url JSON' }; }
  }
  const roles = new Set(['SCOUT', 'IMPLEMENTER', 'REVIEWER', 'VERIFIER']);
  if (!meta || typeof meta !== 'object' || Array.isArray(meta) || meta.protocolVersion !== '1' ||
      typeof meta.taskId !== 'string' || !meta.taskId || !roles.has(meta.role) ||
      typeof meta.scope !== 'string' || !meta.scope || !/^[0-9a-fA-F]{40}$/.test(meta.baseSha ?? '')) {
    return { ok: false, code: 'DELEGATION_METADATA_INVALID', detail: 'required metadata fields are invalid' };
  }
  if (canonicalJson(meta) !== decoded) return { ok: false, code: 'DELEGATION_METADATA_INVALID', detail: 'metadata JSON is not canonical' };
  return { ok: true, meta, scopeHash: sha256(meta.scope) };
}

export const CODEX_CONFIG_ALLOWLIST = Object.freeze([]);

function delegationCwdInScope(cwd, canonicalRoot) {
  try {
    if (!path.isAbsolute(cwd)) return false;
    const candidate = fs.realpathSync.native(cwd);
    const root = fs.realpathSync.native(canonicalRoot);
    const relative = path.relative(root, candidate);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  } catch { return false; }
}

export function validateDelegationParams(meta, toolInput, canonicalRoot, { reply = false } = {}) {
  const bad = (detail) => ({ ok: false, code: 'DELEGATION_PARAMS_INVALID', detail });
  if (toolInput?.config !== undefined) {
    if (!toolInput.config || typeof toolInput.config !== 'object' || Array.isArray(toolInput.config)) return bad('config must be an object');
    const forbidden = Object.keys(toolInput.config).filter((key) => !CODEX_CONFIG_ALLOWLIST.includes(key));
    if (forbidden.length) return bad(`config overrides are forbidden: ${forbidden.join(', ')}`);
  }
  if (toolInput?.['approval-policy'] !== undefined && !['never', 'on-request'].includes(toolInput['approval-policy'])) return bad('approval-policy is invalid');
  if (reply) {
    if (typeof toolInput?.threadId !== 'string' || !toolInput.threadId.trim()) return bad('codex-reply threadId is missing');
    return { ok: true };
  }
  if (typeof toolInput?.cwd !== 'string' || !toolInput.cwd.trim()) return bad('delegation cwd is required');
  if (!delegationCwdInScope(toolInput.cwd, canonicalRoot)) return bad('delegation cwd is not a resolvable path inside the canonical repository');
  const required = meta.role === 'IMPLEMENTER' ? 'workspace-write' : 'read-only';
  if (toolInput?.sandbox === 'danger-full-access') return bad('danger-full-access is forbidden');
  if (toolInput?.sandbox !== required) return bad(`${meta.role} requires ${required}`);
  return { ok: true };
}

// Backward-compatible named export for callers; validation now covers all escalation parameters.
export const validateSandbox = validateDelegationParams;
