# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

DEPENDENCY-B-CROSS-ARTIFACT-GATE-CLOSURE

## Objective

A narrow gate-closure pass on the already-implemented `ADR-0004` Dependency B (PR #22, not yet
merged): close four technical deterministic-validator gaps and one `REVIEW_STATE.md` factual-hygiene
defect an external review found, without redesigning Dependency B, modifying C/D, authorizing
Requirement Derivation, modifying `ADR-0002`/`ADR-0004`, modifying `MemoryContext`'s schema, or
adding runtime/Brain access.

## Branch / Base

Branch: `m0/dependency-b-intent-memory-premise` (continued, same PR #22, no new PR opened).
Base: `main` unchanged at `5054a64fd2a95ee3d139c6a43442f65a8fafb837`.

## Status

**Complete, pending human review.**

Every technical finding independently re-verified against the owning contract before any fix was
applied, per this task's own instruction; all five were confirmed real.

- **Companion `MemoryContext` is no longer optional.** `tests/contracts/validate-contracts.mjs`'s
  `validateIntentSpec` now hard-fails any Inferred Claim carrying a non-empty `memory_premises`, or
  any Open Item carrying a non-empty `memory_discovery_refs`, when no companion `MemoryContext` is
  supplied — an `IntentSpec` can no longer pass deterministic contract validation merely by
  self-asserting `historical_user_category: "A"` or copying a historical citation into its own
  provenance. A Claim-only `IntentSpec` remains fully valid with no companion. Two new invalid
  fixtures added: `intent-spec-memory-premise-no-companion.json`,
  `intent-spec-discovery-ref-no-companion.json`. `docs/contracts/SCHEMA_MAPPING.md`'s validation-
  boundary paragraph and the I-05/I-15/I-23/I-26/I-27 rows rewritten to state the requirement as
  mandatory, not optional — while still honestly not claiming the companion's own `historical_citation`
  is externally verified against a real `UserIdea` artifact (mirrors UI-05's own limitation).
  `schemas/m0/intent-spec.schema.json`'s `memory_premises`/`historicalCitationRef` field descriptions
  updated to match (no structural schema change).
- **Discovery path now requires historical Category A or B standing.**
  `validateDiscoveryRefAgainstCompanion` now additionally checks the companion entry's
  `is_historical_user_statement` is `true` and `historical_user_category` is exactly `"A"` or `"B"`,
  rejecting a non-historical `pattern`/`incident`/`reference`/process-`decision` entry that merely
  happens to carry `DISCOVERY_ATTENTION` for Research Planning's own, different search-shaping
  purpose — that use must not leak into Intent Parsing's discovery-clarification path. New invalid
  fixture: `intent-spec-discovery-ref-non-historical.json` (a `pattern`-typed, non-historical
  companion entry).
- **Upstream `UserIdea` binding now rejects an incompatible non-null artifact type.** Re-derived from
  `M0_SCOPE.md`'s Intent Parsing amendment (unchanged by this task, read only): a `MemoryContext`
  produced for `consuming_stage: "intent_parsing"` has no declared upstream artifact other than
  `UserIdea`, so a present (non-null) `upstream_artifact_binding` naming any other `artifact_type` is
  now rejected as incompatible; a `user_idea`-typed binding must still resolve among the `IntentSpec`'s
  `user_idea_refs` (unchanged); a null binding remains legitimate for a retrieval purpose that does
  not depend on an upstream artifact version. Scoped to `consuming_stage === "intent_parsing"` so it
  does not misfire against the pre-existing wrong-stage fixture's own, differently-reasoned
  `research_planning`-companion. New invalid fixture:
  `intent-spec-memory-premise-incompatible-upstream-binding.json`. Documented in
  `docs/contracts/SCHEMA_MAPPING.md`'s I-15 row and validation-boundary paragraph. No new lifecycle
  concept invented.
- **`force_reasoning.basis` whitespace bypass closed.** Schema's `minLength: 1` alone does not reject
  a whitespace-only string; added a targeted validator guard
  (`force_reasoning.basis.trim().length === 0` → fail), the same discipline already applied to
  `MemoryContext`'s `semantic_authority_class` field — not a project-wide whitespace refactor. New
  invalid fixture: `intent-spec-memory-premise-force-reasoning-whitespace.json`.
  `docs/contracts/SCHEMA_MAPPING.md`'s I-26 row updated.
- **`.project/REVIEW_STATE.md` factual hygiene.** The `MEMORY-CONTEXT-POST-SCHEMA-RECONCILIATION`
  History entry falsely claimed PR #21's merge event "is recorded in `.project/DECISIONS_LOG.md`" —
  independently re-verified by grepping `DECISIONS_LOG.md` directly: it contains separate merge-fact
  entries for PR #19 and PR #20, but none for PR #21. Corrected the sentence to state this accurately,
  with the PR #21 merge SHA/timestamp retained as historical context only. `DECISIONS_LOG.md` itself
  was **not** modified (forbidden file; also avoids a recursive metadata-sync cycle, per explicit
  instruction).

**Reviewer-driven fixes applied** (both independently re-verified before being accepted):

- Two `schemas/m0/intent-spec.schema.json` field descriptions (`memory_premises`,
  `historicalCitationRef`) still said cross-artifact resolution happens "only when a companion... is
  supplied," implying optionality the validator no longer permits — reworded to state the companion
  is now required whenever the corresponding field is non-empty.
- `.project/REVIEW_STATE.md`/`.project/CURRENT_TASK.md`'s fixture-count totals were stale at `78/78`
  (this file's own prior content, from before this round's five new fixtures existed) — updated to
  the current, actually-run `83/83`.

## Allowed Scope

`schemas/m0/intent-spec.schema.json`, `tests/contracts/validate-contracts.mjs`,
`tests/contracts/fixtures/**`, `docs/contracts/SCHEMA_MAPPING.md`, `.project/CURRENT_TASK.md`,
`.project/REVIEW_STATE.md`. `docs/contracts/INTENT_SPEC.md` was read but not modified — direct
re-derivation found it never mentions "companion" or fixture-harness mechanics at all (it is
implementation-independent by design), so no synchronization was needed.

Forbidden and confirmed untouched (verified via `git diff main --stat` against every path):
`docs/foundation/M0_SCOPE.md`, `docs/contracts/MEMORY_CONTEXT.md`, `docs/contracts/USER_IDEA.md`,
`docs/contracts/REQUIREMENT_SPEC.md`, `schemas/m0/memory-context.schema.json`,
`docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`, `docs/adr/**`, `docs/foundation/PRINCIPLES.md`,
`docs/foundation/VISION.md`, `.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`,
`.project/CONTEXT_INDEX.md`, `ROADMAP.md`, `../mihver-brain/**`. No runtime/MCP/network code
introduced. Dependency C/D remain not implemented; Requirement Derivation remains unauthorized.

## Required Context

`docs/foundation/M0_SCOPE.md`, `docs/contracts/INTENT_SPEC.md`, `docs/contracts/MEMORY_CONTEXT.md`,
`schemas/m0/intent-spec.schema.json`, `schemas/m0/memory-context.schema.json`,
`tests/contracts/validate-contracts.mjs`, `docs/contracts/SCHEMA_MAPPING.md` — all re-read fresh in
full before any edit, per this task's own instruction to re-verify every finding against the owning
contract rather than blindly applying it.

## Validation

- `npm test`: 83/83 (78 from PR #22's original round, unmodified in substance, plus 5 new gate-closure
  fixtures).
- `git diff --check`: clean.
- `git diff main --stat`: exactly the allowed files.
- Two fresh independent read-only Codex reviewers (Cross-Artifact Authority Gate; Force/Regression/
  State Hygiene) — see `REVIEW_STATE.md`'s "Latest Review" for findings and disposition.

## Next Gate

Commit and push to the existing `m0/dependency-b-intent-memory-premise` branch / PR #22. Do not open
a new PR. Do not merge. Human review of PR #22, now including this closure round, is the next gate.
