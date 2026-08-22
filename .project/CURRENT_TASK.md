# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

MEMORY-CONTEXT-SCHEMA-CONTRACT-CLOSURE

## Objective

A narrow contract→schema closure pass on top of PR #20 (`M0: add MemoryContext schema foundation`),
closing four structural gaps an external review found. Does not redesign `ADR-0004`, modify
`MEMORY_CONTEXT.md`, enable Dependency B/C/D, or implement any runtime/Brain integration.

## Branch / Base

Branch: `m0/memory-context-schema-foundation` (continued, not newly created)
Existing PR: `mihvernetwork/mihver#20` — continued, not newly opened.

## Status

**Complete, pending human review.**

Re-verified all four confirmed findings directly against `docs/contracts/MEMORY_CONTEXT.md`'s actual
text before implementing anything; none was rejected — all four were genuinely supported by the
Accepted contract.

1. **Semantic authority class as its own axis.** `MEMORY_CONTEXT.md`'s "Seven Independent Authority
   Axes" names Axis 3 ("Semantic authority class — assigned at production per the table above; not
   present in Brain's own schema") as independent from Axis 7 (Influence Taxonomy/allowed use) and
   from `brain_type`. Added `classification.semantic_authority_class` (admitted) and
   `exclusionClassification.semantic_authority_class` (excluded, when attempted) as an **open,
   non-empty string** — deliberately not a closed enum, since the contract's own "Semantic Authority
   Classes" table describes classes narratively and disjunctively (e.g. "historical user
   statement/preference... **or** prior project decision/outcome"), never as a fixed closed
   taxonomy. Independent of `brain_type`, `historical_user_category`, and `influence_tier` — proven
   by fixtures where all four values differ meaningfully.
2. **M-14 explicit admission rationale.** Added a required `admission_reason` field to
   `admittedEntry`, symmetric with the existing `exclusion_reason` on `excludedEntry`. Removed the
   prior mapping-doc claim that admission rationale was "adequately implicit" in scope/status/
   classification/tier — re-derivation confirmed this defeated M-14's own durable-audit purpose,
   since a reconstructed inference is not itself a recorded fact.
3. **M-14 excluded freshness.** Re-derived against M-05 and M-14: freshness is a purely mechanical,
   age-based fact requiring no content inspection at all, unlike classification (which legitimately
   can be skipped for exclusions that happen before any content inspection, e.g. `inbox`-type or
   mechanical scope mismatch). There is no such legitimate gap for freshness — Brain's own
   timestamps and the invocation's retrieval time are available regardless of exclusion reason. Made
   `excludedEntry.freshness` required and non-null (previously nullable), explicitly not conflating
   "classification not attempted" with "freshness unavailable."
4. **Canonical Brain memory identity partition.** Re-derived the audit model as: one Producer
   invocation → one retrieved canonical Brain record → one disposition in this snapshot. Extended the
   existing `unique(...)` check to cover `source.brain_memory_id` across the *combined*
   `admitted_entries` + `excluded_entries` sets, not admitted-only as before. Nothing in
   `MEMORY_CONTEXT.md` contemplates one canonical Brain record producing multiple entries within one
   invocation (Case 14's two separate retrieval purposes produce two separate `MemoryContext`
   artifacts, not two entries in one).

**Corpus sweep performed**, per this task's explicit instruction: every existing valid `MemoryContext`
fixture updated to carry `semantic_authority_class` and `admission_reason`; every existing excluded
entry given required non-null `freshness`; every existing invalid fixture updated with the same new
required fields so each still fails for its own originally-intended reason (verified: schema
validation now succeeds for every invalid fixture before the intended semantic-validator check is
what actually fires — confirmed by re-running the full suite after each fixture edit). Six new
fixtures added: one proving finding #4 (same canonical Brain memory admitted and excluded under
different `entry_id` values), and three proving findings #1/#2/#3's fields cannot silently disappear
(each omitted in turn from an otherwise-valid document).

Dispatched exactly two fresh read-only Codex reviewers, per this task's explicit instruction:
Reviewer A (Classification Axis Separation) and Reviewer B (M-14 Audit Completeness).

- **Reviewer B: no findings across all 11 checks.** Independently re-verified by Claude: combined
  `brain_memory_id` uniqueness, retained content/scope/provenance for both dispositions, freshness
  required-and-non-null on both, explicit admission/exclusion rationale, the dual-disposition
  invalid fixture, and pre-classification exclusions retaining all unrelated mechanical audit facts —
  all confirmed clean by direct re-reading of the actual schema/validator/fixtures.
- **Reviewer A: one confirmed, fixed finding; seven checks passed.** `semantic_authority_class`'s
  `minLength: 1` constraint does not reject a whitespace-only value (e.g. `"   "`), which is lexically
  non-empty but preserves no actual classification — undermining the "assigned at production"
  requirement this axis exists to record. Independently re-verified: real, and specific to the field
  this task introduces (not a pre-existing systemic pattern requiring changes to forbidden files like
  `intent-spec.schema.json`, which uses the identical `minLength: 1` convention throughout its own
  pre-existing fields). Fixed with a targeted validator check
  (`classification.semantic_authority_class.trim().length === 0` → fail), scoped only to the new
  field, with a new invalid fixture proving it. The other seven checks (independent axis existence
  and exercise, `brain_type` remaining a weak prior, Historical User Provenance Gate independence,
  `influence_tier` independence, no closed taxonomy invented, M-19 fail-closed behavior intact,
  fixture accuracy) were independently re-verified and confirmed clean.

`npm test`: 59/59 (32 original + 27 `MemoryContext` fixtures). `git diff --check`: clean. Targeted
`git diff main --stat` against every forbidden file (`MEMORY_CONTEXT.md`,
`ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, `M0_SCOPE.md`, `INTENT_SPEC.md`,
`intent-spec.schema.json`, `REQUIREMENT_SPEC.md`) produced empty output. `ROADMAP.md`/
`CONTEXT_INDEX.md` untouched by this task (the sequencing this task recorded in PR #20 did not need
correction). No `mihver-brain` file touched. No new `MemoryContext` consumer authorized; no
Dependency B/C/D implemented; no runtime/MCP/network code introduced.

## Allowed Scope

`schemas/m0/memory-context.schema.json`, `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`,
`tests/contracts/validate-contracts.mjs`, `tests/contracts/fixtures/**`,
`.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`.

Forbidden and confirmed untouched: `docs/contracts/MEMORY_CONTEXT.md`,
`docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, `docs/foundation/M0_SCOPE.md`,
`docs/contracts/INTENT_SPEC.md`, `schemas/m0/intent-spec.schema.json`,
`docs/contracts/REQUIREMENT_SPEC.md`, `../mihver-brain/**`. Also untouched (not required by this
task): `ROADMAP.md`, `.project/CONTEXT_INDEX.md`.

## Required Context

- `CLAUDE.md`, `docs/contracts/MEMORY_CONTEXT.md` (re-read in full, especially "The Seven
  Independent Authority Axes", "Semantic Authority Classes", "Reproducibility", Invariants M-04/
  M-05/M-14/M-19), `docs/examples/MEMORY_CONTEXT_CASES.md` (Case 14).
- `schemas/m0/memory-context.schema.json`, `tests/contracts/validate-contracts.mjs`,
  `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`, and the full `MemoryContext` fixture corpus
  (prior content from PR #20, read directly before editing).

## Validation

- `npm test`: 59/59.
- `git diff --check`: clean.
- Targeted `git diff main --stat` confirms every forbidden file untouched.
- Two fresh read-only Codex reviewers (A: Classification Axis Separation; B: M-14 Audit
  Completeness) — see `REVIEW_STATE.md`'s "Latest Review" for full findings and disposition.

## Next Gate

Commit and push to the existing `m0/memory-context-schema-foundation` branch. Do not open a new PR.
Do not merge. Human review of PR #20 (now updated) is the next gate; it authorizes only this schema/
validator/fixture/mapping-doc closure — not any new `MemoryContext` consumer, not Dependencies B/C/D,
and not any Brain read adapter or runtime integration.
