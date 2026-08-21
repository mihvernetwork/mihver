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

Task: M0-ADR-0004-MEMORY-CONTEXT-AUTHORITY
Branch: `m0/adr-0004-memory-context-authority`

Semantic/architectural design task: integrate MIHVER Brain / durable memory into Mihver Architect
without violating `ADR-0001`/`ADR-0002`/`ADR-0003`. Full design detail (Phases 0–11: memory
retrieval, authority map, threat model, integration-model comparison, authority model, historical-
user-memory rule, current-input precedence, procedural/semantic split, evidence boundary,
reproducibility model, 20-case corpus, foundation impact) is recorded in `ADR-0004`,
`MEMORY_CONTEXT.md`, and `MEMORY_CONTEXT_CASES.md` themselves — not duplicated here. This entry
records the Phase 12 review round and its outcome.

### Phase 12 — Four independent read-only Codex reviewers, dispatched by interaction axis

A (memory × epistemic provenance), B (memory × stage isolation), C (memory × evidence/architecture),
D (cross-axis adversarial, building a contradiction matrix across `ADR-0004`, `MEMORY_CONTEXT.md`,
all 20 cases, `ADR-0002`, `ADR-0003`, `PRINCIPLES.md`, `M0_SCOPE.md`). All four found real,
independently-verified defects; Claude independently verified every material finding against the
actual frozen text before acting on it — not accepted by reviewer majority vote.

**Most significant finding (Reviewer A, corroborated by Reviewer D's Contradiction #1):** an earlier
draft of `ADR-0004` mis-cited `INTENT_SPEC.md`'s Inference Policy and classified the dependency
("may a `MemoryContext` entry serve as an Inference's premise?") as `CLARIFICATION_ONLY`. On
independent re-verification against the actual frozen Provenance section — which requires every
emitted Claim's chain to point back through `IntentSpec` to *the* `UserIdea` it came from — this did
not hold up: a `MemoryContext` entry is not a Claim and traces to a *different* `UserIdea`, from a
different run. Reclassified as **`SEMANTIC_AMENDMENT_REQUIRED`**, and, on checking the parallel case,
found to apply identically to `REQUIREMENT_SPEC.md`'s Requirement-Level Inference mechanism
(R-10/R-22). Both are now correctly named as required future amendments, distinct from and additional
to the already-expected `M0_SCOPE.md` stage-input-declaration amendment.

**Other confirmed findings, all fixed:**

- (Reviewer A) A real Inferred/Assumed blurring risk: a memory-derived LOW/MEDIUM "default" was
  ambiguously described in a way that could be read as eligible for Assumed origin at Intent Parsing
  — categorically forbidden by Assumption Policy for operational defaults. Closed with an explicit
  "No Assumed-Origin Path for Memory" section in `MEMORY_CONTEXT.md`, and a stage-specific rewrite
  distinguishing Intent Parsing's Inferred-only path from Requirement Derivation's separate,
  already-existing R-19 default mechanism.
- (Reviewer A, Reviewer D's Contradiction #4) A cross-project loophole in Case 3: an earlier draft
  let content-inspection judge a Project-A-scoped record "genuinely project-agnostic" and admit it
  into Project B — silently overriding a recorded, specific scope, a materially weaker boundary than
  the design's own rule for `global`-scoped records. Fixed: a project-scoped record is now excluded
  from a different project's `MemoryContext` on scope alone, unconditionally, with no
  content-inspection override path.
- (Reviewer A) M-07's invariant text said repetition never increases "authority or standing" but
  omitted "confidence" specifically, even though the design's own axis-independence principle (and
  I-16 itself) requires it named explicitly. Fixed.
- (Reviewer B, Reviewer D's Contradiction #9) Several "Always allowed"/"freely" phrases, read
  literally, contradicted the hard "no stage may consume `MemoryContext` at all" rule. Fixed
  throughout (including the two Evidence-boundary table rows), plus a strengthened corpus-wide
  preamble in `MEMORY_CONTEXT_CASES.md` closing the gap across all 20 cases at once rather than
  patching each individually.
- (Reviewer B) Phase 11's stage list under-counted: only Intent Parsing and Research Planning were
  named as plausible `M0_SCOPE.md`-amendment candidates, but the cases themselves (7, 8, 20) describe
  Architecture Synthesis making comparable use — corrected to name it as a third stage requiring its
  own amendment, and the list explicitly reframed as illustrative, not exhaustive.
- (Reviewer B) A reproducibility gap: a bare hash/pointer into Brain's mutable vault cannot
  reconstruct content Brain later edits or supersedes out from under it. Fixed: production must
  retain an actual content copy, not merely an identity reference.
- (Reviewer C) Principle 5's five required properties (source, **version**, date, confidence,
  freshness) had been understated as four in M-12 and the Evidence-boundary table/cases — version
  omitted throughout. Fixed in the invariant, the table, and Cases 9/10.
- (Reviewer C) A subtle risk: "procedural" search-strategy influence could functionally exclude
  candidates from ever being generated, without ever formally "excluding" any — disguising a semantic
  effect as a procedural one. Closed with an explicit additive-never-substitutive constraint on all
  procedural search-strategy influence, in both `ADR-0004` and `MEMORY_CONTEXT.md`.
- (Reviewer D's Contradictions #6/#7) The frozen-`MemoryContext`-snapshot model directly conflicted
  with also requiring two facts only knowable after production — "did this actually influence
  output" and "was this later found stale by contradiction." Resolved by splitting the Reproducibility
  section and M-09/M-14 into two explicit categories: facts fixed at production time (in the frozen
  snapshot) versus facts recorded in the *consuming artifact's own* provenance once known — never by
  mutating the already-frozen snapshot.
- (Reviewer D's cross-document authority conflict) Case 16 offered Requirement Derivation's R-19
  default mechanism as an alternative path for a historically-preferred reporting *cadence* — but
  which cadence the user prefers is a want-level question, exactly what R-19 excludes
  (`ADR-0003`'s own authority boundary), not a measurement/implementation detail of an
  already-settled requirement. The R-19 alternative was removed from Case 16 entirely.
- (Reviewer D's Contradiction #8) A terminology slip in Case 14 conflated "authority" (the strict
  technical axis `MemoryContext` explicitly disclaims having) with a `project` record's ordinary role
  as an identity anchor. Reworded to avoid the word "authority" for this narrower, structural role.
- (Reviewer C's Finding C-3, Reviewer D adjacent) Case 20 incorrectly implied Architecture Synthesis
  could reason from `EvidenceBundle` directly — it cannot; that is Technology Candidate
  Identification's and Evaluation's declared input, not Synthesis's (`M0_SCOPE.md`). Corrected to
  attribute the Evidence-grounded conclusion to the stages that actually own it.
- (Reviewer D) Case 17 allowed a narrow "inference from absence" ("no memory exists, so no prior
  preference") under stated conditions — on independent review this does not hold even narrowly: an
  empty retrieval only establishes that *this query* found nothing, never that the topic was never
  discussed. Fixed to disallow any inference from absence, full stop.
- (Reviewer B) Added an Open Question naming the specific gap that Research Planning makes several
  distinct decisions (per `M0_SCOPE.md`) and this design does not yet specify which, if any, memory
  may influence — deferred explicitly to the future `M0_SCOPE.md` amendment task, not resolved here.

`npm test`: 32/32 throughout (unaffected — no contract/schema/runtime file touched). `git diff main
--stat`: exactly the three new allowed files; no foundation document modified.

**Final recommendation: `FOUNDATION_AMENDMENT_REQUIRED`** — not `REDESIGN_REQUIRED` (no reviewer,
across any axis, found Model C's fundamental approach unsound; every confirmed defect was a scoping,
wording, or cross-reference error corrected without changing the selected model); not
`READY_FOR_HUMAN_REVIEW` either: this design's own corrected analysis established that citing a
`MemoryContext` entry as an Inference's premise requires genuine `SEMANTIC_AMENDMENT_REQUIRED`
changes to **both** `INTENT_SPEC.md` and `REQUIREMENT_SPEC.md`, not merely the already-expected
`M0_SCOPE.md` stage-input amendment. Recording this honestly, rather than as `READY_FOR_HUMAN_REVIEW`,
is the correct application of this task's own Phase 11 instruction.

## Required Changes

None remaining — every confirmed finding from all four reviewers was fixed and re-verified against
the edited text (`npm test`: 32/32 throughout).

## Fixes Applied

See "Phase 12" above for the full list; applied to `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-
BOUNDARY.md`, `docs/contracts/MEMORY_CONTEXT.md`, and `docs/examples/MEMORY_CONTEXT_CASES.md` — no
frozen foundation document touched.

## Pending Human Gate

A PR to `mihvernetwork/mihver:main` (from the `devSerdar` fork), title `M0: define memory context
authority boundary`, is to be opened per this task's explicit instruction. Not to be merged by this
task. `ADR-0004` remains Proposed — the `M0_SCOPE.md`/`INTENT_SPEC.md`/`REQUIREMENT_SPEC.md`
amendments this design identifies as required are each their own separate, future, explicitly
human-authorized task. Human review of the PR is the next gate.

## History

- 2026-08-21 — `PROJECT-STATE-RECONCILE-POST-STEP-03A` (PR #14): reconciled `.project/PROJECT_STATE.md`
  and `.project/DECISIONS_LOG.md` with actual `main` after M0 Step 03A (PR #13, `fe79098`) merged.
  Verified against live git/`gh` state, not stale `.project` prose: `ADR-0002`'s recorded status
  ("Proposed") was stale (it is Accepted); three merged checkpoints (Night Runner PR #7/#8, `ADR-0002`
  Acceptance PR #10/#11/#12, M0 Step 03A PR #13) were missing from "Frozen Steps / Checkpoints";
  `DECISIONS_LOG.md` had four "approved, not yet merged" entries (PR #4/#5/#6/#7) that are actually
  merged, plus two merges (PR #8, PR #13) with no entry at all — all fixed by appending verified-only
  facts, zero existing entries edited or removed. Drift analysis: both files are interpretive
  summaries of live truth, never authoritative themselves; the actual gap was that no task was ever
  scoped to reconcile state immediately after each of those merges (process), and no automated check
  cross-references `PROJECT_STATE.md`/`DECISIONS_LOG.md` claims against ADR `## Status` fields or
  `gh pr list --state merged` (validation) — proposed future invariant: extend
  `scripts/dev/project-context.mjs`'s existing drift-detection pattern to check both. One independent
  Codex reviewer (state authority / historical integrity) found two issues, both fixed: a premature
  cross-reference in `CURRENT_TASK.md`, and a `DECISIONS_LOG.md` entry asserting a claim not
  verifiable from git/GitHub the way its own preamble promised. `npm test`: 32/32. Verdict:
  `READY_FOR_HUMAN_REVIEW`. Moved here from "Latest Review" now that those sections describe
  `M0-ADR-0004-MEMORY-CONTEXT-AUTHORITY` instead, per this file's branch/task scoping. — branch
  `chore/project-state-reconcile-post-step-03a`

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
