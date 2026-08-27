// mihver-publish is the unprivileged client tool: given a repository already holding a commit
// produced by scripts/dev/publication-builder.mjs, plus that commit's PublicationEnvelope and
// PublicationReceipt JSON files, it builds the immutable PublicationPackage (a self-contained Git
// bundle plus a deterministic manifest), computes the REQUEST DIGEST the human will authorize
// out-of-band via mihver-broker-admin, and either writes the package to a directory or submits it
// directly to the Broker's client Unix socket.
//
// This binary NEVER holds a GitHub credential and NEVER talks to GitHub directly -- it only
// prepares an untrusted package for the privileged Broker to independently verify.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"mihver.network/publication-broker/internal/pkgimport"
	"mihver.network/publication-broker/internal/protocol"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "mihver-publish:", err)
		os.Exit(1)
	}
}

func run() error {
	repoRoot := flag.String("repo", ".", "path to the local git repository holding the committed change")
	envelopePath := flag.String("envelope", "", "path to the PublicationEnvelope JSON file")
	receiptPath := flag.String("receipt", "", "path to the PublicationReceipt JSON file")
	outDir := flag.String("out", "", "directory to write the PublicationPackage into (envelope.json, receipt.json, package.bundle, manifest.json)")
	socketPath := flag.String("socket", "", "if set, submit the package directly to this Broker client Unix socket instead of (or in addition to) writing --out")
	gitBinary := flag.String("git", "git", "git executable to use for bundling")
	flag.Parse()

	if *envelopePath == "" || *receiptPath == "" {
		return fmt.Errorf("--envelope and --receipt are required")
	}

	envelopeBytes, err := os.ReadFile(*envelopePath)
	if err != nil {
		return fmt.Errorf("read envelope: %w", err)
	}
	receiptBytes, err := os.ReadFile(*receiptPath)
	if err != nil {
		return fmt.Errorf("read receipt: %w", err)
	}
	envelope, err := protocol.ParseEnvelope(envelopeBytes)
	if err != nil {
		return fmt.Errorf("invalid envelope: %w", err)
	}
	receipt, err := protocol.ParseReceipt(receiptBytes)
	if err != nil {
		return fmt.Errorf("invalid receipt: %w", err)
	}
	if receipt.Status != "COMMITTED" {
		return fmt.Errorf("receipt status is %q, expected COMMITTED -- nothing to publish", receipt.Status)
	}

	bundleBytes, err := buildBundle(*gitBinary, *repoRoot, receipt.CommitSHA)
	if err != nil {
		return fmt.Errorf("build git bundle: %w", err)
	}

	envelopeDigest := sha256Hex(envelopeBytes)
	receiptDigest := sha256Hex(receiptBytes)
	bundleDigest := sha256Hex(bundleBytes)

	manifest := protocol.PackageManifest{
		ProtocolVersion: protocol.ProtocolVersion,
		EnvelopeDigest:  envelopeDigest,
		ReceiptDigest:   receiptDigest,
		BundleDigest:    bundleDigest,
		CommitSHA:       receipt.CommitSHA,
	}
	manifestBytes, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal manifest: %w", err)
	}

	digest := protocol.ComputeRequestDigest(protocol.ProtocolVersion, envelopeBytes, receiptBytes, bundleBytes, manifestBytes)

	fmt.Printf("REQUEST DIGEST: %s\n", digest.Hex())
	fmt.Printf("repository:     %s/%s\n", envelope.Repository.Owner, envelope.Repository.Name)
	fmt.Printf("branch:         %s\n", envelope.Branch)
	fmt.Printf("base_branch:    %s\n", envelope.BaseBranch)
	fmt.Printf("base_commit:    %s\n", envelope.BaseCommit)
	fmt.Printf("commit_sha:     %s\n", receipt.CommitSHA)
	fmt.Println("Human authorization required via mihver-broker-admin before the Broker will act on this digest.")

	if *outDir != "" {
		if err := os.MkdirAll(*outDir, 0o700); err != nil {
			return fmt.Errorf("create out dir: %w", err)
		}
		writes := map[string][]byte{
			"envelope.json":  envelopeBytes,
			"receipt.json":   receiptBytes,
			"package.bundle": bundleBytes,
			"manifest.json":  manifestBytes,
		}
		for name, data := range writes {
			if err := os.WriteFile(filepath.Join(*outDir, name), data, 0o600); err != nil {
				return fmt.Errorf("write %s: %w", name, err)
			}
		}
	}

	if *socketPath != "" {
		if err := submit(*socketPath, envelopeBytes, receiptBytes, bundleBytes, manifestBytes); err != nil {
			return fmt.Errorf("submit to broker: %w", err)
		}
	}

	return nil
}

// buildBundle creates a temporary ref at commitSHA (never touching any existing branch), bundles
// exactly that ref's full reachable history (self-contained -- no prerequisite objects assumed
// present on the Broker's side), and deletes the temporary ref afterward regardless of outcome.
func buildBundle(gitBinary, repoRoot, commitSHA string) ([]byte, error) {
	ctx := context.Background()
	run := func(args ...string) (string, error) {
		cmd := exec.CommandContext(ctx, gitBinary, args...)
		cmd.Dir = repoRoot
		out, err := cmd.CombinedOutput()
		if err != nil {
			return "", fmt.Errorf("git %v: %w: %s", args, err, string(out))
		}
		return string(out), nil
	}

	if _, err := run("update-ref", pkgimport.BundleRefName, commitSHA); err != nil {
		return nil, err
	}
	defer run("update-ref", "-d", pkgimport.BundleRefName)

	tmpFile, err := os.CreateTemp("", "mihver-publish-bundle-")
	if err != nil {
		return nil, err
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	defer os.Remove(tmpPath)

	if _, err := run("bundle", "create", tmpPath, pkgimport.BundleRefName); err != nil {
		return nil, err
	}
	return os.ReadFile(tmpPath)
}

func sha256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func submit(socketPath string, envelopeBytes, receiptBytes, bundleBytes, manifestBytes []byte) error {
	conn, err := net.DialTimeout("unix", socketPath, 5*time.Second)
	if err != nil {
		return err
	}
	defer conn.Close()

	payload := map[string]string{
		"envelope_b64": base64.StdEncoding.EncodeToString(envelopeBytes),
		"receipt_b64":  base64.StdEncoding.EncodeToString(receiptBytes),
		"bundle_b64":   base64.StdEncoding.EncodeToString(bundleBytes),
		"manifest_b64": base64.StdEncoding.EncodeToString(manifestBytes),
	}
	// Wire framing (V3.1-B Hardening Work Package 3): an 8-byte unsigned big-endian payload length,
	// followed by exactly that many JSON bytes -- never a bare json.Encoder.Encode straight onto the
	// connection. This lets the Broker's server determine the exact end of the one request it will
	// ever read for this connection from the declared length alone, with no dependency on this client
	// half-closing its write side or on connection EOF timing.
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal wire payload: %w", err)
	}
	var header [8]byte
	binary.BigEndian.PutUint64(header[:], uint64(len(body)))
	if _, err := conn.Write(header[:]); err != nil {
		return fmt.Errorf("write wire frame header: %w", err)
	}
	if _, err := conn.Write(body); err != nil {
		return fmt.Errorf("write wire frame payload: %w", err)
	}
	var result map[string]any
	if err := json.NewDecoder(conn).Decode(&result); err != nil {
		return err
	}
	out, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(out))
	return nil
}
