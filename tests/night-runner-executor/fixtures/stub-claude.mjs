#!/usr/bin/env node
import { appendFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

if (process.argv.includes('--help')) {
  const delay = Number(process.env.STUB_HELP_DELAY_MS ?? 0);
  if (delay > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
  process.stdout.write(process.env.STUB_HELP ?? [
    '--print', '--output-format', '--permission-mode', '--no-session-persistence', '--tools', '--strict-mcp-config'
  ].join('\n'));
  process.exit(0);
}

if (process.env.STUB_PID_FILE) appendFileSync(process.env.STUB_PID_FILE, `${process.pid}\n`);
if (process.env.STUB_ARGS_FILE) writeFileSync(process.env.STUB_ARGS_FILE, JSON.stringify(process.argv.slice(2)));
if (process.env.STUB_CWD_FILE) writeFileSync(process.env.STUB_CWD_FILE, process.cwd());
if (process.env.STUB_STDOUT) process.stdout.write(process.env.STUB_STDOUT);
if (process.env.STUB_STDERR) process.stderr.write(process.env.STUB_STDERR);

if (process.env.STUB_GRANDCHILD_MARKER) {
  spawn(process.execPath, ['-e', `setTimeout(() => require('fs').writeFileSync(${JSON.stringify(process.env.STUB_GRANDCHILD_MARKER)}, 'survived'), 1500)`], {
    stdio: 'ignore'
  });
}
if (process.env.STUB_IGNORE_SIGTERM === '1') process.on('SIGTERM', () => {});
setTimeout(() => process.exit(Number(process.env.STUB_EXIT_CODE ?? 0)), Number(process.env.STUB_DELAY_MS ?? 0));
