import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeJson } from "../../scripts/dev/canonical-json.mjs";
import { createSession } from "../../scripts/dev/decision-council-kernel.mjs";
import { compileProjectContextPack } from "../../scripts/dev/project-context-pack.mjs";
import { computeContentHash, writeRunBundle } from "../../scripts/dev/run-bundle.mjs";
import { runShadowExerciseWithEvidence, writeShadowVoteAssessmentEvidence } from "../../scripts/dev/shadow-council-run-bundle-evidence.mjs";
import { buildShadowVoteAssessment } from "../../scripts/dev/shadow-council-vote-assessment.mjs";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const root = mkdtempSync(join(realpathSync(tmpdir()), "mihver-shadow-assessment-evidence-"));

function assessment(rationale) {
  const result = buildShadowVoteAssessment({
    decisionRequestId: "decision-1", candidateHash: `sha256:${"1".repeat(64)}`,
    seatId: "seat-openai", councilEpochId: "epoch-1", packetHash: `sha256:${"2".repeat(64)}`,
    outputHash: `sha256:${"3".repeat(64)}`, attestationHash: `sha256:${"4".repeat(64)}`,
    voteValue: "REJECT", rationale,
  });
  assert.equal(result.ok, true);
  return result.assessment;
}

try {
  const evidenceDir = join(root, "unit-evidence");
  const original = assessment("Decisive ground A");
  const changedByOneByte = assessment("Decisive ground B");
  const first = writeShadowVoteAssessmentEvidence(original, evidenceDir);
  const second = writeShadowVoteAssessmentEvidence(changedByOneByte, evidenceDir);
  const firstBytes = readFileSync(first.sourcePath);
  const secondBytes = readFileSync(second.sourcePath);

  assert.deepEqual(Object.keys(first), ["evidenceId", "kind", "producedBy", "summary", "path", "action", "sourcePath", "contentHash"]);
  assert.equal(first.kind, "ARTIFACT");
  assert.equal(first.action, "present");
  assert.equal(first.summary, original.rationale);
  assert.equal(first.contentHash, computeContentHash(firstBytes));
  assert.equal(firstBytes.toString("utf8"), canonicalizeJson(original));
  assert.deepEqual(JSON.parse(firstBytes), original);
  assert.notEqual(second.path, first.path);
  assert.notEqual(second.contentHash, first.contentHash);
  assert.equal(second.contentHash, computeContentHash(secondBytes));
  assert.equal(secondBytes.toString("utf8"), canonicalizeJson(changedByOneByte));

  const seats = [
    { seatId: "seat-openai", provider: "openai", modelFamily: "gpt", modelId: "gpt-5.6-sol", councilEpochId: "epoch-e2e" },
    { seatId: "seat-anthropic", provider: "anthropic", modelFamily: "claude", modelId: "claude-opus-5", councilEpochId: "epoch-e2e" },
    { seatId: "seat-google", provider: "google", modelFamily: "gemini", modelId: "gemini-3.7-flash-medium", councilEpochId: "epoch-e2e" },
  ];
  const hash = `sha256:${"5".repeat(64)}`;
  const session = createSession({ decisionRequestId: "decision-e2e", taskId: "task-e2e", riskClass: "R1", contextHash: hash, repositoryHead: "6".repeat(40), councilEpochId: "epoch-e2e", rotationOrdinal: 0 }, { epochId: "epoch-e2e", seats }, { contextHash: hash, repositoryHead: "6".repeat(40) }).session;
  const votesBySeatId = {
    "seat-openai": { voteValue: "REJECT", rationale: "The rollback plan does not cover partial writes after the migration begins." },
    "seat-anthropic": { voteValue: "ABSTAIN", rationale: "The supplied evidence does not establish the production data-retention boundary." },
    "seat-google": { voteValue: "APPROVE", rationale: "The bounded change is supported by the supplied evidence." },
  };
  const rawMarker = "RAW_FULL_CLI_STDOUT_MUST_NOT_PERSIST";
  let invocation = 0;
  const spawnSeatImpl = (seatId, prompt) => ({
    stdout: `${rawMarker}:${seatId}:${prompt.length}:invocation-${++invocation}`,
    stderr: "", exitCode: 0, childProcessId: 1, cliExecutableRealpath: `/${seatId}`, cliVersion: "1",
  });
  const parseSeatOutputImpl = (seatId) => ({
    text: invocation === 1 ? JSON.stringify({ summary: "Candidate", payload: { safe: true } }) : JSON.stringify(votesBySeatId[seatId]),
    reportedModelId: null, modelUsage: {}, providerSessionId: null, observedToolUsage: [], usageMetadata: null,
  });
  const durableDir = join(root, "durable-evidence");
  const exercise = runShadowExerciseWithEvidence(session, {
    decisionQuestion: "Should the bounded candidate pass?", evidence: ["test evidence"],
    seatIds: seats.map(({ seatId }) => seatId), evidenceDir: durableDir,
    spawnSeatImpl, parseSeatOutputImpl,
  });
  assert.equal(exercise.assessments.length, 3);
  assert.equal(exercise.evidence.length, 3);
  for (const entry of exercise.evidence) {
    const persisted = JSON.parse(readFileSync(entry.sourcePath, "utf8"));
    assert.deepEqual(
      { voteValue: persisted.voteValue, rationale: persisted.rationale },
      votesBySeatId[persisted.seatId]
    );
  }

  const bundleDir = join(root, "bundle");
  const result = writeRunBundle({
    out: bundleDir, runId: "shadow-e2e", contextPack: compileProjectContextPack(REPO_ROOT),
    taskRecord: { taskId: "SHADOW-E2E", objective: "Persist bounded vote rationale.", branch: "feat/shadow-council-vote-rationale-v1b", baseCommit: "a".repeat(40), allowedScope: ["scripts/dev/**", "tests/dev/**"], disposition: "COMPLETE_PENDING_HUMAN_REVIEW", unresolvedRisks: [], humanActionRequested: "Review evidence." },
    evidence: exercise.evidence, finalize: true, finalizedAt: "2026-08-30T00:00:00Z",
    execFileSyncImpl: () => "https://github.com/MIHVER/mihver.git\n",
  });
  assert.equal(result.status, "OK", JSON.stringify(result));
  const manifestText = readFileSync(join(bundleDir, "evidence-manifest.json"), "utf8");
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.evidence.length, 3);
  assert.ok(manifest.evidence.every((entry) => entry.kind === "ARTIFACT"));
  for (const seatId of ["seat-openai", "seat-anthropic"]) {
    const expected = votesBySeatId[seatId];
    const assessment = exercise.assessments.find((entry) => entry.seatId === seatId);
    const artifact = manifest.evidence.find((entry) => entry.evidenceId === `shadow-vote-assessment:${assessment.assessmentHash}`);
    assert.ok(artifact, `missing bundled assessment artifact for ${seatId}`);
    const bundledAssessment = JSON.parse(readFileSync(resolve(bundleDir, artifact.sourcePath ?? artifact.path), "utf8"));
    assert.equal(bundledAssessment.voteValue, expected.voteValue);
    assert.equal(bundledAssessment.rationale, expected.rationale);
  }
  const persistedFiles = [...readdirSync(bundleDir).map((name) => join(bundleDir, name)), ...readdirSync(durableDir).map((name) => join(durableDir, name))];
  for (const path of persistedFiles) assert.doesNotMatch(readFileSync(path, "utf8"), new RegExp(rawMarker));

  console.log("Shadow Council Run Bundle evidence tests: 2 passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
