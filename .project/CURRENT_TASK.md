# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

PROJECT-CONTINUITY-V1A-PR34-GIT-OBSERVATION-BOUNDARY-REVIEW-CLOSEOUT

## Objective

Independent-review and lifecycle closeout for the local implementation commit `429cbef` (which
itself closed six Git-observation-boundary gaps): invoke the two fresh, independent, read-only
Codex reviewers that `PROJECT-CONTINUITY-V1A-PR34-GIT-OBSERVATION-BOUNDARY`'s own instructions
required but a prior final report incorrectly skipped, adjudicate every finding, fix every accepted
material one, and record the outcome. Not authorization for V1B, a task queue, Decision Council,
autonomous execution, Publication Broker activation, push, PR mutation, marking PR #34 ready, or
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
- One local commit only, on top of `429cbef` — never push, never modify PR #34, never mark it
  ready, never merge. `.project/DECISIONS_LOG.md` deliberately not touched by this task.

**Two fresh, independent, read-only Codex Reviewers** (`mcp__codex__codex`), inspecting the exact
committed tree at `429cbef` (not an uncommitted version), run per this task's own explicit
instruction:

**Reviewer A — Git Process Boundary** (threadId `01a0495c-e478-7520-b370-40fc5847ed3f`). Verdict as
reported: NOT PASS. Findings, all ACCEPTED and fixed:
- **Critical** — the child environment was built by spreading `{...process.env}` and deleting
  `GIT_*` keys (a denylist/strip strategy), not an explicit allowlist; every non-`GIT_*` variable,
  including `PATH`, remained inherited. Fixed: `buildHardenedGitEnv`
  (`scripts/dev/project-context-pack.mjs`) now starts from an empty object and copies in only a
  fixed allowlist (`PATH`, `HOME`/`USERPROFILE`, XDG config/cache dirs, Windows system-root
  variables, temp-dir variables), then force-sets a fixed set of safe/deterministic values
  (`GIT_OPTIONAL_LOCKS=0`, `GIT_TERMINAL_PROMPT=0`, `GIT_LITERAL_PATHSPECS=1`,
  `GIT_NO_REPLACE_OBJECTS=1`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=<null device>`,
  `GIT_ATTR_NOSYSTEM=1`, `GIT_PAGER=cat`, `LC_ALL=C`, `LANG=C`). `PATH`-based executable resolution
  itself remains a **documented residual limitation** (Node has no built-in "resolve to an absolute
  binary path first" primitive; every other Git-invoking script in this repository — publication
  builder, project consistency, project context — uses the same bare `execFileSync("git", ...)`
  pattern with no absolute-path pinning either) — stated honestly in
  `docs/development/PROJECT_CONTINUITY.md`, never claimed closed.
- **High** — `--no-replace-objects` (and its `GIT_NO_REPLACE_OBJECTS=1` environment backstop) were
  absent, leaving `refs/replace/*` object substitution able to influence `merge-base`/`rev-list`/
  `diff` traversal. Fixed: added to `GIT_GLOBAL_ARGS` and the forced-safe environment.
- **High** — none of the requested deterministic/safety environment controls were set. Fixed: all
  ten forced values listed above are now always set.
- **Medium** — the index-write regression test (G2) didn't exercise the "touched but byte-identical
  content" case, and the environment tests (G3/G3b) only checked `GIT_DIR`, not a broader hostile
  environment. Addressed: new tests confirm the explicit-allowlist structure directly (no
  arbitrary/non-Git inherited variable passes through; `GIT_ASKPASS` in addition to `GIT_DIR` is
  confirmed stripped) — see "R2"/"R3"/G3/G3c below. A full hostile-`PATH` proof test was
  deliberately not added: it would only demonstrate the accepted, documented residual limitation
  above, not a regression, and constructing a fake `git` executable on `PATH` for a real
  `execFileSync` call was judged disproportionate given that limitation is already honestly
  documented rather than hidden.
- **Low** — documentation described the strip-based sanitization accurately but overstated the
  resulting isolation (didn't disclose `PATH`/`HOME`/locale inheritance). Fixed alongside the code
  changes — see `docs/development/PROJECT_CONTINUITY.md`'s rewritten isolation section.
- Explicit confirmations: one centralized `tryGit` harness for every call site; `-c core.fsmonitor=`
  genuinely blocks a configured fsmonitor from executing; `.git/index` empirically unchanged
  (mtime/inode/size all identical before/after, confirmed directly against the real repository);
  `GIT_DIR`/`GIT_WORK_TREE`/`GIT_INDEX_FILE` specifically are excluded; the compiler creates no
  temporary file/directory and its sole child-process target is `"git"`.

**Reviewer B — Final Determinism** (threadId `01a0495e-b3d5-7551-b9b5-58d961dd95ae`). Verdict as
reported: NOT PASS. Findings, both ACCEPTED and fixed:
- **High** — `resolveRefForEachRef` only inspected the FIRST line of a non-empty
  `for-each-ref` result and accepted it if it looked like a 40-hex OID, silently treating malformed
  or multi-line (ambiguous) output as either a best-effort guess or as "the ref doesn't exist" —
  never as a lookup failure. Reproduced empirically by the reviewer (malformed output fell through
  to the `origin/main` fallback with `valid:true`; a multi-line result accepted the first fake OID).
  Fixed: a non-empty result is now accepted only when it is *exactly one* well-formed 40-hex OID
  line; anything else (malformed content, more than one line) now returns `failed:true`, raising
  `BASELINE_REF_LOOKUP_UNAVAILABLE` (`valid:false`) instead of silently falling back or guessing.
  New tests "R1"/"R1b"/"R1c".
- **Low** — the `REPOSITORY_CHANGED_DURING_COMPILATION` message said only "HEAD or the working tree
  changed," not mentioning branch, even though branch state is bound into the fence. Fixed: message
  now names branch/detached state explicitly. New test "R4".
- Explicit confirmations: the fence binds branch/detached state, HEAD, and normalized working-tree
  status, all three, and a branch-only change (same commit, different ref) does fail closed; local-
  main/origin-main lookup failures (the genuine-command-failure case) do produce
  `BASELINE_REF_LOOKUP_UNAVAILABLE` and block eligibility; the canonicalizer rejects, without
  evaluating or silently omitting, all six exceptional property cases tested directly (non-
  enumerable data property, non-enumerable accessor, own symbol property, array numeric accessor,
  non-enumerable array index, extra array property); ordinary dense arrays/plain objects are
  unchanged; the pack remains a derived, zero-authority artifact — nothing consumes
  `executionEligible` to authorize an action.

**Post-fix revalidation (run directly by Claude)**: `npm ci`; `npm run context`; `npm run
context:pack` / `npm run context:pack -- --pretty` (both schema-valid, parse identically, identical
`contextHash`); `npm run test:context-pack` — 110/110 (up from 103, 7 new regression tests: R1,
R1b, R1c, R2, R3, R4, plus G3's own test strengthened and G3c added); `npm test` — 170/170; `npm run
test:project-consistency` — 19/19; `npm run check:project-consistency` — 7/7; `npm run
test:publication-remote-name-parity` — 44/44; `npm run test:publication-builder` — 42/42; Go
`tools/publication-broker` (`build`/`test`/`test -race`/`vet`/`gofmt -l`) all clean, untouched.
`git diff --check` clean. Real-repository smoke output re-validated against the schema; baseline
resolution (`main` @ `cf0071d...`) unchanged in behavior for the legitimate case; the `diff
--name-only` call confirmed to carry both `-c diff.external=` (before the `diff` token) and
`--no-ext-diff` (after it); every Git invocation confirmed to include `--no-replace-objects`. `git
status --short` before/after every compiler invocation identical (fixture and real repository) —
the compiler still performs no filesystem write. Changed files: `scripts/dev/project-context-pack.mjs`,
`tests/dev/project-context-pack.test.mjs`, `docs/development/PROJECT_CONTINUITY.md` —
`.project/DECISIONS_LOG.md`, `schemas/dev/project-context-pack.schema.json`,
`.github/workflows/ci.yml`, `package.json`, `CLAUDE.md`, `.project/CONTEXT_INDEX.md`,
`.project/PROJECT_STATE.md`, `ROADMAP.md`, and `tools/publication-broker/**` not touched.

## Required Context

- `docs/development/PROJECT_CONTINUITY.md`
- `scripts/dev/project-context-pack.mjs`
- `scripts/dev/canonical-json.mjs`
- `schemas/dev/project-context-pack.schema.json`
