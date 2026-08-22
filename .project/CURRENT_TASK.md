# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-MEMORY-CONTEXT-SCHEMA-FOUNDATION

## Objective

Create the first machine-readable JSON Schema and deterministic validation layer for the
already-Accepted `MemoryContext` semantic contract, derived from `MEMORY_CONTEXT.md`/`ADR-0004`
without inventing new semantic authority. Does **not** enable any new `MemoryContext` consumer and
does **not** implement Brain retrieval/runtime integration. Establishes only the `MemoryContext` side
of the stable `(memory_context_id, entry_id)` identity pair that a future, separately-authorized
Dependency B/C/D amendment could cite — `IntentSpec`/`RequirementSpec` are unchanged.

## Branch / Base

Branch: `m0/memory-context-schema-foundation`
Base: `main` at `8b0c0b65b3d8e6f2cb3034d9f395b2008694cc75` (verified via `git status`/`git log`/
`npm run context` before branching).

**Process note:** file edits for this task were started directly on `main` before the branch was
created — caught mid-task and corrected immediately via `git switch -c` (which preserves
uncommitted work), before any commit was made. `git merge-base HEAD main` confirmed the branch's
base is exactly the specified commit; no work was lost or based on the wrong commit.

## Status

**Complete, pending human review. Acceptance Gate for this task type is "coherent and
adversarially reviewed," not a STOP condition — none of the STOP conditions triggered.**

- Read `ADR-0004`, `MEMORY_CONTEXT.md`, `MEMORY_CONTEXT_CASES.md`, `M0_SCOPE.md`,
  `schemas/m0/{user-idea,intent-spec}.schema.json`, `tests/contracts/validate-contracts.mjs`,
  `docs/contracts/SCHEMA_MAPPING.md`, `ROADMAP.md`, and `.project/CONTEXT_INDEX.md` before design.
  Confirmed the discovery that motivated this task: `schemas/m0/intent-spec.schema.json` represents
  an Inferred Claim's premises only as `premise_claim_ids[]`, resolved only against Claims inside the
  same `IntentSpec` — implementing Dependency B before `MemoryContext` had its own stable entry
  identity would force inventing an ad-hoc reference shape. Neither STOP condition
  (`SEMANTIC_AMENDMENT_REQUIRED` / `SCHEMA_DESIGN_GAP`) was triggered: the Accepted contract contains
  enough information to derive a stable, faithful machine-readable shape.
- Authored `schemas/m0/memory-context.schema.json` (JSON Schema Draft 2020-12), a
  `validateMemoryContext` function added to `tests/contracts/validate-contracts.mjs`, 9 valid and 13
  invalid fixtures under `tests/contracts/fixtures/{valid,invalid}/memory-context-*.json`, and
  `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md` (a new, separate mapping document — did not
  overload the Step-02B-titled `SCHEMA_MAPPING.md`), mapping every M-01–M-21 invariant to
  Schema-enforced / Validator-enforced / Not enforceable at this layer / Not applicable to this
  artifact, honestly.
- Updated `ROADMAP.md` minimally: recorded the discovered sequencing dependency in Phase 9's own
  text (without renumbering Phase headers), split Phase 10 into "MemoryContext schema foundation —
  NEXT (this PR, unmerged)" and a separate, later "Brain read-side adapter / runtime — PLANNED"
  subsection, and reordered Section 22's flat near-term list to insert the schema foundation step
  before Dependency B/C/D. Does not claim the schema exists on `main`.
- Added two `.project/CONTEXT_INDEX.md` navigation rows for the new schema and mapping doc.
- Dispatched three fresh independent read-only Codex reviewers, per this task's explicit
  instruction: A (Schema ↔ Accepted Contract Coverage), B (Epistemic Authority / Provenance), C
  (Lifecycle / Evolvability / Future References). All three converged on the same core defects,
  independently verified by Claude against the actual contract text before any fix — findings were
  not accepted on reviewer say-so alone:
  - **M-04 (superseded record never admitted as live) — confirmed by A and C:** the validator
    checked only `brain_status === "superseded"`, never the contract's explicitly-named second
    signal, `superseded_by` being non-null. Fixed: an admitted entry with a non-null `superseded_by`
    is now also rejected. New invalid fixture added proving this.
  - **M-11 / Historical User Provenance Gate type-independence — confirmed by A and B:** the
    validator forced every `lesson`/`playbook`-typed entry to `PROCESS_ONLY` unconditionally on
    stored `brain_type`, contradicting `MEMORY_CONTEXT.md`'s explicit statement that only `inbox` is
    a genuine, unconditional, type-determined rule — every other type, `lesson`/`playbook` included,
    is redirected to the Category A/B gate when content inspection reveals a historical user
    statement. Fixed: the `PROCESS_ONLY`-forcing rule is now conditioned on
    `!classification.is_historical_user_statement`. New valid fixture added proving a misfiled
    `lesson` can correctly reach `SEMANTIC_PREMISE` via Category A reclassification.
  - **M-14 (excluded-entry audit trail) — confirmed by A:** `excluded_entries` carried only
    `entry_id`/`brain_memory_id`/`brain_type`/`exclusion_reason`, missing the content copy,
    scope/provenance, and (where actually attempted) classification/freshness facts M-14 requires
    for every retrieved memory, not only admitted ones. Fixed: redesigned `excludedEntry` with a new
    `excludedSourceRecord` (full source metadata, `inbox` permitted) and `exclusionClassification`
    (classification minus `influence_tier`, since an excluded entry is never assigned one) — both
    nullable, since some exclusions (e.g. `inbox`-type, mechanical scope mismatch) genuinely happen
    before any classification is attempted. New valid fixture added exercising the fail-closed
    "classification attempted, no tier defensible, excluded" path with non-null classification.
  - **M-19 (fail-closed classification) mapping overclaim — confirmed by A and B:** the mapping
    document classified M-19 "Validator-enforced," but Reviewer B constructed a passing counterexample
    (a document whose `classification_basis` prose describes ambiguity while `classification_ambiguity`
    is left `null`, claiming `DECISION_OPTION`) that the validator cannot catch, since it checks
    consistency between structured fields, not the honesty of free-text `classification_basis` against
    them. Independently reconstructed and confirmed the counterexample validates. Fixed: reclassified
    M-19 (and, for the same reason, M-11 and M-16) from "Validator-enforced" to "Not enforceable at
    this layer" with the real structural guard described honestly, consistent with this document's own
    stated classification discipline (a row stays "Not enforceable" even with a strong partial guard).
  - **Fixture accuracy — confirmed by B:** three valid fixtures declared `classification_method:
    "deterministic"` while their own `classification_basis` text described reading/interpreting body
    content (heuristic by Principle 6's own definition). Fixed: corrected to `"heuristic"`.
- All fixes independently re-verified against the actual contract text (quoted directly from
  `MEMORY_CONTEXT.md`) and against the actual code, not accepted from reviewer summaries. No
  redesign of ADR-0004/`MEMORY_CONTEXT.md` was needed or performed for any finding.

`npm test`: 54/54 (32 original + 22 new `MemoryContext` fixtures — 9 valid, 13 invalid). `git diff
--check`: clean. `git diff main --stat`: exactly three
modified files (`.project/CONTEXT_INDEX.md`, `ROADMAP.md`, `tests/contracts/validate-contracts.mjs`)
plus the new untracked files listed above. Explicitly confirmed via targeted `git diff main --stat`
that every forbidden file (`MEMORY_CONTEXT.md`, `ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`,
`INTENT_SPEC.md`, `intent-spec.schema.json`, `REQUIREMENT_SPEC.md`, `M0_SCOPE.md`, `PRINCIPLES.md`,
`VISION.md`) is unchanged. No `mihver-brain` file touched. No new `MemoryContext` consumer
authorized; no Dependency B/C/D implemented; no runtime/MCP/network code introduced.

## Allowed Scope

New: `schemas/m0/memory-context.schema.json`, `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`.
Modified: `tests/contracts/validate-contracts.mjs`, `tests/contracts/fixtures/**` (new files only),
`.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`, `.project/CONTEXT_INDEX.md`, `ROADMAP.md`.

Forbidden and confirmed untouched: `docs/contracts/MEMORY_CONTEXT.md`,
`docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, `docs/contracts/INTENT_SPEC.md`,
`schemas/m0/intent-spec.schema.json`, `docs/contracts/REQUIREMENT_SPEC.md`,
`docs/foundation/M0_SCOPE.md`, `docs/foundation/PRINCIPLES.md`, `docs/foundation/VISION.md`,
`../mihver-brain/**`.

## Required Context

- `CLAUDE.md`, `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`,
  `docs/contracts/MEMORY_CONTEXT.md` (read in full, including all M-01–M-21 invariants),
  `docs/examples/MEMORY_CONTEXT_CASES.md`, `docs/foundation/M0_SCOPE.md`.
- `schemas/m0/user-idea.schema.json`, `schemas/m0/intent-spec.schema.json`,
  `tests/contracts/validate-contracts.mjs`, `docs/contracts/SCHEMA_MAPPING.md` (existing conventions
  mirrored throughout the new schema/validator/mapping doc).
- `ROADMAP.md`, `.project/CONTEXT_INDEX.md` (prior content, read directly before editing).

## Validation

- `npm test`: 54/54.
- `git diff --check`: clean.
- `git diff main --stat` / targeted forbidden-file diffs: as reported in Status above.
- Three fresh independent read-only Codex reviewers (A/B/C) — see `REVIEW_STATE.md`'s "Latest
  Review" for full findings and disposition.

## Next Gate

Commit, push, and open one PR against `mihvernetwork/mihver:main`, title `M0: add MemoryContext
schema foundation`. Do not merge. Human review of that PR is the next gate; it authorizes only this
schema/validator/fixture/mapping-doc foundation — not any new `MemoryContext` consumer, not
Dependencies B/C/D, and not any Brain read adapter or runtime integration.
