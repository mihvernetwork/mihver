import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeJson } from "../../scripts/dev/canonical-json.mjs";
import { applyEvent, computeDecisionRecordHash, createSession } from "../../scripts/dev/decision-council-kernel.mjs";
import { buildCouncilQuorumProof, computeCouncilConfigHash, computeProofHash, makeRegistryEntry, verifyCouncilQuorumProof } from "../../scripts/dev/council-quorum-proof.mjs";
import { compileProjectContextPack } from "../../scripts/dev/project-context-pack.mjs";
import { computeContentHash, writeRunBundle } from "../../scripts/dev/run-bundle.mjs";
import { runShadowExerciseWithDurableEvidence } from "../../scripts/dev/shadow-council-run-bundle-evidence.mjs";
import { deriveAgentVote, verifyAssessmentHash } from "../../scripts/dev/shadow-council-vote-assessment.mjs";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const root = mkdtempSync(join(realpathSync(tmpdir()), "mihver-shadow-decision-record-evidence-"));
const contextPack = compileProjectContextPack(REPO_ROOT);
const seats = [
  { seatId: "seat-openai", provider: "openai", modelFamily: "gpt", modelId: "gpt-5.6-sol", councilEpochId: "decision-record-epoch" },
  { seatId: "seat-anthropic", provider: "anthropic", modelFamily: "claude", modelId: "claude-opus-5", councilEpochId: "decision-record-epoch" },
  { seatId: "seat-google", provider: "google", modelFamily: "gemini", modelId: "gemini-3.7-flash-medium", councilEpochId: "decision-record-epoch" },
];
const seatIds = seats.map(({ seatId }) => seatId);
const taskRecord = {
  taskId: "SHADOW-DECISION-RECORD-EVIDENCE-TEST", objective: "Test durable DecisionRecord evidence.",
  branch: "fix/shadow-council-decision-record-persistence-v1", baseCommit: "a".repeat(40),
  allowedScope: ["scripts/dev/**", "tests/dev/**"], disposition: "IN_PROGRESS",
  unresolvedRisks: ["Synthetic test bundle remains advisory."], humanActionRequested: "Inspect evidence.",
};

function fresh(decisionRequestId, riskClass) {
  const request = {
    decisionRequestId, taskId: "decision-record-evidence-test", riskClass,
    contextHash: contextPack.contextHash, repositoryHead: contextPack.repository.head,
    councilEpochId: "decision-record-epoch", rotationOrdinal: 0,
  };
  return createSession(request, { epochId: "decision-record-epoch", seats }, {
    contextHash: contextPack.contextHash, repositoryHead: contextPack.repository.head,
  }).session;
}

function fixture(answers) {
  let invocation = 0;
  return {
    spawnSeatImpl(seatId) {
      invocation++;
      return { stdout: `${seatId}:${invocation}`, stderr: "", exitCode: 0, childProcessId: invocation, cliExecutableRealpath: `/${seatId}`, cliVersion: "1" };
    },
    parseSeatOutputImpl(seatId) {
      const value = invocation === 1 ? { summary: "Bounded candidate", payload: { safe: true } } : answers[seatId];
      return { text: JSON.stringify(value), reportedModelId: null, modelUsage: {}, providerSessionId: null, observedToolUsage: [], usageMetadata: null };
    },
  };
}

function options(name, injected) {
  const out = join(root, name);
  return {
    out, evidenceDir: join(out, "evidence"), runId: name, contextPack, taskRecord,
    decisionQuestion: "Should this bounded synthetic candidate pass?", evidence: ["synthetic"],
    seatIds, finalize: true, finalizedAt: "2026-08-30T00:00:00Z",
    ...injected, execFileSyncImpl: () => "https://github.com/MIHVER/mihver.git\n",
  };
}

function readManifest(out) {
  return JSON.parse(readFileSync(join(out, "evidence-manifest.json"), "utf8"));
}

function readRunManifest(out) {
  return JSON.parse(readFileSync(join(out, "run-manifest.json"), "utf8"));
}

function decisionRecordEntry(evidence) {
  return evidence.find((entry) => entry.evidenceId.startsWith("shadow-decision-record:"));
}
function evidenceEntry(evidence, prefix) { return evidence.find((entry) => entry.evidenceId.startsWith(prefix)); }
function recursiveKeys(value) {
  if (Array.isArray(value)) return value.flatMap(recursiveKeys);
  if (value !== null && typeof value === "object") return Object.entries(value)
    .flatMap(([key, child]) => [key, ...recursiveKeys(child)]);
  return [];
}
function assertPersistedVotedTerminalEvidence(out) {
  const manifest = readManifest(out);
  const requestEntry = evidenceEntry(manifest.evidence, "shadow-decision-request:");
  const configEntry = evidenceEntry(manifest.evidence, "shadow-council-config:");
  const recordEntry = evidenceEntry(manifest.evidence, "shadow-decision-record:");
  const proofEntry = evidenceEntry(manifest.evidence, "shadow-council-quorum-proof:");
  assert.ok(requestEntry && configEntry && recordEntry && proofEntry, "voted terminal needs request/config/record/proof evidence");
  assert.equal(existsSync(proofEntry.sourcePath), true, "quorum proof artifact must exist on disk");
  const persistedConfig = JSON.parse(readFileSync(configEntry.sourcePath, "utf8"));
  const persistedDecisionRecordText = readFileSync(recordEntry.sourcePath, "utf8");
  const persistedDecisionRecord = JSON.parse(persistedDecisionRecordText);
  const persistedProof = JSON.parse(readFileSync(proofEntry.sourcePath, "utf8"));
  for (const forbidden of ["proof", "proofHash", "councilQuorumProof"]) {
    assert.equal(persistedDecisionRecordText.includes(`\"${forbidden}\"`), false);
    assert.equal(recursiveKeys(persistedDecisionRecord).includes(forbidden), false);
  }
  assert.equal(persistedProof.provenanceClass, "CONTEMPORANEOUS");
  const { proofHash, ...proofWithoutHash } = persistedProof;
  assert.equal(proofHash, computeProofHash(proofWithoutHash));
  assert.equal(persistedProof.decisionRecordHash, persistedDecisionRecord.recordHash);
  assert.equal(verifyCouncilQuorumProof({ proof: persistedProof, decisionRecord: persistedDecisionRecord,
    trustedRegistry: { [persistedConfig.epochId]: makeRegistryEntry(persistedConfig).entry } }).authorizationEvidenceEligible, true);
  return { manifest, requestEntry, configEntry, recordEntry, proofEntry, persistedConfig, persistedDecisionRecord, persistedProof };
}

const approveAll = Object.fromEntries(seatIds.map((seatId) => [seatId, { voteValue: "APPROVE", rationale: `Approve for ${seatId}` }]));

try {
  // 1 & 2: R3 3/3 terminal DECIDED run persists DecisionRecord before FINALIZED.
  {
    let providerCalls = 0;
    const injected = fixture(approveAll);
    const opts = options("r3-decided", {
      ...injected,
      spawnSeatImpl(seatId, prompt) {
        providerCalls++;
        if (providerCalls === 1) {
          const manifest = readManifest(opts.out);
          const request = manifest.evidence.find((entry) => entry.evidenceId.startsWith("shadow-decision-request:"));
          const config = manifest.evidence.find((entry) => entry.evidenceId.startsWith("shadow-council-config:"));
          assert.ok(request, "DecisionRequest must be manifest-bound before first provider call");
          assert.ok(config, "CouncilConfig must be manifest-bound before first provider call");
          assert.deepEqual(JSON.parse(readFileSync(request.sourcePath, "utf8")), fresh("r3-decided", "R3").decisionRequest);
          assert.deepEqual(JSON.parse(readFileSync(config.sourcePath, "utf8")), fresh("r3-decided", "R3").councilConfig);
        }
        return injected.spawnSeatImpl(seatId, prompt);
      },
    });
    const result = runShadowExerciseWithDurableEvidence(fresh("r3-decided", "R3"), opts);
    assert.equal(result.decisionRecord.state, "DECIDED");
    assert.equal(result.decisionRecord.disposition, "HUMAN_APPROVAL_REQUIRED");
    assert.equal(result.decisionRecord.votes.length, 3);
    assert.ok(result.decisionRecord.votes.every((vote) => vote.voteValue === "APPROVE"));
    const entry = decisionRecordEntry(result.evidence);
    assert.ok(entry, "expected persisted DecisionRecord evidence entry");
    assert.equal(readRunManifest(opts.out).status, "FINALIZED");
    // 16: exactly one terminal DecisionRecord evidence entry.
    assert.equal(result.evidence.filter((item) => item.evidenceId.startsWith("shadow-decision-record:")).length, 1);
    // 15: EvidenceManifest contentHash exactly matches persisted canonical bytes.
    const bytes = readFileSync(entry.sourcePath);
    assert.equal(entry.contentHash, computeContentHash(bytes));
    assert.equal(bytes.toString("utf8"), canonicalizeJson(result.decisionRecord));
    // 14: recordHash exactly equals independent recomputation.
    const { recordHash, ...withoutHash } = result.decisionRecord;
    assert.equal(computeDecisionRecordHash(withoutHash), recordHash);
    assert.equal(providerCalls, 4);
    const { requestEntry, configEntry, persistedConfig, persistedDecisionRecord, persistedProof } = assertPersistedVotedTerminalEvidence(opts.out);
    const persistedRequest = JSON.parse(readFileSync(requestEntry.sourcePath, "utf8"));
    assert.equal(persistedRequest.rotationOrdinal, 0);
    assert.equal(persistedProof.councilConfigHash, computeCouncilConfigHash(persistedConfig));
    assert.equal(persistedProof.decisionRecordHash, persistedDecisionRecord.recordHash);
    assert.equal(result.decisionRecord.proposerSeatId, persistedConfig.seats[persistedRequest.rotationOrdinal % 3].seatId);
    assert.equal(canonicalizeJson(persistedProof.votes), canonicalizeJson(result.session.votes));
  }

  // Real-seat identity claims must be canonical before the first provider is called.
  for (const [name, mutate] of [
    ["missing-model-family", (config) => { config.seats[0] = { ...config.seats[0], modelFamily: "" }; }],
    ["altered-seat-order", (config) => { config.seats.reverse(); }],
    ["altered-model", (config) => { config.seats[0] = { ...config.seats[0], modelId: "other" }; }],
    ["altered-provider", (config) => { config.seats[0] = { ...config.seats[0], provider: "other" }; }],
  ]) {
    let calls = 0;
    const session = fresh(name, "R1");
    const config = structuredClone(session.councilConfig);
    mutate(config);
    const opts = options(name, { ...fixture(approveAll), spawnSeatImpl() { calls++; throw new Error("must not run"); } });
    assert.throws(() => runShadowExerciseWithDurableEvidence({ ...session, councilConfig: config }, opts),
      (error) => error.message === "SHADOW_COUNCIL_CONFIG_MISMATCH");
    assert.equal(calls, 0);
  }

  // A failed identity artifact write is before the provider boundary, while a failed proof write
  // leaves the terminal bundle OPEN and does not bind a proof.
  for (const [name, prefix] of [["request-write-failure", "shadow-decision-request-"], ["config-write-failure", "shadow-council-config-"]]) {
    let calls = 0;
    const opts = options(name, { ...fixture(approveAll), spawnSeatImpl() { calls++; throw new Error("must not run"); },
      writeFileSyncImpl(path, bytes) { if (path.includes(prefix)) throw new Error("ARTIFACT_WRITE_FAILED"); return writeFileSync(path, bytes); } });
    assert.throws(() => runShadowExerciseWithDurableEvidence(fresh(name, "R1"), opts), /ARTIFACT_WRITE_FAILED/);
    assert.equal(calls, 0);
    assert.equal(existsSync(join(opts.out, "evidence-manifest.json")), name !== "request-write-failure");
  }
  {
    const opts = options("proof-write-failure", { ...fixture(approveAll),
      writeFileSyncImpl(path, bytes) { if (path.includes("shadow-council-quorum-proof-")) throw new Error("ARTIFACT_WRITE_FAILED"); return writeFileSync(path, bytes); } });
    assert.throws(() => runShadowExerciseWithDurableEvidence(fresh("proof-write-failure", "R3"), opts), /ARTIFACT_WRITE_FAILED/);
    assert.equal(readRunManifest(opts.out).status, "OPEN");
    assert.equal(readManifest(opts.out).evidence.some((entry) => entry.evidenceId.startsWith("shadow-council-quorum-proof:")), false);
  }

  // 3: R1 terminal approved run persists DecisionRecord.
  {
    const opts = options("r1-approved", fixture(approveAll));
    const result = runShadowExerciseWithDurableEvidence(fresh("r1-approved", "R1"), opts);
    assert.equal(result.decisionRecord.state, "DECIDED");
    assert.equal(result.decisionRecord.disposition, "COUNCIL_APPROVED");
    assert.ok(decisionRecordEntry(result.evidence));
    assert.equal(readRunManifest(opts.out).status, "FINALIZED");
    const { persistedConfig, persistedProof, persistedDecisionRecord } = assertPersistedVotedTerminalEvidence(opts.out);
    assert.deepEqual(persistedConfig.seats.map(({ modelFamily }) => modelFamily), ["gpt", "claude", "gemini"]);
    const verification = verifyCouncilQuorumProof({ proof: persistedProof, decisionRecord: persistedDecisionRecord,
      trustedRegistry: { [persistedConfig.epochId]: makeRegistryEntry(persistedConfig).entry } });
    assert.equal(verification.quorumRecomputation.ruleset, "R1");
    assert.ok(verification.quorumRecomputation.detail.distinctProviderModelFamilies >= 2);
    assert.equal(verification.authorizationEvidenceEligible, true);
  }

  // 4: R2 terminal approved run persists DecisionRecord.
  {
    const reviewerSeatIds = ["seat-google", "seat-anthropic"];
    const opts = options("r2-approved", { ...fixture(approveAll), seatIds: reviewerSeatIds });
    const result = runShadowExerciseWithDurableEvidence(fresh("r2-approved", "R2"), opts);
    assert.equal(result.decisionRecord.state, "DECIDED");
    assert.equal(result.decisionRecord.disposition, "COUNCIL_APPROVED");
    assert.ok(decisionRecordEntry(result.evidence));
    assert.equal(readRunManifest(opts.out).status, "FINALIZED");
    const { manifest, requestEntry, configEntry, recordEntry, proofEntry } = assertPersistedVotedTerminalEvidence(opts.out);
    const persistedRequest = JSON.parse(readFileSync(requestEntry.sourcePath, "utf8"));
    const persistedConfig = JSON.parse(readFileSync(configEntry.sourcePath, "utf8"));
    const persistedDecisionRecord = JSON.parse(readFileSync(recordEntry.sourcePath, "utf8"));
    const persistedVotesBySeat = new Map(manifest.evidence
      .filter((entry) => entry.evidenceId.startsWith("shadow-vote-assessment:"))
      .map((entry) => JSON.parse(readFileSync(entry.sourcePath, "utf8")))
      .map((assessment) => {
        assert.equal(verifyAssessmentHash(assessment), true);
        const vote = deriveAgentVote(assessment);
        return [vote.seatId, vote];
      }));
    const bundleOnlyProof = buildCouncilQuorumProof({ decisionRequest: persistedRequest, councilConfig: persistedConfig,
      decisionRecord: persistedDecisionRecord, votes: persistedConfig.seats
        .filter(({ seatId }) => persistedVotesBySeat.has(seatId)).map(({ seatId }) => persistedVotesBySeat.get(seatId)) });
    assert.equal(bundleOnlyProof.ok, true);
    assert.equal(bundleOnlyProof.proof.proofHash, JSON.parse(readFileSync(proofEntry.sourcePath, "utf8")).proofHash);
  }

  // 5: terminal NO_QUORUM persists DecisionRecord.
  {
    const rejectOne = { ...approveAll, "seat-anthropic": { voteValue: "REJECT", rationale: "Insufficient evidence to approve." } };
    const opts = options("r3-no-quorum", fixture(rejectOne));
    const result = runShadowExerciseWithDurableEvidence(fresh("r3-no-quorum", "R3"), opts);
    assert.equal(result.decisionRecord.state, "NO_QUORUM");
    assert.equal(result.decisionRecord.disposition, "NO_QUORUM");
    const entry = decisionRecordEntry(result.evidence);
    assert.ok(entry);
    assert.equal(readRunManifest(opts.out).status, "FINALIZED");
    assertPersistedVotedTerminalEvidence(opts.out);
  }

  // 6 & 7: malformed seat output / invocation failure before FINALIZE leaves no DecisionRecord, bundle OPEN.
  {
    const malformed = { ...approveAll, "seat-google": { voteValue: "NOT_A_VOTE", rationale: "x" } };
    const opts = options("malformed-preterminate", fixture(malformed));
    assert.throws(() => runShadowExerciseWithDurableEvidence(fresh("malformed-preterminate", "R3"), opts));
    const manifest = readManifest(opts.out);
    assert.equal(manifest.evidence.some((entry) => entry.evidenceId.startsWith("shadow-decision-record:")), false);
    assert.equal(readRunManifest(opts.out).status, "OPEN");
    assert.ok(manifest.evidence.length > 0, "existing failure evidence must survive");
  }
  {
    const opts = options("invocation-failure-preterminate", {
      ...fixture(approveAll),
      spawnSeatImpl() { throw new Error("SPAWN_BOOM"); },
    });
    assert.throws(() => runShadowExerciseWithDurableEvidence(fresh("invocation-failure-preterminate", "R3"), opts));
    const manifest = readManifest(opts.out);
    assert.equal(manifest.evidence.some((entry) => entry.evidenceId.startsWith("shadow-decision-record:")), false);
    assert.equal(readRunManifest(opts.out).status, "OPEN");
  }

  // 8: DecisionRecord write/append failure prevents finalization, isolated specifically to the
  // DecisionRecord append step (not a generic first-evidence collision). recordHash does not depend
  // on vote rationale text, only on voteValue/candidateHash/request fields, so a dry run and the real
  // run below share the exact same decisionRequestId/votes (and therefore the exact same recordHash
  // and shadow-decision-record evidenceId) while using different rationale strings, which makes their
  // packet/attestation/assessment evidenceIds (which do depend on rationale/output content) distinct.
  // Pre-seeding the real bundle with a decoy entry under that shared evidenceId therefore lets every
  // packet/attestation/assessment append for the real run succeed, and only the DecisionRecord append
  // collides.
  {
    const dryRunOpts = options("write-append-failure-dry-run", fixture(approveAll));
    const dryRun = runShadowExerciseWithDurableEvidence(fresh("write-append-failure", "R3"), { ...dryRunOpts, finalize: false });
    const dryEntry = decisionRecordEntry(dryRun.evidence);
    assert.ok(dryEntry, "expected the dry run to persist a DecisionRecord evidence entry");

    const opts = options("write-append-failure", fixture(approveAll));
    const decoyPath = join(opts.out, "decoy-decision-record.json");
    mkdirSync(opts.out, { recursive: true });
    writeFileSync(decoyPath, Buffer.from("{}", "utf8"));
    const seedResult = writeRunBundle({
      out: opts.out, runId: opts.runId, contextPack, taskRecord,
      evidence: [{
        evidenceId: dryEntry.evidenceId, kind: "ARTIFACT",
        producedBy: { role: "REVIEWER", tool: "test-decoy", threadId: null },
        summary: "Decoy entry occupying the real DecisionRecord evidenceId.",
        path: decoyPath, action: "present", sourcePath: decoyPath,
        contentHash: computeContentHash(Buffer.from("{}", "utf8")),
      }],
      finalize: false, execFileSyncImpl: () => "https://github.com/MIHVER/mihver.git\n",
    });
    assert.equal(seedResult.status, "OK", JSON.stringify(seedResult));

    assert.throws(
      () => runShadowExerciseWithDurableEvidence(fresh("write-append-failure", "R3"), opts),
      (error) => /RUN_BUNDLE_EVIDENCE_WRITE_FAILED:DUPLICATE_EVIDENCE_ID/.test(error.message)
    );
    const manifestAfter = readManifest(opts.out);
    // Every packet/attestation/assessment append for the real run succeeded before the collision.
    assert.equal(manifestAfter.evidence.filter((e) => e.evidenceId.startsWith("shadow-council-packet:")).length, 4);
    assert.equal(manifestAfter.evidence.filter((e) => e.evidenceId.startsWith("shadow-seat-attestation:")).length, 4);
    assert.equal(manifestAfter.evidence.filter((e) => e.evidenceId.startsWith("shadow-vote-assessment:")).length, 3);
    assert.equal(readRunManifest(opts.out).status, "OPEN");
  }

  // 10, 11, 12, 13: one-byte mutation / voteValue / candidateHash / repositoryHead-contextHash mutations fail verification.
  {
    const opts = options("mutation-detect", fixture(approveAll));
    const result = runShadowExerciseWithDurableEvidence(fresh("mutation-detect", "R3"), opts);
    const record = result.decisionRecord;

    const mutate = (patch) => {
      const { recordHash, ...withoutHash } = record;
      return { ...withoutHash, ...patch, recordHash };
    };
    assert.notEqual(computeDecisionRecordHash((() => { const m = mutate({ reasonCode: `${record.reasonCode}_X` }); const { recordHash, ...rest } = m; return rest; })()), record.recordHash);

    const mutatedVoteValue = mutate({ votes: record.votes.map((v, i) => (i === 0 ? { ...v, voteValue: "REJECT" } : v)) });
    { const { recordHash, ...rest } = mutatedVoteValue; assert.notEqual(computeDecisionRecordHash(rest), recordHash); }

    const mutatedCandidateHash = mutate({ candidateHash: `sha256:${"9".repeat(64)}` });
    { const { recordHash, ...rest } = mutatedCandidateHash; assert.notEqual(computeDecisionRecordHash(rest), recordHash); }

    const mutatedRepoHead = mutate({ repositoryHead: "f".repeat(40) });
    { const { recordHash, ...rest } = mutatedRepoHead; assert.notEqual(computeDecisionRecordHash(rest), recordHash); }

    const mutatedContextHash = mutate({ contextHash: `sha256:${"e".repeat(64)}` });
    { const { recordHash, ...rest } = mutatedContextHash; assert.notEqual(computeDecisionRecordHash(rest), recordHash); }
  }

  // 9: missing DecisionRecord after a nominally terminal run fails closed before finalization.
  {
    const applyEventImpl = (session, event) => {
      const outcome = applyEvent(session, event);
      if (event.type === "FINALIZE" && outcome.session?.decisionRecord) {
        return { ...outcome, session: { ...outcome.session, decisionRecord: null } };
      }
      return outcome;
    };
    const opts = options("missing-record-preterminate", { ...fixture(approveAll), applyEventImpl });
    assert.throws(
      () => runShadowExerciseWithDurableEvidence(fresh("missing-record-preterminate", "R3"), opts),
      (error) => error.message === "DECISION_RECORD_MISSING_BEFORE_FINALIZE"
    );
    assert.equal(readRunManifest(opts.out).status, "OPEN");
    const manifest = readManifest(opts.out);
    assert.equal(manifest.evidence.some((entry) => entry.evidenceId.startsWith("shadow-decision-record:")), false);
  }

  // 17: appending the exact same DecisionRecord evidence a second time into the same OPEN bundle
  // is rejected (DUPLICATE_EVIDENCE_ID) rather than silently producing a second conflicting entry.
  {
    const opts = options("duplicate-record-rejected", { ...fixture(approveAll), finalize: false });
    const requestId = "duplicate-record-rejected";
    const first = runShadowExerciseWithDurableEvidence(fresh(requestId, "R3"), opts);
    assert.ok(decisionRecordEntry(first.evidence));
    assert.throws(
      () => runShadowExerciseWithDurableEvidence(fresh(requestId, "R3"), { ...opts, ...fixture(approveAll) }),
      (error) => /RUN_BUNDLE_EVIDENCE_WRITE_FAILED/.test(error.message)
    );
    assert.equal(readRunManifest(opts.out).status, "OPEN");
  }

  // Self-consistent substituted record (recordHash recomputed over the substituted content) is
  // still rejected because it no longer matches the terminal session's own votes/candidate/riskClass.
  {
    const applyEventImpl = (session, event) => {
      const outcome = applyEvent(session, event);
      if (event.type === "FINALIZE" && outcome.session?.decisionRecord) {
        const original = outcome.session.decisionRecord;
        const { recordHash, ...withoutHash } = original;
        const substituted = { ...withoutHash, votes: withoutHash.votes.map((v, i) => (i === 0 ? { ...v, voteValue: "REJECT" } : v)) };
        const recomputed = { ...substituted, recordHash: computeDecisionRecordHash(substituted) };
        return { ...outcome, session: { ...outcome.session, decisionRecord: recomputed } };
      }
      return outcome;
    };
    const opts = options("self-consistent-vote-substitution", { ...fixture(approveAll), applyEventImpl });
    assert.throws(
      () => runShadowExerciseWithDurableEvidence(fresh("self-consistent-vote-substitution", "R3"), opts),
      (error) => error.message.startsWith("DURABLE_QUORUM_PROOF_VERIFICATION_FAILED:")
    );
    assert.equal(readRunManifest(opts.out).status, "OPEN");
    assert.equal(readManifest(opts.out).evidence.some((entry) => entry.evidenceId.startsWith("shadow-decision-record:")), true);
  }

  // Self-consistent disposition substitution (DECIDED/COUNCIL_APPROVED forged for an R3 request)
  // is rejected even though the forged record's own recordHash recomputes correctly.
  {
    const applyEventImpl = (session, event) => {
      const outcome = applyEvent(session, event);
      if (event.type === "FINALIZE" && outcome.session?.decisionRecord?.disposition === "HUMAN_APPROVAL_REQUIRED") {
        const original = outcome.session.decisionRecord;
        const { recordHash, ...withoutHash } = original;
        const substituted = { ...withoutHash, disposition: "COUNCIL_APPROVED" };
        const recomputed = { ...substituted, recordHash: computeDecisionRecordHash(substituted) };
        return { ...outcome, session: { ...outcome.session, decisionRecord: recomputed } };
      }
      return outcome;
    };
    const opts = options("self-consistent-disposition-substitution", { ...fixture(approveAll), applyEventImpl });
    assert.throws(
      () => runShadowExerciseWithDurableEvidence(fresh("self-consistent-disposition-substitution", "R3"), opts),
      (error) => error.message.startsWith("DURABLE_QUORUM_PROOF_VERIFICATION_FAILED:")
    );
    assert.equal(readRunManifest(opts.out).status, "OPEN");
  }

  // Self-consistent state/quorumDetail/reasonCode substitution (real R3 3/3 DECIDED forged into a
  // NO_QUORUM record with an internally-consistent quorumDetail/reasonCode and a freshly recomputed
  // valid recordHash) is rejected by the independent CouncilQuorumProof recomputation.
  {
    const applyEventImpl = (session, event) => {
      const outcome = applyEvent(session, event);
      if (event.type === "FINALIZE" && outcome.session?.decisionRecord?.state === "DECIDED") {
        const original = outcome.session.decisionRecord;
        const { recordHash, ...withoutHash } = original;
        const substituted = {
          ...withoutHash,
          state: "NO_QUORUM",
          disposition: "NO_QUORUM",
          quorumDetail: { ruleset: "R3", reason: "R3_INSUFFICIENT_APPROVALS", approvals: 2 },
          reasonCode: "R3_INSUFFICIENT_APPROVALS",
        };
        const recomputed = { ...substituted, recordHash: computeDecisionRecordHash(substituted) };
        return { ...outcome, session: { ...outcome.session, decisionRecord: recomputed } };
      }
      return outcome;
    };
    const opts = options("self-consistent-state-substitution", { ...fixture(approveAll), applyEventImpl });
    assert.throws(
      () => runShadowExerciseWithDurableEvidence(fresh("self-consistent-state-substitution", "R3"), opts),
      (error) => error.message.startsWith("DURABLE_QUORUM_PROOF_VERIFICATION_FAILED:")
    );
    assert.equal(readRunManifest(opts.out).status, "OPEN");
    assert.equal(readManifest(opts.out).evidence.some((entry) => entry.evidenceId.startsWith("shadow-decision-record:")), true);
  }

  console.log("Shadow Council DecisionRecord evidence tests: passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
