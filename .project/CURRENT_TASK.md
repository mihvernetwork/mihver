# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

DECISION-COUNCIL-V1A-KERNEL-SIMULATOR

## Objective

Implement the first deterministic Decision Council foundation for MIHVER: a pure, non-LLM kernel +
deterministic fake-agent simulator proving the council protocol (Rotating Proposer + Two
Independent Reviewers + Exact-Candidate Quorum) — no real LLM/provider/MCP/tool/shell/Publication
Broker connection, no Shadow Council, no execution gateway. Defines and proves the protocol only.

## Branch / Base

Branch: `feat/decision-council-v1a-kernel-simulator`.
Base: `main` at `783a9b6c6f04408a22c2d66463dd768438aee89a`.

## Status

**Complete, pending human review.**

**Changes made:**
- `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md` (new, Claude-authored) — the authoritative
  protocol definition: council topology, orchestrator/council separation, commitment-before-reveal,
  proposer selection (`rotationOrdinal % 3`), exact-candidate freezing, candidate/commitment/record
  hashing recipes (domain-separated, reusing `scripts/dev/canonical-json.mjs`), vote binding, R0–R4
  quorum semantics, risk-specific disposition, failure/no-quorum behavior, authority boundary.
- `schemas/dev/decision-council.schema.json` (new) — `$defs` for `SeatIdentity`, `CouncilConfig`,
  `DecisionRequest`, `ProposalCommitment`, `AgentProposal`, `CandidateDecision`, `AgentVote`,
  `DecisionRecord` (draft 2020-12, `additionalProperties:false` throughout except the intentionally
  open `QuorumDetail`/`proposalContent.payload`).
- `scripts/dev/decision-council-kernel.mjs` (new) — pure reducer/event-sourced state machine
  (`createSession`, `applyEvent`, `getDecisionRecord`) implementing all 9 states (`CREATED`,
  `COMMITMENT_COLLECTION`, `PROPOSAL_REVEAL`, `CANDIDATE_FROZEN`, `VOTING`, `DECIDED`, `NO_QUORUM`,
  `DENIED`, `COUNCIL_NOT_REQUIRED`), the 5 events (`SUBMIT_COMMITMENT`/`REVEAL_PROPOSAL`/
  `FREEZE_CANDIDATE`/`CAST_VOTE`/`FINALIZE`), and R0–R4 quorum math.
- `scripts/dev/decision-council-simulator.mjs` (new) — deterministic fixture helpers
  (`buildCouncilConfig`, `driveToFrozen`, `castVotesAndFinalize`, `createFixtureSession`) that only
  orchestrate the kernel's own public API; no LLM calls, no randomness.
- `tests/dev/decision-council-kernel.test.mjs` (new, 18 cases) / `tests/dev/decision-council-simulator.test.mjs`
  (new, 18 cases) — full adversarial matrix (see Verification below).
- `package.json` — added `test:decision-council-kernel` / `test:decision-council-simulator` script
  entries only (2 lines).
- `.project/CONTEXT_INDEX.md` — added two rows for the new ADR-0005 topic and its implementation
  (a genuinely new authoritative topic owner; conditional-consistency edit, synchronization only).
- `.project/CURRENT_TASK.md` / `.project/REVIEW_STATE.md` (this file and its counterpart) — task
  start and completion record.

**Codex roles used** (all real `mcp__codex__codex`/`mcp__codex__codex-reply`, never a Claude
subagent standing in for a role):
- **Scout**, thread `01a04b25-f542-7922-9447-77c25adc2b9f` (2 rounds, read-only) — repository
  convention inspection (canonical-JSON primitive, ADR/schema/test conventions, Publication Builder
  API, RUN_BUNDLE extension point, package.json scripts) before any design/implementation began.
- **Implementer**, thread `01a04b30-be90-7232-bbca-144b1f389049` (3 rounds, `workspace-write`):
  round 1 caught a genuine internal inconsistency in the ADR draft (Vote binding prose said `VOTING`
  only, the state table said `CANDIDATE_FROZEN` or `VOTING`) and correctly stopped instead of
  guessing — Claude fixed the ADR, Implementer then built all 6 files; round 2 (Claude's own
  adjudication) added 3 previously-uncovered required test cases (`DECISION_REQUEST_MISMATCH`,
  `PROPOSER_ROLE_VIOLATION`, plus an optional `WRONG_COUNCIL_EPOCH`-on-reveal case).
- **Verifier**, thread `01a04b39-9b4a-7731-9b4b-a78dea6bb0c4` (fresh session, `workspace-write`,
  never a continuation of the Implementer's thread) — independently ran and confirmed all checks
  (see Verification below).
- **Reviewer**, thread `01a04b3a-0720-7f21-9e2b-d0f9479d1c2a` (fresh session, `read-only`, authored
  none of the material) — independent adversarial review against the task's verbatim normative
  requirements (see Reviewer findings below).

**Verification** (Verifier, independent, fresh session): `node tests/dev/decision-council-kernel.test.mjs`
— 18 passed, 0 failed; `node tests/dev/decision-council-simulator.test.mjs` — 18 passed, 0 failed;
`npm run check:project-consistency` — 7/7 PASS; `npm test` (`tests/contracts/validate-contracts.mjs`)
— 170 fixtures PASS (unaffected — this task's schema is not wired into that validator, matching how
every other `schemas/dev/*.schema.json` is validated by its own dedicated test file instead, per
existing repository convention); `git status --short` showed exactly the 6 new files + modified
`package.json`, nothing else; `git diff --stat package.json` showed exactly the 2 added lines.

**Reviewer findings and adjudication**: one **MAJOR** finding — that the kernel cannot detect a
single caller submitting well-formed artifacts under multiple different `seatId`s (no cryptographic
signing/channel binding exists to authenticate that a submitted artifact truly originated from a
process distinct from any other seat's). **Adjudicated: rejected as a required code/design
change**, accepted as a documentation-precision fix. The task's own text explicitly disclaims
exactly this property for V1A ("Do not claim this proves real-world provider independence. It
proves only the typed protocol invariant that Shadow Council will later have to attest") and the
task's Stopping Rule forbids speculative hardening beyond what's reproducibly required; no signing/
authentication primitive is specified anywhere in the task, and building one now would be
Shadow-Council-shaped work this task's Non-Goals explicitly excludes. What the kernel *does*
correctly reject — and what "duplicate seat masquerading as another reviewer" means under the
task's own IDENTITY/INDEPENDENCE framing — is registering two `CouncilConfig` seats with an
identical (`provider`,`modelFamily`,`modelId`) triple under different `seatId` labels
(`DUPLICATE_SEAT_IDENTITY`, kernel-test-covered), which the Reviewer's own PASS list independently
confirmed. Applied fix: tightened `ADR-0005`'s "Risks" section so it no longer reads as claiming
more anti-masquerading protection than the design actually provides (wording-only; no schema/
kernel/simulator/test change). All 39 other PASS items from the Reviewer's independent check
(architecture, hashing, quorum math per risk, fail-closed behavior, determinism boundary,
non-goals) confirmed with no further findings.

**Authority boundary preserved**: no real provider/LLM/MCP/tool/shell call anywhere in the kernel
or simulator; no Shadow Council; no Claude-orchestrator integration; no scheduler; no sandbox
execution; no `ExecutionEnvelope`; no Publication Broker provisioning; no automatic push/PR/merge;
no operator UI; no bounded autonomy. `DecisionRecord` carries no field resembling execution
authority (explicitly asserted by a dedicated test).

**Publication:**
- Local Publication Builder authorized: yes, per this task's own explicit instruction ("prepare
  exactly one local commit through the repository publication flow"), gated on verification passing
  and review findings being adjudicated — both met.
- Remote publication: human manual fallback only (unchanged — this task does not touch that).
- Exactly one local commit, subject `feat: add deterministic decision council kernel`, via
  `scripts/dev/publication-builder.mjs`. Not pushed, no PR touched, not merged, no follow-on task
  (Shadow Council or otherwise) started.

## Required Context

- `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`
- `docs/development/AGENT_POLICY.md`, `docs/development/CODEX_ROLES.md`
- `scripts/dev/canonical-json.mjs`, `scripts/dev/publication-builder.mjs`
