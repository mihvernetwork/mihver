package githubapp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"mihver.network/publication-broker/internal/repoidentity"
)

// PR is the minimal shape of a GitHub REST pull request this package needs.
type PR struct {
	Number  int    `json:"number"`
	State   string `json:"state"`
	Title   string `json:"title"`
	Body    string `json:"body"`
	HeadRef string `json:"-"`
	HeadSHA string `json:"-"`
	BaseRef string `json:"-"`
}

type prAPIResponse struct {
	Number int    `json:"number"`
	State  string `json:"state"`
	Title  string `json:"title"`
	Body   string `json:"body"`
	Head   struct {
		Ref string `json:"ref"`
		SHA string `json:"sha"`
	} `json:"head"`
	Base struct {
		Ref string `json:"ref"`
	} `json:"base"`
}

func (r prAPIResponse) toPR() PR {
	return PR{
		Number: r.Number, State: r.State, Title: r.Title, Body: r.Body,
		HeadRef: r.Head.Ref, HeadSHA: r.Head.SHA, BaseRef: r.Base.Ref,
	}
}

// PRClient performs the exact, narrow PR mechanics V3.1-B Section 14 authorizes: search-by-exact-
// head-branch, create, and converge title/body on an existing PR. It has no method that approves,
// merges, closes, or deletes -- those capabilities simply do not exist on this type, so no caller
// mistake can invoke them.
type PRClient struct {
	APIBaseURL string
	Owner      string
	Repo       string
	Token      Token
	HTTPClient *http.Client
}

// validateOwnerRepo re-checks c.Owner/c.Repo via the shared internal/repoidentity validator BEFORE
// any HTTP request is made -- defense in depth, since this package never trusts that a caller
// already validated these fields (e.g. via internal/protocol's Envelope validation). On failure it
// returns a stable, errors.Is-checkable error (wrapping repoidentity.ErrInvalidOwner or
// repoidentity.ErrInvalidRepositoryName) and the caller must make ZERO HTTP requests.
func (c PRClient) validateOwnerRepo() error {
	if _, err := repoidentity.Validate(c.Owner, c.Repo); err != nil {
		return fmt.Errorf("githubapp: %w", err)
	}
	return nil
}

func (c PRClient) client() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	return http.DefaultClient
}

func (c PRClient) do(ctx context.Context, method, path string, body any, out any) (int, error) {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return 0, err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.APIBaseURL+path, reader)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token.Raw())
	req.Header.Set("Accept", "application/vnd.github+json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.client().Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if out != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, out); err != nil {
			return resp.StatusCode, fmt.Errorf("githubapp: unparseable response: %w", err)
		}
	}
	return resp.StatusCode, nil
}

// FindOpenByHead searches ONLY for open PRs with the exact head branch (owner:branch). Returns
// (nil, nil) for zero matches, the single match for exactly one, and a distinct
// ErrAmbiguousPR for more than one -- callers must BLOCK on ambiguity rather than guessing.
var ErrAmbiguousPR = fmt.Errorf("githubapp: more than one open PR matches this exact head branch")

func (c PRClient) FindOpenByHead(ctx context.Context, branch string) (*PR, error) {
	// Owner/Repo are now validated via repoidentity.Validate BEFORE any HTTP request is made (see
	// validateOwnerRepo) -- this is defense in depth on top of internal/protocol's own Envelope/
	// Receipt validation, since this package never trusts that a caller already validated them.
	// Branch shape is a separate, already-existing responsibility (internal/gitremote's
	// ValidateTargetBranch) -- not re-validated here, only escaped: url.PathEscape percent-encodes a
	// stray "/" in Owner/Repo (confining each to its own path segment rather than trusting the
	// character-class check alone), and the "head" query value is built via url.Values (rather than
	// hand-concatenated escaped strings) with its own owner:branch shape reconstructed from a
	// literal ":" that url.Values.Encode() itself percent-encodes -- so an adversarial branch value
	// can never inject a second colon-delimited field.
	if err := c.validateOwnerRepo(); err != nil {
		return nil, err
	}
	q := url.Values{}
	q.Set("state", "open")
	q.Set("head", c.Owner+":"+branch)
	path := fmt.Sprintf("/repos/%s/%s/pulls?%s", url.PathEscape(c.Owner), url.PathEscape(c.Repo), q.Encode())
	var results []prAPIResponse
	status, err := c.do(ctx, http.MethodGet, path, nil, &results)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("githubapp: list PRs failed: status %d", status)
	}
	if len(results) == 0 {
		return nil, nil
	}
	if len(results) > 1 {
		return nil, ErrAmbiguousPR
	}
	pr := results[0].toPR()
	return &pr, nil
}

// Create opens a new PR with exactly the given branch/base/title/body from the validated request --
// never content the Broker composes itself.
func (c PRClient) Create(ctx context.Context, branch, base, title, body string) (*PR, error) {
	if err := c.validateOwnerRepo(); err != nil {
		return nil, err
	}
	reqBody := map[string]string{"head": branch, "base": base, "title": title, "body": body}
	var result prAPIResponse
	status, err := c.do(ctx, http.MethodPost, fmt.Sprintf("/repos/%s/%s/pulls", url.PathEscape(c.Owner), url.PathEscape(c.Repo)), reqBody, &result)
	if err != nil {
		return nil, err
	}
	if status != http.StatusCreated {
		return nil, fmt.Errorf("githubapp: create PR failed: status %d", status)
	}
	pr := result.toPR()
	return &pr, nil
}

// UpdateTitleBody deterministically converges an existing PR's title/body to exactly the validated
// request's values. Never touches base, head, or state.
func (c PRClient) UpdateTitleBody(ctx context.Context, number int, title, body string) (*PR, error) {
	if err := c.validateOwnerRepo(); err != nil {
		return nil, err
	}
	reqBody := map[string]string{"title": title, "body": body}
	var result prAPIResponse
	status, err := c.do(ctx, http.MethodPatch, fmt.Sprintf("/repos/%s/%s/pulls/%d", url.PathEscape(c.Owner), url.PathEscape(c.Repo), number), reqBody, &result)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("githubapp: update PR failed: status %d", status)
	}
	pr := result.toPR()
	return &pr, nil
}
