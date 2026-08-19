# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

PROJECT-CONTEXT-FINAL-PATCH

## Objective

Harden the project-context bootstrap lifecycle before merge: keep `PROJECT_STATE.md` durable/
global only, make `CURRENT_TASK.md` branch-scoped in `npm run context`, add a permanent
Operational State Scope policy, and make `npm run context` compact by default with a `--full`
flag for the detailed dump.

## Branch / Base

Branch: `chore/project-context-bootstrap`
Base: `main` (`0683e84`)

## Status

Complete — committed and pushed to `chore/project-context-bootstrap`. No PR opened (task's PR
expected: no). Awaiting human review of this task's output and of the branch as a whole before
any merge decision.

## Allowed Scope

Update:
- `.project/PROJECT_STATE.md`, `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`,
  `.project/DECISIONS_LOG.md`
- `CLAUDE.md`, `docs/development/AGENT_POLICY.md`
- `scripts/dev/project-context.mjs`

Forbidden: `docs/foundation/**`, `docs/adr/**`, `docs/contracts/**`, `docs/examples/**`,
`schemas/**`, `tests/**` — no architecture, foundation, contract, or schema changes.

## Required Context

- `CLAUDE.md`
- `.project/PROJECT_STATE.md`
- `.project/REVIEW_STATE.md`
- `.project/CONTEXT_INDEX.md`
- `docs/development/AGENT_POLICY.md` (Task Contract, Git & Branch Workflow, Operational State
  Scope)
- `docs/development/REVIEW_PROTOCOL.md` (Completion Checklist, Outcomes)
- `scripts/dev/project-context.mjs`

## Validation

- `npm run context` runs without error, stays compact (~25-40 lines), and reports "no active
  task" when `CURRENT_TASK.md`'s declared branch doesn't match the checked-out branch.
- `npm run context -- --full` runs and prints the detailed state-file dump.
- `npm test` still passes (contract validator untouched).
- `git status` / `git diff --stat` confirm only files listed under Allowed Scope changed.
- One read-only Codex review pass focused on fresh-session and stale-state failure modes.

## Next Gate

Human review of this task's outcome, and of the branch as a whole before any merge decision.
Commit and push are authorized for this task; no PR is expected. No further MIHVER step is
authorized by this task's completion.
