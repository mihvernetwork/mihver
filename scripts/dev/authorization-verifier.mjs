import {
  computeFakeDeterministicResult,
  computeFakeInputHash,
  computeFakeReceiptHash,
  FAKE_ACTIONS,
} from "./fake-executor.mjs";

export function verifyFakeExecutionReceipt({
  receipt, requestedLoopRunId, requestedIteration, requestedAction, requestedInput,
  authorizationEnvelope, allowance,
}) {
  const errors = [];
  if (!receipt || typeof receipt !== "object") return { verified: false, errors: ["RECEIPT_MISSING"] };
  const envelopeAuthorizationId = authorizationEnvelope?.authorizationId;
  const canonicalAuthorizationId = allowance?.canonicalAuthorizationId;
  if (typeof envelopeAuthorizationId !== "string"
      || typeof canonicalAuthorizationId !== "string"
      || envelopeAuthorizationId !== canonicalAuthorizationId
      || receipt.authorizationId !== envelopeAuthorizationId
      || receipt.authorizationId !== canonicalAuthorizationId) errors.push("AUTHORIZATION_MISMATCH");
  if (typeof requestedLoopRunId !== "string" || receipt.loopRunId !== requestedLoopRunId) errors.push("LOOP_RUN_MISMATCH");
  if (!Number.isInteger(requestedIteration) || receipt.iteration !== requestedIteration) errors.push("ITERATION_MISMATCH");
  if (!FAKE_ACTIONS.includes(requestedAction) || receipt.action !== requestedAction) errors.push("ACTION_MISMATCH");
  try {
    const expectedInputHash = computeFakeInputHash(requestedInput);
    if (receipt.inputHash !== expectedInputHash) errors.push("INPUT_HASH_MISMATCH");
    const expectedResult = computeFakeDeterministicResult(requestedAction, expectedInputHash);
    if (JSON.stringify(receipt.deterministicResult) !== JSON.stringify(expectedResult)) {
      errors.push("DETERMINISTIC_RESULT_MISMATCH");
    }
    const { receiptHash, ...body } = receipt;
    if (receiptHash !== computeFakeReceiptHash(body)) errors.push("RECEIPT_HASH_MISMATCH");
  } catch {
    errors.push("RECEIPT_NOT_CANONICAL");
  }
  return { verified: errors.length === 0, errors };
}
