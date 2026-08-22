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

Task: M0-MEMORY-CONTEXT-SCHEMA-FOUNDATION
Branch: `m0/memory-context-schema-foundation`
PR: to be opened against `mihvernetwork/mihver:main` (title `M0: add MemoryContext schema
foundation`) — not yet created as of this entry

Creates the first machine-readable JSON Schema and deterministic validator for the Accepted
`MemoryContext` semantic contract (`schemas/m0/memory-context.schema.json`, a `validateMemoryContext`
function in `tests/contracts/validate-contracts.mjs`, 22 new fixtures, and a new
`docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`), plus a minimal `ROADMAP.md`/`CONTEXT_INDEX.md`
sequencing correction. Does not enable any new `MemoryContext` consumer, does not implement Brain
retrieval/runtime, and does not touch `MEMORY_CONTEXT.md`, `ADR-0004`, `M0_SCOPE.md`,
`INTENT_SPEC.md`, `intent-spec.schema.json`, or `REQUIREMENT_SPEC.md`.

### Review — three fresh independent read-only Codex reviewers

Per this task's explicit instruction: Reviewer A (Schema ↔ Accepted Contract Coverage), Reviewer B
(Epistemic Authority / Provenance), Reviewer C (Lifecycle / Evolvability / Future References). All
three independently converged on overlapping findings; every finding was independently re-verified
by Claude by directly re-reading the cited `MEMORY_CONTEXT.md` text and re-tracing the actual schema/
validator code before any fix was applied.

- **M-04 (superseded record never admitted as live) — confirmed by Reviewers A and C.** The
  validator checked only `source.brain_status === "superseded"`; `MEMORY_CONTEXT.md`'s M-04
  explicitly names a second, independent disqualifying signal ("`status: superseded`, **or linked
  via** `supersedes`/`superseded_by`") the validator never examined — an admitted entry could carry
  `brain_status: "active"` with a non-null `superseded_by` and still pass. Independently re-verified
  by quoting M-04's exact text. Fixed: an admitted entry with a non-null `superseded_by` is now also
  rejected. New invalid fixture (`memory-context-superseded-by-link-admitted.json`) proves the fix.
- **M-11 / Historical User Provenance Gate type-independence — confirmed by Reviewers A and B.**
  The validator forced every `lesson`/`playbook`-typed entry to `influence_tier: "PROCESS_ONLY"`
  unconditionally on stored `brain_type` alone. Independently re-verified against `MEMORY_CONTEXT.md`'s
  "Semantic Authority Classes" section, which explicitly states every classification word including
  "always"/"permanently" is conditioned on content inspection, and that only `inbox` is a genuine,
  unconditional, type-determined exclusion — a misfiled `lesson`/`playbook` whose content
  content-inspection reveals as a historical user statement is redirected to the Category A/B gate
  exactly as a misfiled `decision`/`reference` would be. The prior code silently reintroduced the
  "lesson/playbook are an unconditional exception" reading the contract explicitly rejects — a real
  authority-suppression defect (it could force a Category A entry down to `PROCESS_ONLY`) and,
  structurally, the same class of error as an authority-inflation bug. Fixed: the `PROCESS_ONLY`-only
  rule is now conditioned on `!classification.is_historical_user_statement`. New valid fixture
  (`memory-context-misfiled-lesson-category-a-semantic-premise.json`) proves a misfiled `lesson` can
  now correctly reach `SEMANTIC_PREMISE` via genuine Category A reclassification.
- **M-14 (audit-trail completeness for excluded entries) — confirmed by Reviewer A.** `excludedEntry`
  carried only `entry_id`/`brain_memory_id`/`brain_type`/`exclusion_reason`, missing the retained
  content copy, scope/provenance, and (where actually attempted) classification/freshness facts M-14
  requires for "which memories were retrieved" generally, not only admitted ones. Independently
  re-verified against M-14's literal list. Fixed: redesigned `excludedEntry` with a new
  `excludedSourceRecord` $def (full source metadata, `inbox` permitted) and `exclusionClassification`
  $def (identical to `classification` minus `influence_tier`, since an excluded entry is never
  assigned a tier) — both nullable, since some exclusions (`inbox`-type, mechanical scope mismatch)
  genuinely happen before any classification is attempted, per Cases 3/12/13. New valid fixture
  (`memory-context-excluded-fail-closed-unclassifiable.json`) exercises the case where classification
  *was* attempted (non-null) but no tier could be defensibly assigned.
- **M-19 mapping overclaim — confirmed by Reviewers A and B; Reviewer B constructed a working
  counterexample.** The mapping document classified M-19 "Validator-enforced." Reviewer B constructed,
  on paper, a document whose `classification_basis` prose itself describes a competing/ambiguous
  reading while the structured `classification_ambiguity` field is left `null`, claiming
  `DECISION_OPTION` — the validator checks consistency *between* structured fields, not whether
  free-text `classification_basis` is honestly reflected in them, so this passes. Independently
  reconstructed the counterexample against the actual schema/validator and confirmed it validates.
  Fixed: reclassified M-19 (and, for the identical reason — a real, named, unenforceable remnant of
  each full invariant — M-11 and M-16) from "Validator-enforced" to "Not enforceable at this layer,"
  consistent with this document's own stated discipline that a row stays in that class even given a
  strong partial guard. No code fix is possible or appropriate for the honesty-dependent gap itself
  (verifying prose-to-field consistency is exactly the kind of semantic judgment Principle 6/7 reserve
  from a deterministic layer); the mapping document now says so explicitly instead of overclaiming.
- **Fixture accuracy — confirmed by Reviewer B.** Three valid fixtures declared
  `classification_method: "deterministic"` while their own `classification_basis` text described
  reading/interpreting body content — heuristic by the contract's own Principle-6-grounded
  definition. Fixed: corrected to `"heuristic"` in all three.
- Every other check across all three reviewers (RunContext presence/absence disjointness, open
  `consuming_stage` identifier, retrieval-outcome cardinality, entry-identity uniqueness, the
  Category A/B gate's genuine type-independence for `reference`/`pattern`/`incident`/`project`, the
  identity boundary preventing `pattern`/`incident`/`reference` from ever reaching `SEMANTIC_PREMISE`,
  Brain-confidence/relevance structural separation from authority, `INTENT_SPEC.md`/
  `REQUIREMENT_SPEC.md`/`intent-spec.schema.json` untouched, `ROADMAP.md` not claiming the schema
  exists pre-merge) was independently re-checked and confirmed clean — not merely trusted from the
  reviewers' own "Pass" verdicts.

`npm test`: 54/54 (32 original + 9 valid + 13 invalid `MemoryContext` fixtures). `git diff --check`:
clean. `git diff main --stat`: exactly three modified files (`.project/CONTEXT_INDEX.md`,
`ROADMAP.md`, `tests/contracts/validate-contracts.mjs`) plus the new untracked files
(`schemas/m0/memory-context.schema.json`, `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`,
`tests/contracts/fixtures/{valid,invalid}/memory-context-*.json`,
`.project/CURRENT_TASK.md`/`REVIEW_STATE.md`). Targeted `git diff main --stat` against every
forbidden file (`MEMORY_CONTEXT.md`, `ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`,
`INTENT_SPEC.md`, `intent-spec.schema.json`, `REQUIREMENT_SPEC.md`, `M0_SCOPE.md`, `PRINCIPLES.md`,
`VISION.md`) produced empty output, confirming none changed. No `mihver-brain` file touched. No new
`MemoryContext` consumer authorized; no Dependency B/C/D implemented; no runtime/MCP/network code
introduced.

**Final recommendation: `READY_FOR_HUMAN_REVIEW`.** Neither STOP condition
(`SEMANTIC_AMENDMENT_REQUIRED` / `SCHEMA_DESIGN_GAP`) applies: every finding was a schema/validator/
documentation defect fixable without touching the Accepted semantic contract, and every fix was
independently re-verified against the actual contract text and re-confirmed by a full test re-run
(54/54) after each round of changes.

## Required Changes

None remaining — all five confirmed finding clusters (M-04, M-11, M-14, M-19-and-related
reclassifications, and the three mislabeled fixtures) are fixed by this same change set, each with a
new or corrected fixture demonstrating the fix.

## Fixes Applied

See "Latest Review" above for the full list. Applied to `schemas/m0/memory-context.schema.json`
(added `excludedSourceRecord`/`exclusionClassification` $defs, redesigned `excludedEntry`),
`tests/contracts/validate-contracts.mjs` (added the `superseded_by` check, conditioned the
lesson/playbook rule on `is_historical_user_statement`, extended classification-consistency checks
to `excluded_entries`), three existing valid fixtures (`classification_method` correction), the
existing `memory-context-excluded-entries-audit-trail.json` fixture (updated to the redesigned
`excludedEntry` shape), and `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md` (M-04/M-11/M-14/M-16/
M-19 rows rewritten). Three new fixtures added, each proving one specific fix.

## Pending Human Gate

Commit, push, and open one PR against `mihvernetwork/mihver:main`, title `M0: add MemoryContext
schema foundation`, per this task's explicit instruction. Not merged by this task. Human review of
that PR is the next gate; it authorizes only this schema/validator/fixture/mapping-doc foundation —
not any new `MemoryContext` consumer, not Dependencies B/C/D, and not any Brain read adapter or
runtime integration.

## History

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
