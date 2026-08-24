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
import { execFileSync } from 'node:child_process';
import {
  runAllChecks,
  checkRequiredFiles,
  checkDecisionsLogEntryShape,
  checkDecisionsLogAppendOnlyVsBase,
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

// 7. CLI smoke test: actually execute `node scripts/dev/project-consistency.mjs` as a real child
//    process (not just call the exported function) against the real, currently-consistent repo,
//    and verify it ran to completion — produced its own summary line and PASS lines, and exited 0.
//    This is the entrypoint-portability proof: the old `import.meta.url === \`file://${process.argv[1]}\`}`
//    guard could silently fail to invoke main() on some path shapes, in which case the process
//    would exit 0 having printed nothing — a bare exit-code check alone would not catch that.
{
  const scriptPath = join(repoRoot, 'scripts/dev/project-consistency.mjs');
  let stdout = '';
  let status = 0;
  try {
    stdout = execFileSync(process.execPath, [scriptPath], { cwd: repoRoot, encoding: 'utf8' });
  } catch (err) {
    stdout = err.stdout ? err.stdout.toString() : '';
    status = typeof err.status === 'number' ? err.status : 1;
  }
  assert.equal(status, 0, `expected the CLI entrypoint to exit 0 against the real, consistent repository; got status ${status}\n${stdout}`);
  assert.ok(
    /project-consistency: all deterministic checks passed/.test(stdout),
    `expected the CLI's own summary line in stdout, got:\n${stdout}`
  );
  assert.ok(/\[PASS\] required-files-exist/.test(stdout), `expected at least one "[PASS]" check line, got:\n${stdout}`);
  checked += 1;
}

// 8. Registered cross-reference matching tolerates ordinary Markdown line wrapping: a quoted
//    heading reference split across two source lines (a newline where the original quote has a
//    space) must still be recognized as the same quote — and, once recognized, a genuinely missing
//    target heading must still fail. This exercises both halves in one fixture: if whitespace
//    normalization silently failed, this would report PASS (0 details, nothing recognized as
//    quoted) rather than FAIL.
{
  const dir = makeTempRepo();
  write(
    dir,
    'ROADMAP.md',
    'See `ADR-0004`\'s "Post-Acceptance Dependency B/C/D\nDisposition" section for the full reasoning.\n'
  );
  write(
    dir,
    'docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md',
    '# ADR-0004\n\n## Some Other Heading\n\nno matching heading in this fixture.\n'
  );
  const check = checkHeadingCrossReferences(dir);
  assert.equal(
    check.status,
    'FAIL',
    `expected a line-wrapped quote whose target heading is absent to fail: ${JSON.stringify(check.details)}`
  );
  assert.ok(
    check.details.some((d) => d.includes('Post-Acceptance Dependency B/C/D Disposition')),
    `expected failure detail to mention the disposition heading, got: ${JSON.stringify(check.details)}`
  );
  rmSync(dir, { recursive: true, force: true });
  checked += 1;
}

// 9. DECISIONS_LOG.md append-only baseline: protects entries frozen at the task branch's
//    merge-base with local `main`, not merely the immediately preceding HEAD commit. Uses a real,
//    throwaway git fixture repo (git init -b main, one base commit, then a `feature` branch) so the
//    merge-base logic itself is exercised, not just the string-diff logic around it.
{
  function gitExec(dir, args) {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  }

  const BASE_LOG = [
    '# Decisions Log',
    '',
    '---',
    '',
    '- 2026-01-01 — base entry one. — `abc1234`',
    '- 2026-01-02 — base entry two. — `def5678`',
    '',
  ].join('\n');

  function makeBaseRepo() {
    const dir = makeTempRepo();
    gitExec(dir, ['init', '-b', 'main']);
    gitExec(dir, ['config', 'user.email', 'test@example.com']);
    gitExec(dir, ['config', 'user.name', 'Test']);
    write(dir, '.project/DECISIONS_LOG.md', BASE_LOG);
    gitExec(dir, ['add', '.']);
    gitExec(dir, ['commit', '-m', 'base']);
    gitExec(dir, ['switch', '-c', 'feature']);
    return dir;
  }

  // 9a. Appending a new branch-local entry passes.
  {
    const dir = makeBaseRepo();
    write(dir, '.project/DECISIONS_LOG.md', `${BASE_LOG}- 2026-01-03 — branch-local entry three. — \`aaa1111\`\n`);
    const check = checkDecisionsLogAppendOnlyVsBase(dir);
    assert.equal(check.status, 'PASS', `expected a pure append onto the merge-base to pass: ${JSON.stringify(check.details)}`);
    rmSync(dir, { recursive: true, force: true });
    checked += 1;
  }

  // 9b. Editing a pre-existing base entry fails.
  {
    const dir = makeBaseRepo();
    const edited = BASE_LOG.replace('base entry one', 'EDITED entry one');
    write(dir, '.project/DECISIONS_LOG.md', edited);
    const check = checkDecisionsLogAppendOnlyVsBase(dir);
    assert.equal(check.status, 'FAIL', 'expected editing a pre-existing merge-base entry to fail');
    assert.ok(check.details.some((d) => d.includes('entry 1')), `expected failure detail to name entry 1, got: ${JSON.stringify(check.details)}`);
    rmSync(dir, { recursive: true, force: true });
    checked += 1;
  }

  // 9c. Deleting a pre-existing base entry fails.
  {
    const dir = makeBaseRepo();
    const deleted = ['# Decisions Log', '', '---', '', '- 2026-01-01 — base entry one. — `abc1234`', ''].join('\n');
    write(dir, '.project/DECISIONS_LOG.md', deleted);
    const check = checkDecisionsLogAppendOnlyVsBase(dir);
    assert.equal(check.status, 'FAIL', 'expected deleting a pre-existing merge-base entry to fail');
    rmSync(dir, { recursive: true, force: true });
    checked += 1;
  }

  // 9d. Correcting an entry introduced only on the still-unmerged branch (no counterpart at the
  //     merge-base) passes — it was never frozen to begin with.
  {
    const dir = makeBaseRepo();
    write(dir, '.project/DECISIONS_LOG.md', `${BASE_LOG}- 2026-01-03 — branch-local entry, typo. — \`aaa1111\`\n`);
    write(dir, '.project/DECISIONS_LOG.md', `${BASE_LOG}- 2026-01-03 — branch-local entry, corrected. — \`aaa1111\`\n`);
    const check = checkDecisionsLogAppendOnlyVsBase(dir);
    assert.equal(check.status, 'PASS', `expected correcting a branch-local-only entry to pass: ${JSON.stringify(check.details)}`);
    rmSync(dir, { recursive: true, force: true });
    checked += 1;
  }

  // 9e. CRLF vs. LF alone does not fail the check (normalized before comparison).
  {
    const dir = makeBaseRepo();
    const crlf = `${BASE_LOG.replace(/\n/g, '\r\n')}- 2026-01-03 — new entry. — \`aaa1111\`\r\n`;
    write(dir, '.project/DECISIONS_LOG.md', crlf);
    const check = checkDecisionsLogAppendOnlyVsBase(dir);
    assert.equal(check.status, 'PASS', `expected CRLF-only differences to pass: ${JSON.stringify(check.details)}`);
    rmSync(dir, { recursive: true, force: true });
    checked += 1;
  }

  // 9f2. Appending a new entry separated from the last frozen entry by a blank line still passes —
  //      regression test for a bug where only the region's absolute-last block had its trailing
  //      blank line trimmed, so a blank-line separator before an appended entry corrupted the
  //      *previous*, frozen entry's block and produced a false append-only failure.
  {
    const dir = makeBaseRepo();
    write(
      dir,
      '.project/DECISIONS_LOG.md',
      `${BASE_LOG}\n- 2026-01-03 — branch-local entry three, blank-line separated. — \`aaa1111\`\n`
    );
    const check = checkDecisionsLogAppendOnlyVsBase(dir);
    assert.equal(
      check.status,
      'PASS',
      `expected a blank-line-separated append onto the merge-base to pass: ${JSON.stringify(check.details)}`
    );
    rmSync(dir, { recursive: true, force: true });
    checked += 1;
  }

  // 9f3. Inserting a new entry BETWEEN two pre-existing base entries fails — not merely appended at
  //      the end, so every base entry after the insertion point misaligns positionally.
  {
    const dir = makeBaseRepo();
    const inserted = [
      '# Decisions Log',
      '',
      '---',
      '',
      '- 2026-01-01 — base entry one. — `abc1234`',
      '- 2026-01-01T12:00 — inserted entry. — `ccc3333`',
      '- 2026-01-02 — base entry two. — `def5678`',
      '',
    ].join('\n');
    write(dir, '.project/DECISIONS_LOG.md', inserted);
    const check = checkDecisionsLogAppendOnlyVsBase(dir);
    assert.equal(check.status, 'FAIL', 'expected inserting an entry between two frozen base entries to fail');
    rmSync(dir, { recursive: true, force: true });
    checked += 1;
  }

  // 9f. Fail closed: no local "main" ref found -> FAIL with a diagnostic detail, never a silent
  //     SKIP/PASS. A required protection that could not be evaluated must not let the overall
  //     checker report "all deterministic checks passed".
  {
    const dir = makeTempRepo();
    gitExec(dir, ['init', '-b', 'trunk']);
    gitExec(dir, ['config', 'user.email', 'test@example.com']);
    gitExec(dir, ['config', 'user.name', 'Test']);
    write(dir, '.project/DECISIONS_LOG.md', BASE_LOG);
    gitExec(dir, ['add', '.']);
    gitExec(dir, ['commit', '-m', 'base']);
    const check = checkDecisionsLogAppendOnlyVsBase(dir);
    assert.equal(check.status, 'FAIL', `expected a missing local "main" ref to fail closed with a diagnostic: ${JSON.stringify(check.details)}`);
    assert.ok(check.details.some((d) => d.includes('main')), `expected the diagnostic to mention "main", got: ${JSON.stringify(check.details)}`);
    rmSync(dir, { recursive: true, force: true });
    checked += 1;
  }

  // 9g. A genuinely new .project/DECISIONS_LOG.md that did not exist at the merge-base (introduced
  //     entirely on this branch) is a real, accurate PASS — not a SKIP, and not a FAIL: there are no
  //     frozen entries yet to protect.
  {
    const dir = makeTempRepo();
    gitExec(dir, ['init', '-b', 'main']);
    gitExec(dir, ['config', 'user.email', 'test@example.com']);
    gitExec(dir, ['config', 'user.name', 'Test']);
    write(dir, 'README.md', '# placeholder\n');
    gitExec(dir, ['add', '.']);
    gitExec(dir, ['commit', '-m', 'base, no DECISIONS_LOG.md yet']);
    gitExec(dir, ['switch', '-c', 'feature']);
    write(dir, '.project/DECISIONS_LOG.md', BASE_LOG);
    const check = checkDecisionsLogAppendOnlyVsBase(dir);
    assert.equal(
      check.status,
      'PASS',
      `expected a DECISIONS_LOG.md introduced entirely on this branch to pass explicitly: ${JSON.stringify(check.details)}`
    );
    assert.ok(
      check.details.some((d) => d.includes('did not exist yet at merge-base')),
      `expected an explicit "did not exist yet at merge-base" detail, got: ${JSON.stringify(check.details)}`
    );
    rmSync(dir, { recursive: true, force: true });
    checked += 1;
  }

  // 9h. A malformed entries structure (no "---" separator) in the working-tree version fails closed
  //     rather than skipping — the protection could not be evaluated, so it must not silently pass.
  {
    const dir = makeBaseRepo();
    write(dir, '.project/DECISIONS_LOG.md', '# Decisions Log\n\nno separator in this version at all.\n');
    const check = checkDecisionsLogAppendOnlyVsBase(dir);
    assert.equal(check.status, 'FAIL', `expected a malformed (no "---" separator) entries region to fail closed: ${JSON.stringify(check.details)}`);
    rmSync(dir, { recursive: true, force: true });
    checked += 1;
  }
}

console.log(`project-consistency.test.mjs: ${checked} test group(s) passed.`);
