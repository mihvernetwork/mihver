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
- 2026-08-22 — `M0-ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY` (PR #15) merged to `main`: verified
  via `gh pr view 15 --repo mihvernetwork/mihver --json state,mergedAt,mergeCommit,title`
  (`state: MERGED`, `mergedAt: 2026-08-22T11:23:44Z`) and `git log`/`git status` on `main` (`HEAD`
  matches the reported merge commit exactly) — squash commit `aa1fe66072ae780a910eb458f8263c4886fd37fd`.
  Produced `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`,
  `docs/contracts/MEMORY_CONTEXT.md`, `docs/examples/MEMORY_CONTEXT_CASES.md`. `ADR-0004`'s own
  `## Status` field on `main` at this commit reads **Proposed**, confirmed by direct read of the
  file at this commit — not Accepted, and not claimed as such here. No prior entry in this log
  recorded an approval decision for this merge; this entry records only the independently-verified
  merge fact, not a reconstructed human quote. `MemoryContext` remains design-only: no stage
  declares it as an input on `main` at this commit, and no `mihver-brain` or runtime change
  accompanied this merge.
- 2026-08-22 — `M0-FOUNDATION-MEMORY-BOUNDARY-A` (PR #17) merged to `main`: verified via
  `gh pr view 17 --repo mihvernetwork/mihver --json state,mergedAt,mergeCommit,title`
  (`state: MERGED`, `mergedAt: 2026-08-22T16:09:50Z`) and `git log`/`git status` on `main` (`HEAD`
  matches the reported merge commit exactly) — squash commit
  `9416e857b549bea07d4ce06a5c365524fdf1d51a`. Amended `docs/foundation/M0_SCOPE.md` to implement
  `ADR-0004`'s Dependency A: introduced `RunContext` (a non-memory run/invocation scope anchor,
  distinct from `UserIdea`), the cross-cutting `MemoryContext` Producer boundary, and authorized
  Research Planning as the first and only `MemoryContext`-consuming stage (`DISCOVERY_ATTENTION`
  tier only, additive, provenance-visible). `ADR-0004`'s own `## Status` field on `main` at this
  commit still reads **Proposed** — not Accepted, and not claimed as such here. Every other stage,
  and `ADR-0004`'s dependencies B, C, and D, remain structurally disabled; `INTENT_SPEC.md`/
  `REQUIREMENT_SPEC.md` are untouched. No `mihver-brain`, schema, or runtime change accompanied
  this merge — this is a semantic/foundation authorization only. No prior entry in this log
  recorded an approval decision for this merge; this entry records only the independently-verified
  merge fact, not a reconstructed human quote.
- 2026-08-22 — `ADR-0004` (Memory Context Authority Boundary) Status: **Accepted** — human decision
  stated directly via the `ADR-0004-ACCEPTANCE` task prompt itself ("Move ADR-0004 ... from Proposed
  to Accepted, but ONLY if its own previously-defined Acceptance Gate is demonstrably satisfied by
  current `main`"), which this task treats as the explicit human authorization for the Status
  transition. Basis: `ADR-0004`'s own "Acceptance Gate" section requires dependency A alone
  (the core `M0_SCOPE.md` integration boundary), separately, explicitly human-authorized, completed,
  and adversarially reviewed against real cases — independently reverified against current `main`
  before this change: dependency A completed via PR #17 (squash commit
  `9416e857b549bea07d4ce06a5c365524fdf1d51a`, confirmed merged via `gh pr view 17`), and
  adversarially reviewed by four independent read-only Codex reviewers before that merge (see
  `.project/REVIEW_STATE.md`'s history for `M0-FOUNDATION-MEMORY-BOUNDARY-A`). No semantic redesign
  was performed in this task — Model C and the full `MEMORY_CONTEXT.md` contract are unchanged.
  Dependencies B, C, and D remain exactly as structurally disabled as before this Status change; no
  `MemoryContext` runtime, schema, or Brain adapter exists; `ADR-0003`'s own Status is unchanged
  (**Proposed**). The Status change itself is recorded in
  `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`'s own `## Status` field. The PR opened for
  this change has not merged as of this entry — merge execution requires a separate, later, explicit
  human instruction.
