// Filesystem adapter for persisting advisory ShadowVoteAssessment evidence beside a Run Bundle.
// The returned contentHash is a raw-byte Run Bundle hash, not the assessment's domain hash.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { canonicalizeJson } from "./canonical-json.mjs";
import { computeContentHash } from "./run-bundle.mjs";
import { runShadowExercise } from "./shadow-council-harness.mjs";

export function writeShadowVoteAssessmentEvidence(assessment, evidenceDir) {
  const bytes = Buffer.from(canonicalizeJson(assessment), "utf8");
  const contentHash = computeContentHash(bytes);
  const seatId = encodeURIComponent(assessment.seatId);
  const filename = `shadow-vote-assessment-${seatId}-${contentHash.slice("sha256:".length)}.json`;
  const path = join(evidenceDir, filename);

  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(path, bytes);
  return {
    evidenceId: `shadow-vote-assessment:${assessment.assessmentHash}`,
    kind: "ARTIFACT",
    producedBy: { role: "REVIEWER", tool: "shadow-council-harness", threadId: null },
    summary: assessment.rationale,
    path,
    action: "present",
    sourcePath: path,
    contentHash,
  };
}

export function runShadowExerciseWithEvidence(session, opts) {
  if (typeof opts?.evidenceDir !== "string" || opts.evidenceDir.length === 0) throw new Error("EVIDENCE_DIR_REQUIRED");
  const result = runShadowExercise(session, opts);
  const evidence = result.assessments.map((assessment) => writeShadowVoteAssessmentEvidence(assessment, opts.evidenceDir));
  return { ...result, evidence };
}
