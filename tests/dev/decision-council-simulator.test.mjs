import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { canonicalizeJson } from "../../scripts/dev/canonical-json.mjs";
import { applyEvent, createSession } from "../../scripts/dev/decision-council-kernel.mjs";
import { buildCouncilConfig, castVotesAndFinalize, driveToFrozen } from "../../scripts/dev/decision-council-simulator.mjs";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS: ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL: ${name}\n${error.stack}`); }
}

const contextHash = `sha256:${"a".repeat(64)}`;
const repositoryHead = "b".repeat(40);
const expectedContext = { contextHash, repositoryHead };
const content = { summary: "Use option A", payload: { option: "A" } };

function request(riskClass = "R1", overrides = {}) {
  return { decisionRequestId: `decision-${riskClass}`, taskId: "task-sim", riskClass, contextHash, repositoryHead, councilEpochId: "epoch-1", rotationOrdinal: 0, ...overrides };
}

function frozen(riskClass = "R1", councilConfig = buildCouncilConfig()) {
  const result = createSession(request(riskClass), councilConfig, expectedContext);
  assert.equal(result.ok, true);
  return driveToFrozen(result.session, result.session.expectedProposerSeatId, content);
}

function run(riskClass, votes, councilConfig = buildCouncilConfig()) {
  return castVotesAndFinalize(frozen(riskClass, councilConfig), votes).decisionRecord;
}

test("R1 3-0 approve produces DECIDED/COUNCIL_APPROVED", () => {
  const record = run("R1", { "seat-a": "APPROVE", "seat-b": "APPROVE", "seat-c": "APPROVE" });
  assert.equal(record.state, "DECIDED"); assert.equal(record.disposition, "COUNCIL_APPROVED");
});

test("R1 2-1 approve with diverse providers produces DECIDED/COUNCIL_APPROVED", () => {
  const record = run("R1", { "seat-a": "APPROVE", "seat-b": "APPROVE", "seat-c": "REJECT" });
  assert.equal(record.state, "DECIDED"); assert.equal(record.disposition, "COUNCIL_APPROVED");
});

test("R1 two approvals with same provider/modelFamily fail diversity quorum", () => {
  const cfg = buildCouncilConfig({ seats: [
    { seatId: "seat-a", provider: "shared", modelFamily: "family", modelId: "m1" },
    { seatId: "seat-b", provider: "shared", modelFamily: "family", modelId: "m2" },
    { seatId: "seat-c", provider: "other", modelFamily: "other", modelId: "m3" },
  ] });
  const record = run("R1", { "seat-a": "APPROVE", "seat-b": "APPROVE", "seat-c": "REJECT" }, cfg);
  assert.equal(record.state, "NO_QUORUM"); assert.equal(record.reasonCode, "R1_DIVERSITY_REQUIREMENT_NOT_MET");
});

test("R1 reject scenario produces NO_QUORUM", () => {
  const record = run("R1", { "seat-a": "APPROVE", "seat-b": "REJECT", "seat-c": "REJECT" });
  assert.equal(record.state, "NO_QUORUM");
});

test("explicit ABSTAIN is excluded from quorum and recorded distinctly", () => {
  const record = run("R1", { "seat-a": "APPROVE", "seat-b": "ABSTAIN", "seat-c": "REJECT" });
  assert.equal(record.state, "NO_QUORUM");
  assert.equal(record.votes.find((v) => v.seatId === "seat-b").voteValue, "ABSTAIN");
});

test("omitted timeout vote is MISSING and excluded from quorum", () => {
  const record = run("R1", { "seat-a": "APPROVE" });
  assert.equal(record.state, "NO_QUORUM");
  assert.equal(record.votes.find((v) => v.seatId === "seat-b").voteValue, "MISSING");
  assert.equal(record.votes.find((v) => v.seatId === "seat-b").candidateHash, null);
});

test("conflicting candidateHash vote is rejected and cannot combine into quorum", () => {
  let session = frozen("R1");
  const valid = { decisionRequestId: session.decisionRequest.decisionRequestId, candidateHash: session.candidateDecision.candidateHash, seatId: "seat-a", councilEpochId: "epoch-1", voteValue: "APPROVE" };
  session = applyEvent(session, { type: "CAST_VOTE", vote: valid }).session;
  const conflicting = { ...valid, seatId: "seat-b", candidateHash: `sha256:${"c".repeat(64)}` };
  const rejected = applyEvent(session, { type: "CAST_VOTE", vote: conflicting });
  assert.equal(rejected.error.code, "CANDIDATE_HASH_MISMATCH");
  const record = applyEvent(rejected.session, { type: "FINALIZE" }).session.decisionRecord;
  assert.equal(record.state, "NO_QUORUM");
});

test("R2 proposer approval cannot substitute for a second reviewer", () => {
  const record = run("R2", { "seat-a": "APPROVE", "seat-b": "APPROVE", "seat-c": "REJECT" });
  assert.equal(record.state, "NO_QUORUM"); assert.equal(record.reasonCode, "R2_REVIEWER_REJECTED");
});

test("R2 both reviewers approve while proposer abstains", () => {
  const record = run("R2", { "seat-a": "ABSTAIN", "seat-b": "APPROVE", "seat-c": "APPROVE" });
  assert.equal(record.state, "DECIDED"); assert.equal(record.disposition, "COUNCIL_APPROVED");
});

test("R2 both reviewers approve while proposer is missing", () => {
  const record = run("R2", { "seat-b": "APPROVE", "seat-c": "APPROVE" });
  assert.equal(record.state, "DECIDED");
  assert.equal(record.votes.find((v) => v.seatId === "seat-a").voteValue, "MISSING");
});

test("R2 one reviewer rejects regardless of proposer and other reviewer", () => {
  const record = run("R2", { "seat-a": "APPROVE", "seat-b": "REJECT", "seat-c": "APPROVE" });
  assert.equal(record.state, "NO_QUORUM"); assert.equal(record.reasonCode, "R2_REVIEWER_REJECTED");
});

test("R3 2-of-3 approval produces NO_QUORUM", () => {
  const record = run("R3", { "seat-a": "APPROVE", "seat-b": "APPROVE", "seat-c": "REJECT" });
  assert.equal(record.state, "NO_QUORUM"); assert.equal(record.reasonCode, "R3_INSUFFICIENT_APPROVALS");
});

test("R3 3-of-3 requires human approval and grants no execution authority", () => {
  const record = run("R3", { "seat-a": "APPROVE", "seat-b": "APPROVE", "seat-c": "APPROVE" });
  assert.equal(record.state, "DECIDED"); assert.equal(record.disposition, "HUMAN_APPROVAL_REQUIRED");
  for (const forbidden of ["executionAuthority", "executable", "authorizedToExecute", "executionEnvelope"]) assert.equal(Object.hasOwn(record, forbidden), false);
});

test("R4 is DENIED regardless of supplied proposal and vote artifacts", () => {
  const result = createSession(request("R4"), buildCouncilConfig(), expectedContext);
  assert.equal(result.session.decisionRecord.state, "DENIED");
  const proposalAttempt = applyEvent(result.session, { type: "REVEAL_PROPOSAL", proposal: { riskClass: "R0" } });
  const voteAttempt = applyEvent(result.session, { type: "CAST_VOTE", vote: { voteValue: "APPROVE" } });
  assert.equal(proposalAttempt.error.code, "INVALID_STATE_TRANSITION"); assert.equal(voteAttempt.error.code, "INVALID_STATE_TRANSITION");
  assert.strictEqual(proposalAttempt.session, result.session); assert.equal(result.session.decisionRecord.reasonCode, "HARD_DENY_RISK_R4");
});

test("R0 resolves COUNCIL_NOT_REQUIRED", () => {
  const result = createSession(request("R0"), buildCouncilConfig(), expectedContext);
  assert.equal(result.session.state, "COUNCIL_NOT_REQUIRED"); assert.equal(result.session.decisionRecord.disposition, "COUNCIL_NOT_REQUIRED");
  assert.deepEqual(result.session.decisionRecord.votes, []);
});

test("unknown voter is rejected", () => {
  const session = frozen();
  const vote = { decisionRequestId: session.decisionRequest.decisionRequestId, candidateHash: session.candidateDecision.candidateHash, seatId: "intruder", councilEpochId: "epoch-1", voteValue: "APPROVE" };
  assert.equal(applyEvent(session, { type: "CAST_VOTE", vote }).error.code, "UNKNOWN_SEAT");
});

test("duplicate seat vote rejects second and preserves first without double-counting", () => {
  let session = frozen();
  const base = { decisionRequestId: session.decisionRequest.decisionRequestId, candidateHash: session.candidateDecision.candidateHash, seatId: "seat-a", councilEpochId: "epoch-1", voteValue: "APPROVE" };
  session = applyEvent(session, { type: "CAST_VOTE", vote: base }).session;
  const second = applyEvent(session, { type: "CAST_VOTE", vote: { ...base, voteValue: "REJECT" } });
  assert.equal(second.error.code, "DUPLICATE_SEAT_VOTE"); assert.equal(second.session.votes.length, 1); assert.equal(second.session.votes[0].voteValue, "APPROVE");
});

test("DecisionRecord fits a test-local EvidenceManifest ARTIFACT entry with canonical contentHash", () => {
  const record = run("R1", { "seat-a": "APPROVE", "seat-b": "APPROVE" });
  const contentHash = `sha256:${createHash("sha256").update(Buffer.from(canonicalizeJson(record), "utf8")).digest("hex")}`;
  const entry = { evidenceId: "decision-record-decision-R1", kind: "ARTIFACT", producedBy: { role: "IMPLEMENTER", tool: "decision-council-simulator", threadId: null }, summary: "Deterministic Decision Council record", sourcePath: "decision-record.json", contentHash, path: "decision-record.json", action: "present" };
  assert.match(entry.contentHash, /^sha256:[0-9a-f]{64}$/); assert.equal(entry.kind, "ARTIFACT"); assert.deepEqual(Object.keys(entry).sort(), ["action", "contentHash", "evidenceId", "kind", "path", "producedBy", "sourcePath", "summary"].sort());
});

console.log(`decision-council-simulator: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
