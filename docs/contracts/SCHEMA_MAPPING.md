# Step 02B Schema Mapping

Status: M0 Step 02B machine-readable mapping for the approved Step 02A semantic contracts.

## Validation boundary

The schemas use JSON Schema Draft 2020-12 and define the serialized shape of one `UserIdea`
version and one produced `IntentSpec` version. `tests/contracts/validate-contracts.mjs` adds
deterministic checks for references and relationships inside a single artifact. It does not claim
to determine whether an interpretation is correct, whether quoted content faithfully matches an
external source artifact, or whether history was mutated outside the artifact being validated.

The pinned `ajv` and `ajv-formats` packages are development-only contract-test dependencies. They
are not MIHVER runtime dependencies and do not select or imply MIHVER's eventual runtime language.

The classifications below mean:

- **Schema-enforced:** JSON Schema enforces the full invariant for one artifact.
- **Validator-enforced:** the deterministic validator enforces the full invariant for one artifact
  where JSON Schema alone cannot express it.
- **Not enforceable at this layer:** correctness requires source comparison, version history,
  semantic judgment, or pipeline behavior unavailable to a single-artifact validator. A row stays
  in this class even when schema or validator checks provide useful partial structural guards.

Where only a structural portion is enforceable, the row names the limitation explicitly instead
of claiming enforcement of the full semantic invariant.

**MemoryContext companion cross-artifact checks (ADR-0004 Dependency B).** An `intent-spec`
fixture may optionally supply an immutable companion `memory-context` document alongside it. When
supplied, the validator deterministically resolves an Inferred Claim's `memory_premises` and an
Open Item's `memory_discovery_refs` against that companion — `memory_context_id`/`entry_id`
resolution, admitted-vs-excluded status, `consuming_stage`, Category A standing, `influence_tier`,
and historical-citation equality (see I-05, I-23, I-26 below). This is narrowly scoped to what is
mechanically checkable against an explicitly supplied, immutable snapshot: it does not, and cannot,
determine whether the citation genuinely resolves to real content in an external `UserIdea`
artifact, whether current `UserIdea` input was genuinely given the precedence it requires, or
whether a memory-premised Inference's stated force reasoning is substantively independent rather
than a rephrased copy of the historical statement's own force — those remain "Not enforceable at
this layer," exactly as I-05's existing "substantive reasoning correctness is not part of I-05"
limitation and UI-05's citation limitation already establish for comparable questions. When no
companion is supplied, only the structural, single-artifact checks apply.

## UserIdea invariants

| Invariant | Classification | Mapping and limitation |
|---|---|---|
| UI-01 Immutability | Not enforceable at this layer | Immutability is storage/history behavior. A schema cannot prove a previously recorded version was not edited. |
| UI-02 Attribution | Validator-enforced | `source`, `created_at`, and per-turn `source_id`, `sequence`, `supplied_at`, and authoritative `source_language` are required; the validator requires every turn source to match the stable top-level source. This enforces traceable artifact attribution without claiming verified real-world identity. |
| UI-03 No inference contamination | Not enforceable at this layer | The closed content union prevents explicit epistemic fields in `UserIdea`, but cannot determine whether supplied text was silently interpreted or normalized before serialization. |
| UI-04 Supersession, not mutation | Not enforceable at this layer | Requires comparison with retained prior versions and storage behavior. The schema only represents the current cumulative version and explicit links. |
| UI-05 Explicit supersession linkage | Not enforceable at this layer | Partial guard: a link must point from a later turn to an earlier turn and its quote must occur verbatim in the later textual turn. Determining that the wording actually signals correction/withdrawal requires semantic judgment. |
| UI-06 Faithful capture | Not enforceable at this layer | Requires comparison with the original input modality. The schema preserves transcription text and names its original modality but cannot prove fidelity. |
| UI-07 Reference vs. fetched content | Not enforceable at this layer | Partial guard: attached content and external references are disjoint closed shapes, and a reference has no fetched-content field. The layer cannot detect externally fetched bytes mislabeled as attached/user-supplied content. |

## IntentSpec invariants

| Invariant | Classification | Mapping and limitation |
|---|---|---|
| I-01 Inference cannot become User-Provided | Not enforceable at this layer | Partial guard: `origin` selects disjoint `user_statement` and `derivation` provenance shapes; `userClaimProvenance`'s closed shape (`additionalProperties: false`) also structurally forecloses a `memory_premises` field appearing on a `user_provided` claim (Dependency B), so a memory-derived Inference cannot masquerade as User-Provided by construction. Whether a model-derived proposition was falsely labeled User-Provided via free-text content alone still requires source/semantic comparison. |
| I-02 Assumption cannot become User-Provided | Not enforceable at this layer | Partial guard: `assumed` and `user_provided` require disjoint provenance shapes. Whether an unsupported assumption was falsely labeled User-Provided requires source/semantic comparison. `assumptionProvenance`'s closed shape likewise structurally forecloses a `memory_premises` field (see I-24 below, Dependency B's own no-Assumed-path rule). |
| I-03 Unknown may remain unknown | Not enforceable at this layer | Partial guard: Unknown is a distinct Open Item shape requiring no guessed value, and empty Claim collections are permitted. Proving the parser did not guess elsewhere in free-text Claims is semantic/behavioral. |
| I-04 Conflicting claims are preserved | Not enforceable at this layer | Partial guard: a represented Conflict has distinct resolving participants, at least one Claim, and only Claim or exact Ambiguity-reading references. The validator cannot prove all actual conflicts and participants were preserved. |
| I-05 Inference provenance | Validator-enforced | Schema requires reasoning kind and derivation confidence, and at least one of `premise_claim_ids`/`memory_premises` (Dependency B); the validator resolves Claim premise IDs, rejects self-reference/cycles, prevents confidence from exceeding an inferred Claim premise, and rejects duplicate `(memory_context_id, entry_id)` memory-premise pairs within one Inference. When a companion `MemoryContext` is supplied, the validator additionally resolves each memory premise against it (admitted, Category A, `SEMANTIC_PREMISE`, correct `consuming_stage`, matching historical citation). Inspectability is enforced; substantive reasoning correctness, and citation resolution when no companion is supplied, are not part of I-05. |
| I-06 Assumption rationale | Schema-enforced | Assumptions require a gap, rationale, scope, and `reversible: true`, and cannot carry inference confidence. Narrow interpretiveness and justification quality remain semantic judgments. |
| I-07 Clarification decision is separate | Not enforceable at this layer | Partial guard: clarification decisions are separate and exactly one resolves to every Open Item/Conflict. Whether the decision was genuinely computed from Decision Impact requires behavioral/semantic evidence. |
| I-08 LOW does not automatically clarify | Not enforceable at this layer | Whether a clarification was automatic or independently justified is behavioral context. LOW decisions may legitimately be either value when rationale exists. |
| I-09 No architecture recommendation leakage | Not enforceable at this layer | Closed fields prevent a dedicated recommendation object, but a recommendation or suitability judgment could be hidden in free text. |
| I-10 No RequirementSpec classifications | Not enforceable at this layer | Closed schemas reject added requirement fields, but cannot determine whether free-text propositions have already compiled intent into requirements. No `RequirementSpec` is designed here. |
| I-11 Negation survives | Not enforceable at this layer | Partial guard: force has a distinct `prohibition` value. Proving source negation survived interpretation requires comparison to the source wording. |
| I-12 Conditional intent survives | Not enforceable at this layer | `scope_condition` can preserve a condition, but the validator cannot know that source wording contained one or that its meaning was preserved. |
| I-13 Revision supersedes, never mutates | Not enforceable at this layer | `supersedes_intent_spec_id` represents succession, but proving no historical artifact changed requires cross-version storage comparison. |
| I-14 Intent Parsing may fail | Not enforceable at this layer | Failure is the legitimate absence of an `IntentSpec`, not a variant of the produced-artifact schema. Pipeline result handling is outside this layer. |
| I-15 Downstream traceability | Not enforceable at this layer | The validator checks the local prerequisite that User-Provided Claim provenance matches a declared `user_idea_refs` entry, and, when a companion `MemoryContext` is supplied whose `upstream_artifact_binding` names a `user_idea` artifact, that the bound version is among this `IntentSpec`'s `user_idea_refs` (Dependency B). It cannot verify the external UserIdea artifact or any future downstream artifact's complete traceability chain. |
| I-16 Repetition does not increase confidence | Not enforceable at this layer | Requires comparison across runs/versions and knowledge of how confidence was assigned; this applies identically to repeated `memory_premises` citations (Dependency B) — nothing in the schema or single-fixture validator can observe a "repetition across runs" pattern at all, so this remains fully undelegated to semantic judgment. |
| I-17 Ambiguity readings trace to wording | Not enforceable at this layer | Partial guard: Ambiguities require wording references and distinct candidate readings, and referenced UserIdea versions must be listed. Quote fidelity and whether readings are grounded in that wording require source/semantic comparison. |
| I-18 Blocked version never consumable | Not enforceable at this layer | Partial guards: schema makes `blocked` imply `requirement_derivation_consumable: false`; validator requires a HIGH/CRITICAL unresolved item and rejects eligible artifacts containing one, computed identically regardless of whether an Open Item carries `memory_discovery_refs` (Dependency B) — a memory-shaped clarification question never participates in the HIGH/CRITICAL/eligibility computation itself. Proving that the same historical version never later becomes consumable requires immutable cross-version storage/pipeline enforcement. |
| I-19 Assumptions only fill interpretive gaps | Not enforceable at this layer | Required gap/rationale/scope fields expose the decision for audit, but distinguishing interpretive from technical/operational defaults requires semantic judgment. |
| I-20 Open Item relevance | Not enforceable at this layer | `relevance_rationale` is required, but whether the question is genuinely implicated cannot be decided structurally. |
| I-21 Conflict resolution authority/versioning | Not enforceable at this layer | Requires comparing origins and resolution events across `UserIdea` and `IntentSpec` versions. Single-artifact validation cannot prove authorized resolution or non-mutation. `participantRef`'s closed `oneOf` (`claim` / `ambiguity_reading` only) structurally forecloses a `MemoryContext` entry ever appearing as a Conflict participant at all (Dependency B, I-25) — this part is schema-enforced by construction, not merely unproven. |
| I-22 Independent modality axes | Not enforceable at this layer | Partial guard: force is optional and limited to normative/desiderative values, while user hedging and discourse role are separate fields. Proving the parser did not infer or collapse one axis from another requires source/semantic comparison. `force_reasoning` (Dependency B, I-26) is a distinct, separately-shaped field from `reasoning_kind` and from force itself — schema keeps it structurally apart, but whether its stated basis is genuinely independent reasoning, as opposed to a reworded copy of the historical statement's own force, is not enforceable at this layer. |

| I-23 Memory premise Category A gate | Schema-enforced (structural) + Validator-enforced (cross-artifact, when a companion is supplied) | `memoryPremise.historical_user_category` is `const: "A"`, structurally foreclosing a Category B entry from ever being representable as an Inference premise at all. When a companion `MemoryContext` is supplied, the validator additionally resolves the cited `(memory_context_id, entry_id)` and confirms the companion's own classification independently agrees: `is_historical_user_statement`, `historical_user_category: "A"`, and `influence_tier: "SEMANTIC_PREMISE"`, and rejects excluded entries. Without a companion, only the structural `"A"` self-assertion is checked — whether that self-assertion is honest is not enforceable at this layer, mirroring UI-05's own citation limitation. |
| I-24 Memory premise never confers User-Provided or Assumed origin | Schema-enforced | A memory-premised Claim's `provenance` shape is `inferenceProvenance` — the only shape `memory_premises` can structurally appear in; `userClaimProvenance` and `assumptionProvenance` both close off any such field (`additionalProperties: false`, see I-01/I-02 above), so origin cannot be anything other than `inferred` wherever a memory premise is cited. |
| I-25 Current input wins / memory never a Conflict participant | Schema-enforced (Conflict participation) + Not enforceable at this layer (current-input precedence) | `participantRef`'s closed `oneOf` structurally forecloses a `MemoryContext` entry from ever appearing as a Conflict participant (see I-21 above). Whether current `UserIdea` content was actually given the precedence I-25 requires over a competing historical memory is a semantic judgment outside a single-artifact validator's reach. |
| I-26 Historical force is not current force | Validator-enforced (structural signal) + Not enforceable at this layer (substantive independence) | The validator requires `force_reasoning` whenever a memory-premised Inferred Claim also carries `force`, and rejects `force_reasoning` when no `force` is present. It cannot determine whether the stated reasoning is genuinely independent of the historical statement's own force, as opposed to a restated copy — that remains a semantic judgment (see I-22 above). |
| I-27 Memory alone never closes HIGH/CRITICAL; discovery reference is never an answer | Validator-enforced (structural) + Not enforceable at this layer (semantic closure) | I-18's existing HIGH/CRITICAL-implies-Blocked check applies unchanged and unweakened regardless of `memory_discovery_refs` presence (see I-18 above) — a memory-shaped clarification question cannot flip an Open Item's own Decision Impact or the artifact's `handoff.status`. `memoryDiscoveryRef`'s shape (`memory_context_id`, `entry_id` only) carries no answer-bearing field, structurally distinct from `memoryPremise`; when a companion is supplied, the validator confirms a cited discovery-path entry actually carries `influence_tier: "DISCOVERY_ATTENTION"` in the companion, catching a `DISCOVERY_ATTENTION`-tier entry that a document attempts to cite as a `SEMANTIC_PREMISE` premise elsewhere (I-23). Whether an Open Item was genuinely left open, rather than covertly settled via free-text `question`/`relevance_rationale` wording, is not enforceable at this layer. |

## Deterministic checks and fixtures

Run:

```text
npm test
```

The test runner validates all three schemas, every JSON fixture against the appropriate schema, and
the single-artifact (and, where a fixture supplies one, companion cross-artifact) semantic rules
above. `tests/contracts/fixtures/valid` covers cumulative supersession, multi-part turns,
force-absent descriptive Claims, hedging, inference and assumption provenance, per-turn
multilingual attribution, exact Ambiguity-reading conflicts, an eligible artifact, a permanently
non-consumable Blocked artifact, and — for ADR-0004 Dependency B — a memory-only Category A
Inference, a mixed Claim-and-memory Inference, Category A and Category B `DISCOVERY_ATTENTION`
clarification provenance, and a memory-premised Inference with an explicit, independently-reasoned
current force. `tests/contracts/fixtures/invalid` adversarially covers reference contamination,
attachment integrity, unsupported supersession, provenance and modality misclassification, source
contradiction, mixed-idea references, inference-confidence escalation, Ambiguity distinctness,
invalid Conflict participants, clarification coverage, every Blocked/impact eligibility direction,
and — for Dependency B — a Category B entry attempted as an Inference premise, a premise resolving
to the wrong `influence_tier` (including a `DISCOVERY_ATTENTION`-tier entry cited as though it were
a premise), an excluded, unresolved, or wrong-`consuming_stage` companion reference, a
historical-citation mismatch, a duplicate memory-premise pair, memory content smuggled into
User-Provided or Assumed provenance, a missing provisional/reversible marking, a Brain-confidence
field leaked into derivation provenance, and current force asserted without independent
`force_reasoning`.
