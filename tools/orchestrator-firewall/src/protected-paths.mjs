// Trust-root path protection. Security boundary: exact path checks are strong; shell scanning is heuristic.
import path from 'node:path';

/*
 * CRITICAL SECURITY LIMITATION
 * Shell-command scanning is a deliberately conservative heuristic, NOT a complete OS security sandbox.
 * Obfuscation, indirection, interpreters, and computed paths can evade it. Real protection requires
 * filesystem permissions and human ownership of the installed trust root.
 */
const norm = (value) => path.resolve(String(value));
const within = (candidate, root) => {
  const rel = path.relative(root, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
};

export function protectedPaths({ home, trustRoot, canonicalRoot, installedPaths = [] }) {
  return {
    roots: [norm(trustRoot)],
    exact: [norm(path.join(home, '.claude', 'settings.json')),
      norm(path.join(canonicalRoot, '.claude', 'settings.json')),
      norm(path.join(canonicalRoot, '.claude', 'settings.local.json')),
      ...installedPaths.map(norm)],
  };
}

export function isProtectedPath(filePath, config) {
  if (typeof filePath !== 'string' || !filePath) return false;
  const target = norm(filePath);
  return config.exact.includes(target) || config.roots.some((root) => within(target, root));
}

export function bashTargetsProtected(command, config, home) {
  if (typeof command !== 'string') return false;
  const variants = [...config.roots, ...config.exact].flatMap((target) => {
    const relative = path.relative(home, target);
    return [target, `~/${relative}`, `$HOME/${relative}`, `\${HOME}/${relative}`];
  });
  if (variants.some((needle) => command.includes(needle))) return true;
  // Catch common cd-to-parent then relative mutation forms involving the distinctive trust/config names.
  return /(?:^|[;&|]\s*)cd\s+[^;&|]*(?:\.claude|mihver-firewall)[^;&|]*[;&|]/i.test(command) &&
    /(?:settings(?:\.local)?\.json|mihver-firewall)/i.test(command);
}

export function protectedToolVerdict(toolName, toolInput, config, home) {
  if (['Write', 'Edit', 'NotebookEdit'].includes(toolName) && isProtectedPath(toolInput?.file_path, config)) {
    return { code: 'PROTECTED_PATH_WRITE_DENIED', reason: 'PROTECTED_PATH_WRITE_DENIED: writes to firewall trust/config paths are forbidden' };
  }
  if (toolName === 'Bash' && bashTargetsProtected(toolInput?.command, config, home)) {
    return { code: 'PROTECTED_PATH_BASH_DENIED', reason: 'PROTECTED_PATH_BASH_DENIED: command heuristically targets firewall trust/config paths' };
  }
  return null;
}
