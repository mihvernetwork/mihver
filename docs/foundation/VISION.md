# MIHVER — Vision

## What MIHVER Is

MIHVER is composed of two distinct things that must never be conflated:

1. **Mihver Architect** — the platform itself. This is the software that takes a `UserIdea`,
   derives an `IntentSpec` and `RequirementSpec`, researches the relevant technology ecosystem —
   including the AI/agent ecosystem where applicable — collects `Evidence`, synthesizes and
   evaluates `ArchitectureCandidate` artifacts, and produces a `MihverArchitectureSpec`.
2. **The systems MIHVER generates** — the output of that process. These are the actual system
   components — which may include agents, orchestrators, memory systems, and infrastructure where
   the requirements justify them, and may just as validly include none — that get specified (and,
   in later milestones, provisioned) for the user's specific problem.

Mihver Architect is not part of the systems it designs, and it does not assume the systems it
designs will resemble itself. A generated architecture may use no LLM at all, a single model call,
or a multi-agent orchestrator — Mihver Architect's job is to determine which, not to be one.

## What MIHVER Is Not

MIHVER is **not**:

- another coding IDE,
- another chatbot,
- another fixed agent framework,
- another LangGraph/CrewAI wrapper,
- permanently tied to a specific model vendor,
- permanently tied to a specific orchestration framework.

Mihver Architect may *use* models, orchestration libraries, and tools internally to do its own
work (research, reasoning, validation). That internal usage is an implementation detail of the
platform and is itself subject to replacement — it is not the product, and it does not constrain
what Mihver Architect is allowed to recommend for a user's system.

## The Core Product Idea

> MIHVER converts a user's intent into an evidence-backed, validated, best-fit system architecture.

MIHVER's focus is AI/agent architecture intelligence — its research, evidence, and evaluation
machinery is built around understanding the agent ecosystem in depth. But its output is a
best-fit *system* architecture for the requirements at hand, not a mandate to include agents.
Depending on the evidence, that system architecture may contain zero, one, or many agents (see
Principle 14, "Complexity Must Be Justified," in [PRINCIPLES](./PRINCIPLES.md)); a correct MIHVER
recommendation can be a deterministic pipeline with no LLM in it at all.

The value MIHVER provides is not "an AI wrote you an architecture." It is that the architecture
came from a traceable process: intent was captured, requirements were derived, the ecosystem was
researched, evidence was collected from authoritative sources, candidates were compared on
measurable criteria, and the final selection can be explained and reproduced. "Validated" here
means checked against recorded requirements, evidence, and invariants, not empirically tested by
running the system — see [M0_SCOPE](./M0_SCOPE.md) for that boundary. See
[PRINCIPLES](./PRINCIPLES.md) for the invariants that make this possible, and
[ADR-0001](../adr/ADR-0001-ARCHITECTURE-COMPILER-MODEL.md) for why this is modeled as a
compilation pipeline rather than a single conversation with a model.

## "Latest" Is Not "Best"

The relevant technology ecosystem — AI/agent and otherwise — produces new models, frameworks,
memory systems, and protocols continuously. A platform that reflexively recommends whatever
shipped most recently is not doing architecture — it is doing trend-following, and recency alone
is not evidence of fitness against a `RequirementSpec`.

MIHVER does not treat recency as a merit. A newer framework is only preferable when evidence shows
it is a better fit for the specific requirements at hand: compatibility with the rest of the
candidate architecture, verified capability, operational maturity, security posture, and the
constraints the user actually has (cost, latency, team skill, compliance, longevity).

MIHVER prefers:

> best-fit technology based on current evidence, compatibility, requirements, and validation.

"Best-fit" is contextual and can change per project. It is not a single ranked list of
technologies that MIHVER always reaches for first — see Principle 9, "Best-Fit, Not Universal
Best," in [PRINCIPLES](./PRINCIPLES.md).

## Scope of This Document

This document defines what MIHVER is and why it exists. It intentionally does not define
implementation details, technology choices, or schemas. Those belong to later M0 design work (see
[M0_SCOPE](./M0_SCOPE.md)) and to the artifacts MIHVER itself produces (`RequirementSpec`,
`ArchitectureCandidate`, `MihverArchitectureSpec`, etc.), not to this vision statement — schema
design is still part of M0, just not part of establishing the vision.
