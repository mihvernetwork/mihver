# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

SHADOW-COUNCIL-VOTE-RATIONALE-V1B

## Objective

A real R3 Shadow Council architecture exercise (`AUTHORIZATION-LEDGER-V1C-R3-ARCHITECTURE-DECISION`)
ended `NO_QUORUM` (`seat-openai` REJECT, `seat-anthropic`/`seat-google` APPROVE), and a forensic
follow-up found the rejection rationale was irrecoverably lost: the reviewer output contract forced
`{voteValue}` only, and the attestation retained only a one-way `outputHash` of the raw provider
response. This task adds a Shadow-Council-only advisory `ShadowVoteAssessment` evidence layer so a
future REJECT/ABSTAIN (or APPROVE) is durably diagnosable, without touching ADR-0005's frozen
kernel/quorum/`DecisionRecord` semantics in any way.

## Branch / Base

Branch: `feat/shadow-council-vote-rationale-v1b`.
Base: `main` at `2c87a5780e81e832d9074dd2b74401b8a0caf2e6` (PR #46 merged: Authorization Loop
Foundation V1A).

## Status

**Complete, pending human review.**

**Phase 0 Scout:** confirmed a clean sidecar fix is fully achievable with zero changes to
`AgentVote`/`DecisionRecord`/`CandidateDecision`/the kernel/`schemas/dev/decision-council.schema.json`
— no `PROTOCOL_SEMANTICS_BLOCKER`.

**Implementation (3 workstreams, disjoint files, 1 remediation round):**
- **A** (`scripts/dev/shadow-council-packet.mjs`, new `scripts/dev/shadow-council-vote-assessment.mjs`,
  `schemas/dev/shadow-vote-assessment.schema.json`): reviewer packets now require
  `{voteValue, rationale}` under artifact `ShadowVoteAssessment` (rationale: non-empty, ≤1200 JS
  chars, ≤4096 UTF-8 bytes, fail-closed on missing/empty/whitespace/over-limit/extra fields); a new
  pure module builds/verifies/derives the assessment (`buildShadowVoteAssessment`,
  `computeAssessmentHash`, `verifyAssessmentHash`, `deriveAgentVote`). Proposer contract (`{summary,
  payload}`) unaffected.
- **B** (`scripts/dev/shadow-council-harness.mjs`): each reviewer call now constructs a real
  `ShadowVoteAssessment` (binding `decisionRequestId`/`candidateHash`/`seatId`/`councilEpochId`/
  `packetHash`/`outputHash`/`attestationHash`) and derives the frozen `AgentVote` from it via
  `deriveAgentVote` — never a second, independent construction. `runVotingFlow`/`runShadowExercise`
  now return an ordered `assessments` array alongside `votes`/`packets`/`attestations`.
  `deriveAgentVote` verifies `assessmentHash` before projecting (fixed after review — see below).
- **C** (new `scripts/dev/shadow-council-run-bundle-evidence.mjs`): `runShadowExerciseWithEvidence`
  wraps the pure harness to durably persist every accepted assessment as canonical JSON and return a
  complete, schema-valid `EvidenceManifest` `ARTIFACT` entry per seat — real Run Bundle integration,
  not a manual/optional afterthought.

**Review (4 fresh axis Reviewers, 1 remediation round, 1 exact-final Reviewer):**
- Axis A (protocol contamination): `APPROVED_FOR_INTEGRATION` — confirmed `deriveAgentVote` projects
  exactly the 5 frozen `AgentVote` fields, the frozen kernel's own `exactKeys` check on `AgentVote`
  is defense-in-depth against any accidental contamination, and rationale provably has zero effect
  on quorum/`DecisionRecord`/`recordHash`.
- Axis B (evidence integrity): found a real integrity gap — `deriveAgentVote` did not call
  `verifyAssessmentHash` before projecting, so a tampered (but unverified) assessment could still
  produce a kernel-valid vote. **Fixed**: `deriveAgentVote` now verifies first and throws
  `ASSESSMENT_HASH_MISMATCH` on any mismatch (this is a hardening fix inside the new sidecar module
  only — it does not touch ADR-0005).
- Axis C (forensic usability): found the core wiring gap — `writeShadowVoteAssessmentEvidence`
  existed but nothing in the real exercise-running path ever called it, so rationale would still be
  lost by default. **Fixed** via workstream C's `runShadowExerciseWithEvidence` wrapper (see above).
- Axis D (prompt/output safety): confirmed the reviewer prompt requests only concise decision
  grounds; one wording gap ("hidden reasoning" not explicitly named) and one UTF-8-byte-limit test
  gap were found and fixed.
- Exact-final Reviewer: `READY_FOR_FINAL_VERIFICATION` after one additional test-coverage fix (the
  end-to-end durable-evidence test originally only exercised APPROVE; extended to prove REJECT/
  ABSTAIN rationale round-trips through a real, finalized Run Bundle read back from disk).

No finding at any point required changing ADR-0005's normative `AgentVote`/`DecisionRecord`/quorum
semantics — no `PROTOCOL_SEMANTICS_BLOCKER` was ever raised.

**Final Verifier:** confirmed ADR-0005/kernel/schema, `council-quorum-proof.mjs`/schema, and the
Authorization Loop (Binder/Ledger/Loop) all byte-identical to `main`; rationale invariance proven;
malformed-rationale fail-closed tests present and green; `scripts/dev/run-bundle.mjs` itself
untouched; no execution/publication authority; no real provider calls during any deterministic test
(all use injected `spawnSeatImpl`/`parseSeatOutputImpl`); `npm run check:project-consistency` green;
`git diff --check` clean. Two suites failed only in the Verifier's own restricted sandbox (`EPERM` on
`mkdtemp`) — independently re-run and confirmed green in this session's own shell.

**Real bounded smoke exercise** (`shadow-vote-rationale-smoke-1`, R1, all 3 real seats, 1 proposal +
3 votes, no semantic retry, no provider substitution): every real provider returned a valid
`{voteValue, rationale}` payload on the first attempt (no `PROVIDER_RESPONSE_CONTRACT_BLOCKER`); 3/3
APPROVE on a harmless synthetic Markdown-style-guide question; each seat's rationale durably
persisted and bound into a finalized Run Bundle at
`.project/run-bundles/shadow-council-vote-rationale-v1b-smoke/` — read back from disk and confirmed
present with no live process required. See
`docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`'s new "Exercise 3" section.

**Changes made:**
- New: `scripts/dev/shadow-council-vote-assessment.mjs`, `schemas/dev/shadow-vote-assessment.schema.json`,
  `scripts/dev/shadow-council-run-bundle-evidence.mjs`, `tests/dev/shadow-council-run-bundle-evidence.test.mjs`,
  `.project/run-bundles/shadow-council-vote-rationale-v1b-smoke/` (finalized Run Bundle).
- Modified: `scripts/dev/shadow-council-packet.mjs`, `scripts/dev/shadow-council-harness.mjs`,
  `schemas/dev/shadow-decision-packet.schema.json`, `tests/dev/shadow-council-packet.test.mjs`,
  `tests/dev/shadow-council-harness.test.mjs`, `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`,
  `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`, `.project/PROJECT_STATE.md`.
- **Not modified**: `scripts/dev/decision-council-kernel.mjs`, `schemas/dev/decision-council.schema.json`,
  `scripts/dev/council-quorum-proof.mjs`, `schemas/dev/council-quorum-proof.schema.json`,
  `scripts/dev/authorization-binder.mjs`, `scripts/dev/authorization-ledger-simulator.mjs`,
  `scripts/dev/authorization-loop.mjs`, `scripts/dev/run-bundle.mjs`,
  `scripts/dev/shadow-council-cli-transport.mjs`, `scripts/dev/shadow-council-attestation.mjs`,
  `docs/adr/ADR-0005-...`, `docs/adr/ADR-0006-...` (all byte-identical to `main`).

**Zero quorum semantic change; zero execution authority.** Rationale is Shadow-Council-only advisory
evidence with no path into quorum, hashing, or authorization eligibility. No shell/Git/network/
Publication Broker/provider-CLI-beyond-the-pre-existing-adapter/arbitrary filesystem effect was
added. The historical R3 `NO_QUORUM` exercise was not reinterpreted and `seat-openai`'s lost
rationale was not fabricated.

## Required Context

- `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`'s "Advisory rationale evidence and Run Bundle
  integration" and "Exercise 3" sections
- `scripts/dev/shadow-council-vote-assessment.mjs`, `scripts/dev/shadow-council-run-bundle-evidence.mjs`
  (this task's own output — read directly)
- `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md` (frozen/unmodified — `AgentVote`'s exact shape)
- `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
