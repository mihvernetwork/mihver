# Decisions Log

Append-only. Records durable, human-approved project/process decisions — not their technical
content, which lives in the relevant ADR/contract and must not be duplicated here. Entries are
added at task completion; existing entries are never edited or removed.

Format: `YYYY-MM-DD — decision — reference`.

---

- 2026-08-19 — M0 Step 02A (Intent semantic contract) merged to `main` via PR #1, human-gated
  merge per `AGENT_POLICY.md`. — `218bced`
- 2026-08-19 — M0 Step 02B (Intent schema): human decision stated directly as "APPROVED"; merged
  to `main`. — `0683e84`
- 2026-08-19 — Authorized `PROJECT-CONTEXT-BOOTSTRAP`: build the `.project/` session-bootstrap
  mechanism and `scripts/dev/project-context.mjs`. — branch `chore/project-context-bootstrap`
- 2026-08-19 — Authorized `PROJECT-CONTEXT-FINAL-PATCH`: harden the bootstrap lifecycle before
  merge — durable-only `PROJECT_STATE.md`, branch-scoped `CURRENT_TASK.md`, a permanent
  Operational State Scope policy, and a compact-by-default `npm run context` with `--full`. —
  branch `chore/project-context-bootstrap`
- 2026-08-19 — Human review of the `chore/project-context-bootstrap` branch and bootstrap
  mechanism: **APPROVED WITH FINAL OPERATIONAL PATCH REQUIRED**, stated directly by the human,
  not final merge approval. Authorized `PROJECT-CONTEXT-MERGE-GATE`: Gate Recording Commit policy,
  a compact PROJECT_STATE.md-derived summary in `npm run context`, and this review-state record. —
  branch `chore/project-context-bootstrap`
- 2026-08-19 — `PROJECT-CONTEXT-BOOTSTRAP` **APPROVED for merge** — human decision stated directly
  as "PROJECT-CONTEXT-BOOTSTRAP is APPROVED for merge"; recorded via a Gate Recording Commit per
  `AGENT_POLICY.md`. The merge itself has not been performed — execution requires a separate,
  later explicit instruction. — branch `chore/project-context-bootstrap`
- 2026-08-19 — `PROJECT-CONTEXT-BOOTSTRAP` merged to `main`: human requested PR + squash merge
  directly in conversation (base `main`, compare `chore/project-context-bootstrap`), executed via
  PR #3, squash commit `c5d3dc8`, message `chore: add durable project context bootstrap`. Fulfills
  the merge decision recorded above. — `c5d3dc8`
- 2026-08-19 — Authorized `PROJECT-CONTEXT-FREEZE-STATE`: sync durable project state after the PR
  #3 merge — record the new frozen checkpoint in `PROJECT_STATE.md`, update operational state
  files per `AGENT_POLICY.md`'s Operational State Scope, no bootstrap-implementation or
  architecture changes. — branch `chore/project-context-freeze-state`
- 2026-08-19 — `PROJECT-CONTEXT-FREEZE-STATE` (PR #4) **APPROVED for merge** — human decision
  stated directly as "PR #4 / PROJECT-CONTEXT-FREEZE-STATE is APPROVED for merge"; recorded via a
  Gate Recording Commit per `AGENT_POLICY.md`. The merge itself has not been performed —
  execution requires a separate, later explicit instruction. — branch
  `chore/project-context-freeze-state`
