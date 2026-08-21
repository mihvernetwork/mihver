# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-STEP-03A-CROSS-AXIS-REMEDIATION

## Objective

Remediate five cross-axis semantic issues an external human review found in the M0 Step 03A draft
(`REQUIREMENT_SPEC.md`, `ADR-0003`, `REQUIREMENT_CASES.md`) that prior file-range-based reviewers had
not tested as invariants spanning the whole corpus: (1) normative strength leaking into/from the
epistemic axis (origin/confidence/provisionality); (2) an eligibility test distinguishing which
surviving Unknowns are Requirement Derivation's to fill from which secretly decide intent/normative
authority; (3) Case 15's named-technology scenario manufacturing strength where the source Claim's
force never resolved; (4) Complete/Partial redefined around genuine testability, not merely
Ambiguity/Conflict presence; (5) Case 12 no longer assigning unstated architectural responsibility.
Frozen boundaries respected: `ADR-0002`, `INTENT_SPEC.md`, `USER_IDEA.md`, existing
schemas/validator, and `INTENT_CASES.md` were not modified — no genuine contradiction requiring their
modification was found. `ADR-0003`'s Status remains Proposed throughout, per task instruction.

## Branch / Base

Branch: `m0/step-03a-requirement-contract` (continued; PR #13 already open from the prior sub-task)
Base: `main` (`a20d647` — includes merged PR #10, #11, #12; `ADR-0002` Status: Accepted)

## Status

**Complete.** Fixed all five findings from the external review, plus (per the task's explicit
instruction that Claude independently verify every material finding) four independent read-only
Codex reviewers dispatched by invariant axis rather than file range — A: normative vs. epistemic axis;
B: resolution authority (which Unknowns are fillable); C: completeness/testability; D: cross-document
contradiction hunting. Each finding was independently re-verified by Claude against the actual text
before any fix was applied — not relayed uncritically. See `.project/REVIEW_STATE.md`'s "Latest
Review" (moved to History once this task's own record is superseded) for the full list of
confirmed-and-fixed defects, including two found independently by two reviewers each (a residual
"strength may be weakened" sentence left over from the axis-independence fix; an internal force/result
contradiction in Case 7), one scope bug in the newly-added R-20 that a carve-out fixed, an ADR-0003
overclaim about confidence being mandatory on every Requirement, a mislabeled Unknown-vs-Ambiguity in
Case 16, a Failed-definition contradiction with R-17 in Case 17, an incorrect R-01 citation in an
Anti-Example, and one reviewer disagreement (Case 4's cost-category Unknown fillability) resolved by
Claude's own independent re-derivation rather than by majority vote, documented transparently in the
case text itself. A final read-through also caught one more cross-reference bug (an Examples-section
citation pointing at the wrong case number) that no reviewer had flagged. `npm test`: 32/32 throughout
(unaffected — no schema/validator/fixture file touched, per this task's explicit scope).

Final recommendation: **READY_FOR_HUMAN_REVIEW** — not `REDESIGN_REQUIRED` (no reviewer found the
model's basic shape — provenance chain, origin preservation, non-inflationary force mapping,
Complete/Partial/Failed, the R-19/R-20/R-21 additions — unsound; every confirmed defect was a
drafting/consistency bug, not a structural one; the task's explicit prohibition on redesigning the
provenance chain, eligible-input gate, versioning/supersession model, or leakage boundary was
respected, since no finding proved a direct dependency on any of them); not `REQUIRED_CHANGES_REMAIN`
(every confirmed defect across all four axis reviewers was fixed and independently re-verified against
the actual edited text, not left open).

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
- Four independent Codex reviewers by invariant axis (A/B/C/D), all findings independently verified
  by Claude against the actual text before any fix was applied. One reviewer disagreement (Case 4)
  resolved by Claude's own independent re-derivation, not by majority vote — documented in the case
  text itself.

## Next Gate

PR #13 updated in place (base `mihvernetwork/mihver:main`, compare
`devSerdar:m0/step-03a-requirement-contract` — pushed via the `devSerdar` fork per this task's
explicit instruction, not `mihvernetwork`). Do not merge. `ADR-0003` remains Proposed. Human review of
the PR is the next gate.
