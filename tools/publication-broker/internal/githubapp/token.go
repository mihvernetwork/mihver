package githubapp

import (
	"bytes"
	"context"
	"crypto/rsa"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"mihver.network/publication-broker/internal/config"
)

// Token is an opaque, short-lived GitHub App installation access token. It is deliberately NOT a
// plain string type: its String()/GoString() methods redact the value so an accidental %v/%s/%+v
// in a log statement or error message never leaks it, and there is no exported way to obtain the
// raw bytes except Raw(), whose call sites in this codebase are limited to the single git-push
// credential handoff (internal/gitremote) -- never a log, an error, or the result JSON returned to
// a client.
type Token struct {
	value     string
	ExpiresAt time.Time
}

// Raw returns the actual token value. Callers must never place the result in a log line, an error
// message, argv, a persisted file, or any JSON returned to a client.
func (t Token) Raw() string { return t.value }

// TokenFromRawForTests constructs a Token from a plain string. Exported ONLY so other packages'
// test doubles (e.g. internal/server's fake TokenMinter) can hand a canned value to code expecting
// a real Token, without ever needing a real TokenMinter/HTTP round trip in a unit test. Production
// code must never call this -- the only production path to a Token is TokenMinter.Mint.
func TokenFromRawForTests(raw string) Token { return Token{value: raw} }

func (t Token) String() string   { return "[REDACTED installation token]" }
func (t Token) GoString() string { return "[REDACTED installation token]" }

// MarshalJSON always redacts -- a Token must never be serialized into any persisted or transmitted
// document, including the Broker's own result JSON or audit log.
func (t Token) MarshalJSON() ([]byte, error) {
	return json.Marshal("[REDACTED]")
}

// TargetPermissions is the exact, minimal permission set V3.1-B Section 10 authorizes -- Contents:
// write and Pull requests: write. Metadata:read is implicit for every GitHub App installation token
// and is never requested explicitly. No other permission (Administration, Actions, Workflows,
// Secrets, Members, repository rules administration, or anything else) is ever named here.
var TargetPermissions = map[string]string{
	"contents":      "write",
	"pull_requests": "write",
}

// ReadOnlyPermissions is used for the Broker's own remote-verification calls (e.g. checking a
// branch's current head, listing PRs) that should happen BEFORE the write-capable token is ever
// minted -- "mint the write-capable token as late as possible" (Section 10).
var ReadOnlyPermissions = map[string]string{
	"contents":      "read",
	"pull_requests": "read",
}

// TokenMinter mints installation access tokens against a configured GitHub API base (production:
// https://api.github.com; tests: an httptest server URL injected here, never through production
// config -- see internal/config's ModeTest doc comment).
type TokenMinter struct {
	Mode           config.Mode
	APIBaseURL     string
	AppID          string
	InstallationID string
	PrivateKey     *rsa.PrivateKey
	HTTPClient     *http.Client
	Now            func() time.Time
}

type mintRequest struct {
	Repositories []string          `json:"repositories"`
	Permissions  map[string]string `json:"permissions"`
}

type mintResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
}

// Mint requests an installation token scoped to exactly repositoryName (the single repository this
// Broker is authorized to publish to) and exactly the given permissions map -- callers pass
// TargetPermissions or ReadOnlyPermissions, never a caller-assembled ad hoc set, so the minimal-
// permission invariant lives in one place.
func (m TokenMinter) Mint(ctx context.Context, repositoryName string, permissions map[string]string) (Token, error) {
	if err := config.ValidateGitHubAPIBaseURL(m.Mode, m.APIBaseURL); err != nil {
		return Token{}, err
	}
	now := time.Now
	if m.Now != nil {
		now = m.Now
	}
	appJWT, err := MintAppJWT(m.AppID, m.PrivateKey, now())
	if err != nil {
		return Token{}, err
	}

	reqBody, err := json.Marshal(mintRequest{Repositories: []string{repositoryName}, Permissions: permissions})
	if err != nil {
		return Token{}, fmt.Errorf("githubapp: marshal mint request: %w", err)
	}
	url := fmt.Sprintf("%s/app/installations/%s/access_tokens", m.APIBaseURL, m.InstallationID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return Token{}, fmt.Errorf("githubapp: build mint request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+appJWT)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	client := m.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return Token{}, fmt.Errorf("githubapp: mint request failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusCreated {
		return Token{}, fmt.Errorf("githubapp: mint failed: status %d", resp.StatusCode)
	}
	var parsed mintResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return Token{}, fmt.Errorf("githubapp: unparseable mint response")
	}
	if parsed.Token == "" {
		return Token{}, fmt.Errorf("githubapp: empty token in mint response")
	}
	return Token{value: parsed.Token, ExpiresAt: parsed.ExpiresAt}, nil
}
