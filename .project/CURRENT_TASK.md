# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

authorization-ledger-v1c-v7-preauth-closure

## Objective

Persist the completed **human pre-authorization audit** of the exact V7 candidate so that no future
session can read V7's 3/3 Council approval as implementation authorization. These are **two
separate gates**, and only the first one passed:

| Gate | Result |
| --- | --- |
| Council (R3 quorum) | **`COUNCIL_APPROVED_PENDING_HUMAN_R3_AUTHORIZATION`** — 3/3 APPROVE, `DECIDED` / `HUMAN_APPROVAL_REQUIRED`, `reasonCode R3_QUORUM_MET` |
| Human R3 pre-authorization audit | **`HUMAN_R3_PREAUTH_NOT_READY`** — 2 material architecture blockers + 1 evidence blocker |

**V7 is not Council-rejected.** The Council decision is valid, durable and unchallenged. The
candidate nonetheless cannot proceed to implementation, because the pre-authorization audit found
that a fresh implementation team could not implement V1C exactly from it without inventing new R3
security decisions.

**CandidateDisposition: `SUPERSEDED_PENDING_MATERIAL_REVISION`.**

State/evidence closure only. No Council rerun, no provider invocation, no evidence reconstruction,
no V1C implementation, no V8, no human approval, no push, no PR. The finalized V7 Run Bundle and the
frozen V7 candidate are **not** modified by this task.

The originating decision task (`authorization-ledger-v1c-r3-arch-decision-7`) is recorded below and
in `DECISIONS_LOG.md`; its facts are preserved unchanged.

## Branch / Base

Branch: `decision/authorization-ledger-v1c-r3-architecture-v7`
Base: `main` at `2e42febe088e5e6bdff61431cd964dd2a3f2fcd8` (PR #54 merged: record v1c r3
architecture decision v6; merge-post CI SUCCESS for this exact SHA — `Publication Broker` and
`Project validation` both `success`)

## Status

**Closed at both gates: Council `COUNCIL_APPROVED_PENDING_HUMAN_R3_AUTHORIZATION`, human
pre-authorization `HUMAN_R3_PREAUTH_NOT_READY`. `SUPERSEDED_PENDING_MATERIAL_REVISION`. No V1C
implementation is authorized.** The V7 Council run is recorded first below, unchanged; the
pre-authorization audit result follows it.

### Originating Council decision (`authorization-ledger-v1c-r3-arch-decision-7`)

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

**Council outcome: `COUNCIL_APPROVED_PENDING_HUMAN_R3_AUTHORIZATION`.**

---

## Human pre-authorization audit (second gate) — `HUMAN_R3_PREAUTH_NOT_READY`

Strict read-only pre-authorization audit of the exact
`candidateHash sha256:c072d9969bede46ebfd3ab336d50ef97065a4ff08c6f17f42fe062c74671f0f8`. Base state
re-verified mechanically (branch, `HEAD 86fad34`, merge-base `2e42feb`, `origin/main` at the same
SHA, clean tree, PR #54 merged at exactly `2e42feb` with both merge-post checks `success`).
`candidateHash`, `recordHash` and the Run Bundle `manifestHash` were each **independently
recomputed** from persisted bytes through the frozen ADR-0005 kernel path — never read from a
report. Two fresh read-only Codex auditors were used (`sandbox: read-only`): Auditor A
(architecture / exact implementability) thread `01a0546d-d99a-73a2-b776-8323c790f840`, Auditor B
(identity / trust / human authorization) thread `01a0546f-d77e-7863-a91c-3a31f4aeb70c`. The
decision/evidence chain was verified mechanically by Claude; no third auditor was needed and **no
voting provider was invoked**.

**Verdict: `HUMAN_R3_PREAUTH_NOT_READY`. Primary next action: `NEW_R3_CANDIDATE_REQUIRED`.**

The evidence chain is sound. V7 fails on **exact implementability** — three blockers:

**1. UID policy trust root — `MATERIAL_ARCHITECTURE_BLOCKER`.** The candidate establishes the
desired invariant (root-owned, non-model-writable, ownership/mode/format validated, fail-closed,
CLIENT socket cannot replace it, Claude/Codex cannot edit it) but does not fix the complete runtime
trust-root contract. A successor candidate must define at minimum: absolute policy path; trusted
parent-directory chain; exact acceptable owner UID/GID; exact acceptable file/directory modes;
no-symlink resolution; hard-link policy; fail-closed ownership/mode/path validation; and no
model-writable ancestor capable of replacement. A root-owned file reached through a model-writable
parent is replaceable, so choosing the trust-root location and its resolution rules is itself a
security decision.

**2. `AuthorizationGrant` — `MATERIAL_ARCHITECTURE_BLOCKER`.** V7 binds the important authorization
fields but leaves new R3 security choices to an implementation team. A successor candidate must fix
at minimum: `grantId` generation authority; `grantId` format/entropy; uniqueness; issuance
idempotency across retry/lost ACK; the exact meaning of `issuanceIdentity`; whether V1C supports
expiry, and its exact semantics if so; whether V1C supports revocation, and its exact
authority/state/atomicity if so; the canonical grant identity/hash decision; whether signatures
exist; the exact covered fields/domain of any canonical grant hash; and grant-issuance request
identity / `requestHash` / journal semantics. **No wording such as "where supported" may defer an R3
capability decision.** (V7's `exactBindings` uses exactly that phrasing for both expiry and
revocation; its `requestHash` domain separator is also scoped to `INCREMENT_STOP_EPOCH` only, so
grant-issuance request binding and journaling are not fixed.)

**3. `CouncilQuorumProof` — `EVIDENCE_BLOCKER`.** The V7 `DecisionRecord` is durable and valid, and
**no** `CouncilQuorumProof` is required for the human R3 approval gate itself. However
`scripts/dev/authorization-binder.mjs` later requires a valid, eligible `CouncilQuorumProof` for
R1/R2/R3 authorization evidence, and the V7 bundle **cannot legitimately construct one**: the
contemporaneous run did not durably persist all required source inputs — the exact `DecisionRequest`
including `rotationOrdinal`, the exact `CouncilConfig`, its exact seat order, and `modelFamily` per
seat. (`rotationOrdinal = 6` and the seat order are narrated in task-local prose here and in
`REVIEW_STATE.md`, but narration in a model-writable state file is not durable run-bundle evidence;
`modelFamily` has no source at all — `SEAT_ADAPTERS` in `scripts/dev/shadow-council-cli-transport.mjs`
defines only `{provider, cli, model}`, and the only real-seat `modelFamily` values in the repository
are test fixtures.) `buildCouncilQuorumProof` hardcodes `provenanceClass: "CONTEMPORANEOUS"` and the
verifier rejects anything else, so building a proof now from invented facts would **manufacture
provenance rather than verify it**.

**These values MUST NOT be reconstructed retroactively for V7. Do not manufacture a
`CONTEMPORANEOUS` proof after the run. Forward repair is required before the next R3 architecture
run, and must not alter or repair historical V7 evidence.**

### Axes that passed (non-blocking / clear)

`MATRIX_CONTRACT_CLEAR` (exact 17/17 — count 17, `Q01`..`Q17` each exactly once, 17 pairwise
distinct questions, all answers exactly `NO`, no Claude/Codex collapse, no alias substitution) ·
`STOPEPOCH_DOMAIN_CLEAR` · `STOPEPOCH_IDEMPOTENCY_SATISFIED` (all six traces discharged from the
exact candidate text) · `ADMIN_JOURNAL_CLEAR` · `ADMIN_RESULT_LOOKUP_CLEAR` ·
`CONSUME_ONCE_IMPLEMENTATION_DETAIL_ONLY` (the duplicate-replay result is already canonically
defined as `DENY`/`REPLAY_REJECTED` in `authorization-ledger-result.schema.json`, the simulator and
ADR-0006; the unnamed field is a column name over fixed semantics, and the surface is dormant in
V1C) · `UID_AUTH_CLEAR` · `COUNCIL_TRUST_CLEAR` · `HUMAN_APPROVAL_BINDING_CLEAR` (proven:
human-readable approval text alone ≠ privileged authorization) · `ZERO_EFFECT_CONSUMER_CLEAR` ·
`SEAT_EVIDENCE_CLEAR` · `DECISION_RECORD_DURABLE` · `RUN_BUNDLE_CLEAR` ·
`HISTORICAL_INTEGRITY_CLEAR`.

Also preserved: **no retry; no second candidate; no provider or model substitution; no output
repair; no implementation; no execution authority; no publication authority; no human approval.**

## Next architectural sequence

```
V7 evidence + preauth closure publication
        ↓
forward-only Council context/quorum-proof evidence repair
        ↓
V8 new R3 candidate
        ↓
real 3-seat Council
        ↓
durable DecisionRecord + contemporaneous CouncilQuorumProof
        ↓
fresh human pre-auth audit
        ↓
only if HUMAN_R3_PREAUTH_READY: exact human R3 authorization
```

The forward evidence repair **must not** alter or repair historical V7 evidence. **V8 must be a new
`candidateHash`.** Primary audit recommendation remains **`NEW_R3_CANDIDATE_REQUIRED`**.

## Human action required next

**None of this authorizes anything.** Council approval — even 3/3 — grants zero implementation,
execution, or publication authority, and the human pre-authorization gate returned
`HUMAN_R3_PREAUTH_NOT_READY`, so V1C implementation is **not** authorized on either gate. Each step
in the sequence above requires its own separate, explicit human task instruction. Remote publication
(push/PR/merge) remains human manual fallback only. V1D remains a separate future ADR/task/risk
gate.

## Required Context

- `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v7/` (the frozen V7 evidence this
  closure describes — read directly; **byte-identical, not modified by this task**)
- `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v6/` (historical V6 evidence,
  frozen and not modified by this task)
- `.project/REVIEW_STATE.md` (both gate outcomes for this branch/task)
- `docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md` (frozen/unmodified, `Status: Proposed`)
- `scripts/dev/authorization-binder.mjs` (the R1/R2/R3 `CouncilQuorumProof` admission gate behind
  blocker 3)
- `scripts/dev/council-quorum-proof.mjs` (proof builder/verifier inputs and the `CONTEMPORANEOUS`
  provenance requirement)
- `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md` (harness exercise record)
- `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
