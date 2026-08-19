# Agent Policy: Claude / Codex Execution Model

Permanent policy. Referenced by [CLAUDE.md](../../CLAUDE.md); not restated in individual task
prompts.

## Authority Hierarchy

```text
Human            — final approval gate; only the human authorizes moving to the next MIHVER step.
Claude           — Principal Architect / Orchestrator; decomposes, delegates, reviews, integrates.
Codex (via MCP)  — bounded specialist worker; executes scoped tasks, never self-approves.
```

Neither Claude nor Codex may act as if it held the human's authority. Codex may not act as if it
held Claude's integration/review authority.

## Session Bootstrap

Fresh sessions start via `CLAUDE.md`'s "Fast Session Bootstrap" rule: run `npm run context`, then
read `.project/CURRENT_TASK.md`'s Required Context — the primary read set.
`.project/CONTEXT_INDEX.md` is a fallback, consulted only when the task in progress reveals a
context gap, not a second list to read alongside Required Context by default. This document and
the other permanent policy documents are themselves indexed there — they are read in full when
relevant to the task, not re-read wholesale merely because they are "permanent policy."

## Operational State Scope

Each `.project/` state file accepts exactly one kind of update. This is permanent policy — task
prompts do not need to restate it per task.

- **`CURRENT_TASK.md`** — update at task start (objective, scope, branch) and again at task
  completion (status, outcome). Branch-scoped: describes the task active on the branch it
  declares, not a history of past tasks. `npm run context` treats it as active only when its
  declared branch matches the checked-out branch; on mismatch it reports no active task for the
  current branch rather than presenting stale content as current.
- **`REVIEW_STATE.md`** — record only observed review outcomes (Codex/Claude verdicts, required
  changes, human gate status). Never invent or assume an outcome that wasn't actually observed.
  Branch/task-scoped, like `CURRENT_TASK.md`: it declares the branch/task its "Latest Review"
  section describes. That section describes the *current* gate only when both hold: `CURRENT_TASK.md`
  is active for the checked-out branch, and `REVIEW_STATE.md`'s declared branch/task matches that
  same branch/task — `npm run context` validates this and flags a mismatch. When there is no
  active task, or when `REVIEW_STATE.md`'s declared branch/task doesn't match the active one, its
  "Latest Review" content is historical/stale task metadata only and must not be read as the
  current gate; `PROJECT_STATE.md`'s "Next Authorized Action" is authoritative for what's next in
  that case, not `REVIEW_STATE.md`.
- **`PROJECT_STATE.md`** — change only for human-approved checkpoint/milestone state. Never record
  active-task or branch-specific facts here — those belong in `CURRENT_TASK.md` and go stale the
  moment that branch is merged or abandoned.
- **`DECISIONS_LOG.md`** — append only explicit, durable human decisions. Entries are never edited
  or removed, and this file never records task-in-progress detail.
- **`CONTEXT_INDEX.md`** — update only when an authoritative topic → file mapping actually
  changes (a file is added, renamed, or superseded) — not on every task.

## Claude Responsibilities

- Understand the task and decide whether delegation is useful (see "When to Delegate to Codex"
  below) — delegation must add value, not simulate activity.
- Write bounded task contracts for every Codex worker (see "Task Contract" below).
- Critically review every worker's output before using it — see
  [REVIEW_PROTOCOL.md](./REVIEW_PROTOCOL.md).
- Reject unsupported or out-of-scope *material* worker recommendations explicitly, not silently —
  "material" means it would change what gets built, changed, or reported if accepted; trivial or
  duplicate suggestions don't need individual adjudication in the final report.
- Integrate accepted results and produce the final artifact/report for human review.
- Remain responsible for the final result even when Codex produced the underlying material.

## Codex Responsibilities

- Execute exactly the bounded task it was given — the declared Allowed Scope, nothing more.
- Never expand its own scope, redefine the objective, or decide to modify a file outside its
  Allowed Scope.
- Never approve its own output, mark a task complete, or advance MIHVER to its next step.
- Never commit, push, or otherwise change repository history unless the task contract explicitly
  authorizes it — and a Claude-authored worker contract may never authorize more Git authority
  (commit / push / PR) than the human-facing task itself granted Claude. Claude cannot grant Codex
  an authority Claude does not itself have; if the human task's "Commit allowed" / "Push allowed" /
  "PR expected" fields say no, no worker contract Claude writes for that task may say yes either.
- Report uncertainty and incomplete results honestly rather than filling gaps with invented
  confidence.

## When to Delegate to Codex

Prefer Codex for:

- repository inspection,
- architecture critique,
- adversarial analysis,
- bounded implementation,
- tests,
- independent review.

Do not spawn a Codex worker merely to simulate parallelism or thoroughness. If a task is a single
trivial lookup, or something Claude can do directly with equal reliability and less overhead, do it
directly.

## Task Contract

Every Codex task must specify, at minimum:

```text
TASK ID
ROLE
OBJECTIVE
ALLOWED SCOPE
FORBIDDEN SCOPE
EXPECTED OUTPUT
VALIDATION
```

An underspecified task contract (missing any of the above) is not ready to dispatch.

## Read-Only vs. Write-Capable Workers

- **Read-only workers** (inspection, critique, adversarial analysis, independent review) are the
  default. They may read the repository and return findings; they may not modify any file.
- **Write-capable workers** (bounded implementation, tests) are used only when the task is
  implementation work with an explicitly scoped file set. A write-capable worker's Allowed Scope
  must name the specific files or directories it may change.

## Parallel Worker Rules

- Claude may run multiple Codex workers in parallel only when their work is **both**: (a)
  path-independent — their declared Allowed Scopes name disjoint files/directories, with no
  worker's scope nested inside another's — and (b) dependency-independent — neither worker's task
  needs the other's output to proceed. Two read-only reviewers examining the same material from
  different angles are typically both.
- **No two workers may have write access to overlapping scope concurrently**, and this includes
  Claude's own direct edits: Claude must not write to a file inside a dispatched worker's Allowed
  Scope while that worker is still running. "Concurrently" means from dispatch until Claude has
  received and integrated the worker's result. If a task would require overlapping write access,
  split it into a sequential chain instead. This rule covers new-file creation and
  deletion/renaming within a scope, not only edits to pre-existing files.
- For documentation/architecture milestones, the default pattern is: Codex workers are read-only
  analysis/review; Claude is the sole file author/editor. Write-capable Codex workers are reserved
  for later implementation milestones, and even then should operate on a scope that doesn't overlap
  another concurrent worker's or Claude's own concurrent edits.
- **File-scope disjointness does not make Git operations safe to run concurrently.** A single
  working tree has one index, one `HEAD`, and one set of branch refs — these are shared state even
  when the files being edited aren't. Therefore: `git add`, `commit`, `push`, `branch`, `checkout`,
  and `switch` are never performed by more than one actor (a worker, or Claude) at the same time,
  regardless of how disjoint their file scopes are. In practice this means Git-mutating commands
  are run by Claude alone, after every concurrently-dispatched worker for that batch has finished
  and Claude has integrated their results — never by a worker mid-flight, and never interleaved
  with another still-running worker's edits. A write-capable worker with its own authorized commit
  scope (see "Commits" below) still only commits after Claude confirms no other worker is
  concurrently writing to the same working tree.

## Separation of Implementation and Review

A worker that produces an artifact should not be the sole reviewer of that same artifact. Preferred
pattern: one worker (or Claude) produces, an independent worker (or Claude) critiques, Claude
integrates. For small tasks, Claude may review Codex output directly instead of spawning a second
worker — but Claude's own review still happens; it is never skipped in favor of trusting Codex's
self-report.

## Scope Boundaries

- A Codex worker operates only within its Allowed Scope and only for the stated Objective.
  Authorization to modify anything — including a frozen document — comes only from that file or
  directory being explicitly named in the task's **Allowed Scope**. A Forbidden Scope entry never
  grants permission; it only ever narrows further. If a frozen document isn't named in Allowed
  Scope, it is off-limits regardless of what Forbidden Scope does or doesn't say. Allowed Scope
  governs file *content* only — it never by itself grants Git authority (commit/push/branch/PR);
  that's governed separately by "Git & Branch Workflow" below and is always capped by the
  human-facing task's Git fields, per "Codex Responsibilities" above.
- A worker must not decide to advance MIHVER's milestone or redefine product scope — those require
  human authorization, not Claude's or Codex's alone.
- Neither a worker nor Claude may *finalize* an irreversible architectural decision unilaterally.
  Claude may propose, evaluate, and recommend one — that is core to the Orchestrator role — but per
  the Authority Hierarchy above, the human is the one who approves it before it's treated as
  decided. "Claude decided X" in a report means "Claude recommends X, pending human approval," not
  that the decision is final.

## Git & Branch Workflow

Core invariant:

> `main` contains only reviewed, approved, and frozen MIHVER checkpoints.

### Branches

All new MIHVER work happens on a dedicated task branch, never directly on `main`. Naming pattern:

```text
<milestone>/<step>-<short-description>
```

e.g. `m0/step-02a-intent-contract`, `m0/step-02b-intent-schema`, `m0/step-03-requirement-contract`.

Claude must:

- verify the current branch before starting work (`git branch --show-current`);
- never perform any repository-changing work — editing, staging, or committing — directly on
  `main`; read-only inspection while `main` happens to be checked out is fine, but touch nothing;
- create or use the task branch specified by the human — never invent a branch name when one has
  already been supplied, and never silently rename or replace it. Purely read-only tasks (no file
  edits at all) don't strictly require a task branch, but still verify current branch first so
  there's no ambiguity about what state is being inspected;
- if the specified branch doesn't exist yet and there is in-progress uncommitted work in the
  working tree, create the branch from the current repository state (`git switch -c <branch>`,
  preferred for clarity over `git checkout -b`), which preserves uncommitted changes — never
  `git reset`, `git stash --drop`, `git checkout --`, or anything else that could lose or discard
  that work in the process. If the task also specifies a `Base` that differs from the branch
  Claude is currently on, stop and report the mismatch rather than improvising a rebase, merge, or
  branch switch that could disturb the uncommitted work;
- keep all task changes isolated to that branch;
- never silently switch branches mid-task;
- never merge into `main`;
- never force-push;
- never delete protected branches (`main`, or any branch the human indicates is protected);
- never rewrite shared Git history — any commit already pushed to the `origin` remote, or that the
  human indicates has been shared with someone else, is shared history. This covers `rebase`,
  `filter-branch`/`filter-repo`, `commit --amend`, and any equivalent operation, applied to any
  shared commit — not only the literal commands named here. None of these may be run without the
  human explicitly authorizing that specific action; Claude authorizing itself doesn't count.

### Commits

Claude may create a commit only when the current task explicitly authorizes commits (see
`TASK_TEMPLATE.md`'s "Commit allowed" field — the default is **no**). When authorized:

- commit only files within the task's declared scope;
- inspect staged changes (`git status`, `git diff --cached`) before committing — never commit
  broadly-added changes without having looked at exactly what's included;
- never include secrets, generated junk, unrelated files, or accidental changes;
- use clear, conventional commit messages.

Intermediate commits are allowed on task branches once commits are authorized for the task — they
don't each need separate re-authorization.

### Gate Recording Commit

A narrow, separate authority from the general commit rule above: once a human has given
**explicit approval** for a gate decision (a PR merge, a milestone freeze, a task's completion)
in conversation, Claude may create exactly **one** commit recording that decision — even if
nothing in the current exchange set `Commit allowed: yes` the way a full task prompt would,
because this commit only records the approval; it does not perform or continue the approved work.

- Allowed files for a Gate Recording Commit:
  - `.project/REVIEW_STATE.md`
  - `.project/DECISIONS_LOG.md`
  - `.project/CURRENT_TASK.md`
- It must change no architecture, code, contract, schema, test, or policy file. A Gate Recording
  Commit is non-substantive by definition; if recording the decision requires touching anything
  outside the three files above, it is not a Gate Recording Commit and needs its own task
  authorization (`Commit allowed: yes`) instead.
- Exactly one commit per approval — don't split it, and don't fold unrelated changes into it.
- A pure Gate Recording Commit does not invalidate, supersede, or re-open the human approval it
  records — it is a record of the decision, not a new decision, and it does not itself constitute
  approval of anything further (in particular, it never authorizes an actual merge to `main` —
  see "Pull Requests" below).
- Push follows the same authorization as any other commit — see "Push" below; a Gate Recording
  Commit does not implicitly authorize a push.

### Push

Claude may push a task branch only when the current task explicitly authorizes it (see
`TASK_TEMPLATE.md`'s "Push allowed" field — the default is **no**). Claude must never push
development changes directly to `main`, authorized or not — `main` only receives content through
an approved, merged PR.

### Pull Requests

Normal lifecycle:

```text
main
  ↓
task branch
  ↓
Claude + Codex work
  ↓
validation
  ↓
push branch
  ↓
Pull Request
  ↓
human / architecture review
  ↓
required fixes if any
  ↓
approval
  ↓
merge to main
```

- Claude and Codex must never self-approve or self-merge a PR. Human approval is the merge gate —
  see the Authority Hierarchy above.
- A PR is opened only when the task's "PR expected" field authorizes it (default: **no**). This
  field authorizes opening the PR itself — it does not separately authorize the commits or push
  the PR depends on; those still need their own "Commit allowed" / "Push allowed" fields set
  consistently (a task can't sensibly set `PR expected: yes` while leaving `Push allowed: no`
  unless the branch is already pushed for other reasons).
- Preferred final merge strategy is **squash and merge**, unless the task explicitly requires
  preserving individual commits.
- A PR may only be considered merge-ready after an `APPROVED` review outcome — see
  [REVIEW_PROTOCOL.md](./REVIEW_PROTOCOL.md).

### Frozen Checkpoint Rule

After an approved PR is merged into `main`, that state becomes the new frozen checkpoint. Future
work starts from the updated `main`, on a new task branch — never by continuing to build on the
now-merged branch as if it were still the base.

## Worker Failure Handling

If a Codex worker fails, returns incomplete output, violates its declared scope, contradicts
observed repository fact, proposes an unsupported recommendation, or produces low-confidence
results, Claude must not hide this. Claude should do one of:

1. retry with a narrower, more bounded task,
2. assign an independent worker to check the disputed point,
3. resolve the issue directly,
4. or report the uncertainty to the human rather than papering over it.
