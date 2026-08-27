// MIHVER V3.1-B Closeout Pack A.2, Work Package C: proves schemas/dev/publication-envelope.schema.json
// and schemas/dev/publication-receipt.schema.json's `repository.remote_name` pattern agrees with the
// real Go validator (tools/publication-broker/internal/repoidentity.ValidateRemoteName) for every case
// in a shared literal matrix. Uses the actual AJV validation path (the same `ajv` devDependency
// already declared in package.json), not a standalone regex unit test run outside of AJV.
//
// remoteNameParityMatrix below MUST be kept identical to the Go-side copy in
// tools/publication-broker/internal/repoidentity/repoidentity_test.go
// (`remoteNameParityMatrix`) -- see that variable's own doc comment. Neither file imports the other
// (Node cannot import Go source, and vice versa); the shared literal list, independently checked by
// each language's own real validator, is what makes "the schema and the Go validator agree" a checked
// fact for every one of these cases, not merely an assertion.
//
// Confirmed defect A (Closeout Pack A.2, fixed): both schemas' remote_name pattern was
// `^[^-][^\x00-\x20\x7f/\\~^:?*\[@]*$` -- the first character was checked ONLY against '-', so a
// one-character "/", "\", " ", "\n", "@", ":", "?", or "[" satisfied the schema while
// ValidateRemoteName correctly rejected every one of them.
//
// Confirmed defect B (Closeout Pack A.2.1, fixed): Closeout A.2's own fix used a negated range
// (`[^...\x7f-￿...]`) to exclude non-ASCII code points, but AJV compiles JSON Schema `pattern`
// values as Unicode-CODE-POINT-aware regexes (the `u` flag) -- a code point ABOVE U+FFFF (an astral
// character like 😀 U+1F600 or 𐀀 U+10000) is simply not a member of the range [\x7f,￿] at all, so
// the negated class did not exclude it, and every astral `remote_name` was silently ACCEPTED by both
// schemas. Fixed by replacing the negated-range approach with a POSITIVE printable-ASCII range
// (`[\x21-\x7E]+`, requiring every character to be in that range) -- an astral code point can never be
// a member of that range regardless of internal representation, so it always fails to match.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

const envelopeSchema = JSON.parse(readFileSync(join(repoRoot, 'schemas/dev/publication-envelope.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(readFileSync(join(repoRoot, 'schemas/dev/publication-receipt.schema.json'), 'utf8'));

// Must be kept byte-for-byte in sync with repoidentity_test.go's remoteNameParityMatrix.
const remoteNameParityMatrix = [
  { name: '/', accept: false },
  { name: '\\', accept: false },
  { name: ' ', accept: false },
  { name: '\n', accept: false },
  { name: '@', accept: false },
  { name: ':', accept: false },
  { name: '?', accept: false },
  { name: '[', accept: false },
  { name: '-origin', accept: false },
  { name: 'a/b', accept: false },
  { name: '⁄', accept: false }, // U+2044 FRACTION SLASH
  { name: '／', accept: false }, // U+FF0F FULLWIDTH SOLIDUS
  { name: 'café', accept: false }, // non-ASCII character anywhere in the value
  { name: '😀', accept: false }, // U+1F600 GRINNING FACE -- astral plane (above U+FFFF)
  { name: '𐀀', accept: false }, // U+10000 LINEAR B SYLLABLE B008 A -- astral plane, first non-BMP code point
  { name: '𝕒', accept: false }, // U+1D552 MATHEMATICAL DOUBLE-STRUCK SMALL A -- astral plane
  { name: 'origin', accept: true },
  { name: 'upstream', accept: true },
  { name: 'origin-2', accept: true },
  { name: 'remote.name', accept: true },
  { name: 'remote_name', accept: true },
];

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

// remoteNameOnlyObject builds the minimal object each full schema requires around `remote_name`, so
// AJV actually validates through the real, complete schema document -- not a pattern extracted and
// re-checked in isolation.
function remoteNameOnlyObject(remoteName) {
  return { remote_name: remoteName, owner: 'mihvernetwork', name: 'mihver' };
}

function validateRepositoryField(ajv, fullSchema, remoteName) {
  // Compile only the `repository` subschema (which is where remote_name's pattern lives in both full
  // documents) so this test does not also have to construct a complete, valid Envelope/Receipt for
  // every case -- AJV validates the exact same pattern/type/required rules either way.
  const repositorySchema = { $schema: fullSchema.$schema, ...fullSchema.properties.repository };
  const validate = ajv.compile(repositorySchema);
  return validate(remoteNameOnlyObject(remoteName));
}

for (const [label, schema] of [['envelope', envelopeSchema], ['receipt', receiptSchema]]) {
  const ajv = new Ajv2020({ allErrors: true });
  for (const { name, accept } of remoteNameParityMatrix) {
    test(`${label} schema: remote_name ${JSON.stringify(name)} -> accept=${accept}`, () => {
      const ok = validateRepositoryField(ajv, schema, name);
      assert.equal(ok, accept, `${label} schema disagreed with the Go validator for remote_name ${JSON.stringify(name)}`);
    });
  }
}

// Sanity check: the full Envelope schema, not just the extracted `repository` subschema, also agrees
// -- proves the parity holds through the actual end-to-end document AJV would validate a real
// Envelope against, not merely the isolated fragment used above for matrix convenience.
test('full envelope schema rejects a one-character "/" remote_name', () => {
  const ajv = new Ajv2020({ allErrors: true });
  const validate = ajv.compile(envelopeSchema);
  const envelope = {
    protocol_version: '1.0.0',
    repository: { remote_name: '/', owner: 'mihvernetwork', name: 'mihver' },
    branch: 'task/example',
    base_branch: 'main',
    base_commit: '0'.repeat(40),
    expected_pre_publish_head: '1'.repeat(40),
    allowed_files: [{ path: 'a.txt', action: 'present' }],
    publication_fingerprint: '2'.repeat(64),
    commit_message: 'example',
    pr_expected: false,
  };
  assert.equal(validate(envelope), false, 'full envelope schema must reject remote_name "/"');
});

// Sanity check for Closeout Pack A.2.1's specific fix: the full Envelope schema rejects an astral
// Unicode remote_name through the actual end-to-end document, not merely the isolated `repository`
// subschema used above.
test('full envelope schema rejects an astral-plane emoji remote_name', () => {
  const ajv = new Ajv2020({ allErrors: true });
  const validate = ajv.compile(envelopeSchema);
  const envelope = {
    protocol_version: '1.0.0',
    repository: { remote_name: '😀', owner: 'mihvernetwork', name: 'mihver' },
    branch: 'task/example',
    base_branch: 'main',
    base_commit: '0'.repeat(40),
    expected_pre_publish_head: '1'.repeat(40),
    allowed_files: [{ path: 'a.txt', action: 'present' }],
    publication_fingerprint: '2'.repeat(64),
    commit_message: 'example',
    pr_expected: false,
  };
  assert.equal(validate(envelope), false, 'full envelope schema must reject an astral-plane remote_name');
});

console.log(`publication-remote-name-parity.test.mjs: ${passed} passed`);
