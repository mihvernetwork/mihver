import { createHash } from "node:crypto";
import { canonicalizeJson } from "./canonical-json.mjs";

const HASH64 = /^sha256:[0-9a-f]{64}$/;
const HEX40 = /^[0-9a-f]{40}$/;
const RISKS = new Set(["R0", "R1", "R2", "R3", "R4"]);
const VOTE_VALUES = new Set(["APPROVE", "REJECT", "ABSTAIN"]);
const RECORD_VOTE_VALUES = new Set([...VOTE_VALUES, "MISSING"]);
const RECORD_STATES = new Set(["COUNCIL_NOT_REQUIRED", "DECIDED", "NO_QUORUM", "DENIED"]);
const RECORD_DISPOSITIONS = new Set(["COUNCIL_NOT_REQUIRED", "COUNCIL_APPROVED",
  "HUMAN_APPROVAL_REQUIRED", "NO_QUORUM", "DENIED"]);
const REQUEST_FIELDS = ["decisionRequestId", "taskId", "riskClass", "contextHash", "repositoryHead", "councilEpochId"];
const DECISION_RECORD_FIELDS = [...REQUEST_FIELDS, "state", "disposition", "candidateHash",
  "proposerSeatId", "votes", "quorumDetail", "reasonCode", "recordHash"];
const DOMAINS = {
  config: "MIHVER:DecisionCouncil:CouncilConfig:v1\0",
  proof: "MIHVER:DecisionCouncil:CouncilQuorumProof:v1\0",
  record: "MIHVER:DecisionCouncil:DecisionRecord:v1\0",
};

const ownObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const exactKeys = (value, keys) => ownObject(value) && Object.keys(value).length === keys.length
  && keys.every((key) => hasOwn(value, key));
const nonempty = (value) => typeof value === "string" && value.length > 0;
const hash64 = (value) => typeof value === "string" && HASH64.test(value);
const hex40 = (value) => typeof value === "string" && HEX40.test(value);
const digest = (domain, value) => `sha256:${createHash("sha256")
  .update(Buffer.from(domain, "utf8")).update(Buffer.from(canonicalizeJson(value), "utf8")).digest("hex")}`;
const without = (value, omitted) => Object.fromEntries(Object.entries(value).filter(([key]) => key !== omitted));
const same = (left, right) => {
  try { return canonicalizeJson(left) === canonicalizeJson(right); } catch { return false; }
};

function validSeat(value) {
  const keys = ["seatId", "provider", "modelFamily", "modelId", "councilEpochId"];
  return exactKeys(value, keys) && keys.every((key) => nonempty(value[key]));
}

function validCouncilConfig(value) {
  if (!exactKeys(value, ["epochId", "seats"]) || !nonempty(value.epochId)
      || !Array.isArray(value.seats) || value.seats.length !== 3 || !value.seats.every(validSeat)) return false;
  const seatIds = value.seats.map(({ seatId }) => seatId);
  const identities = value.seats.map(({ provider, modelFamily, modelId }) => `${provider}\0${modelFamily}\0${modelId}`);
  return new Set(seatIds).size === 3 && new Set(identities).size === 3
    && value.seats.every(({ councilEpochId }) => councilEpochId === value.epochId);
}

function validRequest(value) {
  const keys = [...REQUEST_FIELDS, "rotationOrdinal"];
  return exactKeys(value, keys) && nonempty(value.decisionRequestId) && nonempty(value.taskId)
    && RISKS.has(value.riskClass) && HASH64.test(value.contextHash) && HEX40.test(value.repositoryHead)
    && nonempty(value.councilEpochId) && Number.isInteger(value.rotationOrdinal) && value.rotationOrdinal >= 0;
}

function validVote(value) {
  return exactKeys(value, ["decisionRequestId", "candidateHash", "seatId", "councilEpochId", "voteValue"])
    && nonempty(value.decisionRequestId) && HASH64.test(value.candidateHash) && nonempty(value.seatId)
    && nonempty(value.councilEpochId) && VOTE_VALUES.has(value.voteValue);
}

function validDecisionRecordVote(value) {
  return exactKeys(value, ["seatId", "voteValue", "candidateHash"])
    && nonempty(value.seatId) && RECORD_VOTE_VALUES.has(value.voteValue)
    && (value.candidateHash === null || hash64(value.candidateHash));
}

function validDecisionRecord(value) {
  return exactKeys(value, DECISION_RECORD_FIELDS)
    && nonempty(value.decisionRequestId) && nonempty(value.taskId) && RISKS.has(value.riskClass)
    && hash64(value.contextHash) && hex40(value.repositoryHead) && nonempty(value.councilEpochId)
    && RECORD_STATES.has(value.state) && RECORD_DISPOSITIONS.has(value.disposition)
    && (value.candidateHash === null || hash64(value.candidateHash))
    && (value.proposerSeatId === null || nonempty(value.proposerSeatId))
    && Array.isArray(value.votes) && value.votes.every(validDecisionRecordVote)
    && ownObject(value.quorumDetail) && hasOwn(value.quorumDetail, "ruleset")
    && hasOwn(value.quorumDetail, "reason") && nonempty(value.quorumDetail.ruleset)
    && (value.quorumDetail.reason === null || typeof value.quorumDetail.reason === "string")
    && nonempty(value.reasonCode) && hash64(value.recordHash);
}

function validProof(value) {
  return exactKeys(value, ["proofVersion", "decisionRequest", "decisionRecordHash", "quorumRuleVersion",
    "councilConfig", "councilConfigHash", "votes", "provenanceClass", "proofHash"])
    && value.proofVersion === "1" && validRequest(value.decisionRequest) && HASH64.test(value.decisionRecordHash)
    && value.quorumRuleVersion === "decision-council-v1a" && validCouncilConfig(value.councilConfig)
    && HASH64.test(value.councilConfigHash) && Array.isArray(value.votes) && value.votes.every(validVote)
    && ["CONTEMPORANEOUS", "RECONSTRUCTED"].includes(value.provenanceClass) && HASH64.test(value.proofHash);
}

function failure(errorCode, details = {}) { return { ok: false, errorCode, details }; }

export function computeCouncilConfigHash(councilConfig) { return digest(DOMAINS.config, councilConfig); }
export function computeProofHash(proofWithoutHash) { return digest(DOMAINS.proof, proofWithoutHash); }

export function makeRegistryEntry(councilConfig) {
  if (!validCouncilConfig(councilConfig)) return failure("MALFORMED_COUNCIL_CONFIG");
  return { ok: true, entry: { councilEpochId: councilConfig.epochId, councilConfig, councilConfigHash: computeCouncilConfigHash(councilConfig) } };
}

export function lookupTrustedConfigHash(registry, councilEpochId) {
  if (Array.isArray(registry)) return registry.find((entry) => entry?.councilEpochId === councilEpochId)?.councilConfigHash ?? null;
  if (ownObject(registry)) return registry[councilEpochId]?.councilConfigHash ?? null;
  return null;
}

export function buildCouncilQuorumProof({ decisionRequest, councilConfig, votes, decisionRecord } = {}) {
  if (!validRequest(decisionRequest)) return failure("MALFORMED_ARTIFACT", { artifact: "DecisionRequest" });
  if (!validCouncilConfig(councilConfig)) return failure("MALFORMED_COUNCIL_CONFIG");
  if (!Array.isArray(votes) || !votes.every(validVote)) return failure("MALFORMED_ARTIFACT", { artifact: "AgentVote" });
  if (!validDecisionRecord(decisionRecord)) return failure("DECISION_RECORD_MALFORMED");
  for (const field of REQUEST_FIELDS) {
    if (decisionRequest[field] !== decisionRecord[field]) return failure("DECISION_REQUEST_RECORD_MISMATCH", { field });
  }
  let computedRecordHash;
  try { computedRecordHash = digest(DOMAINS.record, without(decisionRecord, "recordHash")); }
  catch { return failure("MALFORMED_ARTIFACT", { artifact: "DecisionRecord" }); }
  if (computedRecordHash !== decisionRecord.recordHash) return failure("DECISION_RECORD_HASH_INVALID");
  const proofWithoutHash = {
    proofVersion: "1", decisionRequest, decisionRecordHash: decisionRecord.recordHash,
    quorumRuleVersion: "decision-council-v1a", councilConfig,
    councilConfigHash: computeCouncilConfigHash(councilConfig), votes,
    provenanceClass: "CONTEMPORANEOUS",
  };
  return { ok: true, proof: { ...proofWithoutHash, proofHash: computeProofHash(proofWithoutHash) } };
}

function recomputeQuorum(request, config, votes) {
  const approvals = votes.filter(({ voteValue }) => voteValue === "APPROVE");
  if (request.riskClass === "R1") {
    if (approvals.length < 2) return { met: false, ruleset: "R1", reason: "R1_INSUFFICIENT_APPROVALS", detail: { ruleset: "R1", reason: "R1_INSUFFICIENT_APPROVALS", approvals: approvals.length } };
    const identities = new Set(approvals.map(({ seatId }) => {
      const seat = config.seats.find((item) => item.seatId === seatId);
      return seat ? `${seat.provider}\0${seat.modelFamily}` : "";
    }));
    if (identities.size < 2) return { met: false, ruleset: "R1", reason: "R1_DIVERSITY_REQUIREMENT_NOT_MET", detail: { ruleset: "R1", reason: "R1_DIVERSITY_REQUIREMENT_NOT_MET", approvals: approvals.length, distinctProviderModelFamilies: identities.size } };
    return { met: true, ruleset: "R1", reason: "R1_QUORUM_MET", detail: { ruleset: "R1", reason: null, approvals: approvals.length, distinctProviderModelFamilies: identities.size } };
  }
  if (request.riskClass === "R2") {
    const proposer = config.seats[request.rotationOrdinal % 3].seatId;
    const reviewerVotes = config.seats.filter(({ seatId }) => seatId !== proposer)
      .map(({ seatId }) => votes.find((vote) => vote.seatId === seatId));
    const count = reviewerVotes.filter((vote) => vote?.voteValue === "APPROVE").length;
    if (reviewerVotes.some((vote) => vote?.voteValue === "REJECT")) return { met: false, ruleset: "R2", reason: "R2_REVIEWER_REJECTED", detail: { ruleset: "R2", reason: "R2_REVIEWER_REJECTED", reviewerApprovals: count } };
    if (!reviewerVotes.every((vote) => vote?.voteValue === "APPROVE")) return { met: false, ruleset: "R2", reason: "R2_INSUFFICIENT_REVIEWER_APPROVALS", detail: { ruleset: "R2", reason: "R2_INSUFFICIENT_REVIEWER_APPROVALS", reviewerApprovals: count } };
    return { met: true, ruleset: "R2", reason: "R2_QUORUM_MET", detail: { ruleset: "R2", reason: null, reviewerApprovals: 2 } };
  }
  if (approvals.length !== 3) return { met: false, ruleset: "R3", reason: "R3_INSUFFICIENT_APPROVALS", detail: { ruleset: "R3", reason: "R3_INSUFFICIENT_APPROVALS", approvals: approvals.length } };
  return { met: true, ruleset: "R3", reason: "R3_QUORUM_MET", detail: { ruleset: "R3", reason: null, approvals: 3 } };
}

function expectedOutcome(riskClass, quorum) {
  return quorum.met
    ? { state: "DECIDED", disposition: riskClass === "R3" ? "HUMAN_APPROVAL_REQUIRED" : "COUNCIL_APPROVED", quorumDetail: quorum.detail, reasonCode: quorum.reason }
    : { state: "NO_QUORUM", disposition: "NO_QUORUM", quorumDetail: quorum.detail, reasonCode: quorum.reason };
}

export function verifyCouncilQuorumProof({ proof, decisionRecord, trustedRegistry } = {}) {
  const result = {
    proofStructurallyValid: false, proofHashValid: false, decisionRecordHashValid: false,
    configTrustValid: false, bindingsValid: false,
    quorumRecomputation: { met: false, ruleset: "UNKNOWN", reason: null, detail: {} },
    quorumMatchesRecord: false, ruleVersion: typeof proof?.quorumRuleVersion === "string" ? proof.quorumRuleVersion : "UNKNOWN",
    provenanceClass: ["CONTEMPORANEOUS", "RECONSTRUCTED"].includes(proof?.provenanceClass) ? proof.provenanceClass : "UNKNOWN",
    authorizationEvidenceEligible: false, errorCode: null,
  };
  const fail = (code) => { if (result.errorCode === null) result.errorCode = code; };
  if (!validDecisionRecord(decisionRecord)) { fail("DECISION_RECORD_MALFORMED"); return result; }
  if (proof?.proofVersion !== "1") { fail("UNKNOWN_PROOF_VERSION"); return result; }
  if (proof?.quorumRuleVersion !== "decision-council-v1a") { fail("UNKNOWN_QUORUM_RULE_VERSION"); return result; }
  result.proofStructurallyValid = validProof(proof);
  if (!result.proofStructurallyValid) fail("MALFORMED_PROOF");
  try { result.proofHashValid = HASH64.test(proof?.proofHash ?? "") && computeProofHash(without(proof, "proofHash")) === proof.proofHash; } catch { result.proofHashValid = false; }
  if (!result.proofHashValid) fail("PROOF_HASH_INVALID");
  try {
    const recordHash = digest(DOMAINS.record, without(decisionRecord, "recordHash"));
    result.decisionRecordHashValid = recordHash === decisionRecord?.recordHash && recordHash === proof?.decisionRecordHash;
  } catch { result.decisionRecordHashValid = false; }
  if (!result.decisionRecordHashValid) fail("DECISION_RECORD_HASH_INVALID");
  try {
    const embeddedHash = computeCouncilConfigHash(proof.councilConfig);
    const trustedHash = lookupTrustedConfigHash(trustedRegistry, proof.decisionRequest.councilEpochId);
    result.configTrustValid = validCouncilConfig(proof.councilConfig) && embeddedHash === proof.councilConfigHash
      && trustedHash !== null && trustedHash === proof.councilConfigHash;
  } catch { result.configTrustValid = false; }
  if (!result.configTrustValid) fail("CONFIG_TRUST_INVALID");

  if (result.proofStructurallyValid) {
    const seats = proof.councilConfig.seats;
    const seatIds = new Set(seats.map(({ seatId }) => seatId));
    const votes = proof.votes;
    const requestRecordMatch = REQUEST_FIELDS.every((field) => proof.decisionRequest[field] === decisionRecord[field]);
    const epochMatch = proof.decisionRequest.councilEpochId === proof.councilConfig.epochId;
    const voteBindings = votes.every((vote) => vote.decisionRequestId === decisionRecord.decisionRequestId
      && vote.councilEpochId === decisionRecord.councilEpochId && vote.candidateHash === decisionRecord.candidateHash
      && seatIds.has(vote.seatId));
    const uniqueVotes = new Set(votes.map(({ seatId }) => seatId)).size === votes.length;
    const proposer = seats[proof.decisionRequest.rotationOrdinal % 3].seatId;
    const proposerMatch = proposer === decisionRecord.proposerSeatId;
    const projection = seats.map(({ seatId }) => {
      const vote = votes.find((item) => item.seatId === seatId);
      return vote ? { seatId, voteValue: vote.voteValue, candidateHash: vote.candidateHash }
        : { seatId, voteValue: "MISSING", candidateHash: null };
    });
    result.bindingsValid = requestRecordMatch && epochMatch && voteBindings && uniqueVotes && proposerMatch
      && same(projection, decisionRecord.votes);
  }
  if (!result.bindingsValid) fail("BINDINGS_INVALID");
  if (result.proofStructurallyValid && ["R1", "R2", "R3"].includes(proof.decisionRequest.riskClass)) {
    result.quorumRecomputation = recomputeQuorum(proof.decisionRequest, proof.councilConfig, proof.votes);
    const expected = expectedOutcome(proof.decisionRequest.riskClass, result.quorumRecomputation);
    result.quorumMatchesRecord = expected.state === decisionRecord?.state && expected.disposition === decisionRecord?.disposition
      && same(expected.quorumDetail, decisionRecord?.quorumDetail) && expected.reasonCode === decisionRecord?.reasonCode;
  }
  if (!result.quorumMatchesRecord) fail("QUORUM_RECORD_MISMATCH");
  if (result.provenanceClass !== "CONTEMPORANEOUS") fail("PROVENANCE_NOT_CONTEMPORANEOUS");
  result.authorizationEvidenceEligible = result.proofStructurallyValid && result.proofHashValid
    && result.decisionRecordHashValid && result.configTrustValid && result.bindingsValid
    && result.quorumMatchesRecord && result.provenanceClass === "CONTEMPORANEOUS";
  return result;
}

export function classifyDecisionRecordEvidence({ decisionRecord, proof } = {}) {
  if (!ownObject(decisionRecord) || !nonempty(decisionRecord.recordHash)) return "UNKNOWN";
  if (proof == null) return "V1_HISTORICAL_NO_PROOF";
  if (proof.provenanceClass === "CONTEMPORANEOUS") return "V1_PROOF_CAPABLE_CONTEMPORANEOUS";
  if (proof.provenanceClass === "RECONSTRUCTED") return "V1_PROOF_RECONSTRUCTED";
  return "UNKNOWN";
}

// Explicitly one-way hash graph: a DecisionRecord and every value covered by recordHash MUST NEVER
// contain or reference this proof, proofHash, or any CouncilQuorumProof field. The proof references
// decisionRecordHash; the record never references the proof, preventing a circular commitment.
