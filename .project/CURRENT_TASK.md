# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

DEPENDENCY-D-FINAL-CROSSREF-HYGIENE

## Objective

A single-purpose cross-reference hygiene pass, continuing PR #27. Does not reopen Dependency D
semantics. Fixed the one confirmed residual named by this task
(`docs/examples/MEMORY_CONTEXT_CASES.md`'s line-wrapped stale reference to the pre-rename ADR
section title "Post-Acceptance Dependency B/C Disposition"), then swept every PR-changed semantic/
docs file for the same stale phrase and fixed four further genuine live cross-references it found
(`docs/contracts/MEMORY_CONTEXT.md` ×2, `docs/contracts/REQUIREMENT_SPEC.md`, `docs/examples/
REQUIREMENT_CASES.md`, `docs/foundation/M0_SCOPE.md`) — all pure string corrections to the ADR
section name, no semantic/authorization content touched.

## Branch / Base

Branch: `m0/dependency-d-r19-memory-decision-option` (existing, continued — not a new branch).
PR: `mihvernetwork/mihver#27` (existing, open, continued — not a new PR, not merged).

## Status

**Complete, pending human review.**

**Fixes applied:**

1. **Named residual.** `docs/examples/MEMORY_CONTEXT_CASES.md` line ~67: a line-wrapped live
   cross-reference — `see ADR-0004's "Post-Acceptance Dependency B/C\nDisposition"` — corrected to
   "...B/C/D Disposition", matching the ADR heading's actual (already-renamed) current text.
2. **Sweep result.** A whitespace-tolerant sweep (`tr '\n' ' '` + grep, to catch line-wrapped
   instances a plain `grep -n` would miss) of every file this PR has touched relative to `main`
   found four further genuine, live, stale cross-references to the pre-rename heading — none of
   them the previously-flagged instance, all newly found by this task's own sweep:
   `docs/contracts/MEMORY_CONTEXT.md` (two, lines ~12 and ~484), `docs/contracts/REQUIREMENT_SPEC.md`
   (one, line ~360, line-wrapped), `docs/examples/REQUIREMENT_CASES.md` (one, line ~769),
   `docs/foundation/M0_SCOPE.md` (one, line ~364). Each was individually read in context before
   editing to confirm it was a live pointer (not a historical quote of the pre-rename name) before
   fixing — all five now read "Post-Acceptance Dependency B/C/D Disposition". Every diff hunk touches
   only the section-name string itself; no surrounding sentence, invariant, or semantic content was
   altered.
3. **Legitimately-preserved instances.** Three remaining "B/C Disposition" (no /D) occurrences —
   `.project/CURRENT_TASK.md` (one) and `.project/REVIEW_STATE.md` (two, from the prior closure
   task's own Status/History text) — were individually read and confirmed to be historical quotes
   describing the rename itself (e.g. "renamed 'Post-Acceptance Dependency B/C Disposition' →
   '...B/C/D Disposition'"), not live cross-references; correctly left unchanged, since rewriting
   them would falsify the historical record of what the old name was.

**Final re-sweep:** zero remaining live/current references to the pre-rename heading across every
PR-changed semantic/docs file (`docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`,
`docs/contracts/REQUIREMENT_SPEC.md`, `docs/contracts/MEMORY_CONTEXT.md`,
`docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`, `docs/examples/REQUIREMENT_CASES.md`,
`docs/examples/MEMORY_CONTEXT_CASES.md`, `docs/foundation/M0_SCOPE.md`).

## Allowed Scope

`docs/examples/MEMORY_CONTEXT_CASES.md` (the named residual), plus — discovered necessary by this
task's own required sweep, not pre-declared — `docs/contracts/MEMORY_CONTEXT.md`,
`docs/contracts/REQUIREMENT_SPEC.md`, `docs/examples/REQUIREMENT_CASES.md`,
`docs/foundation/M0_SCOPE.md` (cross-reference string only, no semantic content), plus
`.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`.

Not modified, per explicit instruction: R-09, R-19, R-21, R-23, R-24 (no defining invariant text
touched in any file); `M0_SCOPE.md`'s stage/authorization semantics (only its one cross-reference
string changed); ADR-0004's own semantics (untouched — the heading itself was already correctly
renamed by the prior closure; this task only fixed *pointers to* it); any `REQUIREMENT_CASES.md`/
`MEMORY_CONTEXT_CASES.md` case content beyond the exact stale-phrase occurrences; `schemas/**`,
`tests/**`, `scripts/**`, `package*.json`, `mihver-brain/**`, `.project/PROJECT_STATE.md`,
`.project/DECISIONS_LOG.md`, `.project/CONTEXT_INDEX.md`, `ROADMAP.md`.

## Required Context

The named file plus every file `git diff main --stat` reported as changed on this branch, swept for
the stale phrase: `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`,
`docs/contracts/REQUIREMENT_SPEC.md`, `docs/contracts/MEMORY_CONTEXT.md`,
`docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`, `docs/examples/REQUIREMENT_CASES.md`,
`docs/examples/MEMORY_CONTEXT_CASES.md`, `docs/foundation/M0_SCOPE.md`.

## Validation

- `npm test`: 85/85, unchanged — no schema/test/fixture file touched.
- `git diff --check`: clean.
- `git diff HEAD^ --stat`: exactly the six changed files (five content files plus this file/
  `REVIEW_STATE.md` once committed) — each hunk a single cross-reference string, confirmed via
  `git diff HEAD^ --`.
- Confirmed: zero remaining stale live references to the pre-rename ADR heading anywhere in the
  PR's changed files; R-09/R-19/R-21/R-23/R-24 and all stage-authorization semantics byte-unchanged.

## Next Gate

Commit and push to the existing branch `m0/dependency-d-r19-memory-decision-option`, existing PR #27.
Do not open a new PR. Do not merge. Human review of PR #27 (now including this hygiene round) is the
next gate.
