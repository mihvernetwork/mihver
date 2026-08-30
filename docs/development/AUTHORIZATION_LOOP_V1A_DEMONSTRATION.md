# Authorization Loop V1A — Deterministic Demonstration Record

Status: **Development demonstration only.** This record documents a deterministic exercise of the
Decision Council → Authorization Binder → Authorization Ledger simulator → FakeExecutor → Verifier
path. It grants no real execution authority, does not authorize repository or external effects, and
does not change ADR-0006's status.

## What was demonstrated

The exercise runs real Decision Council kernel sessions and compiles their real DecisionRecords into
CouncilQuorumProofs. It demonstrates two complete R1 authorization-loop iterations; STOP-epoch
fencing; R3 denial without a grant; an exact-envelope-bound R3 simulated grant followed by one
successful consumption and replay denial; a BLOCKED TaskRecord denial before envelope construction;
and both R4 hard denial and an R1 NO_QUORUM denial.

The printed trace uses the implementation's actual loop states, proof eligibility result, envelope
disposition, Ledger outcomes/reasons, FakeExecutor receipts, and terminal outcomes.

## Reproduction

The authoritative reproduction path is:

```sh
node scripts/dev/authorization-loop-demonstration.mjs
```

The script is non-interactive, deterministic, non-LLM, and network-free. It invokes no shell, Git,
provider CLI, or real executor. All demonstrated execution is performed only by the repository's
in-memory `FakeExecutor`; it performs no filesystem mutation or external effect.

## Authority boundary

`LedgerSimulation` is a non-production in-memory simulator, and `ALLOW_ONCE` in this exercise means
only a simulated handoff to `FakeExecutor`. Neither the demonstration, its DecisionRecords, its
CouncilQuorumProofs, nor its grants confer real execution, publication, merge, or task-transition
authority. This document makes no claim that ADR-0006 is Accepted.
