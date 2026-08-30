import { createHash } from "node:crypto";

import { canonicalizeJson } from "./canonical-json.mjs";

export const FAKE_ACTIONS = Object.freeze([
  "FAKE_WRITE_ARTIFACT",
  "FAKE_COMPUTE",
  "FAKE_NOOP",
]);

const ACTION_SET = new Set(FAKE_ACTIONS);
const RECEIPT_DOMAIN = "MIHVER:FakeExecutionReceipt:v1\0";
const INPUT_DOMAIN = "MIHVER:FakeExecutionInput:v1\0";
const RESULT_DOMAIN = "MIHVER:FakeExecutionResult:v1\0";

function hash(domain, value) {
  return `sha256:${createHash("sha256").update(domain).update(canonicalizeJson(value)).digest("hex")}`;
}

export function computeFakeInputHash(input) {
  return hash(INPUT_DOMAIN, input);
}

export function computeFakeReceiptHash(receiptWithoutHash) {
  return hash(RECEIPT_DOMAIN, receiptWithoutHash);
}

export function computeFakeDeterministicResult(action, inputHash) {
  if (!ACTION_SET.has(action)) throw new TypeError(`unsupported fake action: ${String(action)}`);
  return {
    simulation: action,
    wouldPerform: {
      FAKE_WRITE_ARTIFACT: "DESCRIBE_ARTIFACT_WRITE_ONLY",
      FAKE_COMPUTE: "DESCRIBE_COMPUTATION_ONLY",
      FAKE_NOOP: "NO_OPERATION",
    }[action],
    resultHash: hash(RESULT_DOMAIN, { action, inputHash }),
  };
}

export function executeFakeAction({ loopRunId, iteration, authorizationId, action, input }) {
  if (typeof loopRunId !== "string" || loopRunId.length === 0) throw new TypeError("loopRunId must be a non-empty string");
  if (!Number.isInteger(iteration) || iteration < 1) throw new TypeError("iteration must be a positive integer");
  if (typeof authorizationId !== "string" || authorizationId.length === 0) throw new TypeError("authorizationId must be a non-empty string");
  if (!ACTION_SET.has(action)) throw new TypeError(`unsupported fake action: ${String(action)}`);

  const inputHash = computeFakeInputHash(input);
  const deterministicResult = computeFakeDeterministicResult(action, inputHash);
  const body = {
    protocolVersion: "1.0.0",
    kind: "FakeExecutionReceipt",
    loopRunId,
    iteration,
    authorizationId,
    action,
    inputHash,
    deterministicResult,
  };
  return Object.freeze({ ...body, receiptHash: computeFakeReceiptHash(body) });
}
