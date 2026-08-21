# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-STEP-03A-BRAIN-ASSISTED-FINAL-AUDIT

## Objective

A final audit of the M0 Step 03A draft (`REQUIREMENT_SPEC.md`, `ADR-0003`, `REQUIREMENT_CASES.md`),
informed by MIHVER Brain (`../mihver-brain`) engineering-lesson retrieval before planning the review.
Retrieved and applied two `mihver`-scope lessons: "Review coverage should be decomposed by invariant
axis" and "Cross-axis invariants require explicit review contracts" (both treated as advisory, not
authoritative). Dispatched four independent read-only Codex reviewers by invariant *interaction*
(A: normative × epistemic; B: resolution authority × lifecycle; C: testability × completeness ×
examples; D: cross-document contradiction matrix) rather than file range, and — per the Brain
lessons — added an explicit six-named-axis coverage checklist plus applied pairwise-interaction
scrutiny to Claude's own independent verification, not only to reviewer instructions. Frozen
boundaries respected: `ADR-0002`, `INTENT_SPEC.md`, `USER_IDEA.md`, existing schemas/validator, and
`INTENT_CASES.md` were not modified. `ADR-0003`'s Status remains Proposed throughout.

## Branch / Base

Branch: `m0/step-03a-requirement-contract` (continued; PR #13 already open from prior sub-tasks)
Base: `main` (`a20d647` — includes merged PR #10, #11, #12; `ADR-0002` Status: Accepted)

## Status

**Complete.** Four axis-interaction Codex reviewers found real, independently-verified defects the
prior (file-range and first invariant-axis) rounds had missed. Confirmed and fixed: (1) the
"Requirement-Level Inference" mechanism had no rule pinning its strength to its premise's strength or
requiring provisional marking, unlike the parallel R-03/R-04 rules for `IntentSpec`-level
Inferred/Assumed Claims — closed with new **R-22**; (2) Case 8 was an unfilled placeholder
("`[behavior implied by the assumed referent]`") that couldn't ground its own Complete/strength claims
and read as if Requirement Derivation decides force from the resolved content rather than compiling a
pre-recorded force — rewritten concretely; (3) Case 7a ("minimize data-locality exposure generally")
and Case 11's positive clause ("academic-performance-based indicators... who may need support") each
had zero recorded metric/comparator — the same missing-oracle defect class Case 16's "fast" fix had
addressed, but not caught there — both reclassified Partial for that clause, independent of their
(correct) strength; (4) R-21 itself had real wording tension between its first-sentence
no-invented-scope test and its boundary-refinement carve-out, sharpened into an explicit two-situation
test (genuine metric/threshold-with-boundary-refinement remains Complete vs. no-metric-at-all is
Partial) — this sharper test is what correctly separated the confirmed Case 7a/11 defects from the
still-rejected Case 4 reclassification; (5)-(9) five smaller cross-document clarity fixes (a stray
lowercase "ambiguity" in Case 4 risking confusion with the formal term; ADR-0003's compact force-map
summary implying all preferences map to SHOULD, missing the weak-preference→MAY tier; the "Partial"
prose over-narrowing revision to "an `IntentSpec` clarification" when an R-19-fillable Unknown can
instead be closed by Requirement Derivation alone; ADR-0003's "usable now" phrasing sitting awkwardly
next to "not authorized"; an ADR Open Question conflated with the already-resolved multi-clause
cardinality rule). **One reviewer disagreement resolved again, for a second independent round, by
re-derivation rather than majority vote**: two more reviewers (this round's B and C) independently
argued Case 4's cost-category Unknown should flip to Partial/non-fillable, joining last round's
Reviewer B — Claude re-derived the question a second time, this time articulating the crisp
metric-exists-vs-doesn't dividing line now in R-21, and kept Case 4 Complete/fillable; that same
sharpened line is what caught the genuinely different Case 7a/11 defects, which is itself evidence the
line is correctly drawn rather than merely defended. `npm test`: 32/32 throughout.

Final recommendation: **APPROVED** — not `REDESIGN`; not `APPROVE_WITH_REQUIRED_CHANGES` (all
confirmed defects were fixed in this same task, then re-verified against the edited text, before this
verdict was reached — nothing is left open pending a further round). See
`.project/REVIEW_STATE.md`'s "Latest Review" for the full defect list, the six-axis Brain-derived
coverage checklist, and the Brain Retrieval Impact report.

## Allowed Scope

Add:
- `docs/contracts/REQUIREMENT_SPEC.md`
- `docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`
- `docs/examples/REQUIREMENT_CASES.md`

Update: `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`

Forbidden (frozen, none touched): `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`,
`docs/contracts/INTENT_SPEC.md`, `docs/contracts/USER_IDEA.md`, `schemas/**`,
`tests/contracts/validate-contracts.mjs`, `docs/examples/INTENT_CASES.md`, `CLAUDE.md`,
`docs/development/**`, `.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`.

## Required Context

- `CLAUDE.md`, `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
- `docs/foundation/M0_SCOPE.md`, `docs/foundation/PRINCIPLES.md`, `docs/adr/ADR-0001-ARCHITECTURE-COMPILER-MODEL.md`
- `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`, `docs/contracts/INTENT_SPEC.md`,
  `docs/contracts/USER_IDEA.md` (read-only grounding)

## Validation

- `npm test`: 32/32 throughout (unaffected by this task's prose-only, no-schema-touched changes).
- Four independent Codex reviewers by invariant *interaction* (A/B/C/D), all findings independently
  verified by Claude against the actual text before any fix was applied. One reviewer disagreement
  (Case 4, now argued independently by three reviewers across two rounds) resolved a second time by
  Claude's own re-derivation, not by majority vote — this round's re-derivation produced a sharper,
  independently-useful rule (R-21's two-situation test) rather than just repeating the prior
  conclusion. MIHVER Brain (`../mihver-brain`) queried for review-planning lessons before dispatch;
  see `.project/REVIEW_STATE.md` for the retrieval and its concrete effect on the review plan.

## Next Gate

PR #13 updated in place (base `mihvernetwork/mihver:main`, compare
`devSerdar:m0/step-03a-requirement-contract` — pushed via the `devSerdar` fork per this task's
explicit instruction, not `mihvernetwork`). Do not merge. `ADR-0003` remains Proposed. Human review of
the PR is the next gate.
