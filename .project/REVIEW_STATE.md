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

Task: PROJECT-CONTINUITY-V1B-RUN-BUNDLE
Branch: `feat/project-continuity-v1b-run-bundle`
Target: main
Publication:
- Local Publication Builder authorized: yes, per this task's own explicit instruction (authorized
  once the repository lifecycle gates for this task are complete — met)
- remote publication: human manual fallback only (unchanged by this task)
- one local commit, no push, no PR mutation, no merge, no V1B follow-on started

New subsystem: a deterministic, typed, auditable Run Bundle record (`TaskRecord`, `EvidenceManifest`,
`RunManifest`, a writer/compiler, and a human report renderer) built on `ProjectContextPack` v1 as
pure input. See `.project/CURRENT_TASK.md` for the full architecture/implementation/review record;
summarized here.

**Reviewer** (`mcp__codex__codex`, fresh/independent, thread
`01a04ad0-844d-7c03-9989-15389b631f0b`, spanning both rounds). Round 1 verdict: **REJECT** — 5 MAJOR
+ 1 MINOR, all independently re-traced by Claude and ACCEPTED:
- MAJOR: append path never cross-checked re-read document bytes against the manifest's own
  reference content hashes (only self-hashes) — exploitable for `evidence-manifest.json`. Also:
  `runId`/ContextPack binding/repository identity were silently rebuildable on every append with no
  check against the existing bundle, violating the core "binds to the exact ProjectContextPack used"
  invariant. Fixed: reference-hash cross-checks added; `RUN_IDENTITY_IMMUTABLE` hard-rejects any
  append changing those three fields. New tests RB14/RB15.
- MAJOR: the report renderer never schema-validated, only hash-checked — a hash-consistent-but-
  schema-invalid document would still render. Fixed: reuses the writer's exported validators to
  schema-validate all three documents before reading any field. New test RB16.
- MAJOR (adjudicated, narrowed scope): TOCTOU on the `--out` directory's parent components matches
  this repository's own existing precedent for the identical class of gap in
  `project-context-pack.mjs`'s `safeReadSource` — resolved by honest "Documented residual
  limitation" disclosure (matching that precedent's tone) plus one narrow point-in-time recheck
  immediately before the write phase, not a full directory-descriptor rewrite.
- MAJOR (adjudicated, narrowed scope): non-atomic three-file write — substantially mitigated once
  the reference-hash fix lands (any subsequent reader fails closed on inconsistency, never silently
  trusts it); resolved by one documentation sentence, not transactional-directory-swap machinery.
- MAJOR: code density/style inconsistent with repository convention, directly correlated with the
  first finding being hard to spot. Fixed: rewritten to match
  `project-context-pack.mjs`/`publication-builder.mjs`'s convention.
- MINOR: discriminated-union cross-kind field rejection was untested. Fixed: new test RB17.
Round 2 (post-fix) verdict: **RESOLVED**, one residual MINOR (a doc section didn't mention the new
schema-validation step) — fixed directly by Claude, re-confirmed **RESOLVED**.

**Verifier** (`mcp__codex__codex`, three fresh full sessions): `npm run test:run-bundle` — 13/13
then 17/17 after the fix round; `npm test` — 170/170 throughout; `npm run test:context-pack` —
115/115 (`project-context-pack.mjs` confirmed unchanged); `npm run test:publication-builder` —
42/42 (`publication-builder.mjs` confirmed unchanged); `npm run check:project-consistency` — 7/7;
`npm run test:project-consistency` — 19/19; `git diff --check` clean throughout. Real end-to-end CLI
smoke tests against this actual repository (outside the test harness) confirmed correct
`RUN_IDENTITY_IMMUTABLE` refusal on a mismatched append, correct finalize/report/re-write-refusal
lifecycle, and correct symlink refusal (macOS `/tmp` itself).

**Human review is the next gate** — this task does not authorize a push, PR, or merge. See
`.project/PROJECT_STATE.md`'s "Next Authorized Action" once a human has reviewed this; no V1B
follow-on (V1C, Decision Council, autonomous execution, or any other next step) is authorized by
this task.
