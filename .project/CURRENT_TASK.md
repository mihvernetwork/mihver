# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

ADR-0004-ACCEPTANCE

## Objective

Move `ADR-0004` (Memory Context Authority Boundary) from Proposed to Accepted — **only if** its own
previously-defined Acceptance Gate is demonstrably satisfied by current `main`. This is an
acceptance/status checkpoint, not a semantic redesign: Model C and the full `MEMORY_CONTEXT.md`
contract are unchanged.

## Branch / Base

Branch: `docs/adr-0004-acceptance`
Base: `main` at `823ff9f41f6e7b89814c2246df6ea9db41f7e97c` (verified via `git status`/`git log`/
`npm run context` before branching, matching this task's explicit instruction).

## Status

**Complete, pending human review. Acceptance Gate was satisfied — ADR-0004 Status changed.**

- Verified live reality before editing: `git status` (clean), `git log --oneline --decorate -15`
  (confirmed `main` `HEAD` `823ff9f` = PR #18's merge commit, itself built on PR #17's merge commit
  `9416e85`), `npm run context`, `gh pr view 17` (`state: MERGED`, `mergedAt:
  2026-08-22T16:09:50Z`, `mergeCommit.oid: 9416e857b549bea07d4ce06a5c365524fdf1d51a`), `gh pr view
  18` (`state: MERGED`, `mergeCommit.oid` matching `main` `HEAD` exactly).
- Reconstructed `ADR-0004`'s own "Acceptance Gate" section and independently re-verified all ten
  Acceptance Gate criteria this task named against current `docs/foundation/M0_SCOPE.md`, by direct
  read/grep of the actual file content (unchanged since the prior `M0-FOUNDATION-MEMORY-BOUNDARY-A`
  task in this session): `RunContext` as a non-memory scope anchor; the `MemoryContext` Producer as
  a declared cross-cutting boundary; Research Planning as the sole explicitly-declared consumer,
  restricted to `DISCOVERY_ATTENTION`; additive/provenance-visible behavior stated explicitly; "a
  stage never queries MIHVER Brain directly" stated explicitly; Brain-unavailable/empty-retrieval
  non-blocking behavior stated explicitly; a "MemoryContext Lifecycle and Failure" subsection
  exists; Dependency A's adversarial review (four independent read-only Codex reviewers) is recorded
  in `.project/REVIEW_STATE.md`'s history; and a "Consumption Remains Otherwise Disabled" section
  keeps dependencies B/C/D structurally disabled. All ten confirmed true — the Acceptance Gate is
  satisfied.
- Changed `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`'s `## Status` from `Proposed` to
  `Accepted`, with a compact acceptance note citing PR #17, the adversarial review, and explicitly
  stating dependencies B/C/D remain disabled and are not implied. No other content in that file was
  changed — Model C, the Phase sections, and every invariant are untouched.
- Updated `.project/PROJECT_STATE.md`: added an `ADR-0004` Acceptance checkpoint bullet (mirroring
  the existing `ADR-0002` Acceptance pattern); removed the now-stale `ADR-0004`-Proposed Open Item
  entirely (it is no longer an open Proposed-status question); rewrote "Next Authorized Action" to
  name dependencies B/C/D as the logical next roadmap family without pre-authorizing them, and to
  not authorize Step 03B. `ADR-0003` Open Item is unchanged (still Proposed).
- Appended one new entry to `.project/DECISIONS_LOG.md` recording the Status: Accepted decision and
  its basis; no existing entry edited, deleted, or reordered.
- Corrected `.project/CONTEXT_INDEX.md`'s `ADR-0004` row from `(Proposed)` to `(Accepted)` — the
  only authority-label change made there.
- Updated `ROADMAP.md`: replaced the volatile "Last verified public `main`: `<SHA>`" line with a
  durable "run `npm run context`" instruction, per this task's explicit staleness-hardening
  instruction; `## 10.1` relabeled ACCEPTED with a short acceptance note; `## 10.8` updated to state
  the gate is now satisfied; Phase 6 relabeled "ADR ACCEPTED"; Phase 8 relabeled DONE; Phase 9
  relabeled NEXT with an explicit not-yet-authorized statement; capability map (Section 21) and
  near-term order (Section 22) updated to Accepted/DONE without claiming B/C/D or a runtime are
  implemented.
- Dispatched exactly two fresh read-only Codex reviewers, per this task's explicit instruction:
  Reviewer A (Acceptance Gate Verification) and Reviewer B (Authority / State Consistency) — see
  `REVIEW_STATE.md`'s "Latest Review" for their verdicts and disposition. Claude independently
  re-verified every material finding; no broad semantic re-review of Model C was opened.

`npm test`: 32/32. `git diff --check`: clean. `git diff main --stat` / `git diff main --name-only`:
exactly the seven allowed files. `docs/foundation/M0_SCOPE.md`, `docs/contracts/MEMORY_CONTEXT.md`,
`docs/contracts/INTENT_SPEC.md`, `docs/contracts/REQUIREMENT_SPEC.md`, `schemas/**`, `tests/**`,
`scripts/**`, and `../mihver-brain/**` are unchanged. `ADR-0003`'s own `## Status` field is
unchanged (**Proposed**). Dependencies B, C, and D remain structurally disabled — no wording in any
changed file claims otherwise. No `MemoryContext` runtime, schema, or Brain adapter is claimed to
exist anywhere in the changed files.

## Allowed Scope

- `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`
- `.project/PROJECT_STATE.md`
- `.project/DECISIONS_LOG.md` (append only)
- `.project/CONTEXT_INDEX.md`
- `.project/CURRENT_TASK.md`
- `.project/REVIEW_STATE.md`
- `ROADMAP.md`

Forbidden and confirmed untouched: `docs/foundation/M0_SCOPE.md`, `docs/foundation/PRINCIPLES.md`,
`docs/foundation/VISION.md`, `docs/contracts/MEMORY_CONTEXT.md`, `docs/contracts/INTENT_SPEC.md`,
`docs/contracts/REQUIREMENT_SPEC.md`, `docs/contracts/USER_IDEA.md`, `docs/examples/**`,
`schemas/**`, `tests/**`, `scripts/**`, `../mihver-brain/**`.

## Required Context

- `CLAUDE.md`, `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md` (in full, especially
  "Acceptance Gate"), `docs/contracts/MEMORY_CONTEXT.md`, `docs/examples/MEMORY_CONTEXT_CASES.md`,
  `docs/foundation/M0_SCOPE.md` (post-Dependency-A amendment).
- `.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`, `.project/CONTEXT_INDEX.md`,
  `ROADMAP.md` (prior content, read directly before editing).
- Live `git`/`gh` state (see Status above) — not prior-conversation assumptions.

## Validation

- `npm test`: 32/32.
- `git diff --check`: clean.
- `git diff main --stat` / `git diff main --`: exactly the seven allowed files.
- Two fresh read-only Codex reviewers (A: Acceptance Gate Verification; B: Authority / State
  Consistency) — see `REVIEW_STATE.md`'s "Latest Review" for verdicts and disposition.

## Next Gate

Commit, push, and open one PR against `mihvernetwork/mihver:main`, title `docs: accept ADR-0004
memory context authority boundary`. Do not merge. Human review of that PR is the next gate; it
authorizes only this Status transition — not dependencies B/C/D, not Step 03B, and not any
`mihver-brain` or runtime memory-integration work.
