import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";

import {
  computeAuthorizationEnvelopeHash,
  evaluateAuthorization as evaluateAuthorizationWithoutEvidence,
} from "../../scripts/dev/authorization-binder.mjs";
import {
  applyEvent, computeCommitmentHash, computeDecisionRecordHash, createSession,
} from "../../scripts/dev/decision-council-kernel.mjs";
import {
  buildCouncilQuorumProof, computeProofHash, makeRegistryEntry,
} from "../../scripts/dev/council-quorum-proof.mjs";
import { computeTaskRecordHash } from "../../scripts/dev/run-bundle.mjs";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS: ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL: ${name}\n${error.stack}`); }
}

const contextHash = `sha256:${"1".repeat(64)}`;
const repositoryHead = "2".repeat(40);
const currentContext = { contextHash, repositoryHead };

function selfHash(body, field, compute) {
  return { ...body, [field]: compute(body) };
}

function councilConfig(modelSuffix = "") {
  return { epochId: "council-epoch-1", seats: [
    { seatId: "seat-a", provider: "provider-a", modelFamily: "family-a", modelId: `model-a${modelSuffix}`, councilEpochId: "council-epoch-1" },
    { seatId: "seat-b", provider: "provider-b", modelFamily: "family-b", modelId: "model-b", councilEpochId: "council-epoch-1" },
    { seatId: "seat-c", provider: "provider-c", modelFamily: "family-c", modelId: "model-c", councilEpochId: "council-epoch-1" },
  ] };
}

function councilBundle(riskClass, voteValues) {
  const decisionRequest = { decisionRequestId: "decision-1", taskId: "task-1", riskClass,
    contextHash, repositoryHead, councilEpochId: "council-epoch-1", rotationOrdinal: 0 };
  const config = councilConfig();
  let admitted = createSession(decisionRequest, config, currentContext);
  assert.equal(admitted.ok, true);
  let { session } = admitted;
  const proposalContent = { summary: "Authorize fixture", payload: { fixture: true } };
  const common = { decisionRequestId: decisionRequest.decisionRequestId, seatId: "seat-a", councilEpochId: decisionRequest.councilEpochId };
  session = applyEvent(session, { type: "SUBMIT_COMMITMENT", commitment: { ...common, commitmentHash: computeCommitmentHash(proposalContent) } }).session;
  session = applyEvent(session, { type: "REVEAL_PROPOSAL", proposal: { ...common, proposalContent } }).session;
  session = applyEvent(session, { type: "FREEZE_CANDIDATE" }).session;
  const votes = voteValues.map(([seatId, voteValue]) => ({ decisionRequestId: decisionRequest.decisionRequestId,
    candidateHash: session.candidateDecision.candidateHash, seatId, councilEpochId: decisionRequest.councilEpochId, voteValue }));
  for (const vote of votes) session = applyEvent(session, { type: "CAST_VOTE", vote }).session;
  session = applyEvent(session, { type: "FINALIZE" }).session;
  const built = buildCouncilQuorumProof({ decisionRequest, councilConfig: config, votes, decisionRecord: session.decisionRecord });
  const registered = makeRegistryEntry(config);
  assert.equal(built.ok, true);
  assert.equal(registered.ok, true);
  return { decisionRequest, councilConfig: config, votes, decisionRecord: session.decisionRecord,
    proof: built.proof, trustedRegistry: { [config.epochId]: registered.entry } };
}

const bundles = {
  R1: councilBundle("R1", [["seat-a", "APPROVE"], ["seat-b", "APPROVE"]]),
  R2: councilBundle("R2", [["seat-b", "APPROVE"], ["seat-c", "APPROVE"]]),
  R3: councilBundle("R3", [["seat-a", "APPROVE"], ["seat-b", "APPROVE"], ["seat-c", "APPROVE"]]),
};
const evidenceByRecordHash = new Map(Object.values(bundles)
  .map((bundle) => [bundle.decisionRecord.recordHash, bundle]));

function decision(overrides = {}) {
  const riskClass = overrides.riskClass ?? "R2";
  const disposition = overrides.disposition ?? ({
    R0: "COUNCIL_NOT_REQUIRED",
    R1: "COUNCIL_APPROVED",
    R2: "COUNCIL_APPROVED",
    R3: "HUMAN_APPROVAL_REQUIRED",
    R4: "DENIED",
  })[riskClass];
  if (["R1", "R2", "R3"].includes(riskClass)) {
    const body = { ...structuredClone(bundles[riskClass].decisionRecord), ...overrides };
    delete body.recordHash;
    return selfHash(body, "recordHash", computeDecisionRecordHash);
  }
  const state = overrides.state ?? (riskClass === "R0" ? "COUNCIL_NOT_REQUIRED"
    : riskClass === "R4" ? "DENIED" : disposition === "NO_QUORUM" ? "NO_QUORUM" : "DECIDED");
  const candidateHash = `sha256:${"3".repeat(64)}`;
  const votes = riskClass === "R0" || riskClass === "R4" ? [] : [
    { seatId: "seat-a", voteValue: "APPROVE", candidateHash },
    { seatId: "seat-b", voteValue: "APPROVE", candidateHash },
    disposition === "NO_QUORUM"
      ? { seatId: "seat-c", voteValue: "REJECT", candidateHash }
      : { seatId: "seat-c", voteValue: "APPROVE", candidateHash },
  ];
  const body = {
    decisionRequestId: "decision-1",
    taskId: "task-1",
    riskClass,
    contextHash,
    repositoryHead,
    councilEpochId: "council-epoch-1",
    state,
    disposition,
    candidateHash: riskClass === "R0" || riskClass === "R4" ? null : candidateHash,
    proposerSeatId: riskClass === "R0" || riskClass === "R4" ? null : "seat-a",
    votes,
    quorumDetail: { ruleset: riskClass, reason: null },
    reasonCode: "FIXTURE",
    ...overrides,
  };
  delete body.recordHash;
  return selfHash(body, "recordHash", computeDecisionRecordHash);
}

function authorize(record, taskRecord, context = currentContext, stopEpoch = 7, policyVersion = "authorization-policy/v1") {
  const evidence = evidenceByRecordHash.get(record?.recordHash);
  return evaluateAuthorizationWithoutEvidence(record, taskRecord, context, stopEpoch, policyVersion,
    evidence?.proof, evidence?.trustedRegistry);
}

function task(overrides = {}) {
  const body = {
    taskId: "task-1",
    objective: "Exercise the authorization binder",
    branch: "feat/test",
    baseCommit: "4".repeat(40),
    allowedScope: ["schemas/a.json", "scripts/b.mjs"],
    forbiddenScope: ["docs/secret.md"],
    disposition: "IN_PROGRESS",
    unresolvedRisks: [],
    humanActionRequested: "Review the result",
    ...overrides,
  };
  delete body.taskRecordHash;
  return selfHash(body, "taskRecordHash", computeTaskRecordHash);
}

const schema = JSON.parse(readFileSync(new URL("../../schemas/dev/authorization-envelope.schema.json", import.meta.url), "utf8"));
const validateEnvelope = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

test("happy path creates a schema-valid deterministic envelope and identity", () => {
  const one = authorize(decision(), task());
  const two = authorize(decision(), task());
  assert.equal(one.status, "ENVELOPE");
  assert.deepEqual(one, two);
  assert.equal(one.envelope.authorizationId, two.envelope.authorizationId);
  assert.equal(one.envelope.envelopeHash, two.envelope.envelopeHash);
  assert.equal(validateEnvelope(one.envelope), true, JSON.stringify(validateEnvelope.errors));
});

test("BLOCKED TaskRecord fails closed", () => {
  assert.deepEqual(
    authorize(decision(), task({ disposition: "BLOCKED" }), currentContext, 7),
    { status: "NO_ENVELOPE", reason: "TASK_RECORD_BLOCKED" },
  );
});

test("scope is the ordered set difference with duplicates in both inputs", () => {
  const record = task({
    allowedScope: ["safe", "forbidden", "safe", "also-safe", "forbidden", "also-safe"],
    forbiddenScope: ["forbidden", "forbidden"],
  });
  assert.deepEqual(
    authorize(decision(), record, currentContext, 7).envelope.allowedScope,
    ["safe", "also-safe"],
  );
});

test("duplicate allowed scope tokens never expand authority and preserve first appearance", () => {
  const record = task({ allowedScope: ["b", "a", "b", "c", "a"], forbiddenScope: [] });
  const result = authorize(decision(), record, currentContext, 7);
  assert.deepEqual(result.envelope.allowedScope, ["b", "a", "c"]);
});

test("an all-forbidden allowedScope produces an empty effective scope", () => {
  const once = task({ allowedScope: ["x"], forbiddenScope: ["x"] });
  const repeated = task({ allowedScope: ["x", "x"], forbiddenScope: ["x", "x", "x"] });
  assert.deepEqual(authorize(decision(), once, currentContext, 7).envelope.allowedScope, []);
  assert.deepEqual(authorize(decision(), repeated, currentContext, 7).envelope.allowedScope, []);
});

test("stale context hash and stale repository head are rejected", () => {
  assert.equal(authorize(decision(), task(), { ...currentContext, contextHash: `sha256:${"9".repeat(64)}` }, 7).reason, "CONTEXT_ALREADY_STALE");
  assert.equal(authorize(decision(), task(), { ...currentContext, repositoryHead: "9".repeat(40) }, 7).reason, "CONTEXT_ALREADY_STALE");
});

test("invalid or stale-shaped stop epoch input is rejected", () => {
  assert.equal(authorize(decision(), task(), currentContext, -1).reason, "INVALID_STOP_EPOCH");
  assert.equal(authorize(decision(), task(), currentContext, { current: 8, bound: 7 }).reason, "INVALID_STOP_EPOCH");
});

test("a changed current stop epoch changes the immutable envelope binding", () => {
  const before = authorize(decision(), task(), currentContext, 7).envelope;
  const after = authorize(decision(), task(), currentContext, 8).envelope;
  assert.notEqual(before.envelopeHash, after.envelopeHash);
  assert.equal(before.stopEpoch, 7);
  assert.equal(after.stopEpoch, 8);
});

test("risk downgrade by changing risk without a matching record hash is impossible", () => {
  const canonical = decision({ riskClass: "R3" });
  const altered = { ...canonical, riskClass: "R1", disposition: "COUNCIL_APPROVED" };
  assert.equal(authorize(altered, task(), currentContext, 7).reason, "INVALID_DECISION_RECORD");
});

test("risk and disposition mismatch fails closed even when self-hashed", () => {
  const mismatched = decision({ riskClass: "R3", disposition: "COUNCIL_APPROVED" });
  assert.equal(authorize(mismatched, task(), currentContext, 7).reason, "INVALID_DECISION_RECORD");
});

test("self-hashed semantic risk downgrade is rejected", () => {
  const downgraded = decision({ riskClass: "R1", state: "DENIED", disposition: "DENIED" });
  assert.equal(authorize(downgraded, task(), currentContext, 7).reason, "INVALID_DECISION_RECORD");
});

test("self-hashed R3 records require a candidate, proposer, and three valid approvals", () => {
  assert.equal(authorize(decision({ riskClass: "R3", candidateHash: null }), task(), currentContext, 7).reason, "INVALID_DECISION_RECORD");
  assert.equal(authorize(decision({ riskClass: "R3", proposerSeatId: null }), task(), currentContext, 7).reason, "INVALID_DECISION_RECORD");
  const malformedVotes = decision({ riskClass: "R3", votes: [
    { seatId: "seat-a", voteValue: "APPROVE", candidateHash: `sha256:${"3".repeat(64)}` },
    { seatId: "seat-a", voteValue: "APPROVE", candidateHash: `sha256:${"3".repeat(64)}` },
    { seatId: "seat-c", voteValue: "REJECT", candidateHash: `sha256:${"3".repeat(64)}` },
  ] });
  assert.equal(authorize(malformedVotes, task(), currentContext, 7).reason, "INVALID_DECISION_RECORD");
});

test("self-hashed malformed vote entries are rejected", () => {
  const malformed = decision({ votes: [
    { seatId: "seat-a", voteValue: "YES", candidateHash: `sha256:${"3".repeat(64)}` },
    { seatId: "seat-b", voteValue: "APPROVE", candidateHash: `sha256:${"3".repeat(64)}` },
    { seatId: "seat-c", voteValue: "APPROVE", candidateHash: `sha256:${"3".repeat(64)}` },
  ] });
  assert.equal(authorize(malformed, task(), currentContext, 7).reason, "INVALID_DECISION_RECORD");
});

test("self-hashed TaskRecords outside schema bounds are rejected", () => {
  const oversizedScopeToken = task({ allowedScope: ["x".repeat(4097)] });
  const oversizedRisk = task({ unresolvedRisks: ["x".repeat(2001)] });
  assert.equal(authorize(decision(), oversizedScopeToken, currentContext, 7).reason, "INVALID_TASK_RECORD");
  assert.equal(authorize(decision(), oversizedRisk, currentContext, 7).reason, "INVALID_TASK_RECORD");
});

test("R1, R2, and R3 require eligible council proof evidence", () => {
  for (const riskClass of ["R1", "R2", "R3"]) {
    const result = evaluateAuthorizationWithoutEvidence(
      bundles[riskClass].decisionRecord, task(), currentContext, 7,
    );
    assert.equal(result.status, "NO_ENVELOPE");
    assert.equal(result.reason, "UNKNOWN_PROOF_VERSION");
  }
});

test("a proof whose council config is absent from the trusted registry is denied", () => {
  const canonical = bundles.R2;
  const forged = buildCouncilQuorumProof({
    decisionRequest: canonical.decisionRequest,
    councilConfig: councilConfig("-forged"),
    votes: canonical.votes,
    decisionRecord: canonical.decisionRecord,
  });
  assert.equal(forged.ok, true);
  const result = evaluateAuthorizationWithoutEvidence(canonical.decisionRecord, task(), currentContext, 7,
    "authorization-policy/v1", forged.proof, canonical.trustedRegistry);
  assert.deepEqual(result, { status: "NO_ENVELOPE", reason: "CONFIG_TRUST_INVALID" });
});

test("a valid proof bound to a different valid DecisionRecord is denied", () => {
  const proofOwner = bundles.R1;
  const result = evaluateAuthorizationWithoutEvidence(
    bundles.R2.decisionRecord, task(), currentContext, 7, "authorization-policy/v1",
    proofOwner.proof, proofOwner.trustedRegistry,
  );
  assert.deepEqual(result, { status: "NO_ENVELOPE", reason: "DECISION_RECORD_HASH_INVALID" });
});

test("a correctly rehashed reconstructed proof is denied", () => {
  const canonical = bundles.R2;
  const proofWithoutHash = {
    ...structuredClone(canonical.proof),
    provenanceClass: "RECONSTRUCTED",
  };
  delete proofWithoutHash.proofHash;
  const proof = { ...proofWithoutHash, proofHash: computeProofHash(proofWithoutHash) };
  const result = evaluateAuthorizationWithoutEvidence(
    canonical.decisionRecord, task(), currentContext, 7, "authorization-policy/v1",
    proof, canonical.trustedRegistry,
  );
  assert.deepEqual(result, { status: "NO_ENVELOPE", reason: "PROVENANCE_NOT_CONTEMPORANEOUS" });
});

test("R4 and NO_QUORUM never generate an envelope", () => {
  assert.equal(authorize(decision({ riskClass: "R4" }), task(), currentContext, 7).reason, "R4_HARD_DENY");
  const noQuorum = decision({ riskClass: "R2", disposition: "NO_QUORUM", state: "NO_QUORUM" });
  assert.equal(authorize(noQuorum, task(), currentContext, 7).reason, "COUNCIL_GATE_NOT_MET");
});

test("R3 without a grant is pending and has no execute-shaped disposition", () => {
  const envelope = authorize(decision({ riskClass: "R3" }), task(), currentContext, 7).envelope;
  assert.equal(envelope.disposition, "PENDING_HUMAN_APPROVAL");
  assert.deepEqual(envelope.humanApproval, { required: true, grantRef: null });
  assert.notEqual(envelope.disposition, "POLICY_SATISFIED");
});

test("R0 with no proof follows envelope policy and does not acquire an executable flag", () => {
  const envelope = authorize(decision({ riskClass: "R0" }), task(), currentContext, 7).envelope;
  assert.equal(envelope.disposition, "POLICY_SATISFIED");
  assert.equal("executable" in envelope, false);
  assert.equal(envelope.actionType, "UNDEFINED_PENDING_EXECUTION_GATEWAY");
});

test("the envelope and every nested mutation path are frozen", () => {
  const result = authorize(decision(), task(), currentContext, 7);
  const { envelope } = result;
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(envelope), true);
  assert.equal(Object.isFrozen(envelope.allowedScope), true);
  assert.equal(Object.isFrozen(envelope.humanApproval), true);
  assert.throws(() => { envelope.allowedScope.push("wider"); }, TypeError);
  assert.throws(() => { envelope.humanApproval.grantRef = "grant-1"; }, TypeError);
  assert.throws(() => { envelope.disposition = "CONSUMED"; }, TypeError);
});

test("grantRef cannot mutate envelope identity or hash", () => {
  const envelope = authorize(decision({ riskClass: "R3" }), task(), currentContext, 7).envelope;
  const identity = envelope.authorizationId;
  const hash = envelope.envelopeHash;
  assert.throws(() => { envelope.humanApproval.grantRef = "grant-external"; }, TypeError);
  assert.equal(envelope.humanApproval.grantRef, null);
  assert.equal(envelope.authorizationId, identity);
  assert.equal(envelope.envelopeHash, hash);
  const { envelopeHash, ...body } = envelope;
  assert.equal(computeAuthorizationEnvelopeHash(body), envelopeHash);
});

console.log(`authorization-binder: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
