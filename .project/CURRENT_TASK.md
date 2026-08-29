# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

PROJECT-CONTINUITY-V1B-RUN-BUNDLE

## Objective

Implement the Project Continuity V1B Run Bundle foundation `docs/development/PROJECT_CONTINUITY.md`'s
"Relationship to the future task queue, run bundle, human report, and Decision Council" section
already named as the recommended next task: a deterministic, typed, auditable run record —
`TaskRecord`, an append-only immutable `RunManifest`/Run Bundle directory structure, an
`EvidenceManifest`, a deterministic writer/compiler, and a human review report renderer — built on
`ProjectContextPack` v1 as an input, never superseding or weakening it. Explicitly human-authorized
by this task prompt. Does not implement autonomous task selection, task scheduling, Decision
Council/quorum, autonomous execution authorization, a production executor, unrestricted tool
execution, Publication Broker provisioning/activation, or any push/PR/merge automation.

## Branch / Base

Branch: `feat/project-continuity-v1b-run-bundle`.
Base: `main` at `9e92db02d5623d7c0dcf5eb00819f329d9cdd0fd`.

## Status

**Complete, pending human review.**

**Publication:**
- Local Publication Builder authorized: yes, per this task's own explicit instruction ("authorized
  only after the repository lifecycle gates for this task are complete" — met, see below).
- Remote publication: human manual fallback only (unchanged — this task does not touch that).
- One local commit, subject `feat: add project continuity v1b run bundle`. Never push, never touch
  a PR, never merge, no V1B follow-on (V1C/Decision Council/etc.) started.

**Architecture** (decided by Claude before delegation — see `docs/development/RUN_BUNDLE.md` for
the full, current, authoritative contract; summarized here): three canonical JSON documents per
run (`run-manifest.json`, `task-record.json`, `evidence-manifest.json`) beneath a caller-supplied
`--out` directory; two hash flavors (domain-separated self-hashes `MIHVER:TaskRecord:v1\0` /
`MIHVER:EvidenceManifest:v1\0` / `MIHVER:RunManifest:v1\0`, mirroring `computeContextHash`'s exact
recipe, vs. plain content hashes for external evidence/document bytes); append-only evidence with
immutable run identity (runId/ContextPack binding/repository identity/TaskRecord fixed at creation);
hard finalization gate; reuses `canonicalizeJson`, `computeContextHash`, and
`readRepositoryIdentity`/`parseGitHubRemote` rather than reimplementing any of them.

**Scout** (`mcp__codex__codex`, thread `01a04abd-e90c-76d3-8238-7f3fd7365528`): surveyed
`scripts/dev/`, `schemas/dev/`, `tests/dev/`, `docs/development/`, `.project/CONTEXT_INDEX.md`, and
`package.json` conventions before design; confirmed no repository-defined "RISK" classification
exists (the task prompt's `RISK: R2` tag is external, not acted on beyond disclosure).

**Implementer** (`mcp__codex__codex`, thread `01a04ac4-7781-7c23-a15c-4fb6d2e3b133`, two dispatches):
initial build (7 files + package.json), then a substantial fix round after independent review (see
below). Final scope: `docs/development/RUN_BUNDLE.md`, `schemas/dev/task-record.schema.json`,
`schemas/dev/evidence-manifest.schema.json`, `schemas/dev/run-manifest.schema.json`,
`scripts/dev/run-bundle.mjs`, `scripts/dev/run-bundle-report.mjs`, `tests/dev/run-bundle.test.mjs`
(17 tests), `package.json` (3 new script entries only).

**Reviewer** (`mcp__codex__codex`, fresh/independent, thread `01a04ad0-844d-7c03-9989-15389b631f0b`
throughout, including its post-fix re-checks). Round 1 verdict: **REJECT**, 5 MAJOR + 1 MINOR, all
independently re-traced and ACCEPTED by Claude:
- **MAJOR** — append path never cross-checked re-read `task-record.json`/`evidence-manifest.json`
  bytes against `run-manifest.json`'s own `taskRecordRef.contentHash`/`evidenceManifestRef.contentHash`
  (only self-hashes were checked) — a fabricated-but-internally-self-consistent replacement document
  would have passed, exploitable today for `evidence-manifest.json` specifically. **Also**: `runId`,
  ContextPack binding, and repository identity were silently rebuildable on every append with no
  check against the existing bundle — an append could rebind a run to a different ProjectContextPack
  or change its identity, directly violating the core "binds to the exact ProjectContextPack used"
  invariant. Fixed: `verifyExistingBundle` now cross-checks reference content hashes in addition to
  self-hashes; `verifyImmutableRunIdentity` now hard-rejects (`RUN_IDENTITY_IMMUTABLE`) any append
  changing runId/contextPackBinding/repository. New tests RB14 (identity immutability, all three
  components) and RB15 (self-consistent-but-different replacement rejected for both documents).
- **MAJOR** — the report renderer never schema-validated any document, only hash-checked it; a
  hash-consistent-but-schema-invalid document would still render. Fixed: reuses the writer's
  exported `getRunBundleValidators`/`describeValidationFailure` to schema-validate all three
  documents before reading any field. New test RB16.
- **MAJOR (adjudicated, narrowed scope)** — TOCTOU on the `--out` directory's parent components
  (Node has no portable `openat`-relative-to-a-descriptor primitive) is real but matches this exact
  repository's own existing precedent for the identical class of gap in `project-context-pack.mjs`'s
  `safeReadSource` — resolved by honest "Documented residual limitation" disclosure (matching that
  precedent's tone/rigor) plus one narrow point-in-time recheck (`outputDirectoryStillSafe`)
  immediately before the write phase, not a full directory-descriptor rewrite.
- **MAJOR (adjudicated, narrowed scope)** — the three-file sequential write isn't atomic; a crash
  mid-write is real but substantially mitigated once the first MAJOR fix lands (any subsequent
  reader now fails closed on the inconsistency, never silently trusts it) — resolved by one
  documentation sentence, not full transactional-directory-swap machinery.
- **MAJOR** — code density (long lines, compounded boolean expressions, minimal WHY-comments)
  inconsistent with repository convention and directly correlated with MAJOR 1 being hard to spot
  ("critical checks... discard which verification failed through a compound expression," in the
  Reviewer's own words). Fixed: rewritten to match `project-context-pack.mjs`/`publication-builder.mjs`'s
  one-check-per-clause, named-helper, WHY-commented convention (207→590 lines / 76→246 lines).
- **MINOR** — the discriminated-union cross-kind field rejection (evidence schema's `allOf`/`if`/`then`
  blocks) was untested. Fixed: new test RB17, one case per kind.
Round 2 (post-fix) verdict: **RESOLVED** — every MAJOR/MINOR item independently re-traced and
confirmed, including real execution of the fixed logic, not just presence of a plausibly-named
function. One residual MINOR found: `RUN_BUNDLE.md`'s "Fail-closed human report" section didn't
mention the new schema-validation step. Fixed directly by Claude (one-sentence doc addition, file
already fully read this task); Reviewer re-confirmed **RESOLVED**.

**Verifier** (`mcp__codex__codex`, three fresh full sessions across the two implementation rounds):
`npm run test:run-bundle` — 13/13 then 17/17 after the fix round; `npm test` — 170/170 throughout;
`npm run test:context-pack` — 115/115, `scripts/dev/project-context-pack.mjs` confirmed unchanged;
`npm run test:publication-builder` — 42/42, `scripts/dev/publication-builder.mjs` confirmed
unchanged; `npm run check:project-consistency` — 7/7; `npm run test:project-consistency` — 19/19;
`git diff --check` clean throughout. Real end-to-end CLI smoke tests against this actual repository
(not just the unit harness) confirmed: a fresh write, an append attempting a different `--run-id`
correctly refused `RUN_IDENTITY_IMMUTABLE`, a same-identity append + finalize succeeding, the report
renderer producing correct Markdown containing the fixed authority-boundary sentence, and a
post-finalization write correctly refused `RUN_ALREADY_FINALIZED` — all outside the test harness,
against `/private/tmp` (macOS's `/tmp` is itself a symlink; the writer correctly refused it, an
incidental live confirmation of the symlink guard).

**Changed files**: `docs/development/RUN_BUNDLE.md`, `schemas/dev/task-record.schema.json`,
`schemas/dev/evidence-manifest.schema.json`, `schemas/dev/run-manifest.schema.json`,
`scripts/dev/run-bundle.mjs`, `scripts/dev/run-bundle-report.mjs`, `tests/dev/run-bundle.test.mjs`,
`package.json` (3 new script entries only) — this task's scope; `.project/CURRENT_TASK.md`,
`.project/REVIEW_STATE.md`, `.project/CONTEXT_INDEX.md` (new Run Bundle v1 topic mapping, warranted
per this task's own conditional instruction) — Claude's own state-tracking, per policy.
`docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`, `CLAUDE.md`,
`scripts/dev/project-context-pack.mjs`, `scripts/dev/canonical-json.mjs`,
`scripts/dev/publication-builder.mjs`, every existing schema/test, `ROADMAP.md`,
`.project/PROJECT_STATE.md`, `.project/DECISIONS_LOG.md`, and `tools/publication-broker/**` not
touched — no contradiction with `AGENT_POLICY.md`/`REVIEW_PROTOCOL.md` arose, so neither was edited.

**Local commit prepared via the Local Publication Builder** (`scripts/dev/publication-builder.mjs`)
under a human-authorized `PublicationEnvelope` — see git log for the resulting SHA. Not pushed, no
PR touched, not merged, no V1B follow-on task started.

## Required Context

- `docs/development/PROJECT_CONTINUITY.md`
- `docs/development/RUN_BUNDLE.md`
- `scripts/dev/canonical-json.mjs`
- `scripts/dev/project-context-pack.mjs`
- `scripts/dev/publication-builder.mjs`
