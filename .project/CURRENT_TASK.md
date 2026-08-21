# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

ADR-0002-HANDOFF-CONSISTENCY-FIX

## Objective

Fix a contradiction an external human review found, surviving all prior review rounds:
`INTENT_SPEC.md`'s "Decision Impact Is Outcome-Relative" subsection said a HIGH/CRITICAL item could
be safely deferred because "Requirement Derivation or a later stage will" resolve it — directly
contradicting the contract's own "Handoff Status: Blocked vs. Failed" section, which states
Requirement Derivation never consumes a Blocked version. Fix without changing the outcome-relative
Decision Impact model itself (level definitions, practical test unchanged). Fix Case 14 (identical
contradiction), then grep/review all 20 cases for the same pattern. Continued on the same branch,
updating PR #11 in place — not a new PR.

## Branch / Base

Branch: `fix/adr-0002-adversarial-remediation` (unchanged, continued from prior tasks)
Base: `main` (`3bedeb856fe8e0886042add4427d9828d6978908`)

## Status

**Complete.** Fixed the core contradiction in `INTENT_SPEC.md`'s outcome-relative subsection:
rewrote the bullet claiming "Requirement Derivation or a later stage will" resolve a HIGH/CRITICAL
item to state the correct rule (permanently Blocked; resolution requires a new Intent
Parsing/revision pass producing a new, superseding version; only that new version, if eligible, may
reach Requirement Derivation), explicitly contrasted with MEDIUM/LOW's legitimate same-version
downstream handling. Fixed Case 14's identical contradiction (two bullets rewritten). Two
independent Codex reviewers (A: `INTENT_SPEC.md` handoff/Decision Impact consistency; B: corpus-wide
HIGH/CRITICAL handoff consistency across all 20 cases) found, and Claude independently verified and
fixed: Case 11's ambiguous "must be carried forward" attached to its HIGH extraction-mechanics item
(reworded, plus a light clarification to its adjacent "What IntentSpec must NOT decide" bullet);
three further `INTENT_SPEC.md` passages with the same latent ambiguity (Assumption Policy's generic
Requirement-Derivation-decides-operational-gaps statement, now qualified to LOW/MEDIUM; the
"Backward leakage" Common Violations bullet, now distinguishing interpretive resolution from
operational gap-filling; an Examples-section entry that backwards-said Decision Impact is "assessed
downstream"). Case 3's similar-looking phrase was independently evaluated by both reviewers and
confirmed to describe an unrelated future risk note, not resolution of its HIGH item — left
unchanged. `npm test`: 32/32 throughout (prose-only changes; no fixture/schema/validator file
touched). Comprehensive `grep -n "Requirement Derivation"` sweep of both files re-run after all
fixes; every remaining occurrence confirmed consistent. Full report:
`docs/reviews/ADR-0002-ADVERSARIAL-REMEDIATION.md` (section 6, "Handoff Consistency Fix").

Final recommendation: **READY_TO_RECONSIDER_ADR_ACCEPTANCE** (reaffirmed) — not
`REDESIGN_REQUIRED` (no representability/model-shape failure across four full review rounds), not
`REQUIRED_CHANGES_REMAIN` (the contradiction is fixed at its source and re-verified corpus-wide, no
new confirmed defect remains open). `ADR-0002`'s Status was **not** changed by this task, per its
explicit instruction — that decision belongs to the human.

## Allowed Scope

Update (explicitly authorized, narrow scope only):
- `docs/contracts/INTENT_SPEC.md` — fix the specific handoff/Decision-Impact contradiction only;
  the outcome-relative model's level definitions and practical test are not to be changed.
- `docs/examples/INTENT_CASES.md` — fix Case 14 and any other case found to contain the identical
  contradiction pattern; no Decision Impact level recalibration unless a direct contradiction
  requires it.
- `docs/reviews/ADR-0002-ADVERSARIAL-REMEDIATION.md` — update in place (not a new report file).

Update: `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`

Forbidden: `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md` (Status unchanged), `schemas/**`,
`tests/contracts/validate-contracts.mjs`, model shape changes of any kind, `.project/PROJECT_STATE.md`,
`.project/DECISIONS_LOG.md`, `CLAUDE.md`, `docs/development/**`, and anything Night
Runner/RRF-related or otherwise unrelated to this task.

## Required Context

- `CLAUDE.md`, `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
- `docs/reviews/ADR-0002-ADVERSARIAL-REMEDIATION.md` (prior work this task extends)
- `docs/contracts/INTENT_SPEC.md`, `docs/examples/INTENT_CASES.md` (all 20 cases)

## Validation

- `npm test`: 32/32 throughout (unaffected by prose-only changes).
- Two independent reviewers (contract consistency; corpus-wide consistency), both independently
  verified by Claude against the actual text before any fix was applied.

## Next Gate

PR #11 updated in place (same branch, same PR — not a new one), reaffirming
`READY_TO_RECONSIDER_ADR_ACCEPTANCE`. Human review of the updated report is the next gate. Not
merged, per task instruction. `ADR-0002`'s Status change (if the human agrees) is a separate, later
action this task does not itself perform.
