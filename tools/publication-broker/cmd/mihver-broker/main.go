// mihver-broker is the privileged Publication Broker server. V3.1-B implements and tests this
// source; it does NOT provision the privileged OS identity, install this binary outside the
// repository, install a real GitHub App private key, or activate this process against a live
// GitHub credential -- see docs/development/PUBLICATION_BROKER.md's "Human Provisioning Checklist
// (V3.1-C)" for what remains before this binary may ever be run against real infrastructure.
//
// This binary always runs internal/config.ModeProduction -- the fail-closed config validation in
// internal/config always applies. Closeout Pack A.2.1 (Work Package A) removed the earlier
// --mode=production|test flag entirely: internal/config.Config.ModeTest exists so package-internal
// Go unit tests can inject fake HTTP/Git endpoints, but Config.ModeTest skips every production-only
// path/host rule while this main still wired up real api.github.com/github.com dependencies
// (TokenMinter, GitRemote, PRClientFactory) regardless of mode -- so an operator who merely passed
// --mode=test got a live-credential-capable process with every fail-closed path/host check silently
// disabled. There is now no runtime flag, environment variable, config value, or request field
// anywhere in this binary that can select ModeTest or otherwise bypass production validation.
package main

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"flag"
	"fmt"
	"os"

	"mihver.network/publication-broker/internal/audit"
	"mihver.network/publication-broker/internal/config"
	"mihver.network/publication-broker/internal/gitexec"
	"mihver.network/publication-broker/internal/githubapp"
	"mihver.network/publication-broker/internal/gitremote"
	"mihver.network/publication-broker/internal/grant"
	"mihver.network/publication-broker/internal/server"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "mihver-broker:", err)
		os.Exit(1)
	}
}

// resolveBrokerBinaryPath resolves the running binary's own location via executableFunc (in
// production, always os.Executable -- see run() below). This binary always runs in
// config.ModeProduction (Closeout Pack A.2.1, Work Package A removed the --mode flag entirely), so
// an os.Executable() failure is unconditionally FATAL here, not best-effort. It used to be tolerated
// silently, leaving BrokerBinaryPath empty and letting config validation skip that field's check
// entirely -- internal/config.Config now REQUIRES a non-empty, valid BrokerBinaryPath in production
// (see validateBrokerBinaryPath in internal/config/config.go), so an empty value here would only have
// been caught one layer later anyway; failing here instead gives a clearer, more specific error.
// executableFunc is injectable so a test can force the failure path without needing the real
// os.Executable() to actually fail, which is not portably possible to arrange.
func resolveBrokerBinaryPath(executableFunc func() (string, error)) (string, error) {
	path, err := executableFunc()
	if err != nil {
		return "", fmt.Errorf("resolve broker binary path (os.Executable): %w", err)
	}
	return path, nil
}

func run() error {
	clientSocket := flag.String("client-socket", "/var/run/mihver-broker.sock", "unprivileged client Unix socket path")
	adminSocket := flag.String("admin-socket", "/var/run/mihver-broker-admin.sock", "privileged admin Unix socket path")
	grantStorePath := flag.String("grant-store", "", "path to the broker-owned grant store JSON file")
	auditLogPath := flag.String("audit-log", "", "path to the broker-owned audit log JSONL file")
	gitBinary := flag.String("git", "/usr/bin/git", "explicit, non-model-writable git executable path")
	privateKeyPath := flag.String("private-key", "", "GitHub App private key path (PEM, PKCS#1 or PKCS#8)")
	appID := flag.String("app-id", "", "GitHub App id")
	installationID := flag.String("installation-id", "", "GitHub App installation id")
	repoModelWritableRoot := flag.String("repo-root", "", "the model-writable repository root the private key must never be inside")
	devHome := flag.String("dev-home", "", "the development user's home the private key must never be inside")
	flag.Parse()

	// os.Executable() is an authoritative, process-derived value for the running binary's own
	// location -- never taken from a request or CLI flag that could be spoofed by an untrusted
	// caller. Resolution failure is unconditionally FATAL (this binary has no test-mode escape
	// hatch -- see resolveBrokerBinaryPath's own doc comment): internal/config.Config REQUIRES a
	// non-empty, valid BrokerBinaryPath in production, so silently proceeding here would only defer
	// the same failure to a less specific error one layer later.
	brokerBinaryPath, err := resolveBrokerBinaryPath(os.Executable)
	if err != nil {
		return err
	}

	cfg := config.Config{
		Mode:                        config.ModeProduction,
		PrivateKeyPath:              *privateKeyPath,
		RepositoryModelWritableRoot: *repoModelWritableRoot,
		DevelopmentUserHome:         *devHome,
		AppID:                       *appID,
		InstallationID:              *installationID,
		GitHubAPIHost:               config.FixedGitHubAPIHost,
		GitRemoteHost:               config.FixedGitHubHost,
		BrokerBinaryPath:            brokerBinaryPath,
		GrantStorePath:              *grantStorePath,
		AuditLogPath:                *auditLogPath,
		ClientSocketPath:            *clientSocket,
		AdminSocketPath:             *adminSocket,
		GitBinaryPath:               *gitBinary,
	}
	// Config validation -- which now covers every Broker-owned runtime path (grant store, audit log,
	// both sockets, the git binary, and the private key) -- must run BEFORE any of those paths is
	// opened, listened on, or loaded, and before any token mint. Moving this ahead of grant.Open/
	// audit.Open/loadRSAPrivateKey/ServeSocket is what makes it an actual fail-closed gate rather
	// than a check that runs after the trust boundary has already been crossed.
	if err := cfg.Validate(); err != nil {
		return fmt.Errorf("config validation failed (fail-closed): %w", err)
	}

	if *grantStorePath == "" || *auditLogPath == "" {
		return fmt.Errorf("--grant-store and --audit-log are required")
	}

	grants, err := grant.Open(*grantStorePath)
	if err != nil {
		return err
	}
	auditLog, err := audit.Open(*auditLogPath)
	if err != nil {
		return err
	}

	privateKey, err := loadRSAPrivateKey(*privateKeyPath)
	if err != nil {
		return fmt.Errorf("load private key: %w", err)
	}

	minter := githubapp.TokenMinter{
		Mode:           cfg.Mode,
		APIBaseURL:     "https://" + config.FixedGitHubAPIHost,
		AppID:          cfg.AppID,
		InstallationID: cfg.InstallationID,
		PrivateKey:     privateKey,
	}

	home, cleanup, err := gitexec.NewScratchHome("mihver-broker-runtime-home-")
	if err != nil {
		return err
	}
	defer cleanup()

	deps := server.Deps{
		GitBinary:   *gitBinary,
		Grants:      grants.Client(),
		Audit:       auditLog,
		TokenMinter: minter,
		PRClientFactory: func(token githubapp.Token, owner, repo string) githubapp.PRClient {
			return githubapp.PRClient{APIBaseURL: "https://" + config.FixedGitHubAPIHost, Owner: owner, Repo: repo, Token: token}
		},
		GitRemote: gitremote.Client{Sterile: gitexecSterile(*gitBinary, home)},
		RemoteURLBuilder: func(owner, repo string) (string, error) {
			return gitremote.BuildGitHubRemoteURL(config.FixedGitHubHost, owner, repo)
		},
	}

	clientListener := server.NewClientListener(deps)
	adminListener := server.NewAdminListener(grants.Admin())

	errCh := make(chan error, 2)
	go func() { errCh <- clientListener.ServeSocket(*clientSocket, 0o666) }()
	go func() { errCh <- adminListener.ServeSocket(*adminSocket, 0o600) }()
	return <-errCh
}

func gitexecSterile(gitBinary, home string) gitexec.Sterile {
	return gitexec.Sterile{GitBinary: gitBinary, Home: home}
}

func loadRSAPrivateKey(path string) (*rsa.PrivateKey, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, fmt.Errorf("no PEM block found")
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("unsupported private key format: %w", err)
	}
	key, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("private key is not RSA")
	}
	return key, nil
}
