import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAuthorization } from "../../scripts/dev/authorization-binder.mjs";
import { LedgerSimulation, POLICY_VERSION } from "../../scripts/dev/authorization-ledger-simulator.mjs";
import { buildCouncilQuorumProof, computeProofHash, makeRegistryEntry } from "../../scripts/dev/council-quorum-proof.mjs";
import { computeDecisionRecordHash } from "../../scripts/dev/decision-council-kernel.mjs";
import { computeTaskRecordHash } from "../../scripts/dev/run-bundle.mjs";

const context = Object.freeze({ contextHash: `sha256:${"1".repeat(64)}`, repositoryHead: "2".repeat(40) });
const candidateHash = `sha256:${"3".repeat(64)}`;
const NOW = "2030-01-01T12:00:00.000Z";
const councilConfig = Object.freeze({ epochId: "epoch-1", seats: [
  { seatId: "seat-a", provider: "provider-a", modelFamily: "family-a", modelId: "model-a", councilEpochId: "epoch-1" },
  { seatId: "seat-b", provider: "provider-b", modelFamily: "family-b", modelId: "model-b", councilEpochId: "epoch-1" },
  { seatId: "seat-c", provider: "provider-c", modelFamily: "family-c", modelId: "model-c", councilEpochId: "epoch-1" },
] });
const registryEntry = makeRegistryEntry(councilConfig);
assert.equal(registryEntry.ok, true);
const trustedRegistry = Object.freeze({ "epoch-1": registryEntry.entry });

function taskRecord(overrides = {}) {
  const body = { taskId: "task-1", objective: "Exercise authorization", branch: "feat/test",
    baseCommit: "4".repeat(40), allowedScope: ["alpha", "gamma", "alpha"], forbiddenScope: ["beta"],
    disposition: "IN_PROGRESS", unresolvedRisks: [], humanActionRequested: "Review exact subject", ...overrides };
  delete body.taskRecordHash;
  return { ...body, taskRecordHash: computeTaskRecordHash(body) };
}

function decisionRecord({ riskClass = "R3", disposition, ...overrides } = {}) {
  disposition ??= ({ R0: "COUNCIL_NOT_REQUIRED", R1: "COUNCIL_APPROVED", R2: "COUNCIL_APPROVED",
    R3: "HUMAN_APPROVAL_REQUIRED", R4: "DENIED" })[riskClass];
  const immediate = riskClass === "R0" || riskClass === "R4";
  const body = { decisionRequestId: "decision-1", taskId: "task-1", riskClass,
    contextHash: context.contextHash, repositoryHead: context.repositoryHead, councilEpochId: "epoch-1",
    state: riskClass === "R0" ? "COUNCIL_NOT_REQUIRED" : riskClass === "R4" ? "DENIED" : "DECIDED",
    disposition, candidateHash: immediate ? null : candidateHash, proposerSeatId: immediate ? null : "seat-a",
    votes: immediate ? [] : ["seat-a", "seat-b", "seat-c"].map((seatId) => ({ seatId, voteValue: "APPROVE", candidateHash })),
    quorumDetail: riskClass === "R1"
      ? { ruleset: "R1", reason: null, approvals: 3, distinctProviderModelFamilies: 3 }
      : riskClass === "R2" ? { ruleset: "R2", reason: null, reviewerApprovals: 2 }
        : riskClass === "R3" ? { ruleset: "R3", reason: null, approvals: 3 }
          : { ruleset: riskClass, reason: null },
    reasonCode: ["R1", "R2", "R3"].includes(riskClass) ? `${riskClass}_QUORUM_MET` : "FIXTURE", ...overrides };
  delete body.recordHash;
  return { ...body, recordHash: computeDecisionRecordHash(body) };
}

function proofFor(record, { config = councilConfig, proofRecord = record } = {}) {
  const decisionRequest = { decisionRequestId: proofRecord.decisionRequestId, taskId: proofRecord.taskId,
    riskClass: proofRecord.riskClass, contextHash: proofRecord.contextHash,
    repositoryHead: proofRecord.repositoryHead, councilEpochId: proofRecord.councilEpochId,
    rotationOrdinal: 0 };
  const votes = ["seat-a", "seat-b", "seat-c"].map((seatId) => ({ decisionRequestId: proofRecord.decisionRequestId,
    candidateHash: proofRecord.candidateHash, seatId, councilEpochId: proofRecord.councilEpochId,
    voteValue: "APPROVE" }));
  const built = buildCouncilQuorumProof({ decisionRequest, councilConfig: config, votes, decisionRecord: proofRecord });
  assert.equal(built.ok, true, built.errorCode);
  return built.proof;
}

function fixture({ riskClass = "R3", record, task, testHooks, proof = undefined,
  registry = trustedRegistry, includeProof = true } = {}) {
  const canonicalRecord = record ?? decisionRecord({ riskClass });
  const canonicalTask = task ?? taskRecord();
  const binderProof = ["R1", "R2", "R3"].includes(canonicalRecord.riskClass)
    ? proofFor(canonicalRecord) : null;
  const canonicalProof = proof ?? binderProof;
  const result = evaluateAuthorization(
    canonicalRecord, canonicalTask, context, 7, POLICY_VERSION, binderProof, trustedRegistry,
  );
  assert.equal(result.status, "ENVELOPE", result.reason);
  const councilQuorumProofs = new Map();
  if (includeProof && canonicalProof) councilQuorumProofs.set(
    `${canonicalRecord.decisionRequestId}\0${canonicalRecord.recordHash}`, canonicalProof,
  );
  const simulation = new LedgerSimulation({ decisionRecords: [canonicalRecord], taskRecords: [canonicalTask],
    councilQuorumProofs, trustedRegistry: registry,
    currentContext: context, currentStopEpoch: 7, privilegedApproverIdentity: "simulated-admin:captured-human", testHooks });
  return { record: canonicalRecord, task: canonicalTask, envelope: result.envelope, simulation };
}

const issue = (simulation, envelope, overrides = {}) => simulation.issueGrant(envelope, {
  grantId: "grant-1", expiresAt: "2030-01-02T00:00:00.000Z",
  authorizedAt: "2030-01-01T00:00:00.000Z", ...overrides,
});
function untouched(simulation, envelope, grant = null) {
  assert.equal(simulation.ledgerState(envelope.authorizationId), null);
  assert.equal(simulation.grantState(envelope.envelopeHash), grant);
}

test("real Binder fixture produces ordered-set-difference scope", () => {
  assert.deepEqual(fixture().envelope.allowedScope, ["alpha", "gamma"]);
});

test("canonical records are cloned and frozen against caller-held mutation", async () => {
  const record = decisionRecord({ riskClass: "R0" }); const task = taskRecord();
  const envelope = evaluateAuthorization(record, task, context, 7).envelope;
  const simulation = new LedgerSimulation({ decisionRecords: [record], taskRecords: [task], currentContext: context, currentStopEpoch: 7 });
  record.disposition = "DENIED"; record.recordHash = `sha256:${"f".repeat(64)}`;
  task.allowedScope.push("caller-widened"); task.taskRecordHash = `sha256:${"e".repeat(64)}`;
  assert.equal((await simulation.checkAndConsume(envelope)).outcome, "ALLOW_ONCE");
  assert.equal(simulation.ledgerState(envelope.authorizationId), "CONSUMED");
});

test("grant issuance captures identity and canonically derives binding", async () => {
  const { envelope, simulation } = fixture(); const grant = await issue(simulation, envelope);
  assert.equal(grant.approverIdentity, "simulated-admin:captured-human");
  assert.equal(grant.envelopeHash, envelope.envelopeHash); assert.equal(grant.boundStopEpoch, 7);
  assert.equal(Object.isFrozen(grant), true);
});

test("grant issuance rejects hash tampering without persistence", async () => {
  const { envelope, simulation } = fixture();
  await assert.rejects(() => issue(simulation, { ...structuredClone(envelope), envelopeHash: `sha256:${"f".repeat(64)}` }), /ENVELOPE_RECOMPUTATION_MISMATCH/);
  untouched(simulation, envelope);
});

test("issueGrant and checkAndConsume independently reject missing proof without mutation", async () => {
  const missing = fixture({ includeProof: false });
  await assert.rejects(() => issue(missing.simulation, missing.envelope), /COUNCIL_PROOF_INELIGIBLE:PROOF_MISSING/);
  assert.equal((await missing.simulation.checkAndConsume(missing.envelope, { now: NOW })).reason, "NO_VALID_GRANT");
  untouched(missing.simulation, missing.envelope);
  const grantless = fixture({ riskClass: "R1", includeProof: false });
  assert.equal((await grantless.simulation.checkAndConsume(grantless.envelope)).reason, "COUNCIL_GATE_NOT_MET");
  untouched(grantless.simulation, grantless.envelope);
});

test("forged council config is rejected against constructor-owned trusted registry", async () => {
  const record = decisionRecord();
  const forgedConfig = structuredClone(councilConfig);
  forgedConfig.seats[0].provider = "forged-provider";
  forgedConfig.seats[0].modelFamily = "forged-family";
  const forged = fixture({ record, proof: proofFor(record, { config: forgedConfig }) });
  await assert.rejects(() => issue(forged.simulation, forged.envelope), /CONFIG_TRUST_INVALID/);
  assert.equal((await forged.simulation.checkAndConsume(forged.envelope, { now: NOW })).reason, "NO_VALID_GRANT");
  untouched(forged.simulation, forged.envelope);
});

test("proof bound to a different DecisionRecord is rejected", async () => {
  const record = decisionRecord();
  const other = decisionRecord({ decisionRequestId: "decision-other" });
  const mismatched = fixture({ record, proof: proofFor(other) });
  await assert.rejects(() => issue(mismatched.simulation, mismatched.envelope), /DECISION_RECORD_HASH_INVALID/);
  assert.equal((await mismatched.simulation.checkAndConsume(mismatched.envelope, { now: NOW })).reason, "NO_VALID_GRANT");
  untouched(mismatched.simulation, mismatched.envelope);
});

test("RECONSTRUCTED proof is ineligible even when its hash is valid", async () => {
  const record = decisionRecord();
  const proof = proofFor(record);
  const withoutHash = { ...proof, provenanceClass: "RECONSTRUCTED" };
  delete withoutHash.proofHash;
  const reconstructed = { ...withoutHash, proofHash: computeProofHash(withoutHash) };
  const subject = fixture({ record, proof: reconstructed });
  await assert.rejects(() => issue(subject.simulation, subject.envelope), /PROVENANCE_NOT_CONTEMPORANEOUS/);
  assert.equal((await subject.simulation.checkAndConsume(subject.envelope, { now: NOW })).reason, "NO_VALID_GRANT");
  untouched(subject.simulation, subject.envelope);
});

test("ambiguous canonical DecisionRecords are rejected at construction", () => {
  const first = decisionRecord({ riskClass: "R0" });
  const second = decisionRecord({ riskClass: "R0", taskId: "task-2" });
  assert.throws(() => new LedgerSimulation({ decisionRecords: [first, second], taskRecords: [taskRecord()],
    currentContext: context, currentStopEpoch: 7 }), /ambiguous canonical DecisionRecord identity/);
});

test("concurrent attempts serialize and exactly one consumes", async () => {
  const { envelope, simulation } = fixture(); await issue(simulation, envelope);
  const attempts = await Promise.all([simulation.checkAndConsume(envelope, { now: NOW }), simulation.checkAndConsume(envelope, { now: NOW })]);
  assert.deepEqual(attempts.map((x) => x.outcome).sort(), ["ALLOW_ONCE", "DENY"]);
  assert.deepEqual(attempts.map((x) => x.reason).sort(), ["POLICY_SATISFIED", "REPLAY_REJECTED"]);
  assert.equal(simulation.grantState(envelope.envelopeHash), "CONSUMED");
});

test("STOP writer waits for an in-flight consumption reader", async () => {
  let release; let enteredResolve;
  const gate = new Promise((resolve) => { release = resolve; });
  const entered = new Promise((resolve) => { enteredResolve = resolve; });
  const { envelope, simulation } = fixture({ riskClass: "R0", testHooks: {
    afterLockedRederivation: async () => { enteredResolve(); await gate; },
  } });
  const consume = simulation.checkAndConsume(envelope); await entered;
  let bumped = false; const bump = simulation.bumpStopEpoch(8).then(() => { bumped = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(bumped, false); release();
  assert.equal((await consume).outcome, "ALLOW_ONCE"); await bump; assert.equal(bumped, true);
  assert.equal((await simulation.checkAndConsume(envelope)).reason, "REVOKED_BY_STOP_EPOCH");
});

test("context drift denies without mutation", async () => {
  const { envelope, simulation } = fixture(); await issue(simulation, envelope);
  simulation.setCurrentContext({ ...context, repositoryHead: "9".repeat(40) });
  assert.equal((await simulation.checkAndConsume(envelope, { now: NOW })).reason, "EXPIRED_BY_DRIFT");
  untouched(simulation, envelope, "AUTHORIZED");
});

test("envelope-hash tampering denies without mutation", async () => {
  const { envelope, simulation } = fixture(); await issue(simulation, envelope);
  const tampered = { ...structuredClone(envelope), envelopeHash: `sha256:${"f".repeat(64)}` };
  assert.equal((await simulation.checkAndConsume(tampered, { now: NOW })).reason, "ENVELOPE_RECOMPUTATION_MISMATCH");
  untouched(simulation, envelope, "AUTHORIZED");
});

test("invalid canonical record and task hashes are rejected at ingestion", () => {
  const record = decisionRecord({ riskClass: "R0" }); record.recordHash = `sha256:${"f".repeat(64)}`;
  assert.throws(() => new LedgerSimulation({ decisionRecords: [record], taskRecords: [taskRecord()],
    currentContext: context, currentStopEpoch: 7 }), /invalid canonical DecisionRecord/);

  const task = taskRecord(); task.taskRecordHash = `sha256:${"e".repeat(64)}`;
  assert.throws(() => new LedgerSimulation({ decisionRecords: [decisionRecord({ riskClass: "R0" })],
    taskRecords: [task], currentContext: context, currentStopEpoch: 7 }), /invalid canonical TaskRecord/);
});

test("Ledger rejects structurally invalid self-hashed DecisionRecords at ingestion", () => {
  const malformed = [
    decisionRecord({ riskClass: "R3", state: "DENIED" }),
    decisionRecord({ riskClass: "R3", votes: [
      { seatId: "seat-a", voteValue: "APPROVE", candidateHash },
      { seatId: "seat-a", voteValue: "APPROVE", candidateHash },
      { seatId: "seat-c", voteValue: "REJECT", candidateHash },
    ] }),
  ];
  for (const record of malformed) {
    assert.throws(() => new LedgerSimulation({ decisionRecords: [record], taskRecords: [taskRecord()],
      currentContext: context, currentStopEpoch: 7 }), /invalid canonical DecisionRecord/);
  }
});

test("Binder and Ledger reject the same self-hashed schema-invalid TaskRecord", () => {
  const malformed = taskRecord({ allowedScope: ["x".repeat(4097)] });
  const record = decisionRecord({ riskClass: "R0" });
  assert.equal(evaluateAuthorization(record, malformed, context, 7).reason, "INVALID_TASK_RECORD");
  assert.throws(() => new LedgerSimulation({ decisionRecords: [record], taskRecords: [malformed],
    currentContext: context, currentStopEpoch: 7 }), /invalid canonical TaskRecord/);
});

test("ambiguous TaskRecord lookup denies without mutation", async () => {
  const valid = fixture(); const duplicate = taskRecord({ objective: "duplicate" });
  const simulation = new LedgerSimulation({ decisionRecords: [valid.record], taskRecords: [valid.task, duplicate], currentContext: context, currentStopEpoch: 7 });
  assert.equal((await simulation.checkAndConsume(valid.envelope, { now: NOW })).reason, "TASK_RECORD_LOOKUP_AMBIGUOUS");
  untouched(simulation, valid.envelope);
});

test("bound grant epoch mismatch after STOP denies without consuming", async () => {
  const { envelope, simulation } = fixture(); await issue(simulation, envelope); await simulation.bumpStopEpoch(8);
  assert.equal((await simulation.checkAndConsume(envelope, { now: NOW })).reason, "REVOKED_BY_STOP_EPOCH");
  untouched(simulation, envelope, "AUTHORIZED");
});

test("revoked and consumed grants cannot authorize again", async () => {
  const revoked = fixture(); await issue(revoked.simulation, revoked.envelope);
  await revoked.simulation.revokeGrant(revoked.envelope, { stateChangedAt: NOW });
  assert.equal((await revoked.simulation.checkAndConsume(revoked.envelope, { now: NOW })).reason, "NO_VALID_GRANT");
  untouched(revoked.simulation, revoked.envelope, "REVOKED");
  const consumed = fixture(); await issue(consumed.simulation, consumed.envelope);
  assert.equal((await consumed.simulation.checkAndConsume(consumed.envelope, { now: NOW })).outcome, "ALLOW_ONCE");
  assert.equal((await consumed.simulation.checkAndConsume(consumed.envelope, { now: NOW })).reason, "REPLAY_REJECTED");
  assert.equal(consumed.simulation.grantState(consumed.envelope.envelopeHash), "CONSUMED");
});

test("invalid now and expiry deny without mutation", async () => {
  for (const [now, reason] of [["bad", "INVALID_NOW"], ["2030-01-03T00:00:00.000Z", "GRANT_EXPIRED"]]) {
    const { envelope, simulation } = fixture(); await issue(simulation, envelope);
    assert.equal((await simulation.checkAndConsume(envelope, { now })).reason, reason);
    untouched(simulation, envelope, "AUTHORIZED");
  }
});

test("R0, R1, and R2 consume exactly once without grants", async () => {
  for (const riskClass of ["R0", "R1", "R2"]) {
    const { envelope, simulation } = fixture({ riskClass });
    assert.equal((await simulation.checkAndConsume(envelope)).outcome, "ALLOW_ONCE", riskClass);
    assert.equal(simulation.ledgerState(envelope.authorizationId), "CONSUMED");
    assert.equal(simulation.grantState(envelope.envelopeHash), null);
  }
});

test("forged canonical claims cannot bypass R3 grant", async () => {
  const { envelope, simulation } = fixture();
  const forged = { ...structuredClone(envelope), authorizationId: `sha256:${"0".repeat(64)}`,
    allowedScope: ["global"], riskClass: "R0", disposition: "POLICY_SATISFIED" };
  const denied = await simulation.checkAndConsume(forged, { now: NOW });
  assert.equal(denied.reason, "NO_VALID_GRANT"); assert.equal(denied.canonicalAuthorizationId, envelope.authorizationId);
  untouched(simulation, envelope);
});
