#!/usr/bin/env node
// MIHVER ProjectContextPack v1 compiler (Project Continuity V1A, hardened per
// PROJECT-CONTINUITY-V1A-PR34-FINAL-HARDENING).
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
// See docs/development/PROJECT_CONTINUITY.md for the full contract, including the documented
// residual limitations of the consistency fence and the path-safe-read primitive below.
//
// Hard invariants:
//   - Read-only. This module performs no filesystem write and no Git mutation (no fetch, pull,
//     checkout, branch creation, reset, clean, stash, commit, or config).
//   - Zero network / zero external service. No LLM, no GitHub API, no HTTP/HTTPS/fetch/socket call.
//   - Every Git invocation uses execFileSync with an explicit argument array -- never an
//     interpolated shell command string (mirrors scripts/dev/publication-builder.mjs's convention).
//     The production default is always `execFileSync("git", args, { shell:false, ... })`; tests may
//     inject a different execFileSync-compatible implementation via `options.execFileSyncImpl`
//     (same convention as scripts/dev/publication-builder.mjs) to deterministically fail an exact
//     Git argument array without invoking a real shell.
//   - No clock-dependent field participates in the pack or its contextHash.
//   - The compiler fails closed when a required authority source, or any authority-relevant Git
//     query, cannot be read/observed safely -- see "Validity" below. An "empty successful result"
//     (e.g. no working-tree changes) is always distinguished from "the query itself failed" via a
//     dedicated stable error code -- never collapsed into the same `null`/`[]`/`""` representation.
//   - A bounded start/end consistency fence detects (not prevents) a HEAD or working-tree change
//     that happens during compilation -- see compileProjectContextPack's use of `observeGitState`.
//     This is NOT a filesystem transaction/lock; it only detects an externally observed change
//     between two points in time.
//   - Source reads go through `safeReadSource`, a single bounded read-only primitive (classify,
//     then open with O_NOFOLLOW where supported, fstat, and read from the SAME file descriptor) so
//     the bytes hashed are guaranteed to be the bytes fstat validated for the FINAL path component.
//     This does not close every possible race: Node's public fs API has no `openat`-relative-to-a-
//     directory-descriptor primitive, so an ancestor directory swapped between this function's own
//     realpath containment check and its open() call is a residual, documented limitation -- see
//     PROJECT_CONTINUITY.md.
//
// Exit code contract (CLI only; compileProjectContextPack() itself never calls process.exit and
// never throws -- every failure mode, including a genuinely unexpected internal exception, is
// caught and converted into a schema-valid, deterministic, valid:false degraded pack):
//   0 - pack compiled, validity.valid === true (may still have executionEligible === false)
//   1 - CLI usage error (unrecognized option) -- no pack is emitted on stdout
//   2 - pack compiled (or a degraded internal-error fallback pack), validity.valid === false
//
// Without --pretty: exactly one compact JSON document on stdout, followed by one newline, and
// nothing else on stdout. With --pretty: one stable pretty-printed JSON document, followed by one
// newline. Human-readable diagnostics, if any (including internal exception detail -- see the
// degraded-pack contract below), go to stderr only, NEVER into the emitted pack itself.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import { canonicalizeJson } from "./canonical-json.mjs";

export const SCHEMA_VERSION = "1.0.0";
export const COMPILER_NAME = "project-context-pack.mjs";
export const COMPILER_VERSION = "1.0.0";
export const CONTEXT_HASH_DOMAIN = "MIHVER:ProjectContextPack:v1\0";
export const SCHEMA_URI = "https://mihver.network/schemas/dev/project-context-pack.schema.json";

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

// Core authority/navigation sources every pack manifests. Order here is irrelevant -- the manifest
// is sorted by path in the emitted pack.
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

// Computes a Git blob object's SHA-1 OID directly from raw bytes already in memory -- the exact
// `blob <len>\0<content>` hashing scheme Git itself uses for `git hash-object`/tree blob entries.
// Lets compileSourceEntry bind a "clean" claim to the exact bytes it already read (see Finding 4 /
// SOURCE_HEAD_BLOB_UNDETERMINABLE) instead of trusting `git status`'s "no diff" claim alone.
function gitBlobSha1Hex(buf) {
  const header = Buffer.from(`blob ${buf.length}\0`, "utf8");
  return createHash("sha1").update(Buffer.concat([header, buf])).digest("hex");
}

function sortUnique(list) {
  return Array.from(new Set(list)).sort();
}

function truncate(text, maxLen) {
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

// --- Git access (read-only, execFileSync with an argument array only) --------------------------

// Global flags prepended to EVERY Git invocation this compiler makes, in this fixed order --
// exported so tests can deterministically strip them (`args.slice(GIT_GLOBAL_ARGS.length)`)
// before matching on the actual subcommand:
//   --no-optional-locks -- `git status`/`git diff`/etc. may otherwise refresh and write back the
//     on-disk index as a side effect of an ordinary read (a real filesystem write this read-only
//     compiler must never perform, even incidentally). This flag disables every such optional-lock
//     write path, not merely "status."
//   -c core.fsmonitor= -- neutralizes a repo/global/system config's `core.fsmonitor`, which can
//     otherwise name an ARBITRARY external command Git invokes on ordinary read operations
//     (status, diff, add) regardless of what this compiler itself asked for. Mirrors
//     scripts/dev/publication-builder.mjs's identical fsmonitor-neutralization requirement.
//   --no-replace-objects -- ignores repository `refs/replace/*` object replacement, so commit/tree
//     traversal (merge-base, rev-list, diff) observes the actual object graph, not a substituted
//     one a replace ref could redirect it to.
export const GIT_GLOBAL_ARGS = ["--no-optional-locks", "--no-replace-objects", "-c", "core.fsmonitor="];

// Extra flags for the one call whose output could otherwise be influenced by a configured/
// inherited external diff driver. `-c diff.external=` is a top-level Git option and must precede
// the subcommand name; `--no-ext-diff` is `git diff`'s own flag and must follow it. Together they
// neutralize `diff.external`/a per-path `diff=` attribute driver, so `changedPaths` is always
// Git's own internal diff, never a substituted external command's output.
const NO_EXTERNAL_DIFF_GLOBAL_ARGS = ["-c", "diff.external="];
const NO_EXTERNAL_DIFF_SUBCOMMAND_ARGS = ["--no-ext-diff"];

// The child environment is an EXPLICIT ALLOWLIST, not `{...process.env}` with keys removed:
// starting from an empty object and copying in only the few non-`GIT_*` variables Git/Node's own
// subprocess machinery needs to function at all (PATH to locate the `git` executable; HOME/
// USERPROFILE and the XDG dirs because Git itself may consult them even with system/global config
// disabled below; SYSTEMROOT/circumstantial Windows variables for correctness on that platform;
// TMPDIR/TEMP/TMP since Git can use a temp directory for some internal operations). No other
// inherited variable -- including any GIT_* one -- ever reaches the child. On top of the allowlist,
// a fixed set of safe/deterministic values is always force-set, overriding whatever the allowlisted
// passthrough variables might otherwise have implied:
//   GIT_OPTIONAL_LOCKS=0     -- environment-level backstop for the --no-optional-locks argv flag.
//   GIT_TERMINAL_PROMPT=0    -- never allow an interactive credential/host-key prompt to hang.
//   GIT_LITERAL_PATHSPECS=1  -- pathspec arguments (e.g. a source's relative path) are never
//                               glob-magic-interpreted.
//   GIT_NO_REPLACE_OBJECTS=1 -- environment-level backstop for --no-replace-objects.
//   GIT_CONFIG_NOSYSTEM=1    -- system-wide gitconfig never read.
//   GIT_CONFIG_GLOBAL=<null device> -- the user's own global gitconfig never read either (this
//                               compiler never needs identity/alias/credential config for anything
//                               it does, and a global config is exactly where an unrelated
//                               `core.fsmonitor`/`diff.external`/similar could otherwise still hide
//                               even with this call's own `-c core.fsmonitor=` override, which only
//                               applies to config Git would otherwise read from -- combining both is
//                               what makes the fsmonitor neutralization complete).
//   GIT_ATTR_NOSYSTEM=1      -- system-wide gitattributes never read.
//   GIT_PAGER=cat            -- no interactive pager can ever intercept output.
//   LC_ALL=C / LANG=C        -- deterministic, locale-independent Git message/formatting output.
//
// Documented residual limitation: `PATH` itself is still allowlisted through, because
// `execFileSync("git", ...)` (shell:false) resolves the executable via a PATH search and Node has
// no built-in "resolve to an absolute path first" primitive; a hostile PATH entry earlier than the
// real `git` binary is not defended against by this function. This is the same bare-command
// invocation pattern already used by every other Git-invoking script in this repository
// (scripts/dev/publication-builder.mjs, scripts/dev/project-consistency.mjs,
// scripts/dev/project-context.mjs) -- none of them pin an absolute binary path either. Closing it
// for this one compiler alone, without a repository-wide policy change, would be a false sense of
// security rather than an actual boundary; the realistic threat model here (a trusted local
// developer machine or CI runner that already controls its own PATH) is the same one every other
// script in this repository already relies on.
function buildHardenedGitEnv() {
  const passthroughKeys = [
    "PATH",
    "HOME",
    "USERPROFILE",
    "XDG_CONFIG_HOME",
    "XDG_CACHE_HOME",
    "SYSTEMROOT",
    "SYSTEMDRIVE",
    "TMPDIR",
    "TEMP",
    "TMP",
  ];
  const env = {};
  for (const key of passthroughKeys) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  env.GIT_OPTIONAL_LOCKS = "0";
  env.GIT_TERMINAL_PROMPT = "0";
  env.GIT_LITERAL_PATHSPECS = "1";
  env.GIT_NO_REPLACE_OBJECTS = "1";
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_GLOBAL = process.platform === "win32" ? "NUL" : "/dev/null";
  env.GIT_ATTR_NOSYSTEM = "1";
  env.GIT_PAGER = "cat";
  env.LC_ALL = "C";
  env.LANG = "C";
  return env;
}

// Builds a `tryGit(repoRoot, args)` function bound to a specific execFileSync-compatible
// implementation. The production default (see compileProjectContextPack) always binds the real
// `execFileSync`; tests bind a fake implementation that inspects `args` (after stripping
// GIT_GLOBAL_ARGS) and throws for an exact subcommand argument array, deterministically simulating
// "this Git query is unavailable" without a shell.
function buildTryGit(execFileSyncImpl) {
  const hardenedEnv = buildHardenedGitEnv();
  return function tryGit(repoRoot, args) {
    try {
      const out = execFileSyncImpl("git", [...GIT_GLOBAL_ARGS, ...args], {
        cwd: repoRoot,
        encoding: "utf8",
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: hardenedEnv,
      });
      // Trim only trailing newline(s) -- NOT a full trim(), which would strip the leading space of
      // `git status --porcelain`'s first line for any entry whose status code starts with a space
      // (e.g. " M path"), corrupting that entry's parsed path.
      return { ok: true, out: String(out).replace(/\r?\n+$/, "") };
    } catch {
      // Deliberately collapses every failure mode (nonzero exit, missing binary, thrown test
      // double) into ok:false/out:null -- never into an empty-string/[] result, so callers can
      // always distinguish "the query legitimately found nothing" from "the query failed."
      return { ok: false, out: null };
    }
  };
}

// Resolves a fully-qualified ref (e.g. "refs/heads/main") via `git for-each-ref`, which -- unlike
// `git rev-parse --verify` -- exits 0 with EMPTY output when the ref legitimately does not exist,
// and only exits non-zero on a genuine query failure. This cleanly distinguishes "the ref is
// absent" (a normal, expected repository state) from "the lookup itself failed" (fail closed),
// which `rev-parse --verify`'s single "non-zero exit" outcome cannot: that command exits non-zero
// for both cases alike. A non-empty result that is NOT exactly one well-formed 40-hex OID line
// (malformed output, or more than one matching ref) is ALSO treated as a lookup failure -- never
// silently read as "the ref doesn't exist" (empty) or accepted as a best-effort first guess.
function resolveRefForEachRef(repoRoot, tryGit, ref) {
  const result = tryGit(repoRoot, ["for-each-ref", "--format=%(objectname)", ref]);
  if (!result.ok) return { failed: true, oid: null };
  if (result.out.length === 0) return { failed: false, oid: null };
  const lines = result.out.split("\n");
  if (lines.length !== 1 || !/^[0-9a-f]{40}$/.test(lines[0])) {
    return { failed: true, oid: null };
  }
  return { failed: false, oid: lines[0] };
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

// --- Path safety: structural (string-only) checks, and the bounded safe-read primitive ---------

// Purely lexical checks on the declared path string -- no filesystem access. Mirrors
// scripts/dev/publication-builder.mjs's isSafeRelativePath pattern.
function classifyPathSafetyStructural(relPathRaw) {
  if (typeof relPathRaw !== "string" || relPathRaw.length === 0) return "UNSAFE_INVALID";
  if (relPathRaw.includes("\0") || relPathRaw.includes("\n")) return "UNSAFE_INVALID";
  if (isAbsolute(relPathRaw) || relPathRaw.startsWith("/") || relPathRaw.includes("\\")) {
    return "UNSAFE_ABSOLUTE_PATH";
  }
  const segments = relPathRaw.split("/");
  if (segments.some((s) => s === ".." || s === "")) return "UNSAFE_TRAVERSAL";
  return "STRUCTURALLY_SAFE";
}

function isUnsafeSafety(safety) {
  return safety !== "SAFE";
}

const NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0;

// The single bounded, read-only primitive every source read in this compiler goes through
// (core authority sources, active-task Required Context entries, and .project/STOP). Returns
// exactly one of:
//   { outcome: "MISSING" }                     -- true ENOENT only
//   { outcome: "UNSAFE", reason: <safety code> } -- anything else that isn't a safe regular file
//   { outcome: "OK", buf: <Buffer> }             -- the exact bytes read from one open fd
//
// Sequence: (1) structural checks on the path string; (2) an initial lstat + realpath containment
// check (rejects an absolute-escaping path via a symlinked ancestor directory); (3) open the path
// with O_NOFOLLOW (rejects a symlink at the FINAL path component -- ELOOP) where the platform
// supports it; (4) fstat the resulting file descriptor and require a regular file; (5) read from
// that SAME descriptor. Steps 3-5 operate on one fd, so the bytes returned are guaranteed to be
// exactly what fstat validated for the final path component -- there is no second, path-based
// re-open that a symlink swap between "check" and "read" could redirect.
//
// Residual limitation (documented, not silently claimed closed): Node's public `fs` module has no
// `openat`-relative-to-a-directory-descriptor API, so step (2)'s realpath containment check and
// step (3)'s open() are still two separate syscalls under the hood -- an ancestor directory
// replaced with a symlink in the narrow window between them is not caught by this function. This
// is a real, acknowledged gap in an adversarial concurrent-attacker model; it is not exploitable by
// the content of any file this compiler reads (which never executes anything), only by what byte
// content ends up hashed/summarized into the pack.
function safeReadSource(repoRoot, relPath) {
  const structural = classifyPathSafetyStructural(relPath);
  if (structural !== "STRUCTURALLY_SAFE") return { outcome: "UNSAFE", reason: structural };

  const repoRootResolved = resolve(repoRoot);
  const abs = resolve(repoRootResolved, relPath);
  const rel = relative(repoRootResolved, abs);
  if (rel === "" || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    return { outcome: "UNSAFE", reason: "UNSAFE_ESCAPES_REPO" };
  }

  let lst;
  try {
    lst = lstatSync(abs);
  } catch (err) {
    if (err && err.code === "ENOENT") return { outcome: "MISSING" };
    return { outcome: "UNSAFE", reason: "UNSAFE_LSTAT_FAILED" };
  }
  if (lst.isSymbolicLink()) return { outcome: "UNSAFE", reason: "UNSAFE_SYMLINK" };
  if (!lst.isFile()) return { outcome: "UNSAFE", reason: "UNSAFE_NOT_REGULAR_FILE" };

  let realAbs;
  let realRepoRoot;
  try {
    realAbs = realpathSync(abs);
    realRepoRoot = realpathSync(repoRootResolved);
  } catch {
    return { outcome: "UNSAFE", reason: "UNSAFE_REALPATH_FAILED" };
  }
  const realRel = relative(realRepoRoot, realAbs);
  if (realRel.startsWith(`..${sep}`) || isAbsolute(realRel)) {
    return { outcome: "UNSAFE", reason: "UNSAFE_SYMLINK" };
  }

  let fd;
  try {
    fd = openSync(abs, fsConstants.O_RDONLY | NOFOLLOW);
  } catch (err) {
    if (err && err.code === "ENOENT") return { outcome: "MISSING" };
    if (err && err.code === "ELOOP") return { outcome: "UNSAFE", reason: "UNSAFE_SYMLINK" };
    return { outcome: "UNSAFE", reason: "UNSAFE_OPEN_FAILED" };
  }
  try {
    const st = fstatSync(fd);
    if (!st.isFile()) return { outcome: "UNSAFE", reason: "UNSAFE_NOT_REGULAR_FILE" };
    const buf = readFileSync(fd);
    return { outcome: "OK", buf };
  } catch {
    return { outcome: "UNSAFE", reason: "UNSAFE_READ_FAILED" };
  } finally {
    try {
      closeSync(fd);
    } catch {
      // Nothing further to do if closing an already-troubled fd itself fails.
    }
  }
}

// --- Source manifest entry compilation ----------------------------------------------------------

// Returns a source manifest entry, plus two internal-only fields stripped before the entry is
// placed in the pack's public `sources` array (see compileProjectContextPack):
//   __textContent  -- the decoded UTF-8 text for present/safe entries, so callers that need to
//                      interpret this source (compileProjectInterpretation/compileActiveTask/
//                      compileReview) reuse the EXACT bytes this entry's own hash was computed
//                      from via safeReadSource's single fd read, instead of an independent second
//                      read that could observe a torn/changed version.
//   __unknownReason -- the specific stable error code compileValidity should raise when
//                      state === "UNKNOWN" (SOURCE_STATE_UNDETERMINABLE for an ls-files/status
//                      query failure, SOURCE_HEAD_BLOB_UNDETERMINABLE when a "clean" claim's Git
//                      blob identity could not be established or did not match).
function compileSourceEntry(repoRoot, relPath, role, required, tryGit) {
  const entry = {
    path: relPath,
    role,
    required,
    present: false,
    safety: "UNSAFE_INVALID",
    byteLength: null,
    workingTreeSha256: null,
    headBlobOid: null,
    state: "UNSAFE",
    __textContent: null,
    __unknownReason: null,
  };

  const read = safeReadSource(repoRoot, relPath);

  if (read.outcome === "UNSAFE") {
    entry.safety = read.reason;
    entry.state = "UNSAFE";
    return entry;
  }

  entry.safety = "SAFE";

  if (read.outcome === "MISSING") {
    entry.present = false;
    entry.state = "MISSING";
    // Still worth knowing whether a now-deleted file was tracked at HEAD -- best-effort only,
    // never required for MISSING classification itself.
    const headBlob = tryGit(repoRoot, ["rev-parse", "--verify", `HEAD:${relPath}`]);
    entry.headBlobOid = headBlob.ok && /^[0-9a-f]{40}$/.test(headBlob.out) ? headBlob.out : null;
    return entry;
  }

  // read.outcome === "OK"
  const buf = read.buf;
  entry.present = true;
  entry.byteLength = buf.length;
  entry.workingTreeSha256 = sha256Hex(buf);
  entry.__textContent = buf.toString("utf8");

  const headBlob = tryGit(repoRoot, ["rev-parse", "--verify", `HEAD:${relPath}`]);
  entry.headBlobOid = headBlob.ok && /^[0-9a-f]{40}$/.test(headBlob.out) ? headBlob.out : null;

  const tracked = tryGit(repoRoot, ["ls-files", "--", relPath]);
  if (!tracked.ok) {
    entry.state = "UNKNOWN";
    entry.__unknownReason = "SOURCE_STATE_UNDETERMINABLE";
    return entry;
  }
  if (tracked.out.length === 0) {
    entry.state = "UNTRACKED";
    return entry;
  }

  const statusForPath = tryGit(repoRoot, ["status", "--porcelain", "--", relPath]);
  if (!statusForPath.ok) {
    entry.state = "UNKNOWN";
    entry.__unknownReason = "SOURCE_STATE_UNDETERMINABLE";
    return entry;
  }
  if (statusForPath.out.length > 0) {
    entry.state = "MODIFIED";
    return entry;
  }

  // Candidate CLEAN: `git status` sees no diff. Before trusting that claim, independently bind it
  // to the exact bytes already read -- fail closed (state UNKNOWN) if the HEAD blob identity
  // cannot be established at all, or if it disagrees with the blob hash computed directly from
  // those bytes (Finding 4's clean-source/HEAD-blob binding).
  if (!entry.headBlobOid) {
    entry.state = "UNKNOWN";
    entry.__unknownReason = "SOURCE_HEAD_BLOB_UNDETERMINABLE";
    return entry;
  }
  const localBlobSha1 = gitBlobSha1Hex(buf);
  if (localBlobSha1 !== entry.headBlobOid) {
    entry.state = "UNKNOWN";
    entry.__unknownReason = "SOURCE_HEAD_BLOB_UNDETERMINABLE";
    return entry;
  }

  entry.state = "CLEAN";
  return entry;
}

// --- .project/STOP -----------------------------------------------------------------------------

// Uses the same bounded safe-read primitive as every other source -- so a dangling symlink,
// symlink-to-existing-target, directory, or unreadable node at .project/STOP is never silently
// treated as "absent" (which existsSync-based presence checks conflate with ENOENT). Only a true
// ENOENT is `present:false`; every other non-regular-file/unreadable outcome is `present:true`
// with a null hash and a stable validity error (see compileValidity's STOP_NODE_UNSAFE).
function compileStop(repoRoot) {
  const read = safeReadSource(repoRoot, ".project/STOP");
  if (read.outcome === "MISSING") return { present: false, sha256: null, unsafeReason: null };
  if (read.outcome === "UNSAFE") return { present: true, sha256: null, unsafeReason: read.reason };
  return { present: true, sha256: sha256Hex(read.buf), unsafeReason: null };
}

// --- Repository snapshot -------------------------------------------------------------------------

// Observes the three cheapest, most change-sensitive facts (branch/detached state, HEAD OID, and
// normalized working-tree status) -- used both for the main repository snapshot and, unchanged,
// for the start/end consistency fence in compileProjectContextPack. `ok:false` on any
// sub-observation is treated as "changed" by the fence (see REPOSITORY_CHANGED_DURING_COMPILATION),
// never as a silent match. Branch is included specifically because a checkout/detach/re-attach that
// leaves HEAD pointed at the same commit (e.g. `git symbolic-ref HEAD refs/heads/other` onto an
// identical commit, or a detach-then-reattach) would otherwise be invisible to a HEAD-only fence.
function observeGitState(repoRoot, tryGit) {
  const branchResult = tryGit(repoRoot, ["branch", "--show-current"]);
  const headResult = tryGit(repoRoot, ["rev-parse", "HEAD"]);
  const statusResult = tryGit(repoRoot, ["status", "--porcelain"]);
  const headOk = headResult.ok && /^[0-9a-f]{40}$/.test(headResult.out);
  return {
    branchOk: branchResult.ok,
    branchState: branchResult.ok ? branchResult.out : null, // "" means detached, non-empty is the branch name
    headOk,
    head: headOk ? headResult.out : null,
    statusOk: statusResult.ok,
    // Sorted so two logically-identical status snapshots always compare equal even if Git ever
    // changed its own internal ordering between the two observations.
    normalizedStatus: statusResult.ok
      ? statusResult.out.split("\n").filter(Boolean).sort().join("\n")
      : null,
  };
}

// A query that failed on EITHER observation -- even if it also failed identically on the other --
// is treated as "changed" (fail closed), never as "the two observations agree." Two observations
// only ever compare equal when EVERY sub-query succeeded on both sides and produced the same
// values -- a repeated failure is unresolved, not confirmed-unchanged, and must not be silently
// waved through.
function gitStateEqual(a, b) {
  if (!a.branchOk || !b.branchOk || !a.headOk || !b.headOk || !a.statusOk || !b.statusOk) return false;
  return a.branchState === b.branchState && a.head === b.head && a.normalizedStatus === b.normalizedStatus;
}

function compileRepositorySnapshot(repoRoot, tryGit, errors) {
  const branchResult = tryGit(repoRoot, ["branch", "--show-current"]);
  const headResult = tryGit(repoRoot, ["rev-parse", "HEAD"]);

  if (!branchResult.ok) {
    errors.push({
      code: "BRANCH_STATE_UNAVAILABLE",
      message: "git branch --show-current failed unexpectedly -- branch/detached state could not be determined.",
    });
  }

  const headOk = headResult.ok && /^[0-9a-f]{40}$/.test(headResult.out);
  const head = headOk ? headResult.out : null;

  const branchOk = branchResult.ok;
  const detached = branchOk && branchResult.out === "";
  const branch = branchOk && branchResult.out !== "" ? branchResult.out : null;

  // Uses `for-each-ref`, not `rev-parse --verify` -- see resolveRefForEachRef's own comment for
  // why: it distinguishes "this ref legitimately does not exist" (ok, empty result -- fall back or
  // report no baseline) from "the lookup itself failed" (fail closed with a dedicated error),
  // which `rev-parse --verify`'s single non-zero-exit outcome cannot.
  let baselineRef = null;
  let baselineOid = null;
  const localMain = resolveRefForEachRef(repoRoot, tryGit, "refs/heads/main");
  if (localMain.failed) {
    errors.push({
      code: "BASELINE_REF_LOOKUP_UNAVAILABLE",
      message: "Looking up refs/heads/main failed unexpectedly (distinct from it legitimately not existing).",
    });
  } else if (localMain.oid) {
    baselineRef = "main";
    baselineOid = localMain.oid;
  } else {
    const originMain = resolveRefForEachRef(repoRoot, tryGit, "refs/remotes/origin/main");
    if (originMain.failed) {
      errors.push({
        code: "BASELINE_REF_LOOKUP_UNAVAILABLE",
        message: "Looking up refs/remotes/origin/main failed unexpectedly (distinct from it legitimately not existing).",
      });
    } else if (originMain.oid) {
      baselineRef = "origin/main";
      baselineOid = originMain.oid;
    }
  }

  let mergeBase = null;
  let ahead = null;
  let behind = null;
  let changedPaths = [];

  if (head && baselineOid) {
    const mb = tryGit(repoRoot, ["merge-base", "HEAD", baselineOid]);
    if (!mb.ok || !/^[0-9a-f]{40}$/.test(mb.out)) {
      errors.push({
        code: "MERGE_BASE_UNAVAILABLE",
        message: "git merge-base failed unexpectedly even though HEAD and a baseline are both resolvable.",
      });
    } else {
      mergeBase = mb.out;
    }

    const counts = tryGit(repoRoot, ["rev-list", "--left-right", "--count", `${baselineOid}...HEAD`]);
    const parts = counts.ok ? counts.out.split(/\s+/).filter(Boolean) : [];
    if (!counts.ok || parts.length !== 2 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) {
      errors.push({
        code: "HISTORY_COUNTS_UNAVAILABLE",
        message: "git rev-list --left-right --count failed or returned an unparseable result.",
      });
    } else {
      behind = Number(parts[0]);
      ahead = Number(parts[1]);
    }

    const diffNames = tryGit(repoRoot, [
      ...NO_EXTERNAL_DIFF_GLOBAL_ARGS,
      "diff",
      ...NO_EXTERNAL_DIFF_SUBCOMMAND_ARGS,
      "--name-only",
      `${baselineOid}...HEAD`,
    ]);
    if (!diffNames.ok) {
      errors.push({
        code: "CHANGED_PATHS_UNAVAILABLE",
        message: "git diff --name-only failed unexpectedly even though HEAD and a baseline are both resolvable.",
      });
    } else if (diffNames.out.length > 0) {
      changedPaths = sortUnique(diffNames.out.split("\n").filter(Boolean));
    }
  }

  const statusResult = tryGit(repoRoot, ["status", "--porcelain"]);
  const rawEntries = statusResult.ok && statusResult.out.length > 0 ? statusResult.out.split("\n").filter(Boolean) : [];
  const entries = rawEntries
    .map((line) => ({ status: line.slice(0, 2), path: line.slice(3) }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  // Fail closed rather than silently reporting "clean" when the status query itself failed --
  // see the WORKING_TREE_STATUS_UNAVAILABLE error pushed below.
  const clean = statusResult.ok && entries.length === 0;
  if (!statusResult.ok) {
    errors.push({
      code: "WORKING_TREE_STATUS_UNAVAILABLE",
      message: "git status --porcelain failed unexpectedly -- working-tree cleanliness could not be determined.",
    });
  }

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

function compileProjectInterpretation(sourcesByPath) {
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

function compileActiveTask(branch, detached, sourcesByPath, warnings) {
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

function compileReview(branch, activeTask, sourcesByPath) {
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
  internalSources,
  requiredContextEntries,
  repositoryChangedDuringCompilation,
  repositoryErrors,
}) {
  const errors = [...repositoryErrors];
  const warnings = [];

  if (!repository.head) {
    errors.push({ code: "HEAD_UNRESOLVABLE", message: "git rev-parse HEAD did not resolve to a 40-hex commit OID." });
  }

  for (const src of internalSources) {
    if (src.required && isUnsafeSafety(src.safety)) {
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
    if (src.state === "UNKNOWN" && src.__unknownReason) {
      errors.push({
        code: src.__unknownReason,
        message: `Could not determine a trustworthy state for "${src.path}" (${src.__unknownReason}).`,
        path: src.path,
      });
    }
  }

  for (const rc of requiredContextEntries) {
    if (isUnsafeSafety(rc.safety)) {
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
    if (stop.unsafeReason) {
      errors.push({
        code: "STOP_NODE_UNSAFE",
        message: `.project/STOP is present but is not a safe regular file (${stop.unsafeReason}) -- treated as blocking regardless.`,
      });
    }
  }

  if (!activeTask.active) {
    warnings.push({
      code: "NO_ACTIVE_TASK",
      message: "No task is active for the current branch (detached HEAD, no CURRENT_TASK.md, or a branch mismatch) -- nothing is authorized to execute here.",
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

  if (repositoryChangedDuringCompilation) {
    errors.push({
      code: "REPOSITORY_CHANGED_DURING_COMPILATION",
      message:
        "Branch/detached state, HEAD, or the working tree changed between the start and end of " +
        "compilation -- this is a consistency fence that detects an observed change, not a " +
        "filesystem transaction/lock.",
    });
  }

  const hasUnknownSource = internalSources.some((s) => s.state === "UNKNOWN");

  const valid = errors.length === 0;
  const executionEligible =
    valid &&
    Boolean(repository.head) &&
    Boolean(repository.baseline.oid) &&
    Boolean(repository.mergeBase) &&
    repository.ahead !== null &&
    repository.behind !== null &&
    repository.workingTree.clean &&
    !repository.workingTreeStatusUnavailable &&
    !stop.present &&
    !contradictory &&
    activeTask.active &&
    !hasUnknownSource &&
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

function attachContextHash(packWithoutContextHash) {
  return { ...packWithoutContextHash, contextHash: computeContextHash(packWithoutContextHash) };
}

// Diagnostics only -- NEVER written into the pack itself (see the degraded-pack contract above).
function logInternalError(detail) {
  process.stderr.write(`project-context-pack: internal error: ${detail}\n`);
}

// --- Degraded fallback pack ------------------------------------------------------------------------
//
// Used whenever compilation cannot proceed safely: the repository root does not exist, an
// unexpected internal exception was thrown, or (defensively) the normally-compiled pack somehow
// failed its own schema self-validation. Deliberately built WITHOUT going through the normal
// schema-validating finalize path (finalizePack) -- a degraded pack must be correct by
// construction and must never recursively risk the same failure it exists to recover from. Fully
// static and deterministic: no caller-supplied text (including an absolute --repo path) and no
// raw exception message is ever included -- only a fixed, stable code/message pair. Exception
// detail goes to stderr via logInternalError, never into the returned object.
function buildDegradedPack() {
  const body = {
    $schema: SCHEMA_URI,
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
      workingTreeStatusUnavailable: true,
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
      errors: [
        {
          code: "INTERNAL_COMPILATION_ERROR",
          message: "Pack compilation failed and a safe degraded snapshot was returned instead. See stderr for diagnostic detail.",
        },
      ],
      warnings: [],
    },
  };
  return attachContextHash(body);
}

// Finalizes a normally-compiled pack: attaches contextHash, then self-validates against the
// pack's own JSON Schema as a defensive integrity check before returning. On the (expected-never)
// event that self-validation fails, this does NOT throw or recurse into itself -- it logs the
// detail to stderr and returns the static degraded pack instead, same as any other internal
// failure (see compileProjectContextPack's catch block for the other route to buildDegradedPack).
function finalizePack(packWithoutContextHash) {
  const pack = attachContextHash(packWithoutContextHash);
  const validate = getValidator();
  if (!validate(pack)) {
    const detail = (validate.errors || []).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ");
    logInternalError(`compiled pack failed self-validation against its own schema: ${detail}`);
    return buildDegradedPack();
  }
  return pack;
}

// --- Public compiler API ----------------------------------------------------------------------------

export function compileProjectContextPack(repoRoot, options = {}) {
  try {
    // Test-only seam: deterministically exercises the "unexpected internal exception" degraded-
    // pack path without needing to actually corrupt filesystem/Git state. Never set in production.
    if (options.__forceInternalErrorForTest) {
      throw new Error("forced internal error (test-only seam)");
    }

    if (!existsSync(repoRoot)) {
      // Deliberately does not include the caller-supplied path itself anywhere in the emitted
      // pack -- an operator-supplied --repo value could be an arbitrary local path (e.g. under a
      // home or temp directory) that PROJECT_CONTINUITY.md's privacy rules say this artifact must
      // not echo. See buildDegradedPack's own fixed, stable code/message.
      return buildDegradedPack();
    }

    const tryGit = buildTryGit(options.execFileSyncImpl ?? execFileSync);

    // Start-of-compilation observation for the bounded consistency fence (Finding 4). This is a
    // change-detection fence, not a filesystem transaction/lock -- see this file's header comment
    // and PROJECT_CONTINUITY.md for the honest scope of what it does and does not guarantee.
    const startState = observeGitState(repoRoot, tryGit);

    const repositoryErrors = [];
    const repository = compileRepositorySnapshot(repoRoot, tryGit, repositoryErrors);

    const coreEntries = CORE_SOURCES.map((p) => compileSourceEntry(repoRoot, p, "CORE_AUTHORITY", true, tryGit));
    const sourcesByPath = new Map(coreEntries.map((e) => [e.path, e]));

    const warnings = [];
    const activeTask = compileActiveTask(repository.branch, repository.detached, sourcesByPath, warnings);
    const review = compileReview(repository.branch, activeTask, sourcesByPath);

    const requiredContextEntries = activeTask.requiredContext.map((p) =>
      compileSourceEntry(repoRoot, p, "TASK_REQUIRED_CONTEXT", true, tryGit)
    );
    for (const rc of requiredContextEntries) {
      if (!sourcesByPath.has(rc.path)) sourcesByPath.set(rc.path, rc);
    }

    const stop = compileStop(repoRoot);

    const project = compileProjectInterpretation(sourcesByPath);

    const internalSources = Array.from(sourcesByPath.values()).sort((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0
    );
    const sources = internalSources.map(({ __textContent, __unknownReason, ...publicFields }) => publicFields);

    // End-of-compilation observation, compared against the start-of-compilation one. Any
    // discrepancy -- including one side's query failing while the other succeeded -- is treated
    // as "changed" (fail closed), never silently ignored.
    const endState = observeGitState(repoRoot, tryGit);
    const repositoryChangedDuringCompilation = !gitStateEqual(startState, endState);

    const validity = compileValidity({
      repository,
      activeTask,
      review,
      stop,
      internalSources,
      requiredContextEntries,
      repositoryChangedDuringCompilation,
      repositoryErrors,
    });
    validity.warnings = [...warnings, ...validity.warnings].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
    validity.errors = [...validity.errors].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

    repository.executionBlocked = !validity.executionEligible;

    const packWithoutContextHash = {
      $schema: SCHEMA_URI,
      kind: "ProjectContextPack",
      schemaVersion: SCHEMA_VERSION,
      compiler: { name: COMPILER_NAME, version: COMPILER_VERSION },
      repository,
      project,
      activeTask,
      review,
      stop: { present: stop.present, sha256: stop.sha256 },
      sources,
      validity,
    };

    return finalizePack(packWithoutContextHash);
  } catch (err) {
    logInternalError(err && err.stack ? err.stack : String(err));
    return buildDegradedPack();
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
