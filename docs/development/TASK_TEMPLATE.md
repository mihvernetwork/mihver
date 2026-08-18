# Task Template

Copy this shape for new MIHVER task prompts — this is the **human → Claude** shape. It is not the
Claude → Codex worker contract; when Claude delegates part of a task to Codex, Claude expands this
task's Objective/Scope into the full seven-field contract defined in
[AGENT_POLICY.md](./AGENT_POLICY.md) ("Task Contract": TASK ID / ROLE / OBJECTIVE / ALLOWED SCOPE /
FORBIDDEN SCOPE / EXPECTED OUTPUT / VALIDATION) for that specific worker — the human doesn't write
that contract directly. Permanent policy lives in [CLAUDE.md](../../CLAUDE.md),
[AGENT_POLICY.md](./AGENT_POLICY.md), and [REVIEW_PROTOCOL.md](./REVIEW_PROTOCOL.md) — reference
it, don't repeat it. A filled-in prompt using this shape should normally run **10–30 lines**; the
blank shape below is longer only because every section is shown, including ones a given task may
leave blank or omit (e.g. "Codex" when no delegation is needed).

```markdown
# <TASK-ID> — <TITLE>

Follow `CLAUDE.md`.

## Objective

<one bounded objective>

## Files / Scope

<allowed scope>

## Requirements

- ...
- ...

## Forbidden

- ...
- ...

## Git

Branch: <task branch name, if the human supplied one — never invent one if not stated>
Base: <default: main>
Commit allowed: <default: no>
Push allowed: <default: no>
PR expected: <default: no>

## Codex

<which independent worker/reviewer is useful, if any>

## Completion

<expected validation and final status — APPROVED / APPROVE WITH REQUIRED CHANGES / REDESIGN,
or READY TO FREEZE / NOT READY TO FREEZE for a milestone>

Then stop.
```

### Git field defaults

When a task prompt omits the `## Git` section, or leaves individual fields blank, assume:

```text
Base: main
Commit allowed: no
Push allowed: no
PR expected: no
```

`Branch` has no silent default — if the human hasn't supplied one and the task requires branch
work, ask rather than inventing a name. If a branch was already established in an earlier task
(e.g. the current task continues prior in-progress work), reuse it rather than creating a new one
or switching away from it.
