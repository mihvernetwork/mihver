# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-ADR-0004-FINAL-TAXONOMY-CLOSURE

## Objective

A narrow final semantic closure, before any foundation-amendment work begins — same constraints as
every prior round: no runtime integration, no schema, no MCP, `../mihver-brain` not modified, no
frozen foundation document touched, no redesign of unrelated parts. Continue PR #15 in place (no new
PR). Closed three remaining gaps: (1) **made the Historical User Provenance Gate type-independent** —
the gate (Category A direct / Category B derived-unverified, M-18) now applies to any admitted Brain
record production's own content inspection reveals as describing a historical user statement,
regardless of stored Brain `type` (a record misfiled as `reference`/`pattern`/`incident`/etc. is
gated identically to a `decision` record); added the requirement that an apparent citation must
actually be inspectable *and resolvable*, not merely citation-shaped; added new Case 23 (a misfiled
`reference`-type record); (2) **reconciled memory-informed R-19 defaults with the Influence
Taxonomy** by introducing a fourth tier, `DECISION_OPTION` — a memory-suggested value within a
decision a stage already, independently owns, supplying zero independent authority and never
expanding what the stage could already decide, distinct from `DISCOVERY_ATTENTION` (whose candidates
always require further independent screening before establishing anything) — new Invariant M-21, new
Case 24 (a genuinely R-19-eligible retry-count default, contrasted with an intent-level value R-19
excludes regardless of memory); (3) **explicitly decided ADR-0004's Acceptance Gate** — a new
"Acceptance Gate" subsection names four distinct amendment dependencies (A: core `M0_SCOPE.md`
integration; B: `INTENT_SPEC.md` Inference-premise; C: `REQUIREMENT_SPEC.md` Requirement-Level-
Inference; D: `REQUIREMENT_SPEC.md` R-19 provenance) and decides this ADR becomes Accepted-eligible
once dependency A alone is completed and adversarially reviewed, not all four — with reasoning given
for that choice. Across `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md` (Status: Proposed),
`docs/contracts/MEMORY_CONTEXT.md`, and `docs/examples/MEMORY_CONTEXT_CASES.md` (now 24 cases). A
three-reviewer round then found and this task fixed several further internal-consistency defects
this closure round itself introduced or left incomplete (see Status below). No frozen foundation
document modified. `ADR-0004` remains Proposed.

## Branch / Base

Branch: `m0/adr-0004-memory-context-authority`
Base: `main` (`0ec25a0` — matches this task's stated base commit exactly, confirmed via `npm run
context` and `git rev-parse HEAD` before branching)

## Status

**Complete.** Continuation of the same branch/PR (#15) — see `REVIEW_STATE.md`'s History for prior
rounds' full detail.

**Closed all three gaps this task specified:**

1. **Historical User Provenance Gate made type-independent** — Brain `type` is only ever a weak
   classification prior, never an epistemic shortcut past the Category A/B gate: any admitted record
   (of any non-`inbox` type) that production's own content inspection reveals as describing a
   historical user statement is gated identically to a `decision` record. Fixed the Semantic Authority
   Classes table (both in `MEMORY_CONTEXT.md` and `ADR-0004`'s duplicate), which previously said
   `lesson`/`playbook` misfiled content is merely "excluded" and `reference`/`incident` are
   "permanently"/"always" a fixed tier — a direct contradiction of the gate's own exhaustive rule,
   caught by the reviewer round. Added the requirement that an apparent citation must be inspectably
   **and resolvably** traceable, not merely citation-shaped. New Case 23 (a misfiled `reference`-type
   record carrying historical-user-statement content). M-18 and M-03 updated to state
   type-independence explicitly.
2. **`DECISION_OPTION` introduced as a fourth Influence Taxonomy tier**, reconciling memory-informed
   R-19 defaults with the taxonomy without weakening `DISCOVERY_ATTENTION`'s additive-only invariant:
   a memory-suggested value within a decision the consuming stage already, independently owns,
   supplying zero independent authority, never expanding what the stage could already decide, and
   distinguished from `DISCOVERY_ATTENTION` by *what the tier can establish* (a
   `DISCOVERY_ATTENTION`-shaped candidate always still needs an independent downstream mechanism to
   settle anything; `DECISION_OPTION`'s adoption *is* the immediate establishment of Requirement
   content, in the same step, under the stage's own pre-existing authority — not "zero content effect
   until a later gate," which the reviewer round correctly flagged as an overclaim in the first
   draft). New Invariant M-21. New Case 24: a `pattern`-type memory suggesting "3 retries, exponential
   backoff" for a genuinely R-19-eligible Unknown (within an already-settled "SHALL retry" Requirement)
   vs. an explicit contrast with an intent-level Unknown ("should retry happen at all") R-19
   categorically excludes regardless of memory.
3. **ADR-0004's Acceptance Gate decided explicitly** — new subsection naming four distinct amendment
   dependencies (A: core `M0_SCOPE.md` integration — `RunContext` + producer contract + at least one
   stage's declared input, required for any consumption at all; B: `INTENT_SPEC.md` Inference-premise,
   for citing memory as a Claim's premise; C: `REQUIREMENT_SPEC.md` Requirement-Level-Inference, for
   citing memory as such a premise; D: `REQUIREMENT_SPEC.md` R-19 provenance, for a memory-informed
   default's citation). Decided: this ADR becomes Accepted-eligible once dependency A alone is
   completed and adversarially reviewed — mirroring `ADR-0001`'s IR-per-stage pattern and avoiding
   coupling Acceptance to three separately-scoped, narrower semantic extensions layered on top of an
   already-sound core boundary. Dependencies B/C/D remain explicitly, structurally disabled — not
   merely deferred — until their own separate amendments land, each gating only the one path it names.

**Review round:** three independent read-only Codex reviewers, dispatched by interaction axis
(A: Brain Type × Historical Provenance; B: Influence Taxonomy × R-19; C: Amendment Sequencing ×
Cross-Document Consistency). All three found real, independently-verified defects — full per-reviewer
detail in `REVIEW_STATE.md`'s "Latest Review," not duplicated here. Highlights: the Semantic Authority
Classes table's individual rows (`lesson`, `playbook`, `reference`, `incident`, `pattern`, `project`)
still used absolute language ("always," "permanently," "only") that foreclosed the type-independence
fix for a misfiled record, in both `MEMORY_CONTEXT.md` and `ADR-0004`'s copy; the `DECISION_OPTION`
definition's "no further independent gate" framing overstated the distinction from
`DISCOVERY_ATTENTION` (which can and does directly affect intermediate artifact content); stale
three-tier inventories survived in `ADR-0004`'s Phase 4 axis 7 and Consequences section; the
Historical User Memory Rule's clarification-question path claimed "requires no amendment" when it
still requires dependency A; Cases 16/19/24 didn't name which specific dependency (B or D) gated the
capability they demonstrated, and Case 24 didn't mention dependency D at all; and the Acceptance
Gate's own precedent citation inaccurately implied `ADR-0003` had already been held to and satisfied
its acceptance condition, when `ADR-0003`'s Status is still Proposed — corrected to cite `ADR-0002`
(Accepted) as the actual precedent and `ADR-0003` as a parallel proposed criterion, not a completed
example. All fixed and independently re-verified against the actual current text (not accepted by
reviewer majority vote).

`npm test`: 32/32 throughout (unaffected — no contract/schema/runtime file touched). `git diff main
--stat`: the same three docs plus these two `.project` files; no frozen foundation document
modified. `git diff --check`: clean.

**Final recommendation: unchanged, `FOUNDATION_AMENDMENT_REQUIRED`** — every finding across all
rounds has been a scoping, internal-consistency, or terminology defect within the already-selected
Model C; none has ever shown Model C itself unsound (so not `REDESIGN_REQUIRED`). Not
`READY_FOR_HUMAN_REVIEW` (this ADR is not itself ready to be merged as final/Accepted — Model C's
SEMANTIC_PREMISE/DECISION_OPTION paths remain gated behind separate future amendments), but with no
new semantic blocker remaining in this round: **`READY_FOR_MERGE_AS_PROPOSED_ADR`** — the document
set is internally consistent, adversarially reviewed across four rounds, and ready for human review
and merge in its honest, Proposed state, with dependencies B/C/D correctly recorded as future,
separate, explicitly-gated work.

## Allowed Scope

Update (all pre-existing from the prior round, edited in place — no new files this round):
- `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`
- `docs/contracts/MEMORY_CONTEXT.md`
- `docs/examples/MEMORY_CONTEXT_CASES.md`
- `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`

Forbidden (frozen, none touched): `VISION.md`, `PRINCIPLES.md`, `M0_SCOPE.md`, `ADR-0001`,
`ADR-0002`, `ADR-0003`, `USER_IDEA.md`, `INTENT_SPEC.md`, `REQUIREMENT_SPEC.md`, `schemas/**`,
`tests/**`, `scripts/**`, `../mihver-brain/**`, `.project/PROJECT_STATE.md`,
`.project/DECISIONS_LOG.md`.

## Required Context

- `CLAUDE.md`, `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
- `docs/foundation/PRINCIPLES.md`, `docs/foundation/M0_SCOPE.md`,
  `docs/adr/ADR-0001-ARCHITECTURE-COMPILER-MODEL.md`, `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`,
  `docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`, `docs/contracts/USER_IDEA.md`,
  `docs/contracts/INTENT_SPEC.md`, `docs/contracts/REQUIREMENT_SPEC.md` (read-only grounding)
- `../mihver-brain/README.md`, `../mihver-brain/ARCHITECTURE.md`, `../mihver-brain/src/core/memorySchema.js`
  (read directly for Brain's actual schema, not assumed)

## Validation

- `npm test`: 32/32 (unaffected — no contract/schema/runtime file touched).
- `git diff main --stat`: the same three docs plus `.project/CURRENT_TASK.md`/
  `.project/REVIEW_STATE.md`; no frozen foundation document touched.
- `git diff --check`: clean.
- Three independent Codex reviewers by interaction axis this round (A: Brain Type × Historical
  Provenance; B: Influence Taxonomy × R-19; C: Amendment Sequencing × Cross-Document Consistency),
  all findings independently re-verified by Claude against the actual current text before being
  accepted or acted on — not accepted by majority vote.

## Next Gate

PR `mihvernetwork/mihver#15` (title `M0: define memory context authority boundary`, from the
`devSerdar` fork) already exists and was updated in place — not a new PR. Do not merge. `ADR-0004`
remains Proposed — required frozen-document amendments (`M0_SCOPE.md`, `INTENT_SPEC.md`,
`REQUIREMENT_SPEC.md`) are each their own separate, future, explicitly human-authorized task, not
performed or pre-authorized here. Human review of PR #15 is the next gate.
