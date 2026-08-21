# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

ADR-0002-FINAL-CONSISTENCY-SWEEP

## Objective

Close the remaining consistency gap flagged by `ADR-0002-ADVERSARIAL-REMEDIATION` before ADR-0002
acceptance can be reconsidered: Case 18's stage-relative Decision Impact language, plus a full
review of all 20 `INTENT_CASES.md` cases (not just previously-touched ones) against the
outcome-relative Decision Impact rule, checking for residual stage-relative reasoning and
Unknown-vs-Ambiguity consistency corpus-wide. Explicit follow-up to
`ADR-0002-ADVERSARIAL-REMEDIATION`, continued on the same branch, updating the same PR (#11) rather
than opening a new one.

## Branch / Base

Branch: `fix/adr-0002-adversarial-remediation` (unchanged, continued from the prior task)
Base: `main` (`3bedeb856fe8e0886042add4427d9828d6978908`)

## Status

**Complete.** Case 18 re-evaluated completely from first principles (not a predetermined level):
re-rated LOW → HIGH (negotiability of "blockchain" determines whether an entire distributed-ledger
architecture branch is mandatory vs. a conventional CRDT/OT-based alternative), stage-relative
language removed, a dangling Open-Item cross-reference fixed, retitled away from a title that itself
passed a suitability judgment the case's own body forbids. Three independent Codex reviewers (Cases
1–7, 8–14, 15–20) plus one cross-corpus consistency reviewer found and (after independent
verification) fixed: Case 7 recalibrated MEDIUM → HIGH (same shape-vs-tuning error the original
Case 9 fix had); Case 2 further split (competitor identity MEDIUM / source scope HIGH); six
Unknown → Ambiguity relabelings (Cases 9, 10, 14, 16, 17, 19) where wording already bore on the
question; a category error in Case 20 (and an identical pre-existing one in Case 11) where a
resolved Claim/event was wrongly assigned a Decision Impact level; a missing-provenance gap in
Case 17; a calibration/cross-reference fix in Case 4; imprecise "Blocked pending resolution"
phrasing (this pass's own wording) corrected to state permanent non-consumability; and one gap
(Case 16) Claude caught in its own final read-through, not from any dispatched reviewer. Several
other reviewer suggestions were independently evaluated and explicitly rejected as insufficiently
grounded (Case 1, Case 6 month/currency, Cases 3/4/5/15 completeness additions, Case 11's
missing-field/collision split, Case 12 and Case 14's remaining Unknowns) — documented in the report,
not silently ignored. `npm test`: 32/32 fixtures pass throughout (this sweep touched only
`docs/examples/INTENT_CASES.md` prose; no fixture, schema, or validator file changed). Full report:
`docs/reviews/ADR-0002-ADVERSARIAL-REMEDIATION.md` (section 5, "Final Consistency Sweep").

Final recommendation: **READY_TO_RECONSIDER_ADR_ACCEPTANCE** — not `REDESIGN_REQUIRED` (no
representability or model-shape failure found across three full review rounds), not
`REQUIRED_CHANGES_REMAIN` (the one previously-named blocker is fixed and re-derived from first
principles; all 20 cases now independently checked; remaining flagged items are genuine judgment
calls or out-of-scope completeness suggestions, not confirmed defects). `ADR-0002`'s Status was
**not** changed by this task, per its explicit instruction — that decision belongs to the human.

## Allowed Scope

Update (explicitly authorized, narrow scope only):
- `docs/examples/INTENT_CASES.md` — full-corpus consistency sweep, all 20 cases reviewable; changes
  applied only where independently confirmed as defects.
- `docs/reviews/ADR-0002-ADVERSARIAL-REMEDIATION.md` — update in place (not a new report file).

Update: `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`

Forbidden: `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md` (Status unchanged), `schemas/**`,
`tests/contracts/validate-contracts.mjs`, `docs/contracts/INTENT_SPEC.md` (already "now-authoritative"
per this task's own framing — not reopened this round), `.project/PROJECT_STATE.md`,
`.project/DECISIONS_LOG.md`, `CLAUDE.md`, `docs/development/**`, and anything Night
Runner/RRF-related or otherwise unrelated to this task.

## Required Context

- `CLAUDE.md`, `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
- `docs/reviews/ADR-0002-ADVERSARIAL-REMEDIATION.md` (prior remediation this task extends)
- `docs/contracts/INTENT_SPEC.md` (read-only this round, especially the outcome-relative subsection)
- `docs/examples/INTENT_CASES.md` (all 20 cases)

## Validation

- `npm test`: 32/32 throughout (unaffected by prose-only changes).
- Three parallel range reviewers + one cross-corpus reviewer, all independently verified by Claude
  against the actual text before any fix was applied.

## Next Gate

PR #11 updated in place (same branch, same PR — not a new one), now reflecting
`READY_TO_RECONSIDER_ADR_ACCEPTANCE`. Human review of the updated report and recommendation is the
next gate. Not merged, per task instruction. `ADR-0002`'s Status change (if the human agrees) is a
separate, later action this task does not itself perform.
