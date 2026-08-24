#!/usr/bin/env node
// Deterministic, read-only, zero-network consistency checks for MIHVER's own development
// documents. See docs/development/AGENT_POLICY.md's "Document Authority Model" and
// "Task File Scope Model" for the policy this script enforces a narrow, mechanical slice of.
//
// This script proves only what it can prove mechanically: required files exist, a registered
// literal heading a document quotes still exists in the file it points at, a registered
// owner-field value (e.g. an ADR's own `## Status`) matches a registered mirror's restatement of
// it, and a couple of structural shape rules for `.project/DECISIONS_LOG.md`. It does not parse
// natural-language meaning, does not detect every stale sentence, and does not replace human/Codex
// review of a consistency sweep — see docs/development/REVIEW_PROTOCOL.md's "Final Consistency
// Sweep". Every check here is scoped to explicitly registered facts/files, not a repo-wide
// semantic scan, precisely to keep false positives low: a mention of an old phrase inside
// historical prose (e.g. "renamed from X to Y") is never treated as a live claim.
//
// Never writes to any file. Node built-ins only.

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = dirname(dirname(__dirname));

function read(repoRoot, relPath) {
  const abs = join(repoRoot, relPath);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, 'utf8');
}

function headingExists(content, headingText) {
  const escaped = headingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^#{2,3}\\s+${escaped}\\s*$`, 'm').test(content);
}

// Collapses all runs of whitespace (including the newline introduced by ordinary Markdown line
// wrapping) to a single space, so a quoted heading reference that happens to wrap across two
// source lines is still recognized as the same quote. Deliberately bounded/mechanical — this does
// not attempt any semantic Markdown parsing, just whitespace normalization.
function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ');
}

// --- Check: required development files exist ---------------------------------------------

const REQUIRED_FILES = [
  'CLAUDE.md',
  'docs/development/AGENT_POLICY.md',
  'docs/development/REVIEW_PROTOCOL.md',
  'docs/development/TASK_TEMPLATE.md',
  '.project/PROJECT_STATE.md',
  '.project/CURRENT_TASK.md',
  '.project/REVIEW_STATE.md',
  '.project/CONTEXT_INDEX.md',
  '.project/DECISIONS_LOG.md',
  'ROADMAP.md',
];

export function checkRequiredFiles(repoRoot) {
  const missing = REQUIRED_FILES.filter((relPath) => !existsSync(join(repoRoot, relPath)));
  return {
    name: 'required-files-exist',
    status: missing.length === 0 ? 'PASS' : 'FAIL',
    details: missing.map((relPath) => `missing required file: ${relPath}`),
  };
}

// --- Check: durable mirrors (PROJECT_STATE.md, ROADMAP.md) must not claim an active task -------
//
// `## Task ID` is CURRENT_TASK.md's own signature heading (see AGENT_POLICY.md's "Operational
// State Scope": PROJECT_STATE.md "never records active-task or branch-specific facts"). Its
// presence in a durable/navigation mirror is a structural sign that in-progress task content leaked
// into a file that must stay checkpoint-only.

const NO_ACTIVE_TASK_FILES = ['.project/PROJECT_STATE.md', 'ROADMAP.md'];

export function checkNoActiveTaskInDurableMirrors(repoRoot) {
  const details = [];
  for (const relPath of NO_ACTIVE_TASK_FILES) {
    const content = read(repoRoot, relPath);
    if (content === null) continue; // covered by checkRequiredFiles
    if (/^##\s+Task ID\s*$/m.test(content)) {
      details.push(`${relPath} contains a "## Task ID" heading — active-task content belongs in .project/CURRENT_TASK.md only`);
    }
  }
  return { name: 'no-active-task-in-durable-mirrors', status: details.length === 0 ? 'PASS' : 'FAIL', details };
}

// --- Check: DECISIONS_LOG.md entry shape -------------------------------------------------------
//
// Every top-level bullet (a line starting with "- " at column 0) must open with `YYYY-MM-DD — `,
// per the file's own declared format. Continuation/narrative lines (indented, or not starting with
// "- ") are not checked here — this only proves the append-only record's own entries are shaped
// correctly, not that their prose content is accurate.

export function checkDecisionsLogEntryShape(repoRoot) {
  const content = read(repoRoot, '.project/DECISIONS_LOG.md');
  if (content === null) return { name: 'decisions-log-entry-shape', status: 'SKIP', details: ['.project/DECISIONS_LOG.md not found'] };
  const details = [];
  const lines = content.split(/\r?\n/);
  const datePattern = /^- \d{4}-\d{2}-\d{2} — /;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^-\s/.test(line) && !datePattern.test(line)) {
      details.push(`line ${i + 1}: top-level entry does not start with "- YYYY-MM-DD — ": ${JSON.stringify(line.slice(0, 60))}`);
    }
  }
  return { name: 'decisions-log-entry-shape', status: details.length === 0 ? 'PASS' : 'FAIL', details };
}

// --- Check: DECISIONS_LOG.md's entries region is append-only vs. the task branch's base --------
//
// Protects the entries that already existed at the task branch's *merge-base with local main* —
// not merely the immediately preceding HEAD commit, which would incorrectly let an in-progress
// branch "freeze" its own not-yet-merged, not-yet-reviewed entries after every commit. Reads the
// file's content at that merge-base (via `git merge-base` + `git show`, both read-only/zero-
// network) and compares it against the working tree, entry block by entry block (a "block" is a
// top-level `- YYYY-MM-DD — ` bullet plus its indented continuation lines) rather than a single
// whole-region prefix string, so that:
//   - editing or deleting a pre-existing base entry fails (its block position disagrees), but
//   - appending a new branch-local entry passes, and
//   - correcting an entry that was itself introduced only on the still-unmerged branch (i.e. it has
//     no counterpart at the merge-base) also passes — that entry was never frozen to begin with.
// CRLF is normalized to LF before comparing so line-ending differences alone never fail the check.
//
// FAILS CLOSED: this check exists to protect frozen entries, so whenever the required frozen
// baseline cannot actually be established or read — no local `main` ref, no merge-base, or a
// malformed "---" entries-region structure in either version — the result is FAIL, not SKIP. A
// silent SKIP here would let `main()`'s summary print "all deterministic checks passed" while this
// protection was never actually evaluated, which is exactly the false confidence this check exists
// to prevent. The one case that legitimately isn't a failure: `.project/DECISIONS_LOG.md` genuinely
// did not exist yet at the merge-base (a brand-new file introduced entirely on this branch) — there
// are no frozen entries to protect, so that's reported as an explicit, accurate PASS, not a SKIP.

function entriesRegion(content) {
  const match = content.match(/\n---\n/);
  return match ? content.slice(match.index + match[0].length) : null;
}

function normalizeLineEndings(content) {
  return content.replace(/\r\n/g, '\n');
}

// Splits an entries region into top-level bullet blocks: each block starts at a line matching
// `/^-\s/` (a top-level bullet marker) and includes every following line up to the next top-level
// bullet or the end of the region. Blank/lead-in lines before the first bullet are dropped — they
// carry no entry content to protect. Trailing blank lines are trimmed from *every* block
// individually (not just stripped once at the end of the whole region): otherwise a block's
// trailing-blank-or-not shape would depend on whether it happens to be positionally last, or on
// whether whatever follows it happens to be separated by a blank line — both irrelevant to the
// entry's actual content, and both would otherwise produce a false append-only failure (e.g. a
// pre-existing entry that a later, purely additive edit separated from a new entry with a blank
// line for readability).
function splitEntryBlocks(entriesText) {
  const lines = entriesText.split('\n');
  const blocks = [];
  let current = null;
  const flush = () => {
    if (current === null) return;
    while (current.length > 0 && current[current.length - 1] === '') current.pop();
    blocks.push(current.join('\n'));
  };
  for (const line of lines) {
    if (/^-\s/.test(line)) {
      flush();
      current = [line];
    } else if (current !== null) {
      current.push(line);
    }
  }
  flush();
  return blocks;
}

function resolveMergeBaseWithMain(repoRoot) {
  try {
    execSync('git rev-parse --verify main', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return { ref: null, diagnostic: 'no local "main" branch ref found (git rev-parse --verify main failed) — not a git repo, or main was never fetched/created locally' };
  }
  try {
    const base = execSync('git merge-base HEAD main', { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { ref: base || null, diagnostic: base ? null : 'git merge-base HEAD main returned no commit' };
  } catch {
    return { ref: null, diagnostic: 'git merge-base HEAD main failed (e.g. unrelated histories, detached state)' };
  }
}

export function checkDecisionsLogAppendOnlyVsBase(repoRoot) {
  const name = 'decisions-log-append-only-vs-base';
  const current = read(repoRoot, '.project/DECISIONS_LOG.md');
  if (current === null) return { name, status: 'SKIP', details: ['.project/DECISIONS_LOG.md not found (covered separately by required-files-exist)'] };

  const { ref: baseRef, diagnostic } = resolveMergeBaseWithMain(repoRoot);
  if (baseRef === null) {
    return {
      name,
      status: 'FAIL',
      details: [
        `could not establish the required zero-network git baseline (merge-base with local main), so the append-only protection could not be evaluated: ${diagnostic}`,
      ],
    };
  }

  // Distinguish "the file genuinely didn't exist yet at the merge-base" (a new file introduced on
  // this branch — nothing frozen to protect, an accurate PASS) from any other failure to read its
  // content at that commit (a malformed/unreadable baseline — FAIL, never a silent SKIP).
  let existedAtBase = true;
  try {
    execSync(`git cat-file -e ${baseRef}:.project/DECISIONS_LOG.md`, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    existedAtBase = false;
  }
  if (!existedAtBase) {
    return {
      name,
      status: 'PASS',
      details: [`.project/DECISIONS_LOG.md did not exist yet at merge-base ${baseRef} — a new file introduced on this branch; no frozen entries to protect`],
    };
  }

  let atBase;
  try {
    atBase = execSync(`git show ${baseRef}:.project/DECISIONS_LOG.md`, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return {
      name,
      status: 'FAIL',
      details: [`.project/DECISIONS_LOG.md exists at merge-base ${baseRef} but its content could not be read — the append-only protection could not be evaluated`],
    };
  }

  const currentEntries = entriesRegion(normalizeLineEndings(current));
  const baseEntries = entriesRegion(normalizeLineEndings(atBase));
  if (currentEntries === null || baseEntries === null) {
    const malformedSides = [currentEntries === null ? 'working tree' : null, baseEntries === null ? `merge-base ${baseRef}` : null].filter(Boolean);
    return {
      name,
      status: 'FAIL',
      details: [`could not locate a "---" entries separator in the ${malformedSides.join(' or ')} version — the append-only protection could not be evaluated`],
    };
  }

  const currentBlocks = splitEntryBlocks(currentEntries);
  const baseBlocks = splitEntryBlocks(baseEntries);

  if (currentBlocks.length < baseBlocks.length) {
    return {
      name,
      status: 'FAIL',
      details: [
        `.project/DECISIONS_LOG.md has fewer top-level entries (${currentBlocks.length}) than it did at merge-base ${baseRef} (${baseBlocks.length}) — a pre-existing entry appears to have been deleted`,
      ],
    };
  }

  const details = [];
  for (let i = 0; i < baseBlocks.length; i += 1) {
    if (currentBlocks[i] !== baseBlocks[i]) {
      details.push(
        `entry ${i + 1} (frozen at merge-base ${baseRef}) does not match the working tree version — a pre-existing entry appears to have been edited: ${JSON.stringify(
          baseBlocks[i].slice(0, 60)
        )} → ${JSON.stringify(currentBlocks[i].slice(0, 60))}`
      );
    }
  }
  return { name, status: details.length === 0 ? 'PASS' : 'FAIL', details };
}

// --- Check: registered literal heading cross-references --------------------------------------
//
// A small, explicit, hand-maintained registry of {source file, quoted heading text, target file}
// triples for cross-references this repository's own history has shown go stale after a heading
// rename (see e.g. ADR-0004's "Post-Acceptance Dependency B/C Disposition" -> ".../B/C/D
// Disposition" rename). A registry entry only fires when its quoted text is still present in the
// source file (if the source stopped quoting it, there's nothing to check); when present, the
// target file must contain a matching `##`/`###` heading. This intentionally does not scan the
// whole repository for the phrase — only these explicitly registered pairs — so a historical quote
// of an old heading name elsewhere is never flagged.

const HEADING_REFERENCES = [
  { source: 'CLAUDE.md', quoted: '"Latest Review"', target: '.project/REVIEW_STATE.md', heading: 'Latest Review' },
  { source: 'CLAUDE.md', quoted: '"Next Authorized Action"', target: '.project/PROJECT_STATE.md', heading: 'Next Authorized Action' },
  { source: 'CLAUDE.md', quoted: '"Git & Branch Workflow"', target: 'docs/development/AGENT_POLICY.md', heading: 'Git & Branch Workflow' },
  { source: 'docs/development/AGENT_POLICY.md', quoted: '"Latest Review"', target: '.project/REVIEW_STATE.md', heading: 'Latest Review' },
  { source: 'docs/development/AGENT_POLICY.md', quoted: '"Next Authorized Action"', target: '.project/PROJECT_STATE.md', heading: 'Next Authorized Action' },
  { source: 'docs/development/REVIEW_PROTOCOL.md', quoted: '"Git & Branch Workflow"', target: 'docs/development/AGENT_POLICY.md', heading: 'Git & Branch Workflow' },
  { source: 'docs/development/TASK_TEMPLATE.md', quoted: '"Task Contract"', target: 'docs/development/AGENT_POLICY.md', heading: 'Task Contract' },
  { source: 'ROADMAP.md', quoted: '"Next Authorized Action"', target: '.project/PROJECT_STATE.md', heading: 'Next Authorized Action' },
  {
    source: 'ROADMAP.md',
    quoted: '"Post-Acceptance Dependency B/C/D Disposition"',
    target: 'docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md',
    heading: 'Post-Acceptance Dependency B/C/D Disposition',
  },
  // The currently-live direct quotes of this same ADR-0004 heading elsewhere in the repository.
  // This rename (from "...B/C Disposition" to "...B/C/D Disposition") has already gone stale once
  // in this repository's own history (see DEPENDENCY-D-FINAL-CROSSREF-HYGIENE in
  // .project/REVIEW_STATE.md) — several of these quotes wrap across two source lines under
  // ordinary Markdown line wrapping, which is why the matching below is whitespace-normalized.
  {
    source: 'docs/foundation/M0_SCOPE.md',
    quoted: '"Post-Acceptance Dependency B/C/D Disposition"',
    target: 'docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md',
    heading: 'Post-Acceptance Dependency B/C/D Disposition',
  },
  {
    source: 'docs/contracts/MEMORY_CONTEXT.md',
    quoted: '"Post-Acceptance Dependency B/C/D Disposition"',
    target: 'docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md',
    heading: 'Post-Acceptance Dependency B/C/D Disposition',
  },
  {
    source: 'docs/contracts/REQUIREMENT_SPEC.md',
    quoted: '"Post-Acceptance Dependency B/C/D Disposition"',
    target: 'docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md',
    heading: 'Post-Acceptance Dependency B/C/D Disposition',
  },
  {
    source: 'docs/examples/MEMORY_CONTEXT_CASES.md',
    quoted: '"Post-Acceptance Dependency B/C/D Disposition"',
    target: 'docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md',
    heading: 'Post-Acceptance Dependency B/C/D Disposition',
  },
  {
    source: 'docs/examples/REQUIREMENT_CASES.md',
    quoted: '"Post-Acceptance Dependency B/C/D Disposition"',
    target: 'docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md',
    heading: 'Post-Acceptance Dependency B/C/D Disposition',
  },
];

export function checkHeadingCrossReferences(repoRoot) {
  const details = [];
  for (const ref of HEADING_REFERENCES) {
    const sourceContent = read(repoRoot, ref.source);
    // Whitespace-normalized: tolerates the quoted heading text wrapping across two source lines
    // under ordinary Markdown line wrapping (a newline where the original quote has a space).
    if (sourceContent === null || !normalizeWhitespace(sourceContent).includes(normalizeWhitespace(ref.quoted))) continue; // not currently quoted; nothing to check
    const targetContent = read(repoRoot, ref.target);
    if (targetContent === null) {
      details.push(`${ref.source} quotes ${ref.quoted} pointing at ${ref.target}, which does not exist`);
      continue;
    }
    if (!headingExists(targetContent, ref.heading)) {
      details.push(`${ref.source} quotes ${ref.quoted} but ${ref.target} has no "## ${ref.heading}" (or "### ...") heading — likely renamed`);
    }
  }
  return { name: 'registered-heading-cross-references', status: details.length === 0 ? 'PASS' : 'FAIL', details };
}

// --- Check: registered owner vs. mirror status ---------------------------------------------
//
// For a small set of explicitly registered facts, reads the value from its OWNER (an ADR's own
// `## Status` field) and from a MIRROR restatement inside `.project/PROJECT_STATE.md`'s "Current
// Capability Snapshot" section, and asserts they agree (case-insensitively). This is a direct,
// narrow implementation of the Owner/Mirror model in AGENT_POLICY.md: the mirror must track the
// owner, never compete with it.

function extractAdrStatus(content) {
  const match = content.match(/^##\s+Status\s*\n+\s*(\S+)/m);
  return match ? match[1].trim() : null;
}

function extractSnapshotToken(content, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`^-\\s*${escaped}[^:\\n]*:\\s*([A-Z_]+)`, 'm'));
  return match ? match[1].trim() : null;
}

const OWNER_MIRROR_STATUS = [
  { label: 'ADR-0002', ownerFile: 'docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md' },
  { label: 'ADR-0003', ownerFile: 'docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md' },
  { label: 'ADR-0004', ownerFile: 'docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md' },
];

export function checkOwnerMirrorAdrStatus(repoRoot) {
  const snapshot = read(repoRoot, '.project/PROJECT_STATE.md');
  if (snapshot === null) return { name: 'owner-mirror-adr-status', status: 'SKIP', details: ['.project/PROJECT_STATE.md not found'] };
  const details = [];
  for (const { label, ownerFile } of OWNER_MIRROR_STATUS) {
    const ownerContent = read(repoRoot, ownerFile);
    if (ownerContent === null) {
      details.push(`${label}: owner file ${ownerFile} not found`);
      continue;
    }
    const ownerStatus = extractAdrStatus(ownerContent);
    const mirrorStatus = extractSnapshotToken(snapshot, label);
    if (mirrorStatus === null) continue; // Snapshot doesn't currently restate this fact; nothing to compare
    if (ownerStatus === null) {
      details.push(`${label}: could not parse an owner "## Status" field from ${ownerFile}`);
      continue;
    }
    if (ownerStatus.toUpperCase() !== mirrorStatus.toUpperCase()) {
      details.push(
        `${label}: owner ${ownerFile} says Status "${ownerStatus}" but .project/PROJECT_STATE.md's Current Capability Snapshot says "${mirrorStatus}"`
      );
    }
  }
  return { name: 'owner-mirror-adr-status', status: details.length === 0 ? 'PASS' : 'FAIL', details };
}

// --- Check: registered dependency-status mirror (PROJECT_STATE.md vs. ROADMAP.md Phase 9) -----
//
// PROJECT_STATE.md's Current Capability Snapshot states Dependency B/C/D status as short tokens;
// ROADMAP.md's own "Phase 9" heading restates the same three tokens for navigation. These are two
// independent mirrors of the same underlying fact (the actual owner is the merged PR history /
// M0_SCOPE.md's consumer list) — this check only proves the two mirrors agree with each other, not
// that either is independently correct.

export function checkDependencyStatusMirror(repoRoot) {
  const snapshot = read(repoRoot, '.project/PROJECT_STATE.md');
  const roadmap = read(repoRoot, 'ROADMAP.md');
  if (snapshot === null || roadmap === null) {
    return { name: 'dependency-status-mirror', status: 'SKIP', details: ['.project/PROJECT_STATE.md or ROADMAP.md not found'] };
  }
  const phase9 = roadmap.match(/^##\s+Phase 9[^\n]*—\s*B\s+(\w+),\s*C\s+(\w+),\s*D\s+(\w+)/m);
  if (!phase9) return { name: 'dependency-status-mirror', status: 'SKIP', details: ['ROADMAP.md has no parseable "Phase 9 ... B x, C y, D z" heading'] };
  const [, roadmapB, roadmapC, roadmapD] = phase9;
  const snapshotB = extractSnapshotToken(snapshot, 'Dependency B');
  const snapshotC = extractSnapshotToken(snapshot, 'Dependency C');
  const snapshotD = extractSnapshotToken(snapshot, 'Dependency D');
  const details = [];
  for (const [dep, roadmapVal, snapVal] of [['B', roadmapB, snapshotB], ['C', roadmapC, snapshotC], ['D', roadmapD, snapshotD]]) {
    if (snapVal === null) continue; // Snapshot doesn't restate this dependency; nothing to compare
    if (roadmapVal.toUpperCase() !== snapVal.toUpperCase()) {
      details.push(`Dependency ${dep}: ROADMAP.md Phase 9 heading says "${roadmapVal}" but PROJECT_STATE.md's Snapshot says "${snapVal}"`);
    }
  }
  return { name: 'dependency-status-mirror', status: details.length === 0 ? 'PASS' : 'FAIL', details };
}

// --- Runner --------------------------------------------------------------------------------

export function runAllChecks(repoRoot) {
  return [
    checkRequiredFiles(repoRoot),
    checkNoActiveTaskInDurableMirrors(repoRoot),
    checkDecisionsLogEntryShape(repoRoot),
    checkDecisionsLogAppendOnlyVsBase(repoRoot),
    checkHeadingCrossReferences(repoRoot),
    checkOwnerMirrorAdrStatus(repoRoot),
    checkDependencyStatusMirror(repoRoot),
  ];
}

function main() {
  const repoRoot = defaultRepoRoot;
  const results = runAllChecks(repoRoot);
  let failed = 0;
  for (const result of results) {
    const marker = result.status === 'PASS' ? 'PASS' : result.status === 'SKIP' ? 'SKIP' : 'FAIL';
    console.log(`[${marker}] ${result.name}`);
    for (const detail of result.details) console.log(`       - ${detail}`);
    if (result.status === 'FAIL') failed += 1;
  }
  console.log('');
  console.log(
    failed === 0
      ? 'project-consistency: all deterministic checks passed (this does not prove full repository consistency — see REVIEW_PROTOCOL.md\'s Final Consistency Sweep for what remains reviewer-only).'
      : `project-consistency: ${failed} check(s) failed.`
  );
  process.exit(failed === 0 ? 0 : 1);
}

const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main();
}
