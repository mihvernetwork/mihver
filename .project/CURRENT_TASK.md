# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

SHADOW-COUNCIL-FAILURE-EVIDENCE-V1

## Objective

A real R3 Shadow Council architecture-decision exercise attempt (`authorization-ledger-v1c-r3-arch-decision-2`,
`AUTHORIZATION-LEDGER-V1C-R3-ARCHITECTURE-DECISION-V2`) hit `MALFORMED_SEAT_OUTPUT` mid-voting when a
real seat's response didn't parse into the (PR #47) `{voteValue, rationale}` contract. Because the
existing evidence writer only persisted data after a fully successful exercise return, that entire
attempt's forensic evidence — which seat failed, at what stage, why structurally — was silently and
irrecoverably lost. This task adds a Shadow-Council-only, advisory `ShadowSeatInvocationFailure`
evidence layer, written incrementally via synchronous harness hooks, so a future failure of this kind
is durably diagnosable. This task does NOT rerun the V1C architecture decision itself.

## Branch / Base

Branch: `feat/shadow-council-failure-evidence-v1`.
Base: `main` at `18031989a895a6a85b1b34a9867247a680da9176` (PR #47 merged: Shadow Council vote
rationale).

## Status

**Complete, pending human review.**

**Phase 0 Scout:** mapped every throw site across the real call path (transport/parse/attestation/
admission/Shadow-Council-JSON/response-shape/assessment-validation/vote-derivation/kernel-event/
run-postcondition) and confirmed a clean advisory sidecar — zero changes to ADR-0005's frozen
kernel/schema/`AgentVote`/`DecisionRecord`/`CandidateDecision`, `CouncilQuorumProof`, or the
Authorization Loop — fully satisfies the requirement; the existing Run Bundle OPEN/incremental-append
model already honestly represents a partial/failed exercise, so no
`RUN_BUNDLE_FAILURE_REPRESENTABILITY_BLOCKER` was raised.

**Implementation (3 workstreams, 1 remediation round after 4-axis review):**
- **A** (new `scripts/dev/shadow-council-invocation-failure.mjs`, `schemas/dev/shadow-seat-invocation-failure.schema.json`):
  a pure, domain-hashed `ShadowSeatInvocationFailure` artifact (`buildShadowSeatInvocationFailure`,
  `computeInvocationFailureHash`, `verifyInvocationFailureHash`) binding `seatId`, `provider`,
  `requestedModelId`, `invocationRole`, `candidateHash` (null only for the pre-freeze proposer stage),
  `stage` (an 11-value closed taxonomy), `errorCode`/`details`, packet/invocation-config/attestation/
  output hashes (each hash-or-null), stdout/stderr byte lengths, and any `assessmentFailure` detail —
  never a raw stdout/stderr string.
- **B** (`scripts/dev/shadow-council-harness.mjs`): added synchronous `opts.hooks`
  (`onPacketBuilt`/`onAttestationAdmitted`/`onAttestationRejected`/`onAssessmentBuilt`/
  `onInvocationFailure`) firing at the exact moment each stage completes or fails, classifying every
  throw site precisely and building a real `ShadowSeatInvocationFailure` before the original error
  (unchanged in type/message) propagates. Public API/return shape unchanged; rationale still has zero
  effect on quorum/`DecisionRecord` (pre-existing invariance test untouched, still passing).
- **C** (`scripts/dev/shadow-council-run-bundle-evidence.mjs`): `runShadowExerciseWithDurableEvidence`
  wires those hooks to write ONE `writeRunBundle({..., finalize:false})` call per completed stage —
  incrementally, synchronously, before any later throw can erase it — so a crash/failure mid-exercise
  still leaves a valid, inspectable, `OPEN` Run Bundle with every already-completed seat's evidence.

**Four-axis adversarial review** (fresh Reviewers) — two real, fixed findings each on axes B/C, none on A/D:
- Axis A (protocol contamination): `APPROVED_FOR_INTEGRATION` — failure evidence has no path into
  `AgentVote`/quorum; only `deriveAgentVote(assessment)` feeds `CAST_VOTE`.
- Axis B (evidence durability): found (1) a failed exercise could still be finalized if the caller
  passed `finalize:true`, defeating "stay OPEN on failure"; (2) a throwing caller-supplied
  `onInvocationFailure` hook could mask/replace the original harness error. **Both fixed**: failure
  paths can never finalize regardless of caller option; a caller hook's own exception is now isolated
  (attached non-destructively) and never replaces the original thrown error.
- Axis C (forensic usefulness): found (1) no `provider`/`requestedModelId` in the failure artifact
  (required cross-referencing static code); (2) `SHADOW_RESPONSE_SHAPE` failures had identical empty
  `details` for "missing rationale" vs "extra field"; (3) an `ADMISSION`-stage failure's
  `attestationHash` referenced no durable artifact; (4) `buildInvocationArgv` failures were
  misclassified `SPAWN` instead of `INVOCATION_CONFIG`; (5) `FINALIZE`/`KERNEL_EVENT`/
  `RUN_POSTCONDITION` failures nulled out hash/length metadata that was actually available. **All
  fixed**: `provider`/`requestedModelId` added as required fields; response-shape details now name
  exact missing/extra fields; a new `onAttestationRejected` hook durably persists rejected
  attestations; argv failures reclassified; available metadata now carried forward instead of nulled.
- Axis D (output safety): `APPROVED_FOR_INTEGRATION` — raw stdout/stderr never persisted, only
  hashes/lengths; `details` fields are always small, structured, machine-generated data, never
  arbitrary provider text; no chain-of-thought/hidden-reasoning prompt was introduced (the reviewer
  prompt itself, `shadow-council-packet.mjs`, is untouched by this task).

No finding at any point required changing ADR-0005/`CouncilQuorumProof`/Authorization Loop semantics
— `PROTOCOL_SEMANTICS_BLOCKER` was never triggered.

**Final Verifier:** confirmed ADR-0005/kernel/schema, `CouncilQuorumProof`/schema, Authorization Loop,
`shadow-council-vote-assessment.mjs`, and `shadow-council-packet.mjs`/`shadow-council-cli-transport.mjs`
all byte-identical to `main`; the pre-existing rationale-invariance test unmodified and passing; a
failed exercise's durable mixed-evidence test proven (seat 1's evidence survives seat 2's failure,
bundle stays `OPEN`, no `DecisionRecord`); no execution/publication authority; `npm run
check:project-consistency` green; full test matrix green; `git diff --check` clean. Sandbox-only
`EPERM`-on-`mkdtemp` failures in the Verifier's own restricted environment were independently
re-confirmed green in this session's own shell.

**Real bounded smoke exercise** (`shadow-failure-evidence-smoke-1`, R1, all 3 real seats, no
misbehavior deliberately provoked, no semantic retry): proved the durable per-stage journal on the
NORMAL success path — 11 evidence entries (4 packets, 4 attestations, 3 assessments) written
incrementally and the bundle correctly finalized after a genuine 3/3 `COUNCIL_APPROVED` result. The
negative/failure path remains proven only by the deterministic test suite (per this task's own
instruction not to deliberately prompt a provider to misbehave). See
`docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`'s new "Durable invocation-failure evidence" section
and "Exercise 4".

**Changes made:**
- New: `scripts/dev/shadow-council-invocation-failure.mjs`, `schemas/dev/shadow-seat-invocation-failure.schema.json`,
  `tests/dev/shadow-council-invocation-failure.test.mjs`, `tests/dev/shadow-council-failure-evidence.test.mjs`,
  `.project/run-bundles/shadow-council-failure-evidence-v1-smoke/` (finalized Run Bundle).
- Modified: `scripts/dev/shadow-council-harness.mjs`, `scripts/dev/shadow-council-run-bundle-evidence.mjs`,
  `tests/dev/shadow-council-harness.test.mjs`, `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`,
  `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`, `.project/PROJECT_STATE.md`.
- **Not modified**: `scripts/dev/decision-council-kernel.mjs`, `schemas/dev/decision-council.schema.json`,
  `scripts/dev/council-quorum-proof.mjs`, `schemas/dev/council-quorum-proof.schema.json`,
  `scripts/dev/authorization-binder.mjs`, `scripts/dev/authorization-ledger-simulator.mjs`,
  `scripts/dev/authorization-loop.mjs`, `scripts/dev/shadow-council-vote-assessment.mjs`,
  `scripts/dev/shadow-council-packet.mjs`, `scripts/dev/shadow-council-cli-transport.mjs`,
  `scripts/dev/run-bundle.mjs`, `docs/adr/ADR-0005-...`, `docs/adr/ADR-0006-...` (all byte-identical
  to `main`).

**The V1C architecture Council exercise was NOT rerun by this task.** The historical
`authorization-ledger-v1c-r3-arch-decision-2` `COUNCIL_EVIDENCE_BLOCKER` outcome is unchanged and not
reinterpreted; this task does not claim to know which seat failed, at what stage, or why in that
specific incident — that is exactly the information this task's new capability exists to capture
*going forward*, not retroactively. Zero execution authority; zero quorum semantic change.

## Required Context

- `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`'s "Durable invocation-failure evidence" and
  "Exercise 4" sections
- `scripts/dev/shadow-council-invocation-failure.mjs`, `scripts/dev/shadow-council-run-bundle-evidence.mjs`
  (this task's own output — read directly)
- `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md` (frozen/unmodified)
- `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
