# Review State

Durable review/approval state, updated at the end of each task per `REVIEW_PROTOCOL.md`'s
completion checklist. Never invent or assume approval: if a human has not explicitly stated it,
record the gate as pending, not granted. A Codex or Claude `APPROVED` verdict is a technical
assessment, not human sign-off — see `AGENT_POLICY.md`'s Authority Hierarchy.

**Branch/task-scoped, like [CURRENT_TASK.md](./CURRENT_TASK.md).** The "Latest Review" section
below describes the current gate only when *both* hold: `CURRENT_TASK.md` is active for the
checked-out branch, and this file's own declared Branch/Task (below) matches that same
branch/task. `npm run context` checks this automatically. When either condition fails — no active
task, or this file's Branch/Task doesn't match the active one — the "Latest Review" content is
historical/stale task metadata only, not the current gate; `PROJECT_STATE.md`'s "Next Authorized
Action" is authoritative for what's next, not anything below.

## Latest Review

Task: PROJECT-CONTINUITY-V1A-PR34-GIT-OBSERVATION-BOUNDARY-REVIEW-CLOSEOUT
Branch: `chore/project-continuity-v1a-context-pack`
Target: main
Publication:
- Local Publication Builder authorized: no
- remote publication: human manual fallback only (unchanged by this task)
- one local commit only, per this task's own explicit instruction — no push/PR mutation/merge

Independent-review closeout for implementation commit `429cbefeeaacdf7a6ad859e31579af0f961f956f`
(six Git-observation-boundary fixes), whose own required Codex-review phase a prior final report
incorrectly skipped. Both reviewers reported material findings; all were adjudicated and every
accepted one fixed. See `.project/CURRENT_TASK.md` for the full fix list.

**Reviewer A — Git Process Boundary** (`mcp__codex__codex`, threadId
`01a0495c-e478-7520-b370-40fc5847ed3f`), inspecting the exact committed tree at `429cbef`. Verdict
as reported: NOT PASS.
- Critical (ACCEPTED): child environment was a strip-based denylist (`{...process.env}` minus
  `GIT_*`), not an explicit allowlist — `PATH` and every other non-`GIT_*` variable remained
  inherited. Fixed via `buildHardenedGitEnv`: an explicit allowlist (`PATH`, `HOME`/`USERPROFILE`,
  XDG dirs, Windows/temp-dir variables) plus ten forced safe/deterministic values. `PATH`-based
  executable resolution remains a documented, honestly-stated residual limitation, not claimed
  closed — Node has no absolute-path-first resolution primitive, and every other Git-invoking
  script in this repository shares the identical bare-command pattern.
- High (ACCEPTED): `--no-replace-objects` absent. Fixed: added to `GIT_GLOBAL_ARGS` and
  `GIT_NO_REPLACE_OBJECTS=1` force-set.
- High (ACCEPTED): none of the requested deterministic/safety env controls were set. Fixed: all ten
  now force-set (`GIT_OPTIONAL_LOCKS`, `GIT_TERMINAL_PROMPT`, `GIT_LITERAL_PATHSPECS`,
  `GIT_NO_REPLACE_OBJECTS`, `GIT_CONFIG_NOSYSTEM`, `GIT_CONFIG_GLOBAL`, `GIT_ATTR_NOSYSTEM`,
  `GIT_PAGER`, `LC_ALL`, `LANG`).
- Medium (ACCEPTED): index-write test didn't exercise the touched-but-identical-content case;
  environment tests only checked `GIT_DIR`. Addressed with a strengthened G3 test (checks the exact
  forced-key set, and that `GIT_ASKPASS` is also stripped) plus a new G3c allowlist-structure test.
  A live hostile-`PATH` proof test was deliberately not added — it would only demonstrate the
  accepted, already-honestly-documented residual limitation, not a regression.
- Low (ACCEPTED): documentation overstated the resulting isolation (didn't disclose `PATH`/`HOME`/
  locale inheritance). Fixed in the same doc rewrite.
- Confirmed clean: single centralized `tryGit` harness; `-c core.fsmonitor=` genuinely blocks a
  configured fsmonitor; `.git/index` empirically unchanged (mtime/inode/size identical); `GIT_DIR`/
  `GIT_WORK_TREE`/`GIT_INDEX_FILE` excluded; no temp files created; sole child-process target is
  `"git"`.

**Reviewer B — Final Determinism** (`mcp__codex__codex`, threadId
`01a0495e-b3d5-7551-b9b5-58d961dd95ae`), inspecting the same committed tree. Verdict as reported:
NOT PASS.
- High (ACCEPTED): `resolveRefForEachRef` accepted a malformed or multi-line `for-each-ref` result's
  first line as a best-effort OID, or silently treated it as "the ref doesn't exist" — never as a
  lookup failure. Reproduced empirically by the reviewer (malformed output fell through to the
  `origin/main` fallback with `valid:true`). Fixed: a non-empty result is accepted only when it is
  exactly one well-formed 40-hex OID line; any other non-empty shape now fails closed as
  `BASELINE_REF_LOOKUP_UNAVAILABLE`.
- Low (ACCEPTED): the fence's error message didn't mention branch, even though branch state is
  bound into it. Fixed: message now names branch/detached state explicitly.
- Confirmed clean: fence binds branch/detached, HEAD, and working-tree status all three, and a
  branch-only change (same commit, different ref) does fail closed; genuine local-main/origin-main
  lookup failures do block eligibility; the canonicalizer rejects all six exceptional property cases
  (non-enumerable data/accessor properties, own symbol keys, array numeric accessors, non-enumerable
  array indices, extra array properties) without evaluating or silently omitting any of them;
  ordinary arrays/objects are unaffected; the pack remains derived and non-authorizing.

**Post-fix revalidation (run directly by Claude, after every accepted finding above was fixed)**:
`npm run test:context-pack` — 110/110 (up from 103, 7 new tests: R1/R1b/R1c/R2/R3/R4, plus a
strengthened G3 and new G3c); `npm test` — 170/170; `npm run test:project-consistency` — 19/19;
`npm run check:project-consistency` — 7/7; `npm run test:publication-remote-name-parity` — 44/44;
`npm run test:publication-builder` — 42/42; Go `tools/publication-broker` suite unaffected and
unchanged this task. Real-repository smoke output re-validated against the schema; the `diff
--name-only` call confirmed to carry `-c diff.external=` (before the `diff` token) and
`--no-ext-diff` (after it); every Git invocation confirmed to include `--no-replace-objects`. `git
status --short` before/after every compiler invocation identical (fixture and real repository) —
the compiler still performs no filesystem write. `git diff --name-only` confined to
`scripts/dev/project-context-pack.mjs`, `tests/dev/project-context-pack.test.mjs`, and
`docs/development/PROJECT_CONTINUITY.md` — no forbidden file touched, `.project/DECISIONS_LOG.md`
untouched.

**Human review of the implementation is the next gate** — this task does not authorize its own
merge, push, marking PR #34 ready, or PR mutation. See `.project/PROJECT_STATE.md`'s "Next
Authorized Action" once a human has reviewed this.
