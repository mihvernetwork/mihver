package server

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"mihver.network/publication-broker/internal/githubapp"
	"mihver.network/publication-broker/internal/grant"
)

// shortSocketDir returns a short-path scratch directory suitable for AF_UNIX socket files --
// t.TempDir() nests under the (often long) test name and can exceed the ~104-byte sun_path limit.
func shortSocketDir(t *testing.T) string {
	t.Helper()
	dir, err := os.MkdirTemp("", "mihver-sock-")
	if err != nil {
		t.Fatalf("MkdirTemp: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	return dir
}

func TestAdminAndClientSockets_AreSeparateListenersWithDisjointOperations(t *testing.T) {
	grantPath := filepath.Join(t.TempDir(), "grants.json")
	store, err := grant.Open(grantPath)
	if err != nil {
		t.Fatalf("grant.Open: %v", err)
	}

	sockDir := shortSocketDir(t)
	adminSocket := filepath.Join(sockDir, "a.sock")
	clientSocket := filepath.Join(sockDir, "c.sock")

	admin := NewAdminListener(store.Admin())
	go admin.ServeSocket(adminSocket, 0o600)

	client := NewClientListener(Deps{Grants: store.Client()})
	go client.ServeSocket(clientSocket, 0o666)

	waitForSocket(t, adminSocket)
	waitForSocket(t, clientSocket)

	// The unprivileged client socket only ever decodes packageWireRequest -- sending an admin-shaped
	// "create_grant" op to it must never create a grant. It will be interpreted as a (malformed or
	// empty) PublicationPackage instead and BLOCKED.
	conn, err := net.DialTimeout("unix", clientSocket, 2*time.Second)
	if err != nil {
		t.Fatalf("dial client socket: %v", err)
	}
	adminShapedOp := map[string]any{
		"op": "create_grant", "request_digest": "attempted-forgery", "repository_owner": "o",
		"repository_name": "n", "branch": "b", "base_branch": "main", "base_commit": "c", "ttl_seconds": 3600,
	}
	if err := json.NewEncoder(conn).Encode(adminShapedOp); err != nil {
		t.Fatalf("encode: %v", err)
	}
	var result map[string]any
	if err := json.NewDecoder(conn).Decode(&result); err != nil {
		t.Fatalf("decode: %v", err)
	}
	conn.Close()
	if result["status"] != "BLOCKED" {
		t.Fatalf("expected BLOCKED for an admin-shaped payload sent to the client socket, got %+v", result)
	}

	// Confirm no grant was actually created by that attempt.
	if _, err := store.Client().BeginOrResume("attempted-forgery"); err != grant.ErrNotFound {
		t.Fatalf("client socket must never be able to create a grant, got err=%v", err)
	}

	// Now prove the admin socket DOES create a grant for the same shaped request -- the separation
	// is about which socket you're on, not about the request being unprocessable in principle.
	adminConn, err := net.DialTimeout("unix", adminSocket, 2*time.Second)
	if err != nil {
		t.Fatalf("dial admin socket: %v", err)
	}
	if err := json.NewEncoder(adminConn).Encode(adminShapedOp); err != nil {
		t.Fatalf("encode: %v", err)
	}
	var adminResult AdminResult
	if err := json.NewDecoder(adminConn).Decode(&adminResult); err != nil {
		t.Fatalf("decode: %v", err)
	}
	adminConn.Close()
	if !adminResult.OK {
		t.Fatalf("expected admin socket to successfully create the grant: %+v", adminResult)
	}
	if _, err := store.Client().BeginOrResume("attempted-forgery"); err != nil {
		t.Fatalf("expected the grant created via the admin socket to now be usable, got %v", err)
	}
}

func TestClientSocket_HasNoAdminOperations(t *testing.T) {
	grantPath := filepath.Join(t.TempDir(), "grants.json")
	store, err := grant.Open(grantPath)
	if err != nil {
		t.Fatalf("grant.Open: %v", err)
	}
	// ClientListener is constructed with a Deps whose Grants field is typed *grant.ClientHandle, not
	// *grant.Store -- it has no field or method that could ever produce an *grant.AdminHandle, and
	// packageWireRequest has no field an admin op could populate either. This test documents that
	// structural fact; TestAdminAndClientSockets_* above proves it behaviorally.
	c := NewClientListener(Deps{Grants: store.Client()})
	if c == nil {
		t.Fatalf("unexpected nil")
	}
}

// Test 9 (V3.1-B Hardening R2.1) -- the admin socket returns stable, machine-readable Code values
// for each terminal revoke outcome, through the real admin listener transport (not the in-process
// grant.AdminHandle directly) -- never Grant-ID-dependent free text as the thing a caller compares.
func TestAdminSocket_RevokeTerminalStates_ReturnStableCodes(t *testing.T) {
	grantPath := filepath.Join(t.TempDir(), "grants.json")
	store, err := grant.Open(grantPath)
	if err != nil {
		t.Fatalf("grant.Open: %v", err)
	}
	client := store.Client()
	admin := store.Admin()

	sockDir := shortSocketDir(t)
	adminSocket := filepath.Join(sockDir, "a.sock")
	adminListener := NewAdminListener(admin)
	go adminListener.ServeSocket(adminSocket, 0o600)
	waitForSocket(t, adminSocket)

	revokeViaSocket := func(t *testing.T, grantID string) AdminResult {
		t.Helper()
		conn, err := net.DialTimeout("unix", adminSocket, 2*time.Second)
		if err != nil {
			t.Fatalf("dial admin socket: %v", err)
		}
		defer conn.Close()
		if err := json.NewEncoder(conn).Encode(AdminOp{Op: "revoke_grant", GrantID: grantID}); err != nil {
			t.Fatalf("encode: %v", err)
		}
		var result AdminResult
		if err := json.NewDecoder(conn).Decode(&result); err != nil {
			t.Fatalf("decode: %v", err)
		}
		return result
	}

	t.Run("PUBLISHED", func(t *testing.T) {
		g, err := admin.Create(grant.CreateRequest{RequestDigest: "d-pub", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour})
		if err != nil {
			t.Fatalf("Create: %v", err)
		}
		if _, err := client.BeginOrResume("d-pub"); err != nil {
			t.Fatalf("BeginOrResume: %v", err)
		}
		if err := client.MarkPublished(g.GrantID, "head", 0); err != nil {
			t.Fatalf("MarkPublished: %v", err)
		}
		result := revokeViaSocket(t, g.GrantID)
		if result.OK {
			t.Fatalf("expected OK=false revoking a PUBLISHED grant, got %+v", result)
		}
		if result.Code != "GRANT_ALREADY_PUBLISHED" {
			t.Fatalf("expected Code=GRANT_ALREADY_PUBLISHED, got %+v", result)
		}
	})

	t.Run("BLOCKED", func(t *testing.T) {
		g, err := admin.Create(grant.CreateRequest{RequestDigest: "d-blk", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour})
		if err != nil {
			t.Fatalf("Create: %v", err)
		}
		if _, err := client.BeginOrResume("d-blk"); err != nil {
			t.Fatalf("BeginOrResume: %v", err)
		}
		if err := client.MarkBlocked(g.GrantID, "SOME_REASON"); err != nil {
			t.Fatalf("MarkBlocked: %v", err)
		}
		result := revokeViaSocket(t, g.GrantID)
		if result.OK {
			t.Fatalf("expected OK=false revoking a BLOCKED grant, got %+v", result)
		}
		if result.Code != "GRANT_PREVIOUSLY_BLOCKED" {
			t.Fatalf("expected Code=GRANT_PREVIOUSLY_BLOCKED, got %+v", result)
		}
	})

	t.Run("EXPIRED", func(t *testing.T) {
		g, err := admin.Create(grant.CreateRequest{RequestDigest: "d-exp", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Millisecond})
		if err != nil {
			t.Fatalf("Create: %v", err)
		}
		time.Sleep(5 * time.Millisecond) // past the 1ms TTL -- real wall-clock expiry, not a mocked clock (store is shared with the live socket goroutine)
		if _, err := client.BeginOrResume("d-exp"); err != grant.ErrExpired {
			t.Fatalf("expected ErrExpired, got %v", err)
		}
		result := revokeViaSocket(t, g.GrantID)
		if result.OK {
			t.Fatalf("expected OK=false revoking an EXPIRED grant, got %+v", result)
		}
		if result.Code != "GRANT_EXPIRED" {
			t.Fatalf("expected Code=GRANT_EXPIRED, got %+v", result)
		}
	})
}

// Test 10 (V3.1-B Hardening R3.1.1) -- the admin socket must distinguish a PENDING terminal state
// from a durably-acknowledged (clean) one: revoking a PUBLISHED/BLOCKED grant whose own persistence
// is still failing must never return GRANT_ALREADY_PUBLISHED/GRANT_PREVIOUSLY_BLOCKED/
// GRANT_REVOKE_FAILED, only the distinct GRANT_PUBLISH_PERSIST_FAILED/GRANT_BLOCK_PERSIST_FAILED.
func TestAdminSocket_RevokePendingTerminalStates_ReturnPersistFailedCodes(t *testing.T) {
	grantPath := filepath.Join(t.TempDir(), "grants.json")
	store, err := grant.Open(grantPath)
	if err != nil {
		t.Fatalf("grant.Open: %v", err)
	}
	client := store.Client()
	admin := store.Admin()

	sockDir := shortSocketDir(t)
	adminSocket := filepath.Join(sockDir, "a.sock")
	adminListener := NewAdminListener(admin)
	go adminListener.ServeSocket(adminSocket, 0o600)
	waitForSocket(t, adminSocket)

	revokeViaSocket := func(t *testing.T, grantID string) AdminResult {
		t.Helper()
		conn, err := net.DialTimeout("unix", adminSocket, 2*time.Second)
		if err != nil {
			t.Fatalf("dial admin socket: %v", err)
		}
		defer conn.Close()
		if err := json.NewEncoder(conn).Encode(AdminOp{Op: "revoke_grant", GrantID: grantID}); err != nil {
			t.Fatalf("encode: %v", err)
		}
		var result AdminResult
		if err := json.NewDecoder(conn).Decode(&result); err != nil {
			t.Fatalf("decode: %v", err)
		}
		return result
	}

	t.Run("PENDING_PUBLISHED", func(t *testing.T) {
		g, err := admin.Create(grant.CreateRequest{RequestDigest: "d-pub-pending", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour})
		if err != nil {
			t.Fatalf("Create: %v", err)
		}
		if _, err := client.BeginOrResume("d-pub-pending"); err != nil {
			t.Fatalf("BeginOrResume: %v", err)
		}

		if err := os.Mkdir(grantPath+".tmp", 0o700); err != nil {
			t.Fatalf("obstruct: %v", err)
		}
		if err := client.MarkPublished(g.GrantID, "head", 0); err == nil {
			t.Fatalf("expected MarkPublished to fail while persistence is obstructed")
		}

		result := revokeViaSocket(t, g.GrantID)
		if err := os.Remove(grantPath + ".tmp"); err != nil {
			t.Fatalf("clear obstruction: %v", err)
		}

		if result.OK {
			t.Fatalf("expected OK=false revoking a pending-PUBLISHED grant, got %+v", result)
		}
		if result.Code != "GRANT_PUBLISH_PERSIST_FAILED" {
			t.Fatalf("SECURITY DEFECT: expected Code=GRANT_PUBLISH_PERSIST_FAILED for a pending PUBLISHED grant, got %+v (must not be GRANT_ALREADY_PUBLISHED/GRANT_REVOKE_FAILED)", result)
		}
	})

	t.Run("PENDING_BLOCKED", func(t *testing.T) {
		g, err := admin.Create(grant.CreateRequest{RequestDigest: "d-blk-pending", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour})
		if err != nil {
			t.Fatalf("Create: %v", err)
		}
		if _, err := client.BeginOrResume("d-blk-pending"); err != nil {
			t.Fatalf("BeginOrResume: %v", err)
		}

		if err := os.Mkdir(grantPath+".tmp", 0o700); err != nil {
			t.Fatalf("obstruct: %v", err)
		}
		if err := client.MarkBlocked(g.GrantID, "SOME_REASON"); err == nil {
			t.Fatalf("expected MarkBlocked to fail while persistence is obstructed")
		}

		result := revokeViaSocket(t, g.GrantID)
		if err := os.Remove(grantPath + ".tmp"); err != nil {
			t.Fatalf("clear obstruction: %v", err)
		}

		if result.OK {
			t.Fatalf("expected OK=false revoking a pending-BLOCKED grant, got %+v", result)
		}
		if result.Code != "GRANT_BLOCK_PERSIST_FAILED" {
			t.Fatalf("SECURITY DEFECT: expected Code=GRANT_BLOCK_PERSIST_FAILED for a pending BLOCKED grant, got %+v (must not be GRANT_PREVIOUSLY_BLOCKED/GRANT_REVOKE_FAILED)", result)
		}
	})
}

// --- Wire and component size limits (V3.1-B Hardening) -----------------------------------------
//
// Confirmed gap: ClientListener.handleConn used to decode a caller-supplied JSON object (and its 4
// base64 fields) with no upper bound at all -- a caller reaching the unprivileged client socket
// could force excessive memory allocation before any schema/Git verification ever ran. The tests
// below prove: (1) the raw wire bytes are capped at MaxWireBytes, (2) trailing content after the one
// JSON value is rejected, (3) each of the 4 components is capped at its own documented decoded-size
// limit independently, in a stable order, (4) invalid base64 is still rejected exactly as before, and
// (5) none of this ever lets a size-rejected request reach Orchestrate / touch any Deps field.

// countingTokenMinter is a TokenMinter that must NEVER be called for a size-rejected request --
// Mint is only ever reached deep inside Orchestrate's remote-publication phase, so if it is called
// at all during one of the size-rejection tests below, handleConn incorrectly let a rejected request
// through to Orchestrate.
type countingTokenMinter struct{ calls int32 }

func (m *countingTokenMinter) Mint(ctx context.Context, repositoryName string, permissions map[string]string) (githubapp.Token, error) {
	atomic.AddInt32(&m.calls, 1)
	return githubapp.Token{}, fmt.Errorf("countingTokenMinter: Mint must never be called for a size-rejected request")
}

// newSizeTestClientListener spins up a real ClientListener on a real Unix socket, backed by a real
// grant.Store and an instrumented TokenMinter, and returns the socket path plus that minter so a
// test can assert its call count stayed at zero.
func newSizeTestClientListener(t *testing.T) (sockPath string, minter *countingTokenMinter) {
	t.Helper()
	grantPath := filepath.Join(t.TempDir(), "grants.json")
	store, err := grant.Open(grantPath)
	if err != nil {
		t.Fatalf("grant.Open: %v", err)
	}
	minter = &countingTokenMinter{}
	client := NewClientListener(Deps{Grants: store.Client(), TokenMinter: minter})
	sockDir := shortSocketDir(t)
	sockPath = filepath.Join(sockDir, "c.sock")
	go client.ServeSocket(sockPath, 0o666)
	waitForSocket(t, sockPath)
	return sockPath, minter
}

// frameOf prepends the new wire framing's 8-byte unsigned big-endian payload-length header to
// payload, producing exactly the bytes a well-formed single-frame request puts on the wire: header
// then payload, nothing else. Used both to build a valid frame end-to-end and, by tests that want to
// deliberately send only part of one, as the source frame they slice.
func frameOf(payload []byte) []byte {
	var header [wireFrameHeaderBytes]byte
	binary.BigEndian.PutUint64(header[:], uint64(len(payload)))
	frame := make([]byte, 0, len(header)+len(payload))
	frame = append(frame, header[:]...)
	frame = append(frame, payload...)
	return frame
}

// sendRawToClientSocket frames payload as exactly one wire frame (frameOf) and sends it as a single
// request, then decodes the wire Result the server sends back. It no longer half-closes the
// connection -- under the new length-prefixed frame format the server determines the exact end of
// the request from the declared length alone, with no dependency on EOF/half-close timing on either
// side (the response itself is still a plain json.Encoder.Encode, unchanged by this round).
func sendRawToClientSocket(t *testing.T, sockPath string, payload []byte) Result {
	t.Helper()
	conn, err := net.DialTimeout("unix", sockPath, 5*time.Second)
	if err != nil {
		t.Fatalf("dial client socket: %v", err)
	}
	defer conn.Close()
	if _, err := conn.Write(frameOf(payload)); err != nil {
		t.Fatalf("write: %v", err)
	}
	var result Result
	if err := json.NewDecoder(conn).Decode(&result); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	return result
}

// sendChunked dials the client socket, writes each of chunks with a separate conn.Write call (proving
// io.ReadFull on the server side correctly reassembles a header or payload split across multiple
// writes -- never relying on one write landing as one read), and decodes the wire Result sent back.
// Callers pass already-framed bytes split at arbitrary boundaries; this never adds its own framing.
func sendChunked(t *testing.T, sockPath string, chunks ...[]byte) Result {
	t.Helper()
	conn, err := net.DialTimeout("unix", sockPath, 5*time.Second)
	if err != nil {
		t.Fatalf("dial client socket: %v", err)
	}
	defer conn.Close()
	for _, c := range chunks {
		if len(c) == 0 {
			continue
		}
		if _, err := conn.Write(c); err != nil {
			t.Fatalf("write chunk: %v", err)
		}
	}
	var result Result
	if err := json.NewDecoder(conn).Decode(&result); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	return result
}

// b64OfLen returns a valid base64 string that decodes to exactly n bytes.
func b64OfLen(n int) string {
	return base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{'A'}, n))
}

// isTransportRejection reports whether reason is one of the stable codes handleConn can return
// BEFORE Orchestrate is ever invoked (the size-limit codes, the frame-level codes, and the
// pre-existing malformed-input codes) -- used by tests that want to confirm a request reached
// Orchestrate (i.e. was NOT rejected at the transport/size/frame layer), regardless of what
// Orchestrate itself then decided.
func isTransportRejection(reason string) bool {
	switch reason {
	case "MALFORMED_FRAME", "WIRE_REQUEST_TOO_LARGE", "ENVELOPE_TOO_LARGE", "RECEIPT_TOO_LARGE", "BUNDLE_TOO_LARGE", "MANIFEST_TOO_LARGE", "MALFORMED_WIRE_REQUEST", "MALFORMED_BASE64":
		return true
	default:
		return false
	}
}

// buildWireJSON hand-assembles a packageWireRequest's raw wire JSON bytes byte-for-byte (never via
// json.Marshal, so the exact total length is controllable) and pads with insignificant JSON
// whitespace -- inserted AFTER the manifest field's closing quote, i.e. between the object's last
// field and its closing brace, never inside a string value -- to reach exactly targetLen bytes.
// targetLen < 0 means "no padding, just the natural encoding." Fails the test if targetLen is
// smaller than the unpadded encoding requires.
func buildWireJSON(t *testing.T, envelopeB64, receiptB64, bundleB64, manifestB64 string, targetLen int) []byte {
	t.Helper()
	const (
		prefix = `{"envelope_b64":"`
		mid1   = `","receipt_b64":"`
		mid2   = `","bundle_b64":"`
		mid3   = `","manifest_b64":"`
	)
	baseLen := len(prefix) + len(envelopeB64) + len(mid1) + len(receiptB64) + len(mid2) + len(bundleB64) + len(mid3) + len(manifestB64) + len(`"}`)
	if targetLen < 0 {
		targetLen = baseLen
	}
	if baseLen > targetLen {
		t.Fatalf("buildWireJSON: base encoding (%d bytes) already exceeds targetLen %d", baseLen, targetLen)
	}
	pad := targetLen - baseLen

	buf := make([]byte, 0, targetLen)
	buf = append(buf, prefix...)
	buf = append(buf, envelopeB64...)
	buf = append(buf, mid1...)
	buf = append(buf, receiptB64...)
	buf = append(buf, mid2...)
	buf = append(buf, bundleB64...)
	buf = append(buf, mid3...)
	buf = append(buf, manifestB64...)
	buf = append(buf, '"') // close the manifest_b64 string BEFORE padding, so padding never lands inside a string value
	for i := 0; i < pad; i++ {
		buf = append(buf, ' ')
	}
	buf = append(buf, '}')
	return buf
}

// TestMinPossibleDecodedLen_TightAndSafe proves two properties of the pre-decode base64 length bound
// (V3.1-B Closeout Pack A.1 review remediation) for limit=MaxEnvelopeBytes, which satisfies
// limit % 3 == 1 -- the modulus where base64's 4-byte-group/padding quantization makes limit,
// limit+1, and limit+2 all share the SAME encoded length. This sharing is an information-theoretic
// property of base64 length alone (decoded length cannot be recovered exactly from encoded length
// without inspecting padding), not a bug in any particular formula: no length-only pre-check, however
// formulated, can distinguish an encoding of exactly `limit` bytes from one of `limit+1` or `limit+2`
// bytes when they produce the identical encoded length. What the bound CAN and must do -- and does --
// is (1) never reject the legitimate at-limit case, and (2) reject anything a full base64 group (4
// encoded chars) beyond that ambiguous window, where the minimum possible decoded length has crossed
// the limit unambiguously. The mandatory, unconditional post-decode length check in
// decodePackageComponents is what closes the remaining <= 2-byte ambiguous window exactly -- this
// pre-check's job is only to bound the ALLOCATION the caller can force before that exact check runs,
// which it does: even in the worst case within this ambiguous window, the forced allocation is at
// most 2 bytes over the limit, categorically different from the unbounded-multiple-of-the-limit
// allocation this whole pre-decode bound exists to prevent.
func TestMinPossibleDecodedLen_TightAndSafe(t *testing.T) {
	const limit = MaxEnvelopeBytes // 1 << 20; 1<<20 % 3 == 1
	if limit%3 != 1 {
		t.Fatalf("test setup bug: this test specifically requires limit %% 3 == 1, got limit %% 3 == %d", limit%3)
	}

	atLimitEncodedLen := len(b64OfLen(limit))
	if minPossibleDecodedLen(atLimitEncodedLen) > limit {
		t.Fatalf("SECURITY/CORRECTNESS DEFECT: an encoded length that can legitimately represent exactly the limit (%d) was rejected by the pre-decode bound", limit)
	}

	// limit+1 and limit+2 share atLimitEncodedLen's exact encoded length (the inherent ambiguous
	// window described above) -- both are still safely caught by the unconditional post-decode check,
	// proven separately by TestClientSocket_ComponentSizeLimits_EnvelopeReceiptManifest's
	// "envelope_over_limit" case (which uses exactly limit+1). What THIS test additionally proves is
	// that the pre-check bound is otherwise tight: an encoded length a full base64 group beyond that
	// window -- unambiguously representing more than the limit no matter how it is padded -- IS
	// rejected before any decode is attempted.
	unambiguouslyOverEncodedLen := atLimitEncodedLen + 4
	if minPossibleDecodedLen(unambiguouslyOverEncodedLen) <= limit {
		t.Fatalf("CORRECTNESS DEFECT: an encoded length one full base64 group beyond the limit's ambiguous window (which can ONLY represent more than the limit) was NOT rejected by the pre-decode bound")
	}
}

// TestClientSocket_ComponentSizeLimits_EnvelopeReceiptManifest covers the small (1 MiB) components:
// exactly at each one's limit -> not rejected for a transport/size reason; exactly one byte over ->
// rejected with that field's specific code, never a generic one.
func TestClientSocket_ComponentSizeLimits_EnvelopeReceiptManifest(t *testing.T) {
	sockPath, minter := newSizeTestClientListener(t)
	small := b64OfLen(16)

	cases := []struct {
		name                                string
		envelope, receipt, bundle, manifest string
		wantReason                          string // "" means: must NOT be a transport/size rejection
	}{
		{"envelope_at_limit", b64OfLen(MaxEnvelopeBytes), small, small, small, ""},
		{"envelope_over_limit", b64OfLen(MaxEnvelopeBytes + 1), small, small, small, "ENVELOPE_TOO_LARGE"},
		{"receipt_at_limit", small, b64OfLen(MaxReceiptBytes), small, small, ""},
		{"receipt_over_limit", small, b64OfLen(MaxReceiptBytes + 1), small, small, "RECEIPT_TOO_LARGE"},
		{"manifest_at_limit", small, small, small, b64OfLen(MaxManifestBytes), ""},
		{"manifest_over_limit", small, small, small, b64OfLen(MaxManifestBytes + 1), "MANIFEST_TOO_LARGE"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			raw, err := json.Marshal(packageWireRequest{EnvelopeB64: tc.envelope, ReceiptB64: tc.receipt, BundleB64: tc.bundle, ManifestB64: tc.manifest})
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			result := sendRawToClientSocket(t, sockPath, raw)
			if tc.wantReason == "" {
				if isTransportRejection(result.FailureReason) {
					t.Fatalf("expected NOT a transport/size rejection, got %+v", result)
				}
				return
			}
			if result.Status != "BLOCKED" || result.FailureReason != tc.wantReason {
				t.Fatalf("expected BLOCKED/%s, got %+v", tc.wantReason, result)
			}
		})
	}

	if calls := atomic.LoadInt32(&minter.calls); calls != 0 {
		t.Fatalf("SECURITY DEFECT: TokenMinter.Mint was called %d time(s) for a size-rejected request", calls)
	}
}

// decodeWireRequestAndComponents drives the EXACT SAME two functions handleConn calls before ever
// touching Orchestrate (decodeWireRequest then, on success, decodePackageComponents) directly against
// an in-memory reader, bypassing a real Unix socket entirely. The large-payload boundary tests below
// use this instead of the full sendRawToClientSocket transport: handleConn's connection carries a
// fixed 2-minute net.Conn deadline, and under `-race` the CPU cost alone of JSON-decoding /
// base64-decoding tens of MB of content can legitimately exceed 2 minutes (observed directly: a real
// end-to-end socket version of these exact tests reliably hit the deadline and failed with a broken
// pipe) -- that is a property of the OS-socket-plus-race-instrumentation test harness, not of the
// size-gate logic under test, and calling straight into these two pure functions removes it while
// still exercising the real production code path byte-for-byte. Because Orchestrate is never called
// here at all, "no Deps field is ever touched" is trivially true by construction for these specific
// cases; TestClientSocket_ComponentSizeLimits_EnvelopeReceiptManifest and the other small-payload
// tests above already prove that property behaviorally through the real socket/Orchestrate/Deps path.
func decodeWireRequestAndComponents(raw []byte) (reason string, ok bool) {
	req, reason, ok := decodeWireRequest(bytes.NewReader(frameOf(raw)))
	if !ok {
		return reason, false
	}
	_, _, _, _, reason, ok = decodePackageComponents(req)
	return reason, ok
}

// TestClientSocket_BundleSizeLimit covers the larger (64 MiB) bundle component separately, since
// constructing it is the most memory-heavy of the four.
func TestClientSocket_BundleSizeLimit(t *testing.T) {
	small := b64OfLen(16)

	t.Run("at_limit", func(t *testing.T) {
		raw, err := json.Marshal(packageWireRequest{EnvelopeB64: small, ReceiptB64: small, BundleB64: b64OfLen(MaxBundleBytes), ManifestB64: small})
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		reason, ok := decodeWireRequestAndComponents(raw)
		if !ok {
			t.Fatalf("expected acceptance at exactly MaxBundleBytes, got reason=%q", reason)
		}
	})

	t.Run("over_limit", func(t *testing.T) {
		raw, err := json.Marshal(packageWireRequest{EnvelopeB64: small, ReceiptB64: small, BundleB64: b64OfLen(MaxBundleBytes + 1), ManifestB64: small})
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		reason, ok := decodeWireRequestAndComponents(raw)
		if ok || reason != "BUNDLE_TOO_LARGE" {
			t.Fatalf("expected rejection with BUNDLE_TOO_LARGE, got ok=%v reason=%q", ok, reason)
		}
	})
}

// TestClientSocket_ComponentEncodedLengthAlone_RejectedBeforeDecodeMaterializesBuffer proves Work
// Package 4's specific defect closure: MaxWireBytes (96 MiB) alone never bounds any SINGLE field's
// decoded size -- only the sum of all wire bytes -- so before the pre-decode encoded-length check,
// a caller could send an EnvelopeB64 field many times larger than MaxEnvelopeBytes (1 MiB) while the
// complete wire frame still sat comfortably under the 96 MiB wire cap, forcing an oversized decoded
// allocation for that one field alone. Here EnvelopeB64 decodes to 8 MiB (8x MaxEnvelopeBytes) while
// the whole frame is far below MaxWireBytes -- proving decodePackageComponents's per-component
// ENVELOPE_TOO_LARGE check fires on its own, independent of (and well before) the global wire-size
// budget, from the field's ENCODED length alone (base64.StdEncoding.EncodedLen(MaxEnvelopeBytes)
// compared directly against len(EnvelopeB64)) rather than only after fully decoding it.
func TestClientSocket_ComponentEncodedLengthAlone_RejectedBeforeDecodeMaterializesBuffer(t *testing.T) {
	small := b64OfLen(16)
	const oversizedEnvelopeDecodedLen = 8 << 20 // 8 MiB: >> MaxEnvelopeBytes (1 MiB), << MaxWireBytes (96 MiB)

	raw, err := json.Marshal(packageWireRequest{
		EnvelopeB64: b64OfLen(oversizedEnvelopeDecodedLen),
		ReceiptB64:  small,
		BundleB64:   small,
		ManifestB64: small,
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if len(raw) >= MaxWireBytes {
		t.Fatalf("test setup bug: constructed frame (%d bytes) is not comfortably under MaxWireBytes (%d)", len(raw), MaxWireBytes)
	}

	reason, ok := decodeWireRequestAndComponents(raw)
	if ok || reason != "ENVELOPE_TOO_LARGE" {
		t.Fatalf("expected rejection with the component-specific ENVELOPE_TOO_LARGE (not a generic wire-size code), got ok=%v reason=%q", ok, reason)
	}
}

// TestClientSocket_WireSizeLimit covers the raw-wire-bytes cap directly: exactly MaxWireBytes ->
// accepted; exactly one byte over -> WIRE_REQUEST_TOO_LARGE. Also proves this holds true end-to-end
// through the real Unix socket at a size well within a single connection's normal processing time
// (small components, only the wire-level padding is large) via the "exactly at the wire limit"
// sub-case below, in addition to the direct-function exact-limit/over-limit pair above the fold.
func TestClientSocket_WireSizeLimit(t *testing.T) {
	small := b64OfLen(16)

	atLimit := buildWireJSON(t, small, small, small, small, MaxWireBytes)
	if len(atLimit) != MaxWireBytes {
		t.Fatalf("test setup bug: built %d bytes, want exactly MaxWireBytes (%d)", len(atLimit), MaxWireBytes)
	}
	if reason, ok := decodeWireRequestAndComponents(atLimit); !ok {
		t.Fatalf("expected a request of exactly MaxWireBytes to be accepted, got reason=%q", reason)
	}

	overLimit := buildWireJSON(t, small, small, small, small, MaxWireBytes+1)
	if len(overLimit) != MaxWireBytes+1 {
		t.Fatalf("test setup bug: built %d bytes, want exactly MaxWireBytes+1 (%d)", len(overLimit), MaxWireBytes+1)
	}
	if reason, ok := decodeWireRequestAndComponents(overLimit); ok || reason != "WIRE_REQUEST_TOO_LARGE" {
		t.Fatalf("expected rejection with WIRE_REQUEST_TOO_LARGE, got ok=%v reason=%q", ok, reason)
	}
}

// TestClientSocket_CombinedComponentsWithinOwnLimitsButWireExceeds proves the wire cap is checked
// independently of the per-component caps: all 4 components sit exactly at (never over) their own
// documented limit -- so no single per-component check would fire -- yet the total raw wire bytes
// (padded with insignificant whitespace, simulating real-world JSON/base64 overhead pushing the
// total over budget) exceed MaxWireBytes. The request must still be rejected.
func TestClientSocket_CombinedComponentsWithinOwnLimitsButWireExceeds(t *testing.T) {
	envelope := b64OfLen(MaxEnvelopeBytes)
	receipt := b64OfLen(MaxReceiptBytes)
	bundle := b64OfLen(MaxBundleBytes)
	manifest := b64OfLen(MaxManifestBytes)

	natural := buildWireJSON(t, envelope, receipt, bundle, manifest, -1)
	if len(natural) >= MaxWireBytes {
		t.Fatalf("test setup bug: max-sized components alone (%d bytes) already exceed MaxWireBytes -- padding cannot demonstrate this case", len(natural))
	}

	raw := buildWireJSON(t, envelope, receipt, bundle, manifest, MaxWireBytes+1)
	reason, ok := decodeWireRequestAndComponents(raw)
	if ok {
		t.Fatalf("expected the request to be rejected, got ok=true")
	}
	if reason != "WIRE_REQUEST_TOO_LARGE" {
		t.Fatalf("expected WIRE_REQUEST_TOO_LARGE (no single component here exceeds its own limit), got reason=%q", reason)
	}
}

// TestClientSocket_TrailingJSONValue_RejectsAsMalformedWireRequest proves a second top-level JSON
// value (or any non-whitespace garbage) after a valid, well-sized object is rejected -- the pre-fix
// code never checked dec.More() at all.
func TestClientSocket_TrailingJSONValue_RejectsAsMalformedWireRequest(t *testing.T) {
	sockPath, minter := newSizeTestClientListener(t)
	small := b64OfLen(16)
	base, err := json.Marshal(packageWireRequest{EnvelopeB64: small, ReceiptB64: small, BundleB64: small, ManifestB64: small})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	raw := append(append([]byte{}, base...), []byte(`{"extra":"garbage"}`)...)

	result := sendRawToClientSocket(t, sockPath, raw)
	if result.Status != "BLOCKED" || result.FailureReason != "MALFORMED_WIRE_REQUEST" {
		t.Fatalf("expected BLOCKED/MALFORMED_WIRE_REQUEST for trailing JSON content, got %+v", result)
	}

	if calls := atomic.LoadInt32(&minter.calls); calls != 0 {
		t.Fatalf("SECURITY DEFECT: TokenMinter.Mint was called %d time(s) for a size-rejected request", calls)
	}
}

// TestClientSocket_InvalidBase64_StillRejectsAsMalformedBase64 confirms the pre-existing
// MALFORMED_BASE64 behavior is unchanged for invalid base64 content that is well within all size
// limits.
func TestClientSocket_InvalidBase64_StillRejectsAsMalformedBase64(t *testing.T) {
	sockPath, minter := newSizeTestClientListener(t)
	small := b64OfLen(16)
	raw, err := json.Marshal(packageWireRequest{EnvelopeB64: "not-valid-base64!!!", ReceiptB64: small, BundleB64: small, ManifestB64: small})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	result := sendRawToClientSocket(t, sockPath, raw)
	if result.Status != "BLOCKED" || result.FailureReason != "MALFORMED_BASE64" {
		t.Fatalf("expected BLOCKED/MALFORMED_BASE64, got %+v", result)
	}

	if calls := atomic.LoadInt32(&minter.calls); calls != 0 {
		t.Fatalf("SECURITY DEFECT: TokenMinter.Mint was called %d time(s) for a malformed-base64-rejected request", calls)
	}
}

// TestClientSocket_WellFormedSizedPackage_ReachesOrchestrate is the non-size-related happy-path
// sanity check: a normal, well-formed, appropriately-sized package is NOT rejected at the
// transport/size layer, and actually reaches Orchestrate (proven by getting Orchestrate's own
// MALFORMED_REQUEST classification back, since the component content here is not valid
// envelope/receipt/manifest JSON) -- confirming the size gate above isn't accidentally rejecting
// everything.
func TestClientSocket_WellFormedSizedPackage_ReachesOrchestrate(t *testing.T) {
	sockPath, _ := newSizeTestClientListener(t)
	small := b64OfLen(16)
	raw, err := json.Marshal(packageWireRequest{EnvelopeB64: small, ReceiptB64: small, BundleB64: small, ManifestB64: small})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	result := sendRawToClientSocket(t, sockPath, raw)
	if isTransportRejection(result.FailureReason) {
		t.Fatalf("expected the request to reach Orchestrate, not be rejected at the transport/size layer, got %+v", result)
	}
	if result.Status != "BLOCKED" || !strings.HasPrefix(result.FailureReason, "MALFORMED_REQUEST") {
		t.Fatalf("expected Orchestrate's own MALFORMED_REQUEST rejection (proving Orchestrate was actually reached), got %+v", result)
	}
}

// --- Wire framing (V3.1-B Hardening Work Package 3) ---------------------------------------------
//
// Confirmed gap: the prior design used json.Decoder.Buffered() to detect trailing content after the
// one JSON value it decoded, which only ever proves "nothing extra was already sitting in that
// decoder's own buffer at check time" -- never "exactly one JSON value was ever intended." These
// tests cover the replacement explicit frame (8-byte big-endian payload length + exactly that many
// JSON bytes) end-to-end against the real client socket: fragmented reads, the size boundary at the
// frame layer, truncation, multiple-values/garbage inside one frame, an unknown field, and the
// one-frame-per-connection cardinality.

// TestClientSocket_FragmentedHeaderReads_ReassembledCorrectly proves io.ReadFull inside
// decodeWireRequest correctly reassembles the 8-byte length header even when a caller writes it
// across several separate, small conn.Write calls rather than one.
func TestClientSocket_FragmentedHeaderReads_ReassembledCorrectly(t *testing.T) {
	sockPath, _ := newSizeTestClientListener(t)
	small := b64OfLen(16)
	payload, err := json.Marshal(packageWireRequest{EnvelopeB64: small, ReceiptB64: small, BundleB64: small, ManifestB64: small})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	frame := frameOf(payload)
	// Split only the 8-byte header across three writes (3 + 3 + 2 bytes); the payload follows in one
	// final write.
	result := sendChunked(t, sockPath, frame[0:3], frame[3:6], frame[6:8], frame[8:])
	if isTransportRejection(result.FailureReason) {
		t.Fatalf("expected a fragmented-but-well-formed header to be reassembled and NOT rejected at the transport/frame layer, got %+v", result)
	}
	if result.Status != "BLOCKED" || !strings.HasPrefix(result.FailureReason, "MALFORMED_REQUEST") {
		t.Fatalf("expected Orchestrate's own MALFORMED_REQUEST rejection (proving the frame was correctly reassembled and reached Orchestrate), got %+v", result)
	}
}

// TestClientSocket_FragmentedPayloadReads_ReassembledCorrectly is the same proof for the payload:
// io.ReadFull must correctly reassemble a payload written across several separate conn.Write calls.
func TestClientSocket_FragmentedPayloadReads_ReassembledCorrectly(t *testing.T) {
	sockPath, _ := newSizeTestClientListener(t)
	small := b64OfLen(16)
	payload, err := json.Marshal(packageWireRequest{EnvelopeB64: small, ReceiptB64: small, BundleB64: small, ManifestB64: small})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	frame := frameOf(payload)
	mid := wireFrameHeaderBytes + len(payload)/2
	result := sendChunked(t, sockPath, frame[:wireFrameHeaderBytes], frame[wireFrameHeaderBytes:mid], frame[mid:])
	if isTransportRejection(result.FailureReason) {
		t.Fatalf("expected a fragmented-but-well-formed payload to be reassembled and NOT rejected at the transport/frame layer, got %+v", result)
	}
	if result.Status != "BLOCKED" || !strings.HasPrefix(result.FailureReason, "MALFORMED_REQUEST") {
		t.Fatalf("expected Orchestrate's own MALFORMED_REQUEST rejection (proving the frame was correctly reassembled and reached Orchestrate), got %+v", result)
	}
}

// TestClientSocket_OversizedHeaderAlone_RejectedBeforePayloadSent proves the WIRE_REQUEST_TOO_LARGE
// check fires from the 8-byte header ALONE, strictly before the server ever attempts to read (or
// allocate a buffer for) a matching payload: this test deliberately sends ONLY the oversized header
// and never sends any payload bytes at all, yet still gets a prompt rejection rather than a hang
// waiting for payload bytes that never come.
func TestClientSocket_OversizedHeaderAlone_RejectedBeforePayloadSent(t *testing.T) {
	sockPath, minter := newSizeTestClientListener(t)
	conn, err := net.DialTimeout("unix", sockPath, 5*time.Second)
	if err != nil {
		t.Fatalf("dial client socket: %v", err)
	}
	defer conn.Close()

	var header [wireFrameHeaderBytes]byte
	binary.BigEndian.PutUint64(header[:], uint64(MaxWireBytes+1))
	if _, err := conn.Write(header[:]); err != nil {
		t.Fatalf("write header: %v", err)
	}
	// Deliberately no payload write here at all.

	var result Result
	if err := json.NewDecoder(conn).Decode(&result); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	if result.Status != "BLOCKED" || result.FailureReason != "WIRE_REQUEST_TOO_LARGE" {
		t.Fatalf("expected BLOCKED/WIRE_REQUEST_TOO_LARGE from the header alone, got %+v", result)
	}
	if calls := atomic.LoadInt32(&minter.calls); calls != 0 {
		t.Fatalf("SECURITY DEFECT: TokenMinter.Mint was called %d time(s) for a size-rejected request", calls)
	}
}

// TestClientSocket_TruncatedHeader_RejectedAsMalformedFrame proves a connection that closes its write
// side after fewer than 8 header bytes is rejected as MALFORMED_FRAME, not a panic or an indefinite
// hang.
func TestClientSocket_TruncatedHeader_RejectedAsMalformedFrame(t *testing.T) {
	sockPath, minter := newSizeTestClientListener(t)
	conn, err := net.DialTimeout("unix", sockPath, 5*time.Second)
	if err != nil {
		t.Fatalf("dial client socket: %v", err)
	}
	defer conn.Close()

	if _, err := conn.Write([]byte{0x00, 0x00, 0x01}); err != nil {
		t.Fatalf("write: %v", err)
	}
	cw, ok := conn.(interface{ CloseWrite() error })
	if !ok {
		t.Fatalf("conn does not support CloseWrite")
	}
	if err := cw.CloseWrite(); err != nil {
		t.Fatalf("CloseWrite: %v", err)
	}

	var result Result
	if err := json.NewDecoder(conn).Decode(&result); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	if result.Status != "BLOCKED" || result.FailureReason != "MALFORMED_FRAME" {
		t.Fatalf("expected BLOCKED/MALFORMED_FRAME for a truncated header, got %+v", result)
	}
	if calls := atomic.LoadInt32(&minter.calls); calls != 0 {
		t.Fatalf("SECURITY DEFECT: TokenMinter.Mint was called %d time(s) for a malformed-frame request", calls)
	}
}

// TestClientSocket_TruncatedPayload_RejectedAsMalformedFrame proves a connection that closes its
// write side after the full header plus SOME but not all of the declared payload bytes is rejected
// as MALFORMED_FRAME (the same code as a truncated header -- both are simply "the declared frame was
// never fully received"), not a panic or an indefinite hang.
func TestClientSocket_TruncatedPayload_RejectedAsMalformedFrame(t *testing.T) {
	sockPath, minter := newSizeTestClientListener(t)
	small := b64OfLen(16)
	payload, err := json.Marshal(packageWireRequest{EnvelopeB64: small, ReceiptB64: small, BundleB64: small, ManifestB64: small})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	frame := frameOf(payload)

	conn, err := net.DialTimeout("unix", sockPath, 5*time.Second)
	if err != nil {
		t.Fatalf("dial client socket: %v", err)
	}
	defer conn.Close()

	partial := frame[:wireFrameHeaderBytes+len(payload)/2]
	if _, err := conn.Write(partial); err != nil {
		t.Fatalf("write partial frame: %v", err)
	}
	cw, ok := conn.(interface{ CloseWrite() error })
	if !ok {
		t.Fatalf("conn does not support CloseWrite")
	}
	if err := cw.CloseWrite(); err != nil {
		t.Fatalf("CloseWrite: %v", err)
	}

	var result Result
	if err := json.NewDecoder(conn).Decode(&result); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	if result.Status != "BLOCKED" || result.FailureReason != "MALFORMED_FRAME" {
		t.Fatalf("expected BLOCKED/MALFORMED_FRAME for a truncated payload, got %+v", result)
	}
	if calls := atomic.LoadInt32(&minter.calls); calls != 0 {
		t.Fatalf("SECURITY DEFECT: TokenMinter.Mint was called %d time(s) for a malformed-frame request", calls)
	}
}

// TestClientSocket_ZeroLengthDeclaredFrame_RejectedAsMalformedFrame proves a header declaring a
// payload length of exactly zero is rejected as MALFORMED_FRAME -- there is no such thing as a valid
// zero-length packageWireRequest.
func TestClientSocket_ZeroLengthDeclaredFrame_RejectedAsMalformedFrame(t *testing.T) {
	sockPath, minter := newSizeTestClientListener(t)
	conn, err := net.DialTimeout("unix", sockPath, 5*time.Second)
	if err != nil {
		t.Fatalf("dial client socket: %v", err)
	}
	defer conn.Close()

	var header [wireFrameHeaderBytes]byte // all-zero -> declared length 0
	if _, err := conn.Write(header[:]); err != nil {
		t.Fatalf("write header: %v", err)
	}

	var result Result
	if err := json.NewDecoder(conn).Decode(&result); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	if result.Status != "BLOCKED" || result.FailureReason != "MALFORMED_FRAME" {
		t.Fatalf("expected BLOCKED/MALFORMED_FRAME for a zero-length declared frame, got %+v", result)
	}
	if calls := atomic.LoadInt32(&minter.calls); calls != 0 {
		t.Fatalf("SECURITY DEFECT: TokenMinter.Mint was called %d time(s) for a malformed-frame request", calls)
	}
}

// TestClientSocket_TwoJSONValuesInOneFrame_RejectsAsMalformedWireRequest proves a frame whose payload
// holds two back-to-back JSON objects -- with no bytes beyond the declared frame length -- is
// rejected: the second Decode call inside decodeWireRequest sees a real second value, not io.EOF.
func TestClientSocket_TwoJSONValuesInOneFrame_RejectsAsMalformedWireRequest(t *testing.T) {
	sockPath, minter := newSizeTestClientListener(t)
	small := b64OfLen(16)
	base, err := json.Marshal(packageWireRequest{EnvelopeB64: small, ReceiptB64: small, BundleB64: small, ManifestB64: small})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	second, err := json.Marshal(packageWireRequest{EnvelopeB64: small, ReceiptB64: small, BundleB64: small, ManifestB64: small})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	payload := append(append([]byte{}, base...), second...)

	result := sendRawToClientSocket(t, sockPath, payload)
	if result.Status != "BLOCKED" || result.FailureReason != "MALFORMED_WIRE_REQUEST" {
		t.Fatalf("expected BLOCKED/MALFORMED_WIRE_REQUEST for two JSON values inside one frame, got %+v", result)
	}
	if calls := atomic.LoadInt32(&minter.calls); calls != 0 {
		t.Fatalf("SECURITY DEFECT: TokenMinter.Mint was called %d time(s) for a malformed-wire-request", calls)
	}
}

// TestClientSocket_TrailingGarbageInOneFrame_RejectsAsMalformedWireRequest proves a frame whose
// payload holds one valid object followed by non-JSON, non-whitespace garbage -- still entirely
// within the declared frame length -- is rejected.
func TestClientSocket_TrailingGarbageInOneFrame_RejectsAsMalformedWireRequest(t *testing.T) {
	sockPath, minter := newSizeTestClientListener(t)
	small := b64OfLen(16)
	base, err := json.Marshal(packageWireRequest{EnvelopeB64: small, ReceiptB64: small, BundleB64: small, ManifestB64: small})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	payload := append(append([]byte{}, base...), []byte("   not-json-garbage")...)

	result := sendRawToClientSocket(t, sockPath, payload)
	if result.Status != "BLOCKED" || result.FailureReason != "MALFORMED_WIRE_REQUEST" {
		t.Fatalf("expected BLOCKED/MALFORMED_WIRE_REQUEST for trailing garbage inside one frame, got %+v", result)
	}
	if calls := atomic.LoadInt32(&minter.calls); calls != 0 {
		t.Fatalf("SECURITY DEFECT: TokenMinter.Mint was called %d time(s) for a malformed-wire-request", calls)
	}
}

// TestClientSocket_UnknownWireField_RejectedAsMalformedWireRequest proves a JSON object that is
// otherwise well-formed but carries a field outside packageWireRequest's four known fields is
// rejected by DisallowUnknownFields, surfaced as MALFORMED_WIRE_REQUEST (see decodeWireRequest's own
// doc comment for why this is folded into that code rather than a separate UNKNOWN_WIRE_FIELD).
func TestClientSocket_UnknownWireField_RejectedAsMalformedWireRequest(t *testing.T) {
	sockPath, minter := newSizeTestClientListener(t)
	small := b64OfLen(16)
	payload, err := json.Marshal(map[string]string{
		"envelope_b64":     small,
		"receipt_b64":      small,
		"bundle_b64":       small,
		"manifest_b64":     small,
		"unexpected_field": "x",
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	result := sendRawToClientSocket(t, sockPath, payload)
	if result.Status != "BLOCKED" || result.FailureReason != "MALFORMED_WIRE_REQUEST" {
		t.Fatalf("expected BLOCKED/MALFORMED_WIRE_REQUEST for an unknown wire field, got %+v", result)
	}
	if calls := atomic.LoadInt32(&minter.calls); calls != 0 {
		t.Fatalf("SECURITY DEFECT: TokenMinter.Mint was called %d time(s) for a malformed-wire-request", calls)
	}
}

// TestClientSocket_SecondFrameOnSameConnection_NeverProcessed proves the server processes exactly one
// frame per connection: after a complete first frame+response cycle, a second frame written to the
// SAME connection is never read/processed as a second request -- handleConn has already returned
// (closing its side of the connection) by the time it would be sent. This is checked by confirming no
// further Result ever comes back for the second write, not by requiring the server to emit an
// explicit rejection for it.
func TestClientSocket_SecondFrameOnSameConnection_NeverProcessed(t *testing.T) {
	sockPath, _ := newSizeTestClientListener(t)
	conn, err := net.DialTimeout("unix", sockPath, 5*time.Second)
	if err != nil {
		t.Fatalf("dial client socket: %v", err)
	}
	defer conn.Close()

	small := b64OfLen(16)
	payload, err := json.Marshal(packageWireRequest{EnvelopeB64: small, ReceiptB64: small, BundleB64: small, ManifestB64: small})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if _, err := conn.Write(frameOf(payload)); err != nil {
		t.Fatalf("write first frame: %v", err)
	}
	var first Result
	if err := json.NewDecoder(conn).Decode(&first); err != nil {
		t.Fatalf("decode first result: %v", err)
	}

	// The first request/response cycle is now complete; handleConn has returned and its deferred
	// conn.Close() has run (or is imminently about to). Write a second, well-formed frame on the SAME
	// connection and confirm it never produces a second Result -- either the write itself fails
	// against the now-closed connection, or nothing further is ever readable.
	second, err := json.Marshal(packageWireRequest{EnvelopeB64: small, ReceiptB64: small, BundleB64: small, ManifestB64: small})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	_, writeErr := conn.Write(frameOf(second))

	_ = conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	buf := make([]byte, 16)
	n, readErr := conn.Read(buf)
	if writeErr == nil && n > 0 {
		t.Fatalf("SECURITY DEFECT: server produced further output (n=%d, readErr=%v) for a second frame sent after the first request/response cycle completed", n, readErr)
	}
}

// TestClientSocket_EndToEndFrameRoundTrip_MihverPublishStyle mirrors cmd/mihver-publish's submit()
// client-side framing exactly (marshal the payload map to bytes, write an 8-byte big-endian length
// header, then write the payload bytes) against a real ClientListener socket, and confirms a normal,
// complete round trip using the new framing succeeds end-to-end.
func TestClientSocket_EndToEndFrameRoundTrip_MihverPublishStyle(t *testing.T) {
	sockPath, _ := newSizeTestClientListener(t)
	conn, err := net.DialTimeout("unix", sockPath, 5*time.Second)
	if err != nil {
		t.Fatalf("dial client socket: %v", err)
	}
	defer conn.Close()

	small := b64OfLen(16)
	payload, err := json.Marshal(map[string]string{
		"envelope_b64": small,
		"receipt_b64":  small,
		"bundle_b64":   small,
		"manifest_b64": small,
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var header [wireFrameHeaderBytes]byte
	binary.BigEndian.PutUint64(header[:], uint64(len(payload)))
	if _, err := conn.Write(header[:]); err != nil {
		t.Fatalf("write header: %v", err)
	}
	if _, err := conn.Write(payload); err != nil {
		t.Fatalf("write payload: %v", err)
	}

	var result map[string]any
	if err := json.NewDecoder(conn).Decode(&result); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	if result["status"] != "BLOCKED" {
		t.Fatalf("expected a decodable Result from a normal end-to-end frame round trip, got %+v", result)
	}
}

func waitForSocket(t *testing.T, path string) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if conn, err := net.DialTimeout("unix", path, 50*time.Millisecond); err == nil {
			conn.Close()
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("socket %s never became ready", path)
}
