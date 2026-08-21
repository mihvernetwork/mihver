# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

ADR-0002-ADVERSARIAL-REVIEW

## Objective

Determine whether ADR-0002's remaining status gate is satisfied. `ADR-0002` (Status: Proposed)
names two conditions in its "Future Work" for revisiting Status: schema design work, and at least
one adversarial review pass exercising the model against real cases. Schema design already
happened (M0 Step 02B, merged `0683e84`: `schemas/m0/*.json`, `SCHEMA_MAPPING.md`,
`tests/contracts/**`) — this task does not repeat it. This task performs the second condition: an
adversarial review of the epistemic model (`ADR-0002`, `INTENT_SPEC.md`) against every scenario in
`INTENT_CASES.md`, cross-checked against the schemas, the deterministic validator, and existing
fixtures, producing a PASS/FAIL-per-category report and a final recommendation (`ACCEPT_ADR` /
`KEEP_PROPOSED_WITH_REQUIRED_CHANGES` / `REDESIGN`).

## Branch / Base

Branch: `review/adr-0002-adversarial-review`
Base: `main`

## Status

**Complete.** Two independent read-only Codex reviewers (A: epistemic/semantic correctness; B:
schema/validator coverage) each independently reached **KEEP_PROPOSED_WITH_REQUIRED_CHANGES**.
Claude critically re-verified their most material claims directly against the repository (not
merely relayed) before synthesizing — see `docs/reviews/ADR-0002-ADVERSARIAL-REVIEW.md` for the
full report, including which specific claims were independently confirmed versus taken on the
reviewer's stated basis.

Headline findings: `INTENT_CASES.md` Case 13 is internally self-contradictory (classifies the same
gap as both Ambiguity and Unknown — confirmed by direct quote comparison); Decision Impact ratings
in at least Cases 2 and 14 (confirmed) contradict the contract's own MEDIUM/HIGH definitions, with
the same pattern plausible in Cases 6, 9, 10, 11 (Reviewer A's claim, not individually
re-verified); fixture coverage for `scope_condition`, `reported_third_party` speaker attribution,
and non-`operative` `discourse_role` values is confirmed absent (direct `grep`); no structural
representability failure was found in the schema/validator for any of the 20 cases; `SCHEMA_MAPPING.md`'s
enforcement classifications hold as written; `npm test` passes 24/24.

Final recommendation: **KEEP_PROPOSED_WITH_REQUIRED_CHANGES** — the model's basic shape is sound
(no `REDESIGN`), but `ACCEPT_ADR` is premature while the corpus meant to demonstrate the model
contains a confirmed self-contradiction and confirmed Decision Impact miscalibration. No ADR,
contract, or schema file was modified in this task, per its explicit scope. Report written to
`docs/reviews/ADR-0002-ADVERSARIAL-REVIEW.md`; PR to follow per task instruction. Human review of
the report and its recommendation is the next gate — this task does not itself flip ADR-0002's
Status or apply any of the report's suggested required changes.

## Allowed Scope

Add:
- `docs/reviews/ADR-0002-ADVERSARIAL-REVIEW.md` (new)

Update:
- `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`

Forbidden (read-only for this task): `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`,
`docs/contracts/INTENT_SPEC.md`, `docs/contracts/SCHEMA_MAPPING.md`, `docs/examples/INTENT_CASES.md`,
`schemas/**`, `tests/contracts/**`, `.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`,
`CLAUDE.md`, `docs/development/**`.

## Required Context

- `CLAUDE.md`, `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
- `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`
- `docs/contracts/INTENT_SPEC.md`
- `docs/examples/INTENT_CASES.md`
- `docs/contracts/SCHEMA_MAPPING.md`
- `schemas/m0/intent-spec.schema.json`, `schemas/m0/user-idea.schema.json`
- `tests/contracts/validate-contracts.mjs` and `tests/contracts/fixtures/**`

## Validation

- `npm test`: 24/24 fixtures pass (baseline, before this review's own analysis).
- Two independent read-only Codex reviewers dispatched (in progress).

## Next Gate

PR #10 opened (base `mihvernetwork/mihver:main`, compare `devSerdar:review/adr-0002-adversarial-review`
— pushed via a fork under `devSerdar` since neither the SSH nor `gh` identity available in this
session had direct push access to `mihvernetwork/mihver`). Human review of the report and its
recommendation is the next gate. Not merged, per task instruction.

---

## Prior task on this repository (different branch, not superseded by this file)

`NIGHT-RUNNER-FRESH-CLAUDE-EXECUTOR` remains open on its own branch
(`feat/night-runner-fresh-claude-executor`, PR #8): human-approved for merge, merge execution
itself still pending a separate explicit instruction. That task's full record lives in this file
as committed on that branch, and in `.project/REVIEW_STATE.md`'s History — not restated here, per
this file's branch-scoping (see `AGENT_POLICY.md`'s Operational State Scope).
