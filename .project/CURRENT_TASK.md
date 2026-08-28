# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

PROJECT-CONTINUITY-V1A-CONTEXT-PACK

## Objective

Implement a compact, deterministic, machine-readable `ProjectContextPack` v1, derived from
MIHVER's existing authoritative repository state (live Git + `.project/`/`docs/` owner documents),
so a fresh Claude/Codex/control-plane session can reconstruct current repository/task/review
context without scanning large historical Markdown files or depending on prior chat history. The
pack is a **derived snapshot, never a new authority source** — see
`docs/development/PROJECT_CONTINUITY.md`. This task does not implement the Decision Council, task
queue, run bundle, scheduled reporter, or Publication Broker activation, and does not authorize
autonomous execution, model voting, publication, push, PR creation, merge, or credential use.

## Branch / Base

Branch: `chore/project-continuity-v1a-context-pack`.
Base: `main` at `cf0071d8d71549a6284602dc1c007cb54ef965c5` (PR #33 merge commit).

## Status

**Complete, pending human review.**

**Publication:**
- Local Publication Builder authorized: no.
- Remote publication: human manual fallback only (unchanged — this task does not touch that).
- Do not commit/push/PR beyond the one local commit this task's own instructions authorize —
  never push, never open/modify a PR, never merge.

**Deliverable**:
- `scripts/dev/canonical-json.mjs` — a small, pure, dependency-free canonical JSON serializer
  (recursive key-sorting, order-preserving arrays, strict JSON string escaping; rejects
  `undefined`/functions/symbols/BigInt/sparse arrays/cyclic objects/non-finite numbers/non-plain
  objects). Documents precisely which parts of RFC 8785 it does and does not implement (UTF-16
  key-sort order and ECMAScript number-to-string: yes; Unicode NFC normalization: no).
- `scripts/dev/project-context-pack.mjs` — the `ProjectContextPack` v1 compiler
  (`compileProjectContextPack(repoRoot)`) plus a CLI (`node scripts/dev/project-context-pack.mjs
  [--pretty] [--repo <path>] [--help]`, wired as `npm run context:pack`). Read-only: every Git call
  uses `execFileSync` with an explicit argument array (never an interpolated shell string), no
  filesystem write, no network/LLM/GitHub-API call. Fails closed on a missing/unsafe required
  authority source or active-task Required Context path (absolute path, `..` traversal, symlink, or
  a path escaping the repository after symlink resolution). Self-validates the compiled artifact
  against its own JSON Schema before returning (via the repository's existing `ajv` dependency; no
  new dependency added), falling back to a minimal, schema-shaped, `valid:false` degraded pack on
  any unexpected internal error.
- `schemas/dev/project-context-pack.schema.json` — JSON Schema Draft 2020-12, `additionalProperties:
  false` throughout, strict SHA-1/SHA-256/hash/enum/path patterns, structured `errors`/`warnings`
  finding objects with stable `^[A-Z][A-Z0-9_]*$` reason codes. No secrets, environment maps, raw Git
  config, raw remote URLs, or full source contents are representable.
- `tests/dev/project-context-pack.test.mjs` — 40 tests (assert-based, no framework, matching this
  repository's existing `tests/dev/*.test.mjs` convention) against disposable temporary Git
  repositories built with `execFileSync`, covering: clean main/task-branch compilation; exact
  branch/HEAD/baseline/merge-base/ahead/behind data; run-to-run and compact-vs-pretty determinism;
  canonical-serialization property-order independence; one-byte source-change hash propagation;
  dirty-tree representation without execution eligibility; missing/unsafe required source and
  required-context handling (fail-closed, with `valid`/`executionEligible` correctly distinguished);
  `CURRENT_TASK.md`/`REVIEW_STATE.md` branch/Task-ID mismatch semantics (including the contradictory-
  same-branch-different-task-ID case); detached HEAD never becoming an active task; local-`main`-
  preferred-over-`origin/main` baseline selection and its bounded fallback; no-baseline fail-closed;
  `STOP` presence; untracked/modified source-state accuracy; deterministic manifest/changed-path
  ordering; zero-filesystem-write proof (fixture and real repository); real-repository schema-
  validation and cross-check against direct `git`/file observation; a static source-inspection check
  that the compiler contains no network or filesystem-write API and that every `execFileSync` call
  targets `git` only; CLI usage-error and stdout-is-JSON-only behavior; and a dedicated regression
  test for a real bug found during this task's own validation (below).
- `docs/development/PROJECT_CONTINUITY.md` — new semantic owner of the `ProjectContextPack` v1
  contract: authority precedence (live Git > owning artifact > this pack > chat), what the pack
  contains/excludes, the domain-separated `contextHash` algorithm and invalidation rule, zero-
  network/read-only behavior, fresh-session bootstrap usage, why the pack never authorizes
  execution (`valid` vs `executionEligible` distinguished precisely), its relationship to the future
  V1B run bundle/task queue/Decision Council, and V1A's explicit limitation that live GitHub
  PR/CI state is not observed by this zero-network compiler.
- `package.json`: added `context:pack` and `test:context-pack` scripts; no existing script
  reordered or renamed.
- `.github/workflows/ci.yml`: added one step, "Project context pack tests" (`npm run
  test:context-pack`), inside the existing `project-validation` job, directly after "Test". No
  trigger, permission, concurrency, action pin, `fetch-depth`, existing local-main-baseline step,
  other step, or job was touched; the two required check names (`Project validation`, `Publication
  Broker`) are unchanged — no new required status-check context was created.
- `CLAUDE.md`: minimally extended "Fast Session Bootstrap" to also run `npm run context:pack`,
  stating explicitly that the pack is derived and must not be trusted over live Git or its owning
  source documents.
- `.project/CONTEXT_INDEX.md`: two new rows pointing at `PROJECT_CONTINUITY.md` and at the
  compiler/schema/test set.

**A real bug was found and fixed during this task's own local validation** (before any review):
the internal `tryGit` helper applied a blanket `String#trim()` to every Git command's output. For
`git status --porcelain`'s multi-line output, this silently stripped the leading space from the
*first* line whenever that line's status code begins with a space (e.g. `" M path"`, the common
"modified, unstaged" case) — shifting every character of that one entry's parsed `path` left by one
and silently dropping its first character (observed directly: `.github/workflows/ci.yml` was
misparsed as `github/workflows/ci.yml`). Fixed by trimming only trailing newline(s)
(`out.replace(/\r?\n+$/, "")`) instead of a full `trim()`; every other call site was checked and
does not depend on leading-whitespace stripping. A dedicated regression test
(`tests/dev/project-context-pack.test.mjs`, "case 23b") reproduces the exact failure mode against a
disposable fixture repository and asserts the path is exact.

**Validation (run directly by Claude, after the trim() bug above was found and fixed, and again
after the two Codex reviewers' fixes below)**: `npm ci`; `npm run context`; `npm run context:pack` /
`npm run context:pack -- --pretty` (both parse to the same object and the same `contextHash`, both
validate against the schema, a repeated compact run is byte-identical); `npm run test:context-pack`
— 40/40; `npm test` — 170/170; `npm run test:project-consistency` — 19/19; `npm run
check:project-consistency` — 7/7; `npm run test:publication-remote-name-parity` — 44/44; `npm run
test:publication-builder` — 42/42; Go `tools/publication-broker`: `go build ./...`, `go test
./...`, `go test -race ./...`, `go vet ./...` all clean, `gofmt -l .` clean (untouched this task).
`git diff --check` clean. `git status --short` before/after every compiler invocation identical
(both against fixture repositories and against this real repository) — the compiler performs no
filesystem write. `git diff --name-only` / `git status --short` show changes confined to exactly
the files this task's own Allowed Implementation Scope authorizes.

**Codex delegation**: two fresh, independent, read-only `mcp__codex__codex` reviewers
(Functional/Determinism and Authority/Security), run after implementation and local validation per
this task's own instruction. Both found real, material findings — most notably that
`executionEligible` did not require an active task (a fail-open gap: a clean, baseline-resolvable
snapshot with a detached HEAD or a `CURRENT_TASK.md` branch mismatch could report
`executionEligible: true`) and a torn-read/TOCTOU risk (a source's hash and its later parsed
interpretation could independently re-read the file and observe two different versions). Both were
fixed, along with several smaller findings (schema coherence gaps, Git-query-failure
misclassification, a path-echoing documentation-accuracy issue). See `.project/REVIEW_STATE.md` for
the full itemized findings and Claude's adjudication of each.

## Required Context

- `docs/development/PROJECT_CONTINUITY.md`
- `scripts/dev/project-context-pack.mjs`
- `scripts/dev/canonical-json.mjs`
- `schemas/dev/project-context-pack.schema.json`
