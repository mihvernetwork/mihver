# Task Template

Copy this shape for new MIHVER task prompts — this is the **human → Claude** shape. It is not the
Claude → Codex worker contract; when Claude delegates part of a task to Codex, Claude expands this
task's Objective/Scope into the full seven-field contract defined in
[AGENT_POLICY.md](./AGENT_POLICY.md) ("Task Contract": TASK ID / ROLE / OBJECTIVE / ALLOWED SCOPE /
FORBIDDEN SCOPE / EXPECTED OUTPUT / VALIDATION) for that specific worker — the human doesn't write
that contract directly. Permanent policy lives in [CLAUDE.md](../../CLAUDE.md),
[AGENT_POLICY.md](./AGENT_POLICY.md), [REVIEW_PROTOCOL.md](./REVIEW_PROTOCOL.md), and
[CODEX_ROLES.md](./CODEX_ROLES.md) — reference it, don't repeat it. A filled-in prompt using this shape should normally run **10–40 lines**; the
blank shape below is longer only because every section is shown, including ones a given task may
answer tersely ("none") or omit (e.g. "Codex" when no delegation is needed). The three file-scope
tiers, "Owning Facts Changed", and "Required Final Consistency Sweep" exist to be filled in briefly,
not to force a long prompt — see `AGENT_POLICY.md`'s "Task File Scope Model" and
`REVIEW_PROTOCOL.md`'s "Final Consistency Sweep" for what each is actually asking.

```markdown
# <TASK-ID> — <TITLE>

Follow `CLAUDE.md`.

## Objective

<one bounded objective>

## Which facts become stale elsewhere if this succeeds?

<required before implementation begins — name the mirrors/navigation files that restate a fact this
task's Primary Files own, so Conditional Consistency scope below is decided up front, not discovered
mid-task. "None" is a valid answer for a task with no consistency surface.>

## Files / Scope

Three-tier model — see `AGENT_POLICY.md`'s "Task File Scope Model" for the full policy.

**Primary Files** — modified to deliver the objective itself:
- ...

**Conditional Consistency Files** — may be touched only to fix a statement this task's Primary
change made factually stale, or a direct cross-reference it broke; synchronization only, no
semantic redesign; state why each one became necessary when it's actually touched:
- ...

**Forbidden Files** — outside this task's authority; a semantic-change need here means STOP and
report the contradiction, not edit:
- ...

## Required Context

<files a fresh session must read before starting this task — keep short; if omitted, Claude
derives it from `.project/CONTEXT_INDEX.md`'s entries for the topics this task touches>

## Requirements

- ...
- ...

## Owning Facts Changed

<which OWNER file(s)/section(s) (see AGENT_POLICY.md's Document Authority Model) does this task
change the meaning of, if any — "none" for a pure mirror/navigation/tooling task>

## Required Final Consistency Sweep

<proportional to "Owning Facts Changed" above — see REVIEW_PROTOCOL.md's Final Consistency Sweep;
"lightweight" for an isolated change, otherwise name the mirror/navigation files actually in scope>

## Durable-State Impact

- none
- post-merge reconciliation required
- task itself is state-only

## Publication

Branch: <task branch name, if the human supplied one — never invent one if not stated>
Base branch: <default: main — the PR target>
Base commit: <exact immutable SHA the branch is authorized to build on, if known at task start;
  otherwise Git Operator PREPARE reports the branch tip SHA it created, and that becomes this
  task's Base commit for every Publication Envelope going forward>
Git Operator PREPARE authorized: <yes/no — default: no>
Git Operator PUBLISH authorized: <yes/no — default: no>
PR expected: <yes/no — default: no>

Omitted publication capability defaults to **no**. A publishing task must have an exact branch
identity before Git Operator may mutate repository state — never invent one. `Base branch` and
`Base commit` are deliberately separate: `Base branch` is the moving PR target (normally `main`);
`Base commit` is the immutable ancestry anchor Git Operator verifies before every PUBLISH
(`git merge-base --is-ancestor <Base commit> HEAD`) — a `Base branch` that has since moved forward
must never silently redefine what this task was actually authorized to build on. See
`AGENT_POLICY.md`'s "Git Operator (preferred path for publication)" and `CODEX_ROLES.md`'s
"GIT_OPERATOR" section for what PREPARE/PUBLISH authorization actually permits, and the Publication
Envelope Claude must produce before PUBLISH may run — including the `Expected pre-publish HEAD`
guard and the Publication Fingerprint, neither of which is a task-prompt field; both are Claude's
own Envelope-time responsibility once the task's Publication fields above are set.

## Merge

**HUMAN ONLY.** No task field authorizes Claude, Codex, or Git Operator to merge a PR — see
`AGENT_POLICY.md`'s Authority Hierarchy.

## Codex

<which independent worker/reviewer is useful, if any>

## Completion

<expected validation and final status — APPROVED / APPROVE WITH REQUIRED CHANGES / REDESIGN,
or READY TO FREEZE / NOT READY TO FREEZE for a milestone>

Then stop.
```

### Publication field defaults

When a task prompt omits the `## Publication` section, or leaves individual fields blank, assume:

```text
Base branch: main
Base commit: unset — Git Operator PREPARE must establish and report one before any PUBLISH
Git Operator PREPARE authorized: no
Git Operator PUBLISH authorized: no
PR expected: no
```

`Branch` has no silent default — if the human hasn't supplied one and the task requires branch
work, ask rather than inventing a name. If a branch was already established in an earlier task
(e.g. the current task continues prior in-progress work), reuse it rather than creating a new one
or switching away from it.
