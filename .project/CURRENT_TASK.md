# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-DEPENDENCY-D-R19-MEMORY-DECISION-OPTION

## Objective

Implement `ADR-0004` Dependency D as one bounded Requirement Derivation semantic/foundation slice:
Requirement Derivation becomes the third authorized `MemoryContext` consumer, restricted to exactly
the `DECISION_OPTION` influence tier, to optionally inform a working-default value for a surviving
`IntentSpec` Unknown it has already, independently established as R-19-eligible. Memory supplies
zero independent authority — the final value remains Requirement-Derivation-introduced (R-09), with
its own independent rationale, plus an additional, distinctly-labeled memory-informed-rationale
citation (new invariant R-24) via the stable `(memory_context_id, entry_id)` identity. This is not
`SEMANTIC_PREMISE`, not a Requirement-Level Inference premise (R-23 unaffected, C remains retired),
not Evidence, not User-Provided provenance, and not an automatic default. Does not implement a
`RequirementSpec` machine schema (Step 03B remains deferred).

## Branch / Base

Branch: `m0/dependency-d-r19-memory-decision-option` (new branch, created from `main`).
Base: `main` at `a16491d41d93f4edac9378b6184de071aa681f32` — verified via `git status`/`git log`
(HEAD matched exactly before branching), `npm run context`, `npm test` (85/85), and `gh pr view 26`
(`state: MERGED`, `mergeCommit.oid` matching exactly) before any edit.

## Status

**Complete, pending human review.**

**Prerequisite verified before any edit (Section 1).** The PR #26 historical-source-gate policy is
confirmed intact and internally consistent on current `main`: `tests/contracts/validate-contracts.mjs`
line 337's `isReclassifiedHistorical && tier === "DECISION_OPTION"` check exists; both the Category A
and Category B invalid fixtures exist
(`memory-context-decision-option-on-historical-statement-category-a.json`/`-category-b.json`); the
valid non-historical `DECISION_OPTION` fixture exists (`memory-context-decision-option-non-
historical.json`). Verdict: prerequisite satisfied, not `PR26_PREREQUISITE_NOT_SATISFIED`.

**Pre-implementation D coherence re-confirmed (Section 2).** All eight propositions (A–H) independently
re-verified true against current `REQUIREMENT_SPEC.md`/`MEMORY_CONTEXT.md` text: R-19 already gives
Requirement Derivation content-only fill authority, independent of memory; R-09 already requires
Requirement-Derivation-introduced marking with rationale; memory neither creates nor removes R-19
eligibility; `DECISION_OPTION` proposes a value only within an already-owned decision, remains
optional, and Requirement Derivation retains full adopt/modify/reject/ignore/leave-unresolved
authority; memory never becomes Requirement authority, `SEMANTIC_PREMISE`, a Requirement-Level
Inference premise, Evidence, or current user intent. Verdict: `DEPENDENCY_D_COHERENT`. Proceeded.

**Implementation (Sections 4–22):**

- **`M0_SCOPE.md`**: amended "Stage: Requirement Derivation"'s `Input:` to add optional
  `MemoryContext`, restricted to `DECISION_OPTION` for an already-R-19-established decision, bound to
  the consumed `IntentSpec` version (never `RequirementSpec`, which is this stage's own output).
  Rewrote "Cross-Cutting: MemoryContext Consumption Remains Otherwise Disabled" to record Dependency D
  implemented and the resulting three-consumer map (Intent Parsing, Research Planning, Requirement
  Derivation). Fixed one directly-encountered stale "Requirement Derivation does not [declare a
  MemoryContext input]" sentence in "Principle 3 Compliance." The MemoryContext Producer Boundary
  section itself is unchanged — its existing generic "an explicit, already-computed verdict may be
  mechanically applied; a bare artifact reference is not one" language already covers this use without
  needing stage-specific edits.
- **`REQUIREMENT_SPEC.md`**: added "Memory-Informed R-19 Working Defaults" subsection (the Gate 1/Gate
  2 model, the hard ordering invariant, the frozen historical-source-gate cross-reference, the
  no-provenance-laundering rule, "adoption is never automatic," independent-rationale requirement, the
  Evidence boundary); extended R-09's provenance requirement with the memory-informed-rationale
  citation (content unchanged otherwise); added new invariant **R-24**; added one Example and one
  Anti-Example entry; added a short cross-reference in "Provenance: Requirement → IntentSpec →
  UserIdea" and in "LOW/MEDIUM Open Items..." R-19-fillable paragraph. R-10, R-19, R-22, R-23 confirmed
  byte-unchanged (independently re-verified via `git diff`, not merely asserted).
- **`REQUIREMENT_CASES.md`**: added a "Dependency D: Memory-Informed R-19 Working Defaults" case
  family, Cases 23–35 (13 cases, matching this task's required A–M coverage exactly: valid adoption;
  rejection with a different value chosen; memory unavailable/empty; R-19-forbidden Unknown rejected;
  intent-level/scope-changing value rejected; memory-as-Evidence rejected; multiple disagreeing
  memories with no vote/repetition/confidence authority; conflicting-constraint rejection; R-23
  premise-attempt rejection; invented-Unknown rejection; historical Category A/B rejected at Gate 2; a
  separately-provenanced technical outcome potentially Gate-2-eligible; Complete/Partial driven only by
  R-21). Also fixed two directly-encountered stale claims in Cases 19 and 22 ("Requirement Derivation
  has no declared `MemoryContext` input at all" / "it has none") — both now false given this task's own
  M0_SCOPE.md amendment; corrected to describe the narrow `DECISION_OPTION`-only scope instead.
- **`MEMORY_CONTEXT.md`**: updated the top-of-file status block and "Stage Consumption Authorization"
  to record Dependency D implemented and three current consumers; resolved the "if Requirement
  Derivation is *separately* authorized" conditional (now factual); fixed the "not decided in the
  abstract here" Foundation-Impact-Analysis sentence and two residual "once separately authorized"/
  "once authorized" phrases (LOW/MEDIUM Decision Impact section, Influence Taxonomy reclassification
  table) directly encountered while reading this file for the task. The historical A/B categorical
  `DECISION_OPTION` prohibition, Gate 1/Gate 2 model, and no-laundering distinction (Cases 25/26,
  unchanged) are confirmed intact and unweakened.
- **`MEMORY_CONTEXT_SCHEMA_MAPPING.md`**: updated the opening status paragraph, "Schema
  Representability vs. Pipeline Authorization," and "Stable identity for cross-artifact reference" to
  record Dependency D implemented and its citation of the existing `(memory_context_id, entry_id)`
  pair; added a short "No RequirementSpec Machine Schema Yet" section making explicit that Step 03B
  remains deferred and this task required no `schemas/m0/memory-context.schema.json` change (confirmed
  — none was made). M-01–M-21 semantics unchanged beyond the prior, already-approved source-gate
  clarification.
- **`MEMORY_CONTEXT_CASES.md`**: synchronized Case 24's authorization/status language now that D is
  implemented (removed "hypothetically, if... were authorized," "until dependency D lands... is
  structurally disabled," and "once separately authorized" — all now factual); updated the corpus
  intro's "current status" paragraph and its dependency-status framing paragraph to reflect three
  authorized consumers and Dependency D implemented. No substantive semantic change to Case 24 or any
  other case; Cases 25/26 (the historical-source-gate/no-laundering cases from PR #26) confirmed
  untouched and byte-identical.
- **Machine code**: `schemas/m0/memory-context.schema.json` untouched (confirmed via `git diff` —
  empty); `tests/contracts/validate-contracts.mjs`'s source-gate check untouched, byte-identical in
  behavior; no new fixtures; no `RequirementSpec` schema/validator/fixtures created; no Step 03B work.
- Four fresh independent read-only Codex reviewers (Reviewer A — R-09 × R-19 Authority; Reviewer B —
  `DECISION_OPTION` × Provenance; Reviewer C — Source Gate × C Retirement × Evidence; Reviewer D —
  Stage × Lifecycle × Corpus): **A: 7/7 PASS. B: 7/7 PASS. C: 7/7 PASS. D: 7/7 PASS. Zero findings
  across all 28 checks.** Independently spot-checked by Claude regardless (not merely trusted): R-23's
  invariant text confirmed byte-unchanged by direct diff inspection (no hunk touches it); the
  MemoryContext Producer Boundary section confirmed untouched by direct diff-hunk-location inspection
  (no hunk falls within that section's line range).

## Allowed Scope

`docs/foundation/M0_SCOPE.md`, `docs/contracts/REQUIREMENT_SPEC.md`,
`docs/examples/REQUIREMENT_CASES.md`, `docs/contracts/MEMORY_CONTEXT.md`,
`docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`, `docs/examples/MEMORY_CONTEXT_CASES.md`,
`.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`.

Forbidden and confirmed untouched: `docs/contracts/INTENT_SPEC.md`, `docs/examples/INTENT_CASES.md`,
`docs/contracts/USER_IDEA.md`, `schemas/**`, `tests/**`,
`docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`,
`docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, `.project/PROJECT_STATE.md`,
`.project/DECISIONS_LOG.md`, `.project/CONTEXT_INDEX.md`, `ROADMAP.md`, `scripts/**`, `package*.json`,
`../mihver-brain/**`. No state reconciliation performed in this task, per explicit instruction — PR
#26's checkpoint and this task's own will be recorded together in a single later reconciliation.

## Required Context

`docs/foundation/M0_SCOPE.md`, `docs/foundation/PRINCIPLES.md`,
`docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`,
`docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, `docs/contracts/INTENT_SPEC.md`,
`docs/contracts/REQUIREMENT_SPEC.md`, `docs/contracts/MEMORY_CONTEXT.md`,
`docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`, `docs/examples/REQUIREMENT_CASES.md`,
`docs/examples/MEMORY_CONTEXT_CASES.md`, `schemas/m0/memory-context.schema.json`,
`tests/contracts/validate-contracts.mjs`, `.project/PROJECT_STATE.md`, `ROADMAP.md` — all re-read
fresh, in full or via targeted grep against fresh reads, before any edit.

## Validation

- `npm test`: 85/85, unchanged from base — no schema/test/fixture file touched.
- `git diff --check`: clean.
- `git diff main --stat`: exactly the six allowed content files.
- Confirmed: Dependency C remains RETIRED (R-23 byte-unchanged); Dependency D only (no
  `DISCOVERY_ATTENTION`/`SEMANTIC_PREMISE`/`PROCESS_ONLY` granted to Requirement Derivation); R-10/
  R-22/R-23 intact; no `RequirementSpec` schema; no `RequirementSpec` validator; no Brain/runtime work;
  no durable-state/`ROADMAP.md` change.

## Next Gate

Commit, push, and open one PR against `mihvernetwork/mihver:main`, title "M0: implement Dependency D
memory-informed R-19 defaults". Do not merge. Human review of that PR is the next gate; it authorizes
only this Dependency D semantic/foundation implementation — no `RequirementSpec` schema, no Brain/
runtime work, no durable-state reconciliation (deferred to a later combined task per explicit
instruction).
