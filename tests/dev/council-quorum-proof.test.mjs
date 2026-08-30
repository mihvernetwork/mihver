import assert from "node:assert/strict";
import fs from "node:fs";
import {
  applyEvent, computeCommitmentHash, computeDecisionRecordHash, createSession,
} from "../../scripts/dev/decision-council-kernel.mjs";
import {
  buildCouncilQuorumProof, classifyDecisionRecordEvidence, computeCouncilConfigHash,
  computeProofHash, makeRegistryEntry, verifyCouncilQuorumProof,
} from "../../scripts/dev/council-quorum-proof.mjs";

let passed = 0; let failed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS: ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL: ${name}\n${error.stack}`); }
}
const clone = (value) => structuredClone(value);
const contextHash = `sha256:${"1".repeat(64)}`;
const repositoryHead = "2".repeat(40);
const expectedContext = { contextHash, repositoryHead };
const proposalContent = { summary: "Use candidate A", payload: { option: "A" } };

function config(epochId = "epoch-1") {
  return { epochId, seats: [
    { seatId: "a", provider: "p1", modelFamily: "f1", modelId: "m1", councilEpochId: epochId },
    { seatId: "b", provider: "p2", modelFamily: "f2", modelId: "m2", councilEpochId: epochId },
    { seatId: "c", provider: "p3", modelFamily: "f3", modelId: "m3", councilEpochId: epochId },
  ] };
}
function request(riskClass = "R1", overrides = {}) {
  return { decisionRequestId: `decision-${riskClass}`, taskId: `task-${riskClass}`, riskClass,
    contextHash, repositoryHead, councilEpochId: "epoch-1", rotationOrdinal: 0, ...overrides };
}
function sessionFixture(riskClass, cast, councilConfig = config()) {
  const decisionRequest = request(riskClass);
  let result = createSession(decisionRequest, councilConfig, expectedContext); assert.equal(result.ok, true);
  let session = result.session;
  const common = { decisionRequestId: decisionRequest.decisionRequestId, seatId: "a", councilEpochId: "epoch-1" };
  session = applyEvent(session, { type: "SUBMIT_COMMITMENT", commitment: { ...common, commitmentHash: computeCommitmentHash(proposalContent) } }).session;
  session = applyEvent(session, { type: "REVEAL_PROPOSAL", proposal: { ...common, proposalContent } }).session;
  session = applyEvent(session, { type: "FREEZE_CANDIDATE" }).session;
  const votes = [];
  for (const [seatId, voteValue] of cast) {
    const vote = { decisionRequestId: decisionRequest.decisionRequestId, candidateHash: session.candidateDecision.candidateHash,
      seatId, councilEpochId: "epoch-1", voteValue };
    session = applyEvent(session, { type: "CAST_VOTE", vote }).session; votes.push(vote);
  }
  session = applyEvent(session, { type: "FINALIZE" }).session;
  return { decisionRequest, councilConfig, votes, decisionRecord: session.decisionRecord };
}
function bundle(risk = "R1", votes = [["a", "APPROVE"], ["b", "APPROVE"]]) {
  const fixture = sessionFixture(risk, votes);
  const built = buildCouncilQuorumProof(fixture); assert.equal(built.ok, true);
  const entry = makeRegistryEntry(fixture.councilConfig); assert.equal(entry.ok, true);
  return { ...fixture, proof: built.proof, registry: { "epoch-1": entry.entry } };
}
function seal(proof) { proof.proofHash = computeProofHash(Object.fromEntries(Object.entries(proof).filter(([key]) => key !== "proofHash"))); }
function rehashRecord(record) { record.recordHash = computeDecisionRecordHash(Object.fromEntries(Object.entries(record).filter(([key]) => key !== "recordHash"))); }

for (const [risk, votes] of [["R1", [["a", "APPROVE"], ["b", "APPROVE"]]], ["R2", [["b", "APPROVE"], ["c", "APPROVE"]]], ["R3", [["a", "APPROVE"], ["b", "APPROVE"], ["c", "APPROVE"]]]]) {
  test(`${risk} contemporaneous proof is fully eligible`, () => {
    const x = bundle(risk, votes); const verified = verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry });
    assert.equal(verified.authorizationEvidenceEligible, true); assert.equal(verified.quorumRecomputation.met, true); assert.equal(verified.errorCode, null);
  });
}
test("forged provider identity with stale config hash is untrusted", () => {
  const x = bundle(); x.proof.councilConfig.seats[0].provider = "forged"; seal(x.proof);
  assert.equal(verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry }).configTrustValid, false);
});
test("forged identity rehashed but absent from trust anchor is untrusted", () => {
  const x = bundle(); x.proof.councilConfig.seats[0].modelFamily = "forged"; x.proof.councilConfigHash = computeCouncilConfigHash(x.proof.councilConfig); seal(x.proof);
  assert.equal(verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry }).configTrustValid, false);
});
test("valid config substitution for the epoch is untrusted", () => {
  const x = bundle(); const alternate = config(); alternate.seats[0].modelId = "alternate";
  x.proof.councilConfig = alternate; x.proof.councilConfigHash = computeCouncilConfigHash(alternate); seal(x.proof);
  assert.equal(verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry }).configTrustValid, false);
});
test("proof attached to another DecisionRecord fails record hash", () => {
  const x = bundle(); const other = bundle("R1", [["a", "APPROVE"], ["b", "REJECT"]]);
  assert.equal(verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: other.decisionRecord, trustedRegistry: x.registry }).decisionRecordHashValid, false);
});
test("candidate hash substitution in a vote fails bindings", () => {
  const x = bundle(); x.proof.votes[0].candidateHash = `sha256:${"9".repeat(64)}`; seal(x.proof);
  assert.equal(verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry }).bindingsValid, false);
});
test("vote substitution without rehashing fails proof hash", () => {
  const x = bundle(); x.proof.votes[0].voteValue = "REJECT";
  assert.equal(verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry }).proofHashValid, false);
});
test("duplicate raw vote seat fails bindings", () => {
  const x = bundle(); x.proof.votes[1].seatId = "a"; seal(x.proof);
  assert.equal(verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry }).bindingsValid, false);
});
test("duplicate configured provider/model/model identity is rejected by compiler", () => {
  const x = bundle(); const bad = clone(x.councilConfig); Object.assign(bad.seats[1], { provider: "p1", modelFamily: "f1", modelId: "m1" });
  const built = buildCouncilQuorumProof({ ...x, councilConfig: bad }); assert.equal(built.ok, false); assert.equal(built.errorCode, "MALFORMED_COUNCIL_CONFIG");
});
test("wrong council epoch fails bindings", () => {
  const x = bundle(); x.proof.decisionRequest.councilEpochId = "wrong"; seal(x.proof);
  assert.equal(verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry }).bindingsValid, false);
});
test("wrong proposer in an otherwise hash-valid record fails bindings", () => {
  const x = bundle(); x.decisionRecord.proposerSeatId = "b"; rehashRecord(x.decisionRecord); x.proof.decisionRecordHash = x.decisionRecord.recordHash; seal(x.proof);
  assert.equal(verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry }).bindingsValid, false);
});
test("null proposer in an otherwise hash-valid R1 record fails bindings and eligibility", () => {
  const x = bundle(); x.decisionRecord.proposerSeatId = null; rehashRecord(x.decisionRecord);
  x.proof.decisionRecordHash = x.decisionRecord.recordHash; seal(x.proof);
  const verified = verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry });
  assert.equal(verified.decisionRecordHashValid, true); assert.equal(verified.bindingsValid, false);
  assert.equal(verified.authorizationEvidenceEligible, false); assert.equal(verified.errorCode, "BINDINGS_INVALID");
});
test("DecisionRecord with an extra field is rejected by builder and verifier", () => {
  const x = bundle(); x.decisionRecord.extraField = "x";
  const built = buildCouncilQuorumProof(x);
  assert.equal(built.ok, false); assert.equal(built.errorCode, "DECISION_RECORD_MALFORMED");
  const verified = verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry });
  assert.equal(verified.authorizationEvidenceEligible, false); assert.equal(verified.decisionRecordHashValid, false);
  assert.equal(verified.errorCode, "DECISION_RECORD_MALFORMED");
});
test("R1 insufficient diversity recomputes NO_QUORUM", () => {
  const cfg = config(); cfg.seats[1] = { ...cfg.seats[1], provider: "p1", modelFamily: "f1" };
  const f = sessionFixture("R1", [["a", "APPROVE"], ["b", "APPROVE"]], cfg);
  const built = buildCouncilQuorumProof(f); assert.equal(built.ok, true); const entry = makeRegistryEntry(cfg).entry;
  const v = verifyCouncilQuorumProof({ proof: built.proof, decisionRecord: f.decisionRecord, trustedRegistry: { "epoch-1": entry } });
  assert.equal(v.quorumRecomputation.met, false); assert.equal(v.quorumRecomputation.reason, "R1_DIVERSITY_REQUIREMENT_NOT_MET"); assert.equal(v.quorumMatchesRecord, true);
});
test("R2 proposer approval cannot replace missing reviewer", () => {
  const x = bundle("R2", [["a", "APPROVE"], ["b", "APPROVE"]]); const v = verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry });
  assert.equal(v.quorumRecomputation.met, false); assert.equal(v.quorumRecomputation.detail.reviewerApprovals, 1); assert.equal(v.quorumMatchesRecord, true);
});
test("R3 less than three approvals recomputes NO_QUORUM", () => {
  const x = bundle("R3", [["a", "APPROVE"], ["b", "APPROVE"]]); const v = verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry });
  assert.equal(v.quorumRecomputation.met, false); assert.equal(v.quorumMatchesRecord, true);
});
test("unknown proof version fails closed with specific code", () => {
  const x = bundle(); x.proof.proofVersion = "2"; seal(x.proof); const v = verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry });
  assert.equal(v.authorizationEvidenceEligible, false); assert.equal(v.errorCode, "UNKNOWN_PROOF_VERSION");
});
test("historical V1 record without proof is classified but never eligible", () => {
  const x = bundle(); assert.equal(classifyDecisionRecordEvidence({ decisionRecord: x.decisionRecord }), "V1_HISTORICAL_NO_PROOF");
  assert.equal(verifyCouncilQuorumProof({ decisionRecord: x.decisionRecord, trustedRegistry: x.registry }).authorizationEvidenceEligible, false);
});
test("reconstructed proof remains ineligible even when otherwise valid", () => {
  const x = bundle(); x.proof.provenanceClass = "RECONSTRUCTED"; seal(x.proof); const v = verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry });
  assert.equal(v.proofHashValid, true); assert.equal(v.authorizationEvidenceEligible, false); assert.equal(v.errorCode, "PROVENANCE_NOT_CONTEMPORANEOUS");
  assert.equal(classifyDecisionRecordEvidence({ decisionRecord: x.decisionRecord, proof: x.proof }), "V1_PROOF_RECONSTRUCTED");
});
for (const [name, mutate] of [
  ["council config content", (proof) => { proof.councilConfig.seats[0].modelId += "x"; }],
  ["vote value", (proof) => { proof.votes[0].voteValue = "REJECT"; }],
  ["request taskId", (proof) => { proof.decisionRequest.taskId += "x"; }],
]) test(`one-byte mutation of ${name} invalidates proof hash or bindings`, () => {
  const x = bundle(); mutate(x.proof); const v = verifyCouncilQuorumProof({ proof: x.proof, decisionRecord: x.decisionRecord, trustedRegistry: x.registry });
  assert.equal(v.proofHashValid && v.bindingsValid, false);
});
test("proof construction cannot mutate or enter the DecisionRecord hash graph", () => {
  const x = sessionFixture("R1", [["a", "APPROVE"], ["b", "APPROVE"]]); const before = clone(x.decisionRecord);
  const beforeHash = computeDecisionRecordHash(Object.fromEntries(Object.entries(before).filter(([key]) => key !== "recordHash")));
  assert.equal(buildCouncilQuorumProof(x).ok, true); assert.deepEqual(x.decisionRecord, before); assert.equal(x.decisionRecord.recordHash, beforeHash);
  assert.equal(JSON.stringify(x.decisionRecord).includes("proofHash"), false); assert.equal("quorumProofHash" in x.decisionRecord, false);
  const schema = fs.readFileSync(new URL("../../schemas/dev/decision-council.schema.json", import.meta.url), "utf8");
  assert.equal(schema.includes("proofHash"), false); assert.equal(schema.includes("quorumProofHash"), false);
});

console.log(`council-quorum-proof: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
