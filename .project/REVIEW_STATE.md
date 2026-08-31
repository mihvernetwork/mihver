# Review State

Durable review/approval state, updated at the end of each task per `REVIEW_PROTOCOL.md`'s
completion checklist. Never invent or assume approval: if a human has not explicitly stated it,
record the gate as pending, not granted. A Codex or Claude `APPROVED` verdict is a technical
assessment, not human sign-off — see `AGENT_POLICY.md`'s Authority Hierarchy.

**Branch/task-scoped, like [CURRENT_TASK.md](./CURRENT_TASK.md).** The "Latest Review" section
below describes the current gate only when *both* hold: `CURRENT_TASK.md` is active for the
checked-out branch, and this file's own declared Branch/Task (below) matches that same
branch/task. `npm run context` checks this automatically. When either condition fails — no active
task, or this file's Branch/Task doesn't match the active one — the "Latest Review" content is
historical/stale task metadata only, not the current gate; `PROJECT_STATE.md`'s "Next Authorized
Action" is authoritative for what's next, not anything below.

## Latest Review

Task: authorization-ledger-v1c-r3-architecture-v8-failure-closure
Branch: `decision/authorization-ledger-v1c-r3-architecture-v8`
Target: main at `245957deab85b3a147ad3b8f38c7645628e30059` (PR #56 merged; merge-post CI SUCCESS)
Publication:
- Local publication: exactly ONE local commit is to be created on this branch, subject
  `chore: record v8 candidate construction blocker`. No push, no PR, no merge.
- remote publication automation: NOT AVAILABLE; human manual publication is the fallback.
- Human approval: **PENDING** — not requested, not granted.

**Authoritative classification of the V8 R3 attempt: `COUNCIL_EVIDENCE_BLOCKER`, proximate cause
`CANDIDATE_CONSTRUCTION_BLOCKER`.** This was **not** `NO_QUORUM` and **not** a Council rejection.
No `CandidateDecision` was frozen, **no frozen (non-null) `candidateHash` exists for V8**, and **no
voter was invoked**. Precisely: the only `candidateHash` *field* in the bundle is the failure
artifact's `"candidateHash": null`; the other occurrences are ordinary text inside the proposer
packet's evidence strings and the attestation `text`. No V8 candidate hash value was ever computed
into a persisted artifact. The `seat-anthropic` proposer invocation succeeded; the local post-proposal /
pre-`FREEZE_CANDIDATE` mechanical gate falsely rejected an otherwise semantically complete proposal.

**Preserved facts.** `decisionRequestId` `authorization-ledger-v1c-r3-arch-decision-8`;
`councilEpochId` `authorization-ledger-v1c-r3-arch-decision-8-epoch-1`; `rotationOrdinal` `7`;
kernel-derived proposer `seat-anthropic` (`seats[7 % 3]`, canonical order `seat-openai`,
`seat-anthropic`, `seat-google`); pre-provider packet gate **PASS**; post-proposal/pre-vote
construction gate **FAIL**; failure stage `KERNEL_EVENT` (`eventType FREEZE_CANDIDATE`); failure code
`CANDIDATE_CONSTRUCTION_BLOCKER`; voter calls **0**; `DecisionRecord` **ABSENT**;
`CouncilQuorumProof` **ABSENT**; Run Bundle **`OPEN`**; artifact count **5**. No retry, no second
candidate, no implementation, no execution authority, no publication authority, no human approval.

**False-positive gate finding (orchestrator finding, NOT bundle-proved).** The persisted
`ShadowSeatInvocationFailure` records only `errorCode CANDIDATE_CONSTRUCTION_BLOCKER` and `details
{"eventType": "FREEZE_CANDIDATE"}`. The five specific diagnostics below came from the throwaway,
uncommitted driver's gate output, and the judgement that each was a false positive came from reading
the recovered proposer text in `ShadowSeatAttestation.text`. **Neither is independently provable from
the persisted bundle bytes alone.** With that caveat: the five reported construction failures were
determined to be gate-definition defects rather than substantive proposal omissions. The gate required certain
semantics to appear under specific nested candidate fields after the packet requirements had been
shortened and reorganized to meet the packet-size bound. Known false-negative classes: (1) the
server-derived `authenticatedApproverUid` requirement existed elsewhere in the proposal but the gate
demanded it under `grantIssuanceRequest`; (2) the server-derived `grantHash` requirement existed
elsewhere but the gate demanded it under `grantIssuanceRequest`; (3) the server-derived grant `state`
requirement existed elsewhere but the gate demanded it under `grantIssuanceRequest`; (4)
`IDEMPOTENCY_KEY_REUSE` semantics were required by the architecture but the gate depended on a
literal/location removed while shrinking the packet requirements; (5) the UID policy correctly
rejected `"unknown or extra top-level fields"` but the gate's accepted wording set failed to
recognize that equivalent exact security semantic.

**The recovered proposer output is NOT promoted to normative architecture.** It is recorded only as
`UNFROZEN_PROPOSAL` / `PROPOSAL_CONTENT_NOT_ADMITTED_AS_CANDIDATE`, recoverable solely from the
persisted `ShadowSeatAttestation.text`; no `proposalContent` wrapper and no `CandidateDecision` were
persisted, consistent with failure at `FREEZE_CANDIDATE`.

**Durable evidence (OPEN bundle
`.project/run-bundles/authorization-ledger-v1c-r3-architecture-v8/`).**
`manifestHash sha256:5737aae3d3f8cd8cd20d90d2e817bcd1e8b718b79ac6665490dfcece679edf60`;
`evidenceManifestHash sha256:22f4175070897b42706722d33b7ebf884abdc26b18625ab020290643c297ffd1`;
`taskRecordHash sha256:9e6badf6028d0f1057f3667468fbe15dd6956b2520804dedf65a2d02ed5fc96e`. The exact
`DecisionRequest` (`contentHash sha256:dae00b861995399becaf56d793e463a8b73f0efa600b1be23ac16372097dbebb`,
`contextHash sha256:2c707d7f5846a883402e9191bb06849db66544f3c748c5e6307b1c7ea47db156`) and exact
`CouncilConfig` (`contentHash sha256:193fc861ba8ef9f1102705f8a69007c2c9fae83117d3da301d489379ad21c8a7`,
`councilConfigHash sha256:b6f7b1d3b700f6d90e7a37c83a3226e7bdee2f8de399a790105cff0a70d371bf`) were
persisted and manifest-bound before the first provider process, and the persisted config byte-matches
canonical `buildShadowCouncilConfig` — no seat, provider, `modelFamily` or `modelId` substitution.
Exactly one proposer packet (`packetHash
sha256:534a9c79b5f3c579ea7403afdfeb1f4c5742bbb1609f45bf7b690fb23f10252a`), exactly one admitted
`seat-anthropic` attestation, exactly one `ShadowSeatInvocationFailure`
(`failureHash sha256:d7719444beacb5e39eb88ef51335b8366cd8d51ca926ebe0d4674a11fdd19200`).

**Codex Verifier (fresh, read-only)** (thread `01a05880-0623-75e2-8a22-be1bd037cba0`):
`DECISION_EVIDENCE_VALID`, explicitly scoped — this is **not** a verdict about a Council decision,
because no `DecisionRecord` and no `CouncilQuorumProof` exist. It is a verdict that the blocked OPEN
run's persisted evidence is internally consistent and raw-byte/hash-valid, that the zero-voter claim
holds, and that historical bundles are preserved. It independently recomputed all three manifest
self-hashes, all five raw-byte content hashes, the `packetHash`, the `councilConfigHash`, and the
`7 % 3 → seat-anthropic` derivation. This technical verdict is not human approval.

**Historical integrity.** Run Bundles V3–V7 and the PR #56 smoke bundle are byte-unchanged
(aggregate digest `46748e5f9efc9108dcaf18795064a324022100b20f33140bf9c0b70e823dedf9`, identical
before and after this task). The V8 Run Bundle is byte-unchanged by this closure task (aggregate
digest `cfcc1502abf7dab5275d11d9a4091d535810aa9cd4a608dcf28ed2264357a70c`, identical before and
after). No scripts, schemas, kernel, or ADR files were modified.

**Deterministic validation: run, NOT fully green — disclosed rather than suppressed.** Passing:
`npm test` (170 fixtures), `check:project-consistency` (7 checks), `test:project-consistency`
(19 groups), `context-pack` (115), `run-bundle` (17), `publication-builder` (42),
`publication-broker` (all Go packages ok), `publication-remote-name-parity` (44),
`decision-council-kernel` (18), `council-quorum-proof` (25), `decision-council-simulator` (18),
`shadow-council-packet` (18), `shadow-council-attestation` (5), `shadow-council-cli-transport` (10),
`shadow-council-harness` (32), all three shadow-council evidence suites, and `night-runner`
(15 fixtures). **One pre-existing failure:** `test:night-runner-executor` fails on
`resolver lookup timeout fails closed for discovery and execution` (expected `FAILED`, got
`undefined`). It reproduces identically on a clean detached checkout of the base commit
`245957deab85b3a147ad3b8f38c7645628e30059`, is deterministic (not flaky) on this machine, and is
environment-sensitive (CI on that same SHA was SUCCESS). This task changed only three documentation
files and cannot have caused it; it is recorded as a pre-existing, unrelated local failure and is
**not** repaired here. A separate Codex sandbox additionally reported `publication-broker` Go
failures caused solely by that sandbox denying loopback TCP binding
(`listen tcp6 [::1]:0: operation not permitted`); those do not reproduce outside the sandbox and are
an artifact of the verification environment, not a repository defect.

**Next sequence.** V8 failure evidence publication → Shadow Council candidate-gate reliability
repair → forward-only unfrozen-proposal evidence persistence → deterministic tests + bounded smoke →
merge → V9 new R3 `DecisionRequest` → fresh proposer / fresh candidate → 3-seat Council.

Primary next action: **`CANDIDATE_GATE_RELIABILITY_REPAIR_REQUIRED`**. `NEW_R3_CANDIDATE_REQUIRED` is
explicitly **not** the immediate next action: the tooling defect must be fixed before another R3
attempt is made.
