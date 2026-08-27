// Package gitexec runs `git` with an explicit, sterile environment shared by every Broker package
// that touches Git (pkgimport, verifier, gitremote). It exists so no caller ever inherits the
// development user's HOME, credential helpers, hooks, fsmonitor, aliases, or environment variables --
// per V3.1-B's core invariant, the Broker never trusts user Git configuration as its own authority.
//
// Every invocation uses exec.Command with an explicit argv -- never a shell string -- and every
// invocation explicitly disables hooks, fsmonitor, and any inherited credential helper.
package gitexec

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// Sterile describes the one broker-owned working environment a git invocation is allowed to see:
// an explicit HOME (never the development user's), an explicit working directory, and nothing else
// inherited from the calling process's environment.
type Sterile struct {
	// GitBinary is the explicit, non-model-writable path to the git executable. Production
	// configuration fixes this; tests may point it at whatever `git` is on PATH via exec.LookPath.
	GitBinary string
	// Home is a broker-owned, empty scratch directory used as HOME/XDG config roots for this
	// invocation, so no user-level ~/.gitconfig, credential helper, or alias is ever consulted.
	Home string
}

// Run executes `git <args...>` inside repoDir under the sterile environment, returning combined
// stdout (trimmed) or an error embedding stderr. No shell is ever invoked; args are passed exactly
// as given via argv, never concatenated into a command string.
func (s Sterile) Run(ctx context.Context, repoDir string, args ...string) (string, error) {
	if s.GitBinary == "" {
		return "", fmt.Errorf("gitexec: GitBinary is required")
	}
	cmd := exec.CommandContext(ctx, s.GitBinary, args...)
	cmd.Dir = repoDir
	cmd.Env = s.env()
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git %v: %w: %s", args, err, stderr.String())
	}
	return trimTrailingNewline(stdout.String()), nil
}

// RunWithEnv is Run plus additional explicit environment variables that OVERRIDE the sterile base
// (e.g. a one-shot GIT_ASKPASS token handoff variable for gitremote's push). Extra entries must be
// exact "KEY=VALUE" strings the caller controls -- never derived from untrusted package content.
// Overrides are merged key-by-key (last write wins), never naively appended, so a duplicate key
// never reaches the child process's envp -- which environment implementations resolve
// inconsistently (commonly first-match) and would otherwise silently keep the sterile default
// instead of the caller's intended override.
func (s Sterile) RunWithEnv(ctx context.Context, repoDir string, extraEnv []string, args ...string) (string, error) {
	if s.GitBinary == "" {
		return "", fmt.Errorf("gitexec: GitBinary is required")
	}
	cmd := exec.CommandContext(ctx, s.GitBinary, args...)
	cmd.Dir = repoDir
	cmd.Env = mergeEnv(s.env(), extraEnv)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git %v: %w: %s", args, err, stderr.String())
	}
	return trimTrailingNewline(stdout.String()), nil
}

// mergeEnv merges base and overrides into a single envp slice, keyed by the part of each entry
// before its first '=', with overrides replacing any base entry sharing the same key.
func mergeEnv(base, overrides []string) []string {
	byKey := make(map[string]string, len(base)+len(overrides))
	order := make([]string, 0, len(base)+len(overrides))
	set := func(entry string) {
		key := entry
		if idx := strings.IndexByte(entry, '='); idx >= 0 {
			key = entry[:idx]
		}
		if _, exists := byKey[key]; !exists {
			order = append(order, key)
		}
		byKey[key] = entry
	}
	for _, e := range base {
		set(e)
	}
	for _, e := range overrides {
		set(e)
	}
	out := make([]string, 0, len(order))
	for _, k := range order {
		out = append(out, byKey[k])
	}
	return out
}

// env constructs the complete, minimal environment for a sterile git invocation -- explicitly NOT
// os.Environ(), so nothing from the calling process (an inherited credential helper, a user
// GIT_* override, a hijacked PATH) ever reaches the child process.
func (s Sterile) env() []string {
	return []string{
		"HOME=" + s.Home,
		"GIT_CONFIG_NOSYSTEM=1",
		"GIT_TERMINAL_PROMPT=0",
		"GIT_ASKPASS=",
		"GIT_SSH_COMMAND=false", // no SSH transport is ever used or authorized
		"PATH=/usr/bin:/bin",    // fixed, minimal, non-model-writable search path
		// core.hooksPath/core.fsmonitor are additionally forced via -c on every call site that
		// opens/creates a repo (see pkgimport, gitremote) as defense in depth beyond env alone.
	}
}

func trimTrailingNewline(s string) string {
	for len(s) > 0 && (s[len(s)-1] == '\n' || s[len(s)-1] == '\r') {
		s = s[:len(s)-1]
	}
	return s
}

// NewScratchHome creates a fresh, empty, broker-owned temp directory to use as Sterile.Home for one
// operation, and returns a cleanup function. Never the development user's real $HOME.
func NewScratchHome(prefix string) (dir string, cleanup func(), err error) {
	dir, err = os.MkdirTemp("", prefix)
	if err != nil {
		return "", nil, err
	}
	return dir, func() { os.RemoveAll(dir) }, nil
}
