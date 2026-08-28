#!/usr/bin/env node
// MIHVER ProjectContextPack v1 compiler (Project Continuity V1A).
//
// Produces a compact, deterministic, machine-readable snapshot derived from MIHVER's existing
// authoritative repository state (live Git + the owning .project/docs artifacts), so a fresh
// Claude/Codex/control-plane session can reconstruct current repository/task/review context
// without scanning large historical Markdown files or depending on prior chat history.
//
// The ContextPack is a DERIVED SNAPSHOT, never a new authority source. Authority precedence:
//   1. Live Git state
//   2. The owning repository artifact/document
//   3. This derived ProjectContextPack
//   4. Session/chat summaries
// See docs/development/PROJECT_CONTINUITY.md for the full contract.
//
// Hard invariants:
//   - Read-only. This module performs no filesystem write and no Git mutation (no fetch, pull,
//     checkout, branch creation, reset, clean, stash, commit, or config).
//   - Zero network / zero external service. No LLM, no GitHub API, no HTTP/HTTPS/fetch/socket call.
//   - Every Git invocation uses execFileSync with an explicit argument array -- never an
//     interpolated shell command string (mirrors scripts/dev/publication-builder.mjs's convention).
//   - No clock-dependent field participates in the pack or its contextHash.
//   - The compiler fails closed when a required authority source cannot be read or safely
//     resolved -- see "Validity" below.
//
// Exit code contract (CLI only; compileProjectContextPack() itself never calls process.exit):
//   0 - pack compiled, validity.valid === true (may still have executionEligible === false)
//   1 - CLI usage error (unrecognized option) -- no pack is emitted on stdout
//   2 - pack compiled (or a degraded internal-error fallback pack), validity.valid === false
//
// Without --pretty: exactly one compact JSON document on stdout, followed by one newline, and
// nothing else on stdout. With --pretty: one stable pretty-printed JSON document, followed by one
// newline. Human-readable diagnostics, if any, go to stderr only.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import { canonicalizeJson } from "./canonical-json.mjs";

export const SCHEMA_VERSION = "1.0.0";
export const COMPILER_NAME = "project-context-pack.mjs";
export const COMPILER_VERSION = "1.0.0";
export const CONTEXT_HASH_DOMAIN = "MIHVER:ProjectContextPack:v1\0";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const DEFAULT_REPO_ROOT = resolve(__dirname, "..", "..");
const SCHEMA_PATH = resolve(__dirname, "..", "..", "schemas", "dev", "project-context-pack.schema.json");

let cachedValidator = null;
function getValidator() {
  if (cachedValidator) return cachedValidator;
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  cachedValidator = ajv.compile(schema);
  return cachedValidator;
}

// Core authority/navigation sources every pack manifests (see PROJECT-CONTINUITY-V1A-CONTEXT-PACK
// task, "3.G. Source manifest"). Order here is irrelevant -- the manifest is sorted by path.
const CORE_SOURCES = [
  "CLAUDE.md",
  "ROADMAP.md",
  ".project/PROJECT_STATE.md",
  ".project/CURRENT_TASK.md",
  ".project/REVIEW_STATE.md",
  ".project/CONTEXT_INDEX.md",
  ".project/DECISIONS_LOG.md",
  "docs/development/AGENT_POLICY.md",
  "docs/development/REVIEW_PROTOCOL.md",
  "docs/development/TASK_TEMPLATE.md",
];

// --- small pure utilities -----------------------------------------------------------------------

function sha256Hex(bufferOrString) {
  return createHash("sha256").update(bufferOrString).digest("hex");
}

function sortUnique(list) {
  return Array.from(new Set(list)).sort();
}

function truncate(text, maxLen) {
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

// --- Git access (read-only, execFileSync with an argument array only) --------------------------

function tryGit(repoRoot, args) {
  try {
    const out = execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    // Trim only trailing newline(s) -- NOT a full trim(), which would strip the leading space of
    // `git status --porcelain`'s first line for any entry whose status code starts with a space
    // (e.g. " M path"), corrupting that entry's parsed path.
    return { ok: true, out: out.replace(/\r?\n+$/, "") };
  } catch {
    return { ok: false, out: null };
  }
}

// --- Markdown section parsing (mirrors scripts/dev/project-context.mjs's conventions) ----------

function extractSection(content, heading) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

function extractBranchField(content, heading) {
  for (const line of extractSection(content, heading)) {
    const match = line.match(/^Branch:\s*`([^`]+)`/);
    if (match) return match[1];
  }
  return null;
}

function extractTaskField(content, heading) {
  for (const line of extractSection(content, heading)) {
    const match = line.match(/^Task:\s*(.+)$/);
    if (match) return match[1].trim();
  }
  return null;
}

function extractSectionValue(content, heading) {
  const lines = extractSection(content, heading).map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines[0] : null;
}

function sectionSummary(content, heading, maxLen = 160) {
  const text = extractSection(content, heading).filter((l) => l.trim() !== "").join(" ").trim();
  return text ? truncate(text, maxLen) : null;
}

function extractBullets(lines) {
  const bullets = [];
  for (const raw of lines) {
    if (/^-\s/.test(raw)) {
      bullets.push(raw.replace(/^-\s*/, "").trim());
    } else if (bullets.length && raw.trim() !== "") {
      bullets[bullets.length - 1] += ` ${raw.trim()}`;
    }
  }
  return bullets;
}

function lastBulletSummary(content, heading, maxLen = 160) {
  const bullets = extractBullets(extractSection(content, heading));
  if (bullets.length === 0) return null;
  return truncate(bullets[bullets.length - 1], maxLen);
}

function extractBulletPaths(lines) {
  const paths = [];
  for (const line of lines) {
    const match = line.match(/`([^`]+)`/);
    if (match) paths.push(match[1]);
  }
  return paths;
}

// --- Path safety (mirrors scripts/dev/publication-builder.mjs's isSafeRelativePath /
// resolvesInsideRepo pattern; extended with a realpath containment check so a symlinked ancestor
// directory can't smuggle an otherwise "safe-looking" path outside the repository). -------------

function classifyPathSafety(repoRoot, relPathRaw) {
  if (typeof relPathRaw !== "string" || relPathRaw.length === 0) return "UNSAFE_INVALID";
  if (relPathRaw.includes("\0") || relPathRaw.includes("\n")) return "UNSAFE_INVALID";
  if (isAbsolute(relPathRaw) || relPathRaw.startsWith("/") || relPathRaw.includes("\\")) {
    return "UNSAFE_ABSOLUTE_PATH";
  }
  const segments = relPathRaw.split("/");
  if (segments.some((s) => s === ".." || s === "")) return "UNSAFE_TRAVERSAL";

  const repoRootResolved = resolve(repoRoot);
  const abs = resolve(repoRootResolved, relPathRaw);
  const rel = relative(repoRootResolved, abs);
  if (rel === "" || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return "UNSAFE_ESCAPES_REPO";

  try {
    const st = lstatSync(abs);
    if (st.isSymbolicLink()) return "UNSAFE_SYMLINK";
    if (!st.isFile()) return "UNSAFE_NOT_REGULAR_FILE";
    const realAbs = realpathSync(abs);
    const realRepoRoot = realpathSync(repoRootResolved);
    const realRel = relative(realRepoRoot, realAbs);
    if (realRel.startsWith(`..${sep}`) || isAbsolute(realRel)) return "UNSAFE_SYMLINK";
  } catch {
    // Does not exist on disk: structurally safe as a path, just absent (MISSING, not UNSAFE).
  }
  return "SAFE";
}

function isUnsafe(safety) {
  return safety !== "SAFE";
}

// --- Source manifest entry compilation ----------------------------------------------------------

// Returns a source manifest entry. Reads the file's bytes at most once (`__textContent` carries
// the decoded UTF-8 text for present/safe entries so callers that need to interpret this source
// -- compileProjectInterpretation/compileActiveTask/compileReview -- reuse the exact same bytes
// this entry's own hash was computed from, rather than re-reading the file a second time and
// risking a torn read against a concurrent external modification. `__textContent` is stripped
// before the entry is placed in the pack's `sources` array (see compileProjectContextPack).
function compileSourceEntry(repoRoot, relPath, role, required) {
  const safety = classifyPathSafety(repoRoot, relPath);
  const entry = {
    path: relPath,
    role,
    required,
    present: false,
    safety,
    byteLength: null,
    workingTreeSha256: null,
    headBlobOid: null,
    state: "UNSAFE",
    __textContent: null,
  };

  if (isUnsafe(safety)) return entry;

  const abs = join(repoRoot, relPath);
  let present = false;
  let buf = null;
  try {
    buf = readFileSync(abs);
    present = true;
    entry.byteLength = buf.length;
    entry.workingTreeSha256 = sha256Hex(buf);
    entry.__textContent = buf.toString("utf8");
  } catch {
    present = false;
  }
  entry.present = present;

  const headBlob = tryGit(repoRoot, ["rev-parse", "--verify", `HEAD:${relPath}`]);
  entry.headBlobOid = headBlob.ok && /^[0-9a-f]{40}$/.test(headBlob.out) ? headBlob.out : null;

  if (!present) {
    entry.state = "MISSING";
    return entry;
  }

  const tracked = tryGit(repoRoot, ["ls-files", "--", relPath]);
  if (!tracked.ok) {
    entry.state = "UNKNOWN";
    return entry;
  }
  const isTracked = tracked.out.length > 0;
  if (!isTracked) {
    entry.state = "UNTRACKED";
    return entry;
  }

  const statusForPath = tryGit(repoRoot, ["status", "--porcelain", "--", relPath]);
  if (!statusForPath.ok) {
    entry.state = "UNKNOWN";
    return entry;
  }
  const isModified = statusForPath.out.length > 0;
  entry.state = isModified ? "MODIFIED" : "CLEAN";
  return entry;
}

// --- Repository snapshot -------------------------------------------------------------------------

function compileRepositorySnapshot(repoRoot) {
  const branchResult = tryGit(repoRoot, ["branch", "--show-current"]);
  const headResult = tryGit(repoRoot, ["rev-parse", "HEAD"]);

  const headOk = headResult.ok && /^[0-9a-f]{40}$/.test(headResult.out);
  const head = headOk ? headResult.out : null;

  const branchOk = branchResult.ok;
  const detached = branchOk && branchResult.out === "";
  const branch = branchOk && branchResult.out !== "" ? branchResult.out : null;

  let baselineRef = null;
  let baselineOid = null;
  const localMain = tryGit(repoRoot, ["rev-parse", "--verify", "refs/heads/main"]);
  if (localMain.ok && /^[0-9a-f]{40}$/.test(localMain.out)) {
    baselineRef = "main";
    baselineOid = localMain.out;
  } else {
    const originMain = tryGit(repoRoot, ["rev-parse", "--verify", "refs/remotes/origin/main"]);
    if (originMain.ok && /^[0-9a-f]{40}$/.test(originMain.out)) {
      baselineRef = "origin/main";
      baselineOid = originMain.out;
    }
  }

  let mergeBase = null;
  let ahead = null;
  let behind = null;
  let changedPaths = [];

  if (head && baselineOid) {
    const mb = tryGit(repoRoot, ["merge-base", "HEAD", baselineOid]);
    mergeBase = mb.ok && /^[0-9a-f]{40}$/.test(mb.out) ? mb.out : null;

    const counts = tryGit(repoRoot, ["rev-list", "--left-right", "--count", `${baselineOid}...HEAD`]);
    if (counts.ok) {
      const parts = counts.out.split(/\s+/).filter(Boolean);
      if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
        behind = Number(parts[0]);
        ahead = Number(parts[1]);
      }
    }

    const diffNames = tryGit(repoRoot, ["diff", "--name-only", `${baselineOid}...HEAD`]);
    if (diffNames.ok && diffNames.out.length > 0) {
      changedPaths = sortUnique(diffNames.out.split("\n").filter(Boolean));
    }
  }

  const statusResult = tryGit(repoRoot, ["status", "--porcelain"]);
  const rawEntries = statusResult.ok && statusResult.out.length > 0 ? statusResult.out.split("\n").filter(Boolean) : [];
  const entries = rawEntries
    .map((line) => ({ status: line.slice(0, 2), path: line.slice(3) }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  // Fail closed rather than silently reporting "clean" when the status query itself failed --
  // see compileValidity's WORKING_TREE_STATUS_UNAVAILABLE error.
  const clean = statusResult.ok && entries.length === 0;

  return {
    detached,
    branch,
    head,
    baseline: { ref: baselineRef, oid: baselineOid },
    mergeBase,
    ahead,
    behind,
    workingTree: { clean, entries },
    changedPaths,
    workingTreeStatusUnavailable: !statusResult.ok,
    // Filled in by the caller once validity/executionEligible is known project-wide.
    executionBlocked: null,
  };
}

// --- Project / active task / review sections ------------------------------------------------------

function compileProjectInterpretation(_repoRoot, sourcesByPath) {
  const projectStateEntry = sourcesByPath.get(".project/PROJECT_STATE.md");
  // Reuse the exact bytes compileSourceEntry already hashed -- never re-read the file, which
  // could observe a different (torn) version if it changed mid-compilation.
  const content = projectStateEntry && projectStateEntry.__textContent !== null ? projectStateEntry.__textContent : "";
  return {
    milestone: sectionSummary(content, "Current Milestone"),
    latestCheckpoint: lastBulletSummary(content, "Frozen Steps / Checkpoints (on `main`)"),
    nextAuthorizedAction: sectionSummary(content, "Next Authorized Action"),
    source: {
      path: ".project/PROJECT_STATE.md",
      sha256: projectStateEntry ? projectStateEntry.workingTreeSha256 : null,
    },
  };
}

function compileActiveTask(_repoRoot, branch, detached, sourcesByPath, warnings) {
  const entry = sourcesByPath.get(".project/CURRENT_TASK.md");
  const exists = Boolean(entry && entry.present && entry.safety === "SAFE");
  // Reuse the exact bytes compileSourceEntry already hashed (see that function's own comment).
  const content = exists && entry.__textContent !== null ? entry.__textContent : "";

  const declaredBranch = exists ? extractBranchField(content, "Branch / Base") : null;
  const active = !detached && exists && declaredBranch !== null && declaredBranch === branch;

  if (!detached && exists && declaredBranch !== null && declaredBranch !== branch) {
    warnings.push({
      code: "CURRENT_TASK_BRANCH_MISMATCH",
      message: `.project/CURRENT_TASK.md declares branch "${declaredBranch}" but HEAD is on "${branch}" -- no active task for this branch.`,
      path: ".project/CURRENT_TASK.md",
    });
  }

  if (!active) {
    return {
      active: false,
      declaredBranch,
      taskId: null,
      objective: null,
      status: null,
      requiredContext: [],
    };
  }

  const taskId = extractSectionValue(content, "Task ID");
  const objective = sectionSummary(content, "Objective");
  const status = sectionSummary(content, "Status");
  const requiredContextRaw = extractBulletPaths(extractSection(content, "Required Context"));
  const requiredContext = sortUnique(requiredContextRaw);

  return { active: true, declaredBranch, taskId, objective, status, requiredContext };
}

function compileReview(_repoRoot, branch, activeTask, sourcesByPath) {
  const entry = sourcesByPath.get(".project/REVIEW_STATE.md");
  const exists = Boolean(entry && entry.present && entry.safety === "SAFE");
  // Reuse the exact bytes compileSourceEntry already hashed (see that function's own comment).
  const content = exists && entry.__textContent !== null ? entry.__textContent : "";

  const declaredBranch = exists ? extractBranchField(content, "Latest Review") : null;
  const declaredTaskId = exists ? extractTaskField(content, "Latest Review") : null;
  const outcome = exists ? sectionSummary(content, "Latest Review", 200) : null;

  const current =
    activeTask.active &&
    declaredBranch !== null &&
    declaredBranch === branch &&
    activeTask.taskId !== null &&
    declaredTaskId !== null &&
    declaredTaskId === activeTask.taskId;

  return { current, declaredBranch, declaredTaskId, outcome };
}

// --- Validity / execution eligibility -------------------------------------------------------------

function compileValidity({
  repository,
  activeTask,
  review,
  stop,
  sources,
  requiredContextEntries,
}) {
  const errors = [];
  const warnings = [];

  if (!repository.head) {
    errors.push({ code: "HEAD_UNRESOLVABLE", message: "git rev-parse HEAD did not resolve to a 40-hex commit OID." });
  }

  for (const src of sources) {
    if (src.required && isUnsafe(src.safety)) {
      errors.push({
        code: `UNSAFE_REQUIRED_SOURCE_${src.safety}`,
        message: `Required authority source "${src.path}" is unsafe (${src.safety}).`,
        path: src.path,
      });
    } else if (src.required && src.state === "MISSING") {
      warnings.push({
        code: "REQUIRED_SOURCE_MISSING",
        message: `Required authority source "${src.path}" is missing.`,
        path: src.path,
      });
    }
  }

  for (const rc of requiredContextEntries) {
    if (isUnsafe(rc.safety)) {
      errors.push({
        code: `UNSAFE_REQUIRED_CONTEXT_${rc.safety}`,
        message: `Active task Required Context path "${rc.path}" is unsafe (${rc.safety}).`,
        path: rc.path,
      });
    } else if (rc.state === "MISSING") {
      warnings.push({
        code: "REQUIRED_CONTEXT_MISSING",
        message: `Active task Required Context path "${rc.path}" is missing.`,
        path: rc.path,
      });
    }
  }

  if (!repository.baseline.oid) {
    warnings.push({
      code: "BASELINE_UNRESOLVABLE",
      message: "Neither refs/heads/main nor refs/remotes/origin/main could be resolved.",
    });
  }

  if (!repository.workingTree.clean) {
    warnings.push({ code: "DIRTY_WORKING_TREE", message: "Working tree has uncommitted changes." });
  }

  if (stop.present) {
    warnings.push({ code: "STOP_PRESENT", message: ".project/STOP is present." });
  }

  if (!activeTask.active) {
    warnings.push({
      code: "NO_ACTIVE_TASK",
      message: "No task is active for the current branch (detached HEAD, no CURRENT_TASK.md, or a branch mismatch) -- nothing is authorized to execute here.",
    });
  }

  for (const src of sources) {
    if (src.state === "UNKNOWN") {
      errors.push({
        code: "SOURCE_STATE_UNDETERMINABLE",
        message: `Could not determine the tracked/modified state of "${src.path}" -- a required Git query failed unexpectedly.`,
        path: src.path,
      });
    }
  }

  if (repository.workingTreeStatusUnavailable) {
    errors.push({
      code: "WORKING_TREE_STATUS_UNAVAILABLE",
      message: "git status --porcelain failed unexpectedly -- working-tree cleanliness could not be determined.",
    });
  }

  const contradictory =
    activeTask.active &&
    review.declaredBranch !== null &&
    review.declaredBranch === activeTask.declaredBranch &&
    activeTask.taskId !== null &&
    review.declaredTaskId !== null &&
    review.declaredTaskId !== activeTask.taskId;
  if (contradictory) {
    warnings.push({
      code: "CONTRADICTORY_BRANCH_TASK_STATE",
      message:
        "REVIEW_STATE.md declares the same branch as the active task but a different Task ID -- " +
        "branch/task state is contradictory.",
    });
  }

  const valid = errors.length === 0;
  const executionEligible =
    valid &&
    Boolean(repository.head) &&
    Boolean(repository.baseline.oid) &&
    repository.workingTree.clean &&
    !stop.present &&
    !contradictory &&
    activeTask.active &&
    !warnings.some((w) => w.code === "REQUIRED_SOURCE_MISSING" || w.code === "REQUIRED_CONTEXT_MISSING");

  return { valid, executionEligible, errors, warnings };
}

// --- contextHash -----------------------------------------------------------------------------------

export function computeContextHash(packWithoutContextHash) {
  const canonical = canonicalizeJson(packWithoutContextHash);
  const hash = createHash("sha256");
  hash.update(Buffer.from(CONTEXT_HASH_DOMAIN, "utf8"));
  hash.update(Buffer.from(canonical, "utf8"));
  return `sha256:${hash.digest("hex")}`;
}

function finalizePack(packWithoutContextHash) {
  const contextHash = computeContextHash(packWithoutContextHash);
  const pack = { ...packWithoutContextHash, contextHash };
  const validate = getValidator();
  if (!validate(pack)) {
    const detail = (validate.errors || []).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ");
    throw new Error(`internal: compiled ProjectContextPack failed self-validation against its own schema: ${detail}`);
  }
  return pack;
}

// --- Degraded fallback pack (used only when compilation hits an unexpected internal error) -------

function degradedPack(message) {
  const body = {
    $schema: "https://mihver.network/schemas/dev/project-context-pack.schema.json",
    kind: "ProjectContextPack",
    schemaVersion: SCHEMA_VERSION,
    compiler: { name: COMPILER_NAME, version: COMPILER_VERSION },
    repository: {
      detached: false,
      branch: null,
      head: null,
      baseline: { ref: null, oid: null },
      mergeBase: null,
      ahead: null,
      behind: null,
      workingTree: { clean: false, entries: [] },
      changedPaths: [],
      executionBlocked: true,
    },
    project: {
      milestone: null,
      latestCheckpoint: null,
      nextAuthorizedAction: null,
      source: { path: ".project/PROJECT_STATE.md", sha256: null },
    },
    activeTask: { active: false, declaredBranch: null, taskId: null, objective: null, status: null, requiredContext: [] },
    review: { current: false, declaredBranch: null, declaredTaskId: null, outcome: null },
    stop: { present: false, sha256: null },
    sources: [],
    validity: {
      valid: false,
      executionEligible: false,
      errors: [{ code: "INTERNAL_COMPILATION_ERROR", message: String(message) }],
      warnings: [],
    },
  };
  return finalizePack(body);
}

// --- Public compiler API ----------------------------------------------------------------------------

export function compileProjectContextPack(repoRoot, _options = {}) {
  try {
    if (!existsSync(repoRoot)) {
      // Deliberately does not include the caller-supplied path itself in the emitted pack -- an
      // operator-supplied --repo value could be an arbitrary local path (e.g. under a home or
      // temp directory) that PROJECT_CONTINUITY.md's privacy rules say this artifact must not echo.
      return degradedPack("the requested repository root does not exist");
    }

    const repository = compileRepositorySnapshot(repoRoot);

    const coreEntries = CORE_SOURCES.map((p) => compileSourceEntry(repoRoot, p, "CORE_AUTHORITY", true));
    const sourcesByPath = new Map(coreEntries.map((e) => [e.path, e]));

    const warnings = [];
    const activeTask = compileActiveTask(repoRoot, repository.branch, repository.detached, sourcesByPath, warnings);
    const review = compileReview(repoRoot, repository.branch, activeTask, sourcesByPath);

    const requiredContextEntries = activeTask.requiredContext.map((p) =>
      compileSourceEntry(repoRoot, p, "TASK_REQUIRED_CONTEXT", true)
    );
    for (const rc of requiredContextEntries) {
      if (!sourcesByPath.has(rc.path)) sourcesByPath.set(rc.path, rc);
    }

    const stopSafety = classifyPathSafety(repoRoot, ".project/STOP");
    let stop = { present: false, sha256: null };
    if (!isUnsafe(stopSafety)) {
      try {
        const buf = readFileSync(join(repoRoot, ".project/STOP"));
        stop = { present: true, sha256: sha256Hex(buf) };
      } catch {
        stop = { present: false, sha256: null };
      }
    } else if (existsSync(join(repoRoot, ".project/STOP"))) {
      // Present but unreadable as a safe regular file (e.g. a symlink) -- still report presence.
      stop = { present: true, sha256: null };
    }

    const project = compileProjectInterpretation(repoRoot, sourcesByPath);

    const sources = Array.from(sourcesByPath.values())
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
      .map(({ __textContent, ...publicFields }) => publicFields);

    const validity = compileValidity({
      repository,
      activeTask,
      review,
      stop,
      sources,
      requiredContextEntries,
    });
    validity.warnings = [...warnings, ...validity.warnings].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

    repository.executionBlocked = !validity.executionEligible;

    const packWithoutContextHash = {
      $schema: "https://mihver.network/schemas/dev/project-context-pack.schema.json",
      kind: "ProjectContextPack",
      schemaVersion: SCHEMA_VERSION,
      compiler: { name: COMPILER_NAME, version: COMPILER_VERSION },
      repository,
      project,
      activeTask,
      review,
      stop,
      sources,
      validity,
    };

    return finalizePack(packWithoutContextHash);
  } catch (err) {
    return degradedPack(err && err.message ? err.message : String(err));
  }
}

// --- CLI ---------------------------------------------------------------------------------------------

function printHelp(stream) {
  stream.write(
    [
      "Usage: node scripts/dev/project-context-pack.mjs [--pretty] [--repo <path>] [--help]",
      "",
      "Compiles the MIHVER ProjectContextPack v1 (a derived, read-only repository snapshot) and",
      "prints it as JSON on stdout. See docs/development/PROJECT_CONTINUITY.md.",
      "",
      "Options:",
      "  --pretty        Pretty-print the JSON output (semantics/contextHash are unaffected).",
      "  --repo <path>   Compile against the repository rooted at <path> instead of this script's",
      "                  own repository.",
      "  --help          Print this message and exit 0.",
      "",
      "Exit codes: 0 = compiled, valid; 1 = CLI usage error; 2 = compiled (or degraded), invalid.",
      "",
    ].join("\n")
  );
}

function runCli(argv) {
  let pretty = false;
  let repoArg = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--pretty") {
      pretty = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp(process.stdout);
      return 0;
    } else if (arg === "--repo") {
      repoArg = argv[i + 1];
      i += 1;
      if (!repoArg) {
        process.stderr.write("error: --repo requires a path argument\n");
        return 1;
      }
    } else {
      process.stderr.write(`error: unrecognized option "${arg}"\n`);
      return 1;
    }
  }

  const repoRoot = repoArg ? resolve(process.cwd(), repoArg) : DEFAULT_REPO_ROOT;
  const pack = compileProjectContextPack(repoRoot);
  const json = pretty ? JSON.stringify(pack, null, 2) : JSON.stringify(pack);
  process.stdout.write(`${json}\n`);
  return pack.validity.valid ? 0 : 2;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  process.exitCode = runCli(process.argv.slice(2));
}
