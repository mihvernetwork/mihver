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

Task: authorization-ledger-v1c-r3-arch-decision-5
Branch: `decision/authorization-ledger-v1c-r3-architecture-v5`
Target: main
Publication:
- Local Publication Builder authorized: **yes**, per this task's own "if DECISION_EVIDENCE_VALID,
  create exactly one local evidence commit" instruction — subject
  `chore: record v1c r3 architecture decision v5 evidence`. No push, no PR, no merge.
- remote publication: human manual fallback only (unchanged)

**Real 3-seat Shadow Council R3 exercise** for `authorization-ledger-v1c-r3-arch-decision-5`: one
frozen candidate (`candidateHash sha256:9bc6b4c3c63ffa02563d936557bfaced13e6f6251f7c0084bbd3abc01805a063`,
proposer `seat-openai`, `rotationOrdinal 0`), materially revised from V4
(`sha256:0e63ea1a...246175c`, closed after valid REJECT) to fix both of its named blockers:
(1) stopEpoch now specified as SQLite `INTEGER` bounded `0..9007199254740991`
(`Number.MAX_SAFE_INTEGER`) with an explicit `CHECK` constraint, no BigInt/old+1/wraparound/reset/
float coercion, fail-closed `STOP_EPOCH_EXHAUSTED` at the ceiling; (2) authorization now an exact
`authenticatedPeerUid` (from kernel `SO_PEERCRED`) checked against a root-owned, non-model-writable
UID allowlist, with socket/group permissions serving only as reachability.

**All three seats voted APPROVE** (seat-openai, seat-anthropic, seat-google), each citing both
fixes as decisive. `exerciseOutcome`: 3/3 APPROVE.

**Fresh Verifier** (`mcp__codex__codex`, read-only): first pass `DECISION_EVIDENCE_INVALID` over
two findings (unpersisted `rotationOrdinal`; no `repositoryHead` field inside attestation JSON). A
second, independent, fresh read-only adjudicator confirmed both `VERIFIER_CRITERIA_DEFECT`: neither
field is ever persisted by this harness's evidence model in any run, including the already-merged,
human-reviewed V3/V4 bundles; repository-head integrity is established transitively via the
packet's hashed `repositoryHead`, which every attestation binds to through `packetHash`. Final
verdict: **`DECISION_EVIDENCE_VALID`**.

**Outcome: `COUNCIL_APPROVED_PENDING_HUMAN_R3_AUTHORIZATION`.** Council-evidence-only; zero V1C
implementation, zero execution or publication authority, zero Council rerun. Human must separately
and explicitly authorize the exact candidateHash above before any V1C implementation task begins.

Evidence: `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v5/` (`run-manifest.json`
status `FINALIZED`).

**Human pre-authorization audit (read-only, later, narrow closure task
`AUTHORIZATION-LEDGER-V1C-V5-PREAUTH-CLOSURE`): `HUMAN_R3_PREAUTH_NOT_READY`.** Council approval
(3/3 APPROVE) and human pre-authorization are distinct gates; this finding is not a Council
rejection. Blockers: (1) `MATERIAL_ARCHITECTURE_BLOCKER` — `stopEpoch` increment retry/idempotency
under-specified (lost-ack counterexample: commit N+1, ack lost, retry, no operation identity /
idempotency key / expected-epoch CAS preventing a spurious N+2); (2) `EVIDENCE_BLOCKER` — the
terminal `DecisionRecord` formed in memory was not durably persisted by
`runShadowExerciseWithDurableEvidence`. Clear/nonblocking: UID authorization CLEAR; proposer
rotation NONBLOCKING_PROCEDURAL_FINDING; `CouncilQuorumProof` NOT_REQUIRED_FOR_THIS_GATE; Run
Bundle integrity CLEAR.

**CandidateDisposition: `SUPERSEDED_PENDING_MATERIAL_REVISION`** for `candidateHash
sha256:9bc6b4c3c63ffa02563d936557bfaced13e6f6251f7c0084bbd3abc01805a063` — Council-approved but
**not** implementation-authorized. No Council rerun, no provider calls, no V1C implementation, no
human approval performed by this closure. Finalized Run Bundle unmodified.
