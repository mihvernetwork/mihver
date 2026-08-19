#!/usr/bin/env node
// Prints a compact MIHVER context snapshot so a fresh session doesn't need to scan the
// repository. Node built-ins + git only — see docs/development/AGENT_POLICY.md and
// CLAUDE.md's "Fast Session Bootstrap". Compact by default; pass --full for a detailed dump.

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(__dirname));
const full = process.argv.includes('--full');

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

function truncate(text, maxLen) {
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

function sectionSummary(content, heading, maxLen = 140) {
  const text = extractSection(content, heading)
    .filter((l) => l.trim() !== '')
    .join(' ')
    .trim();
  return text ? truncate(text, maxLen) : '(none)';
}

function extractBullets(lines) {
  const bullets = [];
  for (const raw of lines) {
    if (/^-\s/.test(raw)) {
      bullets.push(raw.replace(/^-\s*/, '').trim());
    } else if (bullets.length && raw.trim() !== '') {
      bullets[bullets.length - 1] += ` ${raw.trim()}`;
    }
  }
  return bullets;
}

function lastBulletSummary(content, heading, maxLen = 140) {
  const bullets = extractBullets(extractSection(content, heading));
  if (bullets.length === 0) return '(none)';
  return truncate(bullets[bullets.length - 1], maxLen);
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

const projectState = readProjectFile('.project/PROJECT_STATE.md');
const currentTaskExists = existsSync(join(repoRoot, '.project/CURRENT_TASK.md'));
const currentTask = readProjectFile('.project/CURRENT_TASK.md');
const declaredBranch = currentTaskExists ? extractDeclaredBranch(currentTask) : null;
// CURRENT_TASK.md is branch-scoped (see AGENT_POLICY.md's "Operational State Scope"): it only
// describes an active task when its declared branch matches the branch actually checked out.
const taskActiveForBranch = currentTaskExists && declaredBranch !== null && declaredBranch === branch;

console.log('=== MIHVER Project Context Snapshot ===');
console.log(`Branch:       ${branch}`);
console.log(`HEAD:         ${head}`);
console.log(`Working tree: ${dirty ? 'dirty' : 'clean'}`);
console.log(`Main delta:   ${mainDelta}`);
if (declaredBranch && declaredBranch !== branch) {
  console.log(
    `WARNING: .project/CURRENT_TASK.md declares branch "${declaredBranch}" but HEAD is on ` +
      `"${branch}" — treating as no active task for this branch.`
  );
} else if (currentTaskExists && declaredBranch === null) {
  console.log(
    'WARNING: could not parse a declared branch from .project/CURRENT_TASK.md\'s "Branch / Base" ' +
      'section — treating as no active task for this branch.'
  );
}

if (full) {
  printHeader('Changed files (branch vs main)');
  console.log(changedVsMain.length ? changedVsMain.join('\n') : '(none)');

  printHeader('Working tree changes (uncommitted)');
  console.log(workingTreeChanges.length ? workingTreeChanges.join('\n') : '(none)');

  printHeader('.project/PROJECT_STATE.md');
  console.log(projectState);

  printHeader('.project/CURRENT_TASK.md');
  console.log(currentTaskExists ? currentTask : '<missing: .project/CURRENT_TASK.md>');

  printHeader('.project/REVIEW_STATE.md');
  console.log(readProjectFile('.project/REVIEW_STATE.md'));
} else {
  console.log(`Changed vs main: ${changedVsMain.length} file(s) (rerun with --full for the list)`);
  console.log(`Uncommitted:     ${workingTreeChanges.length ? `${workingTreeChanges.length} file(s)` : 'none'}`);

  printHeader('Project (parsed from PROJECT_STATE.md, not dumped)');
  console.log(`Milestone:         ${sectionSummary(projectState, 'Current Milestone')}`);
  console.log(
    `Latest checkpoint: ${lastBulletSummary(projectState, 'Frozen Steps / Checkpoints (on `main`)')}`
  );
  console.log(`Next action:       ${sectionSummary(projectState, 'Next Authorized Action')}`);

  printHeader('Active Task (branch-scoped)');
  if (taskActiveForBranch) {
    console.log(`ID:        ${sectionSummary(currentTask, 'Task ID', 80)}`);
    console.log(`Objective: ${sectionSummary(currentTask, 'Objective')}`);
    console.log(`Status:    ${sectionSummary(currentTask, 'Status')}`);
  } else if (!currentTaskExists) {
    console.log('No .project/CURRENT_TASK.md found.');
  } else {
    console.log(`No active task recorded for current branch "${branch}".`);
  }

  printHeader('State files (not dumped — read directly, or rerun with --full)');
  console.log('.project/PROJECT_STATE.md');
  console.log('.project/CURRENT_TASK.md');
  console.log('.project/REVIEW_STATE.md');
}

printHeader('Required Context (from CURRENT_TASK.md)');
const requiredFiles = taskActiveForBranch
  ? extractBulletPaths(extractSection(currentTask, 'Required Context'))
  : [];
if (requiredFiles.length === 0) {
  console.log(taskActiveForBranch ? '(none listed)' : '(no active task for this branch)');
} else {
  for (const relPath of requiredFiles) {
    const abs = join(repoRoot, relPath.split(' ')[0]);
    const flag = existsSync(abs) ? '[ok]' : '[MISSING]';
    console.log(`${flag} ${relPath}`);
  }
}
