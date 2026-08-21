# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-STEP-03A-FINAL-INTRINSIC-CONSISTENCY-FIX

## Objective

Fix three remaining issues an external final review found in the M0 Step 03A draft
(`REQUIREMENT_SPEC.md`, `ADR-0003`, `REQUIREMENT_CASES.md`): (1) "What Qualifies as a Requirement"
contradicted R-20 by implying a binding/constraining Claim with unresolved force could already become
a Requirement; (2) R-21's Complete/Partial test used future-candidate-population phrases
("overwhelming majority of candidates," "narrow boundary zone") instead of being decidable from the
artifact's own semantics alone — re-derived from an intrinsic principle and rebuilt around an explicit
SATISFIED/NOT_SATISFIED/INDETERMINATE satisfaction-procedure model, re-deriving Case 4 rather than
preserving it by default; (3) "User-Selected Technology" implied resolving a named technology's
*negotiability* could, by itself, revise its normative *strength* — these are independent axes.
Frozen boundaries respected: `ADR-0002`, `INTENT_SPEC.md`, `USER_IDEA.md`, existing
schemas/validator, and `INTENT_CASES.md` were not modified. `ADR-0003`'s Status remains Proposed.

## Branch / Base

Branch: `m0/step-03a-requirement-contract` (continued; PR #13 already open from prior sub-tasks)
Base: `main` (`a20d647` — includes merged PR #10, #11, #12; `ADR-0002` Status: Accepted)

## Status

**Complete.** All three findings fixed at the source, then three independent read-only Codex reviewers
dispatched (A: eligibility × force/R-20; B: completeness/testability intrinsicness × Case 4/R-21; C:
force × negotiability × cross-document consistency) found further real defects in Claude's own fixes,
all independently re-verified before being applied:

- (Reviewer A) A second instance of the same R-20 contradiction survived in the Information-Loss
  Rules bullet ("a user-named technology survives as a stated constraint") — reworded to cover both
  the force-resolved and force-unresolved branches instead of overclaiming the former unconditionally.
- (Reviewer B) The newly-written R-21 was gameable: nothing required the SATISFIED/NOT_SATISFIED/
  INDETERMINATE procedure to be *faithful* — a trivial "always INDETERMINATE" procedure technically
  satisfied the letter of the rule. Closed with an explicit faithfulness/maximal-determinacy
  requirement: the procedure must return SATISFIED or NOT_SATISFIED whenever every recorded reading
  agrees, and may only return INDETERMINATE where the readings genuinely disagree for that candidate —
  itself an intrinsic, per-candidate test, not a population claim.
- (Reviewer B) Case 4's worked procedure had a strict-vs-inclusive threshold bug: "under $100/month"
  is a strict inequality, but the procedure used ≤/> instead of </≥, misclassifying a candidate priced
  at exactly $100 as SATISFIED. Fixed, and re-verified the corrected procedure is airtight and
  faithful (never returns INDETERMINATE where readings agree).
- (Reviewer B) Four more instances of stale population-dependent completeness language ("...for
  essentially every candidate") survived in Cases 7b, 8, and 11's prohibition clauses — reworded to
  intrinsic, per-candidate procedure language.
- (Reviewer C) Three more force/negotiability conflations survived Claude's own initial fix: R-19's
  "Note on terminology" said resolving negotiability "directly decides whether a stated constraint is
  binding" (should be exclusivity, not bindingness); the same phrase recurred inside "User-Selected
  Technology" itself ("binding to only this option"); ADR-0003's Decision item 3 repeated the same
  coupling; Case 15 presented "negotiable" as a third force category alongside "obligation" and
  "preferred." All four reworded to keep force (→ strength) and negotiability (→
  exclusivity/substitutability) as genuinely independent axes, matching the already-fixed closing
  paragraph they had been inconsistent with.

`npm test`: 32/32 throughout.

Final recommendation: **APPROVED** — not `REDESIGN` (no reviewer found the model's basic shape
unsound; every confirmed defect was a wording/rigor gap, including the R-21 gaming loophole, which was
a rigor gap in a rule's own definition, not evidence the underlying three-valued model is wrong); not
`APPROVE_WITH_REQUIRED_CHANGES` (all confirmed defects — including the ones the reviewers found in
Claude's own same-task fixes — were fixed and re-verified before this verdict was reached). See
`.project/REVIEW_STATE.md`'s "Latest Review" for the full defect list.

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
- Three independent Codex reviewers (A/B/C), each finding real residual defects in Claude's own
  same-task fixes — including a gaming loophole in the newly-written R-21 and a strict-inequality math
  bug in Case 4's worked procedure — all independently re-verified by Claude against the actual text
  before being fixed.

## Next Gate

PR #13 updated in place (base `mihvernetwork/mihver:main`, compare
`devSerdar:m0/step-03a-requirement-contract` — pushed via the `devSerdar` fork per this task's
explicit instruction, not `mihvernetwork`). Do not merge. `ADR-0003` remains Proposed. Human review of
the PR is the next gate.
