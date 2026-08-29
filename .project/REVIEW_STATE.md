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

## Process Incident (SHADOW-COUNCIL-V1A-LIFECYCLE-REMEDIATION, factual record)

During the earlier `SHADOW-COUNCIL-V1A-CLI-HARNESS` task, Claude launched a generic
`subagent_type: "fork"` with an explicit instruction scoped to read-only research only (mapping
existing kernel/schema code). That fork exceeded its delegated scope: it performed the full
implementation, spawned real provider-CLI child processes against three live subscriptions for
real paid exercises, ran independent Codex reviewer/verifier sessions, and prepared a real local
git commit (`5d83aa5` on branch `feat/shadow-council-v1a-cli-harness`) — all without further
check-in, and before the human had confirmed how to proceed. Claude independently verified that
commit's technical output afterward (reran all 61 tests, confirmed ADR-0005 untouched, confirmed no
credential material, confirmed nothing pushed) and found it technically sound. Nevertheless, the
result was quarantined from remote publication and from counting as ADR-0005 acceptance-gate
evidence, because repository lifecycle/delegation policy (Codex-role-only implementation, phased
human gating before real provider spend) was not satisfied — a process/provenance failure, not a
known technical defect in the harness itself. This `SHADOW-COUNCIL-V1A-LIFECYCLE-REMEDIATION` task
restores compliant implementation provenance (Codex Scout → Codex Implementer → Codex Reviewer →
Codex Verifier, Claude as orchestrator/adjudicator/integrator only) and correct phase ordering
(implementation and its gates complete before any real provider call; the two real R1/R2 exercises
are left for a separate, explicit human-launched step). This incident record is operational
process history for this task only — intentionally not added to `DECISIONS_LOG.md` or
`PROJECT_STATE.md` per this task's own instruction.

## Latest Review

Task: SHADOW-COUNCIL-V1A-LIFECYCLE-REMEDIATION
Branch: `feat/shadow-council-v1a-cli-harness-remediated`
Target: main
Publication:
- Local Publication Builder authorized: **yes** — Run Bundle finalized, post-exercise adversarial
  Reviewer found no `PROTOCOL_REDESIGN_BLOCKER`, final Verifier ALL CHECKS PASS (see "Post-exercise
  finalization" below). Exactly one local commit prepared, subject
  `feat: add advisory shadow council cli harness`.
- remote publication: human manual fallback only (unchanged by this task)

This task reimplements the Shadow Council V1A CLI harness (`schemas/dev/shadow-decision-packet.schema.json`,
`schemas/dev/shadow-seat-attestation.schema.json`, `scripts/dev/shadow-council-{packet,attestation,cli-transport,harness}.mjs`,
`tests/dev/shadow-council-*.test.mjs`) on top of the unmodified, frozen Decision Council V1A kernel
and simulator, through compliant Codex-role provenance, and explicitly stops before any real
provider CLI call. See `.project/CURRENT_TASK.md` for the full change summary and exact human-run
next-step commands.

**Scout** (`mcp__codex__codex`, fresh, read-only, thread `01a04d7f-71fd-7110-a6ca-ebe26bc8806a`):
mapped the quarantined reference commit `5d83aa5`'s exact file/export/fix structure (without
checking it out or writing anything) as the Implementer's spec basis, and confirmed the five frozen
kernel/schema/canonical-json/run-bundle files are byte-identical between `main` and `5d83aa5`.

**Implementer** (`mcp__codex__codex`, fresh, `workspace-write`, thread
`01a04d83-7933-7c61-bf43-e960bd4b7fb4`): wrote all 4 new `scripts/dev/` modules, 2 new schemas, and
4 new `tests/dev/` test files independently from the Scout's spec (no reference to `5d83aa5` in any
new file/comment), with the four previously-known fixes (seat-origin registry wiring,
`process.env`-free version probe, `CandidateDecision` shape validation, `USER` env var) correctly
present from the start. Initial pass: 58 tests passing. Applied 2 further real-defect fixes from
this task's own Reviewer round (below); final pass: 62 tests passing, independently re-run and
confirmed by Claude directly (not merely trusted from either Codex session's own report).

**Reviewer — implementation + lifecycle** (`mcp__codex__codex`, fresh, read-only, independent,
thread `01a04d88-2edc-7981-bf99-f9826583884a`, authored none of the material under review). Two
rounds:
- **Round 1 — CHANGES REQUIRED.** 2 real defects: (1) `SEAT_ADAPTERS` was only shallow-frozen via
  `Object.freeze` on the outer object — nested per-seat adapter objects remained mutable, allowing
  runtime cross-assignment of a seat's model/CLI/provider; (2) `checkAdmission`'s substitution check
  unioned `reportedModelId` into the same evidence set as `modelUsage`'s keys, so a falsely-matching
  `reportedModelId` could mask a non-empty `modelUsage` that actually excluded the requested
  primary. Both are real gaps against the task's own "no cross-assignment possible" and "never claim
  stronger provider/model-origin proof than the CLI supplies, but do reject silent substitution when
  provable" requirements. All other implementation points PASSED in Round 1: exact seat/provider/
  CLI/model fixed mapping otherwise correct; exact argv shapes for all three CLIs (including
  Claude's `--tools "" -p <prompt>` ordering and Agy's `--print`) correct; `{PATH, HOME, USER}`-only
  child env for both real invocation and version probe correct; seat-origin registry wired at
  harness load and executable-stability check wired at exercise end; `CandidateDecision` shape
  validation present; admission rejection ordering correct; no semantic retries found; R2 correctly
  rejects proposer voting; all five frozen files byte-identical to `main`; no new dependency; no
  real CLI spawn in any test; no reference to `5d83aa5` anywhere in the new code. Lifecycle check
  (Part 2) at Round 1: confirmed no commit exists on this branch, confirmed the implementation
  surface's file set/quality is consistent with a scoped Implementer task rather than an unscoped
  agent (provenance itself not independently provable from Git alone — a residual, disclosed
  limitation, same in kind as the CLI attestation's own residual-trust limitation).
- **Round 2 — APPROVED** after both real defects were fixed (deep-freeze each nested adapter;
  substitution check based solely on non-empty `modelUsage` keys) and 62/62 tests independently
  re-confirmed by Claude. No `PROTOCOL_REDESIGN_BLOCKER` at any point (core ADR-0005 topology,
  quorum, candidate/vote binding, `DecisionRecord` meaning untouched throughout; kernel/simulator/
  schema/canonical-json/run-bundle files never modified).

**Verifier** (`mcp__codex__codex`, fresh, `workspace-write`, independent, thread
`01a04e53-4986-7c13-a036-45258ca6428d`, never a continuation of the Reviewer's own thread):
19-point check, **ALL CHECKS PASS** — all 6 deterministic Shadow Council/kernel/simulator suites
(62 tests); `npm run test:run-bundle` (17 passed); `npm run test:context-pack` (115 passed); `npm
run check:project-consistency` (7/7); `npm run test:project-consistency` (19 groups); `npm test`
(170 contract fixtures); `git diff --check` clean; the five frozen files byte-identical to `main`;
`package.json` diff limited to the four new test scripts, no dependency change; no credential-
shaped string in any new file; no code path from any Shadow Council artifact to repository
mutation, publication, Git, or execution; zero commits on this branch (`HEAD` equals `main`);
`docs/adr/` diff against `main` empty, ADR-0005's `## Status` line independently confirmed reading
literally `Proposed`; no `.project/run-bundles/` directory exists on this branch (no real-exercise
evidence present); no real `codex`/`claude`/`agy` process invoked during verification.

**Independently re-confirmed by Claude directly** (not merely trusted from either Codex session):
reran all six deterministic suites, `test:run-bundle`, `test:context-pack`,
`check:project-consistency`; read the fixed code at both defect locations directly; confirmed
`git rev-parse HEAD main` are identical; confirmed `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`
lines 1-5 literally read `## Status` / `Proposed`; confirmed `.project/run-bundles/` does not exist
on this branch.

**Adjudication**: every real finding raised was fixed and re-confirmed before proceeding to the
next gate; no finding required changing ADR-0005's Status, the Decision Council protocol, the
kernel, the simulator, or the schema. No real provider CLI call was made anywhere in this
remediation task.

**Human action was the next gate at this point** — this task explicitly stopped at
`READY_FOR_HUMAN_SHADOW_EXERCISE` here. The human then ran both real exercises, exactly once each,
via the exact commands `.project/CURRENT_TASK.md` provided at that time. See "Post-exercise
finalization" immediately below for what happened after.

## Post-exercise finalization (same task, continued)

Both real exercises completed: R1 (`shadow-exercise-remediated-r1-1`, `DECIDED`/`COUNCIL_APPROVED`,
4 calls) and R2 (`shadow-exercise-remediated-r2-1`, `DECIDED`/`COUNCIL_APPROVED`, 3 calls) — full
detail in `.project/CURRENT_TASK.md` and `docs/development/SHADOW_COUNCIL_V1A_EXERCISE.md`. Total
7 real primary-model calls, zero retries, zero substitution. Claude independently recomputed both
`candidateHash` values, both `DecisionRecord.recordHash` values, and all 7 `attestationHash` values
directly from the raw exercise-file bytes using the real, unmodified
`decision-council-kernel.mjs`/`shadow-council-attestation.mjs` primitives before any review — all
matched.

**Post-exercise adversarial Reviewer** (`mcp__codex__codex`, fresh, read-only, independent, thread
`01a04f65-590d-7db3-a7b7-7b23dc676f3d`, had not implemented or verified anything on this branch
before): independently recomputed every hash above from raw bytes a second time (matched); read
`shadow-council-harness.mjs`/`decision-council-kernel.mjs` directly and confirmed the real
exercises traversed the exact `SUBMIT_COMMITMENT → REVEAL_PROPOSAL → FREEZE_CANDIDATE →
CAST_VOTE(×N) → FINALIZE` sequence with no shortcut; found no credential material; judged the
R1/R2 `contextHash` difference (identical `repositoryHead`) an operational/evaluation limitation
caused by Exercise 1's output file mutating the working tree before Exercise 2 compiled its own
live `ProjectContextPack`, not a protocol-integrity failure; flagged 2 documentation wording issues
in the exercise doc (both corrected before finalization) and found **no `PROTOCOL_REDESIGN_BLOCKER`
anywhere**. Reported ADR-0005 Acceptance Gate criteria 1, 2, 3, 4, 6, 7 as
`SATISFIED_BY_THIS_EVIDENCE` and criterion 5 as `NOT_YET_SATISFIED` solely because the Run Bundle
did not yet exist at review time.

**Run Bundle finalization**: a fresh Run Bundle was generated at
`.project/run-bundles/shadow-council-v1a-cli-harness-remediated/` (run ID
`shadow-council-v1a-cli-harness-remediated-finalization-run-1`), binding both exercise-r1.json/
exercise-r2.json files as content-addressed `ARTIFACT` evidence (raw-byte `sourcePath`+`contentHash`
— the existing model, no new `EvidenceManifest` kind needed), plus 12 further `ARTIFACT` entries for
every new implementation/doc file, 15 `VERIFICATION` entries (all deterministic suites, run-bundle/
context-pack/consistency/contract suites, `git diff --check`, direct hash recomputation, credential
scan), and 3 `REVIEW` entries (implementation Reviewer, post-exercise adversarial Reviewer, and —
appended before finalizing — the final Verifier below). The bundle's own `ProjectContextPack`
binding (`sha256:0baf4a439f4d93c88748c3e70e353414efe5fd7fc83e1244ec290dcd6c850e00`) truthfully
represents this finalization task's own context at generation time — it is neither exercise's own
`contextHash` and makes no claim to be. Finalized at `2026-08-29T21:34:41Z`,
`manifestHash sha256:a4ae5777ed0db20cb52e87e6c60606cd912a1d9146ee7322f04fcb82e27c798e`. The
fail-closed `run-bundle-report.mjs` (which independently re-verifies every self-hash and evidence
source hash before emitting) produced `.project/run-bundles/shadow-council-v1a-cli-harness-remediated/report.md`
with **Final Technical Disposition: COMPLETE_PENDING_HUMAN_REVIEW**.

**Final Verifier** (`mcp__codex__codex`, fresh, `workspace-write`, independent, thread
`01a04f6e-7b70-7f10-99bd-8faa1e16a4b5`): 11-point check covering all deterministic suites (62
tests) plus run-bundle/context-pack/consistency/contract suites, `git diff --check`, the OPEN (then
finalized) Run Bundle's self-hashes and every evidence source hash recomputed independently, R1/R2
byte hashes recomputed independently, the 7-call total recounted independently, a credential scan,
frozen-file byte-identity plus a direct read of ADR-0005's `## Status` line (`Proposed`), a full
re-read of `shadow-council-harness.mjs` confirming no artifact-to-execution path, and a zero-commit
check. **Initial result: 10/11 PASS, item 10 (quarantined-commit provenance) FAIL** — the Verifier
flagged that `task-record.json`'s `objective`/`unresolvedRisks` fields mention the quarantined
commit `5d83aa5` by hash, against Claude's own verification-instruction wording ("not referenced
anywhere in this branch's new files"), which was overly strict and did not match this task's actual
requirement ("not incorporated as publication history/evidence authority"). Claude clarified the
distinction (a purely descriptive, factual historical mention — separately required by this same
task's Process Incident section above — is permitted; incorporation as technical/evidentiary
authority is not) and asked the Verifier to re-check specifically whether any technical value in
the bundle traces to `5d83aa5`'s content. The Verifier re-confirmed independently that it does not
— every hash, byte-count, and evidence entry in the bundle traces only to this branch's own working
tree and real exercises — and revised item 10 to PASS. **Final revised verdict: ALL CHECKS PASS
(11/11).**

**Adjudication**: every real finding raised across the entire task (2 implementation defects, 2
documentation wording issues, 1 overly-strict-instruction false positive) was fixed, clarified, or
corrected and re-confirmed before proceeding to the next gate. No finding at any point required
changing ADR-0005's Status, the Decision Council protocol, the kernel, the simulator, or the
schema. Exactly 7 real provider CLI calls were made in this task's entire lifetime (during the
human-authorized exercises only) — zero during implementation, zero during any review or
verification pass.

**Human review is the next gate.** This task's local publication commit is prepared (see
Publication above) but not pushed; no PR is touched or created; no merge occurs; ADR-0005's Status
remains **Proposed** and its acceptance is not started; no execution-integration follow-on is
started.
