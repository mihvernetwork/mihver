# Context Index

Semantic map: topic → authoritative file(s). Read only what the current task needs — this index
exists to prevent broad repository scans on session start. If a topic you need isn't listed here,
that's a gap in the index, not license to guess; search deliberately, and consider adding an entry.

| Topic | Authoritative file(s) |
|---|---|
| Session bootstrap entrypoint | `CLAUDE.md` ("Fast Session Bootstrap") |
| Live git / task / review snapshot | `npm run context` (`scripts/dev/project-context.mjs`) |
| Milestone/checkpoint state | `.project/PROJECT_STATE.md` |
| Active task | `.project/CURRENT_TASK.md` |
| Review/approval state | `.project/REVIEW_STATE.md` |
| Durable process/project decisions | `.project/DECISIONS_LOG.md` |
| Product vision | `docs/foundation/VISION.md` |
| Non-negotiable principles | `docs/foundation/PRINCIPLES.md` |
| M0 milestone scope | `docs/foundation/M0_SCOPE.md` |
| Architecture compiler model decision (Accepted) | `docs/adr/ADR-0001-ARCHITECTURE-COMPILER-MODEL.md` |
| Epistemic/provenance model decision (Accepted) | `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md` |
| `UserIdea` semantic contract | `docs/contracts/USER_IDEA.md` |
| `IntentSpec` semantic contract | `docs/contracts/INTENT_SPEC.md` |
| Intent semantic test corpus | `docs/examples/INTENT_CASES.md` |
| Requirement Derivation model decision (Proposed) | `docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md` |
| `RequirementSpec` semantic contract | `docs/contracts/REQUIREMENT_SPEC.md` |
| Requirement semantic test corpus | `docs/examples/REQUIREMENT_CASES.md` |
| Memory Context Authority Boundary decision (Accepted) | `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md` |
| `MemoryContext` semantic contract | `docs/contracts/MEMORY_CONTEXT.md` |
| MemoryContext semantic test corpus | `docs/examples/MEMORY_CONTEXT_CASES.md` |
| Schema ↔ contract invariant coverage | `docs/contracts/SCHEMA_MAPPING.md` |
| Machine-readable schemas | `schemas/m0/user-idea.schema.json`, `schemas/m0/intent-spec.schema.json` |
| Deterministic contract validator + fixtures | `tests/contracts/validate-contracts.mjs`, `tests/contracts/fixtures/**` |
| Claude/Codex execution model, Git & branch workflow | `docs/development/AGENT_POLICY.md` |
| Task completion checklist, review outcome vocabulary | `docs/development/REVIEW_PROTOCOL.md` |
| Human → Claude task prompt shape | `docs/development/TASK_TEMPLATE.md` |
| Night Runner (deterministic task orchestration) | `docs/development/NIGHT_RUNNER.md` |
| System-wide roadmap (navigational / non-authoritative — see its own source-of-truth priority order) | `ROADMAP.md` |

## Not covered here

Remote-only facts — open PRs, CI status, PR review comments, actual GitHub merge state — are not
repository content and are intentionally not indexed here. See `CLAUDE.md`'s "Fast Session
Bootstrap" for when GitHub should be consulted instead of this index.
