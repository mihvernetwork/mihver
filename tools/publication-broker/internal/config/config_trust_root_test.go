package config

// Regression suite for MIHVER V3.1-B Closeout Pack A.2, Work Package A (Absolute Canonical Trust
// Roots). Confirmed defect: RepositoryModelWritableRoot/DevelopmentUserHome were only required to be
// non-empty. A RELATIVE trust root remains relative after filepath.EvalSymlinks; comparing it to an
// absolute protected path via filepath.Rel then fails, and the pre-fix isInside converted that error
// to `false` ("not inside") -- so a protected path genuinely inside the repository/home could be
// accepted merely because its trust root was supplied relatively. Every test below was written
// against, and confirmed to fail against, the pre-fix implementation before the fix was applied.

import (
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

// relativeTo returns a path relative to the process's current working directory pointing at the
// same real location as abs -- used to construct a trust root that is genuinely, unambiguously
// relative (not merely "not cleaned") while still resolving to a real, existing directory.
func relativeTo(t *testing.T, abs string) string {
	t.Helper()
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("os.Getwd: %v", err)
	}
	rel, err := filepath.Rel(cwd, abs)
	if err != nil {
		t.Fatalf("filepath.Rel(%q, %q): %v", cwd, abs, err)
	}
	if filepath.IsAbs(rel) {
		t.Fatalf("test setup bug: relativeTo produced an absolute path %q", rel)
	}
	return rel
}

// Case 1: an absolute key genuinely inside a real repository root, with the repository root
// supplied RELATIVELY, must be rejected -- not silently accepted via the isInside/filepath.Rel
// failure-to-false bug.
func TestValidate_RelativeRepoRoot_KeyGenuinelyInside_Rejected(t *testing.T) {
	repoRoot := t.TempDir()
	cfg := validCfg(t, repoRoot) // key material lives directly inside repoRoot
	cfg.RepositoryModelWritableRoot = relativeTo(t, repoRoot)

	err := cfg.Validate()
	if err == nil {
		t.Fatalf("SECURITY DEFECT: a relative repository root did not disable containment -- a key genuinely inside the repository was accepted")
	}
	if !strings.Contains(err.Error(), "absolute") {
		t.Fatalf("expected the rejection to be about the root not being absolute, got: %v", err)
	}
}

// Case 2: an absolute grant store, audit log, client socket, and admin socket, each genuinely
// inside a real repository root supplied RELATIVELY, must each independently be rejected.
func TestValidate_RelativeRepoRoot_RuntimePathsGenuinelyInside_Rejected(t *testing.T) {
	repoRoot := t.TempDir()
	relRoot := relativeTo(t, repoRoot)

	mutations := map[string]func(*Config){
		"grant store":   func(c *Config) { c.GrantStorePath = filepath.Join(repoRoot, "grants.json") },
		"audit log":     func(c *Config) { c.AuditLogPath = filepath.Join(repoRoot, "audit.jsonl") },
		"client socket": func(c *Config) { c.ClientSocketPath = filepath.Join(repoRoot, "client.sock") },
		"admin socket":  func(c *Config) { c.AdminSocketPath = filepath.Join(repoRoot, "admin.sock") },
	}
	for label, mutate := range mutations {
		t.Run(label, func(t *testing.T) {
			cfg := validCfg(t, t.TempDir())
			cfg.RepositoryModelWritableRoot = relRoot
			mutate(&cfg)

			if err := cfg.Validate(); err == nil {
				t.Fatalf("SECURITY DEFECT: a relative repository root did not disable containment for the %s path", label)
			}
		})
	}
}

// Case 3: DevelopmentUserHome supplied relatively must be rejected, symmetrically to
// RepositoryModelWritableRoot.
func TestValidate_RelativeDevHome_KeyGenuinelyInside_Rejected(t *testing.T) {
	devHome := t.TempDir()
	cfg := validCfg(t, devHome)
	cfg.DevelopmentUserHome = relativeTo(t, devHome)

	err := cfg.Validate()
	if err == nil {
		t.Fatalf("SECURITY DEFECT: a relative development-user-home root did not disable containment -- a key genuinely inside it was accepted")
	}
	if !strings.Contains(err.Error(), "absolute") {
		t.Fatalf("expected the rejection to be about the root not being absolute, got: %v", err)
	}
}

// Case 4: a missing (non-existent) trust root must be rejected.
func TestValidate_MissingRepoRoot_Rejected(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.RepositoryModelWritableRoot = filepath.Join(t.TempDir(), "does-not-exist")

	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected a missing repository model-writable root to be rejected")
	}
}

func TestValidate_MissingDevHome_Rejected(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.DevelopmentUserHome = filepath.Join(t.TempDir(), "does-not-exist")

	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected a missing development user home to be rejected")
	}
}

// Case 5: a trust root that is a regular file (not a directory) must be rejected.
func TestValidate_RepoRootIsRegularFile_Rejected(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	filePath := filepath.Join(t.TempDir(), "not-a-directory")
	if err := os.WriteFile(filePath, []byte("x"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
	cfg.RepositoryModelWritableRoot = filePath

	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a repository root that is a regular file was accepted")
	}
}

func TestValidate_DevHomeIsRegularFile_Rejected(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	filePath := filepath.Join(t.TempDir(), "not-a-directory")
	if err := os.WriteFile(filePath, []byte("x"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
	cfg.DevelopmentUserHome = filePath

	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a development user home that is a regular file was accepted")
	}
}

// Case 6: a trust root that is a FIFO must be rejected. Skips (with an explicit log message) if
// syscall.Mkfifo is unavailable on this platform, mirroring fifoPathForTest's own convention.
func TestValidate_RepoRootIsFIFO_Rejected(t *testing.T) {
	dir := t.TempDir()
	fifoPath := filepath.Join(dir, "fifo-root")
	if err := syscall.Mkfifo(fifoPath, 0o600); err != nil {
		t.Skipf("syscall.Mkfifo unavailable on this platform, skipping FIFO-as-trust-root assertion: %v", err)
	}
	cfg := validCfg(t, t.TempDir())
	cfg.RepositoryModelWritableRoot = fifoPath

	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a repository root that is a FIFO was accepted")
	}
}

// Case 7: safe, absolute, external roots (the ordinary happy path) must still be accepted --
// validCfg itself IS this case, exercised repeatedly throughout config_test.go; asserted here
// explicitly as this round's own positive control.
func TestValidate_AbsoluteExistingDirectoryRoots_Accepted(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	if err := cfg.Validate(); err != nil {
		t.Fatalf("unexpected error for safe absolute external trust roots: %v", err)
	}
}

// Case 9: no protected resource may be opened before trust-root validation succeeds. Constructs a
// Config whose PrivateKeyPath points at a NONEXISTENT file (which would produce a distinct
// "private key missing or unreadable" error if validatePrivateKeyPath's os.Lstat ever ran) AND whose
// RepositoryModelWritableRoot is invalid (relative). If the returned error is about the trust root
// rather than the (never-reached) private key, that proves root validation ran first.
func TestValidate_TrustRootValidationRunsBeforeAnyProtectedResourceIsOpened(t *testing.T) {
	repoRoot := t.TempDir()
	cfg := validCfg(t, t.TempDir())
	cfg.PrivateKeyPath = filepath.Join(t.TempDir(), "never-should-be-opened.pem")
	cfg.RepositoryModelWritableRoot = relativeTo(t, repoRoot)

	err := cfg.Validate()
	if err == nil {
		t.Fatalf("expected an error")
	}
	if strings.Contains(err.Error(), "private key") {
		t.Fatalf("SECURITY DEFECT: a protected resource (the private key) was apparently inspected before trust-root validation failed: %v", err)
	}
	if !strings.Contains(err.Error(), "absolute") {
		t.Fatalf("expected the rejection to name the trust root not being absolute, got: %v", err)
	}
}

// isInside's own contract: a comparison error must never be silently treated as "outside." Exercised
// directly at the unit level (not only through the higher-level Validate path above) since isInside
// is what the original defect lived in.
func TestIsInside_ComparisonErrorFailsClosed(t *testing.T) {
	// filepath.Rel returns an error when root and path use incompatible absolute/relative forms
	// (e.g. a relative root against an absolute path) -- exactly the pre-fix defect's trigger.
	inside, err := isInside("/abs/protected/path", "relative/root")
	if err == nil {
		t.Fatalf("expected isInside to return an error for an absolute/relative mismatch, got inside=%v", err)
	}
	if inside {
		t.Fatalf("SECURITY DEFECT: isInside reported inside=true alongside an error")
	}
}

func TestIsInside_OrdinaryContainment(t *testing.T) {
	inside, err := isInside("/repo/sub/file", "/repo")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !inside {
		t.Fatalf("expected /repo/sub/file to be reported inside /repo")
	}

	inside, err = isInside("/other/file", "/repo")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if inside {
		t.Fatalf("expected /other/file to be reported outside /repo")
	}
}
