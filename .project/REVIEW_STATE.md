# Review State

Durable review/approval state, updated at the end of each task per `REVIEW_PROTOCOL.md`'s
completion checklist. Never invent or assume approval: if a human has not explicitly stated it,
record the gate as pending, not granted. A Codex or Claude `APPROVED` verdict is a technical
assessment, not human sign-off — see `AGENT_POLICY.md`'s Authority Hierarchy.

**Branch/task-scoped, like [CURRENT_TASK.md](./CURRENT_TASK.md).** The "Latest Review" section
below describes the current gate only when *both* hold: `CURRENT_TASK.md` is active for the
checked-out branch, and this file's own declared Branch/Task (below) matches that same
branch/task. `npm run context` checks this automatically. When either condition fails — no active
task, or this file's Branch/Task doesn't match the active one — the "Latest Review" content is
historical/stale task metadata only, not the current gate; `PROJECT_STATE.md`'s "Next Authorized
Action" is authoritative for what's next, not anything below.

## Latest Review

Task: NIGHT-RUNNER-FOUNDATION-FINAL
Branch: `chore/night-runner-foundation`

A correction pass on this branch, before PR #7 receives human review.
Reviewer: one independent read-only Codex reviewer, focused specifically on runtime-budget
semantics and state consistency: hand-traced the corrected per-attempt runtime charging (
`min(estimated_runtime_seconds, per_task_timeout_seconds)`, checked before every attempt
including retries) against both new runtime-budget fixtures line-by-line, confirmed the
`max_tasks` integer-validation fixture and code, confirmed `NIGHT_RUNNER.md` has no remaining
stale "charge the full estimate once" description, and audited `.project/CURRENT_TASK.md` /
`.project/REVIEW_STATE.md` for any remaining live/prospective PR-state language.
Reviewer's verdict: **APPROVE WITH REQUIRED CHANGES** — no algorithmic, determinism, or
documentation defect found; all required changes were state-metadata language quoted verbatim
from `CURRENT_TASK.md`'s "Next Gate" and `REVIEW_STATE.md`'s then-current "Merge Decision" /
"Pending Human Gate" sections (PR number, "opened", a `gh pr view 7` suggestion), plus one
additional pre-existing History entry (the PR #4 entry's "remains a separate, later action not
yet taken" clause) that the reviewer identified as the same category of live-state claim.
Claude's final outcome: **APPROVED** (after rewriting all flagged sections to state only that a
PR is expected/authorized and that human review/merge approval is a pending gate, with no PR
number, status, or GitHub-query pointer recorded).

## Required Changes

1. `CURRENT_TASK.md`'s "Next Gate" section asserted PR #7 was opened and suggested `gh pr view 7`
   to check live status. Fixed: now states only that a PR is expected/authorized for this task
   and that human review/the merge gate are pending — no PR number or status claim.
2. `REVIEW_STATE.md`'s "Merge Decision" and "Pending Human Gate" sections made the same PR #7
   live-existence/status claims. Fixed the same way.
3. `REVIEW_STATE.md`'s History entry for `PROJECT-CONTEXT-AUTO-BOOTSTRAP` (PR #6) was stale and
   asserted current, unresolved status ("The merge itself was not performed as of this entry").
   Per explicit human instruction, corrected to record the now-confirmed fact: PR #6 was
   squash-merged to `main` at `3f0b53b`.
4. `REVIEW_STATE.md`'s History entry for `PROJECT-CONTEXT-FREEZE-STATE` (PR #4) similarly
   asserted unresolved current status ("remains a separate, later action not yet taken") rather
   than a settled historical fact. Fixed to record only what was authorized at the time, without
   asserting present-day status.

## Fixes Applied

All four required changes above applied to `.project/CURRENT_TASK.md` and
`.project/REVIEW_STATE.md`. `.project/DECISIONS_LOG.md` was not modified, per explicit
instruction for this patch. Re-validated: `npm run test:night-runner` 15/15, `npm test` 24/24,
`npm run context` (reports this task active/current for this branch).

## Merge Decision

`NIGHT-RUNNER-FOUNDATION` (PR #7) **APPROVED for merge** — human decision stated directly as "PR
#7 / NIGHT-RUNNER-FOUNDATION is APPROVED for merge"; recorded via a Gate Recording Commit per
`AGENT_POLICY.md`. The merge itself has not been performed — execution requires a separate, later
explicit instruction.

## Pending Human Gate

Human review is complete and merge is approved (see "Merge Decision" above). Execution of the
actual merge is the remaining pending step, per `AGENT_POLICY.md`'s Authority Hierarchy and Gate
Recording Commit policy. Live PR existence/status is a remote-only GitHub fact and is not recorded
in this file.

## History

- 2026-08-19 — `NIGHT-RUNNER-FOUNDATION` (first pass, PR #7): one independent read-only Codex
  reviewer, focused on requirement coverage against `docs/development/NIGHT_RUNNER.md`,
  determinism, the structural no-execution-capability invariant, algorithm correctness (budget
  consumption, limit-cascade, human-gated blocking, `main`-branch refusal, retry/timeout math),
  fixture coverage, and the Windows "run as script" guard fix. Verdict **APPROVE WITH REQUIRED
  CHANGES** — two documentation-consistency issues in `NIGHT_RUNNER.md` (a stale `--out` flag
  mention with no implementation; an inaccurate claim that a `STOPPED` dependency reaches the
  per-dependency `BLOCKED` check, when the queue-level STOPPED cascade always intercepts it
  first). No material algorithmic, determinism, or execution-capability defect found. Both fixes
  applied; two fixtures added (self-referencing dependency, `max_retries: 0` boundary) closing
  the two cheapest of several named test-coverage gaps. Final outcome **APPROVED**. Separately, a
  real Windows portability bug was found and fixed during Claude's own manual CLI smoke test (the
  "run as script" guard's naive `` file://${process.argv[1]} `` string comparison never matches a
  Windows path); the reviewer confirmed the fix (`pathToFileURL(process.argv[1]).href`). Moved
  here from "Latest Review" now that it describes the correction pass
  (`NIGHT-RUNNER-FOUNDATION-FINAL`) instead, per this file's branch/task scoping. — branch
  `chore/night-runner-foundation`

- 2026-08-19 — `PROJECT-CONTEXT-AUTO-BOOTSTRAP` (PR #6): reviewed by one independent read-only
  Codex reviewer, verdict **APPROVED** (no required changes). Human stated "PR #6 /
  PROJECT-CONTEXT-AUTO-BOOTSTRAP is APPROVED for merge", recorded via a Gate Recording Commit.
  PR #6 was squash-merged to `main` at `3f0b53b`, per explicit human confirmation. Moved here
  from "Latest Review"/"Merge Decision"/"Pending Human Gate" now that those sections describe the
  current task instead, per this file's branch/task scoping. — branch
  `chore/project-context-auto-bootstrap`

- 2026-08-19 — `PROJECT-CONTEXT-REVIEW-SCOPE` (PR #5): human approved for merge, stated directly
  as "PR #5 / PROJECT-CONTEXT-REVIEW-SCOPE is APPROVED for merge", recorded via a Gate Recording
  Commit. PR #5 was subsequently squash-merged to `main` at `fdc27d4` ("chore: scope review state
  to active task") — see `DECISIONS_LOG.md` for the durable record. — branch
  `chore/project-context-review-scope`

- 2026-08-19 — `PROJECT-CONTEXT-FREEZE-STATE` (PR #4): human approved for merge, stated directly
  as "PR #4 / PROJECT-CONTEXT-FREEZE-STATE is APPROVED for merge", recorded via a Gate Recording
  Commit; that commit recorded the approval only and did not itself authorize merge execution —
  see `DECISIONS_LOG.md` for the durable record. — branch `chore/project-context-freeze-state`

- 2026-08-19 — M0 Step 02B (Intent schema) — human decision: **APPROVED**, stated directly in
  conversation (not Claude-inferred). This entry is Claude's contemporaneous record of that
  conversation; it is not independently verifiable from git/GitHub state — the merge commit
  `0683e84` confirms the code landed, not that a human approved it. — merged to `main` at
  `0683e84`.
- 2026-08-19 — Project Context Bootstrap — human review of the branch/mechanism as a whole:
  **APPROVED WITH FINAL OPERATIONAL PATCH REQUIRED**, stated directly by the human, explicitly not
  final merge approval; authorized the `PROJECT-CONTEXT-MERGE-GATE` patch that was applied to
  satisfy it.
- 2026-08-19 — Project Context Bootstrap — human decision: **APPROVED for merge**, stated directly
  ("PROJECT-CONTEXT-BOOTSTRAP is APPROVED for merge"), recorded via a Gate Recording Commit, then
  executed on the human's explicit request for a PR + squash merge (base `main`, compare
  `chore/project-context-bootstrap`). — merged to `main` via PR #3, squash commit `c5d3dc8`.
