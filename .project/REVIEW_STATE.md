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

Task: PROJECT-CONTINUITY-V1A-PR34-GIT-FILTER-SIDE-EFFECT-CLOSURE
Branch: `chore/project-continuity-v1a-context-pack`
Target: main
Publication:
- Local Publication Builder authorized: no
- remote publication: human manual fallback only (unchanged by this task)
- no commit authorization granted — all changes below are uncommitted, working-tree only; no
  push/PR mutation/merge

Closes the one remaining gap in `ProjectContextPack`'s Git child-process side-effect boundary:
repository-local `filter.<name>.clean`/`.process`/`.smudge` drivers, which Git can invoke as an
arbitrary command during an ordinary working-tree `git status`/`git diff`, were previously
undetected. See `.project/CURRENT_TASK.md` for the full implementation/review/verification record;
summarized here.

**Implementer** (`mcp__codex__codex`, thread `01a04992-89cb-76a2-8e90-b34220368829`): added
`detectConfiguredGitFilters`, run before the first Git call the compiler makes
(`observeGitState`'s `git status`), under the same hardened env/global-args every other call uses.
Three-way exit-code handling: exit 0 with output → block (`GIT_FILTER_DRIVER_CONFIGURED`); `err.status
=== 1` → no match, proceed; anything else → block (`GIT_FILTER_DRIVER_CHECK_UNAVAILABLE`, never
conflated with "no match"). A blocking result returns a degraded pack immediately, before any
working-tree Git call — structurally unreached, not merely skipped.

**Reviewer** (`mcp__codex__codex`, thread `01a0499b-a1f3-7b13-99cc-ba59efb1a4cb`), fresh/
independent. Verdict: CHANGES REQUIRED, one finding, ACCEPTED and fixed:
- MAJOR: the original key-extraction regex could, via greedy backtracking, capture attacker-
  controlled config *value* text (not just the key name) into an unbounded degraded-pack message —
  and `buildDegradedPack` bypasses schema self-validation, so a crafted/numerous config could yield
  a non-schema-valid pack and leak unsanitized command text. Fixed: the CONFIGURED path no longer
  parses any text out of the git output at all — only a bounded integer count of matched lines,
  combined with fixed template text. New test "G0e" (250 adversarial lines) confirms the message
  never contains the attacker string; independently confirmed observed length 364 chars (schema
  limit 2000). Re-checked by the same Reviewer post-fix: **VERDICT: RESOLVED** — all four PASS
  items reconfirmed.
- Confirmed clean (unaffected by the fix): exit-code three-way handling both directions; structural
  short-circuit; config-resolution scope matches the later status/diff calls exactly (includes
  followed, system/global disabled); fail-closed decision never depended on key extraction; both
  pre-existing `buildDegradedPack` call sites unaffected; new codes match the schema's `code`
  pattern; G0/G0b/G0c/G0d genuinely assert the short-circuit, not merely the error code; no
  pre-existing test broke; new doc subsection and its TOCTOU residual-limitation disclosure match
  the file's existing tone/rigor.

**Verifier** (`mcp__codex__codex`, three fresh sessions across the task, correcting a read-only-
sandbox `mkdtemp` block partway through): `npm run test:context-pack` — 115/115 (5 new tests:
G0/G0b/G0c/G0d/G0e); `npm test` — 170/170; `npm run test:project-consistency` — 19/19; `npm run
check:project-consistency` — 7/7; `git diff --check` clean; real-repository `npm run context:pack`
— `valid:true`, no filter-driver error code; `executionEligible:false` correctly, due solely to
this task's own legitimately dirty working tree.

**Process deviation, corrected mid-task**: Claude ran validation directly via Bash once before
dispatching the first Verifier; the user corrected this twice. `docs/development/AGENT_POLICY.md`
was amended — a separate, explicitly user-directed edit, not part of this task's own scope — to
make Verifier delegation unconditional (no size threshold, no self-verification by a producing
agent), mirroring the existing Implementer threshold rule.

**Human review is the next gate** — this task does not authorize its own commit, merge, push,
marking PR #34 ready, or PR mutation. See `.project/PROJECT_STATE.md`'s "Next Authorized Action"
once a human has reviewed this and the separate `AGENT_POLICY.md` amendment.
