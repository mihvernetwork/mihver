# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

authorization-ledger-v1c-r3-arch-decision-5

## Objective

Real 3-seat Shadow Council R3 architecture decision (V5) for the V1C privileged Authorization
Ledger, human-admin AuthorizationGrant path, global stopEpoch register, and trusted Council/evidence
import boundary — materially revised from V4 to fix both of decision-4's valid seat-openai REJECT
findings: (1) stopEpoch specified as unsigned 64-bit while SQLite INTEGER is signed 64-bit, and the
repository's canonical JSON serializer explicitly rejects BigInt, so an unsigned-64 epoch cannot
round-trip through the frozen AuthorizationEnvelope schema without a schema migration (not
authorized here); and (2) SO_PEERCRED treated as if it reliably established supplementary-group
authorization, when it only supplies the peer UID/GID. This is a Council decision + durable evidence
task only — no V1C implementation is authorized by this task.

## Branch / Base

Branch: `decision/authorization-ledger-v1c-r3-architecture-v5`
Base: `main` at `8bf80782c94029264605e74015582e74eb17e240` (PR #51 merged: harden shadow council
reviewer output budget)

## Status

**Bootstrap:** verified `main @ 8bf8078`, working tree clean, matching the task's expected base.

**Council exercise:** ran the real 3-seat Shadow Council harness
(`scripts/dev/shadow-council-run-bundle-evidence.mjs`, PR #47/#48/#51 lineage) against one frozen
new candidate (proposer `seat-openai`, `rotationOrdinal: 0`, consistent with the kernel's
`seats[rotationOrdinal % 3]` formula and V3/V4 precedent). Real subprocess invocations of the
installed `codex`, `claude`, and `agy` CLIs produced all three votes.

- `candidateHash`: `sha256:9bc6b4c3c63ffa02563d936557bfaced13e6f6251f7c0084bbd3abc01805a063`
  (distinct from V3's `sha256:540531...b6e9f3` and V4's `sha256:0e63ea1a...246175c`, both
  permanently closed).
- The candidate specifies stopEpoch as a SQLite `INTEGER` singleton row bounded
  `0..9007199254740991` (`Number.MAX_SAFE_INTEGER`) with an explicit `CHECK` constraint,
  application-computed safe-integer arithmetic (no BigInt/old+1/wraparound/reset/float coercion),
  and fail-closed `STOP_EPOCH_EXHAUSTED` at the ceiling — fixing V4 blocker 1.
- The candidate specifies per-RPC authorization as an exact `authenticatedPeerUid` (derived from
  kernel `SO_PEERCRED`) checked against a root-owned, non-model-writable UID allowlist
  (`/etc/mihver/authorization-ledger/uid-policy.json`), with socket/group permissions serving only
  as reachability, never authorization — fixing V4 blocker 2.
- **All three seats voted APPROVE** (seat-openai, seat-anthropic, seat-google), each with a
  non-empty rationale citing both fixes. `exerciseOutcome`: **3/3 APPROVE**.

**Fresh Verifier (Codex, read-only):** first pass returned `DECISION_EVIDENCE_INVALID` over two
findings (missing persisted `rotationOrdinal`; no `repositoryHead` field inside attestation JSON). A
second, independent, fresh read-only adjudicator confirmed both are `VERIFIER_CRITERIA_DEFECT`, not
real integrity defects: neither field is ever persisted by this harness's evidence model in *any*
run (confirmed identical structural absence in the already-merged, human-reviewed V3/V4 bundles);
repository-head integrity is established transitively through the packet's hashed
`repositoryHead` field, which every attestation binds to via `packetHash`. Final verdict:
**`DECISION_EVIDENCE_VALID`**.

**Evidence:** `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v5/` (`run-manifest.json`
status `FINALIZED`; `evidence-manifest.json` lists 11 artifacts — 4 packets, 4 attestations, 3 vote
assessments — all content-hash-verified).

**Outcome: `COUNCIL_APPROVED_PENDING_HUMAN_R3_AUTHORIZATION`.** No V1C implementation was performed
or authorized. Human must separately and explicitly authorize the exact candidateHash above before
any V1C implementation task begins.

**Human pre-authorization audit (read-only, `AUTHORIZATION-LEDGER-V1C-V5-PREAUTH-CLOSURE`):
`HUMAN_R3_PREAUTH_NOT_READY`.** This is a distinct, later gate from Council approval above — 3/3
Council `APPROVE` is not human pre-authorization, and this audit finding is not a Council rejection.
Two blockers, both material:

1. **`MATERIAL_ARCHITECTURE_BLOCKER`** — `stopEpoch` increment retry/idempotency is
   under-specified. Lost-ack counterexample: commit to epoch `N+1` succeeds, the acknowledgment is
   lost, the same logical operation is retried, and the candidate provides no operation identity /
   idempotency key / expected-epoch CAS preventing a spurious further increment to `N+2`.
2. **`EVIDENCE_BLOCKER`** — the terminal `DecisionRecord` was formed in memory but was not durably
   persisted by `runShadowExerciseWithDurableEvidence`.

Nonblocking/clear findings from the same audit: UID authorization — CLEAR; proposer rotation —
`NONBLOCKING_PROCEDURAL_FINDING`; `CouncilQuorumProof` — `NOT_REQUIRED_FOR_THIS_GATE`; Run Bundle
integrity — CLEAR.

**CandidateDisposition: `SUPERSEDED_PENDING_MATERIAL_REVISION`.** `candidateHash
sha256:9bc6b4c3c63ffa02563d936557bfaced13e6f6251f7c0084bbd3abc01805a063` remains
`COUNCIL_APPROVED` (3/3) but is **not** implementation-authorized and must not be treated as such by
future context. No Council rerun, no provider calls, no V1C implementation, and no human approval
were performed by the closure task that recorded this finding — it only persisted an
already-completed read-only audit result. The finalized Run Bundle under
`.project/run-bundles/authorization-ledger-v1c-r3-architecture-v5/` was not modified.

## Required Context

- `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v5/` (this task's own evidence —
  read directly)
- `docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md` (frozen/unmodified, `Status: Proposed`)
- `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
