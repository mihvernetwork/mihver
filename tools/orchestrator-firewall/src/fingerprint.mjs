// Deterministic workspace fingerprint. Security boundary: uses read-only git plumbing and file reads only.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { canonicalJson } from './delegation.mjs';

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
function git(root, args) { return execFileSync('git', args, { cwd: root, encoding: null, stdio: ['ignore', 'pipe', 'ignore'] }); }

export function computeFingerprint(repoRoot) {
  let head = 'NO_HEAD';
  try { head = git(repoRoot, ['rev-parse', 'HEAD']).toString('utf8').trim(); } catch {}
  let staged = Buffer.alloc(0); let unstaged = Buffer.alloc(0); let listed = Buffer.alloc(0);
  try { staged = git(repoRoot, ['diff', '--cached', '--no-ext-diff', '--binary']); } catch {}
  try { unstaged = git(repoRoot, ['diff', '--no-ext-diff', '--binary']); } catch {}
  try { listed = git(repoRoot, ['ls-files', '--others', '--exclude-standard', '-z']); } catch {}
  const paths = listed.toString('utf8').split('\0').filter(Boolean).sort();
  const chunks = [];
  for (const relative of paths) {
    let contentHash = 'UNREADABLE';
    try { contentHash = hash(fs.readFileSync(path.join(repoRoot, relative))); } catch {}
    chunks.push(relative, contentHash);
  }
  const data = { algo: 'mihver-wsfp-v1', head, stagedHash: hash(staged), unstagedHash: hash(unstaged), untrackedHash: hash(chunks.join('')) };
  const fingerprint = hash(canonicalJson(data));
  return { ...data, fingerprint, short: fingerprint.slice(0, 12) };
}

export function shortFingerprint(repoRoot) { return computeFingerprint(repoRoot).short; }
