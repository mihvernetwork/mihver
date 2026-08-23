# M0 — Idea → Architecture: Scope

## Milestone Input and Output

```text
Input:  UserIdea
Output: MihverArchitectureSpec
```

M0 covers everything between a user describing an idea in natural language and MIHVER producing a
portable, evidence-backed architecture specification. M0 does **not** provision or execute the
generated architecture — see "What M0 Does Not Contain" below.

"Validated" at M0 means checked against the requirements, evidence, and invariants recorded during
the pipeline run (see the Evaluation and Decision stage below) — it does not mean empirically
tested by running the candidate. Empirical validation through sandbox experiments is M1's concern,
not M0's.

M0's milestone semantic input remains solely `UserIdea` — this document's cross-cutting memory
integration (below) does not add a second semantic input. Separately, an M0 invocation also carries
a `RunContext` — or its explicit absence: a non-semantic run/invocation identity anchor, established
outside both the pipeline's own artifact chain and MIHVER Brain. `RunContext` answers "which run,
and optionally which project, is this" — never "what does the user want" (`UserIdea`'s and Intent
Parsing's question alone) — and is never itself a milestone input, a Claim's provenance, or
Evidence. See "Cross-Cutting: RunContext" below.

## Pipeline

```text
UserIdea
    ↓
IntentSpec
    ↓
RequirementSpec
    ↓
ResearchPlan
    ↓
EvidenceBundle
    ↓
TechnologyCandidateSet
    ↓
ArchitectureCandidate (one or more)
    ↓
ArchitectureDecision
    ↓
MihverArchitectureSpec
```

The diagram shows the primary hand-off chain. Several stages additionally consume one or more
earlier artifacts alongside their immediate predecessor — each stage's description below states
its full input list explicitly (per Principle 3, [PRINCIPLES](./PRINCIPLES.md)). No stage reads
anything not named as one of its declared inputs. Stage boundaries below are described in terms of
purpose and decision authority, not implementation — the properties an artifact must satisfy (such
as an evidence entry carrying a source and verification date) are semantic requirements on that
stage's output, not a schema. Field names, cardinality, and serialization are deferred from this
foundation document to subsequent M0 design work (the Requirement IR / Architecture IR schema
effort and its siblings) — they are still in scope for M0, just not for this scope document.

## Cross-Cutting: RunContext (Run/Invocation Scope Anchor)

`RunContext` is a non-memory, non-semantic identity anchor for the current MIHVER invocation —
established by whatever invokes MIHVER (a session, workspace, or engagement binding) before Intent
Parsing runs, entirely outside MIHVER Brain (`../mihver-brain`) and outside the pipeline's own
artifact chain (`UserIdea` → ... → `MihverArchitectureSpec`). It answers "which run, and optionally
which project, is this" — never "what does the user want" (that remains Intent Parsing's exclusive
question, answered from `UserIdea`) and never "what happened before" (that is what Brain, filtered
through `RunContext` via the MemoryContext Producer boundary below, may supply).

`RunContext` is:

- established once, by the invoking context, not derived, inferred, or reconstructed from anything
  Brain stores;
- independent of Brain — Brain may be *asked about* a project matching this identity; it may never
  *supply* the identity being asked about (a Brain record must never authenticate its own
  applicability);
- allowed to be explicitly absent — a genuinely projectless, exploratory, or one-off engagement is a
  valid, complete state, not an error requiring escalation;
- never a substitute for `UserIdea`, never part of a Claim's provenance chain, and never itself
  Evidence.

**Primary semantic pipeline input vs. cross-cutting run context.** M0's declared milestone semantic
input stays exactly `UserIdea` (see "Milestone Input and Output" above), unchanged by this
amendment. `RunContext` is not a second semantic input competing with it, and no stage's declared
`Input:` list in the Pipeline section below is amended to add `RunContext` itself — it is consulted
only by the MemoryContext Producer boundary immediately below, never read directly by a pipeline
stage as if it were a declared artifact input.

**Global vs. project-scoped memory when `RunContext` is absent.** With no `RunContext` established,
only `global`-scoped Brain memory can mechanically pass the MemoryContext Producer's
scope-admissibility check below; no project-scoped record may be admitted, because there is no
anchor to verify it against.

**What a Brain `project` memory may do instead.** Once `RunContext` already establishes an
identity, a Brain `project` record matching that identity may **corroborate** it — supplying
additional durable description or history about a project whose identity is already independently
known. It may never **establish** that identity in the first place, and it is never consulted
before `RunContext` exists to help decide what `RunContext` should be.

## Cross-Cutting: MemoryContext Producer Boundary

This is the sole boundary through which durable memory (MIHVER Brain) may reach a pipeline stage.
It is **not a new linear pipeline stage** — it does not sit at a fixed point in the diagram above,
transforming one primary artifact into the next the way each stage in the Pipeline section does. It
is a cross-cutting boundary/service, invoked repeatedly, once per authorized retrieval, by whichever
already-authorized stage currently needs it, at that stage's own point in the pipeline. Each
invocation produces its own fresh, independently immutable `MemoryContext`.

**Inputs:**

- the current run's `RunContext`, or its explicit absence;
- the identity of the specific consuming stage invoking it;
- a stated retrieval purpose;
- the relevant upstream-artifact-version binding, where the retrieval purpose depends on one (see
  "MemoryContext Lifecycle and Failure" below);
- an explicit, already-computed semantic verdict about a specific memory entry — only when one is
  being mechanically carried through from the consuming stage that already owns it (e.g. a stage's
  own already-stated finding that a specific entry no longer applies). Merely supplying an upstream
  artifact or its version is not, by itself, such a verdict and confers no license to form one.

**Output:** exactly one immutable `MemoryContext` per authorized invocation.

**Allowed to decide:**

- retrieval and filtering against the stated purpose;
- resolving Brain's own lifecycle and supersession chain;
- mechanical scope admissibility against `RunContext` (identity match only — including
  `global`-scope admission, which is scope-tag equality only, never a judgment that a
  `global`-tagged record's content is genuinely project-agnostic);
- mechanical, age/lifecycle-based freshness flags, derived from a record's own timestamps — never a
  judgment that the record's underlying real-world claim is still true;
- source/provenance capture;
- the least-authority classification needed to deliver an entry under the correct authority tier;
- fail-closed exclusion of an entry when it cannot be safely classified — ambiguity is resolved
  toward less authority, never more, and never toward the entry being admitted under a default or
  best-guess classification.

**Not allowed to decide, under any circumstance:**

- what the current user means;
- whether a memory's content semantically contradicts current-run meaning — unless the specific,
  already-computed verdict about that specific entry has itself been supplied as an explicit input
  (in which case the boundary may mechanically apply that literal verdict, never form a new one);
- Requirements;
- technology eligibility;
- Evidence truth;
- architecture selection;
- candidate ranking;
- any other decision that belongs to a specific downstream stage's own declared authority.

**Stage isolation, preserved explicitly:** a stage never queries MIHVER Brain directly, under any
circumstance. The only path memory may take to reach a stage is:

```text
Brain
  → MemoryContext Producer
  → immutable MemoryContext
  → explicitly-authorized consuming stage
```

### MemoryContext Lifecycle and Failure

Each `MemoryContext` is bound, at production, to: the run, the `RunContext` (or its explicit
absence) it was verified against, the consuming stage it was produced for, the retrieval purpose,
and the specific version of any upstream artifact that purpose depended on.

If a bound upstream artifact is superseded, the `MemoryContext` produced against its prior version
is no longer current: it remains immutable historical state (never deleted, never mutated in place)
but must not be silently reused by new reasoning — a consuming stage that still needs memory context
obtains a fresh `MemoryContext` bound to the new version instead, mirroring "Cross-Cutting: Stage
Failure and Revision" below for the artifacts a stage is re-run against.

A `MemoryContext` produced for one run is never carried forward and reused, as-is, by a later run,
even one bound to an identical `RunContext`-or-absence and identical upstream version — each run's
own authorized invocation produces its own fresh snapshot.

If MIHVER Brain is unavailable at retrieval time, the Producer still emits its one immutable
`MemoryContext` for that invocation, carrying zero admitted entries and an explicit
retrieval-unavailable outcome — distinct from a successful retrieval that simply found nothing. The
consuming stage proceeds without any admitted memory content in either case; Brain's availability is
never a precondition for any stage to function, since no stage's declared input list requires memory
as anything other than an optional, additional input whose absence degrades gracefully.

### Principle 3 Compliance

This boundary is a declared, cross-cutting compiler boundary, not undeclared stage-internal state:
`RunContext` and MIHVER Brain are never named in any stage's declared `Input:` list, in this
document or any future one — a stage's only possible path to memory content is a `MemoryContext`
its own `Input:` list explicitly declares (currently, Research Planning and Intent Parsing each
declare one — see below; Requirement Derivation does not, and its own `MemoryContext` consumer
authorization remains a separate, not-yet-authorized future task, distinct from and not implied by
either existing consumer's own authorization). No stage may query Brain directly, and no stage may
treat a `MemoryContext` it was not explicitly authorized to consume as an implicit input. This
preserves Principle 3 (Structured Artifacts Between Stages, [PRINCIPLES](./PRINCIPLES.md)) exactly
as already stated — applied to a boundary that did not exist when that principle, or this document,
was first written.

### Stage: Intent Parsing

- **Purpose:** Understand what the user is actually asking for, disambiguated from how they phrased it.
- **Input:** `UserIdea`, plus an optional `MemoryContext` — produced specifically for Intent
  Parsing by the MemoryContext Producer boundary above, bound to the current `UserIdea` version
  the retrieval purpose depends on, the current `RunContext` (or its explicit absence), and this
  stage's own retrieval purpose. `MemoryContext` absence, an empty retrieval, or MIHVER Brain being
  unavailable must never block Intent Parsing — it proceeds exactly as it would with no memory
  system at all. `UserIdea` remains Intent Parsing's sole primary semantic input; wherever current
  `UserIdea` content is relevant at all, it wins completely over an admitted `MemoryContext` entry
  (`MEMORY_CONTEXT.md`'s "Current Input Must Win").
- **Output:** `IntentSpec`
- **Allowed to decide:** What the user's goal appears to be; what in the idea is explicit vs. left
  implicit at the level of intent (not requirements); what is ambiguous enough to flag for
  clarification. Where an admitted `MemoryContext` entry is used at all, it is authorized only at
  exactly the two tiers `INTENT_SPEC.md`'s Inference Policy now defines, and no other:
  - **`DISCOVERY_ATTENTION`** — a Category A or Category B historical `MemoryContext` entry may
    shape or add a candidate clarification question posed to the current user. It may never itself
    create a User-Provided Claim, create an Assumed Claim, settle an Open Item or Conflict, alter a
    Decision Impact level, or narrow current `UserIdea` meaning — only the current user's own
    current answer, if given, becomes a User-Provided Claim.
  - **`SEMANTIC_PREMISE`** — a qualified Category A historical `MemoryContext` entry (per
    `MEMORY_CONTEXT.md`'s "Historical User Provenance Gate," classified `influence_tier:
    SEMANTIC_PREMISE` for this use) may be cited directly, by reference, as a premise of a
    current-run Inferred Claim, per `INTENT_SPEC.md`'s Inference Policy. Category B is
    categorically ineligible for this tier, at any confidence or repetition level. The resulting
    Claim's origin is Inferred, and only Inferred — never User-Provided, never Assumed. A memory
    premise never, by itself, closes a HIGH or CRITICAL Decision Impact item, and a memory-premised
    Claim's own force is never mechanically copied from the historical statement's force.
- **Not allowed to decide:** Any technology, framework, or architecture; functional or
  non-functional requirements — deriving those from the intent belongs to Requirement Derivation;
  what the user "should" want instead of what they asked for. A `MemoryContext` entry is never a
  `Conflict` participant, is never treated as `Evidence`, and never causes Intent Parsing to query
  MIHVER Brain directly.

### Stage: Requirement Derivation

- **Purpose:** Turn intent into concrete technical and operational requirements.
- **Input:** `IntentSpec`
- **Output:** `RequirementSpec`
- **Allowed to decide:** Functional requirements, non-functional requirements (latency, cost, compliance, team skill, scale), constraints, and success criteria derived from the accepted `IntentSpec`.
- **Not allowed to decide:** Which technologies satisfy those requirements; how many architecture candidates will be produced; what the user meant — that is `IntentSpec`'s output, taken as given.

### Stage: Research Planning

- **Purpose:** Determine what needs to be researched to responsibly satisfy the `RequirementSpec`.
- **Input:** `RequirementSpec`, plus an optional `MemoryContext` — produced specifically for
  Research Planning by the MemoryContext Producer boundary above, bound to the current
  `RequirementSpec` version, the current `RunContext` (or its explicit absence), and this stage's
  own retrieval purpose. `MemoryContext` absence, an empty retrieval, or MIHVER Brain being
  unavailable must never block Research Planning — it proceeds exactly as it would with no memory
  system at all.
- **Output:** `ResearchPlan`
- **Allowed to decide:** What questions need answers, what categories of technology are in scope,
  what sources are authoritative enough to consult, and what counts as sufficient evidence coverage
  for this plan — decided on `RequirementSpec`'s own authority alone. Where an admitted
  `MemoryContext` entry is used at all, it is authorized only at the `DISCOVERY_ATTENTION` influence
  tier: it may **add** research questions worth checking, technology categories worth considering,
  or candidate directions worth investigating, beyond what `RequirementSpec` alone already requires.
  Any such addition must be additive (it never narrows or substitutes for `RequirementSpec`-derived
  coverage) and provenance-visible — `ResearchPlan`'s own future contract must be able to show that a
  specific question, category, or direction originated from a cited `MemoryContext` entry, without
  this document fixing the field or serialization that records it. For a `global`-scoped entry
  specifically, the MemoryContext Producer's admission is mechanical scope-tag equality only (see
  above) — that is never itself confirmation that the entry's content actually generalizes to the
  current project. Research Planning must independently confirm a `global`-scoped entry's content is
  genuinely project-agnostic before using it with this content-shaping effect; an entry it cannot so
  confirm is not used for this purpose.
- **Not allowed to decide:** The answers themselves; which technology is best. Memory must never
  cause Research Planning to remove or skip a `RequirementSpec`-derived research question, narrow
  required research coverage, establish an answer as true, determine technology eligibility,
  determine which technology is best, determine architecture, change a Requirement, or change user
  intent — nor may a `MemoryContext` entry be treated as current Evidence. Research Planning's own
  existing authority over which sources count as authoritative and what evidence coverage is
  sufficient is exercised solely from `RequirementSpec`; it is never delegated to, weakened by, or
  shared with memory merely because a `MemoryContext` was produced for this invocation. A
  `MemoryContext` entry may suggest where else to look; it never decides how trustworthy an answer
  is.

### Stage: Research + Evidence Collection

- **Purpose:** Execute the `ResearchPlan` against the relevant technology ecosystem — including the AI/agent ecosystem where applicable — and record what was found.
- **Input:** `ResearchPlan`
- **Output:** `EvidenceBundle`
- **Allowed to decide:** How to classify and record each observation — source, version, verification date, confidence, and freshness (Principle 5) — under the authority and sufficiency criteria the `ResearchPlan` already set.
- **Not allowed to decide:** Which sources count as authoritative or how much evidence is sufficient — those were fixed by Research Planning; which technology to recommend; how candidates compare to each other.

### Stage: Technology Candidate Identification

- **Purpose:** Screen concrete, named technologies against the `RequirementSpec`'s hard eligibility constraints, grounded in the `EvidenceBundle`. Eligible technologies may be agentic (models, orchestrators, memory systems, sandboxes) or non-agentic (workflow engines, schedulers, databases, queues, deterministic services, libraries, infrastructure) — this stage does not semantically favor agentic building blocks, and this list is illustrative, not a fixed taxonomy.
- **Input:** `RequirementSpec`, `EvidenceBundle`
- **Output:** `TechnologyCandidateSet`
- **Allowed to decide:** Which individual technologies pass hard eligibility constraints (e.g. required protocol support, licensing, deployment target) and are therefore plausible building blocks, with evidence references.
- **Not allowed to decide:** How well a technology fits relative to its alternatives — that is scoring, owned by Evaluation; how technologies combine into a full architecture; final selection.

### Stage: Architecture Synthesis

- **Purpose:** Combine eligible technology candidates into one or more complete, internally-consistent, materially distinct candidate architectures rather than cosmetic variants of the same design (Principle 8).
- **Input:** `TechnologyCandidateSet`, `RequirementSpec`
- **Output:** one or more `ArchitectureCandidate` artifacts
- **Allowed to decide:** How candidates combine; what tradeoffs and consequences each full architecture has, described without ranking them against each other; whether an architecture with zero agents is a valid candidate (Principle 14).
- **Not allowed to decide:** Which candidate is best, or how candidates rank against each other — that is Evaluation's job; execution or provisioning of any candidate.

### Stage: Evaluation and Decision

- **Purpose:** Score the `ArchitectureCandidate` artifacts against measurable, architecture-level criteria derived from the `RequirementSpec` — criteria that apply to how candidates combine technologies, not to any single technology's eligibility, which Technology Candidate Identification already settled — and select one, or record that none qualify.
- **Input:** `ArchitectureCandidate` artifacts, `RequirementSpec`, `EvidenceBundle`
- **Output:** `ArchitectureDecision`
- **Allowed to decide:** Which candidate best fits the requirements, or that no candidate qualifies; what was rejected and why (Principle 10, Explainability).
- **Not allowed to decide:** The final portable spec format; whether to provision anything.

### Stage: Specification Generation

- **Purpose:** Emit a portable specification of the selected architecture that is self-contained: usable without needing the rest of the pipeline run to be re-read alongside it.
- **Input:** `ArchitectureDecision`, which incorporates the full selected `ArchitectureCandidate` and cites its supporting `Evidence` — not a bare pointer to either
- **Output:** `MihverArchitectureSpec`
- **Allowed to decide:** How the decision's incorporated content is represented as a complete, self-contained spec.
- **Not allowed to decide:** Anything about provisioning, execution, or runtime behavior of the spec — that is out of scope for M0; any architectural tradeoff not already settled by the `ArchitectureDecision`.

### Cross-Cutting: MemoryContext Consumption Remains Otherwise Disabled

Research Planning and Intent Parsing (above) are the only two stages in this document whose
declared `Input:` list includes `MemoryContext`. Requirement Derivation, Research + Evidence
Collection, Technology Candidate Identification, Architecture Synthesis, Evaluation and Decision,
and Specification Generation each keep exactly the `Input:` list already stated for them above,
unchanged — none of them may consume `MemoryContext`, or query MIHVER Brain in any form, until
this document is separately amended again to declare it for that specific stage.

This document, together with Intent Parsing's own amendment above, authorizes exactly one
`MemoryContext`-premise path: citing a qualified Category A `MemoryContext` entry as the premise of
a current-run Inferred Claim in `IntentSpec`, per `INTENT_SPEC.md`'s own Inference Policy amendment
(`ADR-0004`'s dependency B). It does **not** authorize a direct Requirement-Level Inference premise —
that path (`ADR-0004`'s originally-named dependency C) was re-derived after dependency B landed,
found structurally incoherent against `REQUIREMENT_SPEC.md`'s own R-10/R-22/R-23, and **retired
rather than implemented**; no `REQUIREMENT_SPEC.md` amendment for it is pending or intended (see
`ADR-0004`'s "Post-Acceptance Dependency B/C Disposition" and `REQUIREMENT_SPEC.md`'s R-23). A
memory-informed R-19 default remains gated behind its own separate, narrower, still-pending
`REQUIREMENT_SPEC.md` amendment (`ADR-0004`'s dependency D), unaffected by dependency C's retirement.
This document does not amend `REQUIREMENT_SPEC.md` (that document's own R-23 makes the retired path
explicit, on its own authority); Requirement Derivation remains unauthorized to consume
`MemoryContext` at all — its `Input:` list above stays `IntentSpec` only.

### Cross-Cutting: Stage Failure and Revision

Every stage above may, instead of producing its declared output artifact, report that it cannot —
for example: insufficient input, an unresolved ambiguity, insufficient evidence, no eligible
candidates, or no candidate that clears Evaluation's constraints, as applicable to that stage. A
stage is not obligated to force an output where the input does not support one.

When a stage is revised — an earlier artifact is amended in response to a failure, new evidence,
or user clarification — the amended artifact becomes a new version, and every stage that declared
it as an input reruns against that new version. Revision never edits a past artifact in place; it
supersedes it. The mechanics of retry, triggering, and user interaction that produce a revision are
implementation concerns deferred past this scope document; what M0 fixes here is only that
versioned supersession, not in-place mutation, is how a revision must propagate — and that "no
valid output" is an acceptable, explicit stage result, not a violation the pipeline must paper over.

## What M0 Does Not Contain

M0 ends at `MihverArchitectureSpec`. It explicitly excludes:

- real architecture provisioning,
- runtime execution of generated systems,
- production deployment,
- full sandbox experimentation (validating candidates by actually running them — this is M1),
- a visual IDE,
- billing,
- a marketplace,
- multi-tenant SaaS concerns.

## Future Milestones (High Level Only)

```text
M0 — Idea → Architecture            (this milestone)
M1 — Architecture Experimentation
M2 — Architecture Build
M3 — Architecture Run
```

M1–M3 are named here only to show where M0's boundary sits. Their scope, stages, and artifacts are
intentionally undefined until M0 is complete.
