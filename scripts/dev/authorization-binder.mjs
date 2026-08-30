import { createHash } from "node:crypto";
import { createRequire } from "node:module";

import Ajv2020 from "ajv/dist/2020.js";

import { canonicalizeJson } from "./canonical-json.mjs";
import { computeTaskRecordHash, valueWithoutHash } from "./canonical-record-hash.mjs";
import { verifyCouncilQuorumProof } from "./council-quorum-proof.mjs";
import { computeDecisionRecordHash } from "./decision-council-kernel.mjs";

export const PROTOCOL_VERSION = "1.0.0";
export const POLICY_VERSION = "authorization-policy/v1";
export const ACTION_TYPE = "UNDEFINED_PENDING_EXECUTION_GATEWAY";
export const AUTHORIZATION_ID_DOMAIN = "MIHVER:AuthorizationEnvelope:AuthorizationId:v1\0";
export const ENVELOPE_HASH_DOMAIN = "MIHVER:AuthorizationEnvelope:v1\0";

export const PROHIBITED_EFFECTS = Object.freeze([
  "GIT_PUSH",
  "GIT_FORCE_PUSH",
  "PR_CREATE",
  "PR_MERGE",
  "MAIN_BRANCH_MUTATION",
  "PUBLICATION_BROKER_INVOCATION",
  "CREDENTIAL_ACCESS",
  "TOOL_EXECUTION",
  "COUNCIL_SCOPE_SELF_EXPANSION",
  "EXECUTION_GATEWAY_BYPASS",
]);

const HASH64 = /^sha256:[0-9a-f]{64}$/;
const HEX40 = /^[0-9a-f]{40}$/;
const RISK_DISPOSITIONS = Object.freeze({
  R0: "COUNCIL_NOT_REQUIRED",
  R1: "COUNCIL_APPROVED",
  R2: "COUNCIL_APPROVED",
  R3: "HUMAN_APPROVAL_REQUIRED",
  R4: "DENIED",
});

const require = createRequire(import.meta.url);
const ajv = new Ajv2020({ allErrors: true, strict: true });
const decisionCouncilSchema = require("../../schemas/dev/decision-council.schema.json");
const taskRecordSchema = require("../../schemas/dev/task-record.schema.json");
ajv.addSchema(decisionCouncilSchema);
const validateDecisionRecordShape = ajv.compile({
  $ref: `${decisionCouncilSchema.$id}#/$defs/DecisionRecord`,
});
const validateTaskRecordShape = ajv.compile(taskRecordSchema);

const ownObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const nonempty = (value) => typeof value === "string" && value.length > 0;

function noEnvelope(reason) {
  return Object.freeze({ status: "NO_ENVELOPE", reason });
}

function sha256(domain, bytes) {
  return `sha256:${createHash("sha256")
    .update(Buffer.from(domain, "utf8"))
    .update(Buffer.from(bytes, "utf8"))
    .digest("hex")}`;
}

export function computeAuthorizationId(decisionRequestId, recordHash) {
  return sha256(AUTHORIZATION_ID_DOMAIN, `${decisionRequestId}\0${recordHash}`);
}

export function computeAuthorizationEnvelopeHash(envelopeWithoutHash) {
  return sha256(ENVELOPE_HASH_DOMAIN, canonicalizeJson(envelopeWithoutHash));
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const item of Object.values(value)) deepFreeze(item, seen);
  return Object.freeze(value);
}

function validDecisionRecord(record) {
  if (!validateDecisionRecordShape(record)) return false;
  const immediate = record.riskClass === "R0" || record.riskClass === "R4";
  const expectedTerminal = record.riskClass === "R0"
    ? ["COUNCIL_NOT_REQUIRED", "COUNCIL_NOT_REQUIRED"]
    : record.riskClass === "R4"
      ? ["DENIED", "DENIED"]
      : record.disposition === "NO_QUORUM"
        ? ["NO_QUORUM", "NO_QUORUM"]
        : ["DECIDED", RISK_DISPOSITIONS[record.riskClass]];
  if (record.state !== expectedTerminal[0] || record.disposition !== expectedTerminal[1]) return false;
  if (immediate) {
    if (record.candidateHash !== null || record.proposerSeatId !== null || record.votes.length !== 0) return false;
  } else {
    if (!HASH64.test(record.candidateHash) || !nonempty(record.proposerSeatId)
        || record.votes.length !== 3
        || new Set(record.votes.map((vote) => vote.seatId)).size !== 3
        || record.votes.some((vote) => (vote.voteValue === "MISSING"
          ? vote.candidateHash !== null
          : vote.candidateHash !== record.candidateHash))) return false;
    // Keep record shape and binding checks here as defense-in-depth. Quorum semantics are not
    // approximated on the privileged side: the independently verified proof is authoritative.
  }
  try {
    return computeDecisionRecordHash(valueWithoutHash(record, "recordHash")) === record.recordHash;
  } catch {
    return false;
  }
}

function validTaskRecord(record) {
  if (!validateTaskRecordShape(record)) return false;
  try {
    return computeTaskRecordHash(valueWithoutHash(record, "taskRecordHash")) === record.taskRecordHash;
  } catch {
    return false;
  }
}

function validCurrentContext(context) {
  return ownObject(context) && Object.keys(context).length === 2
    && HASH64.test(context.contextHash) && HEX40.test(context.repositoryHead);
}

function validStopEpoch(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function deriveScope(taskRecord) {
  const forbidden = new Set(taskRecord.forbiddenScope ?? []);
  const seen = new Set();
  const scope = [];
  for (const token of taskRecord.allowedScope) {
    if (!forbidden.has(token) && !seen.has(token)) {
      seen.add(token);
      scope.push(token);
    }
  }
  return scope;
}

/**
 * Pure authorization construction per ADR-0006.
 *
 * @returns {{status:"NO_ENVELOPE", reason:string}|{status:"ENVELOPE", envelope:object}}
 */
export function evaluateAuthorization(
  decisionRecord,
  taskRecord,
  currentContext,
  currentStopEpoch,
  policyVersion = POLICY_VERSION,
  proof,
  trustedRegistry,
) {
  if (!validDecisionRecord(decisionRecord)) return noEnvelope("INVALID_DECISION_RECORD");
  if (!validTaskRecord(taskRecord)) return noEnvelope("INVALID_TASK_RECORD");
  if (!validCurrentContext(currentContext)) return noEnvelope("INVALID_CURRENT_CONTEXT");
  if (!validStopEpoch(currentStopEpoch)) return noEnvelope("INVALID_STOP_EPOCH");
  if (policyVersion !== POLICY_VERSION) return noEnvelope("UNSUPPORTED_POLICY_VERSION");

  if (decisionRecord.disposition === "DENIED" || decisionRecord.riskClass === "R4") {
    return noEnvelope("R4_HARD_DENY");
  }
  if (decisionRecord.disposition === "NO_QUORUM") return noEnvelope("COUNCIL_GATE_NOT_MET");
  if (RISK_DISPOSITIONS[decisionRecord.riskClass] !== decisionRecord.disposition) {
    return noEnvelope("RISK_DISPOSITION_MISMATCH");
  }
  if (["R1", "R2", "R3"].includes(decisionRecord.riskClass)) {
    const proofResult = verifyCouncilQuorumProof({ proof, decisionRecord, trustedRegistry });
    if (proofResult.authorizationEvidenceEligible !== true) {
      return noEnvelope(proofResult.errorCode ?? "COUNCIL_PROOF_INELIGIBLE");
    }
  }
  if (decisionRecord.taskId !== taskRecord.taskId) return noEnvelope("TASK_IDENTITY_MISMATCH");
  if (taskRecord.disposition === "BLOCKED") return noEnvelope("TASK_RECORD_BLOCKED");
  if (decisionRecord.contextHash !== currentContext.contextHash
      || decisionRecord.repositoryHead !== currentContext.repositoryHead) {
    return noEnvelope("CONTEXT_ALREADY_STALE");
  }

  const allowedScope = deriveScope(taskRecord);

  const humanRequired = decisionRecord.disposition === "HUMAN_APPROVAL_REQUIRED";
  const body = {
    protocolVersion: PROTOCOL_VERSION,
    authorizationId: computeAuthorizationId(decisionRecord.decisionRequestId, decisionRecord.recordHash),
    decisionRecordRef: {
      decisionRequestId: decisionRecord.decisionRequestId,
      recordHash: decisionRecord.recordHash,
    },
    candidateHash: decisionRecord.candidateHash,
    taskId: decisionRecord.taskId,
    riskClass: decisionRecord.riskClass,
    contextHash: decisionRecord.contextHash,
    repositoryHead: decisionRecord.repositoryHead,
    councilEpochId: decisionRecord.councilEpochId,
    stopEpoch: currentStopEpoch,
    policyVersion,
    actionType: ACTION_TYPE,
    allowedScope,
    prohibitedEffects: [...PROHIBITED_EFFECTS],
    humanApproval: { required: humanRequired, grantRef: null },
    singleUse: true,
    disposition: humanRequired ? "PENDING_HUMAN_APPROVAL" : "POLICY_SATISFIED",
  };
  const envelope = deepFreeze({ ...body, envelopeHash: computeAuthorizationEnvelopeHash(body) });
  return deepFreeze({ status: "ENVELOPE", envelope });
}
