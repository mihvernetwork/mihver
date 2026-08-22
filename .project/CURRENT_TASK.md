# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-DEPENDENCY-B-INTENT-MEMORY-PREMISE

## Objective

Implement `ADR-0004` Dependency B as one coherent Intent Parsing / `IntentSpec` integration slice:
let Intent Parsing consume bounded `MemoryContext`, and let a qualified Category A historical-user
`MemoryContext` entry become a cited premise of a current-run Inferred Claim. Not a general memory
expansion. Does not implement Dependency C or D, does not authorize Requirement Derivation to
consume `MemoryContext`, does not implement Brain retrieval/runtime, does not modify MIHVER Brain.

## Branch / Base

Branch: `m0/dependency-b-intent-memory-premise`
Base: `main` at `5054a64fd2a95ee3d139c6a43442f65a8fafb837` (verified via `git status`/`git log`/
`npm run context`/`gh pr view 20`/`gh pr view 21` before branching — matches PR #21's merge commit
exactly).

## Status

**Complete, pending human review.**

STOP-condition re-derivation (explicitly performed before any edit, per this task's own
instructions): neither STOP condition triggers. `FOUNDATION_AMENDMENT_REQUIRED` does not apply —
nothing in this change touches `ADR-0002`'s epistemic foundation, `USER_IDEA.md` semantics, the
Accepted `MemoryContext` authority model, or `RequirementSpec` semantics; `MEMORY_CONTEXT.md` itself
already anticipated this exact path in its "Historical User Memory Rule" section, describing it as
pending only `INTENT_SPEC.md`'s own amendment — precisely what this task performs.
`MEMORY_CONTEXT_REFERENCE_GAP` does not apply either — the existing `(memory_context_id, entry_id)`
pair is explicitly named in `memory-context.schema.json`'s own description as the reference pair a
future amendment would use, and required no redesign.

- **`docs/foundation/M0_SCOPE.md`**: added Intent Parsing as the second stage with an optional
  `MemoryContext` input (mirroring Research Planning's own pattern), naming both `DISCOVERY_ATTENTION`
  and `SEMANTIC_PREMISE` as the exactly-two authorized tiers; rewrote "Cross-Cutting: MemoryContext
  Consumption Remains Otherwise Disabled" to name Intent Parsing as the second authorized stage and
  to state Dependency B (the Inferred-Claim-premise path) as now authorized, while Dependency C/D and
  Requirement Derivation's own consumption remain explicitly unauthorized.
- **`docs/contracts/INTENT_SPEC.md`**: broadened the Claim-origin and Provenance sections to allow an
  Inferred Claim's premises to include qualified Category A `MemoryContext` entries; added a new
  "Memory-Derived Inference Premises" subsection under Inference Policy covering the Category A gate,
  stable `(memory_context_id, entry_id)` reference, never-a-fourth-origin rule, current-input-wins
  rule, provisional/reversible marking, historical-force-is-not-current-force rule, no-repetition-
  bonus rule, Brain-confidence independence, and the HIGH/CRITICAL-never-closed-by-memory-alone rule,
  plus a separate discovery-path paragraph for `DISCOVERY_ATTENTION`; added a Conflict Policy
  paragraph stating a `MemoryContext` entry is never a Conflict participant; added a HIGH/CRITICAL
  cross-reference in "Handoff Status"; extended the Confidence Policy paragraph; added five new
  invariants I-23 through I-27; added two Examples and three Anti-Examples.
- **`schemas/m0/intent-spec.schema.json`**: extended `inferenceProvenance` with an optional
  `memory_premises` array (typed `memoryPremise` objects: `memory_context_id`, `entry_id`,
  `historical_user_category` fixed `const: "A"` — structurally forecloses Category B — and a
  `historical_citation` object), keeping `premise_claim_ids` unchanged and requiring at least one of
  the two via `anyOf`; added `provisional`/`reversible` (required, and structurally forbidden, via
  `if`/`then`/`else`, whenever `memory_premises` is absent) and an optional `force_reasoning` object;
  added an optional `memory_discovery_refs` array (`memoryDiscoveryRef`: `memory_context_id`,
  `entry_id` only — no answer-bearing field) to both Open Item shapes. Zero migration of existing
  Claim-only Inference documents required.
- **`tests/contracts/validate-contracts.mjs`**: extended `validateIntentSpec` to accept an optional
  companion `MemoryContext` document; added memory-premise validation (at-least-one-premise-total,
  duplicate-pair rejection via `JSON.stringify([...])`-keyed uniqueness — not naive string
  concatenation, which a `:`-containing id could collide under —, provisional/reversible presence,
  force/force_reasoning binding) and `memory_discovery_refs` pair-uniqueness; added
  `validateMemoryPremiseAgainstCompanion`/`validateDiscoveryRefAgainstCompanion` cross-artifact
  checks (memory_context_id/entry_id resolution against admitted vs. excluded entries,
  `consuming_stage === "intent_parsing"`, Category A + `SEMANTIC_PREMISE`/`DISCOVERY_ATTENTION` tier,
  historical-citation equality); guarded the existing cycle-detection and confidence-escalation loops
  for now-optional `premise_claim_ids`; extended the fixture-loading harness to resolve an optional
  `fixture.companion` document before running cross-artifact semantic checks.
- **`docs/examples/INTENT_CASES.md`**: added a "Dependency B: Memory-Derived Inference Premises"
  section with cases A–I per the task's required letter list (valid Category A premise; Category B
  ceiling; current-input override; HIGH/CRITICAL never closed by memory; historical force is not
  current force; no Assumed path; repetition confers no authority; type independence; discovery
  provenance stays visible).
- **`tests/contracts/fixtures/`**: added 5 new valid and 14 new invalid `intent-spec` fixtures
  (memory-only Inference, mixed Claim+memory Inference, Category A/B `DISCOVERY_ATTENTION`
  provenance, force-absent and force-reasoned memory premises; Category B as premise, wrong tier,
  excluded/unresolved/wrong-stage/citation-mismatch/duplicate companion references, memory laundered
  into User-Provided/Assumed provenance, missing provisional marking, a leaked `brain_confidence`
  field, force without independent reasoning, and a discovery-tier entry improperly cited as a
  premise). Full corpus sweep performed: all 59 pre-existing fixtures still pass unmodified.
- **`docs/contracts/SCHEMA_MAPPING.md`**: revisited I-01, I-02, I-05, I-15, I-16, I-18, I-21, I-22;
  added I-23 through I-27 with honest Schema-enforced/Validator-enforced/Not-enforceable-at-this-
  layer classification; added a "MemoryContext companion cross-artifact checks" paragraph to the
  Validation Boundary section; updated the fixture-coverage closing paragraph.
- **`docs/contracts/MEMORY_CONTEXT.md`**: targeted stale-prose sweep only, performed after B was
  structurally/semantically complete — corrected the top-of-file status line, "Stage Consumption
  Authorization", and every "pending its required amendment"/`SEMANTIC_AMENDMENT_REQUIRED`/"not yet
  available" phrase tied specifically to the Inferred-Claim-premise path (now implemented), while
  leaving every still-future Dependency C/D statement, Requirement Derivation's own non-authorization,
  and the underlying memory semantics themselves untouched.

**Reviewer-driven fixes applied** (all independently re-verified against the owning contract before
being accepted, per this task's own instruction — one reviewer finding was independently rejected,
see Review below):

- A duplicate `(memory_context_id, entry_id)` pair-uniqueness check used naive `"::"`-joined string
  keys, which a colon-containing `id` (the `id` pattern permits `:`) could collide under, causing a
  false-positive duplicate rejection of two genuinely distinct pairs. Fixed in
  `tests/contracts/validate-contracts.mjs` for both the memory-premise and discovery-ref checks, using
  `JSON.stringify([...])`-encoded keys instead.
- The `force_reasoned` valid fixture's `force_reasoning.basis` text argued only from the *absence* of
  a contradicting current statement ("no current statement contradicts... so the same force
  independently is judged to still apply") — a persistence-by-default pattern, not a genuinely
  affirmative current-run basis, undermining its own value as a positive illustration of M-20. Fixed
  by restructuring the fixture into a mixed Claim+memory premise, grounding the force reasoning in an
  actual current `UserIdea` Claim (team capacity) instead. The same weak pattern in
  `INTENT_SPEC.md`'s own worked Example was independently found and fixed identically. A corpus-wide
  grep confirmed no other fixture carried the same pattern.
- Case D's Unknown/question wording in `INTENT_CASES.md` risked implying the user's own declared
  answer alone settles PCI-DSS applicability; reworded to center the actual data-flow facts that
  determine applicability.

## Allowed Scope

`docs/foundation/M0_SCOPE.md`, `docs/contracts/INTENT_SPEC.md`, `docs/examples/INTENT_CASES.md`,
`schemas/m0/intent-spec.schema.json`, `docs/contracts/SCHEMA_MAPPING.md`,
`tests/contracts/validate-contracts.mjs`, `tests/contracts/fixtures/**`,
`docs/contracts/MEMORY_CONTEXT.md` (status-sync sweep only), `.project/CURRENT_TASK.md`,
`.project/REVIEW_STATE.md`.

Forbidden and confirmed untouched (verified via `git diff main --stat` against every path):
`docs/contracts/USER_IDEA.md`, `docs/contracts/REQUIREMENT_SPEC.md`,
`schemas/m0/memory-context.schema.json`, `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`,
`docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`,
`docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, `docs/foundation/PRINCIPLES.md`,
`docs/foundation/VISION.md`, `.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`,
`.project/CONTEXT_INDEX.md`, `ROADMAP.md`, `../mihver-brain/**`. No runtime/MCP/network code
introduced. `PROJECT_STATE.md`/`ROADMAP.md` reconciliation is explicitly deferred to a follow-up
task, after this PR merges.

## Required Context

- `CLAUDE.md`, `docs/foundation/M0_SCOPE.md`, `docs/foundation/PRINCIPLES.md`,
  `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`,
  `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, `docs/contracts/USER_IDEA.md`,
  `docs/contracts/INTENT_SPEC.md`, `docs/contracts/MEMORY_CONTEXT.md`,
  `docs/examples/INTENT_CASES.md`, `docs/examples/MEMORY_CONTEXT_CASES.md`,
  `schemas/m0/intent-spec.schema.json`, `schemas/m0/memory-context.schema.json`,
  `docs/contracts/SCHEMA_MAPPING.md`, `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`,
  `tests/contracts/validate-contracts.mjs` and its fixtures — all read fresh in full, directly from
  the repository, before any edit.
- Live `git`/`gh` state (see Status/Branch above), not prior-conversation assumptions.

## Validation

- `npm test`: 78/78 (59 pre-existing + 19 new, all pre-existing fixtures unmodified and still
  passing).
- `git diff --check`: clean.
- `git diff main --stat`: exactly the allowed files.
- Targeted `git diff main --stat` against every forbidden path: empty.
- Four fresh independent read-only Codex reviewers, one per invariant axis (Epistemic
  Origin/Provenance; Current Input/Decision Impact/Conflict; Schema/Validator/Cross-Artifact
  References; Force/Cross-Axis/Corpus) — see `REVIEW_STATE.md`'s "Latest Review" for findings and
  disposition.

## Next Gate

Commit, push, and open one PR against `mihvernetwork/mihver:main`, title "M0: implement Dependency B
for Intent Parsing memory provenance". Do not merge. Human review of that PR is the next gate; it
authorizes only Dependency B as scoped above — not Dependency C/D, not Requirement Derivation's own
`MemoryContext` authorization, and not any `mihver-brain` or runtime memory-integration work.
