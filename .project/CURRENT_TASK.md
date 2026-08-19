# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

PROJECT-CONTEXT-REMOTE-STATE-PATCH

## Objective

Fix a stale-state issue: repository state files must not record live or prospective GitHub PR
state (existence, "is opened"/"will be opened" wording, status, mergeability). Remove that wording
from `CURRENT_TASK.md` and `REVIEW_STATE.md`, recording only durable task facts, with an explicit
note that PR state is remote-only and must be queried from GitHub when needed.

## Branch / Base

Branch: `chore/project-context-freeze-state`
Base: `main` (`c5d3dc8`)

## Status

Complete — committed and pushed to `chore/project-context-freeze-state`. PR expected: yes. Human
review and the merge decision are pending. Actual PR existence, status, and mergeability are
remote-only GitHub facts and are not tracked in this file — query GitHub (e.g. `gh pr view`,
`gh pr list`) when that information is needed.

## Allowed Scope

Update:
- `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`

Forbidden: `.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`, `docs/foundation/**`,
`docs/adr/**`, `docs/contracts/**`, `docs/examples/**`, `schemas/**`, `tests/**`, any policy file
(`docs/development/**`), and any code file (including `scripts/dev/project-context.mjs`). This
task is a wording-only fix to two operational state files.

## Required Context

- `CLAUDE.md`
- `.project/CURRENT_TASK.md`
- `.project/REVIEW_STATE.md`
- `docs/development/AGENT_POLICY.md` (Operational State Scope, Git & Branch Workflow)
- `docs/development/REVIEW_PROTOCOL.md` (Completion Checklist, Outcomes)

## Validation

- `npm run context` runs without error.
- `npm test` still passes (contract validator untouched).
- `git diff --stat` confirms only `.project/CURRENT_TASK.md` and `.project/REVIEW_STATE.md`
  changed.

## Next Gate

Human review and merge decision for `chore/project-context-freeze-state` into `main`. This task
pushes to the branch only — it does not open or merge a PR. Whether a PR exists for this branch,
and its status/mergeability, are remote-only GitHub facts not tracked in this file; query GitHub
(e.g. `gh pr list --head chore/project-context-freeze-state`) when that information is needed.
