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

Task: authorization-ledger-v1c-r3-arch-decision-6
Branch: `decision/authorization-ledger-v1c-r3-architecture-v6`
Target: main
Publication:
- Local Publication Builder authorized: **yes**, per this task's own "if DECISION_EVIDENCE_VALID,
  create exactly one local evidence commit" instruction — subject
  `chore: record v1c r3 architecture decision v6`. No push, no PR, no merge.
- remote publication: human manual fallback only (unchanged)

**Real 3-seat Shadow Council R3 exercise** for `authorization-ledger-v1c-r3-arch-decision-6`, base
`main @ f004daa516e87e9e11dfe87023deb4e0302d3e47`. Exactly one frozen candidate
(`candidateHash sha256:c5d16bea3806ff0d10b7e092f8d2240d14d68b9461aeb44c206bf7fcb2fafb90`),
`councilEpochId authorization-ledger-v1c-r3-arch-decision-6-epoch-1`,
`contextHash sha256:690c3a14648c7f30705de901aa982eefc077cba1f75130f7420b87437e8f49da`.

**Proposer rotation.** No durable cross-run rotation state exists — the V5 audit established that,
and this task does not invent one. `rotationOrdinal = 5` was fixed as a caller-controlled
`DecisionRequest` parameter before any provider invocation, under the task-local deterministic rule
"architecture decision version N → `rotationOrdinal = N - 1`". No seat was hard-coded: the frozen
ADR-0005 kernel computed `expectedProposerSeatId = CouncilConfig.seats[5 % 3].seatId`. Seat ordering
`[0] seat-openai, [1] seat-anthropic, [2] seat-google` ⇒ kernel-derived proposer **`seat-google`**
— the first exercise in which `seat-google` has proposed.

**Candidate materially fixes V5's `MATERIAL_ARCHITECTURE_BLOCKER`.** Durable privileged
`admin_operation_journal` keyed `(authenticated_peer_uid, operation_kind, admin_operation_id)`;
domain-separated (`MIHVER_V1C_ADMIN_OP_V1`) `requestHash` binding peer UID + operation kind +
`adminOperationId` + `expectedStopEpoch`; epoch write + journal insert + audit append committed
atomically inside one `BEGIN IMMEDIATE`. Dual protection discharges both required lost-ack traces:
same-ID retry replays the stored `N+1` without a second mutation; a new operation ID carrying a
stale `expectedStopEpoch = N` fails closed with `STALE_EXPECTED_STOP_EPOCH`. No path reaches `N+2`.
Same-ID/different-payload fails closed with `IDEMPOTENCY_KEY_REUSE`. V5's accepted baseline
(safe-integer `stopEpoch` domain `0..9007199254740991` with SQLite `CHECK`, exact-UID `SO_PEERCRED`
authorization, trusted `CouncilEpochRegistry`, exact-bound R3 grant, consume-once, zero production
effect consumers, no Execution Gateway) is preserved intact.

**Votes: 2/3 — `seat-openai` REJECT, `seat-anthropic` APPROVE, `seat-google` APPROVE.** R3 requires
exactly 3/3, so the frozen kernel returned `NO_QUORUM` / `NO_QUORUM`,
`reasonCode R3_INSUFFICIENT_APPROVALS`, `quorumDetail {ruleset: R3, approvals: 2}`,
`recordHash sha256:67dc108473f16037fd7dcf3f73f6fe6293e816d197f8930847a75478e64b92f5`.

`seat-openai`'s REJECT is valid and evidence-grounded, not a harness or contract failure: the packet
required seventeen explicitly answered YES/NO matrix questions; the candidate's `yesNoMatrix`
carries fifteen keys, collapsing the three distinct "CAN CODEX?" questions (grant issuance, ADMIN
UID-policy modification, `stopEpoch` increment) into one ambiguous key and omitting two required
answers. `seat-anthropic` independently identified the same collapse, judging it cosmetic rather
than a trust-boundary defect, and voted APPROVE. Both readings are recorded; the kernel's outcome
stands on the votes, not on adjudicating between them. The rationale is advisory evidence only and
had no effect on quorum, `candidateHash`, or `recordHash`.

**`DecisionRecord` durability gate (PR #53) — SATISFIED, first real-exercise proof.** The terminal
record was independently re-verified against its terminal session, then durably written and bound
into the `EvidenceManifest` *before* `FINALIZED`: exactly one `shadow-decision-record:` entry at
`evidence/shadow-decision-record-3383112e5b0aabed9445f04b4625898902faba6a9a9d16783779e7ab0b95d2dd.json`,
raw-byte `contentHash sha256:3383112e...d2dd`, `recordHash` independently recomputable. V5's
`EVIDENCE_BLOCKER` is closed in practice.

**Fresh Verifier** (`mcp__codex__codex`, read-only, independent, thread
`01a05435-2773-76d2-a0a6-957b8c4b337a`): all three reviewer packets embed a byte-identical
12,289-byte `candidateDecision`; independently recomputed the candidate hash, `recordHash`, all
three `assessmentHash` values, the run/evidence/task-record manifest hashes, and all 12 evidence
raw-byte hashes; confirmed both adversarial lost-ack traces provable from the exact candidate text;
confirmed 4 admitted attestations with zero rejected attestations, zero
`ShadowSeatInvocationFailure` artifacts, and no retry; confirmed V3/V4/V5 bundles untouched and no
implementation on this branch. **Verdict: `DECISION_EVIDENCE_VALID`** (14/14 criteria PASS, both
traces PASS).

**Outcome: `NO_QUORUM`.** Evidence-only exercise; zero V1C implementation, zero execution or
publication authority, zero Council rerun, zero human approval. `candidateHash
sha256:c5d16bea3806ff0d10b7e092f8d2240d14d68b9461aeb44c206bf7fcb2fafb90` is **permanently closed for
R3** and must never be re-voted, cosmetically renamed, or resubmitted. Any future attempt requires a
materially new candidate with a distinct `candidateHash`.

Evidence: `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v6/` (`run-manifest.json`
status `FINALIZED`, `manifestHash sha256:5bb995c9...e477`, 12 artifacts).
