// Package config defines the Broker's runtime configuration and its fail-closed production
// validation (V3.1-B Section 18). Test mode injects fake HTTP/Git endpoints through dependency
// injection in the caller's own Go code -- never through this package's production configuration
// surface, which recognizes exactly two modes and refuses to blur them.
package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Mode is either Production (the only mode that may ever mint a real GitHub token or push to a
// real remote) or Test (used exclusively by this module's own test suite, with fake endpoints
// injected in Go code, never read from this config).
type Mode string

const (
	ModeProduction Mode = "production"
	ModeTest       Mode = "test"
)

// FixedGitHubAPIHost and FixedGitHubHost are the only hosts Production configuration may ever name.
// Not configurable in production -- an arbitrary API/Git host is exactly the kind of misdirection
// this fail-closed model exists to reject.
const (
	FixedGitHubAPIHost = "api.github.com"
	FixedGitHubHost    = "github.com"
)

var appIDPattern = regexp.MustCompile(`^[0-9]+$`)

// Config is the Broker's full runtime configuration.
type Config struct {
	Mode Mode

	// PrivateKeyPath is the GitHub App private key location. In production it must be an absolute,
	// non-symlinked path outside both the repository and the development user's home, readable
	// only by the Broker's own OS identity (checked as best-effort via file mode; the OS identity
	// boundary itself requires the production deployment described in
	// docs/development/PUBLICATION_BROKER.md, which this task does not provision).
	PrivateKeyPath string

	// RepositoryModelWritableRoot and DevelopmentUserHome are the two paths PrivateKeyPath must
	// never be inside, in production. Supplied explicitly rather than guessed, so validation never
	// has to infer "the repository" or "the user's home" from ambient process state.
	RepositoryModelWritableRoot string
	DevelopmentUserHome         string

	AppID          string
	InstallationID string

	GitHubAPIHost string
	GitRemoteHost string

	// BrokerBinaryPath is REQUIRED in production (not optional/skippable-when-empty as in prior
	// rounds): it must be non-empty, absolute, existing, a regular non-symlinked executable file,
	// not group/world-writable, and outside both trust roots -- the same battery already applied to
	// GitBinaryPath (see validateExecutablePath). An operator (or a failed os.Executable() call in
	// cmd/mihver-broker) that ends up with an empty value here must get a hard validation failure,
	// never a silently-skipped check. BrokerConfigPath remains optional; when configured it is
	// checked for group/world-writability and included in the runtime-path pairwise disjointness
	// check below.
	BrokerBinaryPath string
	BrokerConfigPath string

	// GrantStorePath and AuditLogPath are the Broker-owned durable state files. In production both
	// must be absolute and their real (symlink-resolved) parent directory must sit outside both
	// RepositoryModelWritableRoot and DevelopmentUserHome -- a model-writable-side actor with write
	// access to either trust root must never be able to redirect the Broker's own authorization or
	// audit state into a location it can forge or corrupt.
	GrantStorePath string
	AuditLogPath   string

	// ClientSocketPath and AdminSocketPath are the two Unix sockets the Broker listens on. In
	// production both must be absolute, distinct from each other, and their real parent directory
	// must sit outside both trust roots.
	ClientSocketPath string
	AdminSocketPath  string

	// GitBinaryPath is the explicit, non-model-writable git executable the Broker invokes. In
	// production it must exist, be a regular (non-symlink) executable file outside both trust roots,
	// and must not be group/world-writable.
	GitBinaryPath string
}

// Validate applies every fail-closed rule Section 18 requires. Test mode skips the
// production-only host/path rules entirely (by design -- see the package doc comment) but still
// requires the App/installation identifiers to be well-formed when set, since malformed identifiers
// are a correctness bug in any mode.
func (c Config) Validate() error {
	if c.Mode != ModeProduction && c.Mode != ModeTest {
		return fmt.Errorf("config: mode must be %q or %q", ModeProduction, ModeTest)
	}
	if c.AppID != "" && !appIDPattern.MatchString(c.AppID) {
		return fmt.Errorf("config: malformed app id %q", c.AppID)
	}
	if c.InstallationID != "" && !appIDPattern.MatchString(c.InstallationID) {
		return fmt.Errorf("config: malformed installation id %q", c.InstallationID)
	}

	if c.Mode == ModeTest {
		return nil
	}

	return c.validateProduction()
}

func (c Config) validateProduction() error {
	if c.GitHubAPIHost != FixedGitHubAPIHost {
		return fmt.Errorf("config: production GitHub API host must be %q, got %q", FixedGitHubAPIHost, c.GitHubAPIHost)
	}
	if c.GitRemoteHost != FixedGitHubHost {
		return fmt.Errorf("config: production Git remote host must be %q, got %q", FixedGitHubHost, c.GitRemoteHost)
	}

	// Canonical trust roots (Closeout Pack A.2, Work Package A) are resolved EXACTLY ONCE here,
	// before any protected-path validation below runs and before any protected resource (private
	// key, grant store, audit log, socket, executable) is ever opened. See validateTrustRoot's doc
	// comment for why "non-empty" alone was not enough.
	roots, err := resolveTrustRoots(c.RepositoryModelWritableRoot, c.DevelopmentUserHome)
	if err != nil {
		return err
	}

	if err := validatePrivateKeyPath(c.PrivateKeyPath, roots); err != nil {
		return err
	}

	if c.AppID == "" {
		return fmt.Errorf("config: production requires app id")
	}
	if c.InstallationID == "" {
		return fmt.Errorf("config: production requires installation id")
	}

	if err := validateBrokerBinaryPath(c.BrokerBinaryPath, roots); err != nil {
		return err
	}
	if err := rejectWritableByOthers(c.BrokerConfigPath, "broker config"); err != nil {
		return err
	}

	if err := validateStoreFilePath(c.GrantStorePath, "grant store", roots); err != nil {
		return err
	}
	if err := validateStoreFilePath(c.AuditLogPath, "audit log", roots); err != nil {
		return err
	}
	// The DERIVED grant-store persistence temp path (GrantStorePath + ".tmp", exactly what
	// internal/grant.Store.persistLocked writes to and then renames over the grant store) is its own
	// protected runtime location -- see validateGrantTempPathNode's doc comment and
	// validateRuntimePathDisjointness below, which folds it into the same pairwise comparison every
	// other protected path already goes through.
	if err := validateGrantTempPathNode(grantTempPath(c.GrantStorePath)); err != nil {
		return err
	}

	if c.ClientSocketPath == c.AdminSocketPath {
		return fmt.Errorf("config: client socket path and admin socket path must not be equal, got %q", c.ClientSocketPath)
	}
	if err := validateSocketPath(c.ClientSocketPath, "client socket", roots); err != nil {
		return err
	}
	if err := validateSocketPath(c.AdminSocketPath, "admin socket", roots); err != nil {
		return err
	}

	if err := validateGitBinaryPath(c.GitBinaryPath, roots); err != nil {
		return err
	}

	// Runs LAST, after every individual per-field check above has already confirmed each path is
	// absolute, resolvable, and (where applicable) an existing file of the expected kind -- pairwise
	// disjointness assumes that groundwork already holds and only adds the cross-field comparison on
	// top of it.
	if err := validateRuntimePathDisjointness(c); err != nil {
		return err
	}

	return nil
}

// trustRoots holds the two canonical trust roots (Closeout Pack A.2, Work Package A), resolved
// EXACTLY ONCE per Config.Validate call via resolveTrustRoots and then reused by every
// protected-path check below -- never re-derived, and never re-resolved from the raw,
// caller-supplied strings after that single point. raw* is kept only for error messages (so a
// human reading a failure sees the path they actually configured); every containment comparison
// uses real* exclusively.
type trustRoots struct {
	rawRepoRoot  string
	realRepoRoot string
	rawDevHome   string
	realDevHome  string
}

// validateTrustRoot validates RepositoryModelWritableRoot/DevelopmentUserHome THEMSELVES, before
// they are ever used to check a protected path's containment. Non-empty alone is not enough: a
// RELATIVE root remains relative after filepath.EvalSymlinks (EvalSymlinks preserves the
// relative/absolute-ness of its input), and comparing a relative root to an absolute protected path
// via filepath.Rel then fails -- which isInside used to silently treat as "not inside", accepting a
// protected path that is genuinely inside the repository/home merely because its trust root
// was supplied relatively. Every trust root must therefore be: non-empty; absolute; resolvable
// (filepath.EvalSymlinks, which itself requires the path to exist); and, once resolved, an existing
// directory -- a missing root, a regular file, a FIFO, a device, or any other non-directory node
// fails closed here, before any protected-path check ever runs.
func validateTrustRoot(path, label string) (string, error) {
	if path == "" {
		return "", fmt.Errorf("config: production requires a non-empty %s", label)
	}
	if !filepath.IsAbs(path) {
		return "", fmt.Errorf("config: %s must be an absolute path, got %q", label, path)
	}
	real, err := filepath.EvalSymlinks(path)
	if err != nil {
		return "", fmt.Errorf("config: cannot resolve %s %q: %w", label, path, err)
	}
	info, err := os.Stat(real)
	if err != nil {
		return "", fmt.Errorf("config: %s missing or unreadable: %w", label, err)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("config: %s must be a directory, got %q (mode %v)", label, path, info.Mode())
	}
	return real, nil
}

// resolveTrustRoots validates and canonicalizes both trust roots together, once, via
// validateTrustRoot. Called exactly once per Config.Validate (from validateProduction), before any
// protected-path validation and before any protected resource is opened.
func resolveTrustRoots(repoRoot, devHome string) (trustRoots, error) {
	realRepoRoot, err := validateTrustRoot(repoRoot, "repository model-writable root")
	if err != nil {
		return trustRoots{}, err
	}
	realDevHome, err := validateTrustRoot(devHome, "development user home")
	if err != nil {
		return trustRoots{}, err
	}
	return trustRoots{rawRepoRoot: repoRoot, realRepoRoot: realRepoRoot, rawDevHome: devHome, realDevHome: realDevHome}, nil
}

// checkContainment fails closed if realPath aliases into either trust root, and ALSO fails closed if
// the containment comparison itself errors -- isInside's own doc comment explains why a
// filepath.Rel failure must never be silently treated as "outside."
func checkContainment(realPath, label string, roots trustRoots) error {
	insideRepo, err := isInside(realPath, roots.realRepoRoot)
	if err != nil {
		return fmt.Errorf("config: cannot verify %s is outside the model-writable repository: %w", label, err)
	}
	if insideRepo {
		return fmt.Errorf("config: %s must not be inside the model-writable repository (%s), even through a symlinked ancestor directory", label, roots.rawRepoRoot)
	}
	insideHome, err := isInside(realPath, roots.realDevHome)
	if err != nil {
		return fmt.Errorf("config: cannot verify %s is outside the development user's home: %w", label, err)
	}
	if insideHome {
		return fmt.Errorf("config: %s must not be inside the development user's home (%s), even through a symlinked ancestor directory", label, roots.rawDevHome)
	}
	return nil
}

// validatePrivateKeyPath fails closed on both an inadequately-specified boundary AND a path that
// evades it. roots is already fully validated (non-empty, absolute, existing, canonicalized
// directories) by the time this runs -- see resolveTrustRoots, called once from validateProduction
// before this function is ever reached. Containment is checked against the SYMLINK-RESOLVED real
// path of the key's parent directory, not the path as given -- a key placed at a path that is
// textually outside the trust roots but reachable through a symlinked ancestor directory must still
// be rejected.
func validatePrivateKeyPath(path string, roots trustRoots) error {
	if path == "" {
		return fmt.Errorf("config: production requires a private key path")
	}
	if !filepath.IsAbs(path) {
		return fmt.Errorf("config: private key path must be absolute, got %q", path)
	}

	info, err := os.Lstat(path)
	if err != nil {
		return fmt.Errorf("config: private key missing or unreadable: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("config: private key path must not be a symlink")
	}
	// Closeout Pack A.2.1, Work Package B: the pre-fix battery here checked only "not a symlink" and
	// the permission bits -- a FIFO, Unix socket, directory, or device node created with mode 0600
	// (satisfying the permission check below) would have passed. os.Lstat never opens/blocks on any
	// of these; this classification is metadata-only and therefore safe to run before anything ever
	// attempts to read the key's content.
	if !info.Mode().IsRegular() {
		return fmt.Errorf("config: private key path must be a regular file, got mode %v", info.Mode())
	}
	if info.Mode().Perm()&0o077 != 0 {
		return fmt.Errorf("config: private key must not be group/world-readable-or-writable (mode %v)", info.Mode().Perm())
	}

	realParent, err := filepath.EvalSymlinks(filepath.Dir(path))
	if err != nil {
		return fmt.Errorf("config: cannot resolve private key parent directory: %w", err)
	}
	realKeyPath := filepath.Join(realParent, filepath.Base(path))

	return checkContainment(realKeyPath, "private key path", roots)
}

// validateStoreFilePath validates a Broker-owned durable state file path (grant store, audit log)
// in production: must be non-empty and absolute; its real (symlink-resolved) parent directory must
// sit outside both trust roots; if the file already exists it must not itself be a symlink and must
// not be group/world-writable -- mirroring validatePrivateKeyPath's combined Lstat-based technique.
func validateStoreFilePath(path, label string, roots trustRoots) error {
	if path == "" {
		return fmt.Errorf("config: production requires a %s path", label)
	}
	if !filepath.IsAbs(path) {
		return fmt.Errorf("config: %s path must be absolute, got %q", label, path)
	}
	if err := validateTrustedParentDir(path, label); err != nil {
		return err
	}

	realParent, err := filepath.EvalSymlinks(filepath.Dir(path))
	if err != nil {
		return fmt.Errorf("config: cannot resolve %s parent directory: %w", label, err)
	}
	realPath := filepath.Join(realParent, filepath.Base(path))

	if err := checkContainment(realPath, label+" path", roots); err != nil {
		return err
	}

	if info, err := os.Lstat(path); err == nil {
		if info.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("config: %s path must not be a symlink", label)
		}
		// Closeout Pack A.2.1, Work Package B: absence is fine (the Broker may create a new regular
		// file here) but an EXISTING node must be a regular file -- a FIFO, Unix socket, directory, or
		// device node with safe permission bits would otherwise have passed the permission check
		// below undetected. Lstat is metadata-only and never blocks on any of these node types.
		if !info.Mode().IsRegular() {
			return fmt.Errorf("config: %s path must be a regular file, got mode %v", label, info.Mode())
		}
		if info.Mode().Perm()&0o022 != 0 {
			return fmt.Errorf("config: %s must not be group/world-writable (mode %v)", label, info.Mode().Perm())
		}
	}
	return nil
}

// validateSocketPath validates a Unix socket path (client/admin) in production: must be non-empty
// and absolute, and its real parent directory must sit outside both trust roots. The socket special
// file itself is created at listen time, so -- unlike validateStoreFilePath -- there is no existing
// file to Lstat here.
func validateSocketPath(path, label string, roots trustRoots) error {
	if path == "" {
		return fmt.Errorf("config: production requires a %s path", label)
	}
	if !filepath.IsAbs(path) {
		return fmt.Errorf("config: %s path must be absolute, got %q", label, path)
	}
	if err := validateTrustedParentDir(path, label); err != nil {
		return err
	}

	realParent, err := filepath.EvalSymlinks(filepath.Dir(path))
	if err != nil {
		return fmt.Errorf("config: cannot resolve %s parent directory: %w", label, err)
	}
	realPath := filepath.Join(realParent, filepath.Base(path))

	if err := checkContainment(realPath, label+" path", roots); err != nil {
		return err
	}

	// Unlike validateStoreFilePath, an existing node at a socket path is the NORMAL case at startup
	// (a stale socket left behind by an unclean prior shutdown) -- so an existing Unix domain socket
	// is accepted here, not rejected. Anything else already sitting at the path (regular file,
	// directory, symlink, FIFO, device) is rejected at config-validation time, well before the
	// process ever gets near removing anything; the actual removal-before-listen decision is made
	// again, independently, immediately before net.Listen by internal/server/socket_safety.go.
	if info, err := os.Lstat(path); err == nil {
		if err := rejectNonSocketNode(info, label); err != nil {
			return err
		}
	}
	return nil
}

// rejectNonSocketNode rejects an existing filesystem node at a configured socket path unless it is
// itself a Unix domain socket (the expected shape of a stale socket left behind by an unclean prior
// shutdown) or does not exist at all (the caller only invokes this when Lstat already succeeded).
func rejectNonSocketNode(info os.FileInfo, label string) error {
	if info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("config: %s path must not already be a symlink", label)
	}
	if info.Mode()&os.ModeSocket != 0 {
		return nil
	}
	return fmt.Errorf("config: %s path already exists and is not a Unix domain socket (mode %v)", label, info.Mode())
}

// validateTrustedParentDir enforces that path's immediate parent directory entry: exists; is an
// actual directory (not, say, a file mistakenly sitting where a directory was expected); is not
// itself a symlink -- checked via Lstat on the parent entry itself, BEFORE any symlink resolution,
// so a symlinked immediate parent is rejected categorically regardless of where it ultimately
// points; and is not group/world-writable. This is layered on top of, not a replacement for, the
// existing symlinked-ANCESTOR containment check elsewhere in this file, which resolves the full real
// path and compares it against the trust roots -- that check catches a symlink further up the chain
// that resolves inside a trust root, while this one catches an immediate parent that is a symlink at
// all, however it resolves.
func validateTrustedParentDir(path, label string) error {
	parent := filepath.Dir(path)
	info, err := os.Lstat(parent)
	if err != nil {
		return fmt.Errorf("config: %s parent directory missing or unreadable: %w", label, err)
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("config: %s parent directory must not itself be a symlink", label)
	}
	if !info.IsDir() {
		return fmt.Errorf("config: %s parent path must be a directory", label)
	}
	if info.Mode().Perm()&0o022 != 0 {
		return fmt.Errorf("config: %s parent directory must not be group/world-writable (mode %v)", label, info.Mode().Perm())
	}
	return nil
}

// validateExecutablePath validates an explicit, non-model-writable executable path (the git binary,
// the Broker's own binary) in production: must be non-empty and absolute, exist, be a regular
// (non-symlink) file, be executable, must not be group/world-writable, and its real resolved
// location must sit outside both trust roots. label is folded into every returned error message so
// GitBinaryPath and BrokerBinaryPath -- which share this exact battery -- get their own on-brand
// error text from one shared implementation rather than two parallel copies.
func validateExecutablePath(path, label string, roots trustRoots) error {
	if path == "" {
		return fmt.Errorf("config: production requires a %s path", label)
	}
	if !filepath.IsAbs(path) {
		return fmt.Errorf("config: %s path must be absolute, got %q", label, path)
	}

	info, err := os.Lstat(path)
	if err != nil {
		return fmt.Errorf("config: %s missing or unreadable: %w", label, err)
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("config: %s path must not be a symlink", label)
	}
	if info.Mode().IsDir() {
		return fmt.Errorf("config: %s path must not be a directory", label)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("config: %s path must be a regular file", label)
	}
	if info.Mode()&0o111 == 0 {
		return fmt.Errorf("config: %s path must be executable", label)
	}
	if info.Mode().Perm()&0o022 != 0 {
		return fmt.Errorf("config: %s must not be group/world-writable (mode %v)", label, info.Mode().Perm())
	}

	realPath, err := filepath.EvalSymlinks(path)
	if err != nil {
		return fmt.Errorf("config: cannot resolve %s path: %w", label, err)
	}

	return checkContainment(realPath, label+" path", roots)
}

// validateGitBinaryPath validates the explicit git executable path in production. See
// validateExecutablePath for the full battery applied.
func validateGitBinaryPath(path string, roots trustRoots) error {
	return validateExecutablePath(path, "git binary", roots)
}

// validateBrokerBinaryPath validates the Broker's own executable path in production. REQUIRED
// (non-empty) as of this round -- a prior round left this optional and skipped the check entirely
// when the value ended up empty (e.g. an os.Executable() failure in cmd/mihver-broker that was
// previously tolerated as best-effort); that gap is now closed both here (empty is a hard failure)
// and in cmd/mihver-broker/main.go (an os.Executable() error is now fatal in production before this
// ever runs). See validateExecutablePath for the full battery applied -- identical to GitBinaryPath.
func validateBrokerBinaryPath(path string, roots trustRoots) error {
	return validateExecutablePath(path, "broker binary", roots)
}

// runtimeLocation is a canonicalized runtime-path record used only for the pairwise disjointness
// check below. real combines the symlink-resolved real PARENT directory with the path's final
// basename -- the same technique validateStoreFilePath/validateSocketPath already use for
// containment -- which works whether or not the path itself currently exists. info is the result of
// Lstat on the path as given (nil when the path does not currently exist), used only to additionally
// detect hardlink aliases via os.SameFile for paths that DO currently exist; a symlinked-parent or
// same-real-path alias is already caught by comparing real strings regardless of existence.
type runtimeLocation struct {
	label string
	real  string
	info  os.FileInfo
}

// resolveRuntimeLocation computes path's runtimeLocation. label is required and path must already
// be known-absolute (every caller of validateRuntimePathDisjointness runs after the individual
// per-field checks in validateProduction, which already reject a relative or unresolvable path for
// every field this touches).
func resolveRuntimeLocation(label, path string) (runtimeLocation, error) {
	realParent, err := filepath.EvalSymlinks(filepath.Dir(path))
	if err != nil {
		return runtimeLocation{}, fmt.Errorf("config: cannot resolve %s parent directory: %w", label, err)
	}
	loc := runtimeLocation{label: label, real: filepath.Join(realParent, filepath.Base(path))}
	if info, err := os.Lstat(path); err == nil {
		loc.info = info
	}
	return loc, nil
}

// grantTempPath returns the exact derived path internal/grant.Store.persistLocked writes to and
// then renames over grantStorePath -- see that function's own comment ("tmp := s.path + \".tmp\"").
// Kept as a single named function (rather than the raw concatenation repeated at each call site) so
// this file's own derivation can never silently drift from grant.go's.
func grantTempPath(grantStorePath string) string {
	return grantStorePath + ".tmp"
}

// validateGrantTempPathNode classifies whatever, if anything, currently sits at the derived grant
// temp path (Closeout Pack A.2, Work Package B). Runtime disjointness previously compared only the
// CONFIGURED paths, so a configuration where AuditLogPath == GrantStorePath+".tmp" passed validation
// even though a real AdminHandle.Create then writes through the configured audit path and renames it
// over the Grant Store -- see validateRuntimePathDisjointness below, which folds this derived path
// into the same pairwise comparison every other protected path already goes through, closing that
// gap. This function additionally classifies the node itself: absent is the ordinary case and is
// accepted; an existing plain regular file that is not group/world-writable is also accepted --
// persistLocked's own os.WriteFile silently truncates and overwrites whatever regular-file content
// (if any) is already there, so this implementation does not need to verify or recover it, only
// confirm it is not something persistLocked's os.WriteFile/os.Rename sequence could be tricked by. A
// symlink, directory, FIFO, device, or group/world-writable regular file at that exact path is
// rejected outright. A hardlink alias to another protected, currently-existing file is caught
// separately, by validateRuntimePathDisjointness's own os.SameFile comparison below -- not
// duplicated here.
func validateGrantTempPathNode(tempPath string) error {
	info, err := os.Lstat(tempPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("config: cannot inspect grant store temp file %q: %w", tempPath, err)
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("config: grant store temp file %q must not be a symlink", tempPath)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("config: grant store temp file %q must be a regular file, got mode %v", tempPath, info.Mode())
	}
	if info.Mode().Perm()&0o022 != 0 {
		return fmt.Errorf("config: grant store temp file %q must not be group/world-writable (mode %v)", tempPath, info.Mode().Perm())
	}
	return nil
}

// validateRuntimePathDisjointness enforces PAIRWISE DISJOINTNESS across every Broker-owned runtime
// path -- private key, grant store, the DERIVED grant store temp path (grantTempPath), audit log,
// client socket, admin socket, git binary, broker binary, and (when configured) broker config -- so
// that no two of them can ever resolve to the same real location, whether that alias is reached
// through a symlinked parent directory (caught by comparing the resolved-parent+basename form) or
// through a hardlink (caught, for the subset of pairs where both paths currently exist as real
// files, via os.SameFile). A not-yet-existing socket path is naturally skipped by the hardlink
// comparison -- there is nothing to Stat -- and relies on the resolved-parent+basename comparison
// alone, which is exactly what the task requires.
func validateRuntimePathDisjointness(c Config) error {
	var locations []runtimeLocation
	add := func(label, path string) error {
		if path == "" {
			return nil // optional field (broker config only); nothing to compare
		}
		loc, err := resolveRuntimeLocation(label, path)
		if err != nil {
			return err
		}
		locations = append(locations, loc)
		return nil
	}

	fields := []struct{ label, path string }{
		{"private key", c.PrivateKeyPath},
		{"grant store", c.GrantStorePath},
		{"grant store temp file (derived)", grantTempPath(c.GrantStorePath)},
		{"audit log", c.AuditLogPath},
		{"client socket", c.ClientSocketPath},
		{"admin socket", c.AdminSocketPath},
		{"git binary", c.GitBinaryPath},
		{"broker binary", c.BrokerBinaryPath},
		{"broker config", c.BrokerConfigPath},
	}
	for _, f := range fields {
		if err := add(f.label, f.path); err != nil {
			return err
		}
	}

	for i := 0; i < len(locations); i++ {
		for j := i + 1; j < len(locations); j++ {
			a, b := locations[i], locations[j]
			if a.real == b.real {
				return fmt.Errorf("config: %s and %s must not resolve to the same real location (%s)", a.label, b.label, a.real)
			}
			if a.info != nil && b.info != nil && os.SameFile(a.info, b.info) {
				return fmt.Errorf("config: %s and %s must not be hardlink aliases of the same file", a.label, b.label)
			}
		}
	}
	return nil
}

// rejectWritableByOthers validates BrokerConfigPath (the one optional caller of this function): a
// value of "" means "not configured," accepted unconditionally. Once configured it must currently
// exist (unchanged from before this round) as a regular, non-symlinked file that is not
// group/world-writable -- Closeout Pack A.2.1, Work Package B added the symlink and regular-file
// checks; a FIFO, Unix socket, directory, or device node with safe permission bits would otherwise
// have passed the permission check alone undetected.
func rejectWritableByOthers(path, label string) error {
	if path == "" {
		return nil
	}
	info, err := os.Lstat(path)
	if err != nil {
		return fmt.Errorf("config: %s missing or unreadable: %w", label, err)
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("config: %s must not be a symlink", label)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("config: %s must be a regular file, got mode %v", label, info.Mode())
	}
	if info.Mode().Perm()&0o022 != 0 {
		return fmt.Errorf("config: %s must not be group/world-writable (mode %v)", label, info.Mode().Perm())
	}
	return nil
}

// isInside reports whether path is root or lies inside it, per filepath.Rel. Every caller in this
// file passes an already-validated, non-empty, absolute root (see validateTrustRoot) and an already
// symlink-resolved absolute path, so filepath.Rel should never actually fail here in practice -- but
// per Closeout Pack A.2, Work Package A, a comparison error must NEVER be silently treated as "not
// inside" (that was the exact pre-fix defect: an empty or relative root made filepath.Rel fail, and
// the old implementation converted that failure straight into `false`, i.e. "outside," accepting a
// protected path that was genuinely inside the trust root). This function therefore returns the
// comparison error explicitly, and every caller (via checkContainment) fails closed on it.
func isInside(path, root string) (bool, error) {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return false, fmt.Errorf("cannot compute relative path from %q to %q: %w", root, path, err)
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)), nil
}

// ValidateGitHubAPIBaseURL rejects any production API base URL not resolving to FixedGitHubAPIHost
// over https. Used by internal/githubapp so an arbitrary API host can never be configured in
// production even indirectly through a full URL rather than a bare host field.
func ValidateGitHubAPIBaseURL(mode Mode, rawURL string) error {
	if mode == ModeTest {
		return nil
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("config: malformed GitHub API base URL: %w", err)
	}
	if u.Scheme != "https" {
		return fmt.Errorf("config: production GitHub API base URL must be https")
	}
	if u.Host != FixedGitHubAPIHost {
		return fmt.Errorf("config: production GitHub API base URL host must be %q, got %q", FixedGitHubAPIHost, u.Host)
	}
	return nil
}
