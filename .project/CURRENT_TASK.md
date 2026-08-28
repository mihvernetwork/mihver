# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

PROJECT-CONTINUITY-V1A-PR34-GIT-OBSERVATION-BOUNDARY

## Objective

Close six further Git-observation-boundary gaps in `ProjectContextPack` v1 identified after
`PROJECT-CONTINUITY-V1A-PR34-FINAL-HARDENING`: `core.fsmonitor` external-command execution risk
through the compiler's own Git calls, an optional Git-status index refresh/write, inherited `GIT_*`
environment redirection, branch omission from the start/end consistency fence, an ambiguity between
"local `main` legitimately absent" and "the lookup itself failed," and silent omission of
non-enumerable own properties by the canonical JSON serializer. Not authorization for V1B, a task
queue, Decision Council, autonomous execution, Publication Broker activation, push, PR mutation, or
merge.

## Branch / Base

Branch: `chore/project-continuity-v1a-context-pack`.
Base: `main` at `cf0071d8d71549a6284602dc1c007cb54ef965c5` (PR #33 merge commit; unchanged by this
task — PR #34 targets the same base).

## Status

**Complete, pending human review.**

**Publication:**
- Local Publication Builder authorized: no.
- Remote publication: human manual fallback only (unchanged — this task does not touch that).
- One local commit only, on top of `dd58eb6` — never push, never modify PR #34, never mark it
  ready, never merge. `.project/DECISIONS_LOG.md` deliberately not touched by this task.

**Six findings fixed, all in `scripts/dev/project-context-pack.mjs` unless noted**:
1. **`core.fsmonitor` isolation** — every Git invocation now prepends `-c core.fsmonitor=`
   (exported as part of `GIT_GLOBAL_ARGS`), neutralizing a repo/global/system config's
   `core.fsmonitor` setting, which could otherwise name an arbitrary external command Git invokes
   on an ordinary read (status/diff/`ls-files`) regardless of what this compiler asked for —
   mirrors `scripts/dev/publication-builder.mjs`'s existing identical requirement.
2. **No optional-lock index write** — every Git invocation now also prepends
   `--no-optional-locks`, so `git status`/`git diff` can no longer refresh-and-write-back the
   on-disk index as an incidental side effect of a "read." Verified directly: `.git/index`'s own
   mtime is now unchanged by compilation (it previously could change).
3. **`GIT_*` environment isolation** — `buildTryGit` now spawns every Git subprocess with a
   sanitized environment (every inherited `GIT_*` variable stripped: `GIT_DIR`, `GIT_WORK_TREE`,
   `GIT_INDEX_FILE`, `GIT_CONFIG*`, `GIT_ASKPASS`, `GIT_SSH*`, etc.), so this process's own
   environment can never redirect a "read this `repoRoot`" call elsewhere.
4. **Branch in the consistency fence** — `observeGitState`/`gitStateEqual` now also observe
   branch/detached state at both the start and end of compilation, not just HEAD and working-tree
   status, so a checkout/re-attach that leaves HEAD on the same commit is no longer invisible to
   the fence.
5. **Baseline ref lookup disambiguation** — `refs/heads/main`/`refs/remotes/origin/main`
   resolution switched from `git rev-parse --verify` (a single "non-zero exit" outcome that cannot
   distinguish "ref legitimately absent" from "the lookup itself failed") to `git for-each-ref`
   (exits 0 with empty output when a ref legitimately does not exist, non-zero only on a genuine
   failure). A genuine lookup failure now raises a new `BASELINE_REF_LOOKUP_UNAVAILABLE` error
   (`valid: false`), distinct from the pre-existing `BASELINE_UNRESOLVABLE` warning for legitimate
   absence.
6. **Canonical JSON non-enumerable properties** — `scripts/dev/canonical-json.mjs` now rejects any
   non-enumerable own property (which `Object.keys`/`for-in` never see, and would otherwise vanish
   from the canonical output entirely) on both plain objects and arrays (excluding `length` itself,
   which is always a legitimate non-enumerable array property).

**Validation (run directly by Claude, after all fixes)**: `npm ci`; `npm run test:context-pack` —
103/103 (up from 91, 12 new regression tests); `npm test` — 170/170; `npm run
test:project-consistency` — 19/19; `npm run check:project-consistency` — 7/7; `npm run
test:publication-remote-name-parity` — 44/44; `npm run test:publication-builder` — 42/42; Go
`tools/publication-broker` (`build`/`test`/`test -race`/`vet`/`gofmt -l`) all clean, untouched.
`git diff --check` clean. `.git/index` mtime confirmed unchanged by compilation (directly, and via
a new dedicated test). A hostile inherited `GIT_DIR` confirmed not to change compilation's result.
Real-repository smoke output re-validated against the schema; baseline resolution (`main` @
`cf0071d...`) confirmed unchanged in behavior for the legitimate case. `git status --short`
before/after every compiler invocation identical (fixture and real repository) — the compiler
still performs no filesystem write. Changed files: `scripts/dev/project-context-pack.mjs`,
`scripts/dev/canonical-json.mjs`, `tests/dev/project-context-pack.test.mjs`,
`docs/development/PROJECT_CONTINUITY.md` — `.project/DECISIONS_LOG.md` not touched.

No Codex review was requested by this task's own instructions (unlike the two prior
`PROJECT-CONTINUITY-V1A-*` tasks on this branch).

## Required Context

- `docs/development/PROJECT_CONTINUITY.md`
- `scripts/dev/project-context-pack.mjs`
- `scripts/dev/canonical-json.mjs`
- `schemas/dev/project-context-pack.schema.json`
