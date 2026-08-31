// Filesystem adapter for persisting advisory ShadowVoteAssessment evidence beside a Run Bundle.
// The returned contentHash is a raw-byte Run Bundle hash, not the assessment's domain hash.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { canonicalizeJson } from "./canonical-json.mjs";
import {
  buildCouncilQuorumProof,
  computeCouncilConfigHash,
  makeRegistryEntry,
  verifyCouncilQuorumProof,
} from "./council-quorum-proof.mjs";
import { computeDecisionRecordHash } from "./decision-council-kernel.mjs";
import { computeContentHash, writeRunBundle } from "./run-bundle.mjs";
import { runShadowExercise } from "./shadow-council-harness.mjs";
import { buildShadowCouncilConfig, SHADOW_COUNCIL_SEAT_ORDER } from "./shadow-council-cli-transport.mjs";
import { verifyInvocationFailureHash } from "./shadow-council-invocation-failure.mjs";
import { deriveAgentVote, verifyAssessmentHash } from "./shadow-council-vote-assessment.mjs";

const TERMINAL_RECORD_STATES = new Set(["COUNCIL_NOT_REQUIRED", "DECIDED", "NO_QUORUM", "DENIED"]);
const VOTED_TERMINAL_STATES = new Set(["DECIDED", "NO_QUORUM"]);

// Terminal evidence is written in durable-source order: DecisionRecord first, then a quorum proof
// rebuilt from the persisted request, config, record, and vote assessments before finalization.
function verifyDecisionRecord(record) {
  const { recordHash, ...withoutHash } = record;
  if (!/^sha256:[0-9a-f]{64}$/.test(recordHash)) throw new Error("DECISION_RECORD_HASH_MALFORMED");
  if (computeDecisionRecordHash(withoutHash) !== recordHash) throw new Error("DECISION_RECORD_HASH_MISMATCH");
  if (!TERMINAL_RECORD_STATES.has(record.state)) throw new Error("DECISION_RECORD_STATE_INVALID");

}

const PRODUCER = { role: "REVIEWER", tool: "shadow-council-harness", threadId: null };

function writeCanonicalArtifact(value, evidenceDir, { evidenceId, filenamePrefix, summary, writeFileSyncImpl = writeFileSync }) {
  const bytes = Buffer.from(canonicalizeJson(value), "utf8");
  const contentHash = computeContentHash(bytes);
  const filename = `${filenamePrefix}-${contentHash.slice("sha256:".length)}.json`;
  const path = join(evidenceDir, filename);

  mkdirSync(evidenceDir, { recursive: true });
  writeFileSyncImpl(path, bytes);
  return {
    evidenceId: typeof evidenceId === "function" ? evidenceId(contentHash) : evidenceId,
    kind: "ARTIFACT",
    producedBy: PRODUCER,
    summary,
    path,
    action: "present",
    sourcePath: path,
    contentHash,
  };
}

function readDurableArtifact(entry) {
  return JSON.parse(readFileSync(entry.sourcePath, "utf8"));
}

export function assertCanonicalShadowCouncilConfig(session, opts) {
  const request = session?.decisionRequest;
  const config = session?.councilConfig;
  const nonemptyString = (value) => typeof value === "string" && value.length > 0;
  const validSeat = (seat) => seat !== null && typeof seat === "object" && !Array.isArray(seat)
    && Object.keys(seat).length === 5
    && ["seatId", "provider", "modelFamily", "modelId", "councilEpochId"].every((key) => nonemptyString(seat[key]));
  const validConfig = config !== null && typeof config === "object" && !Array.isArray(config)
    && Object.keys(config).length === 2 && nonemptyString(config.epochId)
    && Array.isArray(config.seats) && config.seats.length === 3 && config.seats.every(validSeat)
    && new Set(config.seats.map(({ seatId }) => seatId)).size === 3
    && new Set(config.seats.map(({ provider, modelFamily, modelId }) => `${provider}\0${modelFamily}\0${modelId}`)).size === 3
    && config.seats.every(({ councilEpochId }) => councilEpochId === config.epochId);
  if (!nonemptyString(request?.councilEpochId) || !validConfig || request.councilEpochId !== config.epochId) {
    throw new Error("SHADOW_COUNCIL_CONFIG_MISMATCH");
  }
  const canonical = buildShadowCouncilConfig(request.councilEpochId);
  const claimsRealSeat = config.seats.some(({ seatId }) => SHADOW_COUNCIL_SEAT_ORDER.includes(seatId));
  if ((opts?.spawnSeatImpl === undefined || claimsRealSeat)
      && canonicalizeJson(config) !== canonicalizeJson(canonical)) {
    throw new Error("SHADOW_COUNCIL_CONFIG_MISMATCH");
  }
}

export function writeShadowVoteAssessmentEvidence(assessment, evidenceDir) {
  const seatId = encodeURIComponent(assessment.seatId);
  return writeCanonicalArtifact(assessment, evidenceDir, {
    evidenceId: `shadow-vote-assessment:${assessment.assessmentHash}`,
    filenamePrefix: `shadow-vote-assessment-${seatId}`,
    summary: assessment.rationale,
  });
}

export function writeShadowDecisionRecordEvidence(decisionRecord, evidenceDir) {
  return writeCanonicalArtifact(decisionRecord, evidenceDir, {
    evidenceId: `shadow-decision-record:${decisionRecord.recordHash}`,
    filenamePrefix: "shadow-decision-record",
    summary: `Shadow Council terminal DecisionRecord (${decisionRecord.state}/${decisionRecord.disposition}) for ${decisionRecord.decisionRequestId}.`,
  });
}

export function runShadowExerciseWithEvidence(session, opts) {
  if (typeof opts?.evidenceDir !== "string" || opts.evidenceDir.length === 0) throw new Error("EVIDENCE_DIR_REQUIRED");
  const result = runShadowExercise(session, opts);
  const evidence = result.assessments.map((assessment) => writeShadowVoteAssessmentEvidence(assessment, opts.evidenceDir));
  return { ...result, evidence };
}

// Runs the harness with synchronous, append-only evidence writes. Every hook returns only after its
// artifact and EvidenceManifest entry are durable, so a later harness throw leaves an inspectable
// OPEN bundle. TaskRecord is intentionally reused byte-for-byte because Run Bundle appends make it
// immutable.
export function runShadowExerciseWithDurableEvidence(session, opts) {
  if (typeof opts?.evidenceDir !== "string" || opts.evidenceDir.length === 0) throw new Error("EVIDENCE_DIR_REQUIRED");
  for (const field of ["out", "runId", "contextPack", "taskRecord"]) {
    if (opts?.[field] === undefined) throw new Error(`RUN_BUNDLE_${field.toUpperCase()}_REQUIRED`);
  }
  assertCanonicalShadowCouncilConfig(session, opts);

  const evidence = [];
  const append = (entry) => {
    const result = writeRunBundle({
      out: opts.out,
      runId: opts.runId,
      contextPack: opts.contextPack,
      taskRecord: opts.taskRecord,
      evidence: [entry],
      finalize: false,
      ...(opts.execFileSyncImpl === undefined ? {} : { execFileSyncImpl: opts.execFileSyncImpl }),
    });
    if (result.status !== "OK") throw Object.assign(new Error(`RUN_BUNDLE_EVIDENCE_WRITE_FAILED:${result.reason}`), { result });
    evidence.push(entry);
    return entry;
  };
  const decisionRequestEvidence = append(writeCanonicalArtifact(session.decisionRequest, opts.evidenceDir, {
    evidenceId: (contentHash) => `shadow-decision-request:${session.decisionRequest.decisionRequestId}:${contentHash}`,
    filenamePrefix: "shadow-decision-request",
    summary: `Shadow Council DecisionRequest for ${session.decisionRequest.decisionRequestId}.`,
    writeFileSyncImpl: opts.writeFileSyncImpl,
  }));
  const councilConfigEvidence = append(writeCanonicalArtifact(session.councilConfig, opts.evidenceDir, {
    evidenceId: `shadow-council-config:${computeCouncilConfigHash(session.councilConfig)}`,
    filenamePrefix: "shadow-council-config",
    summary: `Shadow Council CouncilConfig for epoch ${session.councilConfig.epochId}.`,
    writeFileSyncImpl: opts.writeFileSyncImpl,
  }));
  const assessmentEvidence = [];
  const seatPrefix = (kind, seatId) => `${kind}-${encodeURIComponent(seatId)}`;
  const callerHooks = opts.hooks ?? {};
  const hooks = {
    onPacketBuilt(packet, meta) {
      append(writeCanonicalArtifact(packet, opts.evidenceDir, {
        evidenceId: `shadow-council-packet:${packet.packetHash}`,
        filenamePrefix: seatPrefix("shadow-council-packet", meta.seatId),
        summary: `Shadow Council ${meta.invocationRole.toLowerCase()} packet for ${meta.seatId}.`,
      }));
      callerHooks.onPacketBuilt?.(packet, meta);
    },
    onAttestationAdmitted(attestation, meta) {
      append(writeCanonicalArtifact(attestation, opts.evidenceDir, {
        evidenceId: `shadow-seat-attestation:${attestation.attestationHash}`,
        filenamePrefix: seatPrefix("shadow-seat-attestation", meta.seatId),
        summary: `Admitted Shadow Council attestation for ${meta.seatId}.`,
      }));
      callerHooks.onAttestationAdmitted?.(attestation, meta);
    },
    onAttestationRejected(attestation, meta) {
      append(writeCanonicalArtifact(attestation, opts.evidenceDir, {
        evidenceId: `shadow-seat-rejected-attestation:${attestation.attestationHash}`,
        filenamePrefix: seatPrefix("shadow-seat-rejected-attestation", meta.seatId),
        summary: `Rejected Shadow Council attestation for ${meta.seatId}: ${meta.reason}.`,
      }));
      callerHooks.onAttestationRejected?.(attestation, meta);
    },
    onAssessmentBuilt(assessment, meta) {
      assessmentEvidence.push(append(writeShadowVoteAssessmentEvidence(assessment, opts.evidenceDir)));
      callerHooks.onAssessmentBuilt?.(assessment, meta);
    },
    onInvocationFailure(failure) {
      if (!verifyInvocationFailureHash(failure)) throw new Error("INVOCATION_FAILURE_HASH_INVALID");
      append(writeCanonicalArtifact(failure, opts.evidenceDir, {
        evidenceId: `shadow-seat-invocation-failure:${failure.failureHash}`,
        filenamePrefix: seatPrefix("shadow-seat-invocation-failure", failure.seatId),
        summary: `Shadow Council invocation failure for ${failure.seatId} at ${failure.stage}: ${failure.errorCode}.`,
      }));
      try { callerHooks.onInvocationFailure?.(failure); }
      catch (hookError) { Object.defineProperty(failure, "callerHookError", { value: hookError, configurable: true }); }
    },
  };
  const finalize = () => {
    if (!opts.finalize) return;
    const result = writeRunBundle({
      out: opts.out, runId: opts.runId, contextPack: opts.contextPack, taskRecord: opts.taskRecord,
      evidence: [], finalize: true, finalizedAt: opts.finalizedAt,
      ...(opts.execFileSyncImpl === undefined ? {} : { execFileSyncImpl: opts.execFileSyncImpl }),
    });
    if (result.status !== "OK") throw Object.assign(new Error(`RUN_BUNDLE_FINALIZE_FAILED:${result.reason}`), { result });
  };

  const result = runShadowExercise(session, { ...opts, hooks });
  if (result.decisionRecord) {
    verifyDecisionRecord(result.decisionRecord);
    const decisionRecordEvidence = append(writeShadowDecisionRecordEvidence(result.decisionRecord, opts.evidenceDir));
    if (VOTED_TERMINAL_STATES.has(result.decisionRecord.state)
        && ["R1", "R2", "R3"].includes(result.session.decisionRequest.riskClass)) {
      const durableDecisionRequest = readDurableArtifact(decisionRequestEvidence);
      const durableCouncilConfig = readDurableArtifact(councilConfigEvidence);
      const durableDecisionRecord = readDurableArtifact(decisionRecordEvidence);
      const derivedDurableVotes = assessmentEvidence.map((entry) => {
        const assessment = readDurableArtifact(entry);
        if (!verifyAssessmentHash(assessment)) throw new Error("DURABLE_ASSESSMENT_HASH_INVALID");
        return deriveAgentVote(assessment);
      });
      const configSeatIds = durableCouncilConfig.seats.map(({ seatId }) => seatId);
      const configSeatIdSet = new Set(configSeatIds);
      if (derivedDurableVotes.some(({ seatId }) => !configSeatIdSet.has(seatId))) {
        throw new Error("DURABLE_VOTE_SEAT_UNKNOWN");
      }
      const votesBySeatInConfigOrder = (votes) => {
        const bySeatId = new Map(votes.map((vote) => [vote.seatId, vote]));
        return {
          bySeatId,
          canonical: Object.fromEntries(configSeatIds.filter((seatId) => bySeatId.has(seatId))
            .map((seatId) => [seatId, bySeatId.get(seatId)])),
        };
      };
      const durableVoteMap = votesBySeatInConfigOrder(derivedDurableVotes);
      const terminalVoteMap = votesBySeatInConfigOrder(result.session.votes);
      if (derivedDurableVotes.length !== durableVoteMap.bySeatId.size
          || result.session.votes.length !== terminalVoteMap.bySeatId.size
          || durableVoteMap.bySeatId.size !== terminalVoteMap.bySeatId.size
          || [...durableVoteMap.bySeatId.keys()].some((seatId) => !terminalVoteMap.bySeatId.has(seatId))
          || [...terminalVoteMap.bySeatId.keys()].some((seatId) => !durableVoteMap.bySeatId.has(seatId))
          || canonicalizeJson(durableVoteMap.canonical) !== canonicalizeJson(terminalVoteMap.canonical)) {
        throw new Error("DURABLE_VOTES_MISMATCH");
      }
      const durableVotes = configSeatIds.filter((seatId) => durableVoteMap.bySeatId.has(seatId))
        .map((seatId) => durableVoteMap.bySeatId.get(seatId));
      // DEVELOPMENT-TIME structural check only: this locally derived entry is NOT the future
      // privileged CouncilEpochRegistry trust anchor. Future privileged authledgerd must compare
      // councilConfigHash independently against its own trusted registry.
      const registryEntry = makeRegistryEntry(durableCouncilConfig);
      if (!registryEntry.ok) throw new Error("DURABLE_COUNCIL_CONFIG_INVALID");
      const proofResult = buildCouncilQuorumProof({
        decisionRequest: durableDecisionRequest,
        councilConfig: durableCouncilConfig,
        votes: durableVotes,
        decisionRecord: durableDecisionRecord,
      });
      if (!proofResult.ok) throw new Error(`DURABLE_QUORUM_PROOF_BUILD_FAILED:${proofResult.errorCode}`);
      // DEVELOPMENT-TIME structural check only: this locally derived entry is NOT the future
      // privileged CouncilEpochRegistry trust anchor. Future privileged authledgerd must compare
      // councilConfigHash independently against its own trusted registry.
      const verification = verifyCouncilQuorumProof({
        proof: proofResult.proof,
        decisionRecord: durableDecisionRecord,
        trustedRegistry: { [registryEntry.entry.councilEpochId]: registryEntry.entry },
      });
      if (!verification.authorizationEvidenceEligible || verification.provenanceClass !== "CONTEMPORANEOUS") {
        throw new Error(`DURABLE_QUORUM_PROOF_VERIFICATION_FAILED:${verification.errorCode ?? "PROVENANCE"}`);
      }
      append(writeCanonicalArtifact(proofResult.proof, opts.evidenceDir, {
        evidenceId: `shadow-council-quorum-proof:${proofResult.proof.proofHash}`,
        filenamePrefix: "shadow-council-quorum-proof",
        summary: `Contemporaneous Shadow Council quorum proof for ${durableDecisionRecord.decisionRequestId}.`,
        writeFileSyncImpl: opts.writeFileSyncImpl,
      }));
    }
  } else if (opts.finalize) {
    throw new Error("DECISION_RECORD_MISSING_BEFORE_FINALIZE");
  }
  finalize();
  return { ...result, evidence };
}
