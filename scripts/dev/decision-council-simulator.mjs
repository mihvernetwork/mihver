import { applyEvent, computeCommitmentHash, createSession } from "./decision-council-kernel.mjs";

export function buildCouncilConfig({ epochId = "epoch-1", seats } = {}) {
  const fixtureSeats = seats ?? [
    { seatId: "seat-a", provider: "provider-a", modelFamily: "family-a", modelId: "model-a" },
    { seatId: "seat-b", provider: "provider-b", modelFamily: "family-b", modelId: "model-b" },
    { seatId: "seat-c", provider: "provider-c", modelFamily: "family-c", modelId: "model-c" },
  ];
  return { epochId, seats: fixtureSeats.map((seat) => ({ ...seat, councilEpochId: seat.councilEpochId ?? epochId })) };
}

function mustApply(session, event) {
  const result = applyEvent(session, event);
  if (result.error) throw new Error(`Simulator event ${event.type} rejected: ${result.error.code}`);
  return result.session;
}

export function driveToFrozen(session, proposerSeatId, proposalContent) {
  const common = { decisionRequestId: session.decisionRequest.decisionRequestId, seatId: proposerSeatId, councilEpochId: session.decisionRequest.councilEpochId };
  let next = mustApply(session, { type: "SUBMIT_COMMITMENT", commitment: { ...common, commitmentHash: computeCommitmentHash(proposalContent) } });
  next = mustApply(next, { type: "REVEAL_PROPOSAL", proposal: { ...common, proposalContent } });
  return mustApply(next, { type: "FREEZE_CANDIDATE" });
}

export function castVotesAndFinalize(session, votesBySeatId) {
  let next = session;
  for (const seat of session.councilConfig.seats) {
    if (!Object.prototype.hasOwnProperty.call(votesBySeatId, seat.seatId)) continue;
    next = mustApply(next, { type: "CAST_VOTE", vote: { decisionRequestId: session.decisionRequest.decisionRequestId, candidateHash: session.candidateDecision.candidateHash, seatId: seat.seatId, councilEpochId: session.decisionRequest.councilEpochId, voteValue: votesBySeatId[seat.seatId] } });
  }
  return mustApply(next, { type: "FINALIZE" });
}

export function createFixtureSession(decisionRequest, councilConfig, expectedContext) {
  return createSession(decisionRequest, councilConfig, expectedContext);
}
