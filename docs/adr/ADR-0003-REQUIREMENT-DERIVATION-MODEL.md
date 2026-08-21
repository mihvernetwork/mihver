# ADR-0003: Requirement Derivation Model

## Status

Proposed

## Context

M0 Step 03A defines the semantic contract for `IntentSpec` → Requirement Derivation → `RequirementSpec`
(see [REQUIREMENT_SPEC](../contracts/REQUIREMENT_SPEC.md)). `M0_SCOPE.md`'s stage table and
`ADR-0001`'s "Requirement IR" concept already fix the stage boundary — Requirement Derivation
compiles an accepted `IntentSpec` into formal, typed requirements; it does not decide what the user
meant (frozen to Intent Parsing) or which technologies satisfy those requirements (deferred to
Technology Candidate Identification and Architecture Synthesis). What was not yet decided is *how*
that compilation defensibly happens: given an eligible `IntentSpec`, what may Requirement Derivation
turn into a Requirement, what must stay unresolved, and what information must survive the
transformation intact.

The obvious, simplest implementation is: for every Claim in the `IntentSpec`, mechanically emit one
Requirement whose strength is a direct function of the Claim's force, and treat every remaining Open
Item as something a later stage will sort out. That model is rejected here, for reasons this ADR
makes explicit — the same way `ADR-0002` rejected the analogous "LLM reads prompt, emits normalized
JSON" model one stage earlier.

### Why the flat "one Claim, one Requirement, force-determines-strength" model is rejected

A flat compilation model collapses several distinctions that `IntentSpec` deliberately preserved,
throwing away exactly the structure `ADR-0002` was adopted to protect:

- **It does not distinguish Claim origin.** Treating a User-Provided Claim, an Inferred Claim, and an
  Assumed Claim identically once they reach Requirement Derivation launders provenance one stage
  later than `ADR-0002` prevented it — a moderate-confidence Inference would produce the same MUST-
  level Requirement a direct user statement would, with no way for a downstream stage (or a human
  reviewing the pipeline) to tell that the requirement's actual basis was MIHVER's own reasoning, not
  the user's word.
- **It has no answer for surviving Ambiguities and Conflicts.** An eligible `IntentSpec` can still
  carry LOW/MEDIUM Open Items and Conflicts (only HIGH/CRITICAL ones block eligibility). A flat model
  either forces Requirement Derivation to silently pick a reading to produce *some* Requirement — the
  exact "backward leakage" `INTENT_SPEC.md` already forbids — or has no principled way to say "this
  much of the intent compiles cleanly, this much does not yet," collapsing every partial success into
  either an all-or-nothing failure or a silently-guessed success.
- **It does not distinguish force from strength inflation.** "Force determines strength" sounds
  faithful, but without an explicit non-inflationary rule, nothing stops an implementation from
  reading a strong preference as "basically a requirement" and compiling it to MUST — the same
  modality-drift failure `INTENT_SPEC.md`'s Information-Loss Rules already named at the Intent
  Parsing stage, recurring one stage later if not explicitly re-stated here.
- **It has no model of cardinality.** A flat one-Claim-to-one-Requirement mapping cannot represent a
  Requirement genuinely supported by multiple Claims together (e.g. a positive goal plus its
  prohibitions combining into one testable statement), nor a single Claim that defensibly implies
  several independent Requirements. Forcing a 1:1 mapping either merges distinct requirements into one
  under-specified statement or fragments one coherent requirement into artificial pieces.
- **It has no revision/versioning story.** Without an explicit model for what happens when the source
  `IntentSpec` is superseded, an implementation would have to invent ad hoc rules under deadline
  pressure — exactly the risk `ADR-0001`'s "IR churn risk" already names as expected but preventable
  by deciding the model deliberately up front.

The failure mode this produces, one stage removed from `ADR-0002`'s "requirement hallucination": a
plausible-sounding but unsupported Requirement gets compiled as if it followed directly from the
`IntentSpec`, because nothing in the compilation step distinguished a firm user statement from an
inference, an assumption, a silently-resolved ambiguity, or an invented best practice. Call this
**requirement inflation** — force, certainty, or scope quietly growing between `IntentSpec` and
`RequirementSpec` the way meaning quietly grew between `UserIdea` and `IntentSpec` before `ADR-0002`.

## Decision

Requirement Derivation will compile `RequirementSpec` from an eligible `IntentSpec` under four
structural commitments, detailed in full in
[REQUIREMENT_SPEC](../contracts/REQUIREMENT_SPEC.md):

1. **Provenance and origin survive the compilation, never collapsed.** Every Requirement traces to
   the specific Claim(s)/Open Item(s) it derives from, in the specific `IntentSpec` version consumed.
   A Requirement derived from an Inferred or Assumed Claim carries a distinct, visible origin marker
   and a strength ceiling tied to that weaker basis — never presented with User-Provided standing.
   Requirement Derivation's own inferences (about technical implications, not about intent) are a
   separate, independently-labeled provenance layer on top of whatever `IntentSpec` already recorded.
2. **Force maps to strength one-directionally, never inflated.** Obligation/prohibition/permission/
   preference map to MUST/MUST NOT/MAY/SHOULD with an explicit non-inflation rule: a mapping may only
   preserve or (for a weaker basis) reduce strength, never raise it — closing the same "modality
   drift" gap `ADR-0002` closed for Intent Parsing, one stage later.
3. **Interpretive authority over surviving Ambiguities and Conflicts never transfers to this stage,
   regardless of Decision Impact level.** Only *operational* gaps (Unknowns) may legitimately be
   filled with a working default here, and only when marked as Requirement-Derivation-introduced.
   Interpretive gaps (Ambiguity, Conflict) are carried forward unresolved, producing a **Partial**
   `RequirementSpec` rather than a silently-resolved one.
4. **`RequirementSpec` gets its own Complete/Partial/Failed output model**, distinct from
   `IntentSpec`'s Blocked/Failed pair, because the two stages guard against different risks:
   `IntentSpec`'s gate protects the *next* stage from decision-critical gaps; `RequirementSpec`'s
   Complete/Partial distinction describes *this* stage's own completeness, given that its input was
   already past that gate. A Partial `RequirementSpec` is a valid, well-formed, versioned artifact —
   not a degraded or second-class output, and not a permanently non-consumable one the way a Blocked
   `IntentSpec` is — but this model stops short of authorizing *how* a downstream stage may consume
   it; that consumption behavior is a separate, later decision (see Open Questions).

## Rationale

- **Prevents requirement inflation.** Origin, force, and confidence are first-class, mandatory,
  independently-inspectable properties of every Requirement, not optional annotations a compiler
  implementation could drop under time pressure. An Inference or Assumption can never be read back as
  a firm, user-authorized Requirement.
- **Keeps interpretive authority where `ADR-0002` already put it.** By extending the
  Ambiguity/Conflict-resolution prohibition to *every* Decision Impact level, not just HIGH/CRITICAL,
  this decision closes a gap a level-based rule alone would have left open: nothing about a MEDIUM
  Ambiguity surviving `IntentSpec`'s eligibility gate makes it suddenly Requirement Derivation's to
  resolve. The boundary `M0_SCOPE.md` already draws ("Requirement Derivation \[...\] not allowed to
  decide \[...\] what the user meant") is honored at every impact level, not just the ones that happen
  to block the artifact outright.
- **Makes partial progress representable without inventing certainty.** The Complete/Partial/Failed
  model lets Requirement Derivation report exactly how much of the `IntentSpec` compiled cleanly,
  rather than forcing a binary all-succeeds-or-nothing-does outcome that would either discard
  perfectly good Requirements over one unrelated open question, or silently paper over that question
  to avoid discarding them.
- **Supports both cardinalities requirements analysis actually needs.** Allowing many-Claims-to-one-
  Requirement and one-Claim-to-many-Requirements, both with explicit provenance, avoids forcing
  real intent structures into an artificial 1:1 shape that would either merge distinct concerns or
  fragment one coherent requirement.
- **Gives revision and supersession a decided answer up front.** `RequirementSpec` versioning,
  Requirement identity persistence, and the reconsideration-on-supersession rule are specified now,
  rather than left to accumulate as ad hoc implementation choices — directly mitigating the "IR churn
  risk" `ADR-0001` already flagged as a known risk of leaving IR shape undecided.
- **Stays implementation-independent.** Like `ADR-0002`, this ADR and `REQUIREMENT_SPEC.md`
  deliberately stop short of defining any schema, field names, or serialization — the structure is
  conceptual until schema design work actually needs it, consistent with `ADR-0001`'s explicit
  deferral of Requirement IR's schema and `M0_SCOPE.md`'s framing of field-level design as separate,
  later M0 work.

## Consequences

- Requirement Derivation must do more structural work than "restate each Claim more formally." It
  must classify each Requirement's basis, state a mapped strength with its justification, and
  explicitly flag every surviving Ambiguity/Conflict it does not resolve and every Unknown it chooses
  to fill or carry forward.
- `RequirementSpec` is a larger, more structured artifact than a flat requirements list would be —
  the same deliberate tradeoff `ADR-0002` made for `IntentSpec`: more structure now, in exchange for
  every downstream stage (starting with Research Planning) being able to inspect and appropriately
  weight what it's compiling from, per Principle 7 (LLMs Are Reasoners, Not Authorities) — a
  downstream stage still must not treat every Requirement as equally authoritative just because it is
  structured; structure makes that judgment possible, it does not make it automatic.
- A Partial `RequirementSpec` introduces a new kind of intermediate pipeline state `M0_SCOPE.md`'s
  stage table does not explicitly narrate: some Requirements usable now, others pending a revision
  cycle. This document does not design how a downstream stage should behave when handed a Partial
  `RequirementSpec` (e.g. whether Research Planning may proceed on the Complete portion alone) — that
  consumption behavior is explicitly out of scope here and left to that stage's own future design
  work (see Open Questions).
- Revision becomes more consequential, mirroring `ADR-0002`'s equivalent consequence one stage
  earlier: superseding an `IntentSpec` version can invalidate downstream Requirements that depended on
  it, and those dependents must be reconsidered rather than silently carried forward.
- This model does not, by itself, prevent a bad Requirement Derivation implementation from
  misclassifying a Requirement's origin, over- or under-mapping its strength, or failing to detect
  that a candidate Requirement actually depends on an unresolved Ambiguity — the contract defines the
  categories and their invariants; enforcing correct classification is a validation concern for a
  later design step (see Open Questions), the same posture `ADR-0002` already took toward its own
  equivalent risk.

## Alternatives Considered

- **Flat "one Claim, one Requirement, force-determines-strength" compilation, with no origin
  distinction.** Rejected — see "Why the flat model is rejected" in Context above.
- **Requiring 100% resolution before Requirement Derivation may run at all** — i.e., treat any
  surviving Ambiguity or Conflict, at any level, as blocking the entire `RequirementSpec` the way a
  HIGH/CRITICAL item blocks `IntentSpec`. Rejected: this would contradict Decision Impact's own
  premise that MEDIUM/LOW items are legitimately safe to defer past Intent Parsing — forcing them to
  block Requirement Derivation entirely would make the LOW/MEDIUM distinction meaningless one stage
  later, and would needlessly discard perfectly derivable Requirements over one unrelated open
  question.
- **Letting Requirement Derivation resolve leftover Ambiguities/Conflicts itself**, on the reasoning
  that it has more context (a compiled requirement view) than Intent Parsing did. Rejected: the
  IntentSpec/RequirementSpec boundary is frozen by `M0_SCOPE.md` and `INTENT_SPEC.md` specifically to
  prevent this — "more context" is not the same as "authority to decide what the user meant," and
  granting it here would silently reopen a boundary `ADR-0002` closed one stage earlier.
- **A single "confidence score" on every Requirement, uniform across origin.** Rejected for the same
  reason `ADR-0002` rejected a uniform confidence model for Claims: a User-Provided Requirement's
  basis is binary (the user said it or didn't), an Inference-derived Requirement's confidence
  describes derivation strength, and an Assumption-derived Requirement has a rationale, not a
  probability — collapsing these into one score would manufacture false precision exactly where this
  model most needs to avoid it.
- **Forcing every `RequirementSpec` to be either fully successful or a total failure (no Partial
  state).** Rejected: this would mean a single unrelated surviving Ambiguity could discard an entire
  batch of otherwise well-supported Requirements, or — worse — create pressure to silently resolve
  that Ambiguity just to avoid the all-or-nothing failure, reintroducing exactly the interpretive
  overreach this ADR exists to prevent.

## Risks

- **Under-specification of downstream Partial-consumption behavior.** This ADR introduces "Partial"
  as a new intermediate state without specifying how Research Planning or later stages should behave
  when handed one. Mitigation: explicitly named as an Open Question below and left to that stage's own
  design work, consistent with how `ADR-0001` deferred IR schema design without deferring the decision
  that IRs would exist.
- **Requirement-Derivation-level inference could become a laundering vector if implemented loosely.**
  Allowing Requirement Derivation to draw its own technical-implication inferences (Section
  "Requirement-Level Inference" in `REQUIREMENT_SPEC.md`) is useful but risks becoming a backdoor for
  reintroducing intent-level interpretation under the label "technical implication," if an
  implementation doesn't police the boundary carefully. Mitigation: `REQUIREMENT_SPEC.md` states the
  boundary explicitly and requires the inference's premise and reasoning to be stated, mirroring the
  same discipline `INTENT_SPEC.md` already imposes on Intent Parsing inferences — but this ADR does
  not, and cannot, guarantee a real implementation draws that line correctly every time.
  Classification-boundary risk of this kind was already acknowledged as inherent to the analogous
  Inference/Assumption boundary in `ADR-0002`'s own Risks section; this is the same risk recurring one
  stage later.
- **Non-inflation discipline depends on correct force classification upstream.** The force→strength
  mapping's non-inflation guarantee is only as good as `IntentSpec`'s own force classification was —
  if Intent Parsing already misclassified a preference as an obligation, Requirement Derivation
  faithfully propagating that misclassification does not, by itself, produce a wrong Requirement
  Derivation output; the defect would already exist upstream. This ADR does not introduce new
  exposure here; it inherits `ADR-0002`'s existing classification-boundary risk rather than adding to
  it.
- **Complete/Partial calibration risk.** Deciding which surviving items make a `RequirementSpec`
  Partial versus which are minor enough to leave as carried-forward Unknowns on an otherwise Complete
  version is a judgment call, the same kind of coarse, judgment-based calibration `ADR-0002`'s Risks
  section already named for Decision Impact. An implementation that systematically over- or
  under-rates what counts as "blocking" could produce either needlessly fragmented Partial outputs or
  outputs that quietly compile through gaps that should have been flagged.

## Open Questions

- How should Research Planning (or any downstream stage) behave when handed a Partial
  `RequirementSpec` — proceed on the Complete portion alone, wait for full resolution, or something
  else? Not decided here; this ADR establishes that Partial exists as a distinct, valid state, not
  how a consumer must react to one.
- How should the boundary between "a Requirement-Derivation-level technical inference" and "a
  disguised re-interpretation of intent" be validated in an actual implementation, beyond requiring
  the inference to state its premise and reasoning? This ADR defines the category and its discipline;
  it does not define an enforcement mechanism, the same posture `ADR-0002` took toward the analogous
  origin-classification question.
- Should a Requirement ever carry more than one strength simultaneously — e.g. a base obligation with
  a separately-tracked "aspirational" stretch goal layered on top — or does that belong to a later
  refinement of the force→strength mapping? Not resolved in this step.
- Where multiple Claims combine into one Requirement, and one of those Claims is later superseded
  while the others remain live, does the Requirement survive in weakened form, get re-derived from the
  remaining Claims alone, or get invalidated outright pending reconsideration? "IntentSpec Supersession
  Effects" in `REQUIREMENT_SPEC.md` establishes that reconsideration is required; it does not fix
  which of these three outcomes is correct in general — that may be genuinely case-dependent and is
  left to Requirement Derivation's own judgment at re-derivation time, recorded in the new version's
  provenance.
- How finely should "one Requirement" be scoped in practice — is a compound statement ("the system
  shall do X and Y") one Requirement or two? `REQUIREMENT_SPEC.md`'s "Requirement Cardinality and
  Granularity" section fixes the semantic core of this — a split/combination must trace to what the
  source Claims mechanically entail, never to an unresolved interpretive question decided for
  convenience — because that boundary is a provenance/backward-leakage concern, not merely a
  formatting one. What remains genuinely open, and is deferred alongside serialization, is only the
  finer-grained *representation* question: how a schema should express linked or grouped Requirements,
  not whether a given split is semantically defensible.

## Future Work

- Design the machine-readable schema for `RequirementSpec` (field names, cardinality,
  serialization), consuming this ADR's model and `REQUIREMENT_SPEC.md`'s invariants — explicitly out
  of scope for this step, mirroring `ADR-0002`'s equivalent deferral for `IntentSpec` until M0
  Step 03B-equivalent work.
- Build an adversarial worked-example corpus validation pass for `REQUIREMENT_CASES.md`, analogous to
  the adversarial review `ADR-0002` underwent, once schema design exists to check the corpus against.
- Define how downstream stages (starting with Research Planning) consume a Partial `RequirementSpec`
  (see Open Questions above).
- Define a validation approach for the Requirement-Derivation-level-inference boundary (see Open
  Questions above and Risks).
- Revisit this ADR's Status once schema design work and at least one adversarial review pass have
  exercised the model against real cases — the same condition `ADR-0002` set and satisfied for
  itself.
