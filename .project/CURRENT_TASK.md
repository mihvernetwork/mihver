# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

NIGHT-RUNNER-FOUNDATION

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

- `npm run test:night-runner`: 12/12 fixtures passed (10 initial + 2 added in response to the
  reviewer's named test-coverage gaps: self-referencing dependency, `max_retries: 0` boundary).
- `npm test` (existing contract suite): 24/24 passed, unaffected.
- CLI smoke-tested manually (stdout report, correct exit codes for OK/REFUSED); a real Windows
  portability bug (naive `` file://${process.argv[1]} `` string comparison in the "run as
  script" guard, which never matches a Windows path) was found and fixed during this manual
  check, switching to `pathToFileURL(process.argv[1]).href`.
- One independent read-only Codex reviewer: verdict **APPROVE WITH REQUIRED CHANGES** (two
  documentation-consistency issues in `NIGHT_RUNNER.md`: a stale `--out` flag mention, and an
  inaccurate claim that a `STOPPED` dependency reaches the per-dependency `BLOCKED` check — it
  never does, since the queue-level STOPPED cascade always intercepts it first). Both fixes
  applied; reviewer found no material algorithmic, determinism, or execution-capability defect,
  and confirmed the Windows guard fix. Final outcome: **APPROVED**.
- `git status --short` confirms only files inside Allowed Scope changed:
  `.project/CURRENT_TASK.md`, `package.json` (modified, additive only);
  `docs/development/NIGHT_RUNNER.md`, `scripts/dev/night-runner.mjs`, `tests/night-runner/**`
  (new). No frozen document (`AGENT_POLICY.md`, `REVIEW_PROTOCOL.md`, `TASK_TEMPLATE.md`,
  `CLAUDE.md`, `docs/foundation/**`, `docs/adr/**`, `docs/contracts/**`, `schemas/**`,
  `tests/contracts/**`) was touched.

## Next Gate

Commit/push/PR are authorized by this task ("Commit/push allowed: yes. PR expected: yes. Do not
merge. Then stop."). Committed (`4540b32`), pushed to `chore/night-runner-foundation`, and PR #7
opened (`chore/night-runner-foundation` → `main`). Human review and merge approval are a
separate, later gate — not authorized by this task. Live PR status/mergeability are remote-only
GitHub facts not tracked here; query GitHub (e.g. `gh pr view 7`) when needed.
