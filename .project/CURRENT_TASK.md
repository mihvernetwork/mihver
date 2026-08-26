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
- Task branch has been manually committed/pushed (HEAD `2cac1ef`); this pass's own two-file fix
  (below) is currently uncommitted working-tree changes, pending the same manual step.
- PR expected: yes.
- PR identity/state: verify from GitHub.
- Human review remains the current gate.
- Human-only merge, unchanged.

**Files changed** (this branch, across the original task and this final pre-PR consistency +
preflight isolation fix):
- Primary: `scripts/dev/publication-builder.mjs`, `tests/dev/publication-builder.test.mjs`,
  `schemas/dev/publication-envelope.schema.json`, `schemas/dev/publication-receipt.schema.json`,
  `docs/development/AGENT_POLICY.md`, `docs/development/CODEX_ROLES.md`,
  `docs/development/TASK_TEMPLATE.md`, `docs/development/REVIEW_PROTOCOL.md`, `CLAUDE.md`,
  `package.json` (two new npm scripts).
- Conditional Consistency (synchronization-only): `.project/CONTEXT_INDEX.md` (topic rows for the
  retired Git Operator role and the new Publication Protocol / Local Publication Builder / schemas),
  this file and `.project/REVIEW_STATE.md` (this task's own record).

**Final pre-PR fix (this pass)**: the exported `preflight()` entry point was isolated the same way
`buildLocalCommit()` already isolates its whole run — it now always runs under a fresh, empty,
process-owned `core.hooksPath` plus `core.fsmonitor=`, established internally rather than trusted
from any caller-supplied `hooksDir`. The read-only guard logic itself was extracted into an internal
`preflightCore()`, which `buildLocalCommit()` calls directly under its own existing isolation
boundary (one boundary per run, not two). A new adversarial test invokes exported `preflight()`
directly (not via `buildLocalCommit()`) against a repo with a malicious `core.fsmonitor` configured
and asserts the sentinel file is never created.

**Final integrity hardening** (cumulative, as of this pass): fresh empty `core.hooksPath` for the
entire builder run (now including a direct `preflight()` call); `core.fsmonitor` disabled for every
git invocation; `--no-gpg-sign` on the commit; `git check-attr` fail-closed on
filter/text/eol/working-tree-encoding/ident for every present file; `git hash-object --no-filters`
for all content digests; `core.autocrlf=false` during staging; raw-worktree blob SHA required to
exactly equal the staged index blob SHA; exact pre-builder index snapshot/restore on any
post-staging failure; exported `preflight()` isolated from the same hook/fsmonitor surface as
`buildLocalCommit()`. No residual clean/smudge-filter risk is treated as accepted — the fail-closed
`check-attr` guard blocks any explicit `filter=` attribute before any filter command could run.

**Validation run and passing** (by Claude directly): `npm run test:publication-builder`
(37/37 — the dedicated publication-builder suite, including every adversarial case above plus the
new direct-`preflight()` fsmonitor-isolation test), `npm test` (170/170 contract fixtures),
`npm run test:project-consistency` (19/19 test groups), `npm run check:project-consistency`
(7/7 checks), `git diff --check` (clean).

**Independent review**: two fresh Codex Reviewers (Reviewer A: protocol/local-builder correctness;
Reviewer B: authority separation/credential leakage/bypass paths/policy consistency) plus a Codex
Verifier re-running the validation suite (blocked by its own sandbox's temp-dir write restriction on
two of six commands — see above; the six it could evaluate, plus its source-level grep for `push`/
`gh` invocations, corroborate the "never pushes" claim). Claude adjudicated every finding — see
`.project/REVIEW_STATE.md`.

**Remaining V3.1-B work** (explicitly out of scope for this task, per its own instructions): a
separate OS identity for the Publication Broker, a GitHub App credential, a Unix-socket/MCP
privilege boundary, the real `git push`, PR creation, and a GitHub ruleset enforcing this boundary
server-side.
