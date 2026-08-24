# RequirementSpec Schema Mapping

Status: M0 Step 03B machine-readable mapping for the semantic contract in
[REQUIREMENT_SPEC](./REQUIREMENT_SPEC.md) (`ADR-0003`, Status: **Proposed** — this document's own
existence does not change that Status; see `ADR-0003`'s own "Future Work" and "ADR-0003 Acceptance
Reconsideration" in `.project/REVIEW_STATE.md` for the separate, later human decision this task does
not make). Deliberately separate from [SCHEMA_MAPPING](./SCHEMA_MAPPING.md) (Step 02B,
`UserIdea`/`IntentSpec`) and [MEMORY_CONTEXT_SCHEMA_MAPPING](./MEMORY_CONTEXT_SCHEMA_MAPPING.md)
(`MemoryContext`), which this document does not restate or supersede.

## 1. Status / Purpose

This is the first machine-readable representation of `RequirementSpec`. It exists to let a
deterministic validator prove a serialized `RequirementSpec` document conforms to `REQUIREMENT_SPEC.md`'s
structural invariants wherever that is mechanically possible — never to redefine what `RequirementSpec`
*means*. Schema design was deliberately deferred by `ADR-0003`'s own "Future Work" until this task;
`REQUIREMENT_SPEC.md`'s own R-01–R-24 are the frozen input this document represents, not a draft it
improves.

## 2. Semantic-Owner vs. Machine-Representation Boundary

```text
REQUIREMENT_SPEC.md                              = semantic OWNER (frozen input to this task)
schemas/m0/requirement-spec.schema.json           = machine representation (this task, new)
docs/contracts/REQUIREMENT_SPEC_SCHEMA_MAPPING.md = this document (enforcement-boundary map)
tests/contracts/validate-contracts.mjs            = deterministic structural/cross-artifact enforcement
tests/contracts/fixtures/**                       = executable adversarial examples
```

Mirrors exactly the relationship [SCHEMA_MAPPING](./SCHEMA_MAPPING.md) already established for
`IntentSpec` and [MEMORY_CONTEXT_SCHEMA_MAPPING](./MEMORY_CONTEXT_SCHEMA_MAPPING.md) for
`MemoryContext`. When this document and `REQUIREMENT_SPEC.md` disagree, `REQUIREMENT_SPEC.md` is
correct and this document is stale.

## 3. Validation Boundary

`schemas/m0/requirement-spec.schema.json` uses JSON Schema Draft 2020-12 and defines the serialized
shape of one `RequirementSpec` version. `tests/contracts/validate-contracts.mjs`'s
`validateRequirementSpec` adds deterministic cross-artifact checks against a **required** companion
`IntentSpec` (the version `RequirementSpec` claims to have consumed) and, wherever an R-24 citation is
present, a companion `MemoryContext`. It does not, and cannot, determine: whether a clause's free-text
`statement` faithfully captures what its basis Claim(s) actually say; whether a Requirement-Level
Inference's `reasoning` genuinely holds under every materially plausible reading (the operational test
in "Requirement-Level Inference"); whether a working default's `value` is genuinely a defensible
internal/measurement parameter as opposed to a disguised want-level choice; whether a satisfaction
procedure's structural shape is *substantively* faithful and maximally determinate for real
candidates; or whether R-19's fillability test was correctly applied to a given Unknown. All of these
require semantic judgment this single-artifact-plus-companions validator cannot perform — exactly the
same class of limitation [SCHEMA_MAPPING](./SCHEMA_MAPPING.md) and
[MEMORY_CONTEXT_SCHEMA_MAPPING](./MEMORY_CONTEXT_SCHEMA_MAPPING.md) already document honestly for
their own contracts (e.g. I-05, M-19).

Classifications carry the identical meaning already established:

- **Schema-enforced** — JSON Schema alone enforces the full invariant.
- **Validator-enforced** — the deterministic validator enforces the full invariant where JSON Schema
  alone cannot express it.
- **Schema + Validator-enforced** — both layers jointly enforce the full invariant.
- **Not enforceable at this layer** — correctness requires semantic judgment, cross-version history,
  or behavior outside a single-artifact-plus-companions validator's reach. A row stays in this class
  even when schema or validator checks supply a useful partial structural guard — the row names that
  guard explicitly rather than overclaiming full enforcement.
- **Not applicable** — the invariant concerns a different artifact's own behavior this schema could
  not express even in principle.

## 4. Companion-Artifact Model

`RequirementSpec` always requires exactly one companion `IntentSpec` — the exact version named by
`consumed_intent_spec` — since every Requirement's provenance resolves against it (Input Eligibility;
R-01). An R-24 memory-informed rationale additionally requires a companion `MemoryContext` bound to
`consuming_stage: "requirement_derivation"`.

**Multi-companion fixture harness (new).** The existing single-`companion` fixture shape
([SCHEMA_MAPPING](./SCHEMA_MAPPING.md)'s Dependency-B pattern) supports exactly one companion
document — insufficient here, because a `RequirementSpec` fixture may need *simultaneously*: (1) its
consumed `IntentSpec`, and (2) one or more `MemoryContext` documents for R-24 citations, and,
separately, (3) the consumed `IntentSpec` may itself carry a Dependency-B memory reference needing
*its own*, differently-bound `MemoryContext` companion. `validate-contracts.mjs` adds
`fixture.companions` (plural, an array of `{contract, document}` pairs) alongside the existing
singular `fixture.companion`, which keeps working unchanged — none of the existing 85 fixtures were
rewritten. Every companion is resolved by its own stable identity (`intent_spec_id`@`version`, or
`memory_context_id`) out of the full flat companions list, never by array position — so a
`RequirementSpec` citing two differently-bound `MemoryContext` documents (one via its `IntentSpec`
companion's own Dependency-B citation, one via its own R-24 citation) resolves each correctly. **Each
companion contract's identities are also validator-checked unique** within the supplied set
(`intent_spec_id`@`version` for `intent-spec` companions, `memory_context_id` for `memory-context`
companions) — resolving by identity is only genuinely position-independent if identities cannot
collide; two companions sharing an identity would otherwise resolve to whichever happens to appear
first in the array, silently (`requirement-spec-r11-duplicate-companion-intentspec.json`). See
`requirement-spec-multi-companion-nested-resolution.json` for an end-to-end demonstration. No generic
artifact-graph framework was built — resolution is purpose-built to exactly the two lookups this task
needs (`intent_spec_id@version`, `memory_context_id`).

## 5. Failed-Outcome Serialization Decision and Its Basis

**Decision: a "Failed" Requirement Derivation run produces no `RequirementSpec` artifact at all —
never a serialized document with `status: "failed"`.** The schema's `status` field is a closed
two-value enum, `"complete" | "partial"`; there is no third value, and one invalid fixture
(`requirement-spec-au-failed-status-not-representable.json`) proves the schema rejects
`status: "failed"` outright.

**Textual basis**, independently re-derived per the task's own Section 7 instruction, not assumed:

- `M0_SCOPE.md`'s "Cross-Cutting: Stage Failure and Revision" — the cross-cutting rule every M0 stage
  follows — states a stage may, "**instead of producing its declared output artifact**, report that
  it cannot," and that "'no valid output' is an acceptable, explicit stage result." A stage's failure
  response is framed as *not producing the artifact*, not as a degraded variant of it.
- `INTENT_SPEC.md`'s own, structurally identical precedent: "Intent Parsing may return an explicit
  failure **instead of any `IntentSpec` — Blocked or otherwise**" ("Failure Semantics"), and
  `intent-spec.schema.json`'s own top-level description already states this in exactly these words:
  "Failed parsing produces no IntentSpec." `RequirementSpec`'s Failed case is the direct analogue one
  stage later.
- `REQUIREMENT_SPEC.md`'s own framing of Failed: "Requirement Derivation **cannot even attempt**
  honest compilation," and "Failed means '**I cannot even examine this input**' " — language about the
  *attempt* never occurring, not about a completed-but-degraded artifact.
- `REQUIREMENT_SPEC.md`'s own contrast is explicit about what Failed is *not*: "Failed is **not** what
  happens when the input is well-formed but simply supports no formal Requirements — that case... is a
  valid **Complete** output." This confirms `status: "complete"` with `requirements: []` (R-17, Case
  17) is the correct representation for "nothing to derive," which is categorically different from
  Failed and must never be confused with it in either direction.

This is a representation decision determined by the existing contract text, not a new semantic rule
this document invents — matching the same "Failed produces no artifact" shape `intent-spec.schema.json`
already committed to one stage earlier, for the same textual reasons.

## 6. Complete/Partial Representation

`status` is a document-level field (R-16: distinct from any individual Requirement's own `valid`/
`invalidated` status). The validator enforces the **necessary direction only** — it can prove a
document must be `"partial"` from certain structural facts, but cannot prove a document is genuinely
`"complete"` (correctness of *not* having missed a gap is semantic):

- Any top-level `open_items` entry of kind `ambiguity`, `conflict`, `unfillable_unknown`, or
  `unresolved_constraint_candidate` forces `status: "partial"` — validator-enforced, no exception.
- Any clause with `testability.status: "blocked"` forces `status: "partial"` — validator-enforced.
- An `unfilled_r19_unknown` open item does **not**, by itself, force `"partial"` (Case 25's second
  branch: an unfilled R-19-eligible Unknown that no clause's testability actually depends on leaves the
  document `"complete"`) — demonstrated by `requirement-spec-ad-complete-with-unfilled-r19-unknown.json`.
- R-17 (Complete with zero Requirements) is schema-enforced by the absence of any `minItems` on
  `requirements` — demonstrated by `requirement-spec-ad2-complete-zero-requirements.json`.

**Testability (R-21)** is per-clause, not per-Requirement (Case 11: one combined Requirement can have
both Complete and testability-blocked clauses simultaneously). `clause.testability` is a closed
three-shape union:

- `complete_binary` — a plain two-valued procedure. This layer records only that the clause *claims*
  this shape; it cannot execute or prove the procedure's own substantive correctness — a self-reported
  `"complete_binary"` is not proof of R-21 correctness, exactly as the task's own Section 20 warns.
- `complete_indeterminate` — the narrow, legitimate three-valued case. **Condition 1** (the routing
  item must be a surviving Unknown, never an Ambiguity or Conflict) is validator-enforced:
  `grounding_open_item_id` must resolve to a companion open item of kind `"unknown"`
  (`requirement-spec-ag-ambiguity-indeterminate-laundering.json` proves an `"ambiguity"`-kind item is
  rejected here). **Condition 2** (the admissible reading domain must be genuinely closed and
  `IntentSpec`-grounded, never invented) is **Not enforceable at this layer**: `intent-spec.schema.json`'s
  own `"unknown"` shape carries no structured candidate-reading field to check `admissible_readings`
  against — only `"ambiguity"` has one. This is a real, named representability gap in the upstream
  contract's own machine form, not a gap this schema introduces or could unilaterally close without a
  separate, out-of-scope `intent-spec.schema.json` amendment.
- `blocked` — testability-blocked; forces the document `"partial"`.

## 7. Provenance Model

Every direct-compilation clause's `basis` is one or more `claim_id` references into the consumed
`IntentSpec` (R-01) — deliberately **claim-only**, not the `open_item_id` generality
`REQUIREMENT_SPEC.md`'s provenance text also allows for a Requirement's provenance in general: an Open
Item carries no force to map a strength from, so it can never legitimately be a clause's *normative*
basis. A surviving Open Item's two legitimate roles live elsewhere in this schema instead — filling a
detail within an already-settled clause (`working_defaults.source_open_item_id`) or grounding a
clause's own `complete_indeterminate` branch (`testability.grounding_open_item_id`) — never as if it
were itself a strength source. `basis: []` is schema-rejected (`minItems: 1`, R-01;
`requirement-spec-o-zero-provenance-refs.json`); a non-resolving `claim_id` is validator-rejected
(`requirement-spec-p-unresolved-claim-ref.json`).

**R-02** (a force-absent descriptive Claim never becomes normative basis by itself) is
validator-enforced: every `basis` claim's mapped strength (§9) must be non-null, so a force-absent
claim in `basis` fails deterministically (`requirement-spec-g-descriptive-claim-not-basis.json`).
`rationale_refs` is a structurally separate array for exactly this descriptive-claim role
(`requirement-spec-h-descriptive-claim-as-rationale.json`) — removing it changes nothing about the
clause's normative content, matching R-02's own "removing rationale must leave the normative
proposition... completely unchanged."

**Origin/confidence/provisional standing** (`origins`, `derivation_confidences`, `provisional`) are
duplicated directly on each direct-compilation clause, not left as an implicit fact only discoverable
by re-resolving `basis` into the companion `IntentSpec` — mirroring how `intent-spec.schema.json`
itself keeps a Claim's own origin self-contained rather than requiring a lookup into `UserIdea`.
**`origins` and `derivation_confidences` are sets (arrays), not single scalars**, deliberately: an
earlier draft of this schema used single-valued `origin`/`derivation_confidence` fields and rejected
any clause whose basis Claims disagreed on origin or confidence — but "Requirement Cardinality and
Granularity" explicitly permits several Claims of *different* origins to jointly define one testable
behavior (e.g. a User-Provided obligation corroborated by a separately-reasoned Inferred one), and
"Information-Loss Rules" forbids collapsing that distinction into one summary value. A single-origin
clause is simply the common case of this array holding one element
(`requirement-spec-r1-mixed-origin-basis-one-clause.json` exercises the genuinely mixed case). The
validator cross-checks both arrays against the resolved `basis` claims' own origin/confidence values
for exact set-equality, so self-contained readability never diverges from cross-artifact truth.

Provisional-standing requirements are **origin-conditioned, not uniform**, per "Treatment of Claim
Origin": `origins` containing only `"user_provided"` forbids `provisional`; containing `"inferred"`
requires it, with a settled exception allowed (`provisional: false` + `settled_rationale`, "silence is
not that statement" — `requirement-spec-i-inferred-obligation-must.json`); containing `"assumed"`
requires it **unconditionally**, with **no** settled exception (`requirement-spec-j-assumed-obligation-must-provisional.json`
for the compliant case, `requirement-spec-r2-assumed-missing-provisional.json` and
`requirement-spec-r3-assumed-recorded-settled.json` for the two ways this is now rejected) — "Treatment
of Claim Origin" states Assumed origin "does require... provisional and reversible" flatly, with no
stated escape, unlike the explicit "may instead record it as settled" clause given only to Inferred
content. `reversible` is validator-checked to be exactly `true` whenever `provisional: true`
(`requirement-spec-r4-provisional-not-reversible.json`) — an earlier draft of this validator declared
`reversible` in the schema but never actually read it.

**R-07** (condition preservation): `scope_condition` structural presence is validator-enforced
whenever any basis claim itself carries one; faithful preservation of the condition's exact logical
meaning ("only if" never becoming "if and only if") is **Not enforceable at this layer** — a free-text
comparison this validator does not attempt. This structural check also applies to a
Requirement-Level-Inference clause premised on a conditional claim or Requirement — see §8.

**R-08** (never resolves a surviving Ambiguity/Conflict): the Conflict half is validator-enforced for
**both** clause shapes — a direct-compilation clause's `basis`, and a Requirement-Level-Inference's
`premise` (when `kind: "claim"`), may never cite a claim that participates in an unresolved Conflict in
the companion `IntentSpec` (`requirement-spec-aa-conflict-resolved-by-rd.json`,
`requirement-spec-r17-rli-premise-conflicted-claim.json` — an earlier draft of this validator checked
only the direct-compilation path, leaving the RLI path an unguarded bypass). The Ambiguity half is
**Not enforceable at this layer**: unlike a Conflict, an Ambiguity's candidate readings are not Claims a
clause could cite as basis or premise, so there is no analogous structural hook — whether a clause's
content silently depends on resolving a surviving Ambiguity is a semantic-content judgment,
reviewer-only.

## 8. Requirement-Level Inference Representation

A `requirement_level_inference` clause is a **structurally distinct shape** from a direct-compilation
clause (`derivation` discriminates the two) — it carries `premise`/`reasoning`/`provisional`, never
`basis`/`origin`/`derivation_confidence`. This directly represents R-10's requirement that an RLI be
"labeled as a Requirement Derivation inference, never folded into or presented as an `IntentSpec`
Inference": the two are different JSON Schema shapes entirely, not a shared shape with a label field.

**R-23 is schema-enforced, not merely discouraged.** `requirementLevelInferencePremise` is a closed
`oneOf` with exactly two members — `{kind: "claim", claim_id}` and `{kind: "requirement", requirement_id}`
— and no third shape exists anywhere in
the schema for a `MemoryContext` reference to occupy. `requirement-spec-v-rli-memory-premise-impossible.json`
demonstrates that attempting `{kind: "memory_context", ...}` fails at the JSON Schema layer itself,
before any semantic validation runs at all — R-23 "must be impossible structurally where practical"
(task Section 15) is satisfied by construction, the strongest available form of enforcement.

**R-22 × mixed-strength Requirement (task Section 16).** A whole Requirement may serve as a premise
only when every one of its clauses shares one strength
(`requirement-spec-r15-rli-whole-requirement-premise.json`). A mixed-strength Requirement is rejected
outright with no clause-level fallback
(`requirement-spec-r16-rli-whole-requirement-mixed-strength.json`). Clause-level citation is not
authorized by the frozen text; `requirement-spec-t-requirement-clause-kind-rejected.json` proves the
removed shape is schema-rejected.

**RLI premise on an invalidated Requirement is rejected.** "Requirement Invalidation and
Re-Derivation" treats an inference whose premise no longer holds as itself unsupported; the validator
checks invalidation as applicable for both premise shapes
(`requirement-spec-r14-rli-on-invalidated-requirement.json`).

**R-07 propagates through an RLI premise.** A Requirement-Level-Inference clause now carries its own
optional `scope_condition`, structurally required whenever its resolved premise (a claim's, or a
premise Requirement's own) carries one — otherwise a condition preserved through a
direct-compilation clause could be silently dropped exactly one inference-step later
(`requirement-spec-r18-rli-drops-scope-condition.json`). For a whole-Requirement premise with more than
one clause, this check is skipped rather than guessing which clause's condition should propagate — Not
enforceable at this layer for that specific sub-case, disclosed here rather than silently unchecked.

**R-10/R-22 acyclicity.** The RLI premise graph over `clause_id`s (edges from `premise.kind ===
"requirement"` fan out to every clause of the premise Requirement; Claim premises add no clause edge)
must be acyclic for both premise shapes — validator-enforced with the same visiting/visited DFS
pattern `validateIntentSpec` already uses for its own Inference-premise
acyclicity, extended to catch a clause premising on itself too
(`requirement-spec-u-rli-cycle.json`).

## 9. R-19/R-24 Representation

**R-19 working defaults** (`clause.working_defaults[]`) are attached to the already-settled clause
they fill a detail *within* — never a freestanding Requirement of their own — directly representing
"the value selects an internal implementation... detail *within* an already-settled Requirement."
Validator-enforced: `source_open_item_id` must resolve to a companion open item of kind `"unknown"`,
never `"ambiguity"` (`requirement-spec-z-ambiguity-filled-as-default.json`) and never a manufactured ID
(`requirement-spec-ab-invented-unknown-source.json`). **Whether the Unknown genuinely passes R-19's own
fillability test — an internal/measurement detail versus a want-level, user-facing-scope question — is
Not enforceable at this layer**: it is a semantic content judgment (Case 4 vs. Case 10's own worked
contrast), not a structural fact this validator can compute from field shapes alone.

**R-24 memory-informed rationale** is the deepest cross-artifact check this validator performs,
mirroring `MEMORY_CONTEXT_SCHEMA_MAPPING.md`'s M-21 rigor from the other side. Given a
`working_default.memory_informed_rationale`, the validator requires, against a resolved companion
`MemoryContext` (identity-matched by `memory_context_id`):

- the entry resolves and is **admitted**, not excluded (`requirement-spec-am-r24-excluded-entry-rejected.json`);
- the companion's `consuming_stage` is exactly `"requirement_derivation"`
  (`requirement-spec-an-r24-wrong-consuming-stage.json`);
- the entry's `influence_tier` is exactly `"DECISION_OPTION"`
  (`requirement-spec-al-r24-wrong-influence-tier.json`);
- **Gate 2**: the entry's `is_historical_user_statement` is `false` — categorically, independent of
  Category A/B — mirroring `MEMORY_CONTEXT.md`'s "No Assumed-Origin Path for Memory." Because
  `validateMemoryContext` (M-21) already forbids `is_historical_user_statement: true` from ever
  carrying `influence_tier: "DECISION_OPTION"` on the *companion* side, a fixture attempting a
  historical Category A/B entry at `DECISION_OPTION` is rejected one layer earlier, at companion
  validation, before `RequirementSpec`'s own R-24 check ever runs
  (`requirement-spec-aj-r24-historical-category-a-rejected.json`,
  `requirement-spec-ak-r24-historical-category-b-rejected.json`). `RequirementSpec`'s own validator
  additionally, redundantly re-checks `is_historical_user_statement` as defense in depth, in case a
  future fixture or harness change ever makes constructing an inconsistent companion possible;
- **any companion MemoryContext bound to `consuming_stage: "requirement_derivation"` must carry a
  non-null `upstream_artifact_binding`**, naming `artifact_type: "intent_spec"` and matching the exact
  `consumed_intent_spec` identity (`requirement-spec-ao-r24-wrong-upstream-binding.json` for a
  wrong-version binding; `requirement-spec-r19-null-upstream-binding-rejected.json` for a null one). An
  earlier draft of this validator allowed a null binding here, mirroring Intent Parsing's own
  permissive null-allowed pattern for a `DISCOVERY_ATTENTION` retrieval that is genuinely
  version-independent — but per `M0_SCOPE.md`'s "Stage: Requirement Derivation," this MemoryContext's
  own retrieval purpose exists *only after* a specific surviving Unknown in a specific `IntentSpec`
  version has already been established as R-19-eligible, so a version-independent retrieval never
  legitimately arises here; the null-allowed exception was a genuine gap, now closed;
- `rationale` (independent R-09/R-19 justification) is always required alongside
  `memory_informed_rationale`, never replaced by it — schema-enforced (`rationale` is a required field
  of `workingDefault` regardless of whether a memory citation is present);
- **no vote, no repetition, no confidence authority**: nothing in the schema or validator counts,
  ranks, or aggregates multiple admitted `DECISION_OPTION` candidates — there is no field for it to
  read even if it wanted to. `requirement-spec-aq-multiple-disagreeing-memories-no-voting.json`
  demonstrates three disagreeing admitted candidates coexisting while Requirement Derivation adopts a
  fourth, independently-chosen value, citing only one candidate as rationale (never all three, never
  the "most common" one) — nothing about that scenario trips any check, which is itself the proof there
  is no aggregation mechanism to trip;
- **memory citation never replaces ordinary provenance**: structurally impossible by construction — a
  clause's `basis` (its ordinary provenance) is always independently required (`minItems: 1`) whether
  or not `working_defaults` is present at all; the two fields cannot substitute for each other;
- **one surviving Unknown is filled at most once, document-wide.** `source_open_item_id` is
  validator-checked unique across every `working_defaults` entry in the whole document, whether or not
  a memory citation is attached — not merely unique per `(source_open_item_id, memory_context_id,
  entry_id)` triple, which an earlier draft used and which left two *different* memory citations (or
  two plain, uncited fills) proposing contradictory values for the same Unknown undetected
  (`requirement-spec-r13-double-fill-same-unknown.json`). This is also what makes the "no vote"
  guarantee above actually load-bearing: without it, a document could structurally record an
  Unknown "filled" by several disagreeing candidates at once, which is the one shape that would
  actually resemble an unweighted aggregation.
- **a surviving Unknown cannot be both `unfillable_unknown` and filled.** The set of top-level
  `unfillable_unknown.source_open_item_id` values and the set of `working_defaults[].source_open_item_id`
  values are validator-checked disjoint — a document cannot record the same Unknown as simultaneously
  failing R-19 (Gate 1) and successfully filled under it
  (`requirement-spec-r12-unfillable-and-filled-contradiction.json`).

**R-19 auditability has three conceptually distinct components, only two of which this schema
separately serializes.** (A) Gate-1 eligibility -- why the surviving Unknown is R-19-eligible at all;
(B) value-selection defensibility -- why this specific chosen value is independently defensible; (C)
R-24 memory-candidate consideration -- why a specific admitted `DECISION_OPTION` entry was considered.
REQUIREMENT_SPEC.md's own text unifies (A) and (B) into one combined justification -- "its own stated
rationale under R-09 must justify the value defensibly under R-19 on its own terms" ("Memory-Informed
R-19 Working Defaults") -- never asking for two separately-serialized sub-rationales, so the single
required `rationale` field is a faithful representation of that unified requirement, not a
schema-convenience collapse of two things the frozen text keeps apart. (C) is the one component the
frozen text does keep textually separate -- "the memory may explain *why the candidate was
considered*; it can never supply *why it is correct*" -- and the schema mirrors that split exactly:
`memory_informed_rationale` is its own, optional, distinctly-shaped field, never merged into
`rationale`. **Not enforceable at this layer**: whether the single `rationale` field's free text
actually addresses both (A) and (B), as opposed to only one of them, is a substantive-content judgment
this validator cannot perform -- the same class of limitation as R-09/R-11's free-text smuggling gaps.

**Whether the adopted `rationale`'s substantive content is genuinely independent** — as opposed to a
reworded "because memory said so," or a claim about external fact memory cannot establish (Case 28) —
is **Not enforceable at this layer**, the same class of limitation `INTENT_SPEC.md`'s own
`force_reasoning` substantive-independence question already carries (I-26).

## 10. Versioning/Invalidation Representation

`requirement_spec_id`/`version`/`supersedes_requirement_spec_id` mirror the pattern
`intent-spec.schema.json` already established. **`revision` and `requirement.invalidation` are both
present (though nullable) in the schema's own `required` lists** — an earlier draft left both merely
`anyOf [X, null]`-typed without adding them to `required`, which let a document *omit* either key
entirely; the validator's own `!== null` checks then silently passed on `undefined` (JavaScript's
`undefined !== null` is `true`), so a `status: "invalidated"` Requirement that simply never wrote an
`invalidation` key at all satisfied the check meant to require one. Making both keys schema-required
(present, possibly `null`) closes that gap structurally, and the validator's existing `!== null` logic
is now sound because the field is guaranteed present. `revision` is validator-required non-null exactly
when `version > 1` (`requirement-spec-r7-version2-missing-revision.json`), and required `null` at
`version === 1`; `revision.trigger` is a closed enum of `REQUIREMENT_SPEC.md`'s own named reasons
(never an open string a caller could use for an unexplained rewrite); and a present `revision` must name
at least one of `affected_requirement_ids`/`affected_open_item_ids`
(`requirement-spec-r8-revision-affects-nothing.json`) — "Requirement Identity and Versioning" requires
recording which Requirement(s)/Open Item(s) a revision affects, so a revision naming neither is not a
revision at all. `requirement.status`/`invalidation` (R-14) keep an invalidated Requirement in the
array, schema-required to carry a `reason` when present, rather than deleting it —
`requirement-spec-ar-invalidated-requirement.json` demonstrates the shape;
`requirement-spec-as-supersession-revision-shape.json` demonstrates a full version-2 supersession.
The validator now also requires `supersedes_requirement_spec_id` to be `null` at version 1 and
non-null above version 1 (R-12/R-13). When RequirementSpec companions are supplied, that ID must
resolve to a companion whose version is exactly the immediately preceding version. Every ID in
`revision.affected_requirement_ids` and `revision.affected_open_item_ids` must resolve within the
current RequirementSpec, and every `status: "invalidated"` Requirement must be named by a non-null
revision's `affected_requirement_ids`; invalidation cannot appear as a bare status on an original
version.

Clause cross-reference validation is deliberately skipped for an invalidated Requirement. Such a
clause is a historical record validated against the IntentSpec version from which it was derived;
requiring its old `basis`, `premise`, `rationale_refs`, or `working_defaults` references to resolve
against the current superseding IntentSpec incorrectly rejected the exact stale-premise lifecycle
that "IntentSpec Supersession Effects" and "Requirement Invalidation and Re-Derivation" define.
The upgraded `requirement-spec-ar-invalidated-requirement.json` and
`requirement-spec-as-supersession-revision-shape.json` fixtures now supply prior IntentSpec and
RequirementSpec companions, proving mutually consistent four-artifact lifecycles from IntentSpec v1
and RequirementSpec v1 through their v2 artifacts (invalidation and stable-identity revision,
respectively).

This still does NOT prove that the historical version was never mutated in place in real storage --
only that the artifacts supplied together in one validation run are mutually consistent.
**Not enforceable at this layer, mirroring UI-01/I-13 exactly**: that a "past" `RequirementSpec`
version was genuinely never mutated in place, that the `affected_requirement_ids`/`affected_open_item_ids`
named actually correspond to what changed, and that a `revision`'s stated `trigger`/`basis` honestly
reflects what actually happened, all require cross-version storage behavior this single-artifact
validator cannot observe.

**Invalidated-Requirement clause validation is conditional on a resolvable prior companion, not
unconditionally skipped.** When a companion prior `RequirementSpec` is supplied and its own
`consumed_intent_spec` resolves to a supplied prior IntentSpec companion, an invalidated Requirement's
clauses ARE validated -- basis/premise resolution, strength/origin mapping, R-07/R-08 guards,
`working_defaults` resolution -- against THAT prior IntentSpec, never the current one (which may have
withdrawn the Claim this Requirement was originally derived from). This closes the gap where an
invalidated Requirement could cite a fabricated historical Claim, or record a strength/origin
inconsistent with its actual historical basis, undetected
(`requirement-spec-r41-invalidated-fabricated-historical-claim.json`). Historical content never
contributes to the current version's own blocking/partial-status or R-19 working-default accounting.
**Not enforceable at this layer only when no prior RequirementSpec/IntentSpec companion pair is
supplied at all** -- in that narrower case, historical well-formedness remains entirely unverified, as
before.

## 11. R-01 Through R-24 Table

| Invariant | Classification | Mapping and limitation |
|---|---|---|
| R-01 Zero provenance is malformed | Schema + Validator-enforced | `basis` requires `minItems: 1` (schema); every `claim_id` must resolve in the companion `IntentSpec` (validator). |
| R-02 Descriptive Claim never normative basis alone | Validator-enforced | Every `basis` claim's mapped strength (§9) must be non-null; a force-absent claim fails. `rationale_refs` is the structurally separate, correct home for a descriptive claim. |
| R-03 Inferred strength = force, never capped by confidence | Validator-enforced | Strength check never reads `derivation_confidences` at all — non-inflation-by-confidence holds by construction, not merely by convention. |
| R-04 Assumed strength = force; provisional/reversible required, unconditionally | Validator-enforced | Same strength check; `origins` containing `"assumed"` requires `provisional: true`/`reversible: true` with **no** settled exception (§7) — stricter than the Inferred case, and now actually checked (`reversible` was previously declared in the schema but never read). |
| R-05 Preference never MUST; permission never MUST/SHOULD | Validator-enforced | The Force → Strength table (`FORCE_TO_STRENGTH`) has no path from `preference`/`permission` to `MUST`/`MUST_NOT`, or from `permission` to `SHOULD`, at all; a `preference` claim whose own `strength` sub-field was never recorded maps to no strength at all (`mappedStrength` returns `null`), never silently defaulting to the stronger `SHOULD` reading — `requirement-spec-r6-preference-no-strength-not-basis.json`. |
| R-06 Obligation never weaker than MUST; prohibition never weaker than MUST NOT | Validator-enforced | The same table maps `obligation`/`prohibition` to exactly `MUST`/`MUST_NOT` — equality, not merely a floor, so this is fully covered. |
| R-07 Condition preserved, never flattened/strengthened to biconditional | Validator-enforced (structural presence, on both clause shapes) + Not enforceable at this layer (semantic fidelity) | A direct-compilation clause must carry `scope_condition` whenever any basis claim does; an RLI clause must carry one whenever its resolved premise does (§8). Whether the recorded text preserves the exact "only if" (not "if and only if") relation is a free-text judgment. |
| R-08 Never resolves a surviving Ambiguity/Conflict | Validator-enforced (Conflict, on both clause shapes) + Not enforceable at this layer (Ambiguity) | Neither a direct-compilation clause's `basis` nor an RLI's `premise` may cite a Conflict-participant claim (§7/§8). No analogous structural hook exists for a surviving Ambiguity, since its candidate readings are not Claims a clause could cite. |
| R-09 RD-introduced default + R-24 citation distinctly labeled | Validator-enforced (structural guards) + Not enforceable at this layer (R-19-inherited eligibility judgment; rationale genuineness) | `working_defaults[]` structurally requires `rationale`; `memory_informed_rationale` is a separate, optional, distinctly-shaped field, resolved against a companion `MemoryContext` when present (§9); `source_open_item_id` uniqueness is document-wide. Not provable: whether the filled Unknown was genuinely R-19-eligible -- R-09 is explicitly "Subject to R-19's eligibility test," and R-19's own content judgment is itself unenforceable at this layer, a gap R-09 inherits; whether the stated `rationale` is a genuine, independently-reasoned justification rather than a restated or laundered one. |
| R-10 RLI states premise/reasoning, distinctly labeled | Schema + Validator-enforced | `requirement_level_inference` is a wholly separate clause shape from `direct_compilation` (never folded together); premise resolution is validator-enforced whichever of the two premise shapes is used (§8). |
| R-11 No architecture/technology evaluation/selection | Not enforceable at this layer | The schema defines no dedicated evaluation/comparison/selection field anywhere (a structural absence guard, not proof) — free-text `statement`/`value`/`reasoning` content could still smuggle it; only reviewer judgment catches that. |
| R-12 Identity persists; revision supersedes, never mutates in place | Schema + Validator-enforced (version/supersession structure) + Not enforceable at this layer (non-mutation proof) | `version === 1` requires `supersedes_requirement_spec_id: null`; `version > 1` requires it non-null; when a companion prior `RequirementSpec` is supplied, its `requirement_spec_id` and sequential version (`document.version - 1`) are validator-checked (§10). Not provable: that a "past" version was genuinely never mutated in place in real storage requires cross-version storage behavior this single-artifact validator cannot observe; when no companion prior version is supplied, supersession-target consistency is simply unchecked. |
| R-13 Supersession requires reconsideration | Validator-enforced (structural) + Not enforceable at this layer (substantive correctness) | `revision` required non-null at `version > 1`; must name at least one affected Requirement/Open Item; every `affected_requirement_ids`/`affected_open_item_ids` entry must now resolve to a real id in this document (§10). Not provable: whether every Requirement whose provenance transitively traces to now-superseded content was actually named and reconsidered, or whether a reconsideration's own outcome was substantively correct -- both require semantic cross-version comparison. |
| R-14 Invalidated marked, never deleted | Schema + Validator-enforced (marking) + Not enforceable at this layer ("never deleted") | `invalidation` is schema-required (present-but-nullable); the validator requires it non-null exactly when `status: "invalidated"`, requires a `reason` when present, and now additionally requires every invalidated Requirement's id to be named in a non-null `revision.affected_requirement_ids` (§10) -- invalidation is tied to a real versioned revision event, not a bare status. Not provable: that a Requirement known to a prior version was not simply dropped from a new version's `requirements` array rather than carried forward invalidated -- nothing currently cross-checks a new version's full requirement set against a prior version's, even when a companion prior `RequirementSpec` is supplied; only `requirement_id`s explicitly named in `revision.affected_requirement_ids` are ever checked. |
| R-15 Cardinality unconstrained both ways | Schema-enforced | No cardinality constraint beyond `clauses` `minItems: 1`; `basis` may cite one or many claims, and one claim may appear in many clauses' `basis` across many Requirements. |
| R-16 Complete/Partial distinct from per-Requirement validity | Schema-enforced | `status` is document-level; `requirement.status` is an independent, separate field. |
| R-17 Empty Requirement set, Complete, is valid | Schema-enforced (shape) + Not enforceable at this layer (substantive justification) | No `minItems` on `requirements` permits the empty-Complete shape. Not provable: whether the consumed `IntentSpec` genuinely supports no formal Requirements at all -- that is a content judgment, not a structural one. |
| R-18 Repetition never increases confidence/certainty | Not enforceable at this layer | Requires cross-version/cross-run comparison this single-artifact validator cannot perform, the same class as I-16/M-07. |
| R-19 Fillability test (internal detail vs. user-facing scope) | Not enforceable at this layer (content judgment) + Validator-enforced (structural guards) | The genuine fillability judgment is semantic. Structurally guarded: the filled item must be a companion `"unknown"`, never `"ambiguity"`, and never a manufactured ID; a document cannot record the same Unknown as both `unfillable_unknown` (fails Gate 1) and filled by a `working_default` (§9). |
| R-20 Unresolved constraint-candidate (binding, force never resolved) | Validator-enforced (structural) + Not enforceable at this layer (binding-vs.-descriptive distinction) | `source_claim_id` must resolve and be force-absent. Whether a force-absent claim is genuinely "binding/constraining" (R-20) versus purely descriptive (R-02) is itself undecidable from `intent-spec.schema.json` alone — that schema does not structurally distinguish the two; both simply omit `force`. |
| R-21 Satisfaction procedure / Complete-Partial / INDETERMINATE conditions | Validator-enforced (condition 1: routing item must be `"unknown"`, never `"ambiguity"`/`"conflict"`) + Not enforceable at this layer (condition 2's genuine groundedness; the procedure's own substantive faithfulness/determinacy for real candidates) | See §6. `intent-spec.schema.json`'s `"unknown"` shape has no structured reading-domain field to check `admissible_readings` against. |
| R-22 RLI strength = premise strength exactly | Validator-enforced | Exact equality against the resolved premise's strength, whichever of the two premise shapes is used: a Claim (mapped force) or a whole Requirement (single strength across all its clauses, or rejected as undefined) (§8). Also rejects a premise on an invalidated Requirement. |
| R-23 RLI premise never MemoryContext | Schema + Validator-enforced | `requirementLevelInferencePremise`'s closed `oneOf` has no shape for a `MemoryContext` reference — structurally impossible, not merely unchecked (§8). The validator additionally resolves and checks the status of whichever Claim/Requirement identity the closed shape does name (§8) -- not merely the shape's absence of a MemoryContext option. |
| R-24 Memory-informed rationale (Gate 2, provenance-additional, no voting, one fill per Unknown) | Validator-enforced (structural guards) + Not enforceable at this layer (independent-selection/non-laundering judgment) | Mechanically checkable (§9): exact `MemoryContext` identity resolution; entry admitted; `consuming_stage` `requirement_derivation`; classification `DECISION_OPTION`; non-historical (`is_historical_user_statement: false`); correct `upstream_artifact_binding` to the consumed `IntentSpec` version; `memory_informed_rationale` is additional to, never a substitute for, the always-required independent `rationale`; document-wide one-fill-per-Unknown. Not mechanically provable: that the chosen value was genuinely independently selected under Requirement Derivation's own R-09/R-19 authority; that the stated rationale is a genuine, independently-reasoned justification rather than a restatement of the memory citation; that hidden voting/repetition-based confidence, or the memory entry's own influence, did not secretly shape the reasoning -- all require judging the substance of free-text content and reasoning process, not merely its structural shape. |

## 12. Source Disposition Accounting

RequirementSpec validation is bidirectional: references written by the RequirementSpec must resolve
into its consumed IntentSpec, and relevant source items must also have an explicit disposition in the
RequirementSpec. This directly machine-represents the Complete-outcome rule at
`REQUIREMENT_SPEC.md` lines 725–726 and the Information-Loss Rules at lines 792–796; it adds no new
semantics. Every Claim must contribute through a clause basis, RLI premise, or rationale reference;
be explicitly excluded with a reason; participate in a carried-forward Conflict; or be the source of
an R-20 unresolved constraint-candidate. Ambiguities and Conflicts must be carried forward exactly
once. Unknowns must be filled by one `working_default` or carried forward exactly once as
`unfillable_unknown`/`unfilled_r19_unknown`, never both and never neither.

The optional top-level `excluded_claims` array records deliberate Claim loss. Its entries require a
non-empty `reason`; the validator enforces document-wide `claim_id` uniqueness, companion resolution,
and mutual exclusion from clause basis/premise/rationale citations, Conflict participation, and R-20
sources. Regression coverage is `requirement-spec-r20-*` through `requirement-spec-r26-*`: unaccounted
Claims, dropped Ambiguities/Conflicts/Unknowns, double-disposed Unknowns, and invalid exclusions.
Existing valid coverage was repaired only where source disposition had been implicit:
`requirement-spec-ad2-complete-zero-requirements.json` explicitly excludes descriptive `c1`,
`requirement-spec-i-inferred-obligation-must.json` explicitly excludes redundant premise `c1`, and
`requirement-spec-af-legitimate-r21-indeterminate.json` carries its grounding Unknown forward.

## Adversarial Case-Coverage Notes

Fixture names below correspond 1:1 to the letter items in the task's own coverage matrix (Section 26),
except where noted. `REQUIREMENT_CASES.md` case numbers are cited where a fixture directly follows a
worked example's shape.

- **A–F** (force → strength tiers): `requirement-spec-{a,b,c,d,e,f}-*.json` — Cases 1, 2/Case-shape,
  5's permission pattern, 4's strong preference, a moderate-preference analogue, and a weak-preference
  analogue.
- **G/H** (descriptive claim never basis / allowed as rationale): `requirement-spec-{g,h}-*.json`.
- **I/J** (Inferred/Assumed obligation remains MUST): `requirement-spec-{i,j}-*.json`.
- **K** (condition preserved): folded into `requirement-spec-c-permission-may-condition-preserved.json`
  (Case 5's own shape already combines permission + condition).
- **L/N** (multiple Claims → one Requirement; mixed strength): `requirement-spec-l-n-multi-claim-mixed-strength.json`
  — Case 11's own shape, including its positive clause's testability-blocked status alongside the two
  Complete prohibition clauses.
- **M** (one Claim → multiple Requirements): `requirement-spec-m-one-claim-many-requirements.json` —
  Case 12's own logging/search split, deliberately avoiding Case 12's own named failure mode (assigning
  unstated actor responsibility).
- **O–R** (structural/cross-artifact invalidity): `requirement-spec-{o,p,q,r}-*.json`.
- **S–V** (Requirement-Level Inference shape/acyclicity/impossibility): `requirement-spec-{s,t,u,v}-*.json`.
- **R20-R26** (source disposition accounting -- Claim/Ambiguity/Conflict/Unknown completeness): `requirement-spec-{r20,r21,r22,r23,r24,r25,r26}-*.json`.
- **R27-R32** (invalidation/revision linkage, affected-ID resolution, and sequential RequirementSpec supersession): `requirement-spec-{r27,r28,r29,r30,r31,r32}-*.json`.
- **W/X** (R-22 strength inflation/weakening): `requirement-spec-{w,x}-*.json`.
- **Y/Z/AA/AB** (R-19 fill mechanics and adjacent invalidity): `requirement-spec-{y,z,aa,ab}-*.json`.
- **AC** (R-20): `requirement-spec-ac-r20-unresolved-constraint-candidate.json`.
- **AD/AE** (Complete/Partial document-level shapes): `requirement-spec-ad-*.json`,
  `requirement-spec-ad2-*.json` (Case 25's non-forcing carry-forward branch, and R-17's zero-Requirements
  case), `requirement-spec-ae-*.json`.
- **AF/AG** (legitimate vs. laundered INDETERMINATE): `requirement-spec-{af,ag}-*.json`.
- **AH** (open-ended Unknown reading-domain invention): **not fixture-tested** — genuinely not
  mechanically representable given `intent-spec.schema.json`'s own `"unknown"` shape has no structured
  reading-domain field to invent *against*; recorded honestly here as reviewer-only per the task's own
  instruction not to fake an invalid fixture that fails for an unrelated structural reason.
- **AI–AQ** (R-24 full matrix, Dependency D Cases 23/26/29): `requirement-spec-{ai,aj,ak,al,am,an,ao,aq}-*.json`
  — see §9 for exactly which layer (companion `MemoryContext` validation vs. `RequirementSpec`'s own
  R-24 check) each rejection occurs at.
- **AP** (memory cannot replace ordinary provenance): **not separately fixture-tested** — structurally
  impossible by construction (§9's last bullet), not a runtime check with a pass/fail case to exercise.
- **AR/AS** (invalidation/versioning shapes): `requirement-spec-{ar,as}-*.json`.
- **AT** (no architecture/technology-evaluation field leakage): **not fixture-tested** — the closed
  schema (`additionalProperties: false` throughout) defines no such field anywhere to leak through;
  there is no invalid shape to construct that a schema-conformant document could even attempt.
- **AU** (Failed-outcome representation): `requirement-spec-au-failed-status-not-representable.json`
  proves the schema itself has no `"failed"` value — the representation decision *is* the absence
  (§5).
- **Multi-companion harness proof**: `requirement-spec-multi-companion-nested-resolution.json` —
  exercises a companion `IntentSpec` with its own Dependency-B `MemoryContext` need alongside a
  separate, differently-bound `MemoryContext` for the primary document's own R-24 citation, both
  resolved from one flat `companions` array by identity (§4).
- **Post-review regression fixtures (`requirement-spec-r1`–`r19-*.json`)**: added after four independent
  read-only Codex reviewers (Section 31) found real, confirmed defects in the schema/validator's first
  draft — each fixture below regression-tests exactly one confirmed finding, not a hypothetical:
  mixed-origin basis wrongly rejected (R1, §7); Assumed origin's unconditional provisional/reversible
  requirement not enforced (R2/R3/R4, §7); a valid basis claim with the wrong declared strength not
  caught (R5); a strength-less `preference` claim silently inflating to `SHOULD` (R6, §5/§9); `version`/
  `revision` requiredness gaps from the omitted-`required`-key bug (R7/R8, §10); R-20's force-bearing-claim
  guard (R9); `status: "complete"` accepted despite a blocking open item (R10); duplicate companion
  identity resolving positionally (R11, §4); an Unknown recorded as simultaneously `unfillable_unknown`
  and filled (R12, §9); two working defaults filling the same Unknown with contradictory values, no
  memory citation required to trigger it (R13, §9); an RLI premised on an invalidated Requirement
  (R14, §8); the restored whole-Requirement RLI premise, both its valid and its
  no-single-strength-rejected form (R15/R16, §8); R-08's Conflict-participant guard not covering the RLI
  premise path (R17, §7/§8); R-07 unrepresentable/unchecked on RLI clauses (R18, §8); and a
  `requirement_derivation`-stage `MemoryContext` with a null `upstream_artifact_binding` bypassing the
  IntentSpec-version binding check entirely (R19, §9). All were independently re-verified by Claude
  against the actual code/schema before being accepted as real, not merely trusted from a reviewer's own
  report — see `.project/REVIEW_STATE.md` for the full reviewer-by-reviewer record.
