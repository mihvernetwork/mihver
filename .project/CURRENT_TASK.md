# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

PROJECT-CONTEXT-AUTO-BOOTSTRAP

## Objective

Update `CLAUDE.md`'s "Fast Session Bootstrap" section so it explicitly triggers before answering
the **first** user message of a fresh session, unconditionally — including a bare greeting
("hello") with no stated task — not only when the message names a MIHVER task; and so it
explicitly directs Claude to then answer the user's original message normally afterward,
surfacing current project state briefly only when useful. Requirements 1–6 of the originating
task prompt (run `npm run context`; use the compact snapshot as initial state; active-task vs.
no-active-task REVIEW_STATE handling; no repo/git-history/GitHub scanning by default; GitHub as
remote-only) were already present in `CLAUDE.md` before this task — this task closed the one gap
(unconditional trigger + explicit post-bootstrap answer step), as a minimal patch, not an
architecture change.

## Branch / Base

Branch: `chore/project-context-auto-bootstrap`
Base: `main` (`fdc27d4`)

## Status

Complete — implemented (two additive hunks in `CLAUDE.md`'s "Fast Session Bootstrap" section; no
existing rule removed or rewritten), independently reviewed (one read-only Codex reviewer;
verdict **APPROVED**, no required changes — see `.project/REVIEW_STATE.md`), and validated
(`npm test` 24/24, `npm run context` compact). Committed and pushed to
`chore/project-context-auto-bootstrap`; PR opened against `main`. Not merged — merge requires a
separate, later human instruction per `AGENT_POLICY.md`'s Authority Hierarchy.

## Allowed Scope

Update:
- `CLAUDE.md`
- `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`

Forbidden: `.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`, `docs/foundation/**`,
`docs/adr/**`, `docs/contracts/**`, `docs/examples/**`, `schemas/**`, `tests/**`,
`docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`,
`docs/development/TASK_TEMPLATE.md`, `scripts/dev/project-context.mjs`. No live/prospective
GitHub PR state may be recorded in repository metadata (carry forward the
`PROJECT-CONTEXT-REMOTE-STATE-PATCH` invariant).

## Required Context

- `CLAUDE.md`
- `.project/CURRENT_TASK.md`
- `.project/REVIEW_STATE.md`
- `.project/PROJECT_STATE.md`
- `docs/development/AGENT_POLICY.md` (Session Bootstrap, Git & Branch Workflow)
- `docs/development/REVIEW_PROTOCOL.md` (Completion Checklist, Outcomes)

## Validation

- `npm run context` (compact) run on this branch: reports `Active task: none` for this branch
  (expected — this file itself declares the branch being worked on, consistent with how prior
  in-progress tasks report under `project-context.mjs`'s branch/Task-ID matching).
- `npm test` passes (24/24 contract fixtures; untouched by this task).
- One read-only Codex reviewer, focused on requirement coverage (all 7 numbered goals from the
  task prompt), patch minimality, and consistency with `AGENT_POLICY.md`'s Session Bootstrap
  section — verdict **APPROVED**.

## Next Gate

PR opened for `chore/project-context-auto-bootstrap` → `main`. Awaiting human review and merge
decision — not started or implied by this task. Actual PR status/mergeability are remote-only
GitHub facts, not tracked in this file; query GitHub when needed.
