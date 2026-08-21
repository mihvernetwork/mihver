# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-ADR-0004-CROSS-BOUNDARY-REMEDIATION

## Objective

Semantic/architectural remediation only — same constraints as the prior round: no runtime
integration, no schema, no MCP, `../mihver-brain` not modified, no frozen foundation document
touched. Continue PR #15 in place (no new PR). An external human review accepted Model C but found
six cross-boundary issues (circular scope anchor, undefined producer authority, admissibility-vs-
interpretation conflation, false procedural/semantic binary, undefined lifecycle/invalidation,
ambiguous cross-project corpus language) requiring resolution before foundation-amendment work
begins. Fixed all six by introducing `RunContext` (non-memory run-identity anchor), a full
`MemoryContext` Producer contract, an admissibility-vs-interpretation split, a three-tier Influence
Taxonomy (`PROCESS_ONLY`/`DISCOVERY_ATTENTION`/`SEMANTIC_PREMISE`), a full Lifecycle/Invalidation
model, and deterministic per-case scope statements — across `docs/adr/ADR-0004-MEMORY-CONTEXT-
AUTHORITY-BOUNDARY.md` (Status: Proposed), `docs/contracts/MEMORY_CONTEXT.md`, and
`docs/examples/MEMORY_CONTEXT_CASES.md` (now 21 cases, Case 21 added to cover `RunContext`'s
explicit absence). A second-pass four-reviewer round then found and this task fixed several
internal-consistency defects introduced or left over by that remediation itself (see Status below).
No frozen foundation document modified. `ADR-0004` remains Proposed.

## Branch / Base

Branch: `m0/adr-0004-memory-context-authority`
Base: `main` (`0ec25a0` — matches this task's stated base commit exactly, confirmed via `npm run
context` and `git rev-parse HEAD` before branching)

## Status

**Complete.** This is a continuation of the same branch/PR (#15) that produced the original
`ADR-0004`/`MEMORY_CONTEXT.md`/`MEMORY_CONTEXT_CASES.md` draft (see `REVIEW_STATE.md`'s History for
that round's full detail). Before any edit, Brain was re-queried for the same four lesson topics
(`4250a08b`, `96500b29`, `37a0ce2b`, `64d5e902`) — no new memories exist since the prior round;
`64d5e902` (CWD-is-not-a-filesystem-isolation-boundary) proved more precisely on-point this round,
directly framing the fix for the circular-scope-anchor issue below.

**Fixed all six issues an external human review found** in the prior draft:

1. **Circular scope anchor** — Case 14 used a Brain `project` record as its own identity-check
   anchor. Fixed by introducing `RunContext`: a non-memory, non-Brain identity anchor established by
   whatever invokes MIHVER, optional (projectless runs are allowed, then only `global`-scoped memory
   is eligible), which a `project` record may corroborate but never establish.
2. **Undefined `MemoryContext` producer authority** — added "MemoryContext Producer: Role and
   Authority" to `MEMORY_CONTEXT.md`: Inputs (`RunContext`-or-absence, retrieval purpose, consuming
   stage, upstream artifact version), Output (one immutable `MemoryContext` per invocation),
   Allowed-to-decide (mechanical scope/lifecycle/supersession, age-based freshness flagging, least-
   authority classification), Not-allowed-to-decide (current user meaning, semantic contradiction/
   applicability unless pre-settled, Requirements, tech eligibility, Evidence truth, architecture
   selection). Derived as a **cross-cutting boundary invoked repeatedly**, not a linear stage.
3. **Admissibility vs. intent interpretation** — added "Separating Admissibility from Interpretation":
   Category A (mechanical/lifecycle, production's authority) vs. Category B (semantic contradiction/
   applicability, exclusively the consuming stage's). Production never marks a memory
   "stale-for-this-run" from its own semantic judgment.
4. **False procedural/semantic binary** — replaced with a 3-way Influence Taxonomy: `PROCESS_ONLY`
   (zero content effect), `DISCOVERY_ATTENTION` (may alter search space/content, never establishes
   truth/eligibility/requirement/preference, must be additive and provenance-visible),
   `SEMANTIC_PREMISE` (Claim/Requirement support only via the full epistemic/evidence gate).
   Reclassified throughout `ADR-0004`, `MEMORY_CONTEXT.md`, and all cases.
5. **Undefined lifecycle/invalidation** — added "MemoryContext Lifecycle and Invalidation": bound to
   (`RunContext`-or-absence, consuming stage, retrieval purpose, upstream artifact version);
   invalidated (never mutated) on bound-upstream-artifact supersession; superseded snapshots remain
   historical and immutable.
6. **Cross-project corpus contradictions** — every one of the (now 21) cases states its memory's
   scope explicitly (current-project, `global`, or excluded-other-project); Case 21 added for
   `RunContext`'s explicit absence.

**Second-pass review:** four independent read-only Codex reviewers, dispatched by interaction axis
(A: Scope Anchor × Producer Authority; B: Lifecycle × Reproducibility; C: Process × Discovery ×
Semantic Authority; D: cross-document/corpus contradiction sweep), checked those six fixes. All four
found real, independently-verified defects — mostly the remediation's own fixes not propagated to
every duplicate location, and one genuine self-contradiction the remediation introduced — all fixed
after Claude independently re-verified each against the actual current text (not accepted by
reviewer majority vote); full per-reviewer detail is in `REVIEW_STATE.md`'s "Latest Review," not
duplicated here. Highlights: a stale `project`-anchor table row surviving in `ADR-0004`'s own copy;
a genuine contradiction between the Producer's "mechanical scope admissibility only" limit and
pre-existing text requiring it to judge `global`-scoped content "genuinely project-agnostic"
(resolved by deferring that judgment to the consuming stage); an incomplete migration of the old
procedural/semantic terminology to the 3-way taxonomy in several cases and `ADR-0004`'s own
duplicated Phase 6/7/8/9 sections; a functional-exclusion loophole in Case 8; a cross-run reuse gap
in the Lifecycle model; and a cardinality contradiction in Case 18 about whether the Producer emits
an artifact on Brain-unavailability.

`npm test`: 32/32 throughout (unaffected — no contract/schema/runtime file touched). `git diff main
--stat`: the same three docs plus these two `.project` files; no frozen foundation document
modified. `git diff --check`: clean.

**Final recommendation: unchanged, `FOUNDATION_AMENDMENT_REQUIRED`** — this round's findings were all
internal-consistency/scoping/terminology defects within the already-selected Model C; none changed
the verdict. Not `REDESIGN_REQUIRED` (no reviewer, across either round or any axis, found Model C's
fundamental approach unsound). Not `READY_FOR_HUMAN_REVIEW` either: the prior round's finding that
citing a `MemoryContext` entry as an Inference's premise requires `SEMANTIC_AMENDMENT_REQUIRED`
changes to **both** `INTENT_SPEC.md` and `REQUIREMENT_SPEC.md` — not just the already-expected
`M0_SCOPE.md` stage-input amendment — still holds and remains unmet.

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
- Four independent Codex reviewers by interaction axis this round (A: Scope Anchor × Producer
  Authority; B: Lifecycle × Reproducibility; C: Process × Discovery × Semantic Authority; D:
  cross-document/corpus contradiction), all findings independently re-verified by Claude against the
  actual current text before being accepted or acted on — not accepted by majority vote.

## Next Gate

PR `mihvernetwork/mihver#15` (title `M0: define memory context authority boundary`, from the
`devSerdar` fork) already exists and was updated in place — not a new PR. Do not merge. `ADR-0004`
remains Proposed — required frozen-document amendments (`M0_SCOPE.md`, `INTENT_SPEC.md`,
`REQUIREMENT_SPEC.md`) are each their own separate, future, explicitly human-authorized task, not
performed or pre-authorized here. Human review of PR #15 is the next gate.
