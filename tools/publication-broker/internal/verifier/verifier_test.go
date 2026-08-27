package verifier

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os/exec"
	"testing"

	"mihver.network/publication-broker/internal/pkgimport"
	"mihver.network/publication-broker/internal/protocol"
	"mihver.network/publication-broker/internal/testutil"
)

func gitBinary(t *testing.T) string {
	t.Helper()
	path, err := exec.LookPath("git")
	if err != nil {
		t.Fatalf("git not found on PATH: %v", err)
	}
	return path
}

// scenario builds a valid single-commit publish scenario: repo on `main`, task branch with one
// added file "new.txt", imported into broker-owned storage, and matching Envelope/Receipt.
type scenario struct {
	repo      *testutil.Repo
	im        *pkgimport.Imported
	envelope  *protocol.Envelope
	receipt   *protocol.Receipt
	baseSHA   string
	commitSHA string
}

func newScenario(t *testing.T) *scenario {
	t.Helper()
	repo := testutil.NewRepo(t)
	base := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", base)
	repo.WriteFile("new.txt", "hello\n")
	repo.StageAll()
	commitSHA := repo.Commit("test commit")

	blobSHA := repo.BlobSHA("new.txt")
	fp := computeExpectedFingerprint(t, []entry{{path: "new.txt", digest: blobSHA}})

	bundle := repo.BuildBundleForImport(t, commitSHA)
	im, err := pkgimport.Import(context.Background(), gitBinary(t), bundle, commitSHA)
	if err != nil {
		t.Fatalf("pkgimport.Import: %v", err)
	}
	t.Cleanup(im.Close)

	envelope := &protocol.Envelope{
		ProtocolVersion:        protocol.ProtocolVersion,
		Repository:             protocol.Repository{RemoteName: "origin", Owner: "mihvernetwork", Name: "mihver"},
		Branch:                 "chore/test-branch",
		BaseBranch:             "main",
		BaseCommit:             base,
		ExpectedPrePublishHead: base,
		AllowedFiles:           []protocol.AllowedFile{{Path: "new.txt", Action: "present"}},
		PublicationFingerprint: fp,
		CommitMessage:          "test commit",
		PRExpected:             false,
	}
	receipt := &protocol.Receipt{
		Status: "COMMITTED", ProtocolVersion: protocol.ProtocolVersion,
		Repository: envelope.Repository, Branch: envelope.Branch, BaseCommit: base,
		PrePublishHead: base, Fingerprint: fp, CommitSHA: commitSHA, LocalHead: commitSHA, WorkingTree: "clean",
	}
	return &scenario{repo: repo, im: im, envelope: envelope, receipt: receipt, baseSHA: base, commitSHA: commitSHA}
}

type entry struct{ path, digest string }

func computeExpectedFingerprint(t *testing.T, entries []entry) string {
	t.Helper()
	h := sha256.New()
	for _, e := range entries {
		h.Write([]byte(e.path))
		h.Write([]byte{0})
		h.Write([]byte(e.digest))
		h.Write([]byte("\n"))
	}
	return hex.EncodeToString(h.Sum(nil))
}

func TestVerifyCommit_HappyPath(t *testing.T) {
	s := newScenario(t)
	res := VerifyCommit(context.Background(), s.im, s.envelope, s.receipt)
	if !res.OK {
		t.Fatalf("expected OK, got BLOCKED %s: %s", res.Reason, res.Detail)
	}
}

func TestVerifyCommit_ReceiptStatusNotCommitted(t *testing.T) {
	s := newScenario(t)
	s.receipt.Status = "BLOCKED"
	s.receipt.FailureReason = "x"
	s.receipt.CommitSHA = ""
	res := VerifyCommit(context.Background(), s.im, s.envelope, s.receipt)
	if res.OK || res.Reason != "RECEIPT_NOT_COMMITTED" {
		t.Fatalf("expected RECEIPT_NOT_COMMITTED, got %+v", res)
	}
}

func TestVerifyCommit_PrePublishHeadMismatch(t *testing.T) {
	s := newScenario(t)
	s.receipt.PrePublishHead = s.commitSHA // wrong on purpose
	res := VerifyCommit(context.Background(), s.im, s.envelope, s.receipt)
	if res.OK || res.Reason != "RECEIPT_PRE_PUBLISH_HEAD_MISMATCH" {
		t.Fatalf("expected RECEIPT_PRE_PUBLISH_HEAD_MISMATCH, got %+v", res)
	}
}

func TestVerifyCommit_BaseCommitNotAncestor(t *testing.T) {
	s := newScenario(t)
	other := testutil.NewRepo(t)
	s.envelope.BaseCommit = other.Head()
	s.receipt.BaseCommit = other.Head()
	res := VerifyCommit(context.Background(), s.im, s.envelope, s.receipt)
	if res.OK || res.Reason != "BASE_COMMIT_NOT_ANCESTOR" {
		t.Fatalf("expected BASE_COMMIT_NOT_ANCESTOR, got %+v", res)
	}
}

func TestVerifyCommit_BranchEqualsBaseBranch(t *testing.T) {
	s := newScenario(t)
	s.envelope.BaseBranch = s.envelope.Branch
	res := VerifyCommit(context.Background(), s.im, s.envelope, s.receipt)
	if res.OK || res.Reason != "BRANCH_EQUALS_BASE_BRANCH" {
		t.Fatalf("expected BRANCH_EQUALS_BASE_BRANCH, got %+v", res)
	}
}

func TestVerifyCommit_CommitMessageMismatch(t *testing.T) {
	s := newScenario(t)
	s.envelope.CommitMessage = "a different message"
	res := VerifyCommit(context.Background(), s.im, s.envelope, s.receipt)
	if res.OK || res.Reason != "COMMIT_MESSAGE_MISMATCH" {
		t.Fatalf("expected COMMIT_MESSAGE_MISMATCH, got %+v", res)
	}
}

func TestVerifyCommit_ExtraChangedPath(t *testing.T) {
	repo := testutil.NewRepo(t)
	base := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", base)
	repo.WriteFile("new.txt", "hello\n")
	repo.WriteFile("sneaky.txt", "should not be authorized\n")
	repo.StageAll()
	commitSHA := repo.Commit("test commit")

	fp := computeExpectedFingerprint(t, []entry{{path: "new.txt", digest: repo.BlobSHA("new.txt")}})
	bundle := repo.BuildBundleForImport(t, commitSHA)
	im, err := pkgimport.Import(context.Background(), gitBinary(t), bundle, commitSHA)
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	defer im.Close()

	envelope := &protocol.Envelope{
		ProtocolVersion: protocol.ProtocolVersion, Repository: protocol.Repository{RemoteName: "origin", Owner: "o", Name: "n"},
		Branch: "chore/test-branch", BaseBranch: "main", BaseCommit: base, ExpectedPrePublishHead: base,
		AllowedFiles:           []protocol.AllowedFile{{Path: "new.txt", Action: "present"}},
		PublicationFingerprint: fp, CommitMessage: "test commit", PRExpected: false,
	}
	receipt := &protocol.Receipt{
		Status: "COMMITTED", ProtocolVersion: protocol.ProtocolVersion, Repository: envelope.Repository,
		Branch: envelope.Branch, BaseCommit: base, PrePublishHead: base, Fingerprint: fp,
		CommitSHA: commitSHA, LocalHead: commitSHA, WorkingTree: "clean",
	}
	res := VerifyCommit(context.Background(), im, envelope, receipt)
	if res.OK || res.Reason != "EXTRA_CHANGED_PATH" {
		t.Fatalf("expected EXTRA_CHANGED_PATH, got %+v", res)
	}
}

func TestVerifyCommit_MissingChangedPath(t *testing.T) {
	s := newScenario(t)
	// Declare an additional allowed_files entry that was never actually changed in the commit.
	s.envelope.AllowedFiles = append(s.envelope.AllowedFiles, protocol.AllowedFile{Path: "never-touched.txt", Action: "present"})
	res := VerifyCommit(context.Background(), s.im, s.envelope, s.receipt)
	if res.OK || res.Reason != "MISSING_CHANGED_PATH" {
		t.Fatalf("expected MISSING_CHANGED_PATH, got %+v", res)
	}
}

func TestVerifyCommit_ActionDisagreement(t *testing.T) {
	s := newScenario(t)
	s.envelope.AllowedFiles = []protocol.AllowedFile{{Path: "new.txt", Action: "deletion"}}
	res := VerifyCommit(context.Background(), s.im, s.envelope, s.receipt)
	if res.OK || res.Reason != "ACTION_DISAGREEMENT" {
		t.Fatalf("expected ACTION_DISAGREEMENT, got %+v", res)
	}
}

func TestVerifyCommit_FingerprintMismatch(t *testing.T) {
	s := newScenario(t)
	s.envelope.PublicationFingerprint = hex.EncodeToString(sha256.New().Sum(nil)) // wrong on purpose
	res := VerifyCommit(context.Background(), s.im, s.envelope, s.receipt)
	// Caught earlier as RECEIPT_FINGERPRINT_MISMATCH since receipt.Fingerprint (still the correct
	// value) now disagrees with the mutated envelope value -- both cross-checks exist and either
	// firing first is a correct fail-closed outcome.
	if res.OK {
		t.Fatalf("expected BLOCKED for fingerprint mismatch, got OK")
	}
}

func TestVerifyCommit_CommitTreeFingerprintMismatch_IndependentOfReceiptClaim(t *testing.T) {
	s := newScenario(t)
	// Make the RECEIPT and ENVELOPE agree with each other on a WRONG fingerprint value (simulating
	// a Local Builder + Envelope that collaboratively lied) -- the Broker must still independently
	// recompute from the actual commit tree and BLOCK, not trust their mutual agreement.
	wrong := computeExpectedFingerprint(t, []entry{{path: "new.txt", digest: "0000000000000000000000000000000000000000"}})
	s.envelope.PublicationFingerprint = wrong
	s.receipt.Fingerprint = wrong
	res := VerifyCommit(context.Background(), s.im, s.envelope, s.receipt)
	if res.OK || res.Reason != "COMMIT_TREE_FINGERPRINT_MISMATCH" {
		t.Fatalf("expected COMMIT_TREE_FINGERPRINT_MISMATCH, got %+v", res)
	}
}

func TestComputeCommitTreeFingerprint_RejectsSymlink(t *testing.T) {
	repo := testutil.NewRepo(t)
	base := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", base)
	cmd := exec.Command("ln", "-s", "/etc/passwd", "link.txt")
	cmd.Dir = repo.Dir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("ln -s: %v %s", err, out)
	}
	repo.StageAll()
	commitSHA := repo.Commit("add symlink")

	bundle := repo.BuildBundleForImport(t, commitSHA)
	im, err := pkgimport.Import(context.Background(), gitBinary(t), bundle, commitSHA)
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	defer im.Close()

	_, err = ComputeCommitTreeFingerprint(context.Background(), im, commitSHA, []protocol.AllowedFile{{Path: "link.txt", Action: "present"}})
	if err == nil {
		t.Fatalf("expected error for symlink path, got nil")
	}
}

func TestVerifyCommit_DeletionEntry(t *testing.T) {
	repo := testutil.NewRepo(t)
	base := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", base)
	repo.RemoveFile(".seed")
	repo.StageAll()
	commitSHA := repo.Commit("delete seed")

	fp := computeExpectedFingerprint(t, []entry{{path: ".seed", digest: "ABSENT"}})
	bundle := repo.BuildBundleForImport(t, commitSHA)
	im, err := pkgimport.Import(context.Background(), gitBinary(t), bundle, commitSHA)
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	defer im.Close()

	envelope := &protocol.Envelope{
		ProtocolVersion: protocol.ProtocolVersion, Repository: protocol.Repository{RemoteName: "origin", Owner: "o", Name: "n"},
		Branch: "chore/test-branch", BaseBranch: "main", BaseCommit: base, ExpectedPrePublishHead: base,
		AllowedFiles:           []protocol.AllowedFile{{Path: ".seed", Action: "deletion"}},
		PublicationFingerprint: fp, CommitMessage: "delete seed", PRExpected: false,
	}
	receipt := &protocol.Receipt{
		Status: "COMMITTED", ProtocolVersion: protocol.ProtocolVersion, Repository: envelope.Repository,
		Branch: envelope.Branch, BaseCommit: base, PrePublishHead: base, Fingerprint: fp,
		CommitSHA: commitSHA, LocalHead: commitSHA, WorkingTree: "clean",
	}
	res := VerifyCommit(context.Background(), im, envelope, receipt)
	if !res.OK {
		t.Fatalf("expected OK for authorized deletion, got %+v", res)
	}
}
