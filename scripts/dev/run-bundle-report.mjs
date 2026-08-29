#!/usr/bin/env node
// MIHVER Run Bundle v1 human review report renderer.
//
// Reads only FINALIZED bundles and fails closed before rendering if any document is schema-invalid,
// any manifest/document self-hash or reference hash is stale, or any external evidence source has
// changed. Schema validation and hashing are separate trust boundaries: hashes establish identity,
// while schemas establish that fields are safe to interpret. Markdown is emitted only after both.
// The output never authorizes publication or merge and this renderer never executes Git.
//
// CLI exit codes: 0 = rendered; 1 = blocked/untrusted bundle; 2 = usage error.

import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { canonicalizeJson } from "./canonical-json.mjs";
import {
  computeContentHash,
  computeEvidenceManifestHash,
  computeRunManifestHash,
  computeTaskRecordHash,
  describeValidationFailure,
  getRunBundleValidators,
  valueWithoutHash,
} from "./run-bundle.mjs";

function blocked(reason, extra = {}) {
  return { status: "BLOCKED", reason, ...extra };
}

function isInside(root, candidate) {
  const rel = relative(root, candidate);
  if (rel === "") return true;
  if (rel === "..") return false;
  if (rel.startsWith(`..${sep}`)) return false;
  return !isAbsolute(rel);
}

function validateDocument(validate, value, document) {
  const details = describeValidationFailure(validate, value);
  if (details === null) return null;
  return blocked("REPORT_SCHEMA_INVALID", { document, details });
}

// Manifest references are fixed bundle-local paths in v1. Check their boundary before any read so
// a hash value cannot be used to legitimize reading a file outside the run directory.
function resolveSafeReference(root, reference) {
  if (isAbsolute(reference.path)) return null;
  if (reference.path.split(/[\\/]+/).includes("..")) return null;
  const candidate = resolve(root, reference.path);
  return isInside(root, candidate) ? candidate : null;
}

function verifyExternalEvidence(evidence) {
  for (const entry of evidence) {
    if (entry.sourcePath === undefined) continue;
    let bytes;
    try {
      bytes = readFileSync(entry.sourcePath);
    } catch {
      return blocked("REPORT_EVIDENCE_SOURCE_UNREADABLE", { evidenceId: entry.evidenceId });
    }
    if (computeContentHash(bytes) !== entry.contentHash) {
      return blocked("REPORT_EVIDENCE_CONTENT_HASH_MISMATCH", {
        evidenceId: entry.evidenceId,
      });
    }
  }
  return null;
}

function renderBullets(items, emptyMessage) {
  if (items.length === 0) return `- ${emptyMessage}`;
  return items.map((item) => `- ${item}`).join("\n");
}

function renderMarkdown(manifest, task, evidenceManifest) {
  const verificationResults = evidenceManifest.evidence
    .filter((entry) => entry.kind === "VERIFICATION")
    .map((entry) => {
      return `${entry.command}: ${entry.passed} passed, ${entry.failed} failed — ${entry.summary}`;
    });
  const reviewFindings = evidenceManifest.evidence
    .filter((entry) => entry.kind === "REVIEW")
    .map((entry) => {
      return `${entry.verdict}: ${entry.findingsCount} findings, ${entry.blockerCount} blockers — ${entry.summary}`;
    });

  return [
    "# MIHVER Run Bundle Report",
    "",
    "## Observed Facts",
    "",
    `- Run: ${manifest.runId} (finalized ${manifest.finalizedAt})`,
    `- Task: ${task.taskId} — ${task.objective}`,
    `- Repository: ${manifest.repository.owner}/${manifest.repository.name} via ${manifest.repository.remoteName}`,
    `- Basis: branch ${manifest.contextPackBinding.branch ?? "(detached)"}, HEAD ${manifest.contextPackBinding.head}`,
    `- ProjectContextPack: ${manifest.contextPackBinding.contextHash}`,
    "",
    "## Verification Results",
    "",
    renderBullets(verificationResults, "No verification evidence recorded."),
    "",
    "## Review Findings",
    "",
    renderBullets(reviewFindings, "No review evidence recorded."),
    "",
    "## Unresolved Risks",
    "",
    renderBullets(task.unresolvedRisks, "None recorded."),
    "",
    "## Final Technical Disposition",
    "",
    task.disposition,
    "",
    "## Requested Human Action",
    "",
    task.humanActionRequested,
    "",
    "This report is derived from typed evidence only and does not itself authorize publication or merge.",
    "",
  ].join("\n");
}

export function renderRunBundleReport(runDirectory) {
  try {
    const root = resolve(runDirectory);
    const validators = getRunBundleValidators();

    let manifest;
    try {
      manifest = JSON.parse(readFileSync(join(root, "run-manifest.json"), "utf8"));
    } catch (error) {
      return blocked("REPORT_SOURCE_INVALID", { message: String(error.message) });
    }

    // Validate before interpreting status, references, or any other manifest field.
    const manifestSchemaFailure = validateDocument(validators.run, manifest, "run-manifest.json");
    if (manifestSchemaFailure !== null) return manifestSchemaFailure;
    if (manifest.status !== "FINALIZED") return blocked("REPORT_SOURCE_NOT_FINALIZED");

    const expectedManifestHash = computeRunManifestHash(
      valueWithoutHash(manifest, "manifestHash")
    );
    if (manifest.manifestHash !== expectedManifestHash) {
      return blocked("REPORT_MANIFEST_HASH_MISMATCH");
    }

    const taskPath = resolveSafeReference(root, manifest.taskRecordRef);
    if (taskPath === null) return blocked("REPORT_UNSAFE_REFERENCE");
    const evidencePath = resolveSafeReference(root, manifest.evidenceManifestRef);
    if (evidencePath === null) return blocked("REPORT_UNSAFE_REFERENCE");

    let taskBytes;
    let evidenceBytes;
    try {
      taskBytes = readFileSync(taskPath);
      evidenceBytes = readFileSync(evidencePath);
    } catch (error) {
      return blocked("REPORT_SOURCE_INVALID", { message: String(error.message) });
    }

    if (computeContentHash(taskBytes) !== manifest.taskRecordRef.contentHash) {
      return blocked("REPORT_TASK_REF_HASH_MISMATCH");
    }
    if (computeContentHash(evidenceBytes) !== manifest.evidenceManifestRef.contentHash) {
      return blocked("REPORT_EVIDENCE_REF_HASH_MISMATCH");
    }

    let task;
    let evidenceManifest;
    try {
      task = JSON.parse(taskBytes);
      evidenceManifest = JSON.parse(evidenceBytes);
    } catch (error) {
      return blocked("REPORT_SOURCE_INVALID", { message: String(error.message) });
    }

    // These checks precede every field read from either referenced document.
    const taskSchemaFailure = validateDocument(validators.task, task, "task-record.json");
    if (taskSchemaFailure !== null) return taskSchemaFailure;
    const evidenceSchemaFailure = validateDocument(
      validators.evidence,
      evidenceManifest,
      "evidence-manifest.json"
    );
    if (evidenceSchemaFailure !== null) return evidenceSchemaFailure;

    const expectedTaskHash = computeTaskRecordHash(valueWithoutHash(task, "taskRecordHash"));
    if (task.taskRecordHash !== expectedTaskHash) return blocked("REPORT_TASK_HASH_MISMATCH");

    const expectedEvidenceHash = computeEvidenceManifestHash(
      valueWithoutHash(evidenceManifest, "evidenceManifestHash")
    );
    if (evidenceManifest.evidenceManifestHash !== expectedEvidenceHash) {
      return blocked("REPORT_EVIDENCE_HASH_MISMATCH");
    }

    const externalEvidenceFailure = verifyExternalEvidence(evidenceManifest.evidence);
    if (externalEvidenceFailure !== null) return externalEvidenceFailure;

    const markdown = renderMarkdown(manifest, task, evidenceManifest);
    return { status: "OK", markdown, manifestHash: manifest.manifestHash };
  } catch (error) {
    return blocked("REPORT_SOURCE_INVALID", { message: String(error?.message ?? error) });
  }
}

const HELP = `Usage: node scripts/dev/run-bundle-report.mjs --run <dir> [--out <path>]\n\nOptions:\n  --run <dir>   Finalized Run Bundle directory\n  --out <path>  Write Markdown (stdout when omitted)\n  --help        Show help\n\nExit codes: 0 success; 1 blocked/untrusted bundle; 2 usage error.\n`;

function cli(argv) {
  if (argv.includes("--help")) {
    process.stdout.write(HELP);
    return 0;
  }

  const values = {};
  for (let index = 0; index < argv.length; index++) {
    const key = { "--run": "run", "--out": "out" }[argv[index]];
    if (key === undefined || argv[index + 1] === undefined) {
      process.stderr.write(HELP);
      return 2;
    }
    values[key] = argv[++index];
  }
  if (values.run === undefined) {
    process.stderr.write(HELP);
    return 2;
  }

  const result = renderRunBundleReport(values.run);
  if (result.status !== "OK") {
    process.stdout.write(`${canonicalizeJson(result)}\n`);
    return 1;
  }
  if (values.out !== undefined) {
    writeFileSync(values.out, result.markdown, "utf8");
  } else {
    process.stdout.write(result.markdown);
  }
  return 0;
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = cli(process.argv.slice(2));
}
