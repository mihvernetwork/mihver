import test from "node:test";
import assert from "node:assert/strict";
import {
  buildShadowSeatInvocationFailure,
  computeInvocationFailureHash,
  verifyInvocationFailureHash,
} from "../../scripts/dev/shadow-council-invocation-failure.mjs";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const base = (overrides = {}) => ({
  decisionRequestId: "dr-1",
  councilEpochId: "epoch-1",
  seatId: "seat-1",
  provider: "openai",
  requestedModelId: "gpt-5.6-sol",
  invocationRole: "VOTER",
  candidateHash: HASH_A,
  stage: "SHADOW_RESPONSE_JSON_PARSE",
  errorCode: "INVALID_JSON",
  details: { field: "stdout", reason: "parse" },
  packetHash: HASH_A,
  invocationConfigHash: HASH_A,
  stdoutHash: HASH_A,
  stderrHash: HASH_A,
  stdoutByteLength: 10,
  stderrByteLength: 2,
  outputHash: HASH_A,
  attestationHash: HASH_A,
  assessmentFailure: null,
  ...overrides,
});

const expectMalformed = (input) => {
  const result = buildShadowSeatInvocationFailure(input);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "MALFORMED_INVOCATION_FAILURE_INPUT");
  assert.equal(typeof result.details, "object");
};

test("builds VOTER and PROPOSER failures", () => {
  const voter = buildShadowSeatInvocationFailure(base());
  assert.equal(voter.ok, true);
  assert.match(voter.failure.failureHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(verifyInvocationFailureHash(voter.failure), true);

  const proposer = buildShadowSeatInvocationFailure(base({ invocationRole: "PROPOSER", candidateHash: null }));
  assert.equal(proposer.ok, true);
  assert.equal(proposer.failure.candidateHash, null);
});

test("each hash-or-null field accepts a valid hash and null, and rejects malformed hashes", () => {
  for (const field of ["packetHash", "invocationConfigHash", "stdoutHash", "stderrHash", "outputHash", "attestationHash"]) {
    assert.equal(buildShadowSeatInvocationFailure(base({ [field]: HASH_B })).ok, true, `${field} hash`);
    assert.equal(buildShadowSeatInvocationFailure(base({ [field]: null })).ok, true, `${field} null`);
    expectMalformed(base({ [field]: "sha256:not-a-hash" }));
  }
});

test("enforces candidateHash role rule", () => {
  expectMalformed(base({ invocationRole: "PROPOSER", candidateHash: HASH_A }));
  expectMalformed(base({ invocationRole: "VOTER", candidateHash: null }));
});

test("rejects missing, extra, unknown stage, and empty error code", () => {
  const missing = base();
  delete missing.seatId;
  expectMalformed(missing);
  expectMalformed({ ...base(), extra: true });
  expectMalformed(base({ stage: "UNKNOWN" }));
  expectMalformed(base({ errorCode: "" }));
});

test("provider and requestedModelId are required non-empty strings", () => {
  for (const field of ["provider", "requestedModelId"]) {
    expectMalformed(base({ [field]: "" }));
    expectMalformed(base({ [field]: null }));
  }
});

test("details must be a plain canonicalizable object", () => {
  assert.equal(buildShadowSeatInvocationFailure(base({ details: {} })).ok, true);
  assert.equal(buildShadowSeatInvocationFailure(base({ details: { field: "vote", nested: [1, true, null] } })).ok, true);
  for (const details of [null, [], "details", new Date()]) expectMalformed(base({ details }));
  const cyclic = {};
  cyclic.self = cyclic;
  expectMalformed(base({ details: cyclic }));
});

test("assessmentFailure accepts null or the exact failed-assessment shape", () => {
  assert.equal(buildShadowSeatInvocationFailure(base({ assessmentFailure: null })).ok, true);
  assert.equal(buildShadowSeatInvocationFailure(base({ assessmentFailure: { errorCode: "MALFORMED_ASSESSMENT_INPUT", details: { field: "voteValue" } } })).ok, true);
  expectMalformed(base({ assessmentFailure: { details: {} } }));
  expectMalformed(base({ assessmentFailure: { errorCode: "", details: {} } }));
});

test("byte lengths accept non-negative integers or null", () => {
  for (const field of ["stdoutByteLength", "stderrByteLength"]) {
    assert.equal(buildShadowSeatInvocationFailure(base({ [field]: 0 })).ok, true);
    assert.equal(buildShadowSeatInvocationFailure(base({ [field]: null })).ok, true);
    for (const value of [-1, 1.5, "1"]) expectMalformed(base({ [field]: value }));
  }
});

test("computeInvocationFailureHash is domain-separated and deterministic", () => {
  const input = base();
  assert.equal(computeInvocationFailureHash(input), computeInvocationFailureHash({ ...input }));
  assert.match(computeInvocationFailureHash(input), /^sha256:[0-9a-f]{64}$/);
});

test("verification fails after every field is mutated in turn", () => {
  const built = buildShadowSeatInvocationFailure(base({
    assessmentFailure: { errorCode: "MALFORMED_ASSESSMENT_INPUT", details: { field: "voteValue" } },
  }));
  assert.equal(built.ok, true);
  assert.equal(verifyInvocationFailureHash(built.failure), true);

  const mutations = {
    failureHash: HASH_B,
    decisionRequestId: "dr-2",
    councilEpochId: "epoch-2",
    seatId: "seat-2",
    provider: "anthropic",
    requestedModelId: "claude-opus-5",
    invocationRole: "PROPOSER",
    candidateHash: HASH_B,
    stage: "SPAWN",
    errorCode: "INVALID_JSON_",
    details: { field: "stdout", reason: "parse!" },
    packetHash: HASH_B,
    invocationConfigHash: HASH_B,
    stdoutHash: HASH_B,
    stderrHash: HASH_B,
    stdoutByteLength: 11,
    stderrByteLength: 3,
    outputHash: HASH_B,
    attestationHash: HASH_B,
    assessmentFailure: { errorCode: "MALFORMED_ASSESSMENT_INPUT", details: { field: "voteValue!" } },
  };
  assert.deepEqual(Object.keys(mutations), Object.keys(built.failure));
  for (const [field, value] of Object.entries(mutations)) {
    assert.equal(verifyInvocationFailureHash({ ...built.failure, [field]: value }), false, field);
  }
});
