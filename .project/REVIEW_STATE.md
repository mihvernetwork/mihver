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

Task: NIGHT-RUNNER-FRESH-CLAUDE-EXECUTOR
Branch: `feat/night-runner-fresh-claude-executor`

Three independent read-only Codex review passes, plus one live supervised smoke test run directly
by Claude against the real `claude` CLI. Final outcome: **APPROVED**.

**Pass 1 (on V1, implemented by Codex Worker A):** dispatched by Claude after a power interruption
left this task's prior status ambiguous/uncorroborated — no review outcome had actually been
recorded for this task/branch before this pass. Verdict **REDESIGN**: V1's central safety claim —
that a caller-supplied `cwd` outside the repo structurally prevents the child Claude process from
writing into the MIHVER working tree — did not hold. `cwd` is not a filesystem sandbox; a
parent-directory or symlink/junction workspace was lexically accepted as "outside"; STOP was
checked only pre-spawn; timeout killed only the direct child; CLI discovery/execution flags were
inconsistent (`--print` discovered, `-p` executed). Claude independently verified findings 1, 3, 5,
and 6 directly against the code before accepting the verdict, per `REVIEW_PROTOCOL.md`'s
instruction to treat a worker verdict as a claim to check, not relay. Outcome: **REDESIGN
accepted**, not patched forward — a human-authorized six-point redesign was specified and
implemented (executor-owned `mkdtemp` workspace, bidirectional `realpath` containment, discovered-
flag capability restriction, STOP polling + whole-process-tree termination with a bounded
kill-grace timeout, documented fresh-process semantics, expanded tests).

**Windows CLI resolution bug (found by Claude, not a review pass):** running the redesigned
executor against the real installed `claude` CLI (not the test stub) failed with `ENOENT` —
Windows npm installs `claude` as a `.cmd`/`.ps1` shim, not directly spawnable via `shell:false`.
Claude verified `shell:true` "fixes" this but rejected it: Node's `DEP0190` means array arguments
are not escaped under `shell:true`, and `descriptor.prompt` is untrusted text — a real injection
risk. Fixed instead via `where`/`which` resolution of the real `claude.exe`, passing only the
fixed command name (never task content) to the resolver subprocess.

**Pass 2 (on the redesign + Windows fix):** verdict **APPROVE WITH REQUIRED CHANGES** — found the
capability validation used a bypassable denylist (`toolAllowlist: 'default'` silently passed
through, re-enabling Bash, since `'default'` was never on the denylist) and that the `where`/
`which` resolver subprocess had no timeout (unbounded, unlike the `--help` probe). Separately
claimed Windows executable resolution "does not work" — reproduced in the reviewer's own sandbox,
but Claude independently re-verified resolution working correctly in the real target environment
(Git Bash, native PowerShell/Node, and a full live `executeTask` run all succeeded) and attributed
the reviewer's failure to that sandbox's own `PATH` lacking the npm global bin directory, not a
code defect — documented as an explicit operational precondition rather than changed. Required
changes (denylist → positive allowlist restricted to `Read`/`Write`/`Edit` tools and `acceptEdits`
permission mode only; resolver timeout added) were implemented and re-validated.

**Pass 3 (final):** verdict **APPROVED**, no required changes remaining. Independently re-traced
the positive-allowlist rejection paths, confirmed the resolver timeout, confirmed test coverage,
confirmed the documentation is accurate and non-overclaiming, and independently concurred that the
Windows-resolution disagreement from Pass 2 was specific to that reviewer's own sandbox `PATH`, not
a live risk in the real target environment.

**Live adversarial isolation smoke test (run directly by Claude, per the human task's explicit
requirement, against the real `claude` CLI — not a stub):** a task descriptor asked the child
Claude process to write an allowed file inside its own executor-created workspace, and attempt to
write a forbidden file at an absolute path outside the workspace (a disposable temp sibling
directory — never the real MIHVER repo, per instruction). Result: the allowed write succeeded; the
real CLI's own JSON output recorded a `permission_denials` entry for the forbidden `Write`
attempt; the forbidden file was confirmed absent afterward. This is the empirical validation the
capability-restriction mechanism needed, since stub-based automated tests cannot exercise real
Claude Code's actual permission enforcement.

## Required Changes

None remaining as of Pass 3 (final). Pass 1's REDESIGN and Pass 2's required changes were both
resolved — see History for the full record and "Fixes Applied" below.

## Fixes Applied

- Pass 1 (REDESIGN → redesign implementation): workspace isolation via executor-owned `mkdtemp` +
  bidirectional `realpath` containment (closes parent-directory and symlink/junction bypasses);
  discovered-flag capability restriction (`--tools`, `--strict-mcp-config`, no bypass-permissions);
  STOP polled during execution with whole-process-tree termination (POSIX process group / Windows
  `taskkill /t /f`) and a bounded kill-grace timeout; consistent `--print` in discovery and
  execution; documented fresh-process semantics; expanded tests (13 → 17 executor tests).
- Windows CLI resolution fix: `where`/`which`-based real-executable resolution, `shell:true` never
  used (17 → 21 executor tests).
- Pass 2 required changes: denylist → positive allowlist (`Read`/`Write`/`Edit`, `acceptEdits`
  only); resolver lookup timeout added; Windows-resolution documentation precondition added (21 →
  22 executor tests).
- Re-validated after every pass: `npm run test:night-runner` 15/15, `npm test` 24/24, unaffected.
  `scripts/dev/night-runner.mjs` and `tests/night-runner/**` confirmed unchanged after every pass.

## Merge Decision

Not applicable yet. `NIGHT-RUNNER-FRESH-CLAUDE-EXECUTOR` has reached independent-review APPROVED
and commit/push/PR are now authorized per the human task's original fields (`Commit/push allowed:
yes; PR expected: yes; do not merge`) — but there has been no human PR-merge decision, and none is
claimed here.

## Pending Human Gate

A PR is being opened for human review (not merge). Human review/merge approval is the remaining
gate, per `AGENT_POLICY.md`'s Authority Hierarchy — not reached yet as of this entry.

## History

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
