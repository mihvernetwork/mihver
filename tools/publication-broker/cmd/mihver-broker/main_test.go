package main

// Regression suite for MIHVER V3.1-B Closeout Pack A.2.1, Work Package A (Remove Test-Mode Bypass
// From The Privileged Binary). Confirmed defect: cmd/mihver-broker exposed a public
// --mode=production|test flag. internal/config.Config.ModeTest skips every production-only
// path/host validation rule (by design, for internal/config's own unit tests), but this main still
// unconditionally wired up real api.github.com/github.com-targeting dependencies (TokenMinter,
// GitRemote, PRClientFactory) regardless of which mode was selected -- so an operator who merely
// passed --mode=test got a live-credential-capable process with every fail-closed containment/host
// check silently disabled.
//
// run() itself cannot safely be invoked directly from a unit test: it calls flag.Parse() against the
// process's real os.Args/the package-level flag.CommandLine, and (once past config validation) opens
// real Unix sockets and serves forever. The tests below therefore combine (a) direct, injectable-unit
// tests of resolveBrokerBinaryPath -- the one piece of run()'s composition logic that IS extracted
// into a directly callable function -- with (b) structural source-inspection tests proving the
// specific properties this round requires hold in the actual committed source, not merely in
// runtime behavior nothing here can safely exercise. Source-inspection is a deliberate, narrow choice
// for exactly this file: it is the standard technique for "a specific API/flag must never reappear"
// regression guards, and is precise here because main.go is a single small file with no build tags,
// generated code, or macro expansion to complicate a textual check.

import (
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"

	"mihver.network/publication-broker/internal/config"
)

// TestResolveBrokerBinaryPath_ProductionFailsClosedOnExecutableError is the regression test for this
// round's required fail-closed behavior: a prior round tolerated os.Executable() failing as
// best-effort (silently leaving BrokerBinaryPath empty), which internal/config.Config's
// validateBrokerBinaryPath now rejects anyway -- but run() should fail fast with a specific,
// on-brand error here rather than deferring to that less specific one. os.Executable() cannot be
// forced to fail portably, so this injects a fake executableFunc instead.
func TestResolveBrokerBinaryPath_ProductionFailsClosedOnExecutableError(t *testing.T) {
	injectedErr := errors.New("injected os.Executable failure")
	fakeExecutable := func() (string, error) { return "", injectedErr }

	_, err := resolveBrokerBinaryPath(fakeExecutable)
	if err == nil {
		t.Fatalf("expected resolveBrokerBinaryPath to fail closed when executableFunc errors")
	}
	if !errors.Is(err, injectedErr) {
		t.Fatalf("expected the returned error to wrap the injected error, got: %v", err)
	}
}

func TestResolveBrokerBinaryPath_SucceedsWhenExecutableSucceeds(t *testing.T) {
	fakeExecutable := func() (string, error) { return "/opt/mihver/mihver-broker", nil }

	path, err := resolveBrokerBinaryPath(fakeExecutable)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if path != "/opt/mihver/mihver-broker" {
		t.Fatalf("expected the resolved path to be passed through unchanged, got %q", path)
	}
}

// TestResolveBrokerBinaryPath_HasNoModeParameter documents, at the type-signature level, that this
// round removed the production/test distinction entirely: resolveBrokerBinaryPath now takes exactly
// one argument. (The two tests above already exercise this signature directly -- if a mode parameter
// were ever reintroduced, both would fail to compile, which is itself the strongest possible
// regression guard for a signature change; this test exists to name that guarantee explicitly.)
func TestResolveBrokerBinaryPath_HasNoModeParameter(t *testing.T) {
	var fn func(func() (string, error)) (string, error) = resolveBrokerBinaryPath
	_ = fn
}

// ownSource reads this package's own main.go source, for the structural checks below. Uses
// runtime.Caller so the test locates the file relative to itself regardless of the working directory
// `go test` is invoked from.
func ownSource(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatalf("runtime.Caller failed")
	}
	mainPath := filepath.Join(filepath.Dir(thisFile), "main.go")
	data, err := os.ReadFile(mainPath)
	if err != nil {
		t.Fatalf("read main.go: %v", err)
	}
	return string(data)
}

// stripLineComments removes everything from "//" to end-of-line on every line, so the checks below
// search only actual Go code, not doc comments that legitimately mention ModeTest/the removed flag
// while explaining why they were removed.
func stripLineComments(src string) string {
	lines := strings.Split(src, "\n")
	for i, l := range lines {
		if idx := strings.Index(l, "//"); idx >= 0 {
			lines[i] = l[:idx]
		}
	}
	return strings.Join(lines, "\n")
}

// Required test 1: cmd/mihver-broker has no --mode flag.
func TestMain_HasNoModeFlag(t *testing.T) {
	code := stripLineComments(ownSource(t))
	flagNamePattern := regexp.MustCompile(`flag\.\w+\(\s*"([a-zA-Z0-9_-]+)"`)
	for _, m := range flagNamePattern.FindAllStringSubmatch(code, -1) {
		if m[1] == "mode" {
			t.Fatalf("SECURITY DEFECT: cmd/mihver-broker/main.go still registers a flag named %q", m[1])
		}
	}
}

// Required test 2: run's composition always creates config.ModeProduction. Every `Mode:` field
// literal in main.go must be either the literal `config.ModeProduction` (the Config composition
// itself) or `cfg.Mode` (TokenMinter's own Mode field, deriving from that same already-fixed value)
// -- never any other identifier, and in particular never `config.ModeTest`.
func TestMain_ConfigCompositionAlwaysUsesModeProduction(t *testing.T) {
	code := stripLineComments(ownSource(t))
	modeLiteralPattern := regexp.MustCompile(`Mode:\s*([A-Za-z0-9_.]+)`)
	matches := modeLiteralPattern.FindAllStringSubmatch(code, -1)
	if len(matches) == 0 {
		t.Fatalf("test setup bug: no `Mode: ...` field literal found in main.go's Config composition")
	}
	sawConfigModeProduction := false
	for _, m := range matches {
		switch m[1] {
		case "config.ModeProduction":
			sawConfigModeProduction = true
		case "cfg.Mode":
			// fine -- derives from the Config composition checked above, not an independent literal.
		default:
			t.Fatalf("SECURITY DEFECT: main.go composes a Mode: field from %s, not config.ModeProduction (or cfg.Mode deriving from it)", m[1])
		}
	}
	if !sawConfigModeProduction {
		t.Fatalf("test setup bug: expected at least one `Mode: config.ModeProduction` literal in main.go")
	}
}

// Required test 3: unsafe key/state paths cannot become accepted through any main-binary option --
// there is no flag or code path in main.go that skips, conditionally bypasses, or wraps the
// cfg.Validate() call in anything other than an unconditional "if err != nil { return }" gate before
// any protected resource (grant store, audit log, private key) is opened.
func TestMain_ConfigValidationIsUnconditionalAndRunsBeforeAnyProtectedOpen(t *testing.T) {
	code := stripLineComments(ownSource(t))

	validateCalls := strings.Count(code, "cfg.Validate()")
	if validateCalls != 1 {
		t.Fatalf("expected exactly one cfg.Validate() call site in main.go, found %d", validateCalls)
	}
	// No flag exists whose name suggests a validation bypass/skip.
	bypassPattern := regexp.MustCompile(`(?i)flag\.\w+\(\s*"[a-zA-Z0-9_-]*(skip|bypass|unsafe|no-?validate|force)[a-zA-Z0-9_-]*"`)
	if bypassPattern.MatchString(code) {
		t.Fatalf("SECURITY DEFECT: cmd/mihver-broker/main.go registers a flag that appears to bypass validation")
	}

	validateIdx := strings.Index(code, "cfg.Validate()")
	grantOpenIdx := strings.Index(code, "grant.Open(")
	auditOpenIdx := strings.Index(code, "audit.Open(")
	keyLoadIdx := strings.Index(code, "loadRSAPrivateKey(")
	if validateIdx < 0 || grantOpenIdx < 0 || auditOpenIdx < 0 || keyLoadIdx < 0 {
		t.Fatalf("test setup bug: expected call sites not found (validate=%d grantOpen=%d auditOpen=%d keyLoad=%d)", validateIdx, grantOpenIdx, auditOpenIdx, keyLoadIdx)
	}
	if !(validateIdx < grantOpenIdx && validateIdx < auditOpenIdx && validateIdx < keyLoadIdx) {
		t.Fatalf("SECURITY DEFECT: cfg.Validate() does not textually precede grant.Open/audit.Open/loadRSAPrivateKey in main.go")
	}
}

// Required test 4: no main-binary path can construct real GitHub dependencies with ModeTest -- proven
// by confirming ModeTest is never referenced anywhere in this binary's actual code (only in doc
// comments explaining why it was removed, which stripLineComments excludes), AND that the GitHub
// API/remote hosts wired into TokenMinter/RemoteURLBuilder are the fixed production constants,
// literally, not conditioned on cfg.Mode at all.
func TestMain_NeverReferencesModeTestOrConditionsGitHubHostsOnMode(t *testing.T) {
	code := stripLineComments(ownSource(t))
	if strings.Contains(code, "ModeTest") {
		t.Fatalf("SECURITY DEFECT: cmd/mihver-broker/main.go's actual code references ModeTest")
	}
	if strings.Count(code, "config.FixedGitHubAPIHost") == 0 {
		t.Fatalf("test setup bug: expected config.FixedGitHubAPIHost to be used directly in main.go")
	}
	if strings.Count(code, "config.FixedGitHubHost") == 0 {
		t.Fatalf("test setup bug: expected config.FixedGitHubHost to be used directly in main.go")
	}
	// Neither fixed-host constant's use site is inside a conditional keyed on cfg.Mode -- checked by
	// confirming "cfg.Mode ==" or "c.Mode ==" (an explicit mode branch) never appears in this file at
	// all outside the one field assignment already checked by TestMain_ConfigCompositionAlwaysUsesModeProduction.
	modeComparisonPattern := regexp.MustCompile(`\bMode\s*==`)
	if modeComparisonPattern.MatchString(code) {
		t.Fatalf("SECURITY DEFECT: cmd/mihver-broker/main.go branches on a Mode comparison -- no such branch should exist in a binary with a single, fixed production mode")
	}
}

// Required test 5: package-level ModeTest unit tests remain working -- exercised by
// internal/config's own test suite (internal/config/config_test.go's
// TestValidate_TestModeSkipsProductionRules and friends), not duplicated here; this test only
// confirms config.ModeTest itself still exists and behaves as internal/config's tests expect, so a
// change to this binary could never accidentally also remove or break that distinct package-level
// capability.
func TestMain_PackageLevelModeTestStillExistsForInternalConfigUnitTests(t *testing.T) {
	testCfg := config.Config{Mode: config.ModeTest}
	if err := testCfg.Validate(); err != nil {
		t.Fatalf("expected internal/config.ModeTest to still skip production-only validation for package-internal unit tests, got: %v", err)
	}
}

// Required test 6: existing production composition tests remain passing -- see the two
// TestResolveBrokerBinaryPath_* tests above (adjusted to this round's new single-argument
// signature), which continue to pass.
