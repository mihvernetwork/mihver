// Adversarial + happy-path tests for scripts/dev/publication-builder.mjs (V3.1-A). Every fixture is
// a disposable git repository built under the OS temp directory with execFileSync -- this test file
// never touches the actual MIHVER repository. Exercises the deterministic Local Publication Builder
// against the exact adversarial cases DEVELOPMENT-ORCHESTRATION-V3.1-A required: wrong repo,
// main/master branch, wrong pre-publish HEAD, non-ancestor base, duplicate path, traversal path,
// symlink, directory, submodule representation, added file, modified file, deletion, rename pair,
// fingerprint mismatch, staged-file mismatch, dirty unrelated file, malformed envelope, and an
// attempted remote-publication request.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  preflight,
  buildLocalCommit,
  classifyEntry,
  classifyAllowedFiles,
  computeFingerprint,
  parseGitHubRemote,
  validateEnvelopeShape,
  verifyCurrentBranch,
} from '../../scripts/dev/publication-builder.mjs';

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

function tempRepo(label) {
  const root = mkdtempSync(join(tmpdir(), `mihver-pubbuilder-${label}-`));
  roots.push(root);
  return root;
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', shell: false });
}

function initRepo(root, { remoteOwner = 'mihvernetwork', remoteName = 'mihver' } = {}) {
  git(root, ['init', '--initial-branch=main', '-q']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  git(root, ['remote', 'add', 'origin', `https://github.com/${remoteOwner}/${remoteName}.git`]);
  // Content includes the repo root path so two independently-seeded fixture repos never produce a
  // colliding commit SHA (git commit hashes are otherwise deterministic over identical tree/message).
  writeFileSync(join(root, 'README.md'), `seed ${root}\n`);
  git(root, ['add', 'README.md']);
  git(root, ['commit', '-m', 'seed', '-q']);
  const baseCommit = git(root, ['rev-parse', 'HEAD']).trim();
  return baseCommit;
}

function branchAt(root, name, fromCommit) {
  git(root, ['switch', '-c', name, fromCommit, '-q']);
}

function baseEnvelope(overrides = {}) {
  return {
    protocol_version: '1.0.0',
    repository: { remote_name: 'origin', owner: 'mihvernetwork', name: 'mihver' },
    branch: 'chore/test-branch',
    base_branch: 'main',
    base_commit: '0'.repeat(40),
    expected_pre_publish_head: '0'.repeat(40),
    allowed_files: [{ path: 'placeholder.txt', action: 'present' }],
    publication_fingerprint: '0'.repeat(64),
    commit_message: 'test commit',
    pr_expected: false,
    ...overrides,
  };
}

// --- happy paths -------------------------------------------------------------------------------

test('COMMITTED: single added file', () => {
  const root = tempRepo('added');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const receipt = buildLocalCommit(envelope, root);
  assert.equal(receipt.status, 'COMMITTED');
  assert.ok(receipt.commit_sha);
  assert.equal(receipt.working_tree, 'clean');
  assert.equal(git(root, ['log', '-1', '--format=%s']).trim(), 'test commit');
});

test('COMMITTED: modified file', () => {
  const root = tempRepo('modified');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  writeFileSync(join(root, 'README.md'), 'changed\n');
  const allowed_files = [{ path: 'README.md', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const receipt = buildLocalCommit(envelope, root);
  assert.equal(receipt.status, 'COMMITTED');
});

test('COMMITTED: authorized deletion', () => {
  const root = tempRepo('deletion');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  unlinkSync(join(root, 'README.md'));
  const allowed_files = [{ path: 'README.md', action: 'deletion' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const receipt = buildLocalCommit(envelope, root);
  assert.equal(receipt.status, 'COMMITTED');
  const tracked = git(root, ['ls-tree', 'HEAD', '--', 'README.md']).trim();
  assert.equal(tracked, '');
});

test('COMMITTED: rename pair (old deletion + new present)', () => {
  const root = tempRepo('rename');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  const content = execFileSync('cat', [join(root, 'README.md')], { encoding: 'utf8' });
  unlinkSync(join(root, 'README.md'));
  writeFileSync(join(root, 'RENAMED.md'), content);
  const allowed_files = [
    { path: 'README.md', action: 'deletion' },
    { path: 'RENAMED.md', action: 'present' },
  ];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const receipt = buildLocalCommit(envelope, root);
  assert.equal(receipt.status, 'COMMITTED');
});

// --- adversarial: identity / branch / ancestry --------------------------------------------------

test('BLOCKED: wrong repo (repoRoot is not a git repository)', () => {
  const root = tempRepo('notrepo');
  const envelope = baseEnvelope({ base_commit: '0'.repeat(40), expected_pre_publish_head: '0'.repeat(40) });
  const result = preflight(envelope, root);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'NOT_A_GIT_REPOSITORY');
});

test('BLOCKED: wrong remote identity', () => {
  const root = tempRepo('wrongremote');
  const base = initRepo(root, { remoteOwner: 'someone-else', remoteName: 'other-repo' });
  branchAt(root, 'chore/test-branch', base);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base });
  const result = preflight(envelope, root);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'REMOTE_IDENTITY_MISMATCH');
});

test('BLOCKED: main branch rejected (both at envelope-shape level and at the branch guard itself)', () => {
  const root = tempRepo('mainbranch');
  const base = initRepo(root);
  const envelope = baseEnvelope({ branch: 'main', base_commit: base, expected_pre_publish_head: base });
  const result = preflight(envelope, root);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'MALFORMED_ENVELOPE');
  // Defense in depth: verifyCurrentBranch itself independently rejects main/master too, in case a
  // future caller ever invokes it without going through validateEnvelopeShape first.
  assert.equal(verifyCurrentBranch(root, 'main').reason, 'MAIN_BRANCH_FORBIDDEN');
});

test('BLOCKED: master branch rejected (both at envelope-shape level and at the branch guard itself)', () => {
  const root = tempRepo('masterbranch');
  const base = initRepo(root);
  const envelope = baseEnvelope({ branch: 'master', base_commit: base, expected_pre_publish_head: base });
  const result = preflight(envelope, root);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'MALFORMED_ENVELOPE');
  assert.equal(verifyCurrentBranch(root, 'master').reason, 'MAIN_BRANCH_FORBIDDEN');
});

test('BLOCKED: wrong pre-publish HEAD', () => {
  const root = tempRepo('wronghead');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  writeFileSync(join(root, 'extra.txt'), 'x\n');
  git(root, ['add', 'extra.txt']);
  git(root, ['commit', '-m', 'extra', '-q']);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base });
  const result = preflight(envelope, root);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'PRE_PUBLISH_HEAD_MISMATCH');
});

test('BLOCKED: base commit is not an ancestor of HEAD', () => {
  const root = tempRepo('nonancestor');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  const head = git(root, ['rev-parse', 'HEAD']).trim();
  // A commit from a disjoint history (different repo entirely) can never be an ancestor. Uses a
  // distinct owner/name so its seed commit doesn't hash-collide with `root`'s identical seed commit.
  const otherRoot = tempRepo('nonancestor-other');
  const otherCommit = initRepo(otherRoot, { remoteOwner: 'someone-else', remoteName: 'other-repo' });
  const envelope = baseEnvelope({ base_commit: otherCommit, expected_pre_publish_head: head });
  const result = preflight(envelope, root);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'BASE_COMMIT_NOT_ANCESTOR');
});

// --- adversarial: file classification -----------------------------------------------------------

test('BLOCKED: duplicate path', () => {
  const root = tempRepo('duplicate');
  const base = initRepo(root);
  const allowed_files = [{ path: 'a.txt', action: 'present' }, { path: 'a.txt', action: 'present' }];
  const result = classifyAllowedFiles(root, allowed_files, base);
  assert.equal(result.ok, false);
  assert.ok(result.malformed.some((m) => m.reason === 'DUPLICATE_PATH'));
});

test('BLOCKED: traversal path rejected', () => {
  const root = tempRepo('traversal');
  const base = initRepo(root);
  const entry = classifyEntry(root, { path: '../outside.txt', action: 'present' }, base);
  assert.equal(entry.malformed, true);
});

test('BLOCKED: absolute path rejected', () => {
  const root = tempRepo('absolute');
  const base = initRepo(root);
  const entry = classifyEntry(root, { path: '/etc/passwd', action: 'present' }, base);
  assert.equal(entry.malformed, true);
});

test('BLOCKED: symlink rejected', () => {
  const root = tempRepo('symlink');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  symlinkSync('/etc/passwd', join(root, 'link.txt'));
  const entry = classifyEntry(root, { path: 'link.txt', action: 'present' }, base);
  assert.equal(entry.malformed, true);
  assert.equal(entry.reason, 'SYMLINK_NOT_ALLOWED');
});

test('BLOCKED: directory rejected', () => {
  const root = tempRepo('directory');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  mkdirSync(join(root, 'somedir'));
  writeFileSync(join(root, 'somedir', 'f.txt'), 'x\n');
  const entry = classifyEntry(root, { path: 'somedir', action: 'present' }, base);
  assert.equal(entry.malformed, true);
  assert.equal(entry.reason, 'DIRECTORY_NOT_ALLOWED');
});

test('BLOCKED: submodule-mode deletion entry rejected', () => {
  const root = tempRepo('submodule');
  const base = initRepo(root);
  // Fabricate a submodule gitlink entry (mode 160000) without a real submodule checkout.
  const fakeSha = '1'.repeat(40);
  git(root, ['update-index', '--add', '--cacheinfo', `160000,${fakeSha},sub`]);
  git(root, ['commit', '-m', 'add fake submodule', '-q']);
  const headWithSubmodule = git(root, ['rev-parse', 'HEAD']).trim();
  branchAt(root, 'chore/test-branch', headWithSubmodule);
  const entry = classifyEntry(root, { path: 'sub', action: 'deletion' }, headWithSubmodule);
  assert.equal(entry.malformed, true);
  assert.equal(entry.reason, 'DELETION_NOT_A_REGULAR_FILE');
});

test('BLOCKED: deletion entry not tracked at expected_pre_publish_head', () => {
  const root = tempRepo('nottracked');
  const base = initRepo(root);
  const entry = classifyEntry(root, { path: 'never-existed.txt', action: 'deletion' }, base);
  assert.equal(entry.malformed, true);
  assert.equal(entry.reason, 'DELETION_NOT_TRACKED_AT_PRE_PUBLISH_HEAD');
});

// --- adversarial: fingerprint / staging / working tree --------------------------------------------

test('BLOCKED: fingerprint mismatch', () => {
  const root = tempRepo('fpmismatch');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const envelope = baseEnvelope({
    base_commit: base, expected_pre_publish_head: base, allowed_files,
    publication_fingerprint: '0'.repeat(64),
  });
  const result = preflight(envelope, root);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'FINGERPRINT_MISMATCH');
});

test('BLOCKED: dirty unrelated file not in Envelope', () => {
  const root = tempRepo('dirtyunrelated');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  writeFileSync(join(root, 'unrelated.txt'), 'sneaky\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const result = preflight(envelope, root);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'UNRELATED_WORKING_TREE_CHANGES');
});

test('BLOCKED: staged-name mismatch surfaced when a hostile execFileSyncImpl lies about staged names', () => {
  const root = tempRepo('stagedmismatch');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const realExecFileSync = execFileSync;
  const lyingImpl = (cmd, args, opts) => {
    if (args.includes('diff') && args.includes('--cached')) return Buffer.from('new.txt\nextra-not-really-staged.txt\n');
    return realExecFileSync(cmd, args, opts);
  };
  const receipt = buildLocalCommit(envelope, root, { execFileSyncImpl: lyingImpl });
  assert.equal(receipt.status, 'BLOCKED');
  assert.equal(JSON.parse(receipt.failure_reason).reason, 'STAGED_NAME_MISMATCH');
  // No commit was actually created on the real repo despite the lie.
  assert.equal(git(root, ['log', '--oneline']).trim().split('\n').length, 1);
});

// --- adversarial: malformed envelope / never-remote-publish ---------------------------------------

test('BLOCKED: malformed envelope (wrong protocol_version) never reaches repository checks', () => {
  const root = tempRepo('malformedenvelope');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, protocol_version: '9.9.9' });
  const result = preflight(envelope, root);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'MALFORMED_ENVELOPE');
  assert.ok(result.errors.some((e) => e.includes('protocol_version')));
});

test('validateEnvelopeShape rejects missing/wrong-typed required fields', () => {
  assert.equal(validateEnvelopeShape(null).ok, false);
  assert.equal(validateEnvelopeShape({}).ok, false);
  assert.equal(validateEnvelopeShape(baseEnvelope({ base_commit: '0'.repeat(40), expected_pre_publish_head: '0'.repeat(40) })).ok, true);
  assert.equal(validateEnvelopeShape(baseEnvelope({ branch: 'main', base_commit: '0'.repeat(40), expected_pre_publish_head: '0'.repeat(40) })).ok, false);
  assert.equal(validateEnvelopeShape(baseEnvelope({ pr_expected: true, base_commit: '0'.repeat(40), expected_pre_publish_head: '0'.repeat(40) })).ok, false);
  assert.equal(validateEnvelopeShape(baseEnvelope({
    pr_expected: true, pr_title: 'x', pr_body: 'y', base_commit: '0'.repeat(40), expected_pre_publish_head: '0'.repeat(40),
  })).ok, true);
});

test('preflight reports MALFORMED_ALLOWED_FILES for a malformed envelope entry set', () => {
  const root = tempRepo('malformed');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  const allowed_files = [{ path: '../escape.txt', action: 'present' }];
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: '0'.repeat(64) });
  const result = preflight(envelope, root);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'MALFORMED_ALLOWED_FILES');
});

test('never invokes push or an authenticated GitHub API call', () => {
  const root = tempRepo('nopush');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const invokedArgs = [];
  const realExecFileSync = execFileSync;
  const spyImpl = (cmd, args, opts) => {
    invokedArgs.push(args);
    return realExecFileSync(cmd, args, opts);
  };
  const receipt = buildLocalCommit(envelope, root, { execFileSyncImpl: spyImpl });
  assert.equal(receipt.status, 'COMMITTED');
  for (const args of invokedArgs) {
    assert.ok(!args.includes('push'), `unexpected git push invocation: ${JSON.stringify(args)}`);
    assert.ok(args[0] !== 'gh', `unexpected gh CLI invocation: ${JSON.stringify(args)}`);
  }
});

test('COMMITTED: a pre-commit hook that tries to stage an extra file is skipped (--no-verify)', () => {
  const root = tempRepo('hook');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  mkdirSync(join(root, '.git', 'hooks'), { recursive: true });
  const hookPath = join(root, '.git', 'hooks', 'pre-commit');
  writeFileSync(hookPath, '#!/bin/sh\necho "sneaky" > sneaky.txt\ngit add sneaky.txt\nexit 0\n', { mode: 0o755 });
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const receipt = buildLocalCommit(envelope, root);
  assert.equal(receipt.status, 'COMMITTED');
  const committedFiles = git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', receipt.commit_sha]).trim().split('\n');
  assert.ok(!committedFiles.includes('sneaky.txt'), `hook-staged file leaked into commit: ${committedFiles}`);
});

test('COMMITTED: malicious core.fsmonitor command does not execute during the run', () => {
  const root = tempRepo('fsmonitor');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  const sentinel = join(root, 'FSMONITOR_RAN.txt');
  git(root, ['config', 'core.fsmonitor', `sh -c 'touch "${sentinel}"; echo 1'`]);
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const receipt = buildLocalCommit(envelope, root);
  assert.equal(receipt.status, 'COMMITTED');
  assert.throws(() => execFileSync('test', ['-e', sentinel]), 'core.fsmonitor command executed: sentinel file was created');
});

test('BLOCKED: post-staging failure restores exact pre-builder index state, not merely HEAD', () => {
  const root = tempRepo('exactrestore');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  // Simulate a caller that had already legitimately staged an unrelated change before invoking the
  // builder (e.g. from a previous, still-in-progress operation) -- this is NOT one of the Envelope's
  // allowed_files, so it must survive a BLOCKED failure unchanged; a plain `git reset` would instead
  // wipe it back to HEAD and silently discard it.
  writeFileSync(join(root, 'README.md'), 'pre-staged change\n');
  git(root, ['add', 'README.md']);
  const preBuildStagedSha = git(root, ['rev-parse', ':README.md']).trim();
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const realExecFileSync = execFileSync;
  const lyingImpl = (cmd, args, opts) => {
    if (args.includes('diff') && args.includes('--cached')) return Buffer.from('new.txt\nextra-not-really-staged.txt\n');
    return realExecFileSync(cmd, args, opts);
  };
  const receipt = buildLocalCommit(envelope, root, { execFileSyncImpl: lyingImpl });
  assert.equal(receipt.status, 'BLOCKED');
  assert.equal(git(root, ['rev-parse', ':README.md']).trim(), preBuildStagedSha, 'pre-existing staged change was discarded instead of exactly restored');
});

// --- adversarial: complete git hook isolation (core.hooksPath, not just --no-verify) --------------

test('COMMITTED: malicious prepare-commit-msg hook does not execute (sentinel must not exist)', () => {
  const root = tempRepo('prepare-hook');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  mkdirSync(join(root, '.git', 'hooks'), { recursive: true });
  const sentinel = join(root, 'PREPARE_HOOK_RAN.txt');
  writeFileSync(
    join(root, '.git', 'hooks', 'prepare-commit-msg'),
    `#!/bin/sh\ntouch "${sentinel}"\nexit 0\n`,
    { mode: 0o755 },
  );
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const receipt = buildLocalCommit(envelope, root);
  assert.equal(receipt.status, 'COMMITTED');
  assert.throws(() => execFileSync('test', ['-e', sentinel]), 'prepare-commit-msg hook executed: sentinel file was created');
});

test('COMMITTED: malicious post-commit hook does not execute (sentinel must not exist)', () => {
  const root = tempRepo('post-hook');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  mkdirSync(join(root, '.git', 'hooks'), { recursive: true });
  const sentinel = join(root, 'POST_HOOK_RAN.txt');
  writeFileSync(
    join(root, '.git', 'hooks', 'post-commit'),
    `#!/bin/sh\ntouch "${sentinel}"\nexit 0\n`,
    { mode: 0o755 },
  );
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const receipt = buildLocalCommit(envelope, root);
  assert.equal(receipt.status, 'COMMITTED');
  assert.throws(() => execFileSync('test', ['-e', sentinel]), 'post-commit hook executed: sentinel file was created');
});

// --- adversarial: content-transform attributes / filters / autocrlf -------------------------------

test('BLOCKED: explicit filter= attribute rejected, and the filter command never runs', () => {
  const root = tempRepo('filterattr');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  const sentinel = join(root, 'FILTER_RAN.txt');
  writeFileSync(join(root, '.gitattributes'), '*.secret filter=sneaky\n');
  git(root, ['add', '.gitattributes']);
  git(root, ['commit', '-m', 'add attributes', '-q']);
  const headWithAttrs = git(root, ['rev-parse', 'HEAD']).trim();
  git(root, ['config', 'filter.sneaky.clean', `touch "${sentinel}" && cat`]);
  writeFileSync(join(root, 'file.secret'), 'hello\n');
  const allowed_files = [{ path: 'file.secret', action: 'present' }];
  const envelope = baseEnvelope({
    base_commit: base, expected_pre_publish_head: headWithAttrs, allowed_files,
    publication_fingerprint: '0'.repeat(64),
  });
  const result = preflight(envelope, root);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'CONTENT_TRANSFORM_ATTRIBUTE_BLOCKED');
  assert.equal(result.attribute, 'filter');
  assert.throws(() => execFileSync('test', ['-e', sentinel]), 'filter clean command executed despite being blocked');
});

test('BLOCKED: explicit text=auto attribute rejected before staging', () => {
  const root = tempRepo('textattr');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  writeFileSync(join(root, '.gitattributes'), '*.txt text=auto\n');
  git(root, ['add', '.gitattributes']);
  git(root, ['commit', '-m', 'add attributes', '-q']);
  const headWithAttrs = git(root, ['rev-parse', 'HEAD']).trim();
  writeFileSync(join(root, 'file.txt'), 'hello\r\n');
  const allowed_files = [{ path: 'file.txt', action: 'present' }];
  const envelope = baseEnvelope({
    base_commit: base, expected_pre_publish_head: headWithAttrs, allowed_files,
    publication_fingerprint: '0'.repeat(64),
  });
  const result = preflight(envelope, root);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'CONTENT_TRANSFORM_ATTRIBUTE_BLOCKED');
  assert.equal(result.attribute, 'text');
});

test('COMMITTED: core.autocrlf cannot silently alter staged bytes (CRLF file, no attributes)', () => {
  const root = tempRepo('autocrlf');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  git(root, ['config', 'core.autocrlf', 'input']);
  const raw = Buffer.from('line-one\r\nline-two\r\n');
  writeFileSync(join(root, 'crlf.txt'), raw);
  const allowed_files = [{ path: 'crlf.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const receipt = buildLocalCommit(envelope, root);
  assert.equal(receipt.status, 'COMMITTED');
  const committed = git(root, ['show', `${receipt.commit_sha}:crlf.txt`]);
  assert.ok(committed.includes('\r\n'), 'CRLF bytes were normalized despite core.autocrlf override');
});

test('BLOCKED: staged blob differs from raw-worktree blob (hostile hash-object lie) -- index fully restored', () => {
  const root = tempRepo('blobmismatch');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const realExecFileSync = execFileSync;
  let hashObjectCalls = 0;
  const lyingImpl = (cmd, args, opts) => {
    // The raw-worktree hash-object call happens twice: once during preflight's fingerprint
    // computation (must stay real so preflight passes), and once during the post-staging blob-
    // identity proof (lie here) -- so only the second call is corrupted.
    if (args.includes('hash-object') && args.includes('--no-filters')) {
      hashObjectCalls += 1;
      if (hashObjectCalls > 1) return Buffer.from(`${'f'.repeat(40)}\n`);
    }
    return realExecFileSync(cmd, args, opts);
  };
  const receipt = buildLocalCommit(envelope, root, { execFileSyncImpl: lyingImpl });
  assert.equal(receipt.status, 'BLOCKED');
  assert.equal(JSON.parse(receipt.failure_reason).reason, 'STAGED_BLOB_MISMATCH');
  assert.equal(git(root, ['diff', '--cached', '--name-only']).trim(), '', 'index must be fully restored after a staged-blob mismatch');
  assert.equal(git(root, ['log', '--oneline']).trim().split('\n').length, 1, 'no commit must have been created');
});

test('COMMITTED: binary file with no gitattributes succeeds (no transform applies)', () => {
  const root = tempRepo('binary');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  const binary = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x00, 0x89, 0x50, 0x4e, 0x47]);
  writeFileSync(join(root, 'image.bin'), binary);
  const allowed_files = [{ path: 'image.bin', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const receipt = buildLocalCommit(envelope, root);
  assert.equal(receipt.status, 'COMMITTED');
  const wantSha = execFileSync('git', ['hash-object', '--no-filters', '--', 'image.bin'], { cwd: root }).toString().trim();
  const gotSha = execFileSync('git', ['rev-parse', `${receipt.commit_sha}:image.bin`], { cwd: root }).toString().trim();
  assert.equal(gotSha, wantSha);
});

test('exported preflight() is isolated from core.fsmonitor even when called directly (not via buildLocalCommit)', () => {
  const root = tempRepo('preflight-fsmonitor');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  const sentinel = join(root, 'PREFLIGHT_FSMONITOR_RAN.txt');
  git(root, ['config', 'core.fsmonitor', `sh -c 'touch "${sentinel}"; echo 1'`]);
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const result = preflight(envelope, root);
  assert.equal(result.status, 'OK');
  assert.throws(() => execFileSync('test', ['-e', sentinel]), 'core.fsmonitor command executed during a direct preflight() call: sentinel file was created');
});

test('BLOCKED: staged-name mismatch leaves the index fully reset (unstage everything)', () => {
  const root = tempRepo('fullreset');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const realExecFileSync = execFileSync;
  const lyingImpl = (cmd, args, opts) => {
    if (args.includes('diff') && args.includes('--cached')) return Buffer.from('new.txt\nextra-not-really-staged.txt\n');
    return realExecFileSync(cmd, args, opts);
  };
  buildLocalCommit(envelope, root, { execFileSyncImpl: lyingImpl });
  const stagedAfter = git(root, ['diff', '--cached', '--name-only']).trim();
  assert.equal(stagedAfter, '', 'index must be fully reset after a BLOCKED staged-name mismatch');
});

test('BLOCKED: PRE_COMMIT_HEAD_CHANGED when HEAD moves between preflight and the final pre-commit check', () => {
  const root = tempRepo('headchanged');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const realExecFileSync = execFileSync;
  const fakeHead = 'f'.repeat(40);
  let headCalls = 0;
  // Exactly `rev-parse HEAD` (as the last two tokens) is called once during preflight (must return
  // the real HEAD so preflight passes) and once more immediately before commit (this simulates HEAD
  // having moved in between -- e.g. a concurrent process committing on the same branch).
  const isHeadCall = (args) => args.length >= 2 && args[args.length - 2] === 'rev-parse' && args[args.length - 1] === 'HEAD';
  const lyingImpl = (cmd, args, opts) => {
    if (isHeadCall(args)) {
      headCalls += 1;
      if (headCalls > 1) return Buffer.from(`${fakeHead}\n`);
    }
    return realExecFileSync(cmd, args, opts);
  };
  const receipt = buildLocalCommit(envelope, root, { execFileSyncImpl: lyingImpl });
  assert.equal(receipt.status, 'BLOCKED');
  assert.equal(JSON.parse(receipt.failure_reason).reason, 'PRE_COMMIT_HEAD_CHANGED');
  assert.equal(git(root, ['rev-parse', 'HEAD']).trim(), base, 'HEAD must remain unchanged -- no commit made');
  assert.equal(git(root, ['diff', '--cached', '--name-only']).trim(), '', 'index must be exactly restored');
});

test('BLOCKED: INDEX_RESTORE_FAILED when read-tree lies about success without actually restoring the index', () => {
  const root = tempRepo('restorelies');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const realExecFileSync = execFileSync;
  // Induce a normal post-staging BLOCKED condition, then have `read-tree` report success (exit 0)
  // without actually running it -- the exact case the write-tree re-verification exists to catch,
  // distinct from read-tree throwing outright (covered by the sibling test above).
  const lyingImpl = (cmd, args, opts) => {
    if (args.includes('diff') && args.includes('--cached')) return Buffer.from('new.txt\nextra-not-really-staged.txt\n');
    if (args.includes('read-tree')) return Buffer.from('');
    return realExecFileSync(cmd, args, opts);
  };
  const receipt = buildLocalCommit(envelope, root, { execFileSyncImpl: lyingImpl });
  assert.equal(receipt.status, 'BLOCKED');
  const parsed = JSON.parse(receipt.failure_reason);
  assert.equal(parsed.reason, 'INDEX_RESTORE_FAILED');
  assert.equal(parsed.triggering_reason, 'STAGED_NAME_MISMATCH');
  assert.equal(git(root, ['diff', '--cached', '--name-only']).trim(), 'new.txt', 'the un-restored staged content must still be present, proving the lie was caught');
});

test('BLOCKED: STAGED_FINGERPRINT_MISMATCH when a file mutates between preflight and staging (mutation race)', () => {
  const root = tempRepo('mutationrace');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  const filePath = join(root, 'race.txt');
  writeFileSync(filePath, 'version A -- what the Envelope fingerprint was computed over\n');
  const allowed_files = [{ path: 'race.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const realExecFileSync = execFileSync;
  let mutated = false;
  // Simulates a file changing after preflight's fingerprint check succeeded but before `git add`
  // actually stages it: version B (never authorized by the Envelope) is what gets staged.
  const lyingImpl = (cmd, args, opts) => {
    if (!mutated && args.includes('add') && args.includes('race.txt')) {
      mutated = true;
      writeFileSync(filePath, 'version B -- never authorized by the Envelope\n');
    }
    return realExecFileSync(cmd, args, opts);
  };
  const receipt = buildLocalCommit(envelope, root, { execFileSyncImpl: lyingImpl });
  assert.equal(receipt.status, 'BLOCKED');
  assert.equal(JSON.parse(receipt.failure_reason).reason, 'STAGED_FINGERPRINT_MISMATCH');
  assert.equal(git(root, ['rev-parse', 'HEAD']).trim(), base, 'HEAD must remain unchanged -- no commit made');
  assert.equal(git(root, ['diff', '--cached', '--name-only']).trim(), '', 'index must be exactly restored, not left holding version B');
});

test('BLOCKED: INDEX_RESTORE_FAILED surfaces distinctly when read-tree restoration cannot be verified', () => {
  const root = tempRepo('restorefail');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  writeFileSync(join(root, 'new.txt'), 'hello\n');
  const allowed_files = [{ path: 'new.txt', action: 'present' }];
  const fingerprint = computeFingerprint(root, classifyAllowedFiles(root, allowed_files, base).classified);
  const envelope = baseEnvelope({ base_commit: base, expected_pre_publish_head: base, allowed_files, publication_fingerprint: fingerprint });
  const realExecFileSync = execFileSync;
  // Induce a normal post-staging BLOCKED condition (a lying `diff --cached` producing a staged-name
  // mismatch), then additionally break `read-tree` restoration itself -- the Builder must not report
  // the original STAGED_NAME_MISMATCH as though cleanup succeeded when it did not.
  const lyingImpl = (cmd, args, opts) => {
    if (args.includes('diff') && args.includes('--cached')) return Buffer.from('new.txt\nextra-not-really-staged.txt\n');
    if (args.includes('read-tree')) {
      throw new Error('simulated read-tree failure');
    }
    return realExecFileSync(cmd, args, opts);
  };
  const receipt = buildLocalCommit(envelope, root, { execFileSyncImpl: lyingImpl });
  assert.equal(receipt.status, 'BLOCKED');
  const parsed = JSON.parse(receipt.failure_reason);
  assert.equal(parsed.reason, 'INDEX_RESTORE_FAILED');
  assert.equal(parsed.triggering_reason, 'STAGED_NAME_MISMATCH', 'original triggering reason must be preserved as diagnostic data');
  assert.equal(git(root, ['diff', '--cached', '--name-only']).trim(), 'new.txt', 'restoration genuinely failed -- the real staged content must still be present, not silently cleaned');
});

test('computeFingerprint uses true UTF-8 byte-order sort, not UTF-16 code-unit order', () => {
  const root = tempRepo('utf8sort');
  const base = initRepo(root);
  branchAt(root, 'chore/test-branch', base);
  const pathE000 = '\u{E000}.txt'; // UTF-8: 0xEE 0x80 0x80
  const path10000 = '\u{10000}.txt'; // UTF-8: 0xF0 0x90 0x80 0x80 -- but UTF-16 leading surrogate 0xD800 < 0xE000
  writeFileSync(join(root, pathE000), 'a\n');
  writeFileSync(join(root, path10000), 'b\n');
  const allowed_files = [
    { path: pathE000, action: 'present' },
    { path: path10000, action: 'present' },
  ];
  const classified = classifyAllowedFiles(root, allowed_files, base).classified;
  const actual = computeFingerprint(root, classified);

  const digestE000 = execFileSync('git', ['hash-object', '--no-filters', '--', pathE000], { cwd: root, encoding: 'utf8' }).trim();
  const digest10000 = execFileSync('git', ['hash-object', '--no-filters', '--', path10000], { cwd: root, encoding: 'utf8' }).trim();
  const digestByPath = { [pathE000]: digestE000, [path10000]: digest10000 };
  const recipe = (orderedPaths) => {
    const hash = createHash('sha256');
    for (const p of orderedPaths) {
      hash.update(p, 'utf8');
      hash.update(Buffer.from([0]));
      hash.update(digestByPath[p], 'utf8');
      hash.update('\n', 'utf8');
    }
    return hash.digest('hex');
  };

  // U+E000 (0xEE...) sorts before U+10000 (0xF0...) in UTF-8 byte order.
  const utf8ByteOrder = [pathE000, path10000];
  // U+10000's UTF-16 leading surrogate (0xD800) sorts below U+E000's single code unit (0xE000).
  const utf16CodeUnitOrder = [path10000, pathE000];

  assert.equal(actual, recipe(utf8ByteOrder), 'computeFingerprint must follow UTF-8 byte order');
  assert.notEqual(actual, recipe(utf16CodeUnitOrder), 'computeFingerprint must NOT follow UTF-16 code-unit order');
});

test('parseGitHubRemote handles https and ssh forms, rejects anything else', () => {
  assert.deepEqual(parseGitHubRemote('https://github.com/mihvernetwork/mihver.git'), { owner: 'mihvernetwork', name: 'mihver' });
  assert.deepEqual(parseGitHubRemote('git@github.com:mihvernetwork/mihver.git'), { owner: 'mihvernetwork', name: 'mihver' });
  assert.equal(parseGitHubRemote('not-a-remote-url'), null);
  assert.equal(parseGitHubRemote('https://gitlab.com/foo/bar.git'), null);
});

// --- cleanup ---------------------------------------------------------------------------------

for (const root of roots) rmSync(root, { recursive: true, force: true });
console.log(`publication-builder.test.mjs: ${passed} passed`);
