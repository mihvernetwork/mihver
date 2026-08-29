// Tests for MIHVER Run Bundle v1. Uses disposable directories and the repository's hand-rolled
// synchronous harness; no test writes outside its caller-supplied bundle directory.
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, realpathSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalizeJson } from "../../scripts/dev/canonical-json.mjs";
import { compileProjectContextPack, computeContextHash } from "../../scripts/dev/project-context-pack.mjs";
import { computeContentHash, computeEvidenceManifestHash, computeRunManifestHash, computeTaskRecordHash, writeRunBundle } from "../../scripts/dev/run-bundle.mjs";
import { renderRunBundleReport } from "../../scripts/dev/run-bundle-report.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const roots = []; let passed = 0;
function test(name, fn) { try { fn(); passed++; } catch (error) { console.error(`FAIL: ${name}`); throw error; } }
function root() { const value = mkdtempSync(join(realpathSync(tmpdir()), "mihver-run-bundle-")); roots.push(value); return value; }
const contextPack = compileProjectContextPack(REPO_ROOT);
assert.equal(contextPack.kind, "ProjectContextPack");
function task(overrides = {}) { return { taskId: "RB-TASK", objective: "Exercise the bundle.", branch: "feat/rb", baseCommit: "a".repeat(40), allowedScope: ["scripts/dev/**"], disposition: "COMPLETE_PENDING_HUMAN_REVIEW", unresolvedRisks: [], humanActionRequested: "Review the typed evidence.", ...overrides }; }
function evidence(id = "verify", overrides = {}) { return { evidenceId: id, kind: "VERIFICATION", producedBy: { role: "VERIFIER", tool: "node", threadId: null }, summary: "1/1 passed", command: "npm test", passed: 1, failed: 0, ...overrides }; }
const git = () => "https://github.com/MIHVER/mihver.git\n";
function write(out, overrides = {}) { return writeRunBundle({ out, runId: "run-1", contextPack, taskRecord: task(), evidence: [evidence()], execFileSyncImpl: git, ...overrides }); }
function bytes(out) { return ["run-manifest.json", "task-record.json", "evidence-manifest.json"].map((p) => readFileSync(join(out, p), "utf8")); }
function canonical(value) { return `${canonicalizeJson(value)}\n`; }
function without(value, key) { const copy = { ...value }; delete copy[key]; return copy; }
function rehash(value, key, compute) { return { ...without(value, key), [key]: compute(without(value, key)) }; }

test("RB1 identical inputs produce byte-identical artifacts and hashes", () => { const a = root(), b = root(); const ra = write(a), rb = write(b); assert.equal(ra.status, "OK"); assert.deepEqual(bytes(a), bytes(b)); assert.equal(ra.manifestHash, rb.manifestHash); });
test("RB2 changed evidence changes evidence and manifest hashes", () => { const a = root(), b = root(); const ra = write(a), rb = write(b, { evidence: [evidence("verify", { summary: "2/2 passed", passed: 2 })] }); assert.notEqual(ra.evidenceManifestHash, rb.evidenceManifestHash); assert.notEqual(ra.manifestHash, rb.manifestHash); });
test("RB3 tampered ContextPack hash writes nothing", () => { const out = root(); const result = write(out, { contextPack: { ...contextPack, contextHash: `sha256:${"0".repeat(64)}` } }); assert.equal(result.reason, "CONTEXT_PACK_HASH_MISMATCH"); assert.deepEqual(requireNames(out), []); });
test("RB4 invalid ContextPack HEAD is refused", () => { const out = root(); const pack = structuredClone(contextPack); pack.repository.head = "bad"; const result = write(out, { contextPack: pack }); assert.equal(result.reason, "CONTEXT_PACK_INVALID"); assert.deepEqual(requireNames(out), []); });
test("RB5 malformed TaskRecord is refused without files", () => { const out = root(); const result = write(out, { taskRecord: task({ baseCommit: "bad" }) }); assert.equal(result.reason, "TASK_RECORD_INVALID"); assert.deepEqual(requireNames(out), []); });
test("RB6 missing external evidence is refused", () => { const out = root(); const entry = evidence("external", { sourcePath: join(out, "missing.log"), contentHash: `sha256:${"0".repeat(64)}` }); assert.equal(write(out, { evidence: [entry] }).reason, "EVIDENCE_SOURCE_UNREADABLE"); });
test("RB7 duplicate evidence IDs and artifact paths are refused", () => { const a = root(); assert.equal(write(a, { evidence: [evidence("x"), evidence("x")] }).reason, "DUPLICATE_EVIDENCE_ID"); const b = root(), s1 = join(root(), "a"), s2 = join(root(), "b"); writeFileSync(s1, "a"); writeFileSync(s2, "b"); const art = (id, sourcePath) => ({ evidenceId: id, kind: "ARTIFACT", producedBy: { role: "IMPLEMENTER", tool: "editor", threadId: null }, summary: "artifact", path: "same", action: "present", sourcePath, contentHash: computeContentHash(readFileSync(sourcePath)) }); assert.equal(write(b, { evidence: [art("a", s1), art("b", s2)] }).reason, "DUPLICATE_ARTIFACT_PATH"); });
test("RB8 finalized bundle rejects all later writes without byte changes", () => { const out = root(); assert.equal(write(out, { finalize: true, finalizedAt: "2026-08-29T00:00:00Z" }).status, "OK"); const before = bytes(out); assert.equal(write(out, { evidence: [evidence("new")] }).reason, "RUN_ALREADY_FINALIZED"); assert.deepEqual(bytes(out), before); });
test("RB9 traversal and target symlink are refused", () => { const base = root(); assert.equal(writeRunBundle({ out: `${base}/../escape`, runId: "x" }).reason, "UNSAFE_OUTPUT_PATH"); const out = root(), outside = join(root(), "outside"); writeFileSync(outside, "safe"); symlinkSync(outside, join(out, "run-manifest.json")); const result = write(out); assert.equal(result.reason, "UNSAFE_OUTPUT_SYMLINK"); assert.equal(readFileSync(outside, "utf8"), "safe"); });
test("RB10 report refuses an incomplete bundle cleanly", () => { const out = root(); writeFileSync(join(out, "run-manifest.json"), JSON.stringify({ status: "FINALIZED" })); assert.equal(renderRunBundleReport(out).status, "BLOCKED"); });
test("RB11 secret-like strings are refused", () => { const out = root(); assert.equal(write(out, { taskRecord: task({ objective: `credential AKIA${"A".repeat(16)}` }) }).reason, "SECRET_PATTERN_DETECTED"); });
test("RB12 report fails closed after external evidence tampering", () => { const out = root(), source = join(root(), "evidence.log"); writeFileSync(source, "original"); const entry = evidence("external", { sourcePath: source, contentHash: computeContentHash(readFileSync(source)) }); assert.equal(write(out, { evidence: [entry], finalize: true, finalizedAt: "2026-08-29T00:00:00Z" }).status, "OK"); writeFileSync(source, "tampered"); assert.equal(renderRunBundleReport(out).reason, "REPORT_EVIDENCE_CONTENT_HASH_MISMATCH"); });
test("RB13 source contains no Git-mutating command and output stays bounded", () => { const source = readFileSync(join(REPO_ROOT, "scripts/dev/run-bundle.mjs"), "utf8"); assert.doesNotMatch(source, /['\"](?:add|commit|push|checkout|switch|branch|reset|clean|stash|merge)['\"]/); const parent = root(), out = join(parent, "bundle"); assert.equal(write(out).status, "OK"); assert.deepEqual(requireNames(parent), ["bundle"]); });

test("RB14 append rejects changed run identity fields", () => {
  const runIdOut = root();
  assert.equal(write(runIdOut).status, "OK");
  assert.deepEqual(write(runIdOut, { runId: "run-2", evidence: [evidence("new")] }), {
    status: "BLOCKED", reason: "RUN_IDENTITY_IMMUTABLE", component: "runId",
  });

  const contextOut = root();
  assert.equal(write(contextOut).status, "OK");
  const changedPackBody = structuredClone(without(contextPack, "contextHash"));
  changedPackBody.project.milestone = "Different but schema-valid binding.";
  const changedPack = { ...changedPackBody, contextHash: computeContextHash(changedPackBody) };
  const contextResult = write(contextOut, { contextPack: changedPack, evidence: [evidence("new")] });
  assert.equal(contextResult.reason, "RUN_IDENTITY_IMMUTABLE");
  assert.equal(contextResult.component, "contextPackBinding");

  const repositoryOut = root();
  assert.equal(write(repositoryOut).status, "OK");
  const otherGit = () => "https://github.com/MIHVER/other.git\n";
  const repositoryResult = write(repositoryOut, { execFileSyncImpl: otherGit, evidence: [evidence("new")] });
  assert.equal(repositoryResult.reason, "RUN_IDENTITY_IMMUTABLE");
  assert.equal(repositoryResult.component, "repository");
});

test("RB15 append rejects self-consistent replacements that violate manifest references", () => {
  const taskOut = root();
  assert.equal(write(taskOut).status, "OK");
  const taskPath = join(taskOut, "task-record.json");
  const replacementTask = JSON.parse(readFileSync(taskPath, "utf8"));
  replacementTask.objective = "Fabricated replacement.";
  writeFileSync(taskPath, canonical(rehash(replacementTask, "taskRecordHash", computeTaskRecordHash)));
  assert.equal(write(taskOut, { evidence: [evidence("new")] }).reason, "EXISTING_TASK_RECORD_REF_MISMATCH");

  const evidenceOut = root();
  assert.equal(write(evidenceOut).status, "OK");
  const evidencePath = join(evidenceOut, "evidence-manifest.json");
  const replacementEvidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  replacementEvidence.evidence[0].summary = "Fabricated but self-consistent.";
  writeFileSync(evidencePath, canonical(rehash(replacementEvidence, "evidenceManifestHash", computeEvidenceManifestHash)));
  assert.equal(write(evidenceOut, { evidence: [evidence("new")] }).reason, "EXISTING_EVIDENCE_MANIFEST_REF_MISMATCH");
});

test("RB16 report rejects a hash-consistent but schema-invalid document", () => {
  const out = root();
  assert.equal(write(out, { finalize: true, finalizedAt: "2026-08-29T00:00:00Z" }).status, "OK");
  const taskPath = join(out, "task-record.json");
  const manifestPath = join(out, "run-manifest.json");
  if (process.platform !== "win32") {
    chmodSync(taskPath, 0o600);
    chmodSync(manifestPath, 0o600);
  }
  const invalidTask = JSON.parse(readFileSync(taskPath, "utf8"));
  delete invalidTask.objective;
  const invalidTaskWithHash = rehash(invalidTask, "taskRecordHash", computeTaskRecordHash);
  const taskBytes = canonical(invalidTaskWithHash);
  writeFileSync(taskPath, taskBytes);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.taskRecordRef.contentHash = computeContentHash(taskBytes);
  writeFileSync(manifestPath, canonical(rehash(manifest, "manifestHash", computeRunManifestHash)));
  assert.equal(renderRunBundleReport(out).reason, "REPORT_SCHEMA_INVALID");
});

test("RB17 every evidence kind rejects fields from a different kind", () => {
  const producedBy = { role: "IMPLEMENTER", tool: "test", threadId: null };
  const cases = [
    { evidenceId: "artifact", kind: "ARTIFACT", producedBy, summary: "x", path: "x", action: "deletion", command: "foreign" },
    { evidenceId: "execution", kind: "EXECUTION", producedBy, summary: "x", command: "x", exitCode: 0, verdict: "FOREIGN" },
    { evidenceId: "verification", kind: "VERIFICATION", producedBy, summary: "x", command: "x", passed: 1, failed: 0, exitCode: 0 },
    { evidenceId: "review", kind: "REVIEW", producedBy, summary: "x", verdict: "READY", findingsCount: 0, blockerCount: 0, passed: 1 },
  ];
  for (const entry of cases) {
    const result = write(root(), { evidence: [entry] });
    assert.equal(result.reason, "EVIDENCE_INVALID", entry.kind);
  }
});

function requireNames(path) { return readdirSync(path).sort(); }
for (const item of roots) rmSync(item, { recursive: true, force: true });
console.log(`Run Bundle tests: ${passed} passed`);
