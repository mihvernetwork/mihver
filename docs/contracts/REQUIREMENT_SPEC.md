# Contract: RequirementSpec

Status: part of M0 Step 03A (Requirement semantic contract). Implementation-independent — no
serialization, field names, or schema are defined here (see [ADR-0003](../adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md)
for why schema design is deliberately deferred). This document defines the semantic contract every
later schema/validator design must satisfy, the same relationship [INTENT_SPEC](./INTENT_SPEC.md)
has to `schemas/m0/intent-spec.schema.json`.

## Purpose

`RequirementSpec` is Requirement Derivation's output: the compiled, formal, typed set of
requirements that downstream stages (Research Planning, Technology Candidate Identification,
Architecture Synthesis, Evaluation) check candidates and decisions against — see
[M0_SCOPE](../foundation/M0_SCOPE.md)'s "Stage: Requirement Derivation" and ADR-0001's "Requirement
IR." It exists to make one thing possible: a downstream stage can ask "does candidate X satisfy
requirement Y?" as a structural check against a typed, testable statement, without re-reading
`IntentSpec` prose or re-deriving what the user meant.

`RequirementSpec` is a **compilation**, not a re-interpretation. `IntentSpec` already answered "what
did the user mean?" `RequirementSpec` answers a different question: "given what the user meant, what
concrete, testable technical and operational requirements follow?" Confusing the two — either
`IntentSpec` reaching into requirement territory, or `RequirementSpec` reaching back into what the
user meant — is exactly the frozen boundary violation `INTENT_SPEC.md`'s "IntentSpec vs.
RequirementSpec Boundary" section and `M0_SCOPE.md`'s stage table both already forbid. This document
takes that boundary as given and defines what happens on the `RequirementSpec` side of it.

## Stage Boundary (frozen, restated for context)

Per `M0_SCOPE.md`:

```text
Requirement Derivation
  Input:  IntentSpec
  Output: RequirementSpec
  Allowed to decide:     Functional requirements, non-functional requirements (latency, cost,
                          compliance, team skill, scale), constraints, and success criteria derived
                          from the accepted IntentSpec.
  Not allowed to decide: Which technologies satisfy those requirements; how many architecture
                          candidates will be produced; what the user meant.
```

This document does not restate or relitigate this boundary; it specifies what "derived from the
accepted `IntentSpec`" defensibly means in practice.

## Input Eligibility

Requirement Derivation may consume **only** an `IntentSpec` version whose `handoff.status` is
eligible (`requirement_derivation_consumable: true`, per `INTENT_SPEC.md`'s "Handoff Status: Blocked
vs. Failed"). A Blocked `IntentSpec` — one with an unresolved HIGH or CRITICAL Open Item or Conflict
— is never a valid input, in whole or in part. Requirement Derivation must refuse a Blocked
`IntentSpec` entirely rather than attempting a "best effort" partial derivation from it: there is no
such thing as deriving requirements "around" a HIGH/CRITICAL gap, because that gap is, by
definition, decision-impactful enough that proceeding without it risks a materially wrong, unsafe,
or invalid result (`INTENT_SPEC.md`'s Decision Impact levels). Refusing a Blocked input is not a
`RequirementSpec`-level failure in its own right — it is simply "no input was available"; see
"Failure vs. Blocked/Partial Output Semantics" below for what *is* a `RequirementSpec`-level outcome.

An eligible `IntentSpec` may still carry unresolved LOW/MEDIUM Open Items and, in principle,
LOW/MEDIUM Conflicts (Decision Impact levels apply to Conflicts too, not only Open Items — nothing in
`INTENT_SPEC.md` restricts a Conflict to HIGH/CRITICAL, even though every worked example in
`INTENT_CASES.md` happens to be HIGH/CRITICAL). This document defines how those surviving items are
treated once they reach this stage — see "LOW/MEDIUM Open Items and Conflicts That Survive Into This
Stage" below.

## What Qualifies as a Requirement

A Requirement is a **formal, measurable or testable, typed statement** about the system to be built
— "the system shall/shall not/may X, under condition C" — with an explicit provenance chain back to
the Claim(s) or Open Item(s) that support it. A Requirement is not a restatement of a Claim in more
formal words; it is a *compiled* value: something a later stage can check a candidate architecture
against without re-reading prose.

Whether, and what, a Claim compiles to depends on its force, in exactly three ways — never a fourth:

- **Resolved normative or desiderative force** (obligation, prohibition, permission, or preference —
  `INTENT_SPEC.md`'s force axis) — the Claim **may become the basis of a Requirement**, mapped per
  "Force → Requirement Strength Mapping" below.
- **Genuinely force-absent (purely descriptive)** — e.g. "we have five engineers" — the Claim **never
  becomes a Requirement**, by itself; see "What Must Not Become a Requirement."
- **Constraining or binding content whose own force did not resolve to any of the four categories**
  (e.g. an explicitly named required technology stated as a plain, unhedged method rather than as an
  "I want" preference or a stated obligation — see "User-Selected Technology" below) — the Claim is
  **not** thereby eligible to become a Requirement with an assigned strength; per **R-20**, it is
  preserved as an **unresolved constraint-candidate**, and the affected portion of `RequirementSpec` is
  Partial, not Complete, until a new Intent Parsing pass resolves the force. This is a different case
  from the first bullet, not a variant of it: the Claim's binding *character* being evident from its
  wording does not mean its binding *strength* (MUST/SHOULD/MAY) is already settled — those are the
  two different questions R-20 exists to keep separate.

## What Must NOT Become a Requirement

- **A purely descriptive Claim, on its own.** "We have five engineers" or "we currently have 50,000
  active users" states a fact about the user's situation, not something they want, require, or
  forbid. It must not be formalized into a Requirement by itself (there is no "the system shall have
  five engineers" to derive). It may legitimately serve as **rationale attached to** a different
  Requirement that a force-bearing Claim actually supports (e.g. team size may justify a
  maintainability/skill-fit non-functional requirement derived from a *separate* Claim that
  expresses a preference about operational burden) — but the descriptive Claim itself never becomes
  the Requirement's normative content. Concretely: rationale is non-normative metadata only —
  removing it must leave the Requirement's normative proposition, parameters, scope, strength, and
  satisfaction test completely unchanged. No value that occurs *only* in a descriptive Claim (a
  number, threshold, actor, or boundary) may appear in, or narrow, the Requirement's own testable
  content; a descriptive Claim may explain *why* a separately-supported Requirement matters, never
  supply *what* that Requirement actually requires.
- **An unresolved Ambiguity or Conflict, resolved by Requirement Derivation.** Per
  `INTENT_SPEC.md`'s "Backward leakage" rule, deciding *what the user meant* on an Ambiguity or
  Conflict `IntentSpec` left open is never Requirement Derivation's job, **regardless of that item's
  Decision Impact level** — a MEDIUM Ambiguity is exactly as off-limits to interpretive resolution
  here as a HIGH one would have been (HIGH/CRITICAL ones never reach this stage at all, per Input
  Eligibility above; a MEDIUM or LOW Ambiguity/Conflict legitimately can reach this stage, and
  interpretive authority over it still belongs to Intent Parsing alone). This is categorically
  different from filling an *operational* gap (an Unknown, not an Ambiguity) with a working default
  — see "LOW/MEDIUM Open Items and Conflicts That Survive Into This Stage" below for that
  distinction.
- **An Inferred or Assumed Claim, presented as if it were User-Provided.** A Requirement derived
  from an Inference or an Assumption must carry visible origin distinct from a User-Provided-derived
  Requirement — see "Treatment of Claim Origin" below. It is not forbidden to derive a Requirement
  from one; it is forbidden to launder its provenance in the process.
- **Invented best-practice or "obviously needed" requirements the user never raised**, no matter how
  standard they might be for the domain (GDPR compliance, 99.9% uptime, horizontal scalability). If
  no Claim, Inference, or Assumption in the `IntentSpec` supports it, it is not a Requirement — it is
  Requirement Derivation manufacturing scope, the exact failure mode `ADR-0002`'s "requirement
  hallucination" concept named one stage earlier and this document exists to prevent one stage later.
- **A technology suitability or selection judgment.** Even where a user-named technology becomes a
  Requirement-level constraint (see "User-Selected Technology" below), evaluating whether it is a
  *good* choice, comparing it to alternatives, or selecting among several named technologies is
  Technology Candidate Identification's and Architecture Synthesis's job, never Requirement
  Derivation's — see "Architecture/Technology Leakage Prohibitions" below.
- **Any content from a HIGH/CRITICAL Open Item or Conflict.** These never reach this stage per Input
  Eligibility; there is nothing further to say about them here except that their absence is expected,
  not an oversight.

## Provenance: Requirement → IntentSpec → UserIdea

Every Requirement must carry a provenance chain an auditor can inspect without re-running any model,
extending the same chain `INTENT_SPEC.md`'s own Provenance section establishes:

```text
ArchitectureDecision
    ↓
RequirementSpec
    ↓
IntentSpec
    ↓
UserIdea
```

Concretely, a Requirement's provenance must record:

- **which Claim(s) or Open Item(s) it derives from** — one or more `claim_id`/`open_item_id`
  references into the specific `IntentSpec` version consumed. Both directions are allowed and
  expected: one Requirement may combine several Claims, and one Claim may support several distinct
  Requirements (see "Requirement Cardinality and Granularity" below). A Requirement with **zero**
  such references is malformed by definition — there is no such thing as a Requirement with no basis
  in the consumed `IntentSpec`.
- **which `IntentSpec` version it was derived from** — so that when that version is superseded, every
  Requirement depending on it can be identified for reconsideration (see "IntentSpec Supersession
  Effects" below).
- **whether Requirement Derivation itself introduced anything beyond direct compilation** — a filled
  operational default for a surviving Unknown, or a Requirement-level inference drawn from an
  already-accepted Claim (see "Requirement-Level Inference" below) — and if so, its own basis,
  exactly as `INTENT_SPEC.md` requires an Inferred Claim to state its premises and reasoning kind.
  This is a second, independent layer of provenance on top of whatever `IntentSpec` already recorded
  — it is never merged into or presented as though it were part of `IntentSpec`'s own provenance.

This chain is what lets a `RequirementSpec` item, in turn, be traced by a later
`ArchitectureCandidate` or `ArchitectureDecision` all the way back to the original `UserIdea`, per
Principle 11 (Reproducibility) and the same traceability obligation `INTENT_SPEC.md`'s Invariant
I-15 places on itself one stage earlier.

## Requirement Cardinality and Granularity

Both cardinalities are valid, and neither is fixed or assumed:

- **Multiple Claims may support one Requirement**, when their conjunction defines a single testable
  behavior — e.g. a positive capability Claim together with the prohibitions that scope its output
  shape, where the prohibitions are not independently meaningful requirements on their own but only
  make sense as constraints *on* the capability they scope. A combined Requirement's provenance lists
  every contributing Claim, not just the strongest one.
- **One Claim may support several distinct Requirements**, when the Claim mechanically entails more
  than one independently-testable consequence — e.g. "log every user action and let me search those
  logs afterward" entails both a logging requirement and a search requirement, because the Claim's own
  wording directly and textually names both actions as things *this* system does (see Case 12 in
  [REQUIREMENT_CASES](../examples/REQUIREMENT_CASES.md)). A weaker example — e.g. a notification
  preference alone entailing both a "detect the triggering event" requirement and a "send the
  notification" requirement — is *not* automatically legitimate this way: unless the Claim's own
  wording names the detecting system as unambiguously *this* system (rather than leaving it open
  whether an external system, platform webhook, or human supplies the event), assigning a detection
  requirement is assigning unstated architectural responsibility, not compiling what the Claim actually
  entails — see Case 12's own contrast with its rejected earlier draft for the worked failure mode this
  bullet exists to avoid. Splitting is legitimate only when each resulting
  Requirement expresses a genuinely distinct, non-redundant consequence the Claim's own content
  entails; it is not legitimate merely because a plausible-sounding second Requirement could be
  imagined. If the split itself depends on resolving what an ambiguous phrase in the Claim covers —
  rather than on what the Claim's already-settled content mechanically entails — that split is an
  interpretive judgment, not a compilation, and belongs to a new Intent Parsing pass (per
  "Requirement-Level Inference"'s operational test above), not to Requirement Derivation choosing the
  reading it finds most natural.

A single Requirement may combine clauses of **different strength** when they jointly describe one
coherent behavior (e.g. "the system SHOULD do X, and in doing so MUST NOT do Y") — this is not a
violation of "Force → Requirement Strength Mapping" below, because each clause's own strength still
traces to its own originating Claim's own force; strength is preserved per-clause, not homogenized
across the combined statement.

This document does not fix a single granularity rule finer than the above — how narrowly a
"Requirement" should be scoped in a given case remains, in part, a judgment Requirement Derivation
exercises and records (see `ADR-0003`'s Open Questions). What this section does fix, as a semantic
matter — not deferred to schema design — is that (a) a split or combination must be traceable to what
the source Claims actually, mechanically entail, never to an unresolved interpretive question decided
for convenience, and (b) mixed strength within one combined Requirement is expected and valid, not an
error, as long as each clause's strength is independently correct per its own basis.

## Treatment of Claim Origin

`IntentSpec` Claims carry one of three origins — User-Provided, Inferred, Assumed
(`INTENT_SPEC.md`'s "Epistemic Model"). Requirement Derivation must preserve, not collapse, this
distinction when compiling a Claim into a Requirement. Doing so correctly requires keeping **four
conceptually independent properties** separate — none of them substitutes for, caps, or is derived
from another:

1. **Normative strength** (MUST/SHOULD/MAY/MUST NOT) — determined *solely* by the Claim's own force
   (obligation/prohibition/permission/preference), per "Force → Requirement Strength Mapping" below.
2. **Origin** (User-Provided/Inferred/Assumed) — which epistemic category the Claim belongs to in
   `IntentSpec`.
3. **Derivation confidence** (low/moderate/high) — a property of Inferred Claims specifically,
   describing how strongly the premises support the *conclusion*, per `INTENT_SPEC.md`'s Inference
   Policy — not how urgently the resulting Requirement should be treated.
4. **Provisional/reversible standing** — whether the Requirement may need reconsideration if
   corroborating information changes, per "Requirement Invalidation and Re-Derivation" below.

**Confidence and provisional standing are never converted into normative weakness.** An Inferred
Claim carrying obligation force at moderate confidence compiles to a **MUST**-level Requirement,
exactly as a User-Provided obligation would — moderate confidence does not, by itself, downgrade
that to SHOULD. Doing so would smuggle epistemic uncertainty into the normative axis, which is
exactly the confusion `INTENT_SPEC.md`'s I-22 (force, self-reported uncertainty, and discourse role
are independent axes, none collapsed into another) already forbids one stage earlier — this document
extends that same discipline to the origin/confidence axes at the Requirement level. What confidence
and origin *do* govern is separate from strength:

- **User-Provided Claims** are the primary basis for a Requirement. A Requirement derived from one
  preserves the Claim's force and conditions at their stated strength (see "Force → Strength Mapping"
  below) without adding or removing certainty.
- **Inferred Claims** may become the basis of a Requirement. The resulting Requirement's **strength
  is set by the Inferred Claim's own force**, the same as for a User-Provided Claim — it is **not**
  capped or weakened by `derivation_confidence`. What confidence governs instead: (a) whether
  Requirement Derivation chooses to derive a Requirement from this Inference *at all* — a low- or
  very weakly-grounded Inference may be judged too thin a basis to formalize into any Requirement yet,
  in which case it is carried forward as an open item instead, per "LOW/MEDIUM Open Items and
  Conflicts That Survive Into This Stage"; and (b) whether the resulting Requirement (whatever its
  strength) is marked provisional/reversible — lower confidence makes reconsideration more likely to
  be warranted, but does not itself change MUST to SHOULD. **Default:** an Inference-derived
  Requirement is marked provisional/reversible; Requirement Derivation may instead record it as
  settled only when it states why continued reconsideration isn't warranted (e.g. the same conclusion
  is independently corroborated by a separate, live User-Provided Claim) — silence is not that
  statement. Every Inference-derived Requirement, at
  whatever strength, carries a **distinct origin marker** — "derived from an Inference," never
  "user-stated" — and its confidence and premises remain recorded in provenance, visible to every
  downstream consumer, never conveyed solely through a weaker strength label (there is no such label
  to convey it through, since strength does not encode confidence). `INTENT_SPEC.md`'s I-16
  (repetition doesn't increase confidence) applies with equal force here: an Inference's confidence
  does not increase merely because Requirement Derivation finds it convenient to treat as settled.
- **Assumed Claims** are the narrowest, most provisional basis. `INTENT_SPEC.md` already restricts
  Assumptions to narrowly interpretive gaps, never operational defaults — so an Assumption-based
  Requirement should be rare. When one exists, its **strength still follows whatever force the
  assumed reading itself carries** (if the assumed content is something the system must do or avoid,
  the Requirement is MUST/MUST NOT-level) — Assumed origin does not by itself weaken MUST to SHOULD
  any more than Inferred origin does. What Assumed origin *does* require: the Requirement is marked
  **provisional and reversible**, carrying the Assumption's own gap, rationale, and scope forward, and
  must never be presented with the same standing as a User-Provided-derived Requirement.
  `INTENT_SPEC.md`'s I-02 ("an assumption cannot become a user-provided claim") has a direct analogue
  here: an Assumption-derived Requirement must never present itself as user-authorized — regardless of
  its strength.

In all three cases, **I-01/I-02's prohibition on provenance laundering carries forward unchanged**:
an Inference or Assumption can never be read back, at the Requirement level, as though the user had
stated it directly. This is the single most important failure mode this document exists to prevent,
matching `INTENT_SPEC.md`'s own framing of the equivalent rule one stage earlier. Provenance
laundering and strength inflation/deflation are two *different* failure modes — the first is about
misrepresenting *where* a Requirement came from, the second about misrepresenting *how strong* it is
— and neither one's fix should compromise the other: correctly labeling an Inferred MUST as
Inference-derived does not require, and must not produce, softening it to SHOULD.

### Requirement-Level Inference

Requirement Derivation is not purely mechanical; it is permitted to draw its own inferences — but
only about the **technical or operational implications of an already-accepted Claim or Requirement**,
never about **what the user meant**, which remains frozen to Intent Parsing. For example: a
User-Provided Claim carrying an obligation that the system "must run entirely offline" may support a
Requirement-Derivation-level inference that "the system shall make no outbound network calls to
third-party APIs at runtime" — this is a technical implication of an already-settled requirement, not
a new reading of the user's intent. Such an inference:

- must state its premise (which accepted Claim or Requirement it derives from) and its reasoning,
  the same discipline `INTENT_SPEC.md`'s Inference Policy requires of an Intent Parsing Inference;
- is its own, separate provenance layer — it is a Requirement Derivation inference, not an `IntentSpec`
  Inference, and must be labeled as such;
- must not smuggle in an interpretive judgment about intent under cover of a "technical" implication
  — if the implication actually depends on resolving what the user meant rather than what a
  requirement technically entails, it is out of bounds here and belongs to Intent Parsing (a new
  clarification or revision cycle), not to a Requirement Derivation inference.

**Operational test for the boundary:** a candidate Requirement-Level Inference is in bounds only when
its conclusion holds under *every* materially plausible reading still left open by the accepted
Claim and its attached Open Items — not merely under the reading Requirement Derivation finds most
natural or most common. If any surviving Ambiguity, Conflict, condition, hedge, or scope boundary
would change whether the conclusion holds, change its scope, or change its truth, the inference
depends on an unresolved interpretive question and is out of bounds — it belongs to a new Intent
Parsing pass, not to Requirement Derivation, however "plausible" or "obvious" the connection seems.
Domain convention, common usage, or "this plausibly covers X" is never, by itself, sufficient basis
for a Requirement-Level Inference.

**Strength and provisional standing of a Requirement-Level Inference (R-22):** because the operational
test above already requires the conclusion to hold under every materially plausible reading, a
Requirement-Level Inference is not an independent epistemic guess the way an `IntentSpec` Inference
is — it makes an already-settled Requirement's content explicit rather than introducing new normative
content of its own. Its **strength is therefore exactly the strength already established by the
Requirement or Claim it derives from** — never independently chosen, never strengthened, never
weakened — the same non-substitution discipline "Treatment of Claim Origin" applies to origin and
confidence. A Requirement-Derivation-level inference carries no `derivation_confidence` field of its
own (that field belongs to `IntentSpec` Inferences specifically); what it does carry, by default, is a
**provisional/reversible marking**, mirroring the Inferred-Claim default above — because the inference
remains subject to being found unsupported if a later reconsideration shows the premise doesn't
actually entail it (see "Requirement Identity and Versioning"'s re-derivation triggers, which already
name this case). Requirement Derivation may instead record it as settled only on the same basis
described for Inferred Claims: stating why continued reconsideration isn't warranted, not by silence.

### `MemoryContext` Is Not a Requirement-Level Inference Premise

A Requirement-Derivation-level inference's premise is, and remains, exactly what R-10 already
states: **an accepted `IntentSpec` Claim, or an already-derived Requirement** — never a
`MemoryContext` entry, directly. This is stated explicitly here because `ADR-0004` originally named a
direct `MemoryContext` premise at this mechanism as a future dependency ("dependency C"); after
`ADR-0004`'s dependency B was implemented (`INTENT_SPEC.md`'s "Memory-Derived Inference Premises"),
that direct path was re-derived against this section's own text and R-22's strength model, found
structurally incoherent, and retired rather than implemented — see `ADR-0004`'s "Post-Acceptance
Dependency B/C Disposition" for the full reasoning. Two independent reasons, either sufficient alone:

- **No source of normative strength.** R-22's strength model has exactly one source: "the Requirement
  or Claim it derives from." A `MemoryContext` entry is not a Claim and not a Requirement and carries
  no normative authority of its own (`MEMORY_CONTEXT.md`'s Purpose section) — there is nothing for
  R-22 to inherit strength from. Inventing a substitute strength source (from a historical
  statement's own force, from Brain's author-supplied confidence, or from any other property of the
  memory record) is not a narrower reading of R-22 — it is new normative-strength policy, exactly what
  "Historical Force Is Not Current Force" (`MEMORY_CONTEXT.md`'s M-20) already forbids one layer
  earlier and this section extends to the Requirement layer.
- **Requirement-Level Inference is never about intent.** The only `MemoryContext` entry class that can
  ever reach `SEMANTIC_PREMISE` standing at all is a **Category A historical-user statement**
  (`MEMORY_CONTEXT.md`'s Historical User Provenance Gate and Influence Taxonomy) — by definition, a
  record of what the user said or wanted in a past run. That is exactly the kind of content this
  section's own operational test already excludes: a Requirement-Level Inference may draw conclusions
  only "about the technical or operational implications of an already-accepted Claim or Requirement,
  never about what the user meant, which remains frozen to Intent Parsing." A `MemoryContext` entry
  cannot be a legitimate premise here for the same reason a fresh, un-vetted user statement couldn't
  be: both are intent-shaped content Requirement Derivation has no authority to incorporate directly,
  regardless of how it arrived.

**The legitimate path for historical-user memory to affect a Requirement already exists, unchanged:**
a qualified Category A `MemoryContext` entry becomes a current-run Inferred Claim at Intent Parsing
(`ADR-0004` dependency B), and Requirement Derivation then consumes that accepted Claim exactly as it
already consumes any other Inferred Claim — an ordinary Requirement compiled from it (R-03), or a
further Requirement-Level Inference drawing a technical implication from it (this section, premise =
the Claim, strength inherited from the Claim's own force, no new policy required). No second, direct
citation of the same historical memory at the Requirement level is needed or authorized merely because
the underlying record can be found again — see R-23.

**Non-historical technical memory (`pattern`/`incident`/`reference`) is excluded for an entirely
separate reason: memory is never Evidence.** Such an entry never reaches `SEMANTIC_PREMISE` at all,
"regardless of re-verification" (`MEMORY_CONTEXT.md`'s Identity Boundary) — only a wholly new,
independently-produced Evidence/`TechnologyCandidateSet` artifact can. A cached technical record is
therefore no more eligible as a Requirement-Level Inference premise than a historical user statement
is, for a different, independent reason.

This does not authorize Requirement Derivation to consume `MemoryContext` at all — `M0_SCOPE.md`'s
"Stage: Requirement Derivation" declares only `IntentSpec` as its input, and this section does not
change that. It exists solely to make explicit, and permanently close, the direct-premise path
`ADR-0004`'s dependency C once named, so that path is never silently reopened by treating "the memory
can be cited too" as a plausible reading of R-10.

## Force → Requirement Strength Mapping

`INTENT_SPEC.md`'s force axis (obligation / prohibition / permission / preference, with strength for
preference) maps to requirement strength as follows. This mapping is deliberately **one-directional
and non-inflationary** — a mapping preserves exactly the strength the Claim's own force stated, never
strengthening it, and — per "Treatment of Claim Origin" above — **never weakening it either on
account of origin or derivation confidence**. Origin and confidence govern provenance and
provisional/reversible marking, not strength; see R-03/R-04/R-06 below:

```text
obligation             → MUST / SHALL       (mandatory)
prohibition             → MUST NOT / SHALL NOT (mandatory negative)
permission              → MAY                (explicitly optional/permitted — never inflated to MUST)
preference (strong)     → SHOULD (high priority) — never MUST
preference (moderate)   → SHOULD             — never MUST
preference (weak)       → MAY / nice-to-have — never SHOULD, never MUST
force absent (descriptive) → no direct Requirement (see "What Must NOT Become a Requirement")
```

**Silently strengthening a preference into MUST is forbidden**, at any preference strength,
including a strong one — this is the direct continuation of `INTENT_SPEC.md`'s "Modality must not
drift" rule ("I want it to cost under $100/month" must not become an obligatory ceiling merely
because the underlying desire seems important). A permission must likewise never be inflated into an
obligation — "may retain logs for 30 days if legal approves" must become a **MAY**, conditioned on
approval, never a **MUST**. Strength maps *only* from the Claim's own force — never from origin
(User-Provided/Inferred/Assumed) or from derivation confidence. An Inferred or Assumed Claim carrying
obligation force still compiles to MUST, not a weaker strength "because the basis is weaker": origin
and confidence are separate axes, tracked in provenance (see "Treatment of Claim Origin" above), not
folded into the strength mapping. There is no such thing as a legitimate strength *downgrade* driven
by origin or confidence alone — only a legitimate decision not to derive a Requirement at all from a
sufficiently weak Inference (carrying it forward as an open item instead), which is a different
choice than deriving a weakened one.

A Claim with **no force** (purely descriptive) has no strength mapping at all, because it produces no
direct Requirement — see "What Must NOT Become a Requirement."

## Preservation of Conditions and Scope

A Claim carrying a `scope_condition` (`INTENT_SPEC.md`'s conditional-claim mechanism, e.g. "only use
cloud execution if local execution can't support the workload") must have that condition preserved
as a **formal, testable condition attached to the Requirement**, never collapsed into an
unconditional value, and never strengthened beyond the direction the Claim's own wording supports.
The correct compiled form is structurally conditional — "the system may use cloud execution, only if
[condition]" — not a flat, unconditional `cloud_execution = true` or `= false`, and **not** "if and
only if \[condition\]" either: "only if" states a necessary condition (cloud use implies the
condition held), not a biconditional (the condition holding does not itself assert that cloud use is
required or that no other response to the condition is possible). Requirement Derivation must
preserve a condition's stated direction exactly; manufacturing the unstated converse is the same
kind of unauthorized strengthening "Force → Requirement Strength Mapping" forbids for a preference
becoming a MUST. This directly continues `INTENT_SPEC.md`'s I-12 one stage later: if a condition was
preserved through `IntentSpec`, only to be flattened or logically strengthened away here, the
information loss `INTENT_SPEC.md` prevented at the interpretation stage would simply happen one
stage later instead, defeating the purpose of having prevented it at all.

Where the condition's own trigger is itself unresolved — a surviving Ambiguity about what "can't
support the workload" means quantitatively, or an Unknown — that unresolved trigger is a LOW/MEDIUM
Open Item carried forward exactly as described below. This does not block deriving the conditional
Requirement's *text* (the conditional structure itself is still recorded). It does block the
Requirement's own **Completeness**, per R-21: a Requirement whose satisfaction cannot be evaluated for
a given candidate without first resolving the trigger is not independently Complete, whether the
trigger is an Ambiguity (never eligible for R-21's INDETERMINATE branch, per condition 1) or an
Unknown lacking a closed, `IntentSpec`-grounded reading domain (condition 2). Derivability and
Completeness are two different questions; this section fixes only the former.

## LOW/MEDIUM Open Items and Conflicts That Survive Into This Stage

Because only an eligible `IntentSpec` is a valid input (see "Input Eligibility"), every Open Item and
Conflict Requirement Derivation encounters is, by construction, at most MEDIUM impact. Two
categorically different kinds of surviving item exist, and this document treats them differently —
this is the single most load-bearing distinction in this contract, directly extending the same split
`INTENT_SPEC.md`'s "Backward leakage" rule already draws:

- **A surviving Unknown (operational gap) — but not every Unknown is fillable.** An Unknown being
  the *kind of Open Item* that Requirement Derivation is structurally permitted to touch (as opposed
  to an Ambiguity or Conflict, never touchable here) does not, by itself, mean any given Unknown is
  actually fillable. **Semantic test (R-19):** Requirement Derivation may fill an Unknown with a
  working value only when the value selects an internal implementation, execution, or measurement
  detail *within* an already-settled Requirement — not when choosing among materially plausible
  values would add, remove, or narrow any user-facing actor, target, capability, output, condition,
  permission, prohibition, obligation, preference, or the boundary of a stated constraint itself.
  Calling a value "technical" or "operational" is not sufficient on its own — the test is whether a
  materially different choice would change what the Requirement actually covers, not what vocabulary
  describes the value. An Unknown that fails this test is, in substance, an intent-level or
  normative-authority question wearing an Unknown's shape — it must remain unresolved and carried
  forward exactly as an Ambiguity or Conflict would be, even though it is technically categorized as
  an Unknown in the source `IntentSpec`.

  **Note on terminology:** `INTENT_SPEC.md`'s Assumption Policy uses "technical or operational
  default" more broadly than R-19 does — there, the term marks anything Intent Parsing itself must
  not invent (competitor lists, cost scopes, capacity figures all appear as examples in that policy),
  contrasted with genuinely interpretive gaps Intent Parsing *may* resolve. That policy correctly
  leaves the question of *whether and how* to fill such a gap to "Requirement Derivation (or a later
  stage)" — it does not itself decide that every such gap is safely fillable *at this specific
  stage*. R-19 is the narrower test this document applies at that later decision point: some of
  `INTENT_SPEC.md`'s "operational defaults" (a cost-accounting boundary) turn out to be genuine
  internal parameters under R-19; others (a competitor list, which defines what the user's stated
  goal actually targets) turn out, on inspection, to be intent-scope questions despite the shared
  label — see Case 4 versus Case 10 in
  [REQUIREMENT_CASES](../examples/REQUIREMENT_CASES.md), which apply R-19 to opposite outcomes: R-19's
  fillability conclusion (may Requirement Derivation fill this Unknown at all) is independent of R-21's
  separate testability question (is a carried-forward-unresolved version of it still Complete) — Case
  4's own reasoning shows both a fillable Unknown and a testability-blocked carried-forward branch can
  coexist for the same Unknown, which is not a contradiction.
  Whether a named technology's negotiability is resolved is a canonical example of the *forbidden*
  kind under R-19 as well: resolving it directly decides the stated constraint's **exclusivity** —
  whether a substitute may satisfy it, or only the named technology itself may — which is a
  user-facing scope question, not an internal parameter, even though it never touches the constraint's
  normative **strength** (that is force's question alone, kept fully independent — see "User-Selected
  Technology" below). Negotiability can never be filled by Requirement Derivation at any confidence or
  convenience level, for that reason, regardless of whether the Claim's force separately resolved.

  Where filling genuinely *is* permitted under R-19, it remains Requirement Derivation's **choice**,
  not a default it must take, per `INTENT_SPEC.md`'s Assumption Policy ("For an operational gap that
  keeps the produced `IntentSpec` eligible \[LOW/MEDIUM impact\], it is Requirement Derivation's job
  \[...\] to decide whether and how to fill it"). If it fills the gap, the resulting Requirement's
  provenance must mark the value as **Requirement-Derivation-introduced** (per R-09, which is
  conditioned on R-19 — provenance marking never by itself makes an R-19-forbidden Unknown fillable),
  distinct from anything the user or Intent Parsing asserted, with its own stated rationale — never
  presented as though it traces to a User-Provided Claim. Requirement Derivation may instead choose
  **not** to fill a permitted-to-fill gap and carry the Unknown forward unresolved into
  `RequirementSpec` (as an explicit open item attached to whichever candidate Requirements depend on
  it) — both choices are valid for a genuinely technical/operational parameter; silently doing neither
  (dropping the Unknown without a Requirement or a carried-forward record) is not, and filling an
  Unknown the semantic test forbids is not, regardless of how the resulting Requirement is labeled.
- **A surviving Ambiguity or Conflict (interpretive gap).** Requirement Derivation **must not**
  resolve it, at any surviving impact level — this is not a judgment call the way filling an Unknown
  is. It must be carried forward into `RequirementSpec` as an explicit unresolved item, and any
  candidate Requirement whose content genuinely depends on which reading/side is correct must
  likewise remain unresolved rather than be derived against one reading chosen for convenience. This
  is what makes a `RequirementSpec` version **Partial** rather than **Complete** — see "Failure vs.
  Blocked/Partial Output Semantics" below.

## Conflicts and Unresolved Information

A Conflict recorded in the consumed `IntentSpec` (between two User-Provided Claims, or one involving
an Inferred/Assumed Claim not yet independently re-resolved by a later Intent Parsing pass) is
treated exactly as an interpretive Ambiguity is treated above: Requirement Derivation has no
authority to pick a side, regardless of the Conflict's Decision Impact level. Every Requirement that
would depend on one side of an unresolved Conflict must remain undecided rather than derived against
the side that seems more convenient, more technically sound, or more recently stated —
`INTENT_SPEC.md`'s Conflict Policy already forbids exactly this kind of implicit tiebreaking one
stage earlier ("not by recency, by confidence, by which seems more technically convenient"), and
nothing about being one stage removed from the original statement grants Requirement Derivation
authority the contract withheld from Intent Parsing itself.

## Requirement Identity and Versioning

Each Requirement carries a stable identity, persistent across `RequirementSpec` versions for as long
as the Requirement itself remains valid and unchanged (an unmodified Requirement carried forward into
a new `RequirementSpec` version keeps its identity; it is not treated as a newly-minted Requirement
merely because the surrounding version number changed). `RequirementSpec` itself participates in the
same versioned-supersession model every other M0 artifact uses (Principle 3;
`M0_SCOPE.md`'s "Stage Failure and Revision"): a `RequirementSpec` version is never edited in place.
A new version is produced when either:

- the source `IntentSpec` is superseded (see "IntentSpec Supersession Effects" below), or
- Requirement Derivation revises its own previously-derived content, without a new `IntentSpec`
  version necessarily existing (mirroring `INTENT_SPEC.md`'s Conflict Policy allowing an Inferred or
  Assumed Claim's conflict side to be revised by a later Intent Parsing pass without requiring a new
  `UserIdea`) — but only for one of these specific, recorded reasons, never an unexplained change of
  judgment or a stylistic rewrite:
  - new information supplies a value for a previously carried-forward Unknown;
  - a previously-filled Requirement-Derivation default is withdrawn or replaced, on a stated basis;
  - a Requirement-Level Inference is found unsupported, contradicted by its own premises, or
    superseded by a better-grounded one; or
  - a contract-conformance defect (e.g. a misclassified origin or an inflated strength) is discovered
    in a prior derivation and corrected.

  Every such version must record which of these triggered it, which Requirement(s)/Open Item(s) it
  affects, and why the change is a correction or update to Requirement Derivation's own prior work —
  not a reinterpretation of what the user meant, which would instead require a new `IntentSpec`
  version.

## IntentSpec Supersession Effects

When the `IntentSpec` version a `RequirementSpec` was derived from is superseded, every Requirement
whose provenance traces to a Claim that was itself dependent on now-superseded content must be
reconsidered in the new `RequirementSpec` version — not silently carried forward merely because its
text still reads plausibly. This directly mirrors `INTENT_SPEC.md`'s own rule for Inferences and
Assumptions surviving a `UserIdea` revision. Concretely:

- A Requirement whose originating Claim is **unchanged** in the new `IntentSpec` version (still
  present, still live, not superseded) may carry forward into the new `RequirementSpec` version
  unmodified, keeping its identity.
- A Requirement whose originating Claim was **superseded** (per `INTENT_SPEC.md`'s Revision and
  Version Semantics) must be reconsidered against whatever replaced it — this may produce a revised
  Requirement, an invalidated one, or an unchanged one if the replacement happens to support the same
  conclusion, but Requirement Derivation must not assume the last outcome without checking.
- A Requirement whose originating Claim was an **Inference or Assumption** that itself depended on
  now-superseded content must be re-examined even if the Requirement's own text was never directly
  about the changed content — the same transitive-invalidation caution `INTENT_SPEC.md`'s Inference
  Policy already states ("an inference is never stronger than its weakest premise").
- A Requirement supported by **multiple Claims where only some are superseded** must be reconsidered
  as a whole, not left standing on the assumption that its surviving Claims alone were always
  sufficient. It may keep its identity and content unchanged only if the remaining live Claims
  independently support that same content and strength; otherwise it must be revised or invalidated.
  The new version's provenance must name which basis was removed and which remains, so the
  reconsideration itself is auditable — not merely its outcome. (Which specific disposition —
  weakened, re-derived, or invalidated — is correct in a given case is genuinely case-dependent; see
  `ADR-0003`'s Open Questions. This bullet fixes only that reconsideration is mandatory and its basis
  must be recorded, not which of the three outcomes follows.)

## Requirement Invalidation and Re-Derivation

A Requirement becomes invalid — and must be marked as such in a new `RequirementSpec` version, never
silently deleted — when any of the following holds:

- its originating Claim was withdrawn or superseded without a replacement supporting the same
  Requirement;
- it was derived from an Inference or Assumption whose premise or rationale no longer holds after a
  supersession (see above);
- a newly-recorded Conflict (in a later `IntentSpec` version) now contradicts it.

An invalidated Requirement remains in the historical record of the `RequirementSpec` version where it
was valid — it is not deleted retroactively — consistent with Principle 11 (Reproducibility) and the
same historical-integrity discipline `INTENT_SPEC.md`'s I-13 already requires of `IntentSpec` itself.

## Failure vs. Blocked/Partial Output Semantics

Requirement Derivation, like every M0 stage, may report that it cannot produce its declared output
instead of forcing one (`M0_SCOPE.md`'s "Cross-Cutting: Stage Failure and Revision"). `RequirementSpec`
defines three distinct outcomes for a single Requirement Derivation run against one eligible
`IntentSpec` version — this is a genuinely new distinction, not a restatement of `IntentSpec`'s
Blocked/Failed pair, because the two stages face a different problem: `IntentSpec`'s Blocked/Failed
choice gates whether *the next stage* may run at all; `RequirementSpec`'s choice below describes the
completeness of *this stage's own* output, given that it was already authorized to run (its input was
eligible):

- **Complete.** Every Claim in the consumed `IntentSpec` that carries derivable content either became
  one or more Requirements, or was explicitly excluded with a stated reason (descriptive, no force;
  redundant with an existing Requirement; etc.) — **and every derived Requirement supplies or
  authorizes a SATISFIED/NOT_SATISFIED/INDETERMINATE satisfaction procedure an evaluator can apply
  without inventing one itself** (per R-21). Completeness has two distinct ways to fail, not one:
  (a) *interpretive* blockage — a surviving Ambiguity or Conflict prevents deriving a candidate
  Requirement at all (see "LOW/MEDIUM Open Items and Conflicts" above); and (b) *testability*
  blockage — a Requirement was derived, but its own recorded content supplies no metric, comparator,
  or procedure at all — not even one with an INDETERMINATE branch — so an evaluator would have to
  invent the test itself rather than merely apply one. Both make the affected area Partial, not
  Complete, even though only (a) involves an Ambiguity/Conflict in the formal sense — (b) can be
  triggered by an Unknown, or by a Claim whose own force never resolved (R-20). A Complete
  `RequirementSpec` may still carry forward an unresolved LOW/MEDIUM Unknown that a fully-specified
  satisfaction procedure already routes to INDETERMINATE — but only where that Unknown's own admissible
  reading domain is itself explicit, closed, and grounded in the consumed `IntentSpec`'s recorded
  content, per R-21's two conditions; an Unknown whose readings Requirement Derivation would have to
  invent or partition itself does not qualify, and neither does an Ambiguity or Conflict under any
  circumstance (R-21 condition 1) — both remain testability blockage, not a legitimate INDETERMINATE
  routing. Where the routing is legitimate, it does not block testability, because the procedure itself
  is still complete and content-derived; "Complete" describes the absence of *both* kinds of blockage,
  not the absence of every open question, and never depends on how many candidates a surviving Unknown
  actually affects.
- **Partial.** At least one Requirement that could otherwise be derived instead remains explicitly
  unresolved — because it depends on a surviving Ambiguity or Conflict Requirement Derivation has no
  authority to resolve, because a value it materially depends on for testability is wholly unresolved
  (see "Complete" above), or because its own force never resolved to an assignable strength (R-20). A
  Partial `RequirementSpec` is still a valid, versioned, usable artifact — every Requirement that
  *could* be derived independently of the blocked area is derived normally; the blocked area is
  recorded as an explicit open item (or an unresolved constraint-candidate, for the R-20 case), not
  silently dropped and not silently guessed into a false appearance of testability. Downstream stages
  must treat a Partial `RequirementSpec`'s open items as a signal that a revision cycle is needed
  before that specific area can be compiled — but *which* revision cycle depends on what kind of gap
  is blocking it, not always the same one: an unresolved Ambiguity or Conflict, or an R-20 unresolved
  force, can only be closed by a new `IntentSpec` clarification/correction (Requirement Derivation has
  no authority over either); an R-19-eligible Unknown that Requirement Derivation chose to carry
  forward unfilled, by contrast, can be closed by Requirement Derivation itself filling it in a later
  `RequirementSpec` version, with no new `IntentSpec` version required (see "Requirement Identity and
  Versioning"). The mechanics of triggering either revision are deferred, per `M0_SCOPE.md`, to
  implementation, not fixed here.
- **Failed.** Reserved for a narrower and different situation than "nothing to derive": Requirement
  Derivation cannot even attempt honest compilation because the consumed `IntentSpec`, despite having
  passed `IntentSpec`'s own eligibility gate, is internally malformed in a way that blocks processing
  entirely — e.g. a Requirement's would-be basis cites a Claim or Open Item ID that does not resolve
  within the consumed version, or the version's own recorded structure is otherwise inconsistent with
  `INTENT_SPEC.md`'s invariants. This should not occur if upstream validation worked, but Requirement
  Derivation still needs a defined response rather than silently guessing past the defect. Failed is
  **not** what happens when the input is well-formed but simply supports no formal Requirements — that
  case, however requirement-empty it looks, is a valid **Complete** output (see "Complete" above and
  Case 17 in [REQUIREMENT_CASES](../examples/REQUIREMENT_CASES.md)). The distinction is one of *kind*,
  not degree: Complete-with-zero-Requirements means "I examined a well-formed input and honestly found
  nothing to derive"; Failed means "I cannot even examine this input the way this contract requires."

A Partial `RequirementSpec` is not itself the same thing as a Blocked `IntentSpec` — it is a
successfully-produced, versioned artifact, not a permanently non-consumable one, which is a
deliberate difference from `IntentSpec`'s stricter Blocked-means-fully-non-consumable rule: `IntentSpec`'s
HIGH/CRITICAL gate protects against compiling on top of a *decision-critical* gap; a surviving
*interpretive* MEDIUM/LOW gap at the Requirement Derivation stage is, by construction (it survived
`IntentSpec`'s own HIGH/CRITICAL gate), not decision-critical in that same sense. This document does
not, however, go further and authorize *how* a downstream stage may consume a Partial `RequirementSpec`
— whether it may proceed on the Complete portion alone, must wait for full resolution, or something
else is that downstream stage's own contract to define (see `ADR-0003`'s Open Questions). What this
document fixes is only that a Partial artifact is well-formed and valid to produce, with its Complete
and unresolved portions clearly and separately marked — not that consuming the Complete portion in
isolation is already authorized.

## Information-Loss Rules

Requirement Derivation is allowed to be lossy only by explicit, statable design — never by accident,
extending `INTENT_SPEC.md`'s own framing of this rule one stage later:

> Meaningful requirement content must not disappear silently between `IntentSpec` and
> `RequirementSpec`.

- **Negation survives.** A prohibition Claim must produce a MUST NOT / SHALL NOT Requirement — never
  softened into an absent constraint or reframed as a mere absence of a positive Requirement.
- **Conditions survive as conditions**, per "Preservation of Conditions and Scope" above — never
  collapsed into an unconditional value.
- **Force must not drift.** A preference (at any stated strength) must never become MUST; a
  permission must never become MUST or SHOULD; an obligation must never be softened into SHOULD
  merely because Requirement Derivation judges it infeasible — feasibility is a downstream concern
  (Technology Candidate Identification, Architecture Synthesis), not something that retroactively
  changes a Requirement's stated strength.
- **A user-named technology is never silently dropped** — it survives as a strength-bearing stated
  constraint only if its Claim's own force resolved, or otherwise as an unresolved
  constraint-candidate carried forward per R-20 — in neither case as an evaluated or endorsed choice —
  see "User-Selected Technology" below.
- **Origin survives**, per "Treatment of Claim Origin" above — collapsing a User-Provided, Inferred,
  and Assumed basis into indistinguishable Requirements is exactly the provenance-laundering failure
  this document exists to prevent.

## Architecture and Technology Leakage Prohibitions

`RequirementSpec` must contain no architecture or technology **evaluation, comparison, or
selection** — this is the direct continuation of `INTENT_SPEC.md`'s "No Architecture Leakage"
principle, now applied to the next stage down:

### User-Selected Technology

If the user explicitly named a technology, `IntentSpec` preserves this as "user explicitly requested
X," per `INTENT_SPEC.md`'s No Architecture Leakage rule. What `RequirementSpec` does with it next
depends on whether the Claim's own **force** actually resolved to one of the four categories
(obligation/prohibition/permission/preference) — this is not automatic just because a technology was
named:

- **If force resolved** (e.g. the user stated a clear preference or requirement for the technology),
  `RequirementSpec` preserves it as a **stated constraint** at that strength — "the system SHALL use
  PostgreSQL, per explicit user request" for an obligation, "the system SHOULD use PostgreSQL" for a
  preference — exactly mirroring "Force → Strength Mapping" above. Whether *alternatives* would also
  be acceptable (negotiability) is a separate question from whether *this* strength is correct: if
  negotiability is itself an unresolved Unknown, it is carried forward attached to the Requirement,
  never filled (per R-19 — resolving whether the constraint is **exclusive to this option** or
  **substitutable** is exactly the forbidden kind of Unknown), but does not by itself change the
  Requirement's own already-resolved strength: negotiability governs exclusivity/substitutability
  semantics only, never the constraint's binding strength.
- **If force did not resolve** — the wording is a direct, unhedged statement of method that Intent
  Parsing correctly declined to categorize as obligation, prohibition, permission, or preference (see
  `INTENT_CASES.md` Case 7 for the worked example this pattern comes from) — `RequirementSpec` **must
  not manufacture a strength merely to produce a testable Requirement** (per R-20). Assigning MUST
  because the wording is unhedged, or SHOULD because that feels like a safer middle ground, are both
  unauthorized interpretive choices: neither is what the force axis actually settled, and choosing
  either is itself an implicit resolution of the very question (is this binding?) that remains open.
  In this case, `RequirementSpec` preserves the named-technology statement verbatim as an **unresolved
  constraint-candidate** — the fact that the user named it is recorded and carried forward — without
  assigning it MUST, SHOULD, or MAY. This makes the affected portion of `RequirementSpec` **Partial**,
  not Complete (per R-21 and "Failure vs. Blocked/Partial Output Semantics" below): the
  constraint-candidate cannot yet be evaluated as satisfied or not by a candidate architecture,
  because its own binding strength is unresolved, not merely its scope.

In neither case does `RequirementSpec` evaluate, endorse, or determine the named technology's
suitability, compare it to alternatives, or decide whether it is technically appropriate for the
stated goal — that evaluation belongs to Technology Candidate Identification and Architecture
Synthesis, informed by `EvidenceBundle`, governed by Principle 2 (Evidence Before Recommendation).

Force and negotiability remain independent axes here exactly as they do above, and each is revisited
only by the kind of Intent Parsing pass that actually resolves *it*, not by either resolving the
other: a new `IntentSpec` version that resolves the Claim's **force** is what may cause the
Requirement's **strength** to be revisited (per "Requirement Identity and Versioning") — a
negotiability resolution, by itself, does not. A new `IntentSpec` version that resolves
**negotiability** instead changes only the Requirement's recorded **exclusivity/substitutability**
semantics (e.g. from "negotiability unresolved" to "no substitute acceptable" or to "a substitute
satisfying the same criteria is acceptable") — it does not, by itself, revise the strength a prior
force resolution already settled, and it does not retroactively resolve force for a Claim whose force
never resolved in the first place (that still requires its own, separate force-resolving Intent
Parsing pass, per R-20). Resolving one of the two never automatically resolves or revises the other.

### Common Violations

- **Forward leakage** (Requirement Derivation overreaching into architecture): compiling "the system
  shall run locally" into a specific deployment topology, container strategy, or hosting provider;
  compiling a named technology mention into an endorsement of its suitability; inventing a
  requirement for a specific framework, library, or infrastructure pattern the `IntentSpec` never
  supports.
- **Backward leakage** (Requirement Derivation overreaching into intent): reinterpreting what a
  Claim meant once `IntentSpec` recorded it; resolving an Ambiguity or Conflict `IntentSpec` left
  open (see "What Must NOT Become a Requirement" and "Conflicts and Unresolved Information" above);
  treating a Claim's mere presence as license to decide its truth, feasibility, or priority beyond
  what its own force and Decision Impact already established.

## Deterministic Invariants

- **R-01** A Requirement with zero Claim/Open-Item provenance references is malformed — every
  Requirement traces to at least one specific item in the consumed `IntentSpec` version.
- **R-02** A descriptive Claim (force absent) never becomes a Requirement's normative content by
  itself; it may only serve as rationale attached to a Requirement derived from a different,
  force-bearing Claim.
- **R-03** An Inferred-Claim-derived Requirement's strength is set by the Inferred Claim's own force,
  exactly as for a User-Provided Claim — never capped, weakened, or otherwise adjusted by
  `derivation_confidence`. It carries a distinct origin marker and its confidence/premises in
  provenance; it is never presented as User-Provided. (Consistent with R-06: an Inferred obligation
  is still at least MUST.)
- **R-04** An Assumed-Claim-derived Requirement's strength is set by the assumed content's own force,
  the same way; Assumed origin requires the Requirement be marked provisional/reversible, not that
  its strength be weakened. It is never presented with User-Provided standing.
- **R-05** A preference, at any strength, never maps to MUST/SHALL. A permission never maps to
  MUST/SHALL or SHOULD.
- **R-06** An obligation never maps to a weaker strength than MUST/SHALL; a prohibition never maps to
  a weaker strength than MUST NOT/SHALL NOT.
- **R-07** A `scope_condition` on a Claim is preserved as a formal condition on the derived
  Requirement(s); it is never flattened into an unconditional value, and its stated direction (e.g.
  "only if") is never strengthened into a biconditional ("if and only if") the Claim's own wording
  did not support.
- **R-08** Requirement Derivation never resolves an Ambiguity or Conflict surviving in the consumed
  `IntentSpec`, at any Decision Impact level — interpretive authority remains exclusively Intent
  Parsing's.
- **R-09** *Subject to R-19's eligibility test* — provenance marking never by itself makes an
  R-19-forbidden Unknown fillable — Requirement Derivation may fill an eligible surviving Unknown
  with a working default only when doing so is marked as Requirement-Derivation-introduced, with its
  own stated rationale, distinct from any `IntentSpec`-recorded provenance.
- **R-10** A Requirement-Derivation-level inference states its premise (the accepted Claim or
  Requirement it derives from) and reasoning, and is labeled as a Requirement Derivation inference,
  never folded into or presented as an `IntentSpec` Inference. Its strength and provisional standing
  are governed separately, by R-22.
- **R-11** `RequirementSpec` never contains a technology or architecture evaluation, comparison, or
  selection — a user-named technology may appear only as a preserved constraint, never as an endorsed
  or evaluated choice.
- **R-12** A Requirement's identity persists across `RequirementSpec` versions for as long as it
  remains valid and unmodified; revision supersedes rather than mutates a `RequirementSpec` version in
  place.
- **R-13** When the source `IntentSpec` is superseded, every Requirement whose provenance traces
  (directly or transitively, through an Inference or Assumption) to now-superseded content must be
  reconsidered in the new `RequirementSpec` version, not silently carried forward.
- **R-14** An invalidated Requirement is marked invalid in a new version, never deleted from the
  historical record.
- **R-15** One Claim may produce zero, one, or multiple Requirements; one Requirement may be
  supported by multiple Claims. Neither cardinality is fixed or assumed.
- **R-16** A `RequirementSpec` version's Complete/Partial/Failed status is a distinct property from
  any individual Requirement's own validity — a Complete version may still carry forward unresolved
  LOW/MEDIUM Unknowns; a Partial version still contains fully-derived Requirements alongside its
  unresolved area.
- **R-17** An empty Requirement set, when the consumed `IntentSpec` genuinely supports no formal
  Requirements, is a valid Complete output — not a Failure.
- **R-18** Confidence, strength, or certainty in a derived Requirement never increases merely because
  the same underlying Claim was repeated, paraphrased, or agreed on across multiple `IntentSpec`
  versions — mirroring `INTENT_SPEC.md`'s I-16 one stage later.
- **R-19** Requirement Derivation may fill a surviving Unknown only when the value selects an
  internal implementation, execution, or measurement detail *within* an already-settled Requirement
  — not when choosing among materially plausible values would add, remove, or narrow any user-facing
  actor, target, capability, output, condition, permission, prohibition, obligation, preference, or
  the boundary of a stated constraint itself. Labeling a value "technical," "operational," or
  "accounting" is not sufficient by itself — the test is whether a materially different choice would
  change what the requirement actually covers or requires, not what vocabulary describes the value.
  **"Would change what the requirement covers" does not mean "some candidate's pass/fail verdict could
  change"** — nearly any genuine measurement-detail fill differentiates some candidates, by definition
  of being a real parameter, so that alone cannot be the test without making this fillable branch
  vacuous. The operative question is narrower: does the fill change what the Requirement itself
  *asserts* — its stated threshold, its target, its actor, its capability — or only how compliance
  with an already-fixed assertion gets *computed*. A fill that leaves the stated threshold or target
  unchanged and only settles how the compared quantity is measured is fillable; a fill that would
  change the threshold, target, actor, or capability itself is not (see Case 4 versus Case 10 in
  [REQUIREMENT_CASES](../examples/REQUIREMENT_CASES.md) for this exact contrast worked through). An
  Unknown that fails this test must remain unresolved and carried forward, exactly as an Ambiguity
  or Conflict would be, regardless of its Unknown/Ambiguity classification in the source `IntentSpec`.
- **R-20** A Claim that asserts binding or constraining content — the user is stating a method,
  requirement, or means, not merely describing a fact — but whose own force does not resolve to one
  of obligation/prohibition/permission/preference, must not be assigned a Requirement strength by
  Requirement Derivation choosing one on its behalf; it is preserved as an unresolved
  constraint-candidate, and the portion of `RequirementSpec` depending on it is Partial, not Complete,
  until a new Intent Parsing pass resolves the force. **R-20 does not apply to a genuinely
  force-absent descriptive Claim** ("we have five engineers," "we currently use spreadsheets") —
  those are governed by R-02 instead (no Requirement derived at all, Complete either way per R-17):
  a Claim with nothing normative being asserted is a different case from a Claim asserting something
  binding whose normative category just wasn't settled.
- **R-21** A Requirement is genuinely Complete only if its own recorded content supplies, or
  explicitly authorizes, a **satisfaction procedure** — a fixed rule, fully determined by the
  Requirement's own recorded content, that a downstream evaluator can apply to **one candidate at a
  time, considered entirely on its own**, without inventing the metric, comparator, threshold, or
  scope itself. Completeness is a property of the Requirement's own recorded content alone, decidable
  at authoring time — **before any candidate exists to evaluate** — and must never be defined by
  appeal to what a future candidate population happens to look like (not "the overwhelming majority of
  candidates," not "a narrow boundary zone," not any other claim about how many real candidates would
  land where). A test phrased in terms of a candidate population is not decidable from the Requirement
  alone and is therefore not this test.

  The satisfaction procedure a Complete Requirement supplies or authorizes returns exactly one of
  three outcomes for any given candidate: **SATISFIED**, **NOT_SATISFIED**, or **INDETERMINATE**.
  INDETERMINATE is a legitimate, first-class outcome of a Complete Requirement's own procedure — not a
  symptom of Partial status by itself — but **only under two conditions held simultaneously, both
  required, neither sufficient alone**:

  1. **The open item routing a candidate to INDETERMINATE must be a surviving Unknown — never an
     Ambiguity or Conflict.** A surviving Ambiguity or Conflict touching a Requirement's content
     already has its own, separate, absolute rule (R-08, and "LOW/MEDIUM Open Items and Conflicts
     That Survive Into This Stage" above): Requirement Derivation has no authority to resolve it, at
     any impact level, and any Requirement whose content genuinely depends on it must remain
     unresolved, making that area Partial — full stop, with no exception for routing it through an
     otherwise-complete procedure's INDETERMINATE branch instead. Treating an Ambiguity or Conflict as
     merely another INDETERMINATE-triggering condition would let R-21 relabel a forbidden interpretive
     resolution as a permitted testability nuance — it would not actually resolve the Ambiguity or
     Conflict, but it would launder an interpretively-blocked Requirement into looking Complete, which
     is exactly the outcome "LOW/MEDIUM Open Items and Conflicts" forbids. Only a surviving **Unknown**
     — the *kind* of open item Requirement Derivation is structurally permitted to touch at all, per
     R-19 — may ever route a candidate to INDETERMINATE.
  2. **The Unknown's admissible set of readings must itself be explicit, closed, and grounded in the
     consumed `IntentSpec`'s own recorded content — never invented or partitioned by Requirement
     Derivation to make a procedure work.** An Unknown is, by `INTENT_SPEC.md`'s own definition, a
     genuine gap — nothing in the wording addresses it — which means an Unknown does not, in general,
     arrive with a recorded set of candidate readings the way an Ambiguity does (an Ambiguity's
     multiple readings come from specific wording that generates them). Constructing a closed
     two-or-more-reading domain for an Unknown that was never actually recorded that way is itself an
     act of inventing scope — exactly what this invariant's first sentence already forbids. This
     branch is therefore legitimately available only for the narrow case where the `IntentSpec`
     itself — not Requirement Derivation's own judgment — already closes the domain (e.g. the
     `IntentSpec` records the gap as being among a small, explicitly enumerated set of named
     options). An open-ended Unknown ("what's included?", with no enumerated candidate set recorded
     anywhere) does not qualify, however natural a two-way split might seem to Requirement Derivation
     in hindsight.

  Even where both conditions hold, the procedure must still be **faithful and maximally determinate**,
  not merely well-typed: a procedure that returns one of the three labels is not, by itself,
  sufficient — for a candidate where every recorded reading of the grounded Unknown agrees on the same
  verdict, the procedure **must** return that verdict (SATISFIED or NOT_SATISFIED), never
  INDETERMINATE; INDETERMINATE may be returned only for a candidate where the readings genuinely
  disagree — i.e. where the Unknown's eventual resolution would actually change *that specific
  candidate's* verdict. A procedure that returns INDETERMINATE regardless of whether the readings
  agree (e.g. "always INDETERMINATE, because the Unknown remains open") is not a satisfaction
  procedure under this invariant at all — it never applies the Requirement's own recorded content, and
  does not make the Requirement Complete. This faithfulness test is itself intrinsic and per-candidate,
  not a population claim: it asks whether the procedure's output for *this* candidate matches what
  *this* candidate's own recorded facts, read under every recorded reading, actually say — never how
  many other candidates would be affected. What makes a Requirement genuinely Complete is that the
  *procedure itself*, including exactly which recorded, grounded Unknown routes a candidate to
  INDETERMINATE and why, and satisfying the faithfulness test above, is fully specified by the
  Requirement's own recorded content — so an evaluator never has to invent that routing rule, only
  apply it. Because a genuinely closed, `IntentSpec`-grounded reading domain for an Unknown is
  unusual (most surviving Unknowns are open-ended gaps, not enumerated option sets), a legitimate
  three-valued Complete Requirement is expected to be the rarer case, not the default fallback for
  every unresolved-but-metric-bearing Requirement — see Case 4 in
  [REQUIREMENT_CASES](../examples/REQUIREMENT_CASES.md) for a worked example of exactly this boundary:
  its cost-category Unknown does *not* meet condition 2, and its carried-forward-unresolved branch is
  Partial as a result, even though a $100/month threshold is recorded.

  A Requirement is **Partial** (testability-blocked) when no such faithful, properly-grounded
  procedure — not even one with an INDETERMINATE branch — can be written down from its own recorded
  content: either because it supplies no metric, comparator, or procedure at all (e.g. "fast," or
  "minimize exposure generally," with no stated number, benchmark, or comparator anywhere to route
  *any* candidate, in *any* branch), or because its only route to a three-valued procedure would
  require inventing a reading domain the `IntentSpec` never actually recorded (condition 2 above), or
  because the open item blocking it is an Ambiguity or Conflict rather than an Unknown at all
  (condition 1 above). The test is binary and content-only: either the Requirement's own recorded
  content is sufficient to fully specify a faithful, properly-grounded
  SATISFIED/NOT_SATISFIED/INDETERMINATE procedure, or a plain two-valued one (Complete), or it is not
  (Partial) — never a question of how many real-world candidates would fall into which branch.
- **R-22** A Requirement-Derivation-level inference's strength is exactly the strength already
  established by the Requirement or Claim it derives from — never independently chosen, strengthened,
  or weakened — because the operational test governing such an inference already requires it to hold
  under every materially plausible reading. It carries no `derivation_confidence` of its own (that
  field belongs to `IntentSpec` Inferences) and is marked provisional/reversible by default, unless
  Requirement Derivation states why continued reconsideration isn't warranted.
- **R-23** A Requirement-Derivation-level inference's premise is only an accepted `IntentSpec` Claim
  or an already-derived Requirement — never a `MemoryContext` entry, directly, regardless of the
  entry's own classification or category. Historical-user semantic content that legitimately affects
  a Requirement must first become a current-run Inferred Claim through `ADR-0004` dependency B (Intent
  Parsing); Requirement Derivation then draws on that accepted Claim under its own ordinary R-03/R-10
  authority, never on the `MemoryContext` entry a second time. Technical memory
  (`pattern`/`incident`/`reference`) remains excluded independently, because memory is never Evidence.

## Examples

- Claim: "I don't want my source code leaving my computer" (User-Provided, prohibition) → Requirement:
  "The system MUST NOT transmit source code outside the user's designated execution boundary,"
  condition/scope carried from the Claim's own unresolved boundary Ambiguity as an attached open
  item (see Case 2 in
  [REQUIREMENT_CASES](../examples/REQUIREMENT_CASES.md)).
- Claim: "I want it to cost under $100/month" (User-Provided, preference, strong) → Requirement: "The
  system SHOULD cost under $100/month (high-priority preference)" — never "MUST cost under
  $100/month."
- Claim: "May we retain logs for 30 days if legal approves?" (User-Provided, permission, condition =
  legal approval) → Requirement: "The system MAY retain logs for up to 30 days, conditioned on legal
  approval" — never "MUST retain logs for 30 days."
- Claim: "We have five engineers" (User-Provided, force absent, descriptive) → no Requirement derived
  directly; may be recorded as rationale for a separately-derived operational-simplicity preference
  Requirement, if one exists.
- Inferred Claim: "the user appears to have a data-locality or privacy constraint" (force =
  preference, moderate confidence, premise = the source-code prohibition above) → Requirement:
  "The system SHOULD minimize data-locality exposure generally" — SHOULD *because the Inferred
  Claim's own force is a preference*, not because moderate confidence capped a stronger force down.
  Explicitly marked as Inference-derived with its confidence recorded — never presented as though the
  user directly stated a general data-locality requirement.
- Inferred Claim carrying **obligation** force at moderate confidence (contrast the previous example)
  → still a **MUST**-level Requirement, marked Inference-derived and provisional, moderate confidence
  recorded in provenance — moderate confidence does not downgrade it to SHOULD (see Case 7 in
  [REQUIREMENT_CASES](../examples/REQUIREMENT_CASES.md)).

## Anti-Examples

- Compiling "we have five engineers" directly into a Requirement about team size or process. (Violates
  R-02.)
- Compiling an Inferred Claim into a Requirement without marking its Inference origin, so it reads as
  though the user stated it directly. (Violates R-03.) Equally a violation in the other direction:
  weakening an Inferred Claim's obligation force to a SHOULD-level Requirement *because* its
  confidence is only moderate — confidence governs whether to derive a Requirement at all and whether
  to mark it provisional, not its strength. (Also violates R-03, and R-06 if the resulting strength
  falls below MUST/SHALL.)
- Resolving a surviving MEDIUM Ambiguity about environment scope by picking "production only" because
  it is the more common case, then deriving a Requirement against that reading. (Violates R-08.)
- Compiling "I want it to cost under $100/month" into "the system MUST cost under $100/month."
  (Violates R-05.)
- Compiling "may retain logs for 30 days if legal approves" into an unconditional "the system MUST
  retain logs for 30 days," dropping both the permission-not-obligation force and the legal-approval
  condition. (Violates R-05, R-07.)
- Compiling "only use cloud execution if local execution can't support the workload" into an
  unconditional `cloud_execution = true` or `= false`. (Violates R-07.)
- Deriving "the system shall use a microservices architecture with a message queue" from "I want it
  to feel fast and modern," where nothing in the `IntentSpec` names an architecture at all. (Violates
  R-11 — architecture leakage from an under-specified qualitative preference; R-01 alone would not
  catch this, since the Requirement could still cite the "fast and modern" Claim as a bare provenance
  reference despite bearing no real semantic relationship to it.)
- Silently dropping a Requirement whose originating Claim was superseded, instead of marking it
  invalid in a new version. (Violates R-14.)
- Treating a user-named technology's presence as an endorsement of its technical fit for the stated
  goal, or omitting a competing named technology because Requirement Derivation judges it
  "obviously" the wrong choice. (Violates R-11.)
- Citing a Category A `MemoryContext` entry directly as the premise of a Requirement-Level Inference
  ("the system SHOULD use PostgreSQL, per a historical `MemoryContext` entry"), rather than via an
  already-accepted `IntentSpec` Claim that entry produced through Intent Parsing's own dependency-B
  path. (Violates R-23.) Equally a violation: deriving that Requirement's strength from the memory
  entry's own Brain confidence or the historical statement's own force, rather than from an accepted
  Claim's force. (Violates R-22/R-23 together.)
