# ADR-0002: Epistemic Provenance Model

## Status

Proposed

## Context

M0 Step 02A defines the semantic contract for `UserIdea` → Intent Parsing → `IntentSpec` (see
[USER_IDEA](../contracts/USER_IDEA.md) and [INTENT_SPEC](../contracts/INTENT_SPEC.md)). Before
that contract could be written, a more basic question had to be answered: what does it mean for
MIHVER to "understand" a `UserIdea`, and how does that understanding get represented so it can be
trusted by every later stage?

The obvious, simplest implementation is: an LLM reads the raw `UserIdea` and emits a normalized
JSON object describing the user's intent. That model is rejected here, for reasons this ADR makes
explicit.

### Why the flat "LLM reads prompt, emits normalized JSON" model is rejected

A flat normalized-JSON model collapses several genuinely different epistemic states into one
representation:

- what the user actually said,
- what the model concluded the user meant,
- what the model guessed to fill a gap,
- what the model didn't know and quietly defaulted anyway,
- two things the user said that don't agree with each other.

Once collapsed into a single JSON object with no origin markers, none of these are distinguishable
by a downstream consumer. A field like `"deployment": "cloud"` looks identical whether the user
said "use the cloud," MIHVER inferred it from an unrelated remark, or MIHVER guessed it because
nothing was said. Requirement Derivation would then have no way to tell the difference between
compiling a stated requirement and compiling a hallucination.

This directly conflicts with several frozen foundation principles
([PRINCIPLES](../foundation/PRINCIPLES.md)):

- **Principle 2 (Evidence Before Recommendation)** requires every material recommendation to cite
  an explicit basis. A flat JSON model has no place to record that basis once normalization has
  happened — the basis is lost at the moment of normalization.
- **Principle 4 (Separate Facts From Decisions)** requires observed information and MIHVER's own
  conclusions to be distinguishable and separately stored — in Principle 4's own frame that means
  `Evidence` (gathered later, from research) versus `ArchitectureDecision`; the same separation
  principle applies one stage earlier, between what the user asserted and what MIHVER concluded
  from it. A flat model merges them into indistinguishable fields.
- **Principle 7 (LLMs Are Reasoners, Not Authorities)** requires that an LLM's output remain
  subject to validation, not treated as a final answer merely because it was model-generated. A
  flat JSON output *is* treated as a final answer by construction — there is nothing left in the
  representation to subject to further scrutiny.
- **Principle 10 (Explainability)** and **Principle 11 (Reproducibility)** require that a later
  stage's decision be traceable to what supported it and reconstructable from retained artifacts.
  A flat model destroys the chain at the first stage of the entire pipeline, so nothing downstream
  can ever recover it.

The failure mode this produces in practice is **requirement hallucination**: a plausible-sounding
but unsupported interpretation gets compiled into `RequirementSpec` as if it were user-stated,
because nothing in `IntentSpec` distinguished it from something the user actually said.

## Decision

MIHVER will preserve epistemic provenance explicitly between `UserIdea` and `IntentSpec`, and will
not treat model-derived interpretations as equivalent to user-provided claims.

Concretely, `IntentSpec` represents three distinct kinds of record — **Claim** (with origin
User-Provided / Inferred / Assumed), **Open Item** (Unknown or Ambiguity), and **Conflict** (a
relationship between items) — rather than a single flat enum or a single undifferentiated JSON
object. Clarification need is treated as a separate, computed decision (based on Decision Impact),
not as a fourth epistemic category. A Claim's force (normative modality), self-reported uncertainty
(the user's own hedging, e.g. "I think," "roughly"), and discourse role (operative statement vs.
example/quotation/sample) are kept as independent axes rather than folded into one overloaded
"force" property. Assumptions are restricted to narrowly interpretive gaps — never invented
technical or operational defaults — and Open Items exist only when resolving them is necessary to
faithfully interpret, safely compile, or preserve a directly implicated boundary of the stated
intent, not for every speculative adjacent capability. The full model, its policies, and its
invariants are specified in [INTENT_SPEC](../contracts/INTENT_SPEC.md); this ADR records why that
shape was chosen, not the shape itself in full detail.

## Rationale

- **Prevents provenance laundering.** An inference or assumption can never be read back as a
  user-provided claim, because origin is a first-class, mandatory property of every Claim, not an
  optional annotation that can be dropped during normalization.
- **Keeps Conflict and Unknown from being miscategorized as weak claims.** Modeling `Conflict` as a
  relationship (not a per-item status) and `Unknown` as an absence (not a low-confidence claim)
  avoids two specific failure modes identified during design: conflicts silently resolving to
  whichever side was processed last, and unknowns quietly defaulting to a plausible-looking value.
- **Separates confidence from clarification.** Confidence describes derivation strength for an
  Inference; it says nothing about whether the user should be interrupted. Decision Impact is a
  distinct, explicit judgment about consequence, so MIHVER doesn't clarify every low-stakes gap
  (bad product experience) or silently proceed past every high-stakes one (unsafe).
- **Satisfies the frozen stage boundary without weakening it.** `IntentSpec` can preserve strongly
  stated user constraints ("it must run locally," "budget under $100/month") without compiling them
  into `RequirementSpec`-shaped values, because force (obligation/prohibition/preference) is
  recorded as a property of the Claim, separate from the act of formalizing it into a requirement.
- **Makes the model auditable without demanding hidden reasoning.** Provenance for an Inference is
  its premises and reasoning kind — enough for a human or a later stage to challenge it — not a
  full chain-of-thought transcript. This keeps the contract implementable by different reasoning
  approaches (a single LLM call, multiple calls, a rules engine) without baking in a specific
  implementation.
- **Keeps Intent Parsing from quietly doing Requirement Derivation's job.** Restricting Assumptions
  to narrowly interpretive gaps — and requiring Unknown to normally stay Unknown rather than be
  patched over with an invented competitor list, cost scope, or capacity figure — prevents Intent
  Parsing from pre-empting decisions that belong to a later stage merely to hand that stage
  something to work with. A helpful-looking invented default is exactly the kind of unearned
  certainty this ADR exists to prevent, just relocated to a later field.
- **Keeps the Open Item set legible.** Requiring an Open Item to be necessary to faithfully
  interpret, safely compile, or preserve a directly implicated boundary — not merely imaginable —
  stops the record from accumulating speculative gaps about every adjacent capability a system
  like the one described might someday need, which would bury the Open Items that actually matter.
- **Distinguishes what the user handed over from what the user merely pointed at.** A user-supplied
  URL or reference is itself user-supplied content (becoming a User-Provided Claim once `IntentSpec`
  represents it); content later fetched from it is not automatically user-authored. Conflating the
  two would let externally-sourced material masquerade as something the user personally supplied
  and reviewed.

## Consequences

- Intent Parsing must do more structural work than "summarize the request." It must classify each
  piece of information it extracts, state a basis for every inference, and explicitly flag every
  Open Item or Conflict it does not resolve.
- `IntentSpec` is a larger, more structured artifact than a short normalized summary would be. This
  is a deliberate tradeoff: more structure now, in exchange for `RequirementSpec` (and everything
  after it) being able to inspect and appropriately weight what it's compiling from — per Principle
  7 (LLMs Are Reasoners, Not Authorities), a downstream stage still must not treat every `IntentSpec`
  item as equally authoritative just because it's structured; structure makes that judgment
  possible, it doesn't make it automatic.
- Every future stage that consumes `IntentSpec` — starting with Requirement Derivation — must
  itself respect origin and force when compiling, rather than treating every Claim as equally
  authoritative. This ADR does not design that consumption logic; it only establishes that the
  information will be available for it.
- Revision becomes more consequential: superseding a `UserIdea` statement can invalidate downstream
  Inferences and Assumptions that depended on it, and the contract requires those dependents to be
  reconsidered rather than silently carried forward (see "Revision and Version Semantics" in
  [INTENT_SPEC](../contracts/INTENT_SPEC.md)). This is more bookkeeping than a stateless
  re-summarization would require.
- A Blocked `IntentSpec` (HIGH/CRITICAL item unresolved) never flips to "eligible" in place —
  clearing a block always produces a new version, and the Blocked version stays in the historical
  record permanently. This means the pipeline can accumulate several superseded Blocked versions
  for a single evolving idea before one finally clears, which is more version churn than an
  implementation might naively expect, but is required to keep the historical record honest.
- This model does not, by itself, prevent a bad Intent Parsing implementation from mislabeling an
  Assumption as an Inference or vice versa — the contract defines the categories and their
  invariants; enforcing correct classification is a validation concern for a later design step
  (see Open Questions).

## Alternatives Considered

- **Flat normalized JSON, no provenance.** Rejected — see "Why the flat model is rejected" in
  Context above.
- **Single flat five-value enum (`EXPLICIT / INFERRED / ASSUMED / UNKNOWN / CONFLICT`) per item.**
  This was the starting proposal for this step. Rejected in its literal flat form because `CONFLICT`
  is a relationship between items, not a status one item can hold in isolation, and `UNKNOWN`
  describes an absence of a claim, not a kind of claim. Forcing both into the same enum as
  `EXPLICIT`/`INFERRED`/`ASSUMED` produces a category error that would leak into every downstream
  consumer's logic. The adopted model keeps origin as a three-value property of Claims
  specifically, and models Open Item and Conflict as structurally distinct record kinds.
- **Confidence score on every item, uniformly.** Rejected. A single confidence number is meaningful
  for Inferences (derivation strength) but meaningless or actively misleading for User-Provided
  Claims (attribution is binary, not probabilistic), Assumptions (which need rationale, not a
  probability, since they're deliberately unsupported), and Unknowns (nothing to score). Uniform
  confidence would manufacture false precision exactly where the model most needs to avoid it.
- **Clarify on every Unknown/Ambiguity.** Rejected as a usability failure — most gaps don't matter
  enough to interrupt the user. The Decision Impact model (LOW/MEDIUM/HIGH/CRITICAL) was adopted
  specifically to make the clarify/defer choice principled rather than either "always ask" or
  "never ask."
- **Resolve conflicts automatically by recency (latest statement wins).** Rejected as a default
  rule. Recency is a legitimate basis for resolution *when the user's later statement explicitly
  supersedes the earlier one* (an explicit revision, per `UserIdea`'s versioning model), but silently
  applying "latest wins" to any two contradictory statements would erase genuine, still-live
  conflicts (e.g., two different stakeholders' requirements stated in the same session) that must
  instead be surfaced.

## Risks

- **Over-structuring risk.** The three-kind model (Claim / Open Item / Conflict) plus force, scope,
  provenance, confidence, and decision impact is more conceptual surface area than a minimal
  contract needs. Mitigation: this ADR and `INTENT_SPEC.md` deliberately stop short of defining any
  schema, field names, or serialization — the structure is conceptual until Requirement IR /
  schema design work actually needs it, per [M0_SCOPE](../foundation/M0_SCOPE.md).
- **Classification-boundary risk.** The Inference/Assumption boundary ("can MIHVER state a
  premise-based reasoning step, or is it proceeding without adequate support?") is a judgment call
  a real implementation will sometimes get wrong. This ADR defines the categories; it does not
  guarantee any particular implementation classifies correctly.
- **Decision Impact miscalibration risk.** LOW/MEDIUM/HIGH/CRITICAL is a coarse, judgment-based
  scale. An implementation that systematically under-rates impact would silently reintroduce the
  hallucination risk this ADR exists to prevent, just one layer downstream (at the
  clarify-vs-proceed decision instead of at the claim-labeling decision).
- **Provenance verbosity vs. usability.** Fully preserving force, scope, conditions, and provenance
  for every claim risks producing an `IntentSpec` too dense for a human to review directly. This ADR
  treats that as an acceptable cost at the contract level; presentation/summarization for human
  review is a separate, later concern.

## Open Questions

- How should an implementation validate that Intent Parsing correctly classified origin (rather
  than mislabeling an Assumption as an Inference to look more justified)? This contract defines the
  categories and invariants but not an enforcement mechanism.
- Should Decision Impact ever be informed by `Evidence` (once evidence exists, later in the
  pipeline) rather than purely by IntentSpec-local reasoning? At M0 Step 02A, no `Evidence` exists
  yet when `IntentSpec` is produced, so this is out of scope here but may matter once revision
  loops involving later stages are designed.
- How much of the epistemic structure should survive into `RequirementSpec` itself (e.g., does a
  formal requirement still carry a pointer to its originating Claim's force and provenance, or is
  that translated into a different representation)? This is explicitly deferred to Requirement
  Derivation's own contract design, not decided here.
- Where should multi-goal decomposition (a single `UserIdea` expressing several distinct
  objectives) live — as a structuring concept within `IntentSpec`, or left implicit as multiple
  independent Claims about "what the user wants"? Not resolved in this step; see
  [INTENT_CASES](../examples/INTENT_CASES.md) for a worked example that exposes the question.
- How should `IntentSpec` represent conditions with structure beyond a single scoping condition —
  necessary vs. sufficient conditions, unless/exception clauses, nested conditions, or conditions
  with a temporal/phased element ("once accuracy stays above 98% for a month...")? This step
  establishes that a Claim may carry a condition; it does not define a taxonomy of condition types.
- When a `UserIdea` reports a conflict between named third parties with different authority (e.g.
  "Security says X, Product says Y, I'm implementing whatever they decide"), asking the submitting
  user to resolve it may not be a valid clarification strategy, since they may not hold the
  authority to. This step's Conflict and speaker-attribution provisions record the relationship and
  who is asserting what; deciding *who has resolution authority* is out of scope here. This applies
  equally when the submitting user themselves lacks authority to resolve a conflict they're
  reporting (e.g. "I'm the engineer implementing whatever they decide") — the two-path Conflict
  resolution in [INTENT_SPEC](../contracts/INTENT_SPEC.md) defines *artifact-origin* authority
  (User-Provided vs. derived), not *organizational* authority to settle a dispute.
- How should Intent Parsing represent uncertainty about a Claim's own **discourse role** — i.e.
  when it's genuinely unclear whether a piece of text is the user's operative statement, an
  illustrative example, or a quotation, and the ambiguity is about which role applies, not about
  the proposition's content? The Ambiguity mechanism as specified covers multiple readings of *what
  a claim means*; it does not yet explicitly cover multiple readings of *what kind of claim this
  is*. Not resolved in this step.
- Where a user explicitly adopts external content as binding without authoring it (e.g. "use
  whatever's at this URL as the spec, I approve everything on that page"), the external-reference
  distinction in [USER_IDEA](../contracts/USER_IDEA.md) correctly keeps fetched bytes out of
  `UserIdea`, but doesn't yet say how such content should be represented once retrieved — it isn't
  quite a User-Provided Claim (the user didn't write it), isn't quite ordinary `Evidence` (the user
  gave it normative force by adopting it), and a mutable reference (content that can change after
  the user pointed at it) has no defined snapshot/versioning behavior. Not resolved in this step.
- The Assumption Policy's interpretive/operational line ("what the user meant" vs. "a system
  parameter the user never addressed") gets genuinely hard to apply when the user refers to an
  *existing, unstated external convention* rather than either a linguistic ambiguity or a pure gap
  (e.g. "after the usual grace period" — is inferring "whatever the user's own existing process
  currently treats as usual" an interpretive move, or an operational default in disguise?). Not
  resolved in this step; implementations should treat close calls conservatively (toward Unknown)
  until this is refined.
- The Open Item relevance test ("necessary to interpret, safely compile, or preserve a directly
  implicated boundary") has a real judgment call at its edges for systems that *coordinate* a
  real-world activity with inherent risk without directly *performing* it (e.g. a marketplace for
  lending power tools, or a facility guide that shares a building with emergency egress concerns).
  The test filters obvious speculation cleanly but doesn't fully resolve "shares a domain with a
  safety concern" vs. "directly implicates a safety boundary." Not resolved in this step.

## Future Work

- Design the RequirementSpec-side contract (Requirement Derivation's semantic model), consuming
  `IntentSpec`'s Claims/Open Items/Conflicts per the boundary defined here.
- Design the schema (field names, cardinality, serialization) for `IntentSpec`'s epistemic records,
  per the M0-internal schema design work referenced in [M0_SCOPE](../foundation/M0_SCOPE.md) and
  the Requirement IR / Architecture IR future work already listed in
  [ADR-0001](./ADR-0001-ARCHITECTURE-COMPILER-MODEL.md).
- Define a validation approach for origin-classification correctness (see Open Questions).
- Revisit this ADR's Status once the schema design work and at least one adversarial review pass
  (see [INTENT_CASES](../examples/INTENT_CASES.md)) have exercised the model against real cases.
