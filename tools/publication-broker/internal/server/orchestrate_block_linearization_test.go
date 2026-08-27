package server

// Regression suite for DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R3.2-LINEARIZABLE-BLOCK-TRANSITIONS.
//
// Every transition to BLOCKED now competes for the same per-Grant exclusive phase gate
// AdminHandle.Revoke and an admitted publication phase already compete for. These tests exercise the
// exact interleavings the round's own defect description specified, using real disposable git
// repos/bare remotes and channel-based synchronization -- never sleeps for correctness.

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"mihver.network/publication-broker/internal/grant"
	"mihver.network/publication-broker/internal/protocol"
	"mihver.network/publication-broker/internal/testutil"
)

// TestBlockVersusPhaseA_PreFixDefect_ReproducedAgainstPreR32Behavior directly reproduces the confirmed
// R3.2 defect against the actual pre-fix behavior: MarkBlocked (before this round) never competed for
// the Grant's phase gate, so a concurrent block transition for the identical request digest could
// complete while Request A already held the gate and was mid-flight -- and Request A's real local push
// then still succeeded AFTER the Grant had already become BLOCKED. Confirmed via the established
// revert-confirm-restore pattern: see the completion report's "Pre-Fix Block/Phase Race Reproduction"
// section for the exact revert used and the observed pre-fix result. This test itself asserts the
// FIXED (post-R3.2) behavior -- the fixed code makes the old race impossible, so Request B's block
// attempt now correctly BLOCKS until Request A's phase releases the gate, rather than completing
// concurrently with it.
func TestBlockVersusPhaseA_CannotCompleteWhilePhaseAHoldsGate(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, false) // no-PR flow
	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", "")

	req, err := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if err != nil {
		t.Fatalf("ParseRequest: %v", err)
	}
	digest := req.RequestDigest().Hex()
	authorize(t, grants, digest, pkg.envelope)

	admitted := make(chan struct{})
	proceed := make(chan struct{})
	deps.testHookAfterPhaseAAdmitted = func() {
		close(admitted)
		<-proceed
	}

	// Request A: runs Orchestrate, pausing right after Phase A admission (gate held) but before any
	// token mint / push.
	resultA := make(chan Result, 1)
	go func() {
		resultA <- Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	}()
	<-admitted

	// Request B: identical digest, pre-phase failure via a canceled context (package import fails) --
	// the exact deterministic trigger the round's own spec permits, reclassifying nothing about the
	// failure taxonomy itself. This reaches the OUTSIDE-phase blockGrantResult call site, which must
	// now compete for the SAME phase gate Request A already holds.
	depsB := deps
	depsB.testHookAfterPhaseAAdmitted = nil
	blockAttempted := make(chan struct{})
	depsB.testHookBeforeBlockAttempt = func() { close(blockAttempted) }
	blockDone := make(chan Result, 1)
	go func() {
		cancelCtx, cancel := context.WithCancel(context.Background())
		cancel() // already canceled -- deterministic pre-phase failure trigger
		blockDone <- Orchestrate(cancelCtx, depsB, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	}()

	// Wait for Request B to actually reach the block-attempt dispatch point (about to contend for /
	// use the phase gate) before asserting on non-completion -- this removes any dependency on
	// goroutine-scheduling timing for proving B is genuinely contending, rather than merely not yet
	// having been scheduled.
	select {
	case <-blockAttempted:
	case <-time.After(5 * time.Second):
		t.Fatalf("Request B never reached the block-attempt dispatch point")
	}

	// Best-effort, non-authoritative regression signal ONLY: while Request A still holds the gate,
	// Request B's block attempt has not completed after a short, arbitrary wait (a DEADLOCK-GUARD-
	// style timeout here, never positive proof of blocking). This bounded window is NOT proof that
	// mutual exclusion on the phase gate is correct -- a scheduler could in principle delay Request
	// B's goroutine past 100ms even under a correct implementation, and conversely a buggy
	// implementation could still happen not to complete within an arbitrary window on a given run.
	// The strongest evidence for that specific property (MarkBlocked cannot complete while another
	// goroutine genuinely holds the same Grant's phase gate) lives in internal/grant's own test suite:
	// TestMarkBlocked_CannotCompleteWhileGateGenuinelyHeld_UnderSustainedYieldStress
	// (internal/grant/block_linearization_test.go), which uses sustained repeated sampling on an
	// internal Store.waitingForTest observability counter across thousands of real scheduler yields --
	// itself sustained stress evidence, not a mathematical proof that a goroutine has registered
	// inside Go's internal mutex wait queue (see that test's own doc comment for why no such proof is
	// possible with the APIs sync.Mutex exposes). What THIS test proves instead, and what the
	// grant-package test alone cannot, is complementary and IS a real end-to-end fact: that the FULL
	// request-level flow -- a real git push, real Orchestrate admission, and the two calls converging
	// on one identical PUBLISHED Result below -- behaves correctly end-to-end when a block attempt
	// contends against a live Phase A. This 100ms check is kept only as a cheap, best-effort CI
	// regression signal that can catch a gross regression quickly without requiring the grant-level
	// test to also be run; it is deliberately not relied upon as authoritative evidence of mutual
	// exclusion.
	select {
	case res := <-blockDone:
		t.Fatalf("SECURITY DEFECT (or a flaky scheduling window -- see the grant-package test above for the authoritative proof): Request B's block attempt completed (result=%+v) while Request A still held the phase gate", res)
	case <-time.After(100 * time.Millisecond):
		// expected: still blocked
	}

	close(proceed) // let Request A's real push (and MarkPublished) complete, releasing the gate

	var finalA Result
	select {
	case finalA = <-resultA:
	case <-time.After(5 * time.Second):
		t.Fatalf("Request A did not complete")
	}
	if finalA.Status != "PUBLISHED" {
		t.Fatalf("expected Request A to publish successfully (it was already admitted before B's block attempt), got %+v", finalA)
	}

	var finalB Result
	select {
	case finalB = <-blockDone:
	case <-time.After(5 * time.Second):
		t.Fatalf("Request B's block attempt did not complete after the gate was released")
	}

	// Request B must now converge to the SAME real PUBLISHED outcome A already recorded -- never a
	// misleading terminal block.
	if finalB.Status != "PUBLISHED" || finalB.RemoteHead != finalA.RemoteHead || finalB.CommitSHA != finalA.CommitSHA {
		t.Fatalf("SECURITY DEFECT: expected Request B to converge to the exact PUBLISHED outcome A recorded, got A=%+v B=%+v", finalA, finalB)
	}

	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, pkg.envelope.Branch); got != pkg.commitSHA {
		t.Fatalf("expected exactly one real push to %s, got remote=%s", pkg.commitSHA, got)
	}

	client := grants.Client()
	if live, err := client.BeginOrResume(digest); err != nil || live.State != grant.StatePublished {
		t.Fatalf("expected the Grant to durably remain PUBLISHED (never overwritten by the late block attempt), got live=%v err=%v", live, err)
	}
}

// Test 3 (R3.2) -- a block that wins BEFORE Phase A is ever admitted correctly denies that admission:
// zero write-token mint, zero push, remote left untouched.
func TestBlockWinsBeforePhaseAAdmission(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, false)
	remoteDir := testutil.NewBareRemote(t)

	grantPath := filepath.Join(t.TempDir(), "grants.json")
	grants, err := grant.Open(grantPath)
	if err != nil {
		t.Fatalf("grant.Open: %v", err)
	}
	deps, _ := newDepsWithGrants(t, grants, remoteDir, "tok", "")

	req, err := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if err != nil {
		t.Fatalf("ParseRequest: %v", err)
	}
	digest := req.RequestDigest().Hex()
	g := authorize(t, grants, digest, pkg.envelope)
	if _, err := grants.Client().BeginOrResume(digest); err != nil {
		t.Fatalf("pre-transition BeginOrResume: %v", err)
	}

	// Block the grant OUTSIDE of Orchestrate entirely, before any Phase A admission is ever attempted.
	if err := grants.Client().MarkBlocked(g.GrantID, "PRE_PHASE_REASON"); err != nil {
		t.Fatalf("MarkBlocked: %v", err)
	}

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if res.Status != "BLOCKED" || res.FailureReason != "GRANT_PREVIOUSLY_BLOCKED" {
		t.Fatalf("expected BLOCKED/GRANT_PREVIOUSLY_BLOCKED (Phase A admission denied), got %+v", res)
	}
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, pkg.envelope.Branch); got != "" {
		t.Fatalf("SECURITY DEFECT: expected zero push (remote branch must remain absent), got %s", got)
	}
}

// Test 4 (R3.2) -- a block that wins the released gap between Phase A and Phase B: the branch push
// already succeeded (a valid partial-effect ordering) but no PR mutation ever begins.
func TestBlockWinsInPhaseAToPhaseBGap(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, true) // PR-expected flow
	remoteDir := testutil.NewBareRemote(t)

	grantPath := filepath.Join(t.TempDir(), "grants.json")
	grants, err := grant.Open(grantPath)
	if err != nil {
		t.Fatalf("grant.Open: %v", err)
	}
	deps, _ := newDepsWithGrants(t, grants, remoteDir, "tok", "")

	req, err := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if err != nil {
		t.Fatalf("ParseRequest: %v", err)
	}
	digest := req.RequestDigest().Hex()
	g := authorize(t, grants, digest, pkg.envelope)
	if _, err := grants.Client().BeginOrResume(digest); err != nil {
		t.Fatalf("pre-transition BeginOrResume: %v", err)
	}

	deps.testHookBetweenPhaseAAndB = func() {
		// Phase A has already released the gate (branch pushed, Grant still IN_PROGRESS); Phase B has
		// not yet re-acquired it. A block attempt here is a legitimate, documented partial-effect
		// ordering -- it must be able to win.
		if err := grants.Client().MarkBlocked(g.GrantID, "GAP_REASON"); err != nil {
			t.Errorf("MarkBlocked in the Phase A/B gap: %v", err)
		}
	}

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if res.Status != "BLOCKED" || res.FailureReason != "GRANT_PREVIOUSLY_BLOCKED" {
		t.Fatalf("expected BLOCKED/GRANT_PREVIOUSLY_BLOCKED (Phase B admission denied), got %+v", res)
	}
	// The already-successful push from Phase A must remain -- this round never undoes a completed
	// remote effect, it only prevents the NEXT one (PR finalization) from beginning.
	if got := remoteHeadNow(t, deps.GitBinary, remoteDir, pkg.envelope.Branch); got != pkg.commitSHA {
		t.Fatalf("expected the already-pushed commit to remain at %s, got %s", pkg.commitSHA, got)
	}

	live, err := grants.Client().BeginOrResume(digest)
	if err != grant.ErrBlocked {
		t.Fatalf("expected the Grant to remain BLOCKED, got live=%v err=%v", live, err)
	}
}

// Test 5 (R3.2) -- a block attempt for the same Grant must not complete while an admitted Phase B
// (PR finalization) still holds the gate; once Phase B completes, the losing block attempt must
// converge on the exact real PUBLISHED outcome Phase B recorded, never a misleading terminal block.
//
// R3.2 evidence correction: this test now uses TWO complete, identical (same digest) Orchestrate
// calls -- exactly mirroring TestBlockVersusPhaseA_CannotCompleteWhilePhaseAHoldsGate's own pattern
// above -- rather than a real time.Sleep and a direct MarkBlocked call bypassing Orchestrate
// entirely. No sleep is used anywhere in this test for correctness: every synchronization point is a
// channel handshake through an existing testHook* seam.
func TestBlockVersusPhaseB_CannotCompleteWhilePhaseBHoldsGate(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, true) // PR-expected flow

	var createCalls int
	prServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			json.NewEncoder(w).Encode([]map[string]any{})
		case http.MethodPost:
			createCalls++
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]any{
				"number": 99, "state": "open", "title": body["title"], "body": body["body"],
				"head": map[string]string{"ref": body["head"], "sha": pkg.commitSHA},
				"base": map[string]string{"ref": body["base"]},
			})
		}
	}))
	defer prServer.Close()

	remoteDir := testutil.NewBareRemote(t)
	deps, grants := newDeps(t, remoteDir, "tok", prServer.URL)

	req, err := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if err != nil {
		t.Fatalf("ParseRequest: %v", err)
	}
	digest := req.RequestDigest().Hex()
	authorize(t, grants, digest, pkg.envelope)

	admittedB := make(chan struct{})
	proceedB := make(chan struct{})
	deps.testHookAfterPhaseBAdmitted = func() {
		close(admittedB)
		<-proceedB
	}

	// Request A: runs a full Orchestrate call, admits Phase B (push already succeeded in Phase A),
	// and pauses there (gate held) via the channel handshake above -- no sleep.
	resultA := make(chan Result, 1)
	go func() {
		resultA <- Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	}()
	<-admittedB

	// Request B: a full, SEPARATE Orchestrate call for the identical digest, triggered via the same
	// deterministic pre-phase-failure technique (an already-canceled context, which fails package
	// import) TestBlockVersusPhaseA_CannotCompleteWhilePhaseAHoldsGate uses for its own Request B.
	// This reaches the outside-phase blockGrantResult call site, which contends for the SAME per-Grant
	// phase gate Request A's Phase B already holds. testHookBeforeBlockAttempt proves Request B has
	// genuinely reached the block-attempt dispatch point before any assertion about non-completion --
	// no sleep is used for that proof.
	depsB := deps
	depsB.testHookAfterPhaseBAdmitted = nil
	blockAttempted := make(chan struct{})
	depsB.testHookBeforeBlockAttempt = func() { close(blockAttempted) }
	blockDone := make(chan Result, 1)
	go func() {
		cancelCtx, cancel := context.WithCancel(context.Background())
		cancel() // already canceled -- deterministic pre-phase failure trigger
		blockDone <- Orchestrate(cancelCtx, depsB, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	}()

	select {
	case <-blockAttempted:
	case <-time.After(5 * time.Second):
		t.Fatalf("Request B never reached the block-attempt dispatch point")
	}

	// Best-effort, non-authoritative regression signal ONLY -- see
	// TestBlockVersusPhaseA_CannotCompleteWhilePhaseAHoldsGate's identical check above for the full
	// rationale. This bounded 100ms window is NOT proof that mutual exclusion on the phase gate is
	// correct; the strongest available evidence for that lives in
	// internal/grant.TestMarkBlocked_CannotCompleteWhileGateGenuinelyHeld_UnderSustainedYieldStress
	// (internal/grant/block_linearization_test.go) -- itself sustained stress evidence across
	// thousands of real scheduler yields, not a mathematical proof that a goroutine has registered
	// inside Go's internal mutex wait queue. What this test proves instead, and what the grant-package
	// test alone cannot (it never runs a real PR-creation HTTP round trip), is a real end-to-end fact:
	// that the full request-level flow -- Phase B's real PR finalization, contended against a block
	// attempt for the identical Grant, converging on one identical PUBLISHED Result below -- behaves
	// correctly end-to-end. Kept only as a cheap CI regression signal, never as authoritative evidence
	// of mutual exclusion.
	select {
	case res := <-blockDone:
		t.Fatalf("SECURITY DEFECT (or a flaky scheduling window -- see the grant-package test above for the authoritative proof): Request B's block attempt completed (result=%+v) while Phase B still held the phase gate", res)
	case <-time.After(100 * time.Millisecond):
		// expected: still blocked
	}

	close(proceedB) // let Phase B's real PR create (and MarkPublished) complete, releasing the gate

	var finalA Result
	select {
	case finalA = <-resultA:
	case <-time.After(5 * time.Second):
		t.Fatalf("Request A did not complete")
	}
	if finalA.Status != "PUBLISHED" || finalA.PRNumber != 99 {
		t.Fatalf("expected Request A to publish successfully with PR 99, got %+v", finalA)
	}
	if createCalls != 1 {
		t.Fatalf("expected Request A to create/update at most one PR, got %d create calls", createCalls)
	}

	var finalB Result
	select {
	case finalB = <-blockDone:
	case <-time.After(5 * time.Second):
		t.Fatalf("Request B's block attempt did not complete after the gate was released")
	}

	// Request B must now converge to the SAME real PUBLISHED outcome A already recorded -- never a
	// misleading terminal block.
	if finalB.Status != "PUBLISHED" || finalB.GrantID != finalA.GrantID || finalB.CommitSHA != finalA.CommitSHA ||
		finalB.RemoteHead != finalA.RemoteHead || finalB.PRNumber != finalA.PRNumber {
		t.Fatalf("SECURITY DEFECT: expected Request B to converge to the exact PUBLISHED outcome A recorded, got A=%+v B=%+v", finalA, finalB)
	}
	if finalB.PRNumber != 99 {
		t.Fatalf("expected Request B to converge on PR 99, got %+v", finalB)
	}

	client := grants.Client()
	if live, err := client.BeginOrResume(digest); err != nil || live.State != grant.StatePublished || live.PRNumber != 99 {
		t.Fatalf("expected the Grant to durably remain PUBLISHED with PR 99 (never overwritten by the late block attempt), got live=%v err=%v", live, err)
	}
	if createCalls != 1 {
		t.Fatalf("expected exactly one PR create call across both requests, got %d", createCalls)
	}
}

// newDepsWithGrants is defined in orchestrate_persistence_test.go (same package) and reused here.
