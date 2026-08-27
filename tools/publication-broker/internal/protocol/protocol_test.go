package protocol

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"testing"

	"mihver.network/publication-broker/internal/repoidentity"
)

func validEnvelopeJSON() []byte {
	return []byte(`{
		"protocol_version": "1.0.0",
		"repository": {"remote_name": "origin", "owner": "mihvernetwork", "name": "mihver"},
		"branch": "chore/test-branch",
		"base_branch": "main",
		"base_commit": "` + hex40() + `",
		"expected_pre_publish_head": "` + hex40() + `",
		"allowed_files": [{"path": "new.txt", "action": "present"}],
		"publication_fingerprint": "` + hex64() + `",
		"commit_message": "test commit",
		"pr_expected": false
	}`)
}

func hex40() string { return "0123456789abcdef0123456789abcdef01234567" }
func hex64() string {
	return "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"[:64]
}

func TestParseEnvelope_Valid(t *testing.T) {
	e, err := ParseEnvelope(validEnvelopeJSON())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if e.Branch != "chore/test-branch" {
		t.Fatalf("unexpected branch: %s", e.Branch)
	}
}

func TestParseEnvelope_RejectsUnknownField(t *testing.T) {
	raw := []byte(`{
		"protocol_version": "1.0.0",
		"repository": {"remote_name": "origin", "owner": "o", "name": "n"},
		"branch": "b", "base_branch": "main",
		"base_commit": "` + hex40() + `",
		"expected_pre_publish_head": "` + hex40() + `",
		"allowed_files": [{"path": "a", "action": "present"}],
		"publication_fingerprint": "` + hex64() + `",
		"commit_message": "m", "pr_expected": false,
		"unexpected_field": "should be rejected"
	}`)
	if _, err := ParseEnvelope(raw); err == nil {
		t.Fatalf("expected error for unknown field, got nil")
	}
}

func TestParseEnvelope_RejectsMainBranch(t *testing.T) {
	raw := []byte(`{
		"protocol_version": "1.0.0",
		"repository": {"remote_name": "origin", "owner": "o", "name": "n"},
		"branch": "main", "base_branch": "main",
		"base_commit": "` + hex40() + `",
		"expected_pre_publish_head": "` + hex40() + `",
		"allowed_files": [{"path": "a", "action": "present"}],
		"publication_fingerprint": "` + hex64() + `",
		"commit_message": "m", "pr_expected": false
	}`)
	if _, err := ParseEnvelope(raw); err == nil {
		t.Fatalf("expected error for branch=main")
	}
}

func TestParseEnvelope_RejectsDuplicatePath(t *testing.T) {
	raw := []byte(`{
		"protocol_version": "1.0.0",
		"repository": {"remote_name": "origin", "owner": "o", "name": "n"},
		"branch": "b", "base_branch": "main",
		"base_commit": "` + hex40() + `",
		"expected_pre_publish_head": "` + hex40() + `",
		"allowed_files": [{"path": "a", "action": "present"}, {"path": "a", "action": "present"}],
		"publication_fingerprint": "` + hex64() + `",
		"commit_message": "m", "pr_expected": false
	}`)
	if _, err := ParseEnvelope(raw); err == nil {
		t.Fatalf("expected error for duplicate path")
	}
}

func TestParseEnvelope_PRExpectedRequiresTitle(t *testing.T) {
	raw := []byte(`{
		"protocol_version": "1.0.0",
		"repository": {"remote_name": "origin", "owner": "o", "name": "n"},
		"branch": "b", "base_branch": "main",
		"base_commit": "` + hex40() + `",
		"expected_pre_publish_head": "` + hex40() + `",
		"allowed_files": [{"path": "a", "action": "present"}],
		"publication_fingerprint": "` + hex64() + `",
		"commit_message": "m", "pr_expected": true
	}`)
	if _, err := ParseEnvelope(raw); err == nil {
		t.Fatalf("expected error for pr_expected without pr_title")
	}
}

func TestRequestDigest_Deterministic(t *testing.T) {
	e, r, b, m := []byte("envelope"), []byte("receipt"), []byte("bundle"), []byte("manifest")
	d1 := ComputeRequestDigest(ProtocolVersion, e, r, b, m)
	d2 := ComputeRequestDigest(ProtocolVersion, e, r, b, m)
	if d1 != d2 {
		t.Fatalf("digest not deterministic: %x != %x", d1, d2)
	}
}

func TestRequestDigest_OneByteMutationInvalidates(t *testing.T) {
	base := ComputeRequestDigest(ProtocolVersion, []byte("envelope"), []byte("receipt"), []byte("bundle"), []byte("manifest"))

	mutatedEnvelope := ComputeRequestDigest(ProtocolVersion, []byte("Envelope"), []byte("receipt"), []byte("bundle"), []byte("manifest"))
	mutatedReceipt := ComputeRequestDigest(ProtocolVersion, []byte("envelope"), []byte("Receipt"), []byte("bundle"), []byte("manifest"))
	mutatedBundle := ComputeRequestDigest(ProtocolVersion, []byte("envelope"), []byte("receipt"), []byte("Bundle"), []byte("manifest"))
	mutatedManifest := ComputeRequestDigest(ProtocolVersion, []byte("envelope"), []byte("receipt"), []byte("bundle"), []byte("Manifest"))

	for name, other := range map[string]Digest{
		"envelope": mutatedEnvelope, "receipt": mutatedReceipt, "bundle": mutatedBundle, "manifest": mutatedManifest,
	} {
		if base == other {
			t.Fatalf("one-byte mutation in %s did not change the request digest", name)
		}
	}
}

func TestRequestDigest_FramingPreventsConcatenationAmbiguity(t *testing.T) {
	// Without explicit length-prefixing, ("ab","c") and ("a","bc") could hash identically once
	// concatenated. Framing must keep them distinct.
	d1 := ComputeRequestDigest(ProtocolVersion, []byte("ab"), []byte("c"), []byte(""), []byte(""))
	d2 := ComputeRequestDigest(ProtocolVersion, []byte("a"), []byte("bc"), []byte(""), []byte(""))
	if d1 == d2 {
		t.Fatalf("framing did not prevent concatenation ambiguity: %x == %x", d1, d2)
	}
}

func TestParseManifest_RejectsMalformed(t *testing.T) {
	if _, err := ParseManifest([]byte(`{"protocol_version":"1.0.0"}`)); err == nil {
		t.Fatalf("expected error for incomplete manifest")
	}
}

// --- Manifest cross-validation (ParseRequest) -------------------------------------------------
//
// ParseManifest only proves the manifest's digest/commit fields LOOK like SHA-256/Git-SHA hex
// strings. ParseRequest must additionally prove those claimed digests match the REAL bytes of the
// envelope/receipt/bundle that arrived alongside the manifest, and that the manifest's commit_sha
// matches the receipt's own commit_sha -- see ErrManifest*Mismatch in protocol.go.

func sha256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

// flipHexChar returns s with its first character toggled between '0' and '1' -- the result is still
// a well-formed 40/64-hex string (so it still passes ParseManifest's structural regex check) but is
// guaranteed to be a DIFFERENT value from s.
func flipHexChar(s string) string {
	b := []byte(s)
	if len(b) == 0 {
		return s
	}
	if b[0] == '0' {
		b[0] = '1'
	} else {
		b[0] = '0'
	}
	return string(b)
}

func validReceiptJSON(commitSHA string) []byte {
	return []byte(`{
		"status": "COMMITTED",
		"protocol_version": "1.0.0",
		"repository": {"remote_name": "origin", "owner": "mihvernetwork", "name": "mihver"},
		"branch": "chore/test-branch",
		"base_commit": "` + hex40() + `",
		"pre_publish_head": "` + hex40() + `",
		"fingerprint": "` + hex64() + `",
		"commit_sha": "` + commitSHA + `",
		"local_head": "` + hex40() + `",
		"working_tree": "clean"
	}`)
}

func manifestJSON(envelopeDigest, receiptDigest, bundleDigest, commitSHA string) []byte {
	return []byte(`{
		"protocol_version": "1.0.0",
		"envelope_digest_sha256": "` + envelopeDigest + `",
		"receipt_digest_sha256": "` + receiptDigest + `",
		"bundle_digest_sha256": "` + bundleDigest + `",
		"commit_sha": "` + commitSHA + `"
	}`)
}

// validRequestComponents returns a byte-exact, internally consistent (envelope, receipt, bundle,
// manifest) tuple -- the manifest's digests are computed from these EXACT bytes, and its commit_sha
// matches the receipt's own commit_sha. Individual tests mutate one piece of this tuple to exercise
// each cross-validation failure mode.
func validRequestComponents() (envelopeBytes, receiptBytes, bundleBytes, manifestBytes []byte) {
	envelopeBytes = validEnvelopeJSON()
	commitSHA := hex40()
	receiptBytes = validReceiptJSON(commitSHA)
	bundleBytes = []byte("a fake but non-empty git bundle payload, used only as opaque bytes here")
	manifestBytes = manifestJSON(sha256Hex(envelopeBytes), sha256Hex(receiptBytes), sha256Hex(bundleBytes), commitSHA)
	return envelopeBytes, receiptBytes, bundleBytes, manifestBytes
}

// Test 1: a valid, internally consistent request -> ParseRequest succeeds.
func TestParseRequest_ValidManifestCrossValidation_Succeeds(t *testing.T) {
	envelopeBytes, receiptBytes, bundleBytes, manifestBytes := validRequestComponents()
	req, err := ParseRequest(envelopeBytes, receiptBytes, bundleBytes, manifestBytes)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if req == nil {
		t.Fatalf("expected non-nil *Request")
	}
}

// Test 2: wrong envelope_digest_sha256 -> ErrManifestEnvelopeDigestMismatch, nil *Request.
func TestParseRequest_WrongEnvelopeDigest_Fails(t *testing.T) {
	envelopeBytes, receiptBytes, bundleBytes, _ := validRequestComponents()
	commitSHA := hex40()
	badManifest := manifestJSON(flipHexChar(sha256Hex(envelopeBytes)), sha256Hex(receiptBytes), sha256Hex(bundleBytes), commitSHA)

	req, err := ParseRequest(envelopeBytes, receiptBytes, bundleBytes, badManifest)
	if req != nil {
		t.Fatalf("expected nil *Request, got %+v", req)
	}
	if !errors.Is(err, ErrManifestEnvelopeDigestMismatch) {
		t.Fatalf("expected ErrManifestEnvelopeDigestMismatch, got %v", err)
	}
}

// Test 3: wrong receipt_digest_sha256 -> ErrManifestReceiptDigestMismatch, nil *Request.
func TestParseRequest_WrongReceiptDigest_Fails(t *testing.T) {
	envelopeBytes, receiptBytes, bundleBytes, _ := validRequestComponents()
	commitSHA := hex40()
	badManifest := manifestJSON(sha256Hex(envelopeBytes), flipHexChar(sha256Hex(receiptBytes)), sha256Hex(bundleBytes), commitSHA)

	req, err := ParseRequest(envelopeBytes, receiptBytes, bundleBytes, badManifest)
	if req != nil {
		t.Fatalf("expected nil *Request, got %+v", req)
	}
	if !errors.Is(err, ErrManifestReceiptDigestMismatch) {
		t.Fatalf("expected ErrManifestReceiptDigestMismatch, got %v", err)
	}
}

// Test 4: wrong bundle_digest_sha256 -> ErrManifestBundleDigestMismatch, nil *Request.
func TestParseRequest_WrongBundleDigest_Fails(t *testing.T) {
	envelopeBytes, receiptBytes, bundleBytes, _ := validRequestComponents()
	commitSHA := hex40()
	badManifest := manifestJSON(sha256Hex(envelopeBytes), sha256Hex(receiptBytes), flipHexChar(sha256Hex(bundleBytes)), commitSHA)

	req, err := ParseRequest(envelopeBytes, receiptBytes, bundleBytes, badManifest)
	if req != nil {
		t.Fatalf("expected nil *Request, got %+v", req)
	}
	if !errors.Is(err, ErrManifestBundleDigestMismatch) {
		t.Fatalf("expected ErrManifestBundleDigestMismatch, got %v", err)
	}
}

// Test 5: manifest.CommitSHA != receipt.CommitSHA (both individually well-formed 40-hex) ->
// ErrManifestCommitMismatch, nil *Request.
func TestParseRequest_WrongCommitSHA_Fails(t *testing.T) {
	envelopeBytes, receiptBytes, bundleBytes, _ := validRequestComponents()
	wrongCommitSHA := flipHexChar(hex40())
	badManifest := manifestJSON(sha256Hex(envelopeBytes), sha256Hex(receiptBytes), sha256Hex(bundleBytes), wrongCommitSHA)

	req, err := ParseRequest(envelopeBytes, receiptBytes, bundleBytes, badManifest)
	if req != nil {
		t.Fatalf("expected nil *Request, got %+v", req)
	}
	if !errors.Is(err, ErrManifestCommitMismatch) {
		t.Fatalf("expected ErrManifestCommitMismatch, got %v", err)
	}
}

// Test 6: a VALID request, then exactly one byte of the raw envelope/receipt/bundle bytes is
// mutated AFTER the manifest was computed against the original bytes (simulating tampering in
// transit or after signing) -> ParseRequest must fail with the matching digest-mismatch sentinel,
// for all three of envelope/receipt/bundle.
func TestParseRequest_TamperedBytesAfterManifestComputed_Fails(t *testing.T) {
	// These mutations deliberately change bytes WITHIN a free-form text field (never a structural
	// character or a schema-validated fixed-format field) so the tampered bytes still parse and
	// structurally validate on their own -- proving the digest mismatch is what actually catches the
	// tamper, not an incidental parse failure.
	t.Run("envelope", func(t *testing.T) {
		envelopeBytes, receiptBytes, bundleBytes, manifestBytes := validRequestComponents()
		tampered := bytes.Replace(envelopeBytes, []byte(`"commit_message": "test commit"`), []byte(`"commit_message": "test commit!"`), 1)
		if bytes.Equal(tampered, envelopeBytes) {
			t.Fatalf("test setup bug: tamper did not change envelopeBytes")
		}
		if _, err := ParseEnvelope(tampered); err != nil {
			t.Fatalf("test setup bug: tampered envelope must still parse/validate on its own: %v", err)
		}
		req, err := ParseRequest(tampered, receiptBytes, bundleBytes, manifestBytes)
		if req != nil {
			t.Fatalf("expected nil *Request, got %+v", req)
		}
		if !errors.Is(err, ErrManifestEnvelopeDigestMismatch) {
			t.Fatalf("expected ErrManifestEnvelopeDigestMismatch, got %v", err)
		}
	})

	t.Run("receipt", func(t *testing.T) {
		envelopeBytes, receiptBytes, bundleBytes, manifestBytes := validRequestComponents()
		tampered := bytes.Replace(receiptBytes, []byte(`"owner": "mihvernetwork"`), []byte(`"owner": "mihvernetworkX"`), 1)
		if bytes.Equal(tampered, receiptBytes) {
			t.Fatalf("test setup bug: tamper did not change receiptBytes")
		}
		if _, err := ParseReceipt(tampered); err != nil {
			t.Fatalf("test setup bug: tampered receipt must still parse/validate on its own: %v", err)
		}
		req, err := ParseRequest(envelopeBytes, tampered, bundleBytes, manifestBytes)
		if req != nil {
			t.Fatalf("expected nil *Request, got %+v", req)
		}
		if !errors.Is(err, ErrManifestReceiptDigestMismatch) {
			t.Fatalf("expected ErrManifestReceiptDigestMismatch, got %v", err)
		}
	})

	t.Run("bundle", func(t *testing.T) {
		envelopeBytes, receiptBytes, bundleBytes, manifestBytes := validRequestComponents()
		tampered := make([]byte, len(bundleBytes))
		copy(tampered, bundleBytes)
		tampered[0] ^= 0xFF // the bundle is opaque bytes to this package -- no parse/validate step to disturb.
		req, err := ParseRequest(envelopeBytes, receiptBytes, tampered, manifestBytes)
		if req != nil {
			t.Fatalf("expected nil *Request, got %+v", req)
		}
		if !errors.Is(err, ErrManifestBundleDigestMismatch) {
			t.Fatalf("expected ErrManifestBundleDigestMismatch, got %v", err)
		}
	})
}

// Test 7: proves the cross-check is byte-exact, not semantic/parsed-value based. Re-marshal a valid
// envelope to a semantically-equivalent-but-byte-different JSON encoding (reordered keys, extra
// insignificant whitespace) -- using this DIFFERENT byte sequence in place of the original, while the
// manifest still references the ORIGINAL digest, must fail cross-validation; recomputing the
// manifest digest against the NEW bytes must then succeed.
func TestParseRequest_ByteExactCrossValidation_NotSemanticEquivalence(t *testing.T) {
	envelopeBytes, receiptBytes, bundleBytes, manifestBytes := validRequestComponents()

	// Hand-written, key-reordered, whitespace-padded JSON that strictDecode still accepts (same
	// fields, same values, just a different byte sequence) -- proves the check compares raw bytes,
	// not parsed/normalized content.
	reordered := []byte(`{
		"pr_expected":   false,
		"commit_message": "test commit",
		"publication_fingerprint": "` + hex64() + `",
		"allowed_files": [{"action": "present", "path": "new.txt"}],
		"expected_pre_publish_head": "` + hex40() + `",
		"base_commit": "` + hex40() + `",
		"base_branch": "main",
		"branch": "chore/test-branch",
		"repository": {"name": "mihver", "owner": "mihvernetwork", "remote_name": "origin"},
		"protocol_version": "1.0.0"
	}`)
	if string(reordered) == string(envelopeBytes) {
		t.Fatalf("test setup bug: reordered encoding must differ byte-for-byte from the original")
	}
	// Sanity: the reordered bytes still parse to an equivalent, valid Envelope on their own.
	if _, err := ParseEnvelope(reordered); err != nil {
		t.Fatalf("test setup bug: reordered envelope must itself be a valid envelope: %v", err)
	}

	// Original manifest (references envelopeBytes's digest) + the byte-different reordered envelope
	// -> must fail.
	if req, err := ParseRequest(reordered, receiptBytes, bundleBytes, manifestBytes); err == nil || req != nil {
		t.Fatalf("expected ErrManifestEnvelopeDigestMismatch using byte-different envelope against the original manifest, got req=%+v err=%v", req, err)
	} else if !errors.Is(err, ErrManifestEnvelopeDigestMismatch) {
		t.Fatalf("expected ErrManifestEnvelopeDigestMismatch, got %v", err)
	}

	// Recompute the manifest against the NEW (reordered) bytes -> must now succeed.
	commitSHA := hex40()
	recomputedReceipt := validReceiptJSON(commitSHA)
	recomputedManifest := manifestJSON(sha256Hex(reordered), sha256Hex(recomputedReceipt), sha256Hex(bundleBytes), commitSHA)
	req, err := ParseRequest(reordered, recomputedReceipt, bundleBytes, recomputedManifest)
	if err != nil {
		t.Fatalf("expected success once the manifest is recomputed against the new bytes: %v", err)
	}
	if req == nil {
		t.Fatalf("expected non-nil *Request")
	}
}

// Test 8 (implicit in every case above, asserted explicitly here too): ParseRequest returns a nil
// *Request on every manifest cross-validation failure, so no caller could accidentally proceed with
// a partially-valid Request. Also confirms the error message never echoes payload content, only
// digest/commit values that are already public within the package itself.
func TestParseRequest_ManifestMismatch_ReturnsNilRequest(t *testing.T) {
	envelopeBytes, receiptBytes, bundleBytes, _ := validRequestComponents()
	badManifest := manifestJSON(flipHexChar(sha256Hex(envelopeBytes)), sha256Hex(receiptBytes), sha256Hex(bundleBytes), hex40())
	req, err := ParseRequest(envelopeBytes, receiptBytes, bundleBytes, badManifest)
	if req != nil {
		t.Fatalf("SECURITY DEFECT: expected nil *Request on manifest mismatch, got %+v", req)
	}
	if err == nil {
		t.Fatalf("expected non-nil error")
	}
	if strings.Contains(err.Error(), "fake but non-empty git bundle") {
		t.Fatalf("error must never echo raw payload content: %v", err)
	}
}

// Test 9: the REQUEST DIGEST recipe's existing golden tests (TestRequestDigest_*, above in this
// file) remain untouched and passing -- ComputeRequestDigest/Request.RequestDigest() were not
// modified by the manifest cross-validation work.

// --- repoidentity integration ------------------------------------------------------------------
//
// Envelope.Validate/Receipt.Validate now delegate repository.owner/.name/.remote_name to the shared
// internal/repoidentity validator instead of a bare non-empty-string check. These tests prove that
// integration end to end: an invalid owner/name/remote_name is rejected by Validate() (and
// therefore by ParseEnvelope/ParseReceipt/ParseRequest) with a repoidentity-sourced error checkable
// via errors.Is, and ParseRequest never returns a partially-valid *Request in that case.

func envelopeJSONWithRepository(remoteName, owner, name string) []byte {
	return []byte(`{
		"protocol_version": "1.0.0",
		"repository": {"remote_name": "` + remoteName + `", "owner": "` + owner + `", "name": "` + name + `"},
		"branch": "chore/test-branch",
		"base_branch": "main",
		"base_commit": "` + hex40() + `",
		"expected_pre_publish_head": "` + hex40() + `",
		"allowed_files": [{"path": "new.txt", "action": "present"}],
		"publication_fingerprint": "` + hex64() + `",
		"commit_message": "test commit",
		"pr_expected": false
	}`)
}

func TestEnvelopeValidate_InvalidOwner_RejectedViaRepoidentity(t *testing.T) {
	raw := envelopeJSONWithRepository("origin", "expected/../../other-owner", "target")
	_, err := ParseEnvelope(raw)
	if err == nil {
		t.Fatalf("expected error for invalid owner")
	}
	if !errors.Is(err, repoidentity.ErrInvalidOwner) {
		t.Fatalf("expected errors.Is match against repoidentity.ErrInvalidOwner, got %v", err)
	}
}

func TestEnvelopeValidate_InvalidRepoName_RejectedViaRepoidentity(t *testing.T) {
	raw := envelopeJSONWithRepository("origin", "mihvernetwork", "..")
	_, err := ParseEnvelope(raw)
	if !errors.Is(err, repoidentity.ErrInvalidRepositoryName) {
		t.Fatalf("expected errors.Is match against repoidentity.ErrInvalidRepositoryName, got %v", err)
	}
}

func TestEnvelopeValidate_InvalidRemoteName_RejectedViaRepoidentity(t *testing.T) {
	raw := envelopeJSONWithRepository("--upload-pack=evil", "mihvernetwork", "mihver")
	_, err := ParseEnvelope(raw)
	if !errors.Is(err, repoidentity.ErrInvalidRemoteName) {
		t.Fatalf("expected errors.Is match against repoidentity.ErrInvalidRemoteName, got %v", err)
	}
}

func TestReceiptValidate_InvalidOwner_RejectedViaRepoidentity(t *testing.T) {
	raw := []byte(`{
		"status": "COMMITTED",
		"protocol_version": "1.0.0",
		"repository": {"remote_name": "origin", "owner": "expected/../../other-owner", "name": "target"},
		"branch": "chore/test-branch",
		"base_commit": "` + hex40() + `",
		"pre_publish_head": "` + hex40() + `",
		"fingerprint": "` + hex64() + `",
		"commit_sha": "` + hex40() + `",
		"local_head": "` + hex40() + `",
		"working_tree": "clean"
	}`)
	_, err := ParseReceipt(raw)
	if !errors.Is(err, repoidentity.ErrInvalidOwner) {
		t.Fatalf("expected errors.Is match against repoidentity.ErrInvalidOwner, got %v", err)
	}
}

// TestParseRequest_InvalidRepositoryIdentity_NeverReturnsPartialRequest proves the full chain: an
// otherwise byte-consistent request whose envelope carries an invalid owner is rejected by
// ParseRequest itself (which calls ParseEnvelope first) with a repoidentity-sourced error, and
// ParseRequest returns (nil, err) -- never a partially-valid *Request a downstream caller (grant
// lookup, token mint, git execution, PR HTTP request) could act on.
func TestParseRequest_InvalidRepositoryIdentity_NeverReturnsPartialRequest(t *testing.T) {
	envelopeBytes := envelopeJSONWithRepository("origin", "expected/../../other-owner", "target")
	commitSHA := hex40()
	receiptBytes := validReceiptJSON(commitSHA)
	bundleBytes := []byte("a fake but non-empty git bundle payload, used only as opaque bytes here")
	manifestBytes := manifestJSON(sha256Hex(envelopeBytes), sha256Hex(receiptBytes), sha256Hex(bundleBytes), commitSHA)

	req, err := ParseRequest(envelopeBytes, receiptBytes, bundleBytes, manifestBytes)
	if req != nil {
		t.Fatalf("SECURITY DEFECT: expected nil *Request for invalid repository identity, got %+v", req)
	}
	if !errors.Is(err, repoidentity.ErrInvalidOwner) {
		t.Fatalf("expected errors.Is match against repoidentity.ErrInvalidOwner, got %v", err)
	}
}
