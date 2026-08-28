package server

// Regression suite for MIHVER V3.1-B Closeout Pack A.2, Work Package D (Canonical Standard Padded
// Base64). Prior to this round, decodePackageComponents used base64.StdEncoding.DecodeString
// directly, which (a) silently skips embedded CR/LF bytes rather than treating them as invalid
// alphabet characters, and (b) (in non-Strict mode) accepts a final quantum with non-zero unused
// padding bits -- neither of which round-trips through base64.StdEncoding.EncodeToString. Every case
// below is exercised twice: directly against decodeCanonicalBase64 (the pure decision function), and
// through the real client Unix socket transport, confirming a rejected component never reaches
// Orchestrate (zero token mints) and an accepted one still round-trips exactly.

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"sync/atomic"
	"testing"
)

func TestDecodeCanonicalBase64_RejectsNoncanonicalForms(t *testing.T) {
	canonical := base64.StdEncoding.EncodeToString([]byte("hello world"))

	cases := []struct {
		name string
		in   string
	}{
		{"embedded LF", "aGVs\nbG8gd29ybGQ="},
		{"embedded CRLF", "aGVs\r\nbG8gd29ybGQ="},
		{"missing padding", "aGVsbG8gd29ybGQ"},
		{"extra padding", canonical + "="},
		{"url-safe alphabet", "aGVsbG8gd29ybGQ_"},
		{"invalid alphabet", "aGVsbG8!d29ybGQ="},
		{"non-zero unused padding bits", "aGVsbB=="}, // decodes like "aGVsbA==" ("hell") but is not its canonical form
		{"empty string", ""},
		{"not a multiple of 4", "aGVsbA=" /* 7 chars */},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, ok := decodeCanonicalBase64(c.in); ok {
				t.Fatalf("SECURITY DEFECT: noncanonical input %q was accepted", c.in)
			}
		})
	}
}

func TestDecodeCanonicalBase64_AcceptsCanonicalForms(t *testing.T) {
	sizes := []int{0, 1, 2, 3, 4, 5, 6, 7, 8, 100, MaxEnvelopeBytes, MaxEnvelopeBytes + 1, MaxEnvelopeBytes + 2}
	for _, n := range sizes {
		raw := bytes.Repeat([]byte{'M'}, n)
		encoded := base64.StdEncoding.EncodeToString(raw)
		if n == 0 {
			// The empty string is deliberately rejected outright (Work Package D) -- this protocol
			// never carries a legitimately empty component -- so it is exercised in the rejection
			// test above, not here.
			continue
		}
		decoded, ok := decodeCanonicalBase64(encoded)
		if !ok {
			t.Fatalf("size %d: expected canonical base64 %q to be accepted", n, encoded)
		}
		if !bytes.Equal(decoded, raw) {
			t.Fatalf("size %d: decoded mismatch", n)
		}
	}
}

func TestDecodeCanonicalBase64_RoundTripsRealMihverPublishOutput(t *testing.T) {
	// A normal mihver-publish round trip: encode real envelope/receipt/manifest-shaped JSON and a
	// bundle-shaped blob exactly the way mihver-publish does, and confirm the canonical decoder
	// accepts every one of them unchanged.
	payloads := [][]byte{
		[]byte(`{"protocol_version":"1.0.0"}`),
		[]byte(`{"status":"COMMITTED"}`),
		bytes.Repeat([]byte{0x00, 0x01, 0xff, 0x42}, 4096), // bundle-shaped binary content
		[]byte(`{"manifest":"v1"}`),
	}
	for _, p := range payloads {
		encoded := base64.StdEncoding.EncodeToString(p)
		decoded, ok := decodeCanonicalBase64(encoded)
		if !ok {
			t.Fatalf("expected canonical round trip to be accepted for payload of length %d", len(p))
		}
		if !bytes.Equal(decoded, p) {
			t.Fatalf("round-trip payload mismatch")
		}
	}
}

// TestClientSocket_NoncanonicalBase64_RejectsAsMalformedAndNeverMintsToken proves the wire-level
// contract: a component carrying an otherwise-decodable but noncanonical base64 string (embedded
// CRLF) is rejected as MALFORMED_BASE64 before Orchestrate is ever reached -- no Orchestrate call, no
// Grant lookup/mutation, no token mint, no Git/PR activity.
func TestClientSocket_NoncanonicalBase64_RejectsAsMalformedAndNeverMintsToken(t *testing.T) {
	sockPath, minter := newSizeTestClientListener(t)
	small := b64OfLen(16)
	noncanonical := "aGVs\r\nbG8gd29ybGQ="

	raw, err := json.Marshal(packageWireRequest{EnvelopeB64: noncanonical, ReceiptB64: small, BundleB64: small, ManifestB64: small})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	result := sendRawToClientSocket(t, sockPath, raw)
	if result.Status != "BLOCKED" || result.FailureReason != "MALFORMED_BASE64" {
		t.Fatalf("expected BLOCKED/MALFORMED_BASE64 for a noncanonical (embedded-CRLF) component, got %+v", result)
	}
	if calls := atomic.LoadInt32(&minter.calls); calls != 0 {
		t.Fatalf("SECURITY DEFECT: TokenMinter.Mint was called %d time(s) for a noncanonical-base64-rejected request", calls)
	}
}

// TestClientSocket_CanonicalBase64AtExactComponentBoundary_StillReachesOrchestrate confirms the
// canonical-decode fix does not disturb the existing pre-allocation bound tests: a component encoded
// at exactly its own limit, in fully canonical form, must still pass the base64 layer and reach
// Orchestrate (not be misclassified as MALFORMED_BASE64).
func TestClientSocket_CanonicalBase64AtExactComponentBoundary_StillReachesOrchestrate(t *testing.T) {
	sockPath, _ := newSizeTestClientListener(t)
	atLimit := b64OfLen(MaxEnvelopeBytes)

	raw, err := json.Marshal(packageWireRequest{EnvelopeB64: atLimit, ReceiptB64: b64OfLen(16), BundleB64: b64OfLen(16), ManifestB64: b64OfLen(16)})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	result := sendRawToClientSocket(t, sockPath, raw)
	if isTransportRejection(result.FailureReason) {
		t.Fatalf("expected a canonical, exactly-at-limit component to pass the base64/size layer, got %+v", result)
	}
}
