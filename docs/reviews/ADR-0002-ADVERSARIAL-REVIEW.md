# ADR-0002 Adversarial Review

Task: `ADR-0002-ADVERSARIAL-REVIEW`. Branch: `review/adr-0002-adversarial-review`.

## Purpose

[ADR-0002](../adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md)'s Status is **Proposed**. Its "Future
Work" names two conditions for revisiting that status: schema design work, and "at least one
adversarial review pass (see [INTENT_CASES](../examples/INTENT_CASES.md)) [that has] exercised the
model against real cases." Schema design already happened — M0 Step 02B, merged `0683e84`
(`schemas/m0/*.json`, [SCHEMA_MAPPING.md](../contracts/SCHEMA_MAPPING.md),
`tests/contracts/**`) — and this task does not redesign it. This report is the second condition:
an adversarial review of the epistemic model
([INTENT_SPEC.md](../contracts/INTENT_SPEC.md)'s 22 invariants) against every scenario in
`INTENT_CASES.md`, cross-checked against the schema, the deterministic validator
(`tests/contracts/validate-contracts.mjs`), and existing fixtures.

## Method

Two independent read-only Codex reviewers examined disjoint angles of the same material, per
`AGENT_POLICY.md`'s "Separation of Implementation and Review" and "Parallel Worker Rules" (both
read-only, both examining the same material from different angles — no overlapping write scope,
no dependency between them):

- **Reviewer A** — epistemic/semantic correctness: does each `INTENT_CASES.md` case correctly and
  consistently apply the model's own stated policies (Assumption, Conflict, Clarification, Unknown,
  Confidence)? Does any case expose a genuine contradiction or gap in `ADR-0002` itself?
- **Reviewer B** — schema/validator coverage: can the merged JSON Schema and validator structurally
  represent every case losslessly? Is `SCHEMA_MAPPING.md`'s enforcement classification accurate?
  What invariants lack dedicated fixture coverage?

Claude (this report's author) independently re-verified each reviewer's most material claims
against the actual file contents already read in full this session — grep-confirmed every fixture
coverage gap Reviewer B reported, and re-traced Reviewer A's strongest correctness claims against
the exact `INTENT_CASES.md`/`INTENT_SPEC.md` wording — per `REVIEW_PROTOCOL.md`'s instruction to
treat a worker's conclusion as a claim to check, not a finding to relay. No unsupported or
unverifiable claim from either reviewer is included below without that verification being noted.

## Adversarial Categories — PASS/FAIL

| Category | Verdict | Basis |
|---|---|---|
| **Structural representability** (can the schema express every case's Claims/Open Items/Conflicts/handoff losslessly?) | **PASS** | Reviewer B found no case the schema cannot structurally represent (19 PASS, 1 CONCERN on depth of testing — not representability — for Case 20). Independently spot-checked: `speaker` supports `reported_third_party`+`attribution`; `conflict.participants` allows `minItems: 2`; `candidate_readings` requires `minItems: 2`; `scope_condition` and `force` (optional) exist on `claimCommon`. |
| **`SCHEMA_MAPPING.md` accuracy** (does its enforcement classification hold against the real schema/validator?) | **PASS** | Both reviewers checked this independently; neither found a false "Schema-enforced"/"Validator-enforced" claim. Verified directly: I-05 (`inferenceProvenance` requires `premise_claim_ids`/`reasoning_kind`/`derivation_confidence`; validator resolves premises, rejects self-reference/cycles, checks confidence escalation), I-06 (`assumptionProvenance` requires `gap`/`rationale`/`scope`/`reversible: true`), UI-02 (turn `source_id` must match `document.source.source_id`) all check out as written. |
| **Deterministic validation** | **PASS** | `npm install && npm test` → `Contract validation passed: 24 fixtures checked.` (run directly by Claude, not just relayed from either reviewer). |
| **Epistemic/semantic correctness of the model's own worked examples** | **FAIL** | Reviewer A found the corpus's own Decision Impact ratings contradict the contract's stated MEDIUM/HIGH boundary in multiple cases, and found one case (13) internally self-contradictory (classifies the same gap as both Ambiguity and Unknown). Independently re-verified below — these are not stylistic nitpicks; they are the corpus failing to consistently apply the policy it exists to demonstrate. |
| **Fixture/test coverage of the 29 invariants (22 IntentSpec + 7 UserIdea)** | **FAIL** | Only I-05, I-07, and the single-artifact portion of I-18 have a genuine dedicated valid+invalid pair; most invariants have partial or no dedicated adversarial fixture. Independently grep-confirmed the three most concrete gaps below. |

No category returned an outright "the schema cannot represent this" structural impossibility — the
epistemic model's three-kind shape (Claim/Open Item/Conflict) is sound at the representational
level. The FAILs are about **rigor of the evidence produced so far**, not about the model's basic
shape being wrong.

## Material Findings

### 1. Case 13 is internally self-contradictory (verified)

`INTENT_CASES.md` Case 13 ("Human approval requirement") first classifies which environments
"deployment" covers as an **Ambiguity**: "the word 'deployment' alone supports multiple readings,
so this is an Ambiguity, not an Unknown." Two paragraphs later, in "Clarification needs," the same
unresolved item is described as staying "**Unknown**... which environments are covered is an
operational scope question the user never addressed" — which is verbatim the contract's own test
for *Unknown*, not Ambiguity ("if no wording in the `UserIdea` addresses the question at all, it's
an Unknown. If specific wording addresses it but that wording itself supports more than one
reading, it's an Ambiguity" — `INTENT_SPEC.md`, "Open Item"). The same case cannot correctly be
both. This is a defect in the worked corpus itself, not merely a reviewer's stylistic complaint.

### 2. Decision Impact is applied inconsistently against the contract's own MEDIUM/HIGH definitions (verified in 2 of the cited cases, plausible in the rest)

The contract defines MEDIUM as "the eventual answer shifts details but not the shape of the
solution" and HIGH as "proceeding without resolution risks a materially different or significantly
more expensive architecture." Several cases rate MEDIUM (or LOW) while their own stated
decision-impact reasoning describes a shape-level, not detail-level, consequence:

- **Case 2** (research system): rated MEDIUM, but its own reasoning states the unresolved item
  determines "whether the architecture needs authenticated/licensed data access **at all**, versus
  purely public sources" — that is eligibility of architecture candidates, which the contract's own
  HIGH definition covers, not MEDIUM's "shifts details."
- **Case 14** (unknown scale): rated MEDIUM, but its own reasoning states the unresolved scale
  determines "whether the architecture needs elastic/distributed capacity **or a simpler
  fixed-capacity design**" and "affects architecture significantly" — again a shape-level fork, not
  a detail.
- Reviewer A additionally flagged Cases 6, 9, 10, 11 on the same pattern; these were not
  independently re-verified line-by-line by Claude before writing this report but follow the same
  structure as the two confirmed above, and are plausible on their face given the confirmed
  pattern.

This is not a case of two reasonable people disagreeing on a coarse scale (`ADR-0002`'s own "Risks"
section already names Decision Impact miscalibration as a *known risk of an implementation*). What
this review adds is that the risk is realized **in the ADR's own illustrative corpus**, the
document whose entire purpose is to demonstrate the policy is usable — not a hypothetical future
implementation failure.

### 3. Fixture coverage is far narrower than the scenario corpus or `SCHEMA_MAPPING.md`'s structural claims (independently grep-confirmed)

Directly confirmed by Claude (not merely relayed):

```text
$ grep -rl "scope_condition" tests/contracts/fixtures/       → (no results)
$ grep -rl "reported_third_party" tests/contracts/fixtures/  → (no results)
$ grep -rho '"discourse_role": *"[a-z]*"' tests/contracts/fixtures/ | sort -u
  "discourse_role": "operative"                              → only value ever used
```

`scope_condition` is exactly the field Case 9 (conditional requirement) depends on, and no fixture
exercises it — the schema's capability to represent a conditional Claim (I-12) has never actually
been tested. Likewise `reported_third_party` speaker attribution (needed for cases like "my CTO
says X") and every non-`operative` `discourse_role` value (`example`/`quotation`/`sample`) are
schema-legal but fixture-untested.

`intent-spec-multiple-versions-one-idea.json` — the only fixture exercising cross-version
supersession (`supersedes_intent_spec_id`, relevant to Case 20) — was confirmed to have empty
`claims`, `open_items`, and `conflicts` arrays. It proves the *field* is accepted; it does not prove
a claim-bearing supersession (the actual shape Case 20 needs — an old live claim correctly marked
superseded, a new claim taking its place) round-trips correctly.

Reviewer B's broader invariant-by-invariant audit (22 IntentSpec + 7 UserIdea invariants) found
only **I-05, I-07, and the single-artifact portion of I-18** have a genuine dedicated valid+invalid
fixture pair; most others have partial or no dedicated adversarial coverage. This was not
independently re-verified invariant-by-invariant by Claude given the volume (29 invariants), but
the three concrete gaps above were confirmed directly and are consistent with Reviewer B's broader
claim.

### 4. A residual "force" gap for direct, unhedged requests naming a method or technology (Reviewer A; plausible, not independently re-verified)

Reviewer A observed that Cases 7, 16, 17, and 18 each preserve a directly-stated request ("using
LangGraph, GPT-5, Pinecone, and Kubernetes"; "Make a blockchain...") without assigning it a force
value from the contract's defined set (obligation/prohibition/permission/preference), instead
routing the negotiability question into a separate Unknown. This may be a legitimate, deliberate
design choice (the case explicitly reasons that neither "hard requirement" nor "merely
illustrative" is supported by the wording) rather than a gap — but it does mean "how binding is an
explicitly named technology/method, when the wording doesn't hedge either way" has no clean home in
the current four-value force taxonomy. Flagged as a real open question, not confirmed as a defect.

## Unresolved Risks

- **Decision Impact calibration risk is open, not closed.** `ADR-0002`'s own Risks section already
  names this; this review adds concrete evidence the corpus itself doesn't consistently satisfy its
  own MEDIUM/HIGH boundary. Whether Decision Impact should be read as "does this need to block
  before Requirement Derivation" (stage-relative) or "will this ultimately reshape the
  architecture" (outcome-relative) is not settled by the contract text, and Case 9's LOW rating
  (reasoned explicitly as "the risk is architectural only if the condition gets collapsed... not
  here") only makes sense under the stage-relative reading, while the HIGH/MEDIUM definitions read
  as outcome-relative. This ambiguity should be resolved explicitly, not left to worked-example
  precedent.
- **Coverage claims should not be over-read.** `SCHEMA_MAPPING.md`'s classifications are accurate
  as written, but "24 fixtures checked" passing is not evidence that the 20 `INTENT_CASES.md`
  scenarios or the 29 named invariants are adversarially tested — most have no dedicated fixture at
  all. A future reader should not treat `npm test` passing as validation of the epistemic model's
  robustness beyond the specific structural shapes the current fixtures happen to encode.
- **ADR-0002's own open questions remain genuinely open.** The multi-goal decomposition question
  (ADR "Open Questions," 4th bullet) is silently resolved one way by Case 16 (multiple Claims plus
  one relational Claim) without that being flagged in the case as a provisional choice rather than
  settled behavior. The discourse-role-ambiguity question (ADR "Open Questions," 6th bullet from the
  end) is not exercised by any of the 20 cases at all.

## Final Recommendation

**`KEEP_PROPOSED_WITH_REQUIRED_CHANGES`**

Both independent reviewers reached this same disposition from disjoint angles, and Claude's
targeted re-verification of their strongest claims held up. The epistemic model's basic shape
(Claim/Open Item/Conflict, three origins, independent axes) is sound — no case is structurally
unrepresentable, and no invariant was found to be actually violated by the schema/validator as
built. `REDESIGN` would be the wrong call: nothing here requires re-architecting the model. But
`ACCEPT_ADR` (flipping Status to Accepted) would be premature while the corpus meant to demonstrate
the model — `INTENT_CASES.md` itself — contains a confirmed internal self-contradiction (Case 13)
and a confirmed pattern of Decision Impact ratings that don't match the contract's own stated
MEDIUM/HIGH boundary (Cases 2 and 14 confirmed; 6, 9, 10, 11 plausible on the same pattern but not
individually re-verified line-by-line here).

Required changes before `ACCEPT_ADR` should be reconsidered:

1. Fix Case 13's Ambiguity/Unknown self-contradiction in `INTENT_CASES.md`.
2. Resolve whether Decision Impact is stage-relative or outcome-relative, and re-rate the flagged
   cases (2, 6, 9, 10, 11, 14) against whichever reading is chosen — or explicitly document why the
   current ratings are correct under the intended reading, if they are.
3. Add fixtures for `scope_condition`, `reported_third_party`, non-`operative` `discourse_role`
   values, and a claim-bearing (not empty-claims) cross-version supersession matching Case 20's
   shape, before treating schema/validator coverage as adversarially exercised.

None of these require a new task branch to *decide* — per `AGENT_POLICY.md`, that is a human
authorization this report does not itself grant. This task's scope ends here, per its own
instruction: no `ADR-0002` or contract/schema edits were made, and none are recommended as part of
*this* task.

## Reviewer Attribution

- Reviewer A (epistemic/semantic correctness) and Reviewer B (schema/validator coverage): two
  independent read-only Codex MCP sessions, dispatched in parallel from disjoint task contracts
  (per `AGENT_POLICY.md`'s Task Contract and Parallel Worker Rules). Full verbatim reports retained
  in this session's transcript; this document is Claude's critically-reviewed synthesis, not a
  direct relay — see "Method" above for what was independently re-verified versus taken on the
  reviewer's stated basis.
