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

Task: PROJECT-CONTEXT-REVIEW-SCOPE
Branch: `chore/project-context-review-scope`
Reviewer: one independent read-only Codex reviewer, focused on stale review-state leakage.
Reviewer's first pass: **APPROVE WITH REQUIRED CHANGES** — `scripts/dev/project-context.mjs`
matched `REVIEW_STATE.md` against the active task by branch only, not Task ID, so a REVIEW_STATE
left over from an earlier task on the *same* branch could still be reported as current.
Fix applied (exact Task ID matching added, failing closed on any missing/unparseable field);
reviewer re-reviewed the diff and returned **APPROVED**.
Claude's final outcome: **APPROVED**.

## Required Changes

- Match `.project/REVIEW_STATE.md`'s declared Task, not just its declared Branch, against
  `.project/CURRENT_TASK.md`'s active Task ID before treating review state as current — fixed in
  `scripts/dev/project-context.mjs` (`extractTaskField`, `extractSectionValue`,
  `reviewStateMatchesActiveTask`).

## Fixes Applied

Task-ID matching added to `scripts/dev/project-context.mjs` as above. Re-verified: `npm test`
(24/24), `npm run context` (compact) on this branch, `npm run context -- --full`. Also manually
verified, via a throwaway git worktree/clone (not by switching this task's own checkout): (a) a
branch mismatch on a non-`main` branch still warns as before, (b) `main` with a stale
`CURRENT_TASK.md` now prints INFO instead of WARNING, and (c) a same-branch Task-ID mismatch
(temporarily simulated in `.project/REVIEW_STATE.md`, then reverted) now correctly warns instead
of being reported as current.

## Merge Decision

Not yet made — human review/merge decision for this task is pending. Actual PR existence and
status are remote-only GitHub facts not tracked in this file.

## Pending Human Gate

Human review/merge decision is pending for this task. Do not merge without explicit human
authorization. Actual PR existence, status, and mergeability remain remote-only GitHub facts not
tracked in this file — query GitHub when needed.

## History

- 2026-08-19 — `PROJECT-CONTEXT-FREEZE-STATE` (PR #4): human approved for merge, stated directly
  as "PR #4 / PROJECT-CONTEXT-FREEZE-STATE is APPROVED for merge", recorded via a Gate Recording
  Commit; merge execution itself was not authorized by that commit and remains a separate, later
  action not yet taken — see `DECISIONS_LOG.md` for the durable record. Moved here from "Merge
  Decision"/"Pending Human Gate" now that those sections describe the current task
  (`PROJECT-CONTEXT-REVIEW-SCOPE`) instead, per this file's new branch/task scoping. — branch
  `chore/project-context-freeze-state`

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
