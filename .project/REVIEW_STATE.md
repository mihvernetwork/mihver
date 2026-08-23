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

Task: DEPENDENCY-C-POST-MERGE-RECONCILIATION
Branch: `chore/dependency-c-post-merge-reconcile`
PR: to be opened against `mihvernetwork/mihver:main` (title "chore: reconcile state after Dependency
C retirement") — not yet created as of this entry

Durable-state/navigation reconciliation only, after PR #24 (`M0-DEPENDENCY-C-DISPOSITION` plus its
`DEPENDENCY-C-DISPOSITION-SEMANTIC-CLOSURE` follow-up) merged to `main` (squash commit
`54ef91c181134487a50cb7b7c3d3ebeb66716b78`, verified via `gh pr view 24`: `state: MERGED`,
`mergeCommit.oid` matching the given base exactly) and `ADR-0004` Dependency C was formally retired
as `REDUNDANT_AFTER_B`. No semantic redesign: Dependency C's semantics were not reopened, Dependency
D was not implemented, and no contract/ADR/schema/validator/runtime file was touched — confirmed via
`git diff main --stat` (exactly `.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`,
`.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`, `ROADMAP.md`) and `npm test` (83/83,
unaffected).

Added a durable `PROJECT_STATE.md` checkpoint recording Dependency C's retirement (not implemented;
retired as `REDUNDANT_AFTER_B`; canonical Dependency-B path unchanged; Requirement Derivation still
not authorized; Dependency D unaffected, separate, unimplemented); rewrote "Next Authorized Action"
to remove the stale "Dependency C is the logical next task family" framing, replacing it with D's
conceptual scope, explicitly not authorized by this entry. Appended one fact-only `DECISIONS_LOG.md`
entry for PR #24's merge (no existing entry edited or removed). Updated `ROADMAP.md`: added a
**RETIRED** status-legend definition; added subsection 10.11 (Dependency C — RETIRED, PR #24,
mirroring the 10.9/10.10 DONE-checkpoint style, full proof left in the owning contracts); retitled
Phase 9 to "B DONE, C RETIRED, D NEXT (not authorized)"; rewrote the "### C" subsection to RETIRED
and relabeled "### D" from PLANNED to NEXT; fixed Phase 9's Exit line; updated Section 22's
near-term-order items 5–7; added a Dependency C retirement bullet plus a compact capability-map line
to Section 21. `.project/CONTEXT_INDEX.md` read only, left unchanged (no navigation gap — `ADR-0004`,
`REQUIREMENT_SPEC.md`, `MEMORY_CONTEXT.md`, `M0_SCOPE.md`, `ROADMAP.md` already indexed).

### Review — one fresh lightweight read-only Codex reviewer

Post-Dependency-C State Consistency, against the 12-point checklist this task specified. **9 PASS, 3
confirmed findings, all fixed.**

- Points 1, 2, 3, 5, 6, 8, 10, 11, 12 — **PASS**, no findings.
- Points 4, 7, 9 — **FAIL/FINDING, all three traced to the same root cause and independently
  re-verified as real**: `ROADMAP.md`'s section 10.8 ("ADR-0004 acceptance gate") still stated, in
  present tense, "Dependencies B/C/D remain independently disabled until their own amendments land"
  and "Dependencies B/C/D were not, and are not, prerequisites for this Acceptance; they remain
  independently disabled" — both left over from the section's original pre-Dependency-B/C text with
  no historical qualifier, directly contradicting Dependency B's implemented status and Dependency
  C's retirement recorded elsewhere in the very same file (10.10/10.11, Phase 9, Section 21).
  Independently re-verified by direct re-read of `ROADMAP.md` lines 670–676: real. Fixed with the
  same historical-qualifier-plus-forward-pointer treatment this document already uses elsewhere
  ("at the time... B has since landed and C has since been retired — see 10.10/10.11").
- A follow-up targeted sweep (Claude's own, prompted by the reviewer's finding pattern) grepped the
  whole file for every remaining `B/C/D`-combined reference and found two further residual instances
  of the same staleness the reviewer did not flag: Phase 8's "did not wait for B/C/D, which remain
  structurally disabled" bullet, and Phase 10's "Brain read-side adapter/runtime" precondition list
  ("only after dependencies B/C/D... are stable"), which incorrectly listed the now-retired,
  not-applicable C as a live precondition. Both fixed with the same treatment. One further
  borderline passage (10.1's "does not imply dependencies B/C/D are enabled") was tightened for the
  same reason, though it was a general logical statement rather than a stale current-state claim.

Independently re-verified by Claude throughout, not merely trusted: re-read each flagged passage
directly in `ROADMAP.md` before editing, confirmed the contradiction, and re-ran the file-wide grep
after fixing to confirm no further instance of the same pattern survived.

`npm test`: 83/83 (unaffected — no schema/test file touched, re-run by Claude after the post-review
fixes, not only before them). `git diff --check`: clean. `git diff main --stat`: exactly
`.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`, `.project/CURRENT_TASK.md`,
`.project/REVIEW_STATE.md`, `ROADMAP.md` — confirmed directly, not only from the reviewer's
self-report. No `docs/**`, `schemas/**`, `tests/**`, `scripts/**`, or `../mihver-brain/**` file
touched.

**Final recommendation: `READY_FOR_HUMAN_REVIEW`.** All three reviewer findings independently
re-verified and fixed; a follow-up targeted sweep, prompted by the same finding pattern, found and
fixed two further residual instances the reviewer's own checklist didn't specifically probe; the
remaining nine checklist points independently re-confirmed clean.

## Required Changes

None remaining — every confirmed finding above is fixed by this same round.

## Fixes Applied

See "Latest Review" above: `ROADMAP.md` section 10.8's two present-tense "Dependencies B/C/D...
disabled" sentences (historically qualified, forward-pointed to 10.10/10.11); Phase 8's "did not
wait for B/C/D" bullet and Phase 10's Brain-adapter precondition list (same treatment, found by
Claude's own follow-up sweep); 10.1's general "does not imply... enabled" sentence (tightened for
the same reason).

## Pending Human Gate

Commit and push; open exactly one PR against `mihvernetwork/mihver:main` (title "chore: reconcile
state after Dependency C retirement"), per this task's explicit instruction. Not merged by this task.
Human review of that PR is the next gate; it authorizes only this durable-state/navigation
reconciliation — no Dependency D work, no schema/runtime/Brain work, no semantic redesign.

## History

- 2026-08-23 — `DEPENDENCY-C-DISPOSITION-SEMANTIC-CLOSURE` (PR #24, pushed to the same branch/PR as
  `M0-DEPENDENCY-C-DISPOSITION` below, not a new branch): a narrow closure pass fixing two findings
  an external review of PR #24 raised, without reopening the retirement decision or implementing
  Dependency D. Reworded three passages (`ADR-0004`'s retirement reason (2), `REQUIREMENT_SPEC.md`'s
  "never about intent" bullet, `MEMORY_CONTEXT.md`'s "no third way" paragraph) whose supporting
  reasoning overstated itself in a way readable as "intent-shaped premises are categorically
  forbidden," risking a Dependency D foreclosure reading — clarified that the real boundary is
  raw/historical/unaccepted `MemoryContext` content, not intent-derived content as such, since an
  accepted `IntentSpec` Claim remains a fully valid R-10 premise (Case 18). Fixed
  `REQUIREMENT_CASES.md` Case 21, which had invented an unsupported "carried-forward Unknown" not
  present in its own stated `IntentSpec` input. A targeted sweep of "only"/"exclusively"/"no third
  way"/"never"/"intent-shaped" across the new C-disposition wording found and fixed one further
  instance (the case-family intro paragraph). One fresh independent read-only Codex reviewer
  (C-Retirement/D-Separation Closure, 9-point checklist): **9/9 PASS**, independently spot-checked by
  Claude against primary text (including direct reads of the cited Dependency D material) rather than
  trusted at face value. `npm test`: 83/83. Verdict: `READY_FOR_HUMAN_REVIEW`. PR #24 subsequently
  merged to `main` (squash commit `54ef91c181134487a50cb7b7c3d3ebeb66716b78`, verified via `gh pr
  view 24`) — that merge event is recorded in `.project/DECISIONS_LOG.md`. A follow-up task,
  `DEPENDENCY-C-POST-MERGE-RECONCILIATION`, subsequently synchronized durable project state with this
  merged reality, on a new branch. Moved here from "Latest Review" now that those sections describe
  `DEPENDENCY-C-POST-MERGE-RECONCILIATION` instead, per this file's branch/task scoping — this entry
  and `M0-DEPENDENCY-C-DISPOSITION` below share branch `m0/dependency-c-disposition` and PR #24,
  since the closure round was a continuation on the same open PR, not a new branch. — branch
  `m0/dependency-c-disposition`

- 2026-08-23 — `M0-DEPENDENCY-C-DISPOSITION` (PR #24, opened, not yet merged): formally recorded
  `ADR-0004` Dependency C's retirement after a prior task's mandatory pre-implementation
  re-derivation concluded `DEPENDENCY_C_REDUNDANT_AFTER_B` and stopped without implementing anything.
  This task independently re-verified that verdict before editing (all nine propositions A–I in the
  task's Section 1 re-confirmed true against the owning contracts), then recorded the disposition — no
  new capability, no schema/runtime change. Three fresh independent read-only Codex reviewers by axis:
  Reviewer A (R-10/R-22/Redundancy Proof) found two confirmed findings on Case 20/21 (a weak
  illustrative entailment; an unjustified Eligibility "Partial per R-21" claim), both fixed; Reviewer B
  (Memory Authority/Stage Boundary) found nothing across seven checks; Reviewer C (C/D
  Separation/Cross-Document Consistency) found two confirmed findings (a Case 21 Dependency-D scope
  leak; three stale pre-Acceptance/pending-authorization phrases across `ADR-0004` and
  `MEMORY_CONTEXT_CASES.md`), both fixed, plus two further residual instances of the same
  `MEMORY_CONTEXT_CASES.md` staleness Claude's own follow-up corpus-wide grep found and fixed in the
  same pass. `npm test`: 83/83. Verdict: `READY_FOR_HUMAN_REVIEW`. PR #24 opened (title "docs: retire
  redundant Dependency C after Dependency B") — not merged. A follow-up task,
  `DEPENDENCY-C-DISPOSITION-SEMANTIC-CLOSURE`, subsequently fixed two findings an external review of
  the opened PR raised (retirement-proof wording overstatement risking a Dependency D foreclosure
  reading; an invented Case 21 Unknown), on the same branch/PR, before any human merge decision. Moved
  here from "Latest Review" now that those sections describe
  `DEPENDENCY-C-DISPOSITION-SEMANTIC-CLOSURE` instead, per this file's branch/task scoping — both
  entries share branch `m0/dependency-c-disposition` and PR #24, since the closure round was a
  continuation on the same open PR, not a new branch. — branch `m0/dependency-c-disposition`

- 2026-08-23 — `M0-DEPENDENCY-C-REQUIREMENT-MEMORY-PREMISE` (no branch pushed, no PR, no edits made):
  a mandatory pre-implementation re-derivation, required before any implementation, found the direct
  path `MemoryContext → Requirement-Level Inference premise` structurally incoherent against
  `REQUIREMENT_SPEC.md`'s own R-10/R-22 semantics — R-22 has no strength source but an accepted
  Claim/Requirement, and the only `MemoryContext` entry class ever eligible for `SEMANTIC_PREMISE`
  (Category A historical-user statement) is inherently intent-shaped content the Requirement-Level
  Inference mechanism categorically excludes ("never about intent," per `REQUIREMENT_SPEC.md` and
  `ADR-0004`'s own Phase 1 authority map). Every legitimate use of this content was found already
  fully mediated through the just-merged Dependency B. Verdict:
  `DEPENDENCY_C_REDUNDANT_AFTER_B`. Per the task's own explicit instruction for a stop verdict, no
  file was edited, no branch was pushed, and no PR was opened — the locally-created branch
  `m0/dependency-c-requirement-memory-premise` was left with zero commits. This finding directly
  motivated the present task, `M0-DEPENDENCY-C-DISPOSITION`, which formally records the retirement.
  Moved here from "Latest Review" now that those sections describe `M0-DEPENDENCY-C-DISPOSITION`
  instead — this entry was never itself a "Latest Review" (the task stopped before reaching that
  stage), recorded here for lineage completeness only. — branch
  `m0/dependency-c-requirement-memory-premise` (local only, never pushed)

- 2026-08-23 — `DEPENDENCY-B-POST-MERGE-RECONCILIATION` (PR #23, merged, squash commit
  `e0a040928112bf87a9353450c6f5116320f4078a`): status/navigation reconciliation only, after `ADR-0004`
  Dependency B (PR #22, squash commit `2cee16af702804127472af0470b3ce4ef2600f88`) merged to `main`.
  Added a durable "`ADR-0004` Dependency B — Intent Memory Premise" checkpoint to
  `.project/PROJECT_STATE.md`; appended one fact-only merge-confirmation entry to
  `.project/DECISIONS_LOG.md`; corrected two now-stale "Research Planning... sole authorized
  consumer" present-tense sentences (`PROJECT_STATE.md`'s Dependency A/Schema Foundation checkpoint
  bullets) to historical-at-that-checkpoint framing with forward pointers; rewrote
  `PROJECT_STATE.md`'s "Next Authorized Action" to record Dependency C's then-expected conceptual
  scope without designing it, and to state B's completion was not authorization for C. Updated
  `ROADMAP.md`: new subsection 10.10 ("Dependency B — DONE, PR #22"); restructured Phase 9 ("B DONE,
  C/D not authorized"); Section 21's capability map fixture-count corrected `32/32` → `83/83`; Section
  22's near-term order item 4 changed from "NEXT, not authorized" to "DONE (PR #22)". One lightweight
  read-only Codex reviewer (Post-Dependency-B State Consistency, 14-point checklist) found one
  confirmed, fixed finding (two residual stale-present-tense "sole authorized consumer" sentences in
  `ROADMAP.md`'s Phase 10 body and Section 22 item 3, left over from before Dependency B landed);
  all other 13 checks independently re-confirmed clean. `npm test`: 83/83 throughout (unaffected — no
  contract/schema/runtime file touched). Verdict: `READY_FOR_HUMAN_REVIEW`. PR #23 subsequently merged
  to `main` (verified via `gh pr view 23`) — that merge event is recorded in
  `.project/DECISIONS_LOG.md`. `.project/CONTEXT_INDEX.md` was verified accurate and left unmodified.
  Moved here from "Latest Review" now that those sections describe
  `M0-DEPENDENCY-C-REQUIREMENT-MEMORY-PREMISE` and then `M0-DEPENDENCY-C-DISPOSITION` instead, per
  this file's branch/task scoping — this is the first entry on a new branch, since this task's own
  round was self-contained on `chore/dependency-b-post-merge-reconcile`. — branch
  `chore/dependency-b-post-merge-reconcile`

- 2026-08-23 — `DEPENDENCY-B-CROSS-ARTIFACT-GATE-CLOSURE` (PR #22, merged, squash commit
  `2cee16af702804127472af0470b3ce4ef2600f88`): a narrow gate-closure pass on top of PR #22's
  already-implemented `ADR-0004` Dependency B, closing four technical deterministic-validator gaps
  (companion `MemoryContext` made mandatory, not optional, whenever a memory reference is present;
  discovery-path references required to be historical-user standing Category A or B; an incompatible
  non-`user_idea` upstream artifact binding rejected; `force_reasoning.basis` whitespace-only bypass
  closed) plus one `REVIEW_STATE.md` factual-hygiene defect (a false claim that PR #21's merge was
  recorded in `.project/DECISIONS_LOG.md`), all found by an external review and independently
  re-verified real before any fix. Two fresh independent read-only Codex reviewers (Cross-Artifact
  Authority Gate; Force/Regression/State Hygiene) found two further real findings — stale
  "companion optional" schema-description wording, and a stale `78/78` fixture-count total in this
  file and `CURRENT_TASK.md` — both fixed. `npm test`: 83/83. Verdict: `READY_FOR_HUMAN_REVIEW`. PR
  #22 subsequently merged to `main` (squash commit `2cee16af702804127472af0470b3ce4ef2600f88`,
  verified via `gh pr view 22`) — that merge event is recorded in `.project/DECISIONS_LOG.md`. Moved
  here from "Latest Review" now that those sections describe
  `DEPENDENCY-B-POST-MERGE-RECONCILIATION` instead, per this file's branch/task scoping — this is
  the first entry on a new branch, since the gate-closure round was self-contained on
  `m0/dependency-b-intent-memory-premise`/PR #22. — branch `m0/dependency-b-intent-memory-premise`

- 2026-08-23 — `M0-DEPENDENCY-B-INTENT-MEMORY-PREMISE` (PR #22, opened, not yet merged): implemented
  `ADR-0004` Dependency B — Intent Parsing became an authorized `MemoryContext` consumer
  (`M0_SCOPE.md`), and a qualified Category A historical-user `MemoryContext` entry may be cited as a
  premise of a current-run Inferred Claim (`INTENT_SPEC.md`'s Inference Policy amendment). STOP
  conditions explicitly re-derived and found not triggered. Two coherent dimensions landed together:
  `M0_SCOPE.md`'s pipeline authorization and `INTENT_SPEC.md`/`intent-spec.schema.json`/
  `validate-contracts.mjs`'s artifact-provenance representation, plus 9 new `INTENT_CASES.md`
  adversarial cases and 19 new fixtures. Four independent read-only Codex reviewers by invariant axis
  (Epistemic Origin/Provenance; Current Input/Decision Impact/Conflict; Schema/Validator/
  Cross-Artifact References; Force/Cross-Axis/Corpus) found three real, independently-re-verified
  defects — a validator pair-uniqueness key-collision bug (naive `"::"`-joined string keys), a weak
  "persistence-by-default" force-reasoning pattern in an illustrative fixture (also fixed identically
  in `INTENT_SPEC.md`'s own worked example), and a documentation-clarity wording issue in a case — all
  fixed; one proposed finding (validator-side current-input-vs-memory contradiction detection) was
  independently reviewed and rejected as contrary to `MEMORY_CONTEXT.md`'s own explicit design.
  `npm test`: 78/78. Verdict: `READY_FOR_HUMAN_REVIEW`. A subsequent external review of the opened PR
  found the four technical gaps and one factual-hygiene defect that
  `DEPENDENCY-B-CROSS-ARTIFACT-GATE-CLOSURE` (below) closed, on the same branch/PR, before any human
  merge decision. Moved here from "Latest Review" now that those sections describe
  `DEPENDENCY-B-CROSS-ARTIFACT-GATE-CLOSURE` instead, per this file's branch/task scoping — both
  entries share branch `m0/dependency-b-intent-memory-premise` and PR #22, since the closure round was
  a continuation on the same open PR, not a new branch. — branch
  `m0/dependency-b-intent-memory-premise`

- 2026-08-22/2026-08-23 — `MEMORY-CONTEXT-POST-SCHEMA-RECONCILIATION` (PR #21, merged, squash commit
  `5054a64fd2a95ee3d139c6a43442f65a8fafb837`, plus one follow-up single-line ROADMAP.md
  cross-reference fix pushed to the same PR before merge): status/navigation/authorization-prose
  synchronization after PR #19 (ADR-0004 Acceptance) and PR #20 (MemoryContext Schema Foundation)
  both merged to `main`. Corrected `docs/contracts/MEMORY_CONTEXT.md`'s stale top-of-file status
  (`Proposed` → `Accepted`), renamed and rewrote its "Stage Consumption Is Not Yet Authorized"
  section to "Stage Consumption Authorization" reflecting Research Planning as the sole authorized
  consumer (`DISCOVERY_ATTENTION` only), and fixed two narrower stale Research-Planning-authorization
  hedges elsewhere in the same document — while leaving every legitimately-still-future Dependency
  B/C/D statement untouched. Added a "MemoryContext Schema Foundation" checkpoint to
  `.project/PROJECT_STATE.md` and rewrote its "Next Authorized Action" to describe Dependency B's two
  coherent prerequisite dimensions. Appended two fact-only merge-confirmation entries to
  `.project/DECISIONS_LOG.md`. Updated `ROADMAP.md`'s Phase 10 to DONE, its capability map, and its
  Section 22 near-term order. One lightweight read-only Codex reviewer (Post-Schema Authority / State
  Consistency) found one confirmed, fixed finding (two residual stale-present-tense `ROADMAP.md`
  sentences contradicting Phase 10's own DONE status); all other 11 checks independently re-confirmed
  clean. A separate follow-up instruction then fixed one incorrect `ROADMAP.md` cross-reference
  ("section 10.9" → "Phase 10," since 10.9 is Dependency A/PR#17, not the schema foundation),
  pushed to the same PR. `npm test`: 59/59 throughout (unaffected — no contract/schema/runtime file
  touched). Verdict: `READY_FOR_HUMAN_REVIEW`. PR #21 subsequently merged to `main` (verified via `gh
  pr view 21`, mergedAt `2026-08-22T22:05:50Z`, merge commit
  `5054a64fd2a95ee3d139c6a43442f65a8fafb837`) — noted here as historical context only; unlike PR #19
  and PR #20, no separate PR #21 merge-fact entry exists in `.project/DECISIONS_LOG.md` as of this
  entry (verified directly against that file's current content, not assumed). Moved here from "Latest
  Review" now that those sections describe `M0-DEPENDENCY-B-INTENT-MEMORY-PREMISE` instead, per this
  file's branch/task scoping — this is the first entry on a new branch, since this task's own round
  was self-contained on `chore/memory-context-post-schema-reconcile`. — branch
  `chore/memory-context-post-schema-reconcile`

Status/navigation/authorization-prose synchronization after PR #19 (ADR-0004 Acceptance, merge
commit `8b0c0b65b3d8e6f2cb3034d9f395b2008694cc75`) and PR #20 (MemoryContext Schema Foundation,
merge commit `b8fc6fe6558adbb560b48f1bbe937db53ac09555`) both merged to `main`. Corrected
`docs/contracts/MEMORY_CONTEXT.md`'s stale top-of-file status (`Proposed` → `Accepted`), renamed and
rewrote its "Stage Consumption Is Not Yet Authorized" section to "Stage Consumption Authorization"
reflecting Research Planning as the sole authorized consumer (`DISCOVERY_ATTENTION` only), and fixed
two narrower stale Research-Planning-authorization hedges elsewhere in the same document — while
leaving every legitimately-still-future Dependency B/C/D statement untouched. Added a "MemoryContext
Schema Foundation" checkpoint to `.project/PROJECT_STATE.md` and rewrote its "Next Authorized Action"
to describe Dependency B's two coherent prerequisite dimensions (M0_SCOPE.md pipeline authorization;
`INTENT_SPEC.md`/`intent-spec.schema.json`/validator artifact-provenance representation). Appended
two fact-only merge-confirmation entries to `.project/DECISIONS_LOG.md` (PR #19, PR #20) without
editing the existing, still-accurate-at-the-time `ADR-0004-ACCEPTANCE` decision entry. Updated
`ROADMAP.md`'s Phase 10 to DONE, its capability map, and its Section 22 near-term order (splitting
the former combined B/C/D item into three, per the task's explicit sequence). Verified
`.project/CONTEXT_INDEX.md` is already accurate and left it unmodified. Not a redesign of
`MemoryContext`; does not enable Dependency B/C/D; does not implement Brain runtime integration.

### Review — one lightweight fresh read-only Codex reviewer

Per this task's explicit instruction: Post-Schema Authority / State Consistency, against a 12-point
checklist — not a broad semantic re-review of `MemoryContext`/`ADR-0004`'s own soundness.

- **One confirmed, fixed finding:** two `ROADMAP.md` sentences — Phase 7's "Still not implemented:
  `MemoryContext` schema..." and section 10.9's "There is still no `MemoryContext` schema..." — were
  left as present-tense claims, even though both are historically accurate only at their own
  checkpoint (written before PR #20 existed) and now directly contradict Phase 10's own DONE status
  two sections later in the same document. Independently re-verified by direct re-read of both
  lines: real. Fixed with the same historical-pointer treatment already applied to the equivalent
  sentences in `.project/PROJECT_STATE.md` ("at the time of this checkpoint... a schema has since
  been added — see [checkpoint]; a Brain read adapter/runtime still does not exist even now").
- All other 11 checks — `MEMORY_CONTEXT.md`'s Accepted status line; Research Planning stated as sole
  authorized consumer, matching `M0_SCOPE.md`'s actual "Cross-Cutting: MemoryContext Consumption
  Remains Otherwise Disabled" section read directly; `DISCOVERY_ATTENTION`-only stated; every other
  stage still disabled and no stage (Research Planning included) may ever query Brain directly;
  every spot-checked Dependency B/C/D future-statement (Historical User Memory Rule, No
  Assumed-Origin Path for Memory, Influence Taxonomy) confirmed still correctly future; the schema/
  mapping acknowledged without imported field-level detail; no runtime/adapter/executable-Producer
  claimed anywhere in the changed files; `PROJECT_STATE.md`'s PR #20 checkpoint content verified
  accurate line-by-line; `ROADMAP.md` no longer calling PR #20 open/unmerged; Dependency B correctly
  described as NEXT-but-not-authorized with both prerequisite dimensions spelled out in both
  `ROADMAP.md` and `PROJECT_STATE.md`; `DECISIONS_LOG.md`'s diff confirmed purely additive with the
  existing `ADR-0004-ACCEPTANCE` entry's "has not merged as of this entry" text left completely
  intact; and no recursive metadata-sync or silent Dependency B/C/D/Step-03B/runtime authorization
  anywhere — were independently re-verified by Claude and confirmed clean, not merely trusted from
  the reviewer's own "Pass" verdicts.

`npm test`: 59/59 (unaffected — no contract/schema/runtime file touched). `git diff --check`: clean.
`git diff main --stat`: exactly `docs/contracts/MEMORY_CONTEXT.md`, `.project/PROJECT_STATE.md`,
`.project/DECISIONS_LOG.md`, `ROADMAP.md`, plus this task's own `.project/CURRENT_TASK.md`/
`REVIEW_STATE.md`. Targeted `git diff main --stat` against every forbidden path (`M0_SCOPE.md`,
`ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`, `memory-context.schema.json`,
`MEMORY_CONTEXT_SCHEMA_MAPPING.md`, `tests/**`, `INTENT_SPEC.md`, `intent-spec.schema.json`,
`REQUIREMENT_SPEC.md`, `.project/CONTEXT_INDEX.md`) produced empty output. No `mihver-brain` file
touched. No new `MemoryContext` consumer authorized; no Dependency B/C/D implemented; no runtime/
MCP/network code introduced.

**Final recommendation: `READY_FOR_HUMAN_REVIEW`.** The one confirmed finding was independently
verified and fixed; the remaining eleven checks were independently re-confirmed clean, not merely
trusted from the reviewer's report.

## Required Changes

None remaining — the one confirmed finding (two residual stale-present-tense sentences in
`ROADMAP.md`) is fixed by this same edit.

## Fixes Applied

See "Latest Review" above. Applied to `ROADMAP.md` only, beyond the task's own planned edits: Phase
7's and section 10.9's "no `MemoryContext` schema" sentences, both reworded to state that fact as
historical-at-that-checkpoint with a forward pointer to Phase 10's DONE status.
`docs/contracts/MEMORY_CONTEXT.md`, `.project/PROJECT_STATE.md`, and `.project/DECISIONS_LOG.md`
were confirmed clean and required no further change beyond this task's own planned edits.

## Pending Human Gate

Commit, push, and open one PR against `mihvernetwork/mihver:main`, title `chore: reconcile
MemoryContext state after schema foundation`, per this task's explicit instruction. Not merged by
this task. Human review of that PR is the next gate; it authorizes only this documentation/state
reconciliation — not Dependency B/C/D, not Step 03B, and not any `mihver-brain` or runtime
memory-integration work.

## History

- 2026-08-23 — `MEMORY-CONTEXT-SCHEMA-CONTRACT-CLOSURE` (PR #20, merged): a narrow contract→schema
  closure pass on top of the schema-foundation task below, closing four structural gaps an external
  review found — each re-verified directly against `MEMORY_CONTEXT.md`'s actual text before
  implementing anything, all four genuinely supported. Added `classification.semantic_authority_class`/
  `exclusionClassification.semantic_authority_class` (Axis 3, independent of `brain_type`/
  `historical_user_category`/`influence_tier`, deliberately an open non-empty string not a closed
  enum), an explicit `admission_reason` on `admittedEntry` (symmetric with `exclusion_reason`), a
  required non-null `freshness` on `excludedEntry` (previously nullable), and a
  `source.brain_memory_id` uniqueness check extended across the combined
  `admitted_entries`+`excluded_entries` sets (previously admitted-only). Full corpus sweep performed:
  every existing `MemoryContext` fixture updated to the corrected required shape, each invalid
  fixture re-confirmed to still fail for its own originally-declared reason. Two fresh independent
  read-only Codex reviewers — Reviewer A (Classification Axis Separation) found one confirmed,
  fixed finding (a whitespace-only `semantic_authority_class` bypass, closed with a targeted
  validator guard) plus seven clean checks; Reviewer B (M-14 Audit Completeness) found nothing
  across all 11 checks. `npm test`: 59/59. Verdict: `READY_FOR_HUMAN_REVIEW`. Did not redesign
  `ADR-0004`, modify `MEMORY_CONTEXT.md`, enable Dependency B/C/D, or implement runtime/Brain
  integration. Moved here from "Latest Review" now that those sections describe
  `MEMORY-CONTEXT-POST-SCHEMA-RECONCILIATION` instead, per this file's branch/task scoping — shares
  branch `m0/memory-context-schema-foundation` and PR #20 with the entry below, since this was a
  continuation, not a new branch. — branch `m0/memory-context-schema-foundation`

- 2026-08-23 — `M0-MEMORY-CONTEXT-SCHEMA-FOUNDATION` (PR #20, merged, squash commit
  `b8fc6fe6558adbb560b48f1bbe937db53ac09555`): created the first
  machine-readable JSON Schema and deterministic validator for the Accepted `MemoryContext` semantic
  contract (`schemas/m0/memory-context.schema.json`, a `validateMemoryContext` function, 22 new
  fixtures, and `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`), plus a minimal `ROADMAP.md`/
  `CONTEXT_INDEX.md` sequencing correction. Did not enable any new `MemoryContext` consumer, implement
  Brain retrieval/runtime, or touch `MEMORY_CONTEXT.md`/`ADR-0004`/`M0_SCOPE.md`/`INTENT_SPEC.md`/
  `intent-spec.schema.json`/`REQUIREMENT_SPEC.md`. Three independent read-only Codex reviewers
  (Schema ↔ Accepted Contract Coverage; Epistemic Authority/Provenance; Lifecycle/Evolvability/Future
  References) found five real, convergent defects, all independently re-verified by Claude and fixed:
  an incomplete M-04 supersession check (missed `superseded_by`), an M-11 rule that unconditionally
  forced `lesson`/`playbook` entries to `PROCESS_ONLY` (contradicting the contract's explicit
  type-independence override), a missing audit trail for excluded entries (M-14), an M-19 mapping
  overclaim (a constructed counterexample bypasses ambiguity detection via prose/field
  inconsistency), and three fixtures with mislabeled `classification_method` values. `npm test`:
  54/54. Verdict: `READY_FOR_HUMAN_REVIEW`. Moved here from "Latest Review" now that those sections
  describe `MEMORY-CONTEXT-SCHEMA-CONTRACT-CLOSURE` instead, per this file's branch/task scoping —
  both entries share branch `m0/memory-context-schema-foundation` and PR #20, since this was a
  continuation, not a new branch. — branch `m0/memory-context-schema-foundation`

- 2026-08-23 — `ADR-0004-ACCEPTANCE` (PR #19, merged, plus one follow-up state-hygiene push):
  moved `ADR-0004` (Memory Context Authority Boundary) from Proposed to Accepted, per its own
  previously-defined Acceptance Gate (dependency A alone, completed via PR #17 and adversarially
  reviewed — B/C/D not required). Acceptance/status checkpoint only: Model C and the full
  `MEMORY_CONTEXT.md` contract were unchanged. Two fresh independent read-only Codex reviewers —
  Reviewer A (Acceptance Gate Verification) verdict `GATE_SATISFIED`; Reviewer B (Authority / State
  Consistency) found one blocking finding (a last-file-updated ordering artifact in this file,
  resolved by that same edit) and one non-blocking note (flagging the `ROADMAP.md`
  staleness-hardening change as apparent scope overreach, independently reconsidered and found to be
  explicitly authorized by that task's own prompt — no change made). `npm test`: 32/32. Verdict:
  `READY_FOR_HUMAN_REVIEW`. A follow-up task, `ADR-0004-ACCEPTANCE-FINAL-STATE-HYGIENE`, later
  corrected one false factual sentence in this file's own text (a claim that `DECISIONS_LOG.md`
  recorded a separate PR #18 merge entry, which it did not) without adding a new `DECISIONS_LOG.md`
  entry or opening a new PR — pushed to the same `docs/adr-0004-acceptance` branch/PR #19. Moved here
  from "Latest Review" now that those sections describe `M0-MEMORY-CONTEXT-SCHEMA-FOUNDATION`
  instead, per this file's branch/task scoping — this is the first entry on a new branch, since both
  the acceptance task and its state-hygiene follow-up shared `docs/adr-0004-acceptance` and PR #19. —
  branch `docs/adr-0004-acceptance`

- 2026-08-22 — `MASTER-ROADMAP-POST-DEPENDENCY-A-INTEGRITY` (PR #18, merged): durable
  navigation/state reconciliation after `ADR-0004` Dependency A (PR #17, squash commit
  `9416e857b549bea07d4ce06a5c365524fdf1d51a`) merged to `main` while `docs/master-roadmap` was
  already open. No architecture redesign, no `M0_SCOPE.md` change, no ADR Status change, no
  Dependency B/C/D or Step 03B work, no `mihver-brain` change. Updated `ROADMAP.md`
  (last-verified-`main` pointer, Phase 7 → DONE with a new `## 10.9` section, Phase 8 →
  NEXT/not-authorized, capability-map and near-term-order updates, removal of the dangling
  external-report filename reference), `.project/PROJECT_STATE.md` (new Dependency A checkpoint,
  corrected stale "not started"/"no stage declares it" language), `.project/DECISIONS_LOG.md` (one
  new fact-only entry, append-only), and `.project/CONTEXT_INDEX.md` (corrected `ADR-0002` row to
  Accepted; added missing topic rows). One lightweight read-only Codex reviewer (Context Authority /
  Handoff Integrity), per a 9-point checklist, found one confirmed defect (a stale "four future
  dependencies" phrase in `ROADMAP.md`), fixed; eight other checks confirmed clean. `npm test`:
  32/32. Verdict: `CLEAN`. PR #18 subsequently merged to `main` (squash commit
  `823ff9f41f6e7b89814c2246df6ea9db41f7e97c`, verified via `gh pr view 18`) — noted here as
  historical context only; `.project/DECISIONS_LOG.md`'s pre-existing last merge-fact entry before
  this acceptance task remains PR #17's, and no separate PR #18 merge entry was added to it (no new
  state-sync cycle was run merely to record PR #18's own merge metadata). Moved here from "Latest Review"
  now that those sections describe `ADR-0004-ACCEPTANCE` instead, per this file's branch/task
  scoping — this is the first entry on a new branch, since `MASTER-ROADMAP-POST-DEPENDENCY-A-
  INTEGRITY`'s own round continued the pre-existing `docs/master-roadmap` branch rather than
  starting a new one. — branch `docs/master-roadmap`

- 2026-08-22 — `M0-FOUNDATION-MEMORY-BOUNDARY-A` (PR #17, merged): implemented `ADR-0004`'s
  dependency A only (`RunContext`, the `MemoryContext` Producer's own contract, and Research
  Planning as the first and only authorized `MemoryContext`-consuming stage, `DISCOVERY_ATTENTION`
  tier only) by deliberately, explicitly amending the frozen M0 foundation, as directly
  human-authorized. `ADR-0004` itself stayed **Proposed**; dependencies B/C/D and every other
  stage's `MemoryContext` consumption remained structurally disabled; `INTENT_SPEC.md`/
  `REQUIREMENT_SPEC.md` untouched. Four independent read-only Codex reviewers by axis (A: Principle
  3/Stage Isolation; B: Producer Authority; C: Research Planning Least Authority; D: Cross-Document
  Contradiction) found three real, independently-verified-by-Claude defects (an ambiguous Principle-
  3-compliance parenthetical; a missing cross-project content-agnosticism safeguard for
  `global`-scoped entries at Research Planning; a "RunContext is mandatory" wording drift), all
  fixed; the fourth axis found nothing, independently re-checked rather than merely trusted. `npm
  test`: 32/32. Verdict: `READY_FOR_HUMAN_REVIEW`. PR #17 subsequently merged to `main` (squash
  commit `9416e857b549bea07d4ce06a5c365524fdf1d51a`, verified via `gh pr view 17`) — that merge
  event is recorded in `.project/DECISIONS_LOG.md`, not here. Moved here from "Latest Review" now
  that those sections describe `MASTER-ROADMAP-POST-DEPENDENCY-A-INTEGRITY` instead, per this file's
  branch/task scoping — this is the first entry on a new branch, since `M0-FOUNDATION-MEMORY-
  BOUNDARY-A`'s own round was self-contained on `m0/foundation-memory-boundary-a`. — branch
  `m0/foundation-memory-boundary-a`

- 2026-08-22 — `PROJECT-STATE-SYNC-AFTER-ADR-0004` (no PR — pure `.project/` state sync, not a
  code/doc PR): pure durable-state synchronization after `ADR-0004` (Memory Context Authority
  Boundary, PR #15, squash commit `aa1fe66072ae780a910eb458f8263c4886fd37fd`) merged to `main`. No
  architecture-semantic change: `ADR-0004` itself, `M0_SCOPE.md`, `INTENT_SPEC.md`,
  `REQUIREMENT_SPEC.md` not touched, no `mihver-brain` or runtime change, and the Foundation Memory
  Amendment (`ADR-0004`'s "dependency A") not started or pre-authorized by that task. Updated
  `PROJECT_STATE.md` (new checkpoint entry, Status recorded accurately as Proposed, `MemoryContext`
  stated as not operational/authorized), appended one new fact-only entry to `DECISIONS_LOG.md` (no
  existing entry edited), and rewrote `CURRENT_TASK.md` for that task/branch. One lightweight
  read-only Codex reviewer (State Authority / Handoff Integrity) found one finding (this file itself
  not yet updated at review time), fixed by that same edit; `PROJECT_STATE.md`/`DECISIONS_LOG.md`
  confirmed clean. `npm test`: 32/32. Verdict: `READY_FOR_HUMAN_REVIEW`. Moved here from "Latest
  Review" now that those sections describe `M0-FOUNDATION-MEMORY-BOUNDARY-A` instead, per this file's
  branch/task scoping. — branch `chore/project-state-sync-after-adr-0004`

- 2026-08-22 — `M0-ADR-0004-FINAL-TAXONOMY-CLOSURE` (PR #15, fourth round, merged): a narrow final
  semantic closure, before any foundation-amendment work begins. Closed three remaining gaps: (1)
  made the Historical User Provenance Gate (M-18) explicitly type-independent — the gate applies to
  any admitted record production's content inspection reveals as a historical user statement,
  regardless of stored Brain `type`, with a new requirement that a citation must be inspectable
  *and* resolvable, not merely citation-shaped; new Case 23 (misfiled `reference`-type record); (2)
  introduced `DECISION_OPTION` as a fourth Influence Taxonomy tier, reconciling memory-informed R-19
  defaults without weakening `DISCOVERY_ATTENTION`'s additive-only invariant — new Invariant M-21,
  new Case 24 (genuinely R-19-eligible default vs. an intent-level value R-19 excludes); (3)
  explicitly decided `ADR-0004`'s Acceptance Gate — a new subsection naming four dependencies (A:
  core `M0_SCOPE.md`; B: `INTENT_SPEC.md` Inference-premise; C: `REQUIREMENT_SPEC.md`
  Requirement-Level-Inference; D: `REQUIREMENT_SPEC.md` R-19 provenance) and deciding
  Accepted-eligible status requires dependency A alone. Three independent read-only Codex reviewers
  (A: Brain Type × Historical Provenance; B: Influence Taxonomy × R-19; C: Amendment Sequencing ×
  Cross-Document Consistency) found real defects: absolute type-determined language surviving in
  authority-class tables; an overstated `DECISION_OPTION`/`DISCOVERY_ATTENTION` distinction; stale
  three-tier inventories; an overclaiming "requires no amendment" phrase; missing dependency
  citations in several cases and the corpus preamble; an inaccurate `ADR-0003` acceptance-precedent
  claim. All fixed and independently re-verified. `npm test`: 32/32. Verdict:
  `FOUNDATION_AMENDMENT_REQUIRED` (unchanged), with no new blocker — `READY_FOR_MERGE_AS_
  PROPOSED_ADR`. PR #15 subsequently merged to `main` (squash commit `aa1fe66`, verified via `gh pr
  view 15`) — that merge event is recorded in `.project/DECISIONS_LOG.md`, not here. Moved here from
  "Latest Review" now that those sections describe `PROJECT-STATE-SYNC-AFTER-ADR-0004` instead, per
  this file's branch/task scoping — this is the first entry on a new branch, since all four
  `ADR-0004` rounds shared `m0/adr-0004-memory-context-authority`. — branch
  `m0/adr-0004-memory-context-authority`

- 2026-08-22 — `M0-ADR-0004-AUTHORITY-PROVENANCE-CLOSURE` (PR #15, third round): closed six further
  gaps a follow-up task specified: a Historical User Provenance Gate (Category A direct/Category B
  derived-unverified historical user statements, new M-18) gating which entries may ever be cited as
  an Inferred Claim's premise; a Classification Fail-Closed Rule (new M-19) requiring production to
  record classification basis/method/ambiguity and resolve ambiguity toward less authority; removal
  of residual wording letting production treat "an artifact was supplied" as equivalent to "a
  contradiction judgment was supplied"; an explicit Identity Boundary (memory never becomes Evidence,
  regardless of re-verification — only a wholly new artifact does); an R-19 memory-informed-default
  Foundation Impact item; and a Historical Force Is Not Current Force rule (new M-20, new Case 22)
  plus an M-07 correction restoring I-16's "not by itself" qualifier an earlier round had silently
  over-strengthened. Four independent Codex reviewers by interaction axis (A: Historical Provenance ×
  Normative Force; B: Producer Classification × Least Authority; C: Memory × Evidence × Requirement
  Defaults; D: cross-document/corpus contradiction) found real defects: Case 19 bypassed M-18 entirely
  (no Category A/B designation on cited premises); Case 22's worked force example was internally
  self-contradictory; `ADR-0004`'s own duplicated content lagged `MEMORY_CONTEXT.md`'s fixes yet again
  (Phase 4 freshness judgment, Phase 7/8 stale "memory reaches `SEMANTIC_PREMISE`" wording); a second
  unfixed artifact-vs-verdict conflation survived in the Producer's "Not allowed to decide" bullet;
  Reproducibility/M-14 snapshot inventories weren't updated for the new classification-metadata facts;
  Case 8 and M-03 both carried stale/incomplete gating language; Cases 3/12 missed the corpus
  preamble's promised immateriality notes. All fixed and independently re-verified. `npm test`: 32/32.
  Verdict: `FOUNDATION_AMENDMENT_REQUIRED` (unchanged). Moved here from "Latest Review" now that those
  sections describe `M0-ADR-0004-FINAL-TAXONOMY-CLOSURE` instead, per this file's branch/task scoping
  (all entries for this branch share PR #15, since each was a continuation, not a new branch). —
  branch `m0/adr-0004-memory-context-authority`

- 2026-08-21 — `M0-ADR-0004-CROSS-BOUNDARY-REMEDIATION` (PR #15, second round): an external human
  review of the first draft accepted Model C but found six cross-boundary issues (circular scope
  anchor, undefined producer authority, admissibility-vs-interpretation conflation, a false
  procedural/semantic binary, undefined lifecycle/invalidation, ambiguous cross-project corpus
  language) requiring resolution before foundation-amendment work begins. Fixed by introducing
  `RunContext` (non-memory run-identity anchor), a full "MemoryContext Producer: Role and Authority"
  contract, an admissibility-vs-interpretation split, a three-tier Influence Taxonomy
  (`PROCESS_ONLY`/`DISCOVERY_ATTENTION`/`SEMANTIC_PREMISE`), a full Lifecycle/Invalidation model, and
  deterministic per-case scope statements (corpus grew from 20 to 21 cases, adding Case 21 for
  `RunContext`'s explicit absence). Four independent Codex reviewers by interaction axis (A: Scope
  Anchor × Producer Authority; B: Lifecycle × Reproducibility; C: Process × Discovery × Semantic
  Authority; D: cross-document/corpus contradiction) found real defects, mostly the remediation's own
  fixes not propagated to `ADR-0004`'s duplicate copies (a stale `project`-anchor table row, stale
  "produced by one stage" language, stale procedural/semantic terminology in Phase 6/7/8/9) plus a
  self-contradiction between the Producer's "mechanical only" scope authority and pre-existing
  "genuinely project-agnostic" content-judgment text (resolved by deferring that judgment to the
  consuming stage), a functional-exclusion loophole in Case 8, a cross-run reuse gap, and a Case 18
  cardinality conflict. All fixed and independently re-verified. `npm test`: 32/32. Verdict:
  `FOUNDATION_AMENDMENT_REQUIRED` (unchanged). Moved here from "Latest Review" now that those sections
  describe `M0-ADR-0004-AUTHORITY-PROVENANCE-CLOSURE` instead, per this file's branch/task scoping
  (both entries share branch `m0/adr-0004-memory-context-authority` and PR #15). — branch
  `m0/adr-0004-memory-context-authority`

- 2026-08-21 — `M0-ADR-0004-MEMORY-CONTEXT-AUTHORITY` (PR #15, first draft/review round): semantic/
  architectural design task integrating MIHVER Brain / durable memory into Mihver Architect without
  violating `ADR-0001`/`ADR-0002`/`ADR-0003`. Phases 0–11 (memory retrieval, authority map, threat
  model, integration-model comparison — Model C selected over A/B/D, authority model, historical-
  user-memory rule, current-input precedence, procedural/semantic split, evidence boundary,
  reproducibility model, 20-case corpus, foundation impact) produced `ADR-0004`, `MEMORY_CONTEXT.md`,
  `MEMORY_CONTEXT_CASES.md`. Four independent read-only Codex reviewers by interaction axis (A: memory
  × epistemic provenance; B: memory × stage isolation; C: memory × evidence/architecture; D:
  cross-axis adversarial) found real, independently-verified defects, all fixed after Claude
  independently re-verified each: most significantly, an under-classified `INTENT_SPEC.md`/
  `REQUIREMENT_SPEC.md` dependency (citing a `MemoryContext` entry as an Inference's premise
  genuinely broadens both documents' frozen premise/provenance models, requiring
  `SEMANTIC_AMENDMENT_REQUIRED`, not `CLARIFICATION_ONLY`); an Inferred/Assumed blurring risk closed
  with a "No Assumed-Origin Path for Memory" section; a cross-project loophole in Case 3; Phase 11's
  under-counted stage list (missing Architecture Synthesis); a reproducibility gap (bare hash/pointer
  insufficient, actual content copy required); Principle 5's five properties understated as four;
  a "procedural" search-influence risk that could functionally exclude candidates without formally
  excluding any; a frozen-snapshot/post-hoc-fact conflict resolved by splitting Reproducibility into
  production-time vs. consuming-artifact-provenance facts; an R-19 misuse in Case 16; a terminology
  slip in Case 14; an Architecture-Synthesis/EvidenceBundle factual error in Case 20; an
  inference-from-absence defect in Case 17. `npm test`: 32/32. Verdict: `FOUNDATION_AMENDMENT_REQUIRED`
  (not `REDESIGN_REQUIRED` — no reviewer found Model C unsound; not `READY_FOR_HUMAN_REVIEW` — the
  `INTENT_SPEC.md`/`REQUIREMENT_SPEC.md` amendment dependency is real and unmet). Moved here from
  "Latest Review" now that those sections describe `M0-ADR-0004-CROSS-BOUNDARY-REMEDIATION` instead,
  per this file's branch/task scoping (both entries share branch
  `m0/adr-0004-memory-context-authority` and PR #15, since this was a continuation, not a new
  branch). — branch `m0/adr-0004-memory-context-authority`

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
