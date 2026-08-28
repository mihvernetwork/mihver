// Package gitremote implements the Broker's only path to a real Git remote: branch-safety-checked,
// non-force, expected-head-verified pushes (V3.1-B Section 12), with the GitHub token kept
// completely out of argv, the remote URL, and any log or persisted config (Section 11). It never
// executes anything from the untrusted package content, and it never trusts a package-supplied
// remote URL -- BuildGitHubRemoteURL constructs the remote identity itself from validated
// owner/repository fields only.
package gitremote

import (
	"context"
	"fmt"
	"os"
	"regexp"

	"mihver.network/publication-broker/internal/gitexec"
	"mihver.network/publication-broker/internal/repoidentity"
)

// askpassScript is a fixed, static, secret-free script: it reads the token from an environment
// variable this package sets per-invocation (never from argv, never from a file, never from the
// script's own content) and prints it to stdout, which is exactly the GIT_ASKPASS contract. The
// script content itself never changes and is written fresh to a broker-owned scratch file for each
// push so it can never be replaced by anything the untrusted package controls.
const askpassScript = "#!/bin/sh\nprintf '%s' \"$MIHVER_BROKER_GIT_ASKPASS_TOKEN\"\n"

const tokenEnvVar = "MIHVER_BROKER_GIT_ASKPASS_TOKEN"

var validBranchName = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9._/-]*[A-Za-z0-9])?$`)

// ValidateTargetBranch categorically rejects every branch V3.1-B Section 12 forbids: main, master,
// the Envelope's own base_branch, anything shaped like a ref path other than a plain branch name,
// anything containing ".." (ref-path escape) or starting with "-" (argument-injection guard against
// a branch name being interpreted as a flag by git), and anything empty or containing whitespace.
func ValidateTargetBranch(branch, baseBranch string) error {
	if branch == "" {
		return fmt.Errorf("gitremote: branch must be non-empty")
	}
	if branch == "main" || branch == "master" {
		return fmt.Errorf("gitremote: refusing to publish to protected branch %q", branch)
	}
	if branch == baseBranch {
		return fmt.Errorf("gitremote: branch must not equal base_branch (%q)", baseBranch)
	}
	if branch[0] == '-' {
		return fmt.Errorf("gitremote: branch must not start with '-'")
	}
	if !validBranchName.MatchString(branch) {
		return fmt.Errorf("gitremote: branch %q is not a valid plain branch name", branch)
	}
	for i := 0; i+1 < len(branch); i++ {
		if branch[i] == '.' && branch[i+1] == '.' {
			return fmt.Errorf("gitremote: branch must not contain '..'")
		}
	}
	if len(branch) >= 5 && branch[:5] == "refs/" {
		return fmt.Errorf("gitremote: branch must be a plain name, not a ref path")
	}
	return nil
}

// BuildGitHubRemoteURL constructs the exact HTTPS remote URL from owner/repo fields, embedding the
// FIXED, non-secret username "x-access-token" (GitHub's own documented convention for GitHub App
// installation tokens) -- never a package-supplied remote URL, and never the token itself, which is
// supplied only via the askpass environment handoff in Push.
//
// owner and repo are re-validated HERE via repoidentity.Validate, as defense in depth -- this
// function never trusts that a caller already validated them (e.g. via internal/protocol's Envelope
// validation), because a caller mistake or a future code path that constructs a Repository value
// some other way must not be able to reach a usable remote URL with an unvalidated identity. On
// validation failure this function returns ("", err) -- an empty string, never a partially-built or
// best-effort URL -- with err checkable via errors.Is against repoidentity.ErrInvalidOwner /
// repoidentity.ErrInvalidRepositoryName. The resulting URL's path is always exactly
// "/<owner>/<repo>.git" (two path segments): repoidentity's character-class rules categorically
// exclude '/', so owner/repo can never inject an additional path segment or escape the intended
// GitHub host's path space. A caller that correctly propagates this error can never proceed to
// push, ls-remote, or otherwise perform any git remote operation using a malformed target -- this
// function performs no I/O and constructing its return value is the only thing that can happen
// before that error is (or is not) returned.
func BuildGitHubRemoteURL(host string, owner, repo string) (string, error) {
	id, err := repoidentity.Validate(owner, repo)
	if err != nil {
		return "", fmt.Errorf("gitremote: %w", err)
	}
	return fmt.Sprintf("https://x-access-token@%s/%s/%s.git", host, id.Owner, id.Name), nil
}

// gitRunner is the minimal git-execution surface Client needs. It exists as an interface (rather
// than Client embedding gitexec.Sterile directly) for exactly one reason: it lets tests inject a
// synchronized race-seam wrapper around the real sterile runner, so a deterministic adversarial test
// can mutate a disposable local bare remote at the exact boundary between Push's internal
// pre-check and the real `git push` subprocess -- see internal/testutil's RaceInjectingRunner
// (shared across this package's and internal/server's tests). Production code always constructs
// Client with a plain gitexec.Sterile value (which satisfies this interface unmodified); nothing
// here is reachable from untrusted request data, and there is no production callback of any kind.
type gitRunner interface {
	Run(ctx context.Context, repoDir string, args ...string) (string, error)
	RunWithEnv(ctx context.Context, repoDir string, extraEnv []string, args ...string) (string, error)
}

var _ gitRunner = gitexec.Sterile{}

// Client pushes to exactly one authorized branch, under a sterile environment. It uses no
// unconditional force of any kind -- see Push's own doc comment for the one narrow, exact-OID
// compare-and-swap exception this package implements.
type Client struct {
	Sterile gitRunner
}

// ErrRemoteHeadChanged is returned when the remote branch's head, observed immediately before
// pushing, does not match the caller's expected prior head -- including the "branch does not exist
// yet" case (expectedHead == ""). This is the exact race V3.1-B Section 12 requires: never resolved
// by force, only ever reported so the caller can BLOCK / REMOTE_HEAD_CHANGED.
var ErrRemoteHeadChanged = fmt.Errorf("gitremote: remote head changed since it was last observed")

// RemoteHead returns the current SHA of refs/heads/branch at remoteURL, or "" if the branch does
// not exist there yet.
func (c Client) RemoteHead(ctx context.Context, repoDir, remoteURL, branch string, token string) (string, error) {
	extraEnv, cleanup, err := c.askpassEnv(token)
	if err != nil {
		return "", err
	}
	defer cleanup()
	out, err := c.Sterile.RunWithEnv(ctx, repoDir, extraEnv,
		"-c", "credential.helper=", "-c", "core.hooksPath=/dev/null",
		"ls-remote", remoteURL, "refs/heads/"+branch)
	if err != nil {
		return "", fmt.Errorf("gitremote: ls-remote: %w", err)
	}
	if out == "" {
		return "", nil
	}
	fields := splitFields(out)
	if len(fields) < 1 {
		return "", fmt.Errorf("gitremote: unparseable ls-remote output: %q", out)
	}
	return fields[0], nil
}

// Push pushes exactly commitSHA to refs/heads/branch at remoteURL as an ATOMIC compare-and-swap
// against expectedHead (empty meaning "branch must not yet exist"), using one exact, explicit
// --force-with-lease=<refname>:<expect> argument -- never a bare --force, -f, +refspec, an implicit
// (value-less) --force-with-lease, a wildcard, or a lease on any ref other than exactly
// refs/heads/<branch>. This is a narrow, explicit exception to "never force" (V3.1-B Hardening R1.1):
// an ordinary non-force push is only fast-forward-safe, which is NOT atomicity -- a plain `git push`
// still separately (a) reads the remote's current value in this function's own pre-check, then
// (b) issues the push subprocess, and a remote mutation landing in the gap between those two steps
// (e.g. an actor rewinding the branch to an older ancestor of commitSHA) would let an ordinary
// fast-forward push still succeed, publishing a transition the Envelope never authorized. The lease
// closes exactly that gap: the server-side compare-and-swap it requests is atomic with the update
// itself, not merely checked beforehand by this client process. The lease is never a general
// history-rewrite primitive -- it can only ever succeed when the remote's current value already
// equals the exact expectedHead this call was given, i.e. exactly the same authorization this
// function already required before Hardening R1.1; it does not authorize anything a non-force push
// wouldn't also have authorized, it only makes that authorization's enforcement atomic.
func (c Client) Push(ctx context.Context, repoDir, remoteURL, branch, commitSHA, expectedHead, token string) (remoteHeadAfter string, err error) {
	if err := ValidateBranchIsPlainRef(branch); err != nil {
		return "", err
	}

	current, err := c.RemoteHead(ctx, repoDir, remoteURL, branch, token)
	if err != nil {
		return "", err
	}
	if current != expectedHead {
		return "", ErrRemoteHeadChanged
	}

	extraEnv, cleanup, err := c.askpassEnv(token)
	if err != nil {
		return "", err
	}
	defer cleanup()

	// The exact, explicit, single lease this function ever constructs: bound to exactly
	// refs/heads/<branch> and exactly expectedHead (which may be the empty string, meaning the ref
	// must not exist) -- never a bare --force, never an implicit/value-less --force-with-lease,
	// never a lease derived from a remote-tracking ref, never a wildcard, never more than one lease
	// argument.
	lease := "--force-with-lease=refs/heads/" + branch + ":" + expectedHead
	// The refspec itself remains non-prefixed (no leading '+') -- the lease, not a '+' prefix, is
	// what authorizes a non-fast-forward-shaped update; a '+' prefix would additionally bypass git's
	// own client-side fast-forward advisory entirely, which this module never wants.
	refspec := commitSHA + ":refs/heads/" + branch
	if _, err := c.Sterile.RunWithEnv(ctx, repoDir, extraEnv,
		"-c", "credential.helper=", "-c", "core.hooksPath=/dev/null",
		"push", "--porcelain", lease, remoteURL, refspec); err != nil {
		// Classify without trusting stderr text (never localized/human-oriented parsing): re-observe
		// the remote fresh.
		after, obsErr := c.RemoteHead(ctx, repoDir, remoteURL, branch, token)
		switch {
		case obsErr == nil && after == commitSHA:
			// The update actually landed server-side despite the client reporting an error (e.g. a
			// connection drop after the atomic server-side compare-and-swap already applied, or any
			// other post-acceptance client-visible failure) -- this is a genuine success, not a race
			// and not a generic failure. Reporting it as either would be worse than silently
			// swallowing the client-side error: ErrRemoteHeadChanged would incorrectly and
			// permanently BLOCK a grant whose authorized commit was actually published, and a
			// generic failure would make an already-successful push look retryable.
			return after, nil
		case obsErr == nil && after != expectedHead:
			// The remote no longer equals what this call required -- the lease was rejected because
			// the remote genuinely changed, exactly the race this mechanism exists to close.
			return "", ErrRemoteHeadChanged
		default:
			// The remote still (surprisingly) matches expectedHead, or cannot be read at all: some
			// other push failure. Fail closed as a generic push error rather than guessing at a race
			// the fresh observation did not actually confirm.
			return "", fmt.Errorf("gitremote: push failed (lease rejected or remote error): %w", err)
		}
	}

	after, err := c.RemoteHead(ctx, repoDir, remoteURL, branch, token)
	if err != nil {
		return "", err
	}
	if after != commitSHA {
		return "", fmt.Errorf("gitremote: post-push remote head %q does not equal pushed commit %q", after, commitSHA)
	}
	return after, nil
}

// ValidateBranchIsPlainRef re-validates immediately before any git invocation that embeds branch in
// a refspec -- defense in depth even though callers are expected to have already called
// ValidateTargetBranch once during request validation.
func ValidateBranchIsPlainRef(branch string) error {
	if !validBranchName.MatchString(branch) || branch == "" || branch[0] == '-' {
		return fmt.Errorf("gitremote: refusing to embed invalid branch name %q in a refspec", branch)
	}
	return nil
}

// askpassEnv writes a fresh, static, secret-free askpass script to a broker-owned scratch file and
// returns the environment overrides (GIT_ASKPASS pointing at it, and the token itself passed only
// via a process environment variable the script reads) plus a cleanup function. The token is never
// written to the script file, never placed in argv, and never appears in the constructed remote URL.
func (c Client) askpassEnv(token string) (extraEnv []string, cleanup func(), err error) {
	f, err := os.CreateTemp("", "mihver-broker-askpass-")
	if err != nil {
		return nil, nil, fmt.Errorf("gitremote: create askpass scratch file: %w", err)
	}
	path := f.Name()
	if _, err := f.WriteString(askpassScript); err != nil {
		f.Close()
		os.Remove(path)
		return nil, nil, fmt.Errorf("gitremote: write askpass script: %w", err)
	}
	f.Close()
	if err := os.Chmod(path, 0o700); err != nil {
		os.Remove(path)
		return nil, nil, fmt.Errorf("gitremote: chmod askpass script: %w", err)
	}
	cleanup = func() { os.Remove(path) }
	extraEnv = []string{
		"GIT_ASKPASS=" + path,
		tokenEnvVar + "=" + token,
	}
	return extraEnv, cleanup, nil
}

func splitFields(s string) []string {
	var fields []string
	start := -1
	for i := 0; i < len(s); i++ {
		if s[i] == '\t' || s[i] == ' ' || s[i] == '\n' {
			if start != -1 {
				fields = append(fields, s[start:i])
				start = -1
			}
			continue
		}
		if start == -1 {
			start = i
		}
	}
	if start != -1 {
		fields = append(fields, s[start:])
	}
	return fields
}
