# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

ADR-0002-ADVERSARIAL-REMEDIATION

## Objective

Resolve the confirmed findings from `ADR-0002-ADVERSARIAL-REVIEW` (PR #10, not yet merged) without
redesigning the epistemic model or changing the JSON schema shape: (1) fix `INTENT_CASES.md`
Case 13's Ambiguity/Unknown contradiction; (2) make Decision Impact's outcome-relative
interpretation explicit in `INTENT_SPEC.md` and independently re-evaluate Cases 2, 6, 9, 10, 11,
14 against it, re-rating only cases that actually conflict; (3) add adversarial fixture coverage
for `scope_condition`, `reported_third_party` speaker attribution, non-`operative` `discourse_role`
values, and a claim-bearing cross-version supersession (Case 20); (4) validate via tests plus two
independent read-only Codex reviewers, and issue a final recommendation. This task is explicitly
authorized to modify `INTENT_CASES.md` and `INTENT_SPEC.md` within this narrow scope — both are
otherwise frozen documents.

## Branch / Base

Branch: `fix/adr-0002-adversarial-remediation`
Base: `main` (`3bedeb856fe8e0886042add4427d9828d6978908`)

## Status

**Complete.** Fixed Case 13's Ambiguity/Unknown contradiction; added an outcome-relative Decision
Impact clarification to `INTENT_SPEC.md`; independently re-evaluated Cases 2, 6, 9, 10, 11, 14
(re-rated 2, 9, 10, 11-extraction, 14 to HIGH; left 6 at MEDIUM after genuine evaluation); added 8
new fixtures for `scope_condition`, `reported_third_party`, non-`operative` `discourse_role`, and
claim-bearing cross-version supersession (Case 20). Two independent Codex reviewers found two real
issues Claude verified and fixed directly: Case 13's own Decision Impact rating had become
inconsistent with the new outcome-relative clarification (fixed, MEDIUM → HIGH), and Case 9's
original re-rating rationale contained a logical error (a necessary condition does not establish a
runtime mechanism must exist — corrected, re-rated to HIGH). `npm test`: 32/32 fixtures pass.
Case 18's now-inconsistent stage-relative language was found but correctly left unedited (outside
this task's authorized scope) and flagged for a follow-up task. Full report:
`docs/reviews/ADR-0002-ADVERSARIAL-REMEDIATION.md`.

Final recommendation: **REQUIRED_CHANGES_REMAIN** — not `REDESIGN_REQUIRED` (no representability or
model-shape failure found), not `READY_TO_RECONSIDER_ADR_ACCEPTANCE` (Case 18's now-inconsistent
language is a known, real, unaddressed gap). `ADR-0002`'s Status was not changed, per task
instruction. No schema or validator file was modified — confirmed unchanged via `git diff` against
`main`.

## Allowed Scope

Update (explicitly authorized, narrow scope only):
- `docs/examples/INTENT_CASES.md` — Case 13 fix; re-rating of Cases 2, 6, 9, 10, 11, 14 only where
  independently found to actually conflict with the outcome-relative reading.
- `docs/contracts/INTENT_SPEC.md` — minimal clarification that Decision Impact is outcome-relative.

Add:
- `tests/contracts/fixtures/valid/**`, `tests/contracts/fixtures/invalid/**` — new fixtures for
  `scope_condition`, `reported_third_party`, non-`operative` `discourse_role`, claim-bearing
  supersession.
- `docs/reviews/ADR-0002-ADVERSARIAL-REMEDIATION.md` (new report)

Update: `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`

Forbidden: `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md` (Status must not change this task, and
no other edit to this file is in scope either), `schemas/**` (no schema shape change —
if an existing schema/validator defect is found, stop and report, don't silently redesign),
`tests/contracts/validate-contracts.mjs` (no validator logic change unless a defect is found and
explicitly reported first), `.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`,
`CLAUDE.md`, `docs/development/**`.

## Required Context

- `CLAUDE.md`, `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
- `docs/reviews/ADR-0002-ADVERSARIAL-REVIEW.md` (prior review this task remediates)
- `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md` (read-only context)
- `docs/contracts/INTENT_SPEC.md`, `docs/examples/INTENT_CASES.md`
- `schemas/m0/intent-spec.schema.json`, `schemas/m0/user-idea.schema.json`
- `tests/contracts/validate-contracts.mjs` and `tests/contracts/fixtures/**`

## Validation

- Baseline `npm test`: 24/24 (before remediation changes).
- Full validation after changes and two independent Codex reviews: pending.

## Next Gate

PR to `mihvernetwork/mihver:main` expected once remediation is complete and validated (push to
personal fork, per PR #10's precedent — same push-access constraint applies). Do not merge. Do not
change `ADR-0002` Status in this task.
