# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

shadow-council-contemporaneous-quorum-evidence-v1

## Objective

Repair the **FORWARD-ONLY** Shadow Council evidence pipeline so every future real R1/R2/R3 terminal
run produces a legitimate `CONTEMPORANEOUS` `CouncilQuorumProof` from durable evidence.

## Branch / Base

Branch: `fix/shadow-council-contemporaneous-quorum-evidence-v1`
Base: `main` at `3b1ec8f30b2e85b3f07e8cfb2b1274038e02c96b` (PR #55 merged; merge-post CI on this
exact SHA: SUCCESS)

## Scope / non-goals

Risk class: R2 (evidence/provenance contract hardening). Real seat adapters carry authoritative
`modelFamily` metadata; their ordered identity is frozen by
`SHADOW_COUNCIL_SEAT_ORDER = ["seat-openai","seat-anthropic","seat-google"]`, and
`buildShadowCouncilConfig(councilEpochId)` is the canonical builder. `modelFamily` is never derived
heuristically from `modelId` text.

The evidence writer fails closed on a canonical-config mismatch before provider budget is spent;
writes and binds the exact `DecisionRequest` and `CouncilConfig` before the first provider process;
and, at terminal time, persists the `DecisionRecord`, re-reads the request/config/record/every
`ShadowVoteAssessment` from disk, derives votes through frozen `deriveAgentVote` in persisted seat
order, builds and verifies the proof, then persists it before `FINALIZED`. New evidence identities:
`shadow-decision-request:<decisionRequestId>:<contentHash>`,
`shadow-council-config:<councilConfigHash>`, and `shadow-council-quorum-proof:<proofHash>`.
New failure codes: `SHADOW_COUNCIL_CONFIG_MISMATCH`, `SHADOW_COUNCIL_SEAT_ORDER_DRIFT`,
`COUNCIL_EPOCH_ID_REQUIRED`, `DURABLE_ASSESSMENT_HASH_INVALID`, `DURABLE_VOTE_SEAT_UNKNOWN`,
`DURABLE_VOTES_MISMATCH`, `DURABLE_COUNCIL_CONFIG_INVALID`,
`DURABLE_QUORUM_PROOF_BUILD_FAILED`, and `DURABLE_QUORUM_PROOF_VERIFICATION_FAILED`. The three
shadow-council evidence suites are now npm-scripted and run in CI's project-validation job;
`docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md` records the forward invariant.

Unchanged: ADR-0005, ADR-0006, the Decision Council kernel
(`scripts/dev/decision-council-kernel.mjs`), `CouncilQuorumProof` semantics/schema
(`scripts/dev/council-quorum-proof.mjs`, `schemas/dev/council-quorum-proof.schema.json`),
`schemas/dev/decision-council.schema.json`, `scripts/dev/shadow-council-vote-assessment.mjs`, and
Authorization Binder semantics. No V1C implementation. No V8. Historical Run Bundles V3-V7 are
byte-unchanged and are not repaired: historical absence remains historical evidence, and no
retroactive `CONTEMPORANEOUS` proof is permitted.

The registry entry derived locally from persisted `CouncilConfig` is a DEVELOPMENT-TIME structural
check only, not the future privileged `CouncilEpochRegistry` trust anchor. Production trust remains
with future privileged `authledgerd`, which must independently compare `councilConfigHash` against
its own trusted registry. This task supplies durable proof-capable evidence; it establishes no
production trust and grants no execution, publication, merge, or autonomy authority.

## Required Context

- `.project/run-bundles/shadow-council-contemporaneous-quorum-evidence-v1-smoke/` (FINALIZED and
  immutable smoke evidence; 12 artifacts; `manifestHash`
  `sha256:b0a8ba3faa6bd6124b49aa7a551f57b73b71e0f9baca0e7c148e129f24481e1f`)
- `scripts/dev/shadow-council-cli-transport.mjs`
- `scripts/dev/shadow-council-run-bundle-evidence.mjs`
- `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`
- `.project/REVIEW_STATE.md`, `.project/PROJECT_STATE.md`
- `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`

## Status

**Implementation and deterministic validation complete; human approval PENDING — not requested,
not granted.** One bounded real R2 exercise, no retry or provider/model substitution, produced
FINALIZED Run Bundle `shadow-council-contemporaneous-quorum-evidence-v1-smoke`:
`DECIDED` / `COUNCIL_APPROVED`, `R2_QUORUM_MET`, 2/2 reviewer approvals (`seat-anthropic` and
`seat-google` APPROVE), proposer `seat-openai` correctly excluded, `recordHash`
`sha256:c4b6eca41c3d22505ebfdd41895952b7e4868a3e0a2b2c9e2cfa8a0a8caec61e`,
`councilConfigHash sha256:be89b567427f125087168184bcaebf07f04ac361479bd5e2c11d71bea26229ce`, and
`proofHash sha256:6c69f74e41c65b2e315151c44e15e56deb473fa9a1d9b504b0bef43cc98bda88`
with `provenanceClass CONTEMPORANEOUS`.

All three provider invocations succeeded on the first and only Council attempt; the pipeline built,
verified, and persisted the `DecisionRecord` and proof. The initial ad-hoc smoke driver then failed
only at its final step with `RUN_BUNDLE_FINALIZE_FAILED:FINALIZED_AT_REQUIRED`, because it omitted
the required `finalizedAt` option. That throwaway-driver defect was not an evidence-pipeline or
provider/Council failure. The same bundle was finalized with no new evidence and no new provider
invocation; no second smoke was run.

Independent verification from finalized bytes alone re-verified every artifact content hash,
rebuilt the proof from disk-only sources with an exact persisted `proofHash` match, recomputed the
proof/config/record hashes and proposer from persisted rotation/order, confirmed
`authorizationEvidenceEligible === true`, and confirmed the persisted `DecisionRecord` contains no
proof or `proofHash` reference. This grants no execution or publication authority.
