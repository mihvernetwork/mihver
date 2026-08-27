package githubapp

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func testKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate ephemeral test key: %v", err)
	}
	return key
}

func TestMintAppJWT_ProducesVerifiableRS256JWT(t *testing.T) {
	key := testKey(t)
	now := time.Now()
	tok, err := MintAppJWT("123", key, now)
	if err != nil {
		t.Fatalf("MintAppJWT: %v", err)
	}
	parts := strings.Split(tok, ".")
	if len(parts) != 3 {
		t.Fatalf("expected 3 JWT parts, got %d", len(parts))
	}
	claimsJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatalf("decode claims: %v", err)
	}
	var claims jwtClaims
	if err := json.Unmarshal(claimsJSON, &claims); err != nil {
		t.Fatalf("unmarshal claims: %v", err)
	}
	if claims.ISS != "123" {
		t.Fatalf("unexpected iss: %s", claims.ISS)
	}
	if claims.EXP <= claims.IAT {
		t.Fatalf("exp must be after iat")
	}
	if claims.EXP-claims.IAT > 10*60 {
		t.Fatalf("jwt validity window exceeds GitHub's 10 minute maximum")
	}

	// Verify the signature independently against the public key, proving RS256 signing is correct
	// (not merely well-formed).
	signingInput := parts[0] + "." + parts[1]
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		t.Fatalf("decode signature: %v", err)
	}
	digest := sha256.Sum256([]byte(signingInput))
	if err := rsa.VerifyPKCS1v15(&key.PublicKey, crypto.SHA256, digest[:], sig); err != nil {
		t.Fatalf("signature does not verify against the public key: %v", err)
	}
}

func TestMintAppJWT_RequiresAppIDAndKey(t *testing.T) {
	key := testKey(t)
	if _, err := MintAppJWT("", key, time.Now()); err == nil {
		t.Fatalf("expected error for empty app id")
	}
	if _, err := MintAppJWT("123", nil, time.Now()); err == nil {
		t.Fatalf("expected error for nil key")
	}
}
