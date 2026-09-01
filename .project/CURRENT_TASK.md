# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

shadow-council-candidate-gate-reliability-v1

## Objective

Repair the candidate-construction validation architecture exposed by the V8 failure. V8 failed
before `FREEZE_CANDIDATE` because a task-local mechanical gate drifted away from the provider-facing
requirements, falsely rejecting a sound proposal. This task establishes one canonical
`CandidateRequirementSpec` that generates both the provider-facing requirement rendering and the
deterministic candidate validator, so the two cannot drift apart, plus a durable non-normative
`ShadowUnfrozenProposal` artifact so a blocked freeze stays auditable. It is forward-only tooling
repair: no V8 rerun, no V9, no V1C implementation.

## Branch / Base

Branch: `fix/shadow-council-candidate-gate-reliability-v1`
Base: `main` at `3d90e0eaa9dbd65cd52112c574b1d823c598f0f8` (PR #57 merged; merge-post CI on this
exact SHA: SUCCESS)

## Scope / non-goals

Forward-only tooling repair + deterministic verification + one bounded real R2 smoke. Does not touch
V3–V8 historical Run Bundles, the Decision Council kernel, ADR-0005, `CouncilQuorumProof` semantics,
or Authorization Binder semantics. Runs no V9 exercise and hard-codes no V9 matrix into generic
library code. Implements no V1C. Grants no execution, publication, merge, or authorization authority.

## Result

`READY_FOR_PUBLICATION`.

**Core invariant established:**

```
ONE CANONICAL CandidateRequirementSpec
        │
        ├── provider-facing rendering
        └── deterministic validation
```

`HARD_GATE` (deterministic, structural/value invariants) and `COUNCIL_REVIEW` (prose, assessed by
Council voters) are kept separate; no hard gate depends on substring/regex/synonym matching over
prose. `ShadowUnfrozenProposal` is first-class durable advisory evidence recorded before candidate
admission, with zero candidate, vote, quorum, `DecisionRecord`, or authorization authority. Candidate
authority still begins only after a successful kernel `FREEZE_CANDIDATE`.

**Implementation commit:** `8c19e6aa028e64d1d86e0e608ce66e673bc5a9c2` (single local commit, 27
files: 10 source/schema/test/doc files plus the 17-file smoke Run Bundle below; not pushed, no PR).

**Gates passed:**

| Gate | Thread / evidence | Verdict |
| --- | --- | --- |
| Scout (fresh, read-only) | `01a05917-4b31-7103-876c-72e5571d281c` | `NO PROTOCOL SEMANTICS CHANGE REQUIRED` |
| Implementer + 3 remediation rounds | — | closed empty-hard-gate fail-open, `validateCandidateImpl` bypass, unaudited validator throws, op-inventory duplication, unauthenticated-spec acceptance, non-total gate-result predicate |
| Reviewer (fresh, read-only, adversarial) | `01a0593f-cc37-7d81-9693-1bdc478a85b8` | `READY_FOR_FINAL_VERIFICATION` |
| Verifier (fresh, read-only) | `01a05948-beb5-78b1-aec0-c042c03200ec` | `READY_FOR_PUBLICATION` (26/26 checks) |
| Smoke evidence verifier (fresh, read-only, from bundle bytes alone) | `01a05957-8fc7-7d02-accf-3990e775303e` | `SMOKE_EVIDENCE_VERIFIED` |

**One bounded real R2 smoke:** `shadow-council-candidate-gate-reliability-v1-smoke` — no retry, no
provider substitution, no second smoke.

| Fact | Value |
| --- | --- |
| Gate outcome | **ACCEPTED** (8/8 hard requirements evaluated, 0 failures) |
| Terminal state / disposition | **`DECIDED`** / **`COUNCIL_APPROVED`** |
| Proposer / voters | `seat-openai` (proposer); `seat-google`, `seat-anthropic` (voters); proposer did not vote (R2 rule held) |
| `candidateHash` | `sha256:1c1de1a428a380d93123237428cb5d12cda915b02713d82bf5ec56d079f38573` |
| `unfrozenProposalHash` | `sha256:fa4c792952d6e9e0e246a8a4a020ce4f4163deb98f4c25c5e8a9f4c395429727` (distinct domain/preimage from `candidateHash`; confirmed unequal) |
| DecisionRecord `recordHash` | `sha256:e2accd2e0f2c51000414ff3a257405cc13142ec6dd93a06fe9aba7bfaa28dd6f` |
| CouncilQuorumProof `proofHash` (provenance CONTEMPORANEOUS) | `sha256:30ae0a3e2309620c6ea7ef9a369d701ece45c87136b7fa8d7356c76262cf4be1` |
| `authorizationEvidenceEligible` | `true` |
| Run Bundle status | **`FINALIZED`** |
| `manifestHash` | `sha256:893ba6a63817add517bfd737263bc3689988c0817f82ab2b4e82666663d579a3` |
| Artifact count | **14** |

No retry. No V9. No V1C implementation. No execution authority. No publication authority. No human
approval.

### V8 historical state — unchanged

V8 was **not** repaired retroactively and was not rerun. Its Run Bundle
(`.project/run-bundles/authorization-ledger-v1c-r3-architecture-v8/`) remains:

| Fact | Value |
| --- | --- |
| Status | **`OPEN`** |
| `candidateHash` | `null` |
| Artifact count | **5** |
| Voter calls | **0** |
| `DecisionRecord` | **ABSENT** |
| `CouncilQuorumProof` | **ABSENT** |

V3–V7 and the PR #56 contemporaneous-quorum smoke bundle are likewise byte-unchanged. See
`DECISIONS_LOG.md`'s `AUTHORIZATION-LEDGER-V1C-R3-ARCHITECTURE-V8-FAILURE-CLOSURE` entry for V8's
own record, which this task does not alter.

## Required Context

- `.project/run-bundles/shadow-council-candidate-gate-reliability-v1-smoke/`
- `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v8/` (unchanged; historical)
- `.project/REVIEW_STATE.md`
- `.project/DECISIONS_LOG.md`
- `.project/PROJECT_STATE.md`
- `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`
- `docs/development/AGENT_POLICY.md`
- `docs/development/REVIEW_PROTOCOL.md`

## Status

**Implementation, review, verification and bounded real smoke all COMPLETE. Human approval
PENDING — not requested, not granted.** Nothing has been pushed; no PR exists. Publication remains
manual per `CLAUDE.md`'s "Publication" section (remote publication automation is not available).

Primary next action: **`CANDIDATE_GATE_RELIABILITY_PUBLICATION_PENDING_HUMAN_REVIEW`** — human review
of commit `8c19e6aa028e64d1d86e0e608ce66e673bc5a9c2` and the finalized smoke Run Bundle, then a
manual publication decision.

New next architectural action (**not yet authorized**): `V9_NEW_R3_ARCHITECTURE_DECISION`. Sequence:
candidate-gate reliability publication → merge-post CI → human explicitly authorizes a V9 task → V9
fresh `DecisionRequest` → new proposer invocation → new frozen candidate → 3-seat R3 Council →
durable `DecisionRecord` → durable contemporaneous `CouncilQuorumProof` → fresh human
pre-authorization audit. No V9 task may start without a separate, explicit human instruction; V1C
implementation remains likewise unauthorized.
