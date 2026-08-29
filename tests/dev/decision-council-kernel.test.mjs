import assert from "node:assert/strict";
import {
  applyEvent, computeCommitmentHash, createSession,
} from "../../scripts/dev/decision-council-kernel.mjs";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS: ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL: ${name}\n${error.stack}`); }
}

const contextHash = `sha256:${"1".repeat(64)}`;
const repositoryHead = "2".repeat(40);
const expectedContext = { contextHash, repositoryHead };
const proposalContent = { summary: "Adopt deterministic option", payload: { option: "A", nested: { score: 7 } } };

function config(overrides = {}) {
  return {
    epochId: "epoch-1",
    seats: [
      { seatId: "a", provider: "p1", modelFamily: "f1", modelId: "m1", councilEpochId: "epoch-1" },
      { seatId: "b", provider: "p2", modelFamily: "f2", modelId: "m2", councilEpochId: "epoch-1" },
      { seatId: "c", provider: "p3", modelFamily: "f3", modelId: "m3", councilEpochId: "epoch-1" },
    ],
    ...overrides,
  };
}

function request(overrides = {}) {
  return { decisionRequestId: "decision-1", taskId: "task-1", riskClass: "R1", contextHash, repositoryHead, councilEpochId: "epoch-1", rotationOrdinal: 0, ...overrides };
}

function admitted(req = request(), cfg = config()) {
  const result = createSession(req, cfg, expectedContext);
  assert.equal(result.ok, true);
  return result.session;
}

function frozen(content = proposalContent, req = request(), cfg = config()) {
  let session = admitted(req, cfg);
  const common = { decisionRequestId: req.decisionRequestId, seatId: "a", councilEpochId: req.councilEpochId };
  session = applyEvent(session, { type: "SUBMIT_COMMITMENT", commitment: { ...common, commitmentHash: computeCommitmentHash(content) } }).session;
  session = applyEvent(session, { type: "REVEAL_PROPOSAL", proposal: { ...common, proposalContent: content } }).session;
  session = applyEvent(session, { type: "FREEZE_CANDIDATE" }).session;
  return session;
}

function voteEvent(session, seatId, voteValue = "APPROVE", overrides = {}) {
  return { type: "CAST_VOTE", vote: { decisionRequestId: session.decisionRequest.decisionRequestId, candidateHash: session.candidateDecision.candidateHash, seatId, councilEpochId: session.decisionRequest.councilEpochId, voteValue, ...overrides } };
}

function finalized(content = proposalContent) {
  let session = frozen(content);
  session = applyEvent(session, voteEvent(session, "a")).session;
  session = applyEvent(session, voteEvent(session, "b")).session;
  return applyEvent(session, { type: "FINALIZE" }).session;
}

test("same inputs produce byte-identical CandidateDecision and DecisionRecord", () => {
  const one = finalized();
  const two = finalized();
  assert.equal(JSON.stringify(one.candidateDecision), JSON.stringify(two.candidateDecision));
  assert.equal(JSON.stringify(one.decisionRecord), JSON.stringify(two.decisionRecord));
});

test("one-byte proposalContent mutation changes candidateHash", () => {
  const one = frozen({ summary: "A", payload: {} });
  const two = frozen({ summary: "B", payload: {} });
  assert.notEqual(one.candidateDecision.candidateHash, two.candidateDecision.candidateHash);
});

test("wrong contextHash is rejected at admission", () => {
  const result = createSession(request({ contextHash: `sha256:${"3".repeat(64)}` }), config(), expectedContext);
  assert.equal(result.errorCode, "CONTEXT_HASH_MISMATCH");
});

test("wrong repositoryHead is rejected at admission", () => {
  const result = createSession(request({ repositoryHead: "4".repeat(40) }), config(), expectedContext);
  assert.equal(result.errorCode, "REPOSITORY_HEAD_MISMATCH");
});

test("wrong council epoch is rejected for CouncilConfig and DecisionRequest admission mismatches", () => {
  const badSeats = config().seats.map((seat, i) => i === 2 ? { ...seat, councilEpochId: "wrong" } : seat);
  assert.equal(createSession(request(), config({ seats: badSeats }), expectedContext).errorCode, "WRONG_COUNCIL_EPOCH");
  assert.equal(createSession(request({ councilEpochId: "wrong" }), config(), expectedContext).errorCode, "WRONG_COUNCIL_EPOCH");
});

test("wrong council epoch is rejected on SUBMIT_COMMITMENT", () => {
  const session = admitted();
  const result = applyEvent(session, { type: "SUBMIT_COMMITMENT", commitment: { decisionRequestId: "decision-1", seatId: "a", councilEpochId: "wrong", commitmentHash: computeCommitmentHash(proposalContent) } });
  assert.equal(result.error.code, "WRONG_COUNCIL_EPOCH");
  assert.strictEqual(result.session, session);
});

test("wrong council epoch is rejected on REVEAL_PROPOSAL", () => {
  let session = admitted();
  session = applyEvent(session, { type: "SUBMIT_COMMITMENT", commitment: { decisionRequestId: "decision-1", seatId: "a", councilEpochId: "epoch-1", commitmentHash: computeCommitmentHash(proposalContent) } }).session;
  const result = applyEvent(session, { type: "REVEAL_PROPOSAL", proposal: { decisionRequestId: "decision-1", seatId: "a", councilEpochId: "wrong", proposalContent } });
  assert.equal(result.error.code, "WRONG_COUNCIL_EPOCH");
  assert.strictEqual(result.session, session);
});

test("wrong council epoch is rejected on CAST_VOTE", () => {
  const session = frozen();
  const result = applyEvent(session, voteEvent(session, "a", "APPROVE", { councilEpochId: "wrong" }));
  assert.equal(result.error.code, "WRONG_COUNCIL_EPOCH");
});

test("different DecisionRequest on CAST_VOTE is rejected with session unchanged", () => {
  const session = frozen();
  const result = applyEvent(session, voteEvent(session, "a", "APPROVE", { decisionRequestId: "different-decision" }));
  assert.equal(result.error.code, "DECISION_REQUEST_MISMATCH");
  assert.strictEqual(result.session, session);
});

test("non-proposer SUBMIT_COMMITMENT is rejected with session unchanged", () => {
  const session = admitted();
  const result = applyEvent(session, { type: "SUBMIT_COMMITMENT", commitment: { decisionRequestId: "decision-1", seatId: "b", councilEpochId: "epoch-1", commitmentHash: computeCommitmentHash(proposalContent) } });
  assert.equal(result.error.code, "PROPOSER_ROLE_VIOLATION");
  assert.strictEqual(result.session, session);
});

test("duplicate seat identity is rejected", () => {
  const cfg = config();
  cfg.seats[1] = { ...cfg.seats[1], provider: "p1", modelFamily: "f1", modelId: "m1" };
  assert.equal(createSession(request(), cfg, expectedContext).errorCode, "DUPLICATE_SEAT_IDENTITY");
});

test("malformed DecisionRequest missing a required field is rejected without throwing", () => {
  const bad = request(); delete bad.taskId;
  assert.doesNotThrow(() => createSession(bad, config(), expectedContext));
  assert.equal(createSession(bad, config(), expectedContext).errorCode, "MALFORMED_ARTIFACT");
});

test("malformed AgentVote wrong type is rejected without throwing", () => {
  const session = frozen();
  const event = voteEvent(session, "a"); event.vote.voteValue = 7;
  let result;
  assert.doesNotThrow(() => { result = applyEvent(session, event); });
  assert.equal(result.error.code, "MALFORMED_ARTIFACT");
});

test("risk downgrade field on AgentProposal is rejected and never honored", () => {
  let session = admitted();
  session = applyEvent(session, { type: "SUBMIT_COMMITMENT", commitment: { decisionRequestId: "decision-1", seatId: "a", councilEpochId: "epoch-1", commitmentHash: computeCommitmentHash(proposalContent) } }).session;
  const result = applyEvent(session, { type: "REVEAL_PROPOSAL", proposal: { decisionRequestId: "decision-1", seatId: "a", councilEpochId: "epoch-1", proposalContent, riskClass: "R0" } });
  assert.equal(result.error.code, "MALFORMED_ARTIFACT");
  assert.equal(result.session.decisionRequest.riskClass, "R1");
});

test("risk downgrade field on AgentVote is rejected and never honored", () => {
  const session = frozen();
  const event = voteEvent(session, "a"); event.vote.riskClass = "R0";
  assert.equal(applyEvent(session, event).error.code, "MALFORMED_ARTIFACT");
});

test("CAST_VOTE before candidate freeze is an invalid state transition", () => {
  const session = admitted();
  const result = applyEvent(session, { type: "CAST_VOTE", vote: { decisionRequestId: "decision-1", candidateHash: `sha256:${"0".repeat(64)}`, seatId: "a", councilEpochId: "epoch-1", voteValue: "APPROVE" } });
  assert.equal(result.error.code, "INVALID_STATE_TRANSITION");
  assert.strictEqual(result.session, session);
});

test("REVEAL_PROPOSAL before commitment is an invalid state transition", () => {
  const session = admitted();
  const result = applyEvent(session, { type: "REVEAL_PROPOSAL", proposal: { decisionRequestId: "decision-1", seatId: "a", councilEpochId: "epoch-1", proposalContent } });
  assert.equal(result.error.code, "INVALID_STATE_TRANSITION");
});

test("deterministic replay yields deep-equal records and recordHash", () => {
  const replay = () => {
    let session = admitted();
    const common = { decisionRequestId: "decision-1", seatId: "a", councilEpochId: "epoch-1" };
    const events = [
      { type: "SUBMIT_COMMITMENT", commitment: { ...common, commitmentHash: computeCommitmentHash(proposalContent) } },
      { type: "REVEAL_PROPOSAL", proposal: { ...common, proposalContent } },
      { type: "FREEZE_CANDIDATE" },
    ];
    for (const event of events) session = applyEvent(session, event).session;
    session = applyEvent(session, voteEvent(session, "a")).session;
    session = applyEvent(session, voteEvent(session, "b")).session;
    return applyEvent(session, { type: "FINALIZE" }).session;
  };
  const one = replay(); const two = replay();
  assert.deepEqual(one.decisionRecord, two.decisionRecord);
  assert.equal(one.decisionRecord.recordHash, two.decisionRecord.recordHash);
  assert.deepEqual(one.transitionLog.map((x) => x.from), ["CREATED", "COMMITMENT_COLLECTION", "PROPOSAL_REVEAL", "CANDIDATE_FROZEN", "VOTING", "VOTING"]);
});

console.log(`decision-council-kernel: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
