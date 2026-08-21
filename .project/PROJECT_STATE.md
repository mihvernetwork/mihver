# Project State

Durable checkpoint, human/Claude-maintained — not auto-generated. Describes **global, frozen**
project state only: the current milestone and its frozen checkpoints. It never records
active-task, branch, or in-progress facts — those live in [CURRENT_TASK.md](./CURRENT_TASK.md),
which is branch-scoped and updated at task start/end, and go stale here the moment a branch is
merged or abandoned. See "Operational State Scope" in
[AGENT_POLICY.md](../docs/development/AGENT_POLICY.md) for the full per-file update policy.

For live git facts (branch, HEAD, dirty state, diff vs. `main`), run `npm run context`. This file
records interpretation and status; `project-context.mjs` reports raw observed state. If the two
disagree, trust the live git/gh output and update this file — do not trust this file over
reality.

## Current Milestone

M0 — see [M0_SCOPE.md](../docs/foundation/M0_SCOPE.md). Target: `UserIdea` → `MihverArchitectureSpec`.

## Frozen Steps / Checkpoints (on `main`)

- Architecture foundation — `VISION.md`, `PRINCIPLES.md`, `M0_SCOPE.md`, `ADR-0001` (Accepted).
- Development operating model — `CLAUDE.md`, `AGENT_POLICY.md`, `REVIEW_PROTOCOL.md`,
  `TASK_TEMPLATE.md`.
- **M0 Step 02A** — Intent semantic contract. Merged via PR #1 (`218bced`). Produced `ADR-0002`,
  `INTENT_SPEC.md`, `USER_IDEA.md`, `INTENT_CASES.md`.
- **M0 Step 02B** — Intent schema. Merged (`0683e84`). Produced `SCHEMA_MAPPING.md`,
  `schemas/m0/*.json`, `tests/contracts/**`, `package.json`.
- **Project Context Bootstrap** — durable `.project/` session-bootstrap state and
  `npm run context` tooling for fresh-session state reconstruction, plus the Operational State
  Scope and Gate Recording Commit policies. Merged via PR #3, squash commit `c5d3dc8`. Produced
  `.project/PROJECT_STATE.md`, `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`,
  `.project/CONTEXT_INDEX.md`, `.project/DECISIONS_LOG.md`, `scripts/dev/project-context.mjs`;
  extended `docs/development/AGENT_POLICY.md`.
- **Night Runner** — deterministic, dry-run-by-default task-orchestration tooling (no execution
  capability without an explicit human-gated executor). Foundation merged via PR #7 (`9a61a0b`);
  fresh-Claude single-task execution adapter merged via PR #8 (`4590f7a`). Produced
  `docs/development/NIGHT_RUNNER.md`, `scripts/dev/night-runner.mjs`,
  `scripts/dev/night-runner-executor.mjs`, and their dedicated test suites
  (`npm run test:night-runner`, `npm run test:night-runner-executor`) — separate from
  `npm test`, which covers only `tests/contracts/**`.
- **`ADR-0002` Acceptance** — Epistemic Provenance Model moved Proposed → Accepted, per its own
  Future Work condition (schema design complete, plus at least one adversarial review pass
  against real cases). Adversarial review and remediation merged via PR #10 (`548bb75`) and
  PR #11 (`63429c9`); acceptance itself merged via PR #12 (`a20d647`). Current status lives in
  `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`'s own `## Status` field — not restated here
  beyond this checkpoint, to avoid this file drifting out of sync with that field again.
- **M0 Step 03A** — Requirement Derivation semantic contract (`IntentSpec` → `RequirementSpec`).
  Merged via PR #13, squash commit `fe79098`. Produced `docs/contracts/REQUIREMENT_SPEC.md`,
  `docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`, `docs/examples/REQUIREMENT_CASES.md`.
  `ADR-0003`'s Status is **Proposed** on `main` as merged — see Open Items; not restated here
  beyond this checkpoint, for the same reason as `ADR-0002` above.

## Open Items

- `ADR-0003` (Requirement Derivation Model) Status is **Proposed**, not Accepted, on `main` as
  merged via PR #13. Mirroring `ADR-0002`'s own precedent, moving it to Accepted is expected to
  require its own future condition (e.g. schema design plus an adversarial review pass against
  real cases) — see its own "Future Work" section for the actual condition, not restated here to
  avoid drift. No task in this session has been authorized to change `ADR-0003`'s Status.

## Next Authorized Action

None beyond the frozen checkpoints above. Per `REVIEW_PROTOCOL.md` item 9, completing a task is
not authorization to start the next one. In particular: advancing `ADR-0003` toward Accepted,
beginning M0 Step 03B, and starting any new ADR (including a prospective `ADR-0004`) are all
**not** authorized by this reconciliation task — each requires its own separate, explicit human
task instruction, given later. This reconciliation only brought durable project state in line
with what is already true on `main`; it introduced no new architecture decision and started no
new work. See [CURRENT_TASK.md](./CURRENT_TASK.md) for whatever task is active on the currently
checked-out branch, if any.
