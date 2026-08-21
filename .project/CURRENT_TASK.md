# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

M0-STEP-03A-REQUIREMENT-SPEC-SEMANTIC-CONTRACT

## Objective

Begin M0 Step 03 (IntentSpec → RequirementSpec): define the implementation-independent semantic
contract for Requirement Derivation and `RequirementSpec` — semantic design only, no JSON Schema, no
runtime code, no technology research, no architecture synthesis. Required outputs:
`docs/contracts/REQUIREMENT_SPEC.md` (the contract), `docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`
(Status: Proposed), and `docs/examples/REQUIREMENT_CASES.md` (an adversarial worked-example corpus,
≥15 cases, delivered with 17). Frozen boundaries respected: `ADR-0002`, `INTENT_SPEC.md`,
`USER_IDEA.md`, existing schemas/validator, and `INTENT_CASES.md` were not modified — no genuine
contradiction requiring their modification was found.

## Branch / Base

Branch: `m0/step-03a-requirement-contract`
Base: `main` (`a20d647` — includes merged PR #10, #11, #12; `ADR-0002` Status: Accepted)

## Status

**Complete.** Drafted all three required documents. Three independent read-only Codex reviewers
(A: provenance/epistemic boundary; B: requirement semantics; C: lifecycle/handoff) each reviewed the
draft; all three found real, independently-verified defects, several converging across two or three
reviewers on the same issue. Claude independently verified every material finding against the actual
text before fixing — not relayed uncritically — then applied targeted fixes. See
`.project/REVIEW_STATE.md`'s "Latest Review" (moved to History once this task's own record is
superseded) for the full list of confirmed-and-fixed defects: force-inflation bugs in three cases
(preference silently mapped to SHALL/MUST); a condition-strengthening bug ("only if" compiled to "if
and only if," manufacturing an unstated converse) in both the main contract and a case; a
self-contradiction in the Complete/Partial/Failed model (Failed's example was identical to
Complete-with-zero-Requirements'); an overclaim about downstream Partial-consumption authorization
that contradicted the ADR's own Open Questions; an interpretive-leap bug and an invalid
Decision-Impact-level bug in two cases (replaced with cleaner scenarios); plus several smaller fixes
(a dangling internal cross-reference, a missing provenance section, ambiguous invalidation wording,
an unbounded inference-boundary concept now given an operational test, a near-circular re-derivation
trigger now enumerated). `npm test`: 32/32 throughout (unaffected — no schema/validator/fixture file
touched, per this task's explicit scope).

Final recommendation: **READY_FOR_HUMAN_REVIEW** — not `REDESIGN_REQUIRED` (no reviewer found the
model's basic shape — provenance chain, origin preservation, non-inflationary force mapping,
Complete/Partial/Failed — unsound; every confirmed defect was a drafting/consistency bug, not a
structural one); not `REQUIRED_CHANGES_REMAIN` (every confirmed defect across all three reviewers was
fixed and independently re-verified against the actual edited text, not left open).

## Allowed Scope

Add:
- `docs/contracts/REQUIREMENT_SPEC.md`
- `docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`
- `docs/examples/REQUIREMENT_CASES.md`

Update: `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`

Forbidden (frozen, none touched): `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`,
`docs/contracts/INTENT_SPEC.md`, `docs/contracts/USER_IDEA.md`, `schemas/**`,
`tests/contracts/validate-contracts.mjs`, `docs/examples/INTENT_CASES.md`, `CLAUDE.md`,
`docs/development/**`, `.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`.

## Required Context

- `CLAUDE.md`, `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
- `docs/foundation/M0_SCOPE.md`, `docs/foundation/PRINCIPLES.md`, `docs/adr/ADR-0001-ARCHITECTURE-COMPILER-MODEL.md`
- `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`, `docs/contracts/INTENT_SPEC.md`,
  `docs/contracts/USER_IDEA.md` (read-only grounding)

## Validation

- `npm test`: 32/32 throughout (unaffected by this task's prose-only, new-file-only changes).
- Three independent Codex reviewers, all findings independently verified by Claude against the
  actual text before any fix was applied.

## Next Gate

PR #13 opened (base `mihvernetwork/mihver:main`, compare `devSerdar:m0/step-03a-requirement-contract`
— pushed via the `devSerdar` fork per this task's explicit instruction, not `mihvernetwork`). Do not
merge. `ADR-0003` remains Proposed. Human review of the PR is the next gate.
