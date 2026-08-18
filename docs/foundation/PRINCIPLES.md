# MIHVER — Architectural Principles

These principles are non-negotiable for Mihver Architect itself and for the
`MihverArchitectureSpec` outputs it produces. Any design or implementation decision that violates
one of these must either be rejected or must amend this document explicitly — it must never be
silently overridden. See [VISION](./VISION.md) for why these principles exist and
[ADR-0001](../adr/ADR-0001-ARCHITECTURE-COMPILER-MODEL.md) for the compiler model these principles
support.

## 1. Provider Agnosticism

Mihver Architect's own core — its pipeline stages and the contracts between them — must not
hard-depend on a specific vendor's API shape or a specific framework's execution model in a way
that would require redesigning a stage to swap it out. Models, orchestrators, memory systems,
sandboxes, tool protocols, and infrastructure that MIHVER uses internally to do its own work must
be replaceable without touching the pipeline's contracts.

This does not forbid a `MihverArchitectureSpec` from recommending a provider-specific technology
for the user's system. A generated architecture may legitimately select a provider-specific
capability when it is the evidence-backed best fit (Principle 9); the resulting portability
constraints and substitution cost must simply be stated explicitly, not hidden.

## 2. Evidence Before Recommendation

No material architectural recommendation may rest on an LLM's assertion alone. This applies to
which `TechnologyCandidate` is selected, and equally to structural decisions Architecture
Synthesis makes that are not themselves technology selections — topology, worker count,
delegation structure, isolation boundaries, human approval points, state-sharing strategy, and
concurrency structure among them.

Every material recommendation must cite an explicit basis. At M0, a valid basis is one of:

- `RequirementSpec` — the recommendation follows from a stated requirement or constraint;
- `Evidence` — a documented, sourced, dated observation;
- a stated architectural invariant or rule (e.g. one of these Principles).

An LLM may propose a recommendation, but the proposal is accepted only once it names which of
these bases supports it — never on the strength of the proposal alone. Empirical evidence from
running a candidate (sandbox experiments) is a stronger basis than any of the above, but it is an
M1 concern; M0 has no access to it and must not treat an untested assumption as if it were
empirically confirmed.

## 3. Structured Artifacts Between Stages

Major stages of the pipeline (`IntentSpec` → `RequirementSpec` → `ResearchPlan` →
`EvidenceBundle` → `TechnologyCandidateSet` → `ArchitectureCandidate` → `ArchitectureDecision`
→ `MihverArchitectureSpec`) communicate through explicit, inspectable contracts rather than
uncontrolled natural-language handoffs. A stage consumes only the upstream artifacts explicitly
declared as its inputs — which may be more than one, since a later stage is often re-evaluated
against an earlier artifact such as `RequirementSpec` — and produces only its declared output type
at its declared cardinality (most stages produce exactly one artifact; Architecture Synthesis
declares a cardinality of one-or-more `ArchitectureCandidate` artifacts), or an explicit failure
result (see "Stage Failure and Revision" in [M0_SCOPE](./M0_SCOPE.md)). A stage never produces
anything else instead, and must never read another stage's undeclared internal state or an
artifact not named as one of its inputs.

## 4. Separate Facts From Decisions

Research evidence and architectural recommendations must be stored separately. An `EvidenceBundle`
is a record of what was observed about the ecosystem; an `ArchitectureDecision` is a record of
what was chosen and why. Merging the two makes it impossible to later ask "was the evidence wrong,
or was the judgment wrong?" — a distinction Principle 11 (Reproducibility) depends on.

## 5. Freshness Is Explicit

Technology knowledge must track source, version, verification date, confidence, and freshness.
"This framework supports X" is not a usable fact on its own — it must carry where that claim came
from, when it was verified, and how confident MIHVER is that it still holds. Stale or unsourced
claims must be visibly stale or unsourced, never presented as equivalent to fresh, verified ones.

## 6. Deterministic Where Possible

Compatibility rules, validation, scoring inputs, schema validation, security constraints, and
experiments should be deterministic whenever practical. Wherever a check *can* be expressed as
code that produces the same output for the same input, it must be, rather than re-asked of a model
each time. Any check that is not deterministic must declare itself as heuristic (model-assisted) or
human-reviewed, so that downstream consumers of its output know how much weight it can bear.

## 7. LLMs Are Reasoners, Not Authorities

An LLM may propose or interpret — draft an `IntentSpec` from a `UserIdea`, suggest candidate
technologies, explain a tradeoff — but it should not silently become the source of truth. Its
outputs are inputs to a stage, subject to the same validation and evidence requirements as any
other proposal, not a final answer by virtue of being model-generated.

## 8. Multiple Candidate Architectures

MIHVER should avoid immediately committing to the first plausible architecture. Architecture
Synthesis must search for materially distinct alternatives, not cosmetic variants of the same
design, and the search itself — including its outcome — is recorded. MIHVER may proceed to an
`ArchitectureDecision` over a single candidate only when the record shows why no other materially
viable candidate exists, and it may conclude that no acceptable candidate exists at all. What is
disallowed is generating one candidate and calling that generation an evaluation.

## 9. Best-Fit, Not Universal Best

Architecture decisions are contextual. Security-critical systems and hobby projects may
legitimately receive different architecture recommendations for what looks like a similar
`UserIdea`, because their `RequirementSpec` differs. MIHVER does not maintain a single ranked
"best stack" independent of requirements.

## 10. Explainability

MIHVER must be able to answer, for any `ArchitectureDecision`:

- What was selected?
- Why was it selected?
- What alternatives were rejected?
- What evidence supported the decision?
- What remains uncertain?

If any of these five questions cannot be answered from stored artifacts, the decision is not
complete, regardless of whether it "worked."

## 11. Reproducibility

A past `ArchitectureDecision` must be reconstructable from retained, versioned artifacts — the
evidence and assumptions available at the time it was made. This requires that `EvidenceBundle`
and intermediate artifacts are retained and dated, not overwritten or discarded once a later stage
consumes them.

## 12. Evolvability

A newly released framework, model, memory approach, sandbox, protocol, or infrastructure provider
should be introducible without redesigning MIHVER's core. If adding one new `TechnologyCandidate`
requires changing the shape of `RequirementSpec` or the pipeline itself, the pipeline is too
tightly coupled to today's ecosystem.

## 13. Security by Architecture

Any `MihverArchitectureSpec` that grants an agent capability such as shell access, filesystem
access, network access, secrets access, repository write access, or production access must state
why that capability is needed and what boundary constrains it. This invariant applies to the
`MihverArchitectureSpec` artifact itself starting at M0; the mechanisms that enforce these
boundaries at runtime are the concern of later milestones, per [M0_SCOPE](./M0_SCOPE.md).

## 14. Complexity Must Be Justified

MIHVER should be capable of concluding:

> "You do not need an AI agent for this problem."

It must not add agents, vector databases, orchestration frameworks, distributed systems, or other
complexity unless the `RequirementSpec` justifies them. A correct output of the pipeline can be an
architecture with zero agents in it.
