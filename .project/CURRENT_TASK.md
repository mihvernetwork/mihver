# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-DECISION-OPTION-HISTORICAL-SOURCE-GATE-CLOSURE

## Objective

Resolve, by explicit human decision, the pre-Dependency-D `MemoryContext` internal contradiction a
prior task (`M0-DEPENDENCY-D-R19-MEMORY-DECISION-OPTION`) surfaced and stopped on
(`MEMORY_CONTEXT_MACHINE_CONTRACT_GAP`): whether a `MemoryContext` entry classified as a historical
user statement (Category A or B) may ever be eligible for `DECISION_OPTION` influence tier. **Human
decision: NO, categorically, for both categories** — the already-implemented, already-tested
deterministic validator behavior was correct and is preserved unchanged; the semantic contract's own
prose (which previously permitted this "in principle") is corrected to match it. This task does not
implement Dependency D itself — Requirement Derivation remains unauthorized to consume `MemoryContext`,
no `RequirementSpec` schema exists, and no R-24 invariant is added.

## Branch / Base

Branch: `m0/decision-option-historical-source-gate` (new branch, created from `main`).
Base: `main` at `b4fdd70db4887c011853b0090796bdab6ed3f570` — verified via `git status`/`git log`
(HEAD matched exactly before branching), `npm run context`, and `npm test` (83/83) before any edit.

## Status

**Complete, pending human review.**

Read fresh, in full, before any edit: `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`,
`docs/contracts/MEMORY_CONTEXT.md`, `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`,
`docs/contracts/REQUIREMENT_SPEC.md` (R-19/R-09 sections), `docs/examples/MEMORY_CONTEXT_CASES.md`
(Case 24), `schemas/m0/memory-context.schema.json`, `tests/contracts/validate-contracts.mjs`, and the
full `tests/contracts/fixtures/**` MemoryContext fixture set.

- **Policy recorded (Section 1/3 of the task).** `docs/contracts/MEMORY_CONTEXT.md`'s "No
  Assumed-Origin Path for Memory" section now states the two-gate model explicitly: **Gate 1 (R-19
  content eligibility)** — does Requirement Derivation already own this fill decision — and **Gate 2
  (`MemoryContext` source eligibility)** — is this specific entry an eligible `DECISION_OPTION`
  source — both independently required, neither substituting for the other. A historical-user-
  statement entry (Category A or B) categorically fails Gate 2, not because it is presumptively
  false, but because historical-user semantic content belongs entirely to Intent Parsing's own
  epistemic authority boundary (Dependency B's disciplined routes). The "Seven Independent Authority
  Axes" section gained a closing paragraph clarifying that "independent" means no axis is inferred
  from/overridden by/collapsed into another — it does not mean every source class must be eligible
  for every influence tier; two axes may jointly, independently gate one use.
- **Contradiction fixed.** The prior "An entry of either Historical User Provenance Gate category may
  supply this kind of technical/measurement suggestion in principle..." sentence — which contradicted
  the Influence Taxonomy Reclassification table, the schema mapping, and the validator — was replaced
  with the categorical Gate 2 rule. Invariant M-21's own text gained a one-sentence cross-reference
  noting it states Gate 1 only, with Gate 2 documented separately. Non-historical technical/
  measurement memory (`pattern`/`incident`/`reference`/process-`decision`, classified by content, not
  Brain type) remains D-eligible, unaffected.
- **No provenance laundering.** A new paragraph in the same section, and new Case 26, establish: a
  raw historical-user-statement entry is never `DECISION_OPTION`-eligible regardless of later
  adoption; a *separately-recorded*, independently-provenanced technical/process-decision or
  prior-architecture-outcome entry describing the same eventual value — genuinely distinct
  classification and provenance, not a relabeling of the original — may be D-eligible on its own
  terms.
- **`ADR-0004`**: one narrow clarifying sentence added to the existing "Dependency D — unaffected,
  still pending" bullet in "Post-Acceptance Dependency B/C Disposition," framed explicitly as
  clarification, not new capability. `## Status` remains **Accepted**, unchanged; Acceptance not
  reopened.
- **`MEMORY_CONTEXT_SCHEMA_MAPPING.md`**: M-21's row rewritten to document the Gate 2 validator check
  as a deliberate, independently-enforced semantic rule (not merely "already counted under M-11's
  row," which was itself inaccurate — M-11's row never actually mentioned this check); M-11's row
  updated with the mirror-image cross-reference to M-21. Three narrowly-encountered stale "once
  dependency B exists" phrases (M-03, M-08, M-20 rows) corrected to reflect B's actual implemented
  status — directly encountered while editing this file, not a broader reconciliation pass. Fixture-
  coverage prose updated to describe the two new/renamed invalid fixtures and the one new valid
  fixture.
- **Validator**: the `isReclassifiedHistorical && tier === "DECISION_OPTION"` check
  (`tests/contracts/validate-contracts.mjs`) is byte-unchanged in behavior — only its error message
  was extended (still containing the original `must not carry influence_tier "DECISION_OPTION"`
  substring every existing/new fixture's `expected_error` matches) to name the Gate 2 invariant
  explicitly.
- **Fixtures**: added `memory-context-decision-option-on-historical-statement-category-a.json`
  (invalid — Category A + `DECISION_OPTION`, new); renamed the pre-existing Category B invalid
  fixture to `-category-b.json` for clarity (content lightly updated to name Gate 2, behavior
  unchanged); added `memory-context-decision-option-non-historical.json` (valid — non-historical
  `pattern` entry at `DECISION_OPTION`, proving `MemoryContext` representability only, not
  Requirement Derivation authorization). Fixture total: 83 → 85.
- **`MEMORY_CONTEXT_CASES.md`**: added Case 25 (the identical numeric value Case 24 used, proposed
  instead by a Category A and a Category B historical-user statement — both forbidden from
  `DECISION_OPTION` regardless of content; shows the correct routes are Dependency B's premise path
  or a clarification question) and Case 26 (a separately-recorded accepted technical outcome remains
  D-eligible even when a user's suggestion first prompted it — no provenance laundering). Case 24
  itself confirmed byte-unchanged.
- Three fresh independent read-only Codex reviewers (Reviewer A — Source Axis × `DECISION_OPTION`;
  Reviewer B — Boundary / No Intent Bypass; Reviewer C — Machine / Corpus Consistency): **A: 4/4
  PASS. B: 5/5 PASS. C: 6/7 PASS, 1 confirmed finding** — M-21's schema-mapping row said "M-11's row
  below," but M-11's row is physically above M-21's in the table; independently re-verified by
  direct line-number comparison, confirmed real, fixed to "above."

## Allowed Scope

`docs/contracts/MEMORY_CONTEXT.md`, `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`,
`docs/examples/MEMORY_CONTEXT_CASES.md`, `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`
(narrow clarification only), `tests/contracts/validate-contracts.mjs` (error-message clarification
only, behavior preserved), `tests/contracts/fixtures/**` (focused MemoryContext fixtures only),
`.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`.

Forbidden and confirmed untouched: `docs/foundation/M0_SCOPE.md`, `docs/contracts/INTENT_SPEC.md`,
`docs/contracts/REQUIREMENT_SPEC.md`, `docs/contracts/USER_IDEA.md`, `docs/examples/INTENT_CASES.md`,
`docs/examples/REQUIREMENT_CASES.md`, `schemas/m0/memory-context.schema.json`,
`schemas/m0/intent-spec.schema.json`, `.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`,
`.project/CONTEXT_INDEX.md`, `ROADMAP.md`, `../mihver-brain/**`. No schema structural change (none
was necessary — `SCHEMA_DESIGN_GAP` not triggered). No Dependency D implementation.

## Required Context

`docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, `docs/contracts/MEMORY_CONTEXT.md`,
`docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`, `docs/contracts/REQUIREMENT_SPEC.md` (R-19/R-09,
read only), `docs/examples/MEMORY_CONTEXT_CASES.md`, `docs/examples/REQUIREMENT_CASES.md` (read
only), `schemas/m0/memory-context.schema.json`, `tests/contracts/validate-contracts.mjs`,
`tests/contracts/fixtures/**`, `docs/foundation/M0_SCOPE.md` (read only) — all re-read fresh, in
full, before any edit.

## Validation

- `npm test`: 85/85 (83 prior + 2 new MemoryContext policy fixtures; unaffected otherwise).
- `git diff --check`: clean.
- `git diff main --stat`: exactly the allowed files listed above, plus the fixture add/rename.
- Confirmed: Requirement Derivation's `Input:` remains `IntentSpec` only (`M0_SCOPE.md` untouched);
  Dependency D remains unimplemented; no `RequirementSpec` schema exists; no runtime/Brain work.

## Next Gate

Commit, push, and open one PR against `mihvernetwork/mihver:main`, title "M0: close DECISION_OPTION
historical-source gate". Do not merge. Human review of that PR is the next gate; it authorizes only
this contradiction-closure/policy-recording change — no Dependency D implementation, no schema/
runtime/Brain work.
