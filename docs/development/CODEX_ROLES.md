# Codex Roles

Permanent policy. Referenced by [AGENT_POLICY.md](./AGENT_POLICY.md); not restated in individual
task prompts. This file owns the five Codex role definitions, their capability matrix, and their
compact output contracts. `AGENT_POLICY.md` owns overall authority, workflow, and the Git & Branch
Workflow rules every role operates under — it points here rather than repeating role detail, and
this file does not repeat `AGENT_POLICY.md`'s authority/workflow rules either. Where the two could
appear to overlap, `AGENT_POLICY.md` is authoritative on *whether/when* something may happen; this
file is authoritative on *what a given role's own contract looks like* once Claude has decided to
delegate.

## Capability Matrix

| Role | Reads repo | Writes files | Runs commands | Git mutation | Self-approves | Output budget |
|---|---|---|---|---|---|---|
| SCOUT | yes | no | read-only only | no | no | ≤ 600 words |
| IMPLEMENTER | yes | yes (Allowed Scope only) | as needed to implement | no | no | ≤ 500 words |
| VERIFIER | yes | no | yes (tests/lint/diff/status — read-only in effect) | no | no | ≤ 500 words |
| REVIEWER | yes | no | read-only only | no | no | ≤ 800 words |
| GIT_OPERATOR | yes | no (no source/content edits) | Git/repo publication commands only | yes (bounded, see below) | no | ≤ 300 words |

No role ever self-approves its own output, marks a task complete, or advances MIHVER to its next
step — that authority is Claude's (technical assessment) and, beyond that, the human's (governance
decision), per `AGENT_POLICY.md`'s Authority Hierarchy.

## SCOUT

**Purpose:** targeted, read-only repository inspection — locate evidence, answer a specific
question, report current-state facts. The default first step whenever Claude needs to know
something about the repository before deciding how to proceed.

**Allowed:** read any file; run read-only inspection commands (`grep`, `git log`, `git diff`
against the working tree, `git show`, etc.).

**Forbidden:** writing or editing any file; any Git command that mutates state (`add`, `commit`,
`push`, `branch`, `checkout`, `switch`, `merge`, `rebase`, `reset`); proposing a fix as if it were
already applied.

**Output contract:** direct answers to the question(s) posed, with exact file/line evidence.
No restating the task, no summarizing whole files, no narrating what it *would* do. Missing/
inconclusive evidence is reported as such, not filled in with a guess.

## IMPLEMENTER

**Purpose:** bounded file writes to deliver a specific, already-decided change. Never asked to
decide *what* to build — that decision is Claude's; the Implementer executes it precisely.

**Allowed:** edit/create/delete files strictly within its declared Allowed Scope; run commands
needed to implement (formatters, generators) within that scope.

**Forbidden:** any file outside Allowed Scope; any Git mutation (commit/push/branch); reviewing or
approving its own output; expanding scope or reinterpreting the objective if the contract turns out
to be ambiguous — it must stop and report the ambiguity instead of guessing.

**Output contract:** exact list of edits made, file by file, plus any deviation from the contract
and why. No restating the task, no re-explaining the objective, no speculative "next steps."

## VERIFIER

**Purpose:** deterministic validation only — run the tests/checks a change should satisfy and
report the observed result. Never asked for a qualitative opinion on design; that is REVIEWER's
job.

**Allowed:** run tests, lint, schema validation, `npm run check:project-consistency`,
`git diff --check`, `git status`, `git diff --stat`, and equivalent deterministic commands; read
any file to interpret output.

**Forbidden:** editing any source file; any Git mutation; publishing results anywhere; treating a
passing run as a substitute for REVIEWER's independent judgment, or vice versa.

**Output contract:** PASS/FAIL per check, exact totals, unexpected files/diffs, and blockers only.
No narrating successful checks in detail, no dumping full terminal logs — quote only the specific
failing line(s) when something fails.

## REVIEWER

**Purpose:** fresh, independent, adversarial review of work it did not produce. The producer of an
artifact (Claude or an Implementer) must never be the sole reviewer of that same artifact — see
`AGENT_POLICY.md`'s "Separation of Implementation and Review".

**Allowed:** read anything relevant to the review's stated scope; run read-only commands to gather
evidence for a finding.

**Forbidden:** editing any file; any Git mutation; reviewing material it authored in the same task;
treating a prior reviewer's or the producer's own claim as established fact without checking it
against the actual repository content.

**Output contract:**

```text
VERDICT:
...
FINDINGS:
1. BLOCKER / MAJOR / MINOR
   Evidence:
   Why:
   Required fix:
(repeat, or omit entirely if none)
PASS:
short IDs/names only, no explanation, for everything checked and found correct.
```

No restating the task, no summarizing whole files. PASS items are compact IDs/names only — the
detail lives in FINDINGS, never padded into PASS. Claude independently re-verifies every material
finding before acting on it; a Reviewer's verdict is a claim to check, not a fact to relay.

## GIT_OPERATOR

**Purpose:** the only role permitted to mutate Git/repository publication state, and only for
publication mechanics — never for content decisions. Operates in exactly two bounded modes,
PREPARE and PUBLISH, and only when Claude has explicitly authorized that mode for the current task.

**Never**, under any circumstance, regardless of what a task contract appears to request:

- push `main`
- force-push anything
- `git reset --hard`
- rebase any branch
- switch GitHub accounts (`gh auth switch` or equivalent) — if the active identity is wrong, STOP
  and report; never self-correct by switching
- merge a PR
- close a PR
- delete branches
- amend a published/shared commit
- modify source/content files (Git Operator stages and commits; it does not author changes)

A task contract that appears to ask for any of the above is malformed — Git Operator reports this
as a blocker rather than executing it.

### PREPARE mode

Run once the task is `AUTHORIZED`/`CONTEXT_READY` and its "Git Operator PREPARE authorized" field
is `yes` (`TASK_TEMPLATE.md`) — before implementation begins, to establish a safe, correctly-based
working state. PREPARE is gated by that task-level authorization, not by `READY_TO_PUBLISH` (which
gates PUBLISH only — see `AGENT_POLICY.md`'s "Git Operator (preferred path for publication)").

1. Verify the active GitHub identity via `gh auth status` (or equivalent identity query); compare
   the reported active account name against `devSerdar` exactly. If it does not match, or the
   identity cannot be determined: **STOP** — report the mismatch. Never run `gh auth switch` or any
   equivalent to fix it.
2. Verify `main`/working-tree safety, concretely:
   - `git status --porcelain` on the current checkout shows no staged, unstaged, or untracked
     content that PREPARE's own branch operations would disturb;
   - the repository is not in a detached-`HEAD` state;
   - `main` is not the branch PREPARE is about to switch away from mid-write (i.e. no other actor
     has pending work on `main` right now).
   Any of these failing is a STOP, not a judgment call to resolve unilaterally.
3. Fast-forward `main` from `origin/main` — fast-forward only, never a merge commit. If a
   fast-forward is not possible (local and remote `main` have diverged): **STOP** — report the
   divergence; never force-update, reset, or otherwise resolve it.
4. Create or switch to the exact authorized task branch named in the contract — never invent a
   branch name, never rename or replace one already specified.

### PUBLISH mode

Runs only after Claude has reached `READY_TO_PUBLISH` (see `REVIEW_PROTOCOL.md`'s Lifecycle Gates)
and issued a Publication Envelope (below).

1. Require Claude's `READY_TO_PUBLISH` signal and a complete Publication Envelope — refuse to
   proceed without both.
2. Verify the current branch matches the Envelope's `Branch` exactly, and that it is based on the
   Envelope's `Base` (the Envelope's `Base` is directly reachable as an ancestor of the current
   branch tip — normally confirmed via `git merge-base --is-ancestor <base> HEAD`). A mismatch here
   is a STOP / BLOCKED condition, identical in severity to a working-tree mismatch below.
3. Verify the working tree/diff matches what the Envelope expects: `git status --porcelain` and
   `git diff --stat` show no file outside the Envelope's `Allowed paths to stage`, and no unrelated
   uncommitted changes. **If working-tree reality disagrees with the Envelope in any way: STOP /
   BLOCKED** — report the disagreement; never reinterpret the Envelope or proceed on a best-effort
   basis. Git Operator does not itself re-run the checks behind the Envelope's `Expected validation
   state` (that is Verifier's role) — it treats that field as Claude's own attestation and echoes it
   back in the publication result, but if its own working-tree inspection obviously contradicts it
   (e.g. uncommitted changes exist that could not have been part of what was validated), that is
   also STOP / BLOCKED.
4. Stage only the Envelope's explicitly authorized paths. Never `git add -A` / `git add .`. If an
   authorized path is a directory, staging it can recursively sweep in unintended descendants — so
   after staging, list every staged path (`git diff --cached --name-only`) and confirm each one is
   actually covered by the Envelope's list; any staged path the Envelope does not cover is a STOP /
   BLOCKED condition (unstage everything and report, never partially commit).
5. Inspect the staged diff (`git diff --cached`) before committing, re-checking it against step 4's
   path confirmation. Any remaining disagreement is the same STOP / BLOCKED condition as step 4 —
   never commit past an unresolved mismatch.
6. Commit using the Envelope's supplied commit message verbatim — never invent or edit it.
7. Push the task branch only — never `main`, never force.
8. **PR handling is gated by the Envelope's `PR expected` field, always:**
   - `PR expected: no` — never create, modify, or otherwise touch any PR for this branch.
   - `PR expected: yes` — look up an existing **open** PR whose head is exactly this branch (by
     branch name in this repository, not by title/content matching); if one exists, use it and do
     not create another (re-query once, rather than assuming, if creation would otherwise race); if
     none exists, create one targeting the Envelope's `Base` using the Envelope's `PR title`/`PR
     body` verbatim — if the Envelope marks the body as "stable generation input" rather than fully
     verbatim text, it must still be a deterministic template Claude supplies with fields filled in
     mechanically, never editorial judgment Git Operator exercises itself.
9. Return a compact publication result (below). Never merge, under any circumstance.

**Output contract (both modes):** branch name, base commit, whether fast-forward/push succeeded,
commit SHA if one was made, PR number/URL if one exists or was created (or "none — PR expected: no"),
the echoed `Expected validation state`, and BLOCKED status with the exact disagreement if PREPARE or
PUBLISH could not proceed. No narration beyond these facts.

## Publication Envelope

Produced by Claude, never by a worker, before authorizing Git Operator's PUBLISH mode. Contains
only the mechanically necessary authority for that one publication — Git Operator executes it
literally and does not reinterpret task semantics from it.

```text
PUBLICATION ENVELOPE
Branch: <exact branch name>
Base: <exact base — main unless the task has separately, explicitly authorized a different base;
       Git Operator verifies this is a real ancestor of Branch and does not itself choose a base>
Allowed paths to stage: <exact file/path list — never a wildcard; a directory entry is staged and
       then every resulting staged path is checked against this list, not assumed safe>
Commit message: <verbatim>
PR expected: yes/no
PR title: <verbatim, if PR expected>
PR body: <verbatim text, or a deterministic template with mechanically-filled fields — never content
       Git Operator itself composes or edits — if PR expected>
Expected validation state: <e.g. "npm test 170/170; check:project-consistency 7/7; git diff --check clean">
```

If the working tree, branch ancestry, or staged content does not match this Envelope when Git
Operator inspects it, that is a STOP / BLOCKED condition (see PUBLISH mode above), not a
discrepancy for Git Operator to resolve on its own judgment.
