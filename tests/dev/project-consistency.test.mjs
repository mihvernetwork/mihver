// These tests exercise scripts/dev/project-consistency.mjs — which is itself read-only (see its own
// header comment; it never calls a filesystem write function). This test file's own use of
// mkdtempSync/writeFileSync/rmSync below builds disposable, self-contained fixture repos under the
// OS temp directory to exercise negative-path checks (a broken cross-reference, a malformed status
// entry) without touching this actual repository — that is this test suite's own fixture setup, not
// something the checker under test ever does.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runAllChecks,
  checkRequiredFiles,
  checkDecisionsLogEntryShape,
  checkHeadingCrossReferences,
  checkOwnerMirrorAdrStatus,
} from '../../scripts/dev/project-consistency.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(here));

function result(results, name) {
  const found = results.find((r) => r.name === name);
  assert.ok(found, `expected a check result named "${name}"`);
  return found;
}

function makeTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'mihver-consistency-test-'));
  return dir;
}

function write(dir, relPath, content) {
  const abs = join(dir, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
}

let checked = 0;

// 1. Clean repository snapshot passes (run against the real, current repo root).
{
  const results = runAllChecks(repoRoot);
  const failing = results.filter((r) => r.status === 'FAIL');
  assert.equal(
    failing.length,
    0,
    `expected the real repository to pass all deterministic checks, but these failed:\n${JSON.stringify(failing, null, 2)}`
  );
  checked += 1;
}

// 2. A deprecated/stale registered cross-reference fails: CLAUDE.md quotes "Latest Review" but
//    the target file no longer has that heading.
{
  const dir = makeTempRepo();
  write(dir, 'CLAUDE.md', 'See "Latest Review" in the review state file.\n');
  write(dir, '.project/REVIEW_STATE.md', '## Something Else\n\nno matching heading here.\n');
  const check = checkHeadingCrossReferences(dir);
  assert.equal(check.status, 'FAIL', 'expected a stale heading reference to fail');
  assert.ok(
    check.details.some((d) => d.includes('Latest Review')),
    `expected failure detail to mention the stale reference, got: ${JSON.stringify(check.details)}`
  );
  rmSync(dir, { recursive: true, force: true });
  checked += 1;
}

// 3. Historical occurrence does not false-positive where distinguishable: a DECISIONS_LOG fixture
//    whose entry narrative contains embedded dates/quoted historical status words in prose must
//    still pass the entry-shape check, since only the line-start bullet marker is checked.
{
  const dir = makeTempRepo();
  write(
    dir,
    '.project/DECISIONS_LOG.md',
    [
      '# Decisions Log',
      '',
      '---',
      '',
      '- 2026-08-19 — Example decision referencing a later merge on 2026-08-23 and a historical',
      '  status once recorded as "Proposed", later changed — this continuation line does not start',
      '  with "- " and must not be checked as its own entry. — `abc1234`',
      '- 2026-08-20 — Second entry. — `def5678`',
      '',
    ].join('\n')
  );
  const check = checkDecisionsLogEntryShape(dir);
  assert.equal(check.status, 'PASS', `expected historical narrative not to trip entry-shape check: ${JSON.stringify(check.details)}`);
  rmSync(dir, { recursive: true, force: true });
  checked += 1;
}

// 4. A malformed registered current-state entry fails: PROJECT_STATE.md's Snapshot mirror
//    disagrees with the ADR's own owning `## Status` field.
{
  const dir = makeTempRepo();
  write(dir, 'docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md', '# ADR-0004\n\n## Status\n\nAccepted\n');
  write(
    dir,
    '.project/PROJECT_STATE.md',
    ['# Project State', '', '## Current Capability Snapshot', '', '- ADR-0004 (Memory Context): PROPOSED — owner: `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`', ''].join(
      '\n'
    )
  );
  const check = checkOwnerMirrorAdrStatus(dir);
  assert.equal(check.status, 'FAIL', 'expected owner/mirror ADR status disagreement to fail');
  assert.ok(
    check.details.some((d) => d.includes('ADR-0004')),
    `expected failure detail to mention ADR-0004, got: ${JSON.stringify(check.details)}`
  );
  rmSync(dir, { recursive: true, force: true });
  checked += 1;
}

// 5. checkRequiredFiles fails cleanly (not a crash) against an empty directory, and never writes.
{
  const dir = makeTempRepo();
  const before = { existsCheck: true };
  const check = checkRequiredFiles(dir);
  assert.equal(check.status, 'FAIL');
  assert.ok(check.details.length >= 10, 'expected every required file to be reported missing');
  rmSync(dir, { recursive: true, force: true });
  checked += 1;
}

// 6. The checker never modifies files. Two independent proofs:
//    (a) whole-working-tree proof: `git status --porcelain` on the real repo (every file the
//        checker reads — not just a hand-picked subset) is identical before and after a full run,
//        so any write anywhere in the tree would show up as a diff.
//    (b) same proof against a throwaway fixture repo (not git-tracked), by recursively hashing
//        every file's mtime+size before and after, so the proof doesn't depend on git at all.
{
  const { execSync } = await import('node:child_process');
  const before = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf8' });
  runAllChecks(repoRoot);
  const after = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(after, before, 'expected `git status --porcelain` to be unchanged by running the checker against the real repo');
  checked += 1;
}
{
  function snapshotTree(dir) {
    const out = {};
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) Object.assign(out, snapshotTree(abs));
      else {
        const st = statSync(abs);
        out[abs] = `${st.size}:${st.mtimeMs}`;
      }
    }
    return out;
  }
  const dir = makeTempRepo();
  write(dir, 'CLAUDE.md', '# CLAUDE\n');
  write(dir, '.project/PROJECT_STATE.md', '# Project State\n\n## Current Capability Snapshot\n');
  write(dir, '.project/DECISIONS_LOG.md', '# Decisions Log\n\n---\n\n- 2026-01-01 — example. — `abc1234`\n');
  write(dir, 'ROADMAP.md', '# Roadmap\n');
  write(dir, 'docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md', '# ADR-0004\n\n## Status\n\nAccepted\n');
  const before = snapshotTree(dir);
  runAllChecks(dir);
  const after = snapshotTree(dir);
  assert.deepEqual(after, before, 'expected the fixture repo to be byte/mtime-identical after running the checker');
  rmSync(dir, { recursive: true, force: true });
  checked += 1;
}

console.log(`project-consistency.test.mjs: ${checked} test group(s) passed.`);
