# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

NIGHT-RUNNER-FRESH-CLAUDE-EXECUTOR

## Objective

Add the first execution-capable Night Runner layer: launch exactly one fresh Claude Code process
for one explicitly authorized test task, as a separate adapter/layer on top of the existing
deterministic planner (`scripts/dev/night-runner.mjs`, left untouched). No queue loop, no git
worktree automation, no writes to the MIHVER working tree through the child process, no
`main`-branch execution.

## Branch / Base

Branch: `feat/night-runner-fresh-claude-executor`
Base: `main` (`9a61a0bfc03ff17607493539f5003eac0b88c969`)

## Status

**Redesign complete — APPROVED, not yet committed/pushed/PR'd.** V1 (implemented by Codex Worker
A) received an independent Codex review verdict of **REDESIGN**: its central safety claim — that
a caller-supplied `cwd` outside the repo structurally prevents the child Claude process from
writing into the MIHVER working tree — did not hold (`cwd` is not a filesystem sandbox; a
parent-directory or symlink/junction workspace was wrongly accepted as "outside"; STOP was
checked only pre-spawn; timeout killed only the direct child; CLI discovery/execution flags were
inconsistent). Claude accepted REDESIGN rather than patching forward (see `REVIEW_STATE.md`).

A human-authorized six-point redesign was then implemented (by Codex, in three passes, each
reviewed by Claude directly against the diff before proceeding — see "Validation" below) and
independently re-reviewed twice more:
1. Redesign implementation: executor-owned `mkdtemp` workspace (caller-supplied workspace no
   longer trusted or accepted), bidirectional `realpath`-based containment check, discovered-flag
   capability restriction, STOP polling during execution with whole-process-tree termination and a
   bounded kill-grace timeout, documented fresh-process semantics, expanded tests.
2. A real bug Claude found by running the executor against the actual installed `claude` CLI
   (not the test stub): `spawn('claude', ..., {shell:false})` failed with `ENOENT` because Windows
   npm installs `claude` as a non-directly-spawnable `.cmd`/`.ps1` shim. Fixed via `where`/`which`
   resolution of the real `claude.exe` (passing only the fixed command name, never task content);
   `shell:true` was deliberately never used, since Node's `DEP0190` means it does not escape array
   arguments and `descriptor.prompt` is untrusted text — a real injection risk.
3. A second independent Codex review (APPROVE WITH REQUIRED CHANGES) found the capability
   validation used a bypassable denylist (`toolAllowlist: 'default'` silently passed through,
   re-enabling Bash) and that the `where`/`which` resolver call had no timeout. Fixed: switched to
   a positive allowlist (`Read`/`Write`/`Edit` tools, `acceptEdits` permission mode only — anything
   else refused pre-spawn with `INVALID_OPTIONS`) and added the missing timeout. That review's
   separate claim that Windows resolution "does not work" was investigated by Claude and
   attributed to the reviewer's own sandbox PATH, not a defect — independently reproduced working
   correctly in the real target environment (see "Validation").

A third independent Codex review returned final verdict **APPROVED**, with no required changes
remaining, and independently concurred that the Windows-resolution disagreement was
environment-specific to the reviewing sandbox.

Commit/push/PR are now authorized to proceed per the human task's original instruction
(`Commit/push allowed: yes; PR expected: yes; do not merge`), conditioned on this APPROVED outcome
— now met.

## Allowed Scope

Add:
- `scripts/dev/night-runner-executor.mjs` (new; Codex bounded implementation)
- `tests/night-runner-executor/**` (new; Codex bounded implementation)
- `package.json` (additive npm scripts only)

Update:
- `docs/development/NIGHT_RUNNER.md` (new section documenting the executor adapter; existing
  content otherwise unchanged)
- `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`

Forbidden: `scripts/dev/night-runner.mjs`, `tests/night-runner/**`, `docs/foundation/**`,
`docs/adr/**`, `docs/contracts/**`, `docs/examples/**`, `schemas/**`, `tests/contracts/**`,
`docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`,
`docs/development/TASK_TEMPLATE.md`, `CLAUDE.md`, `.project/PROJECT_STATE.md`,
`.project/DECISIONS_LOG.md`, `scripts/dev/project-context.mjs`.

## Required Context

- `CLAUDE.md`
- `docs/development/AGENT_POLICY.md` (Git & Branch Workflow, Task Contract, Parallel Worker Rules)
- `docs/development/REVIEW_PROTOCOL.md`
- `docs/development/NIGHT_RUNNER.md` (existing design: authorization model, `.project/STOP`
  semantics, "main is never a task branch", Future Work)
- `scripts/dev/night-runner.mjs` (planner conventions: pure functions, ESM, node built-ins only,
  `isMainModule` CLI guard)
- `tests/night-runner/validate-night-runner.mjs` (test conventions)

## Validation

- V1: `npm run test:night-runner-executor` (13/13) re-confirmed by Claude, but the tests did not
  exercise the safety-critical gaps the first independent review found. Superseded by the redesign.
- Redesign (final state): `npm run test:night-runner-executor` — Claude independently re-ran this
  after every implementation pass, not just trusted Codex's self-report: 17/17 after the first
  redesign pass, 21/21 after the Windows CLI-resolution fix, **22/22 after the final review-fix
  pass** (positive allowlist + resolver timeout).
- `npm run test:night-runner`: 15/15, re-confirmed unaffected after every pass.
- `npm test`: 24/24, re-confirmed unaffected after every pass.
- `scripts/dev/night-runner.mjs` and `tests/night-runner/**` confirmed byte-for-byte unchanged via
  `git diff --stat` after every pass; `package.json` changes confirmed purely additive (two new
  npm scripts) via `git diff`.
- **Live supervised adversarial isolation smoke test**, run directly by Claude against the real
  installed `claude` CLI (not a stub), per the human task's explicit requirement: a task descriptor
  asked the child Claude process to write an allowed file inside its own executor-created
  workspace, and attempt to write a forbidden file at an absolute path outside the workspace (a
  disposable temp sibling directory — never the real MIHVER repo). Result: the allowed write
  succeeded; the real `claude` CLI's own JSON output recorded a `permission_denials` entry for the
  forbidden `Write` attempt, and the forbidden file was confirmed absent afterward. Run twice
  (before and after the Windows CLI-resolution fix); the first run failed closed at CLI discovery
  (the real Windows ENOENT bug, not a security failure) and the second succeeded end-to-end with
  isolation holding.
- Independent read-only Codex review of V1: verdict **REDESIGN** (see `REVIEW_STATE.md` History).
- Independent read-only Codex review of the redesign (first pass): verdict **APPROVE WITH REQUIRED
  CHANGES** (bypassable capability denylist; unbounded resolver lookup) — both fixed.
- Independent read-only Codex review of the redesign (final pass): verdict **APPROVED**, no
  required changes remaining (see `REVIEW_STATE.md`).

## Next Gate

The redesign reached an **APPROVED** independent review outcome. Commit/push/PR are authorized per
the human task (`Commit/push allowed: yes; PR expected: yes; do not merge`). Claude opens a PR;
does not merge; human review/merge approval remains a separate, later gate.
