# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

DEVELOPMENT-CONSISTENCY-MODEL-V2

## Objective

A bounded improvement to MIHVER's own development *operating model* — not to M0 product semantics —
to reduce the recurring post-implementation "closure chain" pattern visible throughout
`.project/REVIEW_STATE.md`'s history (implementation → review → semantic closure →
foundation/current-state closure → cross-reference hygiene closure → merge → durable-state
reconciliation → factual-log closure). Introduces, in `docs/development/AGENT_POLICY.md`: a formal
Owner / Mirror / Historical Record document-authority model, a three-tier Primary / Conditional
Consistency / Forbidden task file-scope model (replacing the flat Allowed/Forbidden split), and a
one-bounded-reconciliation policy. Adds, in `docs/development/REVIEW_PROTOCOL.md`, a mandatory Final
Consistency Sweep phase (with a proportionality rule) before a task may be reported
`READY_FOR_HUMAN_REVIEW`. Updates `docs/development/TASK_TEMPLATE.md` to the three-tier scope shape
plus new Owning Facts Changed / Mirrors Potentially Affected / Required Final Consistency Sweep /
Durable-State Impact fields and a pre-implementation "which facts become stale elsewhere?" question.
Adds a deterministic, read-only, zero-network consistency checker
(`scripts/dev/project-consistency.mjs`, `npm run check:project-consistency`) plus its own test suite
(`tests/dev/project-consistency.test.mjs`, `npm run test:project-consistency`). Demonstrates the
Owner/Mirror pattern concretely by adding a "Current Capability Snapshot" section to
`.project/PROJECT_STATE.md` and a short editing-policy note (with one compact example) to
`ROADMAP.md`, without a wholesale rewrite of either file's existing history.

**Does not change**: M0 product semantics, `IntentSpec`/`RequirementSpec`/`MemoryContext` semantics,
`ADR-0001`–`ADR-0004` decisions/statuses, schemas, contract behavior, MIHVER Brain, runtime
architecture, or Dependency A/B/C/D status. No file under `docs/foundation/**`, `docs/contracts/**`,
`docs/adr/**`, `docs/examples/**`, `schemas/**`, `tests/contracts/**`, or `../mihver-brain/**` was
touched.

## Branch / Base

Branch: `chore/development-consistency-v2` (new branch, created from `main`).
Base: `main` at `0f5dc581a1f550c85db68af5759b45cad2ab6a30` — verified via `git status` (clean),
`git log` (HEAD matched exactly before branching), `npm run context` (no active task), `npm test`
(85/85) before any edit.

## Status

**Complete, pending human review.**

Implemented as specified. Live reality verified before any edit (Section 0 of the task prompt): all
of `git status`/`git log`/`npm run context`/`npm test` matched the expected base exactly (main HEAD
`0f5dc58`, clean tree, 85/85). Read fresh: `CLAUDE.md`, `AGENT_POLICY.md`, `REVIEW_PROTOCOL.md`,
`TASK_TEMPLATE.md`, `.project/PROJECT_STATE.md`, `.project/CURRENT_TASK.md`,
`.project/REVIEW_STATE.md`, `.project/CONTEXT_INDEX.md`, `.project/DECISIONS_LOG.md`, `ROADMAP.md`,
`scripts/dev/project-context.mjs`. Semantic contracts (`M0_SCOPE.md`, `INTENT_SPEC.md`,
`REQUIREMENT_SPEC.md`, `MEMORY_CONTEXT.md`) were read only as ownership examples during design, per
the task's own instruction, and were not edited.

**Files changed** (all within the task's Primary/Conditional scope — none under a forbidden path):
`docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`,
`docs/development/TASK_TEMPLATE.md`, `scripts/dev/project-consistency.mjs` (new),
`tests/dev/project-consistency.test.mjs` (new), `package.json` (two new npm scripts, additive only),
`.project/PROJECT_STATE.md`, `ROADMAP.md`, `.project/CONTEXT_INDEX.md`. `CLAUDE.md` was read and
found not to need any change (no "Allowed/Forbidden" binary-scope wording lives there to update).
`.project/DECISIONS_LOG.md` was deliberately left untouched: its own policy is now tightened in
`AGENT_POLICY.md`'s "Operational State Scope" section instead (the owner of that policy), rather than
restating it in the log file's own header — consistent with the Owner/Mirror model this task
introduces, and avoiding a self-referential edit to the very file whose entries the append-only
policy protects.

**Three independent read-only Codex reviewers**, one per axis (see `REVIEW_STATE.md` for full
detail):
- Reviewer A (Authority / Owner-Mirror Model): 2/5 PASS initially, 3 confirmed findings — all fixed.
- Reviewer B (Task / Review Workflow): 5/5 PASS, no findings.
- Reviewer C (Deterministic Tooling): 6/7 PASS, 1 confirmed test-coverage finding — fixed.

All confirmed findings were independently re-verified by Claude against the actual file content
(quoted line numbers checked directly) before being accepted, and all were fixed. See
`REVIEW_STATE.md`'s "Latest Review" for the itemized findings and fixes.

**Validation**: `npm test` — 85/85 throughout, unaffected (no contract/schema/fixture file touched).
`npm run check:project-consistency` — all 7 deterministic checks PASS. `npm run test:project-consistency`
— all 7 test groups PASS, including a fixture-repo proof and a real-repo `git status --porcelain`
proof that the checker never modifies any file. `git diff --check` — clean. `git diff main --stat` —
confirmed to touch only the files listed above; no product semantic file, ADR status, or Dependency
A/B/C/D result changed; no `RequirementSpec` Step 03B work started.

## Allowed Scope

**Primary**: `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`,
`docs/development/TASK_TEMPLATE.md`, `scripts/dev/project-consistency.mjs`, `package.json` (npm
script entries only).

**Conditional Consistency** (touched; each edit synchronization-only, reasons recorded above and in
individual edits): `.project/PROJECT_STATE.md` (new Current Capability Snapshot, demonstrating the
model), `ROADMAP.md` (new editing-policy note plus two wording fixes to pre-existing sentences that
Reviewer A found now self-contradict the new Owner/Mirror model — see `REVIEW_STATE.md`),
`.project/CONTEXT_INDEX.md` (navigation entries for the new policy sections and script),
`.project/CURRENT_TASK.md`/`.project/REVIEW_STATE.md` (this task's own record).

**Forbidden, confirmed untouched**: `docs/foundation/**`, `docs/contracts/**`, `docs/adr/**`,
`docs/examples/**`, `schemas/**`, `tests/contracts/**`, `../mihver-brain/**`.

## Required Context

See "Status" above for the full required-reading list, matching the task's own Section 0.

## Validation

See "Status" above.

## Next Gate

Commit, push, and open exactly one PR against `mihvernetwork/mihver:main`
(title: `dev: add development consistency model v2`). Do not merge. Human review of that PR is the
next gate.
