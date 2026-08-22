# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-FOUNDATION-MEMORY-BOUNDARY-A

## Objective

Implement `ADR-0004`'s (Memory Context Authority Boundary) **dependency A only**: the core
`M0_SCOPE.md` foundation amendment that makes `MemoryContext` integration real without enabling any
narrower dependency (B/C/D). This task deliberately, explicitly amends the frozen M0 foundation, as
directly authorized by the human. Dependency A consists of three parts, all delivered:

1. a non-memory `RunContext` boundary (a cross-cutting run/invocation identity anchor, distinct from
   `UserIdea` as M0's sole milestone semantic input);
2. the cross-cutting `MemoryContext Producer` boundary (inputs, output, allowed/not-allowed
   authority, lifecycle/failure semantics, Principle 3 compliance note);
3. explicit stage declaration for exactly one `MemoryContext` consumer — Research Planning, the
   first and only newly-authorized consuming stage, restricted to `DISCOVERY_ATTENTION`-tier,
   additive, provenance-visible use.

`ADR-0004` itself remains **Proposed** — this task does not change its `## Status` field. Dependency
B (`INTENT_SPEC.md` Inference-premise), dependency C (`REQUIREMENT_SPEC.md` Requirement-Level
Inference premise), and dependency D (`REQUIREMENT_SPEC.md` R-19 memory-informed-rationale
provenance) are **not** implemented by this task and remain structurally disabled.

## Branch / Base

Branch: `m0/foundation-memory-boundary-a`
Base: `main` at `9fb4ab5e0f64b050c9399a2d24376b688d44d082` (verified via `git status`/`git log` before
branching, matching this task's explicit instruction).

## Status

**Complete, pending human review.**

- Authored the full `docs/foundation/M0_SCOPE.md` amendment directly (per
  `AGENT_POLICY.md`'s documentation/architecture-milestone default: Codex read-only review, Claude
  sole file author), adding: a `RunContext` clarification to "Milestone Input and Output"; a new
  "Cross-Cutting: RunContext (Run/Invocation Scope Anchor)" section; a new "Cross-Cutting:
  MemoryContext Producer Boundary" section (with "MemoryContext Lifecycle and Failure" and
  "Principle 3 Compliance" subsections); an amended "Stage: Research Planning" `Input:`/`Allowed to
  decide:`/`Not allowed to decide:` set; and a new "Cross-Cutting: MemoryContext Consumption Remains
  Otherwise Disabled" section naming every other stage as unauthorized and confirming
  `INTENT_SPEC.md`/`REQUIREMENT_SPEC.md` are untouched.
- Dispatched four independent read-only Codex reviewers by axis, per this task's explicit
  instruction: A (Principle 3 / Stage Isolation), B (Producer Authority), C (Research Planning Least
  Authority), D (Cross-Document Contradiction).
  - **A** found one blocking issue: the "Principle 3 Compliance" paragraph's parenthetical
    ambiguously read as if Research Planning's declared input covered `RunContext`/Brain, not only
    `MemoryContext`. Independently verified against the actual text — confirmed real. Fixed by
    stating unconditionally that `RunContext`/Brain are never named in any stage's `Input:` list.
  - **B** found one blocking issue: the Research Planning amendment never required Research Planning
    to independently confirm a `global`-scoped entry's content is genuinely project-agnostic before
    using it with content-shaping effect, a safeguard `MEMORY_CONTEXT.md`'s "Cross-Project Scope
    Verification" section requires of the consuming stage. Independently verified by direct re-read
    of that section — confirmed real and applicable, since Research Planning's only permitted memory
    use *is* content-shaping `DISCOVERY_ATTENTION`. Fixed by adding this confirmation requirement to
    Research Planning's `Allowed to decide:` bullet.
  - **C** found no defect on the least-authority axis — independently reviewed its stated reasoning
    against the actual amended text and agreed no fix was needed.
  - **D** found one non-blocking wording drift: "an M0 invocation also carries a `RunContext`" read
    as mandatory, before the explicit-absence allowance appeared two paragraphs later. Independently
    verified and fixed to "a `RunContext` — or its explicit absence" at first mention.
  - Claude independently verified every finding against the actual file contents and the cited
    source documents (`ADR-0004`, `MEMORY_CONTEXT.md`) before applying any fix — findings were not
    accepted by reviewer say-so alone, and none was rejected by majority vote (there was no
    disagreement among reviewers to adjudicate).
- All three confirmed findings fixed; re-ran validation after fixing.

`npm test`: 32/32. `git diff --check`: clean (only a benign CRLF-normalization warning, exit 0).
`git diff main --stat` / `git diff main --name-only`: exactly one file changed,
`docs/foundation/M0_SCOPE.md`. No schema, runtime, `mihver-brain`, `INTENT_SPEC.md`, or
`REQUIREMENT_SPEC.md` file touched.

## Allowed Scope

- Semantic change: `docs/foundation/M0_SCOPE.md` (used).
- Operational updates: `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md` (this update).

Forbidden and confirmed untouched: `docs/foundation/PRINCIPLES.md`, `docs/foundation/VISION.md`,
`docs/adr/ADR-0001-ARCHITECTURE-COMPILER-MODEL.md`, `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`,
`docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`,
`docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, `docs/contracts/USER_IDEA.md`,
`docs/contracts/INTENT_SPEC.md`, `docs/contracts/REQUIREMENT_SPEC.md`,
`docs/contracts/MEMORY_CONTEXT.md`, `docs/examples/**`, `schemas/**`, `tests/**`, `scripts/**`,
`../mihver-brain/**`.

## Required Context

- `CLAUDE.md`, `docs/foundation/PRINCIPLES.md`, `docs/foundation/M0_SCOPE.md` (pre-amendment),
  `docs/adr/ADR-0001-ARCHITECTURE-COMPILER-MODEL.md`, `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`,
  `docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`,
  `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md` (read in full),
  `docs/contracts/MEMORY_CONTEXT.md` (read in full), `docs/examples/MEMORY_CONTEXT_CASES.md` (read
  in full), `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`.
- Live `git` state (`git status`, `git log`) — not prior-conversation assumptions.

## Validation

- `npm test`: 32/32.
- `git diff --check`: clean.
- `git diff main --stat` / `git diff main --`: exactly `docs/foundation/M0_SCOPE.md`.
- Four independent read-only Codex reviewers (A/B/C/D by axis, see Status above) — see
  `REVIEW_STATE.md`'s "Latest Review" for full findings and disposition.

## Next Gate

A PR from the `devSerdar` fork to `mihvernetwork/mihver:main`, title `M0: integrate core
MemoryContext boundary into foundation`, is to be opened per this task's explicit instruction. Do
not merge. Human review of that PR is the next gate; it authorizes only this dependency-A amendment
— it does not authorize dependencies B/C/D, does not move `ADR-0004` to Accepted, and does not
authorize any `mihver-brain`, schema, or runtime memory-integration work.
