import { createHash } from "node:crypto";
import { canonicalizeJson } from "./canonical-json.mjs";

const DOMAIN = "MIHVER:ShadowCouncil:ShadowSeatInvocationFailure:v1\0";
const HASH = /^sha256:[0-9a-f]{64}$/;
const ROLES = new Set(["PROPOSER", "VOTER"]);
const STAGES = new Set([
  "INVOCATION_CONFIG",
  "SPAWN",
  "PROVIDER_ENVELOPE_PARSE",
  "ATTESTATION_BUILD",
  "ADMISSION",
  "SHADOW_RESPONSE_JSON_PARSE",
  "SHADOW_RESPONSE_SHAPE",
  "ASSESSMENT_VALIDATION",
  "VOTE_DERIVATION",
  "KERNEL_EVENT",
  "RUN_POSTCONDITION",
]);
const HASH_OR_NULL_FIELDS = [
  "packetHash",
  "invocationConfigHash",
  "stdoutHash",
  "stderrHash",
  "outputHash",
  "attestationHash",
];
const INPUT_FIELDS = [
  "decisionRequestId",
  "councilEpochId",
  "seatId",
  "provider",
  "requestedModelId",
  "invocationRole",
  "candidateHash",
  "stage",
  "errorCode",
  "details",
  ...HASH_OR_NULL_FIELDS.slice(0, 4),
  "stdoutByteLength",
  "stderrByteLength",
  ...HASH_OR_NULL_FIELDS.slice(4),
  "assessmentFailure",
];
const FAILURE_FIELDS = ["failureHash", ...INPUT_FIELDS];
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value, fields) => plain(value) && Object.keys(value).length === fields.length
  && fields.every((field) => Object.hasOwn(value, field));
const malformed = (details) => ({ ok: false, errorCode: "MALFORMED_INVOCATION_FAILURE_INPUT", details });

export function computeInvocationFailureHash(failureWithoutHash) {
  return `sha256:${createHash("sha256")
    .update(Buffer.from(DOMAIN, "utf8"))
    .update(Buffer.from(canonicalizeJson(failureWithoutHash), "utf8"))
    .digest("hex")}`;
}

export function buildShadowSeatInvocationFailure(input) {
  try {
    if (!exact(input, INPUT_FIELDS)) return malformed({ reason: "INVALID_FIELDS" });
    for (const field of ["decisionRequestId", "councilEpochId", "seatId", "provider", "requestedModelId"]) {
      if (typeof input[field] !== "string" || input[field].length === 0) return malformed({ field, reason: "NON_EMPTY_STRING_REQUIRED" });
    }
    if (!ROLES.has(input.invocationRole)) return malformed({ field: "invocationRole", reason: "INVALID_ENUM_VALUE" });
    if (input.invocationRole === "PROPOSER" && input.candidateHash !== null) return malformed({ field: "candidateHash", reason: "MUST_BE_NULL_FOR_PROPOSER" });
    if (input.invocationRole === "VOTER" && (typeof input.candidateHash !== "string" || !HASH.test(input.candidateHash))) return malformed({ field: "candidateHash", reason: "VALID_HASH_REQUIRED_FOR_VOTER" });
    if (!STAGES.has(input.stage)) return malformed({ field: "stage", reason: "INVALID_ENUM_VALUE" });
    // Harness error codes intentionally remain open while its final taxonomy is being wired.
    if (typeof input.errorCode !== "string" || input.errorCode.length === 0) return malformed({ field: "errorCode", reason: "NON_EMPTY_STRING_REQUIRED" });
    if (!plain(input.details)) return malformed({ field: "details", reason: "PLAIN_OBJECT_REQUIRED" });
    for (const field of HASH_OR_NULL_FIELDS) {
      if (input[field] !== null && (typeof input[field] !== "string" || !HASH.test(input[field]))) return malformed({ field, reason: "HASH_OR_NULL_REQUIRED" });
    }
    for (const field of ["stdoutByteLength", "stderrByteLength"]) {
      if (input[field] !== null && (!Number.isInteger(input[field]) || input[field] < 0)) return malformed({ field, reason: "NON_NEGATIVE_INTEGER_OR_NULL_REQUIRED" });
    }
    if (input.assessmentFailure !== null) {
      if (!exact(input.assessmentFailure, ["errorCode", "details"])) return malformed({ field: "assessmentFailure", reason: "INVALID_FIELDS" });
      if (typeof input.assessmentFailure.errorCode !== "string" || input.assessmentFailure.errorCode.length === 0) return malformed({ field: "assessmentFailure.errorCode", reason: "NON_EMPTY_STRING_REQUIRED" });
      if (!plain(input.assessmentFailure.details)) return malformed({ field: "assessmentFailure.details", reason: "PLAIN_OBJECT_REQUIRED" });
    }
    canonicalizeJson(input);
    const failure = { ...input };
    return { ok: true, failure: { failureHash: computeInvocationFailureHash(failure), ...failure } };
  } catch {
    return malformed({ reason: "NON_CANONICAL_INPUT" });
  }
}

export function verifyInvocationFailureHash(failure) {
  try {
    if (!exact(failure, FAILURE_FIELDS) || typeof failure.failureHash !== "string" || !HASH.test(failure.failureHash)) return false;
    const withoutHash = Object.fromEntries(INPUT_FIELDS.map((field) => [field, failure[field]]));
    return computeInvocationFailureHash(withoutHash) === failure.failureHash;
  } catch {
    return false;
  }
}
