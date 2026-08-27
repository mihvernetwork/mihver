package grant

import (
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func newStore(t *testing.T) *Store {
	t.Helper()
	path := filepath.Join(t.TempDir(), "grants.json")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	return s
}

func TestClient_MissingGrant(t *testing.T) {
	s := newStore(t)
	_, err := s.Client().BeginOrResume("nonexistent-digest")
	if err != ErrNotFound {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestClient_WrongRequestDigestNeverMatchesAnotherGrant(t *testing.T) {
	s := newStore(t)
	if _, err := s.Admin().Create(CreateRequest{RequestDigest: "digest-A", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour}); err != nil {
		t.Fatalf("Create: %v", err)
	}
	// A grant exists, but for a DIFFERENT digest -- "digest-B" must never be authorized by it.
	_, err := s.Client().BeginOrResume("digest-B")
	if err != ErrNotFound {
		t.Fatalf("expected ErrNotFound for wrong digest, got %v", err)
	}
}

func TestClient_ExpiredGrant(t *testing.T) {
	s := newStore(t)
	fixedNow := time.Now()
	s.clock = func() time.Time { return fixedNow }
	if _, err := s.Admin().Create(CreateRequest{RequestDigest: "d", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Second}); err != nil {
		t.Fatalf("Create: %v", err)
	}
	s.clock = func() time.Time { return fixedNow.Add(time.Hour) } // advance past expiry
	_, err := s.Client().BeginOrResume("d")
	if err != ErrExpired {
		t.Fatalf("expected ErrExpired, got %v", err)
	}
}

func TestAdmin_RevokedGrantBlocksClient(t *testing.T) {
	s := newStore(t)
	g, err := s.Admin().Create(CreateRequest{RequestDigest: "d", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := s.Admin().Revoke(g.GrantID); err != nil {
		t.Fatalf("Revoke: %v", err)
	}
	_, err = s.Client().BeginOrResume("d")
	if err != ErrRevoked {
		t.Fatalf("expected ErrRevoked, got %v", err)
	}
}

func TestClient_SameGrantCannotAuthorizeDifferentRequest(t *testing.T) {
	s := newStore(t)
	if _, err := s.Admin().Create(CreateRequest{RequestDigest: "digest-for-request-A", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour}); err != nil {
		t.Fatalf("Create: %v", err)
	}
	// "request B" computes an entirely different digest (this is inherent to the digest recipe --
	// simulated here by simply querying a different digest string); the grant bound to A's digest
	// must never resolve for B's.
	_, err := s.Client().BeginOrResume("digest-for-request-B")
	if err != ErrNotFound {
		t.Fatalf("expected ErrNotFound: a grant for one request must never authorize a different request, got %v", err)
	}
}

func TestUnprivilegedClientHandleCannotCreateOrRevoke(t *testing.T) {
	// This is a compile-time property, not a runtime check: ClientHandle simply has no Create or
	// Revoke method. This test documents and pins that fact -- if someone later adds such a method
	// to ClientHandle, this comment (and the type-level guarantee it describes) would need updating.
	s := newStore(t)
	client := s.Client()
	var _ *ClientHandle = client
	// The following would not compile if uncommented, which is the point:
	//   client.Create(CreateRequest{})
	//   client.Revoke("x")
}

func TestBeginOrResume_IdempotentRetrySameDigest(t *testing.T) {
	s := newStore(t)
	if _, err := s.Admin().Create(CreateRequest{RequestDigest: "d", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour}); err != nil {
		t.Fatalf("Create: %v", err)
	}
	client := s.Client()
	g1, err := client.BeginOrResume("d")
	if err != nil {
		t.Fatalf("first BeginOrResume: %v", err)
	}
	if g1.State != StateInProgress {
		t.Fatalf("expected IN_PROGRESS after first begin, got %s", g1.State)
	}
	// Retry with the identical digest while IN_PROGRESS must succeed (resume), not error.
	g2, err := client.BeginOrResume("d")
	if err != nil {
		t.Fatalf("resume BeginOrResume: %v", err)
	}
	if g2.GrantID != g1.GrantID {
		t.Fatalf("resume returned a different grant")
	}

	if err := client.MarkPublished(g1.GrantID, "deadbeef", 42); err != nil {
		t.Fatalf("MarkPublished: %v", err)
	}
	g3, err := client.BeginOrResume("d")
	if err != nil {
		t.Fatalf("resume after publish: %v", err)
	}
	if g3.State != StatePublished {
		t.Fatalf("expected PUBLISHED, got %s", g3.State)
	}
}

func TestRevoke_CannotRevokePublishedGrant(t *testing.T) {
	s := newStore(t)
	g, _ := s.Admin().Create(CreateRequest{RequestDigest: "d", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour})
	client := s.Client()
	if _, err := client.BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}
	if err := client.MarkPublished(g.GrantID, "head", 0); err != nil {
		t.Fatalf("MarkPublished: %v", err)
	}
	if err := s.Admin().Revoke(g.GrantID); err == nil {
		t.Fatalf("expected error revoking a PUBLISHED grant")
	}
}

func TestAdmin_CannotCreateDuplicateDigest(t *testing.T) {
	s := newStore(t)
	req := CreateRequest{RequestDigest: "d", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour}
	if _, err := s.Admin().Create(req); err != nil {
		t.Fatalf("first Create: %v", err)
	}
	if _, err := s.Admin().Create(req); err != ErrAlreadyExists {
		t.Fatalf("expected ErrAlreadyExists, got %v", err)
	}
}

func TestPersistence_SurvivesReopen(t *testing.T) {
	path := filepath.Join(t.TempDir(), "grants.json")
	s1, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	g, err := s1.Admin().Create(CreateRequest{RequestDigest: "d", RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	s2, err := Open(path)
	if err != nil {
		t.Fatalf("re-Open: %v", err)
	}
	got, err := s2.Client().BeginOrResume("d")
	if err != nil {
		t.Fatalf("BeginOrResume after reopen: %v", err)
	}
	if got.GrantID != g.GrantID {
		t.Fatalf("grant identity did not survive reopen")
	}
}

// --- V3.1-B Hardening R2: linearizable per-Grant phase gate --------------------------------------

func authorizedGrant(t *testing.T, s *Store, digest string) *Grant {
	t.Helper()
	g, err := s.Admin().Create(CreateRequest{RequestDigest: digest, RepositoryOwner: "o", RepositoryName: "n", Branch: "b", BaseBranch: "main", BaseCommit: "c", TTL: time.Hour})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	return g
}

// Test 6 (R2) -- phase admission after a successful revoke is denied.
func TestAdmitPublicationPhase_AfterRevoke_Denied(t *testing.T) {
	s := newStore(t)
	g := authorizedGrant(t, s, "d")
	client := s.Client()
	if _, err := client.BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}
	if err := s.Admin().Revoke(g.GrantID); err != nil {
		t.Fatalf("Revoke: %v", err)
	}
	_, gate, err := client.AdmitPublicationPhase(g.GrantID)
	if err != ErrRevoked {
		t.Fatalf("expected ErrRevoked, got err=%v gate=%v", err, gate)
	}
	if gate != nil {
		t.Fatalf("a denied admission must never return a held gate")
	}
}

// Test 7 (R2) -- Revoke waits for an already-admitted phase, and only succeeds after that phase
// releases the gate (with the Grant still IN_PROGRESS at that point).
func TestRevoke_WaitsForAdmittedPhase(t *testing.T) {
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

	revokeDone := make(chan error, 1)
	revokeStarted := make(chan struct{})
	go func() {
		close(revokeStarted)
		revokeDone <- s.Admin().Revoke(g.GrantID)
	}()
	<-revokeStarted

	// Revoke must not be able to complete while the phase gate is still held -- prove this with a
	// bounded, non-sleep select rather than asserting a negative via a fixed delay.
	select {
	case err := <-revokeDone:
		t.Fatalf("Revoke returned (err=%v) while the phase gate was still held -- linearization was not enforced", err)
	case <-time.After(50 * time.Millisecond):
		// expected: still blocked
	}

	gate.Release()

	select {
	case err := <-revokeDone:
		if err != nil {
			t.Fatalf("expected Revoke to succeed once the phase gate was released, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("Revoke did not return after the phase gate was released")
	}

	got, _, err := client.AdmitPublicationPhase(g.GrantID)
	if err != ErrRevoked {
		t.Fatalf("expected the grant to now be REVOKED, got grant=%v err=%v", got, err)
	}
}

// Test 8 (R2) -- different Grants' phase gates are fully independent; holding one never blocks
// admission or revocation of another.
func TestPhaseGate_DifferentGrantsAreIndependent(t *testing.T) {
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

	// Grant B's admission and revocation must both proceed promptly while A's gate is held.
	done := make(chan error, 1)
	go func() {
		_, gateB, err := client.AdmitPublicationPhase(gB.GrantID)
		if err != nil {
			done <- err
			return
		}
		gateB.Release()
		done <- s.Admin().Revoke(gB.GrantID)
	}()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("Grant B operations failed: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("Grant B admission/revocation blocked behind Grant A's gate -- gates are not independent")
	}
}

// Test 5 (R2) -- revocation must not overwrite BLOCKED or EXPIRED terminal states.
func TestRevoke_DoesNotOverwriteBlocked(t *testing.T) {
	s := newStore(t)
	g := authorizedGrant(t, s, "d")
	client := s.Client()
	if _, err := client.BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}
	if err := client.MarkBlocked(g.GrantID, "SOME_REASON"); err != nil {
		t.Fatalf("MarkBlocked: %v", err)
	}
	if err := s.Admin().Revoke(g.GrantID); err == nil {
		t.Fatalf("expected an error revoking a BLOCKED grant, got nil (BLOCKED must not be silently overwritten)")
	}
	got, _, err := client.AdmitPublicationPhase(g.GrantID)
	if err != ErrBlocked {
		t.Fatalf("expected the grant to remain BLOCKED, got grant=%v err=%v", got, err)
	}
}

func TestRevoke_DoesNotOverwriteExpired(t *testing.T) {
	s := newStore(t)
	fixedNow := time.Now()
	s.clock = func() time.Time { return fixedNow }
	g := authorizedGrant(t, s, "d")
	s.clock = func() time.Time { return fixedNow.Add(2 * time.Hour) } // past the 1-hour TTL
	client := s.Client()
	if _, err := client.BeginOrResume("d"); err != ErrExpired {
		t.Fatalf("expected ErrExpired, got %v", err)
	}
	if err := s.Admin().Revoke(g.GrantID); err == nil {
		t.Fatalf("expected an error revoking an EXPIRED grant, got nil (EXPIRED must not be silently overwritten)")
	}
	_, _, err := client.AdmitPublicationPhase(g.GrantID)
	if err != ErrExpired {
		t.Fatalf("expected the grant to remain EXPIRED, got err=%v", err)
	}
}

// PUBLISHED case is already covered by TestRevoke_CannotRevokePublishedGrant above; this test only
// additionally confirms admission still reports PUBLISHED (idempotent), not an error, afterward.
func TestRevoke_DoesNotOverwritePublished(t *testing.T) {
	s := newStore(t)
	g := authorizedGrant(t, s, "d")
	client := s.Client()
	if _, err := client.BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}
	if err := client.MarkPublished(g.GrantID, "deadbeef", 0); err != nil {
		t.Fatalf("MarkPublished: %v", err)
	}
	if err := s.Admin().Revoke(g.GrantID); err == nil {
		t.Fatalf("expected an error revoking a PUBLISHED grant, got nil")
	}
	got, gate, err := client.AdmitPublicationPhase(g.GrantID)
	if err != nil {
		t.Fatalf("expected PUBLISHED to still admit idempotently, got err=%v", err)
	}
	defer gate.Release()
	if got.State != StatePublished {
		t.Fatalf("expected PUBLISHED, got %s", got.State)
	}
}

// --- V3.1-B Hardening R2.1: persistence-truthful revoke, copy-safe phase lease, stable sentinels --

// obstructPersistence creates a real directory at storePath+".tmp" so persistLocked's
// os.WriteFile(tmp, ...) call deterministically fails -- a genuine file-backed I/O failure, not a
// simulated/faked persistLocked return value. clearPersistenceObstruction removes it again.
func obstructPersistence(t *testing.T, storePath string) {
	t.Helper()
	if err := os.Mkdir(storePath+".tmp", 0o700); err != nil {
		t.Fatalf("obstructPersistence: %v", err)
	}
}

func clearPersistenceObstruction(t *testing.T, storePath string) {
	t.Helper()
	if err := os.Remove(storePath + ".tmp"); err != nil {
		t.Fatalf("clearPersistenceObstruction: %v", err)
	}
}

// Test 1 (R2.1) -- a revoke that hits a persistence failure must never let a LATER call report false
// success while the durable write still has not happened; once the obstruction clears, a retry must
// actually persist REVOKED, confirmed by reopening the Store from disk (not merely re-reading the
// same in-memory Store, which would prove nothing about durability).
func TestRevoke_PersistenceFailureNeverBecomesFalseSuccess(t *testing.T) {
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

	if err := s.Admin().Revoke(g.GrantID); err == nil {
		t.Fatalf("expected the first Revoke to fail while persistence is obstructed")
	}

	// In-memory admission must fail closed as REVOKED even though the durable write did not land.
	if _, _, err := client.AdmitPublicationPhase(g.GrantID); err != ErrRevoked {
		t.Fatalf("expected in-memory state to fail closed as REVOKED after the failed persist, got err=%v", err)
	}

	clearPersistenceObstruction(t, path)

	if err := s.Admin().Revoke(g.GrantID); err != nil {
		t.Fatalf("expected the retried Revoke (after clearing the obstruction) to succeed, got %v", err)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	if live, err := reopened.Client().BeginOrResume("d"); err != ErrRevoked {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably report REVOKED, got grant=%v err=%v", live, err)
	}
}

// Test 2 (R2.1) -- while persistence remains obstructed, NO call may return success, however many
// times it is retried.
func TestRevoke_RepeatedPersistenceFailureNeverReportsSuccess(t *testing.T) {
	path := filepath.Join(t.TempDir(), "grants.json")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	g := authorizedGrant(t, s, "d")
	if _, err := s.Client().BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}

	obstructPersistence(t, path)
	defer clearPersistenceObstruction(t, path)

	for i := 1; i <= 3; i++ {
		if err := s.Admin().Revoke(g.GrantID); err == nil {
			t.Fatalf("call %d: expected Revoke to return an error while persistence remains obstructed, got nil", i)
		}
	}
}

// Test 3 (R2.1) -- revoking an already-durably-REVOKED grant (reopened fresh from disk, no in-memory
// history) remains idempotent success, and the store remains REVOKED afterward.
func TestRevoke_AlreadyDurablyRevoked_RemainsIdempotent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "grants.json")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	g := authorizedGrant(t, s, "d")
	if _, err := s.Client().BeginOrResume("d"); err != nil {
		t.Fatalf("BeginOrResume: %v", err)
	}
	if err := s.Admin().Revoke(g.GrantID); err != nil {
		t.Fatalf("first Revoke: %v", err)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	if err := reopened.Admin().Revoke(g.GrantID); err != nil {
		t.Fatalf("expected an idempotent revoke of an already-durably-REVOKED grant to succeed, got %v", err)
	}

	reopenedAgain, err := Open(path)
	if err != nil {
		t.Fatalf("reopen again: %v", err)
	}
	if _, err := reopenedAgain.Client().BeginOrResume("d"); err != ErrRevoked {
		t.Fatalf("expected the grant to remain REVOKED after an idempotent reopen-revoke-reopen cycle, got err=%v", err)
	}
}

// Test 4 (R2.1) -- AdmitPublicationPhase remains fail-closed (ErrRevoked, no gate returned) in the
// SAME process immediately after a revoke persistence failure, even though the durable write has not
// landed yet.
func TestAdmitPublicationPhase_FailClosedAfterRevokePersistenceFailure(t *testing.T) {
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
	defer clearPersistenceObstruction(t, path)

	if err := s.Admin().Revoke(g.GrantID); err == nil {
		t.Fatalf("expected Revoke to fail while persistence is obstructed")
	}

	live, gate, err := client.AdmitPublicationPhase(g.GrantID)
	if err != ErrRevoked {
		t.Fatalf("expected ErrRevoked, got grant=%v err=%v", live, err)
	}
	if gate != nil {
		t.Fatalf("a denied admission must never return a held gate")
	}
}

// Test 5 (R2.1) -- a value-copied PhaseGate must be safe to Release() any number of times, from
// either the original or the copy, in any order, without panicking.
func TestPhaseGate_CopiedLeaseDoubleReleaseIsSafe(t *testing.T) {
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
	copied := *gate

	// None of these four calls may panic ("fatal error: sync: unlock of unlocked mutex"), and exactly
	// one physical mutex unlock may occur across all of them.
	gate.Release()
	copied.Release()
	gate.Release()
	copied.Release()

	// Prove exactly one real unlock happened (not zero): a fresh acquisition for the same Grant must
	// now succeed promptly rather than blocking forever.
	done := make(chan struct{})
	go func() {
		defer close(done)
		_, gate2, err := client.AdmitPublicationPhase(g.GrantID)
		if err != nil {
			t.Errorf("re-admission after release: %v", err)
			return
		}
		gate2.Release()
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatalf("gate was not actually released -- re-admission blocked")
	}
}

// Test 6 (R2.1) -- releasing the original and a copy concurrently, from different goroutines, is
// race-free and still results in exactly one physical unlock.
func TestPhaseGate_ConcurrentAliasReleaseIsSafe(t *testing.T) {
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
	copied := *gate

	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); gate.Release() }()
	go func() { defer wg.Done(); copied.Release() }()
	wg.Wait()

	done := make(chan struct{})
	go func() {
		defer close(done)
		_, gate2, err := client.AdmitPublicationPhase(g.GrantID)
		if err != nil {
			t.Errorf("re-admission after concurrent release: %v", err)
			return
		}
		gate2.Release()
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatalf("gate was not actually released after concurrent alias release")
	}
}

// Test 7 (R2.1) -- a stale alias left over from an EARLIER acquisition must never be able to unlock a
// LATER, unrelated acquisition of the same Grant's gate, even though both share the same underlying
// mutex. Sequence exactly as required: acquire L1, copy it, release both, acquire L2 (a distinct later
// acquisition) and hold it, call Release again on every old L1 alias, then start a competing
// admission and confirm it stays blocked behind L2 -- only releasing L2 itself may unblock it.
func TestPhaseGate_StaleAliasCannotUnlockLaterHolder(t *testing.T) {
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

	// Stale L1 aliases, released again here, must have no effect on L2's acquisition.
	l1.Release()
	l1Copy.Release()

	competing := make(chan error, 1)
	go func() {
		_, gate3, err := client.AdmitPublicationPhase(g.GrantID)
		if err != nil {
			competing <- err
			return
		}
		gate3.Release()
		competing <- nil
	}()

	select {
	case err := <-competing:
		t.Fatalf("SECURITY DEFECT: a stale L1 alias unlocked L2's acquisition -- a competing admission proceeded (err=%v) while L2 should still be exclusively held", err)
	case <-time.After(50 * time.Millisecond):
		// expected: still blocked behind L2
	}

	l2.Release()

	select {
	case err := <-competing:
		if err != nil {
			t.Fatalf("expected the competing admission to succeed once L2 was actually released, got err=%v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("competing admission did not proceed after L2 was released")
	}
}

// Test 8 (R2.1) -- each terminal-state revoke refusal is a stable sentinel, checkable with errors.Is,
// and never overwrites the grant's actual terminal state.
func TestRevoke_TerminalStates_ReturnStableSentinels(t *testing.T) {
	t.Run("PUBLISHED", func(t *testing.T) {
		s := newStore(t)
		g := authorizedGrant(t, s, "d")
		client := s.Client()
		if _, err := client.BeginOrResume("d"); err != nil {
			t.Fatalf("BeginOrResume: %v", err)
		}
		if err := client.MarkPublished(g.GrantID, "head", 0); err != nil {
			t.Fatalf("MarkPublished: %v", err)
		}
		if err := s.Admin().Revoke(g.GrantID); !errors.Is(err, ErrCannotRevokePublished) {
			t.Fatalf("expected errors.Is(err, ErrCannotRevokePublished), got %v", err)
		}
		live, gate, err := client.AdmitPublicationPhase(g.GrantID)
		if err != nil {
			t.Fatalf("expected PUBLISHED to still admit idempotently, got %v", err)
		}
		defer gate.Release()
		if live.State != StatePublished {
			t.Fatalf("state changed: %s", live.State)
		}
	})
	t.Run("BLOCKED", func(t *testing.T) {
		s := newStore(t)
		g := authorizedGrant(t, s, "d")
		client := s.Client()
		if _, err := client.BeginOrResume("d"); err != nil {
			t.Fatalf("BeginOrResume: %v", err)
		}
		if err := client.MarkBlocked(g.GrantID, "REASON_X"); err != nil {
			t.Fatalf("MarkBlocked: %v", err)
		}
		if err := s.Admin().Revoke(g.GrantID); !errors.Is(err, ErrCannotRevokeBlocked) {
			t.Fatalf("expected errors.Is(err, ErrCannotRevokeBlocked), got %v", err)
		}
		if _, _, err := client.AdmitPublicationPhase(g.GrantID); err != ErrBlocked {
			t.Fatalf("expected the grant to remain BLOCKED, got %v", err)
		}
	})
	t.Run("EXPIRED", func(t *testing.T) {
		s := newStore(t)
		fixedNow := time.Now()
		s.clock = func() time.Time { return fixedNow }
		g := authorizedGrant(t, s, "d")
		s.clock = func() time.Time { return fixedNow.Add(2 * time.Hour) } // past the 1-hour TTL
		client := s.Client()
		if _, err := client.BeginOrResume("d"); err != ErrExpired {
			t.Fatalf("expected ErrExpired, got %v", err)
		}
		if err := s.Admin().Revoke(g.GrantID); !errors.Is(err, ErrCannotRevokeExpired) {
			t.Fatalf("expected errors.Is(err, ErrCannotRevokeExpired), got %v", err)
		}
		if _, _, err := client.AdmitPublicationPhase(g.GrantID); err != ErrExpired {
			t.Fatalf("expected the grant to remain EXPIRED, got %v", err)
		}
	})
}
