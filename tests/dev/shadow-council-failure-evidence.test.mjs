import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createSession } from "../../scripts/dev/decision-council-kernel.mjs";
import { compileProjectContextPack } from "../../scripts/dev/project-context-pack.mjs";
import { computeOutputHash } from "../../scripts/dev/shadow-council-attestation.mjs";
import { runShadowExerciseWithDurableEvidence } from "../../scripts/dev/shadow-council-run-bundle-evidence.mjs";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const root = mkdtempSync(join(realpathSync(tmpdir()), "mihver-shadow-failure-evidence-"));
const seats = [
  { seatId: "seat-openai", provider: "openai", modelFamily: "gpt", modelId: "gpt-5.6-sol", councilEpochId: "failure-evidence-epoch" },
  { seatId: "seat-anthropic", provider: "anthropic", modelFamily: "claude", modelId: "claude-opus-5", councilEpochId: "failure-evidence-epoch" },
  { seatId: "seat-google", provider: "google", modelFamily: "gemini", modelId: "gemini-3.7-flash-medium", councilEpochId: "failure-evidence-epoch" },
];
const seatIds = seats.map(({ seatId }) => seatId);
const contextPack = compileProjectContextPack(REPO_ROOT);
const taskRecord = {
  taskId: "SHADOW-FAILURE-EVIDENCE-TEST", objective: "Test incremental Shadow Council evidence.",
  branch: "feat/shadow-council-failure-evidence-v1", baseCommit: "a".repeat(40),
  allowedScope: ["scripts/dev/**", "tests/dev/**"], disposition: "IN_PROGRESS",
  unresolvedRisks: ["Synthetic test bundle remains advisory."], humanActionRequested: "Inspect evidence.",
};
const rawMarker = "RAW_FAILURE_STDOUT_FIXTURE_MUST_NEVER_PERSIST";

function fresh(decisionRequestId) {
  const request = {
    decisionRequestId, taskId: "failure-evidence-test", riskClass: "R1",
    contextHash: contextPack.contextHash, repositoryHead: contextPack.repository.head,
    councilEpochId: "failure-evidence-epoch", rotationOrdinal: 0,
  };
  return createSession(request, { epochId: "failure-evidence-epoch", seats }, {
    contextHash: contextPack.contextHash, repositoryHead: contextPack.repository.head,
  }).session;
}

function fixture(answers) {
  let invocation = 0;
  return {
    spawnSeatImpl(seatId) {
      invocation++;
      return {
        stdout: `${rawMarker}:${seatId}:invocation-${invocation}`, stderr: "", exitCode: 0,
        childProcessId: invocation, cliExecutableRealpath: `/${seatId}`, cliVersion: "1",
      };
    },
    parseSeatOutputImpl(seatId) {
      const value = invocation === 1
        ? { summary: "Bounded candidate", payload: { safe: true } }
        : answers[seatId];
      return {
        text: JSON.stringify(value), reportedModelId: null, modelUsage: {}, providerSessionId: null,
        observedToolUsage: [], usageMetadata: null,
      };
    },
  };
}

function options(name, injected) {
  const out = join(root, name);
  return {
    out, evidenceDir: join(out, "evidence"), runId: name, contextPack, taskRecord,
    decisionQuestion: "Should this bounded synthetic candidate pass?", evidence: ["synthetic"],
    seatIds, ...injected, execFileSyncImpl: () => "https://github.com/MIHVER/mihver.git\n",
  };
}

function readManifest(out) {
  return JSON.parse(readFileSync(join(out, "evidence-manifest.json"), "utf8"));
}

function captureArtifacts() {
  const values = [];
  return {
    values,
    hooks: {
      onPacketBuilt: (value) => values.push(value),
      onAttestationAdmitted: (value) => values.push(value),
      onAssessmentBuilt: (value) => values.push(value),
      onInvocationFailure: (value) => values.push(value),
    },
  };
}

try {
  const successfulAnswers = Object.fromEntries(seatIds.map((seatId) => [seatId, {
    voteValue: "APPROVE", rationale: `Successful rationale for ${seatId}`,
  }]));
  const successCaptured = captureArtifacts();
  const successOpts = options("success", { ...fixture(successfulAnswers), hooks: successCaptured.hooks });
  const success = runShadowExerciseWithDurableEvidence(fresh("success-decision"), successOpts);
  assert.equal(success.assessments.length, 3);
  // proposer packet/attestation + 3 packet/attestation/assessment sets + 1 terminal DecisionRecord
  assert.equal(success.evidence.length, 12);
  assert.equal(readManifest(successOpts.out).evidence.length, 12);
  const decisionRecordEntry = success.evidence.find((entry) => entry.evidenceId.startsWith("shadow-decision-record:"));
  assert.ok(decisionRecordEntry, "expected a persisted shadow-decision-record evidence entry");
  assert.deepEqual(JSON.parse(readFileSync(decisionRecordEntry.sourcePath, "utf8")), success.decisionRecord);
  assert.deepEqual(
    success.evidence.filter((entry) => entry !== decisionRecordEntry)
      .map((entry) => JSON.parse(readFileSync(entry.sourcePath, "utf8"))),
    successCaptured.values
  );
  for (const assessment of success.assessments) {
    const entry = success.evidence.find((item) => item.evidenceId === `shadow-vote-assessment:${assessment.assessmentHash}`);
    assert.deepEqual(JSON.parse(readFileSync(entry.sourcePath, "utf8")), assessment);
  }

  const malformedRationale = " \t\n";
  const failureAnswers = {
    "seat-openai": { voteValue: "REJECT", rationale: "Exact valid rejection rationale." },
    "seat-anthropic": { voteValue: "APPROVE", rationale: malformedRationale },
    "seat-google": { voteValue: "APPROVE", rationale: "Must never be invoked." },
  };
  const failureCaptured = captureArtifacts();
  const failureOpts = options("failure", { ...fixture(failureAnswers), hooks: failureCaptured.hooks });
  assert.throws(
    () => runShadowExerciseWithDurableEvidence(fresh("failure-decision"), failureOpts),
    (error) => error.message === "MALFORMED_SEAT_OUTPUT"
  );

  const manifest = readManifest(failureOpts.out);
  assert.equal(manifest.evidence.length, 8);
  const persisted = manifest.evidence.map((entry) => ({
    entry, value: JSON.parse(readFileSync(entry.sourcePath, "utf8")),
  }));
  const persistedById = new Map(persisted.map(({ entry, value }) => [entry.evidenceId, value]));
  for (const value of failureCaptured.values) {
    const domainHash = value.failureHash ?? value.assessmentHash ?? value.attestationHash ?? value.packetHash;
    const prefix = value.failureHash ? "shadow-seat-invocation-failure"
      : value.assessmentHash ? "shadow-vote-assessment"
        : value.attestationHash ? "shadow-seat-attestation" : "shadow-council-packet";
    assert.deepEqual(persistedById.get(`${prefix}:${domainHash}`), value);
  }
  assert.equal(persisted.filter(({ entry }) => entry.evidenceId.startsWith("shadow-council-packet:")).length, 3);
  assert.equal(persisted.filter(({ entry }) => entry.evidenceId.startsWith("shadow-seat-attestation:")).length, 3);
  assert.equal(persisted.filter(({ entry }) => entry.evidenceId.startsWith("shadow-vote-assessment:")).length, 1);
  assert.equal(persisted.filter(({ entry }) => entry.evidenceId.startsWith("shadow-seat-invocation-failure:")).length, 1);
  const assessment = persisted.find(({ entry }) => entry.evidenceId.startsWith("shadow-vote-assessment:"))?.value;
  assert.equal(assessment.seatId, "seat-openai");
  assert.equal(assessment.voteValue, "REJECT");
  assert.equal(assessment.rationale, "Exact valid rejection rationale.");
  const failure = persisted.find(({ entry }) => entry.evidenceId.startsWith("shadow-seat-invocation-failure:"))?.value;
  assert.equal(failure.seatId, "seat-anthropic");
  assert.equal(failure.stage, "ASSESSMENT_VALIDATION");
  assert.equal(failure.errorCode, "MALFORMED_ASSESSMENT_INPUT");
  assert.deepEqual(failure.details, { field: "rationale" });
  assert.deepEqual(failure.assessmentFailure, {
    errorCode: "MALFORMED_ASSESSMENT_INPUT", details: { field: "rationale" },
  });
  assert.equal(failure.stdoutByteLength, Buffer.byteLength(`${rawMarker}:seat-anthropic:invocation-3`));
  assert.match(failure.stdoutHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(Object.hasOwn(failure, "stdout"), false);
  assert.equal(persisted.some(({ value }) => value.seatId === "seat-google"), false);
  assert.equal(persisted.some(({ value }) => Object.hasOwn(value, "recordHash") || value.type === "DecisionRecord"), false);

  const runManifest = JSON.parse(readFileSync(join(failureOpts.out, "run-manifest.json"), "utf8"));
  assert.equal(runManifest.status, "OPEN");
  assert.equal(runManifest.finalizedAt, null);
  for (const directory of [failureOpts.out, failureOpts.evidenceDir]) {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (name === "evidence") continue;
      assert.doesNotMatch(readFileSync(path, "utf8"), new RegExp(rawMarker));
    }
  }

  const finalizedFailureOpts = options("failure-finalize-requested", {
    ...fixture(failureAnswers), finalize: true, finalizedAt: "2026-08-30T00:00:00Z",
  });
  assert.throws(
    () => runShadowExerciseWithDurableEvidence(fresh("failure-finalize-requested"), finalizedFailureOpts),
    (error) => error.message === "MALFORMED_SEAT_OUTPUT"
  );
  const failedFinalizeManifest = JSON.parse(readFileSync(join(finalizedFailureOpts.out, "run-manifest.json"), "utf8"));
  assert.equal(failedFinalizeManifest.status, "OPEN");
  assert.equal(failedFinalizeManifest.finalizedAt, null);

  const throwingHookOpts = options("failure-throwing-hook", {
    ...fixture(failureAnswers),
    hooks: { onInvocationFailure: () => { throw new Error("CALLER_HOOK_BROKE"); } },
  });
  assert.throws(
    () => runShadowExerciseWithDurableEvidence(fresh("failure-throwing-hook"), throwingHookOpts),
    (error) => error.message === "MALFORMED_SEAT_OUTPUT"
  );
  assert.equal(readManifest(throwingHookOpts.out).evidence.some((entry) => entry.evidenceId.startsWith("shadow-seat-invocation-failure:")), true);

  const admissionFixture = fixture(successfulAnswers);
  const admissionStdout = `${rawMarker}:seat-openai:invocation-1`;
  const admissionOpts = options("admission-rejection", {
    ...admissionFixture,
    spawnSeatImpl(seatId) {
      const run = admissionFixture.spawnSeatImpl(seatId);
      return { ...run, exitCode: 9 };
    },
  });
  assert.throws(
    () => runShadowExerciseWithDurableEvidence(fresh("admission-rejection"), admissionOpts),
    (error) => error.message === "NONZERO_EXIT"
  );
  const admissionPersisted = readManifest(admissionOpts.out).evidence.map((entry) => ({
    entry, value: JSON.parse(readFileSync(entry.sourcePath, "utf8")),
  }));
  const rejected = admissionPersisted.find(({ entry }) => entry.evidenceId.startsWith("shadow-seat-rejected-attestation:"));
  const admissionFailure = admissionPersisted.find(({ entry }) => entry.evidenceId.startsWith("shadow-seat-invocation-failure:"));
  assert.ok(rejected, "constructed-but-rejected attestation must be durable");
  assert.ok(admissionFailure, "admission failure must be durable");
  assert.match(rejected.entry.summary, /Rejected Shadow Council attestation.*NONZERO_EXIT/);
  assert.equal(admissionFailure.value.stage, "ADMISSION");
  assert.equal(admissionFailure.value.provider, "openai");
  assert.equal(admissionFailure.value.requestedModelId, "gpt-5.6-sol");
  assert.equal(admissionFailure.value.attestationHash, rejected.value.attestationHash);
  assert.equal(admissionFailure.value.stdoutHash, computeOutputHash(admissionStdout));
  assert.equal(admissionFailure.value.stdoutByteLength, Buffer.byteLength(admissionStdout));
  assert.equal(JSON.parse(readFileSync(join(admissionOpts.out, "run-manifest.json"), "utf8")).status, "OPEN");

  console.log("Shadow Council failure evidence tests: 5 passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
