// Package grant implements the server-side PublicationGrant store (V3.1-B Section 7): the
// independent, broker-owned evidence that a human actually authorized one exact publication
// request. A Claude-authored PublicationEnvelope is never sufficient evidence of human authorization
// by itself -- only a Grant, created through the privileged admin path and bound to an exact
// REQUEST DIGEST, is.
//
// The Store's method set is split at compile time into an AdminHandle (create/revoke -- reachable
// only from the privileged admin socket) and a ClientHandle (begin/resume/mark-published/mark-blocked
// -- reachable from the unprivileged client socket). This makes "an unprivileged client cannot
// create, modify, extend, or revoke a grant" a property of the Go type system, not merely a runtime
// check the server package has to remember to enforce: internal/server's client-request handler is
// given only a *ClientHandle, and it has no way to obtain an *AdminHandle from it.
package grant

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"time"
)

// State is a Grant's lifecycle state -- see V3.1-B Section 13's idempotency model.
type State string

const (
	StateAuthorized State = "AUTHORIZED"
	StateInProgress State = "IN_PROGRESS"
	StatePublished  State = "PUBLISHED"
	StateBlocked    State = "BLOCKED"
	StateRevoked    State = "REVOKED"
	StateExpired    State = "EXPIRED"
)

// Grant is broker-owned state Claude cannot mint by editing repository files -- it exists only in
// this store, created only through AdminHandle.Create.
type Grant struct {
	GrantID            string    `json:"grant_id"`
	RequestDigest      string    `json:"request_digest"` // hex sha256, from protocol.Request.RequestDigest()
	RepositoryOwner    string    `json:"repository_owner"`
	RepositoryName     string    `json:"repository_name"`
	Branch             string    `json:"branch"`
	BaseBranch         string    `json:"base_branch"`
	BaseCommit         string    `json:"base_commit"`
	ExpiresAt          time.Time `json:"expires_at"`
	State              State     `json:"state"`
	AuthorizedAt       time.Time `json:"authorized_at"`
	StateChangedAt     time.Time `json:"state_changed_at"`
	BlockedReason      string    `json:"blocked_reason,omitempty"`
	RemoteHeadObserved string    `json:"remote_head_observed,omitempty"` // set once push succeeds, for idempotent retry
	PRNumber           int       `json:"pr_number,omitempty"`
}

var (
	ErrNotFound      = errors.New("grant: no grant for this request_digest")
	ErrRevoked       = errors.New("grant: revoked")
	ErrExpired       = errors.New("grant: expired")
	ErrBlocked       = errors.New("grant: previously blocked, requires fresh admin authorization")
	ErrAlreadyExists = errors.New("grant: a grant for this request_digest already exists")
	ErrWrongState    = errors.New("grant: not in a state that permits this transition")

	// The three sentinels below (V3.1-B Hardening R2.1) are what AdminHandle.Revoke returns --
	// wrapped with grant-ID-specific context via fmt.Errorf's %w, never as a bare freestanding value
	// -- for each of the three terminal states it refuses to overwrite. Callers (in particular
	// internal/server's admin listener, mapping these to stable wire codes for a human operator) must
	// compare against these with errors.Is, never by matching substrings of Error(), since the
	// human-readable message text is not a contract and may change.
	ErrCannotRevokePublished = errors.New("grant: cannot revoke a published grant")
	ErrCannotRevokeBlocked   = errors.New("grant: cannot revoke a blocked grant")
	ErrCannotRevokeExpired   = errors.New("grant: cannot revoke an expired grant")

	// The sentinels below (V3.1-B Hardening R3) extend the same persistence-truthful pattern R2.1
	// established for Revoke to every other Grant state mutation. errors.Is is required to check
	// against them -- each is always wrapped with call-specific context via %w, never returned bare.
	//
	// ErrBeginPersistFailed and ErrExpirePersistFailed are returned by BeginOrResume when a
	// pre-effect (no remote effect has happened yet) transition's own persistLocked() call fails; the
	// in-memory state is ROLLED BACK to its pre-transition value in both cases (never left as an
	// unpersisted, phase-admissible IN_PROGRESS, and never left as an unpersisted EXPIRED when the
	// grant is actually still fully valid until a later, successfully-persisted retry) -- a later
	// BeginOrResume call simply re-attempts the same transition cleanly.
	ErrBeginPersistFailed  = errors.New("grant: failed to persist the IN_PROGRESS transition")
	ErrExpirePersistFailed = errors.New("grant: failed to persist the EXPIRED transition")

	// ErrPublishedOutcomeMismatch and ErrBlockedReasonMismatch are returned by MarkPublished and
	// MarkBlocked (respectively) when a retry reports a DIFFERENT outcome/reason than the one already
	// recorded in memory -- the original must never be silently overwritten by a different one, terminal
	// or not yet durably persisted.
	ErrPublishedOutcomeMismatch = errors.New("grant: MarkPublished retry outcome disagrees with the already-recorded outcome")
	ErrBlockedReasonMismatch    = errors.New("grant: MarkBlocked retry reason disagrees with the already-recorded reason")

	// ErrPublishPersistFailed and ErrBlockPersistFailed (V3.1-B Hardening R3.1) are what BeginOrResume,
	// AdmitPublicationPhase, MarkPublished, and MarkBlocked return specifically when a PUBLISHED or
	// BLOCKED terminal fact is still PENDING -- fail-closed in memory, but not yet confirmed included
	// in any successful persistLocked() call. Distinct from the plain terminal-state sentinels
	// (ErrBlocked, etc.), which mean "this terminal fact IS durably acknowledged" -- see the Store
	// pending set's own doc comment for the exact clean/pending distinction this closes.
	ErrPublishPersistFailed = errors.New("grant: PUBLISHED is still pending -- not yet confirmed durably persisted")
	ErrBlockPersistFailed   = errors.New("grant: BLOCKED is still pending -- not yet confirmed durably persisted")

	// ErrCannotBlockPublished (V3.1-B Hardening R3.2) is what a block transition attempt returns when
	// the Grant has already reached PUBLISHED -- a real remote effect already happened, so BLOCKED can
	// never become true regardless of persistence status. Mirrors AdminHandle.Revoke's own
	// ErrCannotRevokePublished pattern exactly: while PUBLISHED is still pending, the still-failing
	// Store acknowledgement is surfaced as ErrPublishPersistFailed instead of this sentinel (never
	// silently converging on "durably acknowledged"); only once PUBLISHED is durably acknowledged
	// (clean, or repaired) is this terminal-refusal sentinel returned.
	ErrCannotBlockPublished = errors.New("grant: cannot block a published grant")

	// ErrInvalidPhaseLease (V3.1-B Hardening R3.2) is returned by ClientHandle.MarkBlockedInPhase when
	// the supplied *PhaseGate is nil, belongs to a different Store, belongs to a different Grant, or
	// has already been released -- a lease binding failure is always a programming error inside this
	// module (never something request data or an external caller can trigger), but it is reported as a
	// stable, errors.Is-checkable sentinel rather than a panic so a caller can fail closed.
	ErrInvalidPhaseLease = errors.New("grant: invalid, foreign, cross-Store, or released phase lease")
)

// CreateRequest is exactly what the human-operated admin path supplies to authorize one exact
// request -- see V3.1-B Section 7's minimum grant fields.
type CreateRequest struct {
	RequestDigest   string
	RepositoryOwner string
	RepositoryName  string
	Branch          string
	BaseBranch      string
	BaseCommit      string
	TTL             time.Duration
}

// Store is the broker-owned, file-backed grant state. All *data* access is serialized through mu.
// Every mutation attempts to persist via persistLocked -- write a temp file, then os.Rename it over
// the real path -- before the call returns; this persistence write is the one I/O operation mu is
// ever held across, and it is bounded, broker-owned-file-local disk I/O, never Git, HTTP, token-mint,
// or filesystem-import activity involving untrusted content or a remote party.
//
// PRECISE DURABILITY CONTRACT (V3.1-B Hardening R2.1 -- do not overstate this): temp-file-plus-rename
// means a completed persistLocked() call leaves the store file's *content* atomic -- a reader never
// observes a half-written file -- and ordinary process-restart-without-crash never loses a completed
// write. It is NOT fsync-durable: neither the temp file nor its containing directory entry is
// explicitly fsync'd, so a hard crash or power loss between the rename and the OS actually flushing
// that directory entry to disk can still lose an already-"successful" write. That deeper durability
// gap remains an explicit V3.1-C concern (see PUBLICATION_BROKER.md's Human Provisioning Checklist),
// not one this round closes. What THIS round (R2.1) does guarantee, precisely: AdminHandle.Revoke
// never reports success to its caller while persistLocked() is failing (see Revoke's own doc comment)
// -- a persistence failure the Store can actually detect (a full disk, a permission error, an
// unwritable path) is never silently swallowed into a false-positive REVOKED result, and the
// in-memory state fails closed (REVOKED) even when the write that should record it durably has not
// yet succeeded, so no OTHER call in this same process can be misled by an unpersisted revoke.
//
// gates is a SEPARATE, independent per-Grant exclusive lock map (V3.1-B Hardening R2) -- acquiring or
// holding a specific grant's gate never requires holding mu. See PhaseGate's own doc comment for the
// exact lock order this package guarantees.
type Store struct {
	mu       sync.Mutex
	path     string
	byDigest map[string]*Grant
	clock    func() time.Time

	gatesMu sync.Mutex
	gates   map[string]*gateEntry // keyed by Grant.GrantID

	// pending is the runtime-only, NEVER-serialized terminal-persistence-acknowledgement set
	// (V3.1-B Hardening R3.1): it is what actually distinguishes "this Grant's exact PUBLISHED or
	// BLOCKED content exists only because I set it in memory, and I have not yet confirmed a
	// persistLocked() call that included it actually succeeded" from "this Grant's exact PUBLISHED or
	// BLOCKED content has been durably acknowledged." R3's earlier `_ = persistLocked()` "opportunistic
	// repair" calls could not make this distinction at all -- they always discarded the retry's own
	// result and reported the terminal fact as though it were settled, which is exactly the
	// false-success gap R3.1 closes. Keyed by GrantID, present entries mean pending; presence and
	// absence are checked/mutated only under mu (isPendingLocked/markPendingLocked/
	// persistLockedAcknowledging). Because persistLockedAcknowledging always serializes the FULL,
	// CURRENT byDigest map, a single successful call clears every pending entry at once -- it
	// necessarily included each still-pending Grant's exact (unchanged, since the mismatch-rejection on
	// a differing retry guarantees a pending Grant's content never silently changes) current content,
	// satisfying "a successful full-store persistence acknowledges every pending state actually
	// included in that exact successful snapshot" even when the write that triggered it was for a
	// completely different Grant.
	pending map[string]struct{}
}

// Open loads (or initializes) a grant store backed by a single JSON file at path. The containing
// directory must already exist and be broker-owned; this function does not create it, matching
// V3.1-B's "never trust/derive privileged paths implicitly" posture. A fresh, unlocked per-Grant
// phase gate is registered for every grant loaded from disk, so no grant is ever without one.
func Open(path string) (*Store, error) {
	s := &Store{path: path, byDigest: map[string]*Grant{}, clock: time.Now, gates: map[string]*gateEntry{}, pending: map[string]struct{}{}}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return nil, fmt.Errorf("grant: open store: %w", err)
	}
	var grants []*Grant
	if err := json.Unmarshal(data, &grants); err != nil {
		return nil, fmt.Errorf("grant: corrupt store file: %w", err)
	}
	for _, g := range grants {
		s.byDigest[g.RequestDigest] = g
		s.gates[g.GrantID] = &gateEntry{}
	}
	return s, nil
}

func (s *Store) persistLocked() error {
	grants := make([]*Grant, 0, len(s.byDigest))
	for _, g := range s.byDigest {
		grants = append(grants, g)
	}
	data, err := json.MarshalIndent(grants, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

// markPendingLocked records that grantID's current terminal (PUBLISHED/BLOCKED) content has not yet
// been confirmed included in a successful persistLocked() call. Must be called while mu is held.
func (s *Store) markPendingLocked(grantID string) {
	s.pending[grantID] = struct{}{}
}

// isPendingLocked reports whether grantID's current terminal content is still unacknowledged. Must be
// called while mu is held.
func (s *Store) isPendingLocked(grantID string) bool {
	_, ok := s.pending[grantID]
	return ok
}

// persistLockedAcknowledging calls persistLocked() and, ONLY on success, clears every entry in
// pending -- see the Store.pending field's own doc comment for why a single successful full-store
// write correctly acknowledges every currently-pending Grant, not merely the one this particular call
// happens to be mutating. Every production persistLocked() call site in this package uses this
// wrapper, never the raw persistLocked() directly, so an unrelated Grant's successful mutation always
// has the chance to opportunistically acknowledge other Grants' pending terminal facts too. Must be
// called while mu is held.
func (s *Store) persistLockedAcknowledging() error {
	if err := s.persistLocked(); err != nil {
		return err
	}
	for id := range s.pending {
		delete(s.pending, id)
	}
	return nil
}

func newGrantID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

// PhaseGate is the exclusive per-Grant lock this package uses to linearize a Grant's revocation
// against its own remote-effect (publication) phases (V3.1-B Hardening R2). Whoever holds a given
// Grant's gate -- either AdminHandle.Revoke or a ClientHandle.AdmitPublicationPhase caller -- is
// guaranteed no other holder of that SAME Grant's gate can be concurrently checking or mutating its
// state or performing a write-capable operation on its behalf. Different Grants' gates are
// completely independent -- one Grant's gate never blocks another's.
//
// PhaseGate is deliberately a thin handle around a separate, heap-allocated *phaseGateState rather
// than embedding its mutex/sync.Once directly (V3.1-B Hardening R2.1): a bare `PhaseGate{mu, once
// sync.Once}` value is unsafe to copy, because copying it by value (`copied := *gate`) also copies
// sync.Once BY VALUE, producing a second, independent Once guarding the SAME underlying *sync.Mutex
// -- calling Release() on both the original and the copy would then physically unlock that mutex
// twice, the second unlock panicking with "sync: unlock of unlocked mutex" (or worse, silently
// unlocking a totally unrelated later acquisition of the same grant's gate, if a new acquirer had
// already locked it again in between). Indirecting through *phaseGateState makes every PhaseGate
// value naming the same acquisition -- however many times it's copied, passed by value, or aliased
// -- share the exact same Once, so Release() is safe to call any number of times, from any number of
// copies, concurrently or sequentially, and always unlocks the underlying mutex exactly once. A
// PhaseGate obtained from a LATER acquisition of the same Grant's gate (after an earlier holder
// released it) gets a brand-new *phaseGateState with its own fresh Once -- so a stale alias left over
// from an earlier acquisition can never unlock a later, unrelated acquisition, even though both
// acquisitions share the same underlying *sync.Mutex (see acquirePhaseGate).
type PhaseGate struct {
	state *phaseGateState
}

// phaseGateState is the actual release-once state for exactly one acquisition of one Grant's phase
// gate. Never exported, never constructed anywhere but acquirePhaseGate.
//
// operationMu/released (V3.1-B Hardening R3.2) make "Release() versus a gate-bound mutation on this
// same lease" linearizable rather than racy: Release()'s once.Do body acquires operationMu, sets
// released, releases operationMu, and ONLY THEN unlocks the underlying mu -- so whichever of a
// concurrent Release() call and a concurrent gate-bound mutation (see MarkBlockedInPhase) actually
// acquires operationMu first is the one that wins: the mutation either completes entirely before the
// physical gate mutex is ever unlocked (if it wins), or observes released==true and performs no
// mutation at all (if it loses). store/grantID bind this lease to the exact acquisition it came from,
// mechanically (not by caller assertion), so a lease can never be used to mutate a different Grant or
// a different Store's Grant.
type phaseGateState struct {
	mu   *sync.Mutex
	once sync.Once

	operationMu sync.Mutex
	released    bool

	store   *Store
	grantID string
}

// Release unlocks this Grant's phase gate. Safe to call multiple times, from multiple copies of the
// same PhaseGate value, and concurrently from multiple goroutines (sync.Once.Do itself is safe for
// concurrent callers) -- see the PhaseGate doc comment for why copying is safe at all.
func (g *PhaseGate) Release() {
	if g == nil || g.state == nil {
		return
	}
	g.state.once.Do(func() {
		g.state.operationMu.Lock()
		g.state.released = true
		g.state.operationMu.Unlock()
		g.state.mu.Unlock()
	})
}

// leaseFor mechanically validates that g is a live (not yet released), still-active phase lease for
// exactly this store/grantID combination -- never a caller-supplied assertion. Does NOT itself acquire
// operationMu (callers that go on to mutate under the lease must acquire it themselves, atomically
// with their own released check, to avoid a TOCTOU gap against a concurrent Release()) -- this is only
// the identity/nilness check.
func (g *PhaseGate) leaseFor(store *Store, grantID string) error {
	if g == nil || g.state == nil {
		return fmt.Errorf("grant: phase lease is nil: %w", ErrInvalidPhaseLease)
	}
	if g.state.store != store {
		return fmt.Errorf("grant: phase lease belongs to a different Store: %w", ErrInvalidPhaseLease)
	}
	if g.state.grantID != grantID {
		return fmt.Errorf("grant: phase lease belongs to a different Grant (expected %s): %w", grantID, ErrInvalidPhaseLease)
	}
	return nil
}

// gateFor returns the exclusive mutex for grantID, creating and registering one if this exact
// GrantID has never been seen before (defensive fallback -- Open and AdminHandle.Create both
// proactively register a gate for every Grant they know about, so this path is not the normal one,
// but it guarantees a gate always exists rather than risking a nil dereference). gatesMu is held
// only for the brief map lookup/insert itself, never while any specific grant's gate is held or
// being waited on.
// gateEntry is the persistent per-Grant phase gate: the exclusive *sync.Mutex itself, plus a
// test-only observability counter (V3.1-B Closeout Pack A.1) incremented immediately BEFORE Lock() is
// called and decremented immediately after it returns. waiting is never read by any production code
// path. A single observation of waiting > 0 proves a goroutine has reached that atomic increment --
// immediately adjacent to, but not perfectly synchronized with, the moment it actually begins
// blocking inside Lock() itself (Go's sync.Mutex exposes no finer-grained observation point than
// this). internal/grant's own tests therefore do not rely on one snapshot: they sample repeatedly,
// across many real scheduler yields, after first observing waiting > 0 -- see
// waitUntilWaitingThenSustain in block_linearization_test.go for the full argument for why that
// sustained sampling (not a single check) is what makes the resulting evidence meaningfully stronger
// than a single check, without any sleep/fixed-timeout dependency -- it remains stress evidence, not a
// mathematical proof that a goroutine has registered inside Go's internal mutex wait queue (no API
// exposes that directly; see Closeout Pack A.2, Work Package E).
type gateEntry struct {
	mu      sync.Mutex
	waiting int32 // atomic
}

func (s *Store) gateFor(grantID string) *gateEntry {
	s.gatesMu.Lock()
	defer s.gatesMu.Unlock()
	g, ok := s.gates[grantID]
	if !ok {
		g = &gateEntry{}
		s.gates[grantID] = g
	}
	return g
}

// waitingForTest reports how many goroutines are currently blocked acquiring grantID's phase gate.
// Test-only observability seam (V3.1-B Closeout Pack A.1) -- never called from any production code
// path; internal/grant's own tests use it as sustained stress evidence of genuine lock contention (see
// waitUntilWaitingThenSustain in block_linearization_test.go for exactly what this does and does not
// prove). Returns 0 for a grantID whose gate has never been acquired.
func (s *Store) waitingForTest(grantID string) int32 {
	s.gatesMu.Lock()
	g, ok := s.gates[grantID]
	s.gatesMu.Unlock()
	if !ok {
		return 0
	}
	return atomic.LoadInt32(&g.waiting)
}

// acquirePhaseGate blocks until grantID's exclusive phase gate is available, then returns it held.
// This is the ONLY lock-order entry point this package uses for anything beyond a bare data read:
// the phase gate is always acquired FIRST, and only then (if at all) is Store.mu acquired, held
// briefly for an in-memory state check/mutation, and released -- Store.mu is never acquired first
// with a subsequent wait on a phase gate, which is what would risk a lock-order deadlock between
// AdminHandle.Revoke and ClientHandle.AdmitPublicationPhase.
func (s *Store) acquirePhaseGate(grantID string) *PhaseGate {
	g := s.gateFor(grantID)
	atomic.AddInt32(&g.waiting, 1)
	g.mu.Lock()
	atomic.AddInt32(&g.waiting, -1)
	return &PhaseGate{state: &phaseGateState{mu: &g.mu, store: s, grantID: grantID}}
}

// AdminHandle exposes only the mutations the privileged admin socket may perform: creating a grant
// (the human's own authorization act) and revoking one. Obtainable only via Store.Admin.
type AdminHandle struct{ s *Store }

// Admin returns the admin-only facade over this store. internal/server must call this exactly once,
// from the code path serving the admin Unix socket only -- never from the client-socket handler.
func (s *Store) Admin() *AdminHandle { return &AdminHandle{s: s} }

// Create records a brand-new human authorization for one exact request_digest. Fails if a grant for
// that digest already exists -- a request_digest is bound to at most one grant, ever; re-authorizing
// requires a fresh, distinct request (and therefore a distinct digest, since any byte change
// invalidates it).
func (h *AdminHandle) Create(req CreateRequest) (*Grant, error) {
	h.s.mu.Lock()
	defer h.s.mu.Unlock()
	if _, exists := h.s.byDigest[req.RequestDigest]; exists {
		return nil, ErrAlreadyExists
	}
	now := h.s.clock()
	g := &Grant{
		GrantID:         newGrantID(),
		RequestDigest:   req.RequestDigest,
		RepositoryOwner: req.RepositoryOwner,
		RepositoryName:  req.RepositoryName,
		Branch:          req.Branch,
		BaseBranch:      req.BaseBranch,
		BaseCommit:      req.BaseCommit,
		ExpiresAt:       now.Add(req.TTL),
		State:           StateAuthorized,
		AuthorizedAt:    now,
		StateChangedAt:  now,
	}
	h.s.byDigest[g.RequestDigest] = g
	h.s.gatesMu.Lock()
	h.s.gates[g.GrantID] = &gateEntry{}
	h.s.gatesMu.Unlock()
	if err := h.s.persistLockedAcknowledging(); err != nil {
		// Rollback (V3.1-B Hardening R3): no remote effect and no admin-visible success has happened
		// yet -- undo both map insertions so a failed Create leaves NOTHING behind: no Grant
		// resolvable by digest, no live GrantID, no reusable phase gate. A later admin retry of the
		// identical (or any other) CreateRequest can proceed normally, exactly as if this call had
		// never been attempted.
		delete(h.s.byDigest, g.RequestDigest)
		h.s.gatesMu.Lock()
		delete(h.s.gates, g.GrantID)
		h.s.gatesMu.Unlock()
		return nil, err
	}
	cp := *g
	return &cp, nil
}

// Revoke acquires grantID's exclusive phase gate FIRST (per this package's documented lock order --
// see PhaseGate), which is what actually closes the live-revocation race V3.1-B Hardening R2 exists
// for: if a ClientHandle.AdmitPublicationPhase caller currently holds the gate (an admitted
// publication phase is in flight), Revoke blocks here until that phase releases it -- Revoke can
// never observe, let alone act on, a Grant while a remote-effect phase is actively using it. The gate
// is released only via the deferred Release() below, which -- because Go defers run in the reverse
// order they were registered -- fires strictly after the h.s.mu-guarded block below (including its
// persistLocked() call) has fully completed, so a persistence attempt is always finished, one way or
// the other, before any other caller can newly acquire this Grant's gate.
//
// Once the gate is acquired, Revoke applies the exact required transition table: AUTHORIZED and
// IN_PROGRESS move to REVOKED; PUBLISHED, BLOCKED, and EXPIRED are terminal and are never silently
// overwritten -- each returns one of the stable ErrCannotRevoke* sentinels instead (wrapped with
// grant-ID context via %w -- compare with errors.Is, never by matching Error() text). This is what
// makes "PUBLISHED -> unchanged", "BLOCKED -> unchanged", and "EXPIRED -> unchanged" actual
// guarantees rather than merely documented intent: once Revoke's gate acquisition returns, no
// concurrent AdmitPublicationPhase call can be mid-flight for this same Grant, so the state Revoke
// reads under h.s.mu immediately afterward is authoritative, not stale.
//
// PERSISTENCE-TRUTHFUL SUCCESS (V3.1-B Hardening R2.1): Revoke must never report success to its
// caller while the Store's own persistence contract has not actually written REVOKED durably (see
// Store's doc comment for exactly what "durably" does and does not mean here). The REVOKED case below
// is therefore NOT a bare no-op return -- every call, including a retry of an already-in-memory-
// REVOKED grant, attempts persistLocked() again and propagates its result. This is deliberate, not
// wasted work: if an earlier call transitioned the in-memory state to REVOKED but its own
// persistLocked() call failed (a full disk, a permission error, a transient I/O failure), that
// earlier call correctly returned a non-nil error -- but a NAIVE idempotent short-circuit
// ("state is already REVOKED, so return nil") on the next call would then silently report success
// without the durable write ever actually having happened, which is exactly the false-success defect
// this round exists to close. Re-attempting persistLocked() on every REVOKED-state call means: (a) a
// retry after the transient failure clears actually persists and correctly returns nil only once that
// persist succeeds; (b) if the failure is still ongoing, every retry keeps correctly returning a
// non-nil error, never nil; (c) a revoke of an already-durably-REVOKED grant harmlessly rewrites the
// same content back to the store file -- an accepted, explicitly authorized small cost, favoring
// correctness over avoiding a redundant local write. In-memory state remains REVOKED (fail-closed)
// even while persistence is failing, so AdmitPublicationPhase -- which only ever reads the in-memory
// state, never persistLocked()'s own return value -- correctly denies phase admission with ErrRevoked
// in this process regardless of whether the durable write has landed yet.
//
// PENDING-AWARE TERMINAL REFUSAL (V3.1-B Hardening R3.1.1): the PUBLISHED and BLOCKED cases below
// apply this exact same principle to their own refusal. Revocation is denied either way -- a pending
// PUBLISHED/BLOCKED fact is still fail-closed, never rolled back to something revocable -- but while
// it remains pending, Revoke attempts the identical bounded local repair (no remote I/O, still under
// the phase gate and h.s.mu) and reports ErrPublishPersistFailed/ErrBlockPersistFailed instead of
// ErrCannotRevokePublished/ErrCannotRevokeBlocked whenever that repair itself fails -- concealing a
// still-failing Store acknowledgement behind the (also-true) terminal-refusal sentinel would hide
// exactly the kind of fact this round of hardening exists to surface.
func (h *AdminHandle) Revoke(grantID string) error {
	gate := h.s.acquirePhaseGate(grantID)
	defer gate.Release()

	h.s.mu.Lock()
	defer h.s.mu.Unlock()
	g := h.s.findByID(grantID)
	if g == nil {
		return ErrNotFound
	}
	switch g.State {
	case StateAuthorized, StateInProgress:
		g.State = StateRevoked
		g.StateChangedAt = h.s.clock()
		if err := h.s.persistLockedAcknowledging(); err != nil {
			return fmt.Errorf("grant: revoke %s: failed to persist REVOKED: %w", grantID, err)
		}
		return nil
	case StateRevoked:
		// Already REVOKED in memory -- but that alone does not prove the durable write actually
		// landed (see the doc comment above). Re-persist unconditionally so this call cannot report
		// success while the Store's own persistence contract has not actually succeeded.
		if err := h.s.persistLockedAcknowledging(); err != nil {
			return fmt.Errorf("grant: revoke %s: failed to persist REVOKED (retry): %w", grantID, err)
		}
		return nil
	case StatePublished:
		// V3.1-B Hardening R3.1.1: revocation is still (and must remain) denied either way -- the
		// remote effect already happened, so REVOKED can never become true regardless of persistence
		// status. But while PUBLISHED is still pending, reporting the terminal-refusal sentinel alone
		// would conceal that the Store's own acknowledgement of that fact is still failing. Attempt the
		// same bounded local repair Revoke already performs for its own REVOKED case above -- no remote
		// I/O, still under the phase gate and h.s.mu -- and report whichever sentinel matches the
		// repair's actual outcome, never silently converging on "durably acknowledged."
		if h.s.isPendingLocked(grantID) {
			if err := h.s.persistLockedAcknowledging(); err != nil {
				return fmt.Errorf("grant: revoke %s: PUBLISHED is still pending (repair failed): %w (%v)", grantID, ErrPublishPersistFailed, err)
			}
		}
		return fmt.Errorf("grant: cannot revoke grant %s: the remote effect already happened: %w", grantID, ErrCannotRevokePublished)
	case StateBlocked:
		// V3.1-B Hardening R3.1.1: identical rationale to StatePublished above, for BLOCKED.
		if h.s.isPendingLocked(grantID) {
			if err := h.s.persistLockedAcknowledging(); err != nil {
				return fmt.Errorf("grant: revoke %s: BLOCKED is still pending (repair failed): %w (%v)", grantID, ErrBlockPersistFailed, err)
			}
		}
		return fmt.Errorf("grant: cannot revoke grant %s: its terminal reason must not be erased: %w", grantID, ErrCannotRevokeBlocked)
	case StateExpired:
		return fmt.Errorf("grant: cannot revoke grant %s: its terminal state must not be erased: %w", grantID, ErrCannotRevokeExpired)
	default:
		return fmt.Errorf("grant: cannot revoke grant (%s) in unrecognized state %q", grantID, g.State)
	}
}

// ClientHandle exposes only what the unprivileged client socket may do: begin/resume publication
// under an EXISTING grant it cannot itself create, and report outcomes back into that grant's state.
// It has no method that creates, extends, or revokes a grant -- see the package doc comment.
type ClientHandle struct{ s *Store }

// Client returns the unprivileged-client-only facade over this store.
func (s *Store) Client() *ClientHandle { return &ClientHandle{s: s} }

// BeginOrResume looks up the grant bound to requestDigest and, per V3.1-B Section 13's idempotency
// model, either starts it (AUTHORIZED -> IN_PROGRESS) or safely resumes an already-started attempt
// for the SAME exact digest (IN_PROGRESS or PUBLISHED are both returned OK, letting the caller
// observe remote state and continue/no-op rather than treating a retry as a conflict). A grant
// belonging to a different digest is never returned -- there is no cross-digest lookup at all, only
// an exact-digest map key.
// PERSISTENCE-TRUTHFUL (V3.1-B Hardening R3): both transitions BeginOrResume can itself trigger --
// AUTHORIZED -> IN_PROGRESS and AUTHORIZED -> EXPIRED -- are pre-effect: no remote effect (no push,
// no PR) has happened yet at this point, unlike Revoke/MarkPublished/MarkBlocked. So on a
// persistLocked() failure, BOTH transitions are simply ROLLED BACK to AUTHORIZED (never a bare
// no-op-in-memory return, and never a fail-closed-forward unpersisted terminal/phase-admissible
// state) -- the grant remains fully AUTHORIZED and usable, and the very next BeginOrResume call
// (after storage recovery) re-evaluates and re-attempts the same transition cleanly. This is what
// guarantees "no caller may receive a successful IN_PROGRESS result unless that state has actually
// been persisted" and "an expiry persistence failure is never silently claimed as durably recorded"
// without needing any special pending/dirty in-memory marker.
func (h *ClientHandle) BeginOrResume(requestDigest string) (*Grant, error) {
	h.s.mu.Lock()
	defer h.s.mu.Unlock()
	g, exists := h.s.byDigest[requestDigest]
	if !exists {
		return nil, ErrNotFound
	}
	switch g.State {
	case StateRevoked:
		return nil, ErrRevoked
	case StateBlocked:
		// Pending-aware repair (V3.1-B Hardening R3.1, superseding R3's "opportunistic, result
		// discarded" version): MarkBlocked is only ever called by internal/server.Orchestrate, and
		// this exact denial is what stops Orchestrate from ever reaching a MarkBlocked call site again
		// for this Grant -- so a BeginOrResume retry (an ordinary resubmission of the same package) is
		// the ONLY remaining natural path by which an earlier MarkBlocked persistence failure ever gets
		// a chance to durably repair itself. Unlike R3's version, the repair's OWN result is no longer
		// discarded: while BLOCKED is still pending, this returns the distinct, errors.Is-checkable
		// ErrBlockPersistFailed -- never the plain ErrBlocked, which now means "BLOCKED IS durably
		// acknowledged." Only once persistence actually succeeds (this call or an earlier one) does a
		// BeginOrResume call ever report plain ErrBlocked.
		if h.s.isPendingLocked(g.GrantID) {
			if err := h.s.persistLockedAcknowledging(); err != nil {
				return nil, fmt.Errorf("grant: begin %s: BLOCKED is still pending (retry failed): %w (%v)", requestDigest, ErrBlockPersistFailed, err)
			}
		}
		return nil, ErrBlocked
	case StateExpired:
		return nil, ErrExpired
	case StateAuthorized:
		prevState, prevChangedAt := g.State, g.StateChangedAt
		if h.s.clock().After(g.ExpiresAt) {
			g.State = StateExpired
			g.StateChangedAt = h.s.clock()
			if err := h.s.persistLockedAcknowledging(); err != nil {
				g.State, g.StateChangedAt = prevState, prevChangedAt
				return nil, fmt.Errorf("grant: begin %s: failed to persist EXPIRED transition: %w (%v)", requestDigest, ErrExpirePersistFailed, err)
			}
			return nil, ErrExpired
		}
		g.State = StateInProgress
		g.StateChangedAt = h.s.clock()
		if err := h.s.persistLockedAcknowledging(); err != nil {
			g.State, g.StateChangedAt = prevState, prevChangedAt
			return nil, fmt.Errorf("grant: begin %s: failed to persist IN_PROGRESS transition: %w (%v)", requestDigest, ErrBeginPersistFailed, err)
		}
		cp := *g
		return &cp, nil
	case StateInProgress:
		// Safe retry of the identical authorized request -- never broadened, never re-authorized,
		// just resumed. Expiry is intentionally not re-checked here: an in-flight or completed
		// attempt must not be retroactively invalidated by the clock alone (Section 13: "Do not
		// consume authorization in a way that makes an identical retry unsafe after a partial
		// remote success").
		cp := *g
		return &cp, nil
	case StatePublished:
		// Pending-aware repair (V3.1-B Hardening R3.1, superseding R3's "opportunistic, result
		// discarded" version): an earlier MarkPublished call may have fail-closed in memory to
		// PUBLISHED without yet succeeding at persisting that fact. internal/server.Orchestrate's own
		// top-level idempotent-PUBLISHED short-circuit reads exactly this returned snapshot and reports
		// success directly from it -- so while PUBLISHED is still pending, this must NOT return a
		// snapshot at all (a snapshot IS the success signal here); it returns the distinct,
		// errors.Is-checkable ErrPublishPersistFailed instead. Only once persistence actually succeeds
		// (this call or an earlier one) does a snapshot get returned.
		if h.s.isPendingLocked(g.GrantID) {
			if err := h.s.persistLockedAcknowledging(); err != nil {
				return nil, fmt.Errorf("grant: begin %s: PUBLISHED is still pending (retry failed): %w (%v)", requestDigest, ErrPublishPersistFailed, err)
			}
		}
		cp := *g
		return &cp, nil
	default:
		return nil, ErrWrongState
	}
}

// AdmitPublicationPhase acquires grantID's exclusive phase gate and, once held, re-reads the LIVE
// Grant state (never the possibly-stale snapshot an earlier BeginOrResume call returned) to decide
// whether a remote-effect phase (a Git push phase, or a PR finalization phase) may begin. This is
// the linearization point V3.1-B Hardening R2 requires: the gate closes the exact window where a
// concurrent AdminHandle.Revoke could otherwise persist REVOKED after a caller's last state check
// but before that caller's write-capable token mint/push/PR call.
//
// Exactly one of two outcomes:
//   - (grant, gate, nil): admission succeeded. grant.State is either IN_PROGRESS (a genuinely new
//     phase may proceed: mint tokens, push, create/update a PR) or PUBLISHED (idempotent -- another
//     attempt already completed; the caller must perform NO new remote-effect operation and should
//     Release the gate promptly). The caller now owns the gate and MUST call gate.Release() on
//     EVERY return path -- release is safe to call more than once (see PhaseGate), so deferring it
//     immediately after a successful call is always correct.
//   - (nil, nil, err): admission was denied. No gate is held (already released internally) --
//     the caller must NOT call Release. err is one of ErrNotFound, ErrRevoked, ErrBlocked, ErrExpired,
//     ErrWrongState (the last covering AUTHORIZED, which is invalid here: a publication phase must
//     always be preceded by a completed BeginOrResume), or a %w-wrapped ErrPublishPersistFailed /
//     ErrBlockPersistFailed (V3.1-B Hardening R3.1/R3.1.1 -- PUBLISHED or BLOCKED is still pending and
//     a repair attempt just failed; check with errors.Is, not direct equality, since these are always
//     wrapped with call-specific context). Plain ErrBlocked is returned ONLY once BLOCKED is durably
//     acknowledged (clean, or a pending repair just succeeded) -- it must never be conflated with a
//     still-pending BLOCKED. R3.1 closed this distinction for BeginOrResume's BLOCKED/PUBLISHED cases
//     and for this method's own PUBLISHED case, but originally missed this method's BLOCKED denial
//     path (and AdminHandle.Revoke's PUBLISHED/BLOCKED refusal cases) -- both closed by R3.1.1.
func (h *ClientHandle) AdmitPublicationPhase(grantID string) (*Grant, *PhaseGate, error) {
	gate := h.s.acquirePhaseGate(grantID)

	h.s.mu.Lock()
	g := h.s.findByID(grantID)
	var cp Grant
	var publishRepairErr error
	var blockRepairErr error
	blockWasPending := false
	if g != nil {
		cp = *g
		switch {
		case g.State == StatePublished && h.s.isPendingLocked(grantID):
			// Pending-aware repair (V3.1-B Hardening R3.1, superseding R3's "opportunistic, result
			// discarded" version) -- see BeginOrResume's identical rationale. Attempted while mu is
			// still held, alongside the read, so it stays a brief in-memory-plus-local-persist
			// operation, never spanning the Git/HTTP/token-mint activity the caller is about to (or,
			// here, is NOT about to, since this is the idempotent short-circuit) perform. The repair's
			// own result is captured, never discarded -- see below.
			publishRepairErr = h.s.persistLockedAcknowledging()
		case g.State == StateBlocked && h.s.isPendingLocked(grantID):
			// V3.1-B Hardening R3.1.1: the identical pending-aware repair, for the same reason, on the
			// denial path. Without this, a pending BLOCKED grant would misreport as plain ErrBlocked
			// (which means "durably acknowledged" specifically since R3.1) merely because this method
			// never previously checked isPendingLocked for anything but StatePublished. No remote I/O
			// is involved -- this is a bounded local repair attempt, still under mu, still under the
			// held phase gate.
			blockWasPending = true
			blockRepairErr = h.s.persistLockedAcknowledging()
		}
	}
	h.s.mu.Unlock()

	if g == nil {
		gate.Release()
		return nil, nil, ErrNotFound
	}
	if publishRepairErr != nil {
		// PUBLISHED is still pending: the caller must never receive a PUBLISHED snapshot (which IS
		// the success signal for an idempotent admission) alongside a failed repair -- no gate, no
		// snapshot, just the distinct, errors.Is-checkable ErrPublishPersistFailed.
		gate.Release()
		return nil, nil, fmt.Errorf("grant: admit %s: PUBLISHED is still pending (retry failed): %w (%v)", grantID, ErrPublishPersistFailed, publishRepairErr)
	}
	if blockWasPending && blockRepairErr != nil {
		// BLOCKED is still pending: never report plain ErrBlocked (which now specifically means
		// "durably acknowledged") while the repair attempt just failed -- no gate, no snapshot, the
		// distinct, errors.Is-checkable ErrBlockPersistFailed instead.
		gate.Release()
		return nil, nil, fmt.Errorf("grant: admit %s: BLOCKED is still pending (retry failed): %w (%v)", grantID, ErrBlockPersistFailed, blockRepairErr)
	}
	switch cp.State {
	case StateInProgress, StatePublished:
		return &cp, gate, nil
	case StateRevoked:
		gate.Release()
		return nil, nil, ErrRevoked
	case StateBlocked:
		gate.Release()
		return nil, nil, ErrBlocked
	case StateExpired:
		gate.Release()
		return nil, nil, ErrExpired
	default: // StateAuthorized or anything unrecognized
		gate.Release()
		return nil, nil, ErrWrongState
	}
}

// MarkPublished transitions a grant to PUBLISHED, recording the PR number when one exists.
//
// PERSISTENCE-TRUTHFUL, PENDING-AWARE (V3.1-B Hardening R3.1, mirroring AdminHandle.Revoke's R2.1
// pattern, refining R3's version): unlike BeginOrResume's pre-effect transitions, PUBLISHED reports a
// remote effect that has ALREADY genuinely happened (the push, and for a PR flow, the PR too) -- so a
// persistLocked() failure here is never rolled back; the in-memory state stays fail-closed PUBLISHED
// so nothing can re-attempt that remote effect, and the Grant's GrantID is marked pending in
// Store.pending until a persistLockedAcknowledging() call actually succeeds. A retry with the
// IDENTICAL remoteHead/prNumber outcome re-attempts persistence ONLY while still pending -- an already
// DURABLY-acknowledged retry is a true no-op (no unnecessary disk write). A retry reporting a
// DIFFERENT outcome is rejected outright (ErrPublishedOutcomeMismatch) regardless of pending/clean
// status: the already-recorded outcome must never be silently overwritten by a different one.
func (h *ClientHandle) MarkPublished(grantID string, remoteHead string, prNumber int) error {
	h.s.mu.Lock()
	defer h.s.mu.Unlock()
	g := h.s.findByID(grantID)
	if g == nil {
		return ErrNotFound
	}
	if g.State == StatePublished {
		if g.RemoteHeadObserved != remoteHead || g.PRNumber != prNumber {
			return fmt.Errorf("grant: MarkPublished %s: retry outcome (head=%s pr=%d) disagrees with the already-recorded outcome (head=%s pr=%d): %w",
				grantID, remoteHead, prNumber, g.RemoteHeadObserved, g.PRNumber, ErrPublishedOutcomeMismatch)
		}
		if !h.s.isPendingLocked(grantID) {
			return nil // already durably acknowledged -- no unnecessary rewrite
		}
		if err := h.s.persistLockedAcknowledging(); err != nil {
			return fmt.Errorf("grant: MarkPublished %s: PUBLISHED is still pending (retry failed): %w (%v)", grantID, ErrPublishPersistFailed, err)
		}
		return nil
	}
	if g.State != StateInProgress {
		return ErrWrongState
	}
	g.State = StatePublished
	g.StateChangedAt = h.s.clock()
	g.RemoteHeadObserved = remoteHead
	if prNumber != 0 {
		g.PRNumber = prNumber
	}
	h.s.markPendingLocked(grantID)
	if err := h.s.persistLockedAcknowledging(); err != nil {
		return fmt.Errorf("grant: MarkPublished %s: failed to persist PUBLISHED: %w (%v)", grantID, ErrPublishPersistFailed, err)
	}
	return nil
}

// MarkBlocked records a BLOCKED outcome for a grant that was IN_PROGRESS (or still AUTHORIZED, if
// verification failed before any remote effect). A BLOCKED grant is terminal -- it does not
// auto-retry; a fresh admin-authorized grant (new request_digest) is required.
//
// PERSISTENCE-TRUTHFUL, PENDING-AWARE (V3.1-B Hardening R3.1, mirroring AdminHandle.Revoke's R2.1
// pattern, refining R3's version): a persistLocked() failure is never rolled back -- the in-memory
// state stays fail-closed BLOCKED (a caller must never be able to newly admit a publication phase for
// it just because the durable write hasn't landed yet), and the Grant's GrantID is marked pending in
// Store.pending until a persistLockedAcknowledging() call actually succeeds. A retry with the
// IDENTICAL reason re-attempts persistence ONLY while still pending -- an already durably-acknowledged
// retry is a true no-op. A retry with a DIFFERENT reason is rejected outright (ErrBlockedReasonMismatch)
// regardless of pending/clean status: the original terminal reason must never be silently overwritten.
// A block attempt against an already-PUBLISHED grant never overwrites it -- see ErrCannotBlockPublished.
//
// LINEARIZABLE AGAINST CONCURRENT PUBLICATION PHASES AND REVOKE (V3.1-B Hardening R3.2): every
// transition to BLOCKED now competes for the SAME per-Grant exclusive phase gate AdminHandle.Revoke
// and an admitted publication phase (AdmitPublicationPhase) already compete for. MarkBlocked -- the
// OUTSIDE-phase entry point, for a caller that does NOT already hold this Grant's phase gate -- acquires
// it itself before applying the transition, so it either wins outright (no phase is currently admitted;
// a later AdmitPublicationPhase call for this Grant then correctly observes BLOCKED and is denied) or
// blocks until an already-admitted phase (or Revoke) releases the gate, after which it re-reads live
// state -- never overwriting a PUBLISHED result that phase already recorded. A caller that IS already
// inside an admitted phase (Phase A or Phase B in internal/server.Orchestrate) MUST NOT call this
// method -- re-acquiring the same non-reentrant mutex would deadlock -- it must call
// MarkBlockedInPhase with its own already-held lease instead; both share the identical transition
// logic via markBlockedCore.
func (h *ClientHandle) MarkBlocked(grantID, reason string) error {
	gate := h.s.acquirePhaseGate(grantID)
	defer gate.Release()
	return h.s.markBlockedCore(grantID, reason)
}

// MarkBlockedInPhase applies the IDENTICAL BLOCKED transition logic as MarkBlocked (see
// markBlockedCore), but for a caller that is already INSIDE an admitted publication phase and already
// holds that Grant's phase gate (V3.1-B Hardening R3.2) -- Phase A's push-decision-table failures and
// Phase B's PR-outcome failures in internal/server.Orchestrate are the only intended callers. It never
// acquires the underlying per-Grant mutex itself (gate is already held by the caller; re-acquiring a
// non-reentrant mutex from the same logical holder would deadlock). Instead it mechanically validates
// gate is a live, still-active lease for exactly this Store and this GrantID (never a caller-supplied
// assertion -- see PhaseGate.leaseFor), then performs the mutation inside the SAME operationMu critical
// section Release() itself uses, which is what makes this call linearizable against a concurrent
// Release() of the identical lease rather than racing it -- see phaseGateState's own doc comment.
func (h *ClientHandle) MarkBlockedInPhase(gate *PhaseGate, grantID, reason string) error {
	if err := gate.leaseFor(h.s, grantID); err != nil {
		return err
	}
	gate.state.operationMu.Lock()
	defer gate.state.operationMu.Unlock()
	if gate.state.released {
		return fmt.Errorf("grant: MarkBlockedInPhase %s: phase lease already released: %w", grantID, ErrInvalidPhaseLease)
	}
	return h.s.markBlockedCore(grantID, reason)
}

// markBlockedCore is the single shared BLOCKED-transition state machine both MarkBlocked (outside a
// phase, acquires the gate itself) and MarkBlockedInPhase (inside an already-admitted phase, uses the
// caller's already-held lease) apply -- V3.1-B Hardening R3.2 requires these never diverge. The caller
// must already hold grantID's phase gate (by whichever means) before calling this; it acquires only
// the brief Store.mu for the in-memory read/write/persist attempt itself, per this package's documented
// lock order (phase gate first, then Store.mu, never the reverse).
func (s *Store) markBlockedCore(grantID, reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	g := s.findByID(grantID)
	if g == nil {
		return ErrNotFound
	}
	switch g.State {
	case StateRevoked:
		return ErrRevoked
	case StateExpired:
		return ErrExpired
	case StatePublished:
		// A real remote effect already happened -- BLOCKED can never become true regardless of
		// persistence status, but a still-pending PUBLISHED fact's Store acknowledgement must not be
		// concealed behind the (also-true) terminal refusal -- identical rationale to
		// AdminHandle.Revoke's own StatePublished case.
		if s.isPendingLocked(grantID) {
			if err := s.persistLockedAcknowledging(); err != nil {
				return fmt.Errorf("grant: markBlocked %s: PUBLISHED is still pending (repair failed): %w (%v)", grantID, ErrPublishPersistFailed, err)
			}
		}
		return fmt.Errorf("grant: cannot block grant %s: already published: %w", grantID, ErrCannotBlockPublished)
	case StateBlocked:
		if g.BlockedReason != reason {
			return fmt.Errorf("grant: markBlocked %s: retry reason %q disagrees with the already-recorded reason %q: %w",
				grantID, reason, g.BlockedReason, ErrBlockedReasonMismatch)
		}
		if !s.isPendingLocked(grantID) {
			return nil // already durably acknowledged -- no unnecessary rewrite
		}
		if err := s.persistLockedAcknowledging(); err != nil {
			return fmt.Errorf("grant: markBlocked %s: BLOCKED is still pending (retry failed): %w (%v)", grantID, ErrBlockPersistFailed, err)
		}
		return nil
	case StateInProgress, StateAuthorized:
		g.State = StateBlocked
		g.BlockedReason = reason
		g.StateChangedAt = s.clock()
		s.markPendingLocked(grantID)
		if err := s.persistLockedAcknowledging(); err != nil {
			return fmt.Errorf("grant: markBlocked %s: failed to persist BLOCKED: %w (%v)", grantID, ErrBlockPersistFailed, err)
		}
		return nil
	default:
		return ErrWrongState
	}
}

// RecordRemoteHead lets the client report the remote head observed mid-flight (e.g. right after a
// successful push, before the PR step), without changing the grant's IN_PROGRESS state -- used so a
// subsequent retry can tell "push already happened" from "push still needed" per Section 13's
// idempotency example.
//
// RemoteHeadObserved is a recoverable CACHE, never the authority for whether a remote effect
// happened -- internal/server always re-observes the actual remote fresh before trusting anything
// (V3.1-B Hardening R3: see runRemotePublicationPhase's own comment). So on a persistLocked()
// failure, the in-memory cache value is simply ROLLED BACK to what it was before this call, keeping
// it consistent with what is actually on disk rather than silently drifting ahead of it; a later
// identical call can simply retry. A failed cache write never changes Grant authorization, phase-gate
// behavior, or the R1/R1.1 exact remote-transition rules -- those are governed entirely by the fresh
// remote observation, not this cache.
func (h *ClientHandle) RecordRemoteHead(grantID, remoteHead string) error {
	h.s.mu.Lock()
	defer h.s.mu.Unlock()
	g := h.s.findByID(grantID)
	if g == nil {
		return ErrNotFound
	}
	if g.State != StateInProgress {
		return ErrWrongState
	}
	prev := g.RemoteHeadObserved
	g.RemoteHeadObserved = remoteHead
	if err := h.s.persistLockedAcknowledging(); err != nil {
		g.RemoteHeadObserved = prev
		return err
	}
	return nil
}

func (s *Store) findByID(grantID string) *Grant {
	for _, g := range s.byDigest {
		if g.GrantID == grantID {
			return g
		}
	}
	return nil
}
