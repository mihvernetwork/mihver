# Project State

Durable checkpoint, human/Claude-maintained — not auto-generated. For live git facts (branch,
HEAD, dirty state, diff vs. `main`), run `npm run context`. This file records interpretation and
status; `project-context.mjs` reports raw observed state. If the two disagree, trust the live
git/gh output and update this file — do not trust this file over reality.

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

## Active Work

Branch: `chore/project-context-bootstrap` — infrastructure task `PROJECT-CONTEXT-BOOTSTRAP`, not a
milestone step. Complete and pushed; not merged to `main`, no PR opened. See
[CURRENT_TASK.md](./CURRENT_TASK.md).

No M0 step is currently active. `m0/step-03-requirement-contract` appears only as a naming example
in `AGENT_POLICY.md` — it is not an authorized or started step.

## Lifecycle Status

Step 02B is the latest frozen checkpoint on `main`. The active task builds session-bootstrap
tooling on top of it; no M0 pipeline stage beyond Step 02B has started.

## Open Items

- `ADR-0002` Status is still **Proposed**, not Accepted, despite being merged to `main`. See its
  own "Future Work" section for the condition under which it should be revisited — not restated
  here to avoid this file drifting out of sync with that section.

## Next Authorized Action

None beyond completing the active task. Per `REVIEW_PROTOCOL.md` item 9, completing a task is not
authorization to start the next one — the next M0 step, and resolving the ADR-0002 status open
item, both require a new human task instruction.
