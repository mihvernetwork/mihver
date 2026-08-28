package server

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"mihver.network/publication-broker/internal/audit"
	"mihver.network/publication-broker/internal/gitexec"
	"mihver.network/publication-broker/internal/githubapp"
	"mihver.network/publication-broker/internal/gitremote"
	"mihver.network/publication-broker/internal/grant"
	"mihver.network/publication-broker/internal/protocol"
	"mihver.network/publication-broker/internal/testutil"
)

type fakeMinter struct{ token string }

func (f fakeMinter) Mint(ctx context.Context, repositoryName string, permissions map[string]string) (githubapp.Token, error) {
	return githubapp.TokenFromRawForTests(f.token), nil
}

func gitBinary(t *testing.T) string {
	t.Helper()
	path, err := exec.LookPath("git")
	if err != nil {
		t.Fatalf("git not found: %v", err)
	}
	return path
}

func sha256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

type buildResult struct {
	envelopeBytes, receiptBytes, bundleBytes, manifestBytes []byte
	envelope                                                *protocol.Envelope
	commitSHA, baseSHA                                      string
}

func buildPackage(t *testing.T, repo *testutil.Repo, prExpected bool) buildResult {
	t.Helper()
	base := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", base)
	repo.WriteFile("new.txt", "hello\n")
	repo.StageAll()
	commitSHA := repo.Commit("test commit")
	blobSHA := repo.BlobSHA("new.txt")

	h := sha256.New()
	h.Write([]byte("new.txt"))
	h.Write([]byte{0})
	h.Write([]byte(blobSHA))
	h.Write([]byte("\n"))
	fp := hex.EncodeToString(h.Sum(nil))

	envelope := protocol.Envelope{
		ProtocolVersion: protocol.ProtocolVersion,
		Repository:      protocol.Repository{RemoteName: "origin", Owner: "mihvernetwork", Name: "mihver"},
		Branch:          "chore/test-branch", BaseBranch: "main", BaseCommit: base, ExpectedPrePublishHead: base,
		AllowedFiles:           []protocol.AllowedFile{{Path: "new.txt", Action: "present"}},
		PublicationFingerprint: fp, CommitMessage: "test commit", PRExpected: prExpected,
	}
	if prExpected {
		envelope.PRTitle = "Test PR"
		envelope.PRBody = "body"
	}
	receipt := protocol.Receipt{
		Status: "COMMITTED", ProtocolVersion: protocol.ProtocolVersion, Repository: envelope.Repository,
		Branch: envelope.Branch, BaseCommit: base, PrePublishHead: base, Fingerprint: fp,
		CommitSHA: commitSHA, LocalHead: commitSHA, WorkingTree: "clean",
	}

	envelopeBytes, _ := json.Marshal(envelope)
	receiptBytes, _ := json.Marshal(receipt)
	bundleBytes := repo.BuildBundleForImport(t, commitSHA)
	manifest := protocol.PackageManifest{
		ProtocolVersion: protocol.ProtocolVersion,
		EnvelopeDigest:  sha256Hex(envelopeBytes),
		ReceiptDigest:   sha256Hex(receiptBytes),
		BundleDigest:    sha256Hex(bundleBytes),
		CommitSHA:       commitSHA,
	}
	manifestBytes, _ := json.Marshal(manifest)

	return buildResult{envelopeBytes, receiptBytes, bundleBytes, manifestBytes, &envelope, commitSHA, base}
}

func newDeps(t *testing.T, remoteDir, token string, prServerURL string) (Deps, *grant.Store) {
	t.Helper()
	grantPath := filepath.Join(t.TempDir(), "grants.json")
	grants, err := grant.Open(grantPath)
	if err != nil {
		t.Fatalf("grant.Open: %v", err)
	}
	auditPath := filepath.Join(t.TempDir(), "audit.jsonl")
	auditLog, err := audit.Open(auditPath)
	if err != nil {
		t.Fatalf("audit.Open: %v", err)
	}
	home := t.TempDir()
	deps := Deps{
		GitBinary:   gitBinary(t),
		Grants:      grants.Client(),
		Audit:       auditLog,
		TokenMinter: fakeMinter{token: token},
		PRClientFactory: func(tok githubapp.Token, owner, repo string) githubapp.PRClient {
			return githubapp.PRClient{APIBaseURL: prServerURL, Owner: owner, Repo: repo, Token: tok}
		},
		GitRemote:        gitremote.Client{Sterile: gitexec.Sterile{GitBinary: gitBinary(t), Home: home}},
		RemoteURLBuilder: func(owner, name string) (string, error) { return remoteDir, nil },
	}
	return deps, grants
}

func authorize(t *testing.T, grants *grant.Store, digest string, env *protocol.Envelope) *grant.Grant {
	t.Helper()
	g, err := grants.Admin().Create(grant.CreateRequest{
		RequestDigest: digest, RepositoryOwner: env.Repository.Owner, RepositoryName: env.Repository.Name,
		Branch: env.Branch, BaseBranch: env.BaseBranch, BaseCommit: env.BaseCommit, TTL: time.Hour,
	})
	if err != nil {
		t.Fatalf("authorize (admin create grant): %v", err)
	}
	return g
}

func TestOrchestrate_BlockedWithoutGrant(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, false)
	remoteDir := testutil.NewBareRemote(t)
	deps, _ := newDeps(t, remoteDir, "tok", "")

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if res.Status != "BLOCKED" || res.FailureReason != "NO_GRANT" {
		t.Fatalf("expected BLOCKED NO_GRANT, got %+v", res)
	}
}

func TestOrchestrate_PublishedNoPR(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, false)
	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", "")

	req, err := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if err != nil {
		t.Fatalf("ParseRequest: %v", err)
	}
	digest := req.RequestDigest().Hex()
	authorize(t, grants, digest, pkg.envelope)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if res.Status != "PUBLISHED" {
		t.Fatalf("expected PUBLISHED, got %+v", res)
	}
	if res.RemoteHead != pkg.commitSHA {
		t.Fatalf("unexpected remote head: %s", res.RemoteHead)
	}
	if res.PRNumber != 0 {
		t.Fatalf("expected no PR number, got %d", res.PRNumber)
	}
}

func TestOrchestrate_PRExpectedFalseMakesZeroPRCalls(t *testing.T) {
	prCalls := 0
	prServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prCalls++
	}))
	defer prServer.Close()

	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, false)
	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", prServer.URL)

	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	authorize(t, grants, req.RequestDigest().Hex(), pkg.envelope)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if res.Status != "PUBLISHED" {
		t.Fatalf("expected PUBLISHED, got %+v", res)
	}
	if prCalls != 0 {
		t.Fatalf("pr_expected=false must make zero PR API calls, got %d", prCalls)
	}
}

func TestOrchestrate_PublishedWithPR_CreatesPR(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, true) // commit SHA is now known, so the fake server can echo it correctly

	var createCalls, listCalls int
	var lastCreateBody map[string]string
	prServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			listCalls++
			json.NewEncoder(w).Encode([]map[string]any{})
		case http.MethodPost:
			createCalls++
			json.NewDecoder(r.Body).Decode(&lastCreateBody)
			resp := map[string]any{"number": 42, "state": "open", "title": lastCreateBody["title"], "body": lastCreateBody["body"]}
			resp["head"] = map[string]string{"ref": lastCreateBody["head"], "sha": pkg.commitSHA}
			resp["base"] = map[string]string{"ref": lastCreateBody["base"]}
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(resp)
		}
	}))
	defer prServer.Close()

	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", prServer.URL)

	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	authorize(t, grants, req.RequestDigest().Hex(), pkg.envelope)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if res.Status != "PUBLISHED" {
		t.Fatalf("expected PUBLISHED, got %+v", res)
	}
	if res.PRNumber != 42 {
		t.Fatalf("expected PR number 42, got %d", res.PRNumber)
	}
	if listCalls == 0 {
		t.Fatalf("expected FindOpenByHead to have searched for an existing PR before creating one")
	}
	if createCalls != 1 {
		t.Fatalf("expected exactly one PR create call, got %d", createCalls)
	}
	if lastCreateBody["title"] != "Test PR" || lastCreateBody["body"] != "body" {
		t.Fatalf("PR created with unexpected title/body: %+v", lastCreateBody)
	}
}

func TestOrchestrate_AmbiguousExistingPRBlocked(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, true)
	prServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode([]map[string]any{{"number": 1}, {"number": 2}})
	}))
	defer prServer.Close()
	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", prServer.URL)
	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	authorize(t, grants, req.RequestDigest().Hex(), pkg.envelope)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if res.Status != "BLOCKED" || res.FailureReason != "AMBIGUOUS_PR" {
		t.Fatalf("expected BLOCKED AMBIGUOUS_PR, got %+v", res)
	}
}

func TestOrchestrate_ExistingPRBaseMismatchBlocked(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, true)
	prServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("expected only a GET (list) call, PR base mismatch must stop before any write")
		}
		resp := map[string]any{"number": 5, "state": "open"}
		resp["head"] = map[string]string{"ref": pkg.envelope.Branch, "sha": pkg.commitSHA}
		resp["base"] = map[string]string{"ref": "some-other-base"}
		json.NewEncoder(w).Encode([]map[string]any{resp})
	}))
	defer prServer.Close()
	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", prServer.URL)
	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	authorize(t, grants, req.RequestDigest().Hex(), pkg.envelope)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if res.Status != "BLOCKED" || res.FailureReason != "PR_BASE_MISMATCH" {
		t.Fatalf("expected BLOCKED PR_BASE_MISMATCH, got %+v", res)
	}
}

func TestOrchestrate_ExistingPRDeterministicallyUpdated(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, true)
	var updateCalls int
	prServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			resp := map[string]any{"number": 5, "state": "open", "title": "stale title", "body": "stale body"}
			resp["head"] = map[string]string{"ref": pkg.envelope.Branch, "sha": pkg.commitSHA}
			resp["base"] = map[string]string{"ref": pkg.envelope.BaseBranch}
			json.NewEncoder(w).Encode([]map[string]any{resp})
		case http.MethodPatch:
			updateCalls++
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			resp := map[string]any{"number": 5, "state": "open", "title": body["title"], "body": body["body"]}
			resp["head"] = map[string]string{"ref": pkg.envelope.Branch, "sha": pkg.commitSHA}
			resp["base"] = map[string]string{"ref": pkg.envelope.BaseBranch}
			json.NewEncoder(w).Encode(resp)
		default:
			t.Fatalf("unexpected method %s -- Broker must never approve/merge/close a PR", r.Method)
		}
	}))
	defer prServer.Close()
	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", prServer.URL)
	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	authorize(t, grants, req.RequestDigest().Hex(), pkg.envelope)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if res.Status != "PUBLISHED" || res.PRNumber != 5 {
		t.Fatalf("expected PUBLISHED with PR 5 (reused), got %+v", res)
	}
	if updateCalls != 1 {
		t.Fatalf("expected exactly one PATCH (title/body convergence) call, got %d", updateCalls)
	}
}

func TestOrchestrate_IdempotentRetryAfterPushSucceedsPRFails(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, true)

	prCallCount := 0
	prServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prCallCount++
		if r.Method == http.MethodGet {
			json.NewEncoder(w).Encode([]map[string]any{})
			return
		}
		// First POST attempt fails; second attempt (the retry) succeeds.
		if prCallCount <= 2 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		resp := map[string]any{"number": 99, "state": "open", "title": body["title"], "body": body["body"]}
		resp["head"] = map[string]string{"ref": body["head"], "sha": pkg.commitSHA}
		resp["base"] = map[string]string{"ref": body["base"]}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(resp)
	}))
	defer prServer.Close()

	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", prServer.URL)

	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	digest := req.RequestDigest().Hex()
	authorize(t, grants, digest, pkg.envelope)

	first := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if first.Status != "BLOCKED" {
		t.Fatalf("expected first attempt to BLOCK on PR failure, got %+v", first)
	}

	// Confirm the push already landed despite the PR failure (this is the scenario Section 13
	// describes) -- retry must not push again / must not error as a conflict.
	client := grants.Client()
	g, err := client.BeginOrResume(digest)
	if err != nil {
		t.Fatalf("BeginOrResume for inspection: %v", err)
	}
	if g.RemoteHeadObserved == "" {
		t.Fatalf("expected the earlier push to have recorded a remote head despite the PR failure")
	}

	// The actual retry: identical request, same digest. Must converge to PUBLISHED without
	// re-pushing (this is what the fresh-remote-observation fix in Orchestrate proves: it does not
	// push again because it freshly observes the remote already has the authorized commit).
	second := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if second.Status != "PUBLISHED" || second.PRNumber != 99 {
		t.Fatalf("expected the retry to converge to PUBLISHED with PR 99, got %+v", second)
	}
	if second.RemoteHead != pkg.commitSHA {
		t.Fatalf("expected the retry's remote head to still be the original pushed commit (no re-push), got %s", second.RemoteHead)
	}
}

func TestOrchestrate_ResumeDetectsUnexpectedRemoteDriftAfterPartialFailure(t *testing.T) {
	// Regression test for a reviewer-confirmed finding: a retry resuming an IN_PROGRESS grant (push
	// already succeeded once, PR step still pending) must freshly re-observe the remote and BLOCK on
	// real drift (an unexpected commit now sitting on the branch), rather than trusting a cached
	// RemoteHeadObserved value and proceeding straight to the PR step.
	prServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError) // PR step always fails, leaving the grant IN_PROGRESS
	}))
	defer prServer.Close()

	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, true)
	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", prServer.URL)

	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	digest := req.RequestDigest().Hex()
	authorize(t, grants, digest, pkg.envelope)

	first := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if first.Status != "BLOCKED" {
		t.Fatalf("expected first attempt to BLOCK on the PR step, got %+v", first)
	}
	client := grants.Client()
	g, err := client.BeginOrResume(digest)
	if err != nil || g.RemoteHeadObserved == "" {
		t.Fatalf("expected the push to have already succeeded and been recorded: g=%+v err=%v", g, err)
	}

	// Simulate an external actor moving the remote branch after that successful push, directly via
	// plumbing on the bare "remote" -- bypassing this module's own push path entirely.
	other := testutil.NewRepo(t)
	otherHead := other.Head()
	fetchCmd := exec.Command("git", "fetch", other.Dir, otherHead)
	fetchCmd.Dir = remoteDir
	if out, err := fetchCmd.CombinedOutput(); err != nil {
		t.Fatalf("setup: fetch unrelated commit into remote: %v %s", err, out)
	}
	updateRefCmd := exec.Command("git", "update-ref", "refs/heads/"+pkg.envelope.Branch, otherHead)
	updateRefCmd.Dir = remoteDir
	if out, err := updateRefCmd.CombinedOutput(); err != nil {
		t.Fatalf("setup: retarget remote branch: %v %s", err, out)
	}

	retry := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if retry.Status != "BLOCKED" || retry.FailureReason != "REMOTE_HEAD_CHANGED" {
		t.Fatalf("expected the retry to detect remote drift and BLOCKED/REMOTE_HEAD_CHANGED, got %+v", retry)
	}
}

func TestOrchestrate_DifferentRequestCannotReuseGrant(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, false)
	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", "")

	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	authorize(t, grants, req.RequestDigest().Hex(), pkg.envelope)

	// Mutate the envelope by one byte (commit message) -- a genuinely different request, therefore
	// a genuinely different digest, therefore no grant.
	mutatedEnvelopeBytes := append([]byte{}, pkg.envelopeBytes...)
	mutatedEnvelopeBytes = []byte(replaceOnce(string(mutatedEnvelopeBytes), "test commit", "different commit"))

	res := Orchestrate(context.Background(), deps, mutatedEnvelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if res.Status != "BLOCKED" {
		t.Fatalf("expected a mutated request to be BLOCKED (no matching grant or fingerprint mismatch), got %+v", res)
	}
}

func replaceOnce(s, old, new string) string {
	idx := indexOf(s, old)
	if idx == -1 {
		return s
	}
	return s[:idx] + new + s[idx+len(old):]
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

// --- B1: production PRClientFactory composition ------------------------------------------------
//
// Regression coverage for a confirmed defect: cmd/mihver-broker/main.go's production
// Deps.PRClientFactory used to build a githubapp.PRClient without ever setting Owner/Repo, so every
// production PR request silently targeted /repos///pulls. PRClientFactory's signature now requires
// the caller (Orchestrate, in runPRFinalizationPhase) to pass the trusted, Envelope-derived
// owner/repo on every call -- these tests prove (a) Orchestrate passes the EXACT Envelope-derived
// values to a production-shaped factory, (b) a real httptest.Server-backed PRClient built from those
// values issues requests to the correctly-shaped path, and (c) the assertion technique itself would
// have caught the old defect (a factory that ignores its owner/repo parameters, simulating the old
// broken composition, produces the /repos///pulls-shaped path).

// prodShapedPRClientFactory mirrors exactly how cmd/mihver-broker/main.go composes its production
// PRClientFactory (Owner/Repo set from the factory's own parameters, never from an untrusted PR API
// response) -- the only difference from production is the injected APIBaseURL, which points at a
// local httptest.Server instead of https://api.github.com.
func prodShapedPRClientFactory(apiBaseURL string) PRClientFactory {
	return func(token githubapp.Token, owner, repo string) githubapp.PRClient {
		return githubapp.PRClient{APIBaseURL: apiBaseURL, Owner: owner, Repo: repo, Token: token}
	}
}

func TestOrchestrate_PRClientFactoryReceivesExactEnvelopeOwnerRepo(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, true) // PR-expected flow, so Phase B runs

	var gotOwner, gotRepo string
	var calls int
	prServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			json.NewEncoder(w).Encode([]map[string]any{})
		case http.MethodPost:
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			resp := map[string]any{"number": 7, "state": "open", "title": body["title"], "body": body["body"]}
			resp["head"] = map[string]string{"ref": body["head"], "sha": pkg.commitSHA}
			resp["base"] = map[string]string{"ref": body["base"]}
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(resp)
		}
	}))
	defer prServer.Close()

	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", prServer.URL)
	// Wrap a production-shaped factory that also captures exactly what Orchestrate called it with.
	inner := prodShapedPRClientFactory(prServer.URL)
	deps.PRClientFactory = func(token githubapp.Token, owner, repo string) githubapp.PRClient {
		calls++
		gotOwner, gotRepo = owner, repo
		return inner(token, owner, repo)
	}

	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	authorize(t, grants, req.RequestDigest().Hex(), pkg.envelope)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if res.Status != "PUBLISHED" {
		t.Fatalf("expected PUBLISHED, got %+v", res)
	}
	if calls != 1 {
		t.Fatalf("expected PRClientFactory to be called exactly once, got %d", calls)
	}
	if gotOwner != pkg.envelope.Repository.Owner || gotRepo != pkg.envelope.Repository.Name {
		t.Fatalf("expected PRClientFactory to receive Envelope-derived owner=%q repo=%q, got owner=%q repo=%q",
			pkg.envelope.Repository.Owner, pkg.envelope.Repository.Name, gotOwner, gotRepo)
	}
}

func TestOrchestrate_ProductionShapedPRClientHitsCorrectRepoPath(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, true)

	owner, name := pkg.envelope.Repository.Owner, pkg.envelope.Repository.Name
	wantListPrefix := fmt.Sprintf("/repos/%s/%s/pulls", owner, name)
	wantCreatePath := fmt.Sprintf("/repos/%s/%s/pulls", owner, name)

	var sawList, sawCreate bool
	prServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			if !strings.HasPrefix(r.URL.Path, wantListPrefix) {
				t.Errorf("expected list request path to start with %q, got %q", wantListPrefix, r.URL.Path)
			}
			// Path (with query) must never be the broken /repos///pulls shape.
			if strings.Contains(r.URL.String(), "/repos///") {
				t.Errorf("SECURITY DEFECT: list request hit the broken /repos///pulls shape: %s", r.URL.String())
			}
			sawList = true
			json.NewEncoder(w).Encode([]map[string]any{})
		case http.MethodPost:
			if r.URL.Path != wantCreatePath {
				t.Errorf("expected create request path %q, got %q", wantCreatePath, r.URL.Path)
			}
			sawCreate = true
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			resp := map[string]any{"number": 11, "state": "open", "title": body["title"], "body": body["body"]}
			resp["head"] = map[string]string{"ref": body["head"], "sha": pkg.commitSHA}
			resp["base"] = map[string]string{"ref": body["base"]}
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(resp)
		}
	}))
	defer prServer.Close()

	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", prServer.URL)
	deps.PRClientFactory = prodShapedPRClientFactory(prServer.URL)

	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	authorize(t, grants, req.RequestDigest().Hex(), pkg.envelope)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if res.Status != "PUBLISHED" || res.PRNumber != 11 {
		t.Fatalf("expected PUBLISHED with PR 11, got %+v", res)
	}
	if !sawList || !sawCreate {
		t.Fatalf("expected both a list and a create request to reach the fake PR server: list=%v create=%v", sawList, sawCreate)
	}
}

// TestPRClient_EmptyOwnerRepoProducesBrokenPath is a regression-style test proving the assertion
// technique above is sound: a factory that IGNORES its owner/repo parameters and returns a
// githubapp.PRClient with empty Owner/Repo (simulating the OLD broken main.go composition, before
// the prior round's fix) used to silently produce the /repos///pulls-shaped path. As of V3.1-B
// Closeout Pack A.1, internal/githubapp.PRClient itself now validates Owner/Repo via
// internal/repoidentity before ANY HTTP request -- a stronger guarantee than merely avoiding the
// broken path shape: an empty (or otherwise invalid) Owner/Repo now reaches the PR API zero times at
// all, and Orchestrate must report a stable, non-PUBLISHED failure rather than silently proceeding.
func TestPRClient_EmptyOwnerRepoProducesBrokenPath(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, true)

	var prCalls int32
	prServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&prCalls, 1)
		t.Errorf("SECURITY DEFECT: PR API reached with an invalid (empty) Owner/Repo: %s %s", r.Method, r.URL)
	}))
	defer prServer.Close()

	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", prServer.URL)
	// Deliberately IGNORE the owner/repo parameters -- this is the pre-fix defect shape.
	deps.PRClientFactory = func(token githubapp.Token, _, _ string) githubapp.PRClient {
		return githubapp.PRClient{APIBaseURL: prServer.URL, Token: token}
	}

	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	authorize(t, grants, req.RequestDigest().Hex(), pkg.envelope)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if res.Status == "PUBLISHED" {
		t.Fatalf("SECURITY DEFECT: expected a non-PUBLISHED result for an invalid (empty) Owner/Repo, got %+v", res)
	}
	if atomic.LoadInt32(&prCalls) != 0 {
		t.Fatalf("SECURITY DEFECT: expected zero PR API calls for an invalid (empty) Owner/Repo, got %d", prCalls)
	}
}
