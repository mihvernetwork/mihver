// Package audit implements the Broker's own operational audit log (V3.1-B Section 17): a
// broker-owned, append-only, hash-chained JSONL log of state transitions. This is
// tamper-EVIDENT, not tamper-proof: a fully compromised Broker process could append a
// consistent-looking fabricated chain from scratch, and this package makes no claim otherwise. What
// it does guarantee is that any modification of an entry ALREADY WRITTEN, without also rewriting
// every entry after it, is mechanically detectable by Verify.
package audit

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

// Entry is one audit record. No secret values are ever recorded here -- callers must never pass a
// token, private key, or other credential material into Fields.
type Entry struct {
	Timestamp       time.Time         `json:"timestamp"`
	RequestDigest   string            `json:"request_digest,omitempty"`
	GrantID         string            `json:"grant_id,omitempty"`
	RepositoryOwner string            `json:"repository_owner,omitempty"`
	RepositoryName  string            `json:"repository_name,omitempty"`
	Branch          string            `json:"branch,omitempty"`
	BaseBranch      string            `json:"base_branch,omitempty"`
	CommitSHA       string            `json:"commit_sha,omitempty"`
	StateTransition string            `json:"state_transition,omitempty"`
	RemoteHead      string            `json:"remote_head,omitempty"`
	PRNumber        int               `json:"pr_number,omitempty"`
	BlockedReason   string            `json:"blocked_reason,omitempty"`
	Extra           map[string]string `json:"extra,omitempty"`

	PrevHash  string `json:"prev_hash"`
	EntryHash string `json:"entry_hash"`
}

// forbiddenExtraKeys are Extra keys that would defeat the "no secret values" invariant if ever
// populated by a careless caller -- Append rejects them outright rather than trusting every call
// site to remember not to pass a token through the generic Extra map.
var forbiddenExtraKeys = map[string]bool{
	"token": true, "access_token": true, "installation_token": true,
	"private_key": true, "jwt": true, "secret": true, "password": true,
}

// Log is a broker-owned, append-only hash-chained audit log backed by one JSONL file. Not safe for
// concurrent writers from multiple processes; within one process, *Log itself serializes every
// Append call with an internal mutex, so the Broker server can safely share one in-process Log
// instance across concurrently served connections.
type Log struct {
	mu       sync.Mutex
	path     string
	lastHash string
}

// Open opens (creating if necessary) the audit log at path and recovers the last entry's hash so
// the chain continues correctly across a process restart.
func Open(path string) (*Log, error) {
	l := &Log{path: path}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDONLY, 0o600)
	if err != nil {
		return nil, fmt.Errorf("audit: open: %w", err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)
	var last Entry
	found := false
	for scanner.Scan() {
		var e Entry
		if err := json.Unmarshal(scanner.Bytes(), &e); err != nil {
			return nil, fmt.Errorf("audit: corrupt log entry: %w", err)
		}
		last = e
		found = true
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("audit: read log: %w", err)
	}
	if found {
		l.lastHash = last.EntryHash
	}
	return l, nil
}

func canonicalEntryBytes(e Entry) ([]byte, error) {
	// entry_hash is never part of what gets hashed into itself -- only prev_hash plus every other
	// field. Marshal a copy with EntryHash cleared to make this explicit rather than relying on
	// field ordering.
	clean := e
	clean.EntryHash = ""
	return json.Marshal(clean)
}

// Append writes one new entry, chaining it to the previous entry's hash. Rejects any Extra key that
// looks like a secret field name (defense in depth against accidental credential logging), and
// rejects any Extra *value* containing what looks like a GitHub App JWT or installation token
// shape is deliberately NOT attempted -- V3.1-B treats tokens as opaque, so pattern-matching a
// "token shape" would be both unreliable and a false sense of security; the real control is: no
// call site in this codebase ever has a token in scope when it calls Append (see internal/server).
func (l *Log) Append(e Entry) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	for k := range e.Extra {
		if forbiddenExtraKeys[k] {
			return fmt.Errorf("audit: refusing to log forbidden field %q", k)
		}
	}
	if e.Timestamp.IsZero() {
		e.Timestamp = time.Now().UTC()
	}
	e.PrevHash = l.lastHash

	toHash, err := canonicalEntryBytes(e)
	if err != nil {
		return fmt.Errorf("audit: marshal entry: %w", err)
	}
	sum := sha256.Sum256(append([]byte(e.PrevHash), toHash...))
	e.EntryHash = hex.EncodeToString(sum[:])

	line, err := json.Marshal(e)
	if err != nil {
		return fmt.Errorf("audit: marshal final entry: %w", err)
	}
	line = append(line, '\n')

	f, err := os.OpenFile(l.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return fmt.Errorf("audit: open for append: %w", err)
	}
	defer f.Close()
	if _, err := f.Write(line); err != nil {
		return fmt.Errorf("audit: append: %w", err)
	}
	l.lastHash = e.EntryHash
	return nil
}

// Verify re-reads the entire log from path and confirms the hash chain is unbroken: each entry's
// prev_hash equals the previous entry's entry_hash, and each entry's own entry_hash matches a fresh
// recomputation over its own (entry_hash-cleared) content. Returns the index (0-based) of the first
// broken entry, or -1 if the whole chain verifies.
func Verify(path string) (brokenAt int, err error) {
	f, err := os.Open(path)
	if err != nil {
		return -1, fmt.Errorf("audit: open for verify: %w", err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)
	prevHash := ""
	idx := 0
	for scanner.Scan() {
		var e Entry
		if err := json.Unmarshal(scanner.Bytes(), &e); err != nil {
			return idx, fmt.Errorf("audit: corrupt entry at index %d: %w", idx, err)
		}
		if e.PrevHash != prevHash {
			return idx, nil
		}
		toHash, err := canonicalEntryBytes(e)
		if err != nil {
			return idx, err
		}
		sum := sha256.Sum256(append([]byte(e.PrevHash), toHash...))
		if hex.EncodeToString(sum[:]) != e.EntryHash {
			return idx, nil
		}
		prevHash = e.EntryHash
		idx++
	}
	if err := scanner.Err(); err != nil {
		return idx, err
	}
	return -1, nil
}

// ReadAll returns every entry in the log, in append order -- for admin inspection only.
func ReadAll(path string) ([]Entry, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)
	var entries []Entry
	for scanner.Scan() {
		var e Entry
		if err := json.Unmarshal(scanner.Bytes(), &e); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, scanner.Err()
}
