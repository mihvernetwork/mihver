# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

authorization-ledger-v1c-r3-architecture-v8-failure-closure

## Objective

Persist the already-terminal V8 R3 architecture attempt exactly as **historical failure evidence**.
The V8 Council attempt reached a terminal blocked state before any voter was invoked; this task
records that state and its cause. It runs no Council, invokes no provider, freezes no candidate,
repairs no gate, and creates no V9.

## Branch / Base

Branch: `decision/authorization-ledger-v1c-r3-architecture-v8`
Base: `main` at `245957deab85b3a147ad3b8f38c7645628e30059` (PR #56 merged; merge-post CI on this
exact SHA: SUCCESS)

## Scope / non-goals

Risk class: R3 attempt, terminated pre-vote. Authoritative classification:

- **`COUNCIL_EVIDENCE_BLOCKER`** (task-level outcome)
- proximate cause: **`CANDIDATE_CONSTRUCTION_BLOCKER`** (local mechanical gate)

**This was NOT `NO_QUORUM`. This was NOT a Council rejection.** No `CandidateDecision` was frozen,
**no frozen (non-null) `candidateHash` exists for V8**, and no voter was invoked. Precisely: the only
`candidateHash` *field* anywhere in the bundle is the failure artifact's `"candidateHash": null`; the
other occurrences are ordinary text inside the proposer packet's evidence strings and inside the
attestation `text`. No V8 candidate hash value was ever computed into a persisted artifact. The
proposer invocation itself succeeded; the local post-proposal / pre-`FREEZE_CANDIDATE` mechanical
gate falsely rejected an otherwise semantically complete proposal.

Exact preserved facts:

| Fact | Value |
| --- | --- |
| `decisionRequestId` / `taskId` | `authorization-ledger-v1c-r3-arch-decision-8` |
| `councilEpochId` | `authorization-ledger-v1c-r3-arch-decision-8-epoch-1` |
| `rotationOrdinal` | `7` (fixed before any provider call) |
| Kernel-derived proposer | `seat-anthropic` (`seats[7 % 3]`, canonical order `seat-openai`, `seat-anthropic`, `seat-google`) |
| Pre-provider packet gate | **PASS** |
| Post-proposal / pre-vote construction gate | **FAIL** |
| Failure stage | `KERNEL_EVENT` (`eventType` `FREEZE_CANDIDATE`) |
| Failure code | `CANDIDATE_CONSTRUCTION_BLOCKER` |
| Voter calls | **0** |
| `DecisionRecord` | **ABSENT** |
| `CouncilQuorumProof` | **ABSENT** |
| Run Bundle status | **`OPEN`** |
| Artifact count | **5** |

No retry. No second candidate. No implementation. No execution authority. No publication authority.
No human approval.

### False-positive gate finding

The five reported construction failures were determined to be **gate-definition defects, not
substantive proposal omissions**. **Provenance caveat:** the persisted `ShadowSeatInvocationFailure`
records only `errorCode CANDIDATE_CONSTRUCTION_BLOCKER` and `details {"eventType":
"FREEZE_CANDIDATE"}`. The five specific diagnostics below came from the throwaway, uncommitted
driver's gate output, and the judgement that each was a false positive came from reading the
recovered proposer text in `ShadowSeatAttestation.text`. **Neither the five diagnostics nor the
false-positive judgement is independently provable from the persisted bundle bytes alone**; they are
recorded here as the orchestrator's finding, not as bundle-proved fact.

The gate required certain semantics to appear under specific nested candidate fields after the
packet requirements had been shortened and reorganized to fit the packet-size bound (`shadow-council-packet.mjs`: ≤ 20 evidence items of ≤ 1000 chars,
`decisionQuestion` ≤ 2000 chars). Known false-negative classes:

1. The server-derived `authenticatedApproverUid` requirement existed elsewhere in the proposal, but
   the gate demanded it under `grantIssuanceRequest`.
2. The server-derived `grantHash` requirement existed elsewhere, but the gate demanded it under
   `grantIssuanceRequest`.
3. The server-derived grant `state` requirement existed elsewhere, but the gate demanded it under
   `grantIssuanceRequest`.
4. `IDEMPOTENCY_KEY_REUSE` semantics were required by the architecture, but the gate depended on a
   literal/location that was removed while shrinking the packet requirements.
5. The UID policy correctly rejected `"unknown or extra top-level fields"`, but the gate's accepted
   wording set failed to recognize that equivalent exact security semantic.

**The recovered proposal is NOT promoted to normative architecture.** It may be described only as
`UNFROZEN_PROPOSAL` / `PROPOSAL_CONTENT_NOT_ADMITTED_AS_CANDIDATE`. It survives only inside the
persisted `ShadowSeatAttestation.text`; no `proposalContent` wrapper and no `CandidateDecision` were
persisted, consistent with failure at `FREEZE_CANDIDATE`.

Unchanged by this task: every byte already written inside the V8 Run Bundle, ADR-0005, ADR-0006, the
Decision Council kernel, `CouncilQuorumProof` semantics/schema, every other schema, every script, and
historical Run Bundles V3–V7 and the PR #56 smoke bundle. The throwaway V8 driver and gate modules
were scratchpad-only and are deliberately not committed.

## Required Context

- `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v8/`
- `.project/REVIEW_STATE.md`
- `.project/DECISIONS_LOG.md`
- `.project/PROJECT_STATE.md`
- `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`
- `docs/development/AGENT_POLICY.md`
- `docs/development/REVIEW_PROTOCOL.md`

## Status

**V8 attempt terminal and closed as failure evidence; human approval PENDING — not requested, not
granted.** The V8 Run Bundle is `OPEN` with 5 artifacts and `manifestHash`
`sha256:5737aae3d3f8cd8cd20d90d2e817bcd1e8b718b79ac6665490dfcece679edf60`.

Durable pre-provider evidence exists and verifies: the exact `DecisionRequest`
(`contentHash sha256:dae00b861995399becaf56d793e463a8b73f0efa600b1be23ac16372097dbebb`,
`contextHash sha256:2c707d7f5846a883402e9191bb06849db66544f3c748c5e6307b1c7ea47db156`) and the exact
`CouncilConfig` (`contentHash sha256:193fc861ba8ef9f1102705f8a69007c2c9fae83117d3da301d489379ad21c8a7`,
`councilConfigHash sha256:b6f7b1d3b700f6d90e7a37c83a3226e7bdee2f8de399a790105cff0a70d371bf`) were
written and manifest-bound before the first provider process, and the persisted config byte-matches
canonical `buildShadowCouncilConfig` — no seat, provider, `modelFamily` or `modelId` substitution.
Exactly one proposer packet (`packetHash
sha256:534a9c79b5f3c579ea7403afdfeb1f4c5742bbb1609f45bf7b690fb23f10252a`), exactly one admitted
`seat-anthropic` attestation, and exactly one `ShadowSeatInvocationFailure`
(`failureHash sha256:d7719444beacb5e39eb88ef51335b8366cd8d51ca926ebe0d4674a11fdd19200`) are durable.
Zero voter packets, zero assessments, zero `DecisionRecord`, zero `CouncilQuorumProof`.

Primary next action: **`CANDIDATE_GATE_RELIABILITY_REPAIR_REQUIRED`**. The tooling defect must be
fixed before another R3 attempt, so `NEW_R3_CANDIDATE_REQUIRED` is explicitly **not** the immediate
next action.
