# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

NIGHT-RUNNER-FOUNDATION-FINAL

A correction pass on `chore/night-runner-foundation`, continuing directly from
NIGHT-RUNNER-FOUNDATION before its PR receives human review — same branch, same underlying task,
not a new one.

## Objective

Build the deterministic dry-run foundation for MIHVER Night Runner: a control-plane simulator
that plans execution of explicitly pre-authorized, queued tasks against a defined state machine
(READY → RUNNING → VALIDATING → INDEPENDENT_REVIEW → READY_FOR_HUMAN, with RETRY / BLOCKED /
FAILED / STOPPED paths), dependency support, runtime/task/timeout/retry limits, and a
`.project/STOP` kill switch. This version is a simulator only — it must never launch Claude,
Codex, or shell task execution, and must never modify task branches or treat `main` as a
writable task branch.

## Branch / Base

Branch: `chore/night-runner-foundation`
Base: `main` (`3f0b53b`)

## Status

Complete — implemented and validated. `docs/development/NIGHT_RUNNER.md` (design, including a
"Proposed Policy Additions" section explicitly marked pending human review, not adopted policy)
and `.project/CURRENT_TASK.md` were authored/updated directly by Claude per `AGENT_POLICY.md`'s
documentation-authorship pattern. `scripts/dev/night-runner.mjs`, `tests/night-runner/**`, and
the two additive `package.json` npm scripts were also implemented directly by Claude: two
successive Codex write-capable implementation attempts both failed on sandbox/approval
mechanics before any file was written (first: blocked waiting on an interactive approval no one
could grant; second, after the human explicitly authorized `approval-policy: never`: the Codex
session's own sandbox still reported read-only, an apparent Codex MCP server-side configuration
issue outside this session's control) — recorded here rather than hidden, per
`AGENT_POLICY.md`'s Worker Failure Handling. The human explicitly chose "Claude implements it
directly" after being asked. One independent read-only Codex reviewer then reviewed the
Claude-authored implementation (see `.project/REVIEW_STATE.md`); its two required documentation
fixes were applied and two additional fixtures were added to close named test-coverage gaps;
final verdict **APPROVED**.

**Correction pass (this task, NIGHT-RUNNER-FOUNDATION-FINAL):** before human review of PR #7,
three issues were fixed: (1) runtime accounting — `max_runtime_seconds` now charges
`min(estimated_runtime_seconds, per_task_timeout_seconds)` per simulated attempt (including
retries), checked before every attempt rather than pre-charged once as the full estimate, so a
task can be `STOPPED` between attempts and correctly cascades to the remainder of the queue; (2)
`limits.max_tasks` is now validated as a positive integer, not just a positive number; (3)
`.project/CURRENT_TASK.md` and `.project/REVIEW_STATE.md` were corrected to stop recording
live/prospective GitHub PR state, per this repo's standing invariant against that (see "Next
Gate" below). `docs/development/NIGHT_RUNNER.md` was updated to match the corrected runtime
semantics. A second independent read-only Codex reviewer, focused specifically on runtime-budget
semantics and state consistency, verdict **APPROVE WITH REQUIRED CHANGES** (the state-metadata
language above, plus one additional historical entry it flagged); all required changes applied;
final outcome **APPROVED**.

## Allowed Scope

Add:
- `docs/development/NIGHT_RUNNER.md` (new; Claude-authored directly per `AGENT_POLICY.md`'s
  documentation/architecture authorship pattern)
- `scripts/dev/night-runner.mjs` (new; Codex bounded implementation)
- `tests/night-runner/**` (new; Codex bounded implementation)
- `package.json` (additive npm script(s) only)

Update:
- `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`

Forbidden: `docs/foundation/**`, `docs/adr/**`, `docs/contracts/**`, `docs/examples/**`,
`schemas/**`, `tests/contracts/**`, `docs/development/AGENT_POLICY.md`,
`docs/development/REVIEW_PROTOCOL.md`, `docs/development/TASK_TEMPLATE.md`, `CLAUDE.md`,
`.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`, `scripts/dev/project-context.mjs`.
`AGENT_POLICY.md` is not amended by this task — `NIGHT_RUNNER.md` documents *proposed* rules
only, explicitly marked pending human review, not adopted policy.

## Required Context

- `CLAUDE.md`
- `.project/CURRENT_TASK.md`
- `.project/PROJECT_STATE.md`
- `docs/development/AGENT_POLICY.md` (Git & Branch Workflow, Parallel Worker Rules'
  documentation/architecture authorship pattern)
- `docs/development/REVIEW_PROTOCOL.md` (Completion Checklist, Outcomes)
- `tests/contracts/validate-contracts.mjs`, `scripts/dev/project-context.mjs` (existing code
  style/conventions to match: plain ESM, node built-ins only, assert-based fixture tests)

## Validation

- `npm run test:night-runner`: 15/15 fixtures passed (12 from the first pass + 3 added this pass:
  two proving the corrected runtime-budget accounting — retries consuming global budget then
  cascading STOPPED, and a 100s/50s-timeout task correctly running/failing within a 60s budget
  instead of being prematurely stopped — and one proving fractional `max_tasks` is refused).
- `npm test` (existing contract suite): 24/24 passed, unaffected.
- `npm run context`: reports this task active and current for this branch.
- CLI smoke-tested manually in the first pass (stdout report, correct exit codes for OK/REFUSED);
  a real Windows portability bug (naive `` file://${process.argv[1]} `` string comparison in the
  "run as script" guard) was found and fixed then, switching to
  `pathToFileURL(process.argv[1]).href`.
- First independent read-only Codex reviewer (first pass): verdict **APPROVE WITH REQUIRED
  CHANGES** (two documentation-consistency issues), both fixed, final outcome **APPROVED**.
- Second independent read-only Codex reviewer (this pass, focused specifically on runtime-budget
  semantics and state consistency): hand-traced both new runtime-budget fixtures against the
  code and confirmed the corrected charging formula, per-attempt budget check, `STOPPED`-not-
  `FAILED` mid-task outcome, and cascade all behave as intended; confirmed `max_tasks` integer
  validation and its refusal fixture; confirmed `NIGHT_RUNNER.md` has no remaining stale
  "charge full estimate once" text. Verdict **APPROVE WITH REQUIRED CHANGES**, limited to the
  state-metadata language covered under "Next Gate" below; all required changes applied; final
  outcome **APPROVED**.
- `git status --short` confirms only files inside Allowed Scope changed. No frozen document
  (`AGENT_POLICY.md`, `REVIEW_PROTOCOL.md`, `TASK_TEMPLATE.md`, `CLAUDE.md`,
  `docs/foundation/**`, `docs/adr/**`, `docs/contracts/**`, `schemas/**`, `tests/contracts/**`,
  `.project/DECISIONS_LOG.md`) was touched.

## Next Gate

Commit/push are authorized by this task ("Commit/push allowed: yes."). PR expected: yes — this
task updates PR #7 only, does not open a new one, and does not merge. Human review and the merge
gate are pending; live PR status/mergeability are not tracked in this file.
