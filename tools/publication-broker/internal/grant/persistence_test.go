package grant

// Regression suite for DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R3-PERSISTENCE-TRUTHFUL-GRANT-STATE-MACHINE.
//
// Extends the persistence-truthful pattern R2.1 established for AdminHandle.Revoke to every other
// Grant state mutation: Create, BeginOrResume, MarkPublished, MarkBlocked, and RecordRemoteHead. Every
// test here uses a real file-backed Store with persistence genuinely obstructed by creating a real
// directory at the store's <path>.tmp target (see obstructPersistence/clearPersistenceObstruction in
// grant_test.go) -- never a simulated persistLocked() return value.

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// --- Finding A / Test 1: failed Create leaves no usable authorization -----------------------------

func TestCreate_PersistenceFailureLeavesNoUsableAuthorization(t *testing.T) {
	path := filepath.Join(t.TempDir(), "grants.json")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	obstructPersistence(t, path)

	_, err = s.Admin().Create(CreateRequest{RequestDigest: "d", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour})
	if err == nil {
		t.Fatalf("expected Create to fail while persistence is obstructed")
	}

	// SECURITY DEFECT if this succeeds: a failed admin Create must leave no usable authorization.
	if _, err := s.Client().BeginOrResume("d"); err != ErrNotFound {
		t.Fatalf("SECURITY DEFECT: expected ErrNotFound after a failed Create, got err=%v", err)
	}

	clearPersistenceObstruction(t, path)

	// A later admin retry of the identical CreateRequest must succeed cleanly (no leftover stale
	// digest/gate blocking it as a duplicate).
	g, err := s.Admin().Create(CreateRequest{RequestDigest: "d", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour})
	if err != nil {
		t.Fatalf("expected the retried Create to succeed, got %v", err)
	}
	if _, err := s.Client().BeginOrResume("d"); err != nil {
		t.Fatalf("expected the retried grant to be usable, got %v", err)
	}
	// The retried grant must have a working phase gate (no stale, still-locked leftover mutex from
	// the failed attempt) -- prove it by admitting and releasing.
	_, gate, err := s.Client().AdmitPublicationPhase(g.GrantID)
	if err != nil {
		t.Fatalf("expected the retried grant's phase gate to admit cleanly, got %v", err)
	}
	gate.Release()
}

// --- Finding B / Test 2 & 3: BeginOrResume persistence failure --------------------------------------

func TestBeginOrResume_PersistenceFailureNeverBecomesFalseSuccess(t *testing.T) {
	path := filepath.Join(t.TempDir(), "grants.json")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if _, err := s.Admin().Create(CreateRequest{RequestDigest: "d", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour}); err != nil {
		t.Fatalf("Create: %v", err)
	}

	obstructPersistence(t, path)

	// Every attempt while obstructed must fail, and must never leave a phase-admissible grant behind.
	for i := 1; i <= 2; i++ {
		if _, err := s.Client().BeginOrResume("d"); err == nil {
			t.Fatalf("call %d: SECURITY DEFECT: expected BeginOrResume to fail while persistence is obstructed, got nil", i)
		}
		if _, _, err := s.Client().AdmitPublicationPhase(findGrantIDByDigest(t, s, "d")); err == nil {
			t.Fatalf("call %d: SECURITY DEFECT: phase admission must be denied after a failed Begin", i)
		}
	}

	clearPersistenceObstruction(t, path)

	g, err := s.Client().BeginOrResume("d")
	if err != nil {
		t.Fatalf("expected the retried Begin (after clearing the obstruction) to succeed, got %v", err)
	}
	if g.State != StateInProgress {
		t.Fatalf("expected IN_PROGRESS, got %s", g.State)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	live, err := reopened.Client().BeginOrResume("d")
	if err != nil {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably report IN_PROGRESS, err=%v", err)
	}
	if live.State != StateInProgress {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to show IN_PROGRESS, got %s", live.State)
	}
}

func TestBeginOrResume_ConcurrentCallsCannotBypassPendingPersistence(t *testing.T) {
	path := filepath.Join(t.TempDir(), "grants.json")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if _, err := s.Admin().Create(CreateRequest{RequestDigest: "d", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour}); err != nil {
		t.Fatalf("Create: %v", err)
	}

	obstructPersistence(t, path)

	var wg sync.WaitGroup
	errs := make([]error, 4)
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, errs[i] = s.Client().BeginOrResume("d")
		}(i)
	}
	wg.Wait()

	for i, err := range errs {
		if err == nil {
			t.Fatalf("SECURITY DEFECT: concurrent Begin call %d succeeded while persistence was obstructed", i)
		}
	}

	clearPersistenceObstruction(t, path)
	if _, err := s.Client().BeginOrResume("d"); err != nil {
		t.Fatalf("expected Begin to succeed after clearing the obstruction, got %v", err)
	}
}

// --- Finding C / Test 4 & 5: MarkPublished persistence repair and exact idempotency -----------------

func TestMarkPublished_PersistenceFailureNeverBecomesFalseSuccess(t *testing.T) {
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

	if err := client.MarkPublished(g.GrantID, "headA", 7); err == nil {
		t.Fatalf("expected the first MarkPublished to fail while persistence is obstructed")
	}
	if err := client.MarkPublished(g.GrantID, "headA", 7); err == nil {
		t.Fatalf("expected an identical retry to still fail while persistence remains obstructed")
	}

	// The in-process state must remain fail-closed against duplicate publication -- but (V3.1-B
	// Hardening R3.1) a PENDING PUBLISHED must never be returned as a successful phase admission
	// either, since a snapshot IS the success signal here. No gate, no snapshot -- only the distinct,
	// errors.Is-checkable ErrPublishPersistFailed while it remains pending.
	live, gate, err := client.AdmitPublicationPhase(g.GrantID)
	if !errors.Is(err, ErrPublishPersistFailed) {
		t.Fatalf("SECURITY DEFECT: expected errors.Is(err, ErrPublishPersistFailed) while PUBLISHED remains pending, got live=%v gate=%v err=%v", live, gate, err)
	}
	if gate != nil {
		t.Fatalf("a pending-PUBLISHED admission must never return a held gate")
	}

	clearPersistenceObstruction(t, path)

	if err := client.MarkPublished(g.GrantID, "headA", 7); err != nil {
		t.Fatalf("expected the retried MarkPublished (after clearing the obstruction) to succeed, got %v", err)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	reopenedLive, err := reopened.Client().BeginOrResume("d")
	if err != nil {
		t.Fatalf("BeginOrResume after reopen: %v", err)
	}
	if reopenedLive.State != StatePublished || reopenedLive.RemoteHeadObserved != "headA" || reopenedLive.PRNumber != 7 {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably show PUBLISHED head=headA pr=7, got %+v", reopenedLive)
	}
}

func TestMarkPublished_RejectsNonIdenticalRetry(t *testing.T) {
	s := newStore(t)
	g := authorizedGrant(t, s, "d")
	client := s.Client()
	if _, err := client.BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}
	if err := client.MarkPublished(g.GrantID, "headA", 7); err != nil {
		t.Fatalf("first MarkPublished: %v", err)
	}

	if err := client.MarkPublished(g.GrantID, "headB", 7); !errors.Is(err, ErrPublishedOutcomeMismatch) {
		t.Fatalf("SECURITY DEFECT: expected errors.Is(err, ErrPublishedOutcomeMismatch) for a different remote head, got %v", err)
	}
	if err := client.MarkPublished(g.GrantID, "headA", 8); !errors.Is(err, ErrPublishedOutcomeMismatch) {
		t.Fatalf("SECURITY DEFECT: expected errors.Is(err, ErrPublishedOutcomeMismatch) for a different PR number, got %v", err)
	}

	live, gate, err := client.AdmitPublicationPhase(g.GrantID)
	if err != nil {
		t.Fatalf("AdmitPublicationPhase: %v", err)
	}
	gate.Release()
	if live.RemoteHeadObserved != "headA" || live.PRNumber != 7 {
		t.Fatalf("the original recorded outcome must remain unchanged, got head=%s pr=%d", live.RemoteHeadObserved, live.PRNumber)
	}
}

// --- Finding D / Test 6: MarkBlocked persistence repair, cannot overwrite original reason -----------

func TestMarkBlocked_PersistenceFailureRepairable(t *testing.T) {
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

	if err := client.MarkBlocked(g.GrantID, "REASON_X"); err == nil {
		t.Fatalf("expected the first MarkBlocked to fail while persistence is obstructed")
	}
	// V3.1-B Hardening R3.1.1: while BLOCKED remains pending, admission must report the distinct
	// ErrBlockPersistFailed, never the plain ErrBlocked (which now specifically means "durably
	// acknowledged") -- reporting plain ErrBlocked here would misreport a still-failing Store
	// acknowledgement as settled.
	if live, gate, err := client.AdmitPublicationPhase(g.GrantID); !errors.Is(err, ErrBlockPersistFailed) {
		t.Fatalf("SECURITY DEFECT: expected errors.Is(err, ErrBlockPersistFailed) while BLOCKED remains pending, got live=%v gate=%v err=%v", live, gate, err)
	}
	if err := client.MarkBlocked(g.GrantID, "REASON_X"); err == nil {
		t.Fatalf("expected an identical retry to still fail while persistence remains obstructed")
	}
	if err := client.MarkBlocked(g.GrantID, "REASON_Y"); !errors.Is(err, ErrBlockedReasonMismatch) {
		t.Fatalf("SECURITY DEFECT: a different reason must be rejected as a mismatch even mid-obstruction, got %v", err)
	}

	clearPersistenceObstruction(t, path)

	if err := client.MarkBlocked(g.GrantID, "REASON_X"); err != nil {
		t.Fatalf("expected the retried MarkBlocked (after clearing the obstruction) to succeed, got %v", err)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	if _, err := reopened.Client().BeginOrResume("d"); err != ErrBlocked {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably show BLOCKED, err=%v", err)
	}
}

// --- Finding E / Test 8: expiry persistence failure is observable and repairable --------------------

func TestBeginOrResume_ExpiryPersistenceFailureIsObservableAndRepairable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "grants.json")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	fixedNow := time.Now()
	s.clock = func() time.Time { return fixedNow }
	if _, err := s.Admin().Create(CreateRequest{RequestDigest: "d", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Second}); err != nil {
		t.Fatalf("Create: %v", err)
	}
	s.clock = func() time.Time { return fixedNow.Add(time.Hour) } // past the 1-second TTL

	obstructPersistence(t, path)

	if _, err := s.Client().BeginOrResume("d"); err == nil {
		t.Fatalf("expected BeginOrResume to fail (persistence obstructed) rather than silently discard the expiry transition")
	} else if !errors.Is(err, ErrExpirePersistFailed) {
		t.Fatalf("expected errors.Is(err, ErrExpirePersistFailed), got %v", err)
	}

	// Rolled back to AUTHORIZED (never phase-admissible either way) -- no phase gate is reachable.
	live, gate, err := s.Client().AdmitPublicationPhase(findGrantIDByDigest(t, s, "d"))
	if err == nil {
		gate.Release()
		t.Fatalf("SECURITY DEFECT: phase admission must never succeed for an unpersisted-expiry grant, got %+v", live)
	}

	clearPersistenceObstruction(t, path)

	if _, err := s.Client().BeginOrResume("d"); err != ErrExpired {
		t.Fatalf("expected ErrExpired once persistence recovers, got %v", err)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	if _, err := reopened.Client().BeginOrResume("d"); err != ErrExpired {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably show EXPIRED, err=%v", err)
	}
}

// --- Test 9: RecordRemoteHead never false-succeeds ---------------------------------------------------

func TestRecordRemoteHead_NeverFalseSucceeds(t *testing.T) {
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

	if err := client.RecordRemoteHead(g.GrantID, "headA"); err == nil {
		t.Fatalf("expected RecordRemoteHead to fail while persistence is obstructed")
	}

	// The in-memory cache must not silently drift ahead of disk -- it is rolled back to its
	// pre-attempt value ("" here, since no head was ever successfully recorded).
	live, gate, err := client.AdmitPublicationPhase(g.GrantID)
	if err != nil {
		t.Fatalf("AdmitPublicationPhase: %v", err)
	}
	gate.Release()
	if live.RemoteHeadObserved != "" {
		t.Fatalf("expected the in-memory cache to remain rolled back to its prior value, got %q", live.RemoteHeadObserved)
	}

	clearPersistenceObstruction(t, path)

	if err := client.RecordRemoteHead(g.GrantID, "headA"); err != nil {
		t.Fatalf("expected the retried RecordRemoteHead to succeed, got %v", err)
	}
	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	reopenedLive, err := reopened.Client().BeginOrResume("d")
	if err != nil {
		t.Fatalf("BeginOrResume after reopen: %v", err)
	}
	if reopenedLive.RemoteHeadObserved != "headA" {
		t.Fatalf("expected the reopened Store to durably show head=headA, got %q", reopenedLive.RemoteHeadObserved)
	}
}

// --- V3.1-B Hardening R3.1: terminal persistence acknowledgement (pending vs. clean) --------------

// Test 1 (R3.1) -- BeginOrResume must never report a PUBLISHED snapshot while that exact terminal
// state remains persistence-pending; it must return errors.Is-compatible ErrPublishPersistFailed
// instead, and only report PUBLISHED once persistence actually repairs.
func TestBeginOrResume_CannotReportPendingPublished(t *testing.T) {
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
		t.Fatalf("expected MarkPublished to fail with ErrPublishPersistFailed, got %v", err)
	}

	live, err := client.BeginOrResume("d")
	if !errors.Is(err, ErrPublishPersistFailed) {
		t.Fatalf("SECURITY DEFECT: expected errors.Is(err, ErrPublishPersistFailed) while PUBLISHED remains pending, got live=%v err=%v", live, err)
	}
	if live != nil {
		t.Fatalf("SECURITY DEFECT: a pending-PUBLISHED BeginOrResume must never return a snapshot")
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	if l, err := reopened.Client().BeginOrResume("d"); err != nil || l.State != StateInProgress {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to still show IN_PROGRESS while pending, got live=%v err=%v", l, err)
	}

	clearPersistenceObstruction(t, path)

	repaired, err := client.BeginOrResume("d")
	if err != nil {
		t.Fatalf("expected BeginOrResume to repair and return PUBLISHED after recovery, got %v", err)
	}
	if repaired.State != StatePublished || repaired.RemoteHeadObserved != "headA" || repaired.PRNumber != 7 {
		t.Fatalf("expected exact PUBLISHED/headA/7, got %+v", repaired)
	}

	reopenedAgain, err := Open(path)
	if err != nil {
		t.Fatalf("reopen again: %v", err)
	}
	final, err := reopenedAgain.Client().BeginOrResume("d")
	if err != nil || final.State != StatePublished || final.RemoteHeadObserved != "headA" || final.PRNumber != 7 {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably show exact PUBLISHED/headA/7, got live=%+v err=%v", final, err)
	}
}

// Test 2 (R3.1) -- AdmitPublicationPhase must never return a successful PUBLISHED snapshot+gate
// while repair persistence is failing.
func TestAdmitPublicationPhase_CannotReportPendingPublished(t *testing.T) {
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
		t.Fatalf("expected MarkPublished to fail with ErrPublishPersistFailed, got %v", err)
	}

	live, gate, err := client.AdmitPublicationPhase(g.GrantID)
	if !errors.Is(err, ErrPublishPersistFailed) {
		t.Fatalf("SECURITY DEFECT: expected errors.Is(err, ErrPublishPersistFailed), got live=%v gate=%v err=%v", live, gate, err)
	}
	if gate != nil {
		t.Fatalf("SECURITY DEFECT: no remote-effect authority (a held gate) may be returned while PUBLISHED is pending")
	}
	if live != nil {
		t.Fatalf("SECURITY DEFECT: no Grant snapshot may be returned while PUBLISHED is pending")
	}

	clearPersistenceObstruction(t, path)

	live2, gate2, err := client.AdmitPublicationPhase(g.GrantID)
	if err != nil {
		t.Fatalf("expected admission to repair and succeed after recovery, got %v", err)
	}
	gate2.Release()
	if live2.State != StatePublished {
		t.Fatalf("expected PUBLISHED, got %s", live2.State)
	}
}

// Test 5 (R3.1) -- pending BLOCKED remains distinguishable from durably-acknowledged BLOCKED.
func TestBeginOrResume_PendingBlockedRemainsDistinguishable(t *testing.T) {
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
	if err := client.MarkBlocked(g.GrantID, "REASON_X"); !errors.Is(err, ErrBlockPersistFailed) {
		t.Fatalf("expected MarkBlocked to fail with ErrBlockPersistFailed, got %v", err)
	}

	if _, err := client.BeginOrResume("d"); !errors.Is(err, ErrBlockPersistFailed) {
		t.Fatalf("SECURITY DEFECT: expected errors.Is(err, ErrBlockPersistFailed) while BLOCKED remains pending, got %v", err)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	if l, err := reopened.Client().BeginOrResume("d"); err != nil || l.State != StateInProgress {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to still show IN_PROGRESS while pending, got live=%v err=%v", l, err)
	}

	clearPersistenceObstruction(t, path)

	if _, err := client.BeginOrResume("d"); err != ErrBlocked {
		t.Fatalf("expected plain ErrBlocked (durably acknowledged) after recovery, got %v", err)
	}

	reopenedAgain, err := Open(path)
	if err != nil {
		t.Fatalf("reopen again: %v", err)
	}
	// BeginOrResume never returns a snapshot for BLOCKED (always nil, ErrBlocked) -- confirm the exact
	// durable reason via a direct (white-box, same-package) read of the reopened Store instead.
	if _, err := reopenedAgain.Client().BeginOrResume("d"); err != ErrBlocked {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably report plain ErrBlocked, got %v", err)
	}
	reopenedAgain.mu.Lock()
	reopenedGrant, ok := reopenedAgain.byDigest["d"]
	reopenedAgain.mu.Unlock()
	if !ok || reopenedGrant.State != StateBlocked || reopenedGrant.BlockedReason != "REASON_X" {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably show BLOCKED/REASON_X, got %+v", reopenedGrant)
	}
}

// Test 6 (R3.1) -- a clean, already-durable PUBLISHED state does not require (or perform) an
// unnecessary rewrite merely because a LATER write happens to be unavailable.
func TestBeginOrResume_CleanPublishedDoesNotRequireNewWrite(t *testing.T) {
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
	if err := client.MarkPublished(g.GrantID, "headA", 7); err != nil {
		t.Fatalf("MarkPublished: %v", err)
	}

	obstructPersistence(t, path)
	defer clearPersistenceObstruction(t, path)

	live, err := client.BeginOrResume("d")
	if err != nil {
		t.Fatalf("expected the already-durable PUBLISHED snapshot to still be returned despite unavailable future writes, got %v", err)
	}
	if live.State != StatePublished {
		t.Fatalf("expected PUBLISHED, got %s", live.State)
	}

	live2, gate2, err := client.AdmitPublicationPhase(g.GrantID)
	if err != nil {
		t.Fatalf("expected the idempotent PUBLISHED admission to still succeed, got %v", err)
	}
	gate2.Release()
	if live2.State != StatePublished {
		t.Fatalf("expected PUBLISHED, got %s", live2.State)
	}
}

// Test 7 (R3.1) -- a clean, already-durable BLOCKED state returns plain ErrBlocked, not
// ErrBlockPersistFailed, despite a later write being unavailable.
func TestBeginOrResume_CleanBlockedDoesNotRequireNewWrite(t *testing.T) {
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
	if err := client.MarkBlocked(g.GrantID, "REASON_X"); err != nil {
		t.Fatalf("MarkBlocked: %v", err)
	}

	obstructPersistence(t, path)
	defer clearPersistenceObstruction(t, path)

	if _, err := client.BeginOrResume("d"); err != ErrBlocked {
		t.Fatalf("expected plain ErrBlocked (already durably acknowledged) despite unavailable future writes, got %v", err)
	}
}

// Test 8 (R3.1) -- a successful full-store write triggered by an UNRELATED Grant's mutation
// acknowledges every other Grant's pending terminal state too, since persistLockedAcknowledging
// always serializes the full, current byDigest map.
func TestSuccessfulUnrelatedWrite_AcknowledgesOtherPendingGrants(t *testing.T) {
	path := filepath.Join(t.TempDir(), "grants.json")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	client := s.Client()

	gA := authorizedGrant(t, s, "dA")
	if _, err := client.BeginOrResume("dA"); err != nil {
		t.Fatalf("BeginOrResume A: %v", err)
	}
	gB := authorizedGrant(t, s, "dB")
	if _, err := client.BeginOrResume("dB"); err != nil {
		t.Fatalf("BeginOrResume B: %v", err)
	}

	obstructPersistence(t, path)
	if err := client.MarkPublished(gA.GrantID, "headA", 1); !errors.Is(err, ErrPublishPersistFailed) {
		t.Fatalf("expected MarkPublished A to fail, got %v", err)
	}
	clearPersistenceObstruction(t, path)

	// A completely unrelated, successful mutation on Grant B.
	if err := client.MarkBlocked(gB.GrantID, "REASON_B"); err != nil {
		t.Fatalf("MarkBlocked B: %v", err)
	}

	// Grant A must now be acknowledged (clean) WITHOUT another repair write of its own -- verified by
	// re-obstructing persistence and confirming BeginOrResume(A) still succeeds.
	obstructPersistence(t, path)
	defer clearPersistenceObstruction(t, path)

	liveA, err := client.BeginOrResume("dA")
	if err != nil {
		t.Fatalf("expected Grant A to already be acknowledged (clean) via B's successful write, got %v", err)
	}
	if liveA.State != StatePublished {
		t.Fatalf("expected PUBLISHED, got %s", liveA.State)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	finalA, err := reopened.Client().BeginOrResume("dA")
	if err != nil || finalA.State != StatePublished {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably show Grant A PUBLISHED, got live=%+v err=%v", finalA, err)
	}
}

// Test 9 (R3.1) -- pending/dirty metadata must never be serialized into a Grant's JSON.
func TestPendingMetadata_NeverSerialized(t *testing.T) {
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
	_ = client.MarkPublished(g.GrantID, "headA", 7) // leave A pending
	clearPersistenceObstruction(t, path)
	if err := client.MarkPublished(g.GrantID, "headA", 7); err != nil {
		t.Fatalf("repair MarkPublished: %v", err)
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	for _, forbidden := range []string{"pending", "dirty", "acknowledged", "persist_pending"} {
		if bytesContainsFold(raw, forbidden) {
			t.Fatalf("SECURITY DEFECT: serialized Store JSON contains forbidden key/token %q:\n%s", forbidden, raw)
		}
	}

	var decoded []map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	for _, m := range decoded {
		for _, forbidden := range []string{"pending", "dirty", "acknowledged", "persist_pending"} {
			if _, ok := m[forbidden]; ok {
				t.Fatalf("SECURITY DEFECT: a Grant JSON object contains forbidden key %q", forbidden)
			}
		}
	}
}

func bytesContainsFold(b []byte, sub string) bool {
	return strings.Contains(strings.ToLower(string(b)), strings.ToLower(sub))
}

// Test 10 (R3.1) -- multiple identical concurrent repair attempts against one pending terminal state
// produce at most one physical successful persistence, no race, and every successful caller observes
// the same exact outcome.
func TestConcurrentRepair_SafeAndConsistent(t *testing.T) {
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

	// Release the obstruction concurrently with a burst of repair attempts -- a bounded barrier
	// (not sleeps) synchronizes goroutine start; the exact moment persistence becomes available is
	// intentionally racy relative to the goroutines, which is what this test is exercising.
	var start sync.WaitGroup
	start.Add(1)
	var wg sync.WaitGroup
	results := make([]*Grant, 8)
	errs := make([]error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			start.Wait()
			results[i], errs[i] = client.BeginOrResume("d")
		}(i)
	}
	clearPersistenceObstruction(t, path)
	start.Done()
	wg.Wait()

	for i := range results {
		if errs[i] != nil && !errors.Is(errs[i], ErrPublishPersistFailed) {
			t.Fatalf("goroutine %d: unexpected error %v", i, errs[i])
		}
		if results[i] != nil {
			if results[i].State != StatePublished || results[i].RemoteHeadObserved != "headA" || results[i].PRNumber != 7 {
				t.Fatalf("goroutine %d: inconsistent outcome %+v", i, results[i])
			}
		}
	}

	// Eventually (after the obstruction cleared), the state must be durably PUBLISHED.
	final, err := client.BeginOrResume("d")
	if err != nil || final.State != StatePublished || final.RemoteHeadObserved != "headA" || final.PRNumber != 7 {
		t.Fatalf("expected durable exact PUBLISHED/headA/7, got live=%+v err=%v", final, err)
	}
	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	reopenedLive, err := reopened.Client().BeginOrResume("d")
	if err != nil || reopenedLive.State != StatePublished || reopenedLive.RemoteHeadObserved != "headA" || reopenedLive.PRNumber != 7 {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably show exact PUBLISHED/headA/7, got live=%+v err=%v", reopenedLive, err)
	}
}

func findGrantIDByDigest(t *testing.T, s *Store, digest string) string {
	t.Helper()
	s.mu.Lock()
	defer s.mu.Unlock()
	g, ok := s.byDigest[digest]
	if !ok {
		t.Fatalf("no grant for digest %s", digest)
	}
	return g.GrantID
}

// --- V3.1-B Hardening R3.1.1: terminal pending truth across all API surfaces ------------------------

// Test 1 (R3.1.1) -- pending BLOCKED phase admission cannot report clean BLOCKED.
func TestAdmitPublicationPhase_CannotReportPendingBlocked(t *testing.T) {
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
	if err := client.MarkBlocked(g.GrantID, "REASON_X"); !errors.Is(err, ErrBlockPersistFailed) {
		t.Fatalf("expected MarkBlocked to fail with ErrBlockPersistFailed, got %v", err)
	}

	live, gate, err := client.AdmitPublicationPhase(g.GrantID)
	if !errors.Is(err, ErrBlockPersistFailed) {
		t.Fatalf("SECURITY DEFECT: expected errors.Is(err, ErrBlockPersistFailed) while BLOCKED remains pending, got live=%v gate=%v err=%v", live, gate, err)
	}
	if gate != nil {
		t.Fatalf("SECURITY DEFECT: no remote-effect authority (a held gate) may be returned while BLOCKED is pending")
	}
	if live != nil {
		t.Fatalf("SECURITY DEFECT: no Grant snapshot may be returned while BLOCKED is pending")
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	if l, err := reopened.Client().BeginOrResume("d"); err != nil || l.State != StateInProgress {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to still show IN_PROGRESS while pending, got live=%v err=%v", l, err)
	}
}

// Test 2 (R3.1.1) -- pending BLOCKED phase admission repairs after recovery.
func TestAdmitPublicationPhase_PendingBlockedRepairsAfterRecovery(t *testing.T) {
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
	if err := client.MarkBlocked(g.GrantID, "REASON_X"); !errors.Is(err, ErrBlockPersistFailed) {
		t.Fatalf("expected MarkBlocked to fail, got %v", err)
	}
	clearPersistenceObstruction(t, path)

	live, gate, err := client.AdmitPublicationPhase(g.GrantID)
	if err != ErrBlocked {
		t.Fatalf("expected admission to repair and return plain ErrBlocked after recovery, got %v", err)
	}
	if live != nil || gate != nil {
		t.Fatalf("BLOCKED admission must never return a snapshot or gate, got live=%v gate=%v", live, gate)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	reopened.mu.Lock()
	reopenedGrant, ok := reopened.byDigest["d"]
	reopened.mu.Unlock()
	if !ok || reopenedGrant.State != StateBlocked || reopenedGrant.BlockedReason != "REASON_X" {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably show BLOCKED/REASON_X, got %+v", reopenedGrant)
	}
}

// Test 3 (R3.1.1) -- clean BLOCKED admission needs no new write.
func TestAdmitPublicationPhase_CleanBlockedDoesNotRequireNewWrite(t *testing.T) {
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
	if err := client.MarkBlocked(g.GrantID, "REASON_X"); err != nil {
		t.Fatalf("MarkBlocked: %v", err)
	}

	obstructPersistence(t, path)
	defer clearPersistenceObstruction(t, path)

	live, gate, err := client.AdmitPublicationPhase(g.GrantID)
	if err != ErrBlocked {
		t.Fatalf("expected plain ErrBlocked (already durably acknowledged) despite unavailable future writes, got %v", err)
	}
	if live != nil || gate != nil {
		t.Fatalf("BLOCKED admission must never return a snapshot or gate, got live=%v gate=%v", live, gate)
	}
}

// Test 4 (R3.1.1) -- Revoke of a pending BLOCKED grant reports persistence failure, never the
// terminal-refusal sentinel, and never touches the state or original reason.
func TestRevoke_PendingBlocked_ReportsPersistenceFailure(t *testing.T) {
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
	if err := client.MarkBlocked(g.GrantID, "REASON_X"); !errors.Is(err, ErrBlockPersistFailed) {
		t.Fatalf("expected MarkBlocked to fail, got %v", err)
	}
	defer clearPersistenceObstruction(t, path)

	err = s.Admin().Revoke(g.GrantID)
	if !errors.Is(err, ErrBlockPersistFailed) {
		t.Fatalf("SECURITY DEFECT: expected errors.Is(err, ErrBlockPersistFailed), got %v", err)
	}
	if errors.Is(err, ErrCannotRevokeBlocked) {
		t.Fatalf("SECURITY DEFECT: Revoke must not report ErrCannotRevokeBlocked while BLOCKED remains pending -- that conceals the still-failing Store acknowledgement")
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	if l, err := reopened.Client().BeginOrResume("d"); err != nil || l.State != StateInProgress {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to still show IN_PROGRESS while pending, got live=%v err=%v", l, err)
	}
	s.mu.Lock()
	liveGrant := s.byDigest["d"]
	s.mu.Unlock()
	if liveGrant.State != StateBlocked || liveGrant.BlockedReason != "REASON_X" {
		t.Fatalf("Revoke must not alter the in-memory state/reason, got %+v", liveGrant)
	}
}

// Test 5 (R3.1.1) -- Revoke of a pending BLOCKED grant repairs persistence, then still returns the
// terminal refusal (revocation remains denied; repair does not equal success).
func TestRevoke_PendingBlocked_RepairsThenReturnsTerminalRefusal(t *testing.T) {
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
	if err := client.MarkBlocked(g.GrantID, "REASON_X"); !errors.Is(err, ErrBlockPersistFailed) {
		t.Fatalf("expected MarkBlocked to fail, got %v", err)
	}
	clearPersistenceObstruction(t, path)

	err = s.Admin().Revoke(g.GrantID)
	if !errors.Is(err, ErrCannotRevokeBlocked) {
		t.Fatalf("expected errors.Is(err, ErrCannotRevokeBlocked) after repair, got %v", err)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	reopened.mu.Lock()
	reopenedGrant, ok := reopened.byDigest["d"]
	reopened.mu.Unlock()
	if !ok || reopenedGrant.State != StateBlocked || reopenedGrant.BlockedReason != "REASON_X" {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably show BLOCKED/REASON_X (never REVOKED), got %+v", reopenedGrant)
	}
}

// Test 6 (R3.1.1) -- Revoke of a clean BLOCKED grant does not depend on another write.
func TestRevoke_CleanBlocked_DoesNotRequireNewWrite(t *testing.T) {
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
	if err := client.MarkBlocked(g.GrantID, "REASON_X"); err != nil {
		t.Fatalf("MarkBlocked: %v", err)
	}

	obstructPersistence(t, path)
	defer clearPersistenceObstruction(t, path)

	if err := s.Admin().Revoke(g.GrantID); !errors.Is(err, ErrCannotRevokeBlocked) {
		t.Fatalf("expected ErrCannotRevokeBlocked despite unavailable future writes, got %v", err)
	}
}

// Test 7 (R3.1.1) -- Revoke of a pending PUBLISHED grant reports persistence failure, never the
// terminal-refusal sentinel, and never touches the exact recorded outcome.
func TestRevoke_PendingPublished_ReportsPersistenceFailure(t *testing.T) {
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
	defer clearPersistenceObstruction(t, path)

	err = s.Admin().Revoke(g.GrantID)
	if !errors.Is(err, ErrPublishPersistFailed) {
		t.Fatalf("SECURITY DEFECT: expected errors.Is(err, ErrPublishPersistFailed), got %v", err)
	}
	if errors.Is(err, ErrCannotRevokePublished) {
		t.Fatalf("SECURITY DEFECT: Revoke must not report ErrCannotRevokePublished while PUBLISHED remains pending")
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	if l, err := reopened.Client().BeginOrResume("d"); err != nil || l.State != StateInProgress {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to still show IN_PROGRESS while pending, got live=%v err=%v", l, err)
	}
	s.mu.Lock()
	liveGrant := s.byDigest["d"]
	s.mu.Unlock()
	if liveGrant.State != StatePublished || liveGrant.RemoteHeadObserved != "headA" || liveGrant.PRNumber != 7 {
		t.Fatalf("Revoke must not alter the in-memory outcome, got %+v", liveGrant)
	}
}

// Test 8 (R3.1.1) -- Revoke of a pending PUBLISHED grant repairs persistence, then still returns the
// terminal refusal.
func TestRevoke_PendingPublished_RepairsThenReturnsTerminalRefusal(t *testing.T) {
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
	clearPersistenceObstruction(t, path)

	err = s.Admin().Revoke(g.GrantID)
	if !errors.Is(err, ErrCannotRevokePublished) {
		t.Fatalf("expected errors.Is(err, ErrCannotRevokePublished) after repair, got %v", err)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	reopened.mu.Lock()
	reopenedGrant, ok := reopened.byDigest["d"]
	reopened.mu.Unlock()
	if !ok || reopenedGrant.State != StatePublished || reopenedGrant.RemoteHeadObserved != "headA" || reopenedGrant.PRNumber != 7 {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably show exact PUBLISHED/headA/7 (never REVOKED), got %+v", reopenedGrant)
	}
}

// Test 9 (R3.1.1) -- Revoke of a clean PUBLISHED grant does not depend on another write.
func TestRevoke_CleanPublished_DoesNotRequireNewWrite(t *testing.T) {
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
	if err := client.MarkPublished(g.GrantID, "headA", 7); err != nil {
		t.Fatalf("MarkPublished: %v", err)
	}

	obstructPersistence(t, path)
	defer clearPersistenceObstruction(t, path)

	if err := s.Admin().Revoke(g.GrantID); !errors.Is(err, ErrCannotRevokePublished) {
		t.Fatalf("expected ErrCannotRevokePublished despite unavailable future writes, got %v", err)
	}
}

// Test 12 (R3.1.1) -- a successful unrelated Store write acknowledges a pending terminal state that
// Revoke then observes as clean, without requiring another repair write.
func TestRevoke_ObservesCleanAfterUnrelatedSuccessfulWrite(t *testing.T) {
	path := filepath.Join(t.TempDir(), "grants.json")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	client := s.Client()

	gA := authorizedGrant(t, s, "dA")
	if _, err := client.BeginOrResume("dA"); err != nil {
		t.Fatalf("BeginOrResume A: %v", err)
	}
	gB := authorizedGrant(t, s, "dB")
	if _, err := client.BeginOrResume("dB"); err != nil {
		t.Fatalf("BeginOrResume B: %v", err)
	}

	obstructPersistence(t, path)
	if err := client.MarkBlocked(gA.GrantID, "REASON_A"); !errors.Is(err, ErrBlockPersistFailed) {
		t.Fatalf("expected MarkBlocked A to fail, got %v", err)
	}
	clearPersistenceObstruction(t, path)

	// A completely unrelated, successful mutation on Grant B.
	if err := client.MarkPublished(gB.GrantID, "headB", 1); err != nil {
		t.Fatalf("MarkPublished B: %v", err)
	}

	// Grant A must now be acknowledged (clean) via B's write -- verified by re-obstructing and
	// confirming Revoke(A) still returns the terminal refusal without needing its own repair write.
	obstructPersistence(t, path)
	defer clearPersistenceObstruction(t, path)

	if err := s.Admin().Revoke(gA.GrantID); !errors.Is(err, ErrCannotRevokeBlocked) {
		t.Fatalf("expected Grant A to already be acknowledged (clean) via B's successful write, got %v", err)
	}
}
