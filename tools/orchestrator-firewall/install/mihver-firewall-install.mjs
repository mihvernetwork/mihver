#!/usr/bin/env node

import { constants } from 'node:fs';
import {
  access, chmod, copyFile, mkdir, mkdtemp, readFile, realpath, readdir, rename, rm, stat, writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildManifest, FIREWALL_VERSION, hashFile, readManifest, readSourceCommit, sha256,
  VALIDATOR_VERSION, verifyManifest,
} from './manifest.mjs';

const EVENTS = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'UserPromptSubmit', 'Stop', 'ConfigChange',
];
const OWNER_MARKER = 'MIHVER_OWNER=orchestrator-firewall-v1';
const HOOK_TIMEOUT_SECONDS = 10;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(scriptDir, '../../..');
const loaderTemplatePath = join(scriptDir, 'loader-template.mjs');

function usage() {
  return `Usage: node mihver-firewall-install.mjs [--dry-run|--install|--uninstall|--status] [--home <path>] [--repo-root <path>]

Modes are mutually exclusive. With no mode, --dry-run is used.`;
}

function parseArgs(argv) {
  const options = { mode: 'dry-run', home: homedir(), repoRoot: defaultRepoRoot };
  let selectedMode = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (['--dry-run', '--install', '--uninstall', '--status'].includes(arg)) {
      if (selectedMode) throw new Error('choose exactly one mode');
      options.mode = arg.slice(2);
      selectedMode = true;
    } else if (arg === '--home' || arg === '--repo-root') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a path`);
      options[arg === '--home' ? 'home' : 'repoRoot'] = resolve(value);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

async function exists(path) {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}

async function readSettings(settingsPath) {
  if (!(await exists(settingsPath))) return { settings: {}, existed: false, raw: '{}\n' };
  const raw = await readFile(settingsPath, 'utf8');
  try {
    const settings = JSON.parse(raw);
    if (!settings || Array.isArray(settings) || typeof settings !== 'object') {
      throw new Error('top level must be a JSON object');
    }
    if (settings.hooks !== undefined
        && (!settings.hooks || Array.isArray(settings.hooks) || typeof settings.hooks !== 'object')) {
      throw new Error('top-level hooks must be a JSON object when present');
    }
    return { settings, existed: true, raw };
  } catch (error) {
    throw new Error(`refusing to change malformed settings JSON at ${settingsPath}: ${error.message}`);
  }
}

async function listFiles(root, logicalPrefix) {
  const output = [];
  async function visit(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) output.push({ source: path, logical: join(logicalPrefix, relative(root, path)) });
      else throw new Error(`unsupported non-regular engine file: ${path}`);
    }
  }
  await visit(root);
  return output;
}

async function inspectSource(repoRoot) {
  const binRoot = join(repoRoot, 'tools/orchestrator-firewall/bin');
  const srcRoot = join(repoRoot, 'tools/orchestrator-firewall/src');
  const entrySource = join(binRoot, 'mihver-firewall.mjs');
  for (const required of [binRoot, srcRoot, entrySource]) {
    if (!(await exists(required))) throw new Error(`required firewall engine path is missing: ${required}`);
  }
  const sourceFiles = await listFiles(srcRoot, 'src');
  sourceFiles.push({ source: entrySource, logical: 'src/dispatcher.mjs' });
  const hashes = {};
  for (const file of sourceFiles) hashes[file.logical] = await hashFile(file.source);
  const sourceCommit = readSourceCommit(repoRoot);
  return { sourceFiles, hashes, entrySource, sourceCommit };
}

function installLayout(home, shortHash) {
  const claudeRoot = join(home, '.claude');
  const trustRoot = join(claudeRoot, 'mihver-firewall');
  const entryName = `mihver-firewall-${FIREWALL_VERSION}-${shortHash}.mjs`;
  return {
    claudeRoot,
    trustRoot,
    settingsPath: join(claudeRoot, 'settings.json'),
    manifestPath: join(trustRoot, 'manifest.json'),
    installedEntry: join(trustRoot, 'bin', entryName),
    executableManifestPath: join(trustRoot, 'bin', `${entryName}.manifest.json`),
    engineDir: join(trustRoot, 'releases', shortHash, 'src'),
  };
}

function hookCommand(installedEntry) {
  return `${JSON.stringify(installedEntry)} # ${OWNER_MARKER}`;
}

function requiredHook(command) {
  return { hooks: [{ type: 'command', command, timeout: HOOK_TIMEOUT_SECONDS }] };
}

function isOwnedHook(group, trustRoot) {
  // Ownership is a collision-resistant convention, not authentication: both
  // the trust-root path prefix and trailing marker must match.
  if (!group || !Array.isArray(group.hooks) || group.hooks.length !== 1) return false;
  const command = group.hooks[0]?.command;
  const binPrefix = `${join(trustRoot, 'bin')}${sep}`;
  if (typeof command !== 'string' || !command.endsWith(`# ${OWNER_MARKER}`)) return false;
  try {
    const executable = JSON.parse(command.slice(0, command.indexOf(' # ')));
    return typeof executable === 'string'
      && isAbsolute(executable)
      && resolve(executable) === executable
      && executable.startsWith(binPrefix);
  } catch {
    return false;
  }
}

function mergedSettings(settings, command) {
  const result = structuredClone(settings);
  result.hooks ??= {};
  for (const event of EVENTS) {
    const existing = Array.isArray(result.hooks[event]) ? result.hooks[event] : [];
    result.hooks[event] = [...existing.filter((group) => !isOwnedHook(group, dirname(dirname(commandPath(command))))), requiredHook(command)];
  }
  return result;
}

function commandPath(command) {
  return JSON.parse(command.slice(0, command.indexOf(' # ')));
}

function removeOwnedHooks(settings, trustRoot) {
  const result = structuredClone(settings);
  const removed = {};
  if (!result.hooks) return { settings: result, removed };
  for (const [event, groups] of Object.entries(result.hooks)) {
    if (!Array.isArray(groups)) continue;
    const kept = groups.filter((group) => !isOwnedHook(group, trustRoot));
    const count = groups.length - kept.length;
    if (count) removed[event] = count;
    if (kept.length) result.hooks[event] = kept;
    else delete result.hooks[event];
  }
  if (Object.keys(result.hooks).length === 0) delete result.hooks;
  return { settings: result, removed };
}

function serialized(settings) {
  const text = `${JSON.stringify(settings, null, 2)}\n`;
  JSON.parse(text);
  return text;
}

async function atomicWrite(path, content, expectedCurrent) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${process.pid}.${Date.now()}.tmp`);
  await writeFile(temporary, content, { mode: 0o600, flag: 'wx' });
  await readFile(temporary, 'utf8').then(JSON.parse);
  if (expectedCurrent !== undefined) {
    let observed;
    try { observed = await readFile(path, 'utf8'); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      observed = '{}\n';
    }
    if (observed !== expectedCurrent) {
      await rm(temporary, { force: true });
      throw new Error('settings.json changed concurrently; refusing to overwrite it');
    }
  }
  await rename(temporary, path);
}

function timestamp() {
  return new Date().toISOString();
}

async function canonicalRoot(repoRoot) {
  return realpath(repoRoot);
}

async function prepare(options) {
  const root = await canonicalRoot(options.repoRoot);
  const source = await inspectSource(root);
  const release = await buildRelease(options.home, root, source.hashes, source.sourceCommit);
  const layout = release.layout;
  const current = await readSettings(layout.settingsPath);
  const command = hookCommand(layout.installedEntry);
  const resultSettings = mergedSettings(current.settings, command);
  return { root, source, layout, current, command, resultSettings, release };
}

const validatorSource = verifyManifest.toString();
const currentValidatorHash = sha256(validatorSource);

async function buildRelease(home, root, engineHashes, sourceCommit) {
  const trustRoot = installLayout(home, 'unused').trustRoot;
  const binding = {
    canonicalMihverRoot: root, trustRoot, version: FIREWALL_VERSION, sourceCommit,
    validatorHash: currentValidatorHash, validatorVersion: VALIDATOR_VERSION,
  };
  const loaderBytes = renderLoader(await readFile(loaderTemplatePath, 'utf8'), binding);
  const aggregate = `${Object.entries(engineHashes).sort().map(([name, digest]) => `${name}\0${digest}\n`).join('')}installed-loader.mjs\0${sha256(loaderBytes)}\n`;
  const layout = installLayout(home, sha256(aggregate).slice(0, 12));
  return { binding, loaderBytes, layout };
}

function renderLoader(template, binding) {
  const marker = '/* MIHVER_INSTALL_BINDING */ null';
  const validatorMarker = '/* MIHVER_MANIFEST_VALIDATOR */ null';
  if (template.split(marker).length !== 2) throw new Error('loader template binding marker is missing or duplicated');
  if (template.split(validatorMarker).length !== 2) throw new Error('loader template validator marker is missing or duplicated');
  return template
    .replace(marker, `/* MIHVER_INSTALL_BINDING */ ${JSON.stringify(binding)}`)
    .replace(validatorMarker, `/* MIHVER_MANIFEST_VALIDATOR */ ${validatorSource}`);
}

async function readLoaderBinding(entry) {
  const source = await readFile(entry, 'utf8');
  const match = source.match(/^const INSTALL_BINDING = \/\* MIHVER_INSTALL_BINDING \*\/ (\{[^\n]+\});$/m);
  if (!match) throw new Error('registered executable binding is missing or malformed');
  const binding = JSON.parse(match[1]);
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    throw new Error('registered executable binding is invalid');
  }
  return binding;
}

async function dryRun(options) {
  const plan = await prepare(options);
  console.log('DRY RUN — no files will be written');
  console.log(`settings: ${plan.layout.settingsPath}`);
  console.log(`trust root: ${plan.layout.trustRoot}`);
  console.log(`backup: ${join(plan.layout.trustRoot, 'backups', 'settings.<iso8601>.json')}`);
  for (const file of plan.source.sourceFiles) {
    console.log(`copy: ${file.source} -> ${join(plan.layout.engineDir, file.logical.slice('src/'.length))} sha256=${plan.source.hashes[file.logical]}`);
  }
  console.log(`generate executable: ${plan.layout.installedEntry} from ${loaderTemplatePath}`);
  console.log(`write executable manifest: ${plan.layout.executableManifestPath}`);
  console.log(`write bookkeeping manifest last: ${plan.layout.manifestPath}`);
  console.log('resulting settings.json:');
  process.stdout.write(serialized(plan.resultSettings));
}

export async function install(options, { afterStaging, beforeSettingsRename, afterSettingsWrite } = {}) {
  const plan = await prepare(options); // Malformed settings abort before any write.
  // Stage first, then hash the staged bytes and derive the content address from
  // those hashes. Source mutations after copying cannot poison the address.
  await mkdir(plan.layout.trustRoot, { recursive: true });
  const stagingRoot = await mkdtemp(join(plan.layout.trustRoot, '.staging-'));
  const stagedFiles = [];
  try {
    for (const file of plan.source.sourceFiles) {
      const staged = join(stagingRoot, file.logical);
      await mkdir(dirname(staged), { recursive: true });
      await copyFile(file.source, staged);
      stagedFiles.push({ ...file, staged });
    }
    const stagedLogicalHashes = {};
    for (const file of stagedFiles) stagedLogicalHashes[file.logical] = await hashFile(file.staged);
    if (afterStaging) await afterStaging();
    const sourceCommit = readSourceCommit(plan.root);
    const release = await buildRelease(options.home, plan.root, stagedLogicalHashes, sourceCommit);
    const { layout, binding, loaderBytes } = release;
    const stagedEntry = join(stagingRoot, 'installed-loader.mjs');
    await writeFile(stagedEntry, loaderBytes, { mode: 0o755 });
    const command = hookCommand(layout.installedEntry);
    const resultSettings = mergedSettings(plan.current.settings, command);
  await mkdir(join(plan.layout.trustRoot, 'backups'), { recursive: true });
  const backupPath = join(plan.layout.trustRoot, 'backups', `settings.${timestamp()}.json`);
  await writeFile(backupPath, plan.current.raw, { mode: 0o600, flag: 'wx' });

  const installedHashes = {};
  for (const file of stagedFiles) {
    const relativePath = join(relative(layout.trustRoot, layout.engineDir), file.logical.slice('src/'.length));
    const destination = join(layout.trustRoot, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await rename(file.staged, destination);
    installedHashes[relativePath] = await hashFile(destination);
  }
  await mkdir(dirname(layout.installedEntry), { recursive: true });
  await rename(stagedEntry, layout.installedEntry);
  await chmod(layout.installedEntry, 0o755);
  installedHashes[relative(layout.trustRoot, layout.installedEntry)] = await hashFile(layout.installedEntry);
  const manifest = buildManifest({
    sourceCommit,
    files: installedHashes,
    installTime: new Date().toISOString(),
    canonicalMihverRoot: plan.root,
    trustRoot: layout.trustRoot,
    engineDir: layout.engineDir,
    manifestFilename: layout.executableManifestPath.slice(dirname(layout.executableManifestPath).length + 1),
    installedEntry: layout.installedEntry,
    validatorHash: binding.validatorHash,
    validatorVersion: binding.validatorVersion,
    ownedHookEntries: EVENTS.map((event) => ({ event, entry: requiredHook(command) })),
  });
  // Runtime authority is published before hooks can reference it.
  await atomicWrite(layout.executableManifestPath, serialized(manifest));
  if (beforeSettingsRename) await beforeSettingsRename(layout.settingsPath);
  await atomicWrite(layout.settingsPath, serialized(resultSettings), plan.current.raw);
  if (afterSettingsWrite) await afterSettingsWrite();
  // Non-authoritative bookkeeping is deliberately last.
  await atomicWrite(layout.manifestPath, serialized(manifest));

  console.log(`INSTALLED\nbackup: ${backupPath}\nmanifest: ${layout.manifestPath}`);
  for (const [path, hash] of Object.entries(installedHashes)) {
    console.log(`${join(layout.trustRoot, path)} sha256=${hash}`);
  }
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

async function uninstall(options) {
  const root = await canonicalRoot(options.repoRoot);
  const layout = installLayout(options.home, 'unused');
  const current = await readSettings(layout.settingsPath);
  const result = removeOwnedHooks(current.settings, layout.trustRoot);
  if (Object.keys(result.removed).length === 0) {
    console.log('NOT_INSTALLED — no MIHVER-owned hook entries found; no files changed');
    return;
  }
  const backupRoot = join(layout.trustRoot, 'backups');
  await mkdir(backupRoot, { recursive: true });
  const backupPath = join(backupRoot, `settings.${timestamp()}.json`);
  await writeFile(backupPath, current.raw, { mode: 0o600, flag: 'wx' });
  await atomicWrite(layout.settingsPath, serialized(result.settings));
  console.log(`UNINSTALLED hooks only (installed files and backup history retained)\nMIHVER root: ${root}\nbackup: ${backupPath}`);
  for (const [event, count] of Object.entries(result.removed)) console.log(`removed ${count} from ${event}`);
}

function checkHooks(settings, manifest) {
  const reasons = [];
  const command = hookCommand(manifest.installedEntry);
  for (const event of EVENTS) {
    const groups = settings.hooks?.[event];
    const matches = Array.isArray(groups)
      ? groups.filter((group) => JSON.stringify(group) === JSON.stringify(requiredHook(command))).length
      : 0;
    if (matches !== 1) reasons.push(`${event} required hook count is ${matches}, expected 1`);
  }
  return { valid: reasons.length === 0, reasons };
}

async function status(options) {
  const root = await canonicalRoot(options.repoRoot);
  const layout = installLayout(options.home, 'unused');
  const current = await readSettings(layout.settingsPath);
  const ownedEntries = Object.values(current.settings.hooks ?? {}).flatMap((groups) =>
    Array.isArray(groups) ? groups.filter((group) => isOwnedHook(group, layout.trustRoot)) : []);
  if (!ownedEntries.length) {
    console.log(await exists(layout.trustRoot)
      ? 'NOT_INSTALLED — orphaned firewall artifacts are present; no owned hook registrations exist'
      : 'NOT_INSTALLED — no firewall artifacts or owned hook registrations exist');
    return;
  }
  const registeredEntries = [...new Set(ownedEntries.map((group) => commandPath(group.hooks[0].command)))];
  if (registeredEntries.length !== 1) {
    console.log('DRIFTED — owned hooks reference inconsistent executables. Enforcement may be compromised; protection is NOT in effect.');
    process.exitCode = 2; return;
  }
  const registeredEntry = registeredEntries[0];
  let binding;
  try { binding = await readLoaderBinding(registeredEntry); }
  catch (error) { console.log(`DRIFTED — ${error.message}. Enforcement may be compromised; protection is NOT in effect.`); process.exitCode = 2; return; }
  if (binding.validatorHash !== currentValidatorHash || binding.validatorVersion !== VALIDATOR_VERSION) {
    console.log('DRIFTED — registered loader validates by a different generation. Enforcement may be compromised; protection is NOT in effect.');
    console.log(`- registered validator: hash=${String(binding.validatorHash ?? 'missing')} version=${String(binding.validatorVersion ?? 'missing')}`);
    console.log(`- current validator: hash=${currentValidatorHash} version=${VALIDATOR_VERSION}`);
    console.log('- re-run --install to register the current validator generation');
    process.exitCode = 2; return;
  }
  let manifest;
  try { manifest = await readManifest(`${registeredEntry}.manifest.json`); }
  catch (error) { console.log(`DRIFTED — executable manifest cannot be read: ${error.message}. Enforcement may be compromised; protection is NOT in effect.`); process.exitCode = 2; return; }
  const nameMatch = registeredEntry.startsWith(`${join(layout.trustRoot, 'bin')}${sep}`)
    ? registeredEntry.slice(join(layout.trustRoot, 'bin').length + 1).match(/^mihver-firewall-[^-]+-([0-9a-f]{12})\.mjs$/)
    : null;
  const expected = {
    protocolVersion: 'MIHVER-ORCHESTRATOR-FIREWALL-V1', firewallVersion: binding.version,
    sourceCommit: binding.sourceCommit, canonicalMihverRoot: root, trustRoot: layout.trustRoot,
    installedEntry: registeredEntry,
    engineDir: nameMatch ? join(layout.trustRoot, 'releases', nameMatch[1], 'src') : null,
    manifestFilename: `${registeredEntry.slice(dirname(registeredEntry).length + 1)}.manifest.json`,
    validatorHash: binding.validatorHash, validatorVersion: binding.validatorVersion,
  };
  const shapeVerification = verifyManifest(manifest, expected, {
    executableIdentityValid: binding.installedEntry === undefined || registeredEntry === binding.installedEntry,
  });
  if (!shapeVerification.manifestValid) {
    console.log('DRIFTED — malformed executable manifest. Enforcement may be compromised; protection is NOT in effect.');
    for (const reason of shapeVerification.reasons) console.log(`- ${reason}`);
    process.exitCode = 2; return;
  }
  const observedFiles = {};
  const engineFiles = await listFiles(manifest.engineDir, relative(layout.trustRoot, manifest.engineDir)).catch(() => []);
  for (const candidate of [{ source: manifest.installedEntry, logical: relative(layout.trustRoot, manifest.installedEntry) }, ...engineFiles.filter((file) => file.source.endsWith('.mjs'))]) {
    if (await exists(candidate.source)) observedFiles[candidate.logical] = await hashFile(candidate.source);
  }
  const hooks = checkHooks(current.settings, manifest);
  const expectedSource = await inspectSource(root);
  const expectedNewest = (await buildRelease(options.home, root, expectedSource.hashes, expectedSource.sourceCommit)).layout.installedEntry;
  const verification = verifyManifest(manifest, expected, {
    files: observedFiles,
    executableIdentityValid: binding.installedEntry === undefined || registeredEntry === binding.installedEntry,
    requiredHooksValid: hooks.valid,
    hookReasons: hooks.reasons,
  });
  if (verification.valid) {
    console.log('INSTALLED');
    if (registeredEntry !== expectedNewest && await exists(expectedNewest)) {
      console.log('WARNING — superseded release registered; re-run --install to register the newest installed release');
    }
  }
  else {
    console.log('DRIFTED — enforcement may be compromised; protection is NOT in effect.');
    for (const reason of verification.reasons) console.log(`- ${reason}`);
    process.exitCode = 2;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log(usage()); return; }
  if (options.mode === 'dry-run') await dryRun(options);
  else if (options.mode === 'install') await install(options);
  else if (options.mode === 'uninstall') await uninstall(options);
  else await status(options);
}

// Importing installer helpers must never mutate user state (including from npm lifecycle loading).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`mihver-firewall-install: ${error.message}`);
    process.exitCode = 1;
  });
}
