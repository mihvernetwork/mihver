#!/usr/bin/env node

import assert from "node:assert/strict";

import { evaluateAuthorization, POLICY_VERSION } from "./authorization-binder.mjs";
import { LedgerSimulation } from "./authorization-ledger-simulator.mjs";
import { runAuthorizationLoop } from "./authorization-loop.mjs";
import { executeFakeAction } from "./fake-executor.mjs";
import { verifyFakeExecutionReceipt } from "./authorization-verifier.mjs";
import {
  applyEvent, computeCommitmentHash, createSession, getDecisionRecord,
} from "./decision-council-kernel.mjs";
import {
  buildCouncilQuorumProof, makeRegistryEntry, verifyCouncilQuorumProof,
} from "./council-quorum-proof.mjs";
import { computeTaskRecordHash } from "./run-bundle.mjs";

const CONTEXT = Object.freeze({
  contextHash: `sha256:${"1".repeat(64)}`,
  repositoryHead: "2".repeat(40),
});
const STOP_EPOCH = 7;
const NOW = "2030-01-01T12:00:00.000Z";

function line(label, detail) { console.log(`  ${label}: ${detail}`); }
function heading(number, title) { console.log(`\nSCENARIO ${number} — ${title}`); }

function makeTask(taskId, { disposition = "IN_PROGRESS" } = {}) {
  const body = {
    taskId, objective: `Demonstrate ${taskId}`, branch: "feat/authorization-loop-foundation-v1a",
    baseCommit: "3".repeat(40), allowedScope: [`scope:${taskId}`], forbiddenScope: [],
    disposition, unresolvedRisks: [], humanActionRequested: "Inspect deterministic trace",
  };
  return { ...body, taskRecordHash: computeTaskRecordHash(body) };
}

function makeCouncilRun(id, riskClass, voteValues) {
  const councilEpochId = `demonstration-epoch-${id}`;
  const decisionRequest = {
    decisionRequestId: `demonstration-decision-${id}`, taskId: `demonstration-task-${id}`,
    riskClass, contextHash: CONTEXT.contextHash, repositoryHead: CONTEXT.repositoryHead,
    councilEpochId, rotationOrdinal: 0,
  };
  const councilConfig = { epochId: councilEpochId, seats: [
    { seatId: "seat-a", provider: "provider-a", modelFamily: "family-a", modelId: "model-a", councilEpochId },
    { seatId: "seat-b", provider: "provider-b", modelFamily: "family-b", modelId: "model-b", councilEpochId },
    { seatId: "seat-c", provider: "provider-c", modelFamily: "family-c", modelId: "model-c", councilEpochId },
  ] };
  const admitted = createSession(decisionRequest, councilConfig, CONTEXT);
  assert.equal(admitted.ok, true);
  let { session } = admitted;
  if (riskClass !== "R4") {
    const proposalContent = { summary: `Deterministic ${riskClass} proposal`, payload: { id } };
    const common = { decisionRequestId: decisionRequest.decisionRequestId, seatId: "seat-a", councilEpochId };
    session = applyEvent(session, { type: "SUBMIT_COMMITMENT", commitment: {
      ...common, commitmentHash: computeCommitmentHash(proposalContent),
    } }).session;
    session = applyEvent(session, { type: "REVEAL_PROPOSAL", proposal: { ...common, proposalContent } }).session;
    session = applyEvent(session, { type: "FREEZE_CANDIDATE" }).session;
    for (let index = 0; index < voteValues.length; index += 1) {
      session = applyEvent(session, { type: "CAST_VOTE", vote: {
        decisionRequestId: decisionRequest.decisionRequestId,
        candidateHash: session.candidateDecision.candidateHash,
        seatId: councilConfig.seats[index].seatId, councilEpochId, voteValue: voteValues[index],
      } }).session;
    }
    session = applyEvent(session, { type: "FINALIZE" }).session;
  }
  const decisionRecord = getDecisionRecord(session);
  assert.ok(decisionRecord);
  const votes = session.votes;
  const built = riskClass === "R4" ? null : buildCouncilQuorumProof({
    decisionRequest, councilConfig, votes, decisionRecord,
  });
  if (built) assert.equal(built.ok, true, built.errorCode);
  const registered = makeRegistryEntry(councilConfig);
  assert.equal(registered.ok, true, registered.errorCode);
  return {
    decisionRequest, councilConfig, decisionRecord, proof: built?.proof ?? null,
    trustedRegistry: { [councilEpochId]: registered.entry },
    taskRecord: makeTask(decisionRequest.taskId),
  };
}

function fixture(run, action, input, taskRecord = run.taskRecord) {
  return { decisionRecord: run.decisionRecord, taskRecord, currentContext: CONTEXT,
    currentStopEpoch: STOP_EPOCH, policyVersion: POLICY_VERSION, proof: run.proof,
    trustedRegistry: run.trustedRegistry, action, input };
}

function proofMap(runs) {
  return new Map(runs.filter(({ proof }) => proof).map((run) => [
    `${run.decisionRecord.decisionRequestId}\0${run.decisionRecord.recordHash}`, run.proof,
  ]));
}

function ledgerFor(runs, taskRecords = runs.map(({ taskRecord }) => taskRecord)) {
  const trustedRegistry = Object.assign({}, ...runs.map(({ trustedRegistry }) => trustedRegistry));
  return new LedgerSimulation({ decisionRecords: runs.map(({ decisionRecord }) => decisionRecord),
    taskRecords, councilQuorumProofs: proofMap(runs), trustedRegistry,
    currentContext: CONTEXT, currentStopEpoch: STOP_EPOCH });
}

function showProofAndEnvelope(run, item) {
  const proofResult = verifyCouncilQuorumProof({ proof: run.proof,
    decisionRecord: run.decisionRecord, trustedRegistry: run.trustedRegistry });
  line("CouncilQuorumProof.authorizationEvidenceEligible", proofResult.authorizationEvidenceEligible);
  const authorization = evaluateAuthorization(item.decisionRecord, item.taskRecord, item.currentContext,
    item.currentStopEpoch, item.policyVersion, item.proof, item.trustedRegistry);
  line("Binder.status", authorization.status);
  if (authorization.status === "ENVELOPE") line("AuthorizationEnvelope.disposition", authorization.envelope.disposition);
  return authorization;
}

async function scenarioOne() {
  heading(1, "two complete R1 iterations");
  const runs = [makeCouncilRun("iteration-1", "R1", ["APPROVE", "APPROVE"]),
    makeCouncilRun("iteration-2", "R1", ["APPROVE", "APPROVE"])];
  const items = [fixture(runs[0], "FAKE_COMPUTE", { value: 1 }),
    fixture(runs[1], "FAKE_WRITE_ARTIFACT", { content: "deterministic demonstration" })];
  for (let index = 0; index < runs.length; index += 1) {
    line(`iteration ${index + 1} DecisionRecord`, `${runs[index].decisionRecord.state}/${runs[index].decisionRecord.disposition}`);
    showProofAndEnvelope(runs[index], items[index]);
  }
  const ledger = ledgerFor(runs);
  const ledgerResults = [];
  const result = await runAuthorizationLoop({ loopRunId: "demonstration-two-iterations",
    iterationFixtures: items, ledgerCheck: async (envelope) => {
      const outcome = await ledger.checkAndConsume(envelope, { now: NOW }); ledgerResults.push(outcome); return outcome;
    }, isStopStillValid: async () => true });
  ledgerResults.forEach((entry, index) => line(`iteration ${index + 1} Ledger`, `${entry.outcome}/${entry.reason}`));
  result.transitionLog.forEach(({ state, iteration }) => line("loop transition", `iteration=${iteration} state=${state}`));
  line("receipts verified", result.receipts.length);
  assert.equal(result.outcome, "COMPLETED"); assert.equal(result.receipts.length, 2);
}

async function scenarioTwo() {
  heading(2, "STOP epoch fencing");
  const run = makeCouncilRun("stop-fence", "R1", ["APPROVE", "APPROVE"]);
  const item = fixture(run, "FAKE_NOOP", {});
  const authorization = showProofAndEnvelope(run, item);
  assert.equal(authorization.status, "ENVELOPE");
  const ledger = ledgerFor([run]);
  await ledger.bumpStopEpoch(STOP_EPOCH + 1);
  line("Ledger currentStopEpoch", STOP_EPOCH + 1);
  const denied = await ledger.checkAndConsume(authorization.envelope, { now: NOW });
  line("Ledger", `${denied.outcome}/${denied.reason}`);
  line("FakeExecutor", "NOT_CALLED");
  assert.equal(denied.reason, "REVOKED_BY_STOP_EPOCH");
}

async function scenarioThree() {
  heading(3, "R3 without a grant");
  const run = makeCouncilRun("r3-no-grant", "R3", ["APPROVE", "APPROVE", "APPROVE"]);
  const item = fixture(run, "FAKE_NOOP", {});
  const authorization = showProofAndEnvelope(run, item);
  assert.equal(authorization.status, "ENVELOPE");
  const denied = await ledgerFor([run]).checkAndConsume(authorization.envelope, { now: NOW });
  line("Ledger", `${denied.outcome}/${denied.reason}`); line("FakeExecutor", "NOT_CALLED");
  assert.equal(authorization.envelope.disposition, "PENDING_HUMAN_APPROVAL");
  assert.equal(denied.reason, "NO_VALID_GRANT");
}

async function scenarioFour() {
  heading(4, "R3 exact-bound grant, execution, and replay denial");
  const run = makeCouncilRun("r3-grant", "R3", ["APPROVE", "APPROVE", "APPROVE"]);
  const item = fixture(run, "FAKE_COMPUTE", { value: 3 });
  const authorization = showProofAndEnvelope(run, item);
  assert.equal(authorization.status, "ENVELOPE");
  const ledger = ledgerFor([run]);
  const grant = await ledger.issueGrant(authorization.envelope, { grantId: "demonstration-grant-r3",
    authorizedAt: "2030-01-01T00:00:00.000Z", expiresAt: "2030-01-02T00:00:00.000Z" });
  line("Grant binding", `state=${grant.state} envelopeHashMatch=${grant.envelopeHash === authorization.envelope.envelopeHash}`);
  let allowance;
  const result = await runAuthorizationLoop({ loopRunId: "demonstration-r3-grant", iterationFixtures: [item],
    ledgerCheck: async (envelope) => { allowance = await ledger.checkAndConsume(envelope, { now: NOW }); return allowance; },
    isStopStillValid: async () => true });
  line("Ledger first consumption", `${allowance.outcome}/${allowance.reason}`);
  result.transitionLog.forEach(({ state, iteration }) => line("loop transition", `iteration=${iteration} state=${state}`));
  const replay = await ledger.checkAndConsume(authorization.envelope, { now: NOW });
  line("Ledger replay", `${replay.outcome}/${replay.reason}`);
  assert.equal(result.outcome, "COMPLETED"); assert.equal(result.receipts.length, 1);
  assert.equal(replay.reason, "REPLAY_REJECTED");
}

function scenarioFive() {
  heading(5, "BLOCKED task fails before envelope construction");
  const run = makeCouncilRun("blocked", "R1", ["APPROVE", "APPROVE"]);
  const blockedTask = makeTask(run.decisionRecord.taskId, { disposition: "BLOCKED" });
  const item = fixture(run, "FAKE_NOOP", {}, blockedTask);
  const proofResult = verifyCouncilQuorumProof({ proof: run.proof, decisionRecord: run.decisionRecord,
    trustedRegistry: run.trustedRegistry });
  line("CouncilQuorumProof.authorizationEvidenceEligible", proofResult.authorizationEvidenceEligible);
  const authorization = evaluateAuthorization(item.decisionRecord, item.taskRecord, item.currentContext,
    item.currentStopEpoch, item.policyVersion, item.proof, item.trustedRegistry);
  line("Binder", `${authorization.status}/${authorization.reason}`); line("envelope constructed", false);
  line("FakeExecutor", "NOT_CALLED");
  assert.equal(authorization.reason, "TASK_RECORD_BLOCKED");
}

function scenarioSix() {
  heading(6, "R4 hard denial and R1 NO_QUORUM denial");
  const r4 = makeCouncilRun("r4", "R4", []);
  const r4Item = fixture(r4, "FAKE_NOOP", {});
  const r4Authorization = evaluateAuthorization(r4Item.decisionRecord, r4Item.taskRecord,
    r4Item.currentContext, r4Item.currentStopEpoch, r4Item.policyVersion, null, r4Item.trustedRegistry);
  line("R4 DecisionRecord", `${r4.decisionRecord.state}/${r4.decisionRecord.disposition}`);
  line("R4 Binder", `${r4Authorization.status}/${r4Authorization.reason}`);

  const noQuorum = makeCouncilRun("no-quorum", "R1", ["APPROVE", "REJECT"]);
  const noQuorumItem = fixture(noQuorum, "FAKE_NOOP", {});
  const proofResult = verifyCouncilQuorumProof({ proof: noQuorum.proof,
    decisionRecord: noQuorum.decisionRecord, trustedRegistry: noQuorum.trustedRegistry });
  const denied = evaluateAuthorization(noQuorumItem.decisionRecord, noQuorumItem.taskRecord,
    noQuorumItem.currentContext, noQuorumItem.currentStopEpoch, noQuorumItem.policyVersion,
    noQuorumItem.proof, noQuorumItem.trustedRegistry);
  line("NO_QUORUM DecisionRecord", `${noQuorum.decisionRecord.state}/${noQuorum.decisionRecord.disposition}`);
  line("NO_QUORUM proof recomputation", `met=${proofResult.quorumRecomputation.met}`);
  line("NO_QUORUM Binder", `${denied.status}/${denied.reason}`); line("FakeExecutor", "NOT_CALLED");
  assert.equal(r4Authorization.reason, "R4_HARD_DENY"); assert.equal(denied.reason, "COUNCIL_GATE_NOT_MET");
}

// Keep explicit imports and calls here: the grant scenario demonstrates the same FakeExecutor implementation and
// verifier used internally by runAuthorizationLoop without providing an override hook.
assert.equal(typeof executeFakeAction, "function");
assert.equal(typeof verifyFakeExecutionReceipt, "function");

console.log("AUTHORIZATION LOOP V1A — DETERMINISTIC DEMONSTRATION");
await scenarioOne();
await scenarioTwo();
await scenarioThree();
await scenarioFour();
scenarioFive();
scenarioSix();
console.log("\nDEMONSTRATION COMPLETE — all assertions passed; FakeExecutor only");
