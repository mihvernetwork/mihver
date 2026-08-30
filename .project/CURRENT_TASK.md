# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

DECISION-AUTHORIZATION-BOUNDARY-V1A-DESIGN

## Objective

Design, but do not implement, the first deterministic authorization boundary between an Accepted
Decision Council `DecisionRecord` (`docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`, frozen/Accepted,
not modified by this task) and any hypothetical future executable action. Produces a new `Proposed`
ADR (`docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md`) defining an `AuthorizationEnvelope`
artifact, its state machine, its deterministic policy-evaluation algorithm, replay/staleness/STOP-
fencing semantics, and the exact-bound human-approval binding required for R3. No execution gateway,
council→tool path, autonomous task selection, Publication Broker activation, or Claude/Codex
execution authority of any kind is created or implied by this task — design/document output only.

## Branch / Base

Branch: `docs/decision-authorization-boundary-v1a-design`.
Base: `main` at `3016568246837bd10349b60b0d985e9dd391d9fa` (PR #43, ADR-0005 Acceptance).

## Status

**Complete, pending human review.**

**Design produced:** `docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md` (Status: Proposed).
Defines: a threat model; the `AuthorizationEnvelope`/`AuthorizationGrant` artifact schema proposals
(no schema files created); a state machine distinguishing the immutable envelope from the privileged
Ledger's own tracked consumption lifecycle; a two-part deterministic policy-evaluation algorithm
(`evaluateAuthorization` construction, plus a mandatory privileged `resolveCanonicalRecord` +
`independentlyRederive` + `checkAndConsume` re-verification/consumption path that never trusts a
submitted envelope's own claims); replay/staleness/STOP-fencing semantics, including a new global
`stopEpoch` kill-switch concept this ADR is the first to own (distinct from ADR-0005's own, frozen,
per-session `councilEpochId`); an exact-bound human-approval binding for R3 (`AuthorizationGrant`,
modeled on `PublicationGrant`); a full R0–R4 authorization-mapping table re-derived from ADR-0005
without modifying it; an authority matrix; a trust-boundary diagram; explicit non-goals; and a staged
implementation plan (V1B Binder+schema / V1C privileged Ledger+Grant / V1D Execution Gateway, each
separately human-authorized, with an explicit V1C exit-gate requirement that no consumer of the
Ledger may exist until V1D is separately authorized).

**Adversarial review:** two rounds of independent, fresh, read-only Codex Reviewers (axes A–D, then
a fix-verification round), plus Claude's own direct self-review, found and closed several real
BLOCKER-level gaps in the first draft — most centrally, that privileged consumption logic originally
trusted fields read directly off an untrusted, model-writable-zone-submitted candidate envelope
instead of independently re-deriving them from canonical sources. Full round-by-round detail,
adjudication, and the one honestly-flagged residual (no third Codex round was run against the exact
final text) are in `.project/REVIEW_STATE.md`'s "Latest Review" section — not restated here.

**Verification:** a fresh, read-only Codex Verifier confirmed 11/11 deterministic checks PASS —
`docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`, the Decision Council kernel/simulator/schema/tests,
and the Shadow Council V1A exercise/evidence are all byte-identical to `main`; no executable, script,
or schema file was added; `PUBLICATION_BROKER.md`/`CODEX_ROLES.md`/`AGENT_POLICY.md`/the Publication
Builder/`tools/publication-broker/` are untouched; `npm run check:project-consistency` passes;
`git diff --check` is clean.

**Changes made:**
- `docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md` — new file, Status: Proposed.
- `.project/PROJECT_STATE.md` — added an `ADR-0006 (Decision Authorization Boundary): PROPOSED` line
  to the ADR status list and one compact Frozen-Steps-adjacent checkpoint bullet pointing to the ADR
  as semantic authority (no duplication of its content), matching the same pattern used when
  ADR-0003 was first created as Proposed.
- `.project/CONTEXT_INDEX.md` — added one topic → file row for the new ADR (a new file being added
  is exactly the case this index's own update policy names).
- `.project/CURRENT_TASK.md` (this file) / `.project/REVIEW_STATE.md` — task record.
- **Not modified**: `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`, the Decision Council
  kernel/simulator/schema/tests, the Shadow Council V1A exercise/evidence, the Publication Broker
  (source, docs, or schemas), any other policy document. No code, script, or schema file was created.

**Zero execution authority added.** No executor exists; no tool/action path was introduced; no
council→tool path exists; no autonomous task selection was enabled; Claude was granted no execution
authority (see the ADR's own Authority Matrix — every Claude-row cell in the privileged columns is
"no"); Shadow Council was not called; no provider/model call of any kind was made by this task's own
work beyond dispatching Codex Scout/Reviewer/Verifier sessions for read-only inspection/review, none
of which mutated any file.

## Required Context

- `docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md` (this task's own output — read it directly)
- `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md` (frozen/Accepted — unmodified; the ADR-0006 design
  reads this exactly as-is)
- `.project/REVIEW_STATE.md`'s "Latest Review" section (this task's full adversarial-review record)
- `docs/development/AGENT_POLICY.md`, `docs/development/REVIEW_PROTOCOL.md`
