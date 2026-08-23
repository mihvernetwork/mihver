# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

DEPENDENCY-C-DISPOSITION-SEMANTIC-CLOSURE

## Objective

A narrow closure pass on top of `M0-DEPENDENCY-C-DISPOSITION` (already pushed as PR #24, open, not
merged), fixing two findings an external review of that PR raised — without reopening the retirement
decision, without implementing Dependency D, and without touching schema/runtime/Brain. The
retirement conclusion (direct `MemoryContext → Requirement-Level Inference premise` is retired, not
implemented; the canonical path for historical-user memory to affect a Requirement remains
`MemoryContext → Intent Parsing (Dependency B) → current-run Inferred Claim → Requirement Derivation
(existing R-03/R-10/R-22)`) is unchanged by this task. Fixed: (1) three passages whose retirement
*reasoning* overstated itself in a way that could be misread as "intent-shaped premises are
categorically forbidden" — reworded to make explicit that an accepted `IntentSpec` Claim (itself
intent-derived) remains a fully valid premise, and that the real boundary is raw/historical/unaccepted
`MemoryContext` content specifically, not intent-derived content as such; also scoped `MEMORY_CONTEXT.md`'s
absolute "no third way" language to `SEMANTIC_PREMISE`/premise standing so Dependency D's separate,
still-pending path is not foreclosed; (2) `REQUIREMENT_CASES.md` Case 21, which had invented an
unsupported "carried-forward Unknown" not present in its own stated `IntentSpec` input. Dependency D
remains unaffected, unimplemented, and out of scope.

## Branch / Base

Branch: `m0/dependency-c-disposition` (continuation — same branch/PR as `M0-DEPENDENCY-C-DISPOSITION`,
no new branch created).
Base: `main` at `e0a040928112bf87a9353450c6f5116320f4078a`, unchanged from that task. PR #24 confirmed
open against `mihvernetwork/mihver:main` via `gh pr view 24` before any edit.

## Status

**Complete, pending human review.**

Delegated the bounded edit to a Codex write-capable worker, scoped to exactly the four files named in
Allowed Scope below (Codex explicitly instructed not to touch `.project/CURRENT_TASK.md` /
`REVIEW_STATE.md`, `M0_SCOPE.md`, `MEMORY_CONTEXT_CASES.md`, or any schema/test/runtime file). Claude
independently reviewed the resulting diff line-by-line (not merely the worker's self-report) before
accepting it, confirmed via `git status --short` that only the four allowed files changed, and ran
`npm test`/`git diff --check`/`git diff main --stat` directly.

- **Finding 1 fixed** — reworded reason (2) of the Dependency C retirement in
  `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, the "never about intent" bullet in
  `docs/contracts/REQUIREMENT_SPEC.md`'s "`MemoryContext` Is Not a Requirement-Level Inference
  Premise" subsection, and the "There is no third way, and none is coming" paragraph in
  `docs/contracts/MEMORY_CONTEXT.md`'s Historical User Memory Rule section — each now distinguishes
  raw/historical/unaccepted `MemoryContext` content (disqualified) from an accepted `IntentSpec` Claim
  (a fully valid R-10 premise, per Case 18, regardless of its own intent-derived origin). The
  `MEMORY_CONTEXT.md` paragraph additionally now scopes its absolute language explicitly to
  `SEMANTIC_PREMISE`/Requirement-Level-Inference-premise standing, so Dependency D's separate
  `DECISION_OPTION` path is not read as foreclosed. R-10, R-22, and R-23 themselves are
  byte-unchanged — only surrounding prose reasoning was reworded.
- **Finding 2 fixed** — `docs/examples/REQUIREMENT_CASES.md` Case 21's Eligibility paragraph no
  longer claims an unsupported "carried-forward Unknown"; it now states the retry-count/backoff
  detail simply remains unspecified/unconstrained by this `RequirementSpec` version, that its mere
  absence from the stated input manufactures no new Open Item, with a contrast sentence noting
  R-19/R-21 would govern an actual surviving Unknown if the input had contained one. The
  retry-obligation Requirement's own Complete status is unchanged.
- **Targeted sweep** — every "only"/"exclusively"/"no third way"/"never"/"intent-shaped" instance in
  the newly-added C-disposition wording across all four files individually checked against three
  tests (prohibits D? disqualifies accepted Claims as premises? collapses raw memory with an accepted
  Claim?); the case-family intro paragraph in `REQUIREMENT_CASES.md` was additionally tightened
  during the sweep for the same reason as Finding 1; every other matched instance confirmed already
  correctly scoped.
- One fresh independent read-only Codex reviewer (C-Retirement/D-Separation Closure, 9-point
  checklist) found **no findings** — independently re-verified by Claude against primary text, not
  trusted at face value; full detail in `REVIEW_STATE.md`'s "Latest Review."

**Prior task's own detail** (`M0-DEPENDENCY-C-DISPOSITION`: the STOP-verdict re-verification, the
per-file disposition edits across `ADR-0004`, `REQUIREMENT_SPEC.md`, `M0_SCOPE.md`,
`MEMORY_CONTEXT.md`, `MEMORY_CONTEXT_CASES.md`, `REQUIREMENT_CASES.md`, and that task's own
reviewer-driven fixes) is preserved in full in `REVIEW_STATE.md`'s History — not restated here, since
this closure task changed none of that reasoning's conclusions, only sharpened wording in four of
those files as described above.

## Allowed Scope

`docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, `docs/contracts/REQUIREMENT_SPEC.md`,
`docs/contracts/MEMORY_CONTEXT.md`, `docs/examples/REQUIREMENT_CASES.md`,
`.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`.

Forbidden and confirmed untouched: `docs/foundation/M0_SCOPE.md`,
`docs/examples/MEMORY_CONTEXT_CASES.md`, `docs/contracts/INTENT_SPEC.md`,
`docs/examples/INTENT_CASES.md`, `docs/contracts/USER_IDEA.md`, `schemas/**`, `tests/**`,
`scripts/**`, `docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`, `.project/PROJECT_STATE.md`,
`.project/DECISIONS_LOG.md`, `.project/CONTEXT_INDEX.md`, `ROADMAP.md`, `../mihver-brain/**`. No
machine schema. No runtime. No implementation of Dependency D.

## Required Context

`docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`'s "Post-Acceptance Dependency B/C
Disposition" section, `docs/contracts/REQUIREMENT_SPEC.md`'s "`MemoryContext` Is Not a
Requirement-Level Inference Premise" subsection and R-10/R-22/R-23, `docs/contracts/MEMORY_CONTEXT.md`'s
"There is no third way" paragraph and "No Assumed-Origin Path for Memory"/`DECISION_OPTION` material,
`docs/examples/REQUIREMENT_CASES.md`'s Dependency C Disposition case family (Cases 18–22) — all
re-read fresh, in full, before any edit, plus `gh pr view 24` to confirm PR state before editing.

## Validation

- `npm test`: 83/83 (unaffected — no schema/test file touched; independently re-run by Claude).
- `git diff --check`: clean.
- `git status --short`: exactly the four allowed content files modified — confirmed directly by
  Claude, not only from the implementing worker's self-report.
- One fresh independent read-only Codex reviewer (C-Retirement/D-Separation Closure, 9-point
  checklist) — see `REVIEW_STATE.md`'s "Latest Review" for findings and disposition; 9/9 PASS,
  independently spot-checked by Claude against primary text.
- Confirmed: retirement conclusion unchanged; R-10/R-22/R-23 byte-unchanged; accepted `IntentSpec`
  Claims remain valid Requirement-Level Inference premises everywhere; Dependency D's own material
  (`DECISION_OPTION` sections, Case 24) confirmed untouched and byte-identical; no schema/runtime/
  Brain work.

## Next Gate

Commit and push this closure to existing PR #24. Do not open a new PR. Do not merge. Human review of
PR #24 remains the next gate; it authorizes only this disposition-recording documentation change plus
this narrow wording closure — no new capability, no Dependency D work, no schema/runtime work.
