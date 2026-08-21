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

Task: ADR-0002-ACCEPTANCE
Branch: `docs/adr-0002-acceptance`

One independent read-only Codex reviewer verified the `ADR-0002` Status transition
(Proposed → Accepted). Overall verdict: **CLEAN AND READY**, all three checks PASS:

1. **Status transition justified by verifiable evidence.** Confirmed
   `docs/reviews/ADR-0002-ADVERSARIAL-REVIEW.md` and `.../ADR-0002-ADVERSARIAL-REMEDIATION.md`
   exist, reach real (non-ceremonial) conclusions, and their commits (`548bb75`, `63429c9`) are
   ancestors of `main`. Independently re-ran `npm test`: 32/32, matching the ADR's new
   "Acceptance basis" claim.
2. **No substantive semantic/model change slipped into this "acceptance housekeeping" patch.**
   `git diff main --stat` showed only `.project/DECISIONS_LOG.md` and
   `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md` changed; the ADR diff touched only Status, the
   new Acceptance-basis paragraph, and Future Work — Context/Decision/Rationale/Consequences/
   Alternatives Considered/Risks/Open Questions confirmed untouched. `INTENT_SPEC.md`,
   `INTENT_CASES.md`, `schemas/**`, and the validator confirmed unchanged vs. `main`.
3. **Future Work accurately separates completed gates from remaining work.** Schema design
   (M0 Step 02B, `0683e84`) and the "revisit Status" gate (this review) correctly marked complete;
   the genuinely open items (RequirementSpec-side contract design; an origin-classification
   validation approach) remain listed as open; Open Questions confirmed word-for-word unchanged.

One caveat the reviewer raised — local git history alone couldn't confirm the PR #10/#11 number
mapping (no merge commits explicitly naming them) — was independently resolved by Claude via
`gh pr view`: PR #10's merge commit is `548bb75` (matches), PR #11's merge commit is `63429c9`
(matches), both confirmed `MERGED` via the GitHub API, not just local git.

## Required Changes

None.

## Fixes Applied

N/A — no defects found; no fix required.

## Pending Human Gate

PR expected per task instruction (not yet opened at the time of this review); not to be merged by
this task. Human review of the PR, and a separate later instruction to merge, are the next gates.

## History

- 2026-08-19/2026-08-20 — `NIGHT-RUNNER-FRESH-CLAUDE-EXECUTOR` (PR #8): three independent read-only
  Codex review passes plus one live supervised smoke test against the real `claude` CLI. Pass 1
  (on V1) verdict **REDESIGN** — a caller-supplied `cwd` did not actually sandbox the child
  process (parent-directory/symlink bypass, pre-spawn-only STOP check, inconsistent CLI flags);
  accepted and redesigned (executor-owned `mkdtemp` workspace, bidirectional `realpath`
  containment, discovered-flag capability restriction, STOP polling with whole-process-tree
  termination, expanded tests). A Windows CLI-resolution `ENOENT` bug (found by Claude directly,
  not a review pass) was fixed via `where`/`which` resolution, deliberately avoiding `shell:true`
  (Node `DEP0190` injection risk). Pass 2 verdict **APPROVE WITH REQUIRED CHANGES** — bypassable
  capability denylist and an unbounded resolver lookup, both fixed (denylist → positive allowlist;
  timeout added). Pass 3 verdict **APPROVED**, no required changes remaining. Live smoke test
  against the real CLI confirmed the allowed write succeeded and the forbidden write was denied
  and absent. Human approved PR #8 for merge ("PR #8 / NIGHT-RUNNER-FRESH-CLAUDE-EXECUTOR is
  APPROVED for merge"), recorded via a Gate Recording Commit; merge execution itself had not been
  performed as of this entry and required a separate, later explicit instruction. Moved here from
  "Latest Review" now that those sections describe `ADR-0002-ACCEPTANCE` instead, per this file's
  branch/task scoping. — branch `feat/night-runner-fresh-claude-executor`

- 2026-08-19/2026-08-20 — `NIGHT-RUNNER-FOUNDATION-FINAL` (correction pass on
  `chore/night-runner-foundation`, before PR #7 received human review): one independent read-only
  Codex reviewer, focused specifically on runtime-budget semantics and state consistency:
  hand-traced the corrected per-attempt runtime charging
  (`min(estimated_runtime_seconds, per_task_timeout_seconds)`, checked before every attempt
  including retries) against both new runtime-budget fixtures line-by-line, confirmed the
  `max_tasks` integer-validation fixture and code, confirmed `NIGHT_RUNNER.md` has no remaining
  stale "charge the full estimate once" description, and audited `.project/CURRENT_TASK.md` /
  `.project/REVIEW_STATE.md` for any remaining live/prospective PR-state language. Verdict
  **APPROVE WITH REQUIRED CHANGES** — no algorithmic, determinism, or documentation defect found;
  all required changes were state-metadata language quoted verbatim from `CURRENT_TASK.md`'s
  "Next Gate" and `REVIEW_STATE.md`'s then-current "Merge Decision" / "Pending Human Gate"
  sections (PR number, "opened", a `gh pr view 7` suggestion), plus one additional pre-existing
  History entry (the PR #4 entry's "remains a separate, later action not yet taken" clause) that
  the reviewer identified as the same category of live-state claim. Claude's final outcome:
  **APPROVED** (after rewriting all flagged sections to state only that a PR is
  expected/authorized and that human review/merge approval is a pending gate, with no PR number,
  status, or GitHub-query pointer recorded). All four required changes applied to
  `.project/CURRENT_TASK.md` and `.project/REVIEW_STATE.md`; `.project/DECISIONS_LOG.md` was not
  modified, per explicit instruction for this patch. Re-validated: `npm run test:night-runner`
  15/15, `npm test` 24/24, `npm run context` (reported this task active/current for that branch).
  Separately: `NIGHT-RUNNER-FOUNDATION` (PR #7) was human-approved for merge ("PR #7 /
  NIGHT-RUNNER-FOUNDATION is APPROVED for merge"), recorded via a Gate Recording Commit; merge
  execution itself had not been performed as of this entry and required a separate, later explicit
  instruction. Moved here from "Latest Review"/"Merge Decision"/"Pending Human Gate" now that those
  sections describe `NIGHT-RUNNER-FRESH-CLAUDE-EXECUTOR` instead, per this file's branch/task
  scoping. — branch `chore/night-runner-foundation`

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
