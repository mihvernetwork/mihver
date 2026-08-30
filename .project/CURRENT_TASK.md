# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

authorization-ledger-v1c-r3-arch-decision-6

## Objective

Real 3-seat Shadow Council R3 architecture decision (V6) for the V1C privileged Authorization
Ledger, human-admin `AuthorizationGrant` path, trusted Council/evidence import boundary, and the
persistent global `stopEpoch` register — materially revised from V5 to fix V5's single remaining
human-pre-authorization `MATERIAL_ARCHITECTURE_BLOCKER`: the `stopEpoch` increment was atomic but
not application-level idempotent across commit → acknowledgment loss → retry of the same logical
ADMIN operation. V6 must specify a complete retry-safe ADMIN increment protocol (operation identity,
expected-epoch CAS, durable privileged operation journal, request binding) that makes both lost-ack
traces provably safe. V5's second blocker (terminal `DecisionRecord` not durably persisted) was
repaired in the harness by PR #53 and must now be demonstrated by this run's own evidence. This is a
Council decision + durable evidence task only — **no V1C implementation is authorized**.

## Branch / Base

Branch: `decision/authorization-ledger-v1c-r3-architecture-v6`
Base: `main` at `f004daa516e87e9e11dfe87023deb4e0302d3e47` (PR #53 merged: persist shadow council
decision records)

## Status

**Bootstrap:** verified `main @ f004daa`, working tree clean, matching the task's expected base.
Branch created at that exact commit.

**Proposer rotation:** `rotationOrdinal = 5` (task-local deterministic rule: architecture decision
version N → `rotationOrdinal = N - 1`; V6 → 5), fixed as a caller-controlled `DecisionRequest`
parameter *before* any provider invocation. No seat was hard-coded or hand-selected: the frozen
ADR-0005 kernel computed `expectedProposerSeatId = CouncilConfig.seats[5 % 3].seatId`. CouncilConfig
seat ordering is `[0] seat-openai, [1] seat-anthropic, [2] seat-google`, so the kernel-derived
proposer is **`seat-google`**. No durable cross-run rotation state is claimed to exist — the V5
audit established that it does not.

**Council exercise:** ran the real 3-seat Shadow Council harness
(`scripts/dev/shadow-council-run-bundle-evidence.mjs`, PR #47/#48/#51/#53 lineage) against exactly
one frozen new candidate. Real subprocess invocations of the installed `agy`, `codex`, and `claude`
CLIs produced the proposal and all three votes — 4 real calls, zero retries, zero provider or model
substitution, zero response repair, no second candidate.

- `contextHash`: `sha256:690c3a14648c7f30705de901aa982eefc077cba1f75130f7420b87437e8f49da`
- `repositoryHead`: `f004daa516e87e9e11dfe87023deb4e0302d3e47`
- `councilEpochId`: `authorization-ledger-v1c-r3-arch-decision-6-epoch-1`
- `candidateHash`: `sha256:c5d16bea3806ff0d10b7e092f8d2240d14d68b9461aeb44c206bf7fcb2fafb90`
  (distinct from V5's `sha256:9bc6b4c3...1805a063`, V4's `sha256:0e63ea1a...246175c`, and V3's
  `sha256:540531...b6e9f3` — all permanently closed)

The candidate **does** materially fix V5's `MATERIAL_ARCHITECTURE_BLOCKER`. It specifies a durable
privileged `admin_operation_journal` with primary key
`(authenticated_peer_uid, operation_kind, admin_operation_id)`, a domain-separated
(`MIHVER_V1C_ADMIN_OP_V1`) `requestHash` binding peer UID + operation kind + `adminOperationId` +
`expectedStopEpoch`, and a `BEGIN IMMEDIATE` transaction in which the epoch write, the journal
insert, and the audit append commit atomically together. Both required lost-ack traces are
explicitly discharged: same-ID retry replays the stored `N+1` with no second mutation; a new
operation ID carrying a stale `expectedStopEpoch = N` fails closed with
`STALE_EXPECTED_STOP_EPOCH`. Neither path can reach `N+2`. V5's retained baseline (safe-integer
`stopEpoch` domain, exact-UID authorization, trust registry, zero effect consumers) is preserved.

**Votes: 2/3 APPROVE — `seat-openai` REJECT, `seat-anthropic` APPROVE, `seat-google` APPROVE.**
R3 requires exactly 3/3, so the frozen kernel returned `NO_QUORUM`. `seat-openai`'s REJECT is
factually grounded and is *not* a defect of the Council machinery: evidence item 15 required
seventeen explicitly answered matrix questions, and the candidate's `yesNoMatrix` carries only
fifteen keys — the three distinct "CAN CODEX?" questions (grant issuance, ADMIN UID-policy
modification, `stopEpoch` increment) were collapsed into a single ambiguous `"CAN CODEX?"` key, so
two required answers are absent. `seat-anthropic` independently flagged the same collapse as a
non-blocking caveat while voting APPROVE.

- `DecisionRecord.state`: `NO_QUORUM`; `disposition`: `NO_QUORUM`;
  `reasonCode`: `R3_INSUFFICIENT_APPROVALS`; `quorumDetail`: `{ruleset: R3, approvals: 2}`
- `recordHash`: `sha256:67dc108473f16037fd7dcf3f73f6fe6293e816d197f8930847a75478e64b92f5`

**DecisionRecord durability gate (PR #53) — SATISFIED.** This is the first real R3 exercise to prove
it. The terminal `DecisionRecord` was independently re-verified against its terminal session, then
durably written as canonical JSON evidence and bound into the `EvidenceManifest` *before* the Run
Bundle was `FINALIZED`: exactly one `shadow-decision-record:` entry, at
`evidence/shadow-decision-record-3383112e5b0aabed9445f04b4625898902faba6a9a9d16783779e7ab0b95d2dd.json`,
raw-byte `contentHash sha256:3383112e...d2dd`, `recordHash` independently recomputable via the
frozen kernel's `computeDecisionRecordHash`. V5's `EVIDENCE_BLOCKER` is therefore closed in
practice, not merely in test fixtures.

**Evidence:** `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v6/`
(`run-manifest.json` status `FINALIZED`, `manifestHash sha256:5bb995c9...e477`;
`evidence-manifest.json` lists 12 artifacts — 4 packets, 4 attestations, 3 vote assessments, 1
DecisionRecord — all content-hash-verified). Zero `ShadowSeatInvocationFailure` artifacts and zero
rejected attestations.

**Fresh Verifier (Codex, read-only, thread `01a05435-2773-76d2-a0a6-957b8c4b337a`):** verified all
three reviewer packets embed a byte-identical 12,289-byte `candidateDecision`; independently
recomputed the candidate hash, record hash, all assessment hashes, the manifest/evidence/task-record
hashes, and every one of the 12 evidence raw-byte hashes; confirmed both adversarial lost-ack traces
are provable from the exact candidate text; confirmed historical V3/V4/V5 bundles are untouched and
no implementation exists on this branch. **Verdict: `DECISION_EVIDENCE_VALID`** (14/14 criteria
PASS).

**Outcome: `NO_QUORUM`.** `candidateHash sha256:c5d16bea3806ff0d10b7e092f8d2240d14d68b9461aeb44c206bf7fcb2fafb90`
is **permanently closed for R3** and must not be re-voted, cosmetically renamed, or resubmitted. No
V1C implementation was performed or authorized. No Council rerun, no second candidate, no human
approval. Any future candidate must be a materially new one carrying a distinct `candidateHash`.

## Required Context

- `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v6/` (this task's own evidence —
  read directly)
- `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v5/` (historical V5 evidence,
  frozen and not modified by this task)
- `.project/REVIEW_STATE.md` (V5 Council outcome + `HUMAN_R3_PREAUTH_NOT_READY` audit findings)
- `docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md` (frozen/unmodified, `Status: Proposed`)
- `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md` (harness exercise record, incl. PR #53
  durable `DecisionRecord` persistence)
- `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
