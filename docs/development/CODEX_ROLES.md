# Codex Roles

Permanent policy. Referenced by [AGENT_POLICY.md](./AGENT_POLICY.md); not restated in individual
task prompts. This file owns the four Codex role definitions, their capability matrix, their
compact output contracts, and the Publication Protocol (below) that replaced the earlier Codex Git
Operator role. `AGENT_POLICY.md` owns overall authority, workflow, and the Git & Branch Workflow
rules every role operates under — it points here rather than repeating role detail, and this file
does not repeat `AGENT_POLICY.md`'s authority/workflow rules either. Where the two could appear to
overlap, `AGENT_POLICY.md` is authoritative on *whether/when* something may happen; this file is
authoritative on *what a given role's own contract looks like* once Claude has decided to delegate.

**No Codex role mutates Git or repository publication state.** V3's fifth role, Git Operator, is
retired as of V3.1-A (`DEVELOPMENT-ORCHESTRATION-V3.1-A`) — real V3 dogfood proved Codex sandboxes
have no network access and therefore could never functionally or safely own GitHub publication. See
"Publication Protocol" below for the deterministic, non-LLM subsystem that replaced it, and
"Publication Broker (V3.1-B — source implemented, NOT provisioned/activated)" for what remains
before remote publication automation is actually available.

## Capability Matrix

| Role | Reads repo | Writes files | Runs commands | Git mutation | Self-approves | Output budget |
|---|---|---|---|---|---|---|
| SCOUT | yes | no | read-only only | no | no | ≤ 600 words |
| IMPLEMENTER | yes | yes (Allowed Scope only) | as needed to implement | no | no | ≤ 500 words |
| VERIFIER | yes | no | yes (tests/lint/diff/status — read-only in effect) | no | no | ≤ 500 words |
| REVIEWER | yes | no | read-only only | no | no | ≤ 800 words |

No role ever self-approves its own output, marks a task complete, or advances MIHVER to its next
step — that authority is Claude's (technical assessment) and, beyond that, the human's (governance
decision), per `AGENT_POLICY.md`'s Authority Hierarchy. No role mutates Git/repository publication
state — that authority now belongs only to the deterministic Local Publication Builder (local commit
only) and, once provisioned, the privileged Publication Broker (source implemented as of V3.1-B, not
yet provisioned/activated — see `PUBLICATION_BROKER.md`) — see "Publication Protocol" below.

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

## Publication Protocol

V3.1-A (`DEVELOPMENT-ORCHESTRATION-V3.1-A`) replaced the Codex Git Operator role above with a
privilege-separated pipeline. Neither Claude nor any Codex role holds GitHub write credentials —
only the privileged, non-LLM Publication Broker (source implemented as of V3.1-B, not yet
provisioned/activated) does, once a human provisions it:

```text
Claude → PublicationEnvelope → Local Publication Builder → local commit SHA
                                                              → PublicationPackage (V3.1-B)
                                                              → Publication Broker
                                                                (source implemented, NOT PROVISIONED)
                                                              → GitHub App → task branch / PR
```

### PublicationEnvelope

Produced by Claude, never by a worker, before invoking the Local Publication Builder. Contains only
the mechanically necessary authority for that one local commit — the Builder executes it literally
and does not reinterpret task semantics from it. Machine-readable shape:
[schemas/dev/publication-envelope.schema.json](../../schemas/dev/publication-envelope.schema.json).

```text
PUBLICATION ENVELOPE
protocol_version: "1.0.0"
repository: { remote_name, owner, name }        <- identity the Builder verifies against `git remote get-url`
branch: <exact branch name — never main/master>
base_branch: <the eventual PR target — normally main>
base_commit: <exact immutable 40-hex SHA — the ancestry anchor authorized for this task; the Builder
       verifies this is a real ancestor of HEAD, and never substitutes a moving base_branch tip for it>
expected_pre_publish_head: <exact 40-hex SHA HEAD must equal before any staging/commit>
allowed_files: <exact file paths only, each unique, each either "present" (a regular file in the
       working tree, added or modified) or "deletion" (absent from the working tree but a tracked
       regular file at expected_pre_publish_head); no directories, no wildcards, no symlinks, no
       `git add -A`/`.`; a rename is two entries (old path "deletion", new path "present"); an entry
       matching neither shape, or a duplicate, is malformed (BLOCKED)>
publication_fingerprint: <the deterministic digest — see below — over exactly `allowed_files`>
commit_message: <verbatim>
pr_expected: true/false                          <- carried through to the Broker's PublicationPackage;
                                                      NOT actionable until the Broker is provisioned
pr_title / pr_body: <verbatim, if pr_expected>    <- same; NOT actionable until the Broker is provisioned
```

### Local Publication Builder

`scripts/dev/publication-builder.mjs` — deterministic, non-LLM, network-free repository-owned code
(no Codex role, no LLM). Given an Envelope and a repo root, it produces **exactly one local git
commit** and a Publication Receipt
([schemas/dev/publication-receipt.schema.json](../../schemas/dev/publication-receipt.schema.json)).
Every git invocation uses `execFileSync` with an explicit argument array — no shell string
interpolation. It:

1. verifies the working directory is the repository root (`git rev-parse --show-toplevel`);
2. rejects `main`/`master` as the Envelope's `branch`;
3. verifies the checked-out branch equals the Envelope's `branch` and is not detached;
4. verifies the `origin` (or Envelope-declared) remote's owner/name matches `repository` exactly;
5. verifies `HEAD` equals `expected_pre_publish_head` exactly (proves no unexpected pre-existing
   committed work);
6. verifies `base_commit` is a real ancestor of `HEAD` (`git merge-base --is-ancestor`);
7. classifies every `allowed_files` entry as shape (A) present regular file or shape (B) authorized
   deletion, rejecting path traversal, absolute paths, symlinks, directories, submodule gitlinks
   (mode `160000`), duplicates, and anything declared present but absent (or vice versa) — any
   malformed entry is BLOCKED before anything is staged;
8. verifies the working tree has no changes outside the authorized set (rejects a dirty unrelated
   file the Envelope never named);
9. for every shape (A) entry, mechanically inspects the `filter`, `text`, `eol`,
   `working-tree-encoding`, and `ident` `git check-attr` values and BLOCKS on any explicit
   (non-`"unspecified"`) value before touching that file's bytes at all — no external clean/process
   filter command is ever invoked by this module (see "Content-transform guard" below);
10. recomputes the Publication Fingerprint from the raw worktree (below, using
    `git hash-object --no-filters` — raw bytes only) and compares it to the Envelope's carried value
    — any mismatch is BLOCKED. This is an **early authorization check**, not the final binding proof
    — see "What this does and does not prove" below;
11. snapshots the exact current index as a tree (`git write-tree`) so any failure from this point on
    can restore precisely that state (not merely reset to `HEAD`, which could discard a caller's
    legitimate pre-existing staged changes), then stages each entry individually with
    `git --literal-pathspecs add --`/`rm --` per its shape (with `-c core.autocrlf=false`, so a
    repo/global autocrlf setting cannot normalize line endings during staging), then confirms
    `git diff --cached --name-only --no-renames` equals the authorized set exactly — restoring the
    snapshotted index and reporting BLOCKED on any discrepancy;
12. independently re-reads each staged index blob SHA (`git rev-parse --verify --quiet :<path>`) and
    requires it to exactly equal the raw-worktree blob SHA (`git hash-object --no-filters`) computed
    fresh at this point — restoring the snapshotted index and reporting BLOCKED (`STAGED_BLOB_MISMATCH`)
    on any mismatch;
13. recomputes the same canonical Publication Fingerprint recipe a second time — the **final seal** —
    but sourced from the actual staged index blob of each shape (A) entry (not fresh worktree bytes),
    and requires it to still exactly equal the Envelope's carried value, restoring the snapshotted
    index and reporting BLOCKED (`STAGED_FINGERPRINT_MISMATCH`) on any mismatch. This closes a window
    step 10 alone cannot: a file mutated after step 10's worktree check but before/during step 11's
    staging would have its mutated raw bytes agree with its mutated staged bytes (satisfying step 12),
    while both had already silently drifted from what the Envelope authorized — only a fingerprint
    bound to the bytes actually about to be committed closes that gap;
14. immediately before committing, re-reads `HEAD` one more time and requires it still exactly equal
    `expected_pre_publish_head` (already verified once, at step 5, before staging began) — restoring
    the snapshotted index and reporting BLOCKED (`PRE_COMMIT_HEAD_CHANGED`) if HEAD moved during
    staging (e.g. a concurrent process committing on the same branch), so this run's commit can never
    land on an unauthorized parent;
15. commits locally using `commit_message` verbatim, with **every** git invocation this run makes
    (not only the commit) executed under `-c core.hooksPath=<a fresh, empty, process-local directory
    created and destroyed for this one run>` plus `-c core.fsmonitor=`, so no
    pre-commit/prepare-commit-msg/commit-msg/post-commit/fsmonitor hook — repository- or
    user-controlled — can execute at any point; the commit itself additionally passes `--no-verify`
    and `--no-gpg-sign` as defense in depth. Any exception thrown after staging begins (a failing git
    call, a failed cleanup) still triggers the same index restoration before BLOCKED is reported —
    fail-closed, not merely fail-return.

**Index restoration is itself verified, not merely attempted.** Every restoration this run performs
(steps 11–14's "restoring the snapshotted index" and the exception path in step 15) re-derives the
post-restore index tree (`git write-tree`) and requires it to exactly equal the snapshot captured
before staging began — `git read-tree` reporting success is not itself trusted as proof. If
restoration cannot be verified, the result is the distinct `INDEX_RESTORE_FAILED` failure reason
(never the original triggering reason reported as though cleanup succeeded), with the original
reason/details preserved as structured diagnostic data and an explicit note that manual repository
inspection/intervention is required.

It **never** pushes, calls an authenticated GitHub API, creates/modifies/merges a PR, reads GitHub
credentials, or invokes `gh auth token`/switches identity — there is no code path in the script that
does any of these; `pr_expected`/`pr_title`/`pr_body` are carried in the receipt's source Envelope
only, never acted on.

**Content-transform guard** — `git hash-object <path>` (no flags) and `git add` both silently run any
`.gitattributes`-configured clean filter (an arbitrary external command) and can rewrite bytes via
text/eol/working-tree-encoding/ident/`core.autocrlf` normalization even without an explicit `filter=`
attribute. Rather than building a general filter-aware publication engine, the Builder supports only
files for which it can mechanically prove no transform occurs: any explicit (non-`"unspecified"`)
value for `filter`/`text`/`eol`/`working-tree-encoding`/`ident` is BLOCKED outright (step 9, above),
`core.autocrlf` is deterministically disabled for the Builder's own staging invocations, and every
content digest — both the Publication Fingerprint and the post-staging proof — uses
`git hash-object --no-filters` (raw bytes only). The post-staging staged-blob-identity check (step 12)
is the final, independent backstop: it does not assume the attribute guard or autocrlf override caught
everything, it re-derives and compares the actual bytes.

**Publication Fingerprint** — the smallest deterministic binding available without adding more
implementation than this protocol needs. Scope is deliberately narrowed to stay exact and
reproducible:

- **Domain**: every path in `allowed_files` must already classify, unambiguously, as shape (A) or
  shape (B) (Builder step 7's definitions). A path that is neither, or ambiguous, is not
  fingerprinted at all — it is malformed and BLOCKED until the entry itself is fixed. A path
  containing a raw newline is rejected as malformed in the Envelope itself.
- **Canonical recipe** (true UTF-8 byte-order sort — `Buffer.compare` over each path's UTF-8
  encoding, not JavaScript's default string comparison, which compares UTF-16 *code units* and
  disagrees with UTF-8 byte order for any path containing a character above U+FFFF; also not
  locale-dependent), over exactly the `allowed_files` list: for each path, sorted, compute
  `git hash-object --no-filters -- <path>` if shape (A) or the literal string `ABSENT` if shape (B);
  feed `path \0 hash \n` for each into a running SHA-256; the final hex digest is the Publication
  Fingerprint. `--no-filters` is required, not cosmetic: plain `git hash-object <path>` silently runs
  the same clean filter / autocrlf normalization as `git add`, so without it the fingerprint would
  bind filtered bytes (and could itself execute an external filter command) rather than the raw
  worktree bytes it claims to bind. `scripts/dev/publication-builder.mjs` implements this recipe
  once, parameterized only by where each entry's digest comes from: `computeFingerprint` (raw
  worktree bytes, step 10 above — what Claude calls to construct an Envelope) and
  `computeStagedFingerprint` (actual staged index bytes, step 13 above — the Builder's final seal);
  there is exactly one canonical recipe, not two independently-written ones to keep in sync.
- **What this does and does not prove:** step 10's worktree fingerprint proves the exact on-disk
  bytes of every authorized regular file matched the Envelope at the moment preflight ran — it is an
  early authorization check, not the binding proof. Step 13's staged-index fingerprint is what
  actually binds the commit: it proves the exact bytes about to enter the commit still match the
  Envelope, closing the window where a file could otherwise be mutated after step 10 but
  before/during staging. Neither step re-runs or re-proves that validation commands (`npm test`,
  `check:project-consistency`, etc.) passed; that remains Claude's/Verifier's own separate,
  already-run result, carried informally in Claude's report rather than as a second Envelope field.

### Publication Receipt

The Builder's own output — never authored by Claude or a worker. `status` is `COMMITTED` or
`BLOCKED`; `COMMITTED` carries the new local `commit_sha`; `BLOCKED` carries an exact
`failure_reason`. It reports a **local** commit only — it never reports a push or a remote PR state,
because the Builder never performs either. See
[schemas/dev/publication-receipt.schema.json](../../schemas/dev/publication-receipt.schema.json) for
the full shape.

### Publication Broker (V3.1-B — source implemented, NOT provisioned/activated)

Owned in full by [PUBLICATION_BROKER.md](./PUBLICATION_BROKER.md), not restated here. As of
`DEVELOPMENT-ORCHESTRATION-V3.1-B-PRIVILEGED-PUBLICATION-BROKER-FOUNDATION`, the privileged Broker's
source, protocol, and tests are implemented (`tools/publication-broker/`) — the interface sketched in
earlier V3.1-A text (a bare Envelope + Receipt handoff) has been superseded by the actual implemented
transport: the unprivileged side builds an immutable **PublicationPackage** (Envelope bytes, Receipt
bytes, a self-contained Git bundle, and a manifest binding their digests — see
`schemas/dev/publication-package-manifest.schema.json`), computes an ambiguity-free **REQUEST
DIGEST** over it, and a human independently authorizes that exact digest via the Broker's privileged
admin socket before the Broker will act on it — see `PUBLICATION_BROKER.md`'s "Server-Side
PublicationGrant" section for why a Claude-authored Envelope alone is never sufficient authorization
evidence. The Broker never trusts the Envelope/Receipt's own claims for anything remote-effect-
critical — it independently re-derives branch identity, commit ancestry/parentage, changed paths, and
the canonical fingerprint from its own imported copy of the Git object graph before ever minting a
GitHub write token.

**IMPLEMENTED (source, as of V3.1-B) but NOT PROVISIONED/ACTIVATED:**

- the Broker source itself (`tools/publication-broker/`), its protocol, and its adversarial test
  suite (`npm run test:publication-broker`) — all tested against disposable local Git repos, local
  Unix sockets, and fake HTTP servers, never a real GitHub credential
- a separate OS identity for the Broker process — designed in `PUBLICATION_BROKER.md`'s "macOS
  Privilege/Deployment Design", not created by any task to date
- a GitHub App credential — no App exists, no private key has been generated or installed
- the Unix-socket privilege boundary between Claude/Codex and the Broker — the client/admin socket
  *code* exists and is tested; no socket is listening against real infrastructure
- a real `git push` or PR creation against GitHub — the *mechanics* are implemented and tested
  against fakes; never exercised against a live credential
- a GitHub ruleset enforcing this boundary server-side — designed, not applied

**Until V3.1-C's human provisioning (see `PUBLICATION_BROKER.md`'s own checklist) and a passing
end-to-end live dogfood: REMOTE PUBLICATION AUTOMATION = NOT AVAILABLE.** No code path — Claude
directly, any Codex role, the Local Publication Builder, or the now-implemented-but-unprovisioned
Broker source — pushes a branch or touches a PR. Human manual publication (the human runs
`git push`/`gh pr create` themselves from the Builder's local commit) remains the fallback for every
task, regardless of a task's own Publication fields, exactly as under V3.1-A. See `AGENT_POLICY.md`'s
"Git & Branch Workflow" and `TASK_TEMPLATE.md`'s Publication field defaults.
