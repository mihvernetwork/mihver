import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { evaluateAuthorization } from "../../scripts/dev/authorization-binder.mjs";
import {
  applyEvent, computeCommitmentHash, computeDecisionRecordHash, createSession,
} from "../../scripts/dev/decision-council-kernel.mjs";
import {
  buildCouncilQuorumProof, makeRegistryEntry,
} from "../../scripts/dev/council-quorum-proof.mjs";
import { LedgerSimulation } from "../../scripts/dev/authorization-ledger-simulator.mjs";
import { runAuthorizationLoop, TERMINAL_OUTCOMES } from "../../scripts/dev/authorization-loop.mjs";
import { computeTaskRecordHash } from "../../scripts/dev/run-bundle.mjs";

let passed = 0; let failed = 0;
async function test(name, fn) { try { await fn(); passed += 1; console.log(`PASS: ${name}`); } catch (error) { failed += 1; console.error(`FAIL: ${name}\n${error.stack}`); } }

const context = { contextHash: `sha256:${"1".repeat(64)}`, repositoryHead: "2".repeat(40) };
function fixture(id, action = "FAKE_NOOP", input = { id }) {
  const decisionBody = { decisionRequestId: `loop-decision-${id}`, taskId: `loop-task-${id}`, riskClass: "R0",
    contextHash: context.contextHash, repositoryHead: context.repositoryHead, councilEpochId: "loop-real-epoch",
    state: "COUNCIL_NOT_REQUIRED", disposition: "COUNCIL_NOT_REQUIRED", candidateHash: null,
    proposerSeatId: null, votes: [], quorumDetail: { ruleset: "R0", reason: null }, reasonCode: "FIXTURE" };
  const taskBody = { taskId: decisionBody.taskId, objective: `Iteration fixture ${id}`, branch: "feat/test",
    baseCommit: "4".repeat(40), allowedScope: [`fixture-${id}`], forbiddenScope: [], disposition: "IN_PROGRESS",
    unresolvedRisks: [], humanActionRequested: "Review fixture" };
  return { decisionRecord: { ...decisionBody, recordHash: computeDecisionRecordHash(decisionBody) },
    taskRecord: { ...taskBody, taskRecordHash: computeTaskRecordHash(taskBody) }, currentContext: context,
    currentStopEpoch: 7, action, input };
}
function councilFixture(id) {
  const councilEpochId = `loop-council-epoch-${id}`;
  const decisionRequest = { decisionRequestId: `loop-council-decision-${id}`, taskId: `loop-council-task-${id}`,
    riskClass: "R1", contextHash: context.contextHash, repositoryHead: context.repositoryHead,
    councilEpochId, rotationOrdinal: 0 };
  const councilConfig = { epochId: councilEpochId, seats: [
    { seatId: "seat-a", provider: "provider-a", modelFamily: "family-a", modelId: "model-a", councilEpochId },
    { seatId: "seat-b", provider: "provider-b", modelFamily: "family-b", modelId: "model-b", councilEpochId },
    { seatId: "seat-c", provider: "provider-c", modelFamily: "family-c", modelId: "model-c", councilEpochId },
  ] };
  let admitted = createSession(decisionRequest, councilConfig, context); assert.equal(admitted.ok, true);
  let { session } = admitted;
  const proposalContent = { summary: "Authorize loop fixture", payload: { id } };
  const common = { decisionRequestId: decisionRequest.decisionRequestId, seatId: "seat-a", councilEpochId };
  session = applyEvent(session, { type: "SUBMIT_COMMITMENT", commitment: {
    ...common, commitmentHash: computeCommitmentHash(proposalContent),
  } }).session;
  session = applyEvent(session, { type: "REVEAL_PROPOSAL", proposal: { ...common, proposalContent } }).session;
  session = applyEvent(session, { type: "FREEZE_CANDIDATE" }).session;
  const votes = ["seat-a", "seat-b"].map((seatId) => ({ decisionRequestId: decisionRequest.decisionRequestId,
    candidateHash: session.candidateDecision.candidateHash, seatId, councilEpochId, voteValue: "APPROVE" }));
  for (const vote of votes) session = applyEvent(session, { type: "CAST_VOTE", vote }).session;
  session = applyEvent(session, { type: "FINALIZE" }).session;
  const built = buildCouncilQuorumProof({ decisionRequest, councilConfig, votes, decisionRecord: session.decisionRecord });
  const registered = makeRegistryEntry(councilConfig);
  assert.equal(built.ok, true); assert.equal(registered.ok, true);
  const taskBody = { taskId: decisionRequest.taskId, objective: `Council loop fixture ${id}`, branch: "feat/test",
    baseCommit: "4".repeat(40), allowedScope: [`council-fixture-${id}`], forbiddenScope: [], disposition: "IN_PROGRESS",
    unresolvedRisks: [], humanActionRequested: "Review fixture" };
  return { decisionRecord: session.decisionRecord,
    taskRecord: { ...taskBody, taskRecordHash: computeTaskRecordHash(taskBody) }, currentContext: context,
    currentStopEpoch: 7, action: "FAKE_COMPUTE", input: { value: 1 }, proof: built.proof,
    trustedRegistry: { [councilEpochId]: registered.entry } };
}
const fixtures = [fixture("one", "FAKE_COMPUTE", { value: 1 }), fixture("two", "FAKE_WRITE_ARTIFACT", { content: "fixture" })];
const allow = async (envelope) => ({ outcome: "ALLOW_ONCE", reason: "POLICY_SATISFIED",
  canonicalAuthorizationId: envelope.authorizationId, ledgerDisposition: "POLICY_SATISFIED" });
const running = async () => true;
const fakeSchema = JSON.parse(readFileSync(new URL("../../schemas/dev/fake-execution-record.schema.json", import.meta.url), "utf8"));
const loopSchema = JSON.parse(readFileSync(new URL("../../schemas/dev/authorization-loop-record.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true }); ajv.addSchema(fakeSchema); const validateLoop = ajv.compile(loopSchema);
function assertTerminalRecord(record) { assert.equal(validateLoop(record), true, JSON.stringify(validateLoop.errors));
  assert.deepEqual(record.transitionLog.filter(({ state }) => TERMINAL_OUTCOMES.includes(state)), [{ state: record.outcome, iteration: record.iterationCount }]); }

await test("two iterations derive distinct authorizations and complete", async () => {
  const result = await runAuthorizationLoop({ loopRunId: "loop-two", iterationFixtures: fixtures, ledgerCheck: allow, isStopStillValid: running });
  assert.equal(result.outcome, "COMPLETED"); assert.equal(result.receipts.length, 2); assert.equal(new Set(result.authorizationIds).size, 2); assertTerminalRecord(result);
});
await test("real R1 proof passes through the real Binder and real Ledger", async () => {
  const item = councilFixture("success");
  const proofIdentity = `${item.decisionRecord.decisionRequestId}\0${item.decisionRecord.recordHash}`;
  const simulation = new LedgerSimulation({ decisionRecords: [item.decisionRecord], taskRecords: [item.taskRecord],
    councilQuorumProofs: new Map([[proofIdentity, item.proof]]), trustedRegistry: item.trustedRegistry,
    currentContext: context, currentStopEpoch: 7 });
  const result = await runAuthorizationLoop({ loopRunId: "loop-real-council-proof", iterationFixtures: [item],
    ledgerCheck: (env) => simulation.checkAndConsume(env), isStopStillValid: running });
  assert.equal(result.outcome, "COMPLETED"); assert.equal(result.receipts.length, 1);
  assert.equal(simulation.ledgerState(result.authorizationIds[0]), "CONSUMED"); assertTerminalRecord(result);
});
await test("real Ledger without its council proof fails closed before dispatch", async () => {
  const item = councilFixture("ledger-missing-proof");
  const simulation = new LedgerSimulation({ decisionRecords: [item.decisionRecord], taskRecords: [item.taskRecord],
    trustedRegistry: item.trustedRegistry, currentContext: context, currentStopEpoch: 7 });
  const result = await runAuthorizationLoop({ loopRunId: "loop-real-council-proof-missing", iterationFixtures: [item],
    ledgerCheck: (env) => simulation.checkAndConsume(env), isStopStillValid: running });
  assert.equal(result.outcome, "AUTHORIZATION_DENIED"); assert.equal(result.denial.reason, "COUNCIL_GATE_NOT_MET");
  assert.equal(result.receipts.length, 0); assert.equal(result.transitionLog.some(({ state }) => state === "FAKE_EXECUTED"), false);
  assertTerminalRecord(result);
});
await test("caller executor and verifier properties cannot override repository code", async () => {
  const result = await runAuthorizationLoop({ loopRunId: "loop-no-override", iterationFixtures: [fixtures[0]], ledgerCheck: allow,
    isStopStillValid: running, fakeExecute: () => { throw new Error("unused"); }, verifyReceipt: () => { throw new Error("unused"); } });
  assert.equal(result.outcome, "COMPLETED"); assertTerminalRecord(result);
});
await test("hard maximum is clamped and terminates explicitly", async () => {
  const result = await runAuthorizationLoop({ loopRunId: "loop-hard-cap", maxIterations: 99,
    iterationFixtures: [...fixtures, fixture("three"), fixture("four")], ledgerCheck: allow, isStopStillValid: running });
  assert.equal(result.effectiveMaxIterations, 3); assert.equal(result.outcome, "MAX_ITERATIONS_REACHED"); assertTerminalRecord(result);
});
await test("STOP fencing immediately before dispatch yields no receipt", async () => {
  const result = await runAuthorizationLoop({ loopRunId: "loop-stop", iterationFixtures: fixtures, ledgerCheck: allow, isStopStillValid: async () => false });
  assert.equal(result.outcome, "STOPPED"); assert.equal(result.receipts.length, 0); assertTerminalRecord(result);
});
await test("ledger denial fails before dispatch", async () => {
  const result = await runAuthorizationLoop({ loopRunId: "loop-deny", iterationFixtures: fixtures,
    ledgerCheck: async (env) => ({ outcome: "DENY", reason: "fixture", canonicalAuthorizationId: env.authorizationId, ledgerDisposition: null }), isStopStillValid: running });
  assert.equal(result.outcome, "AUTHORIZATION_DENIED"); assert.equal(result.receipts.length, 0); assertTerminalRecord(result);
});
await test("reusing one DecisionRecord across iterations is rejected before replay", async () => {
  const result = await runAuthorizationLoop({ loopRunId: "loop-duplicate-authorization",
    iterationFixtures: [fixtures[0], fixtures[0]], ledgerCheck: allow, isStopStillValid: running });
  assert.equal(result.outcome, "AUTHORIZATION_DENIED"); assert.equal(result.denial.reason, "DUPLICATE_AUTHORIZATION_ID");
  assert.equal(result.authorizationIds.length, 1); assertTerminalRecord(result);
});
await test("empty fixture input completes with one terminal transition", async () => {
  assertTerminalRecord(await runAuthorizationLoop({ loopRunId: "loop-empty", iterationFixtures: [], ledgerCheck: allow, isStopStillValid: running }));
});
await test("real Binder and real Ledger consume two distinct single-use authorizations", async () => {
  const expectedIds = fixtures.map((item) => evaluateAuthorization(item.decisionRecord, item.taskRecord, item.currentContext, item.currentStopEpoch).envelope.authorizationId);
  assert.equal(new Set(expectedIds).size, 2);
  const simulation = new LedgerSimulation({ decisionRecords: fixtures.map((item) => item.decisionRecord), taskRecords: fixtures.map((item) => item.taskRecord), currentContext: context, currentStopEpoch: 7 });
  const result = await runAuthorizationLoop({ loopRunId: "loop-real-integration", iterationFixtures: fixtures,
    ledgerCheck: (env) => simulation.checkAndConsume(env), isStopStillValid: running });
  assert.equal(result.outcome, "COMPLETED"); assert.equal(result.iterationCount, 2); assert.deepEqual(result.authorizationIds, expectedIds);
  for (const id of expectedIds) assert.equal(simulation.ledgerState(id), "CONSUMED"); assertTerminalRecord(result);
});
await test("throwing Ledger fails closed with terminal record", async () => {
  const result = await runAuthorizationLoop({ loopRunId: "loop-ledger-throws", iterationFixtures: [fixtures[0]],
    ledgerCheck: async () => { throw new Error("ledger unavailable"); }, isStopStillValid: running });
  assert.equal(result.outcome, "INTERNAL_ERROR"); assert.equal(result.errorStep, "LEDGER_CHECK"); assert.equal(result.failedIteration, 1); assertTerminalRecord(result);
});
await test("throwing stop check fails closed with terminal record", async () => {
  const result = await runAuthorizationLoop({ loopRunId: "loop-stop-throws", iterationFixtures: [fixtures[0]], ledgerCheck: allow,
    isStopStillValid: async () => { throw new Error("stop unavailable"); } });
  assert.equal(result.outcome, "INTERNAL_ERROR"); assert.equal(result.errorStep, "STOP_CHECK"); assertTerminalRecord(result);
});
await test("real FakeExecutor unsupported action fails closed with terminal record", async () => {
  const result = await runAuthorizationLoop({ loopRunId: "loop-executor-rejects", iterationFixtures: [fixture("unsupported", "REAL_WRITE", {})], ledgerCheck: allow, isStopStillValid: running });
  assert.equal(result.outcome, "INTERNAL_ERROR"); assert.equal(result.errorStep, "FAKE_EXECUTION"); assert.equal(result.receipts.length, 0); assertTerminalRecord(result);
});
console.log(`\nAuthorization loop tests: ${passed} passed, ${failed} failed`); if (failed > 0) process.exitCode = 1;
