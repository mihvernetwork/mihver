package server

import (
	"net"
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

// shortSocketDir (used below) is defined once in listener_test.go and shared across this package's
// test files -- see its doc comment there for why a real Unix socket test needs a shorter path than
// t.TempDir() alone reliably provides.

func TestSafeRemoveStaleSocket_AllowsMissingPath(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "does-not-exist.sock")
	if err := safeRemoveStaleSocket(path); err != nil {
		t.Fatalf("expected a missing path to be allowed (no-op): %v", err)
	}
}

// TestSafeRemoveStaleSocket_RemovesGenuineStaleSocket constructs a real stale Unix domain socket the
// exact way an unclean prior shutdown leaves one behind: net.Listen("unix", path) followed by Close()
// WITHOUT removing the socket file -- the OS does not auto-clean it, so the file survives on disk
// while the listener itself is gone.
func TestSafeRemoveStaleSocket_RemovesGenuineStaleSocket(t *testing.T) {
	dir := shortSocketDir(t)
	path := filepath.Join(dir, "stale.sock")

	ln, err := net.Listen("unix", path)
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	// net.UnixListener.Close() unlinks its socket file by default -- exactly the opposite of what a
	// genuine unclean shutdown (process killed without ever calling Close) leaves behind.
	// SetUnlinkOnClose(false) disables that auto-cleanup so Close() below leaves the socket file on
	// disk, which is the actual scenario safeRemoveStaleSocket exists to handle.
	ln.(*net.UnixListener).SetUnlinkOnClose(false)
	if err := ln.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}
	if _, err := os.Lstat(path); err != nil {
		t.Fatalf("precondition failed: stale socket file should still exist on disk: %v", err)
	}

	if err := safeRemoveStaleSocket(path); err != nil {
		t.Fatalf("expected a genuine stale socket to be removed: %v", err)
	}
	if _, err := os.Lstat(path); !os.IsNotExist(err) {
		t.Fatalf("expected the stale socket file to be gone, Lstat err = %v", err)
	}
}

func TestSafeRemoveStaleSocket_RejectsRegularFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "not-a-socket")
	if err := os.WriteFile(path, []byte("important data"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}

	if err := safeRemoveStaleSocket(path); err == nil {
		t.Fatalf("expected rejection of a regular file at the socket path")
	}
	if _, err := os.Lstat(path); err != nil {
		t.Fatalf("expected the regular file to remain untouched after rejection: %v", err)
	}
}

func TestSafeRemoveStaleSocket_RejectsDirectory(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "a-directory")
	if err := os.Mkdir(path, 0o700); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	if err := safeRemoveStaleSocket(path); err == nil {
		t.Fatalf("expected rejection of a directory at the socket path")
	}
	if info, err := os.Lstat(path); err != nil || !info.IsDir() {
		t.Fatalf("expected the directory to remain untouched after rejection, err=%v", err)
	}
}

func TestSafeRemoveStaleSocket_RejectsSymlink(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "target-file")
	if err := os.WriteFile(target, []byte("data"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	link := filepath.Join(dir, "a-symlink")
	if err := os.Symlink(target, link); err != nil {
		t.Fatalf("symlink: %v", err)
	}

	if err := safeRemoveStaleSocket(link); err == nil {
		t.Fatalf("expected rejection of a symlink at the socket path, regardless of its target")
	}
	if _, err := os.Lstat(link); err != nil {
		t.Fatalf("expected the symlink itself to remain untouched after rejection: %v", err)
	}
	if _, err := os.Lstat(target); err != nil {
		t.Fatalf("expected the symlink's target to remain untouched after rejection: %v", err)
	}
}

// TestSafeRemoveStaleSocket_RejectsSymlinkToGenuineSocket confirms rejection is unconditional on the
// node TYPE at path itself (a symlink), never on what a symlink happens to point to -- even when the
// target is itself a genuine stale socket, the symlink must still be refused, not followed and deleted
// out from under its real target.
func TestSafeRemoveStaleSocket_RejectsSymlinkToGenuineSocket(t *testing.T) {
	dir := shortSocketDir(t)
	realSocket := filepath.Join(dir, "real.sock")
	ln, err := net.Listen("unix", realSocket)
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	ln.(*net.UnixListener).SetUnlinkOnClose(false) // see the sibling test's comment for why
	if err := ln.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}
	link := filepath.Join(dir, "link.sock")
	if err := os.Symlink(realSocket, link); err != nil {
		t.Fatalf("symlink: %v", err)
	}

	if err := safeRemoveStaleSocket(link); err == nil {
		t.Fatalf("expected rejection of a symlink even when it points at a genuine stale socket")
	}
	if _, err := os.Lstat(link); err != nil {
		t.Fatalf("expected the symlink to remain untouched after rejection: %v", err)
	}
	if _, err := os.Lstat(realSocket); err != nil {
		t.Fatalf("expected the real socket to remain untouched after rejection: %v", err)
	}
}

func TestSafeRemoveStaleSocket_RejectsFIFO(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "a-fifo")
	if err := syscall.Mkfifo(path, 0o600); err != nil {
		t.Skipf("syscall.Mkfifo unavailable/unreliable on this test platform, skipping FIFO assertion: %v", err)
	}

	if err := safeRemoveStaleSocket(path); err == nil {
		t.Fatalf("expected rejection of a FIFO at the socket path")
	}
	if _, err := os.Lstat(path); err != nil {
		t.Fatalf("expected the FIFO to remain untouched after rejection: %v", err)
	}
}
