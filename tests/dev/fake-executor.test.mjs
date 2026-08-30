import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";

import { executeFakeAction, FAKE_ACTIONS } from "../../scripts/dev/fake-executor.mjs";
import { verifyFakeExecutionReceipt } from "../../scripts/dev/authorization-verifier.mjs";

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS: ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL: ${name}\n${error.stack}`); }
}

const request = {
  loopRunId: "loop-deterministic", iteration: 1, authorizationId: "authorization-1",
  action: "FAKE_COMPUTE", input: { operands: [2, 3], operation: "fixture-only" },
};
const fakeReceiptSchema = JSON.parse(readFileSync(new URL("../../schemas/dev/fake-execution-record.schema.json", import.meta.url), "utf8"));
const validateFakeReceipt = new Ajv2020({ allErrors: true, strict: true }).compile(fakeReceiptSchema);

await test("same request creates a byte-identical deterministic receipt", () => {
  const receipt = executeFakeAction(request);
  assert.deepEqual(receipt, executeFakeAction(structuredClone(request)));
  assert.equal(validateFakeReceipt(receipt), true, JSON.stringify(validateFakeReceipt.errors));
});

await test("closed fake action enum rejects unknown and non-fake actions", () => {
  assert.deepEqual(FAKE_ACTIONS, ["FAKE_WRITE_ARTIFACT", "FAKE_COMPUTE", "FAKE_NOOP"]);
  assert.throws(() => executeFakeAction({ ...request, action: "WRITE_FILE" }), /unsupported fake action/);
});

await test("verifier independently checks every receipt identity and deterministic result field", () => {
  const receipt = executeFakeAction(request);
  const allowance = { canonicalAuthorizationId: request.authorizationId };
  assert.deepEqual(verifyFakeExecutionReceipt({
    receipt, requestedAction: request.action, requestedInput: request.input,
    requestedLoopRunId: request.loopRunId, requestedIteration: request.iteration,
    authorizationEnvelope: { authorizationId: request.authorizationId }, allowance,
  }), { verified: true, errors: [] });
  const base = { requestedAction: request.action, requestedInput: request.input,
    requestedLoopRunId: request.loopRunId, requestedIteration: request.iteration,
    authorizationEnvelope: { authorizationId: request.authorizationId }, allowance };
  for (const corrupt of [
    { ...receipt, loopRunId: "another-loop" }, { ...receipt, iteration: 2 },
    { ...receipt, authorizationId: "another-authorization" },
    { ...receipt, deterministicResult: { ...receipt.deterministicResult, resultHash: `sha256:${"f".repeat(64)}` } },
  ]) assert.equal(verifyFakeExecutionReceipt({ ...base, receipt: corrupt }).verified, false);
  assert.equal(verifyFakeExecutionReceipt({ ...base, receipt,
    allowance: { canonicalAuthorizationId: "ledger-disagrees" } }).verified, false);
});

await test("authority-distant modules import no effect-capable modules", () => {
  const sources = ["authorization-loop.mjs", "authorization-binder.mjs", "authorization-ledger-simulator.mjs"];
  const forbidden = /^(?:node:)?(?:child_process|fs(?:\/promises)?|net|http|https)$|tools\/publication-broker|scripts\/dev\/publication-builder|scripts\/dev\/night-runner/;
  const visited = new Set();
  function inspect(moduleUrl) {
    if (visited.has(moduleUrl.href)) return;
    visited.add(moduleUrl.href);
    const source = readFileSync(moduleUrl, "utf8");
    const imports = [...source.matchAll(/(?:import\s+(?:[^"']+?\s+from\s+)?|import\s*\()(["'])([^"']+)\1/g)].map((match) => match[2]);
    assert.equal(imports.some((specifier) => forbidden.test(specifier)), false,
      `${moduleUrl.pathname}: ${imports.join(", ")}`);
    for (const specifier of imports.filter((value) => value.startsWith("."))) {
      inspect(new URL(specifier, moduleUrl));
    }
  }
  for (const name of sources) inspect(new URL(`../../scripts/dev/${name}`, import.meta.url));
});

console.log(`\nFake executor tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
