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

**Complete, pending human review.** Per this task's own explicit instruction: Claude did NOT commit,
push, or open a PR. Human manual publication is the required next step.

**Files changed** (working tree only, uncommitted):
- Primary: `scripts/dev/publication-builder.mjs` (new), `tests/dev/publication-builder.test.mjs`
  (new), `schemas/dev/publication-envelope.schema.json` (new),
  `schemas/dev/publication-receipt.schema.json` (new), `docs/development/AGENT_POLICY.md`,
  `docs/development/CODEX_ROLES.md`, `docs/development/TASK_TEMPLATE.md`,
  `docs/development/REVIEW_PROTOCOL.md`, `CLAUDE.md`, `package.json` (two new npm scripts).
- Conditional Consistency (synchronization-only): `.project/CONTEXT_INDEX.md` (topic rows for the
  retired Git Operator role and the new Publication Protocol / Local Publication Builder / schemas),
  this file and `.project/REVIEW_STATE.md` (this task's own record).

**Validation run and passing** (by Claude directly — Codex's own sandbox could not write to the OS
temp directory the test suite needs, which is itself confirmatory evidence for this task's core
premise that Codex sandboxes cannot be trusted with publication-adjacent filesystem/network
authority): `npm test` (170 fixtures), `npm run test:project-consistency` (19 test groups),
`npm run check:project-consistency` (7/7 checks), `npm run test:publication-builder` (27 tests,
including adversarial cases: wrong repo, main/master branch, wrong pre-publish HEAD, non-ancestor
base, duplicate/traversal/absolute/symlink/directory/submodule-mode paths, fingerprint mismatch,
staged-name mismatch via a hostile execFileSyncImpl, a pre-commit hook attempting to smuggle an
extra file into the commit, dirty unrelated file, malformed envelope, rename pair), `git diff
--check` (clean).

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
