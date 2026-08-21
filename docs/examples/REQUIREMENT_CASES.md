# Requirement Semantic Test Corpus

A worked-example corpus for [REQUIREMENT_SPEC](../contracts/REQUIREMENT_SPEC.md), intended as the
basis for future contract validation / evaluation tests once schema design happens — the same role
[INTENT_CASES](./INTENT_CASES.md) plays for [INTENT_SPEC](../contracts/INTENT_SPEC.md). Each case
starts from an **eligible `IntentSpec`** (never a Blocked one — Requirement Derivation never
receives one, per `REQUIREMENT_SPEC.md`'s Input Eligibility) and applies the compilation model
defined there: origin preservation, non-inflationary force → strength mapping, condition
preservation, and the Complete/Partial/Failed output model. No schema or field names are implied by
the formatting below; it is a readable worked form, not a serialization.

Several cases reuse a scenario already worked through in `INTENT_CASES.md`, picking up from its
recorded `IntentSpec` semantics rather than the original `UserIdea` text — this document does not
re-derive intent; it starts from intent already accepted.

---

## 1. Direct obligation

**Source IntentSpec semantics:** Claim, origin = User-Provided, force = obligation ("I need approval
before any deployment" — reusing `INTENT_CASES.md` Case 13's underlying statement, now taken as if
the self-directed-vs-system-enforced Ambiguity had already been resolved by a revision to
"system-enforced," leaving only the MEDIUM environment-scope Ambiguity unresolved on this eligible
version).

**Defensible RequirementSpec result:** Requirement: "The system MUST enforce an approval gate before
deployment; the scope of 'deployment' (which environments) is an unresolved, carried-forward Open
Item, not yet 'all environments' or 'production only.'" Force mapped directly (obligation → MUST) at
full strength, since the basis is a plain User-Provided Claim with no weaker origin to cap it — but
the Requirement's own text must not assert a specific coverage ("any deployment," "all
environments") that the surviving Ambiguity has not actually settled; asserting the broadest reading
would itself be silently resolving that Ambiguity.

**Prohibited transformations:** Compiling the Requirement as "before *any* deployment" or "before
*all* deployments" — either phrasing asserts the broadest environment-scope reading instead of
carrying the surviving Ambiguity forward, which is exactly the backward-leakage error this case
exists to test; inventing a specific approval mechanism (CI gate, two-person rule, manual sign-off)
— that is architecture leakage, not Requirement Derivation's to decide.

**Provenance expectations:** Requirement traces to the single obligation Claim; the surviving
environment-scope Ambiguity is carried forward as its own unresolved item, referenced by this
Requirement as a dependency, not silently folded into the Requirement's text.

**Eligibility:** Partial — the approval-gate Requirement itself derives cleanly (Complete for that
Requirement), but the environment-scope Ambiguity means the *coverage* of that Requirement (which
environments) remains open, making the overall `RequirementSpec` version Partial rather than fully
Complete.

---

## 2. Prohibition

**Source IntentSpec semantics:** Claim, origin = User-Provided, force = prohibition ("I don't want my
source code leaving my computer" — `INTENT_CASES.md` Case 4), with its own surviving CRITICAL
Ambiguity about the boundary of "my computer." (Note: as recorded in `INTENT_CASES.md`, this specific
Ambiguity is CRITICAL, which would make the *source* `IntentSpec` Blocked — for this case to be a
valid Requirement Derivation input at all, assume a revision has narrowed the boundary Ambiguity down
to a surviving MEDIUM residual, e.g. "network-attached storage the user personally controls" left
genuinely open after the device-vs.-network core question was resolved.)

**Defensible RequirementSpec result:** Requirement: "The system MUST NOT transmit source code outside
the user's designated execution boundary." Force mapped directly (prohibition → MUST NOT).

**Prohibited transformations:** Softening the prohibition into a preference ("should avoid
transmitting..."); silently resolving the residual boundary Ambiguity by picking the most permissive
or most restrictive reading; compiling this into a specific technical mechanism (e.g. "MUST run
entirely air-gapped") that the Claim's own wording doesn't support.

**Provenance expectations:** Traces to the prohibition Claim; the residual boundary Ambiguity is
carried forward, attached to this Requirement as an open scoping question, not resolved.

**Eligibility:** Partial — the prohibition itself is a Complete, firm Requirement; its exact boundary
remains open.

---

## 3. Weak preference

**Source IntentSpec semantics:** Claim, origin = User-Provided, force = preference (weak), from
`INTENT_CASES.md` Case 19's pattern adapted: "Maybe you could add a dark mode?" (`INTENT_SPEC.md`'s
own worked example) — force = preference (weak), self-reported uncertainty = hedged ("maybe").

**Defensible RequirementSpec result:** Requirement: "The system MAY include a dark mode (low
priority)." Weak preference maps to MAY/nice-to-have, not SHOULD.

**Prohibited transformations:** Mapping this to SHOULD (over-weighting a weak preference to the same
tier as a moderate/strong one); dropping it entirely on the theory that "weak" means "not worth
tracking" — a weak preference is still a preference and must still produce a (correspondingly weak)
Requirement, not silence.

**Provenance expectations:** Traces to the single weak-preference Claim; the Requirement's own
recorded strength (lowest tier) makes the weak basis visible without needing a separate confidence
field the way an Inference would.

**Eligibility:** Complete.

---

## 4. Strong preference

**Source IntentSpec semantics:** Claim, origin = User-Provided, force = preference (strong) — "I want
it to cost under $100/month" (`INTENT_CASES.md` Case 6), with a surviving MEDIUM Unknown about which
cost categories the ceiling covers.

**Defensible RequirementSpec result:** Requirement: "The system SHOULD cost under $100/month
(high-priority preference)." Strong preference maps to SHOULD (high priority) — **not MUST**, even
though "strong" might tempt an implementation to treat it as effectively mandatory.

**Prohibited transformations:** Mapping strong preference to MUST (the single most tempting and most
explicitly forbidden transformation in this corpus — this is the case that most directly tests
`REQUIREMENT_SPEC.md`'s R-05 invariant); silently deciding the cost-category scope instead of
carrying the Unknown forward.

**Provenance expectations:** Traces to the preference Claim; the cost-category Unknown is either
filled with an explicit, marked working default (e.g. "infrastructure and model-usage costs only,
Requirement-Derivation-introduced default, excluding one-time setup") or carried forward unresolved
— both are valid per `REQUIREMENT_SPEC.md`; whichever is chosen must be visible in the Requirement's
provenance, not silently assumed.

**Eligibility:** Complete either way (filling the Unknown with a marked default, or carrying it
forward as an attached open item on an otherwise-derived Requirement, both keep this Complete — only
an unresolved *Ambiguity or Conflict* would make it Partial, and this Claim carries neither).

---

## 5. Permission that must not become obligation

**Source IntentSpec semantics:** Claim, origin = User-Provided, force = permission, condition = legal
approval — "May we retain logs for 30 days if legal approves?" (`INTENT_SPEC.md`'s own worked
example).

**Defensible RequirementSpec result:** Requirement: "The system MAY retain logs for up to 30 days,
conditioned on legal approval." Permission maps to MAY; the condition is preserved as a formal
trigger, not dropped.

**Prohibited transformations:** Compiling this into "the system MUST retain logs for 30 days" (the
canonical permission-inflation error this case exists to test — directly exercises R-05); dropping
the legal-approval condition and treating retention as unconditionally permitted (exercises R-07).

**Provenance expectations:** Traces to the single permission Claim; the condition (legal approval) is
recorded as an attached, testable trigger on the Requirement itself, not as a separate freestanding
Requirement.

**Eligibility:** Complete.

---

## 6. Descriptive Claim that should not become a Requirement

**Source IntentSpec semantics:** Claim, origin = User-Provided, force = absent (purely descriptive) —
"We currently have five engineers on the team" (`INTENT_SPEC.md`'s own worked example), alongside a
separately force-bearing Claim in the same `IntentSpec` expressing a preference for low operational
overhead.

**Defensible RequirementSpec result:** No Requirement derived directly from the team-size Claim. It
may be attached as **rationale** to a separately-derived Requirement (e.g. "the system SHOULD
minimize operational/maintenance burden (high-priority preference)," with the five-engineer Claim
cited as context for *why* that preference matters) — but the descriptive Claim itself never becomes
a Requirement's normative content.

**Prohibited transformations:** Deriving "the system MUST be operable by a team of five engineers" or
any other requirement whose normative content is the headcount fact itself — nothing in a purely
descriptive statement expresses what the user wants, requires, or forbids (this directly exercises
R-02).

**Provenance expectations:** If used as rationale, the descriptive Claim's ID is recorded as
supporting context on the separately-derived Requirement, clearly distinguished from that
Requirement's actual basis (the force-bearing preference Claim).

**Eligibility:** Complete — the absence of a Requirement from this Claim is itself the correct,
expected outcome, not a gap.

---

## 7. Inferred Claim

**Source IntentSpec semantics:** Inferred Claim, premise = "I don't want our source code sent to
external providers" (User-Provided, prohibition), reasoning = "the user appears to have a
data-locality or privacy constraint," `derivation_confidence` = moderate (`INTENT_SPEC.md`'s own
worked example).

**Defensible RequirementSpec result:** At most a SHOULD-level supporting Requirement — "The system
SHOULD minimize data locality exposure generally (data-locality preference, Inference-derived,
moderate confidence)" — clearly marked as Inference-derived, capped below MUST regardless of how
confidently the Inference reads.

**Prohibited transformations:** Compiling the Inference into a MUST-level Requirement, or into a
Requirement indistinguishable in presentation from the User-Provided prohibition it was derived
from (both exercise R-03); treating the Inference's moderate confidence as license to state it with
the same certainty as the prohibition itself.

**Provenance expectations:** Traces to the Inferred Claim (not directly to the User-Provided Claim it
was inferred from, though that chain is inspectable transitively through the Inferred Claim's own
premises, per `INTENT_SPEC.md`'s I-05); the Requirement's provenance states the Inference's
`derivation_confidence` and reasoning kind, carried forward rather than discarded at compilation.

**Eligibility:** Complete.

---

## 8. Assumed Claim

**Source IntentSpec semantics:** Assumed Claim, gap = "which of two grammatically possible referents
a pronoun points to," rationale = "the nearest-noun reading permits continued interpretation," scope
= narrow (a single sentence), reversible = true (`INTENT_SPEC.md`'s own worked example, from
`intent-spec-ambiguity-conflict.json`).

**Defensible RequirementSpec result:** If the Assumption's resolved reading is itself something the
system must do or avoid, a Requirement may be derived from it — but marked **provisional and
reversible**, e.g. "The system SHOULD \[behavior implied by the assumed referent\] (provisional —
based on an Assumption, reversible if the referent is later clarified otherwise)." If the
Assumption's content is too narrowly interpretive to support any independent system behavior on its
own, no Requirement is derived from it at all, and that is the correct, expected outcome.

**Prohibited transformations:** Presenting an Assumption-derived Requirement with the same standing
as a User-Provided one; treating the Assumption's "reversible: true" property as satisfied by simply
noting it once, rather than actually re-examining the Requirement if a later `IntentSpec` version
resolves the referent differently (this connects forward to "IntentSpec Supersession Effects").

**Provenance expectations:** If a Requirement is derived, it traces to the single Assumed Claim, and
carries forward — not merely references — that Claim's own recorded gap, rationale, scope, and
`reversible: true` property; these are the Requirement's actual basis and must remain visible to a
downstream consumer, not compressed into the word "provisional" alone. If no Requirement is derived,
there is no provenance to record — the absence itself is the correct output, exactly as an empty
Requirement set is in Case 17.

**Eligibility:** Complete.

---

## 9. Conditional intent

**Source IntentSpec semantics:** Claim, origin = User-Provided, force = permission (as established in
the Case 9 remediation of `INTENT_CASES.md`), `scope_condition` = "local execution cannot support the
workload" — "Only use cloud execution if local execution can't support the workload," with a
surviving HIGH-turned-MEDIUM (post-revision) Ambiguity about what "can't support" means technically
(throughput/memory/latency).

**Defensible RequirementSpec result:** Requirement: "The system MAY use cloud execution, only if
local execution cannot support the workload." The condition is preserved as a formal, one-directional
trigger on the Requirement — a necessary condition for cloud use, not resolved into an unconditional
value and not strengthened into a biconditional ("if and only if") that would additionally assert
cloud use is required, or the only possible response, whenever the condition holds.

**Prohibited transformations:** Compiling this into an unconditional `cloud_execution = true` or
`= false` (the canonical condition-flattening error, directly exercising R-07); compiling "only if"
into "if and only if," which manufactures a converse the Claim never stated (the source wording
establishes a necessary condition for cloud use, not that local's insufficiency itself requires or
uniquely permits cloud use); silently picking one
of throughput/memory/latency as the operative meaning of "can't support" instead of carrying that
Ambiguity forward.

**Provenance expectations:** Traces to the single conditional Claim; the "what does 'can't support'
mean" Ambiguity is carried forward as an open item attached to this Requirement's trigger condition —
the Requirement itself (the conditional MAY) is derivable now; its precise firing threshold is not.

**Eligibility:** Partial — the conditional Requirement's existence and shape are Complete; its
trigger's exact quantitative meaning remains open.

---

## 10. LOW/MEDIUM unresolved Open Item that survives

**Source IntentSpec semantics:** Claim, origin = User-Provided, force = preference (weekly cadence,
report output) — "I want something that researches our competitors weekly and writes me a report"
(`INTENT_CASES.md` Case 2, post-remediation: competitor identity = MEDIUM Unknown, source scope =
HIGH — for this eligible input, assume a revision has resolved source scope down to "public web only,
no licensed access," leaving competitor identity as the sole surviving MEDIUM Unknown).

**Defensible RequirementSpec result:** Requirement: "The system SHOULD produce a weekly competitor
research report (recurring cadence, per the user's stated preference)." The source Claim's force is
a preference, not an obligation — the recurring-cadence Inference and the report-output Claim
together establish *what* is wanted and *how often*, but neither adds obligatory force the Claim
itself never expressed; there is no "obligation-adjacent SHALL" tier in the force → strength mapping,
and being unhedged is not the same axis as force (`INTENT_SPEC.md`'s I-22). Competitor identity is
either carried forward as an open item ("which competitors: unresolved") attached to this
Requirement's scope, or filled with a Requirement-Derivation-introduced default (e.g. "top 3
competitors by public visibility, Requirement-Derivation default, reversible") — both valid, must be
marked either way.

**Prohibited transformations:** Mapping the source preference to SHALL/MUST instead of SHOULD (the
error this case's own text originally modeled, corrected above — silent force inflation, directly
exercising R-05); silently inventing a specific competitor list and presenting it as though the user
named them; dropping the Unknown without any record, leaving a later stage unable to tell the scope
was ever open.

**Provenance expectations:** If filled: the default's rationale and its Requirement-Derivation origin
are stated explicitly, distinct from the underlying Claim's own User-Provided provenance. If carried
forward: the open item is attached to the Requirement it scopes, not left as a free-floating,
unconnected note.

**Eligibility:** Complete either way — an Unknown, unlike an Ambiguity or Conflict, does not force
Partial status; Requirement Derivation's choice to fill or carry it forward is a legitimate design
decision, not a completeness gap.

---

## 11. Multiple Claims supporting one Requirement

**Source IntentSpec semantics:** Three Claims from the same `IntentSpec` — (a) User-Provided,
preference: "help teachers identify possibly-struggling students"; (b) User-Provided, prohibition:
"do not rank students"; (c) User-Provided, prohibition: "do not assign risk scores" (`INTENT_CASES.md`
Case 10, post-remediation, with its "struggling" Ambiguity assumed resolved by revision to
"academic-performance-based" for this eligible input).

**Defensible RequirementSpec result:** One combined Requirement: "The system SHOULD surface
academic-performance-based indicators of students who may need support, and MUST NOT produce
per-student rankings or numeric risk scores." The positive goal and both prohibitions compose into a
single testable statement, because they jointly define the same output-shape constraint, not three
independent behaviors — but each clause keeps the strength its own source Claim's force actually
supports: SHOULD for the positive goal (Claim (a) is a preference, not an obligation — combining it
with two prohibitions does not inflate its own force), MUST NOT for each prohibition (Claims (b) and
(c) are themselves prohibitions). Mixed strength within one combined Requirement is expected here,
per "Requirement Cardinality and Granularity" in `REQUIREMENT_SPEC.md` — it is not an error to
correct toward a single uniform strength.

**Prohibited transformations:** Mapping Claim (a)'s preference to SHALL/MUST because it appears
alongside two firmer prohibitions in the same combined statement (force inflation by association,
directly exercising R-05); deriving the prohibitions as a MUST-NOT requirement disconnected from the
positive goal, such that a downstream stage could satisfy the prohibition trivially by building
nothing at all (the prohibitions only make sense as a *shape constraint on* the positive Requirement,
not a standalone one); softening either prohibition to a preference to make the combined statement
easier to satisfy.

**Provenance expectations:** The single Requirement's provenance lists all three Claim IDs (a), (b),
and (c) — not just the strongest one — so an auditor can see the full basis for the combined
statement.

**Eligibility:** Complete.

---

## 12. One Claim producing multiple defensible Requirements

**Source IntentSpec semantics:** Claim, origin = User-Provided, force = preference (strong) — "I want
the system to email me whenever a deployment fails," with no surviving Ambiguity or Conflict
touching this Claim (chosen deliberately so the split below is testable purely against what the
Claim mechanically entails, not against any unresolved reading of it — contrast Case 2/9, where a
split or scope would instead depend on an unresolved Ambiguity).

**Defensible RequirementSpec result:** Two independently testable Requirements from the one Claim:
(i) "The system SHOULD detect deployment failures" and (ii) "The system SHOULD send an email
notification when a deployment failure is detected." Both are mechanically entailed by the single
Claim — you cannot email about a failure without first detecting it, and the Claim explicitly asks
for the email — not an interpretive stretch the way "does 'leaving my computer' plausibly cover
storage too" would be (see `REQUIREMENT_SPEC.md`'s "Requirement Cardinality and Granularity"). Both
carry the source Claim's own strength (preference → SHOULD), since neither is a further inference
beyond what "email me whenever X fails" already directly asks for.

**Prohibited transformations:** Merging both into one vague Requirement ("the system SHOULD notify
about failures") that a downstream stage cannot cleanly test detection capability against
notification-delivery capability separately; inventing a third Requirement (e.g. about *which*
notification channel, retry behavior, or alerting SLA) that the Claim's own wording doesn't support;
splitting the Claim on a reading it doesn't settle (e.g. treating "fails" as covering only some
failure types) rather than on what it mechanically and uncontroversially entails.

**Provenance expectations:** Both Requirements independently list the same single Claim ID as their
basis — this is the expected, valid shape for this cardinality, not a duplication error.

**Eligibility:** Complete.

---

## 13. Conflicting provenance

**Source IntentSpec semantics:** A hypothetical eligible `IntentSpec` carrying a Conflict at MEDIUM
Decision Impact between two User-Provided Claims — "the weekly competitor report should be delivered
on Monday mornings" and "the weekly competitor report should be delivered on Friday afternoons" (no
explicit supersession signal between them, so this is a Conflict, not a correction, per
`INTENT_SPEC.md`'s Conflict Policy). The Decision Impact Provenance states the downstream consequence
as "which day the report-delivery scheduler is configured for" — a scheduling detail, not a fork in
which capability or architecture branch exists at all (contrast Case 8/16/17 in `INTENT_CASES.md`,
where a Conflict's downstream consequence genuinely does fork the architecture and is correctly
HIGH/CRITICAL). MEDIUM applies here under `INTENT_SPEC.md`'s own outcome-relative test precisely
because resolving it either way doesn't change the solution's shape, only a configuration value —
illustrating that a Conflict can survive `IntentSpec`'s eligibility gate without being HIGH/CRITICAL,
even though no case in `INTENT_CASES.md` happens to instantiate this.

**Defensible RequirementSpec result:** No Requirement is derived for the report-delivery schedule at
all. The Conflict is carried forward into `RequirementSpec` as an explicit unresolved item, exactly
as recorded in the source `IntentSpec` — both conflicting Claims preserved, no side chosen. (The
report-content and cadence Requirements from Case 10, if this `IntentSpec` also carries that Claim,
derive normally and independently of this Conflict — only the specific delivery-day value is
blocked.)

**Prohibited transformations:** Picking either side (Monday or Friday) because it seems more
convenient, more recently stated, or more "standard" for a weekly report; averaging the two into a
hedged, noncommittal Requirement that satisfies neither Claim ("the system SHOULD deliver the report
sometime midweek" is not a defensible compilation of either stated position and is itself an
invented third answer); treating the Conflict's MEDIUM impact as license to resolve it, on the
theory that only HIGH/CRITICAL Conflicts are truly off-limits (this is the specific error
`REQUIREMENT_SPEC.md`'s "Conflicts and Unresolved Information" section exists to forbid — a MEDIUM
Conflict is exactly as off-limits to interpretive resolution as a HIGH one, only its consequence
differs).

**Provenance expectations:** The carried-forward Conflict references both original Claim IDs,
unchanged from the `IntentSpec`'s own record; no Requirement in this `RequirementSpec` version claims
either Claim as sole basis for a delivery-day decision.

**Eligibility:** Partial — any Requirement not touching the delivery day derives normally; the
delivery-day value itself stays explicitly open.

---

## 14. Superseded IntentSpec

**Source IntentSpec semantics:** `IntentSpec` v1: Claim, User-Provided, preference (strong), "I want
it to cost under $100/month." `IntentSpec` v2 (explicit correction, `INTENT_CASES.md` Case 20):
supersedes the v1 Claim; new live Claim, "actually up to $500/month."

**Defensible RequirementSpec result:** The `RequirementSpec` version derived from `IntentSpec` v1
("the system SHOULD cost under $100/month") is not edited. A new `RequirementSpec` version is
produced from `IntentSpec` v2, containing the corrected Requirement ("the system SHOULD cost under
$500/month"), with the v1-derived Requirement marked invalid/superseded in the historical record —
not deleted.

**Prohibited transformations:** Silently mutating the existing $100/month Requirement's stated value
in place; treating the v1-derived `RequirementSpec` version as though it never existed once v2
exists; carrying the $100/month Requirement forward unchanged into the new version alongside the
$500/month one, as though both were simultaneously live (that would misrepresent an explicit
correction as an unresolved Conflict, which `INTENT_SPEC.md`'s Case 20 remediation specifically
establishes it is not).

**Provenance expectations:** The new version's Requirement traces to the v2 Claim and records that it
supersedes the v1-derived Requirement. The v1 `RequirementSpec` version itself is never touched —
nothing in it changes, and it continues to record the $100/month Requirement exactly as it existed
when v1 was produced, per Principle 11 (Reproducibility). "Marked invalid" describes a property the
*new* version records about the old Requirement's identity (this identity is superseded, replaced by
that one), not an edit applied to the immutable v1 artifact itself.

**Eligibility:** Complete (new version), historical-Complete-but-superseded (old version) — neither
Partial nor Failed; this is ordinary, expected revision, not a degraded outcome.

---

## 15. Named technology with unresolved negotiability

**Source IntentSpec semantics:** Claim, origin = User-Provided, force = direct unhedged statement of
method (no obligation/preference language used) — "Build a customer-support system using LangGraph,
GPT-5, Pinecone, and Kubernetes" (`INTENT_CASES.md` Case 7, post-remediation, HIGH-impact
negotiability Unknown — for this eligible input, assume a revision has narrowed negotiability's
impact down to MEDIUM, e.g. because a later `UserIdea` turn clarified these are the team's *default*
stack but not stated as strictly non-substitutable, without fully resolving whether substitution is
acceptable).

**Defensible RequirementSpec result:** Requirement: "The system SHOULD use LangGraph, GPT-5,
Pinecone, and Kubernetes as its orchestration, model, vector-store, and deployment components, per
explicit user request (negotiability unresolved — see attached Unknown)." SHOULD, not SHALL: a firm
SHALL/MUST would itself assert that a candidate substituting a different technology fails the
Requirement — exactly the negotiability question the source `IntentSpec` leaves open. Emitting SHALL
here would be an *implicit* resolution of that Unknown toward "non-negotiable," which is exactly as
forbidden as resolving it explicitly (per `REQUIREMENT_SPEC.md`'s "User-Selected Technology"). The
Requirement still preserves the Claim as a real, stated constraint — not softened into a bare
preference either — it simply carries the honest strength an unresolved-negotiability constraint
actually has. The negotiability Unknown is carried forward, attached to this Requirement, unresolved;
if a later `IntentSpec` revision resolves negotiability toward "non-substitutable," the Requirement's
strength may then be revised to SHALL in a new `RequirementSpec` version.

**Prohibited transformations:** Compiling this Requirement as SHALL/MUST while negotiability remains
an unresolved Unknown (the error this case's own text originally modeled, corrected above — strength
inflation that implicitly resolves an Unknown, directly exercising R-05 and the User-Selected
Technology rule); evaluating, endorsing, or second-guessing whether these four technologies are
actually well-suited to a customer-support system (that is Technology Candidate Identification's and
Architecture Synthesis's job, governed by Principle 2); silently resolving negotiability either
direction (treating it as fully substitutable, or as absolutely fixed) instead of carrying the
Unknown forward; deriving a *different* Requirement not authorized by anything stated (e.g. inventing
a "the system MUST support horizontal scaling" requirement merely because Kubernetes was named, when
nothing in the `IntentSpec` states a scaling requirement independently).

**Provenance expectations:** Traces to the single named-technology Claim; the negotiability Unknown
is attached as an explicit open item on this Requirement, carrying forward exactly the uncertainty
`IntentSpec` recorded, neither resolved nor discarded.

**Eligibility:** Complete — an Unknown (not an Ambiguity/Conflict) attached to an otherwise fully
statable Requirement does not, by itself, force Partial status; the constraint itself derives
cleanly, only its future negotiability is open.

---

## 16. Requirement that would cause architecture leakage if over-normalized

**Source IntentSpec semantics:** Claim, origin = User-Provided, force = preference (moderate) — "I
want it to feel modern and fast," with no further specification anywhere in the `IntentSpec` of what
"modern" or "fast" mean operationally (an Unknown, LOW/MEDIUM impact, carried in the source
`IntentSpec`).

**Defensible RequirementSpec result:** Requirement: "The system SHOULD respond to user-facing
interactions quickly enough to be perceived as fast (performance preference; specific latency
threshold unresolved)." No architecture, framework, or technology is named or implied. "Modern" is
either dropped as too vague to support any testable Requirement at all (a legitimate, honest
non-outcome — see Case 6 for the same posture toward under-specified content) or retained only as an
attached, explicitly-unresolved qualitative note, never compiled into a specific implementation
pattern.

**Prohibited transformations:** Deriving "the system SHALL use a microservices architecture with
asynchronous messaging and a modern JavaScript framework" from "modern and fast" — this is the
canonical over-normalization failure this case exists to test: nothing in the source `IntentSpec`
names an architecture, yet a plausible-sounding one gets invented to make the vague preference feel
"actionable." Also prohibited: inventing a specific numeric latency threshold (e.g. "under 200ms")
that no Claim or Open Item supports — that would be a fabricated Requirement-Derivation default
presented without being marked as such, and without honest grounding even as a marked default.

**Provenance expectations:** Traces to the single preference Claim; the absence of a resolved,
testable performance threshold is either an attached open item or explicitly noted as
too-underspecified-to-formalize-further — either way, no invented specificity papers over the gap.

**Eligibility:** Complete — the honest, narrow Requirement is fully derivable; there is no
Ambiguity or Conflict here, only an Unknown (what "fast" quantitatively means) that Requirement
Derivation is not obligated to resolve.

---

## 17. Zero valid requirements / non-requirement intent

**Source IntentSpec semantics:** An eligible `IntentSpec` whose only Claims are descriptive
(force absent) — e.g. "we're a five-person team building an internal tool," "we currently use
spreadsheets for this" — with no Claim anywhere expressing an obligation, prohibition, permission, or
preference, and no surviving Open Item or Conflict that itself implies a testable constraint.

**Defensible RequirementSpec result:** `RequirementSpec` with an **empty Requirement set** — a valid,
Complete output, not a Failure. Per `REQUIREMENT_SPEC.md`'s R-17, this is the correct outcome when
the input genuinely supports no formal Requirements, exactly mirroring `INTENT_SPEC.md`'s own
tolerance for an empty Claims array.

**Prohibited transformations:** Manufacturing Requirements from the descriptive Claims to avoid
producing an "empty-looking" artifact (e.g. inventing "the system MUST be usable by five people" from
the team-size statement); reporting this as a Failure merely because nothing was derived — Failure is
reserved for inputs that support no defensible structure *at all*, and an `IntentSpec` with
well-formed (if entirely descriptive) Claims is a perfectly defensible, if requirement-empty,
structure.

**Provenance expectations:** The empty Requirement set's absence of content is itself the artifact —
no fabricated provenance is needed or permitted to justify it.

**Eligibility:** Complete, with zero Requirements. (Contrast: if the source `IntentSpec` had instead
supported *no coherent structure whatsoever* — not even descriptive Claims, nothing to compile from
at all — that would be the narrower Failed case; this case's well-formed-but-requirement-empty input
does not meet that bar.)
