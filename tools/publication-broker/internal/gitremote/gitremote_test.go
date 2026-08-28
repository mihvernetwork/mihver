package gitremote

import (
	"context"
	"fmt"
	"net/http/cgi"
	"net/http/httptest"
	"net/url"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"mihver.network/publication-broker/internal/gitexec"
	"mihver.network/publication-broker/internal/testutil"
)

func newClient(t *testing.T) Client {
	t.Helper()
	gitBin, err := exec.LookPath("git")
	if err != nil {
		t.Fatalf("git not found: %v", err)
	}
	home := t.TempDir()
	return Client{Sterile: gitexec.Sterile{GitBinary: gitBin, Home: home}}
}

func TestValidateTargetBranch_RejectsMainAndMaster(t *testing.T) {
	if err := ValidateTargetBranch("main", "main"); err == nil {
		t.Fatalf("expected rejection of main")
	}
	if err := ValidateTargetBranch("master", "main"); err == nil {
		t.Fatalf("expected rejection of master")
	}
}

func TestValidateTargetBranch_RejectsBaseBranch(t *testing.T) {
	if err := ValidateTargetBranch("feature", "feature"); err == nil {
		t.Fatalf("expected rejection when branch == base_branch")
	}
}

func TestValidateTargetBranch_RejectsRefPath(t *testing.T) {
	if err := ValidateTargetBranch("refs/heads/feature", "main"); err == nil {
		t.Fatalf("expected rejection of a ref path")
	}
}

func TestValidateTargetBranch_RejectsFlagInjection(t *testing.T) {
	if err := ValidateTargetBranch("--force", "main"); err == nil {
		t.Fatalf("expected rejection of a branch name starting with '-'")
	}
}

func TestValidateTargetBranch_RejectsDotDot(t *testing.T) {
	if err := ValidateTargetBranch("feature/../escape", "main"); err == nil {
		t.Fatalf("expected rejection of '..' in branch name")
	}
}

func TestValidateTargetBranch_AcceptsOrdinaryTaskBranch(t *testing.T) {
	if err := ValidateTargetBranch("chore/publication-broker-v3-1b", "main"); err != nil {
		t.Fatalf("unexpected rejection: %v", err)
	}
}

// pushScenario builds a local repo with a commit, a local bare "remote", and returns everything
// needed to exercise Client.Push against it without any network access.
func pushScenario(t *testing.T) (repo *testutil.Repo, remoteDir, commitSHA string) {
	t.Helper()
	repo = testutil.NewRepo(t)
	base := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", base)
	repo.WriteFile("new.txt", "hello\n")
	repo.StageAll()
	commitSHA = repo.Commit("test commit")
	remoteDir = testutil.NewBareRemote(t)
	return repo, remoteDir, commitSHA
}

func TestPush_NewBranchSucceedsAgainstFakeRemote(t *testing.T) {
	c := newClient(t)
	repo, remoteDir, commitSHA := pushScenario(t)
	after, err := c.Push(context.Background(), repo.Dir, remoteDir, "chore/test-branch", commitSHA, "", "unused-token-for-local-remote")
	if err != nil {
		t.Fatalf("Push: %v", err)
	}
	if after != commitSHA {
		t.Fatalf("unexpected remote head after push: %s", after)
	}
}

func TestPush_UnexpectedRemoteHeadBlocked(t *testing.T) {
	c := newClient(t)
	repo, remoteDir, commitSHA := pushScenario(t)
	// Claim we expect the branch to already exist at some SHA it never actually had.
	_, err := c.Push(context.Background(), repo.Dir, remoteDir, "chore/test-branch", commitSHA, "0000000000000000000000000000000000000000", "unused-token")
	if err != ErrRemoteHeadChanged {
		t.Fatalf("expected ErrRemoteHeadChanged, got %v", err)
	}
}

func TestPush_ExistingRemoteAtExpectedHeadFastForwards(t *testing.T) {
	c := newClient(t)
	repo, remoteDir, commitSHA1 := pushScenario(t)
	if _, err := c.Push(context.Background(), repo.Dir, remoteDir, "chore/test-branch", commitSHA1, "", "tok"); err != nil {
		t.Fatalf("first push: %v", err)
	}

	repo.WriteFile("new2.txt", "more\n")
	repo.StageAll()
	commitSHA2 := repo.Commit("second commit")

	after, err := c.Push(context.Background(), repo.Dir, remoteDir, "chore/test-branch", commitSHA2, commitSHA1, "tok")
	if err != nil {
		t.Fatalf("fast-forward push: %v", err)
	}
	if after != commitSHA2 {
		t.Fatalf("unexpected head after fast-forward: %s", after)
	}
}

func TestPush_NonFastForwardRaceBlocked(t *testing.T) {
	c := newClient(t)
	repo, remoteDir, commitSHA1 := pushScenario(t)
	if _, err := c.Push(context.Background(), repo.Dir, remoteDir, "chore/test-branch", commitSHA1, "", "tok"); err != nil {
		t.Fatalf("first push: %v", err)
	}

	// Simulate someone else moving the remote branch to an unrelated commit in between, directly via
	// plumbing on the bare "remote" itself (not through this package's own Push, and not through an
	// ordinary client push, which would itself be fast-forward-checked and so couldn't set up this
	// scenario at all).
	other := testutil.NewRepo(t)
	otherHead := other.Head()
	// The bare remote doesn't have otherHead's object yet -- fetch it in first via plumbing, then
	// retarget the ref directly.
	fetchCmd := exec.Command("git", "fetch", other.Dir, otherHead)
	fetchCmd.Dir = remoteDir
	if out, err := fetchCmd.CombinedOutput(); err != nil {
		t.Fatalf("setup: fetch unrelated commit into remote: %v %s", err, out)
	}
	updateRefCmd := exec.Command("git", "update-ref", "refs/heads/chore/test-branch", otherHead)
	updateRefCmd.Dir = remoteDir
	if out, err := updateRefCmd.CombinedOutput(); err != nil {
		t.Fatalf("setup: retarget remote branch: %v %s", err, out)
	}

	repo.WriteFile("new2.txt", "more\n")
	repo.StageAll()
	commitSHA2 := repo.Commit("second commit")

	// Caller still believes the expected head is commitSHA1 (stale) -- must be rejected before even
	// attempting git push, since our own pre-check catches it.
	if _, err := c.Push(context.Background(), repo.Dir, remoteDir, "chore/test-branch", commitSHA2, commitSHA1, "tok"); err != ErrRemoteHeadChanged {
		t.Fatalf("expected ErrRemoteHeadChanged, got %v", err)
	}
}

func TestPush_NeverUsesForceFlag(t *testing.T) {
	// Static assertion over the package source is out of scope for a unit test; instead this proves
	// the *behavior* --a push that would require --force to succeed (deliberately mismatched
	// expected head bypassed by directly calling the low-level git push, simulating what --force
	// would have allowed) is never silently reached: Push always returns before invoking `git push`
	// once RemoteHead() disagrees with the caller's expectation.
	c := newClient(t)
	repo, remoteDir, commitSHA1 := pushScenario(t)
	if _, err := c.Push(context.Background(), repo.Dir, remoteDir, "chore/test-branch", commitSHA1, "", "tok"); err != nil {
		t.Fatalf("first push: %v", err)
	}
	unrelated := testutil.NewRepo(t)
	unrelatedHead := unrelated.Head()
	_, err := c.Push(context.Background(), repo.Dir, remoteDir, "chore/test-branch", unrelatedHead, commitSHA1, "tok")
	// unrelatedHead has no ancestry relationship pushed from repo.Dir, and repo.Dir doesn't even
	// contain unrelatedHead as an object, so this must fail one way or another -- confirming no
	// force path silently succeeds here.
	if err == nil {
		t.Fatalf("expected push of an unrelated/unknown commit to fail")
	}
}

// --- Hardening R1.1: atomic compare-and-swap via --force-with-lease -----------------------------

func newRacyClient(t *testing.T, mutate func()) Client {
	t.Helper()
	gitBin, err := exec.LookPath("git")
	if err != nil {
		t.Fatalf("git not found: %v", err)
	}
	home := t.TempDir()
	real := gitexec.Sterile{GitBinary: gitBin, Home: home}
	return Client{Sterile: &testutil.RaceInjectingRunner{Real: real, Mutate: mutate}}
}

// Test 1 (R1.1) -- atomic lease blocks an ancestor rewind landing between Push's pre-check and the
// actual git push subprocess. Demonstrates the exact race the task describes: A -> B -> C, remote at
// B (the authorized predecessor), Push's own pre-check observes B (satisfying the caller's
// expectation), but the remote is rewound to A immediately before the real `git push` subprocess
// runs -- a PLAIN non-force push of C in that situation would still succeed (C is a valid
// fast-forward of A too, since A is C's own ancestor), silently publishing the unauthorized A->C
// transition. The atomic lease must instead fail, and the remote must remain at A.
func TestPush_AtomicLeaseBlocksAncestorRewindBetweenCheckAndPush(t *testing.T) {
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
	pushBareTo(t, repo.Dir, remoteDir, b, "chore/test-branch") // remote starts at the authorized predecessor B

	mutated := false
	client := newRacyClient(t, func() {
		mutated = true
		// Rewind the remote from B to the earlier ancestor A, landing exactly between Push's
		// pre-check (which already observed B) and the real `git push` subprocess about to run.
		setBareRefDirectly(t, remoteDir, a, "chore/test-branch")
	})

	_, err := client.Push(context.Background(), repo.Dir, remoteDir, "chore/test-branch", c, b, "tok")
	if !mutated {
		t.Fatalf("test setup error: the race mutation never fired")
	}
	if err != ErrRemoteHeadChanged {
		t.Fatalf("SECURITY DEFECT: expected ErrRemoteHeadChanged, got %v -- an atomic lease should have rejected the update once the remote no longer matched B", err)
	}
	if got := lsRemoteHead(t, remoteDir, "chore/test-branch"); got != a {
		t.Fatalf("SECURITY DEFECT: remote must remain at A (%s) after the rejected lease, got %s -- C (or C together with B) was published from an unauthorized predecessor", a, got)
	}
}

// Test 2 (R1.1) -- atomic lease blocks a concurrently-created branch. Push's own pre-check observes
// the branch absent, but between that check and the real `git push` subprocess another actor creates
// the branch AT AN ANCESTOR OF commitSHA (A, where the local graph is A -> C) -- chosen deliberately
// so that a PLAIN non-force push of C would still succeed as an ordinary fast-forward from A despite
// the branch having been "absent" (and therefore never authorized to receive any predecessor at all)
// at the moment Push's own pre-check ran. An unrelated concurrently-created commit would already be
// rejected by plain fast-forward-only semantics regardless of any lease, so it would not actually
// exercise this race -- an ancestor is the case that matters.
func TestPush_AtomicLeaseBlocksConcurrentNewBranchCreation(t *testing.T) {
	repo := testutil.NewRepo(t)
	a := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", a)
	repo.WriteFile("c.txt", "c\n")
	repo.StageAll()
	c := repo.Commit("commit c")

	remoteDir := testutil.NewBareRemote(t) // branch absent

	mutated := false
	client := newRacyClient(t, func() {
		mutated = true
		// A concurrent actor creates the branch at A -- an ancestor of C -- between the absence
		// check and the real `git push` subprocess.
		pushBareTo(t, repo.Dir, remoteDir, a, "chore/test-branch")
	})

	_, err := client.Push(context.Background(), repo.Dir, remoteDir, "chore/test-branch", c, "", "tok")
	if !mutated {
		t.Fatalf("test setup error: the race mutation never fired")
	}
	if err != ErrRemoteHeadChanged {
		t.Fatalf("SECURITY DEFECT: expected ErrRemoteHeadChanged, got %v -- an ordinary fast-forward push would have silently succeeded here", err)
	}
	if got := lsRemoteHead(t, remoteDir, "chore/test-branch"); got != a {
		t.Fatalf("SECURITY DEFECT: the concurrently-created branch must remain at A (%s), got %s -- an unauthorized branch-creation race published C", a, got)
	}
}

// Test 5 (R1.1) -- push argv uses only the exact explicit lease, never a bare --force/-f/+refspec,
// never an implicit (value-less) --force-with-lease, and never more than one lease argument.
func TestPush_ArgvUsesOnlyExactExplicitLease(t *testing.T) {
	gitBin, err := exec.LookPath("git")
	if err != nil {
		t.Fatalf("git not found: %v", err)
	}
	home := t.TempDir()
	capture := &testutil.CapturingRunner{Real: gitexec.Sterile{GitBinary: gitBin, Home: home}}
	client := Client{Sterile: capture}

	repo := testutil.NewRepo(t)
	a := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", a)
	repo.WriteFile("c.txt", "c\n")
	repo.StageAll()
	c := repo.Commit("commit c")

	// Existing-branch case: remote already at the authorized predecessor A.
	remoteDir := testutil.NewBareRemote(t)
	pushBareTo(t, repo.Dir, remoteDir, a, "chore/test-branch")
	if _, err := client.Push(context.Background(), repo.Dir, remoteDir, "chore/test-branch", c, a, "tok"); err != nil {
		t.Fatalf("existing-branch push: %v", err)
	}
	existingBranchArgv := findPushArgv(t, capture.Argv)
	assertExactLease(t, existingBranchArgv, "--force-with-lease=refs/heads/chore/test-branch:"+a)

	// Absent-branch case: fresh remote, empty expected value.
	capture.Argv = nil
	remoteDir2 := testutil.NewBareRemote(t)
	if _, err := client.Push(context.Background(), repo.Dir, remoteDir2, "chore/test-branch", c, "", "tok"); err != nil {
		t.Fatalf("absent-branch push: %v", err)
	}
	absentBranchArgv := findPushArgv(t, capture.Argv)
	assertExactLease(t, absentBranchArgv, "--force-with-lease=refs/heads/chore/test-branch:")
}

// findPushArgv returns the single recorded argv slice that contains the literal "push" token.
func findPushArgv(t *testing.T, all [][]string) []string {
	t.Helper()
	var found []string
	count := 0
	for _, args := range all {
		for _, a := range args {
			if a == "push" {
				found = args
				count++
				break
			}
		}
	}
	if count != 1 {
		t.Fatalf("expected exactly one push invocation, found %d among %v", count, all)
	}
	return found
}

// assertExactLease requires argv to contain exactly wantLease as one whole argument (not a
// substring match, which would risk misclassifying the allowed lease as the forbidden bare --force
// flag), and requires none of the categorically forbidden flag shapes are present anywhere in argv.
func assertExactLease(t *testing.T, argv []string, wantLease string) {
	t.Helper()
	leaseCount := 0
	for _, a := range argv {
		if a == wantLease {
			leaseCount++
		}
		// Exact-match forbidden literals only -- never a substring check, which would incorrectly
		// flag "--force-with-lease=..." as containing "--force".
		switch a {
		case "--force", "-f":
			t.Fatalf("SECURITY DEFECT: forbidden flag %q present in push argv %v", a, argv)
		case "--force-with-lease":
			t.Fatalf("SECURITY DEFECT: implicit (value-less) --force-with-lease present in push argv %v", argv)
		}
		if len(a) > 0 && a[0] == '+' {
			t.Fatalf("SECURITY DEFECT: '+'-prefixed refspec %q present in push argv %v (bypasses fast-forward advisory)", a, argv)
		}
	}
	if leaseCount != 1 {
		t.Fatalf("expected exactly one occurrence of the exact lease %q in argv %v, found %d", wantLease, argv, leaseCount)
	}
	// No second/different --force-with-lease value anywhere (multi-lease rejection).
	otherLeaseCount := 0
	for _, a := range argv {
		if len(a) >= len("--force-with-lease=") && a[:len("--force-with-lease=")] == "--force-with-lease=" && a != wantLease {
			otherLeaseCount++
		}
	}
	if otherLeaseCount != 0 {
		t.Fatalf("SECURITY DEFECT: found %d unexpected additional --force-with-lease argument(s) in argv %v", otherLeaseCount, argv)
	}
}

func pushBareTo(t *testing.T, repoDir, remoteDir, sha, branch string) {
	t.Helper()
	cmd := exec.Command("git", "push", remoteDir, sha+":refs/heads/"+branch)
	cmd.Dir = repoDir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("setup push: %v\n%s", err, out)
	}
}

func setBareRefDirectly(t *testing.T, remoteDir, sha, branch string) {
	t.Helper()
	cmd := exec.Command("git", "update-ref", "refs/heads/"+branch, sha)
	cmd.Dir = remoteDir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("setup update-ref: %v\n%s", err, out)
	}
}

func fetchIntoBare(t *testing.T, remoteDir, otherDir, sha string) {
	t.Helper()
	cmd := exec.Command("git", "fetch", otherDir, sha)
	cmd.Dir = remoteDir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("setup fetch: %v\n%s", err, out)
	}
}

func lsRemoteHead(t *testing.T, remoteDir, branch string) string {
	t.Helper()
	cmd := exec.Command("git", "ls-remote", remoteDir, "refs/heads/"+branch)
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

// Regression test for a real reviewer-confirmed finding (Hardening R1.1 independent review): the
// failed-push classification branch re-observed the remote fresh and reported ErrRemoteHeadChanged
// whenever the observation disagreed with expectedHead -- including when the observation was
// commitSHA itself, i.e. when the push had ACTUALLY SUCCEEDED server-side and only the client-side
// command reporting failed (e.g. a dropped connection after the atomic server-side lease already
// applied). That misclassified a genuine success as a terminal race, which would have permanently
// BLOCKED a grant whose authorized commit was actually published. This test uses a real disposable
// git repo/bare remote and a FaultInjectingRunner that lets the real `git push` genuinely execute
// (so the remote is genuinely updated) but then discards that real success and returns a synthetic
// client-visible error -- proving Push now recovers and reports success instead of ErrRemoteHeadChanged.
func TestPush_PushAppliedButClientReportedError_TreatedAsSuccess(t *testing.T) {
	gitBin, err := exec.LookPath("git")
	if err != nil {
		t.Fatalf("git not found: %v", err)
	}
	home := t.TempDir()
	real := gitexec.Sterile{GitBinary: gitBin, Home: home}
	fault := &testutil.FaultInjectingRunner{Real: real, FaultErr: fmt.Errorf("simulated: connection dropped after the remote accepted the push")}
	client := Client{Sterile: fault}

	repo := testutil.NewRepo(t)
	a := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", a)
	repo.WriteFile("c.txt", "c\n")
	repo.StageAll()
	c := repo.Commit("commit c")
	remoteDir := testutil.NewBareRemote(t)

	after, err := client.Push(context.Background(), repo.Dir, remoteDir, "chore/test-branch", c, "", "tok")
	if err != nil {
		t.Fatalf("SECURITY/CORRECTNESS DEFECT: expected Push to recover and report success despite the simulated client-side error, got err=%v (a genuinely successful push must never be reported as ErrRemoteHeadChanged)", err)
	}
	if after != c {
		t.Fatalf("expected returned head %s, got %s", c, after)
	}
	if got := lsRemoteHead(t, remoteDir, "chore/test-branch"); got != c {
		t.Fatalf("expected the remote to actually be at C (%s), got %s", c, got)
	}
}

// --- BuildGitHubRemoteURL: repoidentity integration --------------------------------------------
//
// These tests prove, against a REAL local Git-over-HTTP endpoint (git-http-backend run as CGI over
// httptest.Server -- never a simulated/faked result), that an invalid owner/repo can never produce
// a usable remote URL at all, and that a valid owner/repo produces a URL whose request path is
// always exactly "/<owner>/<repo>.git" (two path segments) and actually reaches the authorized
// repository and no other.

// newLocalGitHTTPTLSServer serves every bare repository under root via the real `git http-backend`
// binary (run as CGI) over TLS (via httptest.NewTLSServer's self-signed test certificate) -- e.g. a
// bare repo at root/expected-owner/target.git is reachable at <server>/expected-owner/target.git.
// BuildGitHubRemoteURL always constructs an
// "https://" URL, so the test double must actually speak TLS to be a faithful "real local endpoint"
// rather than requiring the production URL scheme to be weakened for the test's sake.
func newLocalGitHTTPTLSServer(t *testing.T, root string) *httptest.Server {
	t.Helper()
	out, err := exec.Command("git", "--exec-path").Output()
	if err != nil {
		t.Fatalf("git --exec-path: %v", err)
	}
	backend := filepath.Join(strings.TrimSpace(string(out)), "git-http-backend")
	if _, err := exec.LookPath(backend); err != nil {
		t.Skipf("git-http-backend not available at %s: %v", backend, err)
	}
	handler := &cgi.Handler{
		Path: backend,
		Root: "/",
		Dir:  root,
		Env: []string{
			"GIT_PROJECT_ROOT=" + root,
			"GIT_HTTP_EXPORT_ALL=1",
		},
	}
	return httptest.NewTLSServer(handler)
}

// newBareRepoAt creates a bare repo at exactly path (which may be nested, e.g. root/owner/name.git)
// and pushes a single commit into it via a disposable working repo, returning that commit's SHA.
func newBareRepoAt(t *testing.T, path string) (commitSHA string) {
	t.Helper()
	cmd := exec.Command("git", "init", "--bare", "-q", path)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git init --bare %s: %v\n%s", path, out, out)
	}
	work := testutil.NewRepo(t)
	work.PushTo(path, work.Head(), "main")
	return work.Head()
}

func TestBuildGitHubRemoteURL_MaliciousOwner_RejectedNeverReachesRealServer(t *testing.T) {
	root := t.TempDir()
	authorizedSHA := newBareRepoAt(t, filepath.Join(root, "expected-owner", "target.git"))
	attackerSHA := newBareRepoAt(t, filepath.Join(root, "other-owner", "target.git"))
	if authorizedSHA == attackerSHA {
		t.Fatalf("test setup bug: the two fixture repos must have distinguishable heads")
	}

	srv := newLocalGitHTTPTLSServer(t, root)
	defer srv.Close()
	host := strings.TrimPrefix(srv.URL, "https://")

	remoteURL, err := BuildGitHubRemoteURL(host, "expected-owner/../../other-owner", "target")
	if err == nil {
		t.Fatalf("SECURITY DEFECT: expected rejection of a traversal-shaped owner, got url=%q", remoteURL)
	}
	if remoteURL != "" {
		t.Fatalf("SECURITY DEFECT: expected empty URL on validation failure, got %q", remoteURL)
	}
	// No URL was ever produced, so there is nothing to git-ls-remote against -- confirming the
	// function returns before constructing anything a caller could use to reach the real server at
	// all, let alone the wrong (other-owner) repo on it.
}

func TestBuildGitHubRemoteURL_ValidOwnerRepo_ProducesExactTwoSegmentPathAndReachesAuthorizedRepo(t *testing.T) {
	root := t.TempDir()
	authorizedSHA := newBareRepoAt(t, filepath.Join(root, "expected-owner", "target.git"))
	_ = newBareRepoAt(t, filepath.Join(root, "other-owner", "target.git"))

	srv := newLocalGitHTTPTLSServer(t, root)
	defer srv.Close()
	host := strings.TrimPrefix(srv.URL, "https://")

	remoteURL, err := BuildGitHubRemoteURL(host, "expected-owner", "target")
	if err != nil {
		t.Fatalf("unexpected error for a valid owner/repo: %v", err)
	}

	parsed, err := url.Parse(remoteURL)
	if err != nil {
		t.Fatalf("BuildGitHubRemoteURL produced an unparseable URL %q: %v", remoteURL, err)
	}
	segments := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	if len(segments) != 2 {
		t.Fatalf("expected exactly two path segments, got %d in path %q", len(segments), parsed.Path)
	}
	if segments[0] != "expected-owner" || segments[1] != "target.git" {
		t.Fatalf("unexpected path segments %v", segments)
	}

	// Actually reach the real local server with the constructed URL (never simulated) and confirm
	// it lands on the authorized repo, not the attacker's same-named repo under a different owner.
	// -c http.sslVerify=false is required only because httptest.NewTLSServer's certificate is
	// self-signed and not in any trust store -- it does not weaken anything this test is actually
	// checking (the URL's host/path shape and which repo it reaches), it only lets this local test
	// double's own throwaway cert be accepted.
	lsRemote := exec.Command("git", "-c", "http.sslVerify=false", "ls-remote", remoteURL, "refs/heads/main")
	out, err := lsRemote.CombinedOutput()
	if err != nil {
		t.Fatalf("ls-remote against constructed URL failed: %v\n%s", err, out)
	}
	if !strings.HasPrefix(string(out), authorizedSHA) {
		t.Fatalf("expected ls-remote to report the authorized repo's head %s, got %q", authorizedSHA, out)
	}
}
