// Package pkgimport imports an untrusted PublicationPackage's Git bundle into a fresh, broker-owned
// bare Git repository, under a sterile environment (internal/gitexec), so nothing in
// internal/verifier ever runs Git plumbing against the user's model-writable repository or trusts
// its config/hooks/credential-helpers/fsmonitor/environment. The package producer
// (cmd/mihver-publish) is expected to create the bundle from a single temporary ref pointing at the
// authorized commit -- see BundleRefName -- so the bundle is self-contained (no prerequisite
// objects assumed present) and always importable into an empty repository.
package pkgimport

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"

	"mihver.network/publication-broker/internal/gitexec"
)

// BundleRefName is the single ref name both the producer (bundling) and the Broker (fetching) agree
// on. Using one fixed, non-user-controlled name keeps the import step a single deterministic fetch
// refspec rather than needing to trust a ref name carried in untrusted package content.
const BundleRefName = "refs/heads/mihver-broker-import"

var commitSHAPattern = regexp.MustCompile(`^[0-9a-f]{40}$`)

// Imported is a broker-owned bare repository holding exactly the objects reachable from one
// imported bundle, plus the ref pointing at the authorized commit. Callers must call Close to
// remove the broker-owned scratch directory once verification is finished.
type Imported struct {
	Dir       string
	CommitSHA string

	sterile gitexec.Sterile
	cleanup func()
}

// Close removes the broker-owned bare repository directory.
func (im *Imported) Close() {
	if im.cleanup != nil {
		im.cleanup()
	}
}

// Import writes bundleBytes to a broker-owned scratch file, creates a fresh empty bare repository
// under broker-owned storage, and fetches exactly BundleRefName from the bundle into it, requiring
// the fetched ref to resolve to expectedCommitSHA. Never executes anything from the bundle's
// content -- only Git plumbing (`init`, `fetch`, later `cat-file`/`rev-parse`/`ls-tree`/`diff-tree`
// in internal/verifier) runs, always via exec.Command with explicit argv, never a shell string.
func Import(ctx context.Context, gitBinary string, bundleBytes []byte, expectedCommitSHA string) (*Imported, error) {
	if !commitSHAPattern.MatchString(expectedCommitSHA) {
		return nil, fmt.Errorf("pkgimport: expectedCommitSHA must be 40-hex")
	}
	if len(bundleBytes) == 0 {
		return nil, fmt.Errorf("pkgimport: bundle must be non-empty")
	}

	scratchDir, err := os.MkdirTemp("", "mihver-broker-import-")
	if err != nil {
		return nil, fmt.Errorf("pkgimport: create scratch dir: %w", err)
	}
	cleanup := func() { os.RemoveAll(scratchDir) }

	home, homeCleanup, err := gitexec.NewScratchHome("mihver-broker-import-home-")
	if err != nil {
		cleanup()
		return nil, fmt.Errorf("pkgimport: create scratch home: %w", err)
	}
	fullCleanup := func() {
		homeCleanup()
		cleanup()
	}

	sterile := gitexec.Sterile{GitBinary: gitBinary, Home: home}

	bundlePath := filepath.Join(scratchDir, "package.bundle")
	if err := os.WriteFile(bundlePath, bundleBytes, 0o600); err != nil {
		fullCleanup()
		return nil, fmt.Errorf("pkgimport: write bundle file: %w", err)
	}

	repoDir := filepath.Join(scratchDir, "repo.git")
	if err := os.MkdirAll(repoDir, 0o700); err != nil {
		fullCleanup()
		return nil, fmt.Errorf("pkgimport: create repo dir: %w", err)
	}

	// Fresh, empty, broker-owned bare repository -- never the model-writable user repository, and
	// never reused across imports (a new scratchDir per Import call).
	if _, err := sterile.Run(ctx, repoDir, "-c", "core.hooksPath=/dev/null", "init", "--bare", "--quiet", repoDir); err != nil {
		fullCleanup()
		return nil, fmt.Errorf("pkgimport: git init --bare: %w", err)
	}

	// git bundle verify: fails closed on a corrupt/incomplete bundle (e.g. one that assumes a
	// prerequisite this fresh empty repository doesn't have) before any fetch is attempted.
	if _, err := sterile.Run(ctx, repoDir, "bundle", "verify", bundlePath); err != nil {
		fullCleanup()
		return nil, fmt.Errorf("pkgimport: bundle failed verification (possibly non-self-contained or corrupt): %w", err)
	}

	importRef := "refs/heads/mihver-broker-imported"
	refspec := BundleRefName + ":" + importRef
	if _, err := sterile.Run(ctx, repoDir, "fetch", "--quiet", bundlePath, refspec); err != nil {
		fullCleanup()
		return nil, fmt.Errorf("pkgimport: fetch %s from bundle: %w", BundleRefName, err)
	}

	resolved, err := sterile.Run(ctx, repoDir, "rev-parse", "--verify", "--quiet", importRef)
	if err != nil {
		fullCleanup()
		return nil, fmt.Errorf("pkgimport: resolve imported ref: %w", err)
	}
	if resolved != expectedCommitSHA {
		fullCleanup()
		return nil, fmt.Errorf("pkgimport: imported ref resolves to %s, expected commit_sha %s", resolved, expectedCommitSHA)
	}

	return &Imported{
		Dir:       repoDir,
		CommitSHA: expectedCommitSHA,
		sterile:   sterile,
		cleanup:   fullCleanup,
	}, nil
}

// Run executes a read-only Git plumbing command against the imported bare repository under the same
// sterile environment used for the import itself.
func (im *Imported) Run(ctx context.Context, args ...string) (string, error) {
	return im.sterile.Run(ctx, im.Dir, args...)
}
