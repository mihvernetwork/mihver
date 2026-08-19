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
- **M0 Step 02A** — Intent semantic contract. Merged via PR #1 (`218bced`). Produced `ADR-0002`
  (Status: Proposed — see Open Items), `INTENT_SPEC.md`, `USER_IDEA.md`, `INTENT_CASES.md`.
- **M0 Step 02B** — Intent schema. Merged (`0683e84`). Produced `SCHEMA_MAPPING.md`,
  `schemas/m0/*.json`, `tests/contracts/**`, `package.json`.

## Open Items

- `ADR-0002` Status is still **Proposed**, not Accepted, despite being merged to `main`. See its
  own "Future Work" section for the condition under which it should be revisited — not restated
  here to avoid this file drifting out of sync with that section.

## Next Authorized Action

None beyond the frozen checkpoints above. Per `REVIEW_PROTOCOL.md` item 9, completing a task is
not authorization to start the next one — any new M0 step, and resolving the ADR-0002 status open
item, both require a new human task instruction. See [CURRENT_TASK.md](./CURRENT_TASK.md) for
whatever task is active on the currently checked-out branch, if any.
