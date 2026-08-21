# ADR-0002 Adversarial Remediation

Task: `ADR-0002-ADVERSARIAL-REMEDIATION`. Branch: `fix/adr-0002-adversarial-remediation`.
Remediates the confirmed findings of `ADR-0002-ADVERSARIAL-REVIEW` (PR #10, not yet merged).

## Scope

This task was explicitly authorized to modify `docs/examples/INTENT_CASES.md` and
`docs/contracts/INTENT_SPEC.md` within a narrow scope — both are otherwise frozen documents. No
redesign of the epistemic model and no JSON Schema shape change were authorized or made.
`schemas/**` and `tests/contracts/validate-contracts.mjs` are confirmed byte-for-byte unchanged
versus `main` (independently confirmed by Reviewer B via `git diff`, and by Claude via `git status`
before staging).

## 1. Case 13 — Ambiguity/Unknown contradiction

Fixed. The prior review found Case 13 classified the same open item (which environments
"deployment" covers) as an **Ambiguity** in one bullet and, two paragraphs later, as staying
**Unknown** in another. The fix applies `INTENT_SPEC.md`'s existing practical test consistently —
the word "deployment" itself supports multiple readings, which is the Ambiguity test, not the
Unknown test — and corrects only the mislabeled bullet to say "Ambiguity," without introducing a
new Open Item category. Reviewer A independently confirmed this fix is correct and grounded in the
contract's actual practical-test wording.

## 2. Decision Impact — outcome-relative clarification and re-rating

Added a new `INTENT_SPEC.md` subsection, "Decision Impact Is Outcome-Relative," between the four
level definitions and "Decision Impact Provenance," making explicit that Decision Impact measures
the eventual architectural consequence of proceeding unresolved — not whether resolution happens to
be procedurally deferrable to a later pipeline stage. Independently evaluated each of Cases 2, 6, 9,
10, 11, 14 against this test, per the task's explicit instruction not to blindly re-rate all six:

| Case | Result | Reasoning |
|---|---|---|
| 2 (research system) | MEDIUM → **HIGH** | Downstream fork is "whether the architecture needs authenticated/licensed data access at all" — shape-level. |
| 6 (budget constraint) | **Unchanged (MEDIUM)** | The budget ceiling's existence is already an accepted Claim; only its category scope is unresolved — a detail within an already-determined constraint, not a shape fork. Independently re-verified this holds after the new subsection was added. |
| 9 (conditional requirement) | LOW → **HIGH** (via an intermediate, later-corrected MEDIUM — see below) | Final: whether the architecture needs a runtime local/cloud switching subsystem at all, or can be resolved statically, is a shape fork. |
| 10 (negative requirement) | MEDIUM → **HIGH** | "Which output mechanisms are even eligible" is a materially different output architecture, not a detail. |
| 11 (invoice renaming) | Extraction-mechanics: MEDIUM → **HIGH**; edge-case handling: internal MEDIUM/LOW mismatch between two bullets fixed to consistent LOW | Extraction determines whether an OCR/document-parsing subsystem exists at all — shape-level. Edge-case handling (missing fields, collisions) remains a detail within whichever extraction architecture is chosen. |
| 14 (unknown scale) | MEDIUM → **HIGH** | "Elastic/distributed capacity or a simpler fixed-capacity design" is explicitly the shape-level fork the case's own text already named. |

### Self-correction during review (material)

Two independent Codex reviewers were dispatched after the above changes (Reviewer A: epistemic
correctness of Case 13 + the six ratings; Reviewer B: fixture/schema/validator coverage and
regression correctness). Reviewer A found two real problems that Claude verified directly against
the edited text and then fixed — this is not a case of relaying the reviewer's verdict, but of
checking the specific textual claim and confirming it held:

1. **Case 13's own Decision Impact rating (MEDIUM) newly contradicted the new outcome-relative
   subsection.** Case 13's text states the unresolved item determines "whether an approval-gate
   mechanism needs to exist in the architecture at all" — verbatim the shape-level pattern the new
   subsection defines as HIGH — yet it still read MEDIUM. This was not one of the six cases the task
   named for re-rating, but it is a direct, freshly-introduced consequence of this task's own
   `INTENT_SPEC.md` edit, and Case 13 was already within this task's authorized editing scope for
   its Ambiguity/Unknown fix. Re-rated MEDIUM → HIGH, with the "requires a competing Conflict claim
   to reach HIGH" reasoning removed as exactly the stage-/conflict-relative reasoning the new
   subsection rejects.
2. **Case 9's original re-rating rationale (MEDIUM) contained a logical error.** It claimed "the
   Claim itself already settles" that a fallback mechanism must exist, once the condition is
   stated. Reviewer A correctly pointed out a necessary condition ("only use cloud if local can't
   support the workload") does not establish that a runtime-switching mechanism must be built — a
   statically-resolved deployment choice, decided once at design time, can equally satisfy the
   conditional claim if the workload turns out to be knowable in advance. Re-rated MEDIUM → HIGH
   with corrected reasoning: the unresolved item determines *whether* a runtime monitoring/fallback
   subsystem is needed at all (shape-level), not merely how one is tuned.

A third, smaller gap Reviewer A found: the new subsection's "least favorable reading" test, as
originally worded, had no bound and could be read as license to invent arbitrary worst-case
scenarios — in tension with the existing Open Item Relevance Test's restriction against speculative
Open Items. Tightened by binding "least favorable reading" to "materially plausible" and to the
same "directly implicated boundary" language the Relevance Test already uses elsewhere in
`INTENT_SPEC.md`, rather than inventing new machinery.

### Findings not acted on (flagged, not fixed — outside this task's authorized scope)

- **Case 18** ("false technical premise from user") uses explicitly stage-relative language — "LOW
  at the intent-capture stage itself," "LOW for Intent Parsing specifically" — that Reviewer A
  correctly notes is no longer a valid basis under the new outcome-relative subsection. Case 18 was
  not one of the six cases this task was authorized to re-rate, and was not part of the Case 13 fix.
  **Not edited.** Flagged as required follow-up work for a future task with explicit authorization
  to touch Case 18.
- **Case 11's edge-case handling** (missing/malformed fields bundled with filename collisions,
  both LOW) — Reviewer A suggested missing-field handling alone might warrant a review/exception
  workflow, which could itself be shape-level. Independently evaluated: this is a genuine judgment
  call, not a confirmed conflict with the contract's stated test the way Case 13/9 were — a simple
  skip-and-log default is an equally defensible reading, and the case's own text doesn't establish
  that a whole new subsystem is required either way. **Not changed.** Flagged as a lower-confidence
  open question, not a defect.
- **Case 2's item bundling** — Reviewer A noted the case rates "competitor identity and source
  scope" jointly as HIGH, but only source scope's own stated downstream consequence
  (authenticated/licensed access) clearly earns HIGH on its own; competitor identity alone isn't
  separately argued to that level. The top-line HIGH rating is confirmed correct since at least one
  bundled item earns it. **Not changed** — a precision note, not a rating error.

## 3. Adversarial fixture coverage

Added 8 new fixtures (4 valid/invalid pairs), with no schema or validator change:

- `scope_condition`: valid non-empty value (mirrors Case 9's conditional claim) + invalid empty
  string (schema `minLength` violation).
- `reported_third_party` speaker attribution: valid with `attribution` + invalid missing
  `attribution` (schema `required` violation).
- Non-`operative` `discourse_role` values (`example`, `quotation`, `sample`): one valid fixture
  exercising all three + invalid out-of-enum value (schema `enum` violation).
- Claim-bearing cross-version supersession matching Case 20: a v2 `IntentSpec` with
  `supersedes_intent_spec_id` set, `user_idea_refs` listing both UserIdea versions, and a single
  live claim (the corrected $500/month claim) — the superseded $100/month claim is not duplicated,
  consistent with `INTENT_SPEC.md`'s "Revision and Version Semantics." Invalid counterpart: a claim
  whose `provenance.user_idea_version` references a version not listed in `user_idea_refs` (closes
  the I-15-adjacent gap the prior review flagged — no existing fixture tested this failure mode).

No existing schema/validator defect was discovered; none of the new fixtures required a schema or
validator change to pass — confirmed by both Claude (`npm test` before and after) and Reviewer B
(byte-for-byte `git diff` against `main` for `schemas/**` and `validate-contracts.mjs`).

## 4. Validation

- `npm test`: **32/32 fixtures pass** (24 pre-existing, unmodified — confirmed via SHA-256/`git
  diff` by Reviewer B — plus 8 new), run by Claude both before and after the post-review
  self-correction fixes.
- Two independent read-only Codex reviewers dispatched in parallel (Reviewer A: epistemic
  correctness of Case 13 + the six Decision Impact ratings; Reviewer B: fixture/schema/validator
  coverage and regression correctness).
- Claude independently verified Reviewer A's two material findings by direct textual comparison
  against the edited files (quoted above) before applying the corresponding fixes, and verified
  Reviewer B's fixture-correctness claims are consistent with the schema/validator content read
  during this task — not relayed uncritically, per `REVIEW_PROTOCOL.md`.
- Reviewer B's one procedural note (new fixtures were untracked at review time) is expected and
  resolved by this task's own commit, per its `Commit/push allowed: yes` authorization.

## Final Recommendation

**`REQUIRED_CHANGES_REMAIN`**

Not `REDESIGN_REQUIRED` — no case in this remediation, or in the prior review, required or now
requires re-architecting the Claim/Open Item/Conflict model, and Reviewer B found no schema
representability failure. Not `READY_TO_RECONSIDER_ADR_ACCEPTANCE` — one confirmed, real
inconsistency remains unaddressed: **Case 18's stage-relative Decision Impact language is now
inconsistent with the outcome-relative clarification this task added**, and it was correctly out of
this task's authorized scope to fix (not one of the named six cases, not Case 13). A small follow-up
task, explicitly authorized to touch Case 18, should re-rate it under the same outcome-relative test
applied here before `ADR-0002`'s Status is reconsidered. Case 11's edge-case bundling is a lower-
confidence open question worth a second look in the same pass, though it is not a confirmed defect.

Everything this task was explicitly authorized to fix has been fixed and independently verified:
Case 13's category contradiction, Cases 2/9/10/11/14's Decision Impact miscalibration (including two
issues introduced by this task's own edit and caught during its own review pass, not left for a
future task), and the fixture coverage gaps for `scope_condition`, `reported_third_party`,
non-`operative` `discourse_role`, and claim-bearing cross-version supersession.

## Reviewer Attribution

Two independent read-only Codex MCP sessions, dispatched in parallel from disjoint task contracts
(epistemic correctness; fixture/schema/validator coverage), per `AGENT_POLICY.md`'s Task Contract
and Parallel Worker Rules. Full verbatim reports retained in this session's transcript; this
document is Claude's critically-reviewed synthesis, including two material self-corrections made
after independently verifying Reviewer A's findings against the actual edited text — not a direct
relay of either reviewer's output.
