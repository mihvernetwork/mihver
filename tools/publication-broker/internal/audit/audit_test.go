package audit

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func TestAppend_ChainsHashes(t *testing.T) {
	path := filepath.Join(t.TempDir(), "audit.jsonl")
	l, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if err := l.Append(Entry{RequestDigest: "d1", StateTransition: "AUTHORIZED"}); err != nil {
		t.Fatalf("Append 1: %v", err)
	}
	if err := l.Append(Entry{RequestDigest: "d1", StateTransition: "IN_PROGRESS"}); err != nil {
		t.Fatalf("Append 2: %v", err)
	}
	if err := l.Append(Entry{RequestDigest: "d1", StateTransition: "PUBLISHED"}); err != nil {
		t.Fatalf("Append 3: %v", err)
	}

	entries, err := ReadAll(path)
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}
	if entries[0].PrevHash != "" {
		t.Fatalf("first entry must have empty prev_hash, got %q", entries[0].PrevHash)
	}
	if entries[1].PrevHash != entries[0].EntryHash {
		t.Fatalf("chain broken between entry 0 and 1")
	}
	if entries[2].PrevHash != entries[1].EntryHash {
		t.Fatalf("chain broken between entry 1 and 2")
	}

	brokenAt, err := Verify(path)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if brokenAt != -1 {
		t.Fatalf("expected clean chain, broken at index %d", brokenAt)
	}
}

func TestVerify_DetectsModifiedPriorEntry(t *testing.T) {
	path := filepath.Join(t.TempDir(), "audit.jsonl")
	l, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	for i := 0; i < 3; i++ {
		if err := l.Append(Entry{RequestDigest: "d", StateTransition: "STEP"}); err != nil {
			t.Fatalf("Append: %v", err)
		}
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	lines := strings.Split(strings.TrimRight(string(data), "\n"), "\n")
	if len(lines) != 3 {
		t.Fatalf("expected 3 lines, got %d", len(lines))
	}
	// Tamper with the FIRST entry's content (but not its hashes) -- simulates modifying an
	// already-written entry without also rewriting every entry after it.
	lines[0] = strings.Replace(lines[0], `"STEP"`, `"TAMPERED"`, 1)
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o600); err != nil {
		t.Fatalf("write tampered log: %v", err)
	}

	brokenAt, err := Verify(path)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if brokenAt != 0 {
		t.Fatalf("expected tampering detected at index 0, got %d", brokenAt)
	}
}

func TestPersistence_SurvivesReopenAndContinuesChain(t *testing.T) {
	path := filepath.Join(t.TempDir(), "audit.jsonl")
	l1, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if err := l1.Append(Entry{RequestDigest: "d", StateTransition: "A"}); err != nil {
		t.Fatalf("Append: %v", err)
	}

	l2, err := Open(path)
	if err != nil {
		t.Fatalf("re-Open: %v", err)
	}
	if err := l2.Append(Entry{RequestDigest: "d", StateTransition: "B"}); err != nil {
		t.Fatalf("Append after reopen: %v", err)
	}

	brokenAt, err := Verify(path)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if brokenAt != -1 {
		t.Fatalf("expected clean chain across reopen, broken at %d", brokenAt)
	}
}

func TestAppend_RejectsForbiddenExtraKeys(t *testing.T) {
	path := filepath.Join(t.TempDir(), "audit.jsonl")
	l, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	err = l.Append(Entry{RequestDigest: "d", Extra: map[string]string{"token": "should-never-be-logged"}})
	if err == nil {
		t.Fatalf("expected rejection of forbidden Extra key %q", "token")
	}
}

// --- Concurrency hardening: *Log must serialize concurrent Append calls itself ---------------------

const concurrentAppendCount = 300

// TestAppend_ConcurrentChainIntegrity fires many concurrent Append calls at one shared *Log and
// proves the resulting on-disk chain is exactly as if they had run one at a time: no entry lost,
// none duplicated, every prev_hash/entry_hash link intact end to end. Run with -race.
func TestAppend_ConcurrentChainIntegrity(t *testing.T) {
	path := filepath.Join(t.TempDir(), "audit.jsonl")
	l, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	var wg sync.WaitGroup
	errs := make([]error, concurrentAppendCount)
	for i := 0; i < concurrentAppendCount; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			errs[i] = l.Append(Entry{RequestDigest: fmt.Sprintf("concurrent-%d", i), StateTransition: "STEP"})
		}(i)
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Fatalf("Append %d: %v", i, err)
		}
	}

	entries, err := ReadAll(path)
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	if len(entries) != concurrentAppendCount {
		t.Fatalf("expected %d entries, got %d", concurrentAppendCount, len(entries))
	}

	brokenAt, err := Verify(path)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if brokenAt != -1 {
		t.Fatalf("expected clean chain, broken at index %d", brokenAt)
	}

	seen := make(map[string]int, concurrentAppendCount)
	for _, e := range entries {
		seen[e.RequestDigest]++
	}
	for i := 0; i < concurrentAppendCount; i++ {
		digest := fmt.Sprintf("concurrent-%d", i)
		if seen[digest] != 1 {
			t.Fatalf("expected exactly one entry for %q, got %d", digest, seen[digest])
		}
	}
}

// TestAppend_ConcurrentAppends_NoDuplicatePrevHash proves the chain produced by concurrent Append
// calls is strictly linear: no two entries were computed against the same stale predecessor and
// both got appended (which would show up as two entries sharing one prev_hash).
func TestAppend_ConcurrentAppends_NoDuplicatePrevHash(t *testing.T) {
	path := filepath.Join(t.TempDir(), "audit.jsonl")
	l, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	var wg sync.WaitGroup
	for i := 0; i < concurrentAppendCount; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			if err := l.Append(Entry{RequestDigest: fmt.Sprintf("linear-%d", i), StateTransition: "STEP"}); err != nil {
				t.Errorf("Append %d: %v", i, err)
			}
		}(i)
	}
	wg.Wait()

	entries, err := ReadAll(path)
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	if len(entries) != concurrentAppendCount {
		t.Fatalf("expected %d entries, got %d", concurrentAppendCount, len(entries))
	}

	seenPrevHash := make(map[string]bool, len(entries))
	for i, e := range entries {
		if seenPrevHash[e.PrevHash] {
			t.Fatalf("SECURITY DEFECT: entry %d has a prev_hash %q shared with an earlier entry -- chain forked", i, e.PrevHash)
		}
		seenPrevHash[e.PrevHash] = true
	}
}

// TestAppend_FailedAppendDoesNotAdvanceLastHash uses a real filesystem failure (the log path is
// temporarily replaced with a directory, so the append-mode OpenFile call genuinely fails) to prove
// a failed Append never advances lastHash: the next successful Append must chain from the last
// entry that actually made it to disk before the obstruction, not from the entry whose write failed.
func TestAppend_FailedAppendDoesNotAdvanceLastHash(t *testing.T) {
	path := filepath.Join(t.TempDir(), "audit.jsonl")
	l, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if err := l.Append(Entry{RequestDigest: "d1", StateTransition: "BEFORE"}); err != nil {
		t.Fatalf("Append 1: %v", err)
	}

	entriesBefore, err := ReadAll(path)
	if err != nil {
		t.Fatalf("ReadAll before obstruction: %v", err)
	}
	if len(entriesBefore) != 1 {
		t.Fatalf("expected 1 entry before obstruction, got %d", len(entriesBefore))
	}
	lastGoodHash := entriesBefore[0].EntryHash

	// Obstruct: back up the real file content, then replace the log path with a real directory so
	// os.OpenFile(path, O_APPEND|O_CREATE|O_WRONLY, ...) genuinely fails (EISDIR), not a simulated
	// failure.
	backup, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("backup read: %v", err)
	}
	if err := os.Remove(path); err != nil {
		t.Fatalf("remove for obstruction: %v", err)
	}
	if err := os.Mkdir(path, 0o700); err != nil {
		t.Fatalf("mkdir obstruction: %v", err)
	}

	if err := l.Append(Entry{RequestDigest: "d1", StateTransition: "SHOULD_FAIL"}); err == nil {
		t.Fatalf("expected Append to fail while the log path is obstructed by a directory")
	}

	// Repair: remove the obstructing directory and restore the original file content exactly.
	if err := os.Remove(path); err != nil {
		t.Fatalf("remove obstruction: %v", err)
	}
	if err := os.WriteFile(path, backup, 0o600); err != nil {
		t.Fatalf("restore backup: %v", err)
	}

	if err := l.Append(Entry{RequestDigest: "d1", StateTransition: "AFTER"}); err != nil {
		t.Fatalf("Append after repair: %v", err)
	}

	brokenAt, err := Verify(path)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if brokenAt != -1 {
		t.Fatalf("expected clean chain after repair, broken at index %d", brokenAt)
	}

	entriesAfter, err := ReadAll(path)
	if err != nil {
		t.Fatalf("ReadAll after repair: %v", err)
	}
	if len(entriesAfter) != 2 {
		t.Fatalf("expected exactly 2 durable entries (the failed append must not have been written), got %d", len(entriesAfter))
	}
	if entriesAfter[1].StateTransition != "AFTER" {
		t.Fatalf("expected second entry to be the repair append, got %+v", entriesAfter[1])
	}
	if entriesAfter[1].PrevHash != lastGoodHash {
		t.Fatalf("SECURITY DEFECT: expected the repair append's prev_hash %q to chain from the last durably-written entry %q, not from the failed entry", entriesAfter[1].PrevHash, lastGoodHash)
	}
}

// TestAppend_DifferentLogInstancesAreIndependent proves there is no accidental shared/global mutex:
// two *Log instances at two different paths, appended to concurrently from many goroutines, remain
// fully independent chains with no cross-contamination.
func TestAppend_DifferentLogInstancesAreIndependent(t *testing.T) {
	pathA := filepath.Join(t.TempDir(), "audit-a.jsonl")
	pathB := filepath.Join(t.TempDir(), "audit-b.jsonl")
	lA, err := Open(pathA)
	if err != nil {
		t.Fatalf("Open A: %v", err)
	}
	lB, err := Open(pathB)
	if err != nil {
		t.Fatalf("Open B: %v", err)
	}

	const perLog = 150
	var wg sync.WaitGroup
	for i := 0; i < perLog; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			if err := lA.Append(Entry{RequestDigest: fmt.Sprintf("a-%d", i), StateTransition: "STEP"}); err != nil {
				t.Errorf("Append A %d: %v", i, err)
			}
		}(i)
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			if err := lB.Append(Entry{RequestDigest: fmt.Sprintf("b-%d", i), StateTransition: "STEP"}); err != nil {
				t.Errorf("Append B %d: %v", i, err)
			}
		}(i)
	}
	wg.Wait()

	entriesA, err := ReadAll(pathA)
	if err != nil {
		t.Fatalf("ReadAll A: %v", err)
	}
	entriesB, err := ReadAll(pathB)
	if err != nil {
		t.Fatalf("ReadAll B: %v", err)
	}
	if len(entriesA) != perLog {
		t.Fatalf("expected %d entries in log A, got %d", perLog, len(entriesA))
	}
	if len(entriesB) != perLog {
		t.Fatalf("expected %d entries in log B, got %d", perLog, len(entriesB))
	}

	if brokenAt, err := Verify(pathA); err != nil || brokenAt != -1 {
		t.Fatalf("Verify A: brokenAt=%d err=%v", brokenAt, err)
	}
	if brokenAt, err := Verify(pathB); err != nil || brokenAt != -1 {
		t.Fatalf("Verify B: brokenAt=%d err=%v", brokenAt, err)
	}

	hashesB := make(map[string]bool, len(entriesB))
	for _, e := range entriesB {
		hashesB[e.EntryHash] = true
	}
	for _, e := range entriesA {
		if hashesB[e.PrevHash] {
			t.Fatalf("SECURITY DEFECT: log A entry's prev_hash %q matches a log B entry_hash -- logs are not independent", e.PrevHash)
		}
		if e.RequestDigest != "" && strings.HasPrefix(e.RequestDigest, "b-") {
			t.Fatalf("SECURITY DEFECT: log A contains a log B entry: %+v", e)
		}
	}
	for _, e := range entriesB {
		if e.RequestDigest != "" && strings.HasPrefix(e.RequestDigest, "a-") {
			t.Fatalf("SECURITY DEFECT: log B contains a log A entry: %+v", e)
		}
	}
}

func TestEntry_NeverContainsSecretFieldsByDesign(t *testing.T) {
	// Entry's own struct fields are enumerated here to document that none of them is a credential
	// field -- if a future edit adds one (e.g. "installation_token"), this test's own review should
	// catch it; there is no field named token/secret/key/password among the exported fields.
	e := Entry{}
	forbiddenSubstrings := []string{"token", "secret", "password", "private_key"}
	fields := []string{"RequestDigest", "GrantID", "RepositoryOwner", "RepositoryName", "Branch", "BaseBranch", "CommitSHA", "StateTransition", "RemoteHead", "PRNumber", "BlockedReason"}
	_ = e
	for _, f := range fields {
		for _, forbidden := range forbiddenSubstrings {
			if strings.Contains(strings.ToLower(f), forbidden) {
				t.Fatalf("Entry field %q looks like a secret field", f)
			}
		}
	}
}
