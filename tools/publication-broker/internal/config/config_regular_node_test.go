package config

// Regression suite for MIHVER V3.1-B Closeout Pack A.2.1, Work Package B (Require Regular Protected
// File Nodes). Confirmed defect: validatePrivateKeyPath/validateStoreFilePath/rejectWritableByOthers
// checked only "not a symlink" plus permission bits -- a FIFO, Unix domain socket, directory, or
// device node created with safe permission bits (e.g. 0600) would have passed undetected, since none
// of those checks inspected the node's TYPE. Every test below exercises a real filesystem node (a
// real FIFO via syscall.Mkfifo, a real Unix socket via net.Listen, a real directory, a real symlink)
// against PrivateKeyPath, GrantStorePath, AuditLogPath, and BrokerConfigPath.

import (
	"net"
	"os"
	"path/filepath"
	"syscall"
	"testing"
	"time"
)

// unixSocketPathForTest creates a real, listening Unix domain socket and returns its path, leaving
// the socket file in place (the listener is closed via t.Cleanup, which does not itself remove the
// socket special file). Deliberately uses a short path under "/tmp" directly, NOT t.TempDir() --
// t.TempDir()'s nested-subtest-derived paths can exceed the ~104-byte sun_path limit Unix domain
// sockets are subject to on macOS/BSD, which would fail with an unrelated "invalid argument" error
// having nothing to do with what this test is actually checking.
func unixSocketPathForTest(t *testing.T) string {
	t.Helper()
	dir, err := os.MkdirTemp("/tmp", "mihver-cfg-sock-")
	if err != nil {
		t.Fatalf("MkdirTemp: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	path := filepath.Join(dir, "n.sock")
	ln, err := net.Listen("unix", path)
	if err != nil {
		t.Fatalf("net.Listen(unix): %v", err)
	}
	t.Cleanup(func() { ln.Close() })
	return path
}

// --- PrivateKeyPath ----------------------------------------------------------------------------

func TestValidate_RejectsFIFOAtPrivateKeyPath(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "key.pem")
	if err := syscall.Mkfifo(path, 0o600); err != nil {
		t.Skipf("syscall.Mkfifo unavailable on this platform: %v", err)
	}
	cfg := validCfg(t, t.TempDir())
	cfg.PrivateKeyPath = path
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a FIFO at PrivateKeyPath was accepted")
	}
}

func TestValidate_RejectsUnixSocketAtPrivateKeyPath(t *testing.T) {
	path := unixSocketPathForTest(t)
	cfg := validCfg(t, t.TempDir())
	cfg.PrivateKeyPath = path
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a Unix domain socket at PrivateKeyPath was accepted")
	}
}

func TestValidate_RejectsDirectoryAtPrivateKeyPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.PrivateKeyPath = t.TempDir()
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a directory at PrivateKeyPath was accepted")
	}
}

func TestValidate_AcceptsRegularSafePrivateKey(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected a regular, safely-permissioned private key to be accepted: %v", err)
	}
}

// TestValidate_RejectsFIFOAtPrivateKeyPathWithoutBlocking is the bounded proof this round's task
// requires: Config.Validate must reject a FIFO before anything (grant.Open, audit.Open,
// loadRSAPrivateKey -- in cmd/mihver-broker's own run(), all called only AFTER cfg.Validate()
// succeeds) could ever attempt to open it and block waiting for a reader/writer on the other end.
// os.Lstat is metadata-only and never blocks on a FIFO with no peer -- this test proves
// Config.Validate itself returns promptly with a rejection, never hanging.
func TestValidate_RejectsFIFOAtPrivateKeyPathWithoutBlocking(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "key.pem")
	if err := syscall.Mkfifo(path, 0o600); err != nil {
		t.Skipf("syscall.Mkfifo unavailable on this platform: %v", err)
	}
	cfg := validCfg(t, t.TempDir())
	cfg.PrivateKeyPath = path

	done := make(chan error, 1)
	go func() { done <- cfg.Validate() }()

	select {
	case err := <-done:
		if err == nil {
			t.Fatalf("SECURITY DEFECT: a FIFO at PrivateKeyPath was accepted")
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("Config.Validate blocked for >2s on a FIFO with no peer -- it must classify via Lstat only, never open() the node")
	}
}

// --- GrantStorePath ------------------------------------------------------------------------------

func TestValidate_RejectsFIFOAtGrantStorePathWithoutBlocking(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "grants.json")
	if err := syscall.Mkfifo(path, 0o600); err != nil {
		t.Skipf("syscall.Mkfifo unavailable on this platform: %v", err)
	}
	cfg := validCfg(t, t.TempDir())
	cfg.GrantStorePath = path

	done := make(chan error, 1)
	go func() { done <- cfg.Validate() }()

	select {
	case err := <-done:
		if err == nil {
			t.Fatalf("SECURITY DEFECT: a FIFO at GrantStorePath was accepted")
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("Config.Validate blocked for >2s on a FIFO with no peer -- it must classify via Lstat only, never open() the node")
	}
}

func TestValidate_RejectsUnixSocketAtGrantStorePath(t *testing.T) {
	path := unixSocketPathForTest(t)
	cfg := validCfg(t, t.TempDir())
	cfg.GrantStorePath = path
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a Unix domain socket at GrantStorePath was accepted")
	}
}

func TestValidate_RejectsDirectoryAtGrantStorePath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.GrantStorePath = t.TempDir()
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a directory at GrantStorePath was accepted")
	}
}

func TestValidate_AcceptsAbsentGrantStorePath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.GrantStorePath = filepath.Join(t.TempDir(), "does-not-exist-yet.json")
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected an absent grant store path (to be created by the Broker) to be accepted: %v", err)
	}
}

func TestValidate_AcceptsRegularSafeGrantStoreFile(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	if err := os.WriteFile(cfg.GrantStorePath, []byte("[]"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected a regular, safely-permissioned existing grant store file to be accepted: %v", err)
	}
}

// --- AuditLogPath --------------------------------------------------------------------------------

func TestValidate_RejectsFIFOAtAuditLogPathWithoutBlocking(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "audit.jsonl")
	if err := syscall.Mkfifo(path, 0o600); err != nil {
		t.Skipf("syscall.Mkfifo unavailable on this platform: %v", err)
	}
	cfg := validCfg(t, t.TempDir())
	cfg.AuditLogPath = path

	done := make(chan error, 1)
	go func() { done <- cfg.Validate() }()

	select {
	case err := <-done:
		if err == nil {
			t.Fatalf("SECURITY DEFECT: a FIFO at AuditLogPath was accepted")
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("Config.Validate blocked for >2s on a FIFO with no peer -- it must classify via Lstat only, never open() the node")
	}
}

func TestValidate_RejectsUnixSocketAtAuditLogPath(t *testing.T) {
	path := unixSocketPathForTest(t)
	cfg := validCfg(t, t.TempDir())
	cfg.AuditLogPath = path
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a Unix domain socket at AuditLogPath was accepted")
	}
}

func TestValidate_RejectsDirectoryAtAuditLogPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.AuditLogPath = t.TempDir()
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a directory at AuditLogPath was accepted")
	}
}

func TestValidate_AcceptsAbsentAuditLogPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.AuditLogPath = filepath.Join(t.TempDir(), "does-not-exist-yet.jsonl")
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected an absent audit log path (to be created by the Broker) to be accepted: %v", err)
	}
}

func TestValidate_AcceptsRegularSafeAuditLogFile(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	if err := os.WriteFile(cfg.AuditLogPath, []byte(""), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected a regular, safely-permissioned existing audit log file to be accepted: %v", err)
	}
}

// --- BrokerConfigPath ----------------------------------------------------------------------------

func TestValidate_RejectsFIFOAtBrokerConfigPath(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "broker.json")
	if err := syscall.Mkfifo(path, 0o600); err != nil {
		t.Skipf("syscall.Mkfifo unavailable on this platform: %v", err)
	}
	cfg := validCfg(t, t.TempDir())
	cfg.BrokerConfigPath = path
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a FIFO at BrokerConfigPath was accepted")
	}
}

func TestValidate_RejectsUnixSocketAtBrokerConfigPath(t *testing.T) {
	path := unixSocketPathForTest(t)
	cfg := validCfg(t, t.TempDir())
	cfg.BrokerConfigPath = path
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a Unix domain socket at BrokerConfigPath was accepted")
	}
}

func TestValidate_RejectsDirectoryAtBrokerConfigPath(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.BrokerConfigPath = t.TempDir()
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a directory at BrokerConfigPath was accepted")
	}
}

func TestValidate_RejectsSymlinkedBrokerConfigFile(t *testing.T) {
	target := filepath.Join(t.TempDir(), "real-broker.json")
	if err := os.WriteFile(target, []byte("{}"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	link := filepath.Join(t.TempDir(), "broker.json")
	if err := os.Symlink(target, link); err != nil {
		t.Fatalf("symlink: %v", err)
	}
	cfg := validCfg(t, t.TempDir())
	cfg.BrokerConfigPath = link
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a symlinked BrokerConfigPath file was accepted")
	}
}

func TestValidate_RejectsGroupWorldWritableBrokerConfigFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "broker.json")
	if err := os.WriteFile(path, []byte("{}"), 0o666); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := os.Chmod(path, 0o666); err != nil {
		t.Fatalf("chmod: %v", err)
	}
	cfg := validCfg(t, t.TempDir())
	cfg.BrokerConfigPath = path
	if err := cfg.Validate(); err == nil {
		t.Fatalf("SECURITY DEFECT: a group/world-writable BrokerConfigPath file was accepted")
	}
}

func TestValidate_AcceptsRegularSafeBrokerConfigFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "broker.json")
	if err := os.WriteFile(path, []byte("{}"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	cfg := validCfg(t, t.TempDir())
	cfg.BrokerConfigPath = path
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected a regular, safely-permissioned broker config file to be accepted: %v", err)
	}
}

func TestValidate_UnconfiguredBrokerConfigPathAccepted(t *testing.T) {
	cfg := validCfg(t, t.TempDir())
	cfg.BrokerConfigPath = ""
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected an unconfigured (empty) BrokerConfigPath to be accepted: %v", err)
	}
}
