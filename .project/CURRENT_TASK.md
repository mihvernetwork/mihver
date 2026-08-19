# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

PROJECT-CONTEXT-MERGE-GATE

## Objective

Final bootstrap fixes ahead of the human's merge decision: define a permanent Gate Recording
Commit policy, add a compact global-project summary (milestone / latest checkpoint / next
authorized action) to `npm run context` without dumping `PROJECT_STATE.md`, and record the human's
current review of the branch as approved contingent on this patch — not yet a merge approval.

## Branch / Base

Branch: `chore/project-context-bootstrap`
Base: `main` (`0683e84`)

## Status

Complete — committed and pushed to `chore/project-context-bootstrap`. No PR opened (task's PR
expected: no). The human has since stated: "PROJECT-CONTEXT-BOOTSTRAP is APPROVED for merge" —
recorded via a Gate Recording Commit (see `.project/REVIEW_STATE.md`'s Merge Decision entry). The
merge itself has not been performed and is not authorized by that recording commit.

## Allowed Scope

Update:
- `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`, `.project/DECISIONS_LOG.md`
- `docs/development/AGENT_POLICY.md`
- `scripts/dev/project-context.mjs`

Forbidden: `docs/foundation/**`, `docs/adr/**`, `docs/contracts/**`, `docs/examples/**`,
`schemas/**`, `tests/**` — no architecture, foundation, contract, or schema changes. `CLAUDE.md`
and `.project/PROJECT_STATE.md` are also out of scope for this task — not requested by this
task's prompt, so left untouched (reported to the human as a minor, non-blocking follow-up
instead of edited silently).

## Required Context

- `CLAUDE.md`
- `.project/PROJECT_STATE.md`
- `.project/REVIEW_STATE.md`
- `.project/CONTEXT_INDEX.md`
- `docs/development/AGENT_POLICY.md` (Task Contract, Git & Branch Workflow, Operational State
  Scope, Gate Recording Commit)
- `docs/development/REVIEW_PROTOCOL.md` (Completion Checklist, Outcomes)
- `scripts/dev/project-context.mjs`

## Validation

- `npm run context` runs without error, prints the new Project summary (milestone/latest
  checkpoint/next action) without dumping `PROJECT_STATE.md`, and stays ~30-40 lines.
- `npm run context -- --full` runs and prints the detailed state-file dump.
- `npm test` still passes (contract validator untouched).
- `git status` / `git diff --stat` confirm only files listed under Allowed Scope changed.
- One read-only Codex review pass focused solely on state-lifecycle consistency.

## Next Gate

The human has approved `chore/project-context-bootstrap` for merge (see
`.project/REVIEW_STATE.md`'s Merge Decision entry). What remains is the merge execution itself (or
a PR to carry it) — a separate action requiring its own explicit instruction; not started by this
Gate Recording Commit.
