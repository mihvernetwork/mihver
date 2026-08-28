# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

PROJECT-CONTINUITY-V1A-PR34-GIT-FILTER-SIDE-EFFECT-CLOSURE

## Objective

Close the reproducible Git child-process side-effect boundary in `ProjectContextPack`: a
repository-local Git config (or a file it `include`s/`includeIf`s) can define a `filter.<name>.clean`
/`.process`/`.smudge` driver, which Git can invoke as an arbitrary external command during an
ordinary `git status`/`git diff` against the working tree — a real, unaddressed gap, confirmed by
direct inspection of `scripts/dev/project-context-pack.mjs` at HEAD (`5b68f86`): the existing
hardening (explicit env allowlist, `--no-optional-locks`, `--no-replace-objects`,
`-c core.fsmonitor=`, `GIT_CONFIG_NOSYSTEM`/`GIT_CONFIG_GLOBAL=<null device>`/`GIT_ATTR_NOSYSTEM`,
`diff.external=`/`--no-ext-diff`) covers every other axis but never detects or blocks a configured
filter driver. Required invariant: compilation must detect any repository-local `filter.*.clean`/
`.process`/`.smudge` definition (config resolved exactly as Git itself would for the later calls —
includes followed, system/global already disabled) and fail closed *before* the very first
filter-capable Git call — `observeGitState`'s `git status --porcelain`, which today is the first Git
call compilation makes. Not authorization for V1B, a task queue, Decision Council, autonomous
execution, Publication Broker activation, push, PR mutation, marking PR #34 ready, merge, or any
further edit to `docs/development/AGENT_POLICY.md` (governance commit `5b68f86` stands as-is).

## Branch / Base

Branch: `chore/project-continuity-v1a-context-pack`.
Base: `main` at `cf0071d8d71549a6284602dc1c007cb54ef965c5` (PR #33 merge commit; unchanged by this
task — PR #34 targets the same base).

## Status

**Complete, pending human review.**

**Publication:**
- Local Publication Builder authorized: no.
- Remote publication: human manual fallback only (unchanged — this task does not touch that).
- No commit authorization granted by this task prompt — default per `AGENT_POLICY.md`'s "Commits"
  section is no. All work below is uncommitted, in the working tree only. Never push, never modify
  PR #34, never mark it ready, never merge. `.project/DECISIONS_LOG.md` deliberately not touched.

**Implementer** (`mcp__codex__codex`, thread `01a04992-89cb-76a2-8e90-b34220368829`), scope
`scripts/dev/project-context-pack.mjs` / `tests/dev/project-context-pack.test.mjs` /
`docs/development/PROJECT_CONTINUITY.md`: added `detectConfiguredGitFilters`, called immediately
after `tryGit` is built and strictly before `observeGitState` (the first Git call the compiler
previously made) in `compileProjectContextPack`. Queries `git config --get-regexp
"^filter\..+\.(clean|process|smudge)$"` under the same `GIT_GLOBAL_ARGS`/`buildHardenedGitEnv()`
every other call uses (so it observes config exactly as the later `status`/`diff` calls would —
system/global already disabled, repo-local `include`/`includeIf` files followed). Exit-code
handling: exit 0 with output → `GIT_FILTER_DRIVER_CONFIGURED` (blocking); thrown error with
`err.status === 1` → no match, safe, compilation proceeds; any other outcome →
`GIT_FILTER_DRIVER_CHECK_UNAVAILABLE` (blocking, fail-closed — never conflated with "no match").
Either blocking case returns a degraded pack immediately — `observeGitState`,
`compileRepositorySnapshot`, and every other Git-touching call are structurally unreached, not
merely skipped-in-the-common-case. `buildDegradedPack` was generalized to take an optional
`{code, message}` override (both pre-existing call sites keep their original fixed
`INTERNAL_COMPILATION_ERROR` unchanged).

**Reviewer** (`mcp__codex__codex`, thread `01a0499b-a1f3-7b13-99cc-ba59efb1a4cb`), fresh/independent,
reviewing the Implementer's diff. Verdict: CHANGES REQUIRED, one finding, ACCEPTED and fixed:
- **MAJOR** — the original implementation extracted matched `filter.*.{clean,process,smudge}` key
  names from the raw `git config --get-regexp` output via a greedy regex
  (`^(filter\..+\.(?:clean|process|smudge))(?:[=\s]|$)`) and joined them into the degraded-pack
  message. Greedy backtracking meant a crafted config value containing a later matching substring
  (e.g. `filter.evil.clean = git-lfs.clean --foo`) could make the "extracted key" swallow
  attacker-controlled value text, and the joined list had no length bound — while
  `buildDegradedPack` bypasses `finalizePack`'s schema self-validation entirely, so a sufficiently
  crafted/numerous config could produce a non-schema-valid degraded pack and leak unsanitized
  command text into it. Fixed: `detectConfiguredGitFilters`'s CONFIGURED path no longer parses any
  key/value text out of the git output at all — it returns only a plain count of non-empty output
  lines, and the message is built from fixed template text plus that bounded integer, never any
  string derived from actual config content. New test "G0e" (250 crafted adversarial lines,
  including one designed to defeat naive key extraction) asserts the resulting message never
  contains the attacker-supplied literal text and stays far under the schema's 2000-character
  `message` limit (independently confirmed: 364 characters observed for that input). The
  `buildDegradedPack` doc comment was updated to state the now-true invariant precisely. Re-checked
  by the same Reviewer after the fix: **VERDICT: RESOLVED**
  (`RAW-CONFIG-NONDISCLOSURE`/`BOUNDED-COUNT`/`DEGRADED-INVARIANT-COMMENT`/`G0E-REGRESSION-COVERAGE`
  all PASS).
- Explicit confirmations (unchanged by the fix, still PASS after re-check): exit-0/exit-1/other-exit
  three-way handling correct in both directions; the check runs strictly first and short-circuits
  structurally, not merely by convention; config-resolution scope matches the later status/diff
  calls exactly (includes followed, system/global disabled); the git-side name-pattern is sound;
  the fail-closed decision itself never depended on the (now-removed) key extraction; both
  pre-existing `buildDegradedPack` call sites are unaffected; both new codes match the schema's
  `code` pattern; the G0/G0b/G0c/G0d tests genuinely assert the short-circuit (no status/diff argv
  observed), not merely that an error code appears; no pre-existing test's fake `execFileSyncImpl`
  broke, since the established convention of falling through unmatched argv to the real
  `execFileSync` (against a real, filter-driver-free fixture repo) made the new upfront call safe
  by construction; the new doc subsection and its "Documented residual limitation" (a point-in-time
  check, not a lock — a concurrent local process mutating `.git/config` between the check and the
  subsequent status calls is not caught, consistent with this compiler's existing trusted-local-
  machine threat model) match the file's existing tone/rigor.

**Verifier** (`mcp__codex__codex`, two fresh sessions — threads `01a04998-882d-7b70-b46d-d1596f93a296`
and, after correcting a read-only-sandbox `mkdtemp` block in the first session's two temp-fixture
checks, `01a04999-fe64-7691-ba43-dbce98222ad2`/`01a049a0-f238-7e70-b2e9-e66209c308ef` for the
corrected and post-fix runs): `npm run test:context-pack` — 115/115 (up from 110; five new tests:
G0/G0b/G0c/G0d/G0e); `npm test` — 170/170; `npm run test:project-consistency` — 19/19; `npm run
check:project-consistency` — 7/7; `git diff --check` clean; `npm run context:pack` against this
real repository — `valid:true`, no filter-driver error code (this repo has no filter drivers
configured); `executionEligible:false` correctly, because the working tree is legitimately dirty
(this in-progress task's own uncommitted changes) — `compileValidity`'s `executionEligible`
computation requires `repository.workingTree.clean`, so this is expected, not a defect.

Deviation from initial process, corrected mid-task: Claude ran `npm run test:context-pack`/`npm
test` directly via Bash once, before dispatching the first Verifier — the user corrected this twice
in-session; `docs/development/AGENT_POLICY.md` was amended (separate, explicitly user-authorized
edit, not part of this task's own Allowed Scope) to make Verifier delegation an unconditional rule
with no size exception, mirroring the existing Implementer threshold rule. See that file's
"Claude Responsibilities" section.

**Changed files** (working tree, uncommitted): `scripts/dev/project-context-pack.mjs`,
`tests/dev/project-context-pack.test.mjs`, `docs/development/PROJECT_CONTINUITY.md` (this task's
scope) and `docs/development/AGENT_POLICY.md` (separate, user-directed governance edit, see above)
— `schemas/dev/project-context-pack.schema.json`, `.github/workflows/ci.yml`, `package.json`,
`CLAUDE.md`, `.project/CONTEXT_INDEX.md`, `.project/PROJECT_STATE.md`, `ROADMAP.md`,
`.project/DECISIONS_LOG.md`, and `tools/publication-broker/**` not touched.

**Human review of the implementation (and of the AGENT_POLICY.md amendment) is the next gate** —
this task does not authorize its own commit, merge, push, marking PR #34 ready, or PR mutation.

## Required Context

- `docs/development/PROJECT_CONTINUITY.md`
- `scripts/dev/project-context-pack.mjs`
- `scripts/dev/canonical-json.mjs`
- `schemas/dev/project-context-pack.schema.json`
