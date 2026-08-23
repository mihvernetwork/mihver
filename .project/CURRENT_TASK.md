# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

DECISION-OPTION-SOURCE-GATE-CLOSURE

## Objective

A narrow closure pass, continuing the same branch/PR (#26) as `M0-DECISION-OPTION-HISTORICAL-SOURCE-
GATE-CLOSURE` below, fixing two residual consistency defects on top of that task's already-APPROVED,
not-reopened policy decision (a `MemoryContext` entry classified as a historical user statement —
Category A or B — is categorically ineligible for `DECISION_OPTION`): (1)
`MEMORY_CONTEXT_SCHEMA_MAPPING.md`'s current-state prose was still internally stale, describing
Research Planning as the sole authorized consumer and Dependencies B/C/D as uniformly future/disabled,
when B is implemented and C is retired; (2) two newly-added Dependency-D-shaped `MemoryContext`
fixtures bound their `upstream_artifact_binding` to `requirement_spec` (Requirement Derivation's own
*output*) instead of `intent_spec` (the artifact a surviving R-19-eligible Unknown actually originates
from). Does not implement Dependency D, does not reopen the source-gate policy.

## Branch / Base

Branch: `m0/decision-option-historical-source-gate` (continuation — same branch/PR as
`M0-DECISION-OPTION-HISTORICAL-SOURCE-GATE-CLOSURE`, no new branch created).
Base: `main` at `b4fdd70db4887c011853b0090796bdab6ed3f570`, unchanged from that task. PR #26
confirmed open against `mihvernetwork/mihver:main` before any edit; `npm test` 85/85 confirmed before
any edit (branch already carried the prior round's 83→85 fixture additions).

## Status

**Complete, pending human review.**

**This round's fixes:**

- **Mapping current-state prose fixed.** `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`'s opening
  paragraph, "Schema representability vs. pipeline authorization," and "Stable identity for
  cross-artifact reference" sections rewritten to state current reality: two authorized consumers
  (Research Planning `DISCOVERY_ATTENTION`-only; Intent Parsing `DISCOVERY_ATTENTION`+
  `SEMANTIC_PREMISE`); Dependency B **implemented** (confirmed by direct read of
  `intent-spec.schema.json`'s `memoryPremise`/`memoryDiscoveryRef` definitions, which already cite
  the `(memory_context_id, entry_id)` pair); Dependency C **retired as redundant, not implemented**;
  Dependency D **not implemented, not authorized**. No M-01–M-21 semantic content changed beyond the
  prior round's already-approved source-gate clarification.
- **D-shaped fixture upstream binding fixed.** `tests/contracts/fixtures/valid/memory-context-
  decision-option-non-historical.json` and `tests/contracts/fixtures/invalid/memory-context-decision-
  option-on-historical-statement-category-a.json` (both `consuming_stage: requirement_derivation`,
  retrieval purpose tied to an R-19-eligible default candidate) had `upstream_artifact_binding.
  artifact_type: "requirement_spec"` — wrong, since Requirement Derivation's D-decision originates
  from a surviving Unknown in the *consumed* `IntentSpec`, not its own output. Both corrected to
  `artifact_type: "intent_spec"`, `artifact_id: "intent-support-inbox-v1"`, `version: 1`.
- **Category-B fixture disposition: left unchanged, deliberately.** The pre-existing Category B
  invalid fixture (`consuming_stage: research_planning`, `upstream_artifact_binding: null`) was
  inspected and kept structurally independent — it demonstrates the source gate applies regardless of
  consuming stage (an already-authorized stage), not a Dependency-D-shaped scenario; the task
  explicitly permitted this disposition.
- **One reviewer-found defect fixed beyond the task's own two items.** The one fresh read-only Codex
  reviewer (below) found the valid D-shaped fixture's `freshness_basis` claimed "42 days since
  brain_updated_at" while the actual dates (`brain_updated_at: 2026-01-12`, `retrieval_time:
  2026-08-23`) are ~223 days apart — independently re-verified by direct date arithmetic (confirmed:
  223 days, exceeding the fixture's own stated 180-day threshold, self-contradicting its `"fresh"`
  flag). Fixed by correcting `brain_created_at`/`brain_updated_at` to `2026-07-12` (exactly 42 days
  before the fixture's own `retrieval_time`), matching the stated basis text exactly.
- One fresh independent read-only Codex reviewer (Source-Gate Final Consistency, 9-point checklist):
  **8/9 PASS, 1 confirmed finding** (the freshness-date defect above), independently re-verified and
  fixed.

**Prior round's own detail** (`M0-DECISION-OPTION-HISTORICAL-SOURCE-GATE-CLOSURE`: the Gate 1/Gate 2
policy recording, the contradiction fix, the no-laundering paragraph, `ADR-0004`'s clarification, the
original M-21/M-11 mapping rewrite, the validator message extension, the original fixture additions,
Cases 25/26, and that round's own three-reviewer pass) is preserved below and in `REVIEW_STATE.md`'s
History — not restated, since this closure round changed none of those conclusions, only two residual
consistency defects on top of them.

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

- `npm test`: 85/85, unchanged from the prior round (this closure fixed two consistency defects and
  one fixture date bug; it added no new fixtures).
- `git diff --check`: clean.
- `git diff main --stat`: exactly the allowed files listed above (this round's own diff limited to
  `MEMORY_CONTEXT_SCHEMA_MAPPING.md` and the two D-shaped fixtures, plus these state files).
- Confirmed: Requirement Derivation's `Input:` remains `IntentSpec` only (`M0_SCOPE.md` untouched);
  Dependency D remains unimplemented; no `RequirementSpec` schema exists; no runtime/Brain work; the
  `isReclassifiedHistorical && tier === "DECISION_OPTION"` validator check is byte-unchanged in logic
  from the prior round.

## Next Gate

Commit and push this closure to existing PR #26. Do not open a new PR. Do not merge. Human review of
PR #26 remains the next gate; it authorizes only this contradiction-closure/policy-recording change
plus this narrow consistency closure — no Dependency D implementation, no schema/runtime/Brain work.
