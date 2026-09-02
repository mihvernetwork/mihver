#!/usr/bin/env node
// Generated installed loader. Do not add static engine imports: trust verification must finish first.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const INSTALL_BINDING = /* MIHVER_INSTALL_BINDING */ null;
const verifyManifest = /* MIHVER_MANIFEST_VALIDATOR */ null;
const output = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
const deny = (reason) => output({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
const failClosed = (code) => {
  let input;
  try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { return; }
  if (input?.hook_event_name === 'PreToolUse') deny(`${code}: installed firewall trust verification failed`);
};
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const enumerateMjs = (root) => {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(candidate);
      else if (entry.isFile() && entry.name.endsWith('.mjs')) files.push(candidate);
      else if (!entry.isFile()) throw new Error('non-regular engine path');
    }
  };
  visit(root);
  return files;
};

let failure = 'FIREWALL_MANIFEST_INVALID';
try {
  const entry = fileURLToPath(import.meta.url);
  const selfHash = hash(entry);
  if (!INSTALL_BINDING || typeof INSTALL_BINDING !== 'object' ||
      !path.isAbsolute(INSTALL_BINDING.canonicalMihverRoot) || !path.isAbsolute(INSTALL_BINDING.trustRoot) ||
      typeof INSTALL_BINDING.version !== 'string' || typeof INSTALL_BINDING.sourceCommit !== 'string' ||
      typeof INSTALL_BINDING.validatorHash !== 'string' || typeof INSTALL_BINDING.validatorVersion !== 'string') {
    throw new Error('invalid embedded binding');
  }
  const nameMatch = path.basename(entry).match(/^mihver-firewall-[^-]+-([0-9a-f]{12})\.mjs$/);
  if (!nameMatch) throw new Error('installed executable filename is invalid');
  const installedEntry = path.join(INSTALL_BINDING.trustRoot, 'bin', path.basename(entry));
  const manifestFilename = `${path.basename(entry)}.manifest.json`;
  const engineDir = path.join(INSTALL_BINDING.trustRoot, 'releases', nameMatch[1], 'src');
  const manifestPath = path.join(path.dirname(entry), manifestFilename);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const shapeVerification = verifyManifest(manifest, {
    protocolVersion: 'MIHVER-ORCHESTRATOR-FIREWALL-V1', firewallVersion: INSTALL_BINDING.version,
    sourceCommit: INSTALL_BINDING.sourceCommit, canonicalMihverRoot: INSTALL_BINDING.canonicalMihverRoot,
    trustRoot: INSTALL_BINDING.trustRoot, installedEntry, engineDir, manifestFilename,
    validatorHash: INSTALL_BINDING.validatorHash, validatorVersion: INSTALL_BINDING.validatorVersion,
  }, {});
  if (!shapeVerification.manifestValid) throw new Error(shapeVerification.reasons.join('; '));
  const enginePaths = enumerateMjs(engineDir);
  const actualPaths = [entry, ...enginePaths];
  const entryRelative = path.relative(INSTALL_BINDING.trustRoot, installedEntry);
  const files = {};
  for (const [index, file] of actualPaths.entries()) {
    const relative = index === 0 ? entryRelative : path.relative(INSTALL_BINDING.trustRoot, file);
    files[relative] = index === 0 ? selfHash : hash(file);
  }
  const verification = verifyManifest(manifest, {
    protocolVersion: 'MIHVER-ORCHESTRATOR-FIREWALL-V1', firewallVersion: INSTALL_BINDING.version,
    sourceCommit: INSTALL_BINDING.sourceCommit, canonicalMihverRoot: INSTALL_BINDING.canonicalMihverRoot,
    trustRoot: INSTALL_BINDING.trustRoot, installedEntry, engineDir, manifestFilename,
    validatorHash: INSTALL_BINDING.validatorHash, validatorVersion: INSTALL_BINDING.validatorVersion,
  }, { files, executableIdentityValid: fs.realpathSync.native(installedEntry) === fs.realpathSync.native(entry) });
  if (!verification.valid) {
    if (verification.manifestValid) failure = 'FIREWALL_DRIFT_DETECTED';
    throw new Error(verification.reasons.join('; '));
  }
  failure = 'FIREWALL_DRIFT_DETECTED';
  globalThis.__MIHVER_VERIFIED_INSTALL__ = { ...INSTALL_BINDING, installedEntry, engineDir, manifestFilename, manifest };
  await import(pathToFileURL(path.join(engineDir, 'dispatcher.mjs')).href);
} catch (error) {
  process.stderr.write(`mihver-firewall verification failure: ${String(error?.message ?? error)}\n`);
  failClosed(failure);
}
