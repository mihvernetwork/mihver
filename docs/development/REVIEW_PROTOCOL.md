# Review Protocol

Permanent policy. Referenced by [CLAUDE.md](../../CLAUDE.md); not restated in individual task
prompts.

## Completion Checklist

Before declaring any MIHVER task complete, Claude must:

1. **Review worker outputs critically** — a Codex worker's conclusion is not automatically true;
   read it as a claim to be checked, not a finding to be relayed.
2. **Reject unsupported material recommendations** — explicitly, not by silently omitting them. If
   a worker's finding lacks a traceable basis (a quoted file/line, a reproducible observation), say
   so and decline it. "Material" means it would change what gets built, changed, or reported if
   accepted — trivial or duplicate suggestions don't need individual adjudication in the report.
3. **Check relevant architectural invariants** — whichever of the frozen `PRINCIPLES.md`, the
   current milestone scope, and contract-level invariants (e.g. `INTENT_SPEC.md`'s I-01–I-18) the
   task actually touches; this is scoped by relevance, not a blanket re-read of every foundation
   document on every task (see CLAUDE.md's "read only what's relevant").
4. **Verify frozen files were not changed unexpectedly** — know, going in, which files are frozen
   for this task, and confirm afterward that only the intended files changed.
5. **Inspect `git status`**, at minimum after the work — before-and-after is most useful when the
   task involves or could involve file changes; for a purely read-only task this can be a single
   confirming check rather than a full before/after comparison.
6. **Inspect the relevant diff** — `git diff` / `git diff --stat` — when the task changed any
   file; read it, don't just note that it exists.
7. **Run applicable deterministic validation** where practical (tests, schema checks, lint,
   `npm run check:project-consistency` where the task touched a file that script covers) — for
   documentation/architecture work this may be limited to consistency review; don't skip it where
   it does apply.
8. **Run the Final Consistency Sweep** (below) before reporting the task ready for human review —
   not merely "semantic reviewers passed."
9. **Report unresolved ambiguity and risk** — a clean-looking report that hides an open question is
   worse than one that names it.
10. **Stop before the next task.** Completing the current task is not authorization to begin the
    next one.

## Final Consistency Sweep

Semantic review checks that the change is *correct*. It does not, by itself, check that the change
left the rest of the repository's development documents *consistent* — that is a distinct, mandatory
final phase, not an optional nicety:

```text
implementation
  → semantic review
  → fixes
  → final repository-wide consistency sweep
  → targeted CONDITIONAL CONSISTENCY fixes (see AGENT_POLICY.md's Task File Scope Model)
  → deterministic validation
  → READY_FOR_HUMAN_REVIEW
```

The sweep examines, as applicable to what the task actually touched: owning documents; current-state
mirrors (`.project/PROJECT_STATE.md`'s Current Capability Snapshot, `ROADMAP.md`); navigation files
(`.project/CONTEXT_INDEX.md`); direct heading references that quote another file's section title;
status tokens (`DONE` / `NEXT` / `RETIRED` / `Proposed` / `Accepted`); consumer counts / stage lists;
old "pending" / "not authorized" / "still future" statements a completed task has now made stale;
test-count mirrors; merge/PR references; historical-vs-current tense; case-corpus introductory status
language; schema-mapping current-state prose.

The sweep must distinguish a **historical quote** (a checkpoint or log entry correctly describing a
past state — leave it alone) from a **live/current assertion** (a mirror or navigation statement
claiming to describe *now* — fix it if it's wrong). Never blindly global-replace a phrase; a
mechanical search still needs a human/Claude judgment call at each hit for exactly this reason. See
`AGENT_POLICY.md`'s Document Authority Model for the Owner/Mirror/Historical distinction this sweep
is checking.

**Proportionality.** A tiny, isolated change (a wording fix, a single-file typo correction, a change
with no owning-fact implications) needs only a lightweight sweep — confirm by inspection that nothing
else references what changed; it does not need a dedicated review round or a separate report section.
A change to a contract, ADR, foundation document, or any status/current-state field needs a
repository-wide sweep of the files listed above that are actually relevant to what changed. Do not
manufacture process for a change that has no consistency surface to sweep.

**Verdict progression.** For a task with a non-trivial consistency surface, track:

```text
IMPLEMENTATION_COMPLETE → SEMANTIC_REVIEW_COMPLETE → CONSISTENCY_SWEEP_COMPLETE → READY_FOR_HUMAN_REVIEW
```

A task is `READY_FOR_HUMAN_REVIEW` only after the consistency sweep stage, never straight from
`SEMANTIC_REVIEW_COMPLETE`. For a tiny task under the proportionality rule above, these stages may
collapse into one pass — the point is that the sweep happened, not that it produced its own separate
verdict label every time.

## When Independent Review Is Recommended or Required

- **Architecture and contract work** (foundation documents, ADRs, semantic contracts, schemas):
  an independent Codex review pass — a worker that didn't author the material, checking it against
  the frozen invariants and against itself for internal consistency — is *recommended* for any
  substantive new document, and **required** (not optional) before any milestone freeze decision.
  A small, mechanical edit to existing architecture text (typo, broken link, wording clarification)
  does not need its own review pass.
- **Implementation work** (code, scripts, configuration): require tests or another form of
  deterministic validation where practical, in addition to review. Review alone does not substitute
  for running something and observing the result, when running it is possible.

## Outcomes

Every ordinary (non-freeze) task review passes through one of three dispositions:

```text
APPROVED                      — meets its objective; no material issues found.
APPROVE WITH REQUIRED CHANGES — an interim disposition, not a final report state: the listed
                                 changes are applied immediately (by Claude, or by a Codex worker
                                 whose scope already covers the affected files — never treated as
                                 blanket new write authority beyond the original or an explicitly
                                 expanded scope), then the work is reassessed. The task's *final*
                                 reported outcome is then APPROVED (changes resolved the issues) or
                                 REDESIGN (they didn't — the approach itself needs to change).
REDESIGN                      — the approach itself is wrong; do not patch forward, restart the
                                 design.
```

A milestone-freeze review is a distinct kind of review, not a fourth task outcome layered on top
of the three above — it uses its own vocabulary instead:

```text
READY TO FREEZE      — the milestone's artifacts are internally consistent, invariants hold, and
                        no known contradiction remains unresolved or unreported.
NOT READY TO FREEZE  — at least one material issue remains; name it rather than freezing anyway.
```

A milestone is never marked `READY TO FREEZE` merely because time was spent reviewing it — the
outcome reflects what was actually found, including "nothing wrong, but also not independently
reviewed" as a reason to withhold freeze when independent review was required (see above) and
skipped. A `NOT READY TO FREEZE` verdict names the specific issues; resolving them follows the
ordinary task disposition above (fix, then reassess) before freeze is reconsidered.

Separately: Claude reporting a task as `APPROVED` is Claude's own technical assessment, not human
sign-off. The human's approval to proceed to the next MIHVER step is a distinct gate that happens
after Claude's report, per the Authority Hierarchy in
[AGENT_POLICY.md](./AGENT_POLICY.md).

## PR Merge Readiness

When a task's work is delivered via a Pull Request (see "Git & Branch Workflow" in
[AGENT_POLICY.md](./AGENT_POLICY.md)), the same task-outcome vocabulary applies to the PR itself: a
PR may be considered merge-ready only once Claude's review of the work reaches `APPROVED` — never
while it stands at `APPROVE WITH REQUIRED CHANGES` (interim) or `REDESIGN`. Reaching `APPROVED` is
still Claude's technical assessment, not the merge decision — the human's PR approval and the
actual merge remain a separate, later gate per the Authority Hierarchy. Claude and Codex reaching
`APPROVED` on their own review is never treated as authorization to merge.
