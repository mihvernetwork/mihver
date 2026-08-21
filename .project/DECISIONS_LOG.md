# Decisions Log

Append-only. Records durable, human-approved project/process decisions — not their technical
content, which lives in the relevant ADR/contract and must not be duplicated here. Entries are
added at task completion; existing entries are never edited or removed.

Format: `YYYY-MM-DD — decision — reference`.

---

- 2026-08-19 — M0 Step 02A (Intent semantic contract) merged to `main` via PR #1, human-gated
  merge per `AGENT_POLICY.md`. — `218bced`
- 2026-08-19 — M0 Step 02B (Intent schema): human decision stated directly as "APPROVED"; merged
  to `main`. — `0683e84`
- 2026-08-19 — Authorized `PROJECT-CONTEXT-BOOTSTRAP`: build the `.project/` session-bootstrap
  mechanism and `scripts/dev/project-context.mjs`. — branch `chore/project-context-bootstrap`
- 2026-08-19 — Authorized `PROJECT-CONTEXT-FINAL-PATCH`: harden the bootstrap lifecycle before
  merge — durable-only `PROJECT_STATE.md`, branch-scoped `CURRENT_TASK.md`, a permanent
  Operational State Scope policy, and a compact-by-default `npm run context` with `--full`. —
  branch `chore/project-context-bootstrap`
- 2026-08-19 — Human review of the `chore/project-context-bootstrap` branch and bootstrap
  mechanism: **APPROVED WITH FINAL OPERATIONAL PATCH REQUIRED**, stated directly by the human,
  not final merge approval. Authorized `PROJECT-CONTEXT-MERGE-GATE`: Gate Recording Commit policy,
  a compact PROJECT_STATE.md-derived summary in `npm run context`, and this review-state record. —
  branch `chore/project-context-bootstrap`
- 2026-08-19 — `PROJECT-CONTEXT-BOOTSTRAP` **APPROVED for merge** — human decision stated directly
  as "PROJECT-CONTEXT-BOOTSTRAP is APPROVED for merge"; recorded via a Gate Recording Commit per
  `AGENT_POLICY.md`. The merge itself has not been performed — execution requires a separate,
  later explicit instruction. — branch `chore/project-context-bootstrap`
- 2026-08-19 — `PROJECT-CONTEXT-BOOTSTRAP` merged to `main`: human requested PR + squash merge
  directly in conversation (base `main`, compare `chore/project-context-bootstrap`), executed via
  PR #3, squash commit `c5d3dc8`, message `chore: add durable project context bootstrap`. Fulfills
  the merge decision recorded above. — `c5d3dc8`
- 2026-08-19 — Authorized `PROJECT-CONTEXT-FREEZE-STATE`: sync durable project state after the PR
  #3 merge — record the new frozen checkpoint in `PROJECT_STATE.md`, update operational state
  files per `AGENT_POLICY.md`'s Operational State Scope, no bootstrap-implementation or
  architecture changes. — branch `chore/project-context-freeze-state`
- 2026-08-19 — `PROJECT-CONTEXT-FREEZE-STATE` (PR #4) **APPROVED for merge** — human decision
  stated directly as "PR #4 / PROJECT-CONTEXT-FREEZE-STATE is APPROVED for merge"; recorded via a
  Gate Recording Commit per `AGENT_POLICY.md`. The merge itself has not been performed —
  execution requires a separate, later explicit instruction. — branch
  `chore/project-context-freeze-state`
- 2026-08-19 — `PROJECT-CONTEXT-REVIEW-SCOPE` (PR #5) **APPROVED for merge** — human decision
  stated directly as "PR #5 / PROJECT-CONTEXT-REVIEW-SCOPE is APPROVED for merge"; recorded via a
  Gate Recording Commit per `AGENT_POLICY.md`. The merge itself has not been performed —
  execution requires a separate, later explicit instruction. — branch
  `chore/project-context-review-scope`
- 2026-08-19 — `PROJECT-CONTEXT-AUTO-BOOTSTRAP` (PR #6) **APPROVED for merge** — human decision
  stated directly as "PR #6 / PROJECT-CONTEXT-AUTO-BOOTSTRAP is APPROVED for merge"; recorded via
  a Gate Recording Commit per `AGENT_POLICY.md`. The merge itself has not been performed —
  execution requires a separate, later explicit instruction. — branch
  `chore/project-context-auto-bootstrap`
- 2026-08-19 — `NIGHT-RUNNER-FOUNDATION` (PR #7) **APPROVED for merge** — human decision stated
  directly as "PR #7 / NIGHT-RUNNER-FOUNDATION is APPROVED for merge"; recorded via a Gate
  Recording Commit per `AGENT_POLICY.md`. The merge itself has not been performed — execution
  requires a separate, later explicit instruction. — branch `chore/night-runner-foundation`
- 2026-08-21 — `ADR-0002` (Epistemic Provenance Model) Status: **Accepted** — human decision stated
  directly ("ADR-0002 is approved to move from Proposed to Accepted"), citing merged PR #10
  (adversarial review) and PR #11 (remediation, final consistency sweep, and handoff-consistency
  fix) as evidence, plus a 32/32 passing contract test suite and no representability or
  epistemic-model redesign blocker found across four independent review rounds. Implemented as task
  `ADR-0002-ACCEPTANCE`. The merge of that change to `main` has not been performed — execution
  requires a separate, later explicit instruction. — branch `docs/adr-0002-acceptance`

---

The entries below were appended during `PROJECT-STATE-RECONCILE-POST-STEP-03A` to record merges of
previously-logged-but-then-still-pending decisions above, plus two merges with no prior entry at
all. Every fact below was verified directly against `git log` and `gh pr list --state merged`
before being recorded — none is inferred, reconstructed, or restated from stale `.project` prose.
Entries above this line are unmodified, per this log's append-only policy.

- 2026-08-19 — `PROJECT-CONTEXT-FREEZE-STATE` (PR #4) merged to `main`: verified via `git log` and
  `gh pr list --state merged`. Fulfills the merge decision recorded above (that entry recorded
  approval only; this entry is the follow-up confirming execution happened). — squash commit
  `6a399c7`
- 2026-08-19 — `PROJECT-CONTEXT-REVIEW-SCOPE` (PR #5) merged to `main`: verified via `git log` and
  `gh pr list --state merged`. Fulfills the merge decision recorded above. — squash commit
  `fdc27d4`
- 2026-08-19 — `PROJECT-CONTEXT-AUTO-BOOTSTRAP` (PR #6) merged to `main`: verified via `git log`
  and `gh pr list --state merged`. Fulfills the merge decision recorded above. — squash commit
  `3f0b53b`
- 2026-08-19 — `NIGHT-RUNNER-FOUNDATION` (PR #7) merged to `main`: verified via `git log` and
  `gh pr list --state merged`. Fulfills the merge decision recorded above. — squash commit
  `9a61a0b`
- 2026-08-20 — `NIGHT-RUNNER-FRESH-CLAUDE-EXECUTOR` (PR #8) merged to `main`: verified via
  `git log` and `gh pr list --state merged` — squash commit `4590f7a`. No prior Gate Recording
  Commit entry exists in this log for this PR's merge-approval; this entry records only the
  verified merge fact from git/GitHub, not a reconstructed human quote.
- 2026-08-21 — `ADR-0002-ACCEPTANCE` (PR #12) merged to `main`: verified via `git log` and
  `gh pr list --state merged` — squash commit `a20d647`. Fulfills the `ADR-0002` Status: Accepted
  decision recorded above. `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`'s own `## Status`
  field on `main` now reads **Accepted**, confirmed by direct read of the file at this commit.
- 2026-08-21 — `M0-STEP-03A-REQUIREMENT-SPEC-SEMANTIC-CONTRACT` (PR #13) merged to `main`: verified
  via `git log` and `gh pr list --state merged` — squash commit `fe79098`. Produced
  `docs/contracts/REQUIREMENT_SPEC.md`, `docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`
  (Status: Proposed, confirmed by direct read of the file at this commit),
  `docs/examples/REQUIREMENT_CASES.md`. No prior entry in this log recorded an approval decision
  for this merge. This entry records only the merge fact independently verified via `git log` and
  `gh pr list --state merged`; the merge-authorization decision itself is not something `git log`
  or `gh pr list` can show, is not independently verifiable from those sources, and is not claimed
  as Claude-witnessed here.
