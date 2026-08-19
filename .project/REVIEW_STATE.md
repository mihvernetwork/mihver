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

Task: NIGHT-RUNNER-FOUNDATION
Branch: `chore/night-runner-foundation`
Reviewer: one independent read-only Codex reviewer, focused on requirement coverage against
`docs/development/NIGHT_RUNNER.md`, determinism, the structural no-execution-capability
invariant (no `child_process`/`http`/`https`/`fetch`/`spawn`/`exec`/git-operation imports),
algorithm correctness (budget consumption, limit-cascade, human-gated blocking, `main`-branch
refusal, retry/timeout math), fixture coverage, and the Windows "run as script" guard fix.
Reviewer's verdict: **APPROVE WITH REQUIRED CHANGES** — two documentation-consistency issues in
`NIGHT_RUNNER.md` (a stale `--out` flag mention with no implementation; an inaccurate claim that
a `STOPPED` dependency reaches the per-dependency `BLOCKED` check, when the queue-level STOPPED
cascade always intercepts it first). No material algorithmic, determinism, or
execution-capability defect found. Named several test-coverage gaps explicitly as non-required
("test-suite gaps, not demonstrated implementation failures").
Claude's final outcome: **APPROVED** (after applying both required doc fixes and adding two
fixtures — self-referencing dependency, `max_retries: 0` boundary — closing the two cheapest
named gaps).

## Required Changes

1. `NIGHT_RUNNER.md`'s "What this version does not do" list claimed writes were limited to "an
   optional `--out` report path" that the implementation never had. Fixed: now states the CLI
   only ever prints its report to stdout.
2. `NIGHT_RUNNER.md`'s dependency-propagation bullet claimed a `STOPPED` dependency causes its
   dependents to become `BLOCKED` via the per-dependency check. In the actual algorithm this
   never happens — once a queue-level limit trips or the kill switch engages, every remaining
   task (dependents included) is `STOPPED` directly by the cascade, before the per-dependency
   check would run. Fixed: the bullet now names only `BLOCKED`/`FAILED` dependencies for that
   check and explains the STOPPED-cascade precedence explicitly.

## Fixes Applied

Both required documentation changes above applied to `docs/development/NIGHT_RUNNER.md`. Also
added `tests/night-runner/fixtures/refused-self-dependency.json` and
`tests/night-runner/fixtures/timeout-zero-retries-immediate-fail.json` (not required by the
reviewer, but the two cheapest of the named test-coverage gaps). Re-validated after fixes:
`npm run test:night-runner` 12/12, `npm test` 24/24.

Separately, during Claude's own manual CLI smoke test (before the independent review), a real
Windows portability bug was found and fixed: the "run as script" guard's naive
`` file://${process.argv[1]} `` string comparison never matches a Windows path (backslashes, no
drive-letter leading slash), so the CLI silently did nothing on this platform. Fixed by switching
to `pathToFileURL(process.argv[1]).href`. The independent reviewer separately confirmed this fix
is in place and the bug is not present in any other form.

## Merge Decision

Not reached. This task's Git authorization is Commit: yes, Push: yes, PR: yes, **merge: no** —
"Do not merge. Then stop." PR #7 (`chore/night-runner-foundation` → `main`) was opened per that
authorization; merge itself is not authorized and has not been requested.

## Pending Human Gate

PR #7's review and merge approval are the pending human gate, per `AGENT_POLICY.md`'s Authority
Hierarchy. Live PR status/mergeability are remote-only GitHub facts not tracked here.

## History

- 2026-08-19 — `PROJECT-CONTEXT-AUTO-BOOTSTRAP` (PR #6): reviewed by one independent read-only
  Codex reviewer, verdict **APPROVED** (no required changes). Human stated "PR #6 /
  PROJECT-CONTEXT-AUTO-BOOTSTRAP is APPROVED for merge", recorded via a Gate Recording Commit.
  **The merge itself was not performed** as of this entry — PR #6's live status/mergeability are
  remote-only GitHub facts not tracked here; query GitHub if needed. Moved here from "Latest
  Review"/"Merge Decision"/"Pending Human Gate" now that those sections describe the current task
  (`NIGHT-RUNNER-FOUNDATION`) instead, per this file's branch/task scoping. — branch
  `chore/project-context-auto-bootstrap`

- 2026-08-19 — `PROJECT-CONTEXT-REVIEW-SCOPE` (PR #5): human approved for merge, stated directly
  as "PR #5 / PROJECT-CONTEXT-REVIEW-SCOPE is APPROVED for merge", recorded via a Gate Recording
  Commit. PR #5 was subsequently squash-merged to `main` at `fdc27d4` ("chore: scope review state
  to active task") — see `DECISIONS_LOG.md` for the durable record. — branch
  `chore/project-context-review-scope`

- 2026-08-19 — `PROJECT-CONTEXT-FREEZE-STATE` (PR #4): human approved for merge, stated directly
  as "PR #4 / PROJECT-CONTEXT-FREEZE-STATE is APPROVED for merge", recorded via a Gate Recording
  Commit; merge execution itself was not authorized by that commit and remains a separate, later
  action not yet taken — see `DECISIONS_LOG.md` for the durable record. — branch
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
