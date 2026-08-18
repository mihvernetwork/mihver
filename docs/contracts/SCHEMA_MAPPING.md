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

- **Schema-enforced:** JSON Schema rejects a structurally invalid representation.
- **Validator-enforced:** the deterministic validator rejects a relationship that JSON Schema
  cannot express locally.
- **Not enforceable at this layer:** correctness requires source comparison, version history,
  semantic judgment, or pipeline behavior unavailable to a single-artifact validator.

Where only a structural portion is enforceable, the row names the limitation explicitly instead
of claiming enforcement of the full semantic invariant.

## UserIdea invariants

| Invariant | Classification | Mapping and limitation |
|---|---|---|
| UI-01 Immutability | Not enforceable at this layer | Immutability is storage/history behavior. A schema cannot prove a previously recorded version was not edited. |
| UI-02 Attribution | Schema-enforced | `source`, `created_at`, `source_language`, and per-turn `source_id`, `sequence`, `supplied_at`, and `source_language` are required. The identity's real-world truth is outside this layer. |
| UI-03 No inference contamination | Not enforceable at this layer | The closed content union prevents explicit epistemic fields in `UserIdea`, but cannot determine whether supplied text was silently interpreted or normalized before serialization. |
| UI-04 Supersession, not mutation | Not enforceable at this layer | Requires comparison with retained prior versions and storage behavior. The schema only represents the current cumulative version and explicit links. |
| UI-05 Explicit supersession linkage | Validator-enforced | A link must point from a later turn to an earlier turn and its `explicit_signal_quote` must occur verbatim in the later textual turn. Determining that the quote semantically expresses correction/withdrawal remains human or parser responsibility. |
| UI-06 Faithful capture | Not enforceable at this layer | Requires comparison with the original input modality. The schema preserves transcription text and names its original modality but cannot prove fidelity. |
| UI-07 Reference vs. fetched content | Schema-enforced | Attached content and external references are disjoint closed shapes; an external reference has no field for fetched content. Whether bytes were mislabeled before serialization is not determinable here. |

## IntentSpec invariants

| Invariant | Classification | Mapping and limitation |
|---|---|---|
| I-01 Inference cannot become User-Provided | Schema-enforced | `origin` selects a disjoint provenance shape: `user_provided` requires `user_statement`; `inferred` requires `derivation`. Correct semantic classification is not machine-provable here. |
| I-02 Assumption cannot become User-Provided | Schema-enforced | `assumed` requires `assumption_basis`, while `user_provided` requires `user_statement`. Correct semantic classification is not machine-provable here. |
| I-03 Unknown may remain unknown | Schema-enforced | Unknown is its own Open Item shape and requires no guessed Claim or value. Empty Claim collections are permitted. |
| I-04 Conflicting claims are preserved | Validator-enforced | A Conflict requires at least two distinct, resolving participants, at least one Claim, and permits only Claim or specific Ambiguity-reading references (never an Unknown). Whether all real conflicts were detected or a participant was silently omitted is not machine-provable here. |
| I-05 Inference provenance | Validator-enforced | Schema requires premises, reasoning kind, and derivation confidence; the validator resolves premise IDs and rejects self-reference and cycles. It cannot judge reasoning quality. |
| I-06 Assumption rationale | Schema-enforced | Assumptions require a gap, rationale, scope, and `reversible: true`, and cannot carry inference confidence. Narrow interpretiveness and justification quality remain semantic judgments. |
| I-07 Clarification decision is separate | Validator-enforced | Clarification decisions are outside Claims/Open Items/Conflicts; the validator requires exactly one resolving decision reference for every Open Item and Conflict. Decision correctness remains semantic. |
| I-08 LOW does not automatically clarify | Not enforceable at this layer | Whether a clarification was automatic or independently justified is behavioral context. LOW decisions may legitimately be either value when rationale exists. |
| I-09 No architecture recommendation leakage | Not enforceable at this layer | Closed fields prevent a dedicated recommendation object, but a recommendation or suitability judgment could be hidden in free text. |
| I-10 No RequirementSpec classifications | Not enforceable at this layer | Closed schemas reject added requirement fields, but cannot determine whether free-text propositions have already compiled intent into requirements. No `RequirementSpec` is designed here. |
| I-11 Negation survives | Schema-enforced | `force.modality` has a distinct `prohibition` value. Whether a parser correctly preserved a particular source negation requires source comparison. |
| I-12 Conditional intent survives | Not enforceable at this layer | `scope_condition` can preserve a condition, but the validator cannot know that source wording contained one or that its meaning was preserved. |
| I-13 Revision supersedes, never mutates | Not enforceable at this layer | `supersedes_intent_spec_id` represents succession, but proving no historical artifact changed requires cross-version storage comparison. |
| I-14 Intent Parsing may fail | Not enforceable at this layer | Failure is the legitimate absence of an `IntentSpec`, not a variant of the produced-artifact schema. Pipeline result handling is outside this layer. |
| I-15 Downstream traceability | Not enforceable at this layer | The validator checks the local prerequisite that User-Provided Claim provenance matches a declared `user_idea_refs` entry. It cannot verify the external UserIdea artifact or any future downstream artifact's complete traceability chain. |
| I-16 Repetition does not increase confidence | Not enforceable at this layer | Requires comparison across runs/versions and knowledge of how confidence was assigned. |
| I-17 Ambiguity readings trace to wording | Validator-enforced | Ambiguities require one or more wording references and at least two candidate readings; the validator requires their UserIdea version to be listed. Quote fidelity and plausibility remain semantic. |
| I-18 Blocked version never consumable | Validator-enforced | Schema makes `blocked` imply `requirement_derivation_consumable: false`; validator requires a HIGH/CRITICAL unresolved item and rejects eligible artifacts containing one. Permanent historical non-consumability still depends on immutable version storage. |
| I-19 Assumptions only fill interpretive gaps | Not enforceable at this layer | Required gap/rationale/scope fields expose the decision for audit, but distinguishing interpretive from technical/operational defaults requires semantic judgment. |
| I-20 Open Item relevance | Not enforceable at this layer | `relevance_rationale` is required, but whether the question is genuinely implicated cannot be decided structurally. |
| I-21 Conflict resolution authority/versioning | Not enforceable at this layer | Requires comparing origins and resolution events across `UserIdea` and `IntentSpec` versions. Single-artifact validation cannot prove authorized resolution or non-mutation. |
| I-22 Independent modality axes | Schema-enforced | Force is optional and limited to obligation/prohibition/permission/preference; self-reported uncertainty and discourse role are separate fields. Whether source wording was assigned correctly remains semantic. |

## Deterministic checks and fixtures

Run:

```text
npm test
```

The test runner validates both schemas, every JSON fixture against the appropriate schema, and
the single-artifact semantic rules above. `tests/contracts/fixtures/valid` covers cumulative
supersession, multi-part turns, force-absent descriptive Claims, hedging, inference and assumption
provenance, exact Ambiguity-reading conflicts, an eligible artifact, and a permanently
non-consumable Blocked artifact. `tests/contracts/fixtures/invalid` adversarially covers
reference contamination, attachment integrity, unsupported supersession, provenance and modality
misclassification, Ambiguity distinctness, invalid Conflict participants, clarification coverage,
and every Blocked/impact eligibility direction.
