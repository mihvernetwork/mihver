package server

import (
	"errors"
	"fmt"
	"os"
)

// safeRemoveStaleSocket removes a stale Unix domain socket file at path -- and ONLY that -- before
// ClientListener/AdminListener.ServeSocket calls net.Listen("unix", path). net.Listen on "unix"
// fails with "address already in use" if a filesystem node already sits at path, so a socket server
// that wants to survive its own unclean prior shutdown (which leaves exactly such a stale socket
// file behind, since the OS does not auto-clean it) has always needed to remove whatever is there
// first. The defect this closes: a bare, unconditional os.Remove(path) does that removal without
// ever proving the node it is about to delete is actually a stale socket -- so a misconfiguration
// (or an adversarial path) that points a socket path at some other important file -- a state file,
// a private key, a binary, anything -- would silently delete it.
//
// Classification (Lstat, never dereferencing a symlink target):
//   - path does not exist (Lstat: not-exist error)                         -> ALLOWED, no-op
//   - path exists and its mode has the ModeSocket bit set                  -> ALLOWED, removed
//   - path exists and is a regular file, directory, symlink (of any kind,
//     regardless of what it points to), FIFO, device, or anything else     -> REJECTED, untouched
//
// Fails closed: on a REJECTED classification, this function returns an error and os.Remove is never
// called on that code path at all -- there is no route from "classification says reject" to
// "removal happens anyway". Every call site must propagate a non-nil error return by aborting the
// listen attempt rather than falling through to net.Listen, which would otherwise likely just fail
// on its own with "address already in use" for a non-socket node -- but critically, only AFTER this
// function had already refused to delete anything.
//
// This same check is performed here, at the point of use immediately before net.Listen in
// ServeSocket, in addition to (not instead of) internal/config.Config's own startup-time
// classification of the configured socket paths (see rejectNonSocketNode in
// internal/config/config.go). Performing it twice narrows, but does not eliminate, a
// validate-to-use TOCTOU race: the node at path could still be replaced by an attacker between this
// Lstat and the os.Remove/net.Listen calls that follow it in ServeSocket. Fully eliminating that
// race requires the dedicated OS identity and trusted, non-model-writable directory ownership
// described in docs/development/PUBLICATION_BROKER.md's Human Provisioning Checklist -- which this
// task does not provision. Do not read this function as closing that race; it only shrinks the
// window and, within that window, still refuses to ever delete a non-socket node.
func safeRemoveStaleSocket(path string) error {
	info, err := os.Lstat(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil // nothing to remove; net.Listen will create the socket fresh
		}
		return fmt.Errorf("server: cannot stat socket path %q: %w", path, err)
	}

	if info.Mode()&os.ModeSocket != 0 {
		if err := os.Remove(path); err != nil {
			return fmt.Errorf("server: remove stale socket %q: %w", path, err)
		}
		return nil
	}

	// REJECTED: some node other than a Unix domain socket sits at path. Deliberately do not
	// distinguish further in the error message which kind it is beyond naming the mode -- the
	// action taken (refuse, leave untouched) is identical for a regular file, directory, symlink,
	// FIFO, or device, and no removal is attempted for any of them.
	return fmt.Errorf("server: refusing to remove non-socket node at %q (mode %v); leaving it untouched", path, info.Mode())
}
