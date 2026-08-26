#!/usr/bin/env node
// MIHVER Deterministic Local Publication Builder (V3.1-A).
//
// Repository-owned, non-LLM, network-free code that turns a Claude-authored PublicationEnvelope
// (schemas/dev/publication-envelope.schema.json) into exactly one local git commit on an already
// checked-out task branch, and returns a PublicationReceipt (schemas/dev/publication-receipt.schema.json).
//
// This module NEVER pushes, NEVER calls an authenticated GitHub API, NEVER creates/modifies/merges
// a PR, NEVER reads GitHub credentials, and NEVER invokes `gh auth token` or switches identity. Those
// remote effects belong only to the future privileged Publication Broker (V3.1-B), which this task
// does not implement -- see docs/development/CODEX_ROLES.md's "Future Publication Broker Interface".
//
// Every git invocation below uses execFileSync with an explicit argument array (no shell, no string
// interpolation) so no path or message value is ever concatenated into a shell command line.
//
// Hook isolation: every git invocation buildLocalCommit makes -- not just the commit itself -- runs
// under `-c core.hooksPath=<fresh empty dir>` (a dir this process creates and destroys per
// invocation) plus `-c core.fsmonitor=` and, for the commit specifically, --no-verify/--no-gpg-sign.
// --no-verify alone is NOT sufficient (it only skips pre-commit/commit-msg, not prepare-commit-msg or
// post-commit), and hooksPath alone is NOT sufficient either: `core.fsmonitor` can independently name
// an arbitrary repo/user-controlled command that Git invokes on ordinary read/index operations
// (status, add, diff, reset, commit) regardless of hooksPath, so it must be neutralized on every call
// this module makes, not only on the final commit.
//
// Content-filter fail-closed model: `git hash-object <path>` (no flags) and `git add` both silently
// run any .gitattributes-configured clean filter -- an arbitrary external command -- and can rewrite
// bytes via text/eol/working-tree-encoding/ident/core.autocrlf normalization even without a filter=
// attribute. This builder therefore (a) mechanically inspects filter/text/eol/working-tree-encoding/
// ident via `git check-attr` for every PRESENT file and BLOCKS on any explicit (non-"unspecified")
// value before touching that file's bytes at all -- no external filter command is ever invoked by
// this module; (b) stages with `-c core.autocrlf=false` so a repo/global autocrlf setting cannot
// normalize line endings during `git add`; (c) always computes content digests with
// `git hash-object --no-filters`, which reads raw bytes only; and (d) after staging, independently
// re-reads each staged index blob SHA and requires it to exactly equal the raw-worktree blob SHA,
// unstaging everything and reporting BLOCKED on any mismatch. This is a narrow, mechanical
// byte-identity proof, not a general filter-aware publication engine.

import { lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROTOCOL_VERSION = '1.0.0';

// When `options.hooksDir` is set (buildLocalCommit sets it for its entire run, not just the commit
// call), every invocation is prefixed with the hook/fsmonitor-neutralizing `-c` overrides -- callers
// never need to remember to add them per call.
function git(repoRoot, args, options = {}) {
  const exec = options.execFileSyncImpl ?? execFileSync;
  const configArgs = options.hooksDir
    ? ['-c', `core.hooksPath=${options.hooksDir}`, '-c', 'core.fsmonitor=']
    : [];
  return exec('git', [...configArgs, ...args], { cwd: repoRoot, encoding: 'utf8', shell: false, ...options.execOptions }).toString();
}

function tryGit(repoRoot, args, options = {}) {
  try {
    return { ok: true, stdout: git(repoRoot, args, options) };
  } catch (error) {
    return { ok: false, error };
  }
}

function blocked(reason, extra = {}) {
  return { status: 'BLOCKED', reason, ...extra };
}

// --- Envelope structural validation (mirrors schemas/dev/publication-envelope.schema.json) -----

const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;

// Deliberately hand-rolled rather than depending on ajv at runtime, matching this repository's
// existing "Node built-ins only" convention for deterministic dev scripts (see
// scripts/dev/project-consistency.mjs). Checks only what preflight itself relies on structurally
// being present and well-shaped before it starts reading the repository -- the JSON Schema remains
// the authoritative machine-readable contract for external producers/consumers of an Envelope.
export function validateEnvelopeShape(envelope) {
  const errors = [];
  const fail = (msg) => errors.push(msg);
  if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return { ok: false, errors: ['envelope must be a JSON object'] };
  }
  if (envelope.protocol_version !== '1.0.0') fail('protocol_version must be "1.0.0"');
  const repo = envelope.repository;
  if (!repo || typeof repo !== 'object' || typeof repo.remote_name !== 'string' || repo.remote_name.length === 0
    || typeof repo.owner !== 'string' || repo.owner.length === 0
    || typeof repo.name !== 'string' || repo.name.length === 0) {
    fail('repository must be { remote_name, owner, name } (non-empty strings)');
  }
  if (typeof envelope.branch !== 'string' || envelope.branch.length === 0) fail('branch must be a non-empty string');
  else if (envelope.branch === 'main' || envelope.branch === 'master') fail('branch must not be main/master');
  if (typeof envelope.base_branch !== 'string' || envelope.base_branch.length === 0) fail('base_branch must be a non-empty string');
  if (typeof envelope.base_commit !== 'string' || !HEX40.test(envelope.base_commit)) fail('base_commit must be a 40-hex SHA');
  if (typeof envelope.expected_pre_publish_head !== 'string' || !HEX40.test(envelope.expected_pre_publish_head)) {
    fail('expected_pre_publish_head must be a 40-hex SHA');
  }
  if (!Array.isArray(envelope.allowed_files) || envelope.allowed_files.length === 0) {
    fail('allowed_files must be a non-empty array');
  } else {
    for (const [i, entry] of envelope.allowed_files.entries()) {
      if (!entry || typeof entry !== 'object' || typeof entry.path !== 'string' || entry.path.length === 0) {
        fail(`allowed_files[${i}].path must be a non-empty string`);
      }
      if (entry?.action !== 'present' && entry?.action !== 'deletion') {
        fail(`allowed_files[${i}].action must be "present" or "deletion"`);
      }
    }
  }
  if (typeof envelope.publication_fingerprint !== 'string' || !HEX64.test(envelope.publication_fingerprint)) {
    fail('publication_fingerprint must be a 64-hex SHA-256 digest');
  }
  if (typeof envelope.commit_message !== 'string' || envelope.commit_message.length === 0) fail('commit_message must be a non-empty string');
  if (typeof envelope.pr_expected !== 'boolean') fail('pr_expected must be a boolean');
  else if (envelope.pr_expected === true) {
    if (typeof envelope.pr_title !== 'string' || envelope.pr_title.length === 0) fail('pr_title is required when pr_expected is true');
    if (typeof envelope.pr_body !== 'string') fail('pr_body is required when pr_expected is true');
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// --- Repository identity ----------------------------------------------------------------------

// Recognizes only the two conventional GitHub remote URL shapes; anything else is unparseable and
// therefore never matches an Envelope's declared identity (fail closed).
export function parseGitHubRemote(url) {
  const trimmed = String(url ?? '').trim();
  const httpsMatch = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  const match = httpsMatch ?? sshMatch;
  if (!match) return null;
  return { owner: match[1], name: match[2] };
}

export function readRepositoryIdentity(repoRoot, remoteName, options = {}) {
  const result = tryGit(repoRoot, ['remote', 'get-url', remoteName], options);
  if (!result.ok) return null;
  const parsed = parseGitHubRemote(result.stdout.trim());
  if (!parsed) return null;
  return { remote_name: remoteName, ...parsed };
}

// --- Repo root / branch / HEAD / ancestry guards ----------------------------------------------

export function verifyRepoRoot(repoRoot, options = {}) {
  let expected;
  try {
    expected = realpathSync(resolve(repoRoot));
  } catch {
    return blocked('NOT_A_GIT_REPOSITORY');
  }
  const result = tryGit(repoRoot, ['rev-parse', '--show-toplevel'], options);
  if (!result.ok) return blocked('NOT_A_GIT_REPOSITORY');
  const actual = resolve(result.stdout.trim());
  if (actual !== expected) return blocked('REPO_ROOT_MISMATCH', { expected, actual });
  return { status: 'OK' };
}

export function verifyCurrentBranch(repoRoot, expectedBranch, options = {}) {
  if (expectedBranch === 'main' || expectedBranch === 'master') {
    return blocked('MAIN_BRANCH_FORBIDDEN', { branch: expectedBranch });
  }
  const result = tryGit(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD'], options);
  if (!result.ok) return blocked('BRANCH_UNREADABLE');
  const actual = result.stdout.trim();
  if (actual === 'HEAD') return blocked('DETACHED_HEAD');
  if (actual !== expectedBranch) return blocked('WRONG_BRANCH', { expected: expectedBranch, actual });
  return { status: 'OK' };
}

export function verifyPrePublishHead(repoRoot, expectedHead, options = {}) {
  const result = tryGit(repoRoot, ['rev-parse', 'HEAD'], options);
  if (!result.ok) return blocked('HEAD_UNREADABLE');
  const actual = result.stdout.trim();
  if (actual !== expectedHead) return blocked('PRE_PUBLISH_HEAD_MISMATCH', { expected: expectedHead, actual });
  return { status: 'OK', head: actual };
}

export function verifyBaseAncestry(repoRoot, baseCommit, options = {}) {
  const result = tryGit(repoRoot, ['merge-base', '--is-ancestor', baseCommit, 'HEAD'], options);
  if (!result.ok) return blocked('BASE_COMMIT_NOT_ANCESTOR', { base_commit: baseCommit });
  return { status: 'OK' };
}

export function verifyRemoteIdentity(repoRoot, expectedRepository, options = {}) {
  const actual = readRepositoryIdentity(repoRoot, expectedRepository.remote_name, options);
  if (!actual) return blocked('REMOTE_IDENTITY_UNREADABLE', { remote_name: expectedRepository.remote_name });
  if (actual.owner !== expectedRepository.owner || actual.name !== expectedRepository.name) {
    return blocked('REMOTE_IDENTITY_MISMATCH', { expected: expectedRepository, actual });
  }
  return { status: 'OK' };
}

// --- File classification (shape A / shape B / malformed) ---------------------------------------

// Repo-relative, forward-slash only, no leading slash, no '..' segment, no NUL/newline, and must
// resolve inside repoRoot after normalization -- this is the traversal guard.
function isSafeRelativePath(path) {
  if (typeof path !== 'string' || path.length === 0) return false;
  if (path.includes('\0') || path.includes('\n')) return false;
  if (isAbsolute(path)) return false;
  if (path.startsWith('/') || path.includes('\\')) return false;
  const segments = path.split('/');
  if (segments.some((s) => s === '..' || s === '')) return false;
  return true;
}

function resolvesInsideRepo(repoRoot, path) {
  const abs = resolve(repoRoot, path);
  const rel = relative(resolve(repoRoot), abs);
  return rel !== '' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

// Classifies one Allowed-file entry against the current working tree and the Envelope's
// `expected_pre_publish_head`. Returns { shape: 'A' | 'B', path } or { malformed: true, reason, path }.
// Never throws -- every failure mode is a returned malformed classification (fail closed).
export function classifyEntry(repoRoot, entry, expectedPreHead, options = {}) {
  const path = entry?.path;
  const action = entry?.action;
  if (!isSafeRelativePath(path)) return { malformed: true, reason: 'UNSAFE_PATH', path };
  if (!resolvesInsideRepo(repoRoot, path)) return { malformed: true, reason: 'PATH_ESCAPES_REPO', path };
  if (action !== 'present' && action !== 'deletion') return { malformed: true, reason: 'UNKNOWN_ACTION', path };

  const abs = join(repoRoot, path);
  let onDiskStat = null;
  try {
    onDiskStat = lstatSync(abs);
  } catch {
    onDiskStat = null;
  }

  if (onDiskStat) {
    if (onDiskStat.isSymbolicLink()) return { malformed: true, reason: 'SYMLINK_NOT_ALLOWED', path };
    if (onDiskStat.isDirectory()) return { malformed: true, reason: 'DIRECTORY_NOT_ALLOWED', path };
    if (!onDiskStat.isFile()) return { malformed: true, reason: 'SPECIAL_FILE_NOT_ALLOWED', path };
    if (action !== 'present') return { malformed: true, reason: 'DECLARED_DELETION_BUT_PRESENT', path };
    return { shape: 'A', path };
  }

  // Absent from the working tree: only a legitimate shape (B) authorized deletion if it was a
  // tracked *regular file* (mode 100644/100755) at expected_pre_publish_head -- never a directory
  // (040000), symlink (120000), or submodule (160000).
  if (action !== 'deletion') return { malformed: true, reason: 'DECLARED_PRESENT_BUT_ABSENT', path };
  const lsTree = tryGit(repoRoot, ['ls-tree', expectedPreHead, '--', path], options);
  const lines = lsTree.ok ? lsTree.stdout.split('\n').filter(Boolean) : [];
  if (lines.length !== 1) return { malformed: true, reason: 'DELETION_NOT_TRACKED_AT_PRE_PUBLISH_HEAD', path };
  const mode = lines[0].split(/\s+/)[0];
  if (mode !== '100644' && mode !== '100755') {
    return { malformed: true, reason: 'DELETION_NOT_A_REGULAR_FILE', path, mode };
  }
  return { shape: 'B', path };
}

// Classifies every entry, additionally rejecting duplicate paths. Returns
// { ok: true, classified } or { ok: false, malformed: [...] }.
export function classifyAllowedFiles(repoRoot, allowedFiles, expectedPreHead, options = {}) {
  const seen = new Set();
  const duplicates = new Set();
  for (const entry of allowedFiles) {
    if (typeof entry?.path === 'string') {
      if (seen.has(entry.path)) duplicates.add(entry.path);
      seen.add(entry.path);
    }
  }
  const classified = allowedFiles.map((entry) => classifyEntry(repoRoot, entry, expectedPreHead, options));
  const malformed = classified.filter((c) => c.malformed || duplicates.has(c.path));
  for (const path of duplicates) {
    if (!malformed.some((m) => m.path === path && m.reason === 'DUPLICATE_PATH')) {
      malformed.push({ malformed: true, reason: 'DUPLICATE_PATH', path });
    }
  }
  if (malformed.length > 0) return { ok: false, malformed };
  return { ok: true, classified };
}

// --- Content-transform attribute guard (must run before any content is read/staged) -------------

const GUARDED_ATTRIBUTES = ['filter', 'text', 'eol', 'working-tree-encoding', 'ident'];

// One attribute per invocation keeps output parsing trivial and unambiguous ("path: attr: value"),
// at the cost of `GUARDED_ATTRIBUTES.length` extra process spawns per file -- an acceptable trade for
// a mechanical, easy-to-audit check. Never invokes anything that would run a clean/smudge filter.
function checkAttrValue(repoRoot, path, attribute, options) {
  const result = tryGit(repoRoot, ['check-attr', attribute, '--', path], options);
  if (!result.ok) return null;
  const line = result.stdout.trim();
  const marker = `: ${attribute}: `;
  const idx = line.lastIndexOf(marker);
  if (idx === -1) return null;
  return line.slice(idx + marker.length);
}

// Rejects ANY explicit (non-"unspecified") filter/text/eol/working-tree-encoding/ident attribute on
// a PRESENT file, rather than trying to classify which explicit values are "safe" -- an explicit
// `filter=` attribute names an external command this module must never execute, and explicit
// text/eol/working-tree-encoding/ident values can each rewrite bytes between worktree and index.
// Deliberately does not special-case explicit "unset" (e.g. `-text`): fail-closed on any explicit
// mention rather than building a general filter-aware engine. Deletions (shape B) have no content to
// inspect and are skipped.
export function verifyNoContentTransform(repoRoot, classifiedEntries, options = {}) {
  for (const entry of classifiedEntries) {
    if (entry.shape !== 'A') continue;
    for (const attribute of GUARDED_ATTRIBUTES) {
      const value = checkAttrValue(repoRoot, entry.path, attribute, options);
      if (value === null) return blocked('ATTRIBUTE_UNREADABLE', { path: entry.path, attribute });
      if (value !== 'unspecified') {
        return blocked('CONTENT_TRANSFORM_ATTRIBUTE_BLOCKED', { path: entry.path, attribute, value });
      }
    }
  }
  return { status: 'OK' };
}

// --- Fingerprint (must match AGENT_POLICY.md's canonical recipe exactly) -----------------------

// True UTF-8 byte-order sort (matching `LC_ALL=C sort` over the paths' UTF-8 encoding), NOT
// JavaScript's default `<`/`>` string comparison -- that compares UTF-16 *code units*, which
// disagrees with UTF-8 byte order for any path containing a character above U+FFFF (e.g. U+10000):
// its UTF-16 form starts with a surrogate code unit (0xD800) that sorts below U+E000's single code
// unit (0xE000), while its UTF-8 byte encoding (starting 0xF0) sorts above U+E000's (starting
// 0xEE). `Buffer.compare` on each path's UTF-8 bytes is the actual canonical ordering the
// Publication Protocol owns.
function byteSort(paths) {
  return [...paths].sort((a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')));
}

// `--no-filters` is required, not cosmetic: plain `git hash-object <path>` silently runs the same
// clean filter / autocrlf normalization as `git add`, so without this flag the "fingerprint" would
// bind filtered bytes (and could itself execute an external filter command) rather than the raw
// worktree bytes it claims to bind.
function rawBlobSha(repoRoot, path, options) {
  return git(repoRoot, ['hash-object', '--no-filters', '--', path], options).trim();
}

// Shared canonical recipe (byte-sorted path + NUL + digest + newline, SHA-256) parameterized only
// by how each PRESENT entry's digest is obtained -- computeFingerprint sources it from raw worktree
// bytes (the early preflight authorization check), computeStagedFingerprint from the actual index
// blob just staged (the final pre-commit seal). Both must agree with envelope.publication_fingerprint
// for a commit to ever be made; see verifyStagedFingerprint below for why both checks are required.
function computeFingerprintFromDigests(classifiedEntries, digestFn) {
  const byPath = new Map(classifiedEntries.map((c) => [c.path, c]));
  const hash = createHash('sha256');
  for (const path of byteSort([...byPath.keys()])) {
    const entry = byPath.get(path);
    const digest = entry.shape === 'A' ? digestFn(entry.path) : 'ABSENT';
    hash.update(path, 'utf8');
    hash.update(Buffer.from([0]));
    hash.update(digest, 'utf8');
    hash.update('\n', 'utf8');
  }
  return hash.digest('hex');
}

export function computeFingerprint(repoRoot, classifiedEntries, options = {}) {
  return computeFingerprintFromDigests(classifiedEntries, (path) => rawBlobSha(repoRoot, path, options));
}

// --- Working-tree scope guard -------------------------------------------------------------------

// Every path git reports as changed/untracked must be inside the authorized "present" set -- this
// rejects a dirty unrelated file the Envelope never named.
export function verifyWorkingTreeScope(repoRoot, classifiedEntries, options = {}) {
  const result = tryGit(repoRoot, ['status', '--porcelain', '--no-renames'], options);
  if (!result.ok) return blocked('WORKING_TREE_UNREADABLE');
  // Both shapes are authorized working-tree deviations from a clean checkout: shape (A) shows as a
  // modified/untracked entry, shape (B) shows as a worktree deletion (" D path") since the file was
  // already removed from disk but is still tracked at expected_pre_publish_head.
  const allowedPaths = new Set(classifiedEntries.map((c) => c.path));
  const lines = result.stdout.split('\n').filter(Boolean);
  const unrelated = [];
  for (const line of lines) {
    const path = line.slice(3).trim();
    if (!allowedPaths.has(path)) unrelated.push(path);
  }
  if (unrelated.length > 0) return blocked('UNRELATED_WORKING_TREE_CHANGES', { paths: unrelated });
  return { status: 'OK' };
}

// --- Staging / commit ----------------------------------------------------------------------------

function stageEntry(repoRoot, entry, options) {
  // -c core.autocrlf=false: a repo/global autocrlf=true|input setting would otherwise let `git add`
  // normalize CRLF->LF during staging even with no explicit .gitattributes text/eol attribute (which
  // verifyNoContentTransform already blocked). This is the deterministic override V3.1-A's fail-closed
  // model explicitly permits; the staged-blob proof below still independently catches any residual
  // transform regardless of its cause.
  const args = entry.shape === 'A'
    ? ['-c', 'core.autocrlf=false', '--literal-pathspecs', 'add', '--', entry.path]
    : ['-c', 'core.autocrlf=false', '--literal-pathspecs', 'rm', '--', entry.path];
  return tryGit(repoRoot, args, options);
}

// Reads back the exact blob SHA git bound to `path` in the index right now (not from a cached value
// computed earlier), so the comparison in verifyStagedBlobIdentity reflects what `git add` actually
// did, not what preflight predicted it would do.
function stagedBlobSha(repoRoot, path, options) {
  const result = tryGit(repoRoot, ['rev-parse', '--verify', '--quiet', `:${path}`], options);
  return result.ok ? result.stdout.trim() : null;
}

// The mechanical proof required by V3.1-A: for every PRESENT file just staged, the index blob SHA
// must exactly equal the raw-worktree blob SHA (filters disabled) -- independently re-derived here,
// not reused from the earlier fingerprint computation, so this check catches any transform introduced
// between preflight and staging, not just the ones preflight already predicted.
function verifyStagedBlobIdentity(repoRoot, classifiedEntries, options) {
  for (const entry of classifiedEntries) {
    if (entry.shape !== 'A') continue;
    const raw = rawBlobSha(repoRoot, entry.path, options);
    const staged = stagedBlobSha(repoRoot, entry.path, options);
    if (!staged || staged !== raw) {
      return blocked('STAGED_BLOB_MISMATCH', { path: entry.path, raw_blob_sha: raw, staged_blob_sha: staged });
    }
  }
  return { status: 'OK' };
}

// A sentinel that can never equal a real 40-hex git blob SHA, used when a PRESENT entry's staged
// blob is unexpectedly unreadable -- guarantees the fingerprint this feeds into can never
// accidentally collide with envelope.publication_fingerprint (a 64-hex value derived from real
// digests), rather than silently hashing the empty string.
const STAGED_BLOB_UNREADABLE = 'STAGED_BLOB_UNREADABLE';

// Recomputes the canonical fingerprint from the bytes actually sitting in the index right now --
// the ACTUAL bytes about to enter the commit -- rather than trusting the raw-worktree fingerprint
// preflight verified before staging began. Binding only to preflight's raw-worktree read leaves a
// window open: a file can be mutated after preflight's fingerprint check but before/during `git
// add` stages it, so the fresh raw bytes and the freshly staged bytes can agree with each other
// (satisfying verifyStagedBlobIdentity) while both have silently drifted from what the Envelope
// actually authorized. This is the final seal: the exact bytes about to be committed must
// themselves equal envelope.publication_fingerprint, not merely equal whatever the worktree
// happened to contain a moment earlier.
function computeStagedFingerprint(repoRoot, classifiedEntries, options = {}) {
  return computeFingerprintFromDigests(classifiedEntries, (path) => stagedBlobSha(repoRoot, path, options) ?? STAGED_BLOB_UNREADABLE);
}

function verifyStagedFingerprint(repoRoot, classifiedEntries, expectedFingerprint, options) {
  const actual = computeStagedFingerprint(repoRoot, classifiedEntries, options);
  if (actual !== expectedFingerprint) {
    return blocked('STAGED_FINGERPRINT_MISMATCH', { expected: expectedFingerprint, actual });
  }
  return { status: 'OK' };
}

// Creates a fresh, empty, process-local hooks directory, runs `fn(hooksDir)`, and always removes the
// directory afterward -- the actual hook-suppression boundary. buildLocalCommit passes this dir as
// `options.hooksDir` to every git() call it makes for its whole run (not only the commit itself), so
// no pre-commit/prepare-commit-msg/commit-msg/post-commit/fsmonitor/etc. hook -- from this repo or
// the user's global git config -- can run at any point during the builder's operation.
function withEmptyHooksDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'mihver-pubbuilder-hooks-'));
  try {
    return fn(dir);
  } finally {
    // Never let a cleanup failure clobber an already-computed result (or an in-flight exception) --
    // best-effort removal only.
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignored -- OS temp directory, not a security boundary once the run has already concluded
    }
  }
}

// Captures the *exact* current index content as a tree object, without touching the working tree or
// HEAD. Used to restore the precise pre-staging index state on any post-staging failure -- plain
// `git reset` would instead reset to HEAD, silently discarding any legitimate changes the caller had
// already staged before invoking the builder.
function snapshotIndexTree(repoRoot, options) {
  const result = tryGit(repoRoot, ['write-tree'], options);
  return result.ok ? result.stdout.trim() : null;
}

// Replaces the index wholesale with the exact tree captured by snapshotIndexTree -- the precise
// inverse of whatever staging did, regardless of what the index looked like before this run started.
// Returns true only when restoration is independently PROVEN, not merely attempted: `git read-tree`
// reporting success is not itself sufficient evidence (a hostile/corrupted execFileSyncImpl, or any
// other tool-level lie, could report success without actually restoring the index), so this
// re-snapshots the index immediately after and requires it to exactly equal treeSha -- the same
// write-tree comparison snapshotIndexTree itself uses to capture state, applied here to verify it.
// A caller must never report a BLOCKED failure as "safely restored" without this proof: doing so
// would let a real restoration failure look identical to a normal, safely-recovered BLOCKED result.
function restoreIndexToTree(repoRoot, treeSha, options) {
  const result = tryGit(repoRoot, ['read-tree', treeSha], options);
  if (!result.ok) return false;
  return snapshotIndexTree(repoRoot, options) === treeSha;
}

function stagedNames(repoRoot, options) {
  // --no-renames: without it, an old-path deletion + new-path addition with byte-identical content
  // (a plain rename) is collapsed by git's default rename detection into fewer name-only entries
  // than were actually staged, which would falsely look like a staged-name mismatch below.
  const result = tryGit(repoRoot, ['diff', '--cached', '--name-only', '--no-renames'], options);
  if (!result.ok) return null;
  return result.stdout.split('\n').filter(Boolean);
}

function workingTreeClean(repoRoot, options) {
  const result = tryGit(repoRoot, ['status', '--porcelain'], options);
  return result.ok && result.stdout.trim() === '';
}

// --- Top-level preflight (every read-only check, no staging/commit) ------------------------------

// Runs every guard up to and including the fingerprint check, without staging or committing
// anything. Internal implementation -- callers must go through the exported `preflight` (which
// establishes its own hook/fsmonitor isolation boundary) or, for buildLocalCommit, reuse the
// isolation boundary it already owns for its whole run via `options.hooksDir`.
function preflightCore(envelope, repoRoot, options = {}) {
  const shapeCheck = validateEnvelopeShape(envelope);
  if (!shapeCheck.ok) return blocked('MALFORMED_ENVELOPE', { errors: shapeCheck.errors });

  const root = resolve(repoRoot);

  const rootCheck = verifyRepoRoot(root, options);
  if (rootCheck.status !== 'OK') return rootCheck;

  const branchCheck = verifyCurrentBranch(root, envelope.branch, options);
  if (branchCheck.status !== 'OK') return branchCheck;

  const remoteCheck = verifyRemoteIdentity(root, envelope.repository, options);
  if (remoteCheck.status !== 'OK') return remoteCheck;

  const headCheck = verifyPrePublishHead(root, envelope.expected_pre_publish_head, options);
  if (headCheck.status !== 'OK') return headCheck;

  const ancestryCheck = verifyBaseAncestry(root, envelope.base_commit, options);
  if (ancestryCheck.status !== 'OK') return ancestryCheck;

  const classification = classifyAllowedFiles(root, envelope.allowed_files, envelope.expected_pre_publish_head, options);
  if (!classification.ok) return blocked('MALFORMED_ALLOWED_FILES', { malformed: classification.malformed });

  const scopeCheck = verifyWorkingTreeScope(root, classification.classified, options);
  if (scopeCheck.status !== 'OK') return scopeCheck;

  const transformCheck = verifyNoContentTransform(root, classification.classified, options);
  if (transformCheck.status !== 'OK') return transformCheck;

  const fingerprint = computeFingerprint(root, classification.classified, options);
  if (fingerprint !== envelope.publication_fingerprint) {
    return blocked('FINGERPRINT_MISMATCH', { expected: envelope.publication_fingerprint, actual: fingerprint });
  }

  return { status: 'OK', classified: classification.classified, pre_publish_head: headCheck.head };
}

// Exported entry point. preflight() is read-only (no staging/commit), but its internal git calls
// (status, check-attr, hash-object, etc.) are just as capable of running a repo/user-controlled
// core.fsmonitor command as buildLocalCommit's are, so a direct caller must get the same isolation
// buildLocalCommit gives itself -- a fresh, empty, process-owned hooks directory for this call only.
// A caller-supplied `options.hooksDir` is deliberately never trusted as that boundary: it could name
// a directory the caller (or something upstream of the caller) controls, which is exactly the trust
// this isolation exists to remove. buildLocalCommit does not call this function -- it already owns
// one fresh isolation directory for its entire run and calls preflightCore directly under that.
export function preflight(envelope, repoRoot, options = {}) {
  return withEmptyHooksDir((hooksDir) => preflightCore(envelope, repoRoot, { ...options, hooksDir }));
}

// --- Top-level build: preflight + stage + commit (local only, never push) ------------------------

export function buildLocalCommit(envelope, repoRoot, options = {}) {
  const root = resolve(repoRoot);
  const receiptBase = {
    protocol_version: PROTOCOL_VERSION,
    repository: envelope?.repository,
    branch: envelope?.branch,
    base_commit: envelope?.base_commit,
    fingerprint: envelope?.publication_fingerprint
  };

  // The whole run -- preflight, staging, the byte-identity proof, and the commit itself -- executes
  // under one fresh empty hooks directory, so every git() call this function makes (via `runOptions`,
  // not just the final commit) is hook- and fsmonitor-isolated.
  return withEmptyHooksDir((hooksDir) => {
    const runOptions = { ...options, hooksDir };

    const preBlocked = (pre) => ({
      status: 'BLOCKED',
      ...receiptBase,
      pre_publish_head: envelope?.expected_pre_publish_head,
      local_head: envelope?.expected_pre_publish_head,
      working_tree: workingTreeClean(root, runOptions) ? 'clean' : 'dirty',
      failure_reason: JSON.stringify({ reason: pre.reason, ...pre })
    });

    const pre = preflightCore(envelope, root, runOptions);
    if (pre.status !== 'OK') return preBlocked(pre);

    const { classified, pre_publish_head } = pre;

    const blockedAfterStaging = (reason, extra = {}) => ({
      status: 'BLOCKED', ...receiptBase, pre_publish_head, local_head: pre_publish_head,
      working_tree: workingTreeClean(root, runOptions) ? 'clean' : 'dirty',
      failure_reason: JSON.stringify({ reason, ...extra })
    });

    // Snapshot the index exactly as it stands right now (whatever it was before this run started),
    // so any post-staging failure can restore precisely that state rather than resetting to HEAD.
    const preBuildTree = snapshotIndexTree(root, runOptions);
    if (!preBuildTree) return blockedAfterStaging('INDEX_SNAPSHOT_FAILED');

    let stagingStarted = false;

    // Every post-staging failure path must go through this, never `blockedAfterStaging` directly:
    // restoration is attempted and then independently VERIFIED (see restoreIndexToTree), and if that
    // verification fails, the result is a distinct INDEX_RESTORE_FAILED -- never the original
    // triggering reason reported as though cleanup succeeded, since a caller reading a plain
    // STAGED_NAME_MISMATCH-shaped BLOCKED (for example) would reasonably assume the repository was
    // left clean, which may no longer be true. The original reason/extra are preserved as structured
    // diagnostic data either way.
    const failAfterStaging = (reason, extra = {}) => {
      const restored = stagingStarted ? restoreIndexToTree(root, preBuildTree, runOptions) : true;
      if (!restored) {
        return {
          status: 'BLOCKED', ...receiptBase, pre_publish_head, local_head: pre_publish_head,
          working_tree: workingTreeClean(root, runOptions) ? 'clean' : 'dirty',
          failure_reason: JSON.stringify({
            reason: 'INDEX_RESTORE_FAILED',
            note: 'index restoration could not be verified after a post-staging failure; manual repository inspection/intervention is required',
            triggering_reason: reason,
            triggering_extra: extra
          })
        };
      }
      return blockedAfterStaging(reason, extra);
    };

    try {
      stagingStarted = true;

      for (const entry of classified) {
        const staged = stageEntry(root, entry, runOptions);
        if (!staged.ok) {
          return failAfterStaging('STAGING_FAILED', { path: entry.path });
        }
      }

      const expectedStaged = new Set(classified.map((c) => c.path));
      const actualStaged = stagedNames(root, runOptions);
      const stagedSet = new Set(actualStaged ?? []);
      const stagedMismatch = actualStaged === null
        || actualStaged.length !== expectedStaged.size
        || [...expectedStaged].some((p) => !stagedSet.has(p));
      if (stagedMismatch) {
        return failAfterStaging('STAGED_NAME_MISMATCH', { expected: [...expectedStaged], actual: actualStaged });
      }

      // Mechanical proof required by V3.1-A: raw-worktree blob SHA (filters disabled) must exactly
      // equal the blob `git add` actually bound in the index. A mismatch means some transform slipped
      // past verifyNoContentTransform/the autocrlf override -- fail closed and restore the index.
      const blobIdentityCheck = verifyStagedBlobIdentity(root, classified, runOptions);
      if (blobIdentityCheck.status !== 'OK') {
        return failAfterStaging(blobIdentityCheck.reason, blobIdentityCheck);
      }

      // Final seal required by V3.1-A: the canonical fingerprint recomputed from the ACTUAL staged
      // index blobs -- not fresh worktree bytes -- must still equal envelope.publication_fingerprint.
      // preflight's fingerprint check only proves the worktree matched the Envelope *before* staging
      // began; a file mutated after that check but before/during `git add` could otherwise let bytes
      // the Envelope never authorized reach the commit, since the mutated raw bytes and the mutated
      // staged bytes would still agree with each other and pass verifyStagedBlobIdentity above.
      const fingerprintCheck = verifyStagedFingerprint(root, classified, envelope.publication_fingerprint, runOptions);
      if (fingerprintCheck.status !== 'OK') {
        return failAfterStaging(fingerprintCheck.reason, fingerprintCheck);
      }

      // Final pre-commit HEAD seal: re-read HEAD immediately before committing and require it still
      // equal expected_pre_publish_head (already verified once, before staging, by preflight). HEAD
      // could otherwise have moved during staging -- e.g. a concurrent process committing on this
      // same branch -- letting this run's commit land on top of an unauthorized parent.
      const headRecheck = tryGit(root, ['rev-parse', 'HEAD'], runOptions);
      const headNow = headRecheck.ok ? headRecheck.stdout.trim() : null;
      if (headNow !== pre_publish_head) {
        return failAfterStaging('PRE_COMMIT_HEAD_CHANGED', { expected: pre_publish_head, actual: headNow });
      }

      // Hook isolation for the commit itself: --no-verify alone only skips pre-commit/commit-msg --
      // prepare-commit-msg and post-commit would still run repository/user-controlled code without
      // core.hooksPath (applied above, for this whole run, via runOptions). --no-gpg-sign additionally
      // prevents an external signing program from being invoked.
      const commitResult = tryGit(root, ['commit', '--no-verify', '--no-gpg-sign', '-m', envelope.commit_message], runOptions);
      if (!commitResult.ok) {
        return failAfterStaging('COMMIT_FAILED');
      }

      const headAfter = tryGit(root, ['rev-parse', 'HEAD'], runOptions);
      const commitSha = headAfter.ok ? headAfter.stdout.trim() : null;

      // A commit was made (git reported success above), but its SHA could not be read back and
      // verified -- never claim COMMITTED without a validated 40-hex SHA to hand back in the receipt.
      if (!commitSha || !HEX40.test(commitSha)) {
        return {
          status: 'BLOCKED', ...receiptBase, pre_publish_head, local_head: commitSha ?? pre_publish_head,
          working_tree: workingTreeClean(root, runOptions) ? 'clean' : 'dirty',
          failure_reason: JSON.stringify({ reason: 'POST_COMMIT_HEAD_UNREADABLE', note: 'a local commit may exist; inspect the repository manually before retrying' })
        };
      }

      return {
        status: 'COMMITTED',
        ...receiptBase,
        pre_publish_head,
        commit_sha: commitSha,
        local_head: commitSha,
        working_tree: workingTreeClean(root, runOptions) ? 'clean' : 'dirty'
      };
    } catch (error) {
      // Any thrown error once staging has begun (a throwing git() call, e.g. from rawBlobSha) must
      // still trigger index restoration -- fail closed rather than letting the exception skip cleanup.
      return failAfterStaging('UNEXPECTED_ERROR', { message: error?.message ?? String(error) });
    }
  });
}

// --- CLI entrypoint --------------------------------------------------------------------------

const isMainModule = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMainModule) {
  const envelopePathArg = process.argv[2];
  if (!envelopePathArg || process.argv.length !== 3) {
    console.error('Usage: node scripts/dev/publication-builder.mjs <path-to-publication-envelope.json>');
    process.exit(1);
  }
  try {
    const envelopePath = isAbsolute(envelopePathArg) ? envelopePathArg : resolve(process.cwd(), envelopePathArg);
    const envelope = JSON.parse(readFileSync(envelopePath, 'utf8'));
    const repoRoot = process.cwd();
    const receipt = buildLocalCommit(envelope, repoRoot, {});
    console.log(JSON.stringify(receipt, null, 2));
    process.exit(receipt.status === 'COMMITTED' ? 0 : 1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
