import { createHash } from "node:crypto";
import { canonicalizeJson } from "./canonical-json.mjs";

const DOMAIN = "MIHVER:ShadowCouncil:ShadowVoteAssessment:v1\0";
const HASH = /^sha256:[0-9a-f]{64}$/;
const VOTES = new Set(["APPROVE", "REJECT", "ABSTAIN"]);
const INPUT_FIELDS = ["decisionRequestId", "candidateHash", "seatId", "councilEpochId", "packetHash", "outputHash", "attestationHash", "voteValue", "rationale"];
const ASSESSMENT_FIELDS = ["assessmentHash", ...INPUT_FIELDS];
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value, fields) => plain(value) && Object.keys(value).length === fields.length
  && fields.every((field) => Object.hasOwn(value, field));
const failure = (errorCode, details = {}) => ({ ok: false, errorCode, details });

export function computeAssessmentHash(assessmentWithoutHash) {
  return `sha256:${createHash("sha256")
    .update(Buffer.from(DOMAIN, "utf8"))
    .update(Buffer.from(canonicalizeJson(assessmentWithoutHash), "utf8"))
    .digest("hex")}`;
}

export function buildShadowVoteAssessment(input) {
  try {
    if (!exact(input, INPUT_FIELDS)) return failure("MALFORMED_ASSESSMENT_INPUT", { reason: "INVALID_FIELDS" });
    for (const field of ["decisionRequestId", "seatId", "councilEpochId"]) {
      if (typeof input[field] !== "string" || input[field].length === 0) return failure("MALFORMED_ASSESSMENT_INPUT", { field });
    }
    for (const field of ["candidateHash", "packetHash", "outputHash"]) {
      if (typeof input[field] !== "string" || !HASH.test(input[field])) return failure("MALFORMED_ASSESSMENT_INPUT", { field });
    }
    if (input.attestationHash !== null && (typeof input.attestationHash !== "string" || !HASH.test(input.attestationHash))) return failure("MALFORMED_ASSESSMENT_INPUT", { field: "attestationHash" });
    if (!VOTES.has(input.voteValue)) return failure("MALFORMED_ASSESSMENT_INPUT", { field: "voteValue" });
    if (typeof input.rationale !== "string" || input.rationale.trim().length === 0) return failure("MALFORMED_ASSESSMENT_INPUT", { field: "rationale" });
    if (Buffer.byteLength(input.rationale, "utf8") > 4096) return failure("MALFORMED_ASSESSMENT_INPUT", { field: "rationale", reason: "UTF8_BYTE_LIMIT" });
    if (input.rationale.length > 1200) return failure("MALFORMED_ASSESSMENT_INPUT", { field: "rationale", reason: "CHARACTER_LIMIT" });
    canonicalizeJson(input);
    const assessment = { ...input };
    return { ok: true, assessment: { assessmentHash: computeAssessmentHash(assessment), ...assessment } };
  } catch {
    return failure("MALFORMED_ASSESSMENT_INPUT", { reason: "NON_CANONICAL_INPUT" });
  }
}

export function deriveAgentVote(assessment) {
  if (!verifyAssessmentHash(assessment)) throw new Error("ASSESSMENT_HASH_MISMATCH");
  return { decisionRequestId: assessment.decisionRequestId, candidateHash: assessment.candidateHash, seatId: assessment.seatId, councilEpochId: assessment.councilEpochId, voteValue: assessment.voteValue };
}

export function verifyAssessmentHash(assessment) {
  try {
    if (!exact(assessment, ASSESSMENT_FIELDS) || !HASH.test(assessment.assessmentHash)) return false;
    const withoutHash = Object.fromEntries(INPUT_FIELDS.map((field) => [field, assessment[field]]));
    return computeAssessmentHash(withoutHash) === assessment.assessmentHash;
  } catch { return false; }
}
