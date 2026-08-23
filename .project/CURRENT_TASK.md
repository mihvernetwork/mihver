# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-DEPENDENCY-C-DISPOSITION

## Objective

Formally resolve `ADR-0004` Dependency C after a prior task's mandatory pre-implementation
re-derivation concluded `DEPENDENCY_C_REDUNDANT_AFTER_B` and stopped without implementing anything.
This task does not implement Dependency C — it reconciles the Accepted memory architecture with that
finding: the direct path `MemoryContext → Requirement-Level Inference premise` is retired, not
implemented; the canonical path for historical-user memory to affect a Requirement is
`MemoryContext → Intent Parsing (Dependency B) → current-run Inferred Claim → Requirement Derivation
(existing R-03/R-10/R-22)`. Dependency D is unaffected and not implemented here.

## Branch / Base

Branch: `m0/dependency-c-disposition`
Base: `main` at `e0a040928112bf87a9353450c6f5116320f4078a` (verified via `git status`/`git log`/
`npm run context`/`gh pr view 23` before branching — matches PR #23's merge commit exactly; verified
no remote branch or PR exists for the abandoned `m0/dependency-c-requirement-memory-premise`
implementation attempt, which was never pushed).

## Status

**Complete, pending human review.**

Re-verified the prior STOP verdict before any edit, per this task's own instruction (Section 1):
independently re-confirmed all nine propositions (A–I) against the owning contracts — R-22's sole
strength source is an accepted Claim/Requirement; `MemoryContext` supplies no normative strength of
its own; historical force is not current force (M-20); non-historical `pattern`/`incident`/
`reference` memory never reaches `SEMANTIC_PREMISE`; Category A historical-user memory is
inherently intent-shaped content; Requirement-Level Inference may only draw technical/operational
implications from already-accepted current-run semantics, never intent; Dependency B already
provides the legitimate current-run-Inferred-Claim path; Requirement Derivation already consumes
that Claim under its own existing authority; a second, direct citation of the same memory would be
either redundant or an unauthorized interpretive resolution — all confirmed true. Verdict:
`DEPENDENCY_C_RETIRED_AS_REDUNDANT`. Proceeded with the disposition recording below.

- **`docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`**: added a new, clearly-labeled
  "Post-Acceptance Dependency B/C Disposition" section recording B as implemented and C as retired
  (with the two independent reasons: no strength source; Requirement-Level Inference categorically
  excludes intent-shaped content); added a forward-pointer to the original Acceptance note; updated
  "Acceptance Gate," "Decision," Phase 11's `REQUIREMENT_SPEC.md` item, and "Future Work" to qualify
  — not delete — their original B/C framing as historical-at-the-time reasoning, each now pointing to
  the new disposition section; ADR's own Status remains **Accepted**, unchanged, per this task's
  explicit instruction not to reopen Acceptance.
- **`docs/contracts/REQUIREMENT_SPEC.md`**: added a new "`MemoryContext` Is Not a Requirement-Level
  Inference Premise" subsection immediately after the existing "Requirement-Level Inference"
  content, making the pre-existing boundary explicit without altering it; added invariant **R-23**
  (a Requirement-Level Inference's premise is only an accepted `IntentSpec` Claim or already-derived
  Requirement, never a `MemoryContext` entry; historical-user content must first pass through
  Dependency B; technical memory remains excluded because memory is never Evidence); added two
  Anti-Examples. R-10 and R-22 themselves are byte-unchanged. No `derivation_confidence` added, no
  force→strength behavior altered, no schema fields designed.
- **`docs/foundation/M0_SCOPE.md`**: fixed the stale Principle 3 Compliance sentence (previously
  present-tense "currently, only Research Planning declares one," now naming both current consumers
  and Requirement Derivation's continued non-authorization); updated "Cross-Cutting: MemoryContext
  Consumption Remains Otherwise Disabled" to state Dependency C was retired (not "gated behind a
  pending amendment"), while Dependency D remains genuinely pending. Requirement Derivation's own
  `Input:` list is untouched — still `IntentSpec` only; Intent Parsing's and Research Planning's own
  stage-specific authority (`Input:`/`Allowed to decide`/`Not allowed to decide`) is untouched.
- **`docs/contracts/MEMORY_CONTEXT.md`**: updated the top-of-file status line and "Stage Consumption
  Authorization" section's Dependency-C phrasing from "unavailable" (implying pending) to
  "retired"; added a "There is no third way, and none is coming" paragraph to the "Historical User
  Memory Rule" section stating the retirement explicitly and permanently. Dependency D's own
  material ("No Assumed-Origin Path for Memory" section) is untouched.
- **`docs/examples/MEMORY_CONTEXT_CASES.md`**: swept the intro (previously "no stage is currently
  authorized... see 'Stage Consumption Is Not Yet Authorized'" — both stale) to state current
  reality (Intent Parsing and Research Planning authorized; every other stage not); corrected the
  "dependency C" framing in the same intro paragraph from a pending future path to retired; fixed
  three residual "(once authorized)" phrases on Intent Parsing (Cases 1, 4, 22) and two "pending
  dependency B" phrases (Cases 16, 19) now that Dependency B is implemented. Case 24 (the Dependency
  D worked example) is untouched, confirmed byte-identical.
- **`docs/examples/REQUIREMENT_CASES.md`**: added a "Dependency C Disposition" case family, Cases
  18–22, exactly as specified — (18) a Category A memory already producing a Dependency-B Inferred
  Claim, consumed normally; (19) an attempted direct `MemoryContext` premise, forbidden; (20) the
  same memory cited both via the accepted Claim and as a proposed second direct citation, testing
  double-counting discipline; (21) `pattern` technical memory forbidden from direct use, memory is
  not Evidence; (22) a historical obligation existing only in memory, no direct MUST manufacture.

**Reviewer-driven fixes applied** (all independently re-verified before acceptance, per this task's
own instruction):

- Case 20's illustrative Requirement-Level Inference ("prefer synchronous over asynchronous
  dispatch") did not actually hold under every materially plausible reading of "avoid a message
  queue" (asynchronous dispatch is possible without a queue) — independently re-verified against
  the operational test in `REQUIREMENT_SPEC.md`'s "Requirement-Level Inference" section, confirmed
  real, fixed by replacing it with a tightly-entailed specialization (no dedicated message-broker
  service).
- Case 21's Eligibility claimed the overall area was "Partial per R-21" without justifying why the
  already-derived retry-obligation Requirement's own satisfaction procedure was blocked by the
  unfilled retry-count detail — independently re-verified against R-21's own text (an obligation to
  "retry automatically" is testable independent of count), confirmed the claim was unjustified as
  written, fixed to state the retry-obligation Requirement remains Complete while the retry-count
  detail is a separate, legitimately-unfilled, carried-forward Unknown.
- Case 21 also referenced Dependency D's R-19/R-09 mechanism as an alternative path, violating this
  task's explicit C/D separation requirement (Section 9) — independently re-verified against that
  requirement, confirmed real, removed; Case 21 now ends solely on the R-23/memory-is-not-Evidence
  result.
- Two stale present-tense claims in `ADR-0004` ("no stage in `M0_SCOPE.md`'s current table declares
  any memory... input," and "this ADR's Status stays Proposed until dependency A...") were left over
  from the document's own original, pre-Acceptance Phase 1/Consequences text with no historical
  qualifier — independently re-verified against current `main` (both false as literal present-tense
  claims: two stages now declare `MemoryContext` inputs; Status is Accepted), confirmed real, fixed
  with "at the time of..." qualifiers and forward pointers, consistent with this document's own
  established revision-note convention.
- Three residual "(once authorized)" phrases on Intent Parsing in `MEMORY_CONTEXT_CASES.md` (Cases
  1, 4, 22) were missed by the initial intro-paragraph sweep — independently re-verified via a
  corpus-wide grep, confirmed real (Intent Parsing is now authorized), fixed.

## Allowed Scope

`docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, `docs/foundation/M0_SCOPE.md`,
`docs/contracts/REQUIREMENT_SPEC.md`, `docs/contracts/MEMORY_CONTEXT.md`,
`docs/examples/REQUIREMENT_CASES.md`, `docs/examples/MEMORY_CONTEXT_CASES.md`,
`.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`.

Forbidden and confirmed untouched: `docs/contracts/INTENT_SPEC.md`, `docs/examples/INTENT_CASES.md`,
`docs/contracts/USER_IDEA.md`, `schemas/**`, `tests/**`, `scripts/**`,
`docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`, `.project/PROJECT_STATE.md`,
`.project/DECISIONS_LOG.md`, `.project/CONTEXT_INDEX.md`, `ROADMAP.md`, `../mihver-brain/**`. No
machine schema. No runtime.

## Required Context

`docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`, `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-
BOUNDARY.md`, `docs/foundation/M0_SCOPE.md`, `docs/contracts/INTENT_SPEC.md`,
`docs/contracts/REQUIREMENT_SPEC.md`, `docs/contracts/MEMORY_CONTEXT.md`,
`docs/examples/INTENT_CASES.md`, `docs/examples/REQUIREMENT_CASES.md`,
`docs/examples/MEMORY_CONTEXT_CASES.md`, `ROADMAP.md`, `.project/PROJECT_STATE.md` — all re-read
fresh in full (or via targeted grep confirmed against fresh line-range reads) before any edit.

## Validation

- `npm test`: 83/83 (unaffected — no schema/test file touched).
- `git diff --check`: clean.
- `git diff main --stat`: exactly the allowed files.
- Three fresh independent read-only Codex reviewers (R-10/R-22/Redundancy Proof; Memory Authority/
  Stage Boundary; C/D Separation/Cross-Document Consistency) — see `REVIEW_STATE.md`'s "Latest
  Review" for findings and disposition.
- Confirmed: Requirement Derivation's `Input:` remains `IntentSpec` only; current `MemoryContext`
  consumers remain exactly Intent Parsing and Research Planning; Dependency D remains unimplemented
  and its own material byte-unchanged; no Brain/runtime work.

## Next Gate

Commit, push, and open one PR against `mihvernetwork/mihver:main`, title "docs: retire redundant
Dependency C after Dependency B". Do not merge. Human review of that PR is the next gate; it
authorizes only this disposition-recording documentation change — no new capability, no Dependency D
work, no schema/runtime work.
