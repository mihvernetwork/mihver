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

Task: shadow-council-contemporaneous-quorum-evidence-v1
Branch: `fix/shadow-council-contemporaneous-quorum-evidence-v1`
Target: main at `3b1ec8f30b2e85b3f07e8cfb2b1274038e02c96b` (PR #55 merged; merge-post CI SUCCESS)
Publication:
- Local publication: exactly ONE local commit is to be created on this branch, subject
  `fix: persist contemporaneous council quorum evidence`. No push, no PR, no merge.
- remote publication automation: NOT AVAILABLE; human manual publication is the fallback.
- Human approval: **PENDING** — not requested, not granted.

**Codex Scout** (thread `01a056cc-c285-7c43-a496-91e93d85feaf`): no blockers.

**Codex Reviewer, round 1** (thread `01a056de-5c28-7e22-b50b-a69f4e373d83`):
`REMEDIATION_REQUIRED` — durable vote ordering came from process memory and three test-matrix
coverage gaps remained. A fresh Implementer (thread `01a056e1-b5b7-7590-a52f-cd5da832bf13`)
remediated all four findings.

**Codex Reviewer, round 2 (fresh)** (thread `01a056e7-44e7-76c0-9861-594708ee735b`): confirmed
the four remediations. It raised two findings judged out of scope: the pre-existing legacy
`runShadowExerciseWithEvidence` helper writes no Run Bundle, and empty-reviewer-set `NO_QUORUM`
authorizes nothing, while changing it would alter frozen quorum semantics.

**Codex Verifier (fresh)** (thread `01a056eb-abfb-7913-bd1c-d655814392f2`):
`READY_FOR_PUBLICATION`; independently agreed both out-of-scope judgments are correct and
non-blocking. This technical verdict is not human approval.

**Evidence/provenance gate: SATISFIED for the forward-only pipeline.** The canonical-config gate
fails closed before provider budget is spent; the exact `DecisionRequest` and `CouncilConfig` are
durably written and manifest-bound before provider invocation; terminal proof construction and
verification use durable artifacts re-read from disk and persisted configuration seat order.

**Real bounded R2 smoke** (`shadow-council-contemporaneous-quorum-evidence-v1-smoke`): one attempt,
no retry and no provider/model substitution; `DECIDED` / `COUNCIL_APPROVED`,
`reasonCode R2_QUORUM_MET`, 2/2 reviewer approvals (`seat-anthropic`, `seat-google`), with proposer
`seat-openai` correctly excluded. The FINALIZED Run Bundle has 12 artifacts and
`manifestHash sha256:b0a8ba3faa6bd6124b49aa7a551f57b73b71e0f9baca0e7c148e129f24481e1f`; its
`recordHash` is `sha256:c4b6eca41c3d22505ebfdd41895952b7e4868a3e0a2b2c9e2cfa8a0a8caec61e`,
`councilConfigHash` is `sha256:be89b567427f125087168184bcaebf07f04ac361479bd5e2c11d71bea26229ce`,
and `proofHash` is `sha256:6c69f74e41c65b2e315151c44e15e56deb473fa9a1d9b504b0bef43cc98bda88`
with `provenanceClass CONTEMPORANEOUS`.

All provider invocations, the Council run, and pipeline persistence succeeded on the first and only
attempt. The initial ad-hoc smoke driver failed only at finalization because it omitted `finalizedAt`
(`RUN_BUNDLE_FINALIZE_FAILED:FINALIZED_AT_REQUIRED`); this was a throwaway-driver defect, not an
evidence-pipeline or provider/Council failure. The bundle was finalized without new evidence or a new
provider invocation; no second smoke ran. Finalized-byte-only verification re-verified every content
hash, rebuilt and matched the persisted proof, recomputed the proof/config/record hashes and
proposer, confirmed `authorizationEvidenceEligible === true`, and confirmed the persisted
`DecisionRecord` has no proof/proofHash reference.

**Deterministic validation: green, no `FAIL` lines.** Includes `npm test` (170 fixtures),
`council-quorum-proof` (25), `decision-council-kernel` (18), `run-bundle` (17),
`shadow-council-harness` (32), `shadow-council-cli-transport` (10), all three shadow-council
evidence suites, `authorization-binder` (23), `authorization-loop` (13),
`decision-council-simulator` (18), `project-consistency` (19 groups),
`check:project-consistency`, `context-pack` (115), and `publication-builder` (42).

Frozen/unmodified: ADR-0005, ADR-0006, `scripts/dev/decision-council-kernel.mjs`,
`scripts/dev/council-quorum-proof.mjs`, `schemas/dev/council-quorum-proof.schema.json`,
`schemas/dev/decision-council.schema.json`, `scripts/dev/shadow-council-vote-assessment.mjs`, and
Authorization Binder semantics. No V1C implementation; no V8. Historical Run Bundles V3-V7 are
byte-unchanged and not repaired; no retroactive `CONTEMPORANEOUS` proof is permitted. The locally
derived registry entry is a DEVELOPMENT-TIME structural check only, not the future privileged
`CouncilEpochRegistry` trust anchor; future privileged `authledgerd` must independently compare
`councilConfigHash` against its trusted registry. No execution, publication, merge, or autonomy
authority is granted.
