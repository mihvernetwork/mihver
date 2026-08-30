// Filesystem adapter for persisting advisory ShadowVoteAssessment evidence beside a Run Bundle.
// The returned contentHash is a raw-byte Run Bundle hash, not the assessment's domain hash.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { canonicalizeJson } from "./canonical-json.mjs";
import {
  buildCouncilQuorumProof,
  makeRegistryEntry,
  verifyCouncilQuorumProof,
} from "./council-quorum-proof.mjs";
import { computeDecisionRecordHash } from "./decision-council-kernel.mjs";
import { computeContentHash, writeRunBundle } from "./run-bundle.mjs";
import { runShadowExercise } from "./shadow-council-harness.mjs";
import { verifyInvocationFailureHash } from "./shadow-council-invocation-failure.mjs";

const TERMINAL_RECORD_STATES = new Set(["COUNCIL_NOT_REQUIRED", "DECIDED", "NO_QUORUM", "DENIED"]);
const VOTED_TERMINAL_STATES = new Set(["DECIDED", "NO_QUORUM"]);

// Independently re-derives the ADR-0005 DecisionRecord identity from the terminal session that
// produced it, rather than trusting the kernel's own return value. Fails closed on any mismatch.
//
// For DECIDED/NO_QUORUM outcomes this reuses the existing, frozen CouncilQuorumProof machinery
// (council-quorum-proof.mjs) to independently recompute quorum/state/disposition/quorumDetail/
// reasonCode and re-verify request/candidate/proposer/vote bindings, rather than duplicating the
// kernel's private quorum ruleset in this evidence-layer adapter.
function verifyDecisionRecordAgainstSession(record, session) {
  const { recordHash, ...withoutHash } = record;
  if (!/^sha256:[0-9a-f]{64}$/.test(recordHash)) throw new Error("DECISION_RECORD_HASH_MALFORMED");
  if (computeDecisionRecordHash(withoutHash) !== recordHash) throw new Error("DECISION_RECORD_HASH_MISMATCH");
  if (!TERMINAL_RECORD_STATES.has(record.state)) throw new Error("DECISION_RECORD_STATE_INVALID");

  if (!VOTED_TERMINAL_STATES.has(record.state)) return;

  const registryEntry = makeRegistryEntry(session.councilConfig);
  if (!registryEntry.ok) throw new Error("DECISION_RECORD_COUNCIL_CONFIG_INVALID");
  const proofResult = buildCouncilQuorumProof({
    decisionRequest: session.decisionRequest,
    councilConfig: session.councilConfig,
    votes: session.votes,
    decisionRecord: record,
  });
  if (!proofResult.ok) throw new Error(`DECISION_RECORD_QUORUM_PROOF_BUILD_FAILED:${proofResult.errorCode}`);
  const verification = verifyCouncilQuorumProof({
    proof: proofResult.proof,
    decisionRecord: record,
    trustedRegistry: { [registryEntry.entry.councilEpochId]: registryEntry.entry },
  });
  if (!verification.authorizationEvidenceEligible) {
    throw new Error(`DECISION_RECORD_QUORUM_VERIFICATION_FAILED:${verification.errorCode}`);
  }
}

const PRODUCER = { role: "REVIEWER", tool: "shadow-council-harness", threadId: null };

function writeCanonicalArtifact(value, evidenceDir, { evidenceId, filenamePrefix, summary }) {
  const bytes = Buffer.from(canonicalizeJson(value), "utf8");
  const contentHash = computeContentHash(bytes);
  const filename = `${filenamePrefix}-${contentHash.slice("sha256:".length)}.json`;
  const path = join(evidenceDir, filename);

  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(path, bytes);
  return {
    evidenceId,
    kind: "ARTIFACT",
    producedBy: PRODUCER,
    summary,
    path,
    action: "present",
    sourcePath: path,
    contentHash,
  };
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
      append(writeShadowVoteAssessmentEvidence(assessment, opts.evidenceDir));
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
    verifyDecisionRecordAgainstSession(result.decisionRecord, result.session);
    append(writeShadowDecisionRecordEvidence(result.decisionRecord, opts.evidenceDir));
  } else if (opts.finalize) {
    throw new Error("DECISION_RECORD_MISSING_BEFORE_FINALIZE");
  }
  finalize();
  return { ...result, evidence };
}
