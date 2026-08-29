#!/usr/bin/env node
// MIHVER Run Bundle v1 writer/compiler.
//
// Compiles three canonical JSON records beneath an explicitly supplied output directory. A
// ProjectContextPack is validated and independently re-hashed but never modified. OPEN bundles are
// append-only; FINALIZED bundles are immutable. External evidence is referenced, never copied.
//
// Trust-boundary invariants:
//   - Existing FINALIZED state is checked before any bundle write.
//   - Existing document bytes must match manifest reference hashes and document self-hashes.
//   - Run ID, ContextPack binding, repository identity, and TaskRecord are immutable on append.
//   - Every prospective document is schema-validated before writing.
//   - Output components are checked initially and the directory is rechecked immediately before
//     writing. Node exposes no portable openat-relative API; RUN_BUNDLE.md documents the residual
//     concurrent-directory-swap race.
//   - New files use exclusive no-follow opens. Append replacements use exclusive temporary files
//     and same-directory renames. A crash between sequential renames fails closed on the next read.
//
// Git is read only, solely through publication-builder.mjs's repository-identity helper, using
// options.execFileSyncImpl ?? execFileSync for testability. No execution/publication is authorized.
// CLI exit codes: 0 = written; 1 = blocked; 2 = usage error.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { canonicalizeJson } from "./canonical-json.mjs";
import { computeContextHash } from "./project-context-pack.mjs";
import { readRepositoryIdentity } from "./publication-builder.mjs";

export const TASK_RECORD_HASH_DOMAIN = "MIHVER:TaskRecord:v1\0";
export const EVIDENCE_MANIFEST_HASH_DOMAIN = "MIHVER:EvidenceManifest:v1\0";
export const RUN_MANIFEST_HASH_DOMAIN = "MIHVER:RunManifest:v1\0";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const DOCUMENT_NAMES = ["run-manifest.json", "task-record.json", "evidence-manifest.json"];
const SCHEMA_FILES = {
  context: "project-context-pack.schema.json",
  task: "task-record.schema.json",
  evidence: "evidence-manifest.schema.json",
  run: "run-manifest.schema.json",
};
const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN[^\n]{0,80}PRIVATE KEY-----/,
  /Authorization\s*:\s*Bearer\s+\S+/i,
  /(?:^|\n)[A-Z_][A-Z0-9_]*=[A-Za-z0-9+/_=-]{24,}(?:$|\n)/,
];
let cachedValidators = null;

function blocked(reason, extra = {}) {
  return { status: "BLOCKED", reason, ...extra };
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function computeDomainHash(domain, value) {
  const domainBytes = Buffer.from(domain, "utf8");
  const canonicalBytes = Buffer.from(canonicalizeJson(value), "utf8");
  return sha256(Buffer.concat([domainBytes, canonicalBytes]));
}

export function computeTaskRecordHash(value) {
  return computeDomainHash(TASK_RECORD_HASH_DOMAIN, value);
}

export function computeEvidenceManifestHash(value) {
  return computeDomainHash(EVIDENCE_MANIFEST_HASH_DOMAIN, value);
}

export function computeRunManifestHash(value) {
  return computeDomainHash(RUN_MANIFEST_HASH_DOMAIN, value);
}

export function computeContentHash(value) {
  return sha256(value);
}

export function valueWithoutHash(value, hashField) {
  const copy = { ...value };
  delete copy[hashField];
  return copy;
}

function attachSelfHash(value, hashField, computeHash) {
  const body = valueWithoutHash(value, hashField);
  return { ...body, [hashField]: computeHash(body) };
}

function canonicalDocumentBytes(value) {
  return `${canonicalizeJson(value)}\n`;
}

// Exported so the report renderer cannot drift to a validator configuration that accepts documents
// the writer rejects.
export function getRunBundleValidators() {
  if (cachedValidators !== null) return cachedValidators;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  cachedValidators = {};
  for (const [key, filename] of Object.entries(SCHEMA_FILES)) {
    const schema = require(join(REPO_ROOT, "schemas", "dev", filename));
    cachedValidators[key] = ajv.compile(schema);
  }
  return cachedValidators;
}

export function describeValidationFailure(validate, value) {
  if (validate(value)) return null;
  return validate.errors
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
}

function containsTraversal(path) {
  return String(path).split(/[\\/]+/).includes("..");
}

function isInside(root, candidate) {
  const rel = relative(root, candidate);
  if (rel === "") return true;
  if (rel === "..") return false;
  if (rel.startsWith(`..${sep}`)) return false;
  return !isAbsolute(rel);
}

// Comparing the nearest existing ancestor's real path with its lexical path rejects a symlink in
// any existing component before the requested directory is created.
function assertSafeOutputDirectory(out) {
  if (typeof out !== "string" || out.length === 0) {
    throw Object.assign(new Error("output directory is required"), { code: "UNSAFE_OUTPUT_PATH" });
  }
  if (containsTraversal(out)) {
    throw Object.assign(new Error("output contains traversal"), { code: "UNSAFE_OUTPUT_PATH" });
  }

  const absolute = resolve(out);
  let existingAncestor = absolute;
  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor);
    if (parent === existingAncestor) break;
    existingAncestor = parent;
  }
  if (lstatSync(existingAncestor).isSymbolicLink()) {
    throw Object.assign(new Error("symlink output component"), { code: "UNSAFE_OUTPUT_SYMLINK" });
  }
  if (realpathSync(existingAncestor) !== resolve(existingAncestor)) {
    throw Object.assign(new Error("symlink output component"), { code: "UNSAFE_OUTPUT_SYMLINK" });
  }

  mkdirSync(absolute, { recursive: true });
  let cursor = absolute;
  while (true) {
    if (lstatSync(cursor).isSymbolicLink()) {
      throw Object.assign(new Error("symlink output component"), { code: "UNSAFE_OUTPUT_SYMLINK" });
    }
    if (cursor === existingAncestor) break;
    cursor = dirname(cursor);
  }
  return absolute;
}

function resolveBundlePaths(out) {
  const paths = {};
  for (const name of DOCUMENT_NAMES) {
    const candidate = resolve(out, name);
    if (!isInside(out, candidate)) {
      throw Object.assign(new Error("target escapes output"), { code: "UNSAFE_OUTPUT_PATH" });
    }
    paths[name] = candidate;
  }
  return paths;
}

function rejectSymlinkTargets(paths) {
  for (const path of Object.values(paths)) {
    if (!existsSync(path)) continue;
    if (lstatSync(path).isSymbolicLink()) return blocked("UNSAFE_OUTPUT_SYMLINK");
  }
  return null;
}

// This point-in-time recheck narrows the validation-to-write race. It cannot substitute for the
// openat-relative directory descriptor Node's public fs API does not portably expose.
function outputDirectoryStillSafe(out) {
  try {
    const stat = lstatSync(out);
    if (!stat.isDirectory()) return false;
    if (stat.isSymbolicLink()) return false;
    return realpathSync(out) === out;
  } catch {
    return false;
  }
}

function exclusiveWrite(path, text, replaceExisting) {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
    throw Object.assign(new Error("symlink target"), { code: "UNSAFE_OUTPUT_SYMLINK" });
  }

  const writePath = replaceExisting ? `${path}.tmp-${process.pid}` : path;
  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  let fd;
  try {
    fd = openSync(
      writePath,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | noFollow,
      0o600
    );
    writeFileSync(fd, text, "utf8");
    closeSync(fd);
    fd = undefined;
    if (replaceExisting) renameSync(writePath, path);
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    if (replaceExisting) rmSync(writePath, { force: true });
    throw error;
  }
}

function containsSecretLikeString(value) {
  if (typeof value === "string") {
    return SECRET_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) return value.some(containsSecretLikeString);
  if (value === null || typeof value !== "object") return false;
  return Object.values(value).some(containsSecretLikeString);
}

function verifyEvidenceSource(entry, existingEntry = false) {
  if (entry.sourcePath === undefined) return null;
  let bytes;
  try {
    bytes = readFileSync(entry.sourcePath);
  } catch {
    const reason = existingEntry ? "EXISTING_EVIDENCE_TAMPERED" : "EVIDENCE_SOURCE_UNREADABLE";
    return blocked(reason, { evidenceId: entry.evidenceId });
  }

  const actual = computeContentHash(bytes);
  if (actual === entry.contentHash) return null;
  const reason = existingEntry ? "EXISTING_EVIDENCE_TAMPERED" : "EVIDENCE_CONTENT_HASH_MISMATCH";
  return blocked(reason, { evidenceId: entry.evidenceId, expected: entry.contentHash, actual });
}

function verifySelfHash(value, hashField, computeHash, mismatchReason) {
  const expected = computeHash(valueWithoutHash(value, hashField));
  if (value?.[hashField] === expected) return null;
  return blocked(mismatchReason);
}

function sameJsonValue(left, right) {
  return canonicalizeJson(left) === canonicalizeJson(right);
}

function makeContextPackBinding(contextPack) {
  return {
    contextHash: contextPack.contextHash,
    head: contextPack.repository.head,
    branch: contextPack.repository.branch,
    detached: contextPack.repository.detached,
  };
}

function makeRepositoryIdentity(identity) {
  return {
    remoteName: identity.remote_name,
    owner: identity.owner,
    name: identity.name,
  };
}

function verifyExistingBundle(existing, paths, prospectiveTask) {
  let taskBytes;
  let evidenceBytes;
  try {
    taskBytes = readFileSync(paths["task-record.json"]);
    evidenceBytes = readFileSync(paths["evidence-manifest.json"]);
  } catch {
    return blocked("EXISTING_BUNDLE_INCOMPLETE");
  }

  // Self-hashes do not bind the original bytes: an attacker can construct a different internally
  // self-consistent document. These reference checks preserve the manifest's exact byte identity.
  if (computeContentHash(taskBytes) !== existing.taskRecordRef?.contentHash) {
    return blocked("EXISTING_TASK_RECORD_REF_MISMATCH");
  }
  if (computeContentHash(evidenceBytes) !== existing.evidenceManifestRef?.contentHash) {
    return blocked("EXISTING_EVIDENCE_MANIFEST_REF_MISMATCH");
  }

  let oldTask;
  let oldEvidenceManifest;
  try {
    oldTask = JSON.parse(taskBytes);
    oldEvidenceManifest = JSON.parse(evidenceBytes);
  } catch {
    return blocked("EXISTING_BUNDLE_INVALID");
  }

  const runHashFailure = verifySelfHash(
    existing,
    "manifestHash",
    computeRunManifestHash,
    "RUN_MANIFEST_TAMPERED"
  );
  if (runHashFailure !== null) return runHashFailure;

  const taskHashFailure = verifySelfHash(
    oldTask,
    "taskRecordHash",
    computeTaskRecordHash,
    "TASK_RECORD_TAMPERED"
  );
  if (taskHashFailure !== null) return taskHashFailure;

  const evidenceHashFailure = verifySelfHash(
    oldEvidenceManifest,
    "evidenceManifestHash",
    computeEvidenceManifestHash,
    "EVIDENCE_MANIFEST_TAMPERED"
  );
  if (evidenceHashFailure !== null) return evidenceHashFailure;

  if (oldTask.taskRecordHash !== prospectiveTask.taskRecordHash) {
    return blocked("TASK_RECORD_IMMUTABLE");
  }
  for (const entry of oldEvidenceManifest.evidence) {
    const sourceFailure = verifyEvidenceSource(entry, true);
    if (sourceFailure !== null) return sourceFailure;
  }
  return { status: "OK", evidence: oldEvidenceManifest.evidence };
}

function verifyImmutableRunIdentity(existing, runId, contextPackBinding, repository) {
  if (runId !== existing.runId) {
    return blocked("RUN_IDENTITY_IMMUTABLE", { component: "runId" });
  }
  if (!sameJsonValue(contextPackBinding, existing.contextPackBinding)) {
    return blocked("RUN_IDENTITY_IMMUTABLE", { component: "contextPackBinding" });
  }
  if (!sameJsonValue(repository, existing.repository)) {
    return blocked("RUN_IDENTITY_IMMUTABLE", { component: "repository" });
  }
  return null;
}

function compileArtifacts(evidence) {
  const artifactEntries = evidence.filter((entry) => {
    return entry.kind === "ARTIFACT" && entry.action === "present";
  });
  for (const entry of artifactEntries) {
    if (!entry.contentHash) return blocked("ARTIFACT_CONTENT_HASH_REQUIRED");
  }
  const paths = artifactEntries.map((entry) => entry.path);
  if (new Set(paths).size !== paths.length) return blocked("DUPLICATE_ARTIFACT_PATH");

  const artifacts = artifactEntries.map((entry) => ({
    path: entry.path,
    contentHash: entry.contentHash,
  }));
  artifacts.sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));
  return { status: "OK", artifacts };
}

export function writeRunBundle(options = {}) {
  try {
    const out = assertSafeOutputDirectory(options.out);
    const paths = resolveBundlePaths(out);
    const symlinkFailure = rejectSymlinkTargets(paths);
    if (symlinkFailure !== null) return symlinkFailure;

    let existing = null;
    if (existsSync(paths["run-manifest.json"])) {
      try {
        existing = JSON.parse(readFileSync(paths["run-manifest.json"], "utf8"));
      } catch {
        return blocked("EXISTING_BUNDLE_INVALID");
      }
      // This primary finalization gate precedes every other bundle read and every write.
      if (existing.status === "FINALIZED") return blocked("RUN_ALREADY_FINALIZED");
    }

    const validators = getRunBundleValidators();
    if (existing !== null) {
      const existingSchemaError = describeValidationFailure(validators.run, existing);
      if (existingSchemaError !== null) {
        return blocked("EXISTING_BUNDLE_INVALID", { details: existingSchemaError });
      }
    }
    const contextError = describeValidationFailure(validators.context, options.contextPack);
    if (contextError !== null) return blocked("CONTEXT_PACK_INVALID", { details: contextError });

    const claimedContextHash = options.contextPack.contextHash;
    const actualContextHash = computeContextHash(
      valueWithoutHash(options.contextPack, "contextHash")
    );
    if (actualContextHash !== claimedContextHash) return blocked("CONTEXT_PACK_HASH_MISMATCH");
    if (options.contextPack.repository.head === null) return blocked("CONTEXT_PACK_HEAD_INVALID");

    if (containsSecretLikeString(options.taskRecord)) return blocked("SECRET_PATTERN_DETECTED");
    if (containsSecretLikeString(options.evidence ?? [])) return blocked("SECRET_PATTERN_DETECTED");

    const task = attachSelfHash(options.taskRecord, "taskRecordHash", computeTaskRecordHash);
    const taskError = describeValidationFailure(validators.task, task);
    if (taskError !== null) return blocked("TASK_RECORD_INVALID", { details: taskError });

    let oldEvidence = [];
    if (existing !== null) {
      const existingResult = verifyExistingBundle(existing, paths, task);
      if (existingResult.status !== "OK") return existingResult;
      oldEvidence = existingResult.evidence;
    }

    const evidence = [...oldEvidence, ...(options.evidence ?? [])];
    const evidenceIds = evidence.map((entry) => entry.evidenceId);
    if (new Set(evidenceIds).size !== evidenceIds.length) return blocked("DUPLICATE_EVIDENCE_ID");
    evidence.sort((left, right) => Buffer.from(left.evidenceId).compare(Buffer.from(right.evidenceId)));

    const evidenceManifest = attachSelfHash(
      { evidence },
      "evidenceManifestHash",
      computeEvidenceManifestHash
    );
    const evidenceError = describeValidationFailure(validators.evidence, evidenceManifest);
    if (evidenceError !== null) return blocked("EVIDENCE_INVALID", { details: evidenceError });

    for (const entry of evidence) {
      const sourceFailure = verifyEvidenceSource(entry);
      if (sourceFailure !== null) return sourceFailure;
    }

    const artifactResult = compileArtifacts(evidence);
    if (artifactResult.status !== "OK") return artifactResult;

    const identity = readRepositoryIdentity(
      options.repoRoot ?? REPO_ROOT,
      options.remoteName ?? "origin",
      { execFileSyncImpl: options.execFileSyncImpl ?? execFileSync }
    );
    if (identity === null) return blocked("REPOSITORY_IDENTITY_UNAVAILABLE");

    if (typeof options.runId !== "string") return blocked("RUN_ID_REQUIRED");
    if (options.runId.length === 0) return blocked("RUN_ID_REQUIRED");
    if (options.finalize && !options.finalizedAt) return blocked("FINALIZED_AT_REQUIRED");
    if (!options.finalize && options.finalizedAt !== undefined) {
      return blocked("FINALIZED_AT_WITHOUT_FINALIZE");
    }

    const contextPackBinding = makeContextPackBinding(options.contextPack);
    const repository = makeRepositoryIdentity(identity);
    if (existing !== null) {
      const identityFailure = verifyImmutableRunIdentity(
        existing,
        options.runId,
        contextPackBinding,
        repository
      );
      if (identityFailure !== null) return identityFailure;
    }

    const taskBytes = canonicalDocumentBytes(task);
    const evidenceBytes = canonicalDocumentBytes(evidenceManifest);
    const manifestBody = {
      runId: options.runId,
      status: options.finalize ? "FINALIZED" : "OPEN",
      repository,
      contextPackBinding,
      taskRecordRef: { path: "task-record.json", contentHash: computeContentHash(taskBytes) },
      evidenceManifestRef: {
        path: "evidence-manifest.json",
        contentHash: computeContentHash(evidenceBytes),
      },
      artifacts: artifactResult.artifacts,
      finalizedAt: options.finalize ? options.finalizedAt : null,
    };
    const manifest = attachSelfHash(manifestBody, "manifestHash", computeRunManifestHash);
    const manifestError = describeValidationFailure(validators.run, manifest);
    if (manifestError !== null) {
      return blocked("RUN_MANIFEST_INVALID", { details: manifestError });
    }

    // Recheck after all potentially lengthy validation and external evidence reads.
    if (!outputDirectoryStillSafe(out)) return blocked("OUTPUT_DIRECTORY_CHANGED");

    const replaceExisting = existing !== null;
    exclusiveWrite(paths["task-record.json"], taskBytes, replaceExisting);
    exclusiveWrite(paths["evidence-manifest.json"], evidenceBytes, replaceExisting);
    exclusiveWrite(paths["run-manifest.json"], canonicalDocumentBytes(manifest), replaceExisting);

    if (options.finalize && process.platform !== "win32") {
      for (const path of Object.values(paths)) chmodSync(path, 0o444);
    }
    return {
      status: "OK",
      runId: options.runId,
      manifestHash: manifest.manifestHash,
      taskRecordHash: task.taskRecordHash,
      evidenceManifestHash: evidenceManifest.evidenceManifestHash,
    };
  } catch (error) {
    return blocked(error?.code ?? "RUN_BUNDLE_WRITE_FAILED", {
      message: String(error?.message ?? error),
    });
  }
}

const HELP = `Usage: node scripts/dev/run-bundle.mjs --out <dir> --run-id <id> --context-pack <json> --task-record <json> [--evidence <json>]... [--finalize --finalized-at <ISO-8601>]\n\nOptions:\n  --out <dir>          Bundle directory\n  --run-id <id>        Caller-supplied run identity\n  --context-pack <p>   ProjectContextPack JSON\n  --task-record <p>    TaskRecord input JSON (hash is compiled)\n  --evidence <p>       One new evidence entry JSON; repeatable\n  --finalize            Explicitly finalize the bundle\n  --finalized-at <time> Caller-supplied ISO-8601 finalization time\n  --help                Show help\n\nExit codes: 0 success; 1 blocked; 2 usage error.\n`;

function readCliJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function cli(argv) {
  if (argv.includes("--help")) {
    process.stdout.write(HELP);
    return 0;
  }

  const values = { evidence: [] };
  const optionNames = {
    "--out": "out",
    "--run-id": "runId",
    "--context-pack": "contextPack",
    "--task-record": "taskRecord",
    "--evidence": "evidence",
    "--finalized-at": "finalizedAt",
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--finalize") {
      values.finalize = true;
      continue;
    }
    const key = optionNames[arg];
    if (key === undefined || argv[index + 1] === undefined) {
      process.stderr.write(HELP);
      return 2;
    }
    const rawValue = argv[++index];
    if (key !== "evidence") {
      values[key] = rawValue;
      continue;
    }
    try {
      values.evidence.push(readCliJson(rawValue));
    } catch (error) {
      process.stdout.write(`${JSON.stringify(blocked("INPUT_JSON_INVALID", { message: error.message }))}\n`);
      return 1;
    }
  }

  try {
    values.contextPack = readCliJson(values.contextPack);
    values.taskRecord = readCliJson(values.taskRecord);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(blocked("INPUT_JSON_INVALID", { message: error.message }))}\n`);
    return 1;
  }

  const result = writeRunBundle(values);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.status === "OK" ? 0 : 1;
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = cli(process.argv.slice(2));
}
