# ADR-0001: Architecture Compiler Model

## Status

Accepted

## Context

MIHVER's stated purpose ([VISION](../foundation/VISION.md)) is to convert a `UserIdea` into an
evidence-backed, validated, best-fit system architecture — one that may contain zero, one, or many
agents depending on the requirements. There are two broadly different ways to build a system that
does this:

1. **A single autonomous chatbot/agent** that takes the idea, reasons about it in one open-ended
   loop (possibly with tool calls), and produces an architecture recommendation as a final
   message.
2. **A pipeline of distinct stages**, each with a defined input artifact, a defined output
   artifact, and a bounded decision authority, that together transform the idea into a
   specification — structurally similar to how a compiler transforms source code into an
   executable.

A single autonomous agent is faster to build and demo. But it collapses intent parsing,
requirement analysis, research, evidence gathering, candidate generation, and evaluation into one
undifferentiated reasoning process. That directly conflicts with several principles in
[PRINCIPLES](../foundation/PRINCIPLES.md): it cannot cleanly separate facts from decisions
(Principle 4), it cannot guarantee
multiple independently-evaluated candidates (Principle 8), and it makes explainability (Principle
10) and reproducibility (Principle 11) dependent on the model's ability to narrate its own
reasoning after the fact, rather than on artifacts that exist independent of any one run.

## Decision

MIHVER Architect will be modeled as an **architecture compiler** rather than as a single autonomous
chatbot.

```text
Traditional compiler

Source
    ↓
Parse
    ↓
Intermediate Representation
    ↓
Analysis
    ↓
Optimization
    ↓
Executable
```

```text
MIHVER

User Idea
    ↓
Intent Parsing
    ↓
Requirement IR
    ↓
Research + Evidence
    ↓
Architecture IR
    ↓
Evaluation
    ↓
Mihver Architecture Specification
```

The two pipelines are not claimed to correspond phase-for-phase — MIHVER has more stages than a
typical compiler's textbook depiction, and its final artifact is a specification to be reviewed
before use, not a directly runnable executable. What is adopted from the compiler model is a smaller
set of properties, not a one-to-one mapping: explicit intermediate artifacts, bounded
transformations between them, deterministic checks where possible, and the ability for a stage to
reject its input rather than being forced to produce output (see "Stage Failure and Revision" in
[M0_SCOPE](../foundation/M0_SCOPE.md)).

Two intermediate representations are introduced as first-class concepts in this model:

- **Requirement IR** — the compiled-down, structured form of what the user needs, produced from
  `IntentSpec` and consumed by every downstream stage that must check candidates or decisions
  against requirements (research planning, candidate identification, synthesis, and evaluation).
  Corresponds to `RequirementSpec` in the M0 pipeline ([M0_SCOPE](../foundation/M0_SCOPE.md)).
- **Architecture IR** — the compiled-down, structured form of a candidate system design, produced
  from technology candidates and consumed by evaluation. Corresponds to `ArchitectureCandidate`
  in the M0 pipeline.

Their schemas are explicitly **not** defined by this ADR. Defining them is future work for the M0
pipeline design, not an architectural precedent to be set here.

## Rationale

Modeling MIHVER as a compiler rather than a chatbot follows directly from the principles it must
satisfy:

- **Stage isolation** (Principle 3, 12): each stage has one job and one contract, so a stage can be
  reimplemented — including replacing which LLM or tool does the reasoning inside it — without
  touching its neighbors.
- **Testability**: an IR is a value that can be constructed by hand and fed into the next stage in
  isolation, the same way a compiler's IR can be unit-tested independent of the parser or code
  generator.
- **Deterministic validation** (Principle 6): once intent and requirements are compiled into a
  structured IR, compatibility and validation checks can run as code against that structure instead
  of being re-derived from prose each time.
- **Model independence** (Principle 1, 7): no stage's *contract* depends on which model implements
  it. A model is a reasoner invoked *within* a stage, not the thing that defines the stage.
- **Observability**: each artifact in the pipeline is a durable, inspectable object, so a run can be
  debugged by looking at where an IR went wrong rather than by re-reading an entire transcript.
- **Reproducibility** (Principle 11): a past `ArchitectureDecision` can be inspected against the
  exact `EvidenceBundle` and Requirement IR that existed when it was made.
- **Ability to replace individual reasoning components**: the research stage, the candidate
  generator, and the evaluator can each be upgraded, swapped, or run with a different model
  independently, because they communicate only through explicit structured artifacts — including
  the Requirement IR and Architecture IR checkpoints — never through shared conversational state.
- **Easier future evaluation**: comparing two versions of MIHVER's own pipeline is possible by
  diffing the IRs and decisions they produce for the same `UserIdea`, rather than comparing free-form
  conversations.

## Consequences

- MIHVER's pipeline requires more upfront structural design than a single-prompt agent would. Each
  stage boundary and artifact must be thought through before implementation, which is slower to
  reach a first demo.
- Every stage transition is an opportunity for information loss: if an IR cannot represent
  something the previous stage understood, that nuance is dropped. IR design must be revisited as
  real instances of `UserIdea` expose gaps.
- The pipeline is more code to build and maintain than a single agent loop, and introduces more
  places where a bug can silently produce a malformed artifact that a later stage accepts anyway.
- This ADR commits MIHVER to *staged* processing as a structural pattern. It does not commit MIHVER
  to any specific orchestration technology to implement those stages — that remains an open,
  evidence-driven decision for a future ADR.

## Alternatives Considered

- **Single autonomous chatbot/agent.** Rejected as the primary model: fastest to prototype, but a
  monolithic, transcript-centric implementation does not reliably satisfy Principles 3, 4, 8, 10,
  or 11 unless it introduces explicit stage boundaries and durable artifacts internally — at which
  point it has adopted the essential properties of the compiler model described here anyway,
  informally and without the benefit of having designed it deliberately.
- **Fixed multi-agent framework (e.g., building directly on a specific orchestrator's agent-graph
  abstractions) as the structural model.** Rejected: would couple MIHVER's core pipeline structure
  to one vendor's execution model, violating Principle 1 (Provider Agnosticism) and Principle 12
  (Evolvability). The compiler model is orchestration-technology-agnostic; a specific orchestrator
  may still be used later as an *implementation detail* of running the stages.
- **Fully manual/human-driven architecture selection with MIHVER as a passive checklist.** Rejected:
  does not fulfill the core product idea in [VISION](../foundation/VISION.md) — MIHVER is meant to actively research,
  synthesize, and evaluate, not just record a human's own selection.

## Risks

- **Over-engineering risk:** a compiler model can be taken further than needed for M0's actual
  scope. Mitigation: [M0_SCOPE](../foundation/M0_SCOPE.md) bounds what each stage may decide, and schemas for Requirement IR
  and Architecture IR are deliberately deferred rather than designed speculatively now.
- **False determinism risk:** representing a stage as a clean IR transition can create an illusion
  of rigor around what is still, internally, LLM-assisted reasoning. Mitigation: Principle 7 (LLMs
  Are Reasoners, Not Authorities) and Principle 2 (Evidence Before Recommendation) apply *within*
  each stage, not just between them.
- **IR churn risk:** because schemas are not yet defined, early IR designs may need to change
  significantly once real instances of `UserIdea` are run through the pipeline. This is treated as
  expected evolution, not a failure of the compiler model itself.

## Future Work

- Define the schema for Requirement IR (`RequirementSpec`).
- Define the schema for Architecture IR (`ArchitectureCandidate`).
- Define the `EvidenceBundle` and `TechnologyCandidateSet` structures and their evidence-sourcing
  requirements (Principle 5).
- Define the scoring/comparison model used in the Evaluation and Decision stage.
- A future ADR should select the concrete implementation approach for running the pipeline stages
  (which is explicitly not decided by this ADR).
