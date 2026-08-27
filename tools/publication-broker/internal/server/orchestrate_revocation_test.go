package server

// Regression suite for DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R2-LINEARIZABLE-GRANT-REVOCATION.
//
// The Broker must guarantee: once AdminHandle.Revoke returns success, no new write-capable token
// mint, Git push, PR create, or PR update for that Grant may begin. Every test here uses real
// disposable git repositories/bare remotes and, for the deterministic interleavings that matter,
// channel-based synchronization -- never a sleep to force a specific ordering. A small number of
// tests (TestOrchestrate_DifferentGrantsAreNotSerialized) use a single short, non-correctness-critical
// time.Sleep purely to give an unrelated goroutine a head start before an independent bounded
// time.After assertion; no test's PASS/FAIL correctness depends on sleep timing winning a race.

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"mihver.network/publication-broker/internal/githubapp"
	"mihver.network/publication-broker/internal/grant"
	"mihver.network/publication-broker/internal/protocol"
	"mihver.network/publication-broker/internal/testutil"
)

// --- Required Defect Reproduction ----------------------------------------------------------------
//
// TestOrchestrate_LiveRevocationDefect_ReproducedAgainstPreFixBehavior does not run against the
// current (fixed) Orchestrate -- it directly exercises the exact vulnerable sequence the pre-fix
// implementation performed (BeginOrResume once, then proceed straight to the token mint/push using
// that single stale snapshot, never re-checking live Grant state), using the SAME real
// repo/remote/grant-store fixtures the fixed tests below use, to prove the defect was real. See the
// completion report's "Live Revocation Defect Reproduction" section for the exact sequence and
// observed pre-fix result; keeping a literal "pre-fix mode" flag in production Orchestrate was
// deliberately avoided (this round's own instructions permit that), so this test reconstructs only
// the vulnerable subsequence directly against grant.ClientHandle/TokenMinter/GitRemote, not a copy
// of the whole Orchestrate function.
func TestOrchestrate_LiveRevocationDefect_ReproducedAgainstPreFixBehavior(t *testing.T) {
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

	client := grants.Client()
	stale, err := client.BeginOrResume(digest) // the exact single snapshot the pre-fix code relied on
	if err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}

	// Revoke lands here -- exactly the window the pre-fix code never re-checked.
	if err := grants.Admin().Revoke(stale.GrantID); err != nil {
		t.Fatalf("Revoke: %v", err)
	}

	// Pre-fix vulnerable subsequence: proceed straight to the write-capable token mint and push
	// using ONLY the stale pre-revocation snapshot, exactly as the pre-fix Orchestrate did (it never
	// called anything equivalent to AdmitPublicationPhase).
	writeToken, err := deps.TokenMinter.Mint(context.Background(), pkg.envelope.Repository.Name, githubapp.TargetPermissions)
	if err != nil {
		t.Fatalf("token mint (pre-fix path): %v", err)
	}
	after, pushErr := deps.GitRemote.Push(context.Background(), repo.Dir, remoteDir, pkg.envelope.Branch, pkg.commitSHA, "", writeToken.Raw())

	if pushErr != nil {
		t.Fatalf("test setup invariant violated: the pre-fix vulnerable path was expected to successfully push (proving the defect), but got an error: %v -- if this fails, the defect this test documents may already be structurally impossible to reproduce this way, which would need re-investigation, not silent acceptance", pushErr)
	}
	if after != pkg.commitSHA {
		t.Fatalf("unexpected pushed head: %s", after)
	}

	t.Logf("CONFIRMED PRE-FIX DEFECT: write-capable token was minted and the push to %s succeeded (remote now %s) AFTER Revoke(%s) had already returned success -- this is exactly the live-revocation race Hardening R2 closes. Grant remained REVOKED (irreversibly overwritten below is impossible since MarkPublished now correctly rejects a REVOKED grant).", pkg.commitSHA, after, stale.GrantID)

	// Confirm the grant itself could not be marked PUBLISHED after the fact -- MarkPublished already
	// correctly required IN_PROGRESS even before this round, so the state layer alone caught SOME of
	// the inconsistency; what it could never catch is the remote effect (the push) having already
	// irreversibly happened, which is the actual defect.
	if err := client.MarkPublished(stale.GrantID, after, 0); err == nil {
		t.Fatalf("expected MarkPublished to reject an already-REVOKED grant")
	}
}

// --- Test 1: revoke before an existing-branch push phase -----------------------------------------

func TestOrchestrate_RevokeBeforeExistingBranchPushPhase_Blocked(t *testing.T) {
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
	repo.PushTo(remoteDir, b, "chore/test-branch")

	pkg := buildGraphPackage(t, repo, "chore/test-branch", a, b, c, "c.txt", "commit c", false)
	digest := authorizeGraph(t, grants, pkg)
	g, err := grants.Client().BeginOrResume(digest)
	if err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}

	deps.testHookBeforePhaseA = func() {
		if err := grants.Admin().Revoke(g.GrantID); err != nil {
			t.Errorf("Revoke: %v", err)
		}
	}

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)

	if res.Status != "BLOCKED" || res.FailureReason != "GRANT_REVOKED" {
		t.Fatalf("SECURITY DEFECT: expected BLOCKED/GRANT_REVOKED, got %+v", res)
	}
	if minter.WriteCalls() != 0 {
		t.Fatalf("SECURITY DEFECT: a write-capable token was minted after revoke, writeCalls=%d", minter.WriteCalls())
	}
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, "chore/test-branch"); got != b {
		t.Fatalf("SECURITY DEFECT: remote must remain at B (%s), got %s", b, got)
	}
}

// --- Test 2: revoke before a new-branch creation phase --------------------------------------------

func TestOrchestrate_RevokeBeforeNewBranchCreationPhase_Blocked(t *testing.T) {
	repo := testutil.NewRepo(t)
	a := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", a)
	repo.WriteFile("c.txt", "c\n")
	repo.StageAll()
	c := repo.Commit("commit c")

	remoteDir := testutil.NewBareRemote(t) // branch absent
	deps, grants, minter := remoteTransitionDeps(t, remoteDir)

	pkg := buildGraphPackage(t, repo, "chore/test-branch", a, a, c, "c.txt", "commit c", false)
	digest := authorizeGraph(t, grants, pkg)
	g, err := grants.Client().BeginOrResume(digest)
	if err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}

	deps.testHookBeforePhaseA = func() {
		if err := grants.Admin().Revoke(g.GrantID); err != nil {
			t.Errorf("Revoke: %v", err)
		}
	}

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)

	if res.Status != "BLOCKED" || res.FailureReason != "GRANT_REVOKED" {
		t.Fatalf("SECURITY DEFECT: expected BLOCKED/GRANT_REVOKED, got %+v", res)
	}
	if minter.WriteCalls() != 0 {
		t.Fatalf("SECURITY DEFECT: a write-capable token was minted after revoke, writeCalls=%d", minter.WriteCalls())
	}
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, "chore/test-branch"); got != "" {
		t.Fatalf("SECURITY DEFECT: remote branch must remain absent, got %s", got)
	}
}

// --- Test 3: an admitted no-PR publication phase linearizes before revoke -------------------------

func TestOrchestrate_AdmittedNoPRPhase_LinearizesBeforeRevoke(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, false)
	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", "")

	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	digest := req.RequestDigest().Hex()
	g := authorize(t, grants, digest, pkg.envelope)
	if _, err := grants.Client().BeginOrResume(digest); err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}

	admitted := make(chan struct{})
	proceed := make(chan struct{})
	deps.testHookAfterPhaseAAdmitted = func() {
		close(admitted)
		<-proceed
	}

	orchestrateDone := make(chan Result, 1)
	go func() {
		orchestrateDone <- Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	}()
	<-admitted // Phase A is now admitted and holds the phase gate

	revokeDone := make(chan error, 1)
	revokeStarted := make(chan struct{})
	go func() {
		close(revokeStarted)
		revokeDone <- grants.Admin().Revoke(g.GrantID)
	}()
	<-revokeStarted

	select {
	case err := <-revokeDone:
		t.Fatalf("SECURITY DEFECT: Revoke returned (err=%v) while an admitted publication phase still held the gate", err)
	case <-time.After(50 * time.Millisecond):
		// expected: Revoke is still blocked
	}

	close(proceed) // let the real push (and MarkPublished) complete, then release the gate

	var res Result
	select {
	case res = <-orchestrateDone:
	case <-time.After(5 * time.Second):
		t.Fatalf("Orchestrate did not complete")
	}
	if res.Status != "PUBLISHED" {
		t.Fatalf("expected PUBLISHED, got %+v", res)
	}

	select {
	case err := <-revokeDone:
		if err == nil {
			t.Fatalf("expected Revoke to fail with a stable 'cannot revoke PUBLISHED' error once the phase completed, got nil (success)")
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("Revoke did not return after the phase released")
	}

	// PUBLISHED must not have been overwritten by the (failed) revoke attempt.
	live, gate, err := grants.Client().AdmitPublicationPhase(g.GrantID)
	if err != nil {
		t.Fatalf("expected the grant to still admit as PUBLISHED, got err=%v", err)
	}
	defer gate.Release()
	if live.State != grant.StatePublished {
		t.Fatalf("expected PUBLISHED to survive the revoke attempt, got %s", live.State)
	}
}

// --- Test 4: push succeeds, then revoke prevents PR finalization -----------------------------------

func TestOrchestrate_PushSucceeds_ThenRevokePreventsPRFinalization(t *testing.T) {
	prCallCount := 0
	prServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prCallCount++
		w.WriteHeader(http.StatusInternalServerError) // PR step always fails transiently
	}))
	defer prServer.Close()

	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, true)
	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", prServer.URL)

	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	digest := req.RequestDigest().Hex()
	g := authorize(t, grants, digest, pkg.envelope)

	first := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if first.Status != "BLOCKED" {
		t.Fatalf("expected first attempt to BLOCK at the PR step (push should have already succeeded), got %+v", first)
	}
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, pkg.envelope.Branch); got != pkg.commitSHA {
		t.Fatalf("expected the push to have already succeeded (remote at %s), got %s", pkg.commitSHA, got)
	}
	callsBeforeRevoke := prCallCount

	if err := grants.Admin().Revoke(g.GrantID); err != nil {
		t.Fatalf("Revoke: %v", err)
	}

	retry := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)

	if retry.Status != "BLOCKED" || retry.FailureReason != "GRANT_REVOKED" {
		t.Fatalf("SECURITY DEFECT: expected BLOCKED/GRANT_REVOKED on retry, got %+v", retry)
	}
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, pkg.envelope.Branch); got != pkg.commitSHA {
		t.Fatalf("remote must remain exactly at the already-pushed commit (%s), got %s -- no new push should have occurred", pkg.commitSHA, got)
	}
	if prCallCount != callsBeforeRevoke {
		t.Fatalf("SECURITY DEFECT: retry after revoke made %d additional PR API call(s) -- no PR list/create/update call is authorized after revocation", prCallCount-callsBeforeRevoke)
	}
	client := grants.Client()
	if _, err := client.BeginOrResume(digest); err != grant.ErrRevoked {
		t.Fatalf("expected the grant to remain REVOKED, got err=%v", err)
	}
}

// TestOrchestrate_RevokeWinsInSameInvocationBetweenPhaseAAndPhaseB is the interleaving
// TestOrchestrate_PushSucceeds_ThenRevokePreventsPRFinalization above does NOT exercise: it revokes
// only after a first Orchestrate call has fully returned, then checks a separate retry -- which would
// still pass even if Phase B's own fresh AdmitPublicationPhase call were deleted, since the retry's
// very first BeginOrResume already rejects a REVOKED grant on its own. This test instead uses
// testHookBetweenPhaseAAndB to make Revoke land in the gap where Phase A's gate has been released but
// Phase B has not yet re-acquired it, WITHIN THE SAME Orchestrate call whose push already succeeded --
// proving Phase B's own re-admission, not merely BeginOrResume, is what stops PR finalization.
func TestOrchestrate_RevokeWinsInSameInvocationBetweenPhaseAAndPhaseB(t *testing.T) {
	prCallCount := 0
	prServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prCallCount++
		json.NewEncoder(w).Encode([]map[string]any{}) // would otherwise succeed (empty search, then create)
	}))
	defer prServer.Close()

	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, true)
	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", prServer.URL)

	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	digest := req.RequestDigest().Hex()
	g := authorize(t, grants, digest, pkg.envelope)

	deps.testHookBetweenPhaseAAndB = func() {
		if err := grants.Admin().Revoke(g.GrantID); err != nil {
			t.Errorf("Revoke: %v", err)
		}
	}

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)

	if res.Status != "BLOCKED" || res.FailureReason != "GRANT_REVOKED" {
		t.Fatalf("SECURITY DEFECT: expected BLOCKED/GRANT_REVOKED, got %+v", res)
	}
	if prCallCount != 0 {
		t.Fatalf("SECURITY DEFECT: revoke landed before Phase B admission, yet %d PR API call(s) were made -- Phase B's own fresh AdmitPublicationPhase call is not actually stopping PR finalization", prCallCount)
	}
	// The push itself, in Phase A, was already correctly authorized and already happened before the
	// revoke landed -- that is not what this round undoes (Phase A already committed its remote
	// effect); only the still-pending PR finalization must be prevented.
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, pkg.envelope.Branch); got != pkg.commitSHA {
		t.Fatalf("expected the already-successful push to remain in place at %s, got %s", pkg.commitSHA, got)
	}
	client := grants.Client()
	if _, err := client.BeginOrResume(digest); err != grant.ErrRevoked {
		t.Fatalf("expected the grant to remain REVOKED, got err=%v", err)
	}
}

// --- Test 8 (orchestrate-level confirmation): different Grants are not serialized behind one
// global I/O lock -- holding Grant A's phase gate must not block Grant B's Orchestrate call. -------

func TestOrchestrate_DifferentGrantsAreNotSerialized(t *testing.T) {
	repoA := testutil.NewRepo(t)
	pkgA := buildPackage(t, repoA, false)
	repoB := testutil.NewRepo(t)
	pkgB := buildPackage(t, repoB, false)

	remoteDirA := testutil.NewBareRemote(t)
	remoteDirB := testutil.NewBareRemote(t)
	depsA, grantsA := newDeps(t, remoteDirA, "tok", "")
	depsB, grantsB := newDeps(t, remoteDirB, "tok", "")

	reqA, _ := protocol.ParseRequest(pkgA.envelopeBytes, pkgA.receiptBytes, pkgA.bundleBytes, pkgA.manifestBytes)
	gA := authorize(t, grantsA, reqA.RequestDigest().Hex(), pkgA.envelope)
	if _, err := grantsA.Client().BeginOrResume(reqA.RequestDigest().Hex()); err != nil {
		t.Fatalf("BeginOrResume A: %v", err)
	}

	reqB, _ := protocol.ParseRequest(pkgB.envelopeBytes, pkgB.receiptBytes, pkgB.bundleBytes, pkgB.manifestBytes)
	authorize(t, grantsB, reqB.RequestDigest().Hex(), pkgB.envelope)

	// Hold Grant A's phase gate open indefinitely (never signal proceed) by pausing Orchestrate for
	// A right after admission.
	blockA := make(chan struct{})
	depsA.testHookAfterPhaseAAdmitted = func() { <-blockA }
	defer close(blockA)

	goA := make(chan Result, 1)
	go func() {
		goA <- Orchestrate(context.Background(), depsA, pkgA.envelopeBytes, pkgA.receiptBytes, pkgA.bundleBytes, pkgA.manifestBytes)
	}()

	// Give A's goroutine a moment to actually reach and hold its gate (bounded wait, not used for
	// correctness -- Grant B uses a completely independent Store/gate map regardless).
	time.Sleep(20 * time.Millisecond)

	resB := make(chan Result, 1)
	go func() {
		resB <- Orchestrate(context.Background(), depsB, pkgB.envelopeBytes, pkgB.receiptBytes, pkgB.bundleBytes, pkgB.manifestBytes)
	}()

	select {
	case res := <-resB:
		if res.Status != "PUBLISHED" {
			t.Fatalf("expected Grant B to publish successfully, got %+v", res)
		}
	case <-time.After(3 * time.Second):
		t.Fatalf("SECURITY/CORRECTNESS DEFECT: Grant B's Orchestrate call was blocked behind Grant A's held phase gate -- different Grants must not share one global I/O lock")
	}

	_ = gA
}

// --- Test 9: concurrent identical no-PR requests remain idempotent --------------------------------

func TestOrchestrate_ConcurrentIdenticalNoPRRequests_Idempotent(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, false)
	remoteDir := testutil.NewBareRemote(t)
	deps, grants, minter := remoteTransitionDeps(t, remoteDir)

	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	authorize(t, grants, req.RequestDigest().Hex(), pkg.envelope)

	var wg sync.WaitGroup
	results := make([]Result, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			results[i] = Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
		}(i)
	}
	wg.Wait()

	for i, res := range results {
		if res.Status != "PUBLISHED" {
			t.Fatalf("request %d: expected PUBLISHED, got %+v", i, res)
		}
		if res.CommitSHA != pkg.commitSHA || res.RemoteHead != pkg.commitSHA {
			t.Fatalf("request %d: unexpected commit/remote head in result: %+v", i, res)
		}
	}
	if minter.WriteCalls() != 1 {
		t.Fatalf("expected exactly one write-capable token mint (one remote transition) across both concurrent identical requests, got %d", minter.WriteCalls())
	}
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, pkg.envelope.Branch); got != pkg.commitSHA {
		t.Fatalf("expected remote to end at %s, got %s", pkg.commitSHA, got)
	}
}

// --- Test 10: concurrent identical PR requests do not create duplicate PRs ------------------------

func TestOrchestrate_ConcurrentIdenticalPRRequests_NoDuplicatePR(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, true)

	var mu sync.Mutex
	createCalls := 0
	var createdPR map[string]any

	prServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch r.Method {
		case http.MethodGet:
			if createdPR == nil {
				json.NewEncoder(w).Encode([]map[string]any{})
				return
			}
			json.NewEncoder(w).Encode([]map[string]any{createdPR})
		case http.MethodPost:
			createCalls++
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			createdPR = map[string]any{
				"number": 77, "state": "open", "title": body["title"], "body": body["body"],
				"head": map[string]string{"ref": body["head"], "sha": pkg.commitSHA},
				"base": map[string]string{"ref": body["base"]},
			}
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(createdPR)
		}
	}))
	defer prServer.Close()
	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", prServer.URL)

	req, _ := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	authorize(t, grants, req.RequestDigest().Hex(), pkg.envelope)

	var wg sync.WaitGroup
	results := make([]Result, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			results[i] = Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
		}(i)
	}
	wg.Wait()

	for i, res := range results {
		if res.Status != "PUBLISHED" || res.PRNumber != 77 {
			t.Logf("full result %d: %+v", i, res)
			t.Fatalf("request %d: expected PUBLISHED with PR 77, got %+v", i, res)
		}
	}
	mu.Lock()
	finalCreateCalls := createCalls
	mu.Unlock()
	if finalCreateCalls != 1 {
		t.Fatalf("SECURITY/CORRECTNESS DEFECT: expected exactly one PR create call across both concurrent identical requests, got %d (duplicate PR created)", finalCreateCalls)
	}
}
