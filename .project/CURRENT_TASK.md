# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

AUTHORIZATION-LOOP-FOUNDATION-V1A (resumed and completed through internal gates)

## Objective

Prove a deterministic, non-LLM, FakeExecutor-only demonstration of the full pipeline —
`ProjectContextPack`/`TaskRecord` -> Decision Council `DecisionRecord` -> `CouncilQuorumProof` ->
Authorization Binder (`AuthorizationEnvelope`) -> Authorization Ledger Simulator (`ALLOW_ONCE`/
grant/replay/STOP-fencing) -> `FakeExecutor` -> `authorization-verifier` — with Binder and Ledger
BOTH independently requiring and verifying real `CouncilQuorumProof` evidence (not a bare,
self-consistent `DecisionRecord`) for R1/R2/R3, per ADR-0006's "V1B Amendment" subsection.

This continuation resumed the task from an interrupted Phase 2 boundary: the preserved 14-file
implementation (written before `scripts/dev/council-quorum-proof.mjs` existed) was a real
`PROTOCOL_BOUNDARY_BLOCKER` — it authorized R1/R2/R3 off a bare `DecisionRecord` alone. That blocker
was resolved by `DECISION-COUNCIL-QUORUM-PROOF-V1B` (PR #45, merged to `main` @ `9fe907a`, this
branch's base). This session adopted that merged API, re-ran Phase 2 review, then completed Phases
3-9 without discarding or restarting the preserved implementation, and without returning to the
human between successful internal gates (per this continuation's own escalation policy — no Council
escalation was ever triggered; every finding across all review rounds was a routine or
cross-workstream integration fix).

## Branch / Base

Branch: `feat/authorization-loop-foundation-v1a`.
Base: `main` at `9fe907a87401adae6fe3e4eb443db770dff87678` (PR #45 merged: Decision Council Quorum
Proof V1B).

## Status

**Complete, pending human review.**

**Proof-API adoption (fresh Scout, no interface invented):** confirmed the real, merged
`verifyCouncilQuorumProof({ proof, decisionRecord, trustedRegistry })` signature and mapped it onto
the existing Binder (`evaluateAuthorization`) and Ledger (`issueGrant`/`checkAndConsume`) gates.

**Boundary-integration remediation (2 parallel Codex Implementers, no council escalation
required):**
- **Binder** (`scripts/dev/authorization-binder.mjs`): R1/R2/R3 envelope construction now requires
  `verifyCouncilQuorumProof(...).authorizationEvidenceEligible === true`; retired its own
  hand-rolled quorum approximation, keeping only structural/hash/vote-binding checks as
  defense-in-depth. R0 unaffected (proof not required, by the sidecar's own R1-R3-only design);
  R4/`NO_QUORUM` still deny with no envelope and no proof needed.
- **Ledger** (`scripts/dev/authorization-ledger-simulator.mjs`): constructor now takes
  `councilQuorumProofs` (keyed by the composite `(decisionRequestId, recordHash)` identity — closing
  a pre-existing silent-overwrite-on-duplicate-`decisionRequestId` gap found during review) plus a
  `trustedRegistry`; `issueGrant` and `checkAndConsume` EACH independently call
  `verifyCouncilQuorumProof` themselves inside their existing locked/atomic sections — never
  trusting that the Binder already checked it, per the Ledger's own "never trust the Binder's
  conclusion" design principle.
- **Fake Loop** (`scripts/dev/authorization-loop.mjs`): only needed to thread `fixture.proof`/
  `fixture.trustedRegistry` through to the Binder call — no authority expansion.

**Phase 2 review re-entry (4 fresh axis Reviewers, all reaching `APPROVED_FOR_INTEGRATION` after one
fix round):** two real findings, both fixed — (1) `DecisionRecord`/proof shape gaps in test coverage
(wrong-record-binding proof, `RECONSTRUCTED`-provenance proof, R1-R3 loop integration case) added;
(2) confirmed no protocol-semantics blocker anywhere.

**Phase 3/4 — deterministic demonstration** (`scripts/dev/authorization-loop-demonstration.mjs`,
written up in `docs/development/AUTHORIZATION_LOOP_V1A_DEMONSTRATION.md`): all 6 required scenarios
demonstrated using REAL kernel-produced `DecisionRecord`s and real `CouncilQuorumProof`s (no
fabricated fixtures) — two full R1 iterations reaching `COMPLETED` with `FAKE_EXECUTED`+`VERIFIED`
each; STOP-epoch fencing denial; R3 without a grant (`PENDING_HUMAN_APPROVAL`, denied, no execute);
R3 exact-bound grant + one real consumption + replay denial (`REPLAY_REJECTED`); a `BLOCKED`
TaskRecord denied before envelope construction; R4 hard denial AND a real-kernel-produced
`NO_QUORUM` denial. FakeExecutor only — confirmed via direct grep and an extended transitive-import
test (see Phase 6 below).

**Phase 5 — Run Bundle evidence**: a finalized bundle at
`.project/run-bundles/authorization-loop-v1a-demonstration/` (task-record/evidence-manifest/
run-manifest + `report.md` + a captured full demonstration-output.txt), all self-hashes and content
hashes independently re-verified. Resynced once after a later wording-only fix changed the
demonstration script's content hash (output bytes unchanged, verified byte-identical); `npm run
test:run-bundle`: 17/17.

**Phase 6 — four-axis integrated adversarial review**: hash-graph/binding (APPROVED_FOR_INTEGRATION,
no changes), quorum/replay/fencing (APPROVE_WITH_CHANGES — fixed: removed the Ledger's now-redundant
hand-rolled quorum approximation; reordered `checkAndConsume`/`issueGrant` so the new proof gate no
longer masks older-precedence denials like `REPLAY_REJECTED`/stopEpoch revocation/grant expiry),
effect-isolation (APPROVE_WITH_CHANGES — fixed: extracted `computeTaskRecordHash`/`valueWithoutHash`
into a new pure module `scripts/dev/canonical-record-hash.mjs` so the Binder/Ledger no longer
transitively import `run-bundle.mjs`'s fs/child_process-capable code just for a hash helper;
extended the authority-distance test to walk the transitive import graph; fixed one wording
overclaim, "real executor" -> "FakeExecutor implementation"), confused-deputy resistance
(APPROVED_FOR_INTEGRATION, no changes — Ledger never trusts the Binder's conclusion, proof/registry
are constructor-owned canonical inputs not caller-overridable per request, cross-record proof
substitution is blocked by both the composite key and the sidecar's own `decisionRecordHash`
binding). No finding at any point required a change to actual R1/R2/R3 quorum semantics, the council
topology, or the authority boundary — no `PROTOCOL_SEMANTICS_BLOCKER`/`COUNCIL_ESCALATION_REQUIRED`
was ever raised.

**Phase 7 — final Verifier**: confirmed frozen ADR-0005 kernel/schema and the merged
`council-quorum-proof.mjs`/schema are byte-identical to `main`; ADR-0006 Status still `Proposed`; no
execution/publication/shell/Git/network/provider-CLI capability anywhere in the new code; the full
test matrix green (Binder 23, Ledger 22, Loop 13, FakeExecutor 4, kernel 18, simulator 18,
council-quorum-proof 25, run-bundle 17 — all independently re-run, not just claimed); the
demonstration's 6 scenarios independently re-run and confirmed; the Run Bundle's hashes independently
recomputed and matched; `git diff --check` clean. `scripts/dev/run-bundle.mjs`'s own diff (importing
the extracted pure hash helper) is a same-behavior re-export refactor, confirmed via its own
unaffected 17/17 test suite and an unchanged public API/hash domain — this file is shared dev
tooling, not part of ADR-0005's frozen kernel/schema or the merged quorum-proof sidecar.

**Changes made (this session, on top of the preserved 14 files):**
- New: `scripts/dev/authorization-loop-demonstration.mjs`, `scripts/dev/canonical-record-hash.mjs`,
  `docs/development/AUTHORIZATION_LOOP_V1A_DEMONSTRATION.md`,
  `.project/run-bundles/authorization-loop-v1a-demonstration/` (finalized Run Bundle).
- Modified (from the preserved baseline): `scripts/dev/authorization-binder.mjs`,
  `scripts/dev/authorization-ledger-simulator.mjs`, `scripts/dev/authorization-loop.mjs`,
  `schemas/dev/authorization-ledger-result.schema.json` (new denial-reason enum values),
  their test files, `scripts/dev/run-bundle.mjs` (pure re-export refactor only).
- Modified (this task's own record): `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`.
- **Not modified**: `scripts/dev/decision-council-kernel.mjs`, `schemas/dev/decision-council.schema.json`,
  `scripts/dev/council-quorum-proof.mjs`, `schemas/dev/council-quorum-proof.schema.json` (all
  byte-identical to `main`), `scripts/dev/fake-executor.mjs`, `scripts/dev/authorization-verifier.mjs`
  (unaffected pass-through, zero diff from the preserved baseline), any Publication Broker file,
  `docs/adr/ADR-0005-...`, `docs/adr/ADR-0006-...` (read, not amended — no new amendment was needed
  beyond what `DECISION-COUNCIL-QUORUM-PROOF-V1B` already added).

**Zero execution authority added.** `FakeExecutor` only; no shell/Git mutation/network/Publication
Broker/provider-CLI invocation/arbitrary filesystem effect exists in the loop's own runtime code; no
autonomous real task selection; no council->tool/action path. ADR-0006 remains Proposed and is not
marked Accepted by this task. No R2/R3 real Shadow Council escalation was needed or used in this
continuation (every finding was resolvable as a routine or cross-workstream integration fix).

## Required Context

- `docs/development/AUTHORIZATION_LOOP_V1A_DEMONSTRATION.md` (this task's own demonstration writeup)
- `.project/run-bundles/authorization-loop-v1a-demonstration/report.md` (evidence)
- `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`'s "Future Work" V1B addition,
  `docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md`'s "V1B Amendment" subsection
- `scripts/dev/authorization-binder.mjs`, `scripts/dev/authorization-ledger-simulator.mjs` (this
  task's own integration output — read directly)
- `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
