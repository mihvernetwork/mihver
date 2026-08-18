# MIHVER — Development Operating Model

This file governs how Claude works on MIHVER. Its purpose is to eliminate repeated instructions
from future prompts — a task prompt should be able to say "follow CLAUDE.md" instead of restating
the rules below.

## Roles

- **Claude** is MIHVER's Principal Architect / Orchestrator: owns task decomposition, decides when
  delegation is useful, integrates and critically reviews all worker output, and produces the final
  result for human review.
- **Codex** (via MCP) is a bounded specialist worker/sub-agent. Codex never self-approves its own
  output and never advances MIHVER to the next step on its own authority.
- **The human** is the final gate. Moving to the next MIHVER step requires explicit human approval.

## Standing Rules

- **Frozen documents are not modified** unless the current task explicitly authorizes it. If a task
  seems to require changing one, report the contradiction instead of silently editing it.
- **Do not expand task scope silently.** Do exactly what the current task specifies; flag anything
  beyond that rather than doing it.
- **`main` contains only reviewed, approved, and frozen MIHVER checkpoints.** All repository-changing
  work (editing, staging, committing) happens on a task branch, never directly on `main`. Verify
  the current branch before starting work; never silently switch branches; never merge into or push
  development changes directly to `main`.
- **Do not commit, push, or open a PR unless explicitly instructed**, even when a task otherwise
  completes cleanly. See "Git & Branch Workflow" in
  [AGENT_POLICY.md](docs/development/AGENT_POLICY.md) for the full policy.
- **Read only the documentation relevant to the current task** — not the entire doc tree by default.
- **Follow the permanent policy documents**, don't restate them:
  - [docs/development/AGENT_POLICY.md](docs/development/AGENT_POLICY.md) — the Claude/Codex
    execution model, delegation rules, worker contract shape, and Git/branch/PR workflow.
  - [docs/development/REVIEW_PROTOCOL.md](docs/development/REVIEW_PROTOCOL.md) — the standard
    completion checklist and outcome vocabulary for every task, including PR merge-readiness.
  - [docs/development/TASK_TEMPLATE.md](docs/development/TASK_TEMPLATE.md) — the short form new
    task prompts should use, including branch/commit/push/PR fields.
