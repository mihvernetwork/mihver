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

Task: PROJECT-CONTINUITY-V1A-CONTEXT-PACK
Branch: `chore/project-continuity-v1a-context-pack`
Target: main
Publication:
- Local Publication Builder authorized: no
- remote publication: human manual fallback only (unchanged by this task)
- one local commit only, per this task's own explicit instruction — no push/PR/merge

Implemented `ProjectContextPack` v1 (`scripts/dev/project-context-pack.mjs`,
`scripts/dev/canonical-json.mjs`, `schemas/dev/project-context-pack.schema.json`,
`tests/dev/project-context-pack.test.mjs`, `docs/development/PROJECT_CONTINUITY.md`) — a compact,
deterministic, machine-readable, read-only snapshot of MIHVER's repository/task/review state,
explicitly a derived snapshot never a new authority source. See `.project/CURRENT_TASK.md` for the
full deliverable list.

**Two fresh, independent, read-only Codex Reviewers** (`mcp__codex__codex`), run after
implementation and local validation, per this task's own explicit instruction:

**Reviewer A — Functional / Determinism** (threadId `01a04860-b02d-74e0-8ee1-dcfc9fe5aff4`).
Overall verdict as reported: FAIL. Noted its own sandbox could not run
`tests/dev/project-context-pack.test.mjs` (`mkdtempSync` → `EPERM` under its managed read-only
environment) and ran real-repository read-only checks instead — the same category of
reviewer-sandbox information/capability limitation already documented repeatedly in this
repository's Publication Broker hardening history; independently re-confirmed by Claude that the
suite passes in a real environment (40/40, after the fixes below). Findings:
- **H1 (ACCEPTED)** — `executionEligible` did not require `activeTask.active` or an attached
  branch: a clean, baseline-resolvable repository with a `CURRENT_TASK.md` branch mismatch, or a
  detached HEAD, could report `executionEligible: true` even though no task is actually active to
  execute against. Fixed: `compileValidity` (`scripts/dev/project-context-pack.mjs`) now requires
  `activeTask.active` for `executionEligible`, and emits a new `NO_ACTIVE_TASK` warning whenever no
  task is active. New regression tests: "case 16" (extended) and new "case 16b"
  (`tests/dev/project-context-pack.test.mjs`) — a clean, baseline-resolvable branch with a
  `CURRENT_TASK.md` branch mismatch is confirmed `executionEligible: false`.
- **H2 (ACCEPTED)** — a torn-read risk: `compileSourceEntry` read+hashed each core source once,
  but `compileProjectInterpretation`/`compileActiveTask`/`compileReview` then independently
  re-read `.project/PROJECT_STATE.md`/`CURRENT_TASK.md`/`REVIEW_STATE.md` a second time for
  interpretation — an external modification between the two reads could produce a pack whose
  `contextHash`-covered source hash and its own parsed `project`/`activeTask`/`review` fields
  describe two different versions of the same file. Fixed: `compileSourceEntry` now captures the
  decoded text (`__textContent`) from the exact same read used to compute the entry's hash; the
  three interpretation functions reuse that text instead of re-reading, and `__textContent` is
  stripped before the entry is placed in the public `sources` array. New regression test "case 22b"
  confirms `project.source.sha256` matches an independently recomputed hash of the actual on-disk
  bytes. This fix also closes Reviewer B's L1 (below) for the same three files, since there is no
  longer a second read to race against.
- **M1 (ACCEPTED, partial)** — the schema's strict shape does not by itself forbid a few
  semantically contradictory combinations (`detached:true` with non-null `branch`; a non-null
  `baseline.ref` with a null `oid`; `workingTree.clean:true` with non-empty `entries`;
  `stop.present:false` with a non-null `sha256`). Fixed by adding targeted, cheap `if`/`then`
  constraints to `schemas/dev/project-context-pack.schema.json` for exactly these cases. Not fully
  exhaustive (e.g. `state:"CLEAN"` implying `present:true` was not schema-encoded) — the reviewer's
  own finding text acknowledged the compiler already emits only coherent combinations in practice;
  full cross-field schema enforcement was judged disproportionate to add in this task versus the
  targeted fixes actually applied.
- **M2 (ACCEPTED)** — a failed `git ls-files`/`git status --porcelain -- <path>` call for a
  present, safe source was silently classified as `UNTRACKED`/`CLEAN` respectively, and a failed
  repository-wide `git status --porcelain` produced `clean:false` without a validity error. Fixed:
  a per-path Git query failure now yields a new `state: "UNKNOWN"` (added to the schema's `state`
  enum) and a `SOURCE_STATE_UNDETERMINABLE` validity error (`valid:false`); a failed global status
  query sets a new `repository.workingTreeStatusUnavailable` field and a
  `WORKING_TREE_STATUS_UNAVAILABLE` validity error. Not separately regression-tested against a
  live forced Git failure (deterministically forcing `git ls-files`/`git status` to fail without
  corrupting a fixture repository was judged disproportionate effort for this task) — verified by
  direct code review instead; noted as a known lighter-coverage spot in the Final Report.
- **M3 (ACCEPTED)** — see Reviewer B's M2/M3 below (same underlying finding, reported by both
  reviewers independently).
- Explicit answers 2–4, 7, 9 confirmed no defect (no silent execution-authorizing consumer exists
  anywhere in the repository; compact/pretty parse identically with identical `contextHash`;
  `contextHash` is correctly domain-separated and excludes itself; CI wiring is correct).

**Reviewer B — Authority / Security** (threadId `01a04862-7ef2-7930-8b36-49719b669f4e`). Overall
verdict as reported: NOT PASS (no Critical/High). Findings:
- **M1 (ACCEPTED)** — same underlying issue as Reviewer A's H1 above (stale/mismatched task/review
  state could report `executionEligible: true`). Fixed as described above.
- **M2 (ACCEPTED)** — an unsafe/absolute required-context path string, and a nonexistent `--repo`
  CLI argument, were embedded verbatim in the emitted pack, in tension with
  `docs/development/PROJECT_CONTINUITY.md`'s categorical "excludes... user home paths...
  temporary-directory paths" claim. Fixed two ways: (1) the CLI's `--repo` path is no longer
  echoed into the degraded pack's error message (`scripts/dev/project-context-pack.mjs`'s
  `repoRoot does not exist` path) — the message is now a fixed string with no interpolated path;
  (2) `PROJECT_CONTINUITY.md`'s exclusion claim was corrected to precisely state the one remaining,
  intentional, bounded exception: a `sources[]`/`requiredContext` entry's `path` field echoes
  whatever string a repository-tracked document (e.g. `CURRENT_TASK.md`'s own Required Context
  list) literally declared, including an absolute/unsafe one, so its `safety`/`state`
  classification is legible — that string was already present in tracked repository content, not
  newly exposed by the pack.
- **L1 (ACCEPTED, closed as a side effect)** — a symlink-replacement TOCTOU race between the
  path-safety `realpathSync` check and a later independent re-read of
  `PROJECT_STATE.md`/`CURRENT_TASK.md`/`REVIEW_STATE.md`. Closed by the same H2 fix above (no
  second read exists any more for these three files).
- Explicit answers 1, 3 (apart from M1), 4–10 confirmed no defect: the pack remains a derived
  snapshot (every project/task/review field is parsed from its owning document with a
  path+hash pointer, never invented); no code path anywhere in this repository consumes
  `executionEligible` to act automatically; static path-traversal/absolute-path/backslash/symlink
  bypass attempts all fail closed as designed; no `process.env`, `git remote`, or `git config`
  usage exists anywhere in the compiler; `git diff --name-only`/`git status --short` against `main`
  show only files within this task's own Allowed Implementation Scope — nothing under
  `docs/foundation/`, `docs/contracts/`, `docs/adr/`, `schemas/m0/`, or `tools/publication-broker/`
  was touched; no new Claude/Codex/Publication Broker capability was introduced;
  `docs/development/PROJECT_CONTINUITY.md`'s authority-precedence claim matches
  `docs/development/AGENT_POLICY.md`'s existing Document Authority Model; live GitHub PR/CI state
  is correctly documented as unobserved, never guessed, by this zero-network compiler.

**Post-fix revalidation (run directly by Claude)**: `npm run test:context-pack` — 40/40 (up from
38, two new regression tests added for the fixes above); `npm test` — 170/170; `npm run
test:project-consistency` — 19/19; `npm run check:project-consistency` — 7/7; `npm run
test:publication-remote-name-parity` — 44/44; `npm run test:publication-builder` — 42/42; Go
`tools/publication-broker` suite unaffected and unchanged this task. Real-repository smoke output
re-validated against the updated schema. `git status --short` before/after every compiler
invocation identical (fixture and real repository) — the compiler still performs no filesystem
write. `git diff --name-only` confined to this task's own Allowed Implementation Scope.

**Human review of the implementation is the next gate** — this task does not authorize its own
merge, push, or PR. See `.project/PROJECT_STATE.md`'s "Next Authorized Action" once a human has
reviewed this.
