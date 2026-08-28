// Package testutil provides shared disposable-git-repository fixtures for this module's test
// suites, mirroring the style of tests/dev/publication-builder.test.mjs: every fixture is built
// under the OS temp directory with real `git`, never touching any repository outside the temp dir.
package testutil

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
)

// Repo is a disposable git repository for tests.
type Repo struct {
	Dir string
	t   *testing.T
}

// NewRepo creates a fresh temp git repository (not bare), with a seed commit on `main`, and
// registers cleanup via t.Cleanup.
func NewRepo(t *testing.T) *Repo {
	t.Helper()
	dir := t.TempDir()
	r := &Repo{Dir: dir, t: t}
	r.git("init", "--initial-branch=main", "-q")
	r.git("config", "user.email", "test@example.com")
	r.git("config", "user.name", "Test")
	// unique seed content so repos never hash-collide across parallel fixtures
	seed := filepath.Join(dir, ".seed")
	os.WriteFile(seed, []byte(dir), 0o600)
	r.git("add", ".seed")
	r.git("commit", "-m", "seed", "-q")
	return r
}

func (r *Repo) git(args ...string) string {
	r.t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = r.Dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		r.t.Fatalf("git %v failed: %v\n%s", args, err, out)
	}
	return string(out)
}

// Head returns the current HEAD commit SHA.
func (r *Repo) Head() string {
	return trimNL(r.git("rev-parse", "HEAD"))
}

// SwitchNewBranch creates and checks out a new branch from the given start point.
func (r *Repo) SwitchNewBranch(name, from string) {
	r.git("switch", "-c", name, from, "-q")
}

// WriteFile writes content at relPath in the working tree (does not stage or commit).
func (r *Repo) WriteFile(relPath, content string) {
	full := filepath.Join(r.Dir, relPath)
	os.MkdirAll(filepath.Dir(full), 0o700)
	if err := os.WriteFile(full, []byte(content), 0o600); err != nil {
		r.t.Fatalf("write file: %v", err)
	}
}

// RemoveFile removes relPath from the working tree.
func (r *Repo) RemoveFile(relPath string) {
	os.Remove(filepath.Join(r.Dir, relPath))
}

// StageAll stages every current working-tree change.
func (r *Repo) StageAll() { r.git("add", "-A") }

// Commit commits currently-staged changes with the given exact message and returns the new SHA.
func (r *Repo) Commit(message string) string {
	r.git("commit", "-m", message, "-q")
	return r.Head()
}

// BlobSHA returns the raw (unfiltered) blob SHA git would compute for relPath's current worktree
// content -- matches the V3.1-A/V3.1-B canonical fingerprint recipe's digest source.
func (r *Repo) BlobSHA(relPath string) string {
	return trimNL(r.git("hash-object", "--no-filters", "--", relPath))
}

// BuildBundle creates a self-contained git bundle carrying exactly refName's full reachable
// history, and returns its raw bytes.
func (r *Repo) BuildBundle(t *testing.T, refName string) []byte {
	t.Helper()
	tmp := filepath.Join(t.TempDir(), "test.bundle")
	r.git("bundle", "create", tmp, refName)
	data, err := os.ReadFile(tmp)
	if err != nil {
		t.Fatalf("read bundle: %v", err)
	}
	return data
}

// bundleRefName mirrors pkgimport.BundleRefName without importing that package here (it would
// create an import cycle for pkgimport's own tests) -- kept as a literal constant, cross-checked by
// TestBundleRefNameMatchesPkgimport in pkgimport's own test package.
const bundleRefName = "refs/heads/mihver-broker-import"

// BuildBundleForImport creates a temporary ref at commitSHA (never touching any existing branch),
// bundles exactly that ref's full reachable history under pkgimport.BundleRefName, deletes the
// temporary ref, and returns the bundle's raw bytes -- the exact shape internal/pkgimport.Import
// expects to fetch from.
func (r *Repo) BuildBundleForImport(t *testing.T, commitSHA string) []byte {
	t.Helper()
	r.git("update-ref", bundleRefName, commitSHA)
	defer r.git("update-ref", "-d", bundleRefName)
	return r.BuildBundle(t, bundleRefName)
}

// PushTo pushes exactly sha to refs/heads/branch at remoteDir directly (plumbing-level, bypassing
// any Broker code entirely) -- used by tests to set up a pre-existing remote state (e.g. "the
// remote task branch already sits at an unauthorized ancestor") before the Broker code under test
// ever runs. Never used to exercise Broker behavior itself.
func (r *Repo) PushTo(remoteDir, sha, branch string) {
	r.git("push", remoteDir, sha+":refs/heads/"+branch)
}

// FetchAndSetRef fetches sha from otherDir into remoteDir (a bare repo) and forcibly retargets
// refs/heads/branch there directly via plumbing -- simulates an external actor moving a remote
// branch to an unrelated commit, independent of and not through any Broker push path.
func FetchAndSetRef(t *testing.T, remoteDir, otherDir, sha, branch string) {
	t.Helper()
	fetch := exec.Command("git", "fetch", otherDir, sha)
	fetch.Dir = remoteDir
	if out, err := fetch.CombinedOutput(); err != nil {
		t.Fatalf("fetch into remote: %v\n%s", err, out)
	}
	updateRef := exec.Command("git", "update-ref", "refs/heads/"+branch, sha)
	updateRef.Dir = remoteDir
	if out, err := updateRef.CombinedOutput(); err != nil {
		t.Fatalf("retarget remote branch: %v\n%s", err, out)
	}
}

// NewBareRemote creates an empty bare repository to act as a fake "remote" for gitremote/server
// tests -- a real, local, network-free git remote reachable by file path.
func NewBareRemote(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	cmd := exec.Command("git", "init", "--bare", "-q", dir)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git init --bare: %v\n%s", err, out)
	}
	return dir
}

func trimNL(s string) string {
	for len(s) > 0 && (s[len(s)-1] == '\n' || s[len(s)-1] == '\r') {
		s = s[:len(s)-1]
	}
	return s
}

// Sha256Hex is a small convenience used by several test files to compute expected digests.
func Sha256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

// GitRunner is the minimal git-execution surface RaceInjectingRunner wraps -- structurally
// identical to internal/gitremote's own unexported gitRunner interface (and to
// internal/gitexec.Sterile's method set), so a *gitexec.Sterile value or a gitremote.Client's real
// runner can be assigned here without either package needing to import the other's test helpers.
type GitRunner interface {
	Run(ctx context.Context, repoDir string, args ...string) (string, error)
	RunWithEnv(ctx context.Context, repoDir string, extraEnv []string, args ...string) (string, error)
}

// RaceInjectingRunner wraps a real GitRunner and, immediately before the FIRST invocation whose
// argv contains the literal token "push", synchronously calls Mutate() before delegating to the
// real runner -- deterministically placing a caller-controlled mutation at the exact boundary
// between gitremote.Client.Push's internal pre-push remote-head check (an `ls-remote` call, which
// never matches "push") and the actual `git push` subprocess it is about to issue. Every other
// command is delegated unchanged, and the real `git push` still always actually executes
// afterward -- this never fakes a result, and Mutate is entirely test-controlled, never reachable
// from untrusted request data or production code.
type RaceInjectingRunner struct {
	Real   GitRunner
	Mutate func()

	mu        sync.Mutex
	triggered bool
}

func (r *RaceInjectingRunner) Run(ctx context.Context, repoDir string, args ...string) (string, error) {
	r.maybeTrigger(args)
	return r.Real.Run(ctx, repoDir, args...)
}

func (r *RaceInjectingRunner) RunWithEnv(ctx context.Context, repoDir string, extraEnv []string, args ...string) (string, error) {
	r.maybeTrigger(args)
	return r.Real.RunWithEnv(ctx, repoDir, extraEnv, args...)
}

func (r *RaceInjectingRunner) maybeTrigger(args []string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.triggered {
		return
	}
	for _, a := range args {
		if a == "push" {
			r.triggered = true
			r.Mutate()
			return
		}
	}
}

// CapturingRunner wraps a real GitRunner and records every argv this Client issues through it, so
// tests can inspect the exact command shape (e.g. proving the push argv contains exactly one
// specific --force-with-lease value and none of the categorically forbidden flags).
type CapturingRunner struct {
	Real GitRunner

	mu   sync.Mutex
	Argv [][]string
}

func (r *CapturingRunner) Run(ctx context.Context, repoDir string, args ...string) (string, error) {
	r.record(args)
	return r.Real.Run(ctx, repoDir, args...)
}

func (r *CapturingRunner) RunWithEnv(ctx context.Context, repoDir string, extraEnv []string, args ...string) (string, error) {
	r.record(args)
	return r.Real.RunWithEnv(ctx, repoDir, extraEnv, args...)
}

func (r *CapturingRunner) record(args []string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := append([]string(nil), args...)
	r.Argv = append(r.Argv, cp)
}

// FaultInjectingRunner wraps a real GitRunner and, for the FIRST invocation whose argv contains the
// literal token "push", still delegates to the real runner -- so the actual git command genuinely
// executes and has its real effect on the remote -- but then discards a real success and returns
// FaultErr instead, simulating a client-visible failure reported AFTER the server-side operation
// already succeeded (e.g. a dropped connection after the remote accepted the push). If the real
// command itself failed, that real error is returned unmodified -- FaultErr only ever replaces a
// real success, it never masks a real failure. Every other command, and every subsequent "push"
// invocation, passes through with its real, unmodified result.
type FaultInjectingRunner struct {
	Real     GitRunner
	FaultErr error

	mu        sync.Mutex
	triggered bool
}

func (r *FaultInjectingRunner) Run(ctx context.Context, repoDir string, args ...string) (string, error) {
	return r.maybeFault(args, func() (string, error) { return r.Real.Run(ctx, repoDir, args...) })
}

func (r *FaultInjectingRunner) RunWithEnv(ctx context.Context, repoDir string, extraEnv []string, args ...string) (string, error) {
	return r.maybeFault(args, func() (string, error) { return r.Real.RunWithEnv(ctx, repoDir, extraEnv, args...) })
}

func (r *FaultInjectingRunner) maybeFault(args []string, call func() (string, error)) (string, error) {
	isPush := false
	for _, a := range args {
		if a == "push" {
			isPush = true
			break
		}
	}
	if !isPush {
		return call()
	}
	r.mu.Lock()
	already := r.triggered
	r.triggered = true
	r.mu.Unlock()
	out, err := call()
	if already || err != nil {
		return out, err
	}
	return "", r.FaultErr
}
