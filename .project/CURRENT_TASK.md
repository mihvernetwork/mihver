# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

PROJECT-CONTEXT-REVIEW-SCOPE

## Objective

Fix the fresh-session acceptance-test failure where stale `REVIEW_STATE.md` content from a
completed branch was interpreted as the current gate on `main`. Make `REVIEW_STATE.md`
branch/task-scoped like `CURRENT_TASK.md`, restrict when it may describe the "current" gate,
make `PROJECT_STATE.md`'s Next Authorized Action authoritative when there is no active task, and
teach `npm run context` to validate task/review branch consistency and say `Active task: none`
explicitly.

## Branch / Base

Branch: `chore/project-context-review-scope`
Base: `main` (`6a399c7`)

## Status

Complete — implemented, independently reviewed (one read-only Codex reviewer; first pass
APPROVE WITH REQUIRED CHANGES, fix applied, re-reviewed to APPROVED — see
`.project/REVIEW_STATE.md`), and validated (`npm test` 24/24, `npm run context` compact and
`--full`, plus manual worktree/clone scenario checks for the INFO/WARNING and task-ID-mismatch
paths). Committed and pushed to `chore/project-context-review-scope`. PR expected: yes. Human
review/merge decision is pending — that gate has not been reached yet. Actual PR existence,
status, and mergeability remain remote-only GitHub facts not tracked in this file — query GitHub
(e.g. `gh pr view`, `gh pr list`) when that information is needed.

## Allowed Scope

Update:
- `CLAUDE.md`
- `docs/development/AGENT_POLICY.md`
- `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`
- `scripts/dev/project-context.mjs`

Forbidden: `.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`, `docs/foundation/**`,
`docs/adr/**`, `docs/contracts/**`, `docs/examples/**`, `schemas/**`, `tests/**`,
`docs/development/REVIEW_PROTOCOL.md`, `docs/development/TASK_TEMPLATE.md`. No live/prospective
GitHub PR state may be recorded in repository metadata (carry forward the
`PROJECT-CONTEXT-REMOTE-STATE-PATCH` invariant).

## Required Context

- `CLAUDE.md`
- `.project/CURRENT_TASK.md`
- `.project/REVIEW_STATE.md`
- `.project/PROJECT_STATE.md`
- `docs/development/AGENT_POLICY.md` (Operational State Scope, Git & Branch Workflow)
- `docs/development/REVIEW_PROTOCOL.md` (Completion Checklist, Outcomes)
- `scripts/dev/project-context.mjs`

## Validation

- `npm run context` (compact) on `main` behavior validated conceptually/testably (via an isolated
  worktree, not by switching this task's checkout).
- `npm run context -- --full` runs without error.
- `npm test` still passes (contract validator untouched).
- One read-only Codex reviewer focused on stale review-state leakage.

## Next Gate

Human review and merge decision on this task's work. Do not merge without explicit human
authorization. Actual PR existence, status, and mergeability remain remote-only GitHub facts not
tracked in this file — query GitHub when needed.
