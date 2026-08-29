import { createHash } from "node:crypto";
import { canonicalizeJson } from "./canonical-json.mjs";

const HASH64 = /^sha256:[0-9a-f]{64}$/;
const HEX40 = /^[0-9a-f]{40}$/;
const RISKS = new Set(["R0", "R1", "R2", "R3", "R4"]);
const VOTES = new Set(["APPROVE", "REJECT", "ABSTAIN"]);
const TERMINAL = new Set(["COUNCIL_NOT_REQUIRED", "DECIDED", "NO_QUORUM", "DENIED"]);
const DOMAINS = {
  commitment: "MIHVER:DecisionCouncil:ProposalCommitment:v1\0",
  candidate: "MIHVER:DecisionCouncil:CandidateDecision:v1\0",
  record: "MIHVER:DecisionCouncil:DecisionRecord:v1\0",
};

const ownObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const exactKeys = (v, required) => ownObject(v)
  && Object.keys(v).length === required.length
  && required.every((key) => Object.prototype.hasOwnProperty.call(v, key));
const nonempty = (v) => typeof v === "string" && v.length > 0;

function validSeat(v) {
  const keys = ["seatId", "provider", "modelFamily", "modelId", "councilEpochId"];
  return exactKeys(v, keys) && keys.every((key) => nonempty(v[key]));
}

function validCouncilConfig(v) {
  return exactKeys(v, ["epochId", "seats"]) && nonempty(v.epochId)
    && Array.isArray(v.seats) && v.seats.length === 3 && v.seats.every(validSeat);
}

function validRequest(v) {
  const keys = ["decisionRequestId", "taskId", "riskClass", "contextHash", "repositoryHead", "councilEpochId", "rotationOrdinal"];
  return exactKeys(v, keys) && nonempty(v.decisionRequestId) && nonempty(v.taskId)
    && RISKS.has(v.riskClass) && HASH64.test(v.contextHash) && HEX40.test(v.repositoryHead)
    && nonempty(v.councilEpochId) && Number.isInteger(v.rotationOrdinal) && v.rotationOrdinal >= 0;
}

function validCommitment(v) {
  return exactKeys(v, ["decisionRequestId", "seatId", "councilEpochId", "commitmentHash"])
    && nonempty(v.decisionRequestId) && nonempty(v.seatId) && nonempty(v.councilEpochId)
    && HASH64.test(v.commitmentHash);
}

function validProposalContent(v) {
  if (!exactKeys(v, ["summary", "payload"]) || !nonempty(v.summary) || !ownObject(v.payload)) return false;
  try { canonicalizeJson(v); return true; } catch { return false; }
}

function validProposal(v) {
  return exactKeys(v, ["decisionRequestId", "seatId", "councilEpochId", "proposalContent"])
    && nonempty(v.decisionRequestId) && nonempty(v.seatId) && nonempty(v.councilEpochId)
    && validProposalContent(v.proposalContent);
}

function validVote(v) {
  return exactKeys(v, ["decisionRequestId", "candidateHash", "seatId", "councilEpochId", "voteValue"])
    && nonempty(v.decisionRequestId) && HASH64.test(v.candidateHash) && nonempty(v.seatId)
    && nonempty(v.councilEpochId) && VOTES.has(v.voteValue);
}

function digest(domain, value) {
  return `sha256:${createHash("sha256")
    .update(Buffer.from(domain, "utf8"))
    .update(Buffer.from(canonicalizeJson(value), "utf8"))
    .digest("hex")}`;
}

export function computeCommitmentHash(proposalContent) {
  return digest(DOMAINS.commitment, proposalContent);
}

export function computeCandidateHash(candidateWithoutHash) {
  return digest(DOMAINS.candidate, candidateWithoutHash);
}

export function computeDecisionRecordHash(recordWithoutHash) {
  return digest(DOMAINS.record, recordWithoutHash);
}

function admissionError(errorCode, details = {}) {
  return { ok: false, errorCode, details };
}

function transition(session, to, event, changes = {}) {
  return {
    ...session,
    ...changes,
    state: to,
    transitionLog: [...session.transitionLog, { from: session.state, to, event }],
  };
}

function makeRecord(session, state, disposition, quorumDetail, reasonCode) {
  const candidate = session.candidateDecision ?? null;
  const votes = candidate ? session.councilConfig.seats.map(({ seatId }) => {
    const vote = session.votes.find((item) => item.seatId === seatId);
    return vote
      ? { seatId, voteValue: vote.voteValue, candidateHash: vote.candidateHash }
      : { seatId, voteValue: "MISSING", candidateHash: null };
  }) : [];
  const recordWithoutHash = {
    decisionRequestId: session.decisionRequest.decisionRequestId,
    taskId: session.decisionRequest.taskId,
    riskClass: session.decisionRequest.riskClass,
    contextHash: session.decisionRequest.contextHash,
    repositoryHead: session.decisionRequest.repositoryHead,
    councilEpochId: session.decisionRequest.councilEpochId,
    state,
    disposition,
    candidateHash: candidate?.candidateHash ?? null,
    proposerSeatId: candidate?.proposerSeatId ?? null,
    votes,
    quorumDetail,
    reasonCode,
  };
  return { ...recordWithoutHash, recordHash: computeDecisionRecordHash(recordWithoutHash) };
}

export function createSession(decisionRequest, councilConfig, expectedContext) {
  if (!validRequest(decisionRequest)) return admissionError("MALFORMED_ARTIFACT", { artifact: "DecisionRequest" });
  if (!validCouncilConfig(councilConfig)) return admissionError("MALFORMED_ARTIFACT", { artifact: "CouncilConfig" });
  const seatIds = councilConfig.seats.map((seat) => seat.seatId);
  if (new Set(seatIds).size !== 3) return admissionError("DUPLICATE_SEAT_ID", { seatIds });
  const identities = councilConfig.seats.map((seat) => `${seat.provider}\0${seat.modelFamily}\0${seat.modelId}`);
  if (new Set(identities).size !== 3) return admissionError("DUPLICATE_SEAT_IDENTITY");
  if (councilConfig.seats.some((seat) => seat.councilEpochId !== councilConfig.epochId)
      || decisionRequest.councilEpochId !== councilConfig.epochId) {
    return admissionError("WRONG_COUNCIL_EPOCH");
  }
  if (!ownObject(expectedContext) || decisionRequest.contextHash !== expectedContext.contextHash) {
    return admissionError("CONTEXT_HASH_MISMATCH");
  }
  if (decisionRequest.repositoryHead !== expectedContext.repositoryHead) {
    return admissionError("REPOSITORY_HEAD_MISMATCH");
  }
  let session = {
    state: "CREATED",
    decisionRequest,
    councilConfig,
    expectedProposerSeatId: councilConfig.seats[decisionRequest.rotationOrdinal % 3].seatId,
    commitment: null,
    proposal: null,
    candidateDecision: null,
    votes: [],
    decisionRecord: null,
    transitionLog: [],
  };
  if (decisionRequest.riskClass === "R0") {
    session = transition(session, "COUNCIL_NOT_REQUIRED", "ADMIT", {});
    session = { ...session, decisionRecord: makeRecord(session, "COUNCIL_NOT_REQUIRED", "COUNCIL_NOT_REQUIRED", { ruleset: "R0", reason: null }, "COUNCIL_NOT_REQUIRED_RISK_R0") };
  } else if (decisionRequest.riskClass === "R4") {
    session = transition(session, "DENIED", "ADMIT", {});
    session = { ...session, decisionRecord: makeRecord(session, "DENIED", "DENIED", { ruleset: "R4", reason: "HARD_DENY_RISK_R4" }, "HARD_DENY_RISK_R4") };
  }
  return { ok: true, session };
}

function rejected(session, code, details = {}) {
  return { session, error: { code, details } };
}

function accepted(session) {
  return { session, error: null };
}

function bindingError(session, artifact) {
  if (artifact.decisionRequestId !== session.decisionRequest.decisionRequestId) return "DECISION_REQUEST_MISMATCH";
  if (artifact.councilEpochId !== session.decisionRequest.councilEpochId) return "WRONG_COUNCIL_EPOCH";
  return null;
}

function quorum(session) {
  const risk = session.decisionRequest.riskClass;
  const approvals = session.votes.filter((vote) => vote.voteValue === "APPROVE");
  if (risk === "R1") {
    if (approvals.length < 2) return { met: false, reason: "R1_INSUFFICIENT_APPROVALS", detail: { ruleset: "R1", reason: "R1_INSUFFICIENT_APPROVALS", approvals: approvals.length } };
    const identities = new Set(approvals.map((vote) => {
      const seat = session.councilConfig.seats.find((item) => item.seatId === vote.seatId);
      return `${seat.provider}\0${seat.modelFamily}`;
    }));
    if (identities.size < 2) return { met: false, reason: "R1_DIVERSITY_REQUIREMENT_NOT_MET", detail: { ruleset: "R1", reason: "R1_DIVERSITY_REQUIREMENT_NOT_MET", approvals: approvals.length, distinctProviderModelFamilies: identities.size } };
    return { met: true, reason: "R1_QUORUM_MET", detail: { ruleset: "R1", reason: null, approvals: approvals.length, distinctProviderModelFamilies: identities.size } };
  }
  if (risk === "R2") {
    const reviewers = session.councilConfig.seats.filter((seat) => seat.seatId !== session.expectedProposerSeatId);
    const reviewerVotes = reviewers.map((seat) => session.votes.find((vote) => vote.seatId === seat.seatId));
    if (reviewerVotes.some((vote) => vote?.voteValue === "REJECT")) return { met: false, reason: "R2_REVIEWER_REJECTED", detail: { ruleset: "R2", reason: "R2_REVIEWER_REJECTED", reviewerApprovals: reviewerVotes.filter((v) => v?.voteValue === "APPROVE").length } };
    if (!reviewerVotes.every((vote) => vote?.voteValue === "APPROVE")) return { met: false, reason: "R2_INSUFFICIENT_REVIEWER_APPROVALS", detail: { ruleset: "R2", reason: "R2_INSUFFICIENT_REVIEWER_APPROVALS", reviewerApprovals: reviewerVotes.filter((v) => v?.voteValue === "APPROVE").length } };
    return { met: true, reason: "R2_QUORUM_MET", detail: { ruleset: "R2", reason: null, reviewerApprovals: 2 } };
  }
  if (approvals.length !== 3) return { met: false, reason: "R3_INSUFFICIENT_APPROVALS", detail: { ruleset: "R3", reason: "R3_INSUFFICIENT_APPROVALS", approvals: approvals.length } };
  return { met: true, reason: "R3_QUORUM_MET", detail: { ruleset: "R3", reason: null, approvals: 3 } };
}

export function applyEvent(session, event) {
  if (!ownObject(session) || !ownObject(event) || typeof event.type !== "string") return rejected(session, "MALFORMED_ARTIFACT", { artifact: "Event" });
  if (TERMINAL.has(session.state)) return rejected(session, "INVALID_STATE_TRANSITION", { state: session.state, event: event.type });
  if (event.type === "SUBMIT_COMMITMENT") {
    if (session.state !== "CREATED") return rejected(session, "INVALID_STATE_TRANSITION", { state: session.state, event: event.type });
    if (!exactKeys(event, ["type", "commitment"]) || !validCommitment(event.commitment)) return rejected(session, "MALFORMED_ARTIFACT", { artifact: "ProposalCommitment" });
    const binding = bindingError(session, event.commitment);
    if (binding) return rejected(session, binding);
    if (event.commitment.seatId !== session.expectedProposerSeatId) return rejected(session, "PROPOSER_ROLE_VIOLATION");
    return accepted(transition(session, "COMMITMENT_COLLECTION", event.type, { commitment: event.commitment }));
  }
  if (event.type === "REVEAL_PROPOSAL") {
    if (session.state !== "COMMITMENT_COLLECTION") return rejected(session, "INVALID_STATE_TRANSITION", { state: session.state, event: event.type });
    if (!exactKeys(event, ["type", "proposal"]) || !validProposal(event.proposal)) return rejected(session, "MALFORMED_ARTIFACT", { artifact: "AgentProposal" });
    const binding = bindingError(session, event.proposal);
    if (binding) return rejected(session, binding);
    if (event.proposal.seatId !== session.expectedProposerSeatId) return rejected(session, "PROPOSER_ROLE_VIOLATION");
    if (computeCommitmentHash(event.proposal.proposalContent) !== session.commitment.commitmentHash) return rejected(session, "COMMITMENT_REVEAL_MISMATCH");
    return accepted(transition(session, "PROPOSAL_REVEAL", event.type, { proposal: event.proposal }));
  }
  if (event.type === "FREEZE_CANDIDATE") {
    if (session.state !== "PROPOSAL_REVEAL") return rejected(session, "INVALID_STATE_TRANSITION", { state: session.state, event: event.type });
    if (!exactKeys(event, ["type"])) return rejected(session, "MALFORMED_ARTIFACT", { artifact: "FreezeCandidateEvent" });
    const r = session.decisionRequest;
    const withoutHash = { decisionRequestId: r.decisionRequestId, taskId: r.taskId, riskClass: r.riskClass, contextHash: r.contextHash, repositoryHead: r.repositoryHead, councilEpochId: r.councilEpochId, proposerSeatId: session.expectedProposerSeatId, candidateOrdinal: 0, proposalContent: session.proposal.proposalContent };
    const candidateDecision = { ...withoutHash, candidateHash: computeCandidateHash(withoutHash) };
    return accepted(transition(session, "CANDIDATE_FROZEN", event.type, { candidateDecision }));
  }
  if (event.type === "CAST_VOTE") {
    if (session.state !== "CANDIDATE_FROZEN" && session.state !== "VOTING") return rejected(session, "INVALID_STATE_TRANSITION", { state: session.state, event: event.type });
    if (!exactKeys(event, ["type", "vote"]) || !validVote(event.vote)) return rejected(session, "MALFORMED_ARTIFACT", { artifact: "AgentVote" });
    if (event.vote.candidateHash !== session.candidateDecision.candidateHash) return rejected(session, "CANDIDATE_HASH_MISMATCH");
    const binding = bindingError(session, event.vote);
    if (binding) return rejected(session, binding);
    if (!session.councilConfig.seats.some((seat) => seat.seatId === event.vote.seatId)) return rejected(session, "UNKNOWN_SEAT");
    if (session.votes.some((vote) => vote.seatId === event.vote.seatId)) return rejected(session, "DUPLICATE_SEAT_VOTE");
    return accepted(transition(session, "VOTING", event.type, { votes: [...session.votes, event.vote] }));
  }
  if (event.type === "FINALIZE") {
    if (session.state !== "VOTING") return rejected(session, "INVALID_STATE_TRANSITION", { state: session.state, event: event.type });
    if (!exactKeys(event, ["type"])) return rejected(session, "MALFORMED_ARTIFACT", { artifact: "FinalizeEvent" });
    const result = quorum(session);
    const state = result.met ? "DECIDED" : "NO_QUORUM";
    const disposition = result.met ? (session.decisionRequest.riskClass === "R3" ? "HUMAN_APPROVAL_REQUIRED" : "COUNCIL_APPROVED") : "NO_QUORUM";
    let next = transition(session, state, event.type);
    next = { ...next, decisionRecord: makeRecord(next, state, disposition, result.detail, result.reason) };
    return accepted(next);
  }
  return rejected(session, "MALFORMED_ARTIFACT", { artifact: "Event", eventType: event.type });
}

export function getDecisionRecord(session) {
  return TERMINAL.has(session?.state) ? session.decisionRecord : null;
}
