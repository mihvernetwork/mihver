# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-ADR-0004-AUTHORITY-PROVENANCE-CLOSURE

## Objective

A narrow semantic-closure pass, before any foundation-amendment work begins — same constraints as
prior rounds: no runtime integration, no schema, no MCP, `../mihver-brain` not modified, no frozen
foundation document touched, no broadening of the architecture beyond what's specified. Continue
PR #15 in place (no new PR). Closed six further gaps: (1) a **Historical User Provenance Gate**
distinguishing direct historical user statements (inspectably traceable to an original user-authored
source) from derived/unverified memory (reads like a user statement but lacks that traceable
linkage, the honest default given Brain's actual schema has no field guaranteeing it) — only the
former may ever be cited as an Inference premise; (2) a **Classification Fail-Closed Rule** requiring
production to record classification basis/method/ambiguity and resolve ambiguity toward less
authority, never more; (3) removed residual wording that let production treat "an artifact was
supplied" as equivalent to "a contradiction judgment was supplied"; (4) an explicit **identity
boundary** — a `pattern`/`incident`/`reference` entry never itself reaches `SEMANTIC_PREMISE`,
regardless of re-verification; only a wholly new, independently-produced Evidence artifact does;
(5) a Foundation Impact item for memory-informed R-19 default provenance, closing a gap where this
capability's provenance discipline was specified without naming its `REQUIREMENT_SPEC.md`
amendment; (6) a **Historical Force Is Not Current Force** rule plus new Case 22, and an M-07
correction restoring I-16's "not by itself" qualifier an earlier round had silently over-strengthened.
Across `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md` (Status: Proposed),
`docs/contracts/MEMORY_CONTEXT.md`, and `docs/examples/MEMORY_CONTEXT_CASES.md` (now 22 cases). A
four-reviewer round then found and this task fixed several further internal-consistency defects the
remediation itself introduced or left over (see Status below). No frozen foundation document
modified. `ADR-0004` remains Proposed.

## Branch / Base

Branch: `m0/adr-0004-memory-context-authority`
Base: `main` (`0ec25a0` — matches this task's stated base commit exactly, confirmed via `npm run
context` and `git rev-parse HEAD` before branching)

## Status

**Complete.** Continuation of the same branch/PR (#15) — see `REVIEW_STATE.md`'s History for prior
rounds' full detail. Before any edit, Brain was re-queried for the same four lesson topics
(`4250a08b`, `96500b29`, `37a0ce2b`, `64d5e902`) — no new memories exist since the prior round; all
four remain advisory only, per every prior round's own discipline.

**Closed all six gaps this task specified:**

1. **Historical User Provenance Gate** — new section in `MEMORY_CONTEXT.md` plus Invariant M-18:
   Category A (direct — inspectably traceable to an original historical user-authored source) vs.
   Category B (derived/unverified — the honest default, since Brain's actual schema has no field
   linking a `decision` record's body to a specific historical `UserIdea` turn; named as a future
   Brain/integration dependency, not a gap closed by relaxing the gate). Only Category A may be cited
   as an Inference premise; Category B is capped at `DISCOVERY_ATTENTION` forever. Gated into
   "Historical User Memory Rule," M-03, and every relevant case (1, 4, 11, 16, 19, 22 — plus
   explicit immateriality notes in 2, 3, 12, 15 where the distinction doesn't change the outcome).
2. **Classification Fail-Closed Rule** — new section plus Invariant M-19: production records
   classification basis/method (deterministic vs. heuristic, per Principle 6)/ambiguity; ambiguity
   never promotes to `SEMANTIC_PREMISE`; retrieval relevance and Brain confidence never resolve
   ambiguity; lowest defensible tier or exclusion when no safe classification exists (Principle 7).
3. **Residual producer semantic judgment removed** — the Producer's Inputs list, its "Not allowed to
   decide" bullet, "Separating Admissibility from Interpretation," and M-09 were all tightened:
   production may only mechanically apply an explicit, already-computed verdict about a *specific*
   entry — never merely because an upstream artifact/version was supplied, which is not itself a
   judgment. The Purpose section's residual claim that `MemoryContext` stores "whether it actually
   mattered" was removed (that fact lives only in consuming-artifact provenance).
4. **Identity boundary, not merely a freshness gate** — new subsection under "Memory and Evidence
   Boundary": a `pattern`/`incident`/`reference` entry never itself reaches `SEMANTIC_PREMISE`,
   regardless of re-verification; only a wholly new, independently-produced Evidence/
   TechnologyCandidateSet artifact does. Reworded the Influence Taxonomy, reclassification table,
   M-11, M-12, and Case 7 to remove "the memory reaches/becomes Evidence" phrasing.
5. **R-19 default provenance** — new Foundation Impact item (narrower than, and distinct from, the
   existing R-10/R-22 amendment): a memory-informed R-19 default's R-09 "Requirement-Derivation-
   introduced" provenance must additionally cite the `MemoryContext` entry as a "memory-informed
   rationale." Requirement Derivation added to Phase 11's consuming-stage list (an omission the
   reviewer round caught — the capability existed without its consuming stage being named).
6. **Historical Force Is Not Current Force** — new section plus Invariant M-20: a historical
   statement's own force is never mechanically copied into a current Inferred Claim's force, because
   `REQUIREMENT_SPEC.md`'s Force → Strength Mapping compiles force to hard MUST/MUST NOT regardless
   of confidence. New Case 22 (same-project Category A historical prohibition, no current mention,
   LOW/MEDIUM impact) works this through concretely. M-07 corrected to restore I-16's "not by itself"
   qualifier, which an earlier round's wording had silently over-strengthened into a broader claim
   I-16 does not make.

**Review round:** four independent read-only Codex reviewers, dispatched by interaction axis
(A: Historical Provenance × Normative Force; B: Producer Classification × Least Authority; C: Memory
× Evidence × Requirement Defaults; D: cross-document/corpus contradiction sweep). All four found
real, independently-verified defects — full per-reviewer detail in `REVIEW_STATE.md`'s "Latest
Review," not duplicated here. Highlights: Case 19 cited two records as Inference premises without any
Category A/B designation, bypassing M-18 entirely; Case 22's worked force example was internally
self-contradictory (labeled a preference-strength conclusion "the same prohibition-shaped force" as
history); ADR-0004's own Phase 4 still granted production a semantic freshness judgment M-05
forbids, and its Phase 7/8 tables still described the memory itself "reaching" `SEMANTIC_PREMISE`
after Evidence-gate clearance rather than a new artifact; a second, un-fixed instance of the
artifact-vs-verdict conflation survived in the Producer's "Not allowed to decide" bullet and ADR
Phase 6; the Reproducibility/M-14 snapshot inventories weren't updated to include the new
classification-basis/method/ambiguity facts; Case 8 still claimed Architecture Synthesis was "not
named" in Phase 11 after a prior round had already added it; M-03 didn't carry the new Category A
gate; and Cases 3/12 didn't state the immateriality the corpus preamble promised. All fixed and
independently re-verified against the actual current text (not accepted by reviewer majority vote).

`npm test`: 32/32 throughout (unaffected — no contract/schema/runtime file touched). `git diff main
--stat`: the same three docs plus these two `.project` files; no frozen foundation document
modified. `git diff --check`: clean.

**Final recommendation: unchanged, `FOUNDATION_AMENDMENT_REQUIRED`** — every finding across all
rounds has been a scoping, internal-consistency, or terminology defect within the already-selected
Model C; none has ever shown Model C itself unsound (so not `REDESIGN_REQUIRED`). Not
`READY_FOR_HUMAN_REVIEW` either: the standing finding that citing a `MemoryContext` entry as an
Inference's premise requires `SEMANTIC_AMENDMENT_REQUIRED` changes to `INTENT_SPEC.md` and
`REQUIREMENT_SPEC.md` (now including the R-19 default provenance item), not just the already-expected
`M0_SCOPE.md` stage-input amendment, still holds and remains unmet.

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
- Four independent Codex reviewers by interaction axis this round (A: Historical Provenance ×
  Normative Force; B: Producer Classification × Least Authority; C: Memory × Evidence × Requirement
  Defaults; D: cross-document/corpus contradiction sweep), all findings independently re-verified by
  Claude against the actual current text before being accepted or acted on — not accepted by
  majority vote.

## Next Gate

PR `mihvernetwork/mihver#15` (title `M0: define memory context authority boundary`, from the
`devSerdar` fork) already exists and was updated in place — not a new PR. Do not merge. `ADR-0004`
remains Proposed — required frozen-document amendments (`M0_SCOPE.md`, `INTENT_SPEC.md`,
`REQUIREMENT_SPEC.md`) are each their own separate, future, explicitly human-authorized task, not
performed or pre-authorized here. Human review of PR #15 is the next gate.
