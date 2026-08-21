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

Task: PROJECT-STATE-RECONCILE-POST-STEP-03A
Branch: `chore/project-state-reconcile-post-step-03a`

### Phase 1–2 summary

M0 Step 03A (PR #13) squash-merged to `main` at `fe79098` — confirmed exactly matching this task's
stated expectation via `git log`, `git rev-parse HEAD`, and `gh pr list --repo mihvernetwork/mihver
--state merged --limit 30 --json number,title,mergeCommit,mergedAt` (all 13 merged PRs enumerated and
cross-checked against `.project/PROJECT_STATE.md`'s claims). `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`
and `docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md` were read directly for their own `## Status`
fields (Accepted / Proposed respectively) rather than trusted from `.project` prose. `PROJECT_STATE.md`
was reconciled: removed the stale "ADR-0002 Status: Proposed" claim (both the M0 Step 02A checkpoint
line and the Open Items entry); added three missing frozen checkpoints actually present on `main` —
Night Runner (PR #7 `9a61a0b`, PR #8 `4590f7a`), `ADR-0002` Acceptance (PR #10 `548bb75`, PR #11
`63429c9`, PR #12 `a20d647`), and M0 Step 03A (PR #13 `fe79098`); replaced the resolved ADR-0002 Open
Item with the genuinely-still-open `ADR-0003`-Proposed one; rewrote Next Authorized Action to
explicitly *not* pre-authorize `ADR-0004` or Step 03B. `DECISIONS_LOG.md` was appended (never edited)
with verified-only merge-confirmation entries for PR #4/#5/#6/#7 (previously logged only as "approved,
not yet merged"), PR #8 and PR #13 (no prior entry existed at all), and PR #12 (`ADR-0002` acceptance
merge) — every PR number, commit SHA, and merge date cross-checked against the `gh pr list` output
above before being recorded.

### Phase 3 — Drift analysis

1. **Which facts became stale?** `PROJECT_STATE.md`'s claim that `ADR-0002` Status is "Proposed"
   (stale the moment PR #12 merged, `a20d647`); `PROJECT_STATE.md`'s "Frozen Steps / Checkpoints" list
   (incomplete the moment PR #7/#8/#13 merged without a corresponding state-update task ever running);
   `DECISIONS_LOG.md`'s "the merge has not been performed... requires a separate, later explicit
   instruction" claims for PR #4/#5/#6/#7 (stale the moment those merges actually happened, since no
   follow-up entry was ever appended); `DECISIONS_LOG.md`'s complete silence on PR #8 and PR #13's
   merges (not staleness exactly — an outright gap, since no entry was ever created to go stale).
2. **Which file was supposed to be authoritative for each?** None of `.project/*.md` is actually
   authoritative for any of these facts — `PROJECT_STATE.md` and `DECISIONS_LOG.md` are both
   explicitly *interpretive summaries* of live truth (per `PROJECT_STATE.md`'s own header: "If the two
   disagree, trust the live git/gh output and update this file — do not trust this file over
   reality"). The actual authoritative sources are: each ADR's own `## Status` field for ADR status;
   `git log` / `gh pr list --state merged` for merge state. `.project/*.md` files are meant to be
   *derived* from those sources at reconciliation time, not maintained as a live mirror automatically.
3. **Was the problem human process, missing validation, or both?** Both, weighted toward missing
   validation. Process side: every M0-STEP-03A-* task's own "Allowed Scope" deliberately excluded
   `PROJECT_STATE.md`/`DECISIONS_LOG.md` (correct scope discipline for those narrow tasks), and the
   actual merges of PR #4–#8, #12, #13 all happened outside any task that was itself scoped to update
   durable state afterward — i.e. no task was ever issued specifically to reconcile state immediately
   after each of those merges; this reconciliation task is that missing step, arriving late.
   Validation side: no automated check exists (in `npm run context`, `npm test`, or CI) that
   cross-references `PROJECT_STATE.md`'s status claims against the ADRs' own `## Status` fields or
   against `gh pr list --state merged` — so this class of drift is invisible until someone manually
   diffs prose against reality, which is exactly what this task just did.
4. **What deterministic invariant could catch this class of drift later?** The task's own suggested
   wording ("PROJECT_STATE assertions about accepted ADR status and frozen checkpoints must not
   contradict authoritative repository artifacts") is directionally right but under-specifies *how* —
   and misses the parallel `DECISIONS_LOG.md` failure mode (a PR logged as "merge not yet performed"
   that GitHub now shows as merged). A more actionable, repo-structure-grounded version: **extend
   `scripts/dev/project-context.mjs`'s existing pattern** (it already flags exactly this class of
   drift for `CURRENT_TASK.md`'s declared branch — see its `WARNING:` output) **to (a) parse every
   `docs/adr/ADR-*.md`'s own `## Status` field and flag any `PROJECT_STATE.md` prose that names that
   ADR with a different status, and (b) flag any `DECISIONS_LOG.md` entry containing "has not been
   performed" / "not yet merged" whose cited PR number appears in a fresh `gh pr list --state merged`
   call.** This is proposed only, per this task's explicit instruction — not implemented here.

### Phase 4 — Validation and review

`npm test`: 32/32 (unaffected — no contract/schema file touched). `git diff --check`: clean. `git diff
main --stat` (after this phase's fixes below): four `.project/*.md` files changed, nothing else.

One independent read-only Codex reviewer (state authority / historical integrity) was dispatched.
Findings, each independently re-verified by Claude:

- **Confirmed and fixed:** `CURRENT_TASK.md` claimed Phase 3/4 content "are recorded in
  `.project/REVIEW_STATE.md`'s 'Latest Review'" at a point when this file hadn't been updated yet —
  true at time of review, resolved by this very update. Also confirmed and fixed: `CURRENT_TASK.md`
  claimed `git diff main --stat` showed "the four allowed `.project` files changed" when at review
  time only three had — resolved now that this file is also updated, making the count literally
  accurate.
- **Confirmed and fixed:** the newly-appended `DECISIONS_LOG.md` entry for PR #13 asserted "every
  `M0-STEP-03A-*` task instruction in this session's own record explicitly said 'do not merge'" — the
  reviewer correctly noted this is not verifiable from `git log`/`gh pr list` the way the entry's own
  preamble promised ("verified directly against `git log` and `gh pr list`... none is inferred").
  Removed the claim; the entry now states only the merge fact and that the authorization decision
  itself is not independently verifiable from git/GitHub, without asserting what it can't source from
  those tools.
- **Verified clean, with Claude independently closing a gap the reviewer's own sandbox couldn't:** the
  reviewer's sandbox could not reach `api.github.com` (network blocked, escalation rejected), so it
  could not independently confirm PR-number-to-commit mappings against live GitHub — it verified SHAs
  and dates against local `git log` only. Claude had already run `gh pr list --state merged` directly
  in Phase 1 (full JSON output captured) and re-cross-checked every PR-number/SHA pair used in
  `PROJECT_STATE.md` and `DECISIONS_LOG.md` against that output line by line: all 13 mappings (PR
  #1–#13) match exactly.
- **Verified clean (reviewer's own independent check, re-confirmed by Claude):** `git diff main --
  .project/DECISIONS_LOG.md` shows only added lines — zero deletions, zero modifications to any
  pre-existing entry. Append-only integrity intact.
- **Verified clean:** `CURRENT_TASK.md` correctly declares `Branch: chore/project-state-reconcile-post-step-03a`
  and stays scoped to this specific task; no durable global fact was smuggled into it that belongs in
  `PROJECT_STATE.md` instead.
- **Verified clean:** `PROJECT_STATE.md`'s "Next Authorized Action" explicitly excludes advancing
  `ADR-0003`, beginning M0 Step 03B, and starting `ADR-0004` or any new ADR — no future work was
  silently authorized.
- **Verified clean:** `git diff main --stat` / `git diff --name-status main` show only `.project/*.md`
  files changed — nothing under `docs/contracts/`, `docs/adr/`, `schemas/`, `tests/`, or runtime
  tooling.

`npm test`: 32/32 throughout.

**Final recommendation: `READY_FOR_HUMAN_REVIEW`.** No new architecture decision was introduced;
`ADR-0004` was not started; every confirmed reviewer finding was fixed and re-verified against the
edited text before this recommendation was reached.

## Required Changes

None remaining — the reviewer's confirmed findings (CURRENT_TASK.md's premature "recorded in
REVIEW_STATE.md" / file-count claims, and DECISIONS_LOG.md's non-git/gh-verifiable sourcing claim)
were fixed and re-verified (`npm test`: 32/32 throughout; `git diff main -- .project/DECISIONS_LOG.md`
re-confirmed zero deletions after the fix).

## Fixes Applied

See "Phase 4 — Validation and review" above for the full list; applied to `.project/CURRENT_TASK.md`
and `.project/DECISIONS_LOG.md` (append-only edit to this task's own just-added entry, not to any
pre-existing entry).

## Pending Human Gate

A PR to `mihvernetwork/mihver:main` (from the `devSerdar` fork), title `chore: reconcile durable
project state after Step 03A`, is to be opened per this task's explicit instruction. Not to be merged
by this task — human review of the PR is the next gate.

## History

- 2026-08-21 — `M0-STEP-03A-FINAL-CROSS-REFERENCE-CLEANUP` (PR #13, sixth pass, no reviewers per its
  own instructions): a final independent verification found Case 7b's Eligibility citing "Case 2's
  Completeness" when Case 2 is explicitly Partial (from the fifth round) — replaced with Case 8, a
  genuinely equivalent Complete example. A deterministic sweep of every "Case X's
  Complete/Completeness/Partial" reference in `REQUIREMENT_CASES.md` then found two more instances of
  the same staleness under broader phrasing (Case 16 → Case 1, Case 15 → Case 1/9, both citing a
  pre-fix "testable now" framing the fifth round had already corrected) — fixed. Every remaining
  cross-reference checked against its target case's own current Eligibility and found accurate.
  `npm test`: 32/32. Verdict: CLEAN. PR #13 was subsequently merged to `main` (squash commit `fe79098`)
  — that merge event is recorded in `.project/DECISIONS_LOG.md`, not here. Moved here from "Latest
  Review" now that those sections describe `PROJECT-STATE-RECONCILE-POST-STEP-03A` instead, per this
  file's branch/task scoping — this is the first entry on a new branch, since the prior five rounds all
  shared `m0/step-03a-requirement-contract`. — branch `m0/step-03a-requirement-contract`

- 2026-08-21 — `M0-STEP-03A-FINAL-INTRINSIC-CONSISTENCY-FIX` (PR #13, fourth review round): fixed
  three issues an external final review found in head prior to `3866304`: (1) "What Qualifies as a
  Requirement" contradicted R-20 by implying unresolved-force binding content could already become a
  Requirement — rewritten to an explicit three-way split; (2) R-21 defined Complete/Partial via
  future-candidate-population phrases ("overwhelming majority of candidates") instead of the artifact's
  own semantics — rebuilt around a SATISFIED/NOT_SATISFIED/INDETERMINATE model, Case 4 re-derived
  rather than preserved by default; (3) "User-Selected Technology" let resolving a named technology's
  negotiability drift into revising its strength — fixed to keep force/strength and
  negotiability/exclusivity independent. Three reviewers (A: eligibility × force/R-20; B: completeness
  intrinsicness × Case 4/R-21; C: force × negotiability × cross-document consistency) then found
  further residual instances of the same three bugs in Claude's own same-task fixes: a second R-20
  contradiction in the Information-Loss Rules bullet (A); R-21 was gameable — nothing required the
  procedure to be faithful, so a trivial "always INDETERMINATE" procedure technically satisfied it,
  closed with a faithfulness/maximal-determinacy requirement (B); a strict-vs-inclusive threshold bug
  in Case 4's worked procedure, "under $100" needs `<` not `≤` (B); four more stale population phrases
  in Cases 7b/8/11 (B); three more force/negotiability conflations in R-19's terminology note, inside
  "User-Selected Technology" itself, ADR-0003's Decision item 3, and Case 15 (C). `npm test`: 32/32.
  Moved here from "Latest Review" now that those sections describe
  `M0-STEP-03A-RESIDUAL-CROSS-CONTRACT-FIX` instead, per this file's branch/task scoping (all entries
  for this branch share PR #13, since each was a continuation, not a new branch). — branch
  `m0/step-03a-requirement-contract`

- 2026-08-21 — `M0-STEP-03A-BRAIN-ASSISTED-FINAL-AUDIT` (PR #13, third review round): before this
  round, queried MIHVER Brain (`../mihver-brain`) for review-planning lessons and applied two
  `mihver`-scope memories (decompose review by invariant axis; cross-axis interactions need explicit
  review contracts) — concretely, added a six-named-axis coverage checklist and applied
  pairwise-interaction scrutiny to Claude's own re-derivation, not only to reviewer briefs. Four
  independent read-only Codex reviewers by invariant interaction (A: normative × epistemic; B:
  resolution authority × lifecycle; C: testability × completeness, auditing all 17 cases; D:
  cross-document contradiction matrix). Confirmed and fixed: Requirement-Level Inference had no
  strength/provisionality rule analogous to R-03/R-04 — closed with new R-22; Case 8 was an unfilled
  placeholder that couldn't ground its own Complete/strength claims — rewritten concretely; Case 7a and
  Case 11's positive clause had zero metric/comparator, the same defect class Case 16's "fast" fix
  addressed but two more instances survived — both reclassified Partial for that clause; R-21 had a
  genuine wording tension between its no-invented-scope test and its boundary-refinement carve-out —
  sharpened into a two-situation test (later found in the very next round to still be gameable, and
  further tightened there — see "Latest Review" above); five smaller cross-document clarity fixes
  (stray "ambiguity" wording, ADR force-map summary, Partial-revision-path over-narrowing, "usable now"
  phrasing, an ADR Open Question). One reviewer disagreement (Case 4's cost-category Unknown
  fillability, now argued by three reviewers across two rounds) resolved a second time by
  re-derivation, not majority vote — kept Complete/fillable; the sharpened rule that resolved it also
  caught the Case 7a/11 defects, evidence it was correctly drawn. `npm test`: 32/32. Moved here from
  "Latest Review" now that those sections describe `M0-STEP-03A-FINAL-INTRINSIC-CONSISTENCY-FIX`
  instead, per this file's branch/task scoping (all entries for this branch share PR #13, since each
  was a continuation, not a new branch). — branch `m0/step-03a-requirement-contract`

- 2026-08-21 — `M0-STEP-03A-CROSS-AXIS-REMEDIATION` (PR #13, second review round): four independent
  read-only Codex reviewers by invariant axis (A: normative vs. epistemic; B: resolution authority; C:
  completeness/testability; D: cross-document contradiction). Confirmed and fixed: a residual
  strength-weakening sentence left over from the axis-independence fix (found independently by A, D);
  the Case 7b force/result mismatch (A, D); an ADR-0003 overclaim that confidence is mandatory on every
  Requirement (A, D); an overbroad R-20 scope contradicting Cases 6/17 (D); a Case 17 Failed-definition
  contradiction with R-17 (C, D); Case 16's Unknown reclassified to Ambiguity (B); a miscited R-01 in
  an Anti-Example (D); R-19 tightened with a terminology note reconciling it against
  `INTENT_SPEC.md`'s broader phrase (B); R-21 tightened to an oracle-based test (C); R-09 subordinated
  to R-19. One reviewer disagreement (Case 4's cost-category Unknown fillability, argued by Reviewer B)
  resolved by Claude's independent re-derivation, not majority vote — kept Complete/fillable, text
  strengthened to engage the counterexample directly. A final read-through caught one more
  cross-reference bug no reviewer flagged. `npm test`: 32/32. Moved here from "Latest Review" now that
  those sections describe `M0-STEP-03A-BRAIN-ASSISTED-FINAL-AUDIT` instead, per this file's branch/task
  scoping (all three entries for this branch share PR #13, since each was a continuation, not a new
  branch). — branch `m0/step-03a-requirement-contract`

- 2026-08-21 — `M0-STEP-03A-REQUIREMENT-SPEC-SEMANTIC-CONTRACT` (PR #13, first draft pass): three
  independent read-only Codex reviewers (A: provenance/epistemic boundary; B: requirement
  semantics — force mapping, conditions, leakage; C: lifecycle/handoff — eligibility,
  Complete/Partial/Failed, versioning), each reviewing the first draft of `REQUIREMENT_SPEC.md`,
  `ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`, and `REQUIREMENT_CASES.md` (17 cases) against the
  already-Accepted `INTENT_SPEC.md`/`ADR-0002` model. All three found real, independently-verified
  defects; several were found by two or three reviewers independently. Confirmed and fixed:
  force-inflation bugs in three cases (Case 10/11/15, preference silently mapped to SHALL/MUST);
  a condition-strengthening bug ("only if" compiled to "if and only if") in both the main contract
  and Case 9; a self-contradiction in the Complete/Partial/Failed model (Failed's example identical
  to Complete-with-zero-Requirements'); an overclaim about downstream Partial-consumption
  authorization contradicting the ADR's own Open Questions; an interpretive-leap bug in Case 12 and
  an invalid Decision-Impact-level bug in Case 13 (both replaced with cleaner scenarios); plus
  smaller fixes (a dangling cross-reference, a missing provenance section, ambiguous invalidation
  wording, an unbounded inference-boundary concept given an operational test, a near-circular
  re-derivation trigger enumerated). `npm test`: 32/32. Moved here from "Latest Review" now that
  those sections describe `M0-STEP-03A-CROSS-AXIS-REMEDIATION` instead, per this file's branch/task
  scoping (both entries share branch `m0/step-03a-requirement-contract` and PR #13, since this was a
  continuation, not a new branch). — branch `m0/step-03a-requirement-contract`

- 2026-08-21 — `ADR-0002-ACCEPTANCE` (PR #12, merged `a20d647`): one independent read-only Codex
  reviewer verified the `ADR-0002` Status transition (Proposed → Accepted). Overall verdict
  **CLEAN AND READY** on all three checks: the transition was justified by verifiable evidence
  (`docs/reviews/ADR-0002-ADVERSARIAL-REVIEW.md` and `.../ADR-0002-ADVERSARIAL-REMEDIATION.md`
  exist, reach real conclusions, and their commits `548bb75`/`63429c9` are ancestors of `main`;
  `npm test` independently re-run at 32/32); no substantive semantic/model change slipped into the
  "acceptance housekeeping" patch (`git diff main --stat` showed only the ADR file and
  `.project/DECISIONS_LOG.md` changed); Future Work accurately separated completed gates from
  remaining work. One reviewer caveat (PR #10/#11 number mapping unconfirmable from local git
  alone) was independently resolved by Claude via `gh pr view`. Moved here from "Latest Review" now
  that those sections describe `M0-STEP-03A-REQUIREMENT-SPEC-SEMANTIC-CONTRACT` instead, per this
  file's branch/task scoping. — branch `docs/adr-0002-acceptance`

- 2026-08-19/2026-08-20 — `NIGHT-RUNNER-FRESH-CLAUDE-EXECUTOR` (PR #8): three independent read-only
  Codex review passes plus one live supervised smoke test against the real `claude` CLI. Pass 1
  (on V1) verdict **REDESIGN** — a caller-supplied `cwd` did not actually sandbox the child
  process (parent-directory/symlink bypass, pre-spawn-only STOP check, inconsistent CLI flags);
  accepted and redesigned (executor-owned `mkdtemp` workspace, bidirectional `realpath`
  containment, discovered-flag capability restriction, STOP polling with whole-process-tree
  termination, expanded tests). A Windows CLI-resolution `ENOENT` bug (found by Claude directly,
  not a review pass) was fixed via `where`/`which` resolution, deliberately avoiding `shell:true`
  (Node `DEP0190` injection risk). Pass 2 verdict **APPROVE WITH REQUIRED CHANGES** — bypassable
  capability denylist and an unbounded resolver lookup, both fixed (denylist → positive allowlist;
  timeout added). Pass 3 verdict **APPROVED**, no required changes remaining. Live smoke test
  against the real CLI confirmed the allowed write succeeded and the forbidden write was denied
  and absent. Human approved PR #8 for merge ("PR #8 / NIGHT-RUNNER-FRESH-CLAUDE-EXECUTOR is
  APPROVED for merge"), recorded via a Gate Recording Commit; merge execution itself had not been
  performed as of this entry and required a separate, later explicit instruction. Moved here from
  "Latest Review" now that those sections describe `ADR-0002-ACCEPTANCE` instead, per this file's
  branch/task scoping. — branch `feat/night-runner-fresh-claude-executor`

- 2026-08-19/2026-08-20 — `NIGHT-RUNNER-FOUNDATION-FINAL` (correction pass on
  `chore/night-runner-foundation`, before PR #7 received human review): one independent read-only
  Codex reviewer, focused specifically on runtime-budget semantics and state consistency:
  hand-traced the corrected per-attempt runtime charging
  (`min(estimated_runtime_seconds, per_task_timeout_seconds)`, checked before every attempt
  including retries) against both new runtime-budget fixtures line-by-line, confirmed the
  `max_tasks` integer-validation fixture and code, confirmed `NIGHT_RUNNER.md` has no remaining
  stale "charge the full estimate once" description, and audited `.project/CURRENT_TASK.md` /
  `.project/REVIEW_STATE.md` for any remaining live/prospective PR-state language. Verdict
  **APPROVE WITH REQUIRED CHANGES** — no algorithmic, determinism, or documentation defect found;
  all required changes were state-metadata language quoted verbatim from `CURRENT_TASK.md`'s
  "Next Gate" and `REVIEW_STATE.md`'s then-current "Merge Decision" / "Pending Human Gate"
  sections (PR number, "opened", a `gh pr view 7` suggestion), plus one additional pre-existing
  History entry (the PR #4 entry's "remains a separate, later action not yet taken" clause) that
  the reviewer identified as the same category of live-state claim. Claude's final outcome:
  **APPROVED** (after rewriting all flagged sections to state only that a PR is
  expected/authorized and that human review/merge approval is a pending gate, with no PR number,
  status, or GitHub-query pointer recorded). All four required changes applied to
  `.project/CURRENT_TASK.md` and `.project/REVIEW_STATE.md`; `.project/DECISIONS_LOG.md` was not
  modified, per explicit instruction for this patch. Re-validated: `npm run test:night-runner`
  15/15, `npm test` 24/24, `npm run context` (reported this task active/current for that branch).
  Separately: `NIGHT-RUNNER-FOUNDATION` (PR #7) was human-approved for merge ("PR #7 /
  NIGHT-RUNNER-FOUNDATION is APPROVED for merge"), recorded via a Gate Recording Commit; merge
  execution itself had not been performed as of this entry and required a separate, later explicit
  instruction. Moved here from "Latest Review"/"Merge Decision"/"Pending Human Gate" now that those
  sections describe `NIGHT-RUNNER-FRESH-CLAUDE-EXECUTOR` instead, per this file's branch/task
  scoping. — branch `chore/night-runner-foundation`

- 2026-08-19 — `NIGHT-RUNNER-FOUNDATION` (first pass, PR #7): one independent read-only Codex
  reviewer, focused on requirement coverage against `docs/development/NIGHT_RUNNER.md`,
  determinism, the structural no-execution-capability invariant, algorithm correctness (budget
  consumption, limit-cascade, human-gated blocking, `main`-branch refusal, retry/timeout math),
  fixture coverage, and the Windows "run as script" guard fix. Verdict **APPROVE WITH REQUIRED
  CHANGES** — two documentation-consistency issues in `NIGHT_RUNNER.md` (a stale `--out` flag
  mention with no implementation; an inaccurate claim that a `STOPPED` dependency reaches the
  per-dependency `BLOCKED` check, when the queue-level STOPPED cascade always intercepts it
  first). No material algorithmic, determinism, or execution-capability defect found. Both fixes
  applied; two fixtures added (self-referencing dependency, `max_retries: 0` boundary) closing
  the two cheapest of several named test-coverage gaps. Final outcome **APPROVED**. Separately, a
  real Windows portability bug was found and fixed during Claude's own manual CLI smoke test (the
  "run as script" guard's naive `` file://${process.argv[1]} `` string comparison never matches a
  Windows path); the reviewer confirmed the fix (`pathToFileURL(process.argv[1]).href`). Moved
  here from "Latest Review" now that it describes the correction pass
  (`NIGHT-RUNNER-FOUNDATION-FINAL`) instead, per this file's branch/task scoping. — branch
  `chore/night-runner-foundation`

- 2026-08-19 — `PROJECT-CONTEXT-AUTO-BOOTSTRAP` (PR #6): reviewed by one independent read-only
  Codex reviewer, verdict **APPROVED** (no required changes). Human stated "PR #6 /
  PROJECT-CONTEXT-AUTO-BOOTSTRAP is APPROVED for merge", recorded via a Gate Recording Commit.
  PR #6 was squash-merged to `main` at `3f0b53b`, per explicit human confirmation. Moved here
  from "Latest Review"/"Merge Decision"/"Pending Human Gate" now that those sections describe the
  current task instead, per this file's branch/task scoping. — branch
  `chore/project-context-auto-bootstrap`

- 2026-08-19 — `PROJECT-CONTEXT-REVIEW-SCOPE` (PR #5): human approved for merge, stated directly
  as "PR #5 / PROJECT-CONTEXT-REVIEW-SCOPE is APPROVED for merge", recorded via a Gate Recording
  Commit. PR #5 was subsequently squash-merged to `main` at `fdc27d4` ("chore: scope review state
  to active task") — see `DECISIONS_LOG.md` for the durable record. — branch
  `chore/project-context-review-scope`

- 2026-08-19 — `PROJECT-CONTEXT-FREEZE-STATE` (PR #4): human approved for merge, stated directly
  as "PR #4 / PROJECT-CONTEXT-FREEZE-STATE is APPROVED for merge", recorded via a Gate Recording
  Commit; that commit recorded the approval only and did not itself authorize merge execution —
  see `DECISIONS_LOG.md` for the durable record. — branch `chore/project-context-freeze-state`

- 2026-08-19 — M0 Step 02B (Intent schema) — human decision: **APPROVED**, stated directly in
  conversation (not Claude-inferred). This entry is Claude's contemporaneous record of that
  conversation; it is not independently verifiable from git/GitHub state — the merge commit
  `0683e84` confirms the code landed, not that a human approved it. — merged to `main` at
  `0683e84`.
- 2026-08-19 — Project Context Bootstrap — human review of the branch/mechanism as a whole:
  **APPROVED WITH FINAL OPERATIONAL PATCH REQUIRED**, stated directly by the human, explicitly not
  final merge approval; authorized the `PROJECT-CONTEXT-MERGE-GATE` patch that was applied to
  satisfy it.
- 2026-08-19 — Project Context Bootstrap — human decision: **APPROVED for merge**, stated directly
  ("PROJECT-CONTEXT-BOOTSTRAP is APPROVED for merge"), recorded via a Gate Recording Commit, then
  executed on the human's explicit request for a PR + squash merge (base `main`, compare
  `chore/project-context-bootstrap`). — merged to `main` via PR #3, squash commit `c5d3dc8`.
