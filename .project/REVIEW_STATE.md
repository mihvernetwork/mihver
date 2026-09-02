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

Task: shadow-council-candidate-gate-reliability-v1
Branch: `fix/shadow-council-candidate-gate-reliability-v1`
Target: main at `3d90e0eaa9dbd65cd52112c574b1d823c598f0f8` (PR #57 merged; merge-post CI SUCCESS)

**Fresh read-only Scout** (thread `01a05917-4b31-7103-876c-72e5571d281c`): confirmed no Decision
Council quorum/kernel semantics change is required to implement a pre-freeze candidate gate plus a
non-normative `ShadowUnfrozenProposal` artifact — `NO PROTOCOL SEMANTICS CHANGE REQUIRED`. Mapped
the exact proposer response contract, the `proposalContent` construction site, the
commitment/reveal/freeze kernel sequence, the `applyEventImpl` seam, existing durable-evidence hooks,
packet/evidence size limits, the hash/domain convention, and the invocation-failure taxonomy.

**Implementation** (fresh Codex Implementer, three remediation rounds): built
`scripts/dev/shadow-council-candidate-requirements.mjs` (canonical `CandidateRequirementSpec`, 13
declarative hard-rule operations dispatched from one private, deep-frozen op table; deterministic
budget-safe renderer; pure validator) and `scripts/dev/shadow-council-unfrozen-proposal.mjs`
(`ShadowUnfrozenProposal`, domain `MIHVER:ShadowCouncil:UnfrozenProposal:v1\0`); integrated the gate
into `runProposerFlow` (`scripts/dev/shadow-council-harness.mjs`) between the strict `{summary,payload}`
shape check and `SUBMIT_COMMITMENT`; wired durable persistence of both new artifact kinds into
`scripts/dev/shadow-council-run-bundle-evidence.mjs`, before the proposer packet/provider invocation
for the spec and before validation for the unfrozen proposal.

**Adversarial Reviewer (fresh, read-only)** found and the Implementer closed, across two remediation
rounds: (1) an empty `hardGate` validated any payload — now `hardGate.length >= 1` is enforced at
build time and by the schema, and non-object candidate payloads fail closed; (2) a caller-supplied
`validateCandidateImpl` returning a bare `{ok:true}` bypassed every rule — the harness now verifies
the full result contract (`specHash`, ordered `evaluatedRequirementIds`, empty failure arrays) via an
exported `assertGateResultAccepted`; (3) a throwing validator escaped the audited failure path — now
wrapped in try/catch, captured as `KERNEL_EVENT`/`CANDIDATE_CONSTRUCTION_BLOCKER` with
`gateEvaluationError`, and hostile property getters on the candidate payload or the gate result are
never invoked; (4) the operator inventory was independently restated in four places — now single-
sourced from one private op table, with a test asserting the JSON Schema enum cannot drift from it;
(5) `assertGateResultAccepted` trusted an unverified spec (a forged/tampered/stale
`requirementSpecHash` was accepted) — it now recomputes the spec's self-hash over the normalized body
and rejects any mismatch; (6) the acceptance predicate was not total (a throwing property getter on
the result object propagated) — it now rejects accessor properties without invoking them and is
provably total. Re-review verdict: **`READY_FOR_FINAL_VERIFICATION`**
(thread `01a0593f-cc37-7d81-9693-1bdc478a85b8`).

**Fresh final Verifier (read-only)** (thread `01a05948-beb5-78b1-aec0-c042c03200ec`): verdict
**`READY_FOR_PUBLICATION`** across 26 checks — single canonical hard-gate source with renderer and
validator provably unable to diverge; no substring/prose-based hard gating; the V8-class regression
proposal (structured server-derived approver identity, server-derived `grantHash`, lifecycle initial
state, explicit `IDEMPOTENCY_KEY_REUSE` outcome, structured `rejectUnknownTopLevelFields`) validates,
and each of those five values independently mutated fails with the correct `requirementId`; packet
budgeting cannot drop/truncate/reorder a requirement and fails closed before provider invocation; the
requirement spec and the unfrozen proposal are both durable before their respective next steps; a
blocked freeze leaves the bundle `OPEN` with zero voters and no `candidateHash`; a successful freeze
yields `candidateHash` only after gate PASS; `unfrozenProposalHash` is distinct from `candidateHash`;
V3–V8 and the PR #56 smoke bundle are unchanged; the kernel, ADR-0005, quorum-proof, and Authorization
Binder semantics are unchanged; no-spec runs are unaffected. The one accepted exception: a pre-existing
`test:night-runner-executor` baseline defect, independently proven identical on base `3d90e0e` and
unrelated to this change (a fresh `/tmp` clone of the base SHA reproduces the identical failure). A
`test:publication-broker` failure inside the Verifier's own sandbox (TCP/Unix-socket bind denied) was
independently proven to be a sandbox artifact, not a defect — a forced, uncached `go test -count=1
./...` run outside that sandbox passed every package.

**One bounded real R2 smoke**, `shadow-council-candidate-gate-reliability-v1-smoke` — no retry, no
provider substitution, no second smoke: gate **ACCEPTED** (8/8 requirements evaluated, 0 failures),
terminal **`DECIDED`/`COUNCIL_APPROVED`**, Run Bundle **`FINALIZED`** with **14 artifacts**
(`manifestHash sha256:893ba6a63817add517bfd737263bc3689988c0817f82ab2b4e82666663d579a3`). Proposer
`seat-openai`; voters `seat-google`, `seat-anthropic` (R2 rule held — proposer did not vote).
`candidateHash sha256:1c1de1a428a380d93123237428cb5d12cda915b02713d82bf5ec56d079f38573`;
`unfrozenProposalHash sha256:fa4c792952d6e9e0e246a8a4a020ce4f4163deb98f4c25c5e8a9f4c395429727`
(confirmed distinct — separate hash domains and preimages, neither appears in the other artifact);
DecisionRecord `recordHash sha256:e2accd2e0f2c51000414ff3a257405cc13142ec6dd93a06fe9aba7bfaa28dd6f`;
contemporaneous CouncilQuorumProof
`proofHash sha256:30ae0a3e2309620c6ea7ef9a369d701ece45c87136b7fa8d7356c76262cf4be1`;
`authorizationEvidenceEligible: true`.

**Independent smoke evidence verification (fresh, read-only, from bundle bytes alone)**
(thread `01a05957-8fc7-7d02-accf-3990e775303e`): verdict **`SMOKE_EVIDENCE_VERIFIED`** — recomputed
every hash above from the persisted artifacts, re-ran `validateCandidateAgainstRequirementSpec`
against the recovered spec and candidate payload (`ok:true`, all 8 requirementIds evaluated),
confirmed the full durable persistence chain (DecisionRequest, CouncilConfig,
CandidateRequirementSpec, UnfrozenProposal, terminal DecisionRecord, CouncilQuorumProof), and
independently re-confirmed V3–V8 and the PR #56 smoke bundle byte-unchanged, the kernel/ADR-0005/
quorum-proof/Authorization Binder code unchanged, and that the only paths differing from base
`3d90e0e` are the 10-file source/schema/test/doc change set plus the new smoke bundle directory.

**Historical integrity.** Run Bundles V3–V8 and the PR #56 smoke bundle are byte-unchanged before and
after this task. V8 specifically remains `OPEN`, `candidateHash: null`, 5 artifacts, zero voters,
zero `DecisionRecord`, zero `CouncilQuorumProof` — it was **not** repaired retroactively and was not
rerun. No scripts outside the authorized surfaces, no schemas outside the two new ones, and no kernel,
ADR, quorum-proof, or Authorization Binder files were modified.

**Deterministic validation: fully green** (aside from the two independently-proven-unrelated
exceptions above). `npm test` (170 fixtures), all Shadow Council suites including the two new ones,
`decision-council-kernel` (18), `council-quorum-proof` (25), `decision-council-simulator` (18),
`run-bundle` (17), `context-pack` (115), `publication-builder` (42),
`publication-remote-name-parity` (44), `night-runner` (15), `project-consistency` (19 groups),
`publication-broker` (all Go packages, forced fresh run), `git diff --check` clean.

**Next sequence.** Candidate-gate reliability publication → merge-post CI → human explicitly
authorizes a V9 task → V9 fresh `DecisionRequest` → new proposer invocation → new frozen candidate →
3-seat R3 Council → durable `DecisionRecord` → durable contemporaneous `CouncilQuorumProof` → fresh
human pre-authorization audit.

Primary next action: **`CANDIDATE_GATE_RELIABILITY_PUBLICATION_PENDING_HUMAN_REVIEW`** — human review
of implementation commit `8c19e6aa028e64d1d86e0e608ce66e673bc5a9c2` and the finalized smoke Run
Bundle; human approval is PENDING — not requested, not granted. `V9_NEW_R3_ARCHITECTURE_DECISION` is
the next architectural action but is explicitly **not yet authorized**: no V9 task may start without
its own separate, explicit human instruction, and V1C implementation remains likewise unauthorized.
No execution, publication, push, PR, merge, or autonomy authority follows from anything in this task.
