# Review State

Durable review/approval state, updated at the end of each task per `REVIEW_PROTOCOL.md`'s
completion checklist. Never invent or assume approval: if a human has not explicitly stated it,
record the gate as pending, not granted. A Codex or Claude `APPROVED` verdict is a technical
assessment, not human sign-off — see `AGENT_POLICY.md`'s Authority Hierarchy.

**Branch/task-scoped, like [CURRENT_TASK.md](./CURRENT_TASK.md).** The "Latest Review" section
below describes the current gate only when *both* hold: `CURRENT_TASK.md` is active for the
checked-out branch, and this file's own declared Branch/Task (below) matches that same
branch/task. `npm run context` checks this automatically. When either condition fails — no active
task, or this file's Branch/Task doesn't match the active one — the "Latest Review" content is
historical/stale task metadata only, not the current gate; `PROJECT_STATE.md`'s "Next Authorized
Action" is authoritative for what's next, not anything below.

## Latest Review

Task: ADR-0005-ACCEPTANCE-GATE-DEFINITION
Branch: `docs/adr-0005-acceptance-gate-definition`
Target: main
Publication:
- Local Publication Builder authorized: yes, per this task's own explicit instruction ("prepare
  exactly one local commit through the repository publication flow"), gated on the Reviewer verdict
  being APPROVED and verification being clean — both met (see below)
- remote publication: human manual fallback only (unchanged by this task)
- one local commit, subject `docs: define adr-0005 acceptance gate`, no push, no PR mutation, no
  merge, no Shadow Council started

This task adds exactly one new section (`## Acceptance Gate`) to
`docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`, defining the forward-looking evidence a future
task must produce before `ADR-0005` can even be considered for Status: Proposed → Accepted. It does
not accept `ADR-0005` (Status remains **Proposed**), does not change the Decision Council protocol/
quorum rules/schemas/kernel/simulator/tests, and does not start Shadow Council. See
`.project/CURRENT_TASK.md` for the full change summary.

**Reviewer** (`mcp__codex__codex`, fresh/independent, read-only sandbox, thread
`01a04ca3-85f9-7d33-8344-f905540d01ed`, authored none of the material under review). Two rounds:
- **Round 1**: **CHANGES REQUIRED** — one MAJOR finding, that `git diff main --stat` showed
  `.project/CURRENT_TASK.md` modified in addition to the ADR, which an overly strict instruction in
  Claude's own review prompt ("confirm no other file changed at all") had framed as disqualifying.
  All 6 substantive review points otherwise PASSED even in this round: no accidental ADR acceptance
  (Status confirmed `Proposed`); the ADR's own diff confirmed a pure append-only hunk with no
  pre-existing protocol/topology/hashing/quorum/authority text edited; no circular requirement (the
  criteria explicitly reject retroactive satisfaction from V1A's existing evidence); all 7 criteria
  confirmed concrete/checkable; real provider-backed Shadow Council evidence confirmed mandatory
  (criterion 2); execution/publication authority confirmed out of scope (criterion 6, plus the
  explicit non-prerequisite statement).
- **Round 2** (after Claude clarified that `.project/CURRENT_TASK.md`/`.project/REVIEW_STATE.md`
  updates are explicitly authorized, standard task-completion bookkeeping per this task's own "STATE
  FILES" instruction and `REVIEW_PROTOCOL.md`'s Completion Checklist — not scope creep — and that the
  task's real file-scope restriction is narrower: no change to `.project/PROJECT_STATE.md`,
  `.project/DECISIONS_LOG.md`, or the protocol/schema/kernel/simulator/test files): **APPROVED**. The
  Reviewer independently re-confirmed `.project/PROJECT_STATE.md` and `.project/DECISIONS_LOG.md` at
  zero diff from `main`; `schemas/dev/decision-council.schema.json`,
  `scripts/dev/decision-council-kernel.mjs`, `scripts/dev/decision-council-simulator.mjs`, and both
  test files at zero diff from `main`; the ADR diff still a single append-only hunk; and
  `.project/CURRENT_TASK.md`'s content making no accidental-acceptance claim, no competing semantic
  redefinition of the protocol, and no overstated review/verification claim. No findings.

**Adjudication**: the Round 1 finding was a mismatch between Claude's own overly strict review
instruction and the task's actual, narrower file-scope restriction — not a defect in the change
itself. Corrected by clarifying the instruction, not by altering any file. No finding at any point
required changing the ADR's own Status, the Decision Council protocol, or any schema/kernel/
simulator/test file.

**Verifier** (`mcp__codex__codex`, fresh/independent session, `workspace-write` sandbox, thread
`01a04ca6-197d-7b83-a032-89aa28b290f3`, never a continuation of the Reviewer's own thread):
`npm run context` — **PASS**; `npm run context:pack` — **PASS** (valid: true, 0 errors, 1 expected
warning — `DIRTY_WORKING_TREE`, because the closeout edits were not yet committed at verification
time); `npm run test:decision-council-kernel` — **18 passed, 0 failed**; `npm run
test:decision-council-simulator` — **18 passed, 0 failed**; `npm run test:project-consistency` —
**19 test groups passed, 0 failed**; `npm run check:project-consistency` — **7/7 PASS**; `git diff
--check` — **0 errors**; `git status --short` — exactly `.project/CURRENT_TASK.md` and
`docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md` modified, nothing else; `.project/PROJECT_STATE.md`,
`.project/DECISIONS_LOG.md`, `schemas/dev/decision-council.schema.json`,
`scripts/dev/decision-council-kernel.mjs`, `scripts/dev/decision-council-simulator.mjs`, and both
test files independently confirmed at zero diff from `main`; `ADR-0005`'s `## Status` field
independently confirmed still reading literally `Proposed`. **ALL CHECKS PASS.**

**Human review is the next gate** — this task does not authorize a push, PR, or merge, does not
accept `ADR-0005`, and does not start Shadow Council or any other follow-on task.
