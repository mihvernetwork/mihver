package server

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"strings"
	"time"

	"mihver.network/publication-broker/internal/grant"
)

// Component and wire size limits (V3.1-B Hardening -- unbounded-allocation defense in depth).
//
// Without these, ClientListener.handleConn's json.Decoder would happily read and allocate memory
// for an arbitrarily large single JSON object (containing arbitrarily large base64 strings) sent by
// any caller reaching the unprivileged client socket, before any schema/Git verification ever runs.
// Every one of these is enforced BEFORE Orchestrate (and therefore before any Deps field -- Grants,
// Audit, TokenMinter, GitRemote, PRClientFactory -- is ever touched) for a request that fails any of
// them.
const (
	MaxEnvelopeBytes = 1 << 20  // 1 MiB, decoded -- an Envelope is a small, fixed-shape JSON object.
	MaxReceiptBytes  = 1 << 20  // 1 MiB, decoded -- same rationale as MaxEnvelopeBytes.
	MaxManifestBytes = 1 << 20  // 1 MiB, decoded -- same rationale as MaxEnvelopeBytes.
	MaxBundleBytes   = 64 << 20 // 64 MiB, decoded -- a Git bundle carries real repository content.

	// MaxWireBytes bounds the RAW bytes read off the client socket (before any base64 decoding),
	// i.e. the entire packageWireRequest JSON object as sent. It must comfortably cover base64's
	// ~4/3 expansion of the 66 MiB of decoded content the four limits above allow (~88 MiB encoded)
	// plus JSON field-name/quoting/structural overhead, without being so loose that it stops
	// bounding anything: 96 MiB clears the ~88 MiB encoded floor with headroom for that overhead
	// while still capping worst-case per-connection buffering to a fixed, small multiple of the
	// legitimate maximum package size.
	MaxWireBytes = 96 << 20
)

// packageWireRequest is the client socket's one accepted message shape: a PublicationPackage's four
// components, base64-encoded. This is the ONLY operation the client socket accepts -- there is no
// admin op reachable through this type or this listener.
type packageWireRequest struct {
	EnvelopeB64 string `json:"envelope_b64"`
	ReceiptB64  string `json:"receipt_b64"`
	BundleB64   string `json:"bundle_b64"`
	ManifestB64 string `json:"manifest_b64"`
}

// ClientListener serves the unprivileged publication-request socket. Its Serve loop's only
// operation is decode-one-package -> Orchestrate -> encode-one-Result; it holds a *grant.ClientHandle
// (via Deps.Grants.Client(), called once at construction) and has no field or method through which
// it could reach an *grant.AdminHandle.
type ClientListener struct {
	deps Deps
}

func NewClientListener(deps Deps) *ClientListener { return &ClientListener{deps: deps} }

// ServeSocket listens on a Unix socket at path (removing any stale socket file first) and serves
// one request per connection until the listener is closed. mode restricts the socket file's
// permission bits -- production deployment (docs/development/PUBLICATION_BROKER.md) is what
// actually restricts which OS identity can reach this socket at all; mode is defense in depth on
// top of that, not a substitute for it.
func (c *ClientListener) ServeSocket(path string, mode os.FileMode) error {
	if err := safeRemoveStaleSocket(path); err != nil {
		return err
	}
	ln, err := net.Listen("unix", path)
	if err != nil {
		return fmt.Errorf("server: listen client socket: %w", err)
	}
	defer ln.Close()
	if err := os.Chmod(path, mode); err != nil {
		return fmt.Errorf("server: chmod client socket: %w", err)
	}
	for {
		conn, err := ln.Accept()
		if err != nil {
			return err
		}
		go c.handleConn(conn)
	}
}

func (c *ClientListener) handleConn(conn net.Conn) {
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(2 * time.Minute))

	req, reason, ok := decodeWireRequest(conn)
	if !ok {
		_ = json.NewEncoder(conn).Encode(blockedResult(reason))
		return
	}

	envelopeBytes, receiptBytes, bundleBytes, manifestBytes, reason, ok := decodePackageComponents(req)
	if !ok {
		_ = json.NewEncoder(conn).Encode(blockedResult(reason))
		return
	}

	result := Orchestrate(context.Background(), c.deps, envelopeBytes, receiptBytes, bundleBytes, manifestBytes)
	_ = json.NewEncoder(conn).Encode(result)
}

// wireFrameHeaderBytes is the fixed size, in bytes, of the length prefix that precedes every wire
// request's JSON payload: an 8-byte unsigned big-endian integer giving the exact number of payload
// bytes that follow.
const wireFrameHeaderBytes = 8

// decodeWireRequest reads exactly one length-prefixed frame from r and decodes it as exactly one
// packageWireRequest JSON object.
//
// V3.1-B Hardening (Work Package 3): this replaces a prior design that relied on
// json.Decoder.Buffered() to detect trailing content after the first JSON value. Buffered() only
// inspects bytes the decoder had ALREADY pulled off the wire while parsing that first value -- it
// says nothing about a second value the client sends on a LATER, separate write that simply hadn't
// arrived yet when the check ran. That prior design was therefore never actually proving "exactly one
// JSON value was ever intended," only "no additional value happened to already be sitting in the
// decoder's buffer." It was harmless in practice only because the server never read the connection
// again after acting on the first value -- but it was ambiguous by construction, so this round
// replaces it entirely with an unambiguous, explicit frame:
//
//	8-byte unsigned big-endian payload length
//	+
//	exactly payload-length JSON bytes
//
// The frame's declared length is the sole source of truth for how many payload bytes exist -- no
// blocking-read-for-EOF, no half-close dependency, on either the client or server side. Exactly one
// frame is read and processed per connection (handleConn never calls this a second time); bytes a
// client sends after its one declared frame are simply never read by the server for that connection's
// request/response cycle -- they are not "accepted trailing JSON," they are entirely outside the frame
// and are never even looked at.
//
// Rejections, each a stable wire result code:
//   - the 8-byte header itself could not be fully read (a short/closed connection), or the header
//     decodes to a length of exactly zero -> MALFORMED_FRAME. These are the only two ways an 8-byte
//     big-endian uint64 header can be invalid: io.ReadFull already reports any short/failed read as
//     its own error (a truncated header), and zero is the one value that is itself nonsensical as "the
//     length of a request." A payload read that comes up short against the declared (non-zero,
//     within-bound) length is the same failure mode -- the frame was truncated -- so it is also
//     MALFORMED_FRAME.
//   - a declared payload length greater than MaxWireBytes -> WIRE_REQUEST_TOO_LARGE, decided from the
//     8-byte header ALONE, strictly before any payload buffer of that size is ever allocated or any
//     payload byte is ever read.
//   - the payload's bytes don't decode as a single valid packageWireRequest JSON object, or the object
//     contains a field outside packageWireRequest's four known fields (json.Decoder.DisallowUnknownFields),
//     or a second Decode call against the same (now-exhausted, finite, in-memory) decoder doesn't
//     return exactly io.EOF (i.e. the frame's payload held more than one top-level JSON value, or held
//     trailing non-whitespace garbage after the one object) -> MALFORMED_WIRE_REQUEST. An unknown wire
//     field is folded into this same code rather than getting a separate UNKNOWN_WIRE_FIELD: Go's
//     DisallowUnknownFields surfaces that case as an ordinary Decode error indistinguishable in kind
//     from any other structurally-malformed payload, so treating it identically is both accurate and
//     simpler for a caller to handle than a code that would only ever apply to this one decoder's
//     particular error string.
//
// Takes an io.Reader (any net.Conn satisfies it) rather than net.Conn specifically -- it never uses
// anything conn-specific, and this lets a test exercise it directly against an in-memory reader
// (bytes.Reader) for the large-payload boundary cases without a real socket's per-connection deadline
// or kernel-buffer-paced Write() in the way. Because the second Decode call above runs against a
// bytes.Reader over the exact, already-fully-read frame payload (never against r itself), it can never
// perform further I/O and therefore can never block, regardless of what r is or does.
func decodeWireRequest(r io.Reader) (packageWireRequest, string, bool) {
	var header [wireFrameHeaderBytes]byte
	if _, err := io.ReadFull(r, header[:]); err != nil {
		return packageWireRequest{}, "MALFORMED_FRAME", false
	}
	length := binary.BigEndian.Uint64(header[:])
	if length == 0 {
		return packageWireRequest{}, "MALFORMED_FRAME", false
	}
	if length > uint64(MaxWireBytes) {
		return packageWireRequest{}, "WIRE_REQUEST_TOO_LARGE", false
	}

	payload := make([]byte, length)
	if _, err := io.ReadFull(r, payload); err != nil {
		return packageWireRequest{}, "MALFORMED_FRAME", false
	}

	dec := json.NewDecoder(bytes.NewReader(payload))
	dec.DisallowUnknownFields()
	var req packageWireRequest
	if err := dec.Decode(&req); err != nil {
		return packageWireRequest{}, "MALFORMED_WIRE_REQUEST", false
	}
	// The underlying reader is a bytes.Reader over the exact frame payload already fully read into
	// memory -- there is no more data coming, ever, for this frame, so this call can never block. A
	// well-formed single-object frame yields exactly io.EOF here; anything else (a second real JSON
	// value, or trailing non-whitespace garbage still within the declared frame length) is rejected.
	if err := dec.Decode(new(struct{})); err != io.EOF {
		return packageWireRequest{}, "MALFORMED_WIRE_REQUEST", false
	}
	return req, "", true
}

// decodePackageComponents base64-decodes the wire request's four components and enforces each
// one's documented decoded-size limit, in a fixed, deterministic order (envelope -> receipt ->
// bundle -> manifest), short-circuiting on the FIRST violation found -- whether that violation is
// malformed base64 or an oversized decoded result. No component beyond the one that fails is ever
// decoded, and the caller never invokes Orchestrate (so no Deps field is ever touched) when this
// returns ok=false. Never includes any of the rejected payload -- or a sample of it -- in the
// returned reason.
//
// V3.1-B Hardening (Work Package 4): each component's ENCODED length is bounds-checked BEFORE
// base64.StdEncoding.DecodeString is ever called on it -- MaxWireBytes alone does not bound any single
// field's decoded size, only the sum of all wire bytes, so a caller could otherwise pack one field's
// encoded content right up against MaxWireBytes and force an allocation for a decoded buffer far
// larger than that field's own specific limit (e.g. an EnvelopeB64 whose decode would exceed
// MaxEnvelopeBytes while the overall frame is still comfortably under MaxWireBytes). Rejecting on the
// encoded length is a cheap, pre-allocation bound; the decoded-length check that follows a successful
// decode is kept unconditionally as defense in depth (it is what actually observes what decoding
// produced, not merely what was possible).
//
// The bound is computed as (len(encoded)/4)*3 - 2, the SMALLEST decoded length any valid standard
// base64 string of that encoded length could possibly represent (a full 4-byte group decodes to 3
// bytes with no padding, 2 bytes with one '=' pad character, or 1 byte with two '=' pad characters --
// so the minimum possible decode for N encoded bytes is (N/4)*3 - 2). This is the TIGHTEST bound
// derivable from encoded length alone -- it never rejects an encoded length that could legitimately
// represent <= comp.limit decoded bytes, and rejects every encoded length whose minimum possible
// decode already exceeds comp.limit.
//
// It is NOT byte-exact, and cannot be: base64's 4-byte-group/padding quantization means encoded
// length alone cannot distinguish decoded length N from N+1 or N+2 whenever they fall in the same
// group (concretely, whenever comp.limit % 3 == 1 -- true for every limit in this file -- an encoded
// length can legitimately represent exactly comp.limit, comp.limit+1, OR comp.limit+2 decoded bytes,
// and no length-only check can tell which). This bound therefore still lets an encoded field encoding
// up to 2 bytes MORE than comp.limit through to the actual base64.StdEncoding.DecodeString call below
// -- the unconditional post-decode length check that follows is what closes that residual ambiguity
// exactly, by inspecting what decoding actually produced. What this pre-check bounds is the
// ALLOCATION an attacker can force before that exact check ever runs: at most comp.limit+2 decoded
// bytes, never anything proportional to a different (e.g. much larger) component's limit or to
// MaxWireBytes.
// minPossibleDecodedLen returns the smallest number of decoded bytes any valid standard base64
// string of encodedLen bytes could possibly represent (see decodePackageComponents's doc comment for
// the derivation). Not meaningful for an encodedLen that is not itself a valid base64 length (not a
// multiple of 4) -- base64.StdEncoding.DecodeString rejects those regardless, independent of this
// function's result.
func minPossibleDecodedLen(encodedLen int) int {
	return (encodedLen/4)*3 - 2
}

// decodeCanonicalBase64 decodes b64 only if it is EXACTLY the canonical standard-padded base64
// representation of its own decoded bytes (Closeout A.2, Work Package D). base64.StdEncoding's
// ordinary (non-Strict) DecodeString accepts several noncanonical inputs a caller must never be able
// to smuggle through: embedded CR/LF bytes (Go's decoder silently skips them rather than treating
// them as invalid alphabet characters) and non-zero unused padding bits in the final quantum (a
// well-formed-looking string that nonetheless does not round-trip through EncodeToString). Neither
// gap is closed by .Strict() alone catching the second one -- CR/LF skipping happens independently of
// Strict mode. The fixed decode order is, in this exact sequence, each step short-circuiting on
// failure before the next ever runs:
//  1. (caller's own pre-decode encoded-size bound -- unchanged, unaffected by this function)
//  2. reject any embedded CR or LF outright
//  3. require the encoded length to be a valid standard-padded base64 length (a positive multiple of
//     4; a bare empty string is never a valid encoding of anything this protocol carries, and every
//     accepted component-size limit downstream is also strictly positive)
//  4. decode with base64.StdEncoding.Strict() (rejects non-zero unused padding bits, non-alphabet
//     characters, wrong padding placement)
//  5. (caller's own post-decode size bound -- unchanged, unaffected by this function)
//  6. re-encode the decoded bytes with base64.StdEncoding.EncodeToString
//  7. require the re-encoded value to equal the original input byte-for-byte
//
// Step 7 is not redundant with step 4: it is the actual binding proof that b64 IS the canonical
// encoding of its own decoded value, independent of whatever specific noncanonical shape a future
// base64 quirk might otherwise let past Strict() -- the same defense-in-depth posture the existing
// decoded-size recheck below already uses for size. No prefix of the rejected input is ever included
// in the returned ok=false signal.
func decodeCanonicalBase64(b64 string) ([]byte, bool) {
	if strings.ContainsAny(b64, "\r\n") {
		return nil, false
	}
	if len(b64) == 0 || len(b64)%4 != 0 {
		return nil, false
	}
	decoded, err := base64.StdEncoding.Strict().DecodeString(b64)
	if err != nil {
		return nil, false
	}
	if base64.StdEncoding.EncodeToString(decoded) != b64 {
		return nil, false
	}
	return decoded, true
}

func decodePackageComponents(req packageWireRequest) (envelopeBytes, receiptBytes, bundleBytes, manifestBytes []byte, reason string, ok bool) {
	type component struct {
		b64      string
		limit    int
		tooLarge string
		dst      *[]byte
	}
	components := [...]component{
		{req.EnvelopeB64, MaxEnvelopeBytes, "ENVELOPE_TOO_LARGE", &envelopeBytes},
		{req.ReceiptB64, MaxReceiptBytes, "RECEIPT_TOO_LARGE", &receiptBytes},
		{req.BundleB64, MaxBundleBytes, "BUNDLE_TOO_LARGE", &bundleBytes},
		{req.ManifestB64, MaxManifestBytes, "MANIFEST_TOO_LARGE", &manifestBytes},
	}
	for _, comp := range components {
		// Pre-decode bound: reject an over-limit ENCODED field before ever allocating a decoded output
		// buffer for it -- see the exact formula's derivation in this function's doc comment above.
		if minPossibleDecodedLen(len(comp.b64)) > comp.limit {
			return nil, nil, nil, nil, comp.tooLarge, false
		}
		decoded, ok := decodeCanonicalBase64(comp.b64)
		if !ok {
			return nil, nil, nil, nil, "MALFORMED_BASE64", false
		}
		// Defense in depth: independently re-verify the ACTUAL decoded length, never trusting the
		// pre-decode encoded-length bound alone as a substitute for checking what decoding produced.
		if len(decoded) > comp.limit {
			return nil, nil, nil, nil, comp.tooLarge, false
		}
		*comp.dst = decoded
	}
	return envelopeBytes, receiptBytes, bundleBytes, manifestBytes, "", true
}

// AdminOp is the admin socket's request shape -- create or revoke a grant. There is no "publish"
// op here, and no client-socket message type ever decodes into this type.
type AdminOp struct {
	Op              string `json:"op"` // "create_grant" | "revoke_grant"
	RequestDigest   string `json:"request_digest,omitempty"`
	RepositoryOwner string `json:"repository_owner,omitempty"`
	RepositoryName  string `json:"repository_name,omitempty"`
	Branch          string `json:"branch,omitempty"`
	BaseBranch      string `json:"base_branch,omitempty"`
	BaseCommit      string `json:"base_commit,omitempty"`
	TTLSeconds      int64  `json:"ttl_seconds,omitempty"`
	GrantID         string `json:"grant_id,omitempty"`
}

type AdminResult struct {
	OK      bool   `json:"ok"`
	GrantID string `json:"grant_id,omitempty"`
	Error   string `json:"error,omitempty"`
	// Code is a stable, machine-readable outcome identifier (V3.1-B Hardening R2.1). A human
	// operator (or a script driving mihver-broker-admin) must compare Code, never parse Error's
	// free-text message, which may change wording without notice; Error remains for human-readable
	// context only. Always empty when OK is true. For a FAILED revoke_grant call specifically, Code
	// is always populated -- one of the specific terminal-state/not-found codes below, or the
	// GRANT_REVOKE_FAILED catch-all for anything else (including a persistence failure) -- never
	// left empty for a caller to have to guess at. create_grant failures and malformed-request
	// rejections do not currently populate Code (only Error) -- classifying those is unrelated to
	// this round's revocation-persistence scope and remains a future addition, not a defect here.
	Code string `json:"code,omitempty"`
}

// adminRevokeErrorCode maps a grant.AdminHandle.Revoke error to the stable wire code a human
// operator (or a script driving mihver-broker-admin) can rely on -- always via errors.Is against the
// package's own sentinel values, never by matching substrings of err.Error(), whose wording is not a
// contract. Every terminal-state outcome Revoke can return gets its own distinct code; a persistence
// failure (the grant's true state is still being determined -- retrying may succeed) and an unknown
// grant ID each get their own distinct, equally stable code rather than being folded into one another
// or into a generic bucket that would hide which case actually occurred.
func adminRevokeErrorCode(err error) string {
	switch {
	case errors.Is(err, grant.ErrPublishPersistFailed):
		// V3.1-B Hardening R3.1.1: PUBLISHED is still pending -- Revoke's own bounded repair attempt
		// just failed. Deliberately NOT GRANT_ALREADY_PUBLISHED, which now specifically means "durably
		// acknowledged" -- reporting that here would conceal a still-failing Store write behind an
		// (also-true) terminal-refusal code.
		return "GRANT_PUBLISH_PERSIST_FAILED"
	case errors.Is(err, grant.ErrBlockPersistFailed):
		// V3.1-B Hardening R3.1.1: identical rationale to ErrPublishPersistFailed above, for BLOCKED.
		return "GRANT_BLOCK_PERSIST_FAILED"
	case errors.Is(err, grant.ErrCannotRevokePublished):
		return "GRANT_ALREADY_PUBLISHED"
	case errors.Is(err, grant.ErrCannotRevokeBlocked):
		return "GRANT_PREVIOUSLY_BLOCKED"
	case errors.Is(err, grant.ErrCannotRevokeExpired):
		return "GRANT_EXPIRED"
	case errors.Is(err, grant.ErrNotFound):
		return "GRANT_NOT_FOUND"
	default:
		// Includes any other persistence failure (V3.1-B Hardening R2.1): the grant's durable state
		// could not be confirmed as REVOKED. The caller should treat this as retryable, not as proof
		// the grant is still active -- Revoke's own in-memory state already fails closed regardless.
		return "GRANT_REVOKE_FAILED"
	}
}

// AdminListener serves the privileged admin socket: create/revoke a grant only. It holds a
// *grant.AdminHandle -- obtainable only via Store.Admin() -- so this type is the sole place in this
// module with the authority to mint a new PublicationGrant.
type AdminListener struct {
	admin *grant.AdminHandle
}

func NewAdminListener(admin *grant.AdminHandle) *AdminListener { return &AdminListener{admin: admin} }

func (a *AdminListener) ServeSocket(path string, mode os.FileMode) error {
	if err := safeRemoveStaleSocket(path); err != nil {
		return err
	}
	ln, err := net.Listen("unix", path)
	if err != nil {
		return fmt.Errorf("server: listen admin socket: %w", err)
	}
	defer ln.Close()
	if err := os.Chmod(path, mode); err != nil {
		return fmt.Errorf("server: chmod admin socket: %w", err)
	}
	for {
		conn, err := ln.Accept()
		if err != nil {
			return err
		}
		go a.handleConn(conn)
	}
}

func (a *AdminListener) handleConn(conn net.Conn) {
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(30 * time.Second))

	var op AdminOp
	if err := json.NewDecoder(bufio.NewReader(conn)).Decode(&op); err != nil {
		_ = json.NewEncoder(conn).Encode(AdminResult{OK: false, Error: "MALFORMED_ADMIN_REQUEST"})
		return
	}

	switch op.Op {
	case "create_grant":
		g, err := a.admin.Create(grant.CreateRequest{
			RequestDigest:   op.RequestDigest,
			RepositoryOwner: op.RepositoryOwner,
			RepositoryName:  op.RepositoryName,
			Branch:          op.Branch,
			BaseBranch:      op.BaseBranch,
			BaseCommit:      op.BaseCommit,
			TTL:             time.Duration(op.TTLSeconds) * time.Second,
		})
		if err != nil {
			_ = json.NewEncoder(conn).Encode(AdminResult{OK: false, Error: err.Error()})
			return
		}
		_ = json.NewEncoder(conn).Encode(AdminResult{OK: true, GrantID: g.GrantID})
	case "revoke_grant":
		if err := a.admin.Revoke(op.GrantID); err != nil {
			_ = json.NewEncoder(conn).Encode(AdminResult{OK: false, Error: err.Error(), Code: adminRevokeErrorCode(err)})
			return
		}
		_ = json.NewEncoder(conn).Encode(AdminResult{OK: true, GrantID: op.GrantID})
	default:
		_ = json.NewEncoder(conn).Encode(AdminResult{OK: false, Error: "UNKNOWN_ADMIN_OP"})
	}
}
