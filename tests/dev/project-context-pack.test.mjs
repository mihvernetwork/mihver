// Tests for scripts/dev/canonical-json.mjs and scripts/dev/project-context-pack.mjs
// (Project Continuity V1A). Every fixture is a disposable git repository built under the OS temp
// directory with execFileSync -- this file never mutates the real MIHVER repository except where
// explicitly noted as read-only smoke checks (cases 24-27) run directly against it.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { canonicalizeJson } from "../../scripts/dev/canonical-json.mjs";
import {
  compileProjectContextPack,
  computeContextHash,
  DEFAULT_REPO_ROOT,
} from "../../scripts/dev/project-context-pack.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const CLI_PATH = join(REPO_ROOT, "scripts", "dev", "project-context-pack.mjs");
const SCHEMA_PATH = join(REPO_ROOT, "schemas", "dev", "project-context-pack.schema.json");
const require = createRequire(import.meta.url);

const roots = [];
let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    console.error(`FAIL: ${name}`);
    throw error;
  }
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", shell: false }).trim();
}

function writeFile(root, rel, content) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function currentTaskContent({ branch, taskId, objective = "Fixture objective.", status = "Fixture status.", requiredContext = [] }) {
  const rc = requiredContext.length ? requiredContext.map((p) => `- \`${p}\``).join("\n") : "(none listed)";
  return [
    "# Current Task",
    "",
    "## Task ID",
    "",
    taskId,
    "",
    "## Objective",
    "",
    objective,
    "",
    "## Branch / Base",
    "",
    `Branch: \`${branch}\`.`,
    "Base: `main` at `0000000000000000000000000000000000000000`.",
    "",
    "## Status",
    "",
    status,
    "",
    "## Required Context",
    "",
    rc,
    "",
  ].join("\n");
}

function reviewStateContent({ branch, taskId, outcome = "Reviewed and approved by a fresh reviewer." }) {
  return [
    "# Review State",
    "",
    "## Latest Review",
    "",
    `Task: ${taskId}`,
    `Branch: \`${branch}\``,
    "Target: main",
    "",
    outcome,
    "",
  ].join("\n");
}

function projectStateContent() {
  return [
    "# Project State",
    "",
    "## Current Milestone",
    "",
    "M0 fixture milestone.",
    "",
    "## Frozen Steps / Checkpoints (on `main`)",
    "",
    "- Fixture checkpoint one.",
    "- Fixture checkpoint two.",
    "",
    "## Next Authorized Action",
    "",
    "None automatically.",
    "",
  ].join("\n");
}

const CORE_TRIVIAL = {
  "CLAUDE.md": "# CLAUDE\n\nFixture operating model.\n",
  "ROADMAP.md": "# Roadmap\n\nFixture roadmap.\n",
  ".project/CONTEXT_INDEX.md": "# Context Index\n\nFixture index.\n",
  ".project/DECISIONS_LOG.md": "# Decisions Log\n\nFixture log.\n",
  "docs/development/AGENT_POLICY.md": "# Agent Policy\n\nFixture policy.\n",
  "docs/development/REVIEW_PROTOCOL.md": "# Review Protocol\n\nFixture protocol.\n",
  "docs/development/TASK_TEMPLATE.md": "# Task Template\n\nFixture template.\n",
};

// Writes every core authority source. `taskBranch`/`taskId` are what CURRENT_TASK.md/REVIEW_STATE.md
// declare; `checkoutBranch` (defaults to taskBranch) is informational only here -- callers switch
// branches themselves via git.
function writeCoreFiles(root, { taskBranch, taskId = "FIXTURE-TASK", requiredContext = [], reviewTaskId = taskId, reviewBranch = taskBranch, skip = [] } = {}) {
  for (const [rel, content] of Object.entries(CORE_TRIVIAL)) {
    if (!skip.includes(rel)) writeFile(root, rel, content);
  }
  if (!skip.includes(".project/PROJECT_STATE.md")) writeFile(root, ".project/PROJECT_STATE.md", projectStateContent());
  if (!skip.includes(".project/CURRENT_TASK.md")) {
    writeFile(root, ".project/CURRENT_TASK.md", currentTaskContent({ branch: taskBranch, taskId, requiredContext }));
  }
  if (!skip.includes(".project/REVIEW_STATE.md")) {
    writeFile(root, ".project/REVIEW_STATE.md", reviewStateContent({ branch: reviewBranch, taskId: reviewTaskId }));
  }
}

function tempRepo(label) {
  const root = mkdtempSync(join(tmpdir(), `mihver-ctxpack-${label}-`));
  roots.push(root);
  git(root, ["init", "--initial-branch=main", "-q"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test"]);
  return root;
}

function commitAll(root, message = "commit") {
  git(root, ["add", "-A"]);
  git(root, ["commit", "-m", message, "-q"]);
  return git(root, ["rev-parse", "HEAD"]);
}

// Standard fixture: a `main` branch (seeded) plus a task branch with its own commit, CURRENT_TASK.md
// declaring the task branch, REVIEW_STATE.md matching it. Returns { root, mainOid, headOid }.
function standardFixture(label, overrides = {}) {
  const root = tempRepo(label);
  writeCoreFiles(root, { ...overrides, taskBranch: "main" });
  const mainOid = commitAll(root, "seed on main");
  const branch = overrides.taskBranch ?? "feature/fixture";
  if (branch !== "main") {
    git(root, ["switch", "-c", branch, "-q"]);
    writeCoreFiles(root, { ...overrides, taskBranch: branch });
    commitAll(root, "task branch commit");
  }
  const headOid = git(root, ["rev-parse", "HEAD"]);
  return { root, mainOid, headOid, branch };
}

// --- canonical-json.mjs golden tests --------------------------------------------------------------

test("canonicalizeJson sorts nested object keys deterministically", () => {
  const a = canonicalizeJson({ b: 1, a: { d: 2, c: 3 } });
  const b = canonicalizeJson({ a: { c: 3, d: 2 }, b: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":{"c":3,"d":2},"b":1}');
});

test("canonicalizeJson preserves array element order", () => {
  assert.equal(canonicalizeJson([3, 1, 2]), "[3,1,2]");
  assert.equal(canonicalizeJson({ list: [{ z: 1, a: 2 }] }), '{"list":[{"a":2,"z":1}]}');
});

test("canonicalizeJson escapes strings via JSON string escaping", () => {
  assert.equal(canonicalizeJson("a\"b\\c\nd"), JSON.stringify("a\"b\\c\nd"));
  assert.equal(canonicalizeJson({ "k\"ey": "v" }), `{${JSON.stringify('k"ey')}:"v"}`);
});

test("canonicalizeJson serializes null, booleans, and finite numbers", () => {
  assert.equal(canonicalizeJson(null), "null");
  assert.equal(canonicalizeJson(true), "true");
  assert.equal(canonicalizeJson(false), "false");
  assert.equal(canonicalizeJson(0), "0");
  assert.equal(canonicalizeJson(-1.5), "-1.5");
  assert.equal(canonicalizeJson(123456789), "123456789");
});

test("canonicalizeJson rejects undefined, functions, symbols, BigInt", () => {
  assert.throws(() => canonicalizeJson(undefined), TypeError);
  assert.throws(() => canonicalizeJson(() => {}), TypeError);
  assert.throws(() => canonicalizeJson(Symbol("x")), TypeError);
  assert.throws(() => canonicalizeJson(10n), TypeError);
  assert.throws(() => canonicalizeJson({ a: undefined }), TypeError);
});

test("canonicalizeJson rejects sparse arrays, cyclic objects, non-finite numbers, non-plain objects", () => {
  const sparse = [1, , 3]; // eslint-disable-line no-sparse-arrays
  assert.throws(() => canonicalizeJson(sparse), TypeError);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalizeJson(cyclic), TypeError);
  assert.throws(() => canonicalizeJson(NaN), TypeError);
  assert.throws(() => canonicalizeJson(Infinity), TypeError);
  assert.throws(() => canonicalizeJson(-Infinity), TypeError);
  assert.throws(() => canonicalizeJson(new Date()), TypeError);
  assert.doesNotThrow(() => canonicalizeJson(Object.create(null)));
});

// --- ajv schema loader (used across several compiler-facing cases) --------------------------------

function loadValidator() {
  const ajvModule = require("ajv/dist/2020.js");
  const Ajv2020 = ajvModule.default ?? ajvModule;
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  return ajv.compile(schema);
}

// --- 1. Clean main repository compiles and validates ------------------------------------------

test("case 1: clean main repository compiles and validates against the schema", () => {
  const { root } = standardFixture("case1", { taskBranch: "main" });
  const pack = compileProjectContextPack(root);
  assert.equal(pack.kind, "ProjectContextPack");
  assert.equal(pack.repository.branch, "main");
  assert.equal(pack.repository.workingTree.clean, true);
  const validate = loadValidator();
  assert.equal(validate(pack), true, JSON.stringify(validate.errors));
});

// --- 2. Clean task branch produces exact branch/HEAD/baseline/merge-base data ------------------

test("case 2: clean task branch produces exact branch, HEAD, baseline and merge-base data", () => {
  const { root, mainOid, headOid } = standardFixture("case2", { taskBranch: "feature/exact" });
  const pack = compileProjectContextPack(root);
  assert.equal(pack.repository.branch, "feature/exact");
  assert.equal(pack.repository.head, headOid);
  assert.equal(pack.repository.baseline.ref, "main");
  assert.equal(pack.repository.baseline.oid, mainOid);
  assert.equal(pack.repository.mergeBase, mainOid);
  assert.equal(pack.repository.ahead, 1);
  assert.equal(pack.repository.behind, 0);
});

// --- 3. Two runs, identical semantic object and contextHash ------------------------------------

test("case 3: two runs against unchanged state produce identical object and contextHash", () => {
  const { root } = standardFixture("case3", { taskBranch: "main" });
  const first = compileProjectContextPack(root);
  const second = compileProjectContextPack(root);
  assert.deepEqual(first, second);
  assert.equal(first.contextHash, second.contextHash);
});

// --- 4. Compact and pretty modes: same parsed object and hash ----------------------------------

test("case 4: compact and pretty CLI output parse to the same object and same contextHash", () => {
  const { root } = standardFixture("case4", { taskBranch: "main" });
  const compact = JSON.parse(execFileSync("node", [CLI_PATH, "--repo", root], { encoding: "utf8" }));
  const pretty = JSON.parse(execFileSync("node", [CLI_PATH, "--repo", root, "--pretty"], { encoding: "utf8" }));
  assert.deepEqual(compact, pretty);
  assert.equal(compact.contextHash, pretty.contextHash);
});

// --- 5. Object property ordering does not alter canonical serialization -------------------------

test("case 5: contextHash is unaffected by object construction/property order", () => {
  const packA = { z: 1, a: { y: 2, x: 3 } };
  const packB = { a: { x: 3, y: 2 }, z: 1 };
  assert.equal(computeContextHash(packA), computeContextHash(packB));
});

// --- 6. A one-byte source change changes source hash and contextHash ---------------------------

test("case 6: a one-byte source change changes that source's hash and the contextHash", () => {
  const { root } = standardFixture("case6", { taskBranch: "main" });
  const before = compileProjectContextPack(root);
  const claudeMd = before.sources.find((s) => s.path === "CLAUDE.md");
  writeFile(root, "CLAUDE.md", `${CORE_TRIVIAL["CLAUDE.md"]}x`);
  commitAll(root, "one byte change");
  const after = compileProjectContextPack(root);
  const claudeMdAfter = after.sources.find((s) => s.path === "CLAUDE.md");
  assert.notEqual(claudeMdAfter.workingTreeSha256, claudeMd.workingTreeSha256);
  assert.notEqual(after.contextHash, before.contextHash);
});

// --- 7. Dirty tree is represented and executionEligible=false ----------------------------------

test("case 7: dirty working tree is represented and executionEligible=false", () => {
  const { root } = standardFixture("case7", { taskBranch: "main" });
  writeFile(root, "untracked.txt", "dirty\n");
  const pack = compileProjectContextPack(root);
  assert.equal(pack.repository.workingTree.clean, false);
  assert.equal(pack.validity.executionEligible, false);
  assert.equal(pack.validity.valid, true);
});

// --- 8. Missing required authority source fails closed ------------------------------------------

test("case 8: missing required authority source fails closed (executionEligible=false)", () => {
  const root = tempRepo("case8");
  writeCoreFiles(root, { taskBranch: "main", skip: ["ROADMAP.md"] });
  commitAll(root, "seed missing roadmap");
  const pack = compileProjectContextPack(root);
  const roadmap = pack.sources.find((s) => s.path === "ROADMAP.md");
  assert.equal(roadmap.state, "MISSING");
  assert.equal(pack.validity.executionEligible, false);
  assert.ok(pack.validity.warnings.some((w) => w.code === "REQUIRED_SOURCE_MISSING" && w.path === "ROADMAP.md"));
});

// --- 9. Unsafe symlink authority source fails closed ---------------------------------------------

test("case 9: unsafe symlink authority source fails closed (valid=false)", () => {
  const { root } = standardFixture("case9", { taskBranch: "main" });
  rmSync(join(root, ".project", "CONTEXT_INDEX.md"));
  symlinkSync("/etc/passwd", join(root, ".project", "CONTEXT_INDEX.md"));
  const pack = compileProjectContextPack(root);
  const entry = pack.sources.find((s) => s.path === ".project/CONTEXT_INDEX.md");
  assert.equal(entry.safety, "UNSAFE_SYMLINK");
  assert.equal(entry.state, "UNSAFE");
  assert.equal(pack.validity.valid, false);
  assert.equal(pack.validity.executionEligible, false);
  assert.ok(pack.validity.errors.some((e) => e.path === ".project/CONTEXT_INDEX.md"));
});

// --- 10. Absolute required-context path fails closed ----------------------------------------------

test("case 10: absolute required-context path fails closed (valid=false)", () => {
  const { root } = standardFixture("case10", {
    taskBranch: "feature/absolute",
    requiredContext: ["/etc/passwd"],
  });
  const pack = compileProjectContextPack(root);
  const entry = pack.sources.find((s) => s.path === "/etc/passwd");
  assert.equal(entry.safety, "UNSAFE_ABSOLUTE_PATH");
  assert.equal(pack.validity.valid, false);
});

// --- 11. '..' traversal path fails closed -----------------------------------------------------

test("case 11: '..' path traversal fails closed (valid=false)", () => {
  const { root } = standardFixture("case11", {
    taskBranch: "feature/traversal",
    requiredContext: ["../outside.txt"],
  });
  const pack = compileProjectContextPack(root);
  const entry = pack.sources.find((s) => s.path === "../outside.txt");
  assert.equal(entry.safety, "UNSAFE_TRAVERSAL");
  assert.equal(pack.validity.valid, false);
});

// --- 12. Missing task-required context fails closed -----------------------------------------------

test("case 12: missing task-required context fails closed (executionEligible=false, valid=true)", () => {
  const { root } = standardFixture("case12", {
    taskBranch: "feature/missing-rc",
    requiredContext: ["docs/does-not-exist.md"],
  });
  const pack = compileProjectContextPack(root);
  const entry = pack.sources.find((s) => s.path === "docs/does-not-exist.md");
  assert.equal(entry.state, "MISSING");
  assert.equal(pack.validity.valid, true);
  assert.equal(pack.validity.executionEligible, false);
  assert.ok(pack.validity.warnings.some((w) => w.code === "REQUIRED_CONTEXT_MISSING"));
});

// --- 13. CURRENT_TASK branch mismatch means no active task + warning -----------------------------

test("case 13: CURRENT_TASK branch mismatch means no active task and produces a warning", () => {
  const root = tempRepo("case13");
  writeCoreFiles(root, { taskBranch: "some-other-branch" });
  commitAll(root, "seed");
  const pack = compileProjectContextPack(root);
  assert.equal(pack.activeTask.active, false);
  assert.equal(pack.activeTask.declaredBranch, "some-other-branch");
  assert.ok(pack.validity.warnings.some((w) => w.code === "CURRENT_TASK_BRANCH_MISMATCH"));
});

// --- 14. REVIEW_STATE branch mismatch means historical, not current ------------------------------

test("case 14: REVIEW_STATE branch mismatch means review is historical, not current", () => {
  const { root } = standardFixture("case14", {
    taskBranch: "feature/review-branch-mismatch",
    reviewBranch: "some-other-branch",
  });
  const pack = compileProjectContextPack(root);
  assert.equal(pack.activeTask.active, true);
  assert.equal(pack.review.current, false);
});

// --- 15. REVIEW_STATE Task ID mismatch means historical, not current -----------------------------

test("case 15: REVIEW_STATE Task ID mismatch means review is historical, not current", () => {
  const { root } = standardFixture("case15", {
    taskBranch: "feature/review-task-mismatch",
    taskId: "TASK-A",
    reviewTaskId: "TASK-B",
  });
  const pack = compileProjectContextPack(root);
  assert.equal(pack.activeTask.active, true);
  assert.equal(pack.review.current, false);
  assert.ok(pack.validity.warnings.some((w) => w.code === "CONTRADICTORY_BRANCH_TASK_STATE"));
});

// --- 16. Detached HEAD is explicit and cannot silently become an active task ---------------------

test("case 16: detached HEAD is explicit and never becomes an active task", () => {
  const { root, headOid } = standardFixture("case16", { taskBranch: "feature/detached" });
  git(root, ["checkout", "--detach", headOid, "-q"]);
  const pack = compileProjectContextPack(root);
  assert.equal(pack.repository.detached, true);
  assert.equal(pack.repository.branch, null);
  assert.equal(pack.activeTask.active, false);
  // Regression: an otherwise clean, baseline-resolvable snapshot must still fail closed on
  // executionEligible when there is no active task (nothing is authorized to execute here) --
  // detached HEAD, and a CURRENT_TASK.md branch mismatch, must not be able to slip through with
  // executionEligible=true just because the tree happens to be clean.
  assert.equal(pack.validity.executionEligible, false);
  assert.ok(pack.validity.warnings.some((w) => w.code === "NO_ACTIVE_TASK"));
});

test("case 16b: a clean, baseline-resolvable branch with a CURRENT_TASK branch mismatch is still executionEligible=false", () => {
  const remote = tempRepo("case16b-remote");
  writeCoreFiles(remote, { taskBranch: "main" });
  commitAll(remote, "remote seed");
  const root = tempRepo("case16b-clone");
  git(root, ["remote", "add", "origin", remote]);
  git(root, ["fetch", "origin", "-q"]);
  git(root, ["branch", "main", "origin/main"]);
  git(root, ["switch", "-c", "feature/other", "main", "-q"]);
  // CURRENT_TASK.md (inherited from main) still declares "main" -- a mismatch against the
  // checked-out branch "feature/other". Nothing further to commit: the tree is already clean.

  const pack = compileProjectContextPack(root);
  assert.equal(pack.repository.workingTree.clean, true);
  assert.ok(pack.repository.baseline.oid);
  assert.equal(pack.activeTask.active, false);
  assert.equal(pack.validity.valid, true);
  assert.equal(pack.validity.executionEligible, false);
  assert.ok(pack.validity.warnings.some((w) => w.code === "NO_ACTIVE_TASK"));
});

// --- 17. Local main is preferred when available -------------------------------------------------

test("case 17: local main is preferred over origin/main when both are available", () => {
  const remote = tempRepo("case17-remote");
  writeCoreFiles(remote, { taskBranch: "main" });
  commitAll(remote, "remote seed");

  const root = tempRepo("case17-clone");
  git(root, ["remote", "add", "origin", remote]);
  git(root, ["fetch", "origin", "-q"]);
  git(root, ["branch", "main", "origin/main"]);
  git(root, ["switch", "-c", "feature/local-main", "main", "-q"]);
  writeCoreFiles(root, { taskBranch: "feature/local-main" });
  commitAll(root, "local commit");

  // Diverge local main from origin/main so the test can prove *local* main (not origin/main) was used.
  git(root, ["switch", "main", "-q"]);
  writeFile(root, "local-only.txt", "local main only\n");
  commitAll(root, "local main diverges");
  const localMainOid = git(root, ["rev-parse", "main"]);
  const originMainOid = git(root, ["rev-parse", "origin/main"]);
  assert.notEqual(localMainOid, originMainOid);
  git(root, ["switch", "feature/local-main", "-q"]);

  const pack = compileProjectContextPack(root);
  assert.equal(pack.repository.baseline.ref, "main");
  assert.equal(pack.repository.baseline.oid, localMainOid);
});

// --- 18. origin/main is the bounded fallback when local main is absent ---------------------------

test("case 18: origin/main is the bounded fallback when local main is absent", () => {
  const remote = tempRepo("case18-remote");
  writeCoreFiles(remote, { taskBranch: "main" });
  const remoteOid = commitAll(remote, "remote seed");

  const root = tempRepo("case18-clone");
  git(root, ["remote", "add", "origin", remote]);
  git(root, ["fetch", "origin", "-q"]);
  git(root, ["switch", "-c", "feature/no-local-main", "origin/main", "-q"]);
  writeCoreFiles(root, { taskBranch: "feature/no-local-main" });
  commitAll(root, "task commit");

  const localMain = (() => {
    try {
      return execFileSync("git", ["rev-parse", "--verify", "refs/heads/main"], { cwd: root, encoding: "utf8", shell: false });
    } catch {
      return null;
    }
  })();
  assert.equal(localMain, null);

  const pack = compileProjectContextPack(root);
  assert.equal(pack.repository.baseline.ref, "origin/main");
  assert.equal(pack.repository.baseline.oid, remoteOid);
});

// --- 19. No main/origin-main baseline fails closed -------------------------------------------------

test("case 19: no main/origin-main baseline fails closed (executionEligible=false)", () => {
  const root = tempRepo("case19");
  writeCoreFiles(root, { taskBranch: "solo" });
  git(root, ["checkout", "-b", "solo", "-q"]);
  commitAll(root, "solo seed");
  const pack = compileProjectContextPack(root);
  assert.equal(pack.repository.baseline.ref, null);
  assert.equal(pack.repository.baseline.oid, null);
  assert.equal(pack.repository.mergeBase, null);
  assert.equal(pack.validity.executionEligible, false);
  assert.ok(pack.validity.warnings.some((w) => w.code === "BASELINE_UNRESOLVABLE"));
});

// --- 20. STOP presence makes executionEligible=false ------------------------------------------------

test("case 20: STOP presence makes executionEligible=false", () => {
  const { root } = standardFixture("case20", { taskBranch: "main" });
  writeFile(root, ".project/STOP", "halt\n");
  commitAll(root, "add stop");
  const pack = compileProjectContextPack(root);
  assert.equal(pack.stop.present, true);
  assert.ok(pack.stop.sha256);
  assert.equal(pack.validity.executionEligible, false);
});

// --- 21. Untracked source state is accurately represented -------------------------------------------

test("case 21: untracked source state is accurately represented", () => {
  const { root } = standardFixture("case21", {
    taskBranch: "feature/untracked-rc",
    requiredContext: ["docs/untracked-note.md"],
  });
  writeFile(root, "docs/untracked-note.md", "note\n");
  const pack = compileProjectContextPack(root);
  const entry = pack.sources.find((s) => s.path === "docs/untracked-note.md");
  assert.equal(entry.state, "UNTRACKED");
  assert.equal(entry.headBlobOid, null);
  assert.ok(entry.workingTreeSha256);
});

// --- 22. Modified tracked source records both working-tree SHA-256 and HEAD blob OID ----------------

test("case 22: modified tracked source records both working-tree SHA-256 and HEAD blob OID", () => {
  const { root } = standardFixture("case22", { taskBranch: "main" });
  const before = compileProjectContextPack(root);
  const beforeEntry = before.sources.find((s) => s.path === "ROADMAP.md");
  writeFile(root, "ROADMAP.md", `${CORE_TRIVIAL["ROADMAP.md"]}modified\n`);
  const pack = compileProjectContextPack(root);
  const entry = pack.sources.find((s) => s.path === "ROADMAP.md");
  assert.equal(entry.state, "MODIFIED");
  assert.equal(entry.headBlobOid, beforeEntry.headBlobOid);
  assert.notEqual(entry.workingTreeSha256, beforeEntry.workingTreeSha256);
});

test("case 22b: interpreted project/activeTask/review content is derived from the exact hashed source bytes (no second read)", () => {
  // Regression test: project.milestone/latestCheckpoint/nextAuthorizedAction, activeTask's fields,
  // and review's fields must come from the SAME bytes project.source.sha256/the CURRENT_TASK.md
  // and REVIEW_STATE.md source-manifest entries were hashed from -- computed via one read per
  // file, never a second independent readFileSync call that could observe a different (torn)
  // version of the file if it changed between the hash read and an interpretation re-read.
  const { root } = standardFixture("case22b", { taskBranch: "main", taskId: "TORN-READ-CHECK" });
  const pack = compileProjectContextPack(root);
  const projectStateEntry = pack.sources.find((s) => s.path === ".project/PROJECT_STATE.md");
  assert.equal(pack.project.source.sha256, projectStateEntry.workingTreeSha256);
  assert.equal(pack.activeTask.taskId, "TORN-READ-CHECK");
  const actualProjectStateBytes = readFileSync(join(root, ".project", "PROJECT_STATE.md"));
  const { createHash } = require("node:crypto");
  const actualSha256 = createHash("sha256").update(actualProjectStateBytes).digest("hex");
  assert.equal(pack.project.source.sha256, actualSha256);
});

// --- 23. Source manifest ordering and changed-path ordering are deterministic -----------------------

test("case 23: source manifest and changed-path ordering are deterministic (sorted)", () => {
  const { root } = standardFixture("case23", { taskBranch: "feature/order" });
  const pack = compileProjectContextPack(root);
  const paths = pack.sources.map((s) => s.path);
  const sorted = [...paths].sort();
  assert.deepEqual(paths, sorted);
  const changed = pack.repository.changedPaths;
  assert.deepEqual(changed, [...changed].sort());
});

test("case 23b: a leading-space status code on the first working-tree entry does not corrupt its path", () => {
  // Regression test: `git status --porcelain`'s first line, when its status code starts with a
  // space (e.g. " M path"), must not have that space stripped by an over-eager trim() of the
  // whole multi-line command output -- doing so shifts every character of that one entry's parsed
  // path left by one, silently dropping its first character (e.g. a leading "." on a dotfile).
  const { root } = standardFixture("case23b", { taskBranch: "main" });
  writeFile(root, "CLAUDE.md", `${CORE_TRIVIAL["CLAUDE.md"]}modified\n`);
  const pack = compileProjectContextPack(root);
  const entries = pack.repository.workingTree.entries;
  assert.ok(entries.length > 0);
  const modified = entries.find((e) => e.path === "CLAUDE.md");
  assert.ok(modified, `expected an entry with the exact path "CLAUDE.md", got: ${JSON.stringify(entries)}`);
  assert.equal(modified.status, " M");
});

// --- 24. Compiler performs no filesystem write against a real or fixture repository -----------------

test("case 24: compiler performs no filesystem write against a fixture repository", () => {
  const { root } = standardFixture("case24", { taskBranch: "main" });
  const before = git(root, ["status", "--porcelain"]);
  compileProjectContextPack(root);
  compileProjectContextPack(root);
  const after = git(root, ["status", "--porcelain"]);
  assert.equal(before, after);
});

test("case 24b: compiler performs no filesystem write against the real MIHVER repository", () => {
  const before = execFileSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf8" });
  compileProjectContextPack(DEFAULT_REPO_ROOT);
  const after = execFileSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf8" });
  assert.equal(before, after);
});

// --- 25. Real repository smoke output validates against the schema ----------------------------------

test("case 25: real repository smoke output validates against the schema", () => {
  const pack = compileProjectContextPack(DEFAULT_REPO_ROOT);
  const validate = loadValidator();
  assert.equal(validate(pack), true, JSON.stringify(validate.errors));
});

// --- 26. Real repository: ContextPack agrees with direct git observation ----------------------------

test("case 26: real repository ContextPack agrees with direct git observation", () => {
  const pack = compileProjectContextPack(DEFAULT_REPO_ROOT);
  const branch = execFileSync("git", ["branch", "--show-current"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf8" }).trim().length > 0;
  assert.equal(pack.repository.branch, branch || null);
  assert.equal(pack.repository.head, head);
  assert.equal(pack.repository.workingTree.clean, !dirty);

  const currentTaskContentReal = readFileSync(join(REPO_ROOT, ".project", "CURRENT_TASK.md"), "utf8");
  const lines = currentTaskContentReal.split(/\r?\n/);
  const sectionStart = lines.findIndex((l) => l.trim() === "## Branch / Base");
  let declaredBranch = null;
  if (sectionStart !== -1) {
    for (let i = sectionStart + 1; i < lines.length; i++) {
      if (/^##\s/.test(lines[i])) break;
      const m = lines[i].match(/^Branch:\s*`([^`]+)`/);
      if (m) {
        declaredBranch = m[1];
        break;
      }
    }
  }
  assert.equal(pack.activeTask.active, Boolean(branch) && declaredBranch === branch);
});

// --- 27. Compiler source contains no network implementation or write API ----------------------------

test("case 27: compiler source contains no network implementation or filesystem-write API", () => {
  const src = readFileSync(join(REPO_ROOT, "scripts", "dev", "project-context-pack.mjs"), "utf8");
  for (const forbidden of ["fetch(", "http.request", "https.request", "net.connect", "net.createConnection", "writeFileSync(", "mkdirSync(", "rmSync(", "unlinkSync("]) {
    assert.ok(!src.includes(forbidden), `compiler source must not contain "${forbidden}"`);
  }
  // Every execFileSync call in the compiler must invoke "git" only.
  const execCalls = src.match(/execFileSync\(\s*"[^"]+"/g) || [];
  assert.ok(execCalls.length > 0);
  for (const call of execCalls) {
    assert.ok(call.includes('"git"'), `unexpected non-git execFileSync call: ${call}`);
  }
});

// --- 28. Unsupported canonical JSON values are rejected (see golden tests above) --------------------
// Covered by the canonical-json.mjs golden tests above (undefined/function/symbol/BigInt/sparse
// array/cyclic/non-finite/non-plain-object all throw TypeError).

// --- 29. CLI invalid options fail with documented exit code -----------------------------------------

test("case 29: CLI invalid options fail with documented exit code 1, no pack on stdout", () => {
  let threw = false;
  try {
    execFileSync("node", [CLI_PATH, "--not-a-real-option"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    threw = true;
    assert.equal(err.status, 1);
    assert.equal(err.stdout, "");
  }
  assert.ok(threw, "expected the CLI to exit non-zero on an unrecognized option");
});

// --- 30. stdout always contains JSON only ------------------------------------------------------------

test("case 30: stdout always contains JSON only (compact and pretty)", () => {
  const { root } = standardFixture("case30", { taskBranch: "main" });
  for (const args of [[], ["--pretty"]]) {
    const out = execFileSync("node", [CLI_PATH, "--repo", root, ...args], { encoding: "utf8" });
    assert.ok(out.endsWith("\n"));
    const body = out.slice(0, -1);
    assert.ok(!body.endsWith("\n"), "exactly one trailing newline expected");
    assert.doesNotThrow(() => JSON.parse(body));
    assert.ok(body.startsWith("{"));
  }
});

// --- exit-code contract for a structurally invalid pack (unsafe required source) --------------------

test("CLI exits 2 and still emits a schema-valid pack when validity.valid is false", () => {
  const { root } = standardFixture("exitcode-invalid", { taskBranch: "main" });
  rmSync(join(root, ".project", "CONTEXT_INDEX.md"));
  symlinkSync("/etc/passwd", join(root, ".project", "CONTEXT_INDEX.md"));
  let stdout = null;
  let status = null;
  try {
    stdout = execFileSync("node", [CLI_PATH, "--repo", root], { encoding: "utf8" });
    status = 0;
  } catch (err) {
    stdout = err.stdout;
    status = err.status;
  }
  assert.equal(status, 2);
  const pack = JSON.parse(stdout);
  assert.equal(pack.validity.valid, false);
  const validate = loadValidator();
  assert.equal(validate(pack), true, JSON.stringify(validate.errors));
});

// --- cleanup -------------------------------------------------------------------------------------

for (const root of roots) rmSync(root, { recursive: true, force: true });
console.log(`project-context-pack.test.mjs: ${passed} passed`);
