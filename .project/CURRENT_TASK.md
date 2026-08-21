# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-ADR-0004-MEMORY-CONTEXT-AUTHORITY

## Objective

Semantic/architectural design only — no runtime integration, no schema, no MCP, `../mihver-brain`
not modified, `feat/sb-02-hybrid-retrieval` untouched. Begin architectural design for integrating
MIHVER Brain / durable memory into Mihver Architect without violating the compiler-stage model
(`ADR-0001`), the epistemic-provenance model (`ADR-0002`), or the Requirement-Derivation model
(`ADR-0003`). Produced `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md` (Status: Proposed),
`docs/contracts/MEMORY_CONTEXT.md`, and `docs/examples/MEMORY_CONTEXT_CASES.md` (20 cases). No
frozen foundation document modified. `ADR-0004` remains Proposed.

## Branch / Base

Branch: `m0/adr-0004-memory-context-authority`
Base: `main` (`0ec25a0` — matches this task's stated base commit exactly, confirmed via `npm run
context` and `git rev-parse HEAD` before branching)

## Status

**Complete.** Phase 0 read `../mihver-brain`'s actual `README.md`/`ARCHITECTURE.md`/
`src/core/memorySchema.js` directly rather than assuming its taxonomy from prior-session summaries —
found the real taxonomy is **eight** memory types (`project`, `decision`, `lesson`, `incident`,
`pattern`, `playbook`, `reference`, `inbox`), broader than what earlier sessions had seen. Queried
Brain's CLI for the required lesson topics; all three named memories (`4250a08b`, `96500b29`,
`37a0ce2b`) plus one `global`-scope lesson (`64d5e902`) were retrieved and their concrete influence
on this design recorded in `ADR-0004`'s own Phase 0 section — none treated as authoritative.

Phase 1 built an authority map from direct reads of `PRINCIPLES.md`, `M0_SCOPE.md`, `ADR-0001`,
`ADR-0002`, `ADR-0003`, `USER_IDEA.md`, `INTENT_SPEC.md`, confirming the hard constraint Principle 3
already implies: no stage currently declares any memory artifact as an input, so no stage may query
Brain directly without a separate `M0_SCOPE.md` amendment. Phases 2–10 built the threat model, model
comparison (Model C selected, with real derivation against Models A/B/D — not selected merely
because the task named it), the seven-axis authority model, the historical-user-memory rule, the
current-input-wins precedence table, the procedural/semantic split, the memory/Evidence boundary,
the reproducibility model, and the 20-case adversarial corpus. Phase 11 classified required future
changes to frozen documents.

Phase 12 dispatched four independent read-only Codex reviewers by interaction axis (A: memory ×
epistemic provenance; B: memory × stage isolation; C: memory × evidence/architecture; D: cross-axis
adversarial). All four found real, independently-verified defects, all fixed after Claude
independently re-verified each against the actual frozen text (not accepted by reviewer majority
vote):

- **Reviewer A** found the ADR had mis-cited `INTENT_SPEC.md`'s Inference Policy and, more
  seriously, had under-classified a real dependency as `CLARIFICATION_ONLY` when it required
  `SEMANTIC_AMENDMENT_REQUIRED` — citing a `MemoryContext` entry as an Inference's premise genuinely
  broadens `INTENT_SPEC.md`'s frozen premise/provenance model, it does not merely apply an existing
  test to a new input. The identical problem was found, on independent re-check, to apply to
  `REQUIREMENT_SPEC.md`'s Requirement-Level Inference mechanism (R-10/R-22) too — both reclassified.
  Also found: a real Inferred/Assumed blurring risk (a memory-derived LOW/MEDIUM default could be
  misread as eligible for Assumed origin, which Assumption Policy categorically forbids for
  operational defaults) — closed with an explicit "No Assumed-Origin Path for Memory" section and a
  stage-specific (Intent Parsing vs. Requirement Derivation) rewrite; a cross-project loophole in
  Case 3 that let content-inspection override a recorded Project-A scope; and M-07's invariant text
  omitting "confidence" specifically, even though the design's own axis-independence principle
  required it to be named explicitly.
- **Reviewer B** found several "Always allowed"/"freely" phrases that, read literally, contradicted
  the hard "no stage may consume `MemoryContext` at all" rule — fixed throughout, plus a
  strengthened corpus-wide preamble closing the gap across all 20 cases at once; an under-scoped
  Phase 11 stage list (only two stages named as plausible, when the cases themselves describe a
  third, Architecture Synthesis); and a reproducibility gap (a bare hash/pointer into Brain's mutable
  vault is insufficient — an actual content copy must be retained at production time).
- **Reviewer C** found Principle 5's five required properties (source, **version**, date,
  confidence, freshness) had been under-stated as four (version omitted) in M-12 and the
  Evidence-boundary table and cases — fixed; and a subtle "procedural search influence can
  functionally exclude candidates without ever formally excluding any" risk — closed with an explicit
  additive-never-substitutive constraint on all procedural search-strategy influence.
- **Reviewer D** built a cross-axis contradiction matrix and found: the frozen-`MemoryContext`-
  snapshot model directly conflicted with also requiring a "did this actually influence output"
  post-hoc fact and a "mark stale on later-discovered contradiction" fact — both knowable only after
  production, incompatible with true immutability — resolved by splitting these into the *consuming
  artifact's own* provenance rather than mutating the frozen snapshot; a genuine cross-document
  authority conflict where Case 16 offered a Requirement-Derivation R-19 "default" path for a
  historical cadence *preference*, when deciding a cadence preference is a want-level question R-19
  itself excludes (`ADR-0003`) — the R-19 alternative was removed from Case 16 entirely; a
  terminology slip conflating "authority" (the technical axis) with a `project` record's ordinary
  identity-anchor role in Case 14 — reworded; and an incorrect factual claim that Architecture
  Synthesis could reason from `EvidenceBundle` directly (it cannot — that is Technology Candidate
  Identification's and Evaluation's declared input, not Synthesis's) in Case 20 — corrected to
  attribute the Evidence-grounded conclusion to the stages that actually own it.

`npm test`: 32/32 throughout (unaffected — no contract/schema/runtime file touched). `git diff main
--stat`: exactly the three new allowed files. No frozen foundation document modified.

**Final recommendation: `FOUNDATION_AMENDMENT_REQUIRED`** — not `REDESIGN_REQUIRED` (no reviewer,
across any axis, found Model C's fundamental approach unsound; every confirmed defect was a scoping,
wording, or cross-reference error, not a structural flaw in the chosen model); not
`READY_FOR_HUMAN_REVIEW` either, honestly: this design's own corrected analysis (Reviewer A's
findings) established that citing a `MemoryContext` entry as an Inference's premise genuinely
requires `SEMANTIC_AMENDMENT_REQUIRED` changes to **both** `INTENT_SPEC.md` and
`REQUIREMENT_SPEC.md` — not just the already-expected `M0_SCOPE.md` stage-input amendment — before
any part of this design's Inferred-Claim path can be exercised at all. Recording this honestly as
the verdict, rather than softening it to `READY_FOR_HUMAN_REVIEW`, is itself the correct application
of this task's own Phase 11 instruction.

## Allowed Scope

Add (new files, all present):
- `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`
- `docs/contracts/MEMORY_CONTEXT.md`
- `docs/examples/MEMORY_CONTEXT_CASES.md`

Update: `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`

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

- `npm test`: 32/32 (unaffected by this task's new-file-only changes).
- `git diff main --stat`: exactly the three new allowed files.
- `git diff --check`: clean.
- Four independent Codex reviewers by interaction axis (A/B/C/D), all findings independently
  re-verified by Claude against the actual frozen text before being accepted or acted on — not
  accepted by majority vote.

## Next Gate

PR to be opened from the `devSerdar` fork to `mihvernetwork/mihver:main`, title `M0: define memory
context authority boundary`. Do not merge. `ADR-0004` remains Proposed — required frozen-document
amendments (`M0_SCOPE.md`, `INTENT_SPEC.md`, `REQUIREMENT_SPEC.md`) are each their own separate,
future, explicitly human-authorized task, not performed or pre-authorized here. Human review of the
PR is the next gate.
