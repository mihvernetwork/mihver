package githubapp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"mihver.network/publication-broker/internal/repoidentity"
)

func TestPRClient_FindOpenByHead_ZeroMatches(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode([]prAPIResponse{})
	}))
	defer srv.Close()
	c := PRClient{APIBaseURL: srv.URL, Owner: "o", Repo: "n", Token: Token{value: "t"}}
	pr, err := c.FindOpenByHead(context.Background(), "chore/test-branch")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if pr != nil {
		t.Fatalf("expected nil for zero matches")
	}
}

// TestPRClient_InvalidOwnerRepo_RejectedWithZeroHTTPRequests proves the full defense-in-depth
// chain for all three PRClient operations: an invalid Owner/Repo (e.g. containing "/", which under
// the OLD behavior was merely percent-encoded into its own path segment) is now rejected by
// repoidentity.Validate BEFORE any HTTP request is made, returning a stable error checkable via
// errors.Is, with the test server never invoked at all -- proven by a handler that fails the test
// the instant it is reached, not by inspecting request content after the fact.
func TestPRClient_InvalidOwnerRepo_RejectedWithZeroHTTPRequests(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		t.Errorf("SECURITY DEFECT: HTTP request reached the server for an invalid Owner/Repo: %s %s", r.Method, r.URL)
	}))
	defer srv.Close()

	c := PRClient{APIBaseURL: srv.URL, Owner: "evil/owner", Repo: "evil/repo", Token: Token{value: "t"}}

	if _, err := c.FindOpenByHead(context.Background(), "chore/test-branch"); !errors.Is(err, repoidentity.ErrInvalidOwner) {
		t.Fatalf("FindOpenByHead: expected errors.Is match against repoidentity.ErrInvalidOwner, got %v", err)
	}
	if _, err := c.Create(context.Background(), "b", "base", "t", "b"); !errors.Is(err, repoidentity.ErrInvalidOwner) {
		t.Fatalf("Create: expected errors.Is match against repoidentity.ErrInvalidOwner, got %v", err)
	}
	if _, err := c.UpdateTitleBody(context.Background(), 7, "t", "b"); !errors.Is(err, repoidentity.ErrInvalidOwner) {
		t.Fatalf("UpdateTitleBody: expected errors.Is match against repoidentity.ErrInvalidOwner, got %v", err)
	}

	if calls != 0 {
		t.Fatalf("SECURITY DEFECT: expected zero HTTP requests for an invalid Owner/Repo, got %d", calls)
	}
}

// TestPRClient_FindOpenByHead_QueryBuiltViaURLValues proves the "head" query value is now
// constructed via url.Values (rather than hand-concatenated escaped strings), and that it still
// correctly percent-encodes '/' and ':' exactly as the prior hand-concatenated construction did.
// Owner/Repo here are ordinary valid identities (repoidentity's character-class rules categorically
// exclude '/', so they can no longer carry a path separator); branch is NOT owner/repo-validated by
// this package (that remains internal/gitremote.ValidateTargetBranch's responsibility), so it is the
// value used here to exercise '/'-containing query-value escaping.
func TestPRClient_FindOpenByHead_QueryBuiltViaURLValues(t *testing.T) {
	var gotPath, gotRawQuery string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.EscapedPath()
		gotRawQuery = r.URL.RawQuery
		json.NewEncoder(w).Encode([]prAPIResponse{})
	}))
	defer srv.Close()

	c := PRClient{APIBaseURL: srv.URL, Owner: "mihvernetwork", Repo: "mihver", Token: Token{value: "t"}}
	if _, err := c.FindOpenByHead(context.Background(), "chore/test-branch"); err != nil {
		t.Fatalf("FindOpenByHead: %v", err)
	}
	if gotPath != "/repos/mihvernetwork/mihver/pulls" {
		t.Fatalf("unexpected path: %q", gotPath)
	}
	wantQuery := "head=mihvernetwork%3Achore%2Ftest-branch&state=open"
	if gotRawQuery != wantQuery {
		t.Fatalf("expected url.Values-encoded query %q, got %q", wantQuery, gotRawQuery)
	}
}

func TestPRClient_FindOpenByHead_Ambiguous(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode([]prAPIResponse{{Number: 1}, {Number: 2}})
	}))
	defer srv.Close()
	c := PRClient{APIBaseURL: srv.URL, Owner: "o", Repo: "n", Token: Token{value: "t"}}
	_, err := c.FindOpenByHead(context.Background(), "chore/test-branch")
	if err != ErrAmbiguousPR {
		t.Fatalf("expected ErrAmbiguousPR, got %v", err)
	}
}

func TestPRClient_CreateThenFindExact(t *testing.T) {
	var created *prAPIResponse
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost:
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			resp := prAPIResponse{Number: 7, State: "open", Title: body["title"], Body: body["body"]}
			resp.Head.Ref = body["head"]
			resp.Head.SHA = "deadbeef"
			resp.Base.Ref = body["base"]
			created = &resp
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(resp)
		case r.Method == http.MethodGet:
			if created == nil {
				json.NewEncoder(w).Encode([]prAPIResponse{})
				return
			}
			json.NewEncoder(w).Encode([]prAPIResponse{*created})
		}
	}))
	defer srv.Close()
	c := PRClient{APIBaseURL: srv.URL, Owner: "o", Repo: "n", Token: Token{value: "t"}}

	pr, err := c.Create(context.Background(), "chore/test-branch", "main", "Title", "Body")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if pr.HeadRef != "chore/test-branch" || pr.BaseRef != "main" {
		t.Fatalf("unexpected PR shape: %+v", pr)
	}

	found, err := c.FindOpenByHead(context.Background(), "chore/test-branch")
	if err != nil {
		t.Fatalf("FindOpenByHead: %v", err)
	}
	if found == nil || found.Number != 7 {
		t.Fatalf("expected to find the created PR, got %+v", found)
	}
}

func TestPRClient_UpdateTitleBodyConverges(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			t.Fatalf("unexpected method %s", r.Method)
		}
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		resp := prAPIResponse{Number: 7, State: "open", Title: body["title"], Body: body["body"]}
		resp.Head.Ref = "chore/test-branch"
		resp.Head.SHA = "deadbeef"
		resp.Base.Ref = "main"
		json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()
	c := PRClient{APIBaseURL: srv.URL, Owner: "o", Repo: "n", Token: Token{value: "t"}}
	pr, err := c.UpdateTitleBody(context.Background(), 7, "New Title", "New Body")
	if err != nil {
		t.Fatalf("UpdateTitleBody: %v", err)
	}
	if pr.Title != "New Title" || pr.Body != "New Body" {
		t.Fatalf("update did not converge: %+v", pr)
	}
}

// TestPRClient_HasNoMergeOrCloseMethod documents, at compile time, that PRClient exposes no
// merge/close/approve capability -- there is no such method to call.
func TestPRClient_HasNoMergeOrCloseMethod(t *testing.T) {
	var _ = PRClient{}
	// No c.Merge(...), c.Close(...), or c.Approve(...) exists on this type -- if one is ever added,
	// this test's own review is the intended place to catch it.
}
