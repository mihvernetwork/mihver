package config

import (
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

// fifoPathForTest creates a real FIFO (named pipe) via syscall.Mkfifo in a fresh t.TempDir() and
// returns its path, or returns "" if FIFO creation is not available/reliable on this platform --
// syscall.Mkfifo is supported on macOS and Linux (both covered by this project's CI/dev targets),
// so a failure here is treated as "skip, and say why" rather than silently dropping the assertion.
func fifoPathForTest(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "client.sock")
	if err := syscall.Mkfifo(path, 0o600); err != nil {
		t.Logf("syscall.Mkfifo unavailable on this platform, skipping FIFO-at-socket-path assertion: %v", err)
		return ""
	}
	return path
}

func writeKey(t *testing.T, dir string, mode os.FileMode) string {
	t.Helper()
	path := filepath.Join(dir, "key.pem")
	if err := os.WriteFile(path, []byte("fake key material"), mode); err != nil {
		t.Fatalf("write key: %v", err)
	}
	// os.WriteFile's mode argument only applies at file *creation*, and is itself subject to the
	// process umask -- os.Chmod afterward forces the exact bits this test needs regardless of
	// either, and regardless of whether the path happened to already exist.
	if err := os.Chmod(path, mode); err != nil {
		t.Fatalf("chmod key: %v", err)
	}
	return path
}

// validCfg uses three DISTINCT, real, existing directories (key material, repo root, dev home) --
// EvalSymlinks-based containment checking requires real paths, and using distinct directories is
// what makes TestValidate_RejectsKeyInsideRepo/DevHome below a meaningful adversarial mutation
// rather than a no-op.
func validCfg(t *testing.T, keyDir string) Config {
	t.Helper()
	return Config{
		Mode:                        ModeProduction,
		PrivateKeyPath:              writeKey(t, keyDir, 0o600),
		RepositoryModelWritableRoot: t.TempDir(),
		DevelopmentUserHome:         t.TempDir(),
		AppID:                       "12345",
		InstallationID:              "67890",
		GitHubAPIHost:               FixedGitHubAPIHost,
		GitRemoteHost:               FixedGitHubHost,
		// Safe, fully-external, absolute values for the B2 runtime paths -- each rooted in its own
		// distinct temp directory so a test mutating any one of them is a meaningful adversarial
		// change rather than accidentally also perturbing another field.
		GrantStorePath:   filepath.Join(t.TempDir(), "grants.json"),
		AuditLogPath:     filepath.Join(t.TempDir(), "audit.jsonl"),
		ClientSocketPath: filepath.Join(t.TempDir(), "client.sock"),
		AdminSocketPath:  filepath.Join(t.TempDir(), "admin.sock"),
		GitBinaryPath:    writeExecutable(t, t.TempDir(), "git", 0o755),
		// BrokerBinaryPath is required in production as of this round (previously optional/skipped
		// when empty) -- give it its own distinct temp directory, like every other runtime path here,
		// so mutating any one field in a test remains a meaningful, isolated adversarial change.
		BrokerBinaryPath: writeExecutable(t, t.TempDir(), "mihver-broker", 0o755),
	}
}

func writeExecutable(t *testing.T, dir, name string, mode os.FileMode) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"), mode); err != nil {
		t.Fatalf("write executable: %v", err)
	}
	if err := os.Chmod(path, mode); err != nil { // bypass umask, see writeKey's comment above
		t.Fatalf("chmod executable: %v", err)
	}
	return path
}

func TestValidate_RuntimePaths_HappyPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected safe, fully-external runtime paths to be accepted: %v", err)
	}
}

func TestValidate_RejectsGrantStoreInsideRepo(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	repoRoot := t.TempDir()
	cfg.RepositoryModelWritableRoot = repoRoot
	cfg.GrantStorePath = filepath.Join(repoRoot, "grants.json")
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a grant store path inside the repository root")
	}
}

func TestValidate_RejectsAuditLogInsideRepo(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	repoRoot := t.TempDir()
	cfg.RepositoryModelWritableRoot = repoRoot
	cfg.AuditLogPath = filepath.Join(repoRoot, "audit.jsonl")
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of an audit log path inside the repository root")
	}
}

func TestValidate_RejectsGrantStoreInsideDevHome(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	devHome := t.TempDir()
	cfg.DevelopmentUserHome = devHome
	cfg.GrantStorePath = filepath.Join(devHome, "grants.json")
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a grant store path inside the development user's home")
	}
}

func TestValidate_RejectsAuditLogInsideDevHome(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	devHome := t.TempDir()
	cfg.DevelopmentUserHome = devHome
	cfg.AuditLogPath = filepath.Join(devHome, "audit.jsonl")
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of an audit log path inside the development user's home")
	}
}

func TestValidate_RejectsGrantStoreReachableThroughSymlinkedAncestorDirectory(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	outsideDir := t.TempDir()
	repoRoot := t.TempDir()
	insideRepoRealDir := filepath.Join(repoRoot, "real-subdir")
	if err := os.Mkdir(insideRepoRealDir, 0o700); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	symlinkAncestor := filepath.Join(outsideDir, "looks-outside")
	if err := os.Symlink(insideRepoRealDir, symlinkAncestor); err != nil {
		t.Fatalf("symlink: %v", err)
	}
	cfg.RepositoryModelWritableRoot = repoRoot
	cfg.GrantStorePath = filepath.Join(symlinkAncestor, "grants.json")
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a grant store path reachable through a symlinked ancestor directory pointing inside the repository root")
	}
}

func TestValidate_RejectsSymlinkedGrantStoreFile(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	dir := t.TempDir()
	realPath := filepath.Join(dir, "real-grants.json")
	if err := os.WriteFile(realPath, []byte("{}"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	linkPath := filepath.Join(dir, "grants.json")
	if err := os.Symlink(realPath, linkPath); err != nil {
		t.Fatalf("symlink: %v", err)
	}
	cfg.GrantStorePath = linkPath
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a symlinked grant store file")
	}
}

func TestValidate_RejectsSymlinkedAuditLogFile(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	dir := t.TempDir()
	realPath := filepath.Join(dir, "real-audit.jsonl")
	if err := os.WriteFile(realPath, []byte(""), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	linkPath := filepath.Join(dir, "audit.jsonl")
	if err := os.Symlink(realPath, linkPath); err != nil {
		t.Fatalf("symlink: %v", err)
	}
	cfg.AuditLogPath = linkPath
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a symlinked audit log file")
	}
}

func TestValidate_RejectsGroupWorldWritableGrantStoreFile(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	dir := t.TempDir()
	path := filepath.Join(dir, "grants.json")
	if err := os.WriteFile(path, []byte("{}"), 0o666); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := os.Chmod(path, 0o666); err != nil {
		t.Fatalf("chmod: %v", err)
	}
	cfg.GrantStorePath = path
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a group/world-writable grant store file")
	}
}

func TestValidate_RejectsGroupWorldWritableAuditLogFile(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	dir := t.TempDir()
	path := filepath.Join(dir, "audit.jsonl")
	if err := os.WriteFile(path, []byte(""), 0o666); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := os.Chmod(path, 0o666); err != nil {
		t.Fatalf("chmod: %v", err)
	}
	cfg.AuditLogPath = path
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a group/world-writable audit log file")
	}
}

func TestValidate_RejectsRelativeRuntimePaths(t *testing.T) {
	fields := map[string]func(*Config, string){
		"grant store":   func(c *Config, v string) { c.GrantStorePath = v },
		"audit log":     func(c *Config, v string) { c.AuditLogPath = v },
		"client socket": func(c *Config, v string) { c.ClientSocketPath = v },
		"admin socket":  func(c *Config, v string) { c.AdminSocketPath = v },
		"git binary":    func(c *Config, v string) { c.GitBinaryPath = v },
	}
	for label, set := range fields {
		t.Run(label, func(t *testing.T) {
			cfg := validCfg(t, t.TempDir())
			set(&cfg, "relative/path")
			if err := cfg.Validate(); err == nil {
				t.Fatalf("expected rejection of a relative %s path", label)
			}
		})
	}
}

func TestValidate_RejectsEqualClientAndAdminSocketPaths(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.AdminSocketPath = cfg.ClientSocketPath
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of equal client/admin socket paths")
	}
}

func TestValidate_RejectsClientSocketParentInsideRepo(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	repoRoot := t.TempDir()
	cfg.RepositoryModelWritableRoot = repoRoot
	cfg.ClientSocketPath = filepath.Join(repoRoot, "client.sock")
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a client socket path with a parent inside the repository root")
	}
}

func TestValidate_RejectsAdminSocketParentInsideDevHome(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	devHome := t.TempDir()
	cfg.DevelopmentUserHome = devHome
	cfg.AdminSocketPath = filepath.Join(devHome, "admin.sock")
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of an admin socket path with a parent inside the development user's home")
	}
}

func TestValidate_RejectsGitBinaryInsideRepo(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	repoRoot := t.TempDir()
	cfg.RepositoryModelWritableRoot = repoRoot
	cfg.GitBinaryPath = writeExecutable(t, repoRoot, "git", 0o755)
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a git binary path inside the repository root")
	}
}

func TestValidate_RejectsGroupWorldWritableGitBinary(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.GitBinaryPath = writeExecutable(t, t.TempDir(), "git", 0o775)
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a group-writable git binary")
	}
}

func TestValidate_RejectsMissingGitBinary(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.GitBinaryPath = filepath.Join(t.TempDir(), "does-not-exist")
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a missing git binary path")
	}
}

func TestValidate_RejectsGitBinaryThatIsADirectory(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "git"), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	cfg.GitBinaryPath = filepath.Join(dir, "git")
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a git binary path that is a directory")
	}
}

func TestValidate_RejectsSymlinkedGitBinary(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	dir := t.TempDir()
	real := writeExecutable(t, dir, "real-git", 0o755)
	link := filepath.Join(dir, "git")
	if err := os.Symlink(real, link); err != nil {
		t.Fatalf("symlink: %v", err)
	}
	cfg.GitBinaryPath = link
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a symlinked git binary path")
	}
}

func TestValidate_RejectsNonExecutableGitBinary(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.GitBinaryPath = writeExecutable(t, t.TempDir(), "git", 0o600)
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a non-executable git binary path")
	}
}

func TestValidate_HappyPath(t *testing.T) {
	dir := t.TempDir()
	cfg := validCfg(t, dir)
	if err := cfg.Validate(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidate_RejectsKeyInsideRepo(t *testing.T) {
	dir := t.TempDir()
	cfg := validCfg(t, dir)
	cfg.RepositoryModelWritableRoot = filepath.Dir(cfg.PrivateKeyPath)
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of key path inside repository root")
	}
}

func TestValidate_RejectsKeyInsideDevHome(t *testing.T) {
	dir := t.TempDir()
	cfg := validCfg(t, dir)
	cfg.DevelopmentUserHome = filepath.Dir(cfg.PrivateKeyPath)
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of key path inside development user's home")
	}
}

func TestValidate_RejectsSymlinkedKey(t *testing.T) {
	dir := t.TempDir()
	realKey := writeKey(t, dir, 0o600)
	linkPath := filepath.Join(dir, "key-link.pem")
	if err := os.Symlink(realKey, linkPath); err != nil {
		t.Fatalf("symlink: %v", err)
	}
	cfg := validCfg(t, dir)
	cfg.PrivateKeyPath = linkPath
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of symlinked key")
	}
}

func TestValidate_RejectsEmptyRepoRoot(t *testing.T) {
	// Regression test for a real reviewer-confirmed finding: --repo-root defaulting to "" must not
	// silently disable the containment check (isInside(path, "") previously returned false
	// unconditionally, accepting any key path when this flag was merely omitted).
	dir := t.TempDir()
	cfg := validCfg(t, dir)
	cfg.RepositoryModelWritableRoot = ""
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of an empty (unspecified) repository model-writable root")
	}
}

func TestValidate_RejectsEmptyDevHome(t *testing.T) {
	dir := t.TempDir()
	cfg := validCfg(t, dir)
	cfg.DevelopmentUserHome = ""
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of an empty (unspecified) development user home")
	}
}

func TestValidate_RejectsKeyReachableThroughSymlinkedAncestorDirectory(t *testing.T) {
	// Regression test for a real reviewer-confirmed finding: the key's own Lstat is not a symlink,
	// but one of its ANCESTOR directories is a symlink pointing inside the repository root -- a
	// naive string-prefix containment check on the path as given would miss this.
	outsideDir := t.TempDir()
	repoRoot := t.TempDir()
	insideRepoRealDir := filepath.Join(repoRoot, "real-subdir")
	if err := os.Mkdir(insideRepoRealDir, 0o700); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	symlinkAncestor := filepath.Join(outsideDir, "looks-outside")
	if err := os.Symlink(insideRepoRealDir, symlinkAncestor); err != nil {
		t.Fatalf("symlink: %v", err)
	}
	keyPath := writeKey(t, symlinkAncestor, 0o600)

	cfg := validCfg(t, t.TempDir())
	cfg.RepositoryModelWritableRoot = repoRoot
	cfg.PrivateKeyPath = keyPath
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a key reachable through a symlinked ancestor directory pointing inside the repository root")
	}
}

func TestValidate_RejectsMissingKey(t *testing.T) {
	dir := t.TempDir()
	cfg := validCfg(t, dir)
	cfg.PrivateKeyPath = filepath.Join(dir, "does-not-exist.pem")
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of missing key")
	}
}

func TestValidate_RejectsGroupWorldReadableKey(t *testing.T) {
	dir := t.TempDir()
	cfg := validCfg(t, dir)
	cfg.PrivateKeyPath = writeKey(t, dir, 0o644)
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of group/world-readable key")
	}
}

func TestValidate_RejectsRelativeKeyPath(t *testing.T) {
	dir := t.TempDir()
	cfg := validCfg(t, dir)
	cfg.PrivateKeyPath = "relative/key.pem"
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of relative private key path")
	}
}

func TestValidate_RejectsArbitraryGitHubAPIHost(t *testing.T) {
	dir := t.TempDir()
	cfg := validCfg(t, dir)
	cfg.GitHubAPIHost = "evil.example.com"
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of arbitrary GitHub API host in production")
	}
}

func TestValidate_RejectsArbitraryGitRemoteHost(t *testing.T) {
	dir := t.TempDir()
	cfg := validCfg(t, dir)
	cfg.GitRemoteHost = "evil.example.com"
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of arbitrary git remote host in production")
	}
}

func TestValidate_RejectsMalformedAppID(t *testing.T) {
	dir := t.TempDir()
	cfg := validCfg(t, dir)
	cfg.AppID = "not-numeric"
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of malformed app id")
	}
}

func TestValidate_RejectsGroupWritableBrokerBinary(t *testing.T) {
	dir := t.TempDir()
	cfg := validCfg(t, dir)
	binPath := filepath.Join(dir, "mihver-broker")
	os.WriteFile(binPath, []byte("binary"), 0o775)
	os.Chmod(binPath, 0o775) // bypass umask, see writeKey's comment above
	cfg.BrokerBinaryPath = binPath
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of group-writable broker binary")
	}
}

func TestValidate_TestModeSkipsProductionRules(t *testing.T) {
	cfg := Config{Mode: ModeTest}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("test mode should skip production rules: %v", err)
	}
}

// --- V3.1-B Hardening (this round): pairwise runtime-path disjointness, safe socket handling,
// required BrokerBinaryPath ------------------------------------------------------------------------

func TestValidate_RejectsClientAdminSocketAliasThroughSymlinkedParent(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	realDir := t.TempDir()
	linkDir := filepath.Join(t.TempDir(), "socket-link")
	if err := os.Symlink(realDir, linkDir); err != nil {
		t.Fatalf("symlink: %v", err)
	}
	cfg.ClientSocketPath = filepath.Join(realDir, "broker.sock")
	cfg.AdminSocketPath = filepath.Join(linkDir, "broker.sock")
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of client/admin sockets aliasing through a symlinked parent directory")
	}
}

func TestValidate_RejectsGrantStoreAuditLogSameRealPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	dir := t.TempDir()
	shared := filepath.Join(dir, "state.json")
	if err := os.WriteFile(shared, []byte("{}"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	cfg.GrantStorePath = shared
	cfg.AuditLogPath = shared
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of grant store and audit log at the same real path")
	}
}

func TestValidate_RejectsGrantStoreAuditLogHardlinkAlias(t *testing.T) {
	dir := t.TempDir()
	realPath := filepath.Join(dir, "grants.json")
	if err := os.WriteFile(realPath, []byte("{}"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	linkPath := filepath.Join(dir, "audit.jsonl")
	if err := os.Link(realPath, linkPath); err != nil {
		t.Skipf("hardlinks not supported on this filesystem: %v", err)
	}
	cfg := validCfg(t, t.TempDir())
	cfg.GrantStorePath = realPath
	cfg.AuditLogPath = linkPath
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of grant store and audit log as hardlink aliases of each other")
	}
}

func TestValidate_RejectsSocketAliasingStateFile(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	dir := t.TempDir()
	grantStore := filepath.Join(dir, "grants.json")
	if err := os.WriteFile(grantStore, []byte("{}"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	cfg.GrantStorePath = grantStore
	cfg.ClientSocketPath = grantStore
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a socket path colliding with a state file's real path")
	}
}

func TestValidate_RejectsSocketAliasingPrivateKey(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.ClientSocketPath = cfg.PrivateKeyPath
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a socket path colliding with the private key's real path")
	}
}

func TestValidate_RejectsSocketAliasingGitBinary(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.ClientSocketPath = cfg.GitBinaryPath
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a socket path colliding with the git binary's real path")
	}
}

func TestValidate_RejectsSocketAliasingBrokerBinary(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.AdminSocketPath = cfg.BrokerBinaryPath
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of a socket path colliding with the broker binary's real path")
	}
}

func TestValidate_RejectsExistingRegularFileAtSocketPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	dir := t.TempDir()
	path := filepath.Join(dir, "client.sock")
	if err := os.WriteFile(path, []byte("not a socket"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	cfg.ClientSocketPath = path
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of an existing regular file sitting at a configured socket path")
	}
}

func TestValidate_RejectsExistingSymlinkAtSocketPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	dir := t.TempDir()
	target := filepath.Join(dir, "elsewhere.sock")
	if err := os.WriteFile(target, []byte(""), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	path := filepath.Join(dir, "client.sock")
	if err := os.Symlink(target, path); err != nil {
		t.Fatalf("symlink: %v", err)
	}
	cfg.ClientSocketPath = path
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of an existing symlink sitting at a configured socket path")
	}
}

func TestValidate_RejectsExistingDirectoryAtSocketPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	dir := t.TempDir()
	path := filepath.Join(dir, "client.sock")
	if err := os.Mkdir(path, 0o700); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	cfg.ClientSocketPath = path
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of an existing directory sitting at a configured socket path")
	}
}

func TestValidate_RejectsExistingFIFOAtSocketPath(t *testing.T) {
	path := fifoPathForTest(t)
	if path == "" {
		t.Skip("FIFO creation not available/reliable on this test platform")
	}
	cfg := validCfg(t, t.TempDir())
	cfg.ClientSocketPath = path
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of an existing FIFO sitting at a configured socket path")
	}
}

func TestValidate_RejectsWorldWritableParentDirectory(t *testing.T) {
	fields := map[string]func(*Config, string){
		"grant store":   func(c *Config, v string) { c.GrantStorePath = filepath.Join(v, "grants.json") },
		"audit log":     func(c *Config, v string) { c.AuditLogPath = filepath.Join(v, "audit.jsonl") },
		"client socket": func(c *Config, v string) { c.ClientSocketPath = filepath.Join(v, "client.sock") },
		"admin socket":  func(c *Config, v string) { c.AdminSocketPath = filepath.Join(v, "admin.sock") },
	}
	for label, set := range fields {
		t.Run(label, func(t *testing.T) {
			cfg := validCfg(t, t.TempDir())
			dir := t.TempDir()
			if err := os.Chmod(dir, 0o777); err != nil {
				t.Fatalf("chmod: %v", err)
			}
			set(&cfg, dir)
			if err := cfg.Validate(); err == nil {
				t.Fatalf("expected rejection of a world-writable parent directory for the %s path", label)
			}
		})
	}
}

func TestValidate_RejectsEmptyBrokerBinaryPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.BrokerBinaryPath = ""
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected rejection of an empty broker binary path in production")
	}
}

func TestValidateGitHubAPIBaseURL_RejectsArbitraryHostInProduction(t *testing.T) {
	if err := ValidateGitHubAPIBaseURL(ModeProduction, "https://evil.example.com"); err == nil {
		t.Fatalf("expected rejection")
	}
	if err := ValidateGitHubAPIBaseURL(ModeProduction, "https://"+FixedGitHubAPIHost); err != nil {
		t.Fatalf("unexpected rejection of the real host: %v", err)
	}
	if err := ValidateGitHubAPIBaseURL(ModeTest, "http://127.0.0.1:12345"); err != nil {
		t.Fatalf("test mode must allow an injected fake endpoint: %v", err)
	}
}
