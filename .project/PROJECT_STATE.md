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

## Current Capability Snapshot

The one current-state summary in this file. Per [AGENT_POLICY.md](../docs/development/AGENT_POLICY.md)'s
"Document Authority Model", this section is a compact status + pointer, not a second definition of
any of these facts; if it ever disagrees with a fact's owning artifact, the artifact is correct and
this section is stale. Where a fact has a document owner, that owner is named inline; the schema/
runtime/test-count facts below are directly observable repository state (a file's existence, a test
run's own output) rather than claims a document defines, so they have no document owner to name.
`npm run check:project-consistency` mechanically checks a subset of this section against its owning
ADRs and against `ROADMAP.md`'s equivalent navigation summary.

- ADR-0002 (Epistemic Provenance Model): ACCEPTED — owner: `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`
- ADR-0003 (Requirement Derivation Model): PROPOSED — owner: `docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`
- ADR-0004 (Memory Context Authority Boundary): ACCEPTED — owner: `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`
- ADR-0005 (Decision Council Protocol): ACCEPTED — owner: `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`
- ADR-0006 (Decision Authorization Boundary): PROPOSED — owner: `docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md`

Dependency A/B/C/D and the `DECISION_OPTION` historical-source gate — status tokens only below; these
are several distinct facts with different semantic owners, not one umbrella-owned group:
- Stage `MemoryContext` consumption authorization (which stage may consume `MemoryContext`, and at
  which influence tier) — owner: `docs/foundation/M0_SCOPE.md`.
- `MemoryContext` source/influence eligibility (which entry categories/tiers exist at all and are
  eligible, including the historical Category A/B `DECISION_OPTION` source gate) — owner:
  `docs/contracts/MEMORY_CONTEXT.md`.
- Requirement Derivation Dependency D semantics (memory-informed R-19 working defaults; the
  historical A/B `DECISION_OPTION` content exclusion as it applies to Requirement Derivation) —
  owner: `docs/contracts/REQUIREMENT_SPEC.md` invariant R-24.
- Dependency C's no-direct-Requirement-premise disposition (retired, not implemented) — owner:
  `docs/contracts/REQUIREMENT_SPEC.md` invariant R-23, plus
  `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`'s own "Post-Acceptance Dependency B/C/D
  Disposition" section for the retirement rationale.

Full checkpoint-by-checkpoint PR history is in "Frozen Steps / Checkpoints" below, not repeated here:
- Dependency A (Foundation Memory Boundary): DONE
- Dependency B (Intent Memory Premise): DONE
- Dependency C (Requirement-Level Inference premise): RETIRED
- DECISION_OPTION historical-source gate: DONE
- Dependency D (Memory-Informed R-19 Working Defaults): DONE

MIHVER Orchestrator Delegation Firewall V1: OPERATIONAL — PR #59 merged at main SHA
`7d4ff0b2be4d33d180429ea827b8aebd113d100b`; merge-post CI, Project validation, and Publication
Broker **SUCCESS**; human installation **COMPLETED** / **INSTALLED**; real enforcement smoke
**PASS**. `ORCHESTRATOR_FIREWALL_V1_OPERATIONAL = true`; `V9_PREREQUISITES_FIREWALL = SATISFIED`.
This is a cooperative-agent orchestration guardrail only; documented V1 limitations remain, with no
malicious-same-user protection, OS privilege separation, Execution Gateway activation, V1C
authorization, or R3 human approval.

MemoryContext consumers — owner: `docs/foundation/M0_SCOPE.md`:
- Intent Parsing → `DISCOVERY_ATTENTION`, `SEMANTIC_PREMISE`
- Research Planning → `DISCOVERY_ATTENTION`
- Requirement Derivation → `DECISION_OPTION` only

RequirementSpec machine schema: IMPLEMENTED (M0 Step 03B) — owner: `schemas/m0/requirement-spec.schema.json`,
`docs/contracts/REQUIREMENT_SPEC_SCHEMA_MAPPING.md`
MIHVER Brain adapter / retrieval runtime: NOT IMPLEMENTED (observable: no adapter code in this repo)
Contract suite (`npm test`): 170/170 (observable: `npm test`'s own output)
ProjectContextPack v1 (deterministic, zero-network, derived repository/task-state snapshot):
IMPLEMENTED (Project Continuity V1A) — owner: `docs/development/PROJECT_CONTINUITY.md`,
`schemas/dev/project-context-pack.schema.json`. Tooling: `npm run context:pack`.
MIHVER Run Bundle v1 (deterministic, typed, auditable run record — `TaskRecord`,
`EvidenceManifest`, `RunManifest`, a deterministic bundle writer/compiler, and a human review
report renderer — built on `ProjectContextPack` v1 as pure input): IMPLEMENTED (Project Continuity
V1B) — owner: `docs/development/RUN_BUNDLE.md`.
Decision Council V1A kernel + simulator (pure, non-LLM deterministic reducer/event-sourced state
machine plus deterministic fake-agent fixture helpers, proving the Rotating Proposer + Two
Independent Reviewers + Exact-Candidate Quorum protocol only — no real LLM/provider/MCP/tool/shell/
Publication Broker connection, no Shadow Council, no execution gateway): IMPLEMENTED — owner:
`docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`. `ADR-0005`'s own `## Status` field is now
**Accepted** (see the ADR-0005 line above and the "ADR-0005 Acceptance" checkpoint below for the
frozen evidence basis) — Acceptance validates this protocol foundation and grants no execution,
publication, merge, or autonomy authority of any kind.
Decision Council Quorum Proof V1B sidecar (`CouncilQuorumProof` + `CouncilEpochRegistry`, deterministic
compiler/verifier, letting a downstream verifier independently recompute R1/R2/R3 quorum from raw
`CouncilConfig`/votes rather than trusting a `DecisionRecord`'s self-consistency; frozen V1A kernel/
schema unmodified): IMPLEMENTED — owner: `scripts/dev/council-quorum-proof.mjs`, ADR-0005's own
"Future Work" V1B addition, `docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md`'s "V1B Amendment"
subsection (Proposed, unchanged). This task exists because independent Authorization re-verification
exposed a real persistence/provenance gap in V1A `DecisionRecord`s; it grants no execution authority
and does not mark ADR-0006 Accepted.
Authorization Loop Foundation V1A (deterministic, non-LLM, network-free `AuthorizationEnvelope`
Binder + Ledger Simulator + `FakeExecutor` + verifier, proving the full Decision Council ->
`CouncilQuorumProof` -> Authorization -> simulated single-use consumption pipeline; both the Binder
and Ledger independently require and verify real `CouncilQuorumProof` evidence for R1/R2/R3 rather
than trusting a bare `DecisionRecord`; no real execution/publication/shell/Git/network/provider-CLI
capability of any kind): IMPLEMENTED — owner: `scripts/dev/authorization-binder.mjs`,
`scripts/dev/authorization-ledger-simulator.mjs`, `scripts/dev/authorization-loop.mjs`,
`scripts/dev/fake-executor.mjs`, `docs/development/AUTHORIZATION_LOOP_V1A_DEMONSTRATION.md`,
`docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md` (Proposed, unchanged — this task grants it no
execution authority and does not mark it Accepted). Demonstrated via
`scripts/dev/authorization-loop-demonstration.mjs`; evidence at
`.project/run-bundles/authorization-loop-v1a-demonstration/`.
Shadow Council vote-rationale evidence V1B (`ShadowVoteAssessment` — a Shadow-Council-only advisory
`{voteValue, rationale}` sidecar added on top of the frozen Shadow Council V1A harness/packet
modules, so a future REJECT/ABSTAIN is durably diagnosable; rationale has zero effect on ADR-0005
quorum/`DecisionRecord`/`recordHash`, proven by test; frozen kernel/schema untouched): IMPLEMENTED —
owner: `scripts/dev/shadow-council-vote-assessment.mjs`, `scripts/dev/shadow-council-run-bundle-evidence.mjs`,
`docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`'s "Advisory rationale evidence and Run Bundle
integration" / "Exercise 3" sections. Added after a real R3 exercise
(`AUTHORIZATION-LEDGER-V1C-R3-ARCHITECTURE-DECISION`, `NO_QUORUM`) exposed that a rejecting seat's
rationale was irrecoverably lost; the historical `NO_QUORUM` exercise was not reinterpreted and the
lost rationale was not fabricated. This modifies `scripts/dev/shadow-council-packet.mjs` and
`scripts/dev/shadow-council-harness.mjs` (previously noted below as "frozen" for the V1A harness's
own protocol-exercise purpose) only to add this advisory evidence layer — the underlying seat
cohort/attestation/CLI-transport modules and the R1/R2 exercise record remain unchanged.
Shadow Council invocation-failure evidence V1 (`ShadowSeatInvocationFailure` — a Shadow-Council-only
advisory artifact, plus synchronous harness hooks, persisting durable per-stage evidence for a real
seat invocation — packet built, attestation admitted/rejected, assessment built, or a classified
failure — incrementally to an OPEN Run Bundle as it happens, not only after a successful exercise
return; zero effect on ADR-0005 quorum/`DecisionRecord`, frozen kernel/schema/`CouncilQuorumProof`/
Authorization Loop untouched): IMPLEMENTED — owner: `scripts/dev/shadow-council-invocation-failure.mjs`,
`scripts/dev/shadow-council-run-bundle-evidence.mjs`, `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`'s
"Durable invocation-failure evidence" / "Exercise 4" sections. Added after a real R3 architecture
exercise attempt (`authorization-ledger-v1c-r3-arch-decision-2`) hit `MALFORMED_SEAT_OUTPUT`
mid-voting and lost all forensic evidence because the prior evidence writer only persisted data after
a fully successful return; that failed attempt's outcome (`COUNCIL_EVIDENCE_BLOCKER`) is unchanged
and not reinterpreted, and which seat/stage/reason caused it is not reconstructed — that information
was exactly what was lost. This modifies `scripts/dev/shadow-council-harness.mjs` again (see the V1B
entry above for the same "frozen for protocol-exercise purposes, extended only for advisory evidence"
caveat) only to add hooks; the V1C architecture Council decision itself was not rerun by this task.
Shadow Council contemporaneous quorum evidence V1 (forward-only durable `DecisionRequest` +
canonical `CouncilConfig` + terminal `CouncilQuorumProof` evidence pipeline for real R1/R2/R3 runs;
explicit authoritative real-seat `modelFamily` metadata, frozen canonical seat order, and a
fail-closed canonical-config gate before provider spend; at terminal time, the persisted
request/config/record and every `ShadowVoteAssessment` are re-read from disk, votes are derived
through frozen `deriveAgentVote` in persisted seat order, then proof is built, verified, persisted,
and only then may the Run Bundle be FINALIZED): IMPLEMENTED — owner:
`scripts/dev/shadow-council-cli-transport.mjs`, `scripts/dev/shadow-council-run-bundle-evidence.mjs`,
`docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`. Demonstrated by one bounded real R2 smoke Run
Bundle `.project/run-bundles/shadow-council-contemporaneous-quorum-evidence-v1-smoke/` (FINALIZED,
12 artifacts, `CONTEMPORANEOUS` proof); historical Run Bundles V3-V7 remain byte-unchanged and are
not repaired — historical absence remains historical evidence, and no retroactive proof is
permitted. ADR-0005, ADR-0006, the Decision Council kernel, `CouncilQuorumProof` semantics/schema,
the Decision Council schema, `shadow-council-vote-assessment.mjs`, and Authorization Binder
semantics are frozen/unmodified; no V1C implementation and no V8. The locally derived registry
entry is a DEVELOPMENT-TIME structural check only, not the future privileged `CouncilEpochRegistry`
trust anchor: future privileged `authledgerd` must independently compare `councilConfigHash` against
its own trusted registry. This provides durable proof-capable evidence only and grants no execution,
publication, merge, or autonomy authority.
Shadow Council V1A advisory CLI harness (three independently-spawned provider CLI child processes —
OpenAI/Anthropic/Google — acting as advisory-only council seats feeding the unmodified Decision
Council V1A kernel; no direct provider API/SDK integration): IMPLEMENTED and frozen — owner:
`docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`, `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`.
`ADR-0005`'s own `## Status` field is now **Accepted**, per the frozen real-exercise evidence
described in the ADR's own Acceptance note. All Shadow Council output remains advisory only and
grants no execution, publication, or merge authority.

Full semantic detail for every fact above lives in its owning artifact, and full checkpoint-by-
checkpoint history lives in "Frozen Steps / Checkpoints" below — neither is reproduced here.

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
  **Dependency B has since landed — see the "`ADR-0004` Dependency B" checkpoint below.** Dependency C
  has since been retired, not implemented, and Dependency D has since been implemented — see their
  respective checkpoints below. Adversarially reviewed by four independent read-only
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
  provenance) remained, at the time of this checkpoint, exactly as structurally disabled as before —
  they were never prerequisites for this Acceptance and were not enabled by it. **B has since landed,
  C has since been retired, and D has since been implemented — see their respective checkpoints
  below.** At the time of this checkpoint, no `MemoryContext`
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
  Dependency C has since been retired, not implemented, and Dependency D has since been
  implemented — see their respective checkpoints below. No MIHVER Brain adapter, retrieval
  runtime, or executable Producer implementation exists.
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
  - **What this did not do, at the time of this checkpoint**: Requirement Derivation was still
    **not** a `MemoryContext` consumer; Dependency C (`REQUIREMENT_SPEC.md` Requirement-Level-
    Inference premise) and Dependency D (`REQUIREMENT_SPEC.md` R-19 memory-informed-rationale
    provenance) remained unimplemented; no MIHVER Brain adapter or retrieval runtime existed. Full
    detail in `INTENT_SPEC.md`'s "Memory-Derived Inference Premises" section and
    `docs/contracts/MEMORY_CONTEXT.md`'s "Stage Consumption Authorization" section. **Dependency C
    has since been retired, not implemented, and Dependency D has since been implemented — see the
    "`ADR-0004` Dependency C" and "`ADR-0004` Dependency D" checkpoints below.** No MIHVER Brain
    adapter or retrieval runtime exists even now.
- **`ADR-0004` Dependency C — Retired After Re-Derivation.** A separate task
  (`M0-DEPENDENCY-C-REQUIREMENT-MEMORY-PREMISE`), performing the mandatory pre-implementation
  re-derivation Dependency C required, found its originally planned direct path —
  `MemoryContext → Requirement-Level Inference premise` — structurally incoherent against
  `REQUIREMENT_SPEC.md`'s own R-10/R-22 semantics, and stopped without implementing anything
  (verdict `DEPENDENCY_C_REDUNDANT_AFTER_B`). A follow-up task, `M0-DEPENDENCY-C-DISPOSITION`, plus
  its own narrow wording-closure round (`DEPENDENCY-C-DISPOSITION-SEMANTIC-CLOSURE`), formally
  recorded that retirement across the owning contracts. Merged via PR #24, squash commit
  `54ef91c181134487a50cb7b7c3d3ebeb66716b78`. **Dependency C was not implemented** — no new
  `MemoryContext` consumer, no new normative-strength source, no schema/runtime change. The full
  reasoning is authoritative in `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`'s
  "Post-Acceptance Dependency B/C Disposition" section, `docs/contracts/REQUIREMENT_SPEC.md`'s
  invariant R-23, and `docs/contracts/MEMORY_CONTEXT.md`'s "There is no third way, and none is
  coming" paragraph — not reproduced here.
  - **The canonical path for historical-user memory to affect a Requirement**: Category A
    historical-user `MemoryContext` → Intent Parsing / Dependency B → accepted current-run Inferred
    Claim → Requirement Derivation → existing R-03/R-10/R-22 authority. No second, direct citation
    of the underlying memory at the Requirement level is needed or authorized.
  - **At the time of this checkpoint, Requirement Derivation remained not authorized** to consume
    `MemoryContext` for `SEMANTIC_PREMISE` use — its `M0_SCOPE.md` `Input:` list was `IntentSpec`
    only. **It has since been separately, narrowly authorized as a third `MemoryContext` consumer,
    for a wholly different purpose (`DECISION_OPTION` only) — see the "`ADR-0004` Dependency D"
    checkpoint below.** Retiring C did not itself authorize, and is not the basis for, D's later
    authorization.
  - **At the time of this checkpoint, Dependency D was not retired** — a separate, later, narrower
    path of its own (`MemoryContext → DECISION_OPTION → an R-19-eligible working default →
    memory-informed rationale`), then unimplemented and unauthorized. **Its own prerequisite
    source-eligibility policy has since been settled (PR #26), and it has since been implemented
    (PR #27) — see the two checkpoints immediately below.** No MIHVER Brain adapter or runtime
    exists even now.
  - Contract suite at merged head: **83/83**.
- **`ADR-0004` `DECISION_OPTION` Historical-Source Gate Closure.** Settled, by explicit human
  decision, a prerequisite policy question for Dependency D: whether a `MemoryContext` entry
  classified as a historical user statement — Category A **or** Category B — may ever be eligible
  for `DECISION_OPTION` standing. Decision: **categorically never eligible**, either category.
  Merged via PR #26, squash commit `a16491d41d93f4edac9378b6184de071aa681f32`. Establishes two
  independent, both-required gates for any Dependency D `DECISION_OPTION` candidate: **Gate 1** —
  R-19 content eligibility (does Requirement Derivation already, independently own the fill
  decision); **Gate 2** — `MemoryContext` source eligibility (is the entry itself an eligible
  source at all). Historical-user semantics remain Intent Parsing-owned (Dependency B); Dependency
  D may not become a backdoor around Dependency B. A separately-recorded, non-historical
  technical/project outcome may still be `DECISION_OPTION`-eligible — Gate 2 excludes
  historical-user statements specifically, not every `MemoryContext` entry. Raw historical-user
  memory may never be relabeled or laundered to gain eligibility. The existing deterministic
  validator behavior (`tests/contracts/validate-contracts.mjs`) was already correct and preserved
  unchanged. Contract suite at merged head: **85/85**. **Dependency D itself was not implemented by
  this PR** — this closure settled source-eligibility policy only, ahead of D's own separate
  implementation.
- **`ADR-0004` Dependency D — Memory-Informed R-19 Working Defaults.** Amended
  `docs/foundation/M0_SCOPE.md` and `docs/contracts/REQUIREMENT_SPEC.md` (new invariant **R-24**).
  Merged via PR #27, squash commit `bb70a9ec92da1a17fbb4129f3c062626ecd00cd5`. **Dependency D is
  now IMPLEMENTED.**
  - **Requirement Derivation is now the third authorized `MemoryContext` consumer**, restricted to
    exactly the `DECISION_OPTION` influence tier. Current `MemoryContext` consumers:
    - Intent Parsing — `DISCOVERY_ATTENTION`, `SEMANTIC_PREMISE`
    - Research Planning — `DISCOVERY_ATTENTION`
    - Requirement Derivation — `DECISION_OPTION` only
  - **Canonical ordering:** accepted `IntentSpec` → an existing surviving Unknown → R-19
    eligibility / Gate 1 → optional `MemoryContext` → source eligibility / Gate 2 (PR #26 above) →
    `DECISION_OPTION` candidate → Requirement Derivation's own decision → `RequirementSpec`.
  - **Memory does not create R-19 authority; memory supplies zero independent authority.** If a
    value is adopted it remains: Requirement-Derivation-introduced (R-09) + an independent
    Requirement Derivation rationale + an additional memory-informed rationale citing the stable
    `(memory_context_id, entry_id)` identity (new invariant **R-24**).
  - R-19 unchanged; R-23 unchanged; Dependency C remains retired, unaffected. The historical A/B
    source-gate exclusion (PR #26 above) remains categorical and unweakened. `MemoryContext` is not
    Evidence. `MemoryContext` absence/unavailability is non-blocking — Requirement Derivation
    functions identically either way. `MemoryContext` is bound to the specific consumed
    `IntentSpec` version containing the surviving Unknown — never to `RequirementSpec`, which is
    this stage's own output.
  - **At the time of this checkpoint, no `RequirementSpec` schema existed yet; a schema has since
    been designed — see the "M0 Step 03B — RequirementSpec Schema" checkpoint below.** No MIHVER
    Brain adapter or runtime exists even now.
  - Contract suite at merged head: **85/85**.
- **M0 Step 03B — RequirementSpec Schema.** Created the first machine-readable JSON Schema
  (`schemas/m0/requirement-spec.schema.json`, JSON Schema Draft 2020-12) and deterministic validator
  integration (`tests/contracts/validate-contracts.mjs`) for the (still Proposed) `RequirementSpec`
  semantic contract, plus a dedicated `docs/contracts/REQUIREMENT_SPEC_SCHEMA_MAPPING.md` mapping
  every R-01–R-24 invariant to its enforcement layer. Preserves R-01 through R-24 exactly as
  previously defined — no semantic redesign; **a subsequent human-review-fixes round on the same PR
  explicitly authorized exactly one narrow `REQUIREMENT_SPEC.md` semantic clarification** (the R-22 ×
  mixed-strength Requirement premise question, below) — no other `RequirementSpec` semantics changed,
  and `REQUIREMENT_CASES.md`, `INTENT_SPEC.md`, `MEMORY_CONTEXT.md` remain unedited throughout.
  Extended the fixture harness with a backward-compatible multi-companion model (`fixture.companions`,
  resolved by stable artifact identity) alongside the existing singular `fixture.companion`, without
  rewriting any pre-existing fixture. Two re-derived representation decisions, both textually
  determined rather than invented: a "Failed" Requirement Derivation run produces no `RequirementSpec`
  artifact at all (mirroring `intent-spec.schema.json`'s identical "Failed parsing produces no
  IntentSpec" decision); and R-22 × mixed-strength Requirement — **final decision**, after the
  human-review-fixes round reconsidered an interim per-clause-premise draft this checkpoint originally
  described: the Requirement-Level-Inference premise unit remains exactly R-10's literal `{kind:
  "claim"}` or `{kind: "requirement", requirement_id}` (valid only when all its clauses share one
  strength); a mixed-strength Requirement is **not eligible, as a whole, to serve as a premise**, and
  no clause-level citation is authorized — `{kind: "requirement_clause", ...}` was removed from the
  schema. See `REQUIREMENT_SPEC.md`'s "Mixed-strength Requirement as premise (R-22 clarification)"
  paragraph. `ADR-0003`'s Status remains **Proposed**; this checkpoint does not change it — see
  `docs/contracts/REQUIREMENT_SPEC_SCHEMA_MAPPING.md`'s own "Status / Purpose" section and "Open
  Items" below for the separate, later human decision.
  - Contract suite at merged head: **170/170** (148 at this task's own initial completion — 85
    pre-existing plus 63 new `RequirementSpec` fixtures — plus 22 more added by the subsequent
    human-review-fixes round above).
- **Project Continuity V1A** — deterministic, zero-network, read-only, derived `ProjectContextPack`
  v1 for fast session-state reconstruction (`npm run context:pack`), plus two governance amendments
  to `docs/development/AGENT_POLICY.md` (mandatory Codex Implementer delegation above a fixed size
  threshold; unconditional independent Codex Verifier delegation). Merged via PR #34, squash commit
  `dbdb4f7049d2a73728038f1c98efc47ddfee3727`. Produced `docs/development/PROJECT_CONTINUITY.md`,
  `schemas/dev/project-context-pack.schema.json`, `scripts/dev/project-context-pack.mjs`,
  `scripts/dev/canonical-json.mjs`, `tests/dev/project-context-pack.test.mjs`; extended
  `docs/development/AGENT_POLICY.md`.
- **Project Continuity V1B** — deterministic, typed, auditable Run Bundle foundation, built on
  `ProjectContextPack` v1 as pure input: `TaskRecord`, `EvidenceManifest`, `RunManifest`, a
  deterministic bundle writer/compiler, and a human review report renderer. Merged via PR #36,
  squash commit `8fad9198460b80d28894a821feaa44df4e9b982f`. Full semantic/architectural detail is
  authoritative in `docs/development/RUN_BUNDLE.md` — not reproduced here.
- **Decision Council V1A — kernel + simulator.** First deterministic Decision Council foundation: a
  pure, non-LLM kernel (`scripts/dev/decision-council-kernel.mjs`) plus a deterministic fake-agent
  simulator (`scripts/dev/decision-council-simulator.mjs`) proving the council protocol (Rotating
  Proposer + Two Independent Reviewers + Exact-Candidate Quorum) defined in the new
  `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`, with its schema at
  `schemas/dev/decision-council.schema.json`. Merged via PR #38, squash commit
  `2e9a0e88ad8b74bc11afc0fcac8db704f74690d0`. **Foundation-only**: no real LLM/provider/MCP/tool/
  shell/Publication Broker connection, no Shadow Council, no execution gateway — defines and proves
  the protocol only. **`ADR-0005`'s own `## Status` field remains Proposed as merged** — this
  checkpoint does not change it; full semantic/architectural detail is authoritative in
  `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md` itself, not reproduced here. No follow-on task —
  Shadow Council or otherwise — is recommended or authorized by this checkpoint.
- **Shadow Council V1A — advisory CLI harness.** A real, provider-CLI-backed Shadow Council
  (`codex`/`claude`/`agy` as three independently-spawned council seats) feeding the frozen,
  unmodified Decision Council V1A kernel, with no direct provider API/SDK/HTTP integration. Merged
  via PR #41, squash commit `45077da5300bc56492e26f041fb88583dd5f0085`. Authoritative pointers:
  `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md` (exercise record) and the finalized Run Bundle
  under `.project/run-bundles/shadow-council-v1a-cli-harness-remediated/`, both merged by PR #41.
  **`ADR-0005`'s own `## Status` field remains Proposed as merged** — this checkpoint does not
  change it. All Shadow Council output is advisory only: no `DecisionRecord` produced by it grants
  or implies execution, publication, merge, or autonomous task-transition authority. No follow-on
  task — ADR-0005 acceptance or execution integration — is recommended or authorized by this
  checkpoint.
- **ADR-0005 Acceptance.** `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`'s own `## Status` field
  moved **Proposed → Accepted** after its own seven-item Acceptance Gate was independently
  re-evaluated against frozen `main` evidence and found fully satisfied. Frozen evidence basis:
  Decision Council V1A kernel/simulator (PR #38, freeze PR #39), the Acceptance Gate definition
  itself (PR #40), the real Shadow Council V1A evidence (PR #41, squash commit
  `45077da5300bc56492e26f041fb88583dd5f0085`), and the Shadow Council V1A freeze (PR #42, squash
  commit `f0fa9acddabc59de9e7ed6301496dc233e470d67`). The ADR's own "Acceptance note" is the
  semantic authority for this Acceptance — full criteria detail is not reproduced here. Acceptance
  validates the Decision Council protocol foundation only: it does **not** authorize execution
  integration, bounded autonomy, Publication Broker activation, any council→tool/action path, or
  any new implementation capability — all remain separate, explicitly human-authorized future work.

- **ADR-0006 — Decision Authorization Boundary (V1A Design).** Design-only ADR (`Status: Proposed`)
  defining an `AuthorizationEnvelope`/`AuthorizationGrant` boundary between an Accepted ADR-0005
  `DecisionRecord` and any hypothetical future Execution Gateway — a deterministic policy-evaluation
  algorithm, replay/staleness/STOP-fencing semantics, and exact-bound human-approval binding for R3,
  with a global `stopEpoch` kill-switch concept this ADR is the first to own. No code, schema file, or
  executor exists; ADR-0005 and its kernel/simulator/schema/Shadow Council evidence remain
  byte-identical and unmodified. Grants no execution, publication, bounded-autonomy, or Claude/Codex
  action authority of any kind. See the ADR's own Non-Goals and Staged Implementation Plan (V1B/V1C/
  V1D, each separately authorized) for what remains explicitly unauthorized.

## Open Items

- `ADR-0003` (Requirement Derivation Model) Status is **Proposed**, not Accepted, on `main` as
  merged via PR #13. Mirroring `ADR-0002`'s own precedent, moving it to Accepted requires its own
  future condition — see its own "Future Work" section for the actual condition, not restated here to
  avoid drift: schema design work, plus an adversarial review pass against real cases. **The M0 Step
  03B checkpoint above (schema design plus its own adversarial review) is an observation relevant to
  that condition, not itself the acceptance decision** — `ADR-0003`'s own acceptance remains a later,
  separate, explicit human decision under its own stated criteria. No task in this session has been
  authorized to change `ADR-0003`'s Status.

## Next Authorized Action

None automatically. Per `REVIEW_PROTOCOL.md`'s Completion Checklist rule "Stop before the next
task," completing a task is not authorization to start the next one. In particular: moving
`ADR-0003` to Accepted, implementing Research Planning, and performing any `mihver-brain` or runtime
memory-integration work are all **not** authorized by any checkpoint recorded above — each requires
its own separate, explicit human task instruction, given later. **M0 Step 03B is now DONE** (see the
checkpoint above) — its completion does not, by itself, authorize the next task.

The `MIHVER-ORCHESTRATOR-DELEGATION-FIREWALL-V1` prerequisite chain is complete: PR #59 merged at
main SHA `7d4ff0b2be4d33d180429ea827b8aebd113d100b`; merge-post CI, Project validation, and Publication
Broker succeeded; human installation completed with status `INSTALLED`; and the real enforcement
smoke passed. Therefore `ORCHESTRATOR_FIREWALL_V1_OPERATIONAL = true` and
`V9_PREREQUISITES_FIREWALL = SATISFIED`.

**V9 remains unstarted and is not authorized by this closure.** The next architectural action may
be `V9_NEW_R3_ARCHITECTURE_DECISION`, but it requires a separate, explicit human task instruction.
No V9 DecisionRequest or Council-provider invocation is authorized. Firewall operational status is
limited to the cooperative-agent orchestration guardrail: it does not provide malicious-same-user
protection or OS privilege separation, activate an Execution Gateway, authorize V1C, or constitute
R3 human approval; the documented V1 limitations remain.

This reconciliation performed no semantic redesign, changed no ADR status, and started no new work.
See [CURRENT_TASK.md](./CURRENT_TASK.md) for whatever task is active on the currently checked-out
branch, if any.

**Project Continuity V1A is frozen** (see the checkpoint above, PR #34, squash commit
`dbdb4f7049d2a73728038f1c98efc47ddfee3727`), **Project Continuity V1B is frozen** (see the
checkpoint above, PR #36, squash commit `8fad9198460b80d28894a821feaa44df4e9b982f`),
**Decision Council V1A (kernel + simulator) is frozen** (see the checkpoint above, PR #38, squash
commit `2e9a0e88ad8b74bc11afc0fcac8db704f74690d0`), **Shadow Council V1A (advisory CLI harness) is
frozen** (see the checkpoint above, PR #41, squash commit
`45077da5300bc56492e26f041fb88583dd5f0085`), and **`ADR-0005` is now Accepted** (see the "ADR-0005
Acceptance" checkpoint below). None of this automatically authorizes anything further. No
follow-on task — V1C, execution integration, autonomous task selection/execution, or Publication
Broker provisioning/activation included — is recommended or authorized by any of these
checkpoints; any follow-on task requires its own separate, explicit human authorization, exactly
like every other next-task pointer in this section.
