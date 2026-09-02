// Repository scope gate. Security boundary: ambiguous paths are treated as in-scope.
import fs from 'node:fs';
import path from 'node:path';

function lexical(value) {
  return path.resolve(String(value ?? ''));
}

function real(value) { return fs.realpathSync.native(lexical(value)); }

function beneath(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export function inScope(cwd, canonicalRoot) {
  // Missing or malformed cwd is ambiguous and therefore in scope. A valid
  // absolute cwd can still be proven outside lexically when its target was deleted.
  if (typeof canonicalRoot !== 'string' || !canonicalRoot) return true;
  const lexicalRoot = lexical(canonicalRoot);
  let resolvedRoot;
  try { resolvedRoot = real(canonicalRoot); } catch { return true; }
  if (typeof cwd !== 'string' || !cwd.trim() || !path.isAbsolute(cwd)) return true;
  const rawCwd = lexical(cwd);
  let resolvedCwd;
  try { resolvedCwd = real(cwd); } catch { return beneath(rawCwd, lexicalRoot) || beneath(rawCwd, resolvedRoot); }
  return beneath(rawCwd, resolvedRoot) || beneath(resolvedCwd, resolvedRoot);
}
