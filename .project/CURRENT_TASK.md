# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

DEVELOPMENT-ORCHESTRATION-V3

## Objective

Redesign MIHVER's development execution model so Claude becomes primarily a Principal
Architect / Orchestrator and routine bounded work moves to five specialized Codex roles: Scout
(read-only inspection), Implementer (bounded writes), Verifier (read-only + deterministic
validation), Reviewer (read-only adversarial review), and Git Operator (the only role permitted to
mutate Git state, via PREPARE/PUBLISH modes and a Publication Envelope). Development-infrastructure
only — no M0 product semantics, contracts, ADR semantics, schemas, MIHVER Brain, or
Council/product architecture changed.

**V3 transition rule**: current V2 policy remained authoritative during this task's own execution.
Git Operator was designed but not used for real publication — Claude remained the sole policy-file
editor throughout, per the task's own explicit instruction.

## Branch / Base

Branch: `chore/development-orchestration-v3` (already prepared before this task began).
Base: `main` at `9e1f41eac5b97afb5ef15c62e0d9abb05b911203`.

## Status

**Complete, pending human review.**

**Files changed**:
- Primary: `docs/development/AGENT_POLICY.md`, `docs/development/CODEX_ROLES.md` (new),
  `docs/development/REVIEW_PROTOCOL.md`, `docs/development/TASK_TEMPLATE.md`.
- Conditional Consistency (synchronization-only): `.project/CONTEXT_INDEX.md` (discoverability row
  for `CODEX_ROLES.md`).
- Two subsequent human-review-fixes rounds on the same branch/PR (#31) additionally touched
  `CLAUDE.md` (permanent-policy pointer/description sync, no product semantics) and
  `.project/CURRENT_TASK.md`/`.project/REVIEW_STATE.md` (this task's own record — PR-state sync and
  itemized reviewer-finding records for each round).

**No M0 product semantics, contracts, ADR semantics, schemas, MIHVER Brain, or Council/product
architecture touched** — this is development-infrastructure only.

**Three fresh, independent read-only Codex reviewers**, one per axis (Reviewer A: authority
separation/privilege escalation/Human-only merge; Reviewer B: Claude↔Codex workflow, delegation,
concurrency, lifecycle, token economy; Reviewer C: Git Operator capability safety, Publication
Envelope, branch/PR behavior). All three independently found the same BLOCKER (Git Operator's
PREPARE mode contradicted the original blanket "acts only at `READY_TO_PUBLISH`" wording) plus
several confirmed MAJOR/MINOR findings — all fixed and independently re-verified by Claude against
actual file content. Two further human-review-fixes rounds on PR #31 found and fixed additional
confirmed findings (Git Operator's pre-publish HEAD guard, Base branch/Base commit split, exact
file staging, Publication Fingerprint validation binding, publication receipt; then the
present-regular-file/authorized-deletion staging contradiction). See `.project/REVIEW_STATE.md`'s
"Latest Review" for the full itemized list, round by round.

**Validation**: `npm run check:project-consistency` — 7/7. `npm run test:project-consistency` —
19/19. `git diff --check` — clean. `npm test` not run (no schema/validator/fixture file touched by
this development-infrastructure-only task).

## Allowed Scope

**Primary**: `docs/development/AGENT_POLICY.md`, `docs/development/CODEX_ROLES.md`,
`docs/development/REVIEW_PROTOCOL.md`, `docs/development/TASK_TEMPLATE.md`.

**Conditional Consistency** (touched; synchronization-only): `.project/CONTEXT_INDEX.md`,
`.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`, `CLAUDE.md` (added by the human-review-fixes
rounds).

**Forbidden, confirmed untouched**: M0 product semantics, contracts, ADR semantics, schemas,
MIHVER Brain, Council/product architecture, runtime product behavior.

## Required Context

`docs/development/AGENT_POLICY.md`, `docs/development/CODEX_ROLES.md`,
`docs/development/REVIEW_PROTOCOL.md`, `docs/development/TASK_TEMPLATE.md`.

## Validation

See "Status" above.

## Next Gate

PR: #31
Target: main
Live PR state: verify from GitHub.
Human review is the current gate. Do not merge.
