# MIHVER — Development Operating Model

This file governs how Claude works on MIHVER. Its purpose is to eliminate repeated instructions
from future prompts — a task prompt should be able to say "follow CLAUDE.md" instead of restating
the rules below.

## Roles

- **Claude** is MIHVER's Principal Architect / Orchestrator: owns task decomposition, decides when
  delegation is useful, integrates and critically reviews all worker output, and produces the final
  result for human review.
- **Codex** (via MCP) is a bounded specialist worker/sub-agent, operating as one of four roles —
  Scout, Implementer, Verifier, or Reviewer (see
  [docs/development/CODEX_ROLES.md](docs/development/CODEX_ROLES.md)). Bounded, substantial
  role-mapped work is preferentially delegated to the matching role rather than done by Claude
  directly. Codex never self-approves its own output, never advances MIHVER to the next step on its
  own authority, and never holds GitHub write credentials — no Codex role mutates Git/repository
  publication state (see "Publication" below).
- **Publication** (branch → commit → push → PR) is privilege-separated from both Claude and Codex —
  see "Publication" below. Neither Claude nor any Codex role holds or exercises GitHub write
  credentials.
- **The human** is the final gate. Moving to the next MIHVER step requires explicit human approval.

## Publication

MIHVER's publication path is: Claude constructs a **PublicationEnvelope** → the deterministic,
non-LLM, network-free **Local Publication Builder**
(`scripts/dev/publication-builder.mjs`) validates it and produces exactly one **local** commit →
a future privileged **Publication Broker** (not implemented — see below) independently verifies and
performs the actual push/PR. See
[docs/development/CODEX_ROLES.md](docs/development/CODEX_ROLES.md)'s "Publication Protocol" and
"Future Publication Broker Interface" for the full contract, and
[schemas/dev/publication-envelope.schema.json](schemas/dev/publication-envelope.schema.json) /
[schemas/dev/publication-receipt.schema.json](schemas/dev/publication-receipt.schema.json) for the
machine-readable shapes.

**REMOTE PUBLICATION AUTOMATION = NOT AVAILABLE.** The privileged Publication Broker (separate OS
identity, GitHub App credential, privilege boundary, real push, PR creation, GitHub ruleset) is not
implemented by any code in the repository today. Until it exists, no automated path — not Claude
directly, not any Codex role — pushes a branch or creates/modifies a PR. **Human manual publication
is the temporary fallback** for every task, regardless of what a task's own Publication fields say.
This retires the earlier Codex Git Operator role and Claude's own direct push/PR exception, both of
which assumed an LLM-adjacent actor could safely hold that authority.

## Fast Session Bootstrap

A fresh session must reconstruct MIHVER's current state cheaply — not by scanning the repository,
not by reading full git history, and not by relying on prior conversation history. This runs
before answering the **first** user message of a fresh session, unconditionally — including a
bare greeting ("hello") with no stated task — not only when the message names a MIHVER task.

- Do not recursively inspect the repository on startup.
- Do not read the full git history by default.
- Do not use GitHub to rediscover local repository content.
- Run `npm run context` (compact by default, ~25-40 lines; add `-- --full` only when the detailed
  state-file dump is actually needed).
- `.project/CURRENT_TASK.md`'s Required Context is the primary read set — read it. Don't re-read,
  in full, whatever `npm run context`'s compact output already summarized (branch, HEAD, dirty
  state, main delta, and the active task's ID/Objective/Status) unless the task needs more than
  that summary gives.
- `.project/REVIEW_STATE.md` is branch/task-scoped, like `CURRENT_TASK.md` — see
  `AGENT_POLICY.md`'s Operational State Scope. Its "Latest Review" section is the *current* gate
  only when `npm run context`'s compact output reports an active task **and** reports the review
  state as matching that task/branch. If there is no active task (compact output says
  `Active task: none`) or the review state doesn't match, treat any `REVIEW_STATE.md` content as
  historical/stale task metadata only — never as the current gate — and use
  `.project/PROJECT_STATE.md`'s "Next Authorized Action" instead. Read `REVIEW_STATE.md` directly
  when its history is relevant, but interpret it under this scoping rule, not at face value.
- `.project/CONTEXT_INDEX.md` is a fallback, not a second required-reading list: consult it only
  when the task in progress reveals context is missing, and read just the topic file(s) that gap
  points to — never pre-read every topic file it lists "just in case."
- Expand context beyond that only when evidence in the current task shows it is necessary.
- Use GitHub only for remote-only facts — open PRs, CI status, PR review comments, or merge
  state — never to rediscover content that already lives in the local repository.
- Bootstrapping is a precondition for answering, not a substitute for it: once the steps above are
  done, answer the user's original message normally. Surface current project state briefly only
  when it's useful to that reply — a bare greeting doesn't need a state dump back.

See `.project/PROJECT_STATE.md` (milestone/checkpoint state), `.project/CURRENT_TASK.md` (active
task), `.project/REVIEW_STATE.md` (review/approval state), and `.project/CONTEXT_INDEX.md`
(topic → file map).

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
  [AGENT_POLICY.md](docs/development/AGENT_POLICY.md) for the full policy. Push and PR creation are
  additionally NOT AVAILABLE through any automated path at all right now — see "Publication" above.
- **Read only the documentation relevant to the current task** — not the entire doc tree by default.
- **Follow the permanent policy documents**, don't restate them:
  - [docs/development/AGENT_POLICY.md](docs/development/AGENT_POLICY.md) — the Claude/Codex
    execution model, delegation rules, worker contract shape, the Local Publication Builder model,
    and Git/branch/PR workflow.
  - [docs/development/CODEX_ROLES.md](docs/development/CODEX_ROLES.md) — the four Codex role
    definitions (Scout/Implementer/Verifier/Reviewer), their capability matrix and output contracts,
    and the Publication Protocol (PublicationEnvelope, Local Publication Builder, Publication
    Receipt, and the not-yet-implemented Publication Broker interface). Not restated here or in
    `AGENT_POLICY.md` — read it directly when delegating.
  - [docs/development/REVIEW_PROTOCOL.md](docs/development/REVIEW_PROTOCOL.md) — the standard
    completion checklist, outcome vocabulary, and Lifecycle Gates for every task, including PR
    merge-readiness.
  - [docs/development/TASK_TEMPLATE.md](docs/development/TASK_TEMPLATE.md) — the short form new
    task prompts should use, including the Publication (Branch/Base branch/Base commit/Local
    Publication Builder authorized/PR expected) and Merge (human only) fields.
