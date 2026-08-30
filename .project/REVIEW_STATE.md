# Review State

Durable review/approval state, updated at the end of each task per `REVIEW_PROTOCOL.md`'s
completion checklist. Never invent or assume approval: if a human has not explicitly stated it,
record the gate as pending, not granted. A Codex or Claude `APPROVED` verdict is a technical
assessment, not human sign-off — see `AGENT_POLICY.md`'s Authority Hierarchy.

**Branch/task-scoped, like [CURRENT_TASK.md](./CURRENT_TASK.md).** The "Latest Review" section
below describes the current gate only when *both* hold: `CURRENT_TASK.md` is active for the
checked-out branch, and this file's own declared Branch/Task (below) matches that same
branch/task. `npm run context` checks this automatically. When either condition fails — no active
task, or this file's Branch/Task doesn't match the active one — the "Latest Review" content is
historical/stale task metadata only, not the current gate; `PROJECT_STATE.md`'s "Next Authorized
Action" is authoritative for what's next, not anything below.

## Latest Review

Task: authorization-ledger-v1c-v7-preauth-closure
Branch: `decision/authorization-ledger-v1c-r3-architecture-v7`
Target: main
Publication:
- Local Publication Builder authorized: **yes**, per this closure task's own "create exactly ONE
  additional local commit" instruction — subject `chore: record v7 preauth blockers`. No push, no
  PR, no merge. (The preceding commit on this branch, `chore: record v1c r3 architecture decision
  v7`, recorded the Council run itself.)
- remote publication: human manual fallback only (unchanged)

## Gate summary — read this before anything below

V7 passed **one** of two independent gates. Do not read the Council result as implementation
authorization, and do not describe V7 as Council-rejected.

| Gate | Outcome |
| --- | --- |
| Council (R3 quorum) | **`COUNCIL_APPROVED_PENDING_HUMAN_R3_AUTHORIZATION`** — 3/3 APPROVE; `DecisionRecord` `state DECIDED`, `disposition HUMAN_APPROVAL_REQUIRED`, `reasonCode R3_QUORUM_MET` |
| Human R3 pre-authorization audit | **`HUMAN_R3_PREAUTH_NOT_READY`** — 2 material architecture blockers + 1 evidence blocker |

**CandidateDisposition: `SUPERSEDED_PENDING_MATERIAL_REVISION`.** Primary next action:
**`NEW_R3_CANDIDATE_REQUIRED`**. Full blocker detail and the next architectural sequence are in
[CURRENT_TASK.md](./CURRENT_TASK.md); the Council-run record follows below, unchanged.

**Real 3-seat Shadow Council R3 exercise** for `authorization-ledger-v1c-r3-arch-decision-7`, base
`main @ 2e42febe088e5e6bdff61431cd964dd2a3f2fcd8`. Exactly one frozen candidate
(`candidateHash sha256:c072d9969bede46ebfd3ab336d50ef97065a4ff08c6f17f42fe062c74671f0f8`),
`councilEpochId authorization-ledger-v1c-r3-arch-decision-7-epoch-1`,
`contextHash sha256:7999f772b587226da8637577de934985076bd4404a90c5aa17ce90685c4f1452`.

**Proposer rotation.** No durable cross-run rotation state exists; this task does not invent one.
`rotationOrdinal = 6` was fixed as a caller-controlled `DecisionRequest` parameter before any
provider invocation, under the same task-local deterministic rule "architecture decision version N →
`rotationOrdinal = N - 1`". No seat was hard-coded: the frozen ADR-0005 kernel computed
`expectedProposerSeatId = CouncilConfig.seats[6 % 3].seatId`. Seat ordering `[0] seat-openai,
[1] seat-anthropic, [2] seat-google` ⇒ kernel-derived proposer **`seat-openai`**.

**V7 is a narrow successor to V6, not a redesign.** V6's substantive architecture was sound and is
reproduced unchanged; V6 failed R3 quorum for exactly one reason, and V7's sole material revision
addresses exactly that reason. V6's `yesNoMatrix` answered 15 of the 17 required questions,
collapsing the distinct Claude/Codex questions into shared keys. V7's proposer packet therefore
carried a hard structural contract — `yesNoMatrix` MUST be an array of exactly 17 objects, ids
`Q01`..`Q17` each used once, `question` reproduced verbatim, `answer` exactly `NO`, with
`Q01`/`Q02`, `Q03`/`Q04` and `Q08`/`Q09` named as deliberately near-identical CLAUDE-vs-CODEX pairs
requiring two separate entries each. The frozen candidate answers **17/17**.

**Two mechanical matrix gates, both before any vote.** A *pre-provider* gate asserted, before the
proposer was invoked at all, that each of the 17 canonical questions appears in the constructed
decision question/evidence exactly once (17/17 PASS). A *post-freeze, pre-vote* gate was interposed
on the kernel's `FREEZE_CANDIDATE` transition via `applyEventImpl`, so a non-conforming frozen
candidate would have returned `CANDIDATE_CONSTRUCTION_BLOCKER` and durable failure evidence without
spending a single voter invocation. The frozen candidate passed: 17 entries, ids `Q01`..`Q17` each
once, all `question` strings verbatim and pairwise distinct, all 17 answers exactly `NO`, no
collapsed Claude/Codex entry, no duplicate standing in for a missing entry. The frozen candidate was
never edited, repaired, or re-prompted.

**Architecture preserved from V6.** Dedicated `authledgerd` daemon and `mihver-ledger` OS identity;
separate ADMIN/CLIENT Unix-domain sockets with permissions as reachability only; `SO_PEERCRED` UID
as authenticated identity; root-owned exact-UID allowlist as authorization; privileged SQLite/WAL
state; trusted `CouncilEpochRegistry` with canonical evidence import and re-validation; safe-integer
`stopEpoch` domain `0..9007199254740991` with SQLite `INTEGER` `CHECK` and `STOP_EPOCH_EXHAUSTED` at
the maximum; durable `admin_operation_journal` keyed
`(authenticatedPeerUid, operationKind, adminOperationId)`; domain-separated `requestHash`
(`MIHVER/AUTHLEDGERD/ADMIN/INCREMENT_STOP_EPOCH/REQUEST/V1C\0`) binding peer UID + operation kind +
`adminOperationId` + `expectedStopEpoch`; epoch write + journal insert + audit append in one
`BEGIN IMMEDIATE` commit boundary; expected-epoch CAS; exact-bound R3 `AuthorizationGrant`; dormant
consume-once state; Publication Broker structurally separate. Both required lost-ack traces are
discharged: same-ID retry replays the stored `N+1` with no second mutation and no second audit
mutation event, and a new operation ID carrying a stale `expectedStopEpoch = N` fails closed with
`STALE_EXPECTED_STOP_EPOCH`. Neither path reaches `N+2`. Same-ID/different-request fails closed with
`IDEMPOTENCY_KEY_REUSE`. Operation-result lookup is Option A: an ADMIN-socket, `SO_PEERCRED`-scoped,
strictly read-only `getAdminOperationResult(operationKind, adminOperationId)`.

**Votes: 3/3 — `seat-openai` APPROVE, `seat-anthropic` APPROVE, `seat-google` APPROVE.** R3 requires
exactly 3/3, so the frozen kernel returned `DECIDED` / `HUMAN_APPROVAL_REQUIRED`,
`reasonCode R3_QUORUM_MET`, `quorumDetail {ruleset: R3, approvals: 3}`,
`recordHash sha256:d16ae65b429648dd9e016bdb417895a881a12e2226c5c20f164a238f9c81bb21`. All three
rationales identify the 17/17 uncollapsed matrix as the decisive change and confirm V6's
architecture is preserved; `seat-anthropic` records one residual documentation-level caveat
(consume-once duplicate handling does not name the stored record field returned) that it judged not
to reopen a trust boundary. Rationale is advisory evidence only and had no effect on quorum,
`candidateHash`, or `recordHash`.

**`DecisionRecord` durability gate (PR #53) — SATISFIED.** The terminal record was independently
re-verified against its terminal session, then durably written and bound into the `EvidenceManifest`
*before* `FINALIZED`: exactly one `shadow-decision-record:` entry at
`evidence/shadow-decision-record-5ac292de1187d29e9d7e2d6d4921ce1e94b41c4332aa10abefa36de3ba37d87f.json`,
raw-byte `contentHash sha256:5ac292de...d87f`, `recordHash` independently recomputable.

**Fresh Verifier** (`mcp__codex__codex`, read-only, independent, thread
`01a0545e-ad5f-7cb2-8135-61ef2fd3cb15`): independently recomputed the `candidateHash`, `recordHash`,
all three `assessmentHash` values, the run/evidence/task-record manifest hashes and all 12 evidence
raw-byte hashes; confirmed the candidate is distinct from both V5 and V6; confirmed 17 distinct
matrix entries all answering `NO` with the three Claude/Codex pairs uncollapsed; confirmed both
adversarial lost-ack traces provable from the exact frozen candidate text; confirmed the three
reviewer packets embed a canonically identical `candidateDecision`; confirmed 4 admitted
attestations, 0 rejected attestations, 0 `ShadowSeatInvocationFailure` artifacts and no retry;
confirmed V3/V4/V5/V6 and `arch-decision-2` bundles untouched and no V1C implementation on this
branch. **Verdict: `DECISION_EVIDENCE_VALID`** (18/18 criteria A–R PASS).

**Outcome: `COUNCIL_APPROVED_PENDING_HUMAN_R3_AUTHORIZATION`.** Council approval — even 3/3 —
grants **zero** implementation, execution, or publication authority. No `authledgerd`, no SQLite
production state, no sockets, no grants, no consume activation, no Publication Broker change, no
Execution Gateway, no push, no PR, no merge, no human approval. A **fresh human pre-authorization
audit of the exact `candidateHash sha256:c072d996...f0f8`** remains mandatory before any V1C
implementation task may be authorized. V1D remains a separate future ADR/task/risk gate.

Closed predecessors, never to be re-voted or resubmitted:
`sha256:9bc6b4c3...05a063` (V5, `SUPERSEDED_PENDING_MATERIAL_REVISION`) and
`sha256:c5d16bea...2fafb90` (V6, `NO_QUORUM`, permanently closed for R3).

Evidence: `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v7/` (`run-manifest.json`
status `FINALIZED`, `manifestHash sha256:0b48c8b7...e6de`, 12 artifacts).

---

## Second gate — human R3 pre-authorization audit: `HUMAN_R3_PREAUTH_NOT_READY`

Strict read-only pre-authorization audit of the exact
`candidateHash sha256:c072d9969bede46ebfd3ab336d50ef97065a4ff08c6f17f42fe062c74671f0f8`. Base state
re-verified mechanically; `candidateHash`, `recordHash` and the Run Bundle `manifestHash` each
**independently recomputed** from persisted bytes through the frozen ADR-0005 kernel path, never
taken from a report. Two fresh read-only Codex auditors (`sandbox: read-only`): Auditor A
(architecture / exact implementability) `01a0546d-d99a-73a2-b776-8323c790f840`; Auditor B (identity
/ trust / human authorization) `01a0546f-d77e-7863-a91c-3a31f4aeb70c`. Decision/evidence chain
verified mechanically by Claude — no third auditor needed, **no voting provider invoked, no Council
rerun**.

The evidence chain is sound; V7 fails on **exact implementability**.

1. **UID policy trust root — `MATERIAL_ARCHITECTURE_BLOCKER`.** The invariant is established but the
   runtime trust-root contract is not fixed: absolute policy path, trusted parent-directory chain,
   exact acceptable owner UID/GID, exact acceptable file/directory modes, no-symlink resolution,
   hard-link policy, fail-closed ownership/mode/path validation, and no model-writable ancestor
   capable of replacement all remain for a successor candidate to define.
2. **`AuthorizationGrant` — `MATERIAL_ARCHITECTURE_BLOCKER`.** New R3 security choices are left to
   implementers: `grantId` generation authority, format/entropy, uniqueness, issuance idempotency
   across retry/lost ACK; the exact meaning of `issuanceIdentity`; whether V1C supports expiry and
   its exact semantics; whether V1C supports revocation and its exact authority/state/atomicity;
   canonical grant identity/hash decision; whether signatures exist and, if a canonical grant hash
   exists, its exact covered fields/domain; and grant-issuance request identity / `requestHash` /
   journal semantics. **No wording such as "where supported" may defer an R3 capability decision.**
3. **`CouncilQuorumProof` — `EVIDENCE_BLOCKER`.** The V7 `DecisionRecord` is durable and valid, and
   no proof is required for the human R3 gate itself. But `scripts/dev/authorization-binder.mjs`
   later requires a valid, eligible `CouncilQuorumProof` for R1/R2/R3 authorization evidence, and
   the V7 bundle cannot legitimately construct one: the contemporaneous run did not durably persist
   the exact `DecisionRequest` with `rotationOrdinal`, the exact `CouncilConfig`, its exact seat
   order, or `modelFamily` per seat. **These MUST NOT be reconstructed retroactively for V7, and no
   `CONTEMPORANEOUS` proof may be manufactured after the run.** Forward repair is required before
   the next R3 architecture run and must not alter or repair historical V7 evidence.

**Clear / non-blocking:** `MATRIX_CONTRACT_CLEAR` (exact 17/17) · `STOPEPOCH_DOMAIN_CLEAR` ·
`STOPEPOCH_IDEMPOTENCY_SATISFIED` · `ADMIN_JOURNAL_CLEAR` · `ADMIN_RESULT_LOOKUP_CLEAR` ·
`CONSUME_ONCE_IMPLEMENTATION_DETAIL_ONLY` · `UID_AUTH_CLEAR` · `COUNCIL_TRUST_CLEAR` ·
`HUMAN_APPROVAL_BINDING_CLEAR` · `ZERO_EFFECT_CONSUMER_CLEAR` · `SEAT_EVIDENCE_CLEAR` ·
`DECISION_RECORD_DURABLE` · `RUN_BUNDLE_CLEAR` · `HISTORICAL_INTEGRITY_CLEAR`. Also preserved: no
retry, no second candidate, no provider or model substitution, no output repair, no implementation,
no execution authority, no publication authority, **no human approval**.

**Verdict `HUMAN_R3_PREAUTH_NOT_READY`; primary next action `NEW_R3_CANDIDATE_REQUIRED`.** V7's
`candidateHash sha256:c072d996...4671f0f8` is **`SUPERSEDED_PENDING_MATERIAL_REVISION`** — it joins
V5 (`sha256:9bc6b4c3...1805a063`) and V6 (`sha256:c5d16bea...b2fafb90`) as not to be resubmitted;
**V8 must be a new `candidateHash`.** V7's Council decision and Run Bundle remain valid, durable and
byte-unchanged.
