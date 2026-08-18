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

### Stage: Intent Parsing

- **Purpose:** Understand what the user is actually asking for, disambiguated from how they phrased it.
- **Input:** `UserIdea`
- **Output:** `IntentSpec`
- **Allowed to decide:** What the user's goal appears to be; what in the idea is explicit vs. left implicit at the level of intent (not requirements); what is ambiguous enough to flag for clarification.
- **Not allowed to decide:** Any technology, framework, or architecture; functional or non-functional requirements — deriving those from the intent belongs to Requirement Derivation; what the user "should" want instead of what they asked for.

### Stage: Requirement Derivation

- **Purpose:** Turn intent into concrete technical and operational requirements.
- **Input:** `IntentSpec`
- **Output:** `RequirementSpec`
- **Allowed to decide:** Functional requirements, non-functional requirements (latency, cost, compliance, team skill, scale), constraints, and success criteria derived from the accepted `IntentSpec`.
- **Not allowed to decide:** Which technologies satisfy those requirements; how many architecture candidates will be produced; what the user meant — that is `IntentSpec`'s output, taken as given.

### Stage: Research Planning

- **Purpose:** Determine what needs to be researched to responsibly satisfy the `RequirementSpec`.
- **Input:** `RequirementSpec`
- **Output:** `ResearchPlan`
- **Allowed to decide:** What questions need answers, what categories of technology are in scope, what sources are authoritative enough to consult, and what counts as sufficient evidence coverage for this plan.
- **Not allowed to decide:** The answers themselves; which technology is best.

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
