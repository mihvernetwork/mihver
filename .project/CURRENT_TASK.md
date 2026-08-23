# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

DEVELOPMENT-CONSISTENCY-V2-HARDENING

## Objective

A narrow hardening pass on top of `DEVELOPMENT-CONSISTENCY-MODEL-V2` (below, same branch/PR #29),
closing five confirmed implementation/consistency gaps a human review of PR #29 found. Does not
redesign Owner/Mirror/Historical, the three-tier task scope model, the Final Consistency Sweep, or the
one-bounded-reconciliation policy — those are approved and unchanged.

1. **Portability**: replaced `scripts/dev/project-consistency.mjs`'s non-portable
   `import.meta.url === \`file://${process.argv[1]}\`` CLI-entrypoint guard with the repository's
   already-established `pathToFileURL(process.argv[1]).href` approach (matching
   `scripts/dev/night-runner.mjs`); added a CLI smoke test that actually executes
   `node scripts/dev/project-consistency.mjs` as a child process and checks its exit code and summary
   output.
2. **Cross-reference whitespace tolerance**: the registered heading-reference check now normalizes
   whitespace before matching a quoted heading, so a quote that wraps across two source lines under
   ordinary Markdown line wrapping is still recognized (no semantic parsing added). Registered the
   currently-live direct quotes of `ADR-0004`'s "Post-Acceptance Dependency B/C/D Disposition" heading
   in `docs/foundation/M0_SCOPE.md`, `docs/contracts/MEMORY_CONTEXT.md`,
   `docs/contracts/REQUIREMENT_SPEC.md`, `docs/examples/MEMORY_CONTEXT_CASES.md`, and
   `docs/examples/REQUIREMENT_CASES.md` (`ROADMAP.md` was already registered) — read-only source/target
   registrations in the checker script; the semantic documents themselves were not edited. Added a test
   with a line-wrapped source quote and an absent target heading, which fails.
3. **DECISIONS_LOG append-only baseline**: re-anchored the append-only check from "vs. immediately
   preceding HEAD" to "vs. the task branch's merge-base with local `main`" (zero-network,
   `git merge-base` + `git show`), comparing entry-by-entry rather than as a single prefix string, so
   that editing/deleting a pre-existing base entry fails, appending a new branch-local entry passes,
   and correcting an entry introduced only on the still-unmerged branch also passes. Normalizes
   CRLF/LF before comparing. Skips with a diagnostic (never a silent pass) when no safe git baseline
   can be established. Added focused tests for all of these boundaries using a real throwaway git
   fixture repo.
4. **PR-state drift**: PR #29 is open — fixed this file's and `.project/REVIEW_STATE.md`'s stale "not
   yet opened" assertions. Added standing guidance in `docs/development/AGENT_POLICY.md`'s Operational
   State Scope ("Live PR state is GitHub-owned, not mirrored") so a future task records stable facts
   (`PR expected`, target branch, PR number once known) instead of a live open/closed/merged snapshot
   that goes false the instant `gh pr create` runs.
5. **PROJECT_STATE owner pointers**: split `.project/PROJECT_STATE.md`'s Current Capability Snapshot's
   Dependency A/B/C/D bullet group, which had named one umbrella owner for several distinct facts, into
   per-fact owner pointers: stage `MemoryContext` consumption authorization → `M0_SCOPE.md`;
   `MemoryContext` source/influence eligibility → `MEMORY_CONTEXT.md`; Dependency D semantics / the
   historical A/B `DECISION_OPTION` exclusion → `REQUIREMENT_SPEC.md` R-24; Dependency C's disposition
   → `REQUIREMENT_SPEC.md` R-23 plus `ADR-0004`'s own disposition section. The status-token list itself
   (DONE/RETIRED) is unchanged. No semantic rule copied into `PROJECT_STATE.md`.

The original task this hardens (`DEVELOPMENT-CONSISTENCY-MODEL-V2`) is recorded in
`.project/REVIEW_STATE.md`'s History — its own description, files, and reviewer detail are not
repeated here.

**Does not change**: M0 product semantics, `IntentSpec`/`RequirementSpec`/`MemoryContext` semantics,
`ADR-0001`–`ADR-0004` decisions/statuses, schemas, contract behavior, MIHVER Brain, runtime
architecture, or Dependency A/B/C/D status. No file under `docs/foundation/**`, `docs/contracts/**`,
`docs/adr/**`, `docs/examples/**`, `schemas/**`, `tests/contracts/**`, or `../mihver-brain/**` was
touched.

## Branch / Base

Branch: `chore/development-consistency-v2` (new branch, created from `main`).
Base: `main` at `0f5dc581a1f550c85db68af5759b45cad2ab6a30` — verified via `git status` (clean),
`git log` (HEAD matched exactly before branching), `npm run context` (no active task), `npm test`
(85/85) before any edit.

## Status

**Complete, pending human review.**

Read fresh before editing: `CLAUDE.md`, `AGENT_POLICY.md`, `REVIEW_PROTOCOL.md`, `TASK_TEMPLATE.md`,
`.project/PROJECT_STATE.md`, `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`,
`scripts/dev/project-consistency.mjs`, `tests/dev/project-consistency.test.mjs`,
`scripts/dev/night-runner.mjs` (portability pattern source). Verified branch/PR state live:
`git status` clean at task start, `git log`/`git merge-base` confirmed base `main` at `0f5dc58`,
`gh pr view 29` confirmed PR #29 `OPEN`. Semantic contracts (`M0_SCOPE.md`, `MEMORY_CONTEXT.md`,
`REQUIREMENT_SPEC.md`, `docs/examples/*_CASES.md`, `ADR-0004`) were grepped read-only to confirm the
exact live cross-reference wording to register in the checker — none were edited.

**Files changed this round**: `scripts/dev/project-consistency.mjs`, `tests/dev/project-consistency.test.mjs`
(both Primary); `docs/development/AGENT_POLICY.md`, `.project/PROJECT_STATE.md`,
`.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md` (Conditional Consistency, each edit
synchronization-only — see "Allowed Scope" below for the specific reason per file).
`docs/development/REVIEW_PROTOCOL.md`, `docs/development/TASK_TEMPLATE.md`, and `ROADMAP.md` were
read and found not to need any change (no live PR-state assertion, no owner-pointer claim, no
checker-registry reference in any of them). No `docs/foundation/**`, `docs/contracts/**`,
`docs/adr/**`, `docs/examples/**`, `schemas/**`, or `tests/contracts/**` file was touched — the new
`HEADING_REFERENCES` registry entries only *read* five semantic documents to confirm their live
quoted text, per the task's explicit "read-only target/source registrations" instruction.

**Two independent read-only Codex reviewers**, one per axis (see `REVIEW_STATE.md`'s "Latest Review"
for full detail):
- Reviewer A (deterministic checker / portability): 1 confirmed blocking finding — a
  `splitEntryBlocks` boundary bug where only the entries region's absolute-last block had its
  trailing blank line trimmed, so a blank-line-separated append corrupted the *preceding*, frozen
  entry's block and produced a false append-only failure. Fixed: trailing blank lines are now
  trimmed per-block, not once at the region's end. Two regression tests added (blank-line-separated
  append; insertion between two frozen entries). Re-verified independently by Claude by hand-tracing
  the fixed function against both scenarios, not merely by re-running the reviewer.
- Reviewer B (Owner-Mirror / workflow self-consistency): 2 confirmed blocking findings — this file's
  "Next Gate" still instructed opening a PR that already existed, and this file's own record (Status/
  Files changed/Allowed Scope/Next Gate) still described the prior, already-merged-into-history task
  rather than this hardening round — both because those sections had not yet been rewritten for this
  round when the reviewer ran. Fixed by this rewrite. Reviewer B independently confirmed the
  PR-state standing-guidance wording, the owner-pointer split, and the file-scope compliance all
  check out.

**Validation**: `npm test` — 85/85 (unaffected; no contract/schema/fixture file touched).
`npm run check:project-consistency` — 7/7 checks PASS. `npm run test:project-consistency` — 17/17 test
groups PASS (7 pre-existing plus 10 new: a CLI smoke test; a line-wrapped-quote-with-missing-target
test; and 8 append-only-baseline fixture tests covering append, edit-fails, delete-fails,
branch-local correction, CRLF normalization, blank-line-separated append, mid-region insertion-fails,
and no-local-main SKIP). `git diff --check` — clean. `git diff main --stat` —
confirmed no `docs/foundation/**`, `docs/contracts/**`, `docs/adr/**`, `docs/examples/**`,
`schemas/**`, `tests/contracts/**`, or `../mihver-brain/**` file touched.

## Allowed Scope

**Primary**: `scripts/dev/project-consistency.mjs`, `tests/dev/project-consistency.test.mjs`.

**Conditional Consistency** (touched; each edit synchronization-only):
- `docs/development/AGENT_POLICY.md` — added a standing-guidance paragraph to "Operational State
  Scope" so `CURRENT_TASK.md`/`REVIEW_STATE.md` stop mirroring volatile PR open/closed/merged state,
  addressing the confirmed PR-state-drift gap at its root rather than only this instance of it.
- `.project/PROJECT_STATE.md` — split the Current Capability Snapshot's single umbrella owner for
  Dependency A/B/C/D into the four fact-specific owners the task named; no status token or semantic
  rule changed.
- `.project/CURRENT_TASK.md` / `.project/REVIEW_STATE.md` — this round's own task/review record,
  including fixing the stale "PR not yet opened" assertions PR #29's actual `OPEN` state made false.

**Forbidden, confirmed untouched**: `docs/foundation/**`, `docs/contracts/**`, `docs/adr/**`,
`docs/examples/**`, `schemas/**`, `tests/contracts/**`, `ROADMAP.md`, `../mihver-brain/**`.

## Required Context

See "Status" above for the required-reading list.

## Validation

See "Status" above.

## Next Gate

PR expected: yes — PR #29 already exists (`https://github.com/mihvernetwork/mihver/pull/29`), target
`main`. This round's commits are pushed to that same existing PR; no new PR is opened. Live PR
identity/state: verify from GitHub. Do not merge. Human review of PR #29 is the next gate.
