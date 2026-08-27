// Package server orchestrates one publication request end-to-end: grant lookup/consumption,
// broker-owned package import, independent commit verification, branch-safety-checked push, and PR
// create/update -- in that order, each step fail-closed. It is the only place in this module that
// ties every other package (protocol, grant, pkgimport, verifier, gitremote, githubapp, audit)
// together, and the only place that ever holds a minted GitHub token in memory.
//
// Orchestrate is a pure function over injected Deps so it can be exercised in tests without any
// real Unix socket, real GitHub API, or real network -- see ClientListener/AdminListener in
// listener.go for the thin transport wrapper this function sits behind in production.
//
// V3.1-B Hardening R2 (linearizable grant revocation): every remote-effect phase -- the Git push
// phase and, separately, the PR finalization phase -- is bracketed by
// grant.ClientHandle.AdmitPublicationPhase, which acquires the Grant's exclusive per-Grant phase
// gate and re-reads its LIVE state before any write-capable token is minted. This is what makes
// "once AdminHandle.Revoke returns success, no new write-capable token mint, Git push, PR create,
// or PR update for that Grant may begin" an enforced guarantee rather than a best-effort repeated
// check: Revoke acquires the exact same gate, so it can never observe (or act on) a Grant while one
// of these phases is admitted and in flight, and neither phase can begin while Revoke holds the
// gate. See internal/grant's PhaseGate doc comment for the full lock-order contract.
package server

import (
	"context"
	"errors"
	"time"

	"mihver.network/publication-broker/internal/audit"
	"mihver.network/publication-broker/internal/githubapp"
	"mihver.network/publication-broker/internal/gitremote"
	"mihver.network/publication-broker/internal/grant"
	"mihver.network/publication-broker/internal/pkgimport"
	"mihver.network/publication-broker/internal/protocol"
	"mihver.network/publication-broker/internal/verifier"
)

// Result is what Orchestrate returns -- deliberately never includes a token, private key, or any
// other secret, and is always safe to serialize as the Broker's client-facing response.
type Result struct {
	Status        string `json:"status"` // "PUBLISHED" | "BLOCKED"
	GrantID       string `json:"grant_id,omitempty"`
	CommitSHA     string `json:"commit_sha,omitempty"`
	RemoteHead    string `json:"remote_head,omitempty"`
	PRNumber      int    `json:"pr_number,omitempty"`
	FailureReason string `json:"failure_reason,omitempty"`
}

func blockedResult(reason string) Result { return Result{Status: "BLOCKED", FailureReason: reason} }

// TokenMinter is the narrow interface Orchestrate needs from internal/githubapp -- an interface
// here (not the concrete type) so tests can inject a minter pointed at an httptest server, or a
// fake that never touches the network at all.
type TokenMinter interface {
	Mint(ctx context.Context, repositoryName string, permissions map[string]string) (githubapp.Token, error)
}

// PRClientFactory builds a githubapp.PRClient bound to one minted token -- kept as a factory rather
// than a single long-lived client because the write-capable token is minted late, per request.
type PRClientFactory func(token githubapp.Token, owner, repo string) githubapp.PRClient

// Deps is everything Orchestrate needs, fully injected -- no ambient global state, no implicit
// production defaults. Production wiring (cmd/mihver-broker) and test wiring (server_test.go)
// construct this identically in shape, differing only in which concrete values they inject.
//
// Grants is deliberately typed *grant.ClientHandle, not *grant.Store -- this is what makes "the
// unprivileged client path cannot create/modify/extend/revoke a grant" an actual compile-time
// property of ClientListener (which embeds a Deps) rather than a claim resting on the client-request
// handler simply choosing not to call an available Admin() method. Only cmd/mihver-broker's own
// privileged bootstrap ever holds the full *grant.Store (to derive both a ClientHandle for Deps and
// an AdminHandle for the separate admin listener) -- see NewAdminListener, which takes an
// *grant.AdminHandle directly, never a Deps.
type Deps struct {
	GitBinary        string
	Grants           *grant.ClientHandle
	Audit            *audit.Log
	TokenMinter      TokenMinter
	PRClientFactory  PRClientFactory
	GitRemote        gitremote.Client
	RemoteURLBuilder func(owner, name string) (string, error)
	Now              func() time.Time

	// The fields below are UNEXPORTED, test-only deterministic synchronization seams for
	// internal/server's own _test.go files (which compile into package server itself). They are
	// never referenced by cmd/mihver-broker's production wiring (a different package, which -- being
	// unexported -- has no way to even name these fields, let alone set them) and are never
	// reachable from any PublicationPackage/request content; all remain nil (a complete no-op)
	// on every production and non-concurrency-test code path. They exist solely so a test can prove
	// exact interleavings (e.g. "revoke wins before phase admission", "an admitted phase blocks a
	// concurrent revoke", or "revoke wins in the released gap between Phase A and Phase B") using
	// channel handshakes rather than sleeps -- see orchestrate_revocation_test.go and
	// orchestrate_block_linearization_test.go.
	testHookBeforePhaseA        func()
	testHookAfterPhaseAAdmitted func()
	testHookBetweenPhaseAAndB   func()
	testHookAfterPhaseBAdmitted func()

	// testHookBeforeBlockAttempt (V3.1-B Hardening R3.2) fires in blockGrantResult immediately before
	// dispatching to the gate-acquiring MarkBlocked or the gate-bound MarkBlockedInPhase -- i.e. right
	// at the point the calling goroutine is about to contend for (or use) the per-Grant phase gate.
	// It exists so a test can prove a competing goroutine has actually reached that contention point
	// before asserting on timing, rather than relying on an unsynchronized sleep/timeout window.
	testHookBeforeBlockAttempt func()
}

func (d Deps) now() time.Time {
	if d.Now != nil {
		return d.Now()
	}
	return time.Now()
}

// Orchestrate runs the full publish flow for one PublicationPackage's raw component bytes. It never
// panics on malformed/hostile input -- every failure path returns a BLOCKED Result with an exact
// reason instead.
func Orchestrate(ctx context.Context, d Deps, envelopeBytes, receiptBytes, bundleBytes, manifestBytes []byte) Result {
	req, err := protocol.ParseRequest(envelopeBytes, receiptBytes, bundleBytes, manifestBytes)
	if err != nil {
		return blockedResult("MALFORMED_REQUEST: " + err.Error())
	}
	digest := req.RequestDigest().Hex()

	client := d.Grants
	g, err := client.BeginOrResume(digest)
	if err != nil {
		reason := mapGrantError(err)
		d.auditBlocked("", digest, req, reason)
		return blockedResult(reason)
	}

	if g.RepositoryOwner != req.Envelope.Repository.Owner ||
		g.RepositoryName != req.Envelope.Repository.Name ||
		g.Branch != req.Envelope.Branch ||
		g.BaseBranch != req.Envelope.BaseBranch ||
		g.BaseCommit != req.Envelope.BaseCommit {
		// Outside any admitted phase (activeLease=nil) -- see blockGrantResult's doc comment.
		return d.blockGrantResult(client, nil, g.GrantID, digest, req, "GRANT_REQUEST_FIELD_MISMATCH")
	}

	// Idempotent resume: this exact grant already reached PUBLISHED on an earlier attempt (Section
	// 13) -- report the previously-observed outcome again rather than repeating any remote effect.
	// (BeginOrResume's own snapshot is sufficient here -- no remote-effect phase is about to start,
	// so there is nothing for the phase gate to linearize against yet.)
	if g.State == grant.StatePublished {
		return Result{Status: "PUBLISHED", GrantID: g.GrantID, CommitSHA: req.Receipt.CommitSHA, RemoteHead: g.RemoteHeadObserved, PRNumber: g.PRNumber}
	}

	im, err := pkgimport.Import(ctx, d.GitBinary, req.BundleBytes, req.Receipt.CommitSHA)
	if err != nil {
		reason := "PACKAGE_IMPORT_FAILED: " + err.Error()
		return d.blockGrantResult(client, nil, g.GrantID, digest, req, reason)
	}
	defer im.Close()

	if res := verifier.VerifyCommit(ctx, im, req.Envelope, req.Receipt); !res.OK {
		reason := res.Reason
		if res.Detail != "" {
			reason = res.Reason + ": " + res.Detail
		}
		return d.blockGrantResult(client, nil, g.GrantID, digest, req, reason)
	}

	if err := gitremote.ValidateTargetBranch(req.Envelope.Branch, req.Envelope.BaseBranch); err != nil {
		res := d.blockGrantResult(client, nil, g.GrantID, digest, req, err.Error())
		if res.Status == "PUBLISHED" || res.FailureReason != err.Error() {
			// Either converged to an already-completed PUBLISHED result, or the block itself failed
			// (persistence-pending, revoked, expired, mismatch, etc.) -- in every such case the
			// FailureReason is already the correct stable code, never the raw branch-validation text.
			return res
		}
		return blockedResult("BRANCH_REJECTED: " + res.FailureReason)
	}

	remoteURL, err := d.RemoteURLBuilder(req.Envelope.Repository.Owner, req.Envelope.Repository.Name)
	if err != nil {
		// Structurally unreachable in practice -- req.Envelope.Repository.Owner/.Name already passed
		// internal/protocol's own repoidentity-backed Envelope validation as ParseRequest's first step,
		// and RemoteURLBuilder's production implementation (cmd/mihver-broker/main.go) re-validates via
		// the exact same internal/repoidentity package. Handled fail-closed anyway (V3.1-B Closeout Pack
		// A.1) as defense in depth, exactly like the branch-validation rejection immediately above --
		// outside any admitted phase, so no PhaseGate lease is in scope here.
		return d.blockGrantResult(client, nil, g.GrantID, digest, req, "INVALID_REPOSITORY_IDENTITY: "+err.Error())
	}

	if d.testHookBeforePhaseA != nil {
		d.testHookBeforePhaseA()
	}

	// --- Phase A: remote publication phase (V3.1-B Hardening R2) --------------------------------
	// The exclusive per-Grant phase gate is acquired here, immediately before the fresh
	// remote-head decision begins -- everything from this point through the end of phaseA
	// (including the write-capable token mint and the push itself) runs with the gate held, so a
	// concurrent AdminHandle.Revoke can never interleave with it.
	phaseA := d.runRemotePublicationPhase(ctx, client, g.GrantID, im, remoteURL, req, digest)
	if phaseA.done {
		return phaseA.result
	}

	if !req.Envelope.PRExpected {
		// runRemotePublicationPhase already persisted PUBLISHED and returned it when PRExpected is
		// false; reaching here with done==false and PRExpected==false cannot happen, but fail
		// closed rather than fall through silently if it ever did.
		reason := "INTERNAL_PHASE_INVARIANT_VIOLATION"
		d.auditBlocked(g.GrantID, digest, req, reason)
		return blockedResult(reason)
	}

	// --- Phase B: PR finalization phase (V3.1-B Hardening R2) ------------------------------------
	// Phase A's gate was already released (see runRemotePublicationPhase); this acquires it again,
	// fresh, which is exactly the second admission point that lets a human revoke stop PR creation
	// after a branch push has already succeeded. testHookBetweenPhaseAAndB fires in exactly this gap
	// (gate released, not yet re-acquired) -- the sole seam a test needs to prove a concurrent Revoke
	// can win here and that Phase B's fresh admission (not merely Phase A's) is what stops it.
	if d.testHookBetweenPhaseAAndB != nil {
		d.testHookBetweenPhaseAAndB()
	}
	return d.runPRFinalizationPhase(ctx, client, g.GrantID, phaseA.remoteHead, req, digest)
}

// phaseOutcome is Phase A's result: either `done` is true and `result` is what Orchestrate must
// return directly (a terminal BLOCKED or a no-PR PUBLISHED), or `done` is false and `remoteHead` is
// the confirmed remote head Phase B should verify the eventual PR's head SHA against.
type phaseOutcome struct {
	result     Result
	remoteHead string
	done       bool
}

// runRemotePublicationPhase implements Phase A in full: acquire the per-Grant phase gate, admit
// against the LIVE grant state, freshly observe the remote, apply the R1 four-case exact-transition
// table, perform the R1.1 atomic-lease push when needed, and (for pr_expected == false) persist
// PUBLISHED before releasing the gate. The gate is held for the ENTIRE phase, including the
// write-capable token mint and the push itself -- never merely checked once at the start.
func (d Deps) runRemotePublicationPhase(ctx context.Context, client *grant.ClientHandle, grantID string, im *pkgimport.Imported, remoteURL string, req *protocol.Request, digest string) phaseOutcome {
	live, gate, err := client.AdmitPublicationPhase(grantID)
	if err != nil {
		reason := mapGrantError(err)
		d.auditBlocked(grantID, digest, req, reason)
		return phaseOutcome{result: blockedResult(reason), done: true}
	}
	defer gate.Release()

	if live.State == grant.StatePublished {
		// Another identical concurrent request already completed publication while we were
		// waiting for the gate -- idempotent resume, no new remote effect of any kind.
		return phaseOutcome{
			result:     Result{Status: "PUBLISHED", GrantID: grantID, CommitSHA: req.Receipt.CommitSHA, RemoteHead: live.RemoteHeadObserved, PRNumber: live.PRNumber},
			remoteHead: live.RemoteHeadObserved,
			done:       true,
		}
	}

	if d.testHookAfterPhaseAAdmitted != nil {
		d.testHookAfterPhaseAAdmitted()
	}

	// Both failures below are treated as transient/retryable (network blip, GitHub outage), same
	// rationale as the write-token-mint case further down -- the grant stays IN_PROGRESS.
	readToken, err := d.TokenMinter.Mint(ctx, req.Envelope.Repository.Name, githubapp.ReadOnlyPermissions)
	if err != nil {
		reason := "READ_TOKEN_MINT_FAILED"
		d.auditBlocked(grantID, digest, req, reason)
		return phaseOutcome{result: blockedResult(reason), done: true}
	}
	// ALWAYS freshly observe the remote head before deciding whether to push -- never trust a
	// cached grant.RemoteHeadObserved value on its own. This is deliberate, not merely a race-safety
	// nicety: (a) RecordRemoteHead's own persistence write can itself fail (see below), so a cached
	// value being empty does not prove no push happened; (b) the remote is the actual source of
	// truth for "did this already happen," and re-deriving from it on every attempt is what makes a
	// retry safe even across a crash between a successful push and a successful grant-state write.
	observedNow, err := d.GitRemote.RemoteHead(ctx, im.Dir, remoteURL, req.Envelope.Branch, readToken.Raw())
	if err != nil {
		reason := "REMOTE_HEAD_UNREADABLE"
		d.auditBlocked(grantID, digest, req, reason)
		return phaseOutcome{result: blockedResult(reason), done: true}
	}

	// Exact remote-transition decision table (V3.1-B Hardening R1). A non-force push being a valid
	// fast-forward from *whatever the remote currently happens to be* is NECESSARY but NOT
	// SUFFICIENT authorization: fast-forward-ness alone says nothing about whether the remote's
	// current position is the one thing the Envelope actually authorized moving from. Each branch
	// below binds the push's expected-head argument to a fixed, Envelope-derived value -- never to
	// `observedNow` itself -- so an unreviewed intermediate commit can never be silently published
	// merely because the final commit descends from wherever the remote happens to sit.
	var remoteHeadAfter string
	switch {
	case observedNow == req.Receipt.CommitSHA:
		// Case 1 -- already published: idempotent resume of this exact request. No push, no
		// write-capable token.
		remoteHeadAfter = observedNow

	case observedNow != "" && observedNow == req.Envelope.ExpectedPrePublishHead:
		// Case 2 -- existing branch at the exact authorized predecessor. Mint the write-capable
		// token only now that this equality has succeeded, and bind Push's expected head to the
		// Envelope's own ExpectedPrePublishHead (not observedNow, even though they are equal here by
		// construction) -- Push must never be handed an arbitrary observed ancestor as if it were an
		// authorized one. R1.1's exact-OID --force-with-lease is what makes this atomic against a
		// remote mutation landing between this observation and the push subprocess.
		writeToken, err := d.TokenMinter.Mint(ctx, req.Envelope.Repository.Name, githubapp.TargetPermissions)
		if err != nil {
			reason := "WRITE_TOKEN_MINT_FAILED"
			d.auditBlocked(grantID, digest, req, reason)
			return phaseOutcome{result: blockedResult(reason), done: true}
		}
		pushed, err := d.GitRemote.Push(ctx, im.Dir, remoteURL, req.Envelope.Branch, req.Receipt.CommitSHA, req.Envelope.ExpectedPrePublishHead, writeToken.Raw())
		if err != nil {
			return phaseOutcome{result: d.blockOnPushFailure(client, gate, grantID, digest, req, err), done: true}
		}
		remoteHeadAfter = pushed
		if remoteHeadAfter != req.Receipt.CommitSHA {
			// Inside Phase A's already-held gate -- see blockGrantResult's doc comment.
			return phaseOutcome{result: d.blockGrantResult(client, gate, grantID, digest, req, "PUSHED_HEAD_MISMATCH"), done: true}
		}

	case observedNow == "" && req.Envelope.ExpectedPrePublishHead == req.Envelope.BaseCommit:
		// Case 3 -- absent remote branch, safe to create. Authorized only when the Envelope's own
		// expected predecessor equals its own base_commit (the verifier already proved commit_sha
		// has exactly one parent equal to ExpectedPrePublishHead). Push's expected head is the
		// literal empty string -- R1.1's exact-OID lease with an empty expected value is what makes
		// a concurrent branch creation atomically detected, not merely checked-then-raced.
		writeToken, err := d.TokenMinter.Mint(ctx, req.Envelope.Repository.Name, githubapp.TargetPermissions)
		if err != nil {
			reason := "WRITE_TOKEN_MINT_FAILED"
			d.auditBlocked(grantID, digest, req, reason)
			return phaseOutcome{result: blockedResult(reason), done: true}
		}
		pushed, err := d.GitRemote.Push(ctx, im.Dir, remoteURL, req.Envelope.Branch, req.Receipt.CommitSHA, "", writeToken.Raw())
		if err != nil {
			return phaseOutcome{result: d.blockOnPushFailure(client, gate, grantID, digest, req, err), done: true}
		}
		remoteHeadAfter = pushed
		if remoteHeadAfter != req.Receipt.CommitSHA {
			return phaseOutcome{result: d.blockGrantResult(client, gate, grantID, digest, req, "PUSHED_HEAD_MISMATCH"), done: true}
		}

	default:
		// Case 4 -- every other remote state: fail closed. Zero Git write attempts, zero
		// write-capable token mints, remote left exactly as observed.
		return phaseOutcome{result: d.blockGrantResult(client, gate, grantID, digest, req, "REMOTE_HEAD_CHANGED"), done: true}
	}

	// Persisting the observed remote head is best-effort bookkeeping, not the safety mechanism --
	// the fresh RemoteHead() re-check above is. If this write fails, log it distinctly (never
	// silently discarded) so an operator can see the audit log recorded fewer durable writes than
	// state transitions; the next retry still behaves correctly because it re-derives the truth from
	// the remote rather than trusting this cached field.
	if err := client.RecordRemoteHead(grantID, remoteHeadAfter); err != nil {
		d.auditTransition(grantID, digest, req, "REMOTE_HEAD_PERSIST_FAILED_NON_FATAL", remoteHeadAfter, 0, err.Error())
	}
	d.auditTransition(grantID, digest, req, "REMOTE_PUSHED", remoteHeadAfter, 0, "")

	if !req.Envelope.PRExpected {
		// Still holding the phase gate: persist PUBLISHED before it is released (Phase A
		// requirement 8) -- this is what closes the window between "push succeeded" and "the
		// terminal state is durably recorded" against a concurrent revoke.
		if err := client.MarkPublished(grantID, remoteHeadAfter, 0); err != nil {
			reason := publishPersistFailureReason(err)
			d.auditBlocked(grantID, digest, req, reason)
			return phaseOutcome{result: blockedResult(reason), done: true}
		}
		d.auditTransition(grantID, digest, req, "PUBLISHED_NO_PR", remoteHeadAfter, 0, "")
		return phaseOutcome{
			result:     Result{Status: "PUBLISHED", GrantID: grantID, CommitSHA: req.Receipt.CommitSHA, RemoteHead: remoteHeadAfter},
			remoteHead: remoteHeadAfter,
			done:       true,
		}
	}

	return phaseOutcome{remoteHead: remoteHeadAfter, done: false}
}

// runPRFinalizationPhase implements Phase B in full: acquire the per-Grant phase gate again
// (fresh -- Phase A already released it), admit against the LIVE grant state, and only then mint
// the PR-capable token and perform the exact-head PR search/create/update. This second, separate
// admission point is what lets a human revoke stop PR creation even after the branch push already
// succeeded in Phase A.
func (d Deps) runPRFinalizationPhase(ctx context.Context, client *grant.ClientHandle, grantID, remoteHeadAfter string, req *protocol.Request, digest string) Result {
	live, gate, err := client.AdmitPublicationPhase(grantID)
	if err != nil {
		reason := mapGrantError(err)
		d.auditBlocked(grantID, digest, req, reason)
		return blockedResult(reason)
	}
	defer gate.Release()

	if d.testHookAfterPhaseBAdmitted != nil {
		d.testHookAfterPhaseBAdmitted()
	}

	if live.State == grant.StatePublished {
		// Another identical concurrent request already completed the PR step too.
		return Result{Status: "PUBLISHED", GrantID: grantID, CommitSHA: req.Receipt.CommitSHA, RemoteHead: live.RemoteHeadObserved, PRNumber: live.PRNumber}
	}

	// Everything from here to the end of the PR step is retryable on a transient failure -- an
	// identical retry with the same grant/digest must be able to pick the PR step back up without
	// needing a fresh human authorization (Section 13's worked example is exactly this: push
	// succeeded, PR API call failed). Only AMBIGUOUS_PR/PR_BASE_MISMATCH/PR_STATE_MISMATCH -- real
	// facts about GitHub's actual state disagreeing with what was authorized, not transient errors
	// -- mark the grant terminally BLOCKED.
	prToken, err := d.TokenMinter.Mint(ctx, req.Envelope.Repository.Name, githubapp.TargetPermissions)
	if err != nil {
		reason := "PR_TOKEN_MINT_FAILED"
		d.auditBlocked(grantID, digest, req, reason)
		return blockedResult(reason)
	}
	prClient := d.PRClientFactory(prToken, req.Envelope.Repository.Owner, req.Envelope.Repository.Name)

	existing, err := prClient.FindOpenByHead(ctx, req.Envelope.Branch)
	if err != nil {
		if err == githubapp.ErrAmbiguousPR {
			// Inside Phase B's already-held gate -- see blockGrantResult's doc comment.
			return d.blockGrantResult(client, gate, grantID, digest, req, "AMBIGUOUS_PR")
		}
		reason := "PR_LIST_FAILED"
		d.auditBlocked(grantID, digest, req, reason)
		return blockedResult(reason)
	}

	var pr *githubapp.PR
	if existing == nil {
		created, err := prClient.Create(ctx, req.Envelope.Branch, req.Envelope.BaseBranch, req.Envelope.PRTitle, req.Envelope.PRBody)
		if err != nil {
			reason := "PR_CREATE_FAILED"
			d.auditBlocked(grantID, digest, req, reason)
			return blockedResult(reason)
		}
		pr = created
	} else {
		if existing.BaseRef != req.Envelope.BaseBranch {
			return d.blockGrantResult(client, gate, grantID, digest, req, "PR_BASE_MISMATCH")
		}
		updated, err := prClient.UpdateTitleBody(ctx, existing.Number, req.Envelope.PRTitle, req.Envelope.PRBody)
		if err != nil {
			reason := "PR_UPDATE_FAILED"
			d.auditBlocked(grantID, digest, req, reason)
			return blockedResult(reason)
		}
		pr = updated
	}

	if pr.HeadRef != req.Envelope.Branch || pr.HeadSHA != remoteHeadAfter || pr.BaseRef != req.Envelope.BaseBranch {
		return d.blockGrantResult(client, gate, grantID, digest, req, "PR_STATE_MISMATCH")
	}

	if err := client.MarkPublished(grantID, remoteHeadAfter, pr.Number); err != nil {
		reason := publishPersistFailureReason(err)
		d.auditBlocked(grantID, digest, req, reason)
		return blockedResult(reason)
	}
	d.auditTransition(grantID, digest, req, "PUBLISHED_WITH_PR", remoteHeadAfter, pr.Number, "")

	return Result{Status: "PUBLISHED", GrantID: grantID, CommitSHA: req.Receipt.CommitSHA, RemoteHead: remoteHeadAfter, PRNumber: pr.Number}
}

// blockOnPushFailure classifies a Push error: ErrRemoteHeadChanged means the remote moved in a way
// this run didn't expect between observation and push (a real fact requiring fresh review, so the
// grant is marked terminally BLOCKED); any other push failure (network blip, transient GitHub
// error) is treated as retryable, same rationale as the token-mint failures elsewhere in this file.
func (d Deps) blockOnPushFailure(client *grant.ClientHandle, gate *grant.PhaseGate, grantID, digest string, req *protocol.Request, pushErr error) Result {
	if pushErr == gitremote.ErrRemoteHeadChanged {
		// Inside Phase A's already-held gate -- see blockGrantResult's doc comment.
		return d.blockGrantResult(client, gate, grantID, digest, req, "REMOTE_HEAD_CHANGED")
	}
	reason := "PUSH_FAILED"
	d.auditBlocked(grantID, digest, req, reason)
	return blockedResult(reason)
}

// mapGrantError maps every error grant.BeginOrResume or grant.AdmitPublicationPhase can return to
// a stable, machine-readable reason code. A revocation race must never be reported merely as
// PUSH_FAILED/PR_CREATE_FAILED/GRANT_PUBLISH_PERSIST_FAILED when the real cause is the live Grant
// having become REVOKED -- callers of AdmitPublicationPhase route its error through this same
// function precisely so GRANT_REVOKED is always the reason reported in that case, never a generic
// failure code, and never by first calling MarkBlocked (the grant is already terminal; nothing to
// mark).
func mapGrantError(err error) string {
	switch {
	case errors.Is(err, grant.ErrNotFound):
		return "NO_GRANT"
	case errors.Is(err, grant.ErrRevoked):
		return "GRANT_REVOKED"
	case errors.Is(err, grant.ErrExpired):
		return "GRANT_EXPIRED"
	case errors.Is(err, grant.ErrExpirePersistFailed):
		// V3.1-B Hardening R3: BeginOrResume rolled the in-memory transition back to AUTHORIZED
		// rather than fail-closing forward into an unpersisted EXPIRED -- this is deliberately NOT
		// reported as GRANT_EXPIRED (which would wrongly imply a durably recorded terminal state);
		// it is a distinct, retryable code.
		return "GRANT_EXPIRE_PERSIST_FAILED"
	case errors.Is(err, grant.ErrBlockPersistFailed):
		// V3.1-B Hardening R3.1: BLOCKED is fail-closed in memory but still PENDING -- not yet
		// confirmed included in a successful persistLocked() call. Deliberately NOT reported as
		// GRANT_PREVIOUSLY_BLOCKED, which now means "BLOCKED IS durably acknowledged."
		return "GRANT_BLOCK_PERSIST_FAILED"
	case errors.Is(err, grant.ErrBlocked):
		return "GRANT_PREVIOUSLY_BLOCKED"
	case errors.Is(err, grant.ErrPublishPersistFailed):
		// V3.1-B Hardening R3.1: PUBLISHED is fail-closed in memory but still PENDING. BeginOrResume
		// and AdmitPublicationPhase both return this (never a snapshot) while it remains unconfirmed --
		// a snapshot IS the success signal for PUBLISHED, so it must never accompany this error.
		return "GRANT_PUBLISH_PERSIST_FAILED"
	case errors.Is(err, grant.ErrBeginPersistFailed):
		// V3.1-B Hardening R3: BeginOrResume rolled the in-memory transition back to AUTHORIZED --
		// the grant remains usable; a retry after storage recovery starts cleanly from AUTHORIZED.
		return "GRANT_BEGIN_PERSIST_FAILED"
	default:
		return "GRANT_ERROR"
	}
}

// publishPersistFailureReason classifies a MarkPublished error (V3.1-B Hardening R3): an outcome
// mismatch (this attempt's remoteHead/prNumber disagrees with an already-recorded PUBLISHED outcome
// for the same Grant -- structurally unreachable in normal operation since the per-Grant phase gate
// already serializes Phase B, but fails closed with a distinct, honest code rather than folding it
// into the generic persistence-failure code if it were ever reached) is reported distinctly from a
// genuine persistence failure, so an operator is never told "persistence failed" when the real fact
// is a disagreeing outcome, or vice versa.
func publishPersistFailureReason(err error) string {
	switch {
	case errors.Is(err, grant.ErrPublishedOutcomeMismatch):
		return "GRANT_PUBLISH_OUTCOME_MISMATCH"
	case errors.Is(err, grant.ErrPublishPersistFailed):
		return "GRANT_PUBLISH_PERSIST_FAILED"
	case errors.Is(err, grant.ErrNotFound):
		// Defensive/unreachable in normal operation (MarkPublished is only ever called immediately
		// after AdmitPublicationPhase confirmed the grant exists, under the same phase gate) -- never
		// misclassify this as a persistence failure, which would incorrectly suggest a retry could help.
		return "NO_GRANT"
	case errors.Is(err, grant.ErrWrongState):
		// Equally defensive/unreachable in normal operation -- see above.
		return "GRANT_ERROR"
	default:
		return "GRANT_PUBLISH_PERSIST_FAILED"
	}
}

// blockOutcomeReason classifies a MarkBlocked/MarkBlockedInPhase error to a stable, machine-readable
// reason code (V3.1-B Hardening R3.2) -- errors.Is throughout, never a catch-all that folds every
// non-nil error into GRANT_BLOCK_PERSIST_FAILED (the pre-R3.2 behavior, which mislabeled REVOKED,
// EXPIRED, a reason mismatch, and an invalid phase lease all identically as a persistence failure).
func blockOutcomeReason(err error) string {
	switch {
	case errors.Is(err, grant.ErrBlockPersistFailed):
		return "GRANT_BLOCK_PERSIST_FAILED"
	case errors.Is(err, grant.ErrPublishPersistFailed):
		return "GRANT_PUBLISH_PERSIST_FAILED"
	case errors.Is(err, grant.ErrRevoked):
		return "GRANT_REVOKED"
	case errors.Is(err, grant.ErrExpired):
		return "GRANT_EXPIRED"
	case errors.Is(err, grant.ErrBlockedReasonMismatch):
		return "GRANT_BLOCK_REASON_MISMATCH"
	case errors.Is(err, grant.ErrInvalidPhaseLease):
		// Never reachable from real request data -- an invalid/foreign/released phase lease is always
		// a programming error inside this module, reported distinctly rather than silently folded into
		// a persistence-failure code so it is never mistaken for something a retry could fix.
		return "INTERNAL_PHASE_GATE_ERROR"
	case errors.Is(err, grant.ErrNotFound):
		return "NO_GRANT"
	default:
		return "GRANT_BLOCK_PERSIST_FAILED"
	}
}

// blockGrantResult attempts to durably record a BLOCKED grant with intendedReason, using the correct
// per-Grant-phase-gate linearization API for the caller's context (V3.1-B Hardening R3.2):
//   - activeLease == nil: the caller does NOT already hold this Grant's phase gate (every block call
//     site before Phase A is ever admitted) -- uses the gate-ACQUIRING grant.ClientHandle.MarkBlocked,
//     which competes for the gate against any already-admitted phase or a concurrent Revoke exactly
//     like AdmitPublicationPhase and Revoke already do.
//   - activeLease != nil: the caller IS already inside an admitted phase (Phase A's push-decision-table
//     failures, Phase B's PR-outcome failures) and already holds that Grant's phase gate -- uses the
//     gate-BOUND grant.ClientHandle.MarkBlockedInPhase instead; calling the gate-acquiring MarkBlocked
//     here would re-acquire the same non-reentrant mutex and deadlock.
//
// If the Grant turns out to already be durably PUBLISHED (this attempt lost the linearization race to
// a completed publication), it returns the ACTUAL PUBLISHED Result instead of any BLOCKED result --
// an identical request must converge on the real, already-completed outcome, never a misleading
// terminal block (GRANT_ERROR / GRANT_BLOCK_PERSIST_FAILED / GRANT_ALREADY_PUBLISHED).
func (d Deps) blockGrantResult(client *grant.ClientHandle, activeLease *grant.PhaseGate, grantID, digest string, req *protocol.Request, intendedReason string) Result {
	if d.testHookBeforeBlockAttempt != nil {
		d.testHookBeforeBlockAttempt()
	}
	var err error
	if activeLease != nil {
		err = client.MarkBlockedInPhase(activeLease, grantID, intendedReason)
	} else {
		err = client.MarkBlocked(grantID, intendedReason)
	}
	if err == nil {
		d.auditBlocked(grantID, digest, req, intendedReason)
		return blockedResult(intendedReason)
	}
	if errors.Is(err, grant.ErrCannotBlockPublished) {
		if activeLease == nil {
			// Outside a phase: safe to acquire the gate fresh to fetch the live PUBLISHED snapshot and
			// converge on it -- this is the ordinary "lost the race to a completed publication" case.
			live, gate, aerr := client.AdmitPublicationPhase(grantID)
			if aerr == nil {
				gate.Release()
				d.auditTransition(grantID, digest, req, "CONVERGED_TO_PUBLISHED", live.RemoteHeadObserved, live.PRNumber, "")
				return Result{Status: "PUBLISHED", GrantID: grantID, CommitSHA: req.Receipt.CommitSHA, RemoteHead: live.RemoteHeadObserved, PRNumber: live.PRNumber}
			}
			reason := blockOutcomeReason(aerr)
			d.auditTransition(grantID, digest, req, reason, "", 0, "intended reason: "+intendedReason+": convergence re-read failed: "+aerr.Error())
			return blockedResult(reason)
		}
		// Inside a phase: structurally unreachable (AdmitPublicationPhase's own idempotent-PUBLISHED
		// short-circuit means Phase A/B never even begin against an already-PUBLISHED grant, so no
		// inside-phase block call site can ever observe StatePublished here) -- fail closed rather than
		// attempt a same-gate re-acquisition via AdmitPublicationPhase, which would deadlock.
		reason := blockOutcomeReason(err)
		d.auditTransition(grantID, digest, req, reason, "", 0, "intended reason: "+intendedReason+": "+err.Error())
		return blockedResult(reason)
	}
	reason := blockOutcomeReason(err)
	d.auditTransition(grantID, digest, req, reason, "", 0, "intended reason: "+intendedReason+": "+err.Error())
	return blockedResult(reason)
}

func (d Deps) auditBlocked(grantID, digest string, req *protocol.Request, reason string) {
	if d.Audit == nil {
		return
	}
	e := audit.Entry{Timestamp: d.now(), RequestDigest: digest, GrantID: grantID, StateTransition: "BLOCKED", BlockedReason: reason}
	if req != nil {
		e.RepositoryOwner = req.Envelope.Repository.Owner
		e.RepositoryName = req.Envelope.Repository.Name
		e.Branch = req.Envelope.Branch
		e.BaseBranch = req.Envelope.BaseBranch
	}
	_ = d.Audit.Append(e)
}

func (d Deps) auditTransition(grantID, digest string, req *protocol.Request, transition, remoteHead string, prNumber int, extra string) {
	if d.Audit == nil {
		return
	}
	e := audit.Entry{
		Timestamp: d.now(), RequestDigest: digest, GrantID: grantID,
		StateTransition: transition, RemoteHead: remoteHead, PRNumber: prNumber,
	}
	if extra != "" {
		e.Extra = map[string]string{"detail": extra}
	}
	if req != nil {
		e.RepositoryOwner = req.Envelope.Repository.Owner
		e.RepositoryName = req.Envelope.Repository.Name
		e.Branch = req.Envelope.Branch
		e.BaseBranch = req.Envelope.BaseBranch
		e.CommitSHA = req.Receipt.CommitSHA
	}
	_ = d.Audit.Append(e)
}
