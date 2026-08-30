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
| `RequirementSpec` machine-readable schema | `schemas/m0/requirement-spec.schema.json` |
| `RequirementSpec` schema ↔ semantic invariant mapping | `docs/contracts/REQUIREMENT_SPEC_SCHEMA_MAPPING.md` |
| Memory Context Authority Boundary decision (Accepted) | `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md` |
| `MemoryContext` semantic contract | `docs/contracts/MEMORY_CONTEXT.md` |
| MemoryContext semantic test corpus | `docs/examples/MEMORY_CONTEXT_CASES.md` |
| MemoryContext machine-readable schema | `schemas/m0/memory-context.schema.json` |
| MemoryContext schema ↔ semantic invariant mapping | `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md` |
| Schema ↔ contract invariant coverage | `docs/contracts/SCHEMA_MAPPING.md` |
| Machine-readable schemas | `schemas/m0/user-idea.schema.json`, `schemas/m0/intent-spec.schema.json`, `schemas/m0/requirement-spec.schema.json` |
| Deterministic contract validator + fixtures | `tests/contracts/validate-contracts.mjs`, `tests/contracts/fixtures/**` |
| Claude/Codex execution model, Git & branch workflow, privilege-separated publication | `docs/development/AGENT_POLICY.md` |
| Document Owner/Mirror/Historical model, Task File Scope (Primary/Conditional/Forbidden) | `docs/development/AGENT_POLICY.md` ("Document Authority Model", "Task File Scope Model") |
| Codex role definitions (Scout/Implementer/Verifier/Reviewer), capability matrix, output contracts, Publication Protocol (PublicationEnvelope, Local Publication Builder, Publication Receipt) | `docs/development/CODEX_ROLES.md` |
| Deterministic Local Publication Builder (local commit only; never pushes) + adversarial tests | `scripts/dev/publication-builder.mjs`, `tests/dev/publication-builder.test.mjs` |
| Publication Envelope / Receipt machine-readable schemas + Go-validator parity test | `schemas/dev/publication-envelope.schema.json`, `schemas/dev/publication-receipt.schema.json`, `tests/dev/publication-remote-name-parity.test.mjs` |
| Privileged Publication Broker: architecture, protocol, deployment design (source implemented V3.1-B; NOT provisioned/activated) | `docs/development/PUBLICATION_BROKER.md`, `tools/publication-broker/**` |
| Publication Broker wire/state machine-readable schemas | `schemas/dev/publication-broker-request.schema.json`, `schemas/dev/publication-grant.schema.json`, `schemas/dev/publication-broker-result.schema.json`, `schemas/dev/publication-package-manifest.schema.json` |
| Task completion checklist, review outcome vocabulary, Final Consistency Sweep, Lifecycle Gates | `docs/development/REVIEW_PROTOCOL.md` |
| Human → Claude task prompt shape, Publication/Merge model | `docs/development/TASK_TEMPLATE.md` |
| Deterministic development-consistency checks | `scripts/dev/project-consistency.mjs` (`npm run check:project-consistency`) |
| ProjectContextPack v1 (derived, machine-readable session-bootstrap snapshot; contract, hash rules, authority precedence) | `docs/development/PROJECT_CONTINUITY.md` |
| ProjectContextPack v1 compiler + canonical JSON serializer + schema + tests | `scripts/dev/project-context-pack.mjs` (`npm run context:pack`), `scripts/dev/canonical-json.mjs`, `schemas/dev/project-context-pack.schema.json`, `tests/dev/project-context-pack.test.mjs` (`npm run test:context-pack`) |
| Night Runner (deterministic task orchestration) | `docs/development/NIGHT_RUNNER.md` |
| Run Bundle v1 (deterministic, typed, auditable run record built on ProjectContextPack v1; TaskRecord, EvidenceManifest, RunManifest, hash/append-only/finalization rules, authority boundary) | `docs/development/RUN_BUNDLE.md` |
| Run Bundle v1 writer/compiler + report renderer + schemas + tests | `scripts/dev/run-bundle.mjs` (`npm run run-bundle`), `scripts/dev/run-bundle-report.mjs` (`npm run run-bundle-report`), `schemas/dev/task-record.schema.json`, `schemas/dev/evidence-manifest.schema.json`, `schemas/dev/run-manifest.schema.json`, `tests/dev/run-bundle.test.mjs` (`npm run test:run-bundle`) |
| System-wide roadmap (navigational / non-authoritative — see its own source-of-truth priority order) | `ROADMAP.md` |
| Decision Council V1A protocol: topology, state machine, commitment/reveal, candidate hashing, vote binding, R0–R4 quorum, authority boundary (Proposed) | `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md` |
| Decision Council V1A kernel + fake-agent simulator + schema + tests | `scripts/dev/decision-council-kernel.mjs`, `scripts/dev/decision-council-simulator.mjs`, `schemas/dev/decision-council.schema.json`, `tests/dev/decision-council-kernel.test.mjs` (`npm run test:decision-council-kernel`), `tests/dev/decision-council-simulator.test.mjs` (`npm run test:decision-council-simulator`) |
| Decision Authorization Boundary V1A design: `AuthorizationEnvelope`/`AuthorizationGrant`, policy-evaluation algorithm, replay/staleness/STOP-fencing semantics, human-approval binding (design only, Proposed — no code/schema exists yet) | `docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md` |

## Not covered here

Remote-only facts — open PRs, CI status, PR review comments, actual GitHub merge state — are not
repository content and are intentionally not indexed here. See `CLAUDE.md`'s "Fast Session
Bootstrap" for when GitHub should be consulted instead of this index.
