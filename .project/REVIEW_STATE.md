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

Task: M0-STEP-03A-CROSS-AXIS-REMEDIATION
Branch: `m0/step-03a-requirement-contract`

Four independent read-only Codex reviewers, dispatched by **invariant axis, not file range** (per
this task's explicit instruction, since prior file-range reviewers had missed cross-cutting issues):
A — normative strength vs. epistemic standing (origin/confidence/provisionality) independence; B —
resolution authority (which surviving Unknowns Requirement Derivation may fill); C —
completeness/testability of the Complete/Partial/Failed model; D — cross-document contradiction
hunting across `REQUIREMENT_SPEC.md`, `ADR-0003`, and `REQUIREMENT_CASES.md`. Each reviewed the full
corpus as revised in this task's first pass (the five externally-reported findings already fixed).
Claude independently verified every material finding directly against the actual text before fixing
(not relayed uncritically), then applied targeted fixes across all three documents.

Confirmed and fixed (verified by Claude against the cited text in each case):

- **Residual strength-weakening sentence**: the "Force → Requirement Strength Mapping" section's own
  intro sentence still said a mapping "may only preserve or (for provisional/lower-confidence Claims)
  weaken strength" — a direct leftover contradicting the axis-independence fix already applied
  elsewhere (R-03, R-04, the "Downgrading is permitted" paragraph). Found independently by Reviewers A
  and D; rewritten to state strength is never weakened by origin/confidence either.
- **Case 7 force/result mismatch**: Case 7b stated "force = obligation" but derived a MUST NOT
  (prohibition-mapped) result — an internal contradiction in the very case built to demonstrate the
  axis-independence fix. Found independently by Reviewers A and D; relabeled force to "prohibition"
  throughout (source semantics, result, prohibited-transformations bullet, closing sentence).
- **ADR-0003 confidence overclaim**: "Origin, force, and confidence are first-class, mandatory,
  independently-inspectable properties of every Requirement" — but confidence is an Inferred-Claim-
  specific property, not universal. Found independently by Reviewers A and D; corrected to scope
  confidence to Inference-derived Requirements and mention provisional/reversible standing "wherever
  applicable."
- **R-20 overbroad scope**: as originally worded, R-20 also literally captured genuinely force-absent
  descriptive Claims (already correctly handled by R-02/R-17), contradicting Cases 6 and 17. Found by
  Reviewer D; fixed with an explicit carve-out ("R-20 does not apply to a genuinely force-absent
  descriptive Claim").
- **Case 17 Failed-contrast contradicting R-17**: the "nothing to compile from at all" contrast
  phrasing directly contradicted R-17's own tolerance for a well-formed, entirely-descriptive,
  zero-Requirement `IntentSpec` being Complete, not Failed. Found independently by Reviewers C and D;
  rewritten to define Failed strictly around structural malformedness.
- **Case 16 Unknown/Ambiguity mislabeling**: "fast" was originally treated as an Unknown when, per
  `INTENT_SPEC.md`'s own practical test (wording that itself supports multiple readings is an
  Ambiguity, not a blank gap), it should be an Ambiguity — the same pattern repeatedly fixed earlier
  in `INTENT_CASES.md`. Found by Reviewer B; reclassified and restructured around both R-08
  (Ambiguity never resolvable here) and R-21 (no metric even after picking a reading).
- **Anti-Example misciting R-01**: the microservices-from-vague-preference Anti-Example cited
  "(Violates R-01, R-11)," but R-01 only requires *some* provenance reference exists, which a
  fabricated Requirement could still technically carry. Found by Reviewer D; corrected to cite R-11
  alone, with an explanatory clause.
- **Cross-reference bug** (found by Claude, not a reviewer, during the final read-through sweep after
  all reviewer fixes were applied): the Examples section's source-code-prohibition example pointed at
  "Case 4-derived worked example, Case 1" in `REQUIREMENT_CASES.md`; the matching worked example is
  actually Case 2. Corrected.
- **R-19 tightened and given a terminology note**: Reviewer B's structural test (does a materially
  different value change what the Requirement covers, not what vocabulary describes it) sharpened the
  Unknown-fillability rule; a new "Note on terminology" paragraph reconciles R-19's narrower test
  against `INTENT_SPEC.md`'s broader "technical or operational default" phrase, since the two
  documents use the same words for differently-scoped concepts.
- **R-21 tightened to an oracle-based test**: "does the Requirement's own recorded content already
  point to a satisfaction procedure" replacing a looser "does some reasonable reading exist"
  formulation Reviewer C flagged as too permissive.
- **R-09 explicitly subordinated to R-19**: provenance marking alone was previously readable as
  sufficient to make an Unknown fillable; now explicitly conditioned on passing R-19 first.

**Reviewer disagreement, resolved by independent re-derivation, not majority vote:** Reviewer B
argued Case 4's cost-category Unknown should be reclassified as non-fillable/Partial (same as Case
10's competitor-identity Unknown), citing a concrete boundary-straddling counterexample
($80 infra + $60 licenses = $140, which passes under one cost-category reading and fails under
another). Reviewers C and D did not flag Case 4 as incorrect. Claude independently re-derived the
question from the contract text and concluded Case 4 should keep its Complete/fillable
classification — it has a real metric and threshold, and only the category boundary is ambiguous, so
most candidates are evaluable regardless of interpretation, unlike Case 16's "fast," which has zero
anchor for any candidate. Case 4 was not reclassified, but its text was substantially strengthened
with a new "A candid check against a boundary-straddling candidate" paragraph that explicitly and
honestly engages Reviewer B's exact counterexample rather than leaving it unaddressed.

## Required Changes

None remaining — every confirmed defect from all four axis reviewers was fixed and re-verified, plus
one additional cross-reference bug Claude caught independently (`npm test`: 32/32 throughout,
unaffected since no schema/validator/fixture file was touched).

## Fixes Applied

See "Latest Review" above for the full list; applied directly to `docs/contracts/REQUIREMENT_SPEC.md`,
`docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`, and `docs/examples/REQUIREMENT_CASES.md`.

## Pending Human Gate

PR #13 to be updated in place (pushed to the `devSerdar` fork, not `mihvernetwork` — per this task's
explicit instruction). Not to be merged by this task. `ADR-0003`'s Status remains **Proposed**, per
task instruction — human review of the PR is the next gate.

## History

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
