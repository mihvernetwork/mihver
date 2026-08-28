# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

PROJECT-CONTINUITY-V1A-PR34-FINAL-HARDENING

## Objective

Remediate the material findings from the independent final-tree review of draft PR #34
(`chore/project-continuity-v1a-context-pack`), hardening `ProjectContextPack` v1's failure paths
without expanding its scope: the degraded-pack fallback, `.project/STOP` fail-closed detection, Git
observation failure handling, a bounded start/end consistency fence, path-safe source reads, schema
cross-field coherence, and canonical JSON Unicode handling. Not authorization for V1B, a task queue,
Decision Council, autonomous execution, Publication Broker activation, push, PR mutation, or merge.

## Branch / Base

Branch: `chore/project-continuity-v1a-context-pack`.
Base: `main` at `cf0071d8d71549a6284602dc1c007cb54ef965c5` (PR #33 merge commit; unchanged by this
task — PR #34 targets the same base).

## Status

**Complete, pending human review.**

**Publication:**
- Local Publication Builder authorized: no.
- Remote publication: human manual fallback only (unchanged — this task does not touch that).
- One local commit only, on top of `e502ea9` — never push, never modify PR #34, never merge.

**Pre-fix reproduction**: `node scripts/dev/project-context-pack.mjs --repo
/tmp/mihver-context-pack-does-not-exist` crashed (uncaught `Error: ... failed self-validation ...
missing required property 'workingTreeStatusUnavailable'`, exit 1) instead of emitting the
documented degraded JSON contract — confirmed before any code changed.

**Eight findings from PR #34's independent review, all fixed**:
1. **Degraded pack** — rebuilt as a static, non-recursive fallback (`buildDegradedPack` in
   `scripts/dev/project-context-pack.mjs`) that never calls the schema-validating finalize path
   recursively, includes every schema-required field, is deterministic, never contains raw
   exception text or a caller-supplied path (diagnostics go to stderr only via `logInternalError`),
   and always exits 2 with a schema-valid pack.
2. **STOP fail-closed** — `.project/STOP` now goes through the same bounded `safeReadSource`
   primitive as every other source (`lstat` semantics, never `existsSync`): a dangling symlink,
   symlink-to-existing-target, directory, or unreadable node is `present:true, sha256:null` plus a
   new `STOP_NODE_UNSAFE` validity error; only true `ENOENT` is `present:false`.
3. **Git observation failures** — `tryGit` is now built from an injectable
   `options.execFileSyncImpl` (production default unchanged: `execFileSync("git", args, {
   shell:false, ... })`, mirroring `scripts/dev/publication-builder.mjs`'s existing convention).
   Branch/merge-base/ahead-behind/changed-path/global-status/per-source-ls-files/per-source-status
   failures each now raise a dedicated stable error code
   (`BRANCH_STATE_UNAVAILABLE`/`MERGE_BASE_UNAVAILABLE`/`HISTORY_COUNTS_UNAVAILABLE`/
   `CHANGED_PATHS_UNAVAILABLE`/`WORKING_TREE_STATUS_UNAVAILABLE`/`SOURCE_STATE_UNDETERMINABLE`)
   instead of silently collapsing into an empty/clean/untracked result. A "clean" source claim is
   now independently bound to its own already-read bytes via a locally-computed Git blob SHA-1
   compared against `headBlobOid`; disagreement or unavailability yields `SOURCE_HEAD_BLOB_UNDETERMINABLE`
   (state `UNKNOWN`) instead of a trusted `CLEAN`.
4. **Snapshot consistency fence** — HEAD and normalized working-tree status are observed once at
   the start of compilation and once again before finalization; any observed difference (including
   one side failing while the other succeeds) raises `REPOSITORY_CHANGED_DURING_COMPILATION`.
   Documented precisely as a change-detection fence, not a filesystem transaction/lock.
5. **Path-safe source read** — `classifyPathSafety`+`readFileSync` replaced by one bounded
   `safeReadSource` primitive: structural/lexical checks, `lstat` + realpath containment, then an
   `O_NOFOLLOW` open + `fstat` + read from the same descriptor, so the hashed bytes are exactly what
   `fstat` validated for the final path component. Only true `ENOENT` is `MISSING`; every other
   non-regular-file/unreadable outcome is `UNSAFE` with a specific new safety code
   (`UNSAFE_LSTAT_FAILED`/`UNSAFE_REALPATH_FAILED`/`UNSAFE_OPEN_FAILED`/`UNSAFE_READ_FAILED`, plus
   the existing symlink/not-regular-file/escapes-repo codes). **Documented residual limitation**:
   Node's public `fs` has no `openat`-relative-to-a-directory-descriptor API, so an ancestor
   directory swapped between the realpath containment check and the `O_NOFOLLOW` open is not
   caught — stated honestly in `docs/development/PROJECT_CONTINUITY.md`, not claimed closed.
6. **Schema coherence** — `$schema` is now an exact `const`; new root/cross-object `if`/`then`
   constraints require `executionEligible:true` to imply `validity.valid`,
   `repository.executionBlocked:false`, a clean/available working tree, `activeTask.active`,
   `stop.present:false`, non-null HEAD/baseline/mergeBase/ahead/behind, and no `UNKNOWN` source;
   `executionBlocked` is now schema-required to be the logical negation of `executionEligible`;
   `activeTask.active:true` requires non-null `declaredBranch`/`taskId`;
   `workingTreeStatusUnavailable:true` requires `workingTree.clean:false`; per-source-state
   coherence added for `CLEAN`/`MODIFIED`/`UNTRACKED`/`MISSING`/`UNSAFE`.
7. **Canonical JSON** — `scripts/dev/canonical-json.mjs` now rejects a lone (unpaired) UTF-16
   surrogate in any string or object key, an own symbol-keyed property, an accessor
   (getter/setter) property, and an array with an extraneous own property outside its index range.
   Header corrected: RFC 8785 (JCS) does not normalize Unicode at all (no NFC/NFD step exists in
   the RFC); it requires valid Unicode input and preserves valid strings exactly as supplied.
8. **DECISIONS_LOG** — the V1A branch-local entry introduced by `e502ea9` rewritten to a concise
   durable decision (no reviewer mechanics, test counts, branch name, pending/merged status, or a
   claim that V1B is already authorized); every entry that existed at the merge-base is untouched.

**Validation (run directly by Claude, after all fixes, including the one accepted reviewer
finding below)**: `npm ci`; `npm run context`; `npm run context:pack` / `npm run context:pack --
--pretty` (compact/pretty parse identically, identical `contextHash`, schema-valid, byte-identical
on a repeated run); `npm run test:context-pack` — 91/91 (up from 40, 51 new regression tests added
across the eight findings plus one reviewer-found fence gap); `npm test` — 170/170; `npm run
test:project-consistency` — 19/19; `npm run check:project-consistency` — 7/7 (including
`decisions-log-append-only-vs-base`); `npm run test:publication-remote-name-parity` — 44/44; `npm
run test:publication-builder` — 42/42; Go `tools/publication-broker`
(`build`/`test`/`test -race`/`vet`/`gofmt -l`) all clean, untouched. `git diff --check` clean.
`git status --short` before/after every compiler invocation identical (fixture and real
repository) — the compiler still performs no filesystem write. Changed files confined to this
task's own Allowed Files list.

**Codex delegation**: two fresh, independent, read-only `mcp__codex__codex` reviewers
(Failure-Path/Determinism and Authority/Filesystem-Safety), run after implementation and local
validation per this task's own instruction. Both found one real, additional issue: the snapshot
consistency fence's equality check silently treated a Git query that failed identically at both the
start and end observation as "confirmed unchanged" rather than "changed" — fixed (`gitStateEqual`
now requires both sides' queries to have succeeded before comparing values at all). One further
finding (rewriting `.project/DECISIONS_LOG.md`'s branch-local entry seemingly conflicts with its
own append-only policy) was adjudicated REJECTED_WITH_REASON: the exact rewrite, including its
exact wording, was explicitly mandated by this task's own human-authored prompt for content that
never reached `main` — independently confirmed by `check:project-consistency`'s own
`decisions-log-append-only-vs-base` check passing cleanly. See `.project/REVIEW_STATE.md` for the full itemized
findings and Claude's adjudication of each.

## Required Context

- `docs/development/PROJECT_CONTINUITY.md`
- `scripts/dev/project-context-pack.mjs`
- `scripts/dev/canonical-json.mjs`
- `schemas/dev/project-context-pack.schema.json`
