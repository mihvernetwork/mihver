package server

// Regression suite (orchestrate-level) for DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R3-PERSISTENCE-TRUTHFUL-GRANT-STATE-MACHINE.
//
// Required Test 7: Orchestrate must never silently discard a MarkBlocked persistence failure (the
// pre-R3 code did exactly this at every one of its 11 call sites via `_ = client.MarkBlocked(...)`).
// Exercised here through a real file-backed grant.Store with persistence genuinely obstructed --
// never a simulated/faked MarkBlocked result.

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"mihver.network/publication-broker/internal/grant"
	"mihver.network/publication-broker/internal/protocol"
	"mihver.network/publication-broker/internal/testutil"
)

func TestOrchestrate_MarkBlockedPersistenceFailure_NeverSilentlyDiscarded(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, false)
	remoteDir := testutil.NewBareRemote(t)

	grantPath := filepath.Join(t.TempDir(), "grants.json")
	grants, err := grant.Open(grantPath)
	if err != nil {
		t.Fatalf("grant.Open: %v", err)
	}
	deps, _ := newDepsWithGrants(t, grants, remoteDir, "tok", "")

	// Authorize with a base_commit that will disagree with the Envelope, forcing the pre-effect
	// GRANT_REQUEST_FIELD_MISMATCH path -- the simplest reachable MarkBlocked call site.
	req, err := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if err != nil {
		t.Fatalf("ParseRequest: %v", err)
	}
	digest := req.RequestDigest().Hex()
	created, err := grants.Admin().Create(grant.CreateRequest{
		RequestDigest: digest, RepositoryOwner: pkg.envelope.Repository.Owner, RepositoryName: pkg.envelope.Repository.Name,
		Branch: pkg.envelope.Branch, BaseBranch: pkg.envelope.BaseBranch, BaseCommit: "deliberately-wrong-base-commit",
		TTL: 3600_000_000_000,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	grantID := created.GrantID

	// Transition AUTHORIZED -> IN_PROGRESS FIRST, unobstructed -- Orchestrate's own internal
	// BeginOrResume call must not be the one that hits the obstruction below (that would exercise
	// Begin's own persistence-truthful path, not MarkBlocked's, which is what this test targets). A
	// RESUME of an already-IN_PROGRESS grant performs no persistLocked() call at all, so Orchestrate's
	// subsequent BeginOrResume call (once obstructed) proceeds straight through to the field-mismatch
	// check and its MarkBlocked call.
	if _, err := grants.Client().BeginOrResume(digest); err != nil {
		t.Fatalf("pre-transition BeginOrResume: %v", err)
	}

	// Obstruct persistence for the MarkBlocked call this field-mismatch path is about to make.
	if err := os.Mkdir(grantPath+".tmp", 0o700); err != nil {
		t.Fatalf("obstruct: %v", err)
	}
	defer os.Remove(grantPath + ".tmp")

	res := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)

	if res.Status != "BLOCKED" {
		t.Fatalf("expected BLOCKED, got %+v", res)
	}
	if res.FailureReason != "GRANT_BLOCK_PERSIST_FAILED" {
		t.Fatalf("SECURITY DEFECT: MarkBlocked's persistence failure was silently discarded -- expected FailureReason=GRANT_BLOCK_PERSIST_FAILED, got %q (the original intended reason must not be reported as though it had been durably recorded)", res.FailureReason)
	}

	// In-memory state fails closed to BLOCKED (mirroring MarkPublished/Revoke's own R2.1/R3 pattern --
	// a "decision" transition is never rolled back, only Begin's pre-decision transitions are), even
	// though the durable write has not landed yet. V3.1-B Hardening R3.1.1: while still pending, this
	// must report the distinct ErrBlockPersistFailed, never plain ErrBlocked (which now specifically
	// means "durably acknowledged").
	client := grants.Client()
	if _, _, err := client.AdmitPublicationPhase(grantID); !errors.Is(err, grant.ErrBlockPersistFailed) {
		t.Fatalf("SECURITY DEFECT: expected errors.Is(err, ErrBlockPersistFailed) while BLOCKED remains pending, got %v", err)
	}

	if err := os.Remove(grantPath + ".tmp"); err != nil {
		t.Fatalf("clear obstruction: %v", err)
	}

	// A retry of Orchestrate with the IDENTICAL package must opportunistically repair the BLOCKED
	// persistence (BeginOrResume's own retry path -- see its "opportunistic repair" doc comment) --
	// BLOCKED remains the reported, terminal fact either way (never re-derived from the original
	// field-mismatch check again), but the durable write must now actually land.
	retry := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if retry.Status != "BLOCKED" || retry.FailureReason != "GRANT_PREVIOUSLY_BLOCKED" {
		t.Fatalf("expected the retry to report GRANT_PREVIOUSLY_BLOCKED (BLOCKED is already the fail-closed, decided fact), got %+v", retry)
	}

	reopened, err := grant.Open(grantPath)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	if _, err := reopened.Client().BeginOrResume(digest); err != grant.ErrBlocked {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably show BLOCKED, err=%v", err)
	}
}

// TestOrchestrate_RetryCannotReportPublishedWithoutRepairingPersistence is the required regression
// test for the MAJOR finding an independent Codex Reviewer surfaced in this round: BeginOrResume's
// (and AdmitPublicationPhase's) idempotent PUBLISHED short-circuit read the in-memory snapshot
// directly and returned it as a successful Result -- without ever giving MarkPublished's own
// persistence-repair-retry logic a chance to run again. A resubmission of the identical package could
// therefore report PUBLISHED forever while the on-disk Store still showed IN_PROGRESS. Fixed by having
// BeginOrResume's and AdmitPublicationPhase's PUBLISHED cases opportunistically re-attempt
// persistLocked() before returning (grant.go) -- this test proves a resubmission after a push
// succeeded but MarkPublished's persistence failed, once the obstruction clears, actually repairs the
// durable write, not merely re-reports the same in-memory fact forever.
func TestOrchestrate_RetryCannotReportPublishedWithoutRepairingPersistence(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, false) // no-PR flow: publication completes entirely in Phase A
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
	if _, err := grants.Admin().Create(grant.CreateRequest{
		RequestDigest: digest, RepositoryOwner: pkg.envelope.Repository.Owner, RepositoryName: pkg.envelope.Repository.Name,
		Branch: pkg.envelope.Branch, BaseBranch: pkg.envelope.BaseBranch, BaseCommit: pkg.envelope.BaseCommit,
		TTL: 3600_000_000_000,
	}); err != nil {
		t.Fatalf("Create: %v", err)
	}

	// Transition AUTHORIZED -> IN_PROGRESS FIRST, unobstructed -- see the identical rationale in
	// TestOrchestrate_MarkBlockedPersistenceFailure_NeverSilentlyDiscarded above: a RESUME performs no
	// persistLocked() call, so Orchestrate's own internal BeginOrResume call (once obstructed below)
	// is not what fails first.
	if _, err := grants.Client().BeginOrResume(digest); err != nil {
		t.Fatalf("pre-transition BeginOrResume: %v", err)
	}

	// Obstruct persistence -- the push itself must succeed (it doesn't touch the grant store), but
	// MarkPublished's own persist attempt must fail, leaving the grant fail-closed PUBLISHED in
	// memory only.
	if err := os.Mkdir(grantPath+".tmp", 0o700); err != nil {
		t.Fatalf("obstruct: %v", err)
	}

	first := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if first.Status != "BLOCKED" || first.FailureReason != "GRANT_PUBLISH_PERSIST_FAILED" {
		t.Fatalf("expected the first attempt to report GRANT_PUBLISH_PERSIST_FAILED (push succeeded, persist did not), got %+v", first)
	}

	// While STILL obstructed, a resubmission must NOT report PUBLISHED -- proving the fix actually
	// re-attempts persistence rather than trusting the in-memory snapshot. Exact requirement (V3.1-B
	// Hardening R3.1 -- the R3 version of this test only failed on ErrNotFound, which never actually
	// happens here, so it silently passed despite Orchestrate returning PUBLISHED against a disk state
	// that still showed IN_PROGRESS): the second attempt must be BLOCKED/GRANT_PUBLISH_PERSIST_FAILED,
	// and the reopened Store must still show IN_PROGRESS, never PUBLISHED.
	stillObstructed := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if stillObstructed.Status != "BLOCKED" || stillObstructed.FailureReason != "GRANT_PUBLISH_PERSIST_FAILED" {
		t.Fatalf("SECURITY DEFECT: expected BLOCKED/GRANT_PUBLISH_PERSIST_FAILED while still obstructed, got %+v", stillObstructed)
	}
	reopenedStillObstructed, err := grant.Open(grantPath)
	if err != nil {
		t.Fatalf("reopen (still obstructed): %v", err)
	}
	liveStillObstructed, err := reopenedStillObstructed.Client().BeginOrResume(digest)
	if err != nil {
		t.Fatalf("BeginOrResume (still obstructed reopen): %v", err)
	}
	if liveStillObstructed.State != grant.StateInProgress {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to still show IN_PROGRESS while persistence remains obstructed, got %s", liveStillObstructed.State)
	}

	if err := os.Remove(grantPath + ".tmp"); err != nil {
		t.Fatalf("clear obstruction: %v", err)
	}

	retry := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if retry.Status != "PUBLISHED" {
		t.Fatalf("expected the retry (after clearing the obstruction) to report PUBLISHED, got %+v", retry)
	}

	reopened, err := grant.Open(grantPath)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	live, err := reopened.Client().BeginOrResume(digest)
	if err != nil {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably show PUBLISHED, err=%v", err)
	}
	if live.State != grant.StatePublished {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably show PUBLISHED, got %s", live.State)
	}
}

// Test 4 (R3.1) -- a PR flow whose PR create/update succeeds but whose MarkPublished persistence
// fails must not report PUBLISHED, must not create/update another PR while still obstructed, and
// after recovery must repair to the exact original PR number without creating a duplicate PR.
func TestOrchestrate_PRFlow_CannotFalseSucceedOnPublishPersistenceFailure(t *testing.T) {
	repo := testutil.NewRepo(t)
	pkg := buildPackage(t, repo, true)
	remoteDir := testutil.NewBareRemote(t)

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
				"number": 99, "state": "open", "title": body["title"], "body": body["body"],
				"head": map[string]string{"ref": body["head"], "sha": pkg.commitSHA},
				"base": map[string]string{"ref": body["base"]},
			}
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(createdPR)
		}
	}))
	defer prServer.Close()

	grantPath := filepath.Join(t.TempDir(), "grants.json")
	grants, err := grant.Open(grantPath)
	if err != nil {
		t.Fatalf("grant.Open: %v", err)
	}
	deps, _ := newDepsWithGrants(t, grants, remoteDir, "tok", prServer.URL)

	req, err := protocol.ParseRequest(pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if err != nil {
		t.Fatalf("ParseRequest: %v", err)
	}
	digest := req.RequestDigest().Hex()
	if _, err := grants.Admin().Create(grant.CreateRequest{
		RequestDigest: digest, RepositoryOwner: pkg.envelope.Repository.Owner, RepositoryName: pkg.envelope.Repository.Name,
		Branch: pkg.envelope.Branch, BaseBranch: pkg.envelope.BaseBranch, BaseCommit: pkg.envelope.BaseCommit,
		TTL: 3600_000_000_000,
	}); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if _, err := grants.Client().BeginOrResume(digest); err != nil {
		t.Fatalf("pre-transition BeginOrResume: %v", err)
	}

	if err := os.Mkdir(grantPath+".tmp", 0o700); err != nil {
		t.Fatalf("obstruct: %v", err)
	}

	first := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if first.Status != "BLOCKED" || first.FailureReason != "GRANT_PUBLISH_PERSIST_FAILED" {
		t.Fatalf("expected the first attempt to report GRANT_PUBLISH_PERSIST_FAILED (push+PR succeeded, persist did not), got %+v", first)
	}
	mu.Lock()
	callsAfterFirst := createCalls
	mu.Unlock()
	if callsAfterFirst != 1 {
		t.Fatalf("expected exactly one PR create call after the first attempt, got %d", callsAfterFirst)
	}

	stillObstructed := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if stillObstructed.Status != "BLOCKED" || stillObstructed.FailureReason != "GRANT_PUBLISH_PERSIST_FAILED" {
		t.Fatalf("SECURITY DEFECT: expected BLOCKED/GRANT_PUBLISH_PERSIST_FAILED while still obstructed, got %+v", stillObstructed)
	}
	mu.Lock()
	callsStillObstructed := createCalls
	mu.Unlock()
	if callsStillObstructed != 1 {
		t.Fatalf("SECURITY DEFECT: expected no additional PR create call while still obstructed, got %d total", callsStillObstructed)
	}

	if err := os.Remove(grantPath + ".tmp"); err != nil {
		t.Fatalf("clear obstruction: %v", err)
	}

	retry := Orchestrate(context.Background(), deps, pkg.envelopeBytes, pkg.receiptBytes, pkg.bundleBytes, pkg.manifestBytes)
	if retry.Status != "PUBLISHED" || retry.PRNumber != 99 {
		t.Fatalf("expected the retry (after clearing the obstruction) to report PUBLISHED with the exact original PR number 99, got %+v", retry)
	}
	mu.Lock()
	finalCalls := createCalls
	mu.Unlock()
	if finalCalls != 1 {
		t.Fatalf("SECURITY DEFECT: expected exactly one PR to exist across the whole retry sequence, got %d create calls", finalCalls)
	}

	reopened, err := grant.Open(grantPath)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	live, err := reopened.Client().BeginOrResume(digest)
	if err != nil || live.State != grant.StatePublished || live.PRNumber != 99 {
		t.Fatalf("SECURITY DEFECT: expected the reopened Store to durably show PUBLISHED/PR 99, got live=%+v err=%v", live, err)
	}
}

// newDepsWithGrants mirrors newDeps but accepts an already-open *grant.Store (so the test can obstruct
// its exact backing file), rather than opening one internally.
func newDepsWithGrants(t *testing.T, grants *grant.Store, remoteDir, token, prServerURL string) (Deps, *grant.Store) {
	t.Helper()
	deps, _ := newDeps(t, remoteDir, token, prServerURL)
	deps.Grants = grants.Client()
	return deps, grants
}
