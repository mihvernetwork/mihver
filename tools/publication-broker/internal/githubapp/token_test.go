package githubapp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"mihver.network/publication-broker/internal/config"
)

func TestMint_NamesExactRepositoryAndMinimalPermissions(t *testing.T) {
	var captured mintRequest
	var authHeader string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader = r.Header.Get("Authorization")
		json.NewDecoder(r.Body).Decode(&captured)
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(mintResponse{Token: "opaque-token-value-of-arbitrary-shape-xyz", ExpiresAt: time.Now().Add(time.Hour)})
	}))
	defer srv.Close()

	minter := TokenMinter{
		Mode: config.ModeTest, APIBaseURL: srv.URL, AppID: "1", InstallationID: "2", PrivateKey: testKey(t),
	}
	tok, err := minter.Mint(context.Background(), "mihver", TargetPermissions)
	if err != nil {
		t.Fatalf("Mint: %v", err)
	}
	if tok.Raw() != "opaque-token-value-of-arbitrary-shape-xyz" {
		t.Fatalf("unexpected token value")
	}
	if len(captured.Repositories) != 1 || captured.Repositories[0] != "mihver" {
		t.Fatalf("expected exactly repository [mihver], got %v", captured.Repositories)
	}
	if len(captured.Permissions) != 2 || captured.Permissions["contents"] != "write" || captured.Permissions["pull_requests"] != "write" {
		t.Fatalf("unexpected permissions: %v", captured.Permissions)
	}
	if !strings.HasPrefix(authHeader, "Bearer ") {
		t.Fatalf("expected Bearer auth header, got %q", authHeader)
	}
}

func TestMint_RejectsArbitraryHostInProduction(t *testing.T) {
	minter := TokenMinter{
		Mode: config.ModeProduction, APIBaseURL: "https://evil.example.com", AppID: "1", InstallationID: "2", PrivateKey: testKey(t),
	}
	if _, err := minter.Mint(context.Background(), "mihver", TargetPermissions); err == nil {
		t.Fatalf("expected rejection of arbitrary API host in production")
	}
}

func TestToken_NeverLeaksViaStringOrJSON(t *testing.T) {
	tok := Token{value: "super-secret-value"}
	if strings.Contains(tok.String(), "super-secret-value") {
		t.Fatalf("Token.String() leaked the raw value")
	}
	data, err := json.Marshal(tok)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if strings.Contains(string(data), "super-secret-value") {
		t.Fatalf("Token JSON marshaling leaked the raw value: %s", data)
	}
	if tok.Raw() != "super-secret-value" {
		t.Fatalf("Raw() must still return the actual value for the one legitimate call site")
	}
}

func TestReadOnlyPermissions_AreActuallyReadOnly(t *testing.T) {
	for k, v := range ReadOnlyPermissions {
		if v != "read" {
			t.Fatalf("ReadOnlyPermissions[%q] = %q, expected read", k, v)
		}
	}
}

func TestTargetPermissions_NeverIncludesAdministration(t *testing.T) {
	forbidden := []string{"administration", "actions", "workflows", "secrets", "members", "organization_administration"}
	for _, f := range forbidden {
		if _, present := TargetPermissions[f]; present {
			t.Fatalf("TargetPermissions must never include %q", f)
		}
	}
	if len(TargetPermissions) != 2 {
		t.Fatalf("TargetPermissions must contain exactly contents+pull_requests, got %v", TargetPermissions)
	}
}
