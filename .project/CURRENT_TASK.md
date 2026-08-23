# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

DEPENDENCY-D-FOUNDATION-AND-CORPUS-CLOSURE

## Objective

A narrow closure pass, continuing PR #27, on top of `ADR-0004` Dependency D's already-**approved**
implementation (task `M0-DEPENDENCY-D-R19-MEMORY-DECISION-OPTION`, same branch). Does not redesign
Gate 1 → Gate 2 ordering, R-19, R-24, the historical A/B `DECISION_OPTION` prohibition, the
zero-independent-authority rule, C's retirement, or the Evidence boundary. Fixes only
authoritative-document synchronization (`ADR-0004` still contained several current-state
"Dependency D — pending/disabled/future work" statements contradicting D as implemented;
`REQUIREMENT_SPEC.md`'s Stage Boundary restatement was stale against `M0_SCOPE.md`) and three
worked-case residuals (Case 26's internal contradiction; Case 25/35's R-21 consistency; Case
23/`MEMORY_CONTEXT_CASES.md` Case 24's rationale-example hygiene).

## Branch / Base

Branch: `m0/dependency-d-r19-memory-decision-option` (existing, continued — not a new branch).
PR: `mihvernetwork/mihver#27` (existing, open, continued — not a new PR, not merged).

## Status

**Complete, pending human review.**

**Fixes applied:**

1. **`ADR-0004` foundation blocker.** Performed narrow post-Acceptance synchronization: preserved all
   historical-at-the-time reasoning; only qualified historical passages and added/updated current-state
   forward pointers. Fixed: the "Post-Acceptance Dependency B/C Disposition" section (renamed to
   "...B/C/D Disposition," including a Reviewer-A-caught line-wrapped cross-reference the initial `sed`
   bulk replace missed); the Dependency C bullet's closing sentence re-scoped to "at the time of C's
   retirement"; the Dependency D bullet fully replaced with an "implemented" bullet; the Phase 1
   Authority Map's stale stage-list claim; the Foundation Impact Analysis's two Dependency-D-relevant
   items (given now-completed forward pointers); the Phase 8 boundary table's stale Research Planning
   row; the Acceptance Gate/Decision/Future Work sections' current-state D wording. ADR Status left
   untouched (`Accepted`).
2. **`REQUIREMENT_SPEC.md` Stage-Boundary sync.** Rewrote the "Stage Boundary (frozen, restated for
   context)" section's Requirement Derivation restatement: `IntentSpec` sole primary input;
   `MemoryContext` additional optional input restricted to `DECISION_OPTION`, bound to the consumed
   `IntentSpec` version (never `RequirementSpec`); no role in Gate 1; source must clear Gate 2. R-09/
   R-19/R-21/R-22/R-23/R-24 confirmed byte-unchanged (only two hunks this round, both inside Stage
   Boundary).
3. **Case 26 internal contradiction** (`REQUIREMENT_CASES.md`): replaced the scenario with one that
   explicitly overrides the shared base — settled Requirement "the system MUST handle a failed
   background job"; surviving Unknown "should handling include automatic retry, or require human
   intervention?" — a capability-level question R-19 excludes regardless of memory. Outcome unchanged
   (Gate 1 failure, Partial); Case 27's cross-reference confirmed still valid.
4. **Case 25/Case 35 R-21 consistency** (`REQUIREMENT_CASES.md`): rewrote Case 25's Eligibility
   paragraph — filling the Unknown applies ordinary R-21 (Complete); leaving it unfilled also leaves the
   retry-obligation Requirement Complete, since its own procedure never depended on the missing detail —
   explicitly scoped as not a general "any unfilled Unknown is Complete" rule. Case 35 independently
   re-read, already consistent, left unchanged. R-21 itself unchanged.
5. **Rationale example hygiene** (Case 23 in `REQUIREMENT_CASES.md`; Case 24 in
   `MEMORY_CONTEXT_CASES.md`): replaced "common, reasonable strategy" language with a rationale grounded
   in the choice's own bounded operational properties alone — never claiming industry-standard/optimal/
   best-practice status.

**Review: two fresh independent read-only Codex reviewers, targeted to this closure's own diff.**
Reviewer A (Foundation/Current-State Consistency, 8-point checklist): 6/8 PASS first pass, 2 findings —
1 genuine (the line-wrapped cross-reference above, fixed), 1 a prompt-scope false positive
(`git diff main` necessarily includes the whole branch's prior, already-approved R-09/R-24 additions;
independently re-verified via `git diff` — working tree only — that this round's own edits touch none
of that invariant text). Reviewer B (R-21/Corpus/Evidence, 8-point checklist): 7/8 PASS, 1 finding, same
category of prompt-scope false positive (independently re-verified this round's own diff touches only
Cases 23/25/26 and `MEMORY_CONTEXT_CASES.md` Case 24). Final recommendation: `READY_FOR_HUMAN_REVIEW`.

(This task's implementation is the five fixes listed above. For the prior, still-approved
Dependency D implementation itself — `M0_SCOPE.md`, `MEMORY_CONTEXT.md`,
`MEMORY_CONTEXT_SCHEMA_MAPPING.md` changes, the 13-case family, and the original four-reviewer
round — see `.project/REVIEW_STATE.md`'s History entry for
`M0-DEPENDENCY-D-R19-MEMORY-DECISION-OPTION`.)

## Allowed Scope

`docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, `docs/contracts/REQUIREMENT_SPEC.md`,
`docs/examples/REQUIREMENT_CASES.md`, `docs/examples/MEMORY_CONTEXT_CASES.md`,
`.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`.

Forbidden and confirmed untouched: `docs/foundation/M0_SCOPE.md`, `docs/contracts/INTENT_SPEC.md`,
`docs/examples/INTENT_CASES.md`, `docs/contracts/USER_IDEA.md`, `schemas/**`, `tests/**`, `scripts/**`,
`package*.json`, `mihver-brain/**`, `.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`,
`.project/CONTEXT_INDEX.md`, `ROADMAP.md`. No forbidden owning artifact required a change; no STOP
condition arose.

## Required Context

`docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, `docs/contracts/REQUIREMENT_SPEC.md`,
`docs/examples/REQUIREMENT_CASES.md`, `docs/examples/MEMORY_CONTEXT_CASES.md`,
`docs/foundation/M0_SCOPE.md` (read-only, for cross-check) — all re-read fresh before any edit.

## Validation

- `npm test`: 85/85, unchanged — no schema/test/fixture file touched.
- `git diff --check`: clean (one CRLF-on-touch warning only, not an error).
- `git status --short`: exactly the four allowed content files modified, plus this file and
  `REVIEW_STATE.md`.
- Confirmed: Dependency D remains the only newly-implemented capability this branch adds; ADR-0004
  Status remains `Accepted`; no Step03B/schema/runtime/durable-state/`ROADMAP.md` change.

## Next Gate

Commit and push to the existing branch `m0/dependency-d-r19-memory-decision-option`, existing PR #27.
Do not open a new PR. Do not merge. Human review of PR #27 (now including this closure round) is the
next gate.
