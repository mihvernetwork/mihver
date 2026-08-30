import { executeFakeAction } from "./fake-executor.mjs";
import { verifyFakeExecutionReceipt } from "./authorization-verifier.mjs";
import { evaluateAuthorization } from "./authorization-binder.mjs";

export const DEFAULT_MAX_ITERATIONS = 2;
export const HARD_MAX_ITERATIONS = 3;

export const LOOP_STATES = Object.freeze([
  "CREATED", "OBSERVED", "DECISION_READY", "AUTHORIZATION_EVALUATED",
  "LEDGER_GATE_EVALUATED", "FAKE_EXECUTED", "VERIFIED", "NEXT_ITERATION",
  "COMPLETED", "STOPPED", "AUTHORIZATION_DENIED", "VERIFICATION_FAILED",
  "MAX_ITERATIONS_REACHED", "INTERNAL_ERROR",
]);

export const TERMINAL_OUTCOMES = Object.freeze([
  "COMPLETED", "STOPPED", "AUTHORIZATION_DENIED", "VERIFICATION_FAILED", "MAX_ITERATIONS_REACHED",
  "INTERNAL_ERROR",
]);

function normalizedMaximum(value) {
  if (!Number.isInteger(value) || value < 1) throw new TypeError("maxIterations must be a positive integer");
  return Math.min(value, HARD_MAX_ITERATIONS);
}

export async function runAuthorizationLoop({
  loopRunId,
  iterationFixtures,
  ledgerCheck,
  isStopStillValid,
  maxIterations = DEFAULT_MAX_ITERATIONS,
}) {
  if (typeof loopRunId !== "string" || loopRunId.length === 0) throw new TypeError("loopRunId must be a non-empty string");
  if (!Array.isArray(iterationFixtures)) throw new TypeError("iterationFixtures must be an array supplied by the caller");
  if (typeof ledgerCheck !== "function") throw new TypeError("ledgerCheck must be a function");
  if (typeof isStopStillValid !== "function") throw new TypeError("isStopStillValid must be a function");
  const effectiveMaxIterations = normalizedMaximum(maxIterations);
  const transitionLog = [{ state: "CREATED", iteration: 0 }];
  const receipts = [];
  const authorizationIds = [];
  const transition = (state, iteration) => transitionLog.push({ state, iteration });
  const finish = (outcome, iterationCount, details = {}) => {
    transition(outcome, iterationCount);
    return {
      protocolVersion: "1.0.0", kind: "AuthorizationLoopRecord", loopRunId,
      authorizationIds, requestedMaxIterations: maxIterations,
      effectiveMaxIterations, iterationCount, outcome, receipts, transitionLog, ...details,
    };
  };

  if (iterationFixtures.length === 0) return finish("COMPLETED", 0);
  for (let index = 0; index < effectiveMaxIterations; index += 1) {
    const iteration = index + 1;
    const fixture = iterationFixtures[index];
    if (fixture === undefined) return finish("COMPLETED", index);
    transition("OBSERVED", iteration);
    transition("DECISION_READY", iteration);
    let authorizationEnvelope;
    let ledgerResult;
    try {
      const authorization = evaluateAuthorization(
        fixture?.decisionRecord,
        fixture?.taskRecord,
        fixture?.currentContext,
        fixture?.currentStopEpoch,
        fixture?.policyVersion,
        fixture?.proof,
        fixture?.trustedRegistry,
      );
      transition("AUTHORIZATION_EVALUATED", iteration);
      if (authorization.status !== "ENVELOPE") {
        return finish("AUTHORIZATION_DENIED", index, {
          denial: { outcome: "DENY", reason: authorization.reason },
        });
      }
      authorizationEnvelope = authorization.envelope;
      if (authorizationIds.includes(authorizationEnvelope.authorizationId)) {
        return finish("AUTHORIZATION_DENIED", index, {
          denial: { outcome: "DENY", reason: "DUPLICATE_AUTHORIZATION_ID" },
        });
      }
      authorizationIds.push(authorizationEnvelope.authorizationId);
      ledgerResult = await ledgerCheck(authorizationEnvelope, { fixture, loopRunId, iteration });
    } catch (error) {
      return finish("INTERNAL_ERROR", index, {
        errorStep: authorizationEnvelope ? "LEDGER_CHECK" : "AUTHORIZATION_EVALUATION",
        failedIteration: iteration,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    transition("LEDGER_GATE_EVALUATED", iteration);
    if (ledgerResult?.outcome !== "ALLOW_ONCE"
        || ledgerResult.canonicalAuthorizationId !== authorizationEnvelope.authorizationId) {
      return finish("AUTHORIZATION_DENIED", index, { denial: ledgerResult ?? null });
    }

    // This is intentionally adjacent to dispatch: a fencing change after the ledger check wins.
    let stopValid;
    try {
      stopValid = await isStopStillValid({ authorizationEnvelope, allowance: ledgerResult, fixture, loopRunId, iteration });
    } catch (error) {
      return finish("INTERNAL_ERROR", index, {
        errorStep: "STOP_CHECK", failedIteration: iteration,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    if (stopValid !== true) return finish("STOPPED", index, { stopIteration: iteration });

    let receipt;
    let verification;
    try {
      receipt = executeFakeAction({
        loopRunId, iteration, authorizationId: authorizationEnvelope.authorizationId,
        action: fixture.action, input: fixture.input,
      });
      transition("FAKE_EXECUTED", iteration);
      receipts.push(receipt);
      verification = verifyFakeExecutionReceipt({
        receipt, requestedAction: fixture.action, requestedInput: fixture.input,
        requestedLoopRunId: loopRunId, requestedIteration: iteration,
        authorizationEnvelope, allowance: ledgerResult,
      });
    } catch (error) {
      return finish("INTERNAL_ERROR", index, {
        errorStep: receipt ? "VERIFICATION" : "FAKE_EXECUTION", failedIteration: iteration,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    if (verification?.verified !== true) {
      return finish("VERIFICATION_FAILED", iteration, { verificationErrors: verification?.errors ?? ["VERIFIER_REJECTED"] });
    }
    transition("VERIFIED", iteration);
    transition("NEXT_ITERATION", iteration);
    if (iteration === iterationFixtures.length) return finish("COMPLETED", iteration);
  }
  return finish("MAX_ITERATIONS_REACHED", effectiveMaxIterations, { remainingIterations: iterationFixtures.length - effectiveMaxIterations });
}
