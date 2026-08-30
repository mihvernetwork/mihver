# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

authorization-ledger-v1c-r3-arch-decision-7

## Objective

Real 3-seat Shadow Council R3 architecture decision (V7) for the V1C privileged Authorization
Ledger, human-admin `AuthorizationGrant` path, trusted Council/evidence import boundary, and the
persistent global `stopEpoch` register. V7 is a **narrow successor to V6, not a redesign**: V6's
substantive architecture passed on the merits and must be preserved unchanged. V6 failed R3 quorum
for exactly one reason — its mandatory `yesNoMatrix` answered 15 of the 17 required questions,
collapsing the distinct Claude and Codex questions into shared keys. V7's sole required material
revision is therefore an exact **17-of-17 independently represented** mandatory yes/no matrix, a new
`candidateHash`, and a new Council decision. This is a Council decision + durable evidence task
only — **no V1C implementation is authorized**.

## Branch / Base

Branch: `decision/authorization-ledger-v1c-r3-architecture-v7`
Base: `main` at `2e42febe088e5e6bdff61431cd964dd2a3f2fcd8` (PR #54 merged: record v1c r3
architecture decision v6; merge-post CI SUCCESS for this exact SHA — `Publication Broker` and
`Project validation` both `success`)

## Status

**Bootstrap:** verified `main @ 2e42feb`, `origin/main` at the same SHA, working tree clean, PR #54
merged at exactly this commit with both merge-post checks SUCCESS. Branch created at that exact
commit.

**Proposer rotation:** `rotationOrdinal = 6` (task-local deterministic rule: architecture decision
version N → `rotationOrdinal = N - 1`; V7 → 6), fixed as a caller-controlled `DecisionRequest`
parameter *before* any provider invocation. No seat was hard-coded or hand-selected: the frozen
ADR-0005 kernel computed `expectedProposerSeatId = CouncilConfig.seats[6 % 3].seatId`. CouncilConfig
seat ordering is `[0] seat-openai, [1] seat-anthropic, [2] seat-google`, so the kernel-derived
proposer is **`seat-openai`**. No durable cross-run rotation state is claimed to exist — the V5
audit established that it does not, and no rotation registry was changed.

**Two mechanical matrix gates, both ahead of any vote.** The V6 failure was a *candidate
construction* failure, so V7 gated it mechanically rather than by inspection:

1. **Pre-provider gate** — before the proposer CLI was invoked at all, the driver asserted that each
   of the 17 canonical questions appears in the constructed decision question/evidence set exactly
   once. Result: **17/17 PASS**. Had it failed, the run would have stopped with
   `CANDIDATE_CONSTRUCTION_BLOCKER` without consuming any provider budget.
2. **Post-freeze, pre-vote gate** — interposed on the kernel's `FREEZE_CANDIDATE` transition through
   the harness's existing `applyEventImpl` seam, so it runs *after* the candidate is frozen and
   *before* the first voter packet is built. It checks: `yesNoMatrix` is an array of exactly 17
   entries; ids `Q01`..`Q17` each used exactly once; each entry has exactly `id`/`question`/`answer`;
   each `question` matches the required text verbatim (whitespace/case normalization only, no fuzzy
   matching); all 17 question strings pairwise distinct; all 17 answers exactly `NO`. Result:
   **PASS**. Had it failed, the harness would have written a durable `ShadowSeatInvocationFailure`
   artifact and stopped with zero voter invocations.

The frozen candidate was never edited, repaired, re-prompted, or regenerated.

**Council exercise:** ran the real 3-seat Shadow Council harness
(`scripts/dev/shadow-council-run-bundle-evidence.mjs`, PR #47/#48/#51/#53 lineage) against exactly
one frozen new candidate. Real subprocess invocations of the installed `codex`, `claude`, and `agy`
CLIs produced the proposal and all three votes — 4 real calls, zero retries, zero provider or model
substitution, zero response repair, no second candidate.

- `contextHash`: `sha256:7999f772b587226da8637577de934985076bd4404a90c5aa17ce90685c4f1452`
- `repositoryHead`: `2e42febe088e5e6bdff61431cd964dd2a3f2fcd8`
- `councilEpochId`: `authorization-ledger-v1c-r3-arch-decision-7-epoch-1`
- `candidateHash`: `sha256:c072d9969bede46ebfd3ab336d50ef97065a4ff08c6f17f42fe062c74671f0f8`
  (distinct from V6's `sha256:c5d16bea...2fafb90` and V5's `sha256:9bc6b4c3...1805a063`, both
  permanently closed)

**Material difference from V6:** the architecture is deliberately the same. The frozen candidate
reproduces V6's accepted design — dedicated `authledgerd` daemon and `mihver-ledger` OS identity,
separate ADMIN/CLIENT Unix-domain sockets with permissions as reachability only, `SO_PEERCRED` UID
as authenticated identity, root-owned exact-UID allowlist as authorization, privileged SQLite/WAL
state, trusted `CouncilEpochRegistry` with canonical evidence import and re-validation, safe-integer
`stopEpoch` domain `0..9007199254740991` with SQLite `INTEGER` `CHECK` and `STOP_EPOCH_EXHAUSTED` at
the maximum, durable `admin_operation_journal` uniquely keyed
`(authenticatedPeerUid, operationKind, adminOperationId)`, domain-separated `requestHash`
(`MIHVER/AUTHLEDGERD/ADMIN/INCREMENT_STOP_EPOCH/REQUEST/V1C\0`) binding peer UID + operation kind +
`adminOperationId` + `expectedStopEpoch`, one `BEGIN IMMEDIATE` commit boundary covering the epoch
write, journal insert and audit append, expected-epoch CAS, exact-bound R3 `AuthorizationGrant`,
dormant consume-once state, Publication Broker structurally separate, no Execution Gateway. Both
required lost-ack traces are discharged (same-ID retry replays the stored `N+1` with no second
mutation and no second audit mutation event; a new operation ID carrying a stale
`expectedStopEpoch = N` fails closed with `STALE_EXPECTED_STOP_EPOCH`); neither path reaches `N+2`;
same-ID/different-request fails closed with `IDEMPOTENCY_KEY_REUSE`. Operation-result lookup is
Option A — an ADMIN-socket, `SO_PEERCRED`-scoped, strictly read-only
`getAdminOperationResult(operationKind, adminOperationId)`. The **only** material change from V6 is
the 17/17 uncollapsed `yesNoMatrix` and the resulting new `candidateHash`.

**Votes: 3/3 APPROVE** (`seat-openai`, `seat-anthropic`, `seat-google`). R3 requires exactly 3/3, so
the frozen kernel returned `DECIDED` / `HUMAN_APPROVAL_REQUIRED`, `reasonCode R3_QUORUM_MET`,
`quorumDetail {ruleset: R3, approvals: 3}`,
`recordHash sha256:d16ae65b429648dd9e016bdb417895a881a12e2226c5c20f164a238f9c81bb21`.

**Evidence:** Run Bundle `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v7/`,
`status FINALIZED`, `manifestHash sha256:0b48c8b7...e6de`, 12 artifacts (4 packets, 4 attestations,
3 vote assessments, 1 terminal `DecisionRecord`; zero invocation failures, zero rejected
attestations). The terminal `DecisionRecord` was durably persisted and `EvidenceManifest`-bound
*before* `FINALIZED`.

**Fresh Verifier** (`mcp__codex__codex`, read-only, independent, thread
`01a0545e-ad5f-7cb2-8135-61ef2fd3cb15`): **`DECISION_EVIDENCE_VALID`**, 18/18 criteria A–R PASS.

**Outcome: `COUNCIL_APPROVED_PENDING_HUMAN_R3_AUTHORIZATION`.**

## Human action required next

Council approval — even 3/3 — grants **zero** implementation, execution, or publication authority.
Inspect the durably persisted terminal `DecisionRecord`, the 17-entry `yesNoMatrix` in the frozen
candidate, and the per-seat rationale evidence. A **fresh human pre-authorization audit of the exact
`candidateHash sha256:c072d996...f0f8`** is mandatory before any V1C implementation task may be
separately and explicitly authorized. Remote publication (push/PR/merge) remains human manual
fallback only. V1D remains a separate future ADR/task/risk gate.

## Required Context

- `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v7/` (this task's own evidence —
  read directly)
- `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v6/` (historical V6 evidence,
  frozen and not modified by this task)
- `.project/REVIEW_STATE.md` (V6 `NO_QUORUM` outcome and the 15-of-17 matrix finding V7 answers)
- `docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md` (frozen/unmodified, `Status: Proposed`)
- `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md` (harness exercise record)
- `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
