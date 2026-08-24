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
   branch name, never rename or replace one already specified. Report the resulting branch tip SHA
   in the output — this is the value Claude uses as the *first* Publication Envelope's `Base commit`
   and `Expected pre-publish HEAD` for a brand-new branch (see "Publication Envelope" below).

### PUBLISH mode

Runs only after Claude has reached `READY_TO_PUBLISH` (see `REVIEW_PROTOCOL.md`'s Lifecycle Gates)
and issued a Publication Envelope (below). Every numbered check below is a STOP / BLOCKED condition
on failure, in the order given — Git Operator never proceeds past a failed check on a best-effort
basis, and never resolves a mismatch itself via merge, rebase, reset, or force of any kind.

1. Require Claude's `READY_TO_PUBLISH` signal and a complete Publication Envelope — refuse to
   proceed without both.
2. **Pre-publish HEAD guard, before any staging or commit.** Verify the current branch matches the
   Envelope's `Branch` exactly, then verify `HEAD` equals the Envelope's `Expected pre-publish HEAD`
   **exactly** (`git rev-parse HEAD`). This proves the branch has no unexpected pre-existing
   committed work beyond what Claude authorized — a new task branch's initial HEAD is the authorized
   `Base commit` (from PREPARE, above); a continuation of an existing PR uses the previously-known
   branch head from before the new uncommitted fix set as `Expected pre-publish HEAD`. Any mismatch:
   **BLOCKED** — report the actual vs. expected SHA; never merge, rebase, reset, or force-correct
   into alignment.
3. Verify the Envelope's `Base commit` is a real ancestor of `HEAD`
   (`git merge-base --is-ancestor <Base commit> HEAD`). `Base branch` (normally `main`) is used only
   as the PR target in step 8 below — it is never itself the ancestry check, since `main` can move
   after `Base commit` was authorized; a moving `Base branch` must never silently redefine this
   task's authorized `Base commit`.
4. Verify the working tree/diff matches what the Envelope expects: `git status --porcelain` and
   `git diff --stat` show no file outside the Envelope's `Allowed files to stage`, and no unrelated
   uncommitted changes.
5. **Stage only the Envelope's exact file paths, with pathspec magic disabled, distinguishing
   exactly two authorized shapes.** Every entry in `Allowed files to stage` must be unique (no path
   listed twice) and must resolve, mechanically, to exactly one of:

   - **(A) Present regular file** — exists in the current working tree, and is a regular file
     there (not a directory, symlink, or other special file). May represent added or modified
     content.
   - **(B) Authorized deletion** — absent from the current working tree, **and** resolves at the
     Envelope's `Expected pre-publish HEAD` to a tracked regular file: `git ls-tree
     <Expected pre-publish HEAD> -- <exact-file>` must produce exactly one line for that exact path
     with mode `100644` or `100755` (a tracked regular file; `120000` is a symlink, `040000` a
     tree/directory, `160000` a submodule — none of these qualify). An entry that is absent from
     the working tree but was **not** a tracked regular file at `Expected pre-publish HEAD` (never
     tracked, or tracked as a directory/symlink/submodule) is malformed: **BLOCKED**, not treated as
     a deletion.

   Any entry that is neither (A) nor (B) — a directory, a symlink, a pathspec-magic character
   (`*`, `?`, `[`) unless magic is explicitly disabled, an empty entry, a path resolving outside the
   repository, or a duplicate of another entry — is malformed: **BLOCKED before staging anything**.
   A rename is represented as two separate entries, each independently validated: the old path as
   an (B) authorized deletion, the new path as an (A) present regular file — Git Operator never
   infers a rename from the pair; it validates each entry on its own terms.

   Stage each entry individually with pathspec magic disabled and an explicit end-of-options marker,
   using the shape determined above — never guessed, never inferred from whichever command happens
   to succeed:
   ```text
   git --literal-pathspecs add -- <exact-file>          # (A) present regular file
   git --literal-pathspecs rm -- <exact-file>            # (B) authorized deletion
   ```
   Then confirm `git diff --cached --name-only` produces **exactly** the authorized file set — no
   more, no fewer, no directory-coverage interpretation of what "authorized" means. Any discrepancy:
   unstage everything and report, never partially commit.
6. **Recompute and verify the Publication Fingerprint** (see "Publication Envelope" below) over the
   exact authorized file set, using the same deterministic recipe Verifier used to produce it. If
   the recomputed fingerprint does not match the Envelope's carried fingerprint exactly: BLOCKED —
   the bytes about to be published are not the bytes Verifier last checked.
7. Inspect the staged diff (`git diff --cached`) as a final human-legible cross-check against steps
   5–6 — this is a confirmation, not a substitute for the exact-match checks above.
8. Commit using the Envelope's supplied commit message verbatim — never invent or edit it.
9. Push the task branch only — never `main`, never force.
10. **PR handling is gated by the Envelope's `PR expected` field, always:**
    - `PR expected: no` — never create, modify, or otherwise touch any PR for this branch.
    - `PR expected: yes` — look up an existing **open** PR whose head is exactly this branch (by
      branch name in this repository, not by title/content matching); if one exists, use it and do
      not create another (re-query once, rather than assuming, if creation would otherwise race); if
      none exists, create one with base `Base branch` and head this `Branch`, using the Envelope's
      `PR title`/`PR body` verbatim — if the Envelope marks the body as "stable generation input"
      rather than fully verbatim text, it must still be a deterministic template Claude supplies
      with fields filled in mechanically, never editorial judgment Git Operator exercises itself.
11. **Publication receipt — verify mechanically, not by assertion, branched on `PR expected`:**
    - always: local `HEAD` equals the commit SHA just created; the remote task-branch `HEAD`
      (`git ls-remote origin <Branch>`) equals the local `HEAD`; the working tree is clean
      (`git status --porcelain` empty) after publication.
    - `PR expected: yes` — require a successful lookup of **exactly one open** PR whose head is
      `Branch`; absence of that PR, or a failed/ambiguous lookup, is itself BLOCKED at this step
      (not silently glossed over as "nothing to compare"). Once found: its head branch equals the
      authorized `Branch`; its head SHA equals the remote task-branch `HEAD`; its base branch
      equals the Envelope's `Base branch`.
    - `PR expected: no` — verify no PR was created or touched for this branch; report `pr_number:
      none` and `pr_head: none` rather than attempting any PR comparison.
    Any check failing under the `yes` branch is reported as part of the result, not silently
    assumed.
12. Return a compact publication result (below). Never merge, under any circumstance.

**Output contract (both modes):** for PREPARE — branch name, resulting branch tip SHA, whether
fast-forward succeeded, BLOCKED status with the exact disagreement if it could not proceed. For
PUBLISH — at minimum: `status` (PUBLISHED / BLOCKED), `branch`, `base_branch`, `base_commit`,
`commit` (the new commit SHA), `local_head`, `remote_head`, `pr_number` (or "none — PR expected:
no"), `pr_head`, `working_tree` (clean/dirty), and the exact disagreement if BLOCKED. No narration
beyond these facts.

## Publication Envelope

Produced by Claude, never by a worker, before authorizing Git Operator's PUBLISH mode. Contains
only the mechanically necessary authority for that one publication — Git Operator executes it
literally and does not reinterpret task semantics from it.

```text
PUBLICATION ENVELOPE
Branch: <exact branch name>
Base branch: <the PR target — normally main>
Base commit: <exact immutable SHA — the ancestry anchor authorized for this task; Git Operator
       verifies this is a real ancestor of HEAD, and never substitutes a moving Base branch tip
       for it>
Expected pre-publish HEAD: <exact SHA HEAD must equal before any staging/commit — the branch's
       initial HEAD (= Base commit) for a brand-new task branch, or the previously-known branch
       head for a continuation of an existing PR's fix set>
Allowed files to stage: <exact file paths only, each unique, each either (A) a present regular file
       in the working tree, or (B) an authorized deletion — absent from the working tree but a
       tracked regular file at "Expected pre-publish HEAD"; no directories, no wildcards, no
       symlinks, no `git add -A`/`.`; a rename is two entries (old path deleted, new path present);
       an entry matching neither (A) nor (B), or a duplicate, is itself malformed (BLOCKED)>
Publication Fingerprint: <see below — the deterministic digest Verifier computed over exactly the
       "Allowed files to stage" set after the last edit and Final Consistency Sweep>
Commit message: <verbatim>
PR expected: yes/no
PR title: <verbatim, if PR expected>
PR body: <verbatim text, or a deterministic template with mechanically-filled fields — never content
       Git Operator itself composes or edits — if PR expected>
```

**Publication Fingerprint — the smallest deterministic binding available without adding runtime
implementation beyond this policy.** Scope is deliberately narrowed to keep the recipe exact and
reproducible by two independent actors (Verifier, then Git Operator) with existing tools only:

- **Domain**: every path in `Allowed files to stage` must already classify, unambiguously, as
  either shape (A) present regular file or shape (B) authorized deletion (PUBLISH step 5's
  definitions — Verifier applies the identical classification when it first computes the
  fingerprint, not only Git Operator when it recomputes one). A path that is neither, or that is
  ambiguous (e.g. absent from the working tree but not a tracked regular file at `Expected
  pre-publish HEAD`), is not fingerprinted at all — it is malformed, and Verifier must not produce
  an Envelope for it until the entry itself is fixed. A path containing a raw newline is rejected as
  malformed in the Envelope itself — Git paths permit this in principle, but this policy does not
  attempt to fingerprint it.
- **Canonical command sequence** (run with `LC_ALL=C` so sorting is a fixed byte-order, never
  locale-dependent), computed by Verifier over exactly the `Allowed files to stage` list and
  recomputed identically by Git Operator immediately before staging (PUBLISH step 6). `$p` ranges
  only over already-classified entries — `-e "$p"` reduces to "is this shape (A)?" only because
  shape (B) was already confirmed absent-but-tracked-at-`Expected pre-publish HEAD` beforehand, per
  the Domain bullet above, not because presence-on-disk is itself the classification rule:
  ```sh
  LC_ALL=C sort <<'EOF' | while IFS= read -r p; do
  <one "Allowed files to stage" entry per line>
  EOF
    if [ -e "$p" ]; then h=$(git hash-object -- "$p"); else h="ABSENT"; fi   # (A) hash, or (B) ABSENT
    printf '%s\0%s\n' "$p" "$h"
  done | shasum -a 256 | awk '{print $1}'
  ```
  (`git hash-object -- <path>` — the `--` end-of-options marker prevents a leading-dash filename
  from being misread as a flag; `shasum -a 256` may be substituted with any equivalent SHA-256
  utility, since the recipe's own byte stream, not the specific tool name, is what must match.)
- Any mismatch between Verifier's carried fingerprint and Git Operator's recomputed one is BLOCKED
  (PUBLISH step 6) — the bytes about to be published are not the bytes Verifier last checked.

This is a documented recipe over existing Git plumbing and standard hashing/sorting utilities — no
new script or application code is added to the repository to compute it, and no operator improvises
their own variant of it. **What this does and does not prove:** it proves the exact on-disk bytes of
every authorized regular file are unchanged between Verifier's last check and the moment of
publication — it does NOT re-run or re-prove that the validation commands themselves (`npm test`,
`check:project-consistency`, etc.) passed; that remains Verifier's own separate, already-run result,
carried informally in Claude's own report rather than as a second Envelope field. If a future task
needs to fingerprint directories, symlinks, or newline-containing paths, that is new implementation
work outside this policy document's own narrowed scope, not a silent gap in it.

If the working tree, branch ancestry, staged content, or fingerprint does not match this Envelope
when Git Operator inspects it, that is a STOP / BLOCKED condition (see PUBLISH mode above), not a
discrepancy for Git Operator to resolve on its own judgment.
