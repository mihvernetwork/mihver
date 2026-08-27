// Package protocol defines the wire types the privileged Publication Broker consumes: the
// Claude-authored PublicationEnvelope and the Local Publication Builder's PublicationReceipt
// (mirroring schemas/dev/publication-envelope.schema.json and
// schemas/dev/publication-receipt.schema.json exactly), the PublicationPackage manifest that
// carries the immutable Git object bundle across the unprivileged->privileged boundary, and the
// ambiguity-free REQUEST DIGEST recipe that binds a human authorization to exact request bytes.
//
// Nothing in this package trusts its input: every JSON decode rejects unknown fields (mirroring
// each schema's additionalProperties:false) and every struct is re-validated field-by-field before
// use elsewhere in the Broker. This package performs no I/O and holds no secrets.
package protocol

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"hash"
	"io"
	"regexp"

	"mihver.network/publication-broker/internal/repoidentity"
)

// ProtocolVersion is the only protocol_version this Broker understands, matching V3.1-A's Envelope
// and Receipt schemas exactly. A request naming any other version is rejected before anything else
// is inspected.
const ProtocolVersion = "1.0.0"

var (
	hex40Pattern = regexp.MustCompile(`^[0-9a-f]{40}$`)
	hex64Pattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

// Repository mirrors the `repository` object shared by the Envelope and Receipt schemas.
type Repository struct {
	RemoteName string `json:"remote_name"`
	Owner      string `json:"owner"`
	Name       string `json:"name"`
}

// AllowedFile mirrors one `allowed_files[]` entry.
type AllowedFile struct {
	Path   string `json:"path"`
	Action string `json:"action"` // "present" | "deletion"
}

// Envelope mirrors schemas/dev/publication-envelope.schema.json field-for-field.
type Envelope struct {
	ProtocolVersion        string        `json:"protocol_version"`
	Repository             Repository    `json:"repository"`
	Branch                 string        `json:"branch"`
	BaseBranch             string        `json:"base_branch"`
	BaseCommit             string        `json:"base_commit"`
	ExpectedPrePublishHead string        `json:"expected_pre_publish_head"`
	AllowedFiles           []AllowedFile `json:"allowed_files"`
	PublicationFingerprint string        `json:"publication_fingerprint"`
	CommitMessage          string        `json:"commit_message"`
	PRExpected             bool          `json:"pr_expected"`
	PRTitle                string        `json:"pr_title,omitempty"`
	PRBody                 string        `json:"pr_body,omitempty"`
}

// Receipt mirrors schemas/dev/publication-receipt.schema.json field-for-field.
type Receipt struct {
	Status          string     `json:"status"` // "COMMITTED" | "BLOCKED"
	ProtocolVersion string     `json:"protocol_version"`
	Repository      Repository `json:"repository"`
	Branch          string     `json:"branch"`
	BaseCommit      string     `json:"base_commit"`
	PrePublishHead  string     `json:"pre_publish_head"`
	Fingerprint     string     `json:"fingerprint"`
	CommitSHA       string     `json:"commit_sha,omitempty"`
	LocalHead       string     `json:"local_head"`
	WorkingTree     string     `json:"working_tree"` // "clean" | "dirty"
	FailureReason   string     `json:"failure_reason,omitempty"`
}

// validateRepository re-checks Repository.Owner/.Name/.RemoteName via the shared
// internal/repoidentity validator (rather than the old bare non-empty-string check), so an Envelope
// or Receipt whose repository identity would be unsafe to later embed in a Git remote URL or a
// GitHub REST API path is rejected here, at parse time -- before ParseRequest ever returns a
// *Request, and therefore before any downstream caller (grant lookup, token mint, git execution, PR
// HTTP request) could act on it.
func validateRepository(r Repository) error {
	if _, err := repoidentity.Validate(r.Owner, r.Name); err != nil {
		return fmt.Errorf("repository: %w", err)
	}
	if err := repoidentity.ValidateRemoteName(r.RemoteName); err != nil {
		return fmt.Errorf("repository: %w", err)
	}
	return nil
}

// strictDecode decodes JSON with unknown-field rejection, mirroring each schema's
// additionalProperties:false -- the Broker never silently accepts a field neither schema declares --
// and requires the input to contain EXACTLY one JSON value: nothing but optional trailing whitespace
// may follow it.
//
// Closeout Pack A.2.1, Work Package D: the pre-fix implementation used `dec.More()` to check for
// trailing data, which is unsound for this purpose -- `More` reports whether another JSON *value*
// could be decoded next, not merely whether unconsumed bytes remain. Confirmed empirically before
// fixing: `dec.More()` returns `false` (i.e. "no trailing data, accept") for input like `{...}]` or
// `{...}}` immediately following a valid top-level object, even though these are not valid JSON and
// must be rejected -- a lone `]`/`}` is not itself the start of a value `More` looks for, so it never
// flags the leftover bytes as a problem. Fixed by decoding a SECOND time into a value that accepts
// anything (`new(struct{})`) and requiring that second Decode to fail with exactly `io.EOF` --
// `io.EOF` means the reader was cleanly exhausted (nothing left but optional whitespace the decoder
// itself skips before reporting EOF); any other outcome (a second value decoded successfully, or a
// syntax error from genuinely malformed trailing bytes such as a bare `]`/`}`/garbage) means real
// bytes remain after the first value and the whole input is rejected. This mirrors the identical
// pattern internal/server/listener.go's own wire-request decoder already uses for the same purpose.
func strictDecode(raw []byte, v any) error {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return fmt.Errorf("strict json decode: %w", err)
	}
	if err := dec.Decode(new(struct{})); err != io.EOF {
		return fmt.Errorf("trailing data after json value")
	}
	return nil
}

// ParseEnvelope decodes and structurally validates raw Envelope bytes. It never trusts anything
// about the caller-supplied bytes beyond what the schema and this validation enforce.
func ParseEnvelope(raw []byte) (*Envelope, error) {
	var e Envelope
	if err := strictDecode(raw, &e); err != nil {
		return nil, fmt.Errorf("malformed envelope: %w", err)
	}
	if err := e.Validate(); err != nil {
		return nil, err
	}
	return &e, nil
}

// Validate re-checks every structural constraint the schema declares -- this Broker never assumes
// upstream schema validation already happened, since the package bytes are untrusted input.
func (e *Envelope) Validate() error {
	if e.ProtocolVersion != ProtocolVersion {
		return fmt.Errorf("envelope: unsupported protocol_version %q", e.ProtocolVersion)
	}
	if err := validateRepository(e.Repository); err != nil {
		return fmt.Errorf("envelope: %w", err)
	}
	if e.Branch == "" || e.Branch == "main" || e.Branch == "master" {
		return fmt.Errorf("envelope: branch must be non-empty and not main/master")
	}
	if e.BaseBranch == "" {
		return fmt.Errorf("envelope: base_branch must be non-empty")
	}
	if !hex40Pattern.MatchString(e.BaseCommit) {
		return fmt.Errorf("envelope: base_commit must be 40-hex")
	}
	if !hex40Pattern.MatchString(e.ExpectedPrePublishHead) {
		return fmt.Errorf("envelope: expected_pre_publish_head must be 40-hex")
	}
	if len(e.AllowedFiles) == 0 {
		return fmt.Errorf("envelope: allowed_files must be non-empty")
	}
	seen := make(map[string]bool, len(e.AllowedFiles))
	for i, f := range e.AllowedFiles {
		if f.Path == "" {
			return fmt.Errorf("envelope: allowed_files[%d].path must be non-empty", i)
		}
		if f.Action != "present" && f.Action != "deletion" {
			return fmt.Errorf("envelope: allowed_files[%d].action must be present or deletion", i)
		}
		if seen[f.Path] {
			return fmt.Errorf("envelope: duplicate allowed_files path %q", f.Path)
		}
		seen[f.Path] = true
	}
	if !hex64Pattern.MatchString(e.PublicationFingerprint) {
		return fmt.Errorf("envelope: publication_fingerprint must be 64-hex")
	}
	if e.CommitMessage == "" {
		return fmt.Errorf("envelope: commit_message must be non-empty")
	}
	if e.PRExpected {
		if e.PRTitle == "" {
			return fmt.Errorf("envelope: pr_title required when pr_expected is true")
		}
	}
	return nil
}

// ParseReceipt decodes and structurally validates raw Receipt bytes.
func ParseReceipt(raw []byte) (*Receipt, error) {
	var r Receipt
	if err := strictDecode(raw, &r); err != nil {
		return nil, fmt.Errorf("malformed receipt: %w", err)
	}
	if err := r.Validate(); err != nil {
		return nil, err
	}
	return &r, nil
}

// Validate re-checks every structural constraint the schema declares.
func (r *Receipt) Validate() error {
	if r.Status != "COMMITTED" && r.Status != "BLOCKED" {
		return fmt.Errorf("receipt: status must be COMMITTED or BLOCKED")
	}
	if r.ProtocolVersion != ProtocolVersion {
		return fmt.Errorf("receipt: unsupported protocol_version %q", r.ProtocolVersion)
	}
	if err := validateRepository(r.Repository); err != nil {
		return fmt.Errorf("receipt: %w", err)
	}
	if r.Branch == "" {
		return fmt.Errorf("receipt: branch must be non-empty")
	}
	if !hex40Pattern.MatchString(r.BaseCommit) {
		return fmt.Errorf("receipt: base_commit must be 40-hex")
	}
	if !hex40Pattern.MatchString(r.PrePublishHead) {
		return fmt.Errorf("receipt: pre_publish_head must be 40-hex")
	}
	if !hex64Pattern.MatchString(r.Fingerprint) {
		return fmt.Errorf("receipt: fingerprint must be 64-hex")
	}
	if !hex40Pattern.MatchString(r.LocalHead) {
		return fmt.Errorf("receipt: local_head must be 40-hex")
	}
	if r.WorkingTree != "clean" && r.WorkingTree != "dirty" {
		return fmt.Errorf("receipt: working_tree must be clean or dirty")
	}
	if r.Status == "COMMITTED" {
		if !hex40Pattern.MatchString(r.CommitSHA) {
			return fmt.Errorf("receipt: commit_sha must be 40-hex when status is COMMITTED")
		}
	} else {
		if r.FailureReason == "" {
			return fmt.Errorf("receipt: failure_reason required when status is BLOCKED")
		}
	}
	return nil
}

// PackageManifest is the deterministic, broker-untrusted description of a PublicationPackage: the
// exact Envelope/Receipt digests and the Git bundle digest it is claimed to carry. The Broker never
// trusts this manifest's own claims -- see internal/verifier -- but it IS what the REQUEST DIGEST
// binds, so any manifest mutation after human authorization must invalidate the grant.
type PackageManifest struct {
	ProtocolVersion string `json:"protocol_version"`
	EnvelopeDigest  string `json:"envelope_digest_sha256"` // hex sha256 of the raw envelope bytes
	ReceiptDigest   string `json:"receipt_digest_sha256"`  // hex sha256 of the raw receipt bytes
	BundleDigest    string `json:"bundle_digest_sha256"`   // hex sha256 of the raw git bundle bytes
	CommitSHA       string `json:"commit_sha"`             // the exact commit the bundle carries
}

// ParseManifest decodes and structurally validates raw manifest bytes.
func ParseManifest(raw []byte) (*PackageManifest, error) {
	var m PackageManifest
	if err := strictDecode(raw, &m); err != nil {
		return nil, fmt.Errorf("malformed package manifest: %w", err)
	}
	if m.ProtocolVersion != ProtocolVersion {
		return nil, fmt.Errorf("manifest: unsupported protocol_version %q", m.ProtocolVersion)
	}
	if !hex64Pattern.MatchString(m.EnvelopeDigest) {
		return nil, fmt.Errorf("manifest: envelope_digest_sha256 must be 64-hex")
	}
	if !hex64Pattern.MatchString(m.ReceiptDigest) {
		return nil, fmt.Errorf("manifest: receipt_digest_sha256 must be 64-hex")
	}
	if !hex64Pattern.MatchString(m.BundleDigest) {
		return nil, fmt.Errorf("manifest: bundle_digest_sha256 must be 64-hex")
	}
	if !hex40Pattern.MatchString(m.CommitSHA) {
		return nil, fmt.Errorf("manifest: commit_sha must be 40-hex")
	}
	return &m, nil
}

// Digest is a raw SHA-256 digest.
type Digest [sha256.Size]byte

// Hex returns the lowercase hex encoding of the digest.
func (d Digest) Hex() string { return hex.EncodeToString(d[:]) }

// writeFramed writes an explicit 8-byte big-endian length prefix followed by the bytes themselves,
// so concatenating multiple framed fields is unambiguous regardless of their individual lengths --
// this is what makes the REQUEST DIGEST byte-exact rather than dependent on any delimiter that could
// itself appear inside a field.
func writeFramed(h hash.Hash, b []byte) {
	var lenBuf [8]byte
	binary.BigEndian.PutUint64(lenBuf[:], uint64(len(b)))
	h.Write(lenBuf[:])
	h.Write(b)
}

// ComputeRequestDigest implements the REQUEST DIGEST recipe: SHA-256 over a fixed, explicitly
// length-prefixed framed stream of [protocol_version, sha256(envelopeBytes), sha256(receiptBytes),
// sha256(bundleBytes), sha256(manifestBytes)], in that exact order. Binding the DIGESTS of the raw
// artifacts (not the raw artifacts themselves) keeps the request digest small and constant-size
// regardless of package size, while remaining exactly as sensitive to a one-byte mutation: changing
// a single byte anywhere in envelopeBytes/receiptBytes/bundleBytes/manifestBytes changes that
// artifact's own SHA-256, which changes every subsequent framed field and therefore the final
// digest. This function does not parse or trust the artifacts' content -- it operates purely on
// bytes, which is exactly what "the human authorization binds the exact request bytes" requires.
func ComputeRequestDigest(protocolVersion string, envelopeBytes, receiptBytes, bundleBytes, manifestBytes []byte) Digest {
	envelopeDigest := sha256.Sum256(envelopeBytes)
	receiptDigest := sha256.Sum256(receiptBytes)
	bundleDigest := sha256.Sum256(bundleBytes)
	manifestDigest := sha256.Sum256(manifestBytes)

	h := sha256.New()
	writeFramed(h, []byte(protocolVersion))
	writeFramed(h, envelopeDigest[:])
	writeFramed(h, receiptDigest[:])
	writeFramed(h, bundleDigest[:])
	writeFramed(h, manifestDigest[:])

	var out Digest
	copy(out[:], h.Sum(nil))
	return out
}

// Request is the full unprivileged-to-privileged transport unit: the raw bytes of each artifact
// (never re-serialized -- the digest binds exactly what was authorized, not a re-encoded copy) plus
// their parsed forms for convenience. RequestDigest() recomputes the digest fresh from the raw bytes
// every time it's called -- it is never cached across a boundary that could let stale bytes and a
// stale digest silently drift apart.
type Request struct {
	EnvelopeBytes []byte
	ReceiptBytes  []byte
	BundleBytes   []byte
	ManifestBytes []byte

	Envelope *Envelope
	Receipt  *Receipt
	Manifest *PackageManifest
}

// Manifest cross-validation sentinel errors -- stable, errors.Is-compatible, and distinct per
// mismatched field, so a caller (or a log line) can classify exactly which cross-check failed
// without substring-matching an error's free-text wording, which is not a contract.
//
// PackageManifest's own ParseManifest only proves EnvelopeDigest/ReceiptDigest/BundleDigest LOOK
// like SHA-256 hex strings and CommitSHA looks like a 40-hex Git SHA -- it never proves those claimed
// digests match the REAL bytes of the envelope/receipt/bundle that arrived alongside the manifest, or
// that the manifest's CommitSHA matches the Receipt's own CommitSHA. Without these checks, a manifest
// could claim arbitrary digests unrelated to the actual bytes without ParseRequest ever noticing.
var (
	ErrManifestEnvelopeDigestMismatch = errors.New("protocol: manifest envelope_digest_sha256 does not match sha256 of the actual envelope bytes")
	ErrManifestReceiptDigestMismatch  = errors.New("protocol: manifest receipt_digest_sha256 does not match sha256 of the actual receipt bytes")
	ErrManifestBundleDigestMismatch   = errors.New("protocol: manifest bundle_digest_sha256 does not match sha256 of the actual bundle bytes")
	ErrManifestCommitMismatch         = errors.New("protocol: manifest commit_sha does not match the receipt's commit_sha")
)

// ParseRequest parses and structurally validates every component of a raw PublicationPackage, then
// cross-validates the manifest's claimed digests/commit against the ACTUAL raw bytes of the other
// three components (never a re-marshaled/re-encoded copy of the parsed structs -- a
// semantically-equivalent-but-byte-different re-encoding must NOT pass). This closes the gap where a
// manifest could claim digests unrelated to what it actually travelled alongside; see the sentinel
// errors above.
func ParseRequest(envelopeBytes, receiptBytes, bundleBytes, manifestBytes []byte) (*Request, error) {
	envelope, err := ParseEnvelope(envelopeBytes)
	if err != nil {
		return nil, err
	}
	receipt, err := ParseReceipt(receiptBytes)
	if err != nil {
		return nil, err
	}
	manifest, err := ParseManifest(manifestBytes)
	if err != nil {
		return nil, err
	}
	if len(bundleBytes) == 0 {
		return nil, fmt.Errorf("request: git bundle must be non-empty")
	}

	if envelopeDigest := sha256.Sum256(envelopeBytes); hex.EncodeToString(envelopeDigest[:]) != manifest.EnvelopeDigest {
		return nil, fmt.Errorf("%w: manifest claims %q", ErrManifestEnvelopeDigestMismatch, manifest.EnvelopeDigest)
	}
	if receiptDigest := sha256.Sum256(receiptBytes); hex.EncodeToString(receiptDigest[:]) != manifest.ReceiptDigest {
		return nil, fmt.Errorf("%w: manifest claims %q", ErrManifestReceiptDigestMismatch, manifest.ReceiptDigest)
	}
	if bundleDigest := sha256.Sum256(bundleBytes); hex.EncodeToString(bundleDigest[:]) != manifest.BundleDigest {
		return nil, fmt.Errorf("%w: manifest claims %q", ErrManifestBundleDigestMismatch, manifest.BundleDigest)
	}
	if manifest.CommitSHA != receipt.CommitSHA {
		return nil, fmt.Errorf("%w: manifest has %q, receipt has %q", ErrManifestCommitMismatch, manifest.CommitSHA, receipt.CommitSHA)
	}

	return &Request{
		EnvelopeBytes: envelopeBytes,
		ReceiptBytes:  receiptBytes,
		BundleBytes:   bundleBytes,
		ManifestBytes: manifestBytes,
		Envelope:      envelope,
		Receipt:       receipt,
		Manifest:      manifest,
	}, nil
}

// RequestDigest recomputes the REQUEST DIGEST fresh from this Request's raw bytes.
func (r *Request) RequestDigest() Digest {
	return ComputeRequestDigest(ProtocolVersion, r.EnvelopeBytes, r.ReceiptBytes, r.BundleBytes, r.ManifestBytes)
}
