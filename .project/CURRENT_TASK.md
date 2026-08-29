# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

SHADOW-COUNCIL-V1A-LIFECYCLE-REMEDIATION

## Objective

Recover the technically-valid but lifecycle-invalid Shadow Council V1A CLI harness result (prior
local commit `5d83aa5` on the separate branch `feat/shadow-council-v1a-cli-harness`, quarantined —
see `.project/REVIEW_STATE.md`'s Process Incident) by re-implementing the same, already-reviewed
architecture through compliant provenance (Codex Scout → Codex Implementer → Codex Reviewer →
Codex Verifier, Claude as orchestrator/adjudicator/integrator only), running exactly two real,
human-launched Shadow Council exercises (one R1, one R2) against the frozen, unmodified Decision
Council V1A kernel, finalizing that evidence into a fresh Run Bundle and durable exercise document,
obtaining a post-exercise adversarial review against all seven ADR-0005 Acceptance Gate criteria
plus a final independent verification, and preparing exactly one local publication commit. Does not
change the Decision Council protocol's topology, quorum rules, candidate/vote binding,
`DecisionRecord` meaning, kernel, simulator, or schema. Does not change ADR-0005's Status (remains
**Proposed**). Does not start ADR-0005 acceptance or execution integration. Does not push, open/
modify a PR, or merge.

## Branch / Base

Branch: `feat/shadow-council-v1a-cli-harness-remediated`.
Base: `main` at `2fae893d89c8debded14fb7ba23adfcad2055133`.
Reference only (never merged from, never cherry-picked, not pushed, not gating evidence): local
commit `5d83aa5` on the separate, quarantined branch `feat/shadow-council-v1a-cli-harness`.

## Status

**Complete, pending human review.** Implementation, both real exercises, the finalized Run Bundle,
the post-exercise adversarial review, and final verification are all done. A publication commit is
prepared per this task's own Publication section (see below).

**Real exercises (human-launched, exactly once each, zero retries, zero substitution):**

- **Exercise 1 (R1)** — `shadow-exercise-remediated-r1-1`. Proposer `seat-openai`
  (`rotationOrdinal: 0`), all 3 seats voted APPROVE. `contextHash`
  `sha256:77112af6e80b65e313913a970f6853c9cf4de5b1b94df28db78740f0b7981430`, `repositoryHead`
  `2fae893d89c8debded14fb7ba23adfcad2055133`, `candidateHash`
  `sha256:b7df378ac69e96534a9abd661749af741e3c1008838dd2c2cd4fb6ff602a8583`. `DecisionRecord`:
  `DECIDED` / `COUNCIL_APPROVED`, `recordHash`
  `sha256:090171b1beca5d8f46fe089d3f29829b431a2c898ac10ce9e976a0fe888f503a`. 4 real primary-model
  calls (1 proposal + 3 votes).
- **Exercise 2 (R2)** — `shadow-exercise-remediated-r2-1`. Proposer `seat-anthropic`
  (`rotationOrdinal: 1`, known before execution, excluded from voting — recorded `MISSING`), 2
  reviewer seats (`seat-openai`, `seat-google`) voted APPROVE. `contextHash`
  `sha256:d2c9228d2b64439cf3233f3e296cd75cbc120a429d8ce929139ad77503d15d07`, `repositoryHead`
  `2fae893d89c8debded14fb7ba23adfcad2055133`, `candidateHash`
  `sha256:09da78279a1d2a3ffb3c97926cbbdbfd7b95f7c442b6fa783118a917753c4fb6`. `DecisionRecord`:
  `DECIDED` / `COUNCIL_APPROVED`, `recordHash`
  `sha256:a64c60c0ebd7412331fb8df0219cc2cc5d4e60c3673240fee1842623c00a198a`. 3 real primary-model
  calls (1 proposal + 2 reviewer votes).
- **Total: exactly 7 real primary-model calls** (target 7, hard max 8), zero retries, zero
  provider/model substitution. All candidate/record/attestation hashes independently recomputed by
  Claude directly from raw file bytes using the real, unmodified kernel/attestation primitives —
  not merely trusted from the harness's printed summary — and independently reconfirmed a second
  time by the post-exercise adversarial Reviewer with identical results.
- **Disclosed limitation**: R1 and R2 bind two *different* `ProjectContextPack` `contextHash`
  values (identical `repositoryHead`) because Exercise 1's output file changed the working tree
  before Exercise 2 compiled its own live pack. The post-exercise Reviewer independently judged
  this an operational/evaluation limitation, not a protocol-integrity failure — each exercise's own
  internal consistency (candidate/vote/record binding) is unaffected. Full detail in
  `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`.

**Changes made:**
- `schemas/dev/shadow-decision-packet.schema.json`, `schemas/dev/shadow-seat-attestation.schema.json`
  (new) — `ShadowDecisionPacket v1` / `ShadowSeatAttestation v1` contracts.
- `scripts/dev/shadow-council-packet.mjs`, `scripts/dev/shadow-council-attestation.mjs`,
  `scripts/dev/shadow-council-cli-transport.mjs`, `scripts/dev/shadow-council-harness.mjs` (new) —
  packet builder/hash, attestation/admission/seat-origin-registry, the fixed seat↔provider↔CLI
  adapter table + child-process transport + per-provider output parsers, and the real
  proposer/voting flow driving the unmodified kernel. This exact code produced both real exercises.
- `tests/dev/shadow-council-{packet,attestation,cli-transport,harness}.test.mjs` (new) — 26
  deterministic tests (62 total with the frozen kernel/simulator suites), all fake-transport-only.
- `package.json` — adds the four corresponding `test:shadow-council-*` npm scripts only; no
  dependency/devDependency change.
- `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md` (new) — durable, audit-safe exercise record.
- `.project/run-bundles/shadow-council-v1a-cli-harness-remediated/` (new) — finalized Run Bundle
  (`run-manifest.json`, `task-record.json`, `evidence-manifest.json`, `report.md`,
  `evidence/exercise-r1.json`, `evidence/exercise-r2.json`), 31 evidence entries, run ID
  `shadow-council-v1a-cli-harness-remediated-finalization-run-1`, `manifestHash`
  `sha256:a4ae5777ed0db20cb52e87e6c60606cd912a1d9146ee7322f04fcb82e27c798e`, finalized at
  `2026-08-29T21:34:41Z`.
- `.project/CURRENT_TASK.md` (this file) / `.project/REVIEW_STATE.md` — task record.
- **Not modified** (frozen, confirmed byte-identical to `main`): `scripts/dev/decision-council-kernel.mjs`,
  `scripts/dev/decision-council-simulator.mjs`, `scripts/dev/canonical-json.mjs`,
  `schemas/dev/decision-council.schema.json`, `scripts/dev/run-bundle.mjs`, `docs/adr/` (ADR-0005
  Status still literally `Proposed`).
- **Not incorporated as evidence authority**: the quarantined commit `5d83aa5` — cited only as
  historical/process-incident context (`.project/REVIEW_STATE.md`'s Process Incident and this
  file's Objective/Branch sections); zero technical value in this branch's Run Bundle traces to its
  content, independently confirmed by the final Verifier.

**Codex roles used (real `mcp__codex__codex` sessions only — no generic research fork, no untyped
subagent performed any repository write in this task):**
- **Scout**, thread `01a04d7f-71fd-7110-a6ca-ebe26bc8806a` — mapped the quarantined reference's
  architecture as the Implementer's spec basis. Wrote nothing.
- **Implementer**, thread `01a04d83-7933-7c61-bf43-e960bd4b7fb4` — wrote all new files, applied 2
  Reviewer-found fixes (deep-frozen seat mapping, `modelUsage`-only substitution check).
- **Implementation Reviewer**, thread `01a04d88-2edc-7981-bf99-f9826583884a` — Round 1
  `CHANGES_REQUIRED` (2 real defects), Round 2 `APPROVED`.
- **Implementation Verifier**, thread `01a04e53-4986-7c13-a036-45258ca6428d` — 19-point check,
  `ALL CHECKS PASS`.
- **Post-exercise adversarial Reviewer**, thread `01a04f65-590d-7db3-a7b7-7b23dc676f3d` —
  independently recomputed every hash from raw exercise bytes; found no `PROTOCOL_REDESIGN_BLOCKER`;
  2 documentation wording issues (now corrected); verdict `APPROVED_NO_PROTOCOL_BLOCKER`.
- **Final Verifier**, thread `01a04f6e-7b70-7f10-99bd-8faa1e16a4b5` — 11-point check against the
  finalized state and Run Bundle. Raised one item (a narrative mention of `5d83aa5` in
  `task-record.json`) against an overly strict instruction of Claude's own verification prompt;
  after Claude clarified the actual requirement (no *technical value* may trace to `5d83aa5`, a
  purely descriptive historical mention is fine and separately required), the Verifier independently
  re-confirmed zero technical value in the bundle traces to `5d83aa5` and revised to
  `ALL CHECKS PASS`.

**Independently re-confirmed by Claude directly throughout** (not merely trusted from any Codex
session): all 6 deterministic suites (62 tests), `test:run-bundle` (17), `test:context-pack` (115),
`check:project-consistency` (7/7), `test:project-consistency` (19 groups), `npm test` (170
fixtures), `git diff --check` clean, both candidate/record hashes and all 7 attestation hashes
recomputed from raw exercise-file bytes via the real kernel/attestation primitives, ADR-0005
`## Status` line reads literally `Proposed`, no credential-shaped string anywhere.

## ADR-0005 Acceptance Gate — per-criterion status (post-exercise adversarial Reviewer)

1. `SATISFIED_BY_THIS_EVIDENCE` — frozen kernel/simulator byte-identical to `main`, both suites
   18/18.
2. `SATISFIED_BY_THIS_EVIDENCE` — three real provider CLI seats produced genuine, hash-consistent
   `DecisionRecord`s.
3. `SATISFIED_BY_THIS_EVIDENCE` — concrete adapter/runtime seat-origin separation and attestation
   demonstrated, residual limits disclosed.
4. `SATISFIED_BY_THIS_EVIDENCE` — representative R1 and R2 exercises traversed the unmodified
   kernel sequence and terminalized successfully.
5. `SATISFIED_BY_THIS_EVIDENCE` — the finalized Run Bundle above binds both exercise records as
   content-addressed `ARTIFACT` evidence (this criterion was `NOT_YET_SATISFIED` at review time
   solely because the bundle did not yet exist; it now does).
6. `SATISFIED_BY_THIS_EVIDENCE` — results remained advisory throughout; no `DecisionRecord`
   triggered any repository mutation, publication, merge, tool execution, or task transition.
7. `SATISFIED_BY_THIS_EVIDENCE` — this independent adversarial review itself found only
   documentation/evaluation-methodology improvements, no protocol-redesign requirement.

No `PROTOCOL_REDESIGN_BLOCKER` at any point. **This does not change ADR-0005's Status**, which
remains **Proposed** — moving it to Accepted is a separate, explicit human decision.

**Publication:**
- Local Publication Builder authorized: yes, per this task's own explicit instruction, gated on
  Run Bundle representability being honest, no `PROTOCOL_REDESIGN_BLOCKER`, and both final
  Reviewer/Verifier gates passing — all met (see above).
- Remote publication: human manual fallback only (unchanged — this task does not touch that).
- Exactly one local commit, subject `feat: add advisory shadow council cli harness`, containing the
  lifecycle-compliant implementation and its sanitized/finalized evidence, via
  `scripts/dev/publication-builder.mjs`. Not pushed, no PR touched, not merged, no ADR-0005
  acceptance started, no execution-integration follow-on started.

## Required Context

- `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`'s Acceptance Gate section
- `.project/REVIEW_STATE.md`'s Process Incident and Latest Review sections (this task)
- `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`
- `docs/development/AGENT_POLICY.md`, `docs/development/CODEX_ROLES.md`,
  `docs/development/REVIEW_PROTOCOL.md`
