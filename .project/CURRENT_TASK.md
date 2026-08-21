# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-STEP-03A-FINAL-CROSS-REFERENCE-CLEANUP

## Objective

Fix one stale cross-reference a final independent verification found in `REQUIREMENT_CASES.md`: Case
7b's Eligibility paragraph said "the same pattern as Case 2's Completeness," but Case 2 is now
explicitly Partial (from the prior `M0-STEP-03A-RESIDUAL-CROSS-CONTRACT-FIX` round). Replaced with a
genuinely equivalent Complete binary-check example (Case 8). A deterministic sweep of the whole file
for every "Case X's Complete/Completeness/Partial"-style reference then found two more instances of the
same staleness the sweep's own regex missed on a literal match (broader phrasing: "Case 1's 'approval
gate' (testable now...)" in Case 16, and "Case 1's or Case 9's (those have a testable Requirement with
an open scope/trigger detail)" in Case 15) — both referencing Case 1's/Case 9's pre-fix "testable now"
framing, which the same prior round had already corrected (Case 1 and Case 9's own Requirements are
individually Partial too, not "testable now" with only a detail open). Both fixed. No semantics,
invariants, ADR decisions, or frozen files changed — prose-only cross-reference corrections.

This task supersedes the prior task's own record of what remained; for context on the three residual
issues that round fixed, see below:
(1) R-21 allowed a surviving Ambiguity or Conflict — not just an Unknown — to legitimately route a
candidate to a Complete Requirement's INDETERMINATE branch, contradicting R-08 and "LOW/MEDIUM Open
Items and Conflicts" (which give Requirement Derivation no authority over Ambiguity/Conflict at any
impact level); (2) Case 4 claimed its cost-category Unknown had exactly two recorded, exhaustive
readings, but frozen `INTENT_CASES.md` Case 6 records it only as an open-ended gap — Case 4 was
re-derived rather than preserved by default; (3) "Requirement Cardinality and Granularity" still used
a generic notification-preference "detection + delivery" example, reintroducing the exact
unstated-responsibility bug Case 12 was previously rewritten to avoid. Frozen boundaries respected:
`ADR-0002`, `INTENT_SPEC.md`, `USER_IDEA.md`, existing schemas/validator, and `INTENT_CASES.md` were
not modified. `ADR-0003`'s Status remains Proposed.

## Branch / Base

Branch: `m0/step-03a-requirement-contract` (continued; PR #13 already open from prior sub-tasks)
Base: `main` (`a20d647` — includes merged PR #10, #11, #12; `ADR-0002` Status: Accepted)

## Status

**Complete (this cleanup task).** The stale Case 7b → Case 2 cross-reference is fixed, plus two more
instances of the same staleness the deterministic sweep surfaced (Case 16 → Case 1, Case 15 → Case
1/Case 9), all now referencing cases whose current Eligibility genuinely matches the claim being made.
No reviewers were dispatched for this narrow, mechanical cleanup, per the task's own instructions.
`npm test`: 32/32. Verdict: **CLEAN**.

---

Status of the prior `M0-STEP-03A-RESIDUAL-CROSS-CONTRACT-FIX` round, retained for context: **Complete.**
All three findings fixed at the source, then three independent read-only Codex reviewers
dispatched (A: Ambiguity/Conflict × R-21 lifecycle consistency; B: Case 4 provenance/domain-of-Unknown
consistency; C: cardinality examples × unstated-responsibility leakage) found further real, deeper
instances of the same three patterns, all independently re-verified before being applied:

- (Reviewer A) The explicit R-21 fix (Ambiguity/Conflict can never drive INDETERMINATE) didn't
  propagate to several passages using different vocabulary for the same underlying bug: Cases 1, 2, and
  9 each called an individual Requirement "Complete" (or "Complete for that Requirement," "a Complete,
  firm Requirement," "existence and shape are Complete") while that Requirement's own satisfaction
  genuinely depended on an unresolved Ambiguity — functionally the same "Ambiguity indirectly makes a
  Requirement Complete" outcome R-21's fix exists to forbid, just not phrased as literal INDETERMINATE
  routing. Fixed: all three Requirements are now correctly Partial at the individual level too, per
  R-21 condition 1 and "LOW/MEDIUM Open Items and Conflicts"'s existing rule that any Requirement whose
  content genuinely depends on an Ambiguity/Conflict "must likewise remain unresolved." Also fixed
  "Preservation of Conditions and Scope"'s trigger-Ambiguity paragraph and ADR-0003's Complete/Partial
  calibration-risk wording, which had implied this was a judgment call rather than unconditional.
- (Reviewer B) Case 4's *filled* branch was challenged as potentially violating R-19 itself (does
  choosing a cost-category default narrow "the boundary of a stated constraint"?) — independently
  re-derived and kept fillable: the stated threshold ($100/month) is unchanged under any reading; only
  the measurement of the compared quantity differs, and "some candidate's verdict can flip" cannot be
  the R-19 test (it would make every measurement-detail fill non-fillable). Strengthened both Case 4's
  text and R-19 itself with this threshold-vs-measurement distinction. Also found Case 14 (superseded
  IntentSpec) silently ignored the same cost-scope Unknown that `INTENT_CASES.md` Case 20 confirms
  persists into the v2 correction — fixed to mirror Case 4's now-established fork (Complete if filled,
  Partial if carried forward unresolved).
- (Reviewer C) Confirmed the cardinality fix is sound and no other case exhibits actor/responsibility
  misassignment beyond what was already fixed; two borderline findings (Case 7a's inference scope,
  Case 11's "surface indicators" mechanism choice) were independently re-derived and rejected as a
  different failure mode (testability/mechanism vagueness, already handled separately) rather than the
  specific actor-misassignment pattern this audit targets — documented transparently rather than
  silently dismissed. Added a hardening note to ADR-0003's Risks section explicitly naming
  unstated-actor assignment as a named species of the existing Requirement-Level-Inference-laundering
  risk, per Reviewer C's suggestion.

`npm test`: 32/32 throughout.

Final recommendation: **APPROVED** — not `REDESIGN` (no reviewer found the model's basic shape
unsound; every confirmed defect was the same three already-diagnosed patterns recurring in
not-yet-swept locations, not a new structural problem); not `APPROVE_WITH_REQUIRED_CHANGES` (all
confirmed defects — including the deeper, same-pattern instances the reviewers found beyond Claude's
initial fixes — were fixed and re-verified before this verdict was reached). See
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
- Three independent Codex reviewers (A/B/C), each finding real, deeper instances of the same three
  externally-reported patterns surviving in locations Claude's initial fixes hadn't reached (Cases 1/2/
  9's individual-Requirement Completeness claims; Case 14's silently-ignored cost-scope Unknown; ADR
  wording) — all independently re-verified by Claude against the actual text before being fixed. Two
  reviewer findings (Case 7a, Case 11) were independently re-derived and rejected as a different,
  already-handled failure mode, with reasoning documented rather than silently dismissed.

## Next Gate

PR #13 updated in place (base `mihvernetwork/mihver:main`, compare
`devSerdar:m0/step-03a-requirement-contract` — pushed via the `devSerdar` fork per this task's
explicit instruction, not `mihvernetwork`). Do not merge. `ADR-0003` remains Proposed. Human review of
the PR is the next gate.
