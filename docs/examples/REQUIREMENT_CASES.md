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
full strength. (User-Provided origin is recorded independently in provenance; it neither increases
nor caps the Requirement's strength — strength comes from the force alone, per "Treatment of Claim
Origin" in `REQUIREMENT_SPEC.md`.) The Requirement's own text must not assert a specific coverage
("any deployment," "all
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
provenance, not silently assumed. Filling is legitimate here, unlike Case 10's competitor-identity
Unknown, because cost-category scope selects an accounting parameter *within* an already-settled
preference (per R-19's tightened test): no reading of it adds, removes, or narrows a user-facing
capability, actor, or target — it only changes which dollar amounts count toward a ceiling the user
has already stated. Contrast competitor identity, which changes the research capability's own target
scope.

**A candidate-independent satisfaction procedure (per R-21):** if Requirement Derivation fills the
cost-category Unknown with a marked default, the Requirement becomes an ordinary two-valued test
(SATISFIED if the candidate's cost under that definition is strictly under $100/month, NOT_SATISFIED
otherwise) and Completeness is immediate — no further argument is needed. The harder, more instructive
case is when Requirement Derivation instead carries the Unknown forward unresolved: even then, the
Requirement's own recorded content — "under $100/month" (a strict, not inclusive, threshold — $100.00
exactly does not satisfy it under either reading), together with the carried-forward Unknown's own two
recorded candidate readings ("infrastructure and model-usage costs only," and "all recurring costs") —
already fully specifies a three-valued procedure, applicable to any one candidate considered entirely
on its own, with no reference to any other candidate or to how many candidates would land in which
branch. The procedure presumes the candidate under evaluation supplies the cost figures it needs (its
own infrastructure/model-usage cost and its own total recurring cost); a candidate description that
omits a figure the procedure requires is an evaluation-input completeness problem for the downstream
evaluating stage to resolve, not a defect in this Requirement's own Completeness:

- Let `C_narrow` = the candidate's infrastructure-and-model-usage monthly cost (Reading 1).
- Let `C_wide` = the candidate's total recurring monthly cost, including third-party licenses etc.
  (Reading 2). `C_wide` is always ≥ `C_narrow`, since Reading 2's total is a superset of Reading 1's.
- If `C_wide` < $100 → **SATISFIED** (both readings agree the candidate is strictly under budget).
- If `C_narrow` ≥ $100 → **NOT_SATISFIED** (both readings agree the candidate is not under budget —
  this correctly includes a candidate priced at exactly $100 under either reading, which is not
  "under" $100 by either reading's own strict threshold).
- Otherwise (`C_narrow` < $100 ≤ `C_wide`) → **INDETERMINATE** (the two recorded readings disagree;
  *which* applies is exactly the carried-forward Unknown — not something this procedure, or the
  evaluator, may pick on its own). This is the only branch where the readings actually disagree; the
  first two branches are exactly where they agree, so the procedure is faithful and maximally
  determinate per R-21 — it never returns INDETERMINATE for a candidate the recorded readings already
  agree on.

This procedure is derived entirely from the Requirement's own recorded content (the threshold plus
the Unknown's own two recorded readings); it requires the evaluator to invent nothing, and it is
defined once, applied identically to every candidate one at a time. A candidate costing $80/month in
infrastructure/model usage plus $60/month in third-party licenses (`C_narrow` = $80, `C_wide` = $140)
lands **INDETERMINATE** — not a defect in the procedure, but its own correctly-specified output for a
candidate whose classification genuinely depends on the still-open Unknown. A candidate at $30/month
total (`C_narrow` = `C_wide` = $30) is **SATISFIED**; one at $500/month total is **NOT_SATISFIED** —
resolved without needing the Unknown at all, not because such candidates happen to be common, but
because the procedure's own structure (`C_wide` < threshold, or `C_narrow` ≥ threshold) determines it
for that candidate alone, considered in isolation. Nothing in this procedure, or in the Requirement's
Complete status, depends on how many real candidates would fall into SATISFIED, NOT_SATISFIED, or
INDETERMINATE — the procedure is fixed and content-derived before any candidate exists to apply it to.

**Eligibility:** Complete either way. Filling the Unknown with a marked default collapses the
procedure above to an ordinary two-valued test; carrying it forward unresolved keeps the three-valued
procedure above, which is itself a fully-specified satisfaction procedure per R-21 — INDETERMINATE is
a legitimate output of that procedure, not evidence of Partial status. This is a genuinely different
situation from Case 16's "fast," which supplies no metric, comparator, or reading at all from which
*any* SATISFIED/NOT_SATISFIED/INDETERMINATE procedure could be written down — there, no version of the
procedure above could even be stated, which is what actually makes a Requirement Partial under R-21.

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

**Source IntentSpec semantics (7a — preference-force Inference):** Inferred Claim, force =
preference, premise = "I don't want our source code sent to external providers" (User-Provided,
prohibition), reasoning = "the user appears to have a data-locality or privacy constraint,"
`derivation_confidence` = moderate (`INTENT_SPEC.md`'s own worked example).

**Defensible RequirementSpec result (7a):** Requirement: "The system SHOULD minimize data-locality
exposure generally (Inference-derived, moderate confidence)." SHOULD because the Inferred Claim's
**own force is a preference** — not because moderate confidence capped a stronger force down to
SHOULD. Confidence and provisional standing are recorded in provenance alongside the origin marker,
not folded into the strength. Separately from strength, this Requirement's own recorded content
supplies no metric, comparator, or procedure for "data-locality exposure" or "minimize... generally"
— structurally the same testability gap as Case 16's "fast," not the faithful, fully-specified
SATISFIED/NOT_SATISFIED/INDETERMINATE procedure Case 4's dollar threshold supports (per R-21): no
version of that procedure could be written down here, for any single candidate considered on its own
— there is no recorded reading to route even one candidate to a definite branch. Strength (SHOULD) and
testability (whether a
satisfaction procedure exists) are independent questions — this Requirement's strength classification
is correct precisely because it does not depend on, and is not weakened by, its separate testability
gap.

**Source IntentSpec semantics (7b — prohibition-force Inference, contrast case):** Inferred Claim,
force = prohibition, premise = the same source-code prohibition, reasoning = "the stated prohibition
on transmitting source code externally extends to build artifacts and dependency-lock files that
themselves embed source content" (a technical-scope extension, not a weaker motivational reading),
`derivation_confidence` = moderate.

**Defensible RequirementSpec result (7b):** Requirement: "The system MUST NOT transmit build
artifacts or dependency-lock files containing source content to external providers
(Inference-derived, moderate confidence, provisional/reversible if the extension is later found
unsupported)." **MUST NOT, not SHOULD NOT** — moderate confidence does not weaken a prohibition-force
Inference's strength; it only affects whether Requirement Derivation chooses to derive a Requirement
from it at all, and (having chosen to) makes the result provisional/reversible. This is the specific
case R-03/R-06 consistency depends on: an Inferred prohibition is still at least MUST NOT/SHALL NOT.

**Prohibited transformations:** Compiling either Inference into a Requirement without marking its
Inference origin, so it reads as user-stated (violates R-03); in 7a, inflating the preference-derived
SHOULD to MUST because the underlying privacy concern feels important (violates R-05); in 7b,
**weakening the prohibition-derived MUST NOT to SHOULD NOT because confidence is only moderate** —
this is the confidence-into-normative-weakness conflation this case pair exists to test, and the
specific error the prior draft of this document made (violates R-03/R-06).

**Provenance expectations:** Both trace to their respective Inferred Claim (not directly to the
User-Provided Claim inferred from, though that chain is inspectable transitively through the
Inferred Claim's own premises, per `INTENT_SPEC.md`'s I-05); each Requirement's provenance states its
Inference's `derivation_confidence` and reasoning kind, carried forward rather than discarded at
compilation, and independently of — not substituting for — the Requirement's own strength.

**Eligibility:** Partial for 7a — the SHOULD strength is correctly and completely derived, but the
Requirement's own content supplies no metric/comparator/procedure for "data-locality exposure" or
"generally," per R-21's testability-blockage branch; this is a defect in the worked example caught on
final audit, distinct from the strength question 7a exists to demonstrate. Complete for 7b — "transmit
build artifacts or dependency-lock files containing source content" fully specifies a two-valued,
candidate-independent procedure (per R-21): for any one candidate considered on its own, inspect the
transmitted artifact for embedded source content — SATISFIED if none is found, NOT_SATISFIED if it is
— with no INDETERMINATE branch needed, since nothing in the Requirement's content records a disputed
reading. The same pattern as Case 2's Completeness, not the missing-oracle pattern.

---

## 8. Assumed Claim

**Source IntentSpec semantics:** the user's turn stated "if an upload conflicts with an existing
record, replace it" — Intent Parsing already recorded this as a Claim with **obligation force**
(a direct instruction, not hedged as a wish) *before and independent of* resolving what "it" refers
to; that force is a settled property of the Claim itself, not something that depends on which
referent is later assumed. Separately, the pronoun "it" is grammatically ambiguous between "the
upload" and "the existing record." Assumed Claim: gap = "which of the two grammatically possible
referents the pronoun points to," rationale = "the nearest-noun reading (the existing record) permits
continued interpretation," scope = narrow (a single sentence), reversible = true — the same
gap/rationale/scope/`reversible` structure `INTENT_SPEC.md`'s own worked example uses (from
`intent-spec-ambiguity-conflict.json`), concretized here with an explicit sentence and an explicit,
already-recorded force so this case can be audited for testability and origin/strength independence,
not left as an unfillable placeholder.

**Defensible RequirementSpec result:** Requirement: "The system MUST replace the existing record when
an uploaded file conflicts with it (nearest-noun reading assumed for 'it'; provisional — based on an
Assumption, reversible if the referent is later clarified otherwise)." **MUST**, because that is the
Claim's own already-recorded force — Requirement Derivation is **compiling a force IntentSpec already
settled**, not inspecting the resolved sentence's content and deciding for itself whether the result
"is" obligatory or preferred; the Assumption resolves only *which noun* "it" points to, never *how
binding* the instruction is. Assumed origin requires the provisional/reversible marking; it does not
require, or justify, softening MUST to SHOULD — that would be the same confidence/origin-into-
normative-weakness conflation Case 7b tests, applied to Assumed rather than Inferred origin. (Had the
underlying Claim instead carried preference force, the compiled Requirement would be SHOULD for the
same reason — because that is the Claim's own recorded force, not because Assumed origin caps it
there.) If an Assumption's content were too narrowly interpretive to support any independent system
behavior on its own, no Requirement would be derived from it at all — that remains a correct, expected
outcome for a different Assumed Claim than this one, where the resolved sentence *does* name a
concrete system behavior ("replace the existing record").

**Prohibited transformations:** Presenting an Assumption-derived Requirement with the same standing
as a User-Provided one; weakening the obligation-level assumed reading to SHOULD merely because its
origin is Assumed (the origin justifies the provisional/reversible marking, not a lower strength);
deciding the Requirement's strength by inspecting what the resolved reading "seems like" rather than
compiling the force IntentSpec already recorded on the Claim — that would be Requirement Derivation
quietly exercising interpretive authority over force that belongs to Intent Parsing alone; treating
the Assumption's "reversible: true" property as satisfied by simply noting it once, rather than
actually re-examining the Requirement if a later `IntentSpec` version resolves the referent
differently (this connects forward to "IntentSpec Supersession Effects").

**Provenance expectations:** The Requirement traces to both the obligation-force Claim and the Assumed
Claim resolving its pronoun, and carries forward — not merely references — the Assumption's own
recorded gap, rationale, scope, and `reversible: true` property; these are part of the Requirement's
actual basis and must remain visible to a downstream consumer, not compressed into the word
"provisional" alone.

**Eligibility:** Complete — "replace the existing record" fully specifies a two-valued,
candidate-independent procedure per R-21: for any one candidate considered on its own, did a
conflicting upload's existing record get replaced, yes/no — no INDETERMINATE branch needed, since
nothing in the Requirement's content records a disputed reading; this case is not testing the
testability axis (contrast Case 7a/Case 11, which are).

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
research report (recurring cadence, per the user's stated preference); which competitors is an
unresolved, carried-forward Open Item." The source Claim's force is a preference, not an obligation —
the recurring-cadence Inference and the report-output Claim together establish *what* is wanted and
*how often*, but neither adds obligatory force the Claim itself never expressed; there is no
"obligation-adjacent SHALL" tier in the force → strength mapping, and being unhedged is not the same
axis as force (`INTENT_SPEC.md`'s I-22). **Competitor identity is not fillable by Requirement
Derivation** — unlike Case 4's cost-category Unknown, *which* competitors to research is not a
technical/operational accounting parameter; it defines *what the user's stated goal actually
targets*, i.e. part of what the user wants (per R-19's semantic test: filling it would decide the
goal's own scope, not merely how compliance with an already-settled goal is measured). Only carrying
it forward is defensible here — there is no legitimate "fill with a default" branch for this
particular Unknown, in contrast to Case 4.

**Prohibited transformations:** Mapping the source preference to SHALL/MUST instead of SHOULD (the
error this case's own text originally modeled, corrected above — silent force inflation, directly
exercising R-05); **filling competitor identity with any default** ("top 3 by public visibility" or
similar) and presenting the resulting Requirement as though its scope were settled — this is the
error R-19 exists to forbid: competitor identity is not a technical parameter, so no
Requirement-Derivation-introduced default is legitimate here, unlike Case 4; silently inventing a
specific competitor list and presenting it as though the user named them; dropping the Unknown
without any record, leaving a later stage unable to tell the scope was ever open.

**Provenance expectations:** The Requirement traces to the preference Claim; the competitor-identity
Unknown is attached to it as a carried-forward, never-filled open item — not left as a free-floating,
unconnected note, and never accompanied by a Requirement-Derivation-introduced value the way Case 4's
cost-category Unknown may legitimately be.

**Eligibility:** Partial — the cadence/output-format portion of the Requirement is genuinely testable
now ("does the system produce a weekly report" can be evaluated independently of which competitors);
the *target scope* of that report cannot be, so this area remains open rather than Complete, per
R-19/R-21. Contrast Case 4, which stays Complete either way because its surviving Unknown is a
genuine technical parameter, not a scope-of-intent question.

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
single statement, because they jointly define the same output-shape constraint, not three
independent behaviors — but each clause keeps the strength its own source Claim's force actually
supports: SHOULD for the positive goal (Claim (a) is a preference, not an obligation — combining it
with two prohibitions does not inflate its own force), MUST NOT for each prohibition (Claims (b) and
(c) are themselves prohibitions). Mixed strength within one combined Requirement is expected here,
per "Requirement Cardinality and Granularity" in `REQUIREMENT_SPEC.md` — it is not an error to
correct toward a single uniform strength. Strength and testability are, however, independent
questions (per R-21): the two prohibitions each fully specify a two-valued, candidate-independent
procedure — for any one candidate considered on its own, does the output contain a per-student ranking
or numeric score, yes/no — but the positive clause's "academic-performance-based indicators... who may
need support" supplies no metric, comparator, or threshold — no reading of it says what counts as an
"indicator" or what performance level triggers "may need support," so no version of even a
three-valued procedure could be written down for it. The same missing-oracle pattern as Case 7a and
Case 16's "fast," not the pattern Case 4's dollar threshold supports. The prohibitions being Complete
does not make the
positive clause Complete; each clause's testability, like its strength, is assessed independently.

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

**Eligibility:** Partial — the two prohibition clauses are Complete (a real binary check exists for
each), but the positive clause supplies no metric/comparator for "academic-performance-based
indicators... who may need support," per R-21's testability-blockage branch, making the combined
Requirement's positive half an open item even though its strength (SHOULD) is already correctly
settled. This is a defect in the worked example caught on final audit — a fillable Unknown does not
exist here to carry forward (nothing in the source Claim supplies even an unresolved-but-real metric
the way Case 4's dollar figure does); the gap is a genuinely missing oracle, not a boundary refinement.

---

## 12. One Claim producing multiple defensible Requirements

**Source IntentSpec semantics:** Claim, origin = User-Provided, force = preference (strong) — "I want
the system to log every user action and let me search those logs afterward," with no surviving
Ambiguity or Conflict touching this Claim (chosen deliberately so the split below is testable purely
against what the Claim mechanically entails, not against any unresolved reading of it, and so that
*both* resulting Requirements are unambiguously this system's own responsibility — contrast an
earlier, rejected version of this case that used "email me whenever a deployment fails": splitting
that into "the system SHOULD detect deployment failures" silently assigned detection responsibility
to *this* system, when the Claim never said who or what detects the failure — an external system, a
CI/CD platform's own webhook, or a human could equally be the source of that event. Assigning
unstated architectural responsibility that way would itself violate "Requirement-Level Inference"'s
operational test above; this case is deliberately built so no such assignment is needed.)

**Defensible RequirementSpec result:** Two independently testable Requirements from the one Claim:
(i) "The system SHOULD log every user action" and (ii) "The system SHOULD provide a way to search the
logged actions." Both are directly, textually named in the single compound statement — "log... and
let me search" — not an inference about which system does what (unlike the rejected deployment-email
version, both actions are explicitly, unambiguously actions of *this* system, since the user is
describing what they want *this* system to do), and not an interpretive stretch the way "does
'leaving my computer' plausibly cover storage too" would be (see `REQUIREMENT_SPEC.md`'s "Requirement
Cardinality and Granularity"). Both carry the source Claim's own strength (preference → SHOULD).

**Prohibited transformations:** Merging both into one vague Requirement ("the system SHOULD support
log review") that a downstream stage cannot cleanly test logging capability against search capability
separately; inventing a third Requirement (e.g. about retention period, log format, or access
control) that the Claim's own wording doesn't support; splitting a Claim into Requirements that assign
responsibility the Claim didn't state — the specific error this case's own construction is designed
to avoid, and which any replacement example must keep avoiding.

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

**Defensible RequirementSpec result:** Requirement Derivation does **not** assign any strength
(MUST, SHOULD, or MAY) to this Claim. The source's own force — "a direct unhedged statement of
method" — never resolved to obligation, prohibition, permission, or preference at Intent Parsing;
choosing any single strength now, including SHOULD, would be Requirement Derivation resolving that
open question on the Claim's behalf, which R-20 forbids. What is preserved instead: an **unresolved
constraint-candidate** — "The user explicitly named LangGraph, GPT-5, Pinecone, and Kubernetes as the
intended technologies; whether this is binding as an obligation or merely preferred (force) has not
been established, and separately, whether substitutes would be acceptable even if some strength is
established (negotiability) is also unresolved." Negotiability is not a third force category
alongside obligation and preference — a technology can, in a different case, be obligatory yet
substitutable under stated equivalence criteria, or preferred yet exclusive; here, both are unresolved
simultaneously, but they remain two independent open questions, not one merged "how negotiable is
this" spectrum. Both open questions — force and negotiability — are
carried forward attached to the constraint-candidate, not merged into one vague "unresolved" label:
they are genuinely separate (a resolved-obligation-but-unresolved-negotiability Claim is a different,
and more common, situation — see "User-Selected Technology" in `REQUIREMENT_SPEC.md`).

**Prohibited transformations:** Assigning **any** strength — SHALL/MUST, SHOULD, or even MAY — to
manufacture a testable Requirement from a Claim whose own force never resolved (the specific error an
earlier draft of this case made, by settling on SHOULD as a "safer middle ground": that is still an
unauthorized interpretive choice, not a neutral compilation default, and directly violates R-20);
reading "direct and unhedged" as implying obligation, or reading "no explicit obligation language" as
implying mere preference — both are unsupported readings the wording doesn't settle either way;
evaluating, endorsing, or second-guessing whether these four technologies are actually well-suited to
a customer-support system (Technology Candidate Identification's and Architecture Synthesis's job,
governed by Principle 2); silently resolving negotiability in either direction; deriving a *different*
Requirement not authorized by anything stated (e.g. inventing a "the system MUST support horizontal
scaling" requirement merely because Kubernetes was named).

**Provenance expectations:** The constraint-candidate traces to the single named-technology Claim;
its provenance records that the Claim's own force did not resolve (distinct from, and in addition to,
the separately-unresolved negotiability Unknown) — a downstream reader must be able to tell these are
two different open questions, not one.

**Eligibility:** Partial (per R-20/R-21) — the constraint-candidate cannot be evaluated as "satisfied"
or "not satisfied" by any candidate architecture, because its own binding strength is unresolved, not
merely its precision or its scope. This is a genuinely different reason for Partial than Case 1's or
Case 9's (those have a testable Requirement with an open scope/trigger detail); here, nothing testable
has actually been produced yet for this Claim.

---

## 16. Requirement that would cause architecture leakage if over-normalized

**Source IntentSpec semantics:** Claim, origin = User-Provided, force = preference (moderate) — "I
want it to feel modern and fast." The word "fast" itself bears directly on the performance question
and supports multiple materially different readings (latency? throughput? perceived
responsiveness?), so per `INTENT_SPEC.md`'s practical test ("if specific wording addresses it but
that wording itself supports more than one reading, it's an Ambiguity") this is an **Ambiguity**, not
an Unknown — nothing about it is a blank gap; the word itself is what generates the multiple readings.
"Modern" is vaguer still and doesn't invite a comparably bounded set of readings; it is carried as a
separate, even-less-formalizable open preference.

**Defensible RequirementSpec result:** Requirement Derivation does **not** compile "fast" into a
strength-bearing testable Requirement by picking one of its candidate readings (e.g. defaulting to
"low latency") — per R-08, resolving a surviving Ambiguity is never Requirement Derivation's to do,
at any impact level, exactly as for any other Ambiguity in this corpus. Recording "the system SHOULD
respond quickly enough to be perceived as fast" without picking a reading would also fail R-21
independently: with no metric or comparator recorded for *any* reading, there is nothing a downstream
evaluator could apply without inventing one — contrast Case 4's "$100/month" (a real metric and
threshold; only the accounting *category* is unresolved) or Case 1's "approval gate" (testable now;
only its environment *scope* is open). Both defects point the same direction here: the Ambiguity is
recorded and carried forward, unresolved, rather than compiled into any single reading. No
architecture, framework, or technology is named or implied either way — "modern" is recorded as an
open preference, not compiled into any implementation pattern.

**Prohibited transformations:** Deriving "the system SHALL use a microservices architecture with
asynchronous messaging and a modern JavaScript framework" from "modern and fast" — the canonical
over-normalization failure this case exists to test: nothing in the source `IntentSpec` names an
architecture, yet a plausible-sounding one gets invented to make the vague preference feel
"actionable." Also prohibited: silently picking one reading of "fast" (e.g. "low latency") to produce
*some* testable Requirement (violates R-08, the same error as resolving any other surviving
Ambiguity); inventing a specific numeric latency threshold (e.g. "under 200ms") that no Claim or Open
Item supports — a fabricated Requirement-Derivation default without honest grounding; and (the error
an earlier draft of this case made, by mislabeling "fast" as a bare Unknown rather than an Ambiguity)
recording a strength-bearing SHOULD Requirement with zero quantification and calling that "Complete."

**Provenance expectations:** Traces to the single preference Claim; the "fast" Ambiguity is carried
forward with its candidate readings (latency/throughput/perceived responsiveness), not collapsed into
one; "modern" is recorded as a separate open preference. Neither is compiled into a testable
Requirement yet (contrast Case 4, where a testable Requirement *was* produced and only its accounting
boundary remains open).

**Eligibility:** Partial — for two independently sufficient reasons: the surviving Ambiguity in
"fast" is never Requirement Derivation's to resolve (R-08), and even setting that aside, no reading of
"fast" supplies any metric or comparator to test against (R-21). Resolving either requires a new
Intent Parsing pass — one that picks a reading for "fast," and (separately) one that quantifies
whichever reading is chosen, or confirms no quantification is available.

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
the team-size statement); reporting this as a Failure merely because nothing was derived — per
`REQUIREMENT_SPEC.md`'s Failed definition, Failure is reserved for a *structurally malformed* eligible
`IntentSpec` (e.g. a Requirement's would-be basis citing a Claim/Open-Item ID that doesn't resolve),
not for a well-formed input that simply supports no formal Requirements; an emptiness-driven "Failed"
verdict is itself the error this prohibition exists to catch.

**Provenance expectations:** The empty Requirement set's absence of content is itself the artifact —
no fabricated provenance is needed or permitted to justify it.

**Eligibility:** Complete, with zero Requirements. (Contrast: Failed would require the source
`IntentSpec` to be internally malformed in a way that blocks processing — broken cross-references,
structure inconsistent with `INTENT_SPEC.md`'s own invariants — not merely thin or entirely
descriptive. This case's Claims are well-formed and exhaustively accounted for; there is no structural
defect to trigger Failed, however little normative content the input happened to contain.)
