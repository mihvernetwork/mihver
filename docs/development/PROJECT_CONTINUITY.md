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
- **STOP state** — whether `.project/STOP` exists, and its hash if so. The pack never modifies or
  removes `STOP`.
- **Source manifest** — for every core authority/navigation source and every active-task Required
  Context path: presence, path-safety result, byte length, working-tree SHA-256, the Git blob OID
  at HEAD (or `null` when not represented there), and a state (`CLEAN`/`MODIFIED`/`UNTRACKED`/
  `MISSING`/`UNSAFE`). **Never full file contents.**
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
key-sorted objects, order-preserving arrays, strict JSON string escaping; see that file's own
header for its precise, narrower-than-full-RFC-8785 compatibility statement). The domain-separation
prefix stops a `ProjectContextPack` hash from ever colliding with a canonical-JSON hash computed for
an unrelated purpose. No clock-dependent field, random ID, process ID, or temporary path
participates in the pack or its hash — two consecutive runs against unchanged repository state
produce byte-identical compact output and an identical `contextHash`; `--pretty` changes only
presentation whitespace. A one-byte change to any manifested source changes that source's own hash
and, transitively, `contextHash`. A pack is invalidated (i.e., should be treated as stale and
recompiled) the moment HEAD, the working tree, or any manifested source changes underneath it —
there is no cache-invalidation signal beyond "recompile and compare."

## Zero-network / read-only behavior

The compiler performs no filesystem write, no Git mutation (no fetch/pull/checkout/branch
creation/reset/clean/stash/commit/config), no LLM call, no GitHub API call, and no HTTP/HTTPS/
fetch/socket call of any kind. Every Git invocation uses `execFileSync` with an explicit argument
array — never an interpolated shell command string. `tests/dev/project-context-pack.test.mjs`
mechanically checks (by source inspection and by diffing repository state before/after
compilation) that this holds.

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

This task (`PROJECT-CONTINUITY-V1A-CONTEXT-PACK`) implements only the ContextPack itself. It does
**not** implement, and does not authorize implementing without a further explicit human task, any
of: a task queue or workflow engine, an autonomy/Decision Council voting or quorum mechanism, a run
bundle or append-only run-directory format, a scheduled human report generator, or any execution
authority. The next authorized Project Continuity task,
`PROJECT-CONTINUITY-V1B-RUN-BUNDLE`, is expected to cover typed autonomy task records, append-only
immutable run directories/bundles, execution/verification evidence manifests, and decision-ready
human merge reports — building on this pack as an input, not superseding it. No task before V1B is
authorized to implement any of that.

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
