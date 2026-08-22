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
- **`ADR-0004` — Memory Context Authority Boundary.** Semantic/architectural design only, defining
  how MIHVER Brain (`../mihver-brain`) durable memory could integrate with the M0 pipeline without
  violating `ADR-0001`/`ADR-0002`/`ADR-0003` — a typed, immutable `MemoryContext` artifact ("Model
  C"), never a `Claim`, never `Evidence`, never merged into `UserIdea`, never queried directly by
  any stage. Merged via PR #15, squash commit `aa1fe66`. Produced
  `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, `docs/contracts/MEMORY_CONTEXT.md`,
  `docs/examples/MEMORY_CONTEXT_CASES.md`. `ADR-0004`'s Status is **Proposed** on `main` as
  merged — see Open Items; full semantic detail lives in those documents themselves, not restated
  here. **As of the Dependency A checkpoint immediately below, `MemoryContext` consumption is no
  longer entirely unauthorized** — see that entry for exactly what changed and what still has not.
- **`ADR-0004` Dependency A — Foundation Memory Boundary.** Amended `docs/foundation/M0_SCOPE.md`
  to implement the core `M0_SCOPE.md` integration boundary `ADR-0004`'s Foundation Impact Analysis
  named as required before any `MemoryContext` consumption. Merged via PR #17, squash commit
  `9416e857b549bea07d4ce06a5c365524fdf1d51a`. Introduced: `RunContext` (a non-memory,
  cross-cutting run/invocation identity anchor, distinct from `UserIdea` as M0's sole milestone
  semantic input); the `MemoryContext` Producer as a declared cross-cutting compiler boundary (not
  a new linear pipeline stage); and **Research Planning as the first stage whose declared
  `Input:` list includes an optional `MemoryContext`**, restricted to the `DISCOVERY_ATTENTION`
  influence tier only (additive, provenance-visible, never authoritative). No stage may query
  `../mihver-brain` directly. At the time of this checkpoint, every other pipeline stage, and
  `ADR-0004`'s dependencies B (`INTENT_SPEC.md` Inference-premise), C (`REQUIREMENT_SPEC.md`
  Requirement-Level-Inference premise), and D (`REQUIREMENT_SPEC.md` R-19 memory-informed-rationale
  provenance), remained structurally disabled; `INTENT_SPEC.md`/`REQUIREMENT_SPEC.md` were untouched.
  **Dependency B has since landed — see the "`ADR-0004` Dependency B" checkpoint below.** Dependencies
  C and D remain structurally disabled even now. Adversarially reviewed by four independent read-only
  Codex reviewers, by axis. **This is a semantic/foundation authorization only, not an implemented
  runtime**: at the time of this checkpoint there was still no `MemoryContext` schema, no Brain read
  adapter, and no executable pipeline that actually retrieves or produces a `MemoryContext` —
  Research Planning was newly permitted to consume one under the M0 contract, without yet receiving
  one in practice. A machine-readable schema has since been added — see the "MemoryContext Schema
  Foundation" checkpoint below; a Brain read adapter and executable retrieval pipeline still do not
  exist even now. `ADR-0004`'s own `## Status` field is unchanged by this checkpoint (**Proposed**) —
  see the Acceptance checkpoint immediately below for the later Status change.
- **`ADR-0004` Acceptance** — Memory Context Authority Boundary moved Proposed → Accepted, per its
  own "Acceptance Gate" section's condition: dependency A alone (the core `M0_SCOPE.md` integration
  boundary), separately, explicitly human-authorized, completed, and adversarially reviewed against
  real cases — the same checkpoint recorded immediately above (PR #17, squash commit
  `9416e857b549bea07d4ce06a5c365524fdf1d51a`), already adversarially reviewed by four independent
  read-only Codex reviewers before that merge. Implemented as task `ADR-0004-ACCEPTANCE`; the Status
  change itself is recorded in `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`'s own
  `## Status` field, not restated here beyond this checkpoint, per the same drift-avoidance pattern
  `ADR-0002`'s and `ADR-0003`'s entries already use. This Acceptance changes only the ADR's Status:
  dependencies B (`INTENT_SPEC.md` Inference-premise), C (`REQUIREMENT_SPEC.md`
  Requirement-Level-Inference premise), and D (`REQUIREMENT_SPEC.md` R-19 memory-informed-rationale
  provenance) remain exactly as structurally disabled as before — they were never prerequisites for
  this Acceptance and are not enabled by it. At the time of this checkpoint, no `MemoryContext`
  schema, runtime, or Brain adapter existed, and Research Planning did not retrieve any actual
  memory — a schema has since been added (see "MemoryContext Schema Foundation" below); no runtime
  or Brain adapter exists even now.
- **MemoryContext Schema Foundation** — Created the first machine-readable JSON Schema
  (`schemas/m0/memory-context.schema.json`, JSON Schema Draft 2020-12) and deterministic validator
  integration (`tests/contracts/validate-contracts.mjs`) for the Accepted `MemoryContext` semantic
  contract, plus a dedicated `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md` mapping every
  M-01–M-21 invariant to its enforcement layer (schema-enforced / validator-enforced / not
  enforceable at this layer / not applicable). Merged via PR #20, squash commit
  `b8fc6fe6558adbb560b48f1bbe937db53ac09555`; contract suite at merge-ready head: **59/59**.
  Establishes a stable `(memory_context_id, entry_id)` reference primitive a future Dependency
  B/C/D amendment could cite — at the time of this checkpoint, `INTENT_SPEC.md`,
  `intent-spec.schema.json`, and `REQUIREMENT_SPEC.md` remained untouched, and no such citation was
  yet defined. **Schema representability is not stage authorization**: the schema deliberately
  represents all four Influence Taxonomy tiers and an open `consuming_stage` identifier so that a
  future authorized consumer never requires redesigning the artifact's shape, but `M0_SCOPE.md`
  remains the sole authority for which stage may actually consume `MemoryContext`. At the time of
  this checkpoint, Research Planning (`DISCOVERY_ATTENTION` tier only) was still the sole authorized
  consumer, and dependencies B, C, and D remained exactly as structurally disabled as before this
  checkpoint. **Dependency B has since landed — see the "`ADR-0004` Dependency B" checkpoint below**;
  C and D remain structurally disabled even now. No MIHVER Brain adapter, retrieval runtime, or
  executable Producer implementation exists.
- **`ADR-0004` Dependency B — Intent Memory Premise.** Amended `docs/foundation/M0_SCOPE.md`,
  `docs/contracts/INTENT_SPEC.md`, `schemas/m0/intent-spec.schema.json`, and
  `tests/contracts/validate-contracts.mjs` to let Intent Parsing consume bounded `MemoryContext` and
  let a qualified Category A historical-user `MemoryContext` entry become a cited premise of a
  current-run Inferred Claim. Merged via PR #22, squash commit
  `2cee16af702804127472af0470b3ce4ef2600f88`.
  - **Intent Parsing is now the second authorized `MemoryContext` consumer** (Research Planning
    remains the first, unchanged). Its authorized influence tiers are exactly `DISCOVERY_ATTENTION`
    and `SEMANTIC_PREMISE`.
  - **`DISCOVERY_ATTENTION`**: a Category A or Category B historical-user `MemoryContext` entry may
    shape a provenance-visible candidate clarification question posed to the current user. It never
    itself creates a Claim, resolves an Open Item, or substitutes for the current user's own answer.
  - **`SEMANTIC_PREMISE`**: only a Category A entry may be directly cited, by the stable
    `(memory_context_id, entry_id)` reference, as a premise of a current-run Inferred Claim. Category
    B is categorically ineligible at this tier, at any confidence or repetition level.
  - A companion immutable `MemoryContext` document is **mandatory** for deterministic validation of
    any `memory_premises` or `memory_discovery_refs` reference — an `IntentSpec` cannot pass
    validation merely by self-asserting Category A standing.
  - A memory-derived Claim's origin remains **Inferred only** — never User-Provided, never Assumed.
  - The current `UserIdea` always wins over historical memory; a `MemoryContext` entry is never a
    Conflict participant.
  - A historical statement's own normative force is never mechanically copied into a current
    Inferred Claim's force — an independent, explicit current-run reasoning basis is required
    whenever such a Claim carries force.
  - Memory alone never closes a HIGH or CRITICAL Decision Impact item.
  - Contract suite at merged head: **83/83**.
  - **What this did not do**: Requirement Derivation is still **not** a `MemoryContext` consumer;
    Dependency C (`REQUIREMENT_SPEC.md` Requirement-Level-Inference premise) and Dependency D
    (`REQUIREMENT_SPEC.md` R-19 memory-informed-rationale provenance) remain unimplemented; no
    MIHVER Brain adapter or retrieval runtime exists. Full detail in `INTENT_SPEC.md`'s
    "Memory-Derived Inference Premises" section and `docs/contracts/MEMORY_CONTEXT.md`'s "Stage
    Consumption Authorization" section.

## Open Items

- `ADR-0003` (Requirement Derivation Model) Status is **Proposed**, not Accepted, on `main` as
  merged via PR #13. Mirroring `ADR-0002`'s own precedent, moving it to Accepted is expected to
  require its own future condition (e.g. schema design plus an adversarial review pass against
  real cases) — see its own "Future Work" section for the actual condition, not restated here to
  avoid drift. No task in this session has been authorized to change `ADR-0003`'s Status.

## Next Authorized Action

None automatically. Per `REVIEW_PROTOCOL.md` item 9, completing a task is not authorization to
start the next one. In particular: moving `ADR-0003` to Accepted, beginning M0 Step 03B, starting
`ADR-0004`'s dependencies C or D, and performing any `mihver-brain` or runtime memory-integration
work are all **not** authorized by any checkpoint recorded above — each requires its own separate,
explicit human task instruction, given later. **Dependency B is now complete** (see the
"`ADR-0004` Dependency B" checkpoint above) — its completion is not, by itself, authorization to
start Dependency C.

**Dependency C is the logical next task family**, now that Dependency B has landed — but it is
**not authorized by this entry**. Its expected conceptual scope, recorded here for future reference
only, not designed or implemented by this reconciliation:

- Requirement Derivation must first receive its own, separate `M0_SCOPE.md` authorization to
  consume `MemoryContext` at all — Dependency B's authorization of Intent Parsing does not extend to
  Requirement Derivation; each stage's `MemoryContext` consumption is authorized individually.
- `REQUIREMENT_SPEC.md`'s R-10/R-22 provenance model would then need to recognize a qualified
  `MemoryContext` entry as a Requirement-Level Inference premise, mirroring the discipline
  `INTENT_SPEC.md`'s own Inference Policy amendment already established for Dependency B — without
  becoming a fourth Requirement premise origin, `IntentSpec`-provenance laundering, User-Provided
  Requirement authority, or a substitute for `Evidence`; a memory entry must never become a
  Requirement by itself.
- Dependency D (`REQUIREMENT_SPEC.md` R-19 memory-informed `DECISION_OPTION` rationale) remains a
  separate, later, narrower task of its own — not designed here.

This reconciliation performed no semantic redesign, changed no ADR status, and started no new work.
See [CURRENT_TASK.md](./CURRENT_TASK.md) for whatever task is active on the currently checked-out
branch, if any.
