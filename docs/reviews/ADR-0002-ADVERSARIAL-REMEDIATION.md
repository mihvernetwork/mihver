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

## 5. Final Consistency Sweep (`ADR-0002-FINAL-CONSISTENCY-SWEEP`)

A follow-up task, continued on this same branch and PR, closed the one gap the section above left
open (Case 18) and extended review to all 20 cases — not just the previously-touched ones — per an
explicit instruction to check every case against the outcome-relative Decision Impact rule, detect
residual stage-relative reasoning, and verify Unknown-vs-Ambiguity consistency corpus-wide.

### Method

Three independent read-only Codex reviewers, dispatched in parallel over disjoint case ranges
(A: Cases 1–7, B: Cases 8–14, C: Cases 15–20, each applying the same five checks: outcome-relative
reasoning, level-matches-`INTENT_SPEC.md`, clarification/blocking consistency, residual
stage-relative language, Unknown/Ambiguity correctness), followed by a fourth independent read-only
reviewer checking cross-corpus consistency (cross-references, terminology, pattern application,
and new inconsistencies introduced by this pass's own edits) on the resulting text. Claude performed
an independent first-principles pass of its own before dispatching any reviewer, then
cross-verified every reviewer finding against the actual text before acting — several reviewer
suggestions were evaluated and explicitly rejected as insufficiently grounded (see "Findings
evaluated and not actioned" below), not merely relayed.

### Case 18 — confirmed blocker, corrected

Re-evaluated completely from first principles, per the task's explicit instruction not to assign a
predetermined level. Least favorable materially plausible reading: "blockchain" is treated as
non-negotiable, forcing Architecture Synthesis into a distributed-ledger/consensus architecture
branch (identity mapping, state representation, latency/cost implications) instead of a
conventional CRDT/OT-based collaborative editor — a materially different, likely more expensive
architecture. That is HIGH, not LOW; the prior LOW rating rested entirely on stage-relative
language ("LOW at the intent-capture stage itself," "LOW for Intent Parsing specifically... doesn't
need answering here") that the outcome-relative subsection explicitly rejects. Also found and
fixed: a dangling cross-reference — the case's "What IntentSpec must NOT decide" bullet referenced
a negotiability Open Item "that's a separate Open Item" which had never actually been added to the
Unknowns bullet; added it. Retitled from "False technical premise from user" (a title that itself
passed the suitability judgment the case's own body forbids Intent Parsing from making) to "User-
selected technical means with unresolved negotiability." Full bullet-level rewrite applied; verified
no other file references the old title.

### Corpus-wide fixes applied (all independently verified against the actual text, not relayed)

- **Case 7** (user-selected technology): MEDIUM → HIGH. Re-derivation found the earlier MEDIUM
  rating rested on an unstated assumption — that vector-search/orchestration/deployment component
  *categories* were already independently necessary, with only vendor choice open. Nothing in this
  `UserIdea` establishes that independently of the named technologies themselves; if negotiable,
  Architecture Synthesis has ordinary freedom not to build those components' technology-specific
  branches at all. Matches the same shape-vs-tuning test as Cases 2/9/11/14. Removed stage-relative
  "not yet evaluated"/"no immediate need to resolve... before proceeding" language.
- **Case 2**: further split — competitor identity alone (MEDIUM, tunes an already-established
  research capability) separated from source scope (HIGH, determines whether authenticated/licensed
  access exists at all), replacing the earlier bundled-HIGH framing flagged as a precision note in
  section 2 above.
- **Unknown → Ambiguity relabeling**, applying `INTENT_SPEC.md`'s practical test (wording that bears
  on a question and supports multiple readings is an Ambiguity, not an Unknown) to items previously
  mislabeled: Case 9 ("can't support the workload" — throughput/memory/latency, already implied in
  the case's own Unsafe Assumptions bullet), Case 10 ("struggling"), Case 14 ("local"), Case 16
  ("monitors employee productivity"), Case 17 ("looks obsolete" — candidate readings already listed
  in the case's own text), Case 19 ("best possible" — candidate readings already parenthetical in
  the case's own text).
- **Case 20**: fixed a category error — "LOW for the correction mechanics" assigned a Decision
  Impact level to a resolved supersession event, which is neither an Open Item nor a Conflict.
  `INTENT_SPEC.md` states the four levels apply "to an Open Item or Conflict — not to Claims in
  general." Rewrote to state plainly that no level applies to the correction event itself; only the
  carried-forward cost-scope Unknown (from Case 6) retains its MEDIUM rating.
- **Case 11**: the cross-corpus reviewer caught the *same* category error, pre-existing from before
  this pass — "LOW for the core goal (the renaming pattern itself is clear)" assigned a level to a
  resolved Claim. Fixed identically to Case 20.
- **Case 17**: Decision Impact reasoning previously skipped `INTENT_SPEC.md`'s required
  "unresolved item / downstream decision / why this level" provenance, stating only the conclusion.
  Rewrote to supply all three explicitly.
- **Case 4**: tightened the CRITICAL rationale to name the actual consequence (unauthorized,
  non-reversible disclosure of confidential source code) rather than implying any violation of an
  explicit prohibition is automatically CRITICAL — which would incorrectly pull Cases 10 and 15 (both
  HIGH, both involving a possible prohibition violation) up to CRITICAL too. Also fixed an inaccurate
  cross-reference: Case 4 pointed to Case 8 as "this same statement in contradiction with a later
  one," but Case 8 uses a different `UserIdea` — corrected to describe it as a structurally analogous
  Conflict pattern instead.
- **Terminology precision**: four cases introduced in this pass used "Blocked pending resolution,"
  which risks being misread as "temporarily blocked until resolved" — the opposite of
  `INTENT_SPEC.md`'s I-18 (a Blocked version is *permanently* non-consumable; resolution produces a
  new version, never unblocks the old one in place). Reworded all four (Cases 7, 9, 10, 18) to state
  permanent ineligibility explicitly, matching the more careful phrasing Cases 8/17/19 already used.
- **Case 16**: caught in Claude's own final read-through (not by any dispatched reviewer) — the new
  productivity-monitoring Ambiguity had no assigned Decision Impact level, left dangling against the
  existing "MEDIUM for the other three regarding priority/phasing" framing, which doesn't fit a
  definitional ambiguity. Assigned it its own MEDIUM rating with explicit reasoning, distinct from
  the priority/phasing bundle.

### Findings evaluated and not actioned (independently assessed, not confirmed as defects)

- **Case 1** ("what counts as 'small'"): the reviewer assigned to this case itself called Unknown
  "defensible" on reflection, not a confirmed mislabel. Left unchanged.
- **Case 6** ("month," "currency"): a reviewer suggested relabeling the measurement-period Unknown as
  an Ambiguity and adding a new currency Open Item. Independently judged "month" a materially weaker
  case for Ambiguity than the confirmed relabelings above (ordinary usage doesn't naturally split it
  the way "deployment" or "struggling" do), and currency would be a net-new Open Item, not a
  mislabel correction. Left unchanged.
- **Cases 3, 4, 5, 15**: reviewers suggested assigning individual Decision Impact levels to several
  already-listed-but-previously-unrated Unknowns (escalation path, derived artifacts, output
  audience, external network access, derived-data-as-"documents"). These are completeness additions,
  not mislabeling or miscalibration defects, and acting on all of them would substantially restructure
  the corpus's established compact format beyond what any confirmed defect required. Not added.
- **Case 11**'s missing-field/collision bundling (both LOW): raised independently by two separate
  reviewers across two rounds now. Re-evaluated once more: a materially plausible missing-field
  response (skip and log) doesn't require a fundamentally different architecture the way OCR/
  extraction does — unlike Case 18's blockchain-vs-CRDT fork, there's no comparably clear technology-
  category branch here. Genuine, reasonable disagreement persists without a textual contradiction to
  resolve it (unlike Case 13's or Case 9's original defects). Left unchanged; documented here rather
  than re-litigated indefinitely.
- **Case 12** ("which specific activities," "what authority level"): a reviewer proposed relabeling
  these as Ambiguities. Independently rejected — "runs my store" doesn't invite a natural, bounded
  set of candidate readings the way "deployment," "struggling," or "the company" do; the listed
  alternatives (refunds? pricing? inventory?) read as adjacent-capability enumeration, not
  wording-grounded alternate readings of a specific phrase. Left as Unknown.
- **Case 14** ("viral readiness... essential now or aspirational for later"): judged more marginal
  than the confirmed "local" relabeling in the same case — "ready for when X happens" doesn't clearly
  invite a now-vs-later split the way a scope-word does. Left as Unknown.

### Validation

`npm test`: 32/32 fixtures pass (unaffected — this sweep only touched prose in
`docs/examples/INTENT_CASES.md`; no fixture or schema/validator file was touched). Re-run after
every batch of edits, including after the final self-caught Case 16 fix.

## 6. Handoff Consistency Fix (`ADR-0002-HANDOFF-CONSISTENCY-FIX`)

An external human review, after the final consistency sweep above had already reached
`READY_TO_RECONSIDER_ADR_ACCEPTANCE`, found one more real contradiction that survived all four
prior reviewers and Claude's own passes: `INTENT_SPEC.md`'s new "Decision Impact Is
Outcome-Relative" subsection said a HIGH/CRITICAL item could be safely deferred because
"Requirement Derivation or a later stage will" resolve it — directly contradicting the contract's
own "Handoff Status: Blocked vs. Failed" section, which states Requirement Derivation never
consumes a Blocked version at all. This is a genuine gap in the prior sweep's coverage: all four
previous reviewers checked Decision Impact *calibration* (is the level right?) and
Unknown/Ambiguity *classification*, but not this specific handoff-mechanics question — worth
recording plainly rather than glossing over, since it means the previous `READY` recommendation was
reached without this contradiction having been caught.

### Fix applied

Required semantic rule (specified by the task, implemented without touching the outcome-relative
Decision Impact model itself — the LOW/MEDIUM/HIGH/CRITICAL definitions and the practical test are
unchanged): HIGH/CRITICAL → the current `IntentSpec` is permanently Blocked → the item may be
resolved through clarification, additional context, correction, or another Intent Parsing/revision
pass → resolution creates a new, superseding `IntentSpec` → only an eligible new version may reach
Requirement Derivation. "Procedurally deferrable" (safe for Intent Parsing itself to leave
unresolved) must not be read as deferrable *into* Requirement Derivation while the artifact is
Blocked.

- **`INTENT_SPEC.md`**, "Decision Impact Is Outcome-Relative": rewrote the bullet that said
  "Requirement Derivation or a later stage will" resolve a HIGH/CRITICAL item — it now says
  resolution requires a new Intent Parsing/revision pass producing a new version, and explicitly
  contrasts this with MEDIUM/LOW, where a downstream stage legitimately may pick up a still-open
  item on the *same*, eligible version.
- **Case 14**: had the identical contradiction — "only Requirement Derivation (or a later stage) has
  the standing to decide how to handle an unresolved capacity question" and "Requirement Derivation
  still carries the live Unknown forward and decides how to handle it," both attached to its
  HIGH-impact scale Unknown. Rewrote both bullets to state the correct resolution path.
- **Case 11**, found by Reviewer B (corpus-wide check) and independently verified: "the
  extraction-mechanics Unknown is HIGH — deferrable in the sense that Intent Parsing need not
  resolve it, but it must be carried forward" — "carried forward," left unqualified next to a HIGH
  item, repeats the same ambiguous pattern. Reworded to state explicitly this version is Blocked and
  permanently ineligible, and lightly clarified the adjacent "What IntentSpec must NOT decide" bullet
  so the eventual Architecture Synthesis/Requirement Derivation technology decision is clearly
  described as happening only on a future, resolved, eligible version — not on this Blocked one.
- Three further `INTENT_SPEC.md` passages found by Reviewer A, independently verified and fixed:
  the Assumption Policy's generic "it is Requirement Derivation's job... to decide whether and how
  to fill an operational gap" (now qualified to LOW/MEDIUM-impact gaps, with an explicit sentence
  that a HIGH/CRITICAL gap instead Blocks the version); the "Common Violations" → "Backward leakage"
  bullet's unqualified "silently resolving an Ambiguity or Conflict" (now distinguishes interpretive
  resolution — never Requirement Derivation's job at any impact level — from legitimate operational
  gap-filling at LOW/MEDIUM, which is a different thing); and an Examples-section entry that said
  Decision Impact is "assessed downstream" (backwards — Intent Parsing assesses it before handoff;
  a downstream stage cannot assess eligibility for a version it hasn't received yet).

### Findings evaluated and not actioned

- **Case 3**'s "flagged as a risk area for Requirement Derivation, not recorded as IntentSpec
  Conflict" — both reviewers independently concluded this describes a *separate*, not-yet-existing
  future risk (whether literal automation could produce poor-quality replies), not resolution of the
  case's actual HIGH-impact autonomous-send Ambiguity. Left unchanged.
- **Case 11**'s "What IntentSpec must NOT decide" bullet, on its own — judged a generic,
  still-accurate stage-ownership statement (Architecture Synthesis, informed by Requirement
  Derivation, eventually picks the extraction technology) rather than an independent contradiction;
  lightly clarified anyway alongside the adjacent confirmed fix, for belt-and-suspenders precision.

### Validation

`npm test`: 32/32 fixtures pass (prose-only changes; no fixture, schema, or validator file touched).
Comprehensive `grep -n "Requirement Derivation"` sweep of both `INTENT_SPEC.md` and
`INTENT_CASES.md` re-run after all fixes — every remaining occurrence checked and confirmed
consistent with the Blocked/permanently-ineligible/new-version-required pattern for HIGH/CRITICAL
items, or legitimately describing MEDIUM/LOW same-version downstream handling.

## Final Recommendation

**`READY_TO_RECONSIDER_ADR_ACCEPTANCE`** (reaffirmed after this handoff-consistency fix)

Not `REDESIGN_REQUIRED` — across four full review rounds (the original adversarial review, the
first remediation, the final consistency sweep, and this handoff-consistency fix), no case was
found structurally unrepresentable by the existing schema, and no finding required re-architecting
the Claim/Open Item/Conflict model or the outcome-relative Decision Impact test itself.

Not `REQUIRED_CHANGES_REMAIN` — the contradiction an external human review found (HIGH/CRITICAL
items described as resolvable by Requirement Derivation, contradicting the permanent-Blocked
handoff rule) is now fixed at its source (`INTENT_SPEC.md`) and re-verified across the entire
corpus, not just the one case that prompted the report. Two independent reviewers (handoff
consistency in the contract; corpus-wide handoff consistency across all 20 cases) confirmed the fix
and surfaced three additional passages with the same latent ambiguity, all independently verified
and corrected rather than left outstanding.

`ADR-0002`'s Status field was **not** changed by this task, per its explicit instruction — that
remains the human's decision to make, informed by this report.

## Reviewer Attribution

**First remediation round:** two independent read-only Codex MCP sessions (epistemic correctness;
fixture/schema/validator coverage), dispatched in parallel from disjoint task contracts.

**Final consistency sweep:** three independent read-only Codex MCP sessions dispatched in parallel
over disjoint case ranges (Cases 1–7, 8–14, 15–20), followed by a fourth independent read-only
session for cross-corpus consistency.

**Handoff consistency fix:** two independent read-only Codex MCP sessions (`INTENT_SPEC.md`
handoff/Decision Impact consistency; corpus-wide HIGH/CRITICAL handoff consistency across all 20
cases) — all per `AGENT_POLICY.md`'s Task Contract and Parallel Worker Rules. Full verbatim reports
retained in this session's transcript; this document is Claude's critically-reviewed synthesis
throughout, including material self-corrections made after independently verifying reviewer
findings against the actual edited text (never relayed uncritically), and findings caught by
Claude's own read-throughs rather than by any dispatched reviewer (Case 16's dangling Ambiguity
impact assignment in the prior round).
