#!/usr/bin/env node
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { discoverClaudeCli, executeTask, inspectWorkspaceIsolation } from '../../scripts/dev/night-runner-executor.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const stubPath = join(here, 'fixtures', 'stub-claude.mjs');
const roots = [];
const savedEnv = { ...process.env };
let passed = 0;
const taskkillCalls = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function tempRoot(label) {
  const root = mkdtempSync(join(tmpdir(), `mihver-executor-${label}-`));
  roots.push(root);
  return root;
}
function setup(label) {
  const base = tempRoot(label);
  const repoRoot = join(base, 'repo');
  mkdirSync(join(repoRoot, '.project'), { recursive: true });
  return {
    base, repoRoot, pidFile: join(base, 'pids.txt'), argsFile: join(base, 'args.json'),
    cwdFile: join(base, 'cwd.txt'),
    descriptor: { task_id: label, branch: `feat/${label}`, authorized: true, prompt: 'perform the test task', timeout_seconds: 3 }
  };
}
function options(c, extra = {}) {
  const windowsTaskkill = process.platform === 'win32' ? {
    taskkillSpawn: (command, args) => {
      taskkillCalls.push([command, ...args]);
      try { process.kill(Number(args[1])); } catch {}
      return { unref() {} };
    }
  } : {};
  return { repoRoot: c.repoRoot, claudeCommand: [process.execPath, stubPath], stopPollMs: 25, killGraceMs: 500, ...windowsTaskkill, ...extra };
}
function configureStub(c, values = {}) {
  for (const key of Object.keys(process.env)) if (key.startsWith('STUB_')) delete process.env[key];
  Object.assign(process.env, { STUB_PID_FILE: c.pidFile, STUB_ARGS_FILE: c.argsFile, STUB_CWD_FILE: c.cwdFile }, values);
}
async function test(name, body) {
  try {
    await body();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}\n${error.stack ?? error}`);
    throw error;
  }
}
function assertNeverInvoked(c) { assert.equal(existsSync(c.pidFile), false); }
function assertWorkspace(result) { assert.equal(typeof result.workspace_dir, 'string'); assert.ok(result.workspace_dir.length > 0); }
function enoent(message = 'spawn claude ENOENT') { const error = new Error(message); error.code = 'ENOENT'; return error; }
function resolutionPaths(c) {
  if (process.platform !== 'win32') return { candidate: process.execPath, executable: process.execPath };
  const bin = join(c.base, 'npm-bin');
  const executable = join(bin, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
  mkdirSync(dirname(executable), { recursive: true });
  copyFileSync(process.execPath, executable);
  return { candidate: join(bin, 'claude.cmd'), executable };
}

try {
  await test('STOP switch refuses before spawn', async () => {
    const c = setup('stop'); configureStub(c); writeFileSync(join(c.repoRoot, '.project', 'STOP'), 'stop');
    const result = await executeTask(c.descriptor, options(c));
    assert.equal(result.reason, 'STOP_ACTIVE'); assertWorkspace(result); assertNeverInvoked(c);
  });
  await test('unauthorized task refuses before spawn', async () => {
    const c = setup('unauthorized'); configureStub(c);
    const result = await executeTask({ ...c.descriptor, authorized: false }, options(c));
    assert.equal(result.reason, 'UNAUTHORIZED'); assertWorkspace(result); assertNeverInvoked(c);
  });
  await test('main branch refuses before spawn', async () => {
    const c = setup('main'); configureStub(c);
    const result = await executeTask({ ...c.descriptor, branch: 'main' }, options(c));
    assert.equal(result.reason, 'MAIN_BRANCH_FORBIDDEN'); assertNeverInvoked(c);
  });
  await test('missing and empty branches refuse', async () => {
    for (const branch of [undefined, '']) {
      const c = setup(`branch-${branch === '' ? 'empty' : 'missing'}`); configureStub(c);
      const result = await executeTask({ ...c.descriptor, branch }, options(c));
      assert.equal(result.reason, 'MAIN_BRANCH_FORBIDDEN'); assertNeverInvoked(c);
    }
  });
  await test('invalid timeouts refuse before spawn', async () => {
    for (const timeout_seconds of [undefined, 0, -1, Number.NaN]) {
      const c = setup(`timeout-${String(timeout_seconds)}`); configureStub(c);
      const result = await executeTask({ ...c.descriptor, timeout_seconds }, options(c));
      assert.equal(result.reason, 'INVALID_TASK'); assertNeverInvoked(c);
    }
  });
  await test('bidirectional containment rejects repo child and repo ancestor workspaces', async () => {
    const c = setup('containment');
    const child = join(c.repoRoot, 'child'); mkdirSync(child);
    assert.equal(inspectWorkspaceIsolation(c.repoRoot, child).isolated, false);
    assert.equal(inspectWorkspaceIsolation(c.repoRoot, c.base).isolated, false);
    assert.equal(inspectWorkspaceIsolation(c.repoRoot, c.repoRoot).isolated, false);
  });
  await test('realpath rejects a symlink or junction alias into the repo when supported', async () => {
    const c = setup('alias');
    const alias = join(c.base, 'alias');
    try {
      symlinkSync(c.repoRoot, alias, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      console.log(`SKIP NOTE symlink/junction unavailable: ${error.code ?? error.message}`);
      return;
    }
    assert.equal(inspectWorkspaceIsolation(c.repoRoot, alias).isolated, false);
  });
  await test('CLI discovery names every missing required flag and refuses execution', async () => {
    const c = setup('discovery'); configureStub(c, { STUB_HELP: '--print\n--output-format\n' });
    const discovery = discoverClaudeCli(options(c));
    assert.deepEqual(discovery.missing, ['--permission-mode', '--no-session-persistence', '--tools', '--strict-mcp-config']);
    const result = await executeTask(c.descriptor, options(c));
    assert.equal(result.reason, 'CLI_DISCOVERY_FAILED'); assertNeverInvoked(c);
  });
  await test('CLI discovery timeout fails closed', async () => {
    const c = setup('discovery-timeout'); configureStub(c, { STUB_HELP_DELAY_MS: '500' });
    const discovery = discoverClaudeCli(options(c, { discoveryTimeoutMs: 50 }));
    assert.equal(discovery.ok, false); assert.equal(discovery.reason, 'CLI_DISCOVERY_FAILED');
  });
  await test('resolver lookup timeout fails closed for discovery and execution', async () => {
    const timeoutError = () => Object.assign(new Error('lookup timed out'), { code: 'ETIMEDOUT' });
    const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
    const discoveryCalls = [];
    const discovery = discoverClaudeCli({
      claudeCommand: ['claude'], discoveryTimeoutMs: 37,
      spawnSyncImpl: (command, args, spawnOptions) => {
        discoveryCalls.push([command, spawnOptions.timeout]);
        return command === lookupCommand
          ? { error: timeoutError(), status: null, signal: 'SIGTERM', stdout: '' }
          : { error: enoent('original discovery ENOENT'), status: null, stdout: '' };
      }
    });
    assert.equal(discovery.reason, 'CLI_DISCOVERY_FAILED');
    assert.ok(discoveryCalls.some(([command, timeout]) => command === lookupCommand && timeout === 37));

    const c = setup('resolver-timeout'); configureStub(c);
    const spawnSyncImpl = (command, args, spawnOptions) => command === lookupCommand
      ? { error: timeoutError(), status: null, signal: 'SIGTERM', stdout: '' }
      : spawnSync(process.execPath, [stubPath, ...args], spawnOptions);
    const result = await executeTask(c.descriptor, options(c, {
      claudeCommand: ['claude', stubPath], discoveryTimeoutMs: 37, spawnSyncImpl,
      spawnImpl: () => { throw enoent('original execution ENOENT'); }
    }));
    assert.equal(result.outcome, 'FAILED'); assert.equal(result.error, 'original execution ENOENT');
  });
  await test('CLI discovery resolves ENOENT command and probes the resolved executable', async () => {
    const c = setup('discovery-resolution'); configureStub(c);
    const paths = resolutionPaths(c); const calls = [];
    const spawnSyncImpl = (command, args, spawnOptions) => {
      calls.push([command, spawnOptions.shell]);
      if (command === 'claude') return { error: enoent(), status: null, stdout: '', stderr: '' };
      if (command === (process.platform === 'win32' ? 'where' : 'which')) return { status: 0, stdout: `${paths.candidate}\n`, stderr: '' };
      return spawnSync(command, args, spawnOptions);
    };
    const result = discoverClaudeCli({ claudeCommand: ['claude', stubPath], spawnSyncImpl });
    assert.equal(result.ok, true); assert.equal(result.command, paths.executable);
    assert.ok(calls.some(([command]) => command === paths.executable));
    assert.ok(calls.every(([, shell]) => shell === false));
  });
  await test('execution resolves async ENOENT and retries with the resolved executable', async () => {
    const c = setup('execution-resolution'); configureStub(c);
    const paths = resolutionPaths(c); const spawnCalls = [];
    const spawnSyncImpl = (command, args, spawnOptions) => {
      if (command === 'claude') return spawnSync(process.execPath, [stubPath, ...args], spawnOptions);
      if (command === (process.platform === 'win32' ? 'where' : 'which')) return { status: 0, stdout: `${paths.candidate}\n`, stderr: '' };
      return spawnSync(command, args, spawnOptions);
    };
    const spawnImpl = (command, args, spawnOptions) => {
      spawnCalls.push([command, spawnOptions.shell]);
      if (command === 'claude') {
        const child = new EventEmitter();
        queueMicrotask(() => child.emit('error', enoent('original execution ENOENT')));
        return child;
      }
      return spawn(command, args, spawnOptions);
    };
    const result = await executeTask(c.descriptor, options(c, { claudeCommand: ['claude', stubPath], spawnSyncImpl, spawnImpl }));
    assert.equal(result.outcome, 'COMPLETED'); assert.equal(result.command[0], paths.executable);
    assert.deepEqual(spawnCalls.map(([command]) => command), ['claude', paths.executable]);
    assert.ok(spawnCalls.every(([, shell]) => shell === false));
  });
  await test('failed resolution preserves discovery and execution failure outcomes', async () => {
    const discovery = discoverClaudeCli({ claudeCommand: ['claude'], spawnSyncImpl: (command) => command === 'claude'
      ? { error: enoent('original discovery ENOENT'), status: null } : { status: 1, stdout: '' } });
    assert.equal(discovery.reason, 'CLI_DISCOVERY_FAILED'); assert.equal(discovery.error, 'original discovery ENOENT');

    const c = setup('resolution-failure'); configureStub(c);
    const spawnSyncImpl = (command, args, spawnOptions) => command === 'claude'
      ? spawnSync(process.execPath, [stubPath, ...args], spawnOptions) : { status: 0, stdout: '' };
    const spawnImpl = () => { throw enoent('original execution ENOENT'); };
    const result = await executeTask(c.descriptor, options(c, { claudeCommand: ['claude', stubPath], spawnSyncImpl, spawnImpl }));
    assert.equal(result.outcome, 'FAILED'); assert.equal(result.error, 'original execution ENOENT');
  });
  await test('executor source never enables shell:true', async () => {
    const source = readFileSync(join(here, '..', '..', 'scripts', 'dev', 'night-runner-executor.mjs'), 'utf8');
    const codeOnly = source.replace(/\/\/.*$/gm, '');
    assert.equal(/shell\s*:\s*true/.test(codeOnly), false);
  });
  await test('happy path uses executor workspace and restricted fresh-process flags', async () => {
    const c = setup('happy'); configureStub(c, { STUB_STDOUT: 'known stdout', STUB_STDERR: 'known stderr', STUB_DELAY_MS: '20' });
    const result = await executeTask({ ...c.descriptor, workspace_dir: c.repoRoot }, options(c));
    assert.equal(result.outcome, 'COMPLETED'); assert.equal(result.stdout, 'known stdout'); assert.equal(result.stderr, 'known stderr');
    assert.equal(realpathSync(readFileSync(c.cwdFile, 'utf8')), result.workspace_dir);
    const args = JSON.parse(readFileSync(c.argsFile, 'utf8'));
    for (const flag of ['--print', '--output-format', '--permission-mode', '--no-session-persistence', '--tools', '--strict-mcp-config']) assert.ok(args.includes(flag));
    for (const flag of ['-c', '--continue', '-r', '--resume', '--dangerously-skip-permissions', '--allow-dangerously-skip-permissions']) assert.equal(args.includes(flag), false);
    assert.equal(args[args.indexOf('--tools') + 1], 'Read,Write,Edit');
    assertWorkspace(result);
  });
  await test('approved configurable capabilities are canonicalized and passed', async () => {
    const c = setup('options'); configureStub(c);
    const result = await executeTask(c.descriptor, options(c, { toolAllowlist: ['read', 'EDIT'], permissionMode: 'ACCEPTEDITS' }));
    assert.equal(result.outcome, 'COMPLETED');
    const args = JSON.parse(readFileSync(c.argsFile, 'utf8'));
    assert.equal(args[args.indexOf('--tools') + 1], 'Read,Edit');
    assert.equal(args[args.indexOf('--permission-mode') + 1], 'acceptEdits');
  });
  await test('unapproved configurable capabilities refuse before spawn', async () => {
    for (const extra of [
      { toolAllowlist: 'default' },
      { toolAllowlist: ['Read', 'Grep'] },
      { permissionMode: 'auto' },
      { toolAllowlist: ['Read', 'Bash'] },
      { permissionMode: 'bypassPermissions' }
    ]) {
      const c = setup('unsafe'); configureStub(c);
      const result = await executeTask(c.descriptor, options(c, extra));
      assert.equal(result.reason, 'INVALID_OPTIONS'); assertNeverInvoked(c);
    }
  });
  await test('non-zero exit is failed', async () => {
    const c = setup('failure'); configureStub(c, { STUB_EXIT_CODE: '2' });
    const result = await executeTask(c.descriptor, options(c));
    assert.equal(result.outcome, 'FAILED'); assert.equal(result.exit_code, 2);
  });
  await test('STOP appearing during execution kills child with distinct outcome', async () => {
    const c = setup('mid-stop'); configureStub(c, { STUB_DELAY_MS: '5000' });
    setTimeout(() => writeFileSync(join(c.repoRoot, '.project', 'STOP'), 'stop'), 100);
    const result = await executeTask(c.descriptor, options(c));
    assert.equal(result.outcome, 'STOPPED'); assert.equal(result.stop_detected, true); assert.equal(result.timed_out, false);
  });
  await test('timeout terminates the whole child process tree', async () => {
    const c = setup('tree'); const marker = join(c.base, 'grandchild-survived');
    configureStub(c, {
      STUB_DELAY_MS: '5000', STUB_IGNORE_SIGTERM: '1',
      ...(process.platform === 'win32' ? {} : { STUB_GRANDCHILD_MARKER: marker })
    });
    const result = await executeTask({ ...c.descriptor, timeout_seconds: 0.2 }, options(c));
    assert.equal(result.outcome, 'TIMED_OUT'); assert.equal(result.timed_out, true);
    if (process.platform === 'win32') {
      assert.ok(taskkillCalls.some((call) => call[0] === 'taskkill' && call.includes('/t') && call.includes('/f')));
      console.log('NOTE Windows unit test verifies taskkill /pid /t /f dispatch; OS process-group behavior is POSIX-only.');
    } else {
      await sleep(1800);
      assert.equal(existsSync(marker), false);
    }
  });
  await test('kill-grace resolves when a child never emits close', async () => {
    const c = setup('uncertain'); configureStub(c);
    const fake = new EventEmitter();
    const started = Date.now();
    const result = await executeTask({ ...c.descriptor, timeout_seconds: 0.05 }, options(c, {
      spawnImpl: () => fake, killGraceMs: 80
    }));
    assert.equal(result.outcome, 'TIMED_OUT'); assert.equal(result.termination_uncertain, true);
    assert.ok(Date.now() - started < 1000);
  });
  await test('each execution uses a fresh process and fresh workspace', async () => {
    const c = setup('fresh'); configureStub(c);
    const first = await executeTask(c.descriptor, options(c));
    const second = await executeTask(c.descriptor, options(c));
    const pids = readFileSync(c.pidFile, 'utf8').trim().split(/\r?\n/);
    assert.equal(pids.length, 2); assert.notEqual(pids[0], pids[1]); assert.notEqual(first.workspace_dir, second.workspace_dir);
  });
  console.log(`\n${passed} executor tests passed.`);
} catch {
  process.exitCode = 1;
} finally {
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
  for (const root of roots) rmSync(root, { recursive: true, force: true });
}
