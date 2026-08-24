# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-STEP-03B-REQUIREMENT-SPEC-SCHEMA

## Objective

Implement M0 Step 03B: the first machine-readable representation of `RequirementSpec` —
`schemas/m0/requirement-spec.schema.json`, `docs/contracts/REQUIREMENT_SPEC_SCHEMA_MAPPING.md`,
deterministic validator integration (`tests/contracts/validate-contracts.mjs`), and adversarial
fixture coverage — while preserving `docs/contracts/REQUIREMENT_SPEC.md`'s R-01 through R-24 exactly
as frozen. `ADR-0003`'s Status remains **Proposed**; this task does not accept it. Does not implement
Research Planning, MIHVER Brain runtime/adapter, or start any task after Step 03B.

Two mandatory pre-implementation re-derivations, both settled by existing text, neither a
`SCHEMA_DESIGN_GAP`:

- **Failed-outcome representation**: a Failed Requirement Derivation run produces **no**
  `RequirementSpec` artifact — the schema's `status` enum has only `"complete"`/`"partial"`, never
  `"failed"`. Basis: `M0_SCOPE.md`'s cross-cutting rule ("instead of producing its declared output
  artifact, report that it cannot"; "'no valid output' is an acceptable, explicit stage result"),
  `intent-spec.schema.json`'s identical precedent ("Failed parsing produces no IntentSpec"), and
  `REQUIREMENT_SPEC.md`'s own framing ("cannot even attempt honest compilation").
- **R-22 × mixed-strength Requirement**: final decision, after a subsequent human-review-fixes round
  (see `.project/REVIEW_STATE.md`'s "Latest Review" for detail) reconsidered the interim
  clause-level-escape-valve resolution this bullet originally described — the Requirement-Level-Inference
  premise unit remains exactly R-10's literal `{kind: "claim", claim_id}` or
  `{kind: "requirement", requirement_id}` (valid only when all its clauses share one strength). A
  mixed-strength Requirement is **not eligible, as a whole, to serve as an RLI premise**, and no
  clause-level citation is authorized by the frozen text — `{kind: "requirement_clause", ...}` was
  removed from the schema. See `REQUIREMENT_SPEC.md`'s "Mixed-strength Requirement as premise (R-22
  clarification)" paragraph. `ADR-0003`'s Status remains **Proposed**.

## Branch / Base

Branch: `m0/step-03b-requirement-schema` (new branch, created from `main`).
Base: `main` at `5ca5df94402eab56b96693dc5611123b8b14b4a2` — verified via `git status` (clean),
`git log` (HEAD matched exactly), `npm run context` (no active task for this branch), `npm test`
(85/85), `npm run test:project-consistency` (19/19), `npm run check:project-consistency` (7/7 PASS)
before any edit.

## Status

**Complete, pending human review.**

Read fresh before editing: `CLAUDE.md`, `AGENT_POLICY.md`, `REVIEW_PROTOCOL.md`, `TASK_TEMPLATE.md`,
`.project/PROJECT_STATE.md`, `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`,
`.project/CONTEXT_INDEX.md`, `docs/contracts/REQUIREMENT_SPEC.md` (full), `docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`,
`docs/examples/REQUIREMENT_CASES.md` (full), `docs/contracts/INTENT_SPEC.md` (full),
`docs/contracts/SCHEMA_MAPPING.md`, `schemas/m0/intent-spec.schema.json`,
`docs/contracts/MEMORY_CONTEXT.md` (full), `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`,
`schemas/m0/memory-context.schema.json`, `tests/contracts/validate-contracts.mjs`. `M0_SCOPE.md` read
only for the frozen Requirement Derivation stage boundary and MemoryContext authorization, per the
task's own instruction.

**Files changed**:
- Primary (new/modified): `schemas/m0/requirement-spec.schema.json` (new),
  `docs/contracts/REQUIREMENT_SPEC_SCHEMA_MAPPING.md` (new), `tests/contracts/validate-contracts.mjs`
  (extended with a backward-compatible multi-companion harness and `validateRequirementSpec` plus
  helpers), 63 new fixtures under `tests/contracts/fixtures/{valid,invalid}/requirement-spec-*.json`
  and `requirement-spec-r*-*.json`.
- Conditional Consistency (each edit synchronization-only):
  - `.project/PROJECT_STATE.md` — Current Capability Snapshot updated (schema now IMPLEMENTED,
    148/148 contract suite); removed the brittle "REVIEW_PROTOCOL.md item 9" reference, replaced with
    a stable named reference ("Stop before the next task"); added a compact "M0 Step 03B" checkpoint;
    qualified the Dependency D checkpoint's now-stale "no schema exists yet" sentence as historical;
    updated "Open Items"/"Next Authorized Action" for `ADR-0003`.
  - `.project/CONTEXT_INDEX.md` — added discoverability rows for the new schema/mapping.
  - `ROADMAP.md` — Section 8.3 and Phase 11 flipped from NOT-YET-DONE/PLANNED to DONE with pointers;
    fixture-count mirror (Section 21) updated to 148/148; historical PR #27 checkpoint's "no schema
    exists yet" sentence qualified as historical; near-term-order item 8 updated to DONE.
  - `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md` — "No RequirementSpec Machine Schema Yet"
    section renamed/rewritten to point at the now-existing schema and its own mapping, without
    duplicating its content.
  - `.project/CURRENT_TASK.md` / `.project/REVIEW_STATE.md` — this task's own record.

**No `docs/foundation/**`, `docs/contracts/REQUIREMENT_SPEC.md`, `docs/examples/REQUIREMENT_CASES.md`,
`docs/contracts/INTENT_SPEC.md`, `docs/contracts/MEMORY_CONTEXT.md`, `schemas/m0/user-idea.schema.json`,
`schemas/m0/intent-spec.schema.json`, `schemas/m0/memory-context.schema.json`, or `docs/adr/**` file
touched** — confirmed via `git diff main --stat` against every one, individually, producing empty
output.

**Eight independent read-only reviewers** — four Codex (the task's own required Section 31 reviewers)
plus four Claude general-purpose agents run in parallel for additional cross-checking (a process
deviation from the task's literal "four Codex reviewers" instruction, corrected mid-task by also
dispatching the required four Codex reviewers; both sets' findings were used, with the four Codex
reviewers as the authoritative Section 31 deliverable). See `.project/REVIEW_STATE.md`'s "Latest
Review" for the full itemized findings and fixes — summary: two rounds of findings surfaced 6
independently-confirmed blocking defects in the first draft (schema `revision`/`invalidation` omitted
from `required`, defeating R-12/13/14; Assumed-origin clauses representable as non-provisional/
irreversible with `reversible` never validated; mixed-origin/confidence basis wrongly rejected as a
single scalar instead of a preserved set; R-08's Conflict-participant guard not covering the
Requirement-Level-Inference premise path; R-07 unrepresentable/unchecked on RLI clauses; a
`requirement_derivation`-stage MemoryContext's `upstream_artifact_binding` accepting `null`, bypassing
the IntentSpec-version binding check) plus several further real, independently-confirmed issues
(strength-less `preference` claims silently inflating to SHOULD; duplicate companion identities
resolving positionally; two working defaults able to fill the same Unknown with contradictory values;
an Unknown representable as both `unfillable_unknown` and filled; an RLI premise able to cite an
invalidated Requirement's clause; a revision able to name zero affected Requirements/Open Items; the
R-22×mixed-strength resolution's removal of R-10's literal whole-Requirement premise option, correctly
flagged as an undisclosed narrowing warranting reconsideration even though the refinement itself was
judged defensible). All were independently re-verified by Claude against actual code/schema (not
merely accepted on a reviewer's say-so) and fixed; 19 new regression fixtures
(`requirement-spec-r1`–`r19-*.json`) were added, one per confirmed defect, to prove each fix and guard
against regression. Both re-derivation questions (Failed-outcome, R-22×mixed-strength) were
independently re-examined by multiple reviewers and confirmed correctly determined by existing text,
not requiring a stop.

**Validation**: `npm test` — 148/148 at this task's own completion (85 pre-existing + 63 new; all 85
pre-existing fixtures confirmed byte-unchanged); a subsequent human-review-fixes round on the same
branch/PR brought the current total to **170/170** (22 additional regression fixtures — see
`.project/REVIEW_STATE.md`'s "Latest Review" for detail). `npm run check:project-consistency` — 7/7.
`npm run test:project-consistency` — 19/19.
`git diff --check` — clean. `git diff main --stat` — confirmed no forbidden-path file touched
(individually checked, all empty).

## Allowed Scope

**Primary**: `schemas/m0/requirement-spec.schema.json`, `docs/contracts/REQUIREMENT_SPEC_SCHEMA_MAPPING.md`,
`tests/contracts/validate-contracts.mjs`, `tests/contracts/fixtures/{valid,invalid}/requirement-spec-*.json`.

**Conditional Consistency** (touched; each edit synchronization-only, reasons recorded above):
`.project/PROJECT_STATE.md`, `.project/CONTEXT_INDEX.md`, `ROADMAP.md`,
`docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`, `.project/CURRENT_TASK.md`,
`.project/REVIEW_STATE.md`. `docs/development/REVIEW_PROTOCOL.md` and `docs/development/TASK_TEMPLATE.md`
were read and found not to need any change.

**Forbidden, confirmed untouched**: `docs/contracts/REQUIREMENT_SPEC.md`,
`docs/examples/REQUIREMENT_CASES.md`, `docs/contracts/INTENT_SPEC.md`, `docs/contracts/MEMORY_CONTEXT.md`,
`docs/foundation/**`, `schemas/m0/user-idea.schema.json`, `schemas/m0/intent-spec.schema.json`,
`schemas/m0/memory-context.schema.json`, `docs/adr/ADR-0001*`–`ADR-0004*`, `../mihver-brain/**`.

## Required Context

See "Status" above for the required-reading list.

## Validation

See "Status" above.

## Next Gate

PR: #30 — `https://github.com/mihvernetwork/mihver/pull/30`
Target: main
Live PR state: verify from GitHub.
Human review is the next gate. Do not merge.
