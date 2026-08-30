# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

DECISION-COUNCIL-QUORUM-PROOF-V1B

## Objective

This task exists because independent re-verification work for the paused
`AUTHORIZATION-LOOP-FOUNDATION-V1A` task (parked, not resumed here) exposed a real persistence/
provenance gap: ADR-0005's frozen, Accepted Decision Council V1A `DecisionRecord` self-consistently
proves its own content (`recordHash`) but does not carry `CouncilConfig` seat identity
(`provider`/`modelFamily`), so a downstream Authorization verifier cannot independently recompute
R1 diversity, R2 proposer exclusion, or R3 3-of-3 quorum from a `DecisionRecord` alone — it would
have to trust the record's self-consistency. A real R2 Shadow Council escalation selected
architecture Option C (hash-bound `CouncilConfig` + separate quorum proof) to close this gap.

## Branch / Base

Branch: `feat/decision-council-quorum-proof-v1b`.
Base: `main` at `db263af189093759294e57b86fd02af761f69c15` (PR #44, ADR-0006 design).

## Status

**Complete, pending human review.**

**Design selected (Scout + independent Reviewer, then a security-focused second Reviewer pass):** a
single sidecar `CouncilQuorumProof` artifact, plus a `CouncilEpochRegistry` trust anchor, added
alongside the frozen, unmodified ADR-0005 kernel/schema (`scripts/dev/decision-council-kernel.mjs`,
`schemas/dev/decision-council.schema.json` — zero diff vs `main`, confirmed). The hash graph is a
non-circular DAG: `CouncilConfig -> councilConfigHash -> CouncilQuorumProof -> decisionRecordHash <-
DecisionRecord.recordHash` — the proof references the record; the record never references the proof.
`DecisionRecord` itself was NOT versioned/mutated (Option A, a `DecisionRecordV2`, was considered and
rejected as an avoidable, circularity-risking mutation of frozen evidence).

**Implemented (Codex Implementer, then one fix round after axis review):**
- `scripts/dev/council-quorum-proof.mjs` — `buildCouncilQuorumProof`, `verifyCouncilQuorumProof`,
  `classifyDecisionRecordEvidence`, `computeCouncilConfigHash`, `computeProofHash`,
  `makeRegistryEntry`, `lookupTrustedConfigHash`. Pure, deterministic, no network/fs/Date.now/
  Math.random, reuses `canonicalizeJson`.
- `schemas/dev/council-quorum-proof.schema.json` — `$ref`s `schemas/dev/decision-council.schema.json`
  rather than duplicating `CouncilConfig`/`DecisionRequest`/`AgentVote` shapes.
- `tests/dev/council-quorum-proof.test.mjs` — 25 tests, including the full adversarial matrix (forged
  provider/modelFamily identity, config substitution, proof attached to a different DecisionRecord,
  candidateHash/vote substitution, duplicate seat/identity, wrong epoch/proposer, R1/R2/R3 negative
  cases, unknown proof version, historical-V1-no-proof, reconstructed-mislabeled-as-contemporaneous,
  one-byte mutations, and a circular-hash-graph regression check).
- `package.json` — added standalone `test:council-quorum-proof` script (not added to the aggregate
  `npm test`, matching `test:decision-council-kernel`'s own existing precedent of staying standalone).

**Fixed after axis review (two real findings):**
1. Axis A: `DecisionRecord` shape wasn't validated before hashing, so an extra/injected field (e.g.
   a proof-shaped field) wasn't rejected — added exact-shape validation before any hash comparison in
   both the builder and verifier.
2. Axis B: a `decisionRecord.proposerSeatId === null` bypass in the proposer-binding check would have
   let a forged, correctly-hashed R1/R2/R3 record skip proposer verification — changed to strict
   equality, no null bypass.

**Legacy/compatibility matrix (fail-closed, no reconstruction implemented):**
- `V1_HISTORICAL_NO_PROOF` — a historical `DecisionRecord` with no proof; never
  `authorizationEvidenceEligible`, regardless of `recordHash` validity.
- `V1_PROOF_CAPABLE_CONTEMPORANEOUS` — a `DecisionRecord` + a valid, `CONTEMPORANEOUS`-provenance
  `CouncilQuorumProof`; eligible iff `verifyCouncilQuorumProof` passes every check.
- `V1_PROOF_RECONSTRUCTED` — the `provenanceClass: "RECONSTRUCTED"` enum value is defined for future
  use but no code path in this task ever produces one; if one is ever presented, it is always
  ineligible even if otherwise fully hash-valid.
- No fabrication/backfill of provider/model provenance from a bare `DecisionRecord` exists anywhere.

**ADR work:**
- `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md` — pure addition under "Future Work" describing the
  V1B sidecar and its non-circularity rule. Status remains **Accepted**; its Acceptance decision was
  not reopened; no R0–R4/topology/authority-boundary text was changed (confirmed: diff vs `main` is
  additions-only).
- `docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md` — one new subsection ("V1B Amendment —
  Council Quorum Proof Requirement") stating that a future implementation of this design must require
  and independently verify a `CONTEMPORANEOUS`, fully-eligible `CouncilQuorumProof` wherever the
  applicable policy needs independently provable council legitimacy, and that a legacy/self-consistent
  `DecisionRecord` alone is insufficient in that case. Status remains **Proposed**; this task does not
  mark it Accepted and grants it no execution authority.

**Review:** four fresh, independent, read-only Codex Reviewers (axis A hash-graph/versioning, axis B
quorum-recomputation correctness, axis C legacy/provenance, axis D confused-deputy resistance) each
gave APPROVE or APPROVE_WITH_CHANGES (two real findings, both fixed — see above); a fifth, fresh,
exact-final Reviewer then gave `READY_FOR_FINAL_VERIFICATION`. No finding at any point required
changing actual R1/R2/R3 quorum semantics (no `PROTOCOL_SEMANTICS_BLOCKER` was raised).

**Verification:** a fresh, read-only Codex Verifier confirmed: frozen kernel/schema zero-diff;
ADR-0005 additions-only diff; ADR-0006 Status still Proposed; no `AuthorizationEnvelope`/Ledger/Binder
implementation copied or resumed; the new sidecar is pure (no network/shell/git/publication/provider
calls); the new proof test suite and the existing kernel/simulator suites are green; `git diff --check`
is clean. Shadow Council and ContextPack/Run Bundle/project-consistency/`npm test` failures observed
in its restricted sandbox were independently re-checked directly in this session and confirmed to be
**pre-existing environment gaps unrelated to this branch's changes** (`node_modules` is entirely
absent in this worktree — `ajv`/`ajv-formats` are listed in `package.json` devDependencies but never
installed; the Shadow Council CLI-transport `mkdtemp EPERM` failures are a sandbox restriction, not a
code regression) — this branch's diff vs `main` touches no dependency, install, or Shadow Council file.

**Changes made:**
- New: `scripts/dev/council-quorum-proof.mjs`, `schemas/dev/council-quorum-proof.schema.json`,
  `tests/dev/council-quorum-proof.test.mjs`.
- Modified: `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md` (Future Work addition only),
  `docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md` (one new subsection), `package.json` (one new
  standalone test script), `.project/PROJECT_STATE.md`, `.project/CURRENT_TASK.md` (this file).
- **Not modified**: `scripts/dev/decision-council-kernel.mjs`, `schemas/dev/decision-council.schema.json`
  (frozen V1A kernel/schema — zero diff vs `main`), any Shadow Council file, any Authorization
  Loop/Binder/Ledger file, `AUTHORIZATION-LOOP-FOUNDATION-V1A`'s parked worktree/branch (untouched,
  not resumed), the Publication Broker (source, docs, or schemas), `tools/publication-broker/`.

**Zero execution authority added.** No executor exists; the new sidecar only compiles/verifies proof
artifacts as pure data; no provider/model API call, shell command, Git/network operation, or
publication-path code was added by the sidecar itself. This session's own work beyond editing these
files was limited to dispatching read-only or worktree-scoped Codex Scout/Implementer/Reviewer/
Verifier sessions.

## Required Context

- `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`'s "Future Work" V1B addition (this task's design
  summary) and `scripts/dev/council-quorum-proof.mjs` (this task's own output — read directly)
- `docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md`'s "V1B Amendment" subsection
- `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
