# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

DEVELOPMENT-ORCHESTRATION-V3.1-A-PUBLICATION-BOUNDARY

## Objective

Implement the first repository-side foundation of MIHVER's privilege-separated publication
architecture: neither Claude nor any Codex role holds GitHub write credentials. Target pipeline:
Claude constructs a `PublicationEnvelope` → the deterministic, non-LLM, network-free **Local
Publication Builder** (`scripts/dev/publication-builder.mjs`) produces exactly one local commit →
a future privileged **Publication Broker** (explicitly NOT implemented — V3.1-B) independently
verifies and performs the actual push/PR. Retires the V3 Codex Git Operator role — real V3 dogfood
proved Codex sandboxes have no network access and could never safely or functionally own GitHub
publication — leaving four Codex roles: Scout, Implementer, Verifier, Reviewer.

## Branch / Base

Branch: `chore/publication-boundary-v3-1a`.
Base: `main` at `dbc051690f733a841cc9e0d898597505ebb533a1`.

## Status

**Complete, pending human review.**

**Publication:**
- Human manual fallback is in use.
- Task branch changes through the prior closure round are committed and pushed; this pass's own
  PR #32 remediation fix (below) is currently uncommitted working-tree changes, pending the same
  manual step.
- PR expected: yes; PR #32 is the human-review-tracked PR for this task.
- PR identity/state: verify from GitHub.
- Human review is the current gate.
- Human-only merge unchanged.

**Files changed** (this branch, across the original task and its final preflight-isolation
closure — see History in `.project/REVIEW_STATE.md` for the two commits):
- Primary: `scripts/dev/publication-builder.mjs`, `tests/dev/publication-builder.test.mjs`,
  `schemas/dev/publication-envelope.schema.json`, `schemas/dev/publication-receipt.schema.json`,
  `docs/development/AGENT_POLICY.md`, `docs/development/CODEX_ROLES.md`,
  `docs/development/TASK_TEMPLATE.md`, `docs/development/REVIEW_PROTOCOL.md`, `CLAUDE.md`,
  `package.json` (two new npm scripts).
- Conditional Consistency (synchronization-only): `.project/CONTEXT_INDEX.md` (topic rows for the
  retired Git Operator role and the new Publication Protocol / Local Publication Builder / schemas),
  this file and `.project/REVIEW_STATE.md` (this task's own record).

**Final preflight-isolation closure** (previously committed/pushed): the exported `preflight()` entry
point was isolated the same way `buildLocalCommit()` already isolates its whole run — it now always
runs under a fresh, empty, process-owned `core.hooksPath` plus `core.fsmonitor=`, established
internally rather than trusted from any caller-supplied `hooksDir`. The read-only guard logic itself
was extracted into an internal `preflightCore()`, which `buildLocalCommit()` calls directly under its
own existing isolation boundary (one boundary per run, not two).

**PR #32 human-review remediation round (this pass, currently uncommitted)**: fixed three findings
confirmed on open PR #32 (`APPROVE_WITH_REQUIRED_CHANGES`). (1) BLOCKER — the Envelope fingerprint
was only ever checked against fresh raw-worktree bytes, never against the actual staged/index bytes
about to be committed, leaving a window where a file mutated after preflight's fingerprint check but
before/during staging could pass `verifyStagedBlobIdentity` (mutated raw bytes == mutated staged
bytes) while no longer matching what the Envelope authorized; fixed by adding
`computeStagedFingerprint`/`verifyStagedFingerprint`, recomputing the same canonical recipe from the
actual staged index blobs after staging and requiring it to still equal
`envelope.publication_fingerprint` (`STAGED_FINGERPRINT_MISMATCH` on mismatch), plus a new immediate
pre-commit re-check that `HEAD` still equals `expected_pre_publish_head`
(`PRE_COMMIT_HEAD_CHANGED` on mismatch). (2) BLOCKER — `restoreIndexToTree` discarded its
`git read-tree` result, so a BLOCKED receipt could claim safe cleanup even if restoration itself
silently failed; fixed so `restoreIndexToTree` independently re-derives the post-restore index tree
(`git write-tree`) and requires it to exactly equal the pre-staging snapshot, with every post-staging
failure path routed through a new `failAfterStaging` that reports the distinct `INDEX_RESTORE_FAILED`
(preserving the original triggering reason as diagnostic data) whenever restoration cannot be
verified. (3) MAJOR — `byteSort` used JavaScript's default UTF-16 code-unit string comparison, not
the documented UTF-8 canonical byte order (they disagree for any path above U+FFFF); fixed to
`Buffer.compare` over each path's UTF-8 encoding. Five new adversarial/regression tests added:
mutation-race → `STAGED_FINGERPRINT_MISMATCH`; `PRE_COMMIT_HEAD_CHANGED`; `read-tree` throwing →
`INDEX_RESTORE_FAILED`; `read-tree` lying about success (no actual restore) →
`INDEX_RESTORE_FAILED`; UTF-8-vs-UTF-16 byte-order regression (U+E000 vs U+10000).
`docs/development/CODEX_ROLES.md`'s Publication Protocol steps and "Publication Fingerprint" section
updated to describe the two-stage fingerprint (early worktree check, final staged-index seal), the
pre-commit HEAD re-check, and verified (not merely attempted) index restoration.

**Final integrity hardening** (cumulative, as of this pass): fresh empty `core.hooksPath` for the
entire builder run (including a direct `preflight()` call); `core.fsmonitor` disabled for every git
invocation; `--no-gpg-sign` on the commit; `git check-attr` fail-closed on
filter/text/eol/working-tree-encoding/ident for every present file; `git hash-object --no-filters`
for all content digests; `core.autocrlf=false` during staging; raw-worktree blob SHA required to
exactly equal the staged index blob SHA; a final staged-index fingerprint seal requiring the actual
committed bytes to equal `envelope.publication_fingerprint`; an immediate pre-commit HEAD re-check;
exact, independently-verified pre-builder index snapshot/restore on any post-staging failure, with a
distinct `INDEX_RESTORE_FAILED` state when restoration cannot be proven; exported `preflight()`
isolated from the same hook/fsmonitor surface as `buildLocalCommit()`; true UTF-8 canonical byte-order
sort. No residual clean/smudge-filter risk is treated as accepted — the fail-closed `check-attr` guard
blocks any explicit `filter=` attribute before any filter command could run.

**Validation run and passing** (by Claude directly): `npm run test:publication-builder`
(42/42 — the dedicated publication-builder suite, including every adversarial case above plus this
round's five new tests), `npm test` (170/170 contract fixtures), `npm run test:project-consistency`
(19/19 test groups), `npm run check:project-consistency` (7/7 checks), `git diff --check` (clean).

**Independent review**: two fresh Codex Reviewers from the original round (Reviewer A: protocol/
local-builder correctness; Reviewer B: authority separation/credential leakage/bypass paths/policy
consistency) plus a Codex Verifier re-running the validation suite (blocked by its own sandbox's
temp-dir write restriction on two of six commands; the six it could evaluate, plus its source-level
grep for `push`/`gh` invocations, corroborate the "never pushes" claim); and, for this PR #32
remediation round, one fresh read-only Codex Reviewer scoped to exactly the six items above
(fingerprint→staged-index binding, mutation-race closure, pre-commit HEAD re-check, verified index
restoration, restoration-failure reporting, UTF-8 canonical byte order). That Reviewer found the
first five implementation points correct and the UTF-8 sort correct with adequate regression
coverage, but flagged two real test-coverage gaps: no direct test for `PRE_COMMIT_HEAD_CHANGED`, and
the restoration-failure test only covered `read-tree` throwing, not `read-tree` reporting success
without actually restoring (the exact case the `write-tree` re-verification exists to catch). Claude
adjudicated both as genuine and added the two missing tests (see above) rather than dismissing them.
Claude adjudicates every finding — see `.project/REVIEW_STATE.md`.

**Remaining V3.1-B work** (explicitly out of scope for this task, per its own instructions): a
separate OS identity for the Publication Broker, a GitHub App credential, a Unix-socket/MCP
privilege boundary, the real `git push`, PR creation, and a GitHub ruleset enforcing this boundary
server-side.
