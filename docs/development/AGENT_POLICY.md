# Agent Policy: Claude / Codex Execution Model

Permanent policy. Referenced by [CLAUDE.md](../../CLAUDE.md); not restated in individual task
prompts.

## Authority Hierarchy

```text
Human
  ↓ authorization
Claude Orchestrator
  ├─ Codex Scout
  ├─ Codex Implementer
  ├─ Codex Verifier
  └─ Codex Reviewer
          ↓
   PublicationEnvelope
          ↓
Local Publication Builder (deterministic, non-LLM, network-free — local commit only)
          ↓
Publication Broker (privileged, non-LLM — NOT IMPLEMENTED, see CODEX_ROLES.md)
          ↓
        GitHub PR
          ↓
      Human review gate
          ↓
      Human-only merge
```

Claude decides, decomposes, delegates, adjudicates, and integrates. Codex performs bounded
inspection, implementation, verification, and independent review — never decides *what* to build,
never self-approves, never advances MIHVER to its next step, and never mutates Git/repository
publication state. Publication (local commit → push → PR) is a privilege-separated pipeline neither
Claude nor Codex is the credential holder for — see "Git & Branch Workflow" below and
[CODEX_ROLES.md](./CODEX_ROLES.md)'s "Publication Protocol". The human retains irreversible/
governance authority: final approval, and the only authority to merge. Neither Claude nor Codex may
act as if it held the human's authority. Codex may not act as if it held Claude's
integration/review authority. See [CODEX_ROLES.md](./CODEX_ROLES.md) for each Codex role's full
capability matrix and output contract; this file governs *whether/when* a role acts, not the role's
own internal contract.

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
  or removed, and this file never records task-in-progress detail. A durable entry should normally
  contain only what's needed later and nothing that can drift: date, task/decision identifier,
  result, PR number, merge SHA, a concise durable decision/result, and an authoritative-artifact
  pointer where useful — minimizing the entry's own future correction surface. Avoid recording
  ephemeral operational facts that belong in `CURRENT_TASK.md`/`REVIEW_STATE.md` instead and would
  only need factual correction later if copied here: exact task-start `HEAD` values, temporary
  branch/workspace state, narrated test-command sequences, or reviewer execution mechanics already
  captured in `REVIEW_STATE.md`'s history. Neither `CURRENT_TASK.md` nor `REVIEW_STATE.md` is itself
  semantic authority for anything — see the Document Authority Model above — and their detailed
  execution content should stay there rather than being copied into this log.
- **`CONTEXT_INDEX.md`** — update only when an authoritative topic → file mapping actually
  changes (a file is added, renamed, or superseded) — not on every task.

**Live PR state is GitHub-owned, not mirrored.** `CURRENT_TASK.md` and `REVIEW_STATE.md` must never
record a PR's open/closed/merged state as a present-tense snapshot (e.g. "not yet opened", "still
needs to be opened") — that phrasing goes false the moment `gh pr create` runs, which is exactly the
kind of drift this policy exists to prevent. Prefer stable wording that doesn't need a follow-up edit
just because GitHub's state changed underneath it:

```text
PR expected: yes
Target: main
Live PR identity/state: verify from GitHub
Human review is the next gate once the PR exists.
```

Once a PR number is known, recording it (`PR #29`) is fine and useful — but record only the number,
not a claim about its current open/closed/merged state, and do not treat that state changing later as
grounds for a commit whose only purpose is updating the state word.

## Document Authority Model

Every development-facing document — or, where one file legitimately mixes roles (e.g.
`.project/PROJECT_STATE.md`'s current-state "Current Capability Snapshot" section versus its own
historical "Frozen Steps / Checkpoints" bullets below it), each clearly delineated section within
it — falls into exactly one of three roles. This model exists to stop
a recurring pattern: an implementation lands cleanly, then a chain of follow-up "closure" tasks is
needed because the same mutable fact was duplicated in several files, or a historical checkpoint was
read as if it were still current. See `REVIEW_PROTOCOL.md`'s "Final Consistency Sweep" for the
process step that checks this model held; `scripts/dev/project-consistency.mjs`
(`npm run check:project-consistency`) mechanically checks a small, explicitly registered slice of it.

**OWNER** — the file/section that defines a fact or semantic rule. Only the owner may be amended to
change what the fact *is*. Examples: `docs/foundation/M0_SCOPE.md` (stage input/authority
ownership), `docs/contracts/INTENT_SPEC.md` (Intent semantics), `docs/contracts/REQUIREMENT_SPEC.md`
(Requirement semantics), `docs/contracts/MEMORY_CONTEXT.md` (MemoryContext semantics), an ADR (its
own `## Status` and architectural rationale), a schema/validator/test (machine-representation and
enforcement, where applicable).

**MIRROR / NAVIGATION** — a file that may summarize or point to an owner, but must never
independently redefine the same mutable fact. A mirror should prefer *status + pointer* over
restating the whole rule. Examples: `ROADMAP.md`, `.project/PROJECT_STATE.md`,
`.project/CONTEXT_INDEX.md`. When a mirror and its owner disagree, the owner is correct and the
mirror is stale — that is a synchronization edit, never a reason to re-litigate the owner's content.

**HISTORICAL RECORD** — a checkpoint or log entry that describes reality *at the time it was
written*. `.project/DECISIONS_LOG.md` entries and `PROJECT_STATE.md`'s "Frozen Steps / Checkpoints"
bullets are historical once committed: they are not rewritten merely because current reality later
changed. Current truth belongs in a dedicated current-state section or a later checkpoint instead —
see "Current Capability Snapshot" in `.project/PROJECT_STATE.md`. Do not chase every later change
with an "at the time... has since..." qualifier on the historical entry either; add one only when a
historical entry's present-tense wording would otherwise mislead a reader into thinking it still
describes today.

This model does not create a fourth kind of authority: a mirror repeating a fact and its owner
stating the same fact are not two competing sources — the mirror is never authoritative on its own,
even if it happens to be read first.

## Task File Scope Model

Task prompts (see `TASK_TEMPLATE.md`) use a three-tier file scope, replacing a flat
Allowed/Forbidden split. This exists because a strictly binary scope repeatedly produced a second
"closure" task immediately after a correct implementation, solely to fix a mirror the primary change
had made factually stale but which the binary model had put out of reach.

1. **PRIMARY FILES** — files the task is expected to modify to deliver its actual objective.
2. **CONDITIONAL CONSISTENCY FILES** — files that *may* be modified, but only to fix a statement the
   primary change made factually stale, or to repair a direct cross-reference the primary change
   broke. Editing a conditional file requires: (a) the edit is synchronization-only — no new
   semantic content, no redesign of what the file's owner already governs; (b) Claude states, in the
   task's own record, *why* the file became necessary to touch; (c) review confirms the change was
   synchronization-only, not scope creep wearing a consistency-fix label.
3. **FORBIDDEN FILES** — genuinely outside this task's authority. If a forbidden file's content would
   need to change for semantic reasons (not mere synchronization), the task stops and reports the
   contradiction rather than editing it — this is the existing "frozen documents are not modified
   without explicit authorization" rule from `CLAUDE.md`, restated here as the third tier.

A Codex worker's own `ALLOWED SCOPE` (see "Task Contract" below) is drawn only from the human task's
Primary files, plus whichever specific Conditional Consistency files Claude has already identified as
necessary for that worker's bounded piece of work — never from Forbidden files, and never used to
silently widen a worker's authority beyond what the human task itself granted.

## Claude Responsibilities

Claude's own working cycle, per task and per phase within a task:

```text
UNDERSTAND → DECOMPOSE → DELEGATE → ADJUDICATE → INTEGRATE → AUTHORIZE NEXT PHASE → REPORT
```

- **Understand** the task before decomposing it — do not delegate a piece Claude has not itself
  scoped.
- **Decompose** substantial bounded work into pieces a single Codex role can execute reliably (see
  "When to Delegate to Codex" below).
- **Delegate** is the *preferred default* for routine operations that map cleanly onto a role:
  repository inspection → Scout, implementation → Implementer, tests/diff verification → Verifier,
  adversarial review → Reviewer. Branch/commit/push/PR are not a Codex role at all — see "Git &
  Branch Workflow" below. Concretely: if the work
  involves editing more than a small, isolated handful of lines in files Claude has not already
  fully read this task, running a test/build/validation command, or producing an independent
  judgment on work Claude itself authored, route it to the matching role rather than doing it
  directly — these are the routine cases the table above exists for. Direct Claude action remains
  possible when the work is a single trivial lookup, a one-line fix in a file already fully read
  this task, or dispatching a worker would clearly cost more than it returns — but when Claude does
  substantial role-mapped work directly instead of delegating it, the task's own report names which
  exception applied, rather than silently skipping delegation. Delegation must add value, not
  simulate activity.
- **Adjudicate** every worker's output as a claim to check, never a finding to relay — see
  [REVIEW_PROTOCOL.md](./REVIEW_PROTOCOL.md). Reject unsupported or out-of-scope *material*
  recommendations explicitly, not silently — "material" means it would change what gets built,
  changed, or reported if accepted; trivial or duplicate suggestions don't need individual
  adjudication in the final report.
- **Integrate** accepted results into a coherent whole; remain responsible for the final result even
  when Codex produced the underlying material.
- **Authorize next phase** explicitly — a worker's completion is not, by itself, authorization to
  advance the task's lifecycle gate (see `REVIEW_PROTOCOL.md`'s Lifecycle Gates); Claude makes that
  call.
- **Report** the outcome for human review, naming unresolved ambiguity and risk rather than hiding
  it behind a clean-looking summary.

## Codex Responsibilities

- Execute exactly the bounded task it was given — the declared Allowed Scope, nothing more.
- Never expand its own scope, redefine the objective, or decide to modify a file outside its
  Allowed Scope.
- Never approve its own output, mark a task complete, or advance MIHVER to its next step.
- **Never commit, push, or otherwise mutate Git/repository state, under any role, ever.** No Codex
  role may do so — see "Git & Branch Workflow" below for what replaced the retired Git Operator
  role. A Claude-authored worker contract may never authorize Git mutation for any Codex worker; if
  a worker contract appears to grant it, that contract is malformed.
- Report uncertainty and incomplete results honestly rather than filling gaps with invented
  confidence.

## When to Delegate to Codex

Delegation is the preferred default for substantial bounded work; route it by role (full contracts
in [CODEX_ROLES.md](./CODEX_ROLES.md)):

| Kind of work | Role |
|---|---|
| Repository inspection, targeted evidence-gathering | Scout |
| Bounded file writes to an already-decided change | Implementer |
| Tests, diff/status checks, deterministic validation | Verifier |
| Adversarial/independent review of produced work | Reviewer |

Branch prep, commit, push, and PR creation are no longer a Codex role at all — see "Git & Branch
Workflow" below. Local-commit publication is Claude constructing a PublicationEnvelope and invoking
the deterministic Local Publication Builder; push/PR creation are NOT AVAILABLE until the privileged
Publication Broker (V3.1-B) exists.

Do not spawn a Codex worker merely to simulate parallelism or thoroughness. If a task is a single
trivial lookup, or something Claude can do directly with equal reliability and less overhead, do it
directly — see "Claude Responsibilities" above for when direct action is the exception, not the
default.

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

An underspecified task contract (missing any of the above) is not ready to dispatch. `ROLE` must be
exactly one of the four roles defined in [CODEX_ROLES.md](./CODEX_ROLES.md): `SCOUT`, `IMPLEMENTER`,
`VERIFIER`, `REVIEWER`.

## Mutation Classes: Read-Only, Content-Write, Git-Mutation

Three classes, not two — conflating the latter two was the historical gap the now-retired Git
Operator role existed to close for Codex specifically. As of V3.1-A, Git-mutation is no longer a
Codex capability at all — it belongs only to the deterministic Local Publication Builder (local
commit) and, in future, the privileged Publication Broker (push/PR) — see "Git & Branch Workflow"
below and [CODEX_ROLES.md](./CODEX_ROLES.md)'s "Publication Protocol":

- **Read-only** (default): Scout, Verifier, and Reviewer never modify any file and never mutate Git
  state.
- **Content-write**: Implementer edits file content within its Allowed Scope, only when the task is
  implementation work with an explicitly scoped file set. Never mutates Git state.
- **Git-mutation**: performed only by the Local Publication Builder (a local commit, from a
  Claude-authored PublicationEnvelope) or, once it exists, the privileged Publication Broker
  (push/PR) — never by a Codex role, and never concurrently with a content-write actor in the same
  working tree; see "Parallel Worker Rules" below.

See [CODEX_ROLES.md](./CODEX_ROLES.md)'s Capability Matrix for the full per-role breakdown — not
restated here.

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
  and `switch` are never performed by more than one actor (the Local Publication Builder, another
  worker, or Claude) at the same time, regardless of how disjoint their file scopes are. In practice
  this means Git-mutating commands are run by exactly one authorized Git actor at a time — Claude
  directly, per "Git & Branch Workflow" below, or the Local Publication Builder Claude invokes —
  only after every concurrently-dispatched content-writing worker for that batch has finished and
  Claude has integrated their results; never by a worker mid-flight, and never interleaved with
  another still-running worker's edits. Claude must not create or switch branches, or invoke the
  Local Publication Builder, while an Implementer from the same or an overlapping task is still
  mid-edit.

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

### Publication is privilege-separated, not a Codex role (V3.1-A)

Real V3 dogfood proved Codex sandboxes have no network access and therefore could never safely or
functionally own GitHub publication — the Codex Git Operator role from V3 is retired. Publication
now flows: Claude constructs a **PublicationEnvelope** → the deterministic, non-LLM, network-free
**Local Publication Builder** (`scripts/dev/publication-builder.mjs`) produces exactly one **local**
commit and a Publication Receipt → a future privileged **Publication Broker** independently
verifies and performs the actual push/PR. Full contract (Envelope shape, Builder behavior, Receipt
shape, and what the Broker is/isn't) lives in [CODEX_ROLES.md](./CODEX_ROLES.md)'s "Publication
Protocol" — not restated here.

**The Broker is NOT IMPLEMENTED.** No separate OS identity, GitHub App credential, privilege
boundary, real push, PR creation, or GitHub ruleset exists yet — that is V3.1-B's scope, not this
policy's. **Until it exists: REMOTE PUBLICATION AUTOMATION = NOT AVAILABLE.** Neither Claude nor any
Codex role pushes a branch or creates/modifies a PR, under any task authorization whatsoever — the
"Push" and "Pull Requests" sections below are retired as *automated* paths and describe only what
remains true (never `main`, never force, human-only merge) for the human's own manual publication.
This also retires Claude's own former direct push/PR exception: an LLM-adjacent actor holding that
authority is exactly the privilege-separation gap V3.1-A exists to close, regardless of whether it
is exercised by Claude or by a delegated Codex worker.

**What Claude may still do directly:** author a PublicationEnvelope and invoke the Local Publication
Builder to produce a local commit (see "Commits" below — this replaces the old PREPARE/PUBLISH
split; there is no separate "branch preparation" mode, since the Builder's own guards — repo root,
branch identity, ancestry, `Expected pre-publish HEAD` — cover what PREPARE used to check, and Claude
still creates/switches the task branch directly per "Branches" below before ever invoking it).
`READY_TO_PUBLISH` (per [REVIEW_PROTOCOL.md](./REVIEW_PROTOCOL.md)'s Lifecycle Gates) still gates
*producing* the Envelope and running the Builder; a `COMMITTED` Publication Receipt is a mechanical
fact about a local commit, never an approval, and never proof of a push or PR that did not happen.

No Git mutation — by the Local Publication Builder, by a worker, or by Claude directly — may overlap
another write-capable actor in the same working tree; see "Parallel Worker Rules" above, which
applies to the Builder exactly as it does to Claude's own direct Git commands.

**`Base branch` and `Base commit` are two separate authorities, not one overloaded field** — see
`TASK_TEMPLATE.md`'s Publication model and `CODEX_ROLES.md`'s PublicationEnvelope for the full
schema. `Base branch` is the eventual PR target (normally `main`, actionable only once the Broker
exists); `Base commit` is the immutable ancestry anchor the Local Publication Builder verifies before
ever staging or committing — a `Base branch` that has since moved forward must never silently
redefine what a task was actually authorized to build on. Before any staging or commit, the Builder
also requires `HEAD` to equal the Envelope's `Expected pre-publish HEAD` exactly — proving the branch
carries no unexpected pre-existing committed work — with any mismatch reported as `BLOCKED`, never
resolved via merge, rebase, reset, or force.

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
  that work in the process. If the task also specifies a `Base branch` that differs from the branch
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

Local commits (never a push, never a network call) remain Claude's own direct authority, gated by
task-level authorization: Claude may create a commit only when the current task explicitly
authorizes it (see `TASK_TEMPLATE.md`'s "Local Publication Builder authorized" field — the default
is **no**). When authorized, the preferred path is a PublicationEnvelope run through
`scripts/dev/publication-builder.mjs` (see "Publication is privilege-separated, not a Codex role
(V3.1-A)" above and [CODEX_ROLES.md](./CODEX_ROLES.md)'s "Publication Protocol"); a small, low-risk
change may still be committed by Claude with plain `git commit` instead, under the same rules:

- commit only files within the task's declared scope;
- inspect staged changes (`git status`, `git diff --cached`) before committing — never commit
  broadly-added changes without having looked at exactly what's included;
- never include secrets, generated junk, unrelated files, or accidental changes;
- use clear, conventional commit messages.

Intermediate commits are allowed on task branches once commits are authorized for the task — they
don't each need separate re-authorization. A local commit, by either path, is never a push and
never touches GitHub — see "Push" and "Pull Requests" below.

### Gate Recording Commit

A narrow, separate authority from the general commit rule above: once a human has given
**explicit approval** for a gate decision (a PR merge, a milestone freeze, a task's completion)
in conversation, Claude may create exactly **one** commit recording that decision — even if
nothing in the current exchange set "Local Publication Builder authorized: yes" the way a full task
prompt would, because this commit only records the approval; it does not perform or continue the
approved work.

- Allowed files for a Gate Recording Commit:
  - `.project/REVIEW_STATE.md`
  - `.project/DECISIONS_LOG.md`
  - `.project/CURRENT_TASK.md`
- It must change no architecture, code, contract, schema, test, or policy file. A Gate Recording
  Commit is non-substantive by definition; if recording the decision requires touching anything
  outside the three files above, it is not a Gate Recording Commit and needs its own task
  authorization ("Local Publication Builder authorized: yes") instead.
- Exactly one commit per approval — don't split it, and don't fold unrelated changes into it.
- A pure Gate Recording Commit does not invalidate, supersede, or re-open the human approval it
  records — it is a record of the decision, not a new decision, and it does not itself constitute
  approval of anything further (in particular, it never authorizes an actual merge to `main` —
  see "Pull Requests" below).
- Like every other commit, it never implies a push — see "Push" below.

### Push

**NOT AVAILABLE as an automated path.** Neither Claude nor any Codex worker pushes any branch, under
any task authorization whatsoever — see "Publication is privilege-separated, not a Codex role
(V3.1-A)" above. Pushing a task branch is human manual action until the privileged Publication
Broker (V3.1-B) exists. This is an absolute rule, not one a task prompt can opt back into: `main`
was never pushable by Claude/Codex either, and now no branch is.

### Pull Requests

**NOT AVAILABLE as an automated path**, for the same reason as "Push" above — opening, modifying, or
touching a PR requires the same GitHub write credential a push does, which no LLM-adjacent actor
holds. Until the Publication Broker (V3.1-B) exists, PR creation is exclusively human manual action,
from the branch the human pushes themselves off the Local Publication Builder's local commit.

Once the Broker exists, the eventual lifecycle is:

```text
main
  ↓
task branch
  ↓
Claude + Codex work
  ↓
validation
  ↓
PublicationEnvelope → Local Publication Builder → local commit
  ↓
Publication Broker: push branch, open/update PR
  ↓
human / architecture review
  ↓
required fixes if any
  ↓
approval
  ↓
merge to main
```

- Claude and Codex must never self-approve or self-merge a PR — this remains true once the Broker
  exists. Human approval is the merge gate — see the Authority Hierarchy above.
- Preferred final merge strategy is **squash and merge**, unless the task explicitly requires
  preserving individual commits.
- A PR may only be considered merge-ready after an `APPROVED` review outcome — see
  [REVIEW_PROTOCOL.md](./REVIEW_PROTOCOL.md) — this is unchanged by who performs the push/PR
  mechanics.

### Frozen Checkpoint Rule

After an approved PR is merged into `main`, that state becomes the new frozen checkpoint. Future
work starts from the updated `main`, on a new task branch — never by continuing to build on the
now-merged branch as if it were still the base.

### Post-Merge Reconciliation

A merged checkpoint normally needs **at most one** bounded reconciliation task afterward — to sync
mirrors/navigation and append the durable-decision record — not an open-ended chain. Do not
recursively open a reconciliation-of-the-reconciliation merely to record that the reconciliation PR
itself merged: once a reconciliation PR is merged, that merge needs no further state update unless it
independently changed product or development truth (in which case that's a new, separate fact to
record, not a loop closing over itself). This is why `REVIEW_PROTOCOL.md`'s mandatory final
consistency sweep happens *before* a task reaches `READY_FOR_HUMAN_REVIEW` — catching a mirror gone
stale during implementation review, rather than discovering it only after merge, is what keeps
reconciliation to one bounded pass instead of several.

## Worker Failure Handling

If a Codex worker fails, returns incomplete output, violates its declared scope, contradicts
observed repository fact, proposes an unsupported recommendation, or produces low-confidence
results, Claude must not hide this. Claude should do one of:

1. retry with a narrower, more bounded task,
2. assign an independent worker to check the disputed point,
3. resolve the issue directly,
4. or report the uncertainty to the human rather than papering over it.

**Local Publication Builder `BLOCKED`** is a distinct case, not covered by the general retry logic
above: if `scripts/dev/publication-builder.mjs` reports the working tree disagrees with the
PublicationEnvelope, Claude must not retry with a widened Envelope or any reinterpretation of what
was authorized — the Builder has no force flags to begin with. Resolve the actual disagreement first
(re-inspect the working tree, correct the Envelope to match reality if the mismatch is benign, or
escalate to the human if it isn't) and only then reissue a corrected Envelope for a fresh attempt.
