# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

PROJECT-CONTEXT-BOOTSTRAP

## Objective

Create a durable, fast session-bootstrap mechanism so a fresh Claude session can reconstruct
MIHVER's current state without scanning the whole repository or relying on prior conversation
history.

## Branch / Base

Branch: `chore/project-context-bootstrap`
Base: `main` (`0683e84`)

## Status

Complete — committed and pushed to `chore/project-context-bootstrap`. No PR opened (task's PR
expected: no). Awaiting human review and any merge decision.

## Allowed Scope

Create:
- `.project/PROJECT_STATE.md`, `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`,
  `.project/CONTEXT_INDEX.md`, `.project/DECISIONS_LOG.md`
- `scripts/dev/project-context.mjs`

Update:
- `CLAUDE.md`, `docs/development/AGENT_POLICY.md`, `docs/development/TASK_TEMPLATE.md`,
  `package.json`

Forbidden: `docs/foundation/**`, `docs/adr/**`, `docs/contracts/**`, `docs/examples/**`,
`schemas/**`, `tests/**` — no architecture, foundation, contract, or schema changes.

## Required Context

- `CLAUDE.md`
- `.project/PROJECT_STATE.md`
- `.project/REVIEW_STATE.md`
- `.project/CONTEXT_INDEX.md`
- `docs/development/AGENT_POLICY.md` (Task Contract, Git & Branch Workflow)
- `docs/development/REVIEW_PROTOCOL.md` (Completion Checklist, Outcomes)

## Validation

- `npm run context` runs without error and prints branch/HEAD/dirty/main-delta/state/required
  context.
- `npm test` still passes (contract validator untouched).
- `git status` / `git diff --stat` confirm only files listed under Allowed Scope changed.
- One read-only Codex review pass covering: stale-state risk, duplicated source-of-truth risk,
  context explosion, hidden GitHub dependency, ambiguity about human approval.

## Next Gate

Human review of this task's outcome. Commit and push are authorized for this task; no PR is
expected. No further MIHVER step is authorized by this task's completion.
