import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

export const PROTOCOL_VERSION = 'MIHVER-ORCHESTRATOR-FIREWALL-V1';
export const FIREWALL_VERSION = '1.0.0';
export const VALIDATOR_VERSION = '2';

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export async function hashFile(path) {
  return sha256(await readFile(path));
}

export function readSourceCommit(repoRoot) {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function buildManifest({
  sourceCommit,
  files,
  installTime,
  canonicalMihverRoot,
  trustRoot,
  engineDir,
  manifestFilename,
  installedEntry,
  validatorHash,
  validatorVersion,
  ownedHookEntries = [],
}) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    firewallVersion: FIREWALL_VERSION,
    sourceCommit,
    installTime,
    canonicalMihverRoot,
    trustRoot,
    engineDir,
    manifestFilename,
    installedEntry,
    validatorHash,
    validatorVersion,
    ownedHookEntries,
    files: Object.fromEntries(
      Object.entries(files).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
}

export async function readManifest(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

// This function must remain standalone: the installer embeds its exact source
// in each loader so runtime verification can happen before any engine import.
export function verifyManifest(manifest, expected, observed) {
  const reasons = [];
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!object(manifest)) {
    return { valid: false, manifestValid: false, reasons: ['manifest top level is not an object'] };
  }
  if (!object(expected) || !object(observed)) {
    return { valid: false, manifestValid: false, reasons: ['manifest validator inputs are invalid'] };
  }
  const stringFields = [
    'protocolVersion', 'firewallVersion', 'sourceCommit', 'installTime', 'canonicalMihverRoot',
    'trustRoot', 'engineDir', 'manifestFilename', 'installedEntry', 'validatorHash', 'validatorVersion',
  ];
  for (const field of stringFields) {
    if (typeof manifest[field] !== 'string' || manifest[field].length === 0) {
      reasons.push(`manifest ${field} is missing or has invalid type`);
    }
  }
  if (manifest.protocolVersion !== expected.protocolVersion) {
    reasons.push('manifest protocol version is missing or unsupported');
  }
  if (manifest.firewallVersion !== expected.firewallVersion) {
    reasons.push('manifest firewall version differs from the executable binding');
  }
  if (manifest.sourceCommit !== expected.sourceCommit) {
    reasons.push('manifest source commit differs from the executable binding');
  }
  if (manifest.canonicalMihverRoot !== expected.canonicalMihverRoot) {
    reasons.push('manifest is bound to a different canonical MIHVER root');
  }
  if (manifest.trustRoot !== expected.trustRoot) {
    reasons.push('manifest records a different installation trust root');
  }
  if (manifest.installedEntry !== expected.installedEntry) {
    reasons.push('manifest installed executable path is invalid or altered');
  }
  if (observed.executableIdentityValid === false) {
    reasons.push('running executable identity differs from the executable binding');
  }
  if (manifest.engineDir !== expected.engineDir) reasons.push('manifest records a different engine directory');
  if (manifest.manifestFilename !== expected.manifestFilename) reasons.push('manifest filename binding is invalid');
  if (manifest.validatorHash !== expected.validatorHash) reasons.push('manifest validator hash differs from the executable binding');
  if (manifest.validatorVersion !== expected.validatorVersion) reasons.push('manifest validator version differs from the executable binding');
  const expectedFiles = manifest.files && typeof manifest.files === 'object' && !Array.isArray(manifest.files)
    ? manifest.files : {};
  if (expectedFiles !== manifest.files) reasons.push('manifest file map is missing or invalid');
  for (const [relativePath, expectedHash] of Object.entries(expectedFiles)) {
    if (!relativePath || typeof expectedHash !== 'string' || !/^[0-9a-f]{64}$/.test(expectedHash)) {
      reasons.push(`manifest file entry is invalid: ${relativePath}`);
    }
  }
  let manifestValid = reasons.length === 0;
  if (observed.files !== undefined) {
    const actualFiles = object(observed.files) ? observed.files : {};
    if (actualFiles !== observed.files) {
      reasons.push('observed file map is missing or invalid');
      manifestValid = false;
    }
    for (const relativePath of Object.keys(expectedFiles)) {
      if (!(relativePath in actualFiles)) {
        reasons.push(`installed file is missing: ${relativePath}`);
        manifestValid = false;
      }
    }
    for (const relativePath of Object.keys(actualFiles)) {
      if (!(relativePath in expectedFiles)) {
        reasons.push(`unexpected manifest-tracked file observation: ${relativePath}`);
        manifestValid = false;
      }
    }
    for (const [relativePath, expectedHash] of Object.entries(expectedFiles)) {
      if (relativePath in actualFiles && actualFiles[relativePath] !== expectedHash) {
        reasons.push(`installed file hash differs: ${relativePath}`);
      }
    }
  }
  if (observed.requiredHooksValid === false) {
    reasons.push(...(observed.hookReasons?.length
      ? observed.hookReasons
      : ['one or more required hook registrations are missing or altered']));
  }

  return { valid: reasons.length === 0, manifestValid, reasons };
}
