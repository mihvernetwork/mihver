package config

// Regression suite for MIHVER V3.1-B Closeout Pack A.2, Work Package B (Derived Grant Persistence
// Path Disjointness). Confirmed defect: grant persistence writes to GrantStorePath + ".tmp" and
// renames it over GrantStorePath (see internal/grant.Store.persistLocked), but runtime disjointness
// previously compared only the CONFIGURED paths -- so a configuration where
// AuditLogPath == GrantStorePath+".tmp" passed validation even though a real AdminHandle.Create then
// writes through the configured audit path and renames it over the Grant Store.

import (
	"os"
	"path/filepath"
	"syscall"
	"testing"
	"time"

	"mihver.network/publication-broker/internal/grant"
)

func TestValidate_RejectsAuditLogEqualToGrantTempPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.AuditLogPath = grantTempPath(cfg.GrantStorePath)
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: AuditLogPath == GrantStorePath+\".tmp\" was accepted")
	}
}

func TestValidate_RejectsClientSocketEqualToGrantTempPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.ClientSocketPath = grantTempPath(cfg.GrantStorePath)
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: ClientSocketPath == GrantStorePath+\".tmp\" was accepted")
	}
}

func TestValidate_RejectsAdminSocketEqualToGrantTempPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.AdminSocketPath = grantTempPath(cfg.GrantStorePath)
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: AdminSocketPath == GrantStorePath+\".tmp\" was accepted")
	}
}

func TestValidate_RejectsPrivateKeyEqualToGrantTempPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	// PrivateKeyPath must exist for validatePrivateKeyPath's own checks to get far enough to reach
	// disjointness, so write real key material at the exact derived temp path.
	tempPath := grantTempPath(cfg.GrantStorePath)
	if err := os.WriteFile(tempPath, []byte("fake key material"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	cfg.PrivateKeyPath = tempPath
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: PrivateKeyPath == GrantStorePath+\".tmp\" was accepted")
	}
}

func TestValidate_RejectsGitBinaryEqualToGrantTempPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	tempPath := grantTempPath(cfg.GrantStorePath)
	if err := os.WriteFile(tempPath, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatalf("write: %v", err)
	}
	cfg.GitBinaryPath = tempPath
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: GitBinaryPath == GrantStorePath+\".tmp\" was accepted")
	}
}

func TestValidate_RejectsBrokerBinaryEqualToGrantTempPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	tempPath := grantTempPath(cfg.GrantStorePath)
	if err := os.WriteFile(tempPath, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatalf("write: %v", err)
	}
	cfg.BrokerBinaryPath = tempPath
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: BrokerBinaryPath == GrantStorePath+\".tmp\" was accepted")
	}
}

func TestValidate_RejectsBrokerConfigEqualToGrantTempPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	tempPath := grantTempPath(cfg.GrantStorePath)
	if err := os.WriteFile(tempPath, []byte("{}"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	cfg.BrokerConfigPath = tempPath
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: BrokerConfigPath == GrantStorePath+\".tmp\" was accepted")
	}
}

// TestValidate_RejectsGrantTempPathAliasingThroughSymlinkedParent mirrors the existing
// symlinked-ancestor containment tests: the audit log is configured through a DIFFERENT-looking path
// that resolves, via a symlinked parent directory, to the exact same real location as the derived
// grant temp path.
func TestValidate_RejectsGrantTempPathAliasingThroughSymlinkedParent(t *testing.T) {
	realDir := t.TempDir()
	linkDir := filepath.Join(t.TempDir(), "link-to-real")
	if err := os.Symlink(realDir, linkDir); err != nil {
		t.Fatalf("symlink: %v", err)
	}

	cfg := validCfg(t, t.TempDir())
	cfg.GrantStorePath = filepath.Join(realDir, "grants.json")
	// Configured through the symlinked parent -- resolves to the exact same real file as
	// grantTempPath(cfg.GrantStorePath).
	cfg.AuditLogPath = filepath.Join(linkDir, "grants.json.tmp")

	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: an audit log reachable through a symlinked ancestor directory aliasing the derived grant temp path was accepted")
	}
}

// TestValidate_RejectsGrantTempPathHardlinkAlias mirrors the existing hardlink-alias tests for
// grant-store/audit-log.
func TestValidate_RejectsGrantTempPathHardlinkAlias(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	tempPath := grantTempPath(cfg.GrantStorePath)
	if err := os.WriteFile(tempPath, []byte("audit content"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	// AuditLogPath is configured at a DIFFERENT textual path that is a hardlink to the exact same
	// inode as the derived grant temp path.
	altAuditPath := filepath.Join(filepath.Dir(tempPath), "audit-alias.jsonl")
	if err := os.Link(tempPath, altAuditPath); err != nil {
		t.Skipf("hardlinks unavailable in this environment: %v", err)
	}
	cfg.AuditLogPath = altAuditPath

	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: an audit log that is a hardlink alias of the derived grant temp path was accepted")
	}
}

func TestValidate_RejectsDirectoryAtGrantTempPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	tempPath := grantTempPath(cfg.GrantStorePath)
	if err := os.Mkdir(tempPath, 0o700); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a directory sitting at the derived grant temp path was accepted")
	}
}

func TestValidate_RejectsSymlinkAtGrantTempPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	tempPath := grantTempPath(cfg.GrantStorePath)
	target := filepath.Join(t.TempDir(), "elsewhere")
	if err := os.WriteFile(target, []byte("x"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := os.Symlink(target, tempPath); err != nil {
		t.Fatalf("symlink: %v", err)
	}
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a symlink sitting at the derived grant temp path was accepted")
	}
}

func TestValidate_RejectsFIFOAtGrantTempPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	tempPath := grantTempPath(cfg.GrantStorePath)
	if err := syscall.Mkfifo(tempPath, 0o600); err != nil {
		t.Skipf("syscall.Mkfifo unavailable on this platform: %v", err)
	}
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a FIFO sitting at the derived grant temp path was accepted")
	}
}

func TestValidate_RejectsGroupWorldWritableFileAtGrantTempPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	tempPath := grantTempPath(cfg.GrantStorePath)
	if err := os.WriteFile(tempPath, []byte("x"), 0o666); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := os.Chmod(tempPath, 0o666); err != nil {
		t.Fatalf("chmod: %v", err)
	}
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a group/world-writable regular file sitting at the derived grant temp path was accepted")
	}
}

// TestValidate_AcceptsSafeStaleRegularFileAtGrantTempPath confirms a pre-existing, safe, non-writable
// stale regular temp file at the exact derived path (e.g. left behind by a prior ungraceful shutdown
// mid-persist) does NOT itself cause rejection -- persistLocked's own os.WriteFile simply truncates
// and overwrites it. Only ownership/permission/node-type problems (covered by the tests above) are
// rejected, not mere pre-existence.
func TestValidate_AcceptsSafeStaleRegularFileAtGrantTempPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	tempPath := grantTempPath(cfg.GrantStorePath)
	if err := os.WriteFile(tempPath, []byte(`[{"stale":"content"}]`), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected a safe stale regular temp file to be accepted, got: %v", err)
	}
}

// TestGrantPersistence_RealOperationalRegression is the "real operational regression" required by
// this round: it does not merely check that Config.Validate rejects the vulnerable configuration
// (the tests above already do that) -- it demonstrates, with the REAL internal/grant.Store and REAL
// file-system persistence, that the vulnerability the config check exists to prevent is genuine: if
// AuditLogPath is configured at GrantStorePath+".tmp" and a real AdminHandle.Create runs, the grant
// store's own temp-write-then-rename sequence silently overwrites and consumes whatever content was
// sitting at the configured audit log path -- exactly the cross-contamination Config.Validate must
// (and, per the tests above, does) reject before either subsystem is ever opened.
func TestGrantPersistence_RealOperationalRegression(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	auditLogPath := grantTempPath(cfg.GrantStorePath)
	realAuditContent := []byte(`{"real":"audit entry that must never be silently destroyed"}`)
	if err := os.WriteFile(auditLogPath, realAuditContent, 0o600); err != nil {
		t.Fatalf("write real audit content: %v", err)
	}
	cfg.AuditLogPath = auditLogPath

	// Step 1: Config.Validate must reject this configuration outright, before grant.Open or
	// audit.Open is ever called in the real cmd/mihver-broker startup sequence -- see main.go, which
	// runs cfg.Validate() before either Open call.
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: Config.Validate accepted a configuration where the audit log path aliases the derived grant temp path")
	}

	// Step 2: demonstrate what Validate's rejection is actually preventing -- a real Store,
	// bypassing config validation entirely (as the pre-fix code path effectively did), genuinely
	// destroys the "audit" content sitting at the colliding path the instant a grant is created.
	store, err := grant.Open(cfg.GrantStorePath)
	if err != nil {
		t.Fatalf("grant.Open: %v", err)
	}
	if _, err := store.Admin().Create(grant.CreateRequest{
		RequestDigest:   "d",
		RepositoryOwner: "mihvernetwork",
		RepositoryName:  "mihver",
		Branch:          "task/example",
		BaseBranch:      "main",
		BaseCommit:      "0000000000000000000000000000000000000000",
		TTL:             time.Hour,
	}); err != nil {
		t.Fatalf("Create: %v", err)
	}

	// The colliding path is not merely overwritten -- persistLocked's os.Rename(tmp, grantStorePath)
	// actually MOVES it out from under the configured audit log path entirely (it becomes the grant
	// store file itself), so the real audit content is now either gone or replaced. Either outcome
	// proves the destructive collision; only "unchanged and still present" would mean the test failed
	// to exercise it.
	survived, readErr := os.ReadFile(auditLogPath)
	if readErr == nil && string(survived) == string(realAuditContent) {
		t.Fatalf("test setup bug: the real audit content survived unmodified at %q -- this run did not actually exercise the collision", auditLogPath)
	}
	if readErr != nil {
		t.Logf("confirmed: the configured audit log path was consumed (renamed away) by a real AdminHandle.Create's grant-store persistence: %v", readErr)
	} else {
		t.Logf("confirmed: the configured audit log path's content was silently overwritten by a real AdminHandle.Create's grant-store persistence")
	}
	t.Logf("this is exactly what Config.Validate's rejection above prevents from ever being reachable")
}
