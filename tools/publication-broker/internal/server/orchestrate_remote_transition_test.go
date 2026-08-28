package server

// Regression suite for DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R1-EXACT-REMOTE-TRANSITION.
//
// The Broker must authorize only one of two exact remote transitions: an EXISTING remote branch
// advancing from exactly envelope.expected_pre_publish_head to receipt.commit_sha, or an ABSENT
// remote branch being created only when expected_pre_publish_head == base_commit and commit_sha is
// its verified single child. A non-force push being a valid fast-forward from *whatever the remote
// currently happens to be* is necessary but NOT sufficient authorization -- the remote's observed
// state must additionally equal the exact value the Envelope actually authorized moving from.

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"path/filepath"
	"sync"
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

// countingMinter is a TokenMinter test double that records how many times each permission class
// was requested, so tests can assert a write-capable (Contents:write) token was NEVER minted on a
// path that must not push.
type countingMinter struct {
	mu         sync.Mutex
	token      string
	readCalls  int
	writeCalls int
}

func (m *countingMinter) Mint(ctx context.Context, repositoryName string, permissions map[string]string) (githubapp.Token, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if permissions["contents"] == "write" {
		m.writeCalls++
	} else {
		m.readCalls++
	}
	return githubapp.TokenFromRawForTests(m.token), nil
}

func (m *countingMinter) WriteCalls() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.writeCalls
}

// remoteTransitionDeps builds Deps wired to a real disposable local bare remote and a
// call-counting token minter, for exact-remote-transition tests.
func remoteTransitionDeps(t *testing.T, remoteDir string) (Deps, *grant.Store, *countingMinter) {
	t.Helper()
	gitBin := gitBinaryForTransitionTests(t)

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
	minter := &countingMinter{token: "tok"}
	home := t.TempDir()
	deps := Deps{
		GitBinary:   gitBin,
		Grants:      grants.Client(),
		Audit:       auditLog,
		TokenMinter: minter,
		PRClientFactory: func(tok githubapp.Token, owner, repo string) githubapp.PRClient {
			return githubapp.PRClient{APIBaseURL: "", Owner: "mihvernetwork", Repo: "mihver", Token: tok}
		},
		GitRemote:        gitremote.Client{Sterile: gitexec.Sterile{GitBinary: gitBin, Home: home}},
		RemoteURLBuilder: func(owner, name string) (string, error) { return remoteDir, nil },
	}
	return deps, grants, minter
}

func gitBinaryForTransitionTests(t *testing.T) string {
	t.Helper()
	path, err := exec.LookPath("git")
	if err != nil {
		t.Fatalf("git not found: %v", err)
	}
	return path
}

// graphPackage builds a raw PublicationPackage (Envelope + Receipt + bundle + manifest) whose
// Envelope declares exactly baseCommit/prePublishHead/commitSHA and exactly the given changed
// file, matching what scripts/dev/publication-builder.mjs + mihver-publish would actually produce
// for a real commit -- fingerprint computed over the true blob SHA at commitSHA.
type graphPackage struct {
	envelopeBytes, receiptBytes, bundleBytes, manifestBytes []byte
	envelope                                                *protocol.Envelope
}

func buildGraphPackage(t *testing.T, repo *testutil.Repo, branch, baseCommit, prePublishHead, commitSHA, changedFile, commitMessage string, prExpected bool) graphPackage {
	t.Helper()
	blobSHA := repo.BlobSHA(changedFile)

	h := sha256.New()
	h.Write([]byte(changedFile))
	h.Write([]byte{0})
	h.Write([]byte(blobSHA))
	h.Write([]byte("\n"))
	fp := hex.EncodeToString(h.Sum(nil))

	envelope := protocol.Envelope{
		ProtocolVersion:        protocol.ProtocolVersion,
		Repository:             protocol.Repository{RemoteName: "origin", Owner: "mihvernetwork", Name: "mihver"},
		Branch:                 branch,
		BaseBranch:             "main",
		BaseCommit:             baseCommit,
		ExpectedPrePublishHead: prePublishHead,
		AllowedFiles:           []protocol.AllowedFile{{Path: changedFile, Action: "present"}},
		PublicationFingerprint: fp,
		CommitMessage:          commitMessage,
		PRExpected:             prExpected,
	}
	if prExpected {
		envelope.PRTitle = "Test PR"
		envelope.PRBody = "body"
	}
	receipt := protocol.Receipt{
		Status: "COMMITTED", ProtocolVersion: protocol.ProtocolVersion, Repository: envelope.Repository,
		Branch: branch, BaseCommit: baseCommit, PrePublishHead: prePublishHead, Fingerprint: fp,
		CommitSHA: commitSHA, LocalHead: commitSHA, WorkingTree: "clean",
	}

	envelopeBytes, _ := json.Marshal(envelope)
	receiptBytes, _ := json.Marshal(receipt)
	bundleBytes := repo.BuildBundleForImport(t, commitSHA)
	manifest := protocol.PackageManifest{
		ProtocolVersion: protocol.ProtocolVersion,
		EnvelopeDigest:  testutil.Sha256Hex(envelopeBytes),
		ReceiptDigest:   testutil.Sha256Hex(receiptBytes),
		BundleDigest:    testutil.Sha256Hex(bundleBytes),
		CommitSHA:       commitSHA,
	}
	manifestBytes, _ := json.Marshal(manifest)

	return graphPackage{envelopeBytes, receiptBytes, bundleBytes, manifestBytes, &envelope}
}

func authorizeGraph(t *testing.T, grants *grant.Store, pkg graphPackage) string {
	t.Helper()
	req, err := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if err != nil {
		t.Fatalf("ParseRequest: %v", err)
	}
	digest := req.RequestDigest().Hex()
	if _, err := grants.Admin().Create(grant.CreateRequest{
		RequestDigest: digest, RepositoryOwner: pkg.envelope.Repository.Owner, RepositoryName: pkg.envelope.Repository.Name,
		Branch: pkg.envelope.Branch, BaseBranch: pkg.envelope.BaseBranch, BaseCommit: pkg.envelope.BaseCommit, TTL: time.Hour,
	}); err != nil {
		t.Fatalf("authorize: %v", err)
	}
	return digest
}

// httptestNewFailingServer returns a fake GitHub API server that always fails PR API calls (used to
// force Orchestrate to stop right after a successful push, leaving the grant IN_PROGRESS with an
// observed remote head, without needing pr_expected=false).
func httptestNewFailingServer(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
}

func remoteHeadNow(t *testing.T, gitBin, remoteDir, branch string) string {
	t.Helper()
	cmd := exec.Command(gitBin, "ls-remote", remoteDir, "refs/heads/"+branch)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("ls-remote: %v\n%s", err, out)
	}
	if len(out) == 0 {
		return ""
	}
	line := string(out)
	tab := 0
	for tab < len(line) && line[tab] != '\t' {
		tab++
	}
	return line[:tab]
}

// --- Test 1: existing remote branch at unauthorized ancestor ------------------------------------

func TestOrchestrate_ExistingBranchAtUnauthorizedAncestor_Blocked(t *testing.T) {
	repo := testutil.NewRepo(t)
	a := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", a)
	repo.WriteFile("b.txt", "b\n")
	repo.StageAll()
	b := repo.Commit("commit b")
	repo.WriteFile("c.txt", "c\n")
	repo.StageAll()
	c := repo.Commit("commit c")

	remoteDir := testutil.NewBareRemote(t)
	deps, grants, minter := remoteTransitionDeps(t, remoteDir)
	repo.PushTo(remoteDir, a, "chore/test-branch") // remote sits at the UNAUTHORIZED ancestor A

	pkg := buildGraphPackage(t, repo, "chore/test-branch", a, b, c, "c.txt", "commit c", false)
	digest := authorizeGraph(t, grants, pkg)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)

	if res.Status != "BLOCKED" {
		t.Fatalf("SECURITY DEFECT: expected BLOCKED, got %+v (an unauthorized intermediate commit may have been published)", res)
	}
	if res.FailureReason != "REMOTE_HEAD_CHANGED" {
		t.Fatalf("expected FailureReason REMOTE_HEAD_CHANGED, got %q", res.FailureReason)
	}
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, "chore/test-branch"); got != a {
		t.Fatalf("SECURITY DEFECT: remote branch must remain at A (%s), got %s -- unauthorized commit(s) were published", a, got)
	}
	if minter.WriteCalls() != 0 {
		t.Fatalf("SECURITY DEFECT: a write-capable (Contents:write) token was minted despite the transition never being authorized (writeCalls=%d)", minter.WriteCalls())
	}
	client := grants.Client()
	if _, err := client.BeginOrResume(digest); err != grant.ErrBlocked {
		t.Fatalf("expected the grant to have become terminally BLOCKED, got err=%v", err)
	}
}

// --- Test 2: missing remote branch with an unpublished intermediate commit ----------------------

func TestOrchestrate_MissingBranchWithUnpublishedIntermediateCommit_Blocked(t *testing.T) {
	repo := testutil.NewRepo(t)
	a := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", a)
	repo.WriteFile("b.txt", "b\n")
	repo.StageAll()
	b := repo.Commit("commit b")
	repo.WriteFile("c.txt", "c\n")
	repo.StageAll()
	c := repo.Commit("commit c")

	remoteDir := testutil.NewBareRemote(t)
	deps, grants, minter := remoteTransitionDeps(t, remoteDir) // remote left entirely absent

	pkg := buildGraphPackage(t, repo, "chore/test-branch", a, b, c, "c.txt", "commit c", false)
	authorizeGraph(t, grants, pkg)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)

	if res.Status != "BLOCKED" {
		t.Fatalf("SECURITY DEFECT: expected BLOCKED, got %+v (an absent branch published an unpublished multi-commit chain)", res)
	}
	if res.FailureReason != "REMOTE_HEAD_CHANGED" {
		t.Fatalf("expected FailureReason REMOTE_HEAD_CHANGED, got %q", res.FailureReason)
	}
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, "chore/test-branch"); got != "" {
		t.Fatalf("SECURITY DEFECT: remote branch must remain absent, got %s", got)
	}
	if minter.WriteCalls() != 0 {
		t.Fatalf("SECURITY DEFECT: a write-capable token was minted despite the transition never being authorized (writeCalls=%d)", minter.WriteCalls())
	}
}

// --- Test 3: safe new branch creation --------------------------------------------------------

func TestOrchestrate_SafeNewBranchCreation_Published(t *testing.T) {
	repo := testutil.NewRepo(t)
	a := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", a)
	repo.WriteFile("c.txt", "c\n")
	repo.StageAll()
	c := repo.Commit("commit c") // A -> C directly, no intermediate commit

	remoteDir := testutil.NewBareRemote(t)
	deps, grants, minter := remoteTransitionDeps(t, remoteDir) // remote absent

	pkg := buildGraphPackage(t, repo, "chore/test-branch", a, a, c, "c.txt", "commit c", false)
	authorizeGraph(t, grants, pkg)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)

	if res.Status != "PUBLISHED" {
		t.Fatalf("expected PUBLISHED for a safe new-branch creation, got %+v", res)
	}
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, "chore/test-branch"); got != c {
		t.Fatalf("expected remote branch to become C (%s), got %s", c, got)
	}
	if minter.WriteCalls() != 1 {
		t.Fatalf("expected exactly one write-capable token mint (one push), got %d", minter.WriteCalls())
	}
}

// --- Test 4: safe existing-branch advancement ------------------------------------------------

func TestOrchestrate_SafeExistingBranchAdvancement_Published(t *testing.T) {
	repo := testutil.NewRepo(t)
	a := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", a)
	repo.WriteFile("b.txt", "b\n")
	repo.StageAll()
	b := repo.Commit("commit b")
	repo.WriteFile("c.txt", "c\n")
	repo.StageAll()
	c := repo.Commit("commit c")

	remoteDir := testutil.NewBareRemote(t)
	deps, grants, minter := remoteTransitionDeps(t, remoteDir)
	repo.PushTo(remoteDir, b, "chore/test-branch") // remote already at the authorized predecessor B

	pkg := buildGraphPackage(t, repo, "chore/test-branch", a, b, c, "c.txt", "commit c", false)
	authorizeGraph(t, grants, pkg)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)

	if res.Status != "PUBLISHED" {
		t.Fatalf("expected PUBLISHED for a safe existing-branch advancement, got %+v", res)
	}
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, "chore/test-branch"); got != c {
		t.Fatalf("expected remote branch to become C (%s), got %s", c, got)
	}
	if minter.WriteCalls() != 1 {
		t.Fatalf("expected exactly one non-force push (one write-capable token mint), got %d", minter.WriteCalls())
	}
}

// --- Test 5: idempotent already-pushed retry -------------------------------------------------

func TestOrchestrate_IdempotentAlreadyPushedRetry_NoSecondPush(t *testing.T) {
	repo := testutil.NewRepo(t)
	a := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", a)
	repo.WriteFile("b.txt", "b\n")
	repo.StageAll()
	b := repo.Commit("commit b")
	repo.WriteFile("c.txt", "c\n")
	repo.StageAll()
	c := repo.Commit("commit c")

	remoteDir := testutil.NewBareRemote(t)
	deps, grants, minter := remoteTransitionDeps(t, remoteDir)
	// Simulate a previously-completed push (e.g. by an earlier Orchestrate call whose own grant
	// bookkeeping never persisted) -- the remote already sits at commit_sha itself.
	repo.PushTo(remoteDir, c, "chore/test-branch")

	pkg := buildGraphPackage(t, repo, "chore/test-branch", a, b, c, "c.txt", "commit c", false)
	authorizeGraph(t, grants, pkg)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)

	if res.Status != "PUBLISHED" {
		t.Fatalf("expected PUBLISHED (idempotent resume), got %+v", res)
	}
	if res.RemoteHead != c {
		t.Fatalf("expected remote head %s, got %s", c, res.RemoteHead)
	}
	if minter.WriteCalls() != 0 {
		t.Fatalf("expected zero write-capable token mints for an already-published remote (no push needed), got %d", minter.WriteCalls())
	}
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, "chore/test-branch"); got != c {
		t.Fatalf("remote head must remain unchanged at C, got %s", got)
	}
}

// --- Test 6: cross-call retry drift after a successful push -------------------------------------
//
// IMPORTANT SCOPE NOTE (corrected after independent review): this test proves CROSS-CALL retry
// drift detection -- an external actor retargets the remote BETWEEN two separate Orchestrate calls,
// and the second call's own fresh observation catches it. It does NOT exercise, and must not be
// read as proving, the narrower INTRA-CALL race where the remote moves in the microscopic window
// between GitRemote.Push's own internal RemoteHead check (gitremote.go's Push, immediately before
// it shells out to `git push`) and that subprocess actually running. That narrower window is
// covered by internal/gitremote's own TestPush_NonFastForwardRaceBlocked, which retargets the
// remote directly between two Push-adjacent calls and confirms ErrRemoteHeadChanged. Deliberately
// not independently re-proven here: Deps.GitRemote is a concrete gitremote.Client (not an
// interface), so injecting a synchronization hook between Push's internal check and its `git push`
// subprocess call, from an orchestrate-level test, would require adding a test-only seam to
// production code that nothing else needs -- judged not worth the interface change for this round;
// TestPush_NonFastForwardRaceBlocked already gives real, non-mocked coverage of that exact
// mechanism (git's own server-side fast-forward rejection), just at the gitremote layer instead of
// through Orchestrate.
func TestOrchestrate_RetryDetectsExternalRemoteDriftAfterPushSucceeds(t *testing.T) {
	prServer := httptestNewFailingServer(t)
	defer prServer.Close()

	repo := testutil.NewRepo(t)
	a := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", a)
	repo.WriteFile("b.txt", "b\n")
	repo.StageAll()
	b := repo.Commit("commit b")

	remoteDir := testutil.NewBareRemote(t)
	deps, grants, _ := remoteTransitionDeps(t, remoteDir)
	deps.PRClientFactory = func(tok githubapp.Token, owner, repo string) githubapp.PRClient {
		return githubapp.PRClient{APIBaseURL: prServer.URL, Owner: "mihvernetwork", Repo: "mihver", Token: tok}
	}
	repo.PushTo(remoteDir, a, "chore/test-branch")

	// First package: A -> B (authorized predecessor A == base_commit), pr_expected so the PR step
	// (which always fails against prServer) leaves the grant IN_PROGRESS after a successful push.
	firstPkg := buildGraphPackage(t, repo, "chore/test-branch", a, a, b, "b.txt", "commit b", true)
	authorizeGraph(t, grants, firstPkg)
	first := Orchestrate(context.Background(), deps, firstPkg.envelopeBytes, firstPkg.receiptBytes, firstPkg.bundleBytes, firstPkg.manifestBytes)
	if first.Status != "BLOCKED" {
		t.Fatalf("expected the first attempt to BLOCK at the PR step (push should have already succeeded), got %+v", first)
	}
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, "chore/test-branch"); got != b {
		t.Fatalf("expected the push to have succeeded and advanced the remote to B (%s), got %s", b, got)
	}

	// External actor retargets the remote directly -- simulates drift landing between the earlier
	// successful push and this retry, without going through this module's own Push at all.
	other := testutil.NewRepo(t)
	externalHead := other.Head()
	testutil.FetchAndSetRef(t, remoteDir, other.Dir, externalHead, "chore/test-branch")

	// Retry the SAME first package (same digest, still IN_PROGRESS) -- must detect the drift.
	retry := Orchestrate(context.Background(), deps, firstPkg.envelopeBytes, firstPkg.receiptBytes, firstPkg.bundleBytes, firstPkg.manifestBytes)
	if retry.Status != "BLOCKED" || retry.FailureReason != "REMOTE_HEAD_CHANGED" {
		t.Fatalf("expected the retry to detect the race/drift and BLOCK/REMOTE_HEAD_CHANGED, got %+v", retry)
	}
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, "chore/test-branch"); got != externalHead {
		t.Fatalf("SECURITY DEFECT: remote must remain exactly at the externally-set head (%s) after a BLOCKED retry, got %s", externalHead, got)
	}
}

// =================================================================================================
// Hardening R1.1 -- atomic remote CAS (DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R1.1-ATOMIC-REMOTE-CAS)
// =================================================================================================

// remoteTransitionDepsWithRacyGitRemote is remoteTransitionDeps, except Deps.GitRemote's underlying
// runner is wrapped in a testutil.RaceInjectingRunner so a test can deterministically mutate the
// bare remote at the exact boundary between GitRemote.Push's internal pre-check and the real `git
// push` subprocess it is about to issue.
func remoteTransitionDepsWithRacyGitRemote(t *testing.T, remoteDir string, mutate func()) (Deps, *grant.Store, *countingMinter) {
	t.Helper()
	deps, grants, minter := remoteTransitionDeps(t, remoteDir)
	real := deps.GitRemote.Sterile
	deps.GitRemote = gitremote.Client{Sterile: &testutil.RaceInjectingRunner{Real: real, Mutate: mutate}}
	return deps, grants, minter
}

// Test 6 (R1.1) -- the verifier's exact-parent gate blocks an invalid parent/ancestry commit even
// when the remote already happens to sit exactly where a lease would accept it, proving the atomic
// lease is not a substitute for -- and cannot be reached before -- local authorization. Constructs a
// real commit X whose actual git parent is A (not B), while the Envelope/Receipt falsely claim
// pre_publish_head=B; the remote is placed at B (i.e. would satisfy Case 2's lease precondition), so
// if the local authorization gate were bypassable this would otherwise reach and pass Push.
func TestOrchestrate_VerifierGateBlocksInvalidParentEvenWhenRemoteMatchesLease(t *testing.T) {
	repo := testutil.NewRepo(t)
	a := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", a)
	repo.WriteFile("b.txt", "b\n")
	repo.StageAll()
	b := repo.Commit("commit b")

	// X is a sibling of B: its real git parent is A, not B.
	repo.SwitchNewBranch("sibling", a)
	repo.WriteFile("x.txt", "x\n")
	repo.StageAll()
	x := repo.Commit("commit x")

	remoteDir := testutil.NewBareRemote(t)
	deps, grants, minter := remoteTransitionDeps(t, remoteDir)
	repo.PushTo(remoteDir, b, "chore/test-branch") // remote sits at B -- would satisfy a lease bound to B

	// Envelope/Receipt lie: they declare pre_publish_head=B (matching the remote) for commit X,
	// whose actual parent is A.
	pkg := buildGraphPackage(t, repo, "chore/test-branch", a, b, x, "x.txt", "commit x", false)
	authorizeGraph(t, grants, pkg)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)

	if res.Status != "BLOCKED" {
		t.Fatalf("SECURITY DEFECT: expected BLOCKED (invalid parent), got %+v", res)
	}
	if minter.WriteCalls() != 0 {
		t.Fatalf("SECURITY DEFECT: a write-capable token was minted despite the verifier's parent check never having passed (writeCalls=%d) -- Push must be unreachable here", minter.WriteCalls())
	}
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, "chore/test-branch"); got != b {
		t.Fatalf("SECURITY DEFECT: remote must remain unchanged at B (%s), got %s -- an invalid-parent commit was published", b, got)
	}
}

// Test 7 (R1.1) -- the full orchestration flow maps an atomic-lease race (detected inside
// GitRemote.Push via the deterministic race seam) to a terminal BLOCKED/REMOTE_HEAD_CHANGED result,
// with the grant transitioned to terminal BLOCKED, the remote left at the competing actor's value,
// and no PR create/update call made.
func TestOrchestrate_AtomicLeaseRaceMapsToTerminalBlock(t *testing.T) {
	var prCalls int
	prServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prCalls++
		w.WriteHeader(http.StatusOK)
	}))
	defer prServer.Close()

	repo := testutil.NewRepo(t)
	a := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", a)
	repo.WriteFile("b.txt", "b\n")
	repo.StageAll()
	b := repo.Commit("commit b")
	repo.WriteFile("c.txt", "c\n")
	repo.StageAll()
	c := repo.Commit("commit c")

	remoteDir := testutil.NewBareRemote(t)

	other := testutil.NewRepo(t)
	otherHead := other.Head()

	var deps Deps
	var grants *grant.Store
	deps, grants, _ = remoteTransitionDepsWithRacyGitRemote(t, remoteDir, func() {
		// Land exactly between Push's pre-check (which will have observed B) and the real `git
		// push` subprocess: rewind the remote to an unrelated competing commit.
		testutil.FetchAndSetRef(t, remoteDir, other.Dir, otherHead, "chore/test-branch")
	})
	deps.PRClientFactory = func(tok githubapp.Token, owner, repo string) githubapp.PRClient {
		return githubapp.PRClient{APIBaseURL: prServer.URL, Owner: "mihvernetwork", Repo: "mihver", Token: tok}
	}
	repo.PushTo(remoteDir, b, "chore/test-branch") // remote starts at the authorized predecessor B

	pkg := buildGraphPackage(t, repo, "chore/test-branch", a, b, c, "c.txt", "commit c", true)
	digest := authorizeGraph(t, grants, pkg)

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)

	if res.Status != "BLOCKED" || res.FailureReason != "REMOTE_HEAD_CHANGED" {
		t.Fatalf("SECURITY DEFECT: expected BLOCKED/REMOTE_HEAD_CHANGED, got %+v", res)
	}
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, "chore/test-branch"); got != otherHead {
		t.Fatalf("SECURITY DEFECT: remote must remain at the competing actor's value (%s), got %s", otherHead, got)
	}
	if prCalls != 0 {
		t.Fatalf("expected zero PR API calls after an atomic-lease race BLOCKED the publish, got %d", prCalls)
	}
	client := grants.Client()
	if _, err := client.BeginOrResume(digest); err != grant.ErrBlocked {
		t.Fatalf("expected the grant to have become terminally BLOCKED, got err=%v", err)
	}
}

// Test 8 (R1.1) -- idempotent already-published retry behavior is unchanged by the atomic-lease
// mechanism: TestOrchestrate_IdempotentAlreadyPushedRetry_NoSecondPush (above, from Round 1) already
// proves this -- when the fresh observation already equals receipt.commit_sha, Orchestrate's Case 1
// short-circuit returns before ever calling GitRemote.Push, so the lease is never constructed or
// evaluated at all. No separate test is added here to avoid duplicating that exact coverage; this
// comment exists so R1.1's own required-test list is traceable to where it is actually satisfied.
