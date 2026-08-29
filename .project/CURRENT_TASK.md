# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

ADR-0005-ACCEPTANCE-GATE-DEFINITION

## Objective

Define the forward-looking Status-revisit / acceptance condition for `ADR-0005` (Decision Council
Protocol) before any Shadow Council implementation begins. Does not accept `ADR-0005` — its Status
remains **Proposed**. Does not change the Decision Council protocol, quorum rules, schemas, kernel,
simulator, or tests. Does not start Shadow Council.

## Branch / Base

Branch: `docs/adr-0005-acceptance-gate-definition`.
Base: `main` at `fb6bd0a13a3c21cbcdab17b5aae5d97f7262b34c`.

## Status

**Complete, pending human review.**

**Changes made:**
- `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md` — added one new `## Acceptance Gate` section
  (85 lines) at the end of the document, after `## Future Work`. No other section was edited; the
  `## Status` field (line 5, `Proposed`) is untouched. The new section:
  - states explicitly that Status remains Proposed and that satisfying the gate does not itself
    flip Status — a later, separate, explicit human decision is still required;
  - states explicitly that none of its seven criteria is satisfied by work completed to date (V1A
    proves internal protocol soundness only, not real-provider seat behavior);
  - lists seven required future-evidence criteria: (1) V1A remains frozen and its deterministic/
    adversarial suite still passes; (2) a separately-authorized Shadow Council exercise has
    actually run, with three real provider-backed seats producing the existing typed artifacts;
    (3) real seat/provider origin attestation at the adapter/runtime boundary is demonstrated,
    closing the specific gap this ADR's own "Risks" section already names; (4) at least one
    representative R1 and one representative R2 decision traverse the exact existing commitment →
    reveal → candidate freeze → vote → `DecisionRecord` sequence without kernel/quorum redesign;
    (5) council artifacts/`DecisionRecord` bind into the existing Run Bundle audit model without a
    semantic change; (6) shadow execution remained advisory only throughout the exercise — no
    council result directly caused repository mutation, publication, merge, tool execution, or
    autonomous task execution; (7) at least one independent adversarial review of the real exercise
    finds no protocol-level redesign requirement;
  - states explicitly that unresolved operational/provider-adapter issues do not block acceptance
    if they don't require changing the protocol itself;
  - states explicitly that an observed need to change topology, candidate/vote binding, risk/quorum
    semantics, the authority boundary, or core typed-artifact meaning **is** a blocker;
  - states explicitly that Publication Broker activation and bounded autonomous execution are
    **not** prerequisites for this ADR's acceptance.
- `.project/CURRENT_TASK.md` (this file) / `.project/REVIEW_STATE.md` — task start/completion
  record only.
- **Not modified** (per this task's own scope): `.project/PROJECT_STATE.md`,
  `.project/DECISIONS_LOG.md` (no checkpoint/status decision is being made — `ADR-0005` stays
  Proposed), `schemas/dev/decision-council.schema.json`, `scripts/dev/decision-council-kernel.mjs`,
  `scripts/dev/decision-council-simulator.mjs`, `tests/dev/decision-council-kernel.test.mjs`,
  `tests/dev/decision-council-simulator.test.mjs`.

**Codex roles used** (real `mcp__codex__codex`, never a Claude subagent standing in for a role):
- **Reviewer**, thread `01a04ca3-85f9-7d33-8344-f905540d01ed` (fresh, read-only, independent) —
  final verdict **APPROVED**; full findings in `.project/REVIEW_STATE.md`.
- **Verifier**, thread `01a04ca6-197d-7b83-a032-89aa28b290f3` (fresh, `workspace-write`,
  independent) — **ALL CHECKS PASS**; full results in `.project/REVIEW_STATE.md`.

**Final verdict: APPROVED / ALL CHECKS PASS** (see `.project/REVIEW_STATE.md`'s "Latest Review"
section for the full transcript of both).

**Authority boundary preserved**: no protocol/schema/kernel/simulator/test change; no Shadow
Council started; `ADR-0005`'s Status field itself untouched.

**Publication:**
- Local Publication Builder authorized: yes, per this task's own explicit instruction ("prepare
  exactly one local commit through the repository publication flow"), gated on Reviewer verdict and
  clean verification.
- Remote publication: human manual fallback only (unchanged — this task does not touch that).
- Exactly one local commit, subject `docs: define adr-0005 acceptance gate`, via
  `scripts/dev/publication-builder.mjs`. Not pushed, no PR touched, not merged, no follow-on task
  (Shadow Council or otherwise) started.

## Required Context

- `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`
- `docs/development/AGENT_POLICY.md`, `docs/development/CODEX_ROLES.md`,
  `docs/development/REVIEW_PROTOCOL.md`
