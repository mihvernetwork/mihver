# Decisions Log

Append-only. Records durable, human-approved project/process decisions — not their technical
content, which lives in the relevant ADR/contract and must not be duplicated here. Entries are
added at task completion; existing entries are never edited or removed.

Format: `YYYY-MM-DD — decision — reference`.

---

- 2026-08-19 — M0 Step 02A (Intent semantic contract) merged to `main` via PR #1, human-gated
  merge per `AGENT_POLICY.md`. — `218bced`
- 2026-08-19 — M0 Step 02B (Intent schema): human decision stated directly as "APPROVED"; merged
  to `main`. — `0683e84`
- 2026-08-19 — Authorized `PROJECT-CONTEXT-BOOTSTRAP`: build the `.project/` session-bootstrap
  mechanism and `scripts/dev/project-context.mjs`. — branch `chore/project-context-bootstrap`
- 2026-08-19 — Authorized `PROJECT-CONTEXT-FINAL-PATCH`: harden the bootstrap lifecycle before
  merge — durable-only `PROJECT_STATE.md`, branch-scoped `CURRENT_TASK.md`, a permanent
  Operational State Scope policy, and a compact-by-default `npm run context` with `--full`. —
  branch `chore/project-context-bootstrap`
- 2026-08-19 — Human review of the `chore/project-context-bootstrap` branch and bootstrap
  mechanism: **APPROVED WITH FINAL OPERATIONAL PATCH REQUIRED**, stated directly by the human,
  not final merge approval. Authorized `PROJECT-CONTEXT-MERGE-GATE`: Gate Recording Commit policy,
  a compact PROJECT_STATE.md-derived summary in `npm run context`, and this review-state record. —
  branch `chore/project-context-bootstrap`
- 2026-08-19 — `PROJECT-CONTEXT-BOOTSTRAP` **APPROVED for merge** — human decision stated directly
  as "PROJECT-CONTEXT-BOOTSTRAP is APPROVED for merge"; recorded via a Gate Recording Commit per
  `AGENT_POLICY.md`. The merge itself has not been performed — execution requires a separate,
  later explicit instruction. — branch `chore/project-context-bootstrap`
- 2026-08-19 — `PROJECT-CONTEXT-BOOTSTRAP` merged to `main`: human requested PR + squash merge
  directly in conversation (base `main`, compare `chore/project-context-bootstrap`), executed via
  PR #3, squash commit `c5d3dc8`, message `chore: add durable project context bootstrap`. Fulfills
  the merge decision recorded above. — `c5d3dc8`
- 2026-08-19 — Authorized `PROJECT-CONTEXT-FREEZE-STATE`: sync durable project state after the PR
  #3 merge — record the new frozen checkpoint in `PROJECT_STATE.md`, update operational state
  files per `AGENT_POLICY.md`'s Operational State Scope, no bootstrap-implementation or
  architecture changes. — branch `chore/project-context-freeze-state`
- 2026-08-19 — `PROJECT-CONTEXT-FREEZE-STATE` (PR #4) **APPROVED for merge** — human decision
  stated directly as "PR #4 / PROJECT-CONTEXT-FREEZE-STATE is APPROVED for merge"; recorded via a
  Gate Recording Commit per `AGENT_POLICY.md`. The merge itself has not been performed —
  execution requires a separate, later explicit instruction. — branch
  `chore/project-context-freeze-state`
- 2026-08-19 — `PROJECT-CONTEXT-REVIEW-SCOPE` (PR #5) **APPROVED for merge** — human decision
  stated directly as "PR #5 / PROJECT-CONTEXT-REVIEW-SCOPE is APPROVED for merge"; recorded via a
  Gate Recording Commit per `AGENT_POLICY.md`. The merge itself has not been performed —
  execution requires a separate, later explicit instruction. — branch
  `chore/project-context-review-scope`
- 2026-08-19 — `PROJECT-CONTEXT-AUTO-BOOTSTRAP` (PR #6) **APPROVED for merge** — human decision
  stated directly as "PR #6 / PROJECT-CONTEXT-AUTO-BOOTSTRAP is APPROVED for merge"; recorded via
  a Gate Recording Commit per `AGENT_POLICY.md`. The merge itself has not been performed —
  execution requires a separate, later explicit instruction. — branch
  `chore/project-context-auto-bootstrap`
- 2026-08-19 — `NIGHT-RUNNER-FOUNDATION` (PR #7) **APPROVED for merge** — human decision stated
  directly as "PR #7 / NIGHT-RUNNER-FOUNDATION is APPROVED for merge"; recorded via a Gate
  Recording Commit per `AGENT_POLICY.md`. The merge itself has not been performed — execution
  requires a separate, later explicit instruction. — branch `chore/night-runner-foundation`
- 2026-08-21 — `ADR-0002` (Epistemic Provenance Model) Status: **Accepted** — human decision stated
  directly ("ADR-0002 is approved to move from Proposed to Accepted"), citing merged PR #10
  (adversarial review) and PR #11 (remediation, final consistency sweep, and handoff-consistency
  fix) as evidence, plus a 32/32 passing contract test suite and no representability or
  epistemic-model redesign blocker found across four independent review rounds. Implemented as task
  `ADR-0002-ACCEPTANCE`. The merge of that change to `main` has not been performed — execution
  requires a separate, later explicit instruction. — branch `docs/adr-0002-acceptance`

---

The entries below were appended during `PROJECT-STATE-RECONCILE-POST-STEP-03A` to record merges of
previously-logged-but-then-still-pending decisions above, plus two merges with no prior entry at
all. Every fact below was verified directly against `git log` and `gh pr list --state merged`
before being recorded — none is inferred, reconstructed, or restated from stale `.project` prose.
Entries above this line are unmodified, per this log's append-only policy.

- 2026-08-19 — `PROJECT-CONTEXT-FREEZE-STATE` (PR #4) merged to `main`: verified via `git log` and
  `gh pr list --state merged`. Fulfills the merge decision recorded above (that entry recorded
  approval only; this entry is the follow-up confirming execution happened). — squash commit
  `6a399c7`
- 2026-08-19 — `PROJECT-CONTEXT-REVIEW-SCOPE` (PR #5) merged to `main`: verified via `git log` and
  `gh pr list --state merged`. Fulfills the merge decision recorded above. — squash commit
  `fdc27d4`
- 2026-08-19 — `PROJECT-CONTEXT-AUTO-BOOTSTRAP` (PR #6) merged to `main`: verified via `git log`
  and `gh pr list --state merged`. Fulfills the merge decision recorded above. — squash commit
  `3f0b53b`
- 2026-08-19 — `NIGHT-RUNNER-FOUNDATION` (PR #7) merged to `main`: verified via `git log` and
  `gh pr list --state merged`. Fulfills the merge decision recorded above. — squash commit
  `9a61a0b`
- 2026-08-20 — `NIGHT-RUNNER-FRESH-CLAUDE-EXECUTOR` (PR #8) merged to `main`: verified via
  `git log` and `gh pr list --state merged` — squash commit `4590f7a`. No prior Gate Recording
  Commit entry exists in this log for this PR's merge-approval; this entry records only the
  verified merge fact from git/GitHub, not a reconstructed human quote.
- 2026-08-21 — `ADR-0002-ACCEPTANCE` (PR #12) merged to `main`: verified via `git log` and
  `gh pr list --state merged` — squash commit `a20d647`. Fulfills the `ADR-0002` Status: Accepted
  decision recorded above. `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`'s own `## Status`
  field on `main` now reads **Accepted**, confirmed by direct read of the file at this commit.
- 2026-08-21 — `M0-STEP-03A-REQUIREMENT-SPEC-SEMANTIC-CONTRACT` (PR #13) merged to `main`: verified
  via `git log` and `gh pr list --state merged` — squash commit `fe79098`. Produced
  `docs/contracts/REQUIREMENT_SPEC.md`, `docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`
  (Status: Proposed, confirmed by direct read of the file at this commit),
  `docs/examples/REQUIREMENT_CASES.md`. No prior entry in this log recorded an approval decision
  for this merge. This entry records only the merge fact independently verified via `git log` and
  `gh pr list --state merged`; the merge-authorization decision itself is not something `git log`
  or `gh pr list` can show, is not independently verifiable from those sources, and is not claimed
  as Claude-witnessed here.
- 2026-08-22 — `M0-ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY` (PR #15) merged to `main`: verified
  via `gh pr view 15 --repo mihvernetwork/mihver --json state,mergedAt,mergeCommit,title`
  (`state: MERGED`, `mergedAt: 2026-08-22T11:23:44Z`) and `git log`/`git status` on `main` (`HEAD`
  matches the reported merge commit exactly) — squash commit `aa1fe66072ae780a910eb458f8263c4886fd37fd`.
  Produced `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`,
  `docs/contracts/MEMORY_CONTEXT.md`, `docs/examples/MEMORY_CONTEXT_CASES.md`. `ADR-0004`'s own
  `## Status` field on `main` at this commit reads **Proposed**, confirmed by direct read of the
  file at this commit — not Accepted, and not claimed as such here. No prior entry in this log
  recorded an approval decision for this merge; this entry records only the independently-verified
  merge fact, not a reconstructed human quote. `MemoryContext` remains design-only: no stage
  declares it as an input on `main` at this commit, and no `mihver-brain` or runtime change
  accompanied this merge.
- 2026-08-22 — `M0-FOUNDATION-MEMORY-BOUNDARY-A` (PR #17) merged to `main`: verified via
  `gh pr view 17 --repo mihvernetwork/mihver --json state,mergedAt,mergeCommit,title`
  (`state: MERGED`, `mergedAt: 2026-08-22T16:09:50Z`) and `git log`/`git status` on `main` (`HEAD`
  matches the reported merge commit exactly) — squash commit
  `9416e857b549bea07d4ce06a5c365524fdf1d51a`. Amended `docs/foundation/M0_SCOPE.md` to implement
  `ADR-0004`'s Dependency A: introduced `RunContext` (a non-memory run/invocation scope anchor,
  distinct from `UserIdea`), the cross-cutting `MemoryContext` Producer boundary, and authorized
  Research Planning as the first and only `MemoryContext`-consuming stage (`DISCOVERY_ATTENTION`
  tier only, additive, provenance-visible). `ADR-0004`'s own `## Status` field on `main` at this
  commit still reads **Proposed** — not Accepted, and not claimed as such here. Every other stage,
  and `ADR-0004`'s dependencies B, C, and D, remain structurally disabled; `INTENT_SPEC.md`/
  `REQUIREMENT_SPEC.md` are untouched. No `mihver-brain`, schema, or runtime change accompanied
  this merge — this is a semantic/foundation authorization only. No prior entry in this log
  recorded an approval decision for this merge; this entry records only the independently-verified
  merge fact, not a reconstructed human quote.
- 2026-08-22 — `ADR-0004` (Memory Context Authority Boundary) Status: **Accepted** — human decision
  stated directly via the `ADR-0004-ACCEPTANCE` task prompt itself ("Move ADR-0004 ... from Proposed
  to Accepted, but ONLY if its own previously-defined Acceptance Gate is demonstrably satisfied by
  current `main`"), which this task treats as the explicit human authorization for the Status
  transition. Basis: `ADR-0004`'s own "Acceptance Gate" section requires dependency A alone
  (the core `M0_SCOPE.md` integration boundary), separately, explicitly human-authorized, completed,
  and adversarially reviewed against real cases — independently reverified against current `main`
  before this change: dependency A completed via PR #17 (squash commit
  `9416e857b549bea07d4ce06a5c365524fdf1d51a`, confirmed merged via `gh pr view 17`), and
  adversarially reviewed by four independent read-only Codex reviewers before that merge (see
  `.project/REVIEW_STATE.md`'s history for `M0-FOUNDATION-MEMORY-BOUNDARY-A`). No semantic redesign
  was performed in this task — Model C and the full `MEMORY_CONTEXT.md` contract are unchanged.
  Dependencies B, C, and D remain exactly as structurally disabled as before this Status change; no
  `MemoryContext` runtime, schema, or Brain adapter exists; `ADR-0003`'s own Status is unchanged
  (**Proposed**). The Status change itself is recorded in
  `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`'s own `## Status` field. The PR opened for
  this change has not merged as of this entry — merge execution requires a separate, later, explicit
  human instruction.
- 2026-08-23 — `ADR-0004-ACCEPTANCE` (PR #19) merged to `main`: verified via
  `gh pr view 19 --repo mihvernetwork/mihver --json state,mergedAt,mergeCommit,title`
  (`state: MERGED`, `mergedAt: 2026-08-22T16:48:25Z`) and `git log`/`git status` on `main` (`HEAD`
  at this task's start matched the reported merge commit exactly) — squash commit
  `8b0c0b65b3d8e6f2cb3034d9f395b2008694cc75`. Fulfills the Status: Accepted decision recorded above
  — that entry recorded the decision and its basis only, noting explicitly its PR had not yet
  merged; this entry records only the independently-verified merge fact, not a reconstructed human
  quote. `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`'s own `## Status` field on `main`
  at this commit reads **Accepted**, confirmed by direct read of the file at this commit.
- 2026-08-23 — `M0-MEMORY-CONTEXT-SCHEMA-FOUNDATION` (PR #20, plus one same-branch/PR follow-up
  commit closing four reviewer-found structural gaps) merged to `main`: verified via
  `gh pr view 20 --repo mihvernetwork/mihver --json state,mergedAt,mergeCommit,title`
  (`state: MERGED`, `mergedAt: 2026-08-22T21:27:25Z`) and `git log`/`git status` on `main` (`HEAD`
  at this task's start matched the reported merge commit exactly) — squash commit
  `b8fc6fe6558adbb560b48f1bbe937db53ac09555`. Produced the first machine-readable `MemoryContext`
  JSON Schema (`schemas/m0/memory-context.schema.json`), deterministic validator integration, a
  27-fixture contract corpus, and `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`. Established
  only the `MemoryContext`-side `(memory_context_id, entry_id)` reference primitive; `INTENT_SPEC.md`,
  `intent-spec.schema.json`, and `REQUIREMENT_SPEC.md` are untouched on `main` at this commit,
  confirmed by direct read. No `mihver-brain`, runtime, or MCP change accompanied this merge; no new
  `MemoryContext` consumer was authorized (Research Planning, `DISCOVERY_ATTENTION` only, remains
  the sole authorized consumer per `docs/foundation/M0_SCOPE.md`); dependencies B, C, and D remain
  structurally disabled. No prior entry in this log recorded an approval decision for this merge;
  this entry records only the independently-verified merge fact, not a reconstructed human quote.
- 2026-08-23 — `M0-DEPENDENCY-B-INTENT-MEMORY-PREMISE` (PR #22) merged to `main`: verified via
  `gh pr view 22 --repo mihvernetwork/mihver --json state,mergedAt,mergeCommit,title`
  (`state: MERGED`, `mergedAt: 2026-08-22T23:14:04Z`) and `git log`/`git status` on `main` (`HEAD`
  at this task's start matched the reported merge commit exactly) — squash commit
  `2cee16af702804127472af0470b3ce4ef2600f88`. Landed `ADR-0004` Dependency B: Intent Parsing became
  an authorized `MemoryContext` consumer (`docs/foundation/M0_SCOPE.md`); the Category A
  `SEMANTIC_PREMISE` → Inferred Claim path landed (`docs/contracts/INTENT_SPEC.md`'s Inference
  Policy amendment, `schemas/m0/intent-spec.schema.json`'s typed `memoryPremise` reference); the
  Category A/B `DISCOVERY_ATTENTION` clarification-provenance path landed; deterministic companion-
  `MemoryContext` cross-artifact validation landed in `tests/contracts/validate-contracts.mjs`
  (mandatory, not optional, whenever a memory reference is present), confirmed by direct read of
  the merged files at this commit. Contract suite at this commit: **83/83**, confirmed by running
  `npm test` directly against `main`. Dependencies C and D remain unimplemented; Requirement
  Derivation remains unauthorized to consume `MemoryContext`; no MIHVER Brain adapter or runtime
  exists — confirmed by direct read, not assumed. No prior entry in this log recorded an approval
  decision for this merge; this entry records only the independently-verified merge fact, not a
  reconstructed human quote.
- 2026-08-23 — `M0-DEPENDENCY-C-DISPOSITION` (PR #24, plus one same-branch/PR follow-up commit from
  `DEPENDENCY-C-DISPOSITION-SEMANTIC-CLOSURE` sharpening retirement-proof wording and fixing an
  invented Case 21 Unknown) merged to `main`: verified via
  `gh pr view 24 --repo mihvernetwork/mihver --json state,mergedAt,mergeCommit,title`
  (`state: MERGED`, `mergedAt: 2026-08-23T07:15:36Z`) and `git log`/`git status` on `main` (`HEAD` at
  this task's start matched the reported merge commit exactly) — squash commit
  `54ef91c181134487a50cb7b7c3d3ebeb66716b78`. `ADR-0004` Dependency C was retired, not implemented:
  its originally planned direct path, `MemoryContext → Requirement-Level Inference premise`, was
  re-derived before any implementation and found redundant given Dependency B, confirmed by direct
  read of the merged files at this commit. `docs/contracts/REQUIREMENT_SPEC.md`'s invariant R-23 now
  explicitly forbids a `MemoryContext` entry, directly, as a Requirement-Level Inference premise.
  Requirement Derivation's declared `Input:` remains `IntentSpec` only. Dependency B remains the
  canonical, sole path by which historical-user `MemoryContext` content reaches `SEMANTIC_PREMISE`
  standing. Dependency D remains pending and unaffected — a separate, narrower,
  zero-independent-authority `DECISION_OPTION` path, not designed or implemented by this merge.
  Contract suite at this commit: **83/83**, confirmed by running `npm test` directly against `main`.
  No schema, runtime, or `mihver-brain` change accompanied this merge — confirmed by direct read, not
  assumed. No prior entry in this log recorded an approval decision for this merge; this entry
  records only the independently-verified merge fact, not a reconstructed human quote.
- 2026-08-23 — `M0-DECISION-OPTION-HISTORICAL-SOURCE-GATE-CLOSURE` / `DECISION-OPTION-SOURCE-GATE-
  CLOSURE` (PR #26) merged to `main`: verified via
  `gh pr view 26 --repo mihvernetwork/mihver --json state,mergedAt,mergeCommit,title`
  (`state: MERGED`, `mergedAt: 2026-08-23T08:49:07Z`) and `git log` confirming that squash commit's
  presence in `main`'s ancestry — squash commit `a16491d41d93f4edac9378b6184de071aa681f32`. (This
  reconciliation task's own HEAD at start was the later PR #27 merge commit
  `bb70a9ec92da1a17fbb4129f3c062626ecd00cd5`, not PR #26's — see the PR #27 entry below; PR #26's own
  merge fact was independently re-verified via `gh pr view`, not from a HEAD-at-start match.) Settled,
  by explicit human decision, a prerequisite policy question for `ADR-0004` Dependency D: a
  `MemoryContext` entry classified as a historical user statement — Category A or Category B — is
  categorically ineligible for `DECISION_OPTION`. Established two independent, both-required gates:
  R-19 content eligibility (Gate 1) and `MemoryContext` source eligibility (Gate 2). The existing
  deterministic source-gate decision logic (`tests/contracts/validate-contracts.mjs`) was already
  correct and remained unchanged; this PR only clarified/extended the surrounding diagnostic error-
  message wording around that rule, confirmed by direct read of the merged files at this commit — not
  every byte or message in the file was left untouched, only the decision logic itself. Contract
  suite at this commit: **85/85**,
  confirmed by running `npm test` directly against `main`. Dependency D itself remained
  unimplemented at this checkpoint — confirmed by direct read, not assumed. No `mihver-brain` or
  runtime integration accompanied this merge. No prior entry in this log recorded an approval
  decision for this merge; this entry records only the independently-verified merge fact, not a
  reconstructed human quote.
- 2026-08-23 — `M0-DEPENDENCY-D-R19-MEMORY-DECISION-OPTION` / `DEPENDENCY-D-FOUNDATION-AND-CORPUS-
  CLOSURE` / `DEPENDENCY-D-FINAL-CROSSREF-HYGIENE` (PR #27) merged to `main`: verified via
  `gh pr view 27 --repo mihvernetwork/mihver --json state,mergedAt,mergeCommit,title`
  (`state: MERGED`, `mergedAt: 2026-08-23T10:26:17Z`) and `git log`/`git status` on `main` (`HEAD` at
  this task's start matched the reported merge commit exactly) — squash commit
  `bb70a9ec92da1a17fbb4129f3c062626ecd00cd5`. `ADR-0004` Dependency D was implemented: Requirement
  Derivation became the third authorized `MemoryContext` consumer (`docs/foundation/M0_SCOPE.md`),
  restricted to exactly `DECISION_OPTION`, confirmed by direct read of the merged files at this
  commit. New invariant **R-24** (`docs/contracts/REQUIREMENT_SPEC.md`) requires an adopted value to
  carry a distinct memory-informed-rationale citation of the stable `(memory_context_id, entry_id)`
  identity, in addition to its own independent rationale; R-19 unchanged; Dependency C's retirement
  and R-23 remain intact, unaffected; the historical A/B `DECISION_OPTION` source gate (PR #26
  above) remains categorical and unweakened. `MemoryContext` is not, and does not become, Evidence.
  No `RequirementSpec` schema or runtime change accompanied this merge — confirmed by direct read,
  not assumed. Contract suite at this commit: **85/85**, confirmed by running `npm test` directly
  against `main`. No prior entry in this log recorded an approval decision for this merge; this
  entry records only the independently-verified merge fact, not a reconstructed human quote.
- 2026-08-28 — Human authorized `PROJECT-CONTINUITY-V1A-CONTEXT-PACK`: create a deterministic,
  zero-network, read-only, derived ProjectContextPack that never grants execution or publication
  authority. PR #34 is the human-review vehicle; merge remains human-only. —
  `docs/development/PROJECT_CONTINUITY.md`
- 2026-08-29 — Project Continuity V1A accepted and frozen: PR #34 merged to `main`, squash commit
  `dbdb4f7049d2a73728038f1c98efc47ddfee3727`, establishing the deterministic `ProjectContextPack` v1
  foundation. — `docs/development/PROJECT_CONTINUITY.md`
- 2026-08-29 — Project Continuity V1B accepted and frozen: PR #36 merged to `main`, squash commit
  `8fad9198460b80d28894a821feaa44df4e9b982f`, establishing the deterministic Run Bundle v1
  foundation. — `docs/development/RUN_BUNDLE.md`
- 2026-08-29 — Decision Council V1A (deterministic kernel + simulator) accepted and frozen: PR #38
  merged to `main`, squash commit `2e9a0e88ad8b74bc11afc0fcac8db704f74690d0`.
  `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`'s own `## Status` field remains **Proposed** —
  this freeze does not change it. No Shadow Council or other follow-on task is authorized by this
  entry. — `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`
- 2026-08-29 — Shadow Council V1A (advisory CLI harness) accepted and frozen: PR #41 merged to
  `main`, squash commit `45077da5300bc56492e26f041fb88583dd5f0085`.
  `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`'s own `## Status` field remains **Proposed** —
  this freeze does not change it; all Shadow Council output remains advisory only. No ADR-0005
  acceptance or execution-integration follow-on task is authorized by this entry. —
  `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`
- 2026-08-30 — Human authorized `ADR-0005-ACCEPTANCE`: `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`'s
  own `## Status` field moved **Proposed → Accepted**, on frozen evidence basis PR #38/#39
  (Decision Council V1A kernel/simulator), PR #40 (Acceptance Gate definition), PR #41 (real Shadow
  Council V1A evidence), and PR #42 (Shadow Council V1A freeze). Acceptance authorizes no
  execution, publication, merge, or autonomy capability. — `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`
- 2026-08-30 — `AUTHORIZATION-LEDGER-V1C-V5-PREAUTH-CLOSURE` (narrow, read-only, no new commits to
  the finalized Run Bundle): persisted the result of an already-completed human pre-authorization
  audit for `authorization-ledger-v1c-r3-arch-decision-5`'s V5 candidate (`candidateHash
  sha256:9bc6b4c3c63ffa02563d936557bfaced13e6f6251f7c0084bbd3abc01805a063`, Council `3/3 APPROVE`,
  `COUNCIL_APPROVED_PENDING_HUMAN_R3_AUTHORIZATION`). Audit result: **`HUMAN_R3_PREAUTH_NOT_READY`**
  — distinct from, and not, a Council rejection. Two material blockers: (1)
  `MATERIAL_ARCHITECTURE_BLOCKER` — `stopEpoch` increment retry/idempotency under-specified (a
  lost-ack retry has no operation identity/idempotency key/expected-epoch CAS preventing a spurious
  further increment); (2) `EVIDENCE_BLOCKER` — the terminal `DecisionRecord` formed in memory was
  not durably persisted by `runShadowExerciseWithDurableEvidence`. Nonblocking/clear: UID
  authorization CLEAR; proposer rotation NONBLOCKING_PROCEDURAL_FINDING; `CouncilQuorumProof`
  NOT_REQUIRED_FOR_THIS_GATE; Run Bundle integrity CLEAR. **CandidateDisposition:
  `SUPERSEDED_PENDING_MATERIAL_REVISION`** — Council-approved, not implementation-authorized. No
  Council rerun, no provider calls, no V1C implementation, no human approval performed. The
  finalized Run Bundle under `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v5/`
  was not modified. — `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`
- 2026-08-30 — `AUTHORIZATION-LEDGER-V1C-R3-ARCHITECTURE-DECISION-V6`: real 3-seat Shadow Council R3
  architecture exercise on `main @ f004daa5`, one frozen candidate (`candidateHash
  sha256:c5d16bea3806ff0d10b7e092f8d2240d14d68b9461aeb44c206bf7fcb2fafb90`, `councilEpochId
  authorization-ledger-v1c-r3-arch-decision-6-epoch-1`). `rotationOrdinal = 5` was fixed before any
  provider call and the frozen ADR-0005 kernel derived the proposer from
  `CouncilConfig.seats[5 % 3]` — **`seat-google`**, its first time proposing; no seat was
  hard-coded and no durable cross-run rotation state is claimed to exist. The candidate materially
  fixes V5's `MATERIAL_ARCHITECTURE_BLOCKER` via a durable privileged `admin_operation_journal`
  keyed `(authenticated_peer_uid, operation_kind, admin_operation_id)`, a domain-separated
  `requestHash`, and an expected-epoch CAS, all committed atomically with the epoch write and audit
  append — both lost-ack traces provably cannot reach `N+2`. **Votes 2/3** (`seat-openai` REJECT,
  `seat-anthropic` APPROVE, `seat-google` APPROVE); R3 requires exactly 3/3, so the kernel returned
  **`NO_QUORUM`** (`reasonCode R3_INSUFFICIENT_APPROVALS`, `recordHash
  sha256:67dc108473f16037fd7dcf3f73f6fe6293e816d197f8930847a75478e64b92f5`). The REJECT is valid and
  evidence-grounded: the candidate's `yesNoMatrix` answers 15 of the 17 required questions,
  collapsing the three distinct "CAN CODEX?" questions into one. This run is also the first real
  exercise to satisfy the PR #53 durability gate — exactly one terminal `DecisionRecord` durably
  persisted and `EvidenceManifest`-bound before `FINALIZED` — closing V5's `EVIDENCE_BLOCKER` in
  practice. Fresh read-only Codex Verifier: **`DECISION_EVIDENCE_VALID`** (14/14, both traces PASS).
  `candidateHash sha256:c5d16bea...b2fafb90` is **permanently closed for R3**; any future attempt
  needs a materially new candidate. No retry, no second candidate, no V1C implementation, no
  execution or publication authority, no human approval. —
  `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v6/`, `.project/CURRENT_TASK.md`,
  `.project/REVIEW_STATE.md`, `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`
- 2026-08-30 — `AUTHORIZATION-LEDGER-V1C-R3-ARCHITECTURE-DECISION-V7`: real 3-seat Shadow Council R3
  architecture exercise on `main @ 2e42febe`, one frozen candidate (`candidateHash
  sha256:c072d9969bede46ebfd3ab336d50ef97065a4ff08c6f17f42fe062c74671f0f8`, `councilEpochId
  authorization-ledger-v1c-r3-arch-decision-7-epoch-1`). `rotationOrdinal = 6` was fixed before any
  provider call and the frozen ADR-0005 kernel derived the proposer from
  `CouncilConfig.seats[6 % 3]` — **`seat-openai`**; no seat was hard-coded, no rotation registry was
  changed, and no durable cross-run rotation state is claimed to exist. V7 is a **narrow successor
  to V6, not a redesign**: V6's substantive architecture is reproduced unchanged (dedicated
  `authledgerd`/`mihver-ledger`, ADMIN/CLIENT socket split with reachability-only permissions,
  `SO_PEERCRED` authentication + root-owned exact-UID authorization, privileged SQLite/WAL state,
  trusted `CouncilEpochRegistry`, safe-integer `stopEpoch` domain, durable `admin_operation_journal`
  keyed `(authenticatedPeerUid, operationKind, adminOperationId)`, domain-separated `requestHash`,
  expected-epoch CAS, one `BEGIN IMMEDIATE` commit boundary, exact-bound R3 `AuthorizationGrant`,
  dormant consume-once, zero production effect consumers, no Execution Gateway). The **sole**
  material revision is the defect that actually caused V6's `NO_QUORUM`: the mandatory `yesNoMatrix`
  now answers **17 of 17** questions as 17 independently represented entries, with the
  Claude-vs-Codex pairs (`Q01`/`Q02`, `Q03`/`Q04`, `Q08`/`Q09`) uncollapsed and every answer exactly
  `NO`. Two mechanical gates enforced this ahead of any vote: a pre-provider gate asserting all 17
  questions are separately represented in the constructed packet (17/17 PASS, before the proposer
  was invoked), and a post-freeze/pre-vote gate interposed on `FREEZE_CANDIDATE` via the harness's
  `applyEventImpl` seam, which would have returned `CANDIDATE_CONSTRUCTION_BLOCKER` with zero voter
  invocations had the frozen candidate not conformed. **Votes 3/3 APPROVE** (`seat-openai`,
  `seat-anthropic`, `seat-google`); R3 requires exactly 3/3, so the kernel returned **`DECIDED` /
  `HUMAN_APPROVAL_REQUIRED`** (`reasonCode R3_QUORUM_MET`, `recordHash
  sha256:d16ae65b429648dd9e016bdb417895a881a12e2226c5c20f164a238f9c81bb21`), durably persisted and
  `EvidenceManifest`-bound before `FINALIZED`. Fresh read-only Codex Verifier:
  **`DECISION_EVIDENCE_VALID`** (18/18 criteria A–R PASS). Outcome:
  **`COUNCIL_APPROVED_PENDING_HUMAN_R3_AUTHORIZATION`** — a fresh human pre-authorization audit of
  the exact `candidateHash sha256:c072d996...4671f0f8` is still mandatory. No retry, no second
  candidate, no provider or model substitution, no V1C implementation, no execution or publication
  authority, no human approval. V5 (`sha256:9bc6b4c3...1805a063`) and V6
  (`sha256:c5d16bea...b2fafb90`) remain permanently closed; the V3/V4/V5/V6 Run Bundles were not
  modified. — `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v7/`,
  `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`,
  `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`
- 2026-08-31 — `AUTHORIZATION-LEDGER-V1C-V7-PREAUTH-CLOSURE`: strict read-only **human R3
  pre-authorization audit** of the exact V7 candidate (`candidateHash
  sha256:c072d9969bede46ebfd3ab336d50ef97065a4ff08c6f17f42fe062c74671f0f8`, `recordHash
  sha256:d16ae65b429648dd9e016bdb417895a881a12e2226c5c20f164a238f9c81bb21`). **Two separate gates,
  only the first passed.** Council: **`COUNCIL_APPROVED_PENDING_HUMAN_R3_AUTHORIZATION`** — 3/3
  APPROVE, `DecisionRecord` `state DECIDED` / `disposition HUMAN_APPROVAL_REQUIRED` / `reasonCode
  R3_QUORUM_MET`, valid and durable; **V7 is not Council-rejected**. Human pre-authorization audit:
  **`HUMAN_R3_PREAUTH_NOT_READY`**. CandidateDisposition: **`SUPERSEDED_PENDING_MATERIAL_REVISION`**.
  Three blockers: (1) **UID policy trust root — `MATERIAL_ARCHITECTURE_BLOCKER`**: the invariant is
  established but the runtime trust-root contract is not fixed (absolute policy path, trusted
  parent-directory chain, exact owner UID/GID, exact file/directory modes, no-symlink resolution,
  hard-link policy, fail-closed ownership/mode/path validation, no model-writable ancestor capable of
  replacement). (2) **`AuthorizationGrant` — `MATERIAL_ARCHITECTURE_BLOCKER`**: new R3 security
  choices left to implementers (`grantId` generation authority/format/entropy/uniqueness, issuance
  idempotency across retry/lost ACK, exact meaning of `issuanceIdentity`, whether V1C supports expiry
  and revocation and their exact semantics/authority/state/atomicity, canonical grant identity/hash
  decision, whether signatures exist and any canonical grant hash's covered fields/domain, and
  grant-issuance request identity/`requestHash`/journal semantics); no wording such as "where
  supported" may defer an R3 capability decision. (3) **`CouncilQuorumProof` — `EVIDENCE_BLOCKER`**:
  no proof is required for the human R3 gate, but `authorization-binder.mjs` later requires a valid
  eligible proof for R1/R2/R3 authorization evidence, and the V7 bundle cannot legitimately construct
  one because the contemporaneous run did not durably persist the exact `DecisionRequest` with
  `rotationOrdinal`, the exact `CouncilConfig`, its exact seat order, or `modelFamily` per seat —
  these must **not** be reconstructed retroactively and no `CONTEMPORANEOUS` proof may be
  manufactured after the run; forward-only repair is required before the next R3 architecture run and
  must not alter historical V7 evidence. Clear: `MATRIX_CONTRACT_CLEAR` (exact 17/17),
  `STOPEPOCH_DOMAIN_CLEAR`, `STOPEPOCH_IDEMPOTENCY_SATISFIED`, `ADMIN_JOURNAL_CLEAR`,
  `ADMIN_RESULT_LOOKUP_CLEAR`, `CONSUME_ONCE_IMPLEMENTATION_DETAIL_ONLY`, `UID_AUTH_CLEAR`,
  `COUNCIL_TRUST_CLEAR`, `HUMAN_APPROVAL_BINDING_CLEAR`, `ZERO_EFFECT_CONSUMER_CLEAR`,
  `SEAT_EVIDENCE_CLEAR`, `DECISION_RECORD_DURABLE`, `RUN_BUNDLE_CLEAR`,
  `HISTORICAL_INTEGRITY_CLEAR`. Primary next action: **`NEW_R3_CANDIDATE_REQUIRED`**; sequence is
  forward-only evidence repair → V8 (new `candidateHash`) → real 3-seat Council → durable
  `DecisionRecord` + contemporaneous `CouncilQuorumProof` → fresh human pre-auth audit → exact human
  R3 authorization only if `HUMAN_R3_PREAUTH_READY`. Read-only audit: no Council rerun, no provider
  invocation, no evidence reconstruction, no V1C implementation, no V8, no execution or publication
  authority, **no human approval**. The finalized V7 Run Bundle and frozen V7 candidate are
  byte-unchanged. — `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`
- 2026-08-31 — `AUTHORIZATION-LEDGER-V1C-R3-ARCHITECTURE-V8-FAILURE-CLOSURE`: persist the
  already-terminal V8 R3 architecture attempt as **historical failure evidence**. Authoritative
  classification **`COUNCIL_EVIDENCE_BLOCKER`**, proximate cause
  **`CANDIDATE_CONSTRUCTION_BLOCKER`**. **This was NOT `NO_QUORUM` and NOT a Council rejection**: no
  `CandidateDecision` was frozen, **no frozen (non-null) `candidateHash` exists for V8** (the only
  `candidateHash` field in the bundle is the failure artifact's `"candidateHash": null`), and **no
  voter was invoked**.
  Preserved facts: `decisionRequestId` `authorization-ledger-v1c-r3-arch-decision-8`,
  `councilEpochId` `authorization-ledger-v1c-r3-arch-decision-8-epoch-1`, `rotationOrdinal` `7`,
  kernel-derived proposer `seat-anthropic` (`seats[7 % 3]` over canonical order `seat-openai`,
  `seat-anthropic`, `seat-google`), pre-provider packet gate **PASS**, post-proposal/pre-vote
  construction gate **FAIL**, failure stage `KERNEL_EVENT` (`eventType FREEZE_CANDIDATE`), failure
  code `CANDIDATE_CONSTRUCTION_BLOCKER`, voter calls **0**, `DecisionRecord` **ABSENT**,
  `CouncilQuorumProof` **ABSENT**, Run Bundle **`OPEN`**, artifact count **5**. The `seat-anthropic`
  proposer invocation itself succeeded; the local post-proposal / pre-`FREEZE_CANDIDATE` mechanical
  gate falsely rejected an otherwise semantically complete proposal. **False-positive gate finding** (orchestrator finding, **not** provable
  from the persisted bundle alone — the failure artifact records only `errorCode` and `details
  {"eventType": "FREEZE_CANDIDATE"}`; the diagnostics came from the throwaway uncommitted driver's
  gate output and the judgement from reading the recovered `ShadowSeatAttestation.text`): the five
  reported construction failures were gate-definition defects, not substantive proposal omissions — the gate required semantics under specific nested candidate fields after the packet
  requirements had been shortened/reorganized to meet the packet-size bound. Known false-negative
  classes: (1) server-derived `authenticatedApproverUid` present elsewhere but demanded under
  `grantIssuanceRequest`; (2) server-derived `grantHash` present elsewhere but demanded under
  `grantIssuanceRequest`; (3) server-derived grant `state` present elsewhere but demanded under
  `grantIssuanceRequest`; (4) `IDEMPOTENCY_KEY_REUSE` required by the architecture but the gate
  depended on a literal/location removed while shrinking the packet requirements; (5) the UID policy
  correctly rejected `"unknown or extra top-level fields"` but the gate's accepted wording set failed
  to recognize that equivalent exact security semantic. The recovered proposer output is **not**
  promoted to normative architecture and is recorded only as `UNFROZEN_PROPOSAL` /
  `PROPOSAL_CONTENT_NOT_ADMITTED_AS_CANDIDATE`, recoverable solely from the persisted
  `ShadowSeatAttestation.text`. Next sequence: V8 failure evidence publication → Shadow Council
  candidate-gate reliability repair → forward-only unfrozen-proposal evidence persistence →
  deterministic tests + bounded smoke → merge → V9 new R3 `DecisionRequest` → fresh proposer / fresh
  candidate → 3-seat Council. Primary next action: **`CANDIDATE_GATE_RELIABILITY_REPAIR_REQUIRED`**;
  `NEW_R3_CANDIDATE_REQUIRED` is explicitly **not** the immediate next action because the tooling
  defect must be fixed first. No Council rerun, no provider invocation, no gate repair, no candidate
  freeze, no V9, no V1C implementation, no push, no PR, no execution or publication authority, **no
  human approval**. Every byte already inside the V8 Run Bundle is unchanged (aggregate digest
  `cfcc1502abf7dab5275d11d9a4091d535810aa9cd4a608dcf28ed2264357a70c` before and after); historical
  V3–V7 and the PR #56 smoke bundle are byte-unchanged (aggregate digest
  `46748e5f9efc9108dcaf18795064a324022100b20f33140bf9c0b70e823dedf9` before and after); no scripts,
  schemas, kernel or ADR files were modified. Deterministic validation was run and is disclosed as not
  fully green: one **pre-existing, unrelated** failure, `test:night-runner-executor`
  (`resolver lookup timeout fails closed...`), reproduces identically on a clean checkout of the base
  commit and is not repaired here. —
  `.project/run-bundles/authorization-ledger-v1c-r3-architecture-v8/`, `.project/CURRENT_TASK.md`,
  `.project/REVIEW_STATE.md`
- 2026-09-01 — `SHADOW-COUNCIL-CANDIDATE-GATE-RELIABILITY-V1`: repaired the candidate-construction
  validation architecture exposed by V8. Root cause was structural drift — a task-local mechanical
  gate held its own copy of the provider-facing requirements, the wording moved, the copy did not,
  and a sound proposal was falsely rejected. Fix establishes one canonical `CandidateRequirementSpec`
  (`scripts/dev/shadow-council-candidate-requirements.mjs`) that both the provider-facing renderer
  and the deterministic validator execute — no second, independently-maintained requirement list.
  `HARD_GATE` (deterministic, structural) and `COUNCIL_REVIEW` (prose, Council-assessed) are kept
  separate; no hard gate depends on substring/regex/synonym matching over prose. A new durable,
  non-normative `ShadowUnfrozenProposal` artifact (`scripts/dev/shadow-council-unfrozen-proposal.mjs`)
  records the parsed proposer output before candidate admission, carrying zero vote, quorum,
  `DecisionRecord`, or authorization authority; its hash is domain-separated from `candidateHash` and
  candidate authority still begins only at kernel `FREEZE_CANDIDATE`. The gate is opt-in: runs
  supplying no spec are unchanged. Implementation commit
  `8c19e6aa028e64d1d86e0e608ce66e673bc5a9c2` on `fix/shadow-council-candidate-gate-reliability-v1`
  (base `main` `3d90e0eaa9dbd65cd52112c574b1d823c598f0f8`, PR #57 merged, merge-post CI SUCCESS).
  Gates passed: Scout (thread `01a05917-4b31-7103-876c-72e5571d281c`, `NO PROTOCOL SEMANTICS CHANGE
  REQUIRED`); three remediation rounds against adversarial review closing empty-hard-gate fail-open,
  a `validateCandidateImpl` bypass, unaudited validator throws, op-inventory duplication, an
  unauthenticated-spec acceptance path, and a non-total gate-result predicate; fresh Reviewer
  (thread `01a0593f-cc37-7d81-9693-1bdc478a85b8`) verdict `READY_FOR_FINAL_VERIFICATION`; fresh
  Verifier (thread `01a05948-beb5-78b1-aec0-c042c03200ec`) verdict `READY_FOR_PUBLICATION` across 26
  checks, including that the V8-class regression proposal validates and each of its five real
  structured values independently fails the correct `requirementId` when mutated. One bounded real
  R2 smoke, `shadow-council-candidate-gate-reliability-v1-smoke`: gate **ACCEPTED**, terminal
  **`DECIDED` / `COUNCIL_APPROVED`**, Run Bundle **`FINALIZED`** with **14 artifacts**
  (`manifestHash sha256:893ba6a63817add517bfd737263bc3689988c0817f82ab2b4e82666663d579a3`),
  `candidateHash sha256:1c1de1a428a380d93123237428cb5d12cda915b02713d82bf5ec56d079f38573`,
  `unfrozenProposalHash sha256:fa4c792952d6e9e0e246a8a4a020ce4f4163deb98f4c25c5e8a9f4c395429727`
  (distinct from `candidateHash`, confirmed via separate hash domains and preimages), DecisionRecord
  `recordHash sha256:e2accd2e0f2c51000414ff3a257405cc13142ec6dd93a06fe9aba7bfaa28dd6f`, contemporaneous
  CouncilQuorumProof `proofHash sha256:30ae0a3e2309620c6ea7ef9a369d701ece45c87136b7fa8d7356c76262cf4be1`,
  `authorizationEvidenceEligible true`. No retry, no provider substitution, no second smoke; smoke
  evidence independently re-verified from bundle bytes alone by a fresh Verifier (thread
  `01a05957-8fc7-7d02-accf-3990e775303e`), verdict `SMOKE_EVIDENCE_VERIFIED`. **V8 was NOT repaired
  retroactively**: its Run Bundle remains `OPEN`, `candidateHash: null`, 5 artifacts, zero voters,
  zero `DecisionRecord`, zero `CouncilQuorumProof`, byte-unchanged; V3–V7 and the PR #56
  contemporaneous-quorum smoke bundle are likewise byte-unchanged. `scripts/dev/decision-council-kernel.mjs`,
  ADR-0005, `CouncilQuorumProof` semantics/schema, and Authorization Binder semantics are all
  unchanged. No V9 was run and no V9 matrix is hard-coded into generic library code (the 17/12
  matrices used to prove expressibility live only in this task's tests). No V1C implementation
  exists on this branch. No execution, publication, merge, or authorization authority is granted by
  anything added — the new artifact explicitly carries none. **No human approval**: not requested,
  not granted. Next sequence: candidate-gate reliability publication → merge-post CI → human
  explicitly authorizes a V9 task → V9 fresh `DecisionRequest` → new proposer invocation → new frozen
  candidate → 3-seat R3 Council → durable `DecisionRecord` → durable contemporaneous
  `CouncilQuorumProof` → fresh human pre-authorization audit. Primary next action:
  **`CANDIDATE_GATE_RELIABILITY_PUBLICATION_PENDING_HUMAN_REVIEW`**; `V9_NEW_R3_ARCHITECTURE_DECISION`
  is the next architectural action but is explicitly **not** yet authorized — no V9 task may start
  without a separate, explicit human instruction. —
  `scripts/dev/shadow-council-candidate-requirements.mjs`,
  `scripts/dev/shadow-council-unfrozen-proposal.mjs`, `scripts/dev/shadow-council-harness.mjs`,
  `scripts/dev/shadow-council-run-bundle-evidence.mjs`,
  `schemas/dev/shadow-candidate-requirement-spec.schema.json`,
  `schemas/dev/shadow-unfrozen-proposal.schema.json`,
  `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`,
  `.project/run-bundles/shadow-council-candidate-gate-reliability-v1-smoke/`,
  `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`
- 2026-09-02 — `MIHVER-ORCHESTRATOR-DELEGATION-FIREWALL-V1`: human directed durable recording of
  the completed R2 restriction-only developer control-plane hardening now present in the working
  tree: a Claude Code hook-based orchestrator delegation firewall that denies Claude MAIN direct
  repository tools, binds Codex MCP delegation to `MIHVER_DELEGATION_V1` roles, writes hash-chained
  hook receipts, and gates Stop on completed IMPLEMENTER plus fresh fingerprint-matching VERIFIER
  evidence. Six fresh adversarial review rounds closed all blocking bypasses and misleading
  diagnostics; the final verdict was `READY_FOR_FINAL_VERIFICATION`. This entry records no
  publication or activation: no commit was created, nothing was pushed, no PR exists, nothing is
  merged, and the firewall is not installed on the host. Next authorized action is human review and
  human-performed commit/push/PR. **V9 remains blocked and unauthorized** until the firewall is
  merged, post-merge CI succeeds, a human installs it, and a real enforcement smoke succeeds, in
  that order. No authority expansion and no V1C authorization. — `.project/CURRENT_TASK.md`,
  `.project/REVIEW_STATE.md`
- 2026-09-02 — `MIHVER-ORCHESTRATOR-DELEGATION-FIREWALL-V1-CI-SCOPE-REMEDIATION`: PR #59 initial
  Project validation **FAILED** due to `SCOPE_SYMLINK_BOUNDARY_CROSS_PLATFORM_DEFECT`. The
  restriction-only remediation is **COMPLETED** in the working tree, with fresh local verification
  **PASS** (40/40 firewall tests, 170/170 contract fixtures, 7/7 project-consistency checks, clean
  `git diff --check`). Publication state is `PENDING_NEW_PR_CI`; this is not a claim that PR #59 CI
  is green. A new commit must be pushed and GitHub CI must actually succeed before any green claim.
  No commit, push, merge, host installation, authority expansion, or V1C authorization occurred. —
  `.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`
- 2026-09-02 — `MIHVER-ORCHESTRATOR-DELEGATION-FIREWALL-V1-CI-SCOPE-REMEDIATION` follow-up: a fresh
  adversarial Reviewer returned `SCOPE_REMEDIATION_BLOCKER` on a malformed-absolute-cwd fail-open in
  the failed-realpath fallback. Remediation is restriction-only and **COMPLETED**: genuine
  `ENOENT`/`ENOTDIR` failures preserve the prior lexical fallback, while every other realpath failure
  is ambiguous and now remains in scope. Fresh local verification **PASS**: 42/42 firewall tests,
  170/170 contract fixtures, 7/7 project-consistency checks, clean `git diff --check`. PR #59 initial
  Project validation remains **FAILED**, cause `SCOPE_SYMLINK_BOUNDARY_CROSS_PLATFORM_DEFECT`; its
  remediation is **COMPLETED**, and publication remains `PENDING_NEW_PR_CI`. No claim that PR #59 CI
  is green; no commit, push, merge, host installation, authority expansion, or V1C authorization. —
  `tools/orchestrator-firewall/src/scope.mjs`,
  `tools/orchestrator-firewall/test/orchestrator-firewall.test.mjs`, `.project/CURRENT_TASK.md`,
  `.project/REVIEW_STATE.md`
