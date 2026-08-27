// Package githubapp implements the GitHub App credential model (V3.1-B Section 10): minting a
// short-lived App JWT from a private key, exchanging it for a minimally-scoped, short-lived
// installation access token ON DEMAND, and the PR create/update mechanics (Section 14) performed
// with that token. Nothing here uses a Personal Access Token, a user's `gh auth token`, or any
// long-lived credential -- the only credential this package ever holds is the App private key
// (never read by this package itself in production; a *rsa.PrivateKey is handed in already loaded
// by the privileged caller) and the installation tokens it mints, which are treated as opaque,
// memory-only, never-logged secrets -- see Token's own type below.
package githubapp

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"
)

// jwtHeader is fixed -- RS256 is the only algorithm GitHub App JWTs use.
var jwtHeaderB64 = base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","typ":"JWT"}`))

type jwtClaims struct {
	IAT int64  `json:"iat"`
	EXP int64  `json:"exp"`
	ISS string `json:"iss"`
}

// MintAppJWT builds and RS256-signs a GitHub App JWT for appID using key, valid from
// (now - 60s) to (now + 9m) -- backdating `iat` slightly is GitHub's own documented
// recommendation to tolerate small clock drift between this process and GitHub's servers; the
// maximum GitHub accepts is 10 minutes, 9 is used to stay safely inside that bound.
func MintAppJWT(appID string, key *rsa.PrivateKey, now time.Time) (string, error) {
	if appID == "" {
		return "", fmt.Errorf("githubapp: app id is required")
	}
	if key == nil {
		return "", fmt.Errorf("githubapp: private key is required")
	}
	claims := jwtClaims{
		IAT: now.Add(-60 * time.Second).Unix(),
		EXP: now.Add(9 * time.Minute).Unix(),
		ISS: appID,
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("githubapp: marshal claims: %w", err)
	}
	claimsB64 := base64.RawURLEncoding.EncodeToString(claimsJSON)

	signingInput := jwtHeaderB64 + "." + claimsB64
	digest := sha256.Sum256([]byte(signingInput))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	if err != nil {
		return "", fmt.Errorf("githubapp: sign jwt: %w", err)
	}
	sigB64 := base64.RawURLEncoding.EncodeToString(sig)

	return signingInput + "." + sigB64, nil
}
