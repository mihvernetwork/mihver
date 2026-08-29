# MIHVER Run Bundle Report

## Observed Facts

- Run: shadow-council-v1a-cli-harness-remediated-finalization-run-1 (finalized 2026-08-29T21:34:41Z)
- Task: SHADOW-COUNCIL-V1A-LIFECYCLE-REMEDIATION — Recover the technically-valid but lifecycle-invalid Shadow Council V1A CLI harness result (quarantined local commit 5d83aa5 on the separate branch feat/shadow-council-v1a-cli-harness, produced by a research fork that exceeded its delegated read-only scope) by re-implementing the same, already-reviewed architecture through compliant provenance (Codex Scout -> Codex Implementer -> Codex Reviewer -> Codex Verifier, Claude as orchestrator/adjudicator/integrator only), then running exactly two real, human-launched Shadow Council exercises (one R1, one R2) against the frozen, unmodified Decision Council V1A kernel, then finalizing that evidence into a fresh Run Bundle and durable exercise document, obtaining a post-exercise adversarial review against all seven ADR-0005 Acceptance Gate criteria and a final independent verification, and preparing exactly one local publication commit. Does not change the Decision Council protocol's topology, quorum rules, candidate/vote binding, DecisionRecord meaning, kernel, simulator, or schema. Does not change ADR-0005's Status (remains Proposed). Does not start ADR-0005 acceptance or execution integration. Does not push, open/modify a PR, or merge.
- Repository: mihvernetwork/mihver via origin
- Basis: branch feat/shadow-council-v1a-cli-harness-remediated, HEAD 2fae893d89c8debded14fb7ba23adfcad2055133
- ProjectContextPack: sha256:0baf4a439f4d93c88748c3e70e353414efe5fd7fc83e1244ec290dcd6c850e00

## Verification Results

- npm run check:project-consistency: 7 passed, 0 failed — 7 deterministic project-consistency checks, all PASS against the final state-file content.
- npm run test:context-pack: 115 passed, 0 failed — ProjectContextPack suite, confirmed unmodified and green; the stale Required Context path (docs/development/... -> docs/adr/...) fix was independently confirmed to clear the REQUIRED_CONTEXT_MISSING warning.
- npm test: 170 passed, 0 failed — Repository contract-fixture validation suite, all 170 fixtures PASS.
- grep -riE "api[_-]?key|secret|password|BEGIN.*PRIVATE KEY|Authorization:|Bearer " across both exercise JSON files, the new schemas/scripts/tests, and the durable exercise document: 1 passed, 0 failed — No credential-shaped string found in any new or exercise-produced file; independently reconfirmed by the post-exercise adversarial Reviewer.
- node tests/dev/decision-council-kernel.test.mjs: 18 passed, 0 failed — Frozen kernel suite, confirmed unmodified and green after this task's changes.
- node tests/dev/decision-council-simulator.test.mjs: 18 passed, 0 failed — Frozen simulator suite, confirmed unmodified and green after this task's changes.
- Direct recomputation of both candidateHash values (computeCandidateHash), both DecisionRecord.recordHash values (computeDecisionRecordHash), and all 7 attestationHash values (buildAttestation) from the raw exercise-r1.json/exercise-r2.json bytes, using the real unmodified scripts/dev/decision-council-kernel.mjs and scripts/dev/shadow-council-attestation.mjs primitives -- never trusting the harness's own printed summary.: 11 passed, 0 failed — 2 candidateHash + 2 recordHash + 7 attestationHash recomputations, all matched exactly; independently reconfirmed a second time by the post-exercise adversarial Reviewer with the same results.
- git diff --check: 1 passed, 0 failed — No whitespace-error or conflict-marker diagnostics across the full working-tree diff.
- npm run test:run-bundle: 17 passed, 0 failed — Run Bundle subsystem's own deterministic suite, confirmed unmodified and green.
- node tests/dev/shadow-council-attestation.test.mjs: 5 passed, 0 failed — Independently rerun by Claude directly, including the two post-review regression tests.
- node tests/dev/shadow-council-cli-transport.test.mjs: 9 passed, 0 failed — Independently rerun by Claude directly.
- 11-point final verification: 6 deterministic Shadow Council/kernel/simulator suites (62 tests), run-bundle/context-pack/consistency/contract suites, git diff --check, OPEN Run Bundle self-hash + evidence-source-hash integrity, R1/R2 byte-hash recomputation, 7-call-count recount, credential scan, frozen-file byte-identity + ADR-0005 Status text, no-execution-path re-read of shadow-council-harness.mjs, quarantined-commit provenance check (clarified to evidentiary-authority standard, not mere narrative mention), zero-commit check: 11 passed, 0 failed — Fresh independent final Verifier, workspace-write, no real provider calls made. ALL CHECKS PASS after one clarification round: item 10 initially flagged the quarantined commit hash 5d83aa5 appearing in task-record.json's narrative objective/unresolvedRisks text; on review confirmed this is purely descriptive process-incident context (required elsewhere in this task) and that zero technical values in this bundle trace to 5d83aa5's actual content -- revised to PASS.
- node tests/dev/shadow-council-harness.test.mjs: 7 passed, 0 failed — Independently rerun by Claude directly; all tests use fake transports, zero real CLI spawn.
- 19-point independent verification: 6 deterministic Shadow Council/kernel/simulator suites (62 tests), run-bundle/context-pack/consistency/contract suites, frozen-file byte-identity, package.json dependency-diff check, credential scan, no-DecisionRecord-to-execution-path check, zero-commit check, docs/adr/ diff check, no run-bundle-directory-exists check, zero-real-provider-call check: 19 passed, 0 failed — Fresh independent Verifier, workspace-write, never a continuation of the Reviewer's own thread. ALL CHECKS PASS, confirmed before any real provider call was authorized.
- node tests/dev/shadow-council-packet.test.mjs: 5 passed, 0 failed — Independently rerun by Claude directly (not merely trusted from Implementer/Reviewer reports).
- npm run test:project-consistency: 19 passed, 0 failed — 19 project-consistency test groups, all PASS (uses disposable temp-directory git fixtures internally; the real repository branch/state is unaffected).

## Review Findings

- CHANGES_REQUIRED_THEN_APPROVED: 2 findings, 0 blockers — Fresh independent adversarial implementation review, two rounds. Round 1 found 2 real defects: SEAT_ADAPTERS shallow-frozen (nested adapter objects mutable, allowing runtime cross-assignment), and checkAdmission's substitution check unioning reportedModelId with modelUsage keys (a falsely-matching reportedModelId could mask a modelUsage set that excluded the primary). Both fixed (deep-freeze; substitution check based solely on modelUsage keys) and independently re-verified by Claude. Round 2: APPROVED. No PROTOCOL_REDESIGN_BLOCKER at either round.
- APPROVED_NO_PROTOCOL_BLOCKER: 2 findings, 0 blockers — Fresh independent adversarial review of the real exercise evidence (not the implementation code). Independently recomputed both candidateHash, both recordHash, and all 7 attestationHash values from raw bytes -- all matched. Confirmed the exact kernel event sequence (SUBMIT_COMMITMENT -> REVEAL_PROPOSAL -> FREEZE_CANDIDATE -> CAST_VOTE(xN) -> FINALIZE) was traversed with no shortcut. Found no credential material. Judged the R1/R2 contextHash difference an operational evaluation limitation, not a protocol-integrity failure. Found 2 documentation wording issues (now corrected) and 0 protocol-redesign blockers. Reported 6 of 7 ADR-0005 Acceptance Gate criteria SATISFIED_BY_THIS_EVIDENCE and criterion 5 (Run Bundle) NOT_YET_SATISFIED solely because the bundle did not yet exist at review time -- this Run Bundle is that bundle.

## Unresolved Risks

- One parent harness process (this Claude Code orchestrator, on this machine) controlled all three child-process launches for both exercises; seat-origin attestation proves local runtime/process separation only, not cryptographic provider non-collusion.
- The codex and agy CLIs report no per-model usage breakdown or model identifier at all (reportedModelId: null, modelUsage: {}) on any call; this is recorded honestly as unavailable, never fabricated as confirmation.
- agy's JSON output exposes no tool-call field, so its observedToolUsage is structurally always empty -- a real observability gap, not proof that no tool was used.
- A real child process's pid is not observable via execFileSync on a successful call; childProcessId records 0 as a sentinel, not a genuine pid.
- R1 and R2 bind two different ProjectContextPack contextHash values (repositoryHead identical) because Exercise 1's output file changed the working tree before Exercise 2 compiled its own live ContextPack; disclosed as an operational/evaluation limitation, independently judged by a fresh adversarial Reviewer to not affect protocol integrity or candidate/vote meaning.
- The sanitized exercise JSON files do not retain the kernel's internal transitionLog, so they are not a fully self-contained event-log transcript; the Reviewer judged the recorded operator command, attestations, candidate binding, votes, and terminal records collectively sufficient evidence of protocol traversal, and recommended (not required) preserving transitionLog in future exercise output.
- The quarantined commit 5d83aa5 on branch feat/shadow-council-v1a-cli-harness is not incorporated into this branch's history, evidence authority, or Run Bundle in any way; it is cited only as historical/reference material in documentation.

## Final Technical Disposition

COMPLETE_PENDING_HUMAN_REVIEW

## Requested Human Action

Review this finalized evidence (Run Bundle, durable exercise document, both sanitized real exercise records, Reviewer and Verifier results) and decide, as two separate explicit decisions: (1) whether to push this branch and open/merge a PR, and (2) whether this evidence should move ADR-0005 toward Status: Accepted. Neither is authorized or decided by this task.

This report is derived from typed evidence only and does not itself authorize publication or merge.
