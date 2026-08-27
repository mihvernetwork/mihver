package grant

// Regression suite for DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R3.2-LINEARIZABLE-BLOCK-TRANSITIONS.
//
// Every transition to BLOCKED now competes for the same per-Grant exclusive phase gate
// AdminHandle.Revoke and an admitted publication phase (AdmitPublicationPhase) already compete for.
// MarkBlocked (outside a phase) acquires the gate itself; MarkBlockedInPhase (inside an already-
// admitted phase) uses the caller's already-held lease and never re-acquires the underlying mutex.
// This file exercises the phase-lease safety properties directly at the grant-package level -- real
// synchronization (channels/mutex blocking), never sleeps for correctness.

import (
	"errors"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"
)

// waitingSampleIterations bounds waitUntilWaitingThenSustain's SUSTAINED sampling phase below by an
// iteration COUNT, never a wall-clock duration -- see that function's doc comment for why a bounded
// iteration count is the correct tool here, not a timeout.
const waitingSampleIterations = 20000

// waitUntilWaiting spins (never sleeps a fixed duration) until s reports at least one goroutine
// currently past the atomic "about to acquire" marker for grantID's phase gate, or fails the test
// after a generous deadlock-guard deadline (a safety net only -- see waitUntilWaitingThenSustain for
// why a single observation of this is not yet the full proof).
func waitUntilWaiting(t *testing.T, s *Store, grantID string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if s.waitingForTest(grantID) > 0 {
			return
		}
		runtime.Gosched()
	}
	t.Fatalf("grantID %s never showed a waiter on its phase gate within the deadlock guard deadline", grantID)
}

// waitUntilWaitingThenSustain is SUSTAINED STRESS EVIDENCE, not a mathematical proof, that MarkBlocked
// (running in its own goroutine, pushing its eventual result to done) cannot complete while holder
// continues to hold grantID's phase gate. Closeout Pack A.2's own required correction: this function's
// name and an earlier version of this comment described the result as a "deterministic proof" that a
// goroutine has registered inside the Go runtime's internal mutex wait queue. That claim is stronger
// than what this function can actually establish -- Go's sync.Mutex exposes no API to observe "a
// goroutine is currently blocked inside my runtime wait queue," so nothing in this file can prove that
// registration occurred. What it DOES establish is repeated, non-timing-dependent stress evidence
// against the specific failure mode a broken/no-op lock would produce.
//
// Store.waitingForTest's counter is incremented immediately BEFORE acquirePhaseGate's Lock() call and
// decremented immediately after Lock() returns -- so an observation of "waiting > 0" only proves the
// competing goroutine has reached that atomic increment, not that it has necessarily already entered
// the runtime's blocking wait inside Lock() itself (an external reviewer correctly identified this gap
// in an earlier version of this evidence). A single point-in-time check taken right after that one
// observation could, in principle, land in the vanishingly narrow window between the increment and the
// Lock() call actually starting to block.
//
// This function narrows that gap with SUSTAINED, repeated sampling instead of a single snapshot: once
// "waiting > 0" is first observed, it continues yielding (runtime.Gosched, never time.Sleep) and
// re-checking BOTH conditions on every one of waitingSampleIterations further iterations:
//   - done must never receive a value (MarkBlocked must never complete) -- checked non-blockingly on
//     every iteration, not once.
//   - waitingForTest(grantID) must never legitimately drop back to 0 while holder has not yet released
//     -- since holder controls the ONLY release, MarkBlocked's Lock() call cannot legitimately return
//     until holder's own release call runs, so any observed 0 in this window is itself independent,
//     unambiguous evidence of a broken mutex/gate, not merely "goroutine hasn't run yet."
//
// Running thousands of real scheduler yields gives the runtime substantial opportunity to actually
// advance the competing goroutine if the underlying lock were in any way non-blocking or otherwise
// defective -- unlike a single check, a regression that made Lock() effectively a no-op would need to
// go completely unobserved across every one of these iterations to escape detection here, not just win
// one unlucky race. This is still probabilistic stress evidence, not a proof, and is complemented (not
// replaced) by the structural source review that MarkBlocked's and AdmitPublicationPhase's own code
// both call the identical acquirePhaseGate/gateFor path for the same GrantID -- see grant.go's own
// gateEntry/acquirePhaseGate doc comments. The only fixed wall-clock element anywhere in this function
// is the deadlock-guard deadline inside waitUntilWaiting itself: a safety net so a genuinely hung run
// fails with a clear message instead of blocking CI forever, never itself part of the positive
// evidence above.
func waitUntilWaitingThenSustain(t *testing.T, s *Store, grantID string, done <-chan error) {
	t.Helper()
	waitUntilWaiting(t, s, grantID)
	for i := 0; i < waitingSampleIterations; i++ {
		select {
		case res := <-done:
			t.Fatalf("SECURITY DEFECT: the competing call completed (err=%v) while the phase gate was still held", res)
		default:
		}
		if s.waitingForTest(grantID) == 0 {
			t.Fatalf("SECURITY DEFECT: the phase gate's waiter count dropped to zero while the gate was still held -- this can only mean the competing goroutine's Lock() call returned without a release, i.e. the mutex failed to exclude it")
		}
		runtime.Gosched()
	}
}

// Test (V3.1-B Closeout Pack A.1, Work Package 5, Option B part 1; wording corrected in Closeout Pack
// A.2, Work Package E) -- sustained, package-level stress evidence that MarkBlocked cannot complete
// while another goroutine already holds the same Grant's phase gate. See waitUntilWaitingThenSustain's
// doc comment for exactly what this evidence does and does not establish: it is sustained repeated
// sampling across thousands of real scheduler yields, not a single theoretically racy snapshot, but it
// is still stress evidence rather than a mathematical proof that a goroutine has registered inside
// Go's internal mutex wait queue -- no API exists to observe that directly. The deadlock-guard timeout
// in waitUntilWaiting is exactly that: a guard against a hung test, not part of the positive evidence.
func TestMarkBlocked_CannotCompleteWhileGateGenuinelyHeld_UnderSustainedYieldStress(t *testing.T) {
	s := newStore(t)
	g := authorizedGrant(t, s, "d")
	client := s.Client()
	if _, err := client.BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}

	// Hold the gate directly (no remote effect needed for this proof -- only genuine mutual exclusion).
	gate := s.acquirePhaseGate(g.GrantID)

	blockDone := make(chan error, 1)
	go func() { blockDone <- client.MarkBlocked(g.GrantID, "REASON_X") }()

	waitUntilWaitingThenSustain(t, s, g.GrantID, blockDone)

	gate.Release()

	select {
	case err := <-blockDone:
		if err != nil {
			t.Fatalf("MarkBlocked: %v", err)
		}
	case <-time.After(2 * time.Second): // deadlock guard only, never the positive proof
		t.Fatalf("MarkBlocked did not complete after the gate was released")
	}

	if _, err := client.BeginOrResume("d"); err != ErrBlocked {
		t.Fatalf("expected the grant to be durably BLOCKED, got %v", err)
	}
}

// Test 6 (partial, R3.2) -- MarkBlockedInPhase using the caller's own already-admitted lease does not
// deadlock and correctly persists BLOCKED using the SAME held gate, never re-acquiring it.
func TestMarkBlockedInPhase_UsesAlreadyHeldLease_NoDeadlock(t *testing.T) {
	s := newStore(t)
	g := authorizedGrant(t, s, "d")
	client := s.Client()
	if _, err := client.BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}

	live, gate, err := client.AdmitPublicationPhase(g.GrantID)
	if err != nil {
		t.Fatalf("AdmitPublicationPhase: %v", err)
	}
	if live.State != StateInProgress {
		t.Fatalf("expected IN_PROGRESS, got %s", live.State)
	}

	done := make(chan error, 1)
	go func() {
		done <- client.MarkBlockedInPhase(gate, g.GrantID, "REASON_X")
	}()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("MarkBlockedInPhase: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("DEADLOCK: MarkBlockedInPhase did not return using its own already-held lease")
	}
	gate.Release()

	if _, err := client.BeginOrResume("d"); err != ErrBlocked {
		t.Fatalf("expected the grant to be durably BLOCKED, got %v", err)
	}
}

// Test 10 (R3.2) -- a phase lease acquired for Grant A must not be usable to block Grant B.
func TestMarkBlockedInPhase_CrossGrantLeaseRejected(t *testing.T) {
	s := newStore(t)
	gA := authorizedGrant(t, s, "dA")
	gB := authorizedGrant(t, s, "dB")
	client := s.Client()
	if _, err := client.BeginOrResume("dA"); err != nil {
		t.Fatalf("BeginOrResume A: %v", err)
	}
	if _, err := client.BeginOrResume("dB"); err != nil {
		t.Fatalf("BeginOrResume B: %v", err)
	}

	_, gateA, err := client.AdmitPublicationPhase(gA.GrantID)
	if err != nil {
		t.Fatalf("admit A: %v", err)
	}
	defer gateA.Release()

	err = client.MarkBlockedInPhase(gateA, gB.GrantID, "REASON_X")
	if !errors.Is(err, ErrInvalidPhaseLease) {
		t.Fatalf("SECURITY DEFECT: expected errors.Is(err, ErrInvalidPhaseLease) using Grant A's lease against Grant B, got %v", err)
	}

	// Neither Grant was mutated.
	if _, err := client.BeginOrResume("dA"); err != nil {
		t.Fatalf("Grant A must remain IN_PROGRESS and usable, got %v", err)
	}
	if _, err := client.BeginOrResume("dB"); err != nil {
		t.Fatalf("Grant B must remain IN_PROGRESS and untouched, got %v", err)
	}
}

// Test 11 (R3.2) -- a lease from Store A must not mutate a Grant in Store B.
func TestMarkBlockedInPhase_CrossStoreLeaseRejected(t *testing.T) {
	sA := newStore(t)
	sB := newStore(t)
	gA := authorizedGrant(t, sA, "d")
	authorizedGrant(t, sB, "d") // same digest, different Store -- a distinct Grant

	clientA := sA.Client()
	clientB := sB.Client()
	if _, err := clientA.BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume A: %v", err)
	}
	if _, err := clientB.BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume B: %v", err)
	}

	_, gateA, err := clientA.AdmitPublicationPhase(gA.GrantID)
	if err != nil {
		t.Fatalf("admit A: %v", err)
	}
	defer gateA.Release()

	// gA.GrantID happens not to exist in sB at all, but even if IDs collided, leaseFor's store
	// identity check must reject this before ever touching sB's data.
	err = clientB.MarkBlockedInPhase(gateA, gA.GrantID, "REASON_X")
	if !errors.Is(err, ErrInvalidPhaseLease) {
		t.Fatalf("SECURITY DEFECT: expected errors.Is(err, ErrInvalidPhaseLease) using Store A's lease against Store B, got %v", err)
	}
}

// Test 12 (R3.2) -- after Release(), a gate-bound MarkBlockedInPhase call must fail without mutating
// state.
func TestMarkBlockedInPhase_ReleasedLeaseRejected(t *testing.T) {
	s := newStore(t)
	g := authorizedGrant(t, s, "d")
	client := s.Client()
	if _, err := client.BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}

	_, gate, err := client.AdmitPublicationPhase(g.GrantID)
	if err != nil {
		t.Fatalf("AdmitPublicationPhase: %v", err)
	}
	gate.Release()

	err = client.MarkBlockedInPhase(gate, g.GrantID, "REASON_X")
	if !errors.Is(err, ErrInvalidPhaseLease) {
		t.Fatalf("SECURITY DEFECT: expected errors.Is(err, ErrInvalidPhaseLease) on a released lease, got %v", err)
	}

	if _, err := client.BeginOrResume("d"); err != nil {
		t.Fatalf("expected the grant to remain untouched (still IN_PROGRESS), got %v", err)
	}
}

// Test 13 (R3.2) -- a stale alias from an earlier, fully-released acquisition must never be able to
// affect a LATER, distinct acquisition of the same Grant's gate.
func TestMarkBlockedInPhase_StaleAliasCannotAffectLaterAcquisition(t *testing.T) {
	s := newStore(t)
	g := authorizedGrant(t, s, "d")
	client := s.Client()
	if _, err := client.BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}

	_, l1, err := client.AdmitPublicationPhase(g.GrantID)
	if err != nil {
		t.Fatalf("admit L1: %v", err)
	}
	l1Copy := *l1
	l1.Release()
	l1Copy.Release()

	_, l2, err := client.AdmitPublicationPhase(g.GrantID)
	if err != nil {
		t.Fatalf("admit L2: %v", err)
	}

	// Every stale L1 alias must be rejected -- L2 remains the only active authority.
	if err := client.MarkBlockedInPhase(l1, g.GrantID, "REASON_X"); !errors.Is(err, ErrInvalidPhaseLease) {
		t.Fatalf("SECURITY DEFECT: stale L1 mutated the Grant while L2 is the active holder, err=%v", err)
	}
	if err := client.MarkBlockedInPhase(&l1Copy, g.GrantID, "REASON_X"); !errors.Is(err, ErrInvalidPhaseLease) {
		t.Fatalf("SECURITY DEFECT: stale L1 copy mutated the Grant while L2 is the active holder, err=%v", err)
	}

	// L2 itself is still the genuinely active lease and can legitimately block.
	if err := client.MarkBlockedInPhase(l2, g.GrantID, "REASON_X"); err != nil {
		t.Fatalf("expected L2 (the real active lease) to succeed, got %v", err)
	}
	l2.Release()
}

// Test 14 (R3.2) -- Release() versus a gate-bound mutation on the SAME lease is linearizable: exactly
// one ordering wins (mutation completes before the physical unlock, or the mutation is rejected
// because release already won), never "the mutation appears to succeed after the gate was already
// physically released and reused."
func TestPhaseGate_ReleaseVersusMarkBlockedInPhase_Linearizable(t *testing.T) {
	for i := 0; i < 25; i++ {
		s := newStore(t)
		g := authorizedGrant(t, s, "d")
		client := s.Client()
		if _, err := client.BeginOrResume("d"); err != nil {
			t.Fatalf("BeginOrResume: %v", err)
		}
		_, gate, err := client.AdmitPublicationPhase(g.GrantID)
		if err != nil {
			t.Fatalf("AdmitPublicationPhase: %v", err)
		}

		var wg sync.WaitGroup
		var mutateErr error
		wg.Add(2)
		go func() { defer wg.Done(); gate.Release() }()
		go func() { defer wg.Done(); mutateErr = client.MarkBlockedInPhase(gate, g.GrantID, "REASON_X") }()
		wg.Wait()

		// Whichever ordering won, the Grant's final state must be internally consistent: either the
		// mutation won (Grant is BLOCKED) or it lost (Grant is untouched, still IN_PROGRESS) -- never a
		// torn/partial state, and a fresh acquisition for the same Grant must always succeed promptly
		// afterward (proving the underlying mutex was genuinely, exactly-once unlocked).
		if mutateErr != nil && !errors.Is(mutateErr, ErrInvalidPhaseLease) {
			t.Fatalf("iteration %d: unexpected error from the losing mutation: %v", i, mutateErr)
		}

		// A fresh AdmitPublicationPhase call always acquires (and, one way or another, releases) the
		// underlying mutex first, regardless of whether it ultimately admits or denies -- so it proves
		// the gate was genuinely, exactly-once unlocked either way. If the mutation won, the Grant is
		// now BLOCKED, so admission is correctly DENIED with ErrBlocked (not a failure of this test --
		// that denial itself is proof the mutex was obtainable). If the mutation lost, admission
		// correctly succeeds against the still-IN_PROGRESS Grant.
		reAdmitDone := make(chan struct{}, 1)
		go func() {
			_, gate2, err := client.AdmitPublicationPhase(g.GrantID)
			switch {
			case err == nil:
				// The mutation lost (its lease was already released) -- Grant remains IN_PROGRESS and
				// freely admissible again. This is a fully valid, expected outcome, not an error.
				gate2.Release()
			case err == ErrBlocked:
				if mutateErr != nil {
					t.Errorf("iteration %d: mutation reported failure but Grant is BLOCKED", i)
				}
			default:
				t.Errorf("iteration %d: unexpected re-admission error: %v", i, err)
			}
			reAdmitDone <- struct{}{}
		}()
		select {
		case <-reAdmitDone:
		case <-time.After(2 * time.Second):
			t.Fatalf("iteration %d: gate was not actually released -- re-admission blocked (double-unlock or leak)", i)
		}
	}
}

// Test 15 (R3.2) -- two concurrent, DIFFERENT block reasons for the same Grant: exactly one reason
// wins under the gate; the other receives ErrBlockedReasonMismatch; the stored reason never changes
// after that.
func TestMarkBlocked_ConcurrentDifferentReasons_FirstWriterWins(t *testing.T) {
	s := newStore(t)
	g := authorizedGrant(t, s, "d")
	client := s.Client()
	if _, err := client.BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}

	var wg sync.WaitGroup
	errs := make([]error, 2)
	reasons := []string{"REASON_A", "REASON_B"}
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			errs[i] = client.MarkBlocked(g.GrantID, reasons[i])
		}(i)
	}
	wg.Wait()

	successCount := 0
	mismatchCount := 0
	for _, err := range errs {
		switch {
		case err == nil:
			successCount++
		case errors.Is(err, ErrBlockedReasonMismatch):
			mismatchCount++
		default:
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if successCount != 1 || mismatchCount != 1 {
		t.Fatalf("expected exactly one success and one ErrBlockedReasonMismatch, got success=%d mismatch=%d (errs=%v)", successCount, mismatchCount, errs)
	}

	s.mu.Lock()
	finalReason := s.byDigest["d"].BlockedReason
	s.mu.Unlock()
	if finalReason != "REASON_A" && finalReason != "REASON_B" {
		t.Fatalf("stored reason is neither original candidate: %q", finalReason)
	}

	// A second attempt with the LOSING reason must still be rejected -- the winner's reason is final.
	losing := "REASON_B"
	if finalReason == "REASON_B" {
		losing = "REASON_A"
	}
	if err := client.MarkBlocked(g.GrantID, losing); !errors.Is(err, ErrBlockedReasonMismatch) {
		t.Fatalf("expected the losing reason to remain rejected after the fact, got %v", err)
	}
}

// Test 16 (R3.2) -- a late block attempt against a Grant whose publication completed remotely but
// whose MarkPublished persistence is still pending must report ErrPublishPersistFailed (never
// silently succeed in blocking, never claim PUBLISHED is durably acknowledged); once repaired, it must
// report ErrCannotBlockPublished, and the exact published outcome must remain unchanged.
func TestMarkBlocked_CannotMislabelPendingPublished(t *testing.T) {
	path := filepath.Join(t.TempDir(), "grants.json")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	g := authorizedGrant(t, s, "d")
	client := s.Client()
	if _, err := client.BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}

	obstructPersistence(t, path)
	if err := client.MarkPublished(g.GrantID, "headA", 7); !errors.Is(err, ErrPublishPersistFailed) {
		t.Fatalf("expected MarkPublished to fail, got %v", err)
	}

	lateErr := client.MarkBlocked(g.GrantID, "TOO_LATE")
	if !errors.Is(lateErr, ErrPublishPersistFailed) {
		t.Fatalf("SECURITY DEFECT: expected errors.Is(err, ErrPublishPersistFailed) for a late block against pending PUBLISHED, got %v", lateErr)
	}
	if errors.Is(lateErr, ErrCannotBlockPublished) {
		t.Fatalf("SECURITY DEFECT: must not report ErrCannotBlockPublished while PUBLISHED is still pending")
	}

	clearPersistenceObstruction(t, path)

	if err := client.MarkBlocked(g.GrantID, "TOO_LATE"); !errors.Is(err, ErrCannotBlockPublished) {
		t.Fatalf("expected errors.Is(err, ErrCannotBlockPublished) once PUBLISHED is durably acknowledged, got %v", err)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	final, err := reopened.Client().BeginOrResume("d")
	if err != nil || final.State != StatePublished || final.RemoteHeadObserved != "headA" || final.PRNumber != 7 {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably show exact PUBLISHED/headA/7 (never BLOCKED), got live=%+v err=%v", final, err)
	}
}

// Test 7 (R3.2) -- Revoke wins the gate before a concurrent block attempt: the block attempt (once it
// finally acquires the gate) must observe REVOKED and refuse, never overwriting it with BLOCKED.
func TestRevoke_WinsBeforeBlock(t *testing.T) {
	s := newStore(t)
	g := authorizedGrant(t, s, "d")
	client := s.Client()
	if _, err := client.BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}

	// Hold the gate ourselves first (simulating Revoke having just won it and being about to persist)
	// via a real AdmitPublicationPhase-style acquisition is not directly available for Revoke's own
	// internal use, so instead: start Revoke and a concurrent MarkBlocked at the same time and assert
	// on the FINAL state, which is exactly what "the gate serializes these two operations" must
	// guarantee regardless of which happens to win the race for the mutex first.
	var wg sync.WaitGroup
	var revokeErr, blockErr error
	wg.Add(2)
	go func() { defer wg.Done(); revokeErr = s.Admin().Revoke(g.GrantID) }()
	go func() { defer wg.Done(); blockErr = client.MarkBlocked(g.GrantID, "REASON_X") }()
	wg.Wait()

	s.mu.Lock()
	finalState := s.byDigest["d"].State
	s.mu.Unlock()

	switch finalState {
	case StateRevoked:
		if revokeErr != nil {
			t.Fatalf("Revoke won (state=REVOKED) but itself returned an error: %v", revokeErr)
		}
		if !errors.Is(blockErr, ErrRevoked) {
			t.Fatalf("SECURITY DEFECT: expected the losing MarkBlocked to observe ErrRevoked, got %v", blockErr)
		}
	case StateBlocked:
		if blockErr != nil {
			t.Fatalf("Block won (state=BLOCKED) but itself returned an error: %v", blockErr)
		}
		if !errors.Is(revokeErr, ErrCannotRevokeBlocked) {
			t.Fatalf("SECURITY DEFECT: expected the losing Revoke to observe ErrCannotRevokeBlocked, got %v", revokeErr)
		}
	default:
		t.Fatalf("SECURITY DEFECT: expected the Grant to end in REVOKED or BLOCKED (exactly one operation must win), got %s", finalState)
	}
}

// Test 9 (R3.2) -- different Grants' MarkBlocked calls remain fully independent; holding one Grant's
// phase gate (via an admitted publication phase) must never block a MarkBlocked call for another
// Grant.
func TestMarkBlocked_DifferentGrantsAreIndependent(t *testing.T) {
	s := newStore(t)
	gA := authorizedGrant(t, s, "dA")
	gB := authorizedGrant(t, s, "dB")
	client := s.Client()
	if _, err := client.BeginOrResume("dA"); err != nil {
		t.Fatalf("BeginOrResume A: %v", err)
	}
	if _, err := client.BeginOrResume("dB"); err != nil {
		t.Fatalf("BeginOrResume B: %v", err)
	}

	_, gateA, err := client.AdmitPublicationPhase(gA.GrantID)
	if err != nil {
		t.Fatalf("admit A: %v", err)
	}
	defer gateA.Release()

	done := make(chan error, 1)
	go func() { done <- client.MarkBlocked(gB.GrantID, "REASON_X") }()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("MarkBlocked on Grant B failed: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("SECURITY/CORRECTNESS DEFECT: MarkBlocked on Grant B blocked behind Grant A's held phase gate -- gates are not independent")
	}
}
