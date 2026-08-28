package protocol

// Regression suite for MIHVER V3.1-B Closeout Pack A.2.1, Work Package D (Exactly One JSON Value Per
// Artifact). Confirmed defect: strictDecode used `dec.More()` to detect trailing data after the first
// JSON value, which is unsound for that purpose -- `More` reports whether ANOTHER JSON VALUE could be
// decoded next, not merely whether unconsumed bytes remain. Empirically confirmed before fixing:
// `dec.More()` returned `false` (i.e. "accept, no trailing data") for input shaped like `{...}]` or
// `{...}}` -- a lone `]`/`}` is not itself the start of a value `More` looks for, so real leftover
// bytes went completely undetected. Applied centrally (strictDecode is the single implementation
// ParseEnvelope/ParseReceipt/ParseManifest all call), so this suite exercises it identically through
// all three public entry points.

import "testing"

// assertStrictArtifactContract exercises the required trailing-data matrix for one artifact "kind"
// (Envelope/Receipt/Manifest), via its own top-level Parse function. validJSON must be a
// SUCCESSFULLY-parseable, single top-level JSON object for that kind.
func assertStrictArtifactContract(t *testing.T, kind string, validJSON []byte, parse func([]byte) error) {
	t.Helper()

	t.Run(kind+"/valid_plus_whitespace_passes", func(t *testing.T) {
		raw := append(append([]byte{}, validJSON...), []byte("   \n\t  ")...)
		if err := parse(raw); err != nil {
			t.Fatalf("expected trailing whitespace-only content to be accepted, got: %v", err)
		}
	})

	t.Run(kind+"/valid_plus_second_object_rejected", func(t *testing.T) {
		raw := append(append([]byte{}, validJSON...), validJSON...)
		if err := parse(raw); err == nil {
			t.Fatalf("SECURITY DEFECT: a second top-level JSON value was accepted")
		}
	})

	t.Run(kind+"/valid_plus_trailing_bracket_rejected", func(t *testing.T) {
		raw := append(append([]byte{}, validJSON...), []byte("]")...)
		if err := parse(raw); err == nil {
			t.Fatalf("SECURITY DEFECT: a trailing ']' after a valid value was accepted")
		}
	})

	t.Run(kind+"/valid_plus_trailing_brace_rejected", func(t *testing.T) {
		raw := append(append([]byte{}, validJSON...), []byte("}")...)
		if err := parse(raw); err == nil {
			t.Fatalf("SECURITY DEFECT: a trailing '}' after a valid value was accepted")
		}
	})

	t.Run(kind+"/valid_plus_trailing_garbage_rejected", func(t *testing.T) {
		raw := append(append([]byte{}, validJSON...), []byte("not json garbage 123")...)
		if err := parse(raw); err == nil {
			t.Fatalf("SECURITY DEFECT: trailing non-JSON garbage after a valid value was accepted")
		}
	})
}

func TestStrictJSONContract_Envelope(t *testing.T) {
	assertStrictArtifactContract(t, "envelope", validEnvelopeJSON(), func(raw []byte) error {
		_, err := ParseEnvelope(raw)
		return err
	})
}

func TestStrictJSONContract_Receipt(t *testing.T) {
	assertStrictArtifactContract(t, "receipt", validReceiptJSON(hex40()), func(raw []byte) error {
		_, err := ParseReceipt(raw)
		return err
	})
}

func TestStrictJSONContract_Manifest(t *testing.T) {
	validManifest := manifestJSON(hex64(), hex64(), hex64(), hex40())
	assertStrictArtifactContract(t, "manifest", validManifest, func(raw []byte) error {
		_, err := ParseManifest(raw)
		return err
	})
}

// --- Unknown fields, for the two artifact kinds not already covered by an existing test ---------
// (TestParseEnvelope_RejectsUnknownField already covers Envelope.)

func TestParseReceipt_RejectsUnknownField(t *testing.T) {
	raw := []byte(`{
		"status": "COMMITTED",
		"protocol_version": "1.0.0",
		"repository": {"remote_name": "origin", "owner": "mihvernetwork", "name": "mihver"},
		"branch": "chore/test-branch",
		"base_commit": "` + hex40() + `",
		"pre_publish_head": "` + hex40() + `",
		"fingerprint": "` + hex64() + `",
		"commit_sha": "` + hex40() + `",
		"local_head": "` + hex40() + `",
		"working_tree": "clean",
		"unexpected_field": "should be rejected"
	}`)
	if _, err := ParseReceipt(raw); err == nil {
		t.Fatalf("expected error for unknown field, got nil")
	}
}

func TestParseManifest_RejectsUnknownField(t *testing.T) {
	raw := []byte(`{
		"protocol_version": "1.0.0",
		"envelope_digest_sha256": "` + hex64() + `",
		"receipt_digest_sha256": "` + hex64() + `",
		"bundle_digest_sha256": "` + hex64() + `",
		"commit_sha": "` + hex40() + `",
		"unexpected_field": "should be rejected"
	}`)
	if _, err := ParseManifest(raw); err == nil {
		t.Fatalf("expected error for unknown field, got nil")
	}
}

// --- Manifest cross-validation / request digest behavior must remain unchanged -------------------
// (Exercised already by TestParseRequest_* in protocol_test.go; this test adds one more direct proof
// that a byte-exact, otherwise-valid full Request still parses successfully after this round's
// strictDecode change -- i.e. the fix did not regress the happy path any of those tests also cover.)

func TestParseRequest_StillSucceedsAfterStrictDecodeChange(t *testing.T) {
	envelopeBytes, receiptBytes, bundleBytes, manifestBytes := validRequestComponents()
	req, err := ParseRequest(envelopeBytes, receiptBytes, bundleBytes, manifestBytes)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if req.RequestDigest() != ComputeRequestDigest(ProtocolVersion, envelopeBytes, receiptBytes, bundleBytes, manifestBytes) {
		t.Fatalf("request digest recipe changed unexpectedly")
	}
}
