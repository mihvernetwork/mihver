# MemoryContext Schema Mapping

Status: M0 machine-readable mapping for the Accepted `MemoryContext` semantic contract
([MEMORY_CONTEXT](./MEMORY_CONTEXT.md), part of `ADR-0004`, Status: Accepted — see that ADR's own
"Acceptance Gate" for what Acceptance did and did not authorize). Deliberately separate from
[SCHEMA_MAPPING](./SCHEMA_MAPPING.md), which is titled and scoped to Step 02B's `UserIdea`/
`IntentSpec` mapping specifically and is not overloaded here.

**This document does not authorize any new `MemoryContext` consumer, and does not implement Brain
retrieval or runtime integration.** `docs/foundation/M0_SCOPE.md` continues to authorize exactly one
consuming stage (Research Planning, `DISCOVERY_ATTENTION` tier only) — see "Schema Representability
vs. Pipeline Authorization" below. `MemoryContext.md`, `ADR-0004`, `M0_SCOPE.md`, `INTENT_SPEC.md`,
`intent-spec.schema.json`, and `REQUIREMENT_SPEC.md` are unchanged by this document and by the
schema/validator it describes.

## Validation boundary

`schemas/m0/memory-context.schema.json` uses JSON Schema Draft 2020-12 and defines the serialized
shape of exactly one immutable `MemoryContext` produced by one authorized Producer invocation.
`tests/contracts/validate-contracts.mjs`'s `validateMemoryContext` function adds deterministic
checks for structural cross-field invariants inside that single artifact — the same
single-artifact boundary [SCHEMA_MAPPING](./SCHEMA_MAPPING.md) already establishes for `UserIdea`/
`IntentSpec`. It does not claim to determine whether an entry's content genuinely is a historical
user statement, whether a citation actually resolves against a real `UserIdea` artifact, whether a
`global`-scoped entry's content is genuinely project-agnostic, whether a cached technical claim
remains true, whether a consuming stage's actual use of an entry stayed within its authorized
influence tier, or whether `MemoryContext` production was invoked with real Brain access at all.
Those all require source comparison, cross-artifact/cross-run state, external system behavior, or
downstream-consumer behavior unavailable to a single-artifact validator — exactly the same class of
limitation [SCHEMA_MAPPING](./SCHEMA_MAPPING.md) already documents honestly for `UserIdea`/
`IntentSpec` (see e.g. UI-05, I-05).

The classifications below carry the identical meaning [SCHEMA_MAPPING](./SCHEMA_MAPPING.md) already
defines:

- **Schema-enforced:** JSON Schema enforces the full invariant for one artifact.
- **Validator-enforced:** the deterministic validator enforces the full invariant for one artifact
  where JSON Schema alone cannot express it.
- **Not enforceable at this layer:** correctness requires source comparison, cross-artifact/cross-run
  state, semantic judgment, or downstream-consumer behavior unavailable to a single-artifact
  validator. A row stays in this class even when schema or validator checks provide useful partial
  structural guards — the row names the limitation explicitly instead of claiming enforcement of the
  full semantic invariant.
- **Not applicable to this artifact:** the invariant concerns a different artifact's own future
  behavior (a downstream `IntentSpec`/`RequirementSpec` amendment this task does not perform, or a
  future `EvidenceBundle`) and is not something `MemoryContext`'s own shape could express even in
  principle. Distinguished from "Not enforceable at this layer" because there is no partial
  structural guard to name — the concept simply does not live in this artifact.

## Schema representability vs. pipeline authorization

A structurally valid `MemoryContext` document is not, by itself, evidence that any pipeline stage is
currently authorized to consume it. `docs/foundation/M0_SCOPE.md`'s "Cross-Cutting: MemoryContext
Consumption Remains Otherwise Disabled" section is the sole authority for which stage may consume
`MemoryContext` at all, and it authorizes exactly one today: Research Planning, restricted to the
`DISCOVERY_ATTENTION` tier. This schema deliberately represents all four Influence Taxonomy tiers
(`PROCESS_ONLY`/`DISCOVERY_ATTENTION`/`DECISION_OPTION`/`SEMANTIC_PREMISE`) and an open
`consuming_stage` identifier — not a closed enum naming only Research Planning — so that a future,
separately-authorized `M0_SCOPE.md` amendment adding another consuming stage (e.g. Intent Parsing or
Requirement Derivation) never requires redesigning `MemoryContext`'s own artifact shape (Principle
12, Evolvability). Nothing in this schema or its validator authorizes dependencies B, C, or D, moves
any stage's authorization forward, or implies a `MemoryContext` runtime, Brain adapter, or executable
retrieval path exists — none of those exist as of this document.

## Stable identity for future cross-artifact reference (Dependencies B/C/D)

Every admitted entry carries an `entry_id`, unique within its `MemoryContext`, alongside that
artifact's own `memory_context_id`. The pair `(memory_context_id, entry_id)` is the stable,
inspectable identity a future, separately-authorized amendment to `INTENT_SPEC.md` (dependency B) or
`REQUIREMENT_SPEC.md` (dependencies C/D) could use to cite exactly one specific `MemoryContext`
entry. **This document establishes only the `MemoryContext` side of that identity/reference
boundary.** It does not define, and `intent-spec.schema.json`/`INTENT_SPEC.md`/`REQUIREMENT_SPEC.md`
do not yet contain, any field or provenance shape that actually cites this pair — that citation shape
belongs to dependencies B, C, and D respectively, each its own separate, later, explicitly
human-authorized task.

**Canonical Brain-memory identity is additionally partitioned, not merely entry-identity.** The
audit model is: one Producer invocation retrieves one canonical Brain record into exactly one
disposition within this snapshot. `source.brain_memory_id` (on an admitted entry) or
`source.brain_memory_id` (on an excluded entry) is validator-checked for uniqueness across the
*combined* `admitted_entries`/`excluded_entries` sets, not merely within `admitted_entries` alone —
the same canonical Brain record can never simultaneously appear admitted under one `entry_id` and
excluded under another. Nothing in `MEMORY_CONTEXT.md` contemplates one canonical Brain record
producing multiple entries, of any disposition, within a single invocation; Case 14's two
independent `MemoryContext` productions for two different retrieval purposes are two *separate*
artifacts, not two entries inside one.

## The Seven Independent Authority Axes, as represented

MEMORY_CONTEXT.md's "Seven Independent Authority Axes" section requires each axis to remain
independent — never substituting for, capping, or derived from another. Mapped explicitly, so none
is silently collapsed into another field:

| Axis | Schema representation |
|---|---|
| 1. Retrieval relevance | Not represented at all (see M-01's row below) — deliberately absent, not merely unused. |
| 2. Source/provenance | `source.provenance.{source,author}`. |
| 3. Semantic authority class | `classification.semantic_authority_class` (admitted) / `exclusionClassification.semantic_authority_class` (excluded, when a classification was attempted) — an open, non-empty descriptive string assigned at production, independent of `source.brain_type` (a weak prior only), `classification.historical_user_category` (the separate Historical User Provenance Gate axis), and `classification.influence_tier` (Axis 7). Deliberately not a closed enum: MEMORY_CONTEXT.md's "Semantic Authority Classes" table describes these classes narratively as production's own content-inspection judgment, not as a fixed closed taxonomy (e.g. a `decision`-typed record's typical class is stated as "historical user statement/preference... **or** prior project decision/outcome" — an open disjunction, not one of a small closed set), and this field must not pretend otherwise by inventing a closed vocabulary the contract does not commit to. The validator additionally rejects a whitespace-only value (`"   "` etc.) — JSON Schema's `minLength: 1` alone does not, since whitespace is lexically non-empty; without this guard a placeholder could satisfy the schema while preserving no actual classification, defeating the "assigned at production" requirement this axis exists to record. |
| 4. Freshness/temporal standing | `freshness.{freshness_flag,freshness_basis}` (production-time judgment) plus `source.{brain_status,brain_created_at,brain_updated_at}` (Brain's own lifecycle fields) — kept as distinct fields per M-05. |
| 5. Scope/project applicability | `source.scope`, checked against `run_context` (never against another entry or its own content) — M-06/M-13/M-16. |
| 6. Confidence, where meaningful | `source.brain_confidence` — never copied into, or conflated with, any MIHVER-side confidence, since no such field exists in this artifact at all (M-02). |
| 7. Allowed use by stage | `classification.influence_tier` (per entry) plus the artifact-level `consuming_stage` (which stage this whole snapshot was produced for) — schema representability is explicitly not the same as `M0_SCOPE.md` pipeline authorization (see "Schema Representability vs. Pipeline Authorization" above). |

## MemoryContext invariants

| Invariant | Classification | Mapping and limitation |
|---|---|---|
| M-01 Relevance never truth/authority | Not enforceable at this layer | Partial guard: no field anywhere in this schema represents retrieval relevance or rank at all — the absence itself prevents this artifact from ever storing it as, or conflating it with, authority. Whether code outside this artifact ever computes or is influenced by a relevance score is outside a data-shape validator's reach. |
| M-02 Brain confidence ≠ MIHVER confidence | Not enforceable at this layer | Partial guard: `brain_confidence` is present and required, but this artifact defines no separate field for an Inference-derivation or Evidence confidence of any kind — there is nothing here to conflate `brain_confidence` with. Whether a later consuming artifact copies `brain_confidence` into its own confidence field is that artifact's behavior, not this one's shape. |
| M-03 Historical statement never automatically User-Provided; only Category A may become a cited Inference premise; Category B restricted to DISCOVERY_ATTENTION; neither becomes Assumed | Not enforceable at this layer | This invariant is primarily about `IntentSpec`'s own Claim-origin behavior when it cites a `MemoryContext` entry (dependency B, implemented) — behavior this artifact cannot observe. Partial guard: Category A/B are structurally distinguished (see M-18) and `SEMANTIC_PREMISE` is validator-restricted to Category A entries only (see M-11/M-19), narrowing what a future citation could even legitimately point at. |
| M-04 Superseded record never admitted as live | Validator-enforced | An admitted entry's `source.brain_status` may never be `"superseded"`, **and** its `source.superseded_by` may never be non-null — the invariant names both signals explicitly ("`status: superseded`, or linked via `supersedes`/`superseded_by`"), so both are checked. Since a record linked as superseded-by another can never be admitted at all, no single `MemoryContext` can present a superseded record and its live successor as though both were independently live support — this fully covers the invariant within one artifact. Trusts the stated `brain_status`/`superseded_by` fields as accurate at retrieval time, the same attribution-not-verification trust boundary UI-02 already accepts for `UserIdea` source identity. |
| M-05 Freshness is mechanical/age-based, distinct from Brain status, never a real-world-truth judgment | Not enforceable at this layer | Partial guard: `freshness_flag`/`freshness_basis` are required, closed-shaped fields, structurally separate from `source.brain_status` and from any real-world-truth claim — this schema defines no field anywhere that could assert the underlying claim is still true. Whether a specific `freshness_flag` value was actually, correctly computed from age against some threshold cannot be checked here: the contract fixes no numeric threshold for this layer to verify against. |
| M-06 Scope verified against RunContext, never assumed/content-based; `global` admission is scope-tag equality only | Validator-enforced | Every admitted entry's `source.scope` is checked against `run_context`: with `run_context.status == "absent"`, only `scope == "global"` passes; with `run_context.status == "present"`, `scope` must be `"global"` or exactly equal `run_context.project_slug`. Whether a `global`-scoped entry's *content* is genuinely project-agnostic is explicitly the consuming stage's judgment per the contract, not this layer's — not a gap in this layer's enforcement, but the layer boundary the contract itself draws. |
| M-07 Repetition never by itself increases authority/confidence | Not enforceable at this layer | Requires comparing independence across multiple entries/runs, a semantic judgment. Partial guard: each entry's `classification_basis` is independently required per entry, and the schema defines no aggregate "entry count" field any authority computation could read. |
| M-08 Memory alone never closes a HIGH/CRITICAL item | Not applicable to this artifact | Concerns `IntentSpec`'s own Decision Impact handling of a downstream item (dependency B, implemented). `MemoryContext` itself carries no Decision Impact concept at all. |
| M-09 Memory contradiction never recorded as an IntentSpec Conflict; production never itself detects it | Not enforceable at this layer | Concerns downstream-artifact (`IntentSpec`) behavior. Partial guard: this schema provides no field through which an admitted entry could be recorded as, or linked into, an `IntentSpec` Conflict participant — that link does not exist here to misuse. |
| M-10 Memory contradiction is not an independent blocking mechanism | Not applicable to this artifact | Concerns Decision-Impact-driven clarification triggering at a downstream consuming stage; `MemoryContext` has no Decision Impact or clarification concept. |
| M-11 Influence tier is a property of use; `lesson`/`playbook` always `PROCESS_ONLY` (absent content-inspection redirection); `SEMANTIC_PREMISE` requires clearing the full gate | Not enforceable at this layer | Strong partial guard, validator-enforced: an admitted entry with `source.brain_type` `"lesson"` or `"playbook"` **that is not reclassified, by content inspection, as a historical user statement** must carry `influence_tier: "PROCESS_ONLY"` — the rule is conditioned on `classification.is_historical_user_statement`, never on stored `brain_type` alone, because MEMORY_CONTEXT.md's own "Semantic Authority Classes" section explicitly overrides the "always"/"permanently" wording for every non-`inbox` type, `lesson`/`playbook` included, once content inspection redirects the entry to the Historical User Provenance Gate. A misfiled `lesson`/`playbook` correctly classified Category A may therefore reach `SEMANTIC_PREMISE` exactly as a misfiled `reference` may — see the corpus fixture. Separately, `influence_tier: "SEMANTIC_PREMISE"` is only valid when the entry is a Category A historical user statement, structurally excluding every `pattern`/`incident`/`reference`/non-historical entry from ever reaching `SEMANTIC_PREMISE`, matching the identity-boundary rule directly. The mirror-image rule also holds: an entry with `is_historical_user_statement: true` (Category A or B) may never carry `influence_tier: "DECISION_OPTION"` — the `MemoryContext` source-eligibility gate (Gate 2) M-21's own row documents in full; the check itself lives in the same validator function this row already describes, so it is noted here rather than duplicated. What remains genuinely unverifiable: whether a consuming stage's actual downstream *use* of an admitted `DISCOVERY_ATTENTION` entry stayed additive and provenance-visible — that is the consuming stage's own behavior, not this artifact's shape. |
| M-12 No Brain memory record may become a direct `EvidenceBundle` entry | Not applicable to this artifact | `EvidenceBundle` does not exist yet (deferred by `ADR-0001`) and is not designed here. Partial note: `MemoryContext` and any future `EvidenceBundle` remain and will remain distinct artifact types; nothing in this schema provides a mechanism for a `MemoryContext` entry to present itself as an `EvidenceBundle` entry. |
| M-13 Brain `scope` is a necessary filter, never sufficient by itself | Validator-enforced | Same enforcement as M-06 — scope is checked against `run_context`, never against another Brain record's content and never assumed compatible; see M-06's row for the exact rule. |
| M-14 Production record must preserve the named audit facts | Schema-enforced | M-14 lists these facts for retrieved memories generally, not only admitted ones, so `excluded_entries` carries the same depth as `admitted_entries`, with two narrow exceptions named below: retrieved-memory identity (`brain_memory_id`, canonically partitioned across admitted/excluded — see "Stable identity for future cross-artifact reference" above), an explicit outcome discriminator (`retrieval_outcome`, three closed values), content retained as an actual copy for both admitted and excluded entries (`content`, plus canonical `brain_memory_id` — Brain returns full record content for anything retrieved, whether ultimately admitted or excluded), retrieval time distinct from Brain's own timestamps (`retrieval_time` vs. `brain_created_at`/`brain_updated_at`), the retrieval query and purpose (`retrieval_query`, `retrieval_purpose`), each entry's scope and provenance (`source.scope`, `source.provenance`), the authority classification with its basis/method/ambiguity/semantic-authority-class where one was actually attempted (`classification.*`, nullable *only* on an excluded entry, and only when exclusion happened before any classification was attempted at all — e.g. `inbox`-type or a mechanical scope mismatch, see M-06/M-16), **the freshness judgment (`freshness.*`), required and non-null for every admitted and every excluded entry alike** — freshness is a purely mechanical, age-based fact requiring no content inspection at all (M-05), so unlike classification there is no legitimate case where a retrieved-but-excluded candidate lacks a computable freshness judgment; **an explicit rationale for why each was admitted or excluded** — `admission_reason` on every admitted entry, symmetric with `exclusion_reason` on every excluded entry, each its own required, durable fact rather than something reconstructed later from scope/status/classification/tier (that reconstruction would defeat M-14's own durable-audit purpose, since it is not itself a recorded fact); and which stage was authorized to use it (`consuming_stage`). Whether a recorded rationale honestly reflects the real reason, rather than a fabricated one, is Not enforceable at this layer. |
| M-15 No stage may query Brain directly | Not enforceable at this layer | A code-execution-path invariant, not a data-shape property. No document schema or single-artifact validator can observe what code path produced or consumed a `MemoryContext`; this is enforced, if at all, by `docs/foundation/M0_SCOPE.md`'s own stated prohibition and by code review, not by this layer. |
| M-16 `project` record may corroborate, never establish, RunContext identity; global-only when RunContext absent | Not enforceable at this layer | Strong partial guard, fully validator-enforced: the `run_context`-absent → `scope == "global"`-only rule is the same check as M-06. What remains genuinely unverifiable: whether a `project`-type entry was ever consulted *before* `RunContext` existed (to help decide what it should be) is a temporal fact about the Producer's own internal sequencing that no frozen single-artifact snapshot can attest to either way. |
| M-17 MemoryContext bound to RunContext/stage/purpose/upstream version; never reused across runs | Not enforceable at this layer | Cross-run reuse and upstream-artifact-version invalidation both require comparing this artifact against other artifacts or other runs — external state a single-artifact validator cannot see. Partial guard: `run_id`, `run_context`, `consuming_stage`, `retrieval_purpose`, and `upstream_artifact_binding` are all required fields, giving an external system (e.g. a future Producer implementation) everything it needs to perform that comparison itself. |
| M-18 Historical User Provenance Gate: Category A requires inspectable, resolvable citation, type-independent | Not enforceable at this layer | Partial guard, structurally strong: `is_historical_user_statement`/`historical_user_category` consistency is validator-enforced (category requires the flag; the flag without a category is rejected); Category A requires the complete `historical_citation` shape (`idea_id`, `user_idea_version`, `turn_id`, `quote`, all non-empty) and Category B forbids it. The gate applies by `historical_user_category`'s own value, never by `source.brain_type`, so a `reference`- or `pattern`-typed entry can be classified Category A exactly as a `decision`-typed one can — type-independence is representable and exercised (see the corpus fixture). What remains unverifiable here, exactly mirroring UI-05's identical limitation: whether the cited `idea_id`/`user_idea_version`/`turn_id`/`quote` actually, genuinely resolves against a real `UserIdea` artifact. That requires cross-artifact comparison this single-artifact validator does not perform. |
| M-19 Fail-closed classification: ambiguity never promotes authority | Not enforceable at this layer | Strong partial guard, validator-enforced *given honestly self-consistent fields*: an entry with `classification_method: "deterministic"` may not carry a non-null `classification_ambiguity` at all. An entry with `classification_method: "heuristic"` and a non-null `classification_ambiguity` may not carry `influence_tier: "DECISION_OPTION"` or `"SEMANTIC_PREMISE"` — only `PROCESS_ONLY`/`DISCOVERY_ATTENTION` remain available. Neither `relevance` (which this schema has no field for at all — M-01) nor `brain_confidence` is read by any tier-assignment rule in the validator, so neither can resolve an ambiguity even informally. What this layer cannot catch: a document whose free-text `classification_basis` itself describes a competing/ambiguous reading while its structured `classification_ambiguity` field is left `null` — the validator checks consistency *between* the structured fields, not whether `classification_basis`'s prose content is honestly reflected in them. This is a real gap, not merely an unprovable-correctness caveat: production could self-report `classification_ambiguity: null` while its own stated `classification_basis` contradicts that, and this single-artifact validator has no way to detect the contradiction. Whether production's own judgment that a classification "cannot be defensibly assigned" was itself correct is likewise Not enforceable at this layer — the same substantive-correctness carve-out I-05 already accepts for Inference Policy. |
| M-20 Historical force never mechanically copied into current Inferred Claim force | Not applicable to this artifact | Concerns a downstream `IntentSpec` Inferred Claim's own force-derivation step at Intent Parsing (dependency B, implemented), not anything `MemoryContext` itself represents. This artifact carries no normative-force field for any entry. |
| M-21 DECISION_OPTION supplies zero independent authority; source eligibility (Gate 2) is categorically unavailable to any historical-user-statement entry, independent of R-19 content eligibility (Gate 1); currently named only for a memory-informed R-19 default | Not applicable to this artifact, partially covered elsewhere | The R-09/R-19 justification-and-citation discipline this invariant describes belongs to Requirement Derivation (dependency D), a downstream stage this task does not touch — Gate 1 (R-19 content eligibility) is therefore Not applicable at this layer. **Gate 2 (`MemoryContext` source eligibility) is a deliberate, independently-enforced semantic rule this schema's validator does enforce, not an incidental side effect of another invariant's own check:** an admitted entry with `classification.is_historical_user_statement: true` may never carry `classification.influence_tier: "DECISION_OPTION"`, regardless of `historical_user_category` ("A" or "B") and regardless of the entry's own content — see `MEMORY_CONTEXT.md`'s "No Assumed-Origin Path for Memory" (the Gate 1/Gate 2 split) and M-21's own cross-reference. This is validator-enforced independently of, and cross-referenced from, M-11's row above — the two rows describe the same one validator check from two different invariants' perspectives, not two separate checks. |

## Deterministic checks and fixtures

Run:

```text
npm test
```

The test runner validates all three schemas (`UserIdea`, `IntentSpec`, `MemoryContext`), every JSON
fixture against its declared contract's schema, and each contract's single-artifact semantic rules.
`tests/contracts/fixtures/valid` adds `MemoryContext` coverage for: an admitted `DISCOVERY_ATTENTION`
entry against a present `RunContext`; a successfully-empty retrieval; a `retrieval_unavailable`
outcome; a projectless run admitting only a `global`-scoped entry; a `reference`-typed entry
correctly classified Category A despite its non-`decision` stored type (type-independence); a
`decision`-typed entry correctly resolved toward the lower-authority Category B reading under
genuine classification ambiguity (fail-closed in the safe direction); an admitted entry alongside a
fully-audited `excluded_entries` list (an `inbox`-type and a cross-project-scoped candidate, each
carrying its own retained content/source and a null classification, since both were excluded before
any classification was attempted); a fail-closed exclusion where classification *was* attempted but
no tier could be defensibly assigned (a non-null `exclusionClassification` with no `influence_tier`
at all); a `lesson`-typed entry whose content inspection reclassifies it as a Category A
historical user statement reaching `SEMANTIC_PREMISE` — the type-independence guarantee extended to
`lesson`/`playbook`, not only to `reference`/`pattern`/`incident`/`project`; and a `pattern`-typed,
non-historical entry (`is_historical_user_statement: false`) admitted at `DECISION_OPTION` — proving
`MemoryContext` can represent the source-eligible side of the Gate 2 rule, not that Requirement
Derivation is authorized to consume it.

`tests/contracts/fixtures/invalid` adversarially covers: duplicate `entry_id` values; a
`retrieval_unavailable` outcome carrying admitted content; a malformed `run_context` binding; an
`influence_tier` value outside the closed four; `SEMANTIC_PREMISE` claimed without Category A
standing; an `inbox`-typed record admitted as an entry; a `lesson`-typed entry (not reclassified as
historical) not restricted to `PROCESS_ONLY`; `DECISION_OPTION` claimed for a Category A
historical-user-statement entry and, separately, for a Category B one — the source-eligibility gate
(Gate 2) excludes both categories identically, regardless of content; an admitted entry carrying `brain_status: "superseded"`; an admitted entry carrying
a non-null `superseded_by` despite an `active` `brain_status`; a Category A claim with no
`historical_citation`; an admitted entry whose `scope` does not match `run_context`; an ambiguous
heuristic classification claiming `DECISION_OPTION` despite the fail-closed rule; the same canonical
`source.brain_memory_id` appearing once admitted and once excluded under different `entry_id` values
in one snapshot; and, proving each newly-required field cannot silently disappear or be trivially defeated, an
admitted entry missing `semantic_authority_class`, an admitted entry with a whitespace-only
`semantic_authority_class`, an admitted entry missing `admission_reason`, and an excluded entry
carrying `freshness: null`.
