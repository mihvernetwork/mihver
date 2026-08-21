# Contract: IntentSpec

Status: part of M0 Step 02A (Intent semantic contract). Implementation-independent — no
serialization, field names, or schema are defined here. This is the most load-bearing document
in this step: it defines the epistemic model every later MIHVER stage depends on.

## Purpose

`IntentSpec` is Intent Parsing's output: a structured interpretation of one or more `UserIdea`
versions (see [USER_IDEA](./USER_IDEA.md)) that preserves what the user meant *and* how MIHVER
knows it — without silently converting interpretation, inference, or provisional guesswork into
unearned certainty.

`IntentSpec` exists to make one thing possible: a downstream stage (starting with Requirement
Derivation) can act on what MIHVER currently understands about the user's intent without ever being
misled into treating a MIHVER-generated interpretation as if the user had said it directly.

## Input

One or more `UserIdea` versions (the current version and, where relevant to revision, the version
history it supersedes).

## Output Semantics

`IntentSpec` is not a flat list of facts. It is a **versioned epistemic record**: a set of
*items*, each with a recorded relationship to its source, held together with the *relationships
between items* (agreement, dependency, conflict) that a flat list would lose. See "Epistemic
Model" below for what an item is and what kinds exist.

`IntentSpec` never asserts that the world is a certain way. It only ever asserts: *this is what
was said, inferred, assumed, left open, or found to conflict, as of this version.*

## Epistemic Model

The naive model — a single flat enum of `EXPLICIT / INFERRED / ASSUMED / UNKNOWN / CONFLICT`
attached to each item — does not survive contact with real cases. Two of those five are not
properties of a single item at all:

- **Conflict** is a relationship between two or more items, not a status one item can hold alone.
  An item is not "a conflict"; it *participates in* a conflict with one or more other items.
- **Unknown** is not a claim with weak support — it is the *absence* of a claim. Modeling it as a
  degenerate claim invites exactly the failure mode this contract exists to prevent: treating "we
  don't know" as if it were a fact with low confidence, which slides toward guessing.

So the model splits into three kinds of record, plus one cross-cutting decision:

### 1. Claim

A proposition MIHVER holds, with an explicit **origin**:

- **User-Provided** — traceable directly to something the user said in a specific `UserIdea`
  version. See "Terminology: Claim, Not Fact" below for why this is not called a "fact."
- **Inferred** — derived by MIHVER from one or more other Claims through an identifiable
  reasoning step. Carries its premises and the kind of reasoning applied (see "Inference Policy").
- **Assumed** — adopted provisionally so MIHVER can proceed despite a gap, not because it is
  believed to follow from anything (see "Assumption Policy").

Every Claim also carries, conceptually (not as a fixed schema here), several **independent axes**.
These must not be collapsed into one another — in particular, "force" must not be overloaded to
also carry the user's own hedging, or the claim's discourse role; a Claim can be a hedged
preference, a confident prohibition, a hedged example, and so on, and each axis needs to be
readable on its own:

- its **force** — the normative/desiderative modality only, and *only* that: whether it expresses
  an obligation as the user stated it ("must"), a prohibition ("must not"), a permission or
  allowance ("may," "is allowed to" — distinct from an obligation: something being permitted does
  not mean it is required), or a preference of some strength ("would like," "prefer," down to a
  weak "it'd be nice if"). Force is about what the user wants, requires, or permits — it is never
  epistemic. Words like "maybe," "perhaps," or "I'm not sure" are not force values and must never
  be read as a weak or hedged force category ("weakly-held possibility" is not a thing this axis
  represents) — they belong entirely to the separate **self-reported uncertainty** axis below, even
  when they modify what looks like a preference in the same sentence ("maybe you could add X" is a
  weak preference *and*, separately, a hedged one — two distinct axis values, never one blended
  category).

  **A Claim may also carry no force at all.** A purely descriptive statement — "we have 50,000
  active users," "our team is five engineers" — asserts a fact about the world without expressing
  any obligation, permission, or preference. Such a Claim's force is simply absent: not a weak
  default standing in for one of the categories above, and not something Intent Parsing manufactures
  to fill the property. If the user didn't express a want, requirement, or permission, there is no
  force to record.

  Force says nothing about whether the text is the user's own operative statement or an
  illustrative sample; that question belongs entirely to the separate **discourse role** axis
  below, and force's wording must not reuse "example" or similar language that overlaps with it
  (see Invariant I-22). Force must survive Intent Parsing undistorted — a preference must never be
  tightened into an obligation, a permission must never be tightened into an obligation either (see
  Anti-Examples), and an obligation must never be softened into a preference, no matter how MIHVER
  might rate its feasibility.
- its **self-reported uncertainty** — separate from force, and separate from the Inference
  confidence described in "Confidence Policy" below: whether the *user themselves* hedged the
  claim ("I think," "roughly," "not sure," "maybe," "around X") versus asserted it plainly. "I
  think we have about 10,000 users" is still a User-Provided Claim (the user did say it), but it is
  a *hedged* one — that hedge is part of what the user actually communicated and must survive, the
  same way force must survive. Collapsing a hedged claim into an unhedged one is a loss of meaning
  just like collapsing a preference into an obligation would be. This axis has no fixed value set
  defined here (schema design is deferred, per [M0_SCOPE](../foundation/M0_SCOPE.md)) — the
  requirement at this stage is only that the hedge, when present, is preserved as a distinguishable
  property of the Claim, not silently dropped or folded into force or confidence.
- its **speaker attribution** — the submitting user's own statement is the default case, but a
  `UserIdea` may report a third party's statement instead (e.g. "my CTO says X"). When it does,
  the Claim's origin is still User-Provided (the *submission* is traceable to the user), but its
  provenance must record who is asserting the underlying proposition — the submitting user
  directly, or the submitting user reporting someone else — without Intent Parsing resolving whose
  statement has authority. That resolution, if it matters, is a clarification or a later-stage
  concern, not something Intent Parsing decides.
- its **discourse role** — whether the text is the user's own operative statement, or something
  the user included as an example, quotation, or pasted sample. Content offered as an example is
  not automatically an operative Claim about what the system should do; Intent Parsing must record
  which role a piece of `UserIdea` content is playing before treating it as a Claim MIHVER itself
  now holds.
- its **scope/condition**, if the user stated one ("only if local execution can't handle the
  load") — see "Conditional and Negative Intent" below. This step defines that a Claim may carry a
  condition; it does not define a taxonomy of condition types (necessary vs. sufficient,
  exceptions, nested or temporal conditions) — see Open Questions in
  [ADR-0002](../adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md).
- its **provenance** (see "Provenance" below).

A Claim is never asserted as objectively true. It is asserted as *held*, with a stated origin.

### 2. Open Item

Something Intent Parsing explicitly could not resolve from the available `UserIdea`. Two distinct
shapes exist, and they must not be conflated:

- **Unknown** — no value or answer is available at all: nothing in the `UserIdea` bears on the
  question either way (e.g., deployment region was never mentioned, in any wording). An Unknown is
  not "false," "optional," "irrelevant," or "use a sensible default" — it is a recorded absence of
  information, nothing more.
- **Ambiguity** — the user's own words *do* bear on the question, but support two or more
  materially different readings, and Intent Parsing has not picked one (e.g., "leave the company"
  could mean leave the corporate network or leave any external system's control). An Ambiguity
  records the candidate readings; it must not silently collapse to whichever reading seems most
  likely.

The practical test: if no wording in the `UserIdea` addresses the question at all, it's an
**Unknown**. If specific wording addresses it but that wording itself supports more than one
reading, it's an **Ambiguity** — even if the gap "feels" similar to an Unknown from the outside.
Treating an unresolved ambiguity as though it were a blank Unknown erases the fact that the user
*did* say something relevant; treating a genuine information gap as an Ambiguity invents readings
the wording doesn't support. Every Ambiguity must trace to the specific span of user wording that
produces the multiple readings — MIHVER may not record an Ambiguity untethered to actual wording
(see Invariant I-17).

**Relevance test.** An Open Item is valid only when resolving it is necessary to faithfully
interpret the stated intent, to safely compile it later, or to preserve a boundary the stated
intent directly implicates. Intent Parsing must not generate an Unknown or Ambiguity for every
imaginable adjacent capability a system like this *might* someday need — that produces noise that
buries the Open Items that actually matter and invites exactly the kind of speculative
scope-invention this contract exists to prevent (see Case 1 in
[INTENT_CASES](../examples/INTENT_CASES.md) for a worked example of trimming an over-broad Unknown
list down to what the stated idea actually implicates).

A candidate reading within an Ambiguity is a lightweight alternative statement, not an independent
Claim — it carries no origin of its own (it is not User-Provided, since the user did not commit to
it specifically, and not Inferred, since nothing has been derived yet) and may optionally note why
it's a plausible reading. Once a specific reading is confirmed (via revision, see below) it becomes
a proper Claim in the new `IntentSpec` version, with its own origin and provenance at that point.

Open Items are not Claims and carry no origin classification — there is nothing held to classify.

### 3. Conflict

A relationship between two or more Claims (or an Open Item and a Claim, e.g. an Ambiguity whose
readings are individually consistent but jointly contradict another Claim) that cannot all be
accepted at once without resolution. A Conflict record must preserve every participating item,
state why they are incompatible, and remain unresolved unless something in this contract's
Revision policy explicitly resolves it. MIHVER detecting a conflict is not the same as MIHVER
resolving it, and Intent Parsing has no authority to resolve one on its own judgment (see
"Conflict Policy").

### 4. Clarification Need (a decision, not an epistemic kind)

`NEEDS_CLARIFICATION` is not a fourth kind of item alongside Claim/Open Item/Conflict. It is a
**decision** computed from an Open Item or Conflict plus its Decision Impact (see "Clarification
Policy" below). The same Unknown can be paired with a clarification need in one case and none in
another, depending on how much it matters — so it cannot be a fixed label baked into the item
itself.

## Terminology: Claim, Not Fact

A user statement establishes only that *the user asserted it* — not that it is objectively true.
"Our company has 50,000 active users" tells MIHVER the user said this; it does not verify it.

MIHVER therefore never labels a User-Provided item a "fact." The term used throughout this
contract and downstream is **claim**: a proposition with a stated origin, deliberately neutral
about its truth. "Fact" is reserved for a proposition that has met an explicit verification
standard — which Intent Parsing never performs and which, if it ever happens in MIHVER, happens
through `Evidence` in a later stage, not through user assertion alone.

This distinction is the difference between **source provenance** ("where did this proposition come
from") and **objective truth / verification** ("is this proposition actually true"). `IntentSpec`
only ever records the former. Confusing the two is exactly the failure this document exists to
prevent.

## Provenance

Every Claim must be traceable to its origin in a way an auditor (human or downstream stage) can
inspect without re-running any model:

- A **User-Provided** Claim traces to a specific `UserIdea` version and, where practical, the
  specific statement within it.
- An **Inferred** Claim traces to its premises (the specific Claims it was derived from) and names
  the kind of reasoning step taken (e.g., "generalization," "implication," "domain default
  applied") at a level someone can audit — not MIHVER's full internal reasoning trace. Store enough
  to justify and challenge the inference, not a hidden chain-of-thought transcript.
- An **Assumed** Claim traces to the gap it bridges and its stated rationale (see "Assumption
  Policy").

This chain is what makes the following future traceability possible without relying on a
conversation transcript as the record of truth:

```text
ArchitectureDecision
    ↓
RequirementSpec
    ↓
IntentSpec
    ↓
UserIdea
```

`IntentSpec`'s obligation here is narrow but essential: every Claim it emits must carry enough of
this chain that a `RequirementSpec` item derived from it can, in turn, point back through
`IntentSpec` to the original `UserIdea`. The full cross-stage provenance schema is not designed in
this document — only that `IntentSpec` must not be the place where the chain breaks.

## Inference Policy

An Inference is only valid when MIHVER can state its premises and the kind of reasoning applied. If
MIHVER cannot state what it's basing the inference on, the item is not an inference — it is an
Assumption (see below), and must be labeled as one.

Inference chains are transitive: if Claim C was inferred from Claim B, which was itself an
Inference or an Assumption, C does not inherit User-Provided status. C's provenance must show the
full chain, so a downstream consumer can see that C ultimately rests on an Assumption even if the
immediate step from B to C looks solid. An inference is never stronger than its weakest premise.

**Confidence** is meaningful here and should be recorded: an Inference can legitimately carry a
confidence level describing how strongly the premises support the conclusion. This is confidence
in the *derivation*, not confidence that the underlying proposition is true in the world.

Worked examples in [INTENT_CASES](../examples/INTENT_CASES.md) express an Inference's premises and
reasoning informally (e.g. "since 'weekly' implies repetition") rather than through a fixed
taxonomy of reasoning kinds — that informal form is this contract's intended illustration of "state
the premises and the kind of reasoning," not a literal field format. A named, closed taxonomy of
reasoning kinds is schema-level detail, deferred along with the rest of serialization (see "Field
names, cardinality, and serialization" in [M0_SCOPE](../foundation/M0_SCOPE.md)). What this policy
does require, even informally, is that the premises be identifiable and the inference not be
asserted as if it needed no support at all — an inference with no stated basis is not an inference
under this policy; it is an unlabeled Assumption (see "Assumption Policy") and must be corrected as
such.

## Assumption Policy

An Assumption is a provisional proposition MIHVER adopts specifically to let processing continue
despite missing or insufficient information. It is not a low-confidence inference wearing a
different label — the defining feature is that MIHVER chose to proceed *without* adequate support,
not that it found weak support.

**Assumptions are restricted to narrowly interpretive gaps — never technical or operational
working defaults.** An interpretive gap is about *what the user meant*: resolving which of two
grammatically possible referents a pronoun points to, or treating an obvious typo as the word it
was clearly meant to be. A technical or operational default is about *filling in a system
parameter the user never addressed at all* — a competitor list, a cost-category scope, an approval
mechanism, a capacity/scale figure. Intent Parsing must not invent the latter kind, even to be
helpful to a downstream stage that will eventually need a working value. **Unknown should normally
remain Unknown.** For an operational gap that keeps the produced `IntentSpec` eligible (LOW/MEDIUM
impact), it is Requirement Derivation's job (or a later stage's) to decide whether and how to fill
it — with a working default, a clarification, or research — not Intent Parsing's job to pre-empt
that by manufacturing one under the label "Assumption." A HIGH/CRITICAL operational gap instead
makes the produced version Blocked (see "Handoff Status: Blocked vs. Failed" below); Requirement
Derivation does not fill that gap on this version at all — resolution requires a new, superseding
`IntentSpec` version first.

Any Assumption that is retained must be:

- **narrowly interpretive** — about resolving what the user meant, not about supplying an
  operational value the user never addressed;
- **explicit** — stated plainly as an Assumption, never blended into a Claim's wording;
- **why it was introduced** — what specific interpretive gap it bridges;
- **scoped** — the narrowest context in which it applies; an assumption made to interpret one
  phrase must never silently become a project-wide constraint;
- **reversible** — nothing downstream may treat it as final;
- **justified** — the rationale must be stated, not merely asserted;
- **revisited** if contradictory information later arrives (see Revision below).

An Assumption does not carry a probabilistic confidence score — a manufactured probability would
imply a rigor the assumption doesn't have. It carries a rationale instead. An Assumption must
never be presented, stored, or forwarded in a way indistinguishable from a User-Provided Claim —
this is the single most important failure mode this contract exists to prevent (see Invariant I-02).

## Unknown Policy

An Unknown is a valid, complete, terminal result for a given piece of information — not a
placeholder that must eventually be filled by Intent Parsing. If the `UserIdea` doesn't support a
value, `IntentSpec` records Unknown and stops there; it does not manufacture a plausible default to
make the artifact look complete. Absence of a claim about X means "X is unspecified," not "X is
false," "X is not needed," or "X may be decided arbitrarily downstream" — those are all different
things and must not be inferred from silence without an explicit inference step that says so.

## Conflict Policy

When two or more Claims (or an Ambiguity's readings and another Claim) cannot jointly hold, Intent
Parsing records a Conflict rather than silently preferring one side — by recency, by confidence, by
which seems more technically convenient, or by any other implicit tiebreaker. All participating
Claims remain in `IntentSpec`, each still carrying its own origin and provenance.

How a Conflict may be resolved depends on what's conflicting:

- **Conflict between two live User-Provided Claims.** Intent Parsing has no authority to choose a
  winner — never through Intent Parsing's own judgment about which claim the user "really" meant.
  This can only be resolved through a `UserIdea` revision that explicitly supersedes one side (see
  "Explicit vs. implicit correction" in [USER_IDEA](./USER_IDEA.md)).
- **Conflict involving an Inferred or Assumed Claim.** Since an Inference or Assumption is MIHVER's
  own derived conclusion, not the user's statement, a later Intent Parsing run *may* revise or
  withdraw the derived side of the conflict on its own — without requiring a new `UserIdea` — if it
  has grounds to (e.g. reconsidering the reasoning, or new context within the same `UserIdea`
  version surfaces on a later pass). This is revising MIHVER's own work, not overriding the user.

In both cases the resolution — whichever kind — always produces a **new `IntentSpec` version**; it
never mutates the version that recorded the Conflict. The version that recorded the Conflict
remains in the historical record exactly as it was (see "Revision and Version Semantics" below and
Invariant I-13).

## Clarification Policy

MIHVER does not ask the user about every Open Item — that would be an unusable product. Whether an
Open Item or Conflict needs clarification depends on **Decision Impact**: how much a wrong or
deferred resolution would change the eventual architecture decision.

### Decision Impact

Four levels, applied to an Open Item or Conflict (not to Claims in general — a resolved Claim has
no open impact to assess):

- **LOW** — proceeding without resolving this could not materially change which architecture is
  appropriate. Example: an unspecified UI color.
- **MEDIUM** — deferring this is safe; the eventual answer shifts details but not the shape of the
  solution. A downstream stage (Requirement Derivation or later) may choose to resolve it with a
  working default at that point — but that is a decision for that stage to make, not license for
  Intent Parsing to record one itself as an Assumption (see "Assumption Policy" above: MEDIUM
  impact alone never justifies an invented operational default here). Example: unspecified
  preferred cloud provider, when no other constraint makes the choice safety- or cost-critical.
- **HIGH** — proceeding without resolution risks a materially different or significantly more
  expensive architecture. Example: whether production deployment may happen automatically.
- **CRITICAL** — proceeding without resolution risks an unsafe, invalid, non-compliant, or
  irreversible outcome. Example: whether the data involved includes medical records; whether an
  irreversible production action (e.g. deletion) is genuinely intended and authorized. "Invalid"
  here also covers the case where the request is specified so thinly that any resulting
  architecture would be substantially MIHVER's invention rather than attributable to stated
  intent — the goal itself, not just an architectural detail, is what's missing.

### Decision Impact Is Outcome-Relative

Decision Impact measures the consequence of proceeding while an Open Item or Conflict remains
unresolved on the eventual downstream requirement/architecture decision — never how soon, or at
which pipeline stage, the item happens to get resolved. These are different questions, and only the
first governs the level assigned here:

- An item can be perfectly safe for *Intent Parsing itself* to leave unresolved — producing a
  Blocked `IntentSpec` rather than fabricating an answer — while still carrying HIGH or CRITICAL
  Decision Impact, if an unresolved wrong answer would materially reshape the eventual architecture.
  This is not the same as deferring the item *into* Requirement Derivation: per "Handoff Status:
  Blocked vs. Failed" below, Requirement Derivation never consumes a Blocked version, so a
  HIGH/CRITICAL item cannot be "carried forward" for a later stage to resolve on the same artifact.
  Its resolution — clarification, additional context, a correction, or another Intent
  Parsing/revision pass — must instead produce a new, superseding `IntentSpec` version; only that
  new version, if it is itself eligible, may reach Requirement Derivation. Being safe for Intent
  Parsing to leave unresolved and being low-impact are not the same fact, and an assessment must not
  infer the second from the first. (Contrast MEDIUM and below, where the produced `IntentSpec` is
  eligible and a downstream stage legitimately may pick up the still-open item on that same version
  — see "Decision Impact" above and the Assumption Policy.)
- Conversely, an item can be resolvable immediately and still be LOW impact, if resolving it either
  way would not change which architecture is appropriate.
- The practical test: ask what happens to the *eventual* architecture recommendation if this item
  is never resolved and a later stage has to proceed on the least favorable *materially plausible*
  reading — bounded the same way the Open Item Relevance Test already bounds Open Items generally
  (necessary to interpret, safely compile, or preserve a directly implicated boundary of the stated
  intent), not any imaginable worst case a similar system might someday face. If that bounded worst
  case forces a materially different or more expensive architecture, the item is at least HIGH —
  regardless of whether a mechanism exists to safely postpone answering it right now. "Safely
  postponable" describes *when* MIHVER must act on the answer, not *how much the answer matters*
  once given.
- An item whose eventual answer only tunes or scopes a capability whose existence is already
  established by an accepted Claim (e.g. a precise cost category within an already-stated budget
  ceiling) is a detail-level question even when the eventual number matters — because no reading of
  the answer changes *whether* that capability exists, only how it is configured. An item whose
  eventual answer determines *whether* an entire capability, subsystem, or architecture branch
  exists at all is shape-level, not detail-level, even when a placeholder or fixed-capacity starting
  point could technically be built and revised later.

HIGH/CRITICAL Decision Impact is what triggers the Blocked handoff consequence (see "Handoff
Status: Blocked vs. Failed" below) — the outcome-relative reading above is what that trigger is
meant to measure, not a separate, stricter test layered on top of it.

### Decision Impact Provenance

A LOW/MEDIUM/HIGH/CRITICAL assignment is itself a claim that needs a basis, not a label applied by
feel. Every Decision Impact assessment must make inspectable:

- **what unresolved item is being assessed** — the specific Open Item or Conflict;
- **what downstream decision it could change** — which later choice (architecture shape, technology
  eligibility, a safety boundary) would come out differently depending on how it resolves;
- **why this level, not one above or below** — the specific reasoning connecting the item to the
  consequence, not just a restatement of the level's general definition.

An assessment that can't state the second point (what downstream decision could change) hasn't
actually established impact — it's asserted a level without a basis, which this policy doesn't
permit any more than an unsupported Inference would be permitted elsewhere in this contract.

### The Clarification Invariant

> Clarify only when unresolved uncertainty is sufficiently decision-impactful that proceeding
> would create a materially different, unsafe, invalid, or disproportionately expensive
> architecture decision.

LOW-impact Open Items are recorded and carried forward without interrupting the user. MEDIUM is
usually deferrable and normally stays Unknown rather than being paired with an invented
operational-default Assumption (see "Assumption Policy" above — MEDIUM impact is not, by itself,
license to manufacture a working value).

### Handoff Status: Blocked vs. Failed

HIGH and CRITICAL Open Items or Conflicts are a reason to withhold a Claim from downstream
compilation, not necessarily a reason to withhold `IntentSpec` itself. Two distinct outcomes exist,
and the difference matters:

- **Blocked.** Intent Parsing produces a complete, valid, versioned `IntentSpec` — everything that
  *can* be recorded (Claims, Open Items, Conflicts, their Decision Impact) is recorded — but the
  artifact is explicitly marked as **never** eligible for Requirement Derivation to consume — not a
  temporary hold that lifts once the HIGH/CRITICAL item resolves, but a permanent property of this
  specific version. Resolving the underlying item doesn't change this version's eligibility; it
  produces a different, new version that carries its own (unblocked) status — see Invariant I-18.
  This is the normal outcome for a well-formed idea that simply contains a decision-critical gap
  (e.g. Case 5 or Case 17 in [INTENT_CASES](../examples/INTENT_CASES.md)): the epistemic record is
  exactly what this contract is for, and producing it is not the same as authorizing what comes
  next.
- **Failed.** Intent Parsing cannot produce a defensible `IntentSpec` at all — not even a blocked
  one — because no coherent structure can be extracted from the input (see "Failure Semantics"
  below). This is reserved for input that is unintelligible or so self-contradictory that no
  provisional Claims can responsibly be recorded.

Most HIGH/CRITICAL cases are Blocked, not Failed. Failure is the narrower, more severe outcome.

**A Blocked `IntentSpec` never becomes unblocked in place.** There is no operation that flips a
Blocked artifact's status to eligible once the blocking item resolves — that would be exactly the
in-place mutation this contract's revision model forbids (see Invariant I-13). Resolution, however
it happens, produces a **new `IntentSpec` version**, per the Conflict Policy's two resolution paths
above and the general Revision and Version Semantics below; the Blocked version stays Blocked,
permanently, as the historical record of that point in the pipeline's understanding. Requirement
Derivation only ever consumes a version that isn't Blocked — never "the same version, now
resolved."

Resolving a HIGH/CRITICAL block also does not automatically mean asking the user immediately.
Asking the user is one way a block gets resolved, but not the only one: an Inference or Assumption
being revised on a later Intent Parsing pass (see "Conflict Policy" above), or additional context
the user volunteers unprompted, can also produce the new version that clears the block — without
Intent Parsing needing to interrupt with a question the moment the level is assigned. (Research,
once that stage exists downstream, could in principle surface something that prompts the user to
revise their `UserIdea`, but Research Planning runs after Requirement Derivation per
[M0_SCOPE](../foundation/M0_SCOPE.md), and a Blocked `IntentSpec` is exactly what's ineligible for
Requirement Derivation — so research cannot itself be what clears an initial block within this
pipeline's frozen ordering. What HIGH/CRITICAL fixes is that compilation must wait — not that a
clarifying question must be sent the instant the level is assigned.)

This document does not design the clarification UI/UX or the exact mechanics of asking — only when
the semantic contract requires the *need* (and the Blocked status) to exist and be visible to
downstream stages.

## Confidence Policy

Confidence is not attached uniformly to everything — that produces false precision. The policy:

- **User-Provided Claims carry no confidence score.** Attribution is binary: either the user said
  it (traceable to a `UserIdea` version) or they didn't. There is nothing probabilistic about
  "the user said X" itself. (Whether X is *true* is a separate question `IntentSpec` never scores —
  see "Terminology: Claim, Not Fact.")
- **Inferences carry confidence**, describing derivation strength — how well the premises support
  the conclusion — never how likely the conclusion is to be true in the world.
- **Assumptions carry rationale, not confidence.** A manufactured probability on a deliberately
  unsupported proposition would misrepresent what an assumption is.
- **Unknowns carry no confidence.** There is no proposition to score.
- **Ambiguities may record, for each candidate reading, why it's plausible** — this is closer to
  "supporting basis per candidate" than a single confidence number, and must not be reduced to
  silently picking the highest-scored reading.
- **A User-Provided Claim's own hedge ("I think," "roughly") is not confidence and is not scored.**
  It's the separate self-reported-uncertainty axis described under "Claim" above — part of what the
  user said, preserved as-is, not converted into or confused with a MIHVER-assigned probability.

Confidence must never increase merely because an unsupported claim was repeated, copied across
versions, or agreed on by multiple model passes — repetition and self-consistency are not
independent evidence (see Invariant I-16 in the ADR).

## IntentSpec vs. RequirementSpec Boundary

This is a hard boundary, frozen by [M0_SCOPE](../foundation/M0_SCOPE.md): Intent Parsing may not
derive functional or non-functional requirements or decide any technology/framework/architecture;
Requirement Derivation may not decide what the user meant.

The precise line:

```text
IntentSpec:      "The user says/wants/needs/prohibits X (or simply states X)," with origin and
                 provenance, and force when the statement actually carries normative/desiderative
                 content — absent for a purely descriptive claim.
RequirementSpec: "The system shall satisfy X'," a formal, measurable, typed requirement derived
                 from an accepted IntentSpec claim.
```

`IntentSpec` may preserve, verbatim in meaning:

- "User wants local execution" (a User-Provided Claim, force = strong preference/requirement as
  stated),
- "User says budget should stay below $100/month" (Claim, with the ambiguity of what's included
  left as an Open Item if unstated),
- "User prefers Claude as the orchestrating model" (Claim, explicitly naming a technology because
  the *user* named it — see "No Architecture Leakage" below),
- "User does not want automatic production deployment" (Claim with prohibitive force — the
  negation is part of the claim, not a separate flag; see "Conditional and Negative Intent"),
- "User expects approximately 500 users" (Claim, with "500 users" preserved verbatim rather than
  interpreted as concurrent/registered/peak — that interpretation, if needed, is either an
  explicit Inference with its basis stated, or an Open Item).

`IntentSpec` must **not** decide:

```text
local_execution = REQUIRED
max_monthly_cost = 100
orchestrator = Claude
human_approval = REQUIRED
scaling_strategy = X
```

Those are typed, formal, testable requirement values — Requirement Derivation's exclusive
authority. Turning a Claim into one of these, even when the Claim's force is "must," is
compilation, not preservation, and belongs to the next stage.

### No Architecture Leakage

`IntentSpec` must contain no architecture or technology recommendation, *unless the user
explicitly named it*. If the user says "I want to use PostgreSQL," `IntentSpec` may preserve "User
explicitly requested PostgreSQL" as a Claim — it must not evaluate, endorse, or determine PostgreSQL's
technical suitability. That evaluation is downstream (Technology Candidate Identification /
Architecture Synthesis), governed by Principle 2 (Evidence Before Recommendation) in
[PRINCIPLES](../foundation/PRINCIPLES.md).

### Common Violations

- **Forward leakage** (Intent Parsing overreaching): turning "run locally" directly into
  `execution_location = LOCAL`; turning a named technology mention into an accepted architectural
  decision; inventing unstated best-practice requirements (GDPR, 99.9% uptime) that the user never
  raised.
- **Backward leakage** (Requirement Derivation overreaching): reinterpreting what the user meant
  once `IntentSpec` has recorded it; silently deciding *what the user meant* on an Ambiguity or
  Conflict `IntentSpec` left open, instead of failing or requesting a revision — this is about
  interpretive authority, which is never Requirement Derivation's regardless of Decision Impact
  level, and is distinct from the operational gap-filling a downstream stage may legitimately do for
  a LOW/MEDIUM Unknown (see Assumption Policy above); treating a Claim's presence in `IntentSpec` as
  license to decide its truth or feasibility.

## Information-Loss Rules

Intent Parsing is allowed to be lossy only by explicit, statable design — never by accident.

> Meaningful user intent must not disappear silently between `UserIdea` and `IntentSpec`.

### Conditional and Negative Intent

- **Negation is semantically load-bearing and must survive.** "I do NOT want the agent to deploy
  to production" is a Claim with prohibitive force — it is not dropped, softened, or reframed as
  the mere absence of a positive claim about deployment.
- **Conditional statements must survive as conditions, not as unconditional claims.** "Only use
  cloud execution if local execution cannot support the workload" must be preserved as a Claim
  whose applicability is scoped by a stated condition — it must never collapse into
  `cloud_execution = true` (or false). If Intent Parsing cannot represent the condition faithfully,
  the correct outcome is an Open Item (or failure, if the condition is load-bearing enough), not a
  simplified unconditional version.
- **Modality must not drift.** "I'd prefer to avoid AWS" is a preference; it must not become "AWS
  prohibited" or be silently dropped to "no constraint." Strengthening or weakening a Claim's force
  during Intent Parsing is a violation of this contract even when the resulting Claim looks more
  actionable.

## Failure Semantics

Consistent with the frozen "Stage Failure and Revision" invariant in
[M0_SCOPE](../foundation/M0_SCOPE.md), Intent Parsing may return an explicit failure instead of any
`IntentSpec` — Blocked or otherwise — when:

- the input is unintelligible,
- contradictory information prevents any coherent structure from being recorded at all (a
  Conflict can usually still be *represented*, per the Conflict Policy — failure is for the rarer
  case where even representing the input coherently isn't possible),
- required source material referenced by the user is unavailable **and** its absence prevents even
  a partial, defensible structure from being recorded — e.g. the entire stated intent is "use that
  file verbatim" with nothing else to characterize. If a defensible partial structure *can* still
  be recorded (the reference itself as a Claim, an Open Item for the unavailable content, a
  CRITICAL Decision Impact) — as is true whenever there's more to the `UserIdea` than the
  unavailable reference alone — that's a Blocked `IntentSpec`, not a failure; unavailability alone
  doesn't override the general rule that a representable HIGH/CRITICAL gap is Blocked.

A HIGH/CRITICAL ambiguity or conflict that *can* be represented is ordinarily a Blocked
`IntentSpec` (see "Handoff Status" above), not a failure. Failure is not a defect — it is the
correct outcome when even a Blocked `IntentSpec` would mean inventing structure MIHVER does not
have grounds for. This is the same invariant that governs every other stage: no stage is obligated
to force an output where the input does not support one.

## Revision and Version Semantics

`IntentSpec` participates in the same versioned-supersession model as every other M0 artifact
(Principle 3, [PRINCIPLES](../foundation/PRINCIPLES.md); "Stage Failure and Revision,"
[M0_SCOPE](../foundation/M0_SCOPE.md)):

- A new `UserIdea` version (an addition, correction, or clarification answer) triggers a rerun of
  Intent Parsing, which produces a new `IntentSpec` version *or* an explicit failure — the same
  choice available on any run, per "Stage Failure and Revision" in
  [M0_SCOPE](../foundation/M0_SCOPE.md). When it does produce a new version, the prior `IntentSpec`
  version is superseded, not edited in place.
- When a new `UserIdea` version explicitly supersedes an earlier statement, every Claim in the
  prior `IntentSpec` that was derived from (or dependent on) the superseded statement must be
  reconsidered in the new version — not silently carried forward unchanged merely because its text
  still reads plausibly. An Inference or Assumption that rested on now-superseded content does not
  survive revision unexamined.
- A `UserIdea` correction can resolve a previously recorded Conflict between two User-Provided
  Claims (by superseding one side) or Ambiguity (by disambiguating), or it can resolve an
  Assumption (by supplying the previously missing information) — in each case the resolution is
  recorded in the new `IntentSpec` version, and the prior version's record of the open question
  remains intact as history. A Conflict where one side is an Inferred or Assumed Claim can
  additionally be resolved by a new Intent Parsing run revising its own derived claim, without a
  new `UserIdea` version — see "Conflict Policy" above — but this still produces a new `IntentSpec`
  version, never an in-place edit of the one that recorded the Conflict.
- A later user statement that happens to match an earlier Assumption does not retroactively make
  that assumption a User-Provided Claim in the version where it was introduced — it confirms or
  supersedes it only in the new version.

## Invariants

- **I-01** A model inference cannot become a user-provided claim.
- **I-02** An assumption cannot become a user-provided claim.
- **I-03** An unknown may remain unknown; nothing forces a guessed value to complete the artifact.
- **I-04** Conflicting claims are preserved, not silently resolved.
- **I-05** Every inference has inspectable provenance (its premises and reasoning kind).
- **I-06** Every assumption has explicit rationale (why, scope, reversibility).
- **I-07** Clarification need is a decision computed from decision impact, separate from a Claim's
  or Open Item's own record.
- **I-08** Low-impact unknowns do not automatically require clarification.
- **I-09** `IntentSpec` contains no architecture or technology recommendation unless preserving an
  explicit user request, and even then does not evaluate its suitability.
- **I-10** `IntentSpec` does not derive `RequirementSpec`-level requirement classifications.
- **I-11** Negation must survive interpretation as prohibitive force, not disappear or become an
  unconditional positive claim's absence.
- **I-12** Conditional intent must survive interpretation as a scoped condition, not collapse into
  an unconditional claim.
- **I-13** Revision supersedes rather than mutates historical `IntentSpec` and `UserIdea`
  artifacts.
- **I-14** Intent Parsing may explicitly fail rather than fabricate certainty.
- **I-15** A downstream artifact must eventually be able to trace material meaning back to
  `UserIdea` provenance through `IntentSpec`'s recorded chain.
- **I-16** Repetition, paraphrase, or multi-pass agreement does not by itself increase confidence
  or promote an item's origin.
- **I-17** An Ambiguity's candidate readings must trace to specific user wording; MIHVER may not
  record an Ambiguity that isn't grounded in something the user actually wrote.
- **I-18** A Blocked `IntentSpec` (a complete, versioned artifact with an unresolved HIGH/CRITICAL
  item) is a valid produced output, not a failure. That specific Blocked version is **never**
  consumable by Requirement Derivation — not now, and not later, even once whatever blocked it is
  resolved. Resolution does not make the Blocked version eligible; it produces a new, superseding
  `IntentSpec` version, and *that new version* — not the Blocked one — is what Requirement
  Derivation may consume. The Blocked version remains in the historical record, permanently
  not-consumable, exactly as it was. Failure is reserved for input that prevents any defensible
  `IntentSpec` from being recorded at all.
- **I-19** An Assumption may only fill a narrowly interpretive gap (what the user meant); it may
  never supply a technical or operational working default (a parameter, scope, or figure the user
  never addressed) merely to give a downstream stage something to work with.
- **I-20** An Open Item exists only when resolving it is necessary to faithfully interpret, safely
  compile, or preserve a directly implicated boundary of the stated intent — not for every
  imaginable adjacent capability a system like this might someday need.
- **I-21** A Conflict between two User-Provided Claims can be resolved only by an explicit
  `UserIdea` revision; a Conflict involving an Inferred or Assumed Claim may additionally be
  resolved by Intent Parsing revising its own derived claim on a later run — either way, resolution
  produces a new version, never an in-place edit.
- **I-22** A Claim's force (normative/desiderative modality — obligation, prohibition, permission,
  or preference; possibly absent for a purely descriptive claim), self-reported uncertainty (the
  user's own epistemic hedging, e.g. "maybe," "I think"), and discourse role
  (operative/example/quotation) are independent axes; none may be collapsed into or inferred from
  another, and epistemic hedge words must never be read as a force value.

## Examples

- User: "I want the system to run locally." → Claim, origin = User-Provided, force = strong
  preference/requirement as literally stated, unresolved Open Item: what "locally" is scoped to
  (device / network / premises).
- User: "I don't want our source code sent to external providers." → Claim, origin = User-Provided,
  force = prohibition. Permitted Inference (separately recorded, with basis and moderate
  confidence): "the user appears to have a data-locality or privacy constraint" — kept distinct
  from the Claim itself.
- Deployment region never mentioned. → Open Item: Unknown. Decision Impact assessed by Intent
  Parsing itself, before handoff — not by a downstream stage, which never sees this assessment
  until it exists (likely MEDIUM unless another Claim makes it HIGH/CRITICAL, e.g. a data-residency
  prohibition).
- "Everything must run locally" earlier, "use a managed cloud-only service" later in the same
  `UserIdea` (no supersession stated). → Conflict recorded, both Claims preserved, no side chosen.
- User: "I think we have about 10,000 users, but I'm not sure." → Claim, origin = User-Provided,
  self-reported uncertainty = hedged, force = absent (this is a purely descriptive statement about
  the world — no obligation, permission, or preference is expressed; the hedge belongs entirely to
  self-reported uncertainty, not to a force value). The hedge survives distinctly from any separate
  Inference confidence MIHVER might record elsewhere.
- User: "May we retain logs for 30 days if legal approves?" → Claim, force = permission (not
  obligation), condition = legal approval. `IntentSpec` does not compile this into a retention
  requirement.
- User: "We currently have 5 engineers on the team." → Claim, origin = User-Provided, force =
  absent (purely descriptive — no obligation, permission, or preference is expressed).
- User: "Maybe you could add a dark mode?" → Claim, force = preference (weak — the desiderative
  content is "add a dark mode"), self-reported uncertainty = hedged ("maybe"). "Maybe" is not read
  as the force value itself; force and hedge are recorded as two separate properties of one Claim.

## Anti-Examples

- Storing "User wants local execution" and "MIHVER infers a privacy motivation" as the same kind of
  item with no origin distinction. (Violates I-01/I-05.)
- Silently filling an unmentioned deployment region with "cloud" because it's common. (Violates
  I-03/I-02 — an unstated default masquerading as either an Unknown-resolution or an unlabeled
  Assumption.)
- Emitting `local_execution = REQUIRED` directly from "it must run locally." (Violates I-09/I-10 —
  this is a RequirementSpec-shaped value, not an IntentSpec claim.)
- Interrupting the user to ask about UI color choice before any architecture work begins. (Violates
  I-08 — this is a LOW-impact Open Item that does not warrant clarification.)
- Picking "cloud execution" as the resolved value for "only use cloud if local can't support the
  workload." (Violates I-12 — the condition is dropped instead of preserved.)
- Recording an Assumption of "assume 3-5 competitors by public visibility" to help Requirement
  Derivation get started, when the user never addressed scope at all. (Violates I-19 — an invented
  operational default, not an interpretive gap; should remain Unknown.)
- Listing "whether the CI provider supports parallel test runners" as an Unknown for a UserIdea that
  never mentions CI or testing. (Violates I-20 — an adjacent capability question, not implicated by
  the stated intent.)
- A Blocked `IntentSpec` v3 having its status field silently flipped to "eligible" once new
  information arrives, instead of producing v4. (Violates I-13/I-18/I-21.)
- Recording "the user is fairly confident about the 10,000-user figure" as an Inference confidence
  score derived from the words "I think." (Violates I-22 — self-reported uncertainty is the user's
  own hedge, not a MIHVER-assigned confidence value.)
- Recording "I want it to cost under $100/month" with obligatory force ("must"). "I want" is
  preference language; silently upgrading it to an obligation because the underlying desire seems
  important is exactly the drift Information-Loss Rules forbid — "I want X" must not become "X is
  mandatory" without wording that actually says so ("must," "need to," "required to"). (Violates
  "Modality must not drift" and I-22.)
- Recording "maybe we should use Redis" with force = "weakly-held possibility." There is no such
  force category; the correct record is force = preference (weak) plus self-reported uncertainty =
  hedged, as two separate properties. (Violates I-22.)
