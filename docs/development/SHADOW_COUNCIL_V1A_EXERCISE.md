# Shadow Council V1A — CLI Harness Exercise Record

Status: **Advisory exercise record only.** This document records what actually happened when the
Shadow Council V1A CLI harness (`SHADOW-COUNCIL-V1A-LIFECYCLE-REMEDIATION`, recovering
`SHADOW-COUNCIL-V1A-CLI-HARNESS`'s quarantined technical result through compliant provenance — see
`.project/REVIEW_STATE.md`'s Process Incident) ran two real, provider-CLI-backed exercises against
the frozen, non-LLM Decision Council V1A kernel (`scripts/dev/decision-council-kernel.mjs`), which
the harness (`scripts/dev/shadow-council-harness.mjs`) imports and drives directly — the exercises
did not traverse the separate `decision-council-simulator.mjs` test-harness module, which remains a
frozen, unmodified deterministic test suite unrelated to this real-exercise path. This document
grants no authority: no `DecisionRecord` produced here caused, or may in future be read as
authorizing, any repository mutation, publication, merge, tool execution, or autonomous task
transition. `ADR-0005`'s Status remains **Proposed**; this document does not change it. See
`docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`'s Acceptance Gate section for the criteria this
exercise is evidence toward, and `docs/development/RUN_BUNDLE.md` for the Run Bundle this evidence
is planned to be bound into once generated (see "Independent review and verification" below for its
status as of this document's writing).

## Repository / task identity

- Base branch: `main` @ `2fae893d89c8debded14fb7ba23adfcad2055133`
- Task branch: `feat/shadow-council-v1a-cli-harness-remediated`
- `repositoryHead` bound by both exercises: `2fae893d89c8debded14fb7ba23adfcad2055133` (identical —
  no commit exists on this branch at the time either exercise ran)
- Council epoch: `shadow-council-v1a-remediated-epoch-1`
- Both exercises were launched by the human operator, one command each, exactly once, per
  `.project/CURRENT_TASK.md`'s "Human action required next" section.

## Seat cohort (real, independently spawned CLI child processes)

| Seat | Provider | CLI | CLI version | Requested model | Executable realpath |
|---|---|---|---|---|---|
| `seat-openai` | openai | `codex` | `codex-cli 0.149.0` | `gpt-5.6-sol` | `/Users/ev/.codex/packages/standalone/releases/0.149.0-aarch64-apple-darwin/bin/codex` |
| `seat-anthropic` | anthropic | `claude` | `2.1.251 (Claude Code)` | `claude-opus-5` | `/Users/ev/.local/share/claude/versions/2.1.251` |
| `seat-google` | google | `agy` | `1.1.22` | `gemini-3.7-flash-medium` | `/Users/ev/.local/bin/agy` |

Each seat ran as its own child process, with a minimal explicit child environment of exactly
`{PATH, HOME, USER}` (no other variable forwarded). Every attestation records
`observedToolUsage: []` and `exitCode: 0`.

## Exercise 1 — `shadow-exercise-remediated-r1-1` (R1, all 3 seats vote)

- Proposer seat (`rotationOrdinal: 0`, deterministic): `seat-openai`
- Decision question (advisory-only fixture, explicitly framed to the seat as having zero effect on
  any real MIHVER document/merge/repository action): whether MIHVER's future internal documentation
  style guidance should prefer the Oxford comma.
- `contextHash`: `sha256:77112af6e80b65e313913a970f6853c9cf4de5b1b94df28db78740f0b7981430`
- `repositoryHead`: `2fae893d89c8debded14fb7ba23adfcad2055133`
- `candidateHash`: `sha256:b7df378ac69e96534a9abd661749af741e3c1008838dd2c2cd4fb6ff602a8583`
- Votes: `seat-openai` APPROVE, `seat-anthropic` APPROVE, `seat-google` APPROVE
- `quorumDetail`: `{ruleset: "R1", approvals: 3, distinctProviderModelFamilies: 3}`,
  `reasonCode: R1_QUORUM_MET`
- `DecisionRecord.state`: `DECIDED`; `disposition`: `COUNCIL_APPROVED`
- `recordHash`: `sha256:090171b1beca5d8f46fe089d3f29829b431a2c898ac10ce9e976a0fe888f503a`
- Real primary-model calls: **4** (1 proposal + 3 votes), all admitted, 0 rejected, 0 retried
- Full sanitized record: `.project/run-bundles/shadow-council-v1a-cli-harness-remediated/evidence/exercise-r1.json`
  (raw-byte `sha256:f5fce317a6a403767ed0746b2e7413714016e00def31d3d3c3e8912571bb3464`)

## Exercise 2 — `shadow-exercise-remediated-r2-1` (R2, 2 reviewer seats only)

- Proposer seat (`rotationOrdinal: 1`, deterministic and known before execution): `seat-anthropic`
  — excluded from voting per R2 semantics, recorded as `MISSING` in the `DecisionRecord`, not
  counted toward quorum; the harness's `PROPOSER_CANNOT_VOTE` guard would have rejected any attempt
  to include it.
- Decision question (advisory-only fixture, same framing): whether MIHVER's future internal
  documentation style guidance should recommend wrapping prose at 100 columns under
  `docs/development/`.
- `contextHash`: `sha256:d2c9228d2b64439cf3233f3e296cd75cbc120a429d8ce929139ad77503d15d07`
- `repositoryHead`: `2fae893d89c8debded14fb7ba23adfcad2055133`
- `candidateHash`: `sha256:09da78279a1d2a3ffb3c97926cbbdbfd7b95f7c442b6fa783118a917753c4fb6`
- Votes: `seat-openai` APPROVE, `seat-anthropic` MISSING (proposer, did not vote), `seat-google`
  APPROVE
- `quorumDetail`: `{ruleset: "R2", reviewerApprovals: 2}`, `reasonCode: R2_QUORUM_MET`
- `DecisionRecord.state`: `DECIDED`; `disposition`: `COUNCIL_APPROVED`
- `recordHash`: `sha256:a64c60c0ebd7412331fb8df0219cc2cc5d4e60c3673240fee1842623c00a198a`
- Real primary-model calls: **3** (1 proposal + 2 reviewer votes), all admitted, 0 rejected, 0
  retried
- Full sanitized record: `.project/run-bundles/shadow-council-v1a-cli-harness-remediated/evidence/exercise-r2.json`
  (raw-byte `sha256:205abef4bdeedd96dced6ca4be1b18dae35df4e295ec19ac3b9a07a46327a663`)

## Call budget

Target per the task: R1 = 4, R2 = 3, total = 7. Hard maximum 8. **Actual: exactly 7**, with zero
retries and zero provider/model substitution across both exercises. Each human-launched command ran
its full straight-through pass exactly once; no seat's real vote or proposal was ever regenerated.

## `contextHash` drift between R1 and R2 (disclosed operational limitation)

R1 and R2 bind two **different** `contextHash` values even though both bind the identical
`repositoryHead` (`2fae893…`, no commit exists on this branch). Cause, confirmed by direct
inspection: Exercise 1's command wrote its sanitized output file
(`.../evidence/exercise-r1.json`) into the working tree as its final step; Exercise 2's command,
run afterward, compiled its own live `ProjectContextPack` and observed that new untracked file as
part of the current working-tree state, producing a different `contextHash` than Exercise 1 saw.
This is a **disclosed operational/evaluation limitation of running two paired exercises
sequentially against a live, mutating working tree**, not a protocol or kernel defect: each
exercise's `DecisionRequest.contextHash` was independently valid for the context that actually
existed at the moment that exercise ran (`createSession` verified this via its own
`CONTEXT_HASH_MISMATCH`/`REPOSITORY_HEAD_MISMATCH` fail-closed checks, which both exercises passed
against their own live pack), and `repositoryHead` — the actual Git commit basis — was identical
for both. This document does **not** claim the two exercises ran against one identical
`ProjectContextPack`; each exercise's own `contextHash` is recorded above and inside its evidence
file, and remains the authoritative identity for that exercise. A future paired-evaluation task may
choose to stage evidence output outside the subject working tree, or pre-pin one shared evaluation
context, to avoid this drift — not attempted here, since redesigning the harness for this was out
of this task's scope.

## Attestation summary

All 7 counted seat invocations produced an admitted `ShadowSeatAttestation`
(`schemas/dev/shadow-seat-attestation.schema.json`): `exitCode: 0`, `observedToolUsage: []` for
every call, and executable identity confirmed stable per seat within each exercise
(`assertStableExecutableAcrossRun`). The Anthropic CLI reported a full `modelUsage` set including
both the requested primary (`claude-opus-5`) and an internal auxiliary model
(`claude-haiku-4-5-20251001`) on both of its calls — expected and not treated as substitution, since
the requested model was present and the substitution check is based solely on `modelUsage`'s own
keys. The `codex` and `agy` CLIs reported no per-model usage breakdown or model identifier at all
(`reportedModelId: null`, `modelUsage: {}`) on every call — recorded as "unavailable," never
fabricated as confirmation, per this task's requirement not to claim stronger provider/model-origin
proof than the CLI actually supplies. All hashes (`candidateHash`, `DecisionRecord.recordHash`, and
every `attestationHash`) were independently recomputed by Claude directly from the raw exercise
JSON files using the real, unmodified `decision-council-kernel.mjs` and
`shadow-council-attestation.mjs` primitives, and matched the values recorded in each file exactly —
not merely trusted from the harness's own printed summary. A grep for credential-shaped strings
(API keys, PEM headers, `Authorization:`/`Bearer` values) across both exercise files found none.

## Independent review and verification

- **Implementation Reviewer** (fresh `mcp__codex__codex`, read-only, independent,
  `01a04d88-2edc-7981-bf99-f9826583884a`) — two rounds during `SHADOW-COUNCIL-V1A-LIFECYCLE-REMEDIATION`'s
  implementation phase: Round 1 found 2 real defects (shallow-frozen `SEAT_ADAPTERS` nested
  objects; a `reportedModelId` union loophole in the substitution check), both fixed; Round 2
  **APPROVED**. Full detail in `.project/REVIEW_STATE.md`.
- **Implementation Verifier** (fresh `mcp__codex__codex`, `workspace-write`, independent,
  `01a04e53-4986-7c13-a036-45258ca6428d`) — 19-point check, **ALL CHECKS PASS**, including zero
  real provider calls made during implementation/verification.
- **Post-exercise adversarial Reviewer** (fresh `mcp__codex__codex`, read-only, independent,
  `01a04f65-590d-7db3-a7b7-7b23dc676f3d`) — independently recomputed both candidate hashes, both
  `DecisionRecord.recordHash` values, and all 7 `attestationHash` values directly from the raw
  exercise files; confirmed the exact kernel event sequence (`SUBMIT_COMMITMENT` →
  `REVEAL_PROPOSAL` → `FREEZE_CANDIDATE` → `CAST_VOTE`(×N) → `FINALIZE`) was traversed with no
  shortcut; found no credential material; found the `contextHash` difference between R1 and R2 to
  be an operational evaluation limitation, not a protocol-integrity failure; found **no
  `PROTOCOL_REDESIGN_BLOCKER`**; flagged two now-corrected wording issues in this document. Full
  per-criterion ADR-0005 Acceptance Gate table in `.project/REVIEW_STATE.md`.
- **Final Verifier**, for this finalization task's own suites/Run Bundle/state integrity once the
  Run Bundle is generated: see `.project/REVIEW_STATE.md`'s Latest Review section for its thread,
  results, and the final per-criterion adjudication (criterion 5 depends on the Run Bundle actually
  existing, which this finalization task produces after this document was first drafted).

## Advisory rationale evidence and Run Bundle integration

`AgentVote` remains the normative ADR-0005 quorum artifact, completely unchanged. A
`ShadowVoteAssessment` and its rationale are Shadow-Council-only **ADVISORY** evidence. They never
influence quorum, `candidateHash`, `DecisionRecord.recordHash`, risk classification, or
authorization eligibility. This separation is mechanically demonstrated by the harness tests: two
runs with identical votes and different rationale text produce byte-identical `DecisionRecord`s.

The rationale is a concise decision-grounds string, explicitly **not chain-of-thought**. A caller
may persist each assessment as canonical JSON under a Run Bundle's `evidence/` directory and bind
the file through an `EvidenceManifest` entry with `kind: "ARTIFACT"`, `action: "present"`, `path`,
`sourcePath`, and the raw-file-byte `contentHash`. That content hash is distinct from the
domain-separated `assessmentHash`. Human operators may inspect this persisted advisory evidence
after the fact to diagnose a `NO_QUORUM`, `REJECT`, or `ABSTAIN` outcome; inspection does not give
the rationale any normative or authorization effect.

The two real R1/R2 exercises recorded above predate this capability and remain historical exactly
as originally recorded; their rationales are not retroactively reconstructed. The later real R3
Authorization-Ledger-V1C-architecture exercise also remains historical: it ended `NO_QUORUM`, and
`seat-openai`'s rationale for its `REJECT` vote was never durably recorded and is irrecoverably
lost. This document does not invent or imply what that rationale was. That evidence gap is exactly
why durable `ShadowVoteAssessment` evidence and Run Bundle binding were added.

## Incremental failure-path evidence

PR #47 added durable rationale evidence. A subsequent real V1C R3 exercise attempt (V2) hit
`MALFORMED_SEAT_OUTPUT` and exposed that failure-path evidence was not durable.
`SHADOW-COUNCIL-FAILURE-EVIDENCE-V1` therefore adds durable, incrementally written
`ShadowSeatInvocationFailure` evidence, together with the packet, attestation, and assessment
artifacts completed before a failure, so a future failed exercise is forensically diagnosable. The
failed V1C attempt is not reconstructed or reinterpreted: the lost evidence does not establish
which seat failed or why, and this record does not invent either fact.

Incremental writes leave the Run Bundle `OPEN` unless the caller explicitly requests finalization.
An OPEN bundle can accept later diagnostic evidence, but its `TaskRecord` is immutable: an initial
`IN_PROGRESS` disposition cannot later be changed to `BLOCKED` in the same bundle.

## Exercise 3 — `shadow-vote-rationale-smoke-1` (R1 smoke test, all 3 seats vote, rationale contract)

Real, bounded smoke exercise for `SHADOW-COUNCIL-VOTE-RATIONALE-V1B`, proving the new
`{voteValue, rationale}` reviewer contract works end-to-end with all three real CLI adapters and
produces durable rationale evidence — not a V1C architecture retry, no semantic retry, no provider
substitution.

- Base branch: `main` @ `2c87a5780e81e832d9074dd2b74401b8a0caf2e6`
- Task branch: `feat/shadow-council-vote-rationale-v1b`
- Council epoch: `shadow-council-vote-rationale-smoke-epoch-1`
- `contextHash`: `sha256:9170696138d2126f8048ff8a22b44dd4256c1c36a55161a5fed7425c51d17f72`
- `repositoryHead`: `2c87a5780e81e832d9074dd2b74401b8a0caf2e6`
- Decision question (advisory-only, harmless synthetic fixture, explicitly framed as having zero
  effect on any real MIHVER document/merge/repository action): whether MIHVER's internal Markdown
  style guidance should prefer sentence-case or title-case headings.
- Proposer (`rotationOrdinal: 0`, deterministic): `seat-openai`
- `candidateHash`: `sha256:8a4710dc1b3fe1b5161ae25d5fdb0a299df553c2f33a2eb896e05a2c2c905cbe`
- Votes: `seat-openai` APPROVE, `seat-anthropic` APPROVE, `seat-google` APPROVE — `DECIDED` /
  `COUNCIL_APPROVED`, `recordHash`: `sha256:c6e7d8252da9a08a17c0f33643e533aec881a85cc9ff18fd37ac265648e3b1d9`
- Every one of the three real reviewer calls returned a valid `{voteValue, rationale}` JSON payload
  on the first attempt — no provider violated the new contract, so no
  `PROVIDER_RESPONSE_CONTRACT_BLOCKER` occurred. Each seat's `ShadowVoteAssessment` (concise,
  on-topic decision grounds, none resembling chain-of-thought) was durably persisted as canonical
  JSON evidence and bound into a finalized Run Bundle at
  `.project/run-bundles/shadow-council-vote-rationale-v1b-smoke/` (`evidence-manifest.json`,
  `run-manifest.json`, `task-record.json`, plus one evidence file per seat under `evidence/`) via
  `runShadowExerciseWithEvidence`. The persisted rationale for each seat is readable directly from
  those files with no live process required — the exact gap this task exists to close.
- This exercise's success criterion was durable `{voteValue, rationale, assessmentHash,
  attestation/output binding}` evidence per seat, not a particular vote outcome.

## Durable invocation-failure evidence (`SHADOW-COUNCIL-FAILURE-EVIDENCE-V1`)

PR #47 (above) landed rationale evidence for successful votes. A subsequent real R3 V1C-architecture
exercise attempt (`authorization-ledger-v1c-r3-arch-decision-2`, V2) then hit `MALFORMED_SEAT_OUTPUT`
mid-voting when a real seat's response didn't parse into `{voteValue, rationale}` — and because the
evidence writer only persisted data after the whole exercise returned successfully, that entire
exercise's forensic evidence (which seat failed, at what stage, why structurally) was silently lost.
**That failed exercise attempt is not reconstructed or reinterpreted here** — this document does not
claim to know which seat failed, at what stage, or why; that is exactly the information that was
lost, before this capability existed.

This task (`SHADOW-COUNCIL-FAILURE-EVIDENCE-V1`) adds a Shadow-Council-only, advisory
`ShadowSeatInvocationFailure` artifact (`scripts/dev/shadow-council-invocation-failure.mjs`) plus
synchronous harness hooks (`onPacketBuilt`/`onAttestationAdmitted`/`onAttestationRejected`/
`onAssessmentBuilt`/`onInvocationFailure`) so every stage of a real seat invocation — packet built,
attestation admitted or rejected, assessment built, or a classified failure (`SPAWN`,
`INVOCATION_CONFIG`, `PROVIDER_ENVELOPE_PARSE`, `ATTESTATION_BUILD`, `ADMISSION`,
`SHADOW_RESPONSE_JSON_PARSE`, `SHADOW_RESPONSE_SHAPE`, `ASSESSMENT_VALIDATION`, `VOTE_DERIVATION`,
`KERNEL_EVENT`, or `RUN_POSTCONDITION`) — is durably written to a Run Bundle as it happens, not only
after a successful return. A failed exercise's Run Bundle stays `OPEN` (never finalized) and preserves
every already-completed seat's evidence up to the point of failure; no `DecisionRecord` is ever
fabricated for an incomplete/failed exercise. Raw provider stdout/stderr text is never persisted —
only hashes and byte lengths — matching the existing rationale-evidence discipline of never
persisting hidden reasoning or arbitrary raw model output.

### Exercise 4 — `shadow-failure-evidence-smoke-1` (R1 smoke test, durable invocation journal)

Real, bounded smoke exercise proving the new durable per-stage evidence journal works end-to-end on
NORMAL, successful responses from all three real CLI adapters (the negative/failure path is proven
deterministically with injected fixtures in the test suite — this smoke exercise does not
deliberately provoke a provider to misbehave).

- Base branch: `main` @ `1803198...` (`feat/shadow-council-failure-evidence-v1`)
- Council epoch: `shadow-council-failure-evidence-smoke-epoch-1`
- `repositoryHead`: `18031989a895a6a85b1b34a9867247a680da9176`
- Decision question (advisory-only, harmless synthetic fixture): whether MIHVER's internal Markdown
  style guidance should prefer the Oxford comma in prose lists.
- Proposer (`rotationOrdinal: 0`): `seat-openai`
- `candidateHash`: `sha256:8be2de7d8e5dbfc5402f8b3f1e0ef329f847db9cf5b9e7ac56350109c12b38f5`
- Votes: `seat-openai` APPROVE, `seat-anthropic` APPROVE, `seat-google` APPROVE — `DECIDED` /
  `COUNCIL_APPROVED`, `recordHash`: `sha256:4c5ddc5171cc1383f6f60e4b4832e47d762173ed75aa059dde7f3a8f3f0c22c5`
- Every real seat call produced durable, per-hook evidence exactly as designed: 11 evidence entries
  total (4 packets and 4 attestations — the proposer seat has both a proposal and a vote
  packet/attestation — plus 3 vote assessments), all written incrementally and finalized into a
  Run Bundle at `.project/run-bundles/shadow-council-failure-evidence-v1-smoke/`. No invocation
  failure occurred, so no `ShadowSeatInvocationFailure` evidence was produced by this exercise — the
  negative path remains proven only by the deterministic test suite, per this task's own instruction
  not to deliberately prompt a provider to misbehave.

### Exercise 5 — reviewer-output reliability hardening (`SHADOW-COUNCIL-REVIEWER-OUTPUT-RELIABILITY-V1`)

The real 3-seat R3 architecture exercises for the V1C Authorization Ledger design
(`authorization-ledger-v1c-r3-architecture-v3` and `-v4`, see
`.project/run-bundles/authorization-ledger-v1c-r3-architecture-v3/` and `-v4/`) both independently
exposed the same repeated reviewer-output failure: `seat-anthropic` returned a structurally valid,
exact-shape reviewer response (`voteValue` + `rationale`), but its `rationale` exceeded the
1200-character hard acceptance ceiling enforced in
`scripts/dev/shadow-council-vote-assessment.mjs`. `ASSESSMENT_VALIDATION` correctly failed closed
both times, and the durable per-stage invocation-failure evidence worked exactly as designed in both
cases — no vote was fabricated, no output was repaired, and no retry occurred. V4 additionally
carried an outer task-level instruction suggesting a rationale of at most ~900 characters, but that
instruction was never rendered into the real seat packet/prompt (`renderPacketPrompt` only ever
built the reviewer prompt from `packet.decisionQuestion` and `packet.evidence`), so the model never
actually saw any length guidance beyond the bare "at most 1200 characters" ceiling itself.

This task (`SHADOW-COUNCIL-REVIEWER-OUTPUT-RELIABILITY-V1`) strengthens the canonical reviewer
prompt rendered by `renderPacketPrompt` in `scripts/dev/shadow-council-packet.mjs` to add an explicit
generation-budget instruction — target roughly 500 characters, generate no more than 600 characters —
with per-`voteValue` guidance on what counts as concise decisive content (APPROVE: the decisive
reason plus at most one caveat; REJECT: at most two decisive blockers; ABSTAIN: the decisive
information/authority deficiency only). The existing 1200-character / 4096-UTF-8-byte hard acceptance
ceiling is **unchanged** and remains independently enforced by the parser/builder — the generation
budget is advisory prompt guidance only, not a new acceptance rule. Rationale remains advisory
evidence: it has zero effect on `voteValue`, quorum, `candidateHash`, or `DecisionRecord.recordHash`,
and no historical Council decision (including V3's REJECT or V4's failure) is reinterpreted by this
task.

A single harmless, real, reviewer-contract-compliance smoke was then run (fallback shape: 1 proposer
call + 3 reviewer calls, no retries, no provider substitution) against a synthetic frozen candidate
with a deliberately non-trivial, multi-trade-off decision question, so reviewers had to prioritize
decisive grounds rather than reply "looks good." All three seats produced valid strict two-field JSON
on the first call: `seat-anthropic` APPROVE at 587 characters, `seat-openai` APPROVE at 475
characters, `seat-google` APPROVE at 345 characters — all comfortably under the new ~600-character
generation budget and far under the unchanged 1200-character hard ceiling. This is the first time
`seat-anthropic` has passed a real reviewer invocation on its first call after two consecutive
real-exercise failures. Evidence is persisted and finalized at
`.project/run-bundles/shadow-council-reviewer-output-reliability-v1-smoke/`. This smoke is evidence
of reviewer-output reliability only; it is not a Council architecture decision and grants zero
execution or V1C implementation authority.

## Advisory-only confirmation

Nothing in this exercise, this harness, or its two `DecisionRecord`s grants execution, publication,
merge, or autonomous task-transition authority. Both `DecisionRecord`s carry
`disposition: COUNCIL_APPROVED`, which under the existing frozen kernel semantics is itself just a
typed evidence value, not a self-executing instruction — see `scripts/dev/decision-council-kernel.mjs`
(unmodified by this task) and `ADR-0005`'s own authority boundary. `ADR-0005` Status remains
**Proposed**. This exercise does not decide whether `SHADOW-COUNCIL-V1A-CLI-HARNESS` or
`SHADOW-COUNCIL-V1A-LIFECYCLE-REMEDIATION` should be merged.

## Residual trust limitations

- One parent harness process (the Claude Code orchestrator, on this machine) controlled all three
  child-process launches for both exercises. The seat-origin boundary enforced by
  `attestSeatOriginRegistry`/`checkAdmission`/`assertStableExecutableAcrossRun` proves local
  runtime/process separation between seat adapters, not cryptographic provider non-collusion — the
  same limitation stated verbatim in every `ShadowSeatAttestation.residualTrustLimitation` field.
- `codex` and `agy` provide no machine-readable confirmation of which underlying model actually
  answered; `requestedModelId` is recorded, `reportedModelId` is honestly recorded as unavailable
  (`null`) rather than assumed.
- `agy`'s JSON output exposes no tool-call field, so its `observedToolUsage` is structurally always
  `[]` — a real observability gap, not a claim that no tool was used.
- A real child process's pid is not observable via `execFileSync` on a successful call;
  `childProcessId` records `0` as a sentinel in that case, not a genuine pid.
- R1 and R2 bind two different `contextHash` values (see above) due to the working tree mutating
  between the two sequential human-launched runs — a disclosed evaluation-methodology limitation,
  not a protocol-integrity failure, since `repositoryHead` and each exercise's own internal
  consistency were independently verified.
