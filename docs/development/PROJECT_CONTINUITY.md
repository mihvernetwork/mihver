# Project Continuity: ProjectContextPack v1 (V1A)

Owner of the ProjectContextPack v1 contract: what it is, what it deliberately is not, how to
compile and read it, and how it relates to the rest of MIHVER's development operating model. See
[AGENT_POLICY.md](./AGENT_POLICY.md) for the Claude/Codex execution model this contract sits
inside, and [CLAUDE.md](../../CLAUDE.md)'s "Fast Session Bootstrap" for when a fresh session should
run it.

## Chat is an interface, not project memory

A conversation transcript is a session-scoped interface between a human and Claude/Codex — it is
never where MIHVER's durable state lives, and it is never authoritative for anything. Nothing in
this repository's process depends on a fresh session having access to a prior chat's history.
Durable state lives in the repository itself: live Git state, and the `.project/`/`docs/`
artifacts this document's "Source manifest" section names. A ProjectContextPack exists precisely
so that a fresh Claude, Codex, or future control-plane session never needs — and is never expected
to have — chat history to reconstruct current context.

## The ContextPack is a derived snapshot, not an authority artifact

A `ProjectContextPack` is compiled, deterministically and read-only, from the repository's own
live Git state and its owning documents. It never defines a fact; it only observes and reports
facts that are already defined elsewhere. Authority precedence, most authoritative first:

1. **Live Git state** — the actual branch, HEAD, working tree, and history.
2. **The owning repository artifact/document** — e.g. `.project/PROJECT_STATE.md` for
   milestone/checkpoint state, `.project/CURRENT_TASK.md` for the active task, `.project/REVIEW_STATE.md`
   for review/approval state — see [AGENT_POLICY.md](./AGENT_POLICY.md)'s "Operational State Scope"
   and "Document Authority Model" for the full per-file rules this pack only observes, never
   redefines.
3. **This derived `ProjectContextPack`** — a compact, hashed observation of (1) and (2), useful for
   fast reconstruction, never a substitute for reading (2) directly when its full detail matters.
4. **Session/chat summaries** — the least authoritative; useful only within their own session.

If a `ProjectContextPack` ever disagrees with live Git or with an owning document, **the pack is
stale and loses** — recompile it, and trust the higher-precedence source in the meantime. This
mirrors the same "trust reality over the mirror" rule `.project/PROJECT_STATE.md` and
`scripts/dev/project-context.mjs` already state for themselves.

## What the pack contains, and deliberately excludes

Compiled by `scripts/dev/project-context-pack.mjs` (`npm run context:pack`), shaped by
[`schemas/dev/project-context-pack.schema.json`](../../schemas/dev/project-context-pack.schema.json).
At a high level, a pack contains:

- **Artifact identity** — schema/compiler version and a domain-separated `contextHash` covering
  every authority-relevant field.
- **Repository snapshot** — branch or explicit detached state, exact HEAD OID, the selected local
  baseline (`main`, falling back to `origin/main`), baseline OID, merge-base, ahead/behind counts,
  clean/dirty working-tree state and entries, and paths changed relative to the baseline.
- **Compact project interpretation** — milestone, latest frozen checkpoint, and next authorized
  action, each derived from `.project/PROJECT_STATE.md` with a pointer (path + hash) back to it —
  never a second definition of those facts.
- **Active task** — whether `.project/CURRENT_TASK.md` declares the branch actually checked out
  (the same fail-closed rule `npm run context` already uses), and if so its Task ID, objective,
  status, and Required Context paths.
- **Review gate** — whether `.project/REVIEW_STATE.md`'s "Latest Review" matches the active task's
  branch *and* Task ID exactly (otherwise historical, never the current gate).
- **STOP state** — whether a filesystem node exists at `.project/STOP`, and its hash if it is a
  safe regular file. Determined via `lstat` semantics through the same bounded safe-read primitive
  every source uses (see "Path-safe source reads" below), never via a plain existence check —
  see "Unsafe STOP nodes" below for exactly what counts as present-but-unsafe. The pack never
  modifies or removes `STOP`.
- **Source manifest** — for every core authority/navigation source and every active-task Required
  Context path: presence, path-safety result, byte length, working-tree SHA-256, the Git blob OID
  at HEAD (or `null` when not represented there), and a state (`CLEAN`/`MODIFIED`/`UNTRACKED`/
  `MISSING`/`UNSAFE`/`UNKNOWN`). **Never full file contents.** `UNKNOWN` means a Git query needed to
  classify this source failed, or a "clean" claim's HEAD blob identity could not be independently
  established or matched — see "Git query availability" below; an `UNKNOWN` source can never
  coexist with `executionEligible: true`.
- **Validity** — a `valid`/`executionEligible` pair (see "Why the pack cannot authorize execution"
  below) plus structured `errors`/`warnings`.

It deliberately excludes: GitHub tokens, environment variables, credential-helper values, raw Git
config, raw remote URLs, SSH agent details, complete file contents, Claude/Codex transcripts or
chain of thought, API responses, and secrets/PEM material. The compiler itself never reads
`process.env`, never runs `git remote`/`git config`, and never discovers or emits a machine-local
home or temporary-directory path on its own. This is narrower than "no local path can ever appear
in the output" in two specific, bounded ways, both call-site-supplied rather than automatically
discovered: (1) a `sources[]`/`activeTask.requiredContext` entry's `path` field echoes whatever
string a repository-tracked document (e.g. `.project/CURRENT_TASK.md`'s Required Context list)
literally declared — including an absolute or otherwise unsafe path, reported verbatim precisely
so its `safety`/`state` classification is legible; that string was already present in tracked
repository content, not newly exposed by the pack. (2) The CLI's own `--repo <path>` argument is
never echoed back into a compiled pack. Repository identity is represented only through safe
repository-local facts; v1 deliberately omits any owner/repository tuple rather than risk it
becoming an accidental credential or URL leak vector.

## Hash and invalidation rules

```text
contextHash =
  "sha256:" + SHA256(
    UTF8("MIHVER:ProjectContextPack:v1\0")
    || canonicalJson(packWithoutContextHash)
  )
```

`canonicalJson` is `scripts/dev/canonical-json.mjs`'s deterministic serializer (recursively
key-sorted objects, order-preserving arrays, strict JSON string escaping). It matches RFC 8785's
(JSON Canonicalization Scheme, "JCS") UTF-16 code-unit key ordering and ECMAScript number-to-string
formatting. **JCS does not normalize Unicode** — RFC 8785 has no NFC/NFD/NFKC/NFKD step at all; it
instead requires valid Unicode input and preserves valid strings exactly as supplied, which is
exactly what this serializer does: no normalization is performed or implied, and two
Unicode-equivalent-but-differently-normalized strings are never treated as canonically identical.
"Valid Unicode input" is enforced by rejecting any string or object key containing a lone
(unpaired) UTF-16 surrogate code unit, which cannot be re-encoded as well-formed text. The
serializer also rejects own symbol-keyed properties, non-enumerable own properties (which
`Object.keys`/`for-in` never see, and would otherwise vanish from the output entirely), accessor
(getter/setter) properties, and an array with an extraneous own property outside its dense index
range — every case where a value would otherwise be silently omitted or evaluated rather than data
the caller can see was rejected.
See that file's own header for the complete, precise compatibility statement.

The domain-separation prefix stops a `ProjectContextPack` hash from ever colliding with a
canonical-JSON hash computed for an unrelated purpose. No clock-dependent field, random ID, process
ID, or temporary path participates in the pack or its hash — two consecutive runs against unchanged
repository state produce byte-identical compact output and an identical `contextHash`; `--pretty`
changes only presentation whitespace. A one-byte change to any manifested source changes that
source's own hash and, transitively, `contextHash`. A pack is invalidated (i.e., should be treated
as stale and recompiled) the moment HEAD, the working tree, or any manifested source changes
underneath it — there is no cache-invalidation signal beyond "recompile and compare."

## Zero-network / read-only behavior

The compiler performs no filesystem write, no Git mutation (no fetch/pull/checkout/branch
creation/reset/clean/stash/commit/config), no LLM call, no GitHub API call, and no HTTP/HTTPS/
fetch/socket call of any kind. Every Git invocation uses `execFileSync` with an explicit argument
array — never an interpolated shell command string. `tests/dev/project-context-pack.test.mjs`
mechanically checks (by source inspection and by diffing repository state before/after
compilation) that this holds.

Every Git invocation is additionally isolated on two more axes, both prepended/applied
automatically and exported as `GIT_GLOBAL_ARGS` (`scripts/dev/project-context-pack.mjs`) so tests
can deterministically account for them:

- **`--no-optional-locks`** — an ordinary `git status`/`git diff` can otherwise refresh and write
  back the on-disk index as a side effect of what looks like a pure read; this flag disables that
  entire class of incidental write, which a genuinely read-only compiler must never perform even
  unintentionally. `tests/dev/project-context-pack.test.mjs` confirms `.git/index`'s own mtime is
  unchanged by compilation.
- **`-c core.fsmonitor=`** — neutralizes a repository/global/system Git config's `core.fsmonitor`
  setting, which can otherwise name an arbitrary external command Git invokes on ordinary read
  operations (status, diff, `ls-files`) regardless of what this compiler itself asked for. Mirrors
  `scripts/dev/publication-builder.mjs`'s identical existing fsmonitor-neutralization requirement.

Every Git subprocess is also spawned with a **sanitized environment**: every inherited `GIT_*`
variable (`GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_CONFIG*`, `GIT_ASKPASS`, `GIT_SSH*`,
etc.) is stripped before spawning, so this process's own environment can never silently redirect a
"read this `repoRoot`" call to a different location, or plumb unwanted credential-adjacent
behavior into a subprocess this compiler only ever uses for local, read-only queries against an
explicit `cwd`. `tests/dev/project-context-pack.test.mjs` confirms both that the sanitized
environment object contains no `GIT_*` key, and that a hostile inherited `GIT_DIR` does not change
compilation's result.

## Git query availability

Every Git query this compiler makes can fail independently of what it is asking about, and a
failed query is never collapsed into the same representation as "the query succeeded and found
nothing" (an empty result, `null`, or `[]`). A failure produces a dedicated, stable
`validity.errors[].code` instead — for example `BRANCH_STATE_UNAVAILABLE` (branch/detached state),
`MERGE_BASE_UNAVAILABLE`, `HISTORY_COUNTS_UNAVAILABLE` (ahead/behind), `CHANGED_PATHS_UNAVAILABLE`,
`WORKING_TREE_STATUS_UNAVAILABLE` (the repository-wide status query), and, per source,
`SOURCE_STATE_UNDETERMINABLE` (an `ls-files`/per-path `status` query failed) or
`SOURCE_HEAD_BLOB_UNDETERMINABLE` (a source `git status` reports as unmodified, but its HEAD blob
identity either could not be established or does not match a blob hash independently computed from
the exact bytes this compiler already read — see "Clean-source/HEAD-blob binding" below), and
`BASELINE_REF_LOOKUP_UNAVAILABLE` (see "Baseline ref lookup" below). Any such
error makes `validity.valid: false`, which makes `executionEligible: false` — none of these
conditions can ever coexist with `executionEligible: true`. Production Git calls always run through
`execFileSync("git", args, { shell: false, ... })`; `tests/dev/project-context-pack.test.mjs`
deterministically injects a failure for an exact Git argument array (via an
execFileSync-compatible test double, matching `scripts/dev/publication-builder.mjs`'s existing
`execFileSyncImpl` convention) to exercise every one of these fail-closed paths without a shell and
without needing to actually corrupt a fixture repository.

### Clean-source/HEAD-blob binding

A source is reported `CLEAN` only after independently binding that claim to the exact bytes this
compiler already read for it: the compiler computes a Git blob SHA-1 directly from those bytes
(the same `blob <len>\0<content>` hashing scheme Git itself uses) and requires it to equal the
source's own `headBlobOid` (from `git rev-parse --verify HEAD:<path>`). If that OID is unavailable
or disagrees, the source is reported `UNKNOWN`, not `CLEAN` — `git status`'s "no diff" claim alone
is never trusted on its own for the CLEAN classification.

### Baseline ref lookup

`refs/heads/main` and `refs/remotes/origin/main` are resolved via `git for-each-ref`, not
`git rev-parse --verify`. `rev-parse --verify` exits non-zero both when a ref legitimately does not
exist and when the lookup itself genuinely fails (corrupt repo, Git internal error, etc.) — a single
outcome that cannot distinguish "no baseline exists, fall back or report none" from "the lookup
failed, fail closed." `for-each-ref` instead exits `0` with **empty output** when a ref legitimately
does not exist, and only exits non-zero on an actual query failure, so the two cases are
distinguishable: a legitimate absence contributes only the existing `BASELINE_UNRESOLVABLE` warning
(once neither ref resolves), while a genuine lookup failure raises the dedicated
`BASELINE_REF_LOOKUP_UNAVAILABLE` error (`valid: false`).

## Snapshot consistency fence

The compiler observes branch/detached state, HEAD, and a normalized working-tree status once at the
very start of compilation and once again immediately before the pack is finalized. Branch state is
included specifically so a checkout/detach/re-attach that leaves HEAD pointed at the same commit
(e.g. re-attaching HEAD to a branch via `git symbolic-ref` without moving the commit, or a
detach-then-reattach) is not invisible to a HEAD-only fence. Two observations compare
equal only when *every* one of the start and end queries succeeded and produced the same value; any
query
failure at either point — even a query that fails identically at both ends — is treated as
"changed," never as "confirmed unchanged" (a repeated failure is unresolved, not evidence of
stability). Whenever the two observations don't compare equal, compilation reports
`REPOSITORY_CHANGED_DURING_COMPILATION`, an error (so `valid: false`, `executionEligible: false`). **This is a bounded consistency fence that detects an externally
observed change, not a filesystem transaction or lock.** It cannot prevent a change from happening
during compilation, and a change occurring entirely within the (typically sub-second) window
between the two observations, in a way that leaves both observations looking identical (e.g. a
change immediately reverted), is not detectable by this mechanism. Do not read it as a stronger
guarantee than that.

## Path-safe source reads

Every source read (core authority sources, active-task Required Context entries, and
`.project/STOP`) goes through one bounded, read-only primitive
(`safeReadSource` in `scripts/dev/project-context-pack.mjs`): after structural and lexical path
checks, it opens the target with `O_NOFOLLOW` where the platform supports it (macOS/Linux), `fstat`s
the resulting file descriptor to require a regular file, and reads from that *same* descriptor —
so the bytes hashed are guaranteed to be exactly what `fstat` validated for the file's final path
component. A dangling symlink, a symlink to an existing file, a directory, or any non-ENOENT
open/lstat/realpath/read failure is `UNSAFE`, never silently treated as `SAFE` or `MISSING` — only
a true `ENOENT` is `MISSING`.

**Documented residual limitation**: Node's public `fs` module has no `openat`-relative-to-a-
directory-descriptor primitive, so the realpath-based ancestor-containment check (does this path,
once every symlink is resolved, still land inside the repository root?) and the `O_NOFOLLOW` open
of the final component are still two separate syscalls. An ancestor directory replaced with a
symlink in the narrow window between those two syscalls is not caught by this function. This is a
real, acknowledged gap under an adversarial concurrent-local-attacker model — do not claim it is
fully closed. It requires an attacker already able to mutate the repository's filesystem
concurrently with compilation, and the worst case is that its byte content is hashed/summarized
into the pack (this compiler never executes anything it reads).

## Unsafe STOP nodes

`.project/STOP` is read through the same `safeReadSource` primitive as every other source, so
`existsSync`-style presence checking is never used for it. A safe regular file yields
`stop.present: true` with its SHA-256; any other node — a dangling symlink, a symlink to an
existing target, a directory, or an unreadable/unsafe node — also yields `stop.present: true`, but
with `sha256: null`, plus a `STOP_NODE_UNSAFE` validity error (so `valid: false`,
`executionEligible: false` in addition to the ordinary `STOP_PRESENT` warning that already blocks
eligibility whenever `STOP` is present at all). Only a true `ENOENT` — no filesystem node at that
path — is `stop.present: false`.

## Degraded output and error sanitization

Whenever compilation cannot proceed safely — the requested repository root does not exist, or an
unexpected internal exception is thrown anywhere in the compiler — a fixed, statically-constructed
degraded pack is returned instead of throwing: `validity.valid: false`,
`validity.executionEligible: false`, `repository.executionBlocked: true`, and exactly one
structured error with the stable code `INTERNAL_COMPILATION_ERROR` and a fixed message. This
degraded pack is built directly (never by recursively calling the same schema-validating,
potentially-throwing finalize path a normal pack goes through) so it cannot itself fail the way it
exists to recover from. It never contains a raw exception message, a stack trace, or any
caller-supplied path (including an absolute `--repo` argument) — that detail, if any, is written to
stderr only, never into the emitted pack. Because the degraded pack's shape is entirely static, it
is fully deterministic: two independent runs that both hit this path produce byte-identical output
and an identical `contextHash`.

## Fresh-session bootstrap

A fresh session reconstructs current MIHVER state per [CLAUDE.md](../../CLAUDE.md)'s "Fast Session
Bootstrap": run `npm run context` (the existing compact human-readable snapshot) and
`npm run context:pack` (this pack, machine-readable and hashable). The pack is a convenience for
fast, hashable reconstruction — it is derived and must never be trusted over live Git or the
owning source documents it observes. When the pack and a source document disagree, read the source
document directly and treat the pack as stale.

## Why the pack cannot authorize execution

`ProjectContextPack` never grants execution, even when `validity.executionEligible === true`. It is
a read-only observation, produced by a non-LLM, network-free, deterministic compiler with no
concept of task selection, approval, or credentials — nothing in this repository's process treats
its output as permission to act. `executionEligible` exists only to distinguish two different
questions the pack can answer:

- **Structural validity** (`validity.valid`) — was this a coherent, safely-resolved snapshot at
  all? A dirty or in-progress repository can still be structurally valid; `valid` only goes `false`
  for an actual integrity problem (HEAD unresolvable, or a required source/Required-Context path
  that is unsafe — absolute, traversal, or a symlink — rather than merely absent).
- **Execution eligibility** (`validity.executionEligible`) — is this snapshot additionally clean
  enough that a human might reasonably authorize new execution against it? At minimum this is
  `false` whenever the working tree is dirty, HEAD or the baseline cannot be established, a
  required authority source or active-task Required Context path is missing or unsafe, branch/task
  state is contradictory (the same branch declared by both `CURRENT_TASK.md` and `REVIEW_STATE.md`
  but for two different Task IDs), or `.project/STOP` is present.

Even a pack with `executionEligible === true` is only ever an *input* a human (or a future,
separately-authorized control plane — see below) may consider. The actual authorization to execute
remains exactly where [CLAUDE.md](../../CLAUDE.md) and [AGENT_POLICY.md](./AGENT_POLICY.md) already
put it: an explicit human decision.

## Relationship to the future task queue, run bundle, human report, and Decision Council

This task (`PROJECT-CONTINUITY-V1A-CONTEXT-PACK`, hardened by
`PROJECT-CONTINUITY-V1A-PR34-FINAL-HARDENING`) implements only the ContextPack itself. It does
**not** implement, and does not authorize implementing without a further explicit human task, any
of: a task queue or workflow engine, an autonomy/Decision Council voting or quorum mechanism, a run
bundle or append-only run-directory format, a scheduled human report generator, or any execution
authority. `PROJECT-CONTINUITY-V1B-RUN-BUNDLE` is the **recommended** next Project Continuity task
— not yet authorized — expected, once a human explicitly authorizes it after V1A itself is merged
and frozen, to cover typed autonomy task records, append-only immutable run directories/bundles,
execution/verification evidence manifests, and decision-ready human merge reports, building on this
pack as an input, not superseding it. No task before that explicit authorization exists is
authorized to implement any of it.

## V1A limitations

- **Live GitHub state is not observed.** This compiler makes zero network calls, so it has no view
  of open PRs, CI run status, PR review comments, or actual GitHub merge state. Those remain
  intentionally outside `.project/CONTEXT_INDEX.md`'s scope too — see that file's "Not covered
  here" section and [CLAUDE.md](../../CLAUDE.md)'s "Fast Session Bootstrap" for when GitHub itself
  should be consulted instead.
- **No autonomous execution is implemented by this pack or this task.** `executionEligible` is a
  descriptive field, not a control signal; nothing reads it to decide to act on its own.
- **Repository identity is intentionally not represented** in v1 (see "What the pack contains"
  above) — a future version may add a sanitized owner/repository tuple once that can be done
  without any risk of leaking remote/credential detail.
