package pkgimport

import (
	"context"
	"os/exec"
	"testing"

	"mihver.network/publication-broker/internal/testutil"
)

func gitBinary(t *testing.T) string {
	t.Helper()
	path, err := exec.LookPath("git")
	if err != nil {
		t.Fatalf("git not found: %v", err)
	}
	return path
}

func TestImport_HappyPath(t *testing.T) {
	repo := testutil.NewRepo(t)
	base := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", base)
	repo.WriteFile("new.txt", "hello\n")
	repo.StageAll()
	commitSHA := repo.Commit("test commit")

	bundle := repo.BuildBundleForImport(t, commitSHA)
	im, err := Import(context.Background(), gitBinary(t), bundle, commitSHA)
	if err != nil {
		t.Fatalf("Import: %v", err)
	}
	defer im.Close()
	if im.CommitSHA != commitSHA {
		t.Fatalf("unexpected CommitSHA: %s", im.CommitSHA)
	}
}

func TestImport_ReceiptCommitSHAMismatch(t *testing.T) {
	repo := testutil.NewRepo(t)
	base := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", base)
	repo.WriteFile("new.txt", "hello\n")
	repo.StageAll()
	commitSHA := repo.Commit("test commit")

	bundle := repo.BuildBundleForImport(t, commitSHA)
	wrongSHA := base // a real, but different, commit SHA -- simulates a Receipt claiming the wrong commit
	if _, err := Import(context.Background(), gitBinary(t), bundle, wrongSHA); err == nil {
		t.Fatalf("expected error for commit SHA mismatch, got nil")
	}
}

func TestImport_MissingCommitObject(t *testing.T) {
	repo := testutil.NewRepo(t)
	base := repo.Head()
	repo.SwitchNewBranch("chore/test-branch", base)
	repo.WriteFile("new.txt", "hello\n")
	repo.StageAll()
	commitSHA := repo.Commit("test commit")
	bundle := repo.BuildBundleForImport(t, commitSHA)

	// A commit SHA that's syntactically valid (40-hex) but doesn't exist anywhere in the bundle.
	fake := "1111111111111111111111111111111111111111"
	if _, err := Import(context.Background(), gitBinary(t), bundle, fake); err == nil {
		t.Fatalf("expected error for missing commit object, got nil")
	}
}

func TestImport_CorruptBundleRejected(t *testing.T) {
	commitSHA := "1111111111111111111111111111111111111111"
	if _, err := Import(context.Background(), gitBinary(t), []byte("not a real bundle"), commitSHA); err == nil {
		t.Fatalf("expected error for corrupt bundle, got nil")
	}
}

func TestImport_EmptyBundleRejected(t *testing.T) {
	commitSHA := "1111111111111111111111111111111111111111"
	if _, err := Import(context.Background(), gitBinary(t), []byte{}, commitSHA); err == nil {
		t.Fatalf("expected error for empty bundle, got nil")
	}
}

func TestImport_MalformedExpectedCommitSHARejected(t *testing.T) {
	if _, err := Import(context.Background(), gitBinary(t), []byte("x"), "not-a-sha"); err == nil {
		t.Fatalf("expected error for malformed expected commit sha, got nil")
	}
}

// TestBundleRefNameMatchesTestutil cross-checks the literal constant testutil duplicates for its
// own decoupling reasons against this package's real exported constant, so the two can never
// silently drift apart.
func TestBundleRefNameMatchesTestutil(t *testing.T) {
	if BundleRefName != "refs/heads/mihver-broker-import" {
		t.Fatalf("BundleRefName changed to %q -- update internal/testutil/gitfixture.go's bundleRefName to match", BundleRefName)
	}
}
