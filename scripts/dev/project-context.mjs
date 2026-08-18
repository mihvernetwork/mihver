#!/usr/bin/env node
// Prints a compact MIHVER context snapshot so a fresh session doesn't need to scan the
// repository. Node built-ins + git only — see docs/development/AGENT_POLICY.md and
// CLAUDE.md's "Fast Session Bootstrap".

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(__dirname));

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch (err) {
    return `<error: ${String(err.message).split('\n')[0]}>`;
  }
}

function isError(value) {
  return value.startsWith('<error');
}

function readProjectFile(relPath) {
  const abs = join(repoRoot, relPath);
  if (!existsSync(abs)) return `<missing: ${relPath}>`;
  return readFileSync(abs, 'utf8').trimEnd();
}

function extractSection(content, heading) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

function extractBulletPaths(lines) {
  const paths = [];
  for (const line of lines) {
    const match = line.match(/`([^`]+)`/);
    if (match) paths.push(match[1]);
  }
  return paths;
}

function resolveMainRef() {
  for (const ref of ['main', 'origin/main']) {
    if (!isError(git(`rev-parse --verify ${ref}`))) return ref;
  }
  return null;
}

function printHeader(title) {
  console.log(`\n--- ${title} ---`);
}

function extractDeclaredBranch(currentTaskContent) {
  for (const line of extractSection(currentTaskContent, 'Branch / Base')) {
    const match = line.match(/^Branch:\s*`([^`]+)`/);
    if (match) return match[1];
  }
  return null;
}

const branch = git('branch --show-current') || '<detached HEAD>';
const head = git('rev-parse --short HEAD');
const statusPorcelain = git('status --porcelain');
const dirty = !isError(statusPorcelain) && statusPorcelain.length > 0;

const mainRef = resolveMainRef();
let mainDelta = 'unknown (no main ref found)';
let changedVsMain = [];
if (mainRef) {
  const counts = git(`rev-list --left-right --count ${mainRef}...HEAD`);
  if (!isError(counts)) {
    const [behind, ahead] = counts.split(/\s+/);
    mainDelta = `${ahead} ahead, ${behind} behind ${mainRef} (local ref, not fetched)`;
  }
  const diffNames = git(`diff --name-only ${mainRef}...HEAD`);
  if (!isError(diffNames) && diffNames) changedVsMain = diffNames.split('\n').filter(Boolean);
}

const workingTreeChanges = isError(statusPorcelain)
  ? []
  : statusPorcelain.split('\n').filter(Boolean);

const currentTaskForBranchCheck = readProjectFile('.project/CURRENT_TASK.md');
const declaredBranch = extractDeclaredBranch(currentTaskForBranchCheck);

console.log('=== MIHVER Project Context Snapshot ===');
console.log(`Branch:       ${branch}`);
console.log(`HEAD:         ${head}`);
console.log(`Working tree: ${dirty ? 'dirty' : 'clean'}`);
console.log(`Main delta:   ${mainDelta}`);
if (declaredBranch && declaredBranch !== branch) {
  console.log(
    `WARNING: .project/CURRENT_TASK.md declares branch "${declaredBranch}" but HEAD is on ` +
      `"${branch}" — CURRENT_TASK.md may be stale.`
  );
}

printHeader('Changed files (branch vs main)');
console.log(changedVsMain.length ? changedVsMain.join('\n') : '(none)');

printHeader('Working tree changes (uncommitted)');
console.log(workingTreeChanges.length ? workingTreeChanges.join('\n') : '(none)');

printHeader('.project/PROJECT_STATE.md');
console.log(readProjectFile('.project/PROJECT_STATE.md'));

const currentTask = currentTaskForBranchCheck;
printHeader('.project/CURRENT_TASK.md');
console.log(currentTask);

printHeader('.project/REVIEW_STATE.md');
console.log(readProjectFile('.project/REVIEW_STATE.md'));

printHeader('Required Context (from CURRENT_TASK.md)');
const requiredFiles = extractBulletPaths(extractSection(currentTask, 'Required Context'));
if (requiredFiles.length === 0) {
  console.log('(none listed)');
} else {
  for (const relPath of requiredFiles) {
    const abs = join(repoRoot, relPath.split(' ')[0]);
    const flag = existsSync(abs) ? '[ok]' : '[MISSING]';
    console.log(`${flag} ${relPath}`);
  }
}
