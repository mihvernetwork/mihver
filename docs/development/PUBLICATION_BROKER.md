# Publication Broker (V3.1-B)

Permanent policy/semantic-owner document for the privileged Publication Broker. Referenced by
[CODEX_ROLES.md](./CODEX_ROLES.md)'s "Publication Broker (V3.1-B — source implemented, NOT
provisioned/activated)" section (that section now points here rather than restating this document's
content) and [AGENT_POLICY.md](./AGENT_POLICY.md)'s
"Git & Branch Workflow". This file owns the Broker's architecture, trust model, protocol, and
deployment design; [CODEX_ROLES.md](./CODEX_ROLES.md) continues to own the Codex role definitions
and the Local Publication Builder (V3.1-A), which this document does not restate or reopen.

## Status (current, as of V3.1-B Closeout Pack A.2.1 / Source Merge Preparation)

```text
Local Publication Builder:                IMPLEMENTED (V3.1-A)
Publication Broker source:                IMPLEMENTED (V3.1-B) -- tools/publication-broker/
Source implementation review:             R1 -> R3.2 -> Closeout Pack A -> A.1 -> A.2 -> A.2.1, all
                                           APPROVED / READY_FOR_EXTERNAL_PATCH_REVIEW
External source-boundary review:          CLOSED -- CLOSEOUT_A.2.1_EXTERNAL_PATCH_REVIEW = PASS
Source status:                            MERGE CANDIDATE (source only -- see below)
Privilege-separated Broker installation:   NOT PROVISIONED
GitHub App credential:                     NOT INSTALLED
GitHub main ruleset:                       NOT APPLIED
Activation status:                         NOT PROVISIONED / NOT ACTIVATED
Remote publication automation:             NOT AVAILABLE
```

**SOURCE IMPLEMENTATION vs ACTIVATION -- these are two separate facts, never conflated:**

- **Source implementation:** reviewed through R1, R1.1, R2, R2.1, R3, R3.1, R3.1.1, R3.2, Closeout
  Pack A, A.1, A.2, and A.2.1 (each round's own hardening/remediation recorded in
  `.project/CURRENT_TASK.md`/`.project/REVIEW_STATE.md`). The Closeout Pack A.2.1 external
  patch-review bundle (`mihver-v3.1-b-closeout-a21-review-bundle.patch`, SHA-256
  `6c90cc87249056a49b46f356ef69aa2fd239546495805cf868041550df0646e9`, 1,055,327 bytes, 20,530 lines,
  63 diff sections) is the latest externally reviewed artifact; its verdict is
  `CLOSEOUT_A.2.1_EXTERNAL_PATCH_REVIEW = PASS`. The source is therefore an eligible **source merge
  candidate** after this repository's own final validation gate (below) passes on the exact reviewed
  bytes.
- **Activation:** not provisioned, not enabled, and not tested against live GitHub infrastructure. No
  separate OS identity has been created, no compiled Broker binary has been installed outside this
  repository, no GitHub App exists, no private key has been installed, and no
  `mihver-broker`/`mihver-broker-admin` process has ever been run against real infrastructure by any
  task to date. Every test in `tools/publication-broker/**` runs against disposable local Git
  repositories, local Unix sockets in a temp directory, and `httptest` fake HTTP servers — never a
  real GitHub credential, never a real push, never a real PR. Merging this source into `main` does
  not itself introduce any real GitHub App key, installation, socket service, ruleset, or live
  publication path -- see "Human Provisioning Checklist (V3.1-C)" below for the full, still-explicit
  list of what remains before this source may ever run for real. Until that provisioning happens and
  an end-to-end live dogfood passes, **REMOTE PUBLICATION AUTOMATION = NOT AVAILABLE** remains true
  exactly as it was under V3.1-A — no code path, including this one, pushes a branch or touches a PR
  today, and merging the reviewed source does not change that.

**On race-test validation provenance:** this repository's own full `go test -race ./...` run (executed
directly, covering every package, to completion) is what this status relies on as the mandatory
pre-commit gate — see `.project/REVIEW_STATE.md`'s Closeout Pack A.2/A.2.1 entries for exactly which
race runs were performed directly versus by an independent reviewer, and never a claim of a separate
"external extraction environment" this project has no actual record of running.

## Core Security Invariant

**The repository source code is not the privilege boundary.** Claude and Codex can both read and
write every file in this repository, including everything under `tools/publication-broker/`.
Placing Broker source in the repository therefore creates no credential separation by itself — the
separation only exists once a *reviewed, compiled* Broker artifact is installed **outside** the
model-writable repository, under a distinct OS identity Claude/Codex cannot modify or impersonate,
holding a GitHub App private key Claude/Codex cannot read. Everything in this document up to
"macOS Deployment Target" describes source-level design that is *ready* for that installation, not a
claim that the installation has happened.

## Trust-Zone Diagram

```text
┌───────────────────────────────────────────────────────────────────────┐
│ MODEL-WRITABLE ZONE (Claude / Codex / development user)                │
│                                                                         │
│  scripts/dev/publication-builder.mjs (V3.1-A, unchanged)               │
│    -> local commit + PublicationReceipt                                │
│  cmd/mihver-publish (V3.1-B, this task)                                │
│    -> builds an immutable PublicationPackage (git bundle + manifest)   │
│    -> computes the REQUEST DIGEST, prints it for human authorization   │
│    -> submits the package over the UNPRIVILEGED client Unix socket     │
└───────────────────────────────────┬───────────────────────────────────┘
                                     │ untrusted input, never trusted code execution
                                     ▼
┌───────────────────────────────────────────────────────────────────────┐
│ PRIVILEGE BOUNDARY -- NOT PROVISIONED BY THIS TASK                     │
│  separate OS identity · broker-owned executable, outside this repo     │
│  broker-owned state (grant store, audit log) · broker-owned GitHub App │
│  private key · broker-owned bare Git storage for imported packages     │
├───────────────────────────────────────────────────────────────────────┤
│  cmd/mihver-broker (this task's source; not installed/run for real)    │
│    1. import the untrusted package into broker-owned bare git storage  │
│       (internal/pkgimport) -- never executes anything from it          │
│    2. look up/consume a server-side PublicationGrant bound to the      │
│       EXACT request digest (internal/grant) -- a human, not Claude,    │
│       created this grant via the PRIVILEGED admin socket               │
│    3. independently re-verify every remote-effect-critical fact        │
│       (internal/verifier) -- never trusts the Envelope/Receipt's own   │
│       claims, only the actual imported Git object graph                │
│    4. mint a short-lived, minimally-scoped GitHub App installation     │
│       token ON DEMAND (internal/githubapp) -- Contents:write,          │
│       Pull requests:write only, never persisted                        │
│    5. branch-safety-checked, non-force, expected-head-verified push    │
│       (internal/gitremote) -- categorically rejects main/master/       │
│       base_branch/tags/arbitrary refs/force/delete                     │
│    6. create/update exactly one PR if pr_expected (internal/githubapp) │
│    7. append a hash-chained audit entry (internal/audit) -- no secrets │
└───────────────────────────────────┬───────────────────────────────────┘
                                     │ short-lived installation token, memory only
                                     ▼
┌───────────────────────────────────────────────────────────────────────┐
│ GITHUB                                                                  │
│  task branch pushed · PR created/updated · main ruleset (V3.1-C) blocks│
│  the Publication App from ever updating main · human-only merge        │
└───────────────────────────────────────────────────────────────────────┘
```

## Go Module / Binary Structure

```text
tools/publication-broker/
  go.mod                          module mihver.network/publication-broker; Go stdlib only
  cmd/
    mihver-broker/                the privileged server: client + admin Unix socket listeners
    mihver-broker-admin/          CLI: create-grant / revoke-grant, talks only to the admin socket
    mihver-publish/               unprivileged client: builds a PublicationPackage, prints the
                                   REQUEST DIGEST, optionally submits to the client socket
  internal/
    protocol/    Envelope/Receipt/PackageManifest wire types (mirroring the V3.1-A JSON Schemas
                 field-for-field, strict-decoded, unknown fields rejected) + the REQUEST DIGEST
                 framing/recipe
    grant/       server-side PublicationGrant store; AdminHandle (create/revoke) and ClientHandle
                 (begin/resume/mark-published/mark-blocked) are DISJOINT Go types -- the unprivileged
                 socket handler is constructible only with a ClientHandle, and has no way to obtain
                 an AdminHandle from it
    pkgimport/   imports an untrusted Git bundle into a fresh, broker-owned bare repository under a
                 sterile environment (internal/gitexec) -- never executes bundle content
    verifier/    the Broker's OWN independent re-verification of every remote-effect-critical fact
                 (Section 9 below) -- never trusts the Envelope/Receipt's claims
    githubapp/   GitHub App JWT minting (RS256, stdlib crypto/rsa), installation-token minting
                 (opaque Token type that redacts on String()/MarshalJSON()), and the narrow PR
                 create/update/search mechanics (no merge/close/approve method exists on PRClient)
    gitremote/   branch-safety validation + non-force, expected-head-checked push, with the token
                 kept out of argv/URL/logs via a per-push GIT_ASKPASS env handoff
    gitexec/     the shared sterile git-exec wrapper (explicit argv only, explicit minimal env,
                 broker-owned scratch HOME) every other package that touches git uses
    audit/       broker-owned, hash-chained, append-only JSONL audit log
    config/      fail-closed production configuration validation (Section 18)
    server/      orchestrates one publish request end-to-end (Deps + Orchestrate), plus the thin
                 Unix-socket transport wrapper (ClientListener / AdminListener)
    testutil/    shared disposable-git-repository test fixtures (mirrors
                 tests/dev/publication-builder.test.mjs's own fixture style)
```

No third-party Go dependency was added anywhere in this module — every package above uses only the
Go standard library (`crypto/rsa`, `crypto/sha256`, `net`, `net/http`, `os/exec`, `encoding/json`,
etc.).

## PublicationPackage / Request Digest

The Broker never runs Git commands inside the user's model-writable repository, and never trusts a
package-supplied remote URL, `.git/config`, hooks, credential helpers, aliases, fsmonitor, `HOME`, or
environment. The unprivileged side (`mihver-publish`) instead builds an **immutable
PublicationPackage**: the raw Envelope bytes, the raw Receipt bytes, a **self-contained Git bundle**
(created from a fixed temporary ref, `refs/heads/mihver-broker-import`, so it is always importable
into an empty repository with no assumed prerequisite objects), and a deterministic manifest binding
their digests plus the commit SHA. The Broker copies/imports this into broker-owned bare storage
(`internal/pkgimport`) before touching it in any other way.

**REQUEST DIGEST** = SHA-256 over an explicitly length-prefixed framed stream of
`[protocol_version, sha256(envelope), sha256(receipt), sha256(bundle), sha256(manifest)]`, in that
exact order (`internal/protocol.ComputeRequestDigest`). Explicit 8-byte big-endian length prefixes on
every field make the framing unambiguous — two different `(a, b)` pairs whose naive concatenation
would collide (`"ab"+"c"` vs `"a"+"bc"`) never hash identically. A single byte changed anywhere in any
of the four artifacts changes that artifact's own digest, which changes every subsequent framed field
and therefore the final REQUEST DIGEST — this is what makes "one-byte modification after
authorization invalidates the grant" a mechanical fact, not a policy statement.

## Server-Side PublicationGrant

A Claude-authored PublicationEnvelope is **not** sufficient evidence that a human authorized remote
publication — Claude produced it. The privileged Broker requires an independent, broker-owned
**PublicationGrant**, created only through the **privileged admin path**, bound to the exact REQUEST
DIGEST:

```text
1. mihver-publish computes and prints the REQUEST DIGEST (does not act on it)
2. the human authorizes that EXACT digest via mihver-broker-admin create-grant, talking only to
   the privileged admin Unix socket
3. the Broker stores the grant in broker-owned state (internal/grant), keyed by digest
4. mihver-publish (or a retry of it) submits the package to the UNPRIVILEGED client socket; the
   Broker looks up the grant by the digest it independently recomputes from the submitted bytes --
   never a digest the client merely claims
```

`internal/grant.Store` splits its method set at the Go type level: `AdminHandle` (create/revoke) is
obtainable only via `Store.Admin()`, and `ClientHandle` (begin/resume/mark-published/mark-blocked) via
`Store.Client()`. `internal/server`'s client-socket handler is constructed with only a `ClientHandle`
in its `Deps` — it has no field, method, or code path that could reach an `AdminHandle`. This makes
"an unprivileged client cannot create, modify, extend, or revoke a grant" a compile-time property,
not merely a runtime check the server has to remember to enforce; the admin/client Unix socket
separation (`/var/run/mihver-broker.sock` vs `/var/run/mihver-broker-admin.sock` in production) is
additionally what an attacker with only development-user access can never reach at all, once the
macOS deployment below is actually provisioned.

**Grant lifecycle** (`internal/grant`'s `State`): `AUTHORIZED → IN_PROGRESS → PUBLISHED`, with
`BLOCKED`, `REVOKED`, `EXPIRED` as terminal states. A grant is bound to exactly one request digest,
ever — a different (mutated) request can never reuse it. **Idempotency (Section 13):** a retry with
the *identical* digest against an `IN_PROGRESS` or `PUBLISHED` grant resumes rather than errors; the
Broker records the remote head it observed after a successful push (`RemoteHeadObserved`) so a retry
that only failed at the PR step does not push again. Only failures that represent a genuine fact
requiring fresh human review — a verifier `BLOCKED` reason, an unexpected changed remote head, an
ambiguous/mismatched PR — transition the grant to the terminal `BLOCKED` state. Transient failures
(a token-mint network error, a transient PR API 5xx) leave the grant `IN_PROGRESS` so an identical
retry can simply continue; see `internal/server/orchestrate.go`'s inline comments at each failure
site for the exact classification.

### Linearizable Grant Revocation (V3.1-B Hardening R2)

Idempotent resume (above) closes retries; it does not by itself close a **live revocation race**: a
concurrently in-flight `Orchestrate` call that already completed `BeginOrResume` holds a single Grant
snapshot captured before an `AdminHandle.Revoke` call lands. Repeated read-only state re-checks alone
cannot close this — the window between the last check and the actual write-capable operation (token
mint, `Push`, PR create/update) is exactly where the race lives (TOCTOU). The guarantee required: once
`AdminHandle.Revoke` returns success, no new write-capable token mint, `Push`, PR create, or PR update
for that Grant may begin.

`internal/grant.Store` now owns one exclusive **per-Grant phase gate** (`*sync.Mutex`, keyed by
`GrantID`, held in a separate `gates` map guarded by its own `gatesMu` — never `Store.mu` itself),
initialized for every grant loaded at `Open()` and for every grant created via `AdminHandle.Create`.
`ClientHandle.AdmitPublicationPhase(grantID)` acquires this gate, re-reads the Grant's live state
fresh from the Store, and returns the *still-held* gate (as a `*PhaseGate`, `Release()`d by the
caller — idempotent via `sync.Once`, so a double-`Release()`, or a `Release()` called on a copied
`PhaseGate` value, never panics — see "Copy-Safe Phase Lease" below) together with a fresh snapshot;
it never returns a generic "wrong state" error for a real terminal state — `REVOKED`,
`BLOCKED`, and `EXPIRED` are each reported distinctly. `AdminHandle.Revoke` acquires the **same** gate
**first**, before touching any state — so `Revoke` blocks for the duration of any publication phase
that is already admitted, and a phase cannot be newly admitted while `Revoke` holds the gate. Lock
order is fixed and one-directional everywhere: the phase gate first, then `Store.mu` only briefly for
an in-memory read/write, released before any I/O — `Store.mu` is never held across a token mint,
`git`/HTTP call, or filesystem import; the reverse order (acquiring `Store.mu` and then the phase
gate) never occurs, so the two locks cannot deadlock against each other.

`internal/server.Orchestrate` performs its two remote-effect phases each under their own fresh gate
acquisition — Phase A (`runRemotePublicationPhase`: the existing R1/R1.1 remote-transition decision
table and `Push` call) and, when `pr_expected`, Phase B (`runPRFinalizationPhase`: PR search/
create/update) — releasing the gate at the end of each phase rather than holding it for the whole
call, specifically so `Revoke` can still win in the gap between a successful push and PR
finalization. Each phase re-admits via `AdmitPublicationPhase` before doing anything write-capable;
a `REVOKED` admission maps to the stable `GRANT_REVOKED` failure code (never a generic `PUSH_FAILED`/
`PR_CREATE_FAILED`), and `MarkBlocked` is never called on a revocation race — revocation is not a
verifiable fact about GitHub's own state the way a real push/PR failure is. `Revoke` itself can never
overwrite a `PUBLISHED`, `BLOCKED`, or `EXPIRED` grant ("last writer wins" is explicitly rejected):
its switch only ever transitions `AUTHORIZED`/`IN_PROGRESS` to `REVOKED`, treats `REVOKED` as
idempotent, and returns one of three stable sentinel errors for every other terminal state (see
"Stable Revoke Error Model" below), leaving it unchanged. The gate is per-Grant, not a single global
I/O mutex — holding one Grant's gate never blocks Orchestrate calls or revocation for a different
Grant.

### Persistence-Truthful Revoke (V3.1-B Hardening R2.1)

The gate above closes the *in-process ordering* race. A narrower, purely local gap remained inside
`AdminHandle.Revoke` itself: the original implementation special-cased `REVOKED` as a bare
`return nil` — correct semantically (revoking an already-revoked grant should be a no-op success) but
unsafe combined with persistence failure. If a first `Revoke` call transitioned the in-memory state to
`REVOKED` but its own `persistLocked()` call failed (a full disk, a permission error), that call
correctly returned a non-nil error — but a *second* call would see the in-memory state already
`REVOKED` and return `nil` immediately, **without ever attempting to persist again**, reporting success
while the on-disk store still showed the grant `IN_PROGRESS`. Reopening the Store (a Broker process
restart) would then load the grant as still active. This is not a durability/`fsync`/power-loss
concern (that gap is real but explicitly out of this round's scope — see the exact wording in
`internal/grant.Store`'s own doc comment); it is a plain persistence-error/retry defect, reproduced
deterministically with a real file-backed Store (obstructing `persistLocked`'s temp-file write by
creating a directory at the target `.tmp` path) before being fixed.

Fixed by making `Revoke`'s `REVOKED` case **never** a bare no-op: every call, including a retry of an
already-in-memory-`REVOKED` grant, re-attempts `persistLocked()` and propagates its exact result —
`nil` only once that specific attempt actually succeeds, the wrapped error again if it is still
failing. This means a grant that is already durably `REVOKED` on disk pays a small redundant rewrite
on every idempotent revoke call — an explicitly accepted cost, favoring correctness (never a false
`nil`) over avoiding that write. In-memory state remains `REVOKED` (fail-closed) the moment a genuine
`AUTHORIZED`/`IN_PROGRESS` → `REVOKED` transition happens, independent of whether persistence
succeeds, so `AdmitPublicationPhase` — which only ever reads in-memory state — correctly denies
publication-phase admission with `ErrRevoked` in the same process regardless of persistence outcome.

### Copy-Safe Phase Lease (V3.1-B Hardening R2.1)

`PhaseGate` originally embedded its `*sync.Mutex` and `sync.Once` directly as struct fields. This is
unsafe to copy: `copied := *gate` copies `sync.Once` *by value*, producing a second, independent Once
guarding the same underlying mutex — calling `Release()` on both the original and the copy then
physically unlocks that mutex twice, the second call panicking with `fatal error: sync: unlock of
unlocked mutex` (reproduced directly against the pre-fix type before this was closed). `PhaseGate` is
now a thin handle around a separate, heap-allocated, unexported `phaseGateState` (`{mu *sync.Mutex;
once sync.Once}`): every `PhaseGate` value naming the same acquisition — however many times it is
copied, passed by value, or aliased — shares the exact same `phaseGateState` pointer and therefore the
exact same `Once`, so `Release()` is safe to call any number of times, from any number of copies,
concurrently or sequentially, and always unlocks the underlying mutex exactly once. A `PhaseGate`
obtained from a *later* acquisition of the same Grant's gate (after an earlier holder released it) gets
a brand-new `phaseGateState` with its own fresh `Once` — so a stale alias left over from an earlier,
fully-released acquisition can never unlock a later, unrelated acquisition, even though both
acquisitions share the same underlying `*sync.Mutex`.

### Stable Revoke Error Model (V3.1-B Hardening R2.1)

`AdminHandle.Revoke`'s three terminal-state refusals are stable sentinel errors —
`ErrCannotRevokePublished`, `ErrCannotRevokeBlocked`, `ErrCannotRevokeExpired` — wrapped with
grant-ID-specific human context via `fmt.Errorf`'s `%w`, checked with `errors.Is`, never by matching
substrings of `Error()`'s free-text message (which is not a contract). `internal/server`'s
`AdminListener` maps a `revoke_grant` failure to a stable wire `Code` on `AdminResult`
(`GRANT_ALREADY_PUBLISHED`, `GRANT_PREVIOUSLY_BLOCKED`, `GRANT_EXPIRED`, `GRANT_NOT_FOUND`, or
`GRANT_REVOKE_FAILED` for anything else, including a persistence failure) via the same `errors.Is`
comparisons, so a human operator — or a script driving `mihver-broker-admin` — has a machine-readable
outcome to branch on instead of parsing prose.

This closes the race in-process only; cross-process fencing, durability/fsync guarantees, and any
provisioned-broker persistence model remain V3.1-C concerns. See
`internal/server/orchestrate_revocation_test.go` and `internal/grant/grant_test.go`'s
`TestRevoke_WaitsForAdmittedPhase`/`TestAdmitPublicationPhase_AfterRevoke_Denied`/
`TestPhaseGate_DifferentGrantsAreIndependent`/`TestRevoke_DoesNotOverwriteBlocked`/
`TestRevoke_DoesNotOverwriteExpired`/`TestRevoke_DoesNotOverwritePublished` for the full regression
suite, including a deterministic defect reproduction proving the pre-fix race actually let a
write-capable push land after `Revoke` had already returned success.

### Persistence-Truthful Grant State Machine (V3.1-B Hardening R3)

R2.1 made `AdminHandle.Revoke` persistence-truthful (never reports success while its own
`persistLocked()` call is failing). R3 extends the same principle to every other Grant state
mutation — `AdminHandle.Create`, `ClientHandle.BeginOrResume`, `ClientHandle.MarkPublished`,
`ClientHandle.MarkBlocked`, and `ClientHandle.RecordRemoteHead` — closing the same class of defect
each one previously had: mutate the in-memory `Grant` first, attempt `persistLocked()`, and on failure
either discard the error (`_ = persistLocked()`) or return it without undoing the in-memory mutation —
so a *later* call could see the already-mutated in-memory state and report success even though the
Store file never actually recorded it.

Two distinct repair strategies are used, chosen by whether a remote effect has already genuinely
happened:

- **Rollback** (`Create`, and `BeginOrResume`'s own `AUTHORIZED → IN_PROGRESS` / `AUTHORIZED →
  EXPIRED` transitions): no remote effect (no push, no PR) and no privileged admin decision has
  happened yet, so on a `persistLocked()` failure the in-memory mutation is simply undone — `Create`
  removes both map insertions (the Grant and its phase gate) so a failed Create leaves nothing behind
  to be mistakenly usable; `BeginOrResume` reverts to `AUTHORIZED` so a later call re-attempts the
  same transition cleanly, with no special pending/dirty marker ever needed or persisted.
- **Fail-closed-forward** (`MarkPublished`, `MarkBlocked`, mirroring `Revoke`'s R2.1 pattern): a real
  remote effect (the push, and for a PR flow, the PR) or an already-decided terminal fact has
  happened, so rolling back would risk a caller re-attempting that effect or losing the decision. The
  in-memory state stays `PUBLISHED`/`BLOCKED` even while persistence is failing (denying new
  phase admission the whole time), and a retry reporting the IDENTICAL outcome/reason re-attempts
  `persistLocked()` and propagates its exact result — never a bare no-op success. A retry reporting a
  DIFFERENT outcome/reason is rejected outright (`ErrPublishedOutcomeMismatch` /
  `ErrBlockedReasonMismatch`) regardless of whether the recorded fact is durably acknowledged yet: it
  must never be silently overwritten by a different one.

### Terminal Persistence Acknowledgement (V3.1-B Hardening R3.1)

R3's own first implementation of the fail-closed-forward strategy above had a real gap an independent
reviewer found: `BeginOrResume`'s `BLOCKED` case, and (for the identical reason)
`BeginOrResume`'s/`AdmitPublicationPhase`'s `PUBLISHED` cases, re-attempted `persistLocked()`
*opportunistically* — but then **discarded the repair attempt's own result** and reported the terminal
fact as settled regardless. Concretely: `MarkPublished` fails to persist; the grant is fail-closed
`PUBLISHED` in memory only; a resubmission of the identical package calls `BeginOrResume`, which
silently re-attempts (and re-fails) the same write, then returns the `PUBLISHED` snapshot anyway —
`Orchestrate`'s own idempotent-`PUBLISHED` short-circuit then reports success to the caller while the
Store file still shows `IN_PROGRESS`. This is precisely the "in-memory fail-closed fact" being
conflated with "successfully acknowledged Store snapshot" that this round exists to separate: merely
*attempting* `persistLocked()` before returning a terminal snapshot never guaranteed persistence
actually succeeded.

`internal/grant.Store` now owns a runtime-only, NEVER-serialized acknowledgement set, `pending
map[string]struct{}` keyed by `GrantID`. `MarkPublished`/`MarkBlocked` mark a Grant pending the moment
they transition it to `PUBLISHED`/`BLOCKED`; every production `persistLocked()` call site in the
package instead calls `persistLockedAcknowledging()`, which calls `persistLocked()` and, **only on
success**, clears every currently-pending entry — a single successful full-store write always
serializes the FULL, current `byDigest` map, so it necessarily included each still-pending Grant's
exact (unchanged, since the outcome/reason-mismatch rejection above guarantees a pending Grant's
content never silently changes) current content, correctly acknowledging it even when the write that
triggered it was for a completely different Grant. This makes the pending/clean distinction the actual
mechanism, not merely a documented intention:

- `BeginOrResume`'s `BLOCKED`/`PUBLISHED` cases and `AdmitPublicationPhase`'s `PUBLISHED` case now
  check `isPendingLocked` first. If clean, they return the durable result immediately (no wasted
  write). If pending, they re-attempt `persistLockedAcknowledging()` and **propagate that attempt's own
  result** — `ErrBlockPersistFailed`/`ErrPublishPersistFailed` on failure (never the plain
  `ErrBlocked`, and, critically, never a `PUBLISHED` snapshot — a snapshot IS the success signal for
  `AdmitPublicationPhase`, so it must never accompany a failed repair), the durable result only once
  persistence actually succeeds.
- `MarkPublished`/`MarkBlocked` themselves skip an unnecessary rewrite entirely when a retry's outcome
  matches an already-*clean* (not merely already-`PUBLISHED`/`BLOCKED` in memory) Grant.
- `mapGrantError` gained `GRANT_BLOCK_PERSIST_FAILED` and `GRANT_PUBLISH_PERSIST_FAILED` cases for the
  two new sentinels (`ErrBlockPersistFailed`, `ErrPublishPersistFailed`), distinguishing "this terminal
  fact is still pending" from `GRANT_PREVIOUSLY_BLOCKED`/a `PUBLISHED` result, which now mean "durably
  acknowledged" specifically.

Nothing here changes what R3.1's own predecessor rounds already guarantee: the terminal fact itself is
still fail-closed in memory the instant it is decided (never re-attemptable, never silently
overwritten by a different outcome/reason); this round closes only the narrower gap of a *pending*
fact being misreported as *acknowledged*. As with every round in this series, this remains an
in-process, running-Broker-process guarantee — `pending` itself is pure runtime state, never persisted,
and this round adds no `fsync`, directory-entry durability, or cross-process/power-loss consistency
claim.

`RecordRemoteHead` is neither — `RemoteHeadObserved` is a recoverable *cache*, never the authority for
whether a remote effect happened (`Orchestrate` always re-observes the actual remote fresh before
trusting anything). On a `persistLocked()` failure it simply rolls the in-memory cache value back to
what it was before the call, keeping it consistent with disk rather than silently drifting ahead of
it; a failed cache write never changes Grant authorization or the R1/R1.1 exact remote-transition
rules, which are governed entirely by the fresh remote observation.

`internal/server.Orchestrate`'s own error handling was closed to match: every one of its 11
`MarkBlocked` call sites previously discarded the error (`_ = client.MarkBlocked(...)`); all now route
through a `blockGrant` helper that reports the stable `GRANT_BLOCK_PERSIST_FAILED` code (retaining the
originally intended reason in the audit record's detail field, never silently lost) when persistence
itself fails, rather than misreporting the intended reason as though it had been durably recorded.
`mapGrantError` was changed from bare equality (`switch err { case grant.ErrX: ... }`) to `errors.Is`
comparisons so it correctly classifies the new wrapped sentinels — `GRANT_BEGIN_PERSIST_FAILED` and
`GRANT_EXPIRE_PERSIST_FAILED` for `BeginOrResume`'s own (rolled-back) transition failures — as
distinct, retryable codes, deliberately never reported as the terminal-sounding `GRANT_EXPIRED` when
the grant was in fact rolled back to `AUTHORIZED`. `MarkPublished`'s two call sites similarly
distinguish a genuine outcome mismatch (`GRANT_PUBLISH_OUTCOME_MISMATCH` — structurally unreachable in
normal operation given the per-Grant phase gate already serializes Phase B, but never folded into the
generic persistence-failure code if it were ever reached) from an actual persistence failure
(`GRANT_PUBLISH_PERSIST_FAILED`).

No new field was added to the `Grant` struct or its JSON persistence shape — no pending/dirty marker
of any kind is ever serialized; every guarantee above is achieved purely through what is mutated,
rolled back, or re-attempted in memory before `persistLocked()` is called. As with R2.1, this closes
the class of defect only for a running Broker process observing a *detectable* persistence error (a
full disk, a permission error, an unwritable path) — it does not add `fsync`, directory-entry
durability, or crash/power-loss consistency guarantees, which remain explicit V3.1-C concerns.

### Terminal Pending Truth Across All API Surfaces (V3.1-B Hardening R3.1.1)

R3.1 itself had a real gap: it closed the pending/clean distinction for `BeginOrResume`'s
`PUBLISHED`/`BLOCKED` cases and `AdmitPublicationPhase`'s `PUBLISHED` case, but missed two remaining
surfaces that can also observe a terminal state — `AdmitPublicationPhase`'s own `BLOCKED` case, and
`AdminHandle.Revoke`'s `PUBLISHED`/`BLOCKED` refusal cases. Concretely: a pending `BLOCKED` grant
(its `MarkBlocked` persistence still failing) would be denied phase admission with the plain
`ErrBlocked` — which, since R3.1, specifically means "durably acknowledged" — silently conflating
pending with clean; `Revoke` would similarly report `ErrCannotRevokeBlocked`/`ErrCannotRevokePublished`
(and the admin socket `GRANT_PREVIOUSLY_BLOCKED`/`GRANT_ALREADY_PUBLISHED`) for a still-pending
terminal fact, concealing that the Store's own acknowledgement of it was still failing.

Both are now closed with the identical bounded-local-repair pattern R3.1 already established
elsewhere — no remote I/O, always under the phase gate and a brief `Store.mu` hold:

- `AdmitPublicationPhase`'s `BLOCKED` case: if pending, re-attempts `persistLockedAcknowledging()`
  and propagates its own result. On failure: no gate, no snapshot, the distinct
  `ErrBlockPersistFailed` — never plain `ErrBlocked`. On success (or if already clean): plain
  `ErrBlocked`, no gate, no snapshot (admission is still denied either way — `BLOCKED` never grants
  remote-effect authority regardless of pending/clean status).
- `AdminHandle.Revoke`'s `PUBLISHED`/`BLOCKED` cases: if pending, re-attempts and propagates the
  repair's own result — `ErrPublishPersistFailed`/`ErrBlockPersistFailed` on failure, never the
  terminal-refusal sentinels. On success (or if already clean): the terminal-refusal sentinel
  (`ErrCannotRevokePublished`/`ErrCannotRevokeBlocked`) is returned as before — repairing the
  Store's acknowledgement never turns into a successful revocation; the remote effect (for
  `PUBLISHED`) or the terminal decision (for `BLOCKED`) is denied either way, only the CONCEALMENT of
  a still-failing acknowledgement behind that (also-true) refusal is what this round closes.
- The admin listener's `adminRevokeErrorCode` gained `ErrPublishPersistFailed` →
  `GRANT_PUBLISH_PERSIST_FAILED` and `ErrBlockPersistFailed` → `GRANT_BLOCK_PERSIST_FAILED` cases,
  checked before the terminal-refusal cases, so a pending terminal state is never reported to an
  admin operator as `GRANT_ALREADY_PUBLISHED`/`GRANT_PREVIOUSLY_BLOCKED`/the generic
  `GRANT_REVOKE_FAILED` catch-all.

No new field, no redesign of `Store.pending` or `persistLockedAcknowledging()` — this round is purely
about applying R3.1's already-established mechanism to the two surfaces it missed.

### Linearizable Block Transitions (V3.1-B Hardening R3.2)

Every prior round closed a race by linearizing *admission* (`AdmitPublicationPhase`) against `Revoke`
on the same per-Grant `PhaseGate` -- but `ClientHandle.MarkBlocked` itself never competed for that
gate at all. Confirmed defect, reproduced against a real local git repo/bare remote before any fix:
Request A calls `AdmitPublicationPhase` and is admitted (holds the gate, proceeding toward a push);
Request B, for the identical request digest, independently calls `MarkBlocked` directly (not through
the gate) while A's phase is still in flight -- B's call completed immediately, concurrently with A
still holding the gate, and A's real local push then still succeeded AFTER the Grant had already
become `BLOCKED`.

**`Revoke`, `MarkBlocked`, Phase A, and Phase B now all compete on the SAME per-Grant phase gate.**
Two mechanically distinct entry points exist, both sharing one transition state machine
(`markBlockedCore`) so the two never diverge:

- **`ClientHandle.MarkBlocked`** (outside any admitted phase -- every block call site reached before
  Phase A is ever entered) acquires the Grant's phase gate itself, exactly like `AdmitPublicationPhase`
  and `Revoke` already do, then applies the transition, then releases.
- **`ClientHandle.MarkBlockedInPhase`** (inside an already-admitted phase -- Phase A's push-decision-
  table failures, Phase B's PR-outcome failures) uses the caller's OWN already-held `*PhaseGate`
  directly, never re-acquiring the underlying per-Grant mutex (which is not reentrant and would
  deadlock). The supplied lease's `Store`/`GrantID` identity is mechanically validated -- never a
  caller assertion -- against the exact values it was acquired for (`PhaseGate.leaseFor`), and,
  separately, a fresh liveness recheck plus the actual mutation happen inside the same `operationMu`
  critical section `PhaseGate.Release()` itself uses, which is what makes "`Release()` versus a
  gate-bound mutation on the same lease" linearizable:
  whichever wins acquiring `operationMu` first either completes its mutation entirely before the
  underlying mutex is ever physically unlocked, or observes the lease as already released and mutates
  nothing.

**Valid partial-effect orderings are explicit, not accidental.** A block that wins BEFORE Phase A is
admitted correctly denies that admission (zero token mint, zero push). A block that wins in the
released gap BETWEEN Phase A and Phase B is also legitimate: the branch push from Phase A has already
genuinely happened (this round never undoes a completed remote effect) and remains at the pushed
commit, but the block prevents Phase B's PR mutation from ever beginning. A phase that wins first
(publication completes, `PUBLISHED` is recorded before the gate releases) can never be overwritten by
a later block attempt -- `markBlockedCore`'s own `StatePublished` case refuses exactly like `Revoke`'s
does (pending-aware: a still-pending `PUBLISHED` is reported as `ErrPublishPersistFailed`, never
silently converged on `ErrCannotBlockPublished`, until the Store acknowledgement actually succeeds).
`internal/server.Orchestrate`'s own `blockGrantResult` additionally converges an OUTSIDE-phase block
attempt that loses to an already-completed `PUBLISHED` onto the REAL, exact `PUBLISHED` `Result`
(`GrantID`/`CommitSHA`/`RemoteHead`/`PRNumber`) rather than ever reporting a misleading terminal block.

**Lock order, unchanged and still enforced:** per-Grant phase gate (or an already-held lease) first,
then `Store.mu` briefly for the in-memory read/write/persist attempt, then release -- `Store.mu` is
never held across Git/HTTP/token-mint/package-import/PR-API activity; only the phase gate itself may
and must span that admitted remote-effect I/O.

**This remains an in-process, single-Broker-process guarantee**, exactly like every round in this
series: no cross-process fencing, no `fsync`/directory-entry durability, no power-loss consistency, and
`go test -race` demonstrates the absence of a *data race* in this process, not cross-process or
crash-time correctness.

## Independent Commit/Tree Verification

Before any GitHub **write** token is ever minted, `internal/verifier.VerifyCommit` independently
re-derives every remote-effect-critical fact from the Broker's own imported Git object graph — it
never trusts the Envelope, the Receipt, or the package manifest's own claims about them:

- Envelope/Receipt cross-checks: protocol versions, repository identity, branch, `base_commit`,
  `receipt.status == COMMITTED`, `local_head == commit_sha`, `pre_publish_head ==
  expected_pre_publish_head`, `receipt.fingerprint == envelope.publication_fingerprint`.
- Git object checks: the imported commit's SHA matches the Receipt exactly; it has **exactly one**
  parent, equal to `pre_publish_head` (a merge commit is never authorized); `base_commit` is a real
  ancestor (`git merge-base --is-ancestor`); `branch` is never `main`/`master` and never equals
  `base_branch`; the commit message equals the Envelope's `commit_message` exactly.
- Changed paths: `git diff-tree --no-renames` between `pre_publish_head` and `commit_sha` must equal
  the Envelope's `allowed_files` set **exactly** — an extra changed path, a missing declared path, or
  an action disagreeing with the observed status (`A`/`M` vs `present`, `D` vs `deletion`) all BLOCK;
  any other change type (`T` — a symlink/gitlink/tree substitution at an existing path) is rejected
  outright regardless of declared action.
- Fingerprint: the exact V3.1-A canonical recipe (true UTF-8 byte-order sort via `bytes.Compare`,
  `path \0 digest \n` framing, SHA-256) is recomputed **directly from the imported commit tree** —
  PRESENT uses the actual commit-tree blob SHA (rejecting anything that isn't a plain regular-file
  blob, mode `100644`/`100755`), DELETION requires the path be entirely absent and uses the literal
  digest `ABSENT`. This is required to exactly equal `envelope.publication_fingerprint`. The Broker
  never trusts the Local Builder's or the Envelope's own fingerprint claim as the binding proof — this
  recomputation, from bytes the Broker itself imported and inspected, is.

## GitHub App Credential / Token Model

Production design targets a **private GitHub App** — never a Personal Access Token, never
`devSerdar`/`mihvernetwork` user credentials, never `gh auth token`, never a long-lived installation
token. The App's private key is stored **outside** this repository and **outside** the development
user's home, readable only by the Broker's own OS identity (`internal/config.Config.Validate`
fail-closes on a key path inside either, a symlinked key, a missing key, or a group/world-readable
key). `internal/githubapp.MintAppJWT` builds and RS256-signs a fresh App JWT (stdlib `crypto/rsa`
only) each time; `TokenMinter.Mint` exchanges it for an installation access token scoped to **exactly
one repository** and **exactly** the requested permission set — production only ever requests
`{contents: write, pull_requests: write}` (`TargetPermissions`) for the actual push/PR step, and
`{contents: read, pull_requests: read}` (`ReadOnlyPermissions`) for the earlier remote-verification
read (minted as late as possible, only after local/grant/package verification already succeeded).
Never requested: Administration, Actions, Workflows, Secrets, Members, or repository-rules
administration.

Installation tokens are treated as **opaque** (`githubapp.Token` never assumes a fixed length or a
`ghs_` prefix): the type's `String()`/`GoString()`/`MarshalJSON()` all redact, so an accidental
`%v`/log line/JSON response can never leak the raw value; `Raw()` — the only way to extract it — is
called only at the one legitimate site (`internal/gitremote`'s askpass handoff). Tokens are
memory-only: never persisted, never logged, never written into the audit log (which categorically
rejects `Extra` keys shaped like a secret field name), never included in `server.Result`.

## Git Authentication (Section 11)

The token never appears in the remote URL, in any `argv`, or in any log/persisted config.
`internal/gitremote.BuildGitHubRemoteURL` constructs `https://x-access-token@github.com/OWNER/NAME.git`
from **validated owner/repo fields only** — the fixed username is a public GitHub convention, not a
secret, and a package-supplied remote URL is never trusted or used. The actual token is handed to
`git` via a fresh, per-push `GIT_ASKPASS` script (static, secret-free content) that reads the token
from a process environment variable (`MIHVER_BROKER_GIT_ASKPASS_TOKEN`) set only for that one
`exec.Command` invocation — never written to disk, never appearing in the script file itself. Every
push/`ls-remote` invocation additionally passes `-c credential.helper=` (disables any inherited
credential helper) and runs under `internal/gitexec`'s sterile environment (`GIT_TERMINAL_PROMPT=0`,
fixed minimal `PATH`, broker-owned scratch `HOME`, no SSH transport).

## Remote Branch Safety / Idempotency (Sections 12–13)

`internal/gitremote.ValidateTargetBranch` categorically rejects `main`, `master`, a branch equal to
`base_branch`, anything shaped like a ref path (`refs/...`) rather than a plain name, anything
starting with `-` (argument-injection guard), and anything containing `..`.

**No unconditional force or history-rewrite push exists anywhere in this module.** `Client.Push`
updates the remote as an atomic compare-and-swap (V3.1-B Hardening R1.1) using exactly one explicit,
exact-OID `--force-with-lease=refs/heads/<branch>:<expect>` argument — never a bare `--force`/`-f`,
never a `+`-prefixed refspec, never an implicit (value-less) `--force-with-lease`, never a lease
derived from a remote-tracking ref, never a wildcard, and never more than one lease argument. The
lease is solely an atomic compare-and-swap for an already-verified one-child transition — it can only
ever succeed when the remote's current value already equals the exact `expectedHead` `Push` was
given (the literal empty string for a not-yet-existing branch), i.e. exactly the same authorization
`Push` already required before it issues the update; it authorizes nothing a non-force push wouldn't
also have authorized, it only makes that authorization's enforcement atomic with the write itself,
closing the gap where an ordinary non-force push separately (a) reads the remote, then (b) issues the
push, and a remote mutation landing in between those two steps could otherwise still succeed as a
valid fast-forward from wherever the remote had moved to. Lease rejection is classified without
trusting stderr text: `Push` re-observes the remote fresh after a failed lease and distinguishes
three outcomes, in order: (1) the fresh observation already equals `commitSHA` — the update actually
landed server-side despite the client reporting an error (e.g. a dropped connection after the atomic
compare-and-swap already applied); this is reported as a genuine success, never as
`ErrRemoteHeadChanged` or a generic failure — misreporting an already-successful publish as a race
would permanently `BLOCK` a grant whose authorized commit was actually published; (2) the fresh
observation disagrees with `expectedHead` — the lease was genuinely rejected because the remote
changed, reported as `ErrRemoteHeadChanged`; (3) otherwise (the remote still matches `expectedHead`,
or cannot be read at all) — some other push failure, failed closed as a generic, non-lease push error
rather than guessing. After a successful push, the remote head is re-read and required to exactly
equal the pushed commit. See `internal/gitremote/gitremote_test.go` for adversarial coverage of both
a non-fast-forward race
(retargeting the fake remote's ref directly between two `Push` calls) and the narrower intra-call
atomicity race the lease exists to close (mutating the remote via a deterministic race seam at the
exact boundary between `Push`'s internal pre-check and the real `git push` subprocess).

**A non-force fast-forward is necessary but not sufficient authorization** (V3.1-B Hardening R1).
`Client.Push`'s "matches the caller's expectation" check is only as strong as *what the caller passes
as that expectation* — `internal/server.Orchestrate` is what binds it to something actually
authorized, via an exact remote-transition decision table applied to the freshly-observed remote
head (`observedNow`) after package import, independent commit verification, and branch-name
validation:

```text
observedNow == receipt.commit_sha                                    -> already published (idempotent
                                                                         resume; no push, no
                                                                         write-capable token minted)
observedNow == envelope.expected_pre_publish_head (non-empty)         -> existing branch may advance;
                                                                         Push's expected head is bound
                                                                         to expected_pre_publish_head
                                                                         itself, never to observedNow
observedNow == "" AND expected_pre_publish_head == base_commit        -> absent branch may be created;
                                                                         Push's expected head is ""
                                                                         (any other absent-branch case,
                                                                         where an unpublished
                                                                         intermediate commit would
                                                                         exist between what was
                                                                         authorized and commit_sha,
                                                                         falls through to the row below)
every other observed state (older ancestor, unexpected descendant,    -> fail closed: BLOCKED /
divergent commit, absent with expected_pre_publish_head !=               REMOTE_HEAD_CHANGED; zero
base_commit, moved by another actor, ...)                                Git write attempts; zero
                                                                           write-capable token mints;
                                                                           grant transitions to
                                                                           terminal BLOCKED
```

Before this decision table existed, `Orchestrate` passed the raw `observedNow` value straight through
to `Push` as its own expectation — a non-force push of `receipt.commit_sha` is a valid git
fast-forward from *any* ancestor of it, not only from `expected_pre_publish_head`, so a remote
sitting at an older, unreviewed commit (e.g. `A` in a real `A → B → C` chain where the Envelope only
ever authorized the `B → C` transition) could still receive a successful push carrying the unreviewed
intermediate commit `B` along with `C`. `internal/server/orchestrate_remote_transition_test.go`'s
`TestOrchestrate_ExistingBranchAtUnauthorizedAncestor_Blocked` is the regression test for exactly this
scenario, alongside five further tests covering the absent-branch multi-commit case, safe
new-branch/existing-branch transitions, idempotent already-published retries, and cross-call drift
detection after a partial success.

### Atomic Remote Compare-and-Swap (V3.1-B Hardening R1.1)

The decision table above closes the *orchestration-level* gap (never authorizing a push from an
unauthorized starting point). A narrower gap remained purely inside `Client.Push` itself: an ordinary
non-force push necessarily performs its "does the remote match what I expect" check and the actual
`git push` subprocess as **two separate steps**, and a remote mutation landing in the gap between
them — even though `Push`'s own pre-check had already correctly observed the authorized predecessor —
could still let an ordinary fast-forward push succeed from wherever the remote had moved to in the
meantime. `Client.Push` closes this with one exact, explicit `--force-with-lease=refs/heads/<branch>:
<expect>` argument per push: `<expect>` is exactly the same `expectedHead` value `Push`'s own
pre-check already required (the literal empty string when the branch must not yet exist), so the
lease authorizes nothing beyond what the surrounding non-force semantics already authorized — it only
makes the remote's compare-and-swap atomic with the write itself, evaluated server-side as a single
operation rather than client-side beforehand. **No unconditional force, `+`-refspec, implicit lease,
wildcard lease, or multi-ref lease exists anywhere in this module** — every such shape is explicitly
tested against in `internal/gitremote/gitremote_test.go`'s `TestPush_ArgvUsesOnlyExactExplicitLease`.
`internal/gitremote/gitremote_test.go`'s `TestPush_AtomicLeaseBlocksAncestorRewindBetweenCheckAndPush`
and `TestPush_AtomicLeaseBlocksConcurrentNewBranchCreation` deterministically reproduce the exact
intra-call race this closes, using a test-only `RaceInjectingRunner` (`internal/testutil`) that
mutates a real disposable local bare remote at the exact boundary between `Push`'s internal pre-check
and the real `git push` subprocess it is about to issue — never a sleep, never simulated timing, and
the real `git push` subprocess still always actually executes. Both tests were independently confirmed
to fail against the prior plain-push implementation before the lease was added, and
`internal/server/orchestrate_remote_transition_test.go`'s `TestOrchestrate_AtomicLeaseRaceMapsToTerminalBlock`
confirms the same race, exercised through the full `Orchestrate` flow, maps to a terminal
`BLOCKED`/`REMOTE_HEAD_CHANGED` grant state with zero PR API calls made.

## PR Behavior (Section 14)

When `pr_expected == false`, the Broker makes **zero** PR API calls — not create, not update, not
even a search (`internal/server/orchestrate_test.go`'s
`TestOrchestrate_PRExpectedFalseMakesZeroPRCalls` asserts this against an instrumented fake server).
When `pr_expected == true`: search **only** for open PRs with the exact head branch
(`internal/githubapp.PRClient.FindOpenByHead`); zero matches creates one with the Envelope's exact
`branch`/`base_branch`/`pr_title`/`pr_body`; exactly one match deterministically converges its
title/body (never its head, base, or state) to those exact values; more than one match is
`BLOCKED / AMBIGUOUS_PR`. After create/update, the Broker independently verifies the resulting PR's
head branch, head SHA (must equal the just-pushed remote head), and base all agree with what was
authorized — any disagreement is `BLOCKED / PR_STATE_MISMATCH`. **`PRClient` has no `Merge`, `Close`,
or `Approve` method** — there is no capability to remove, since the type simply doesn't expose one.

## macOS Privilege/Deployment Design (Section 16 — NOT PROVISIONED by this task)

Production deployment target on this Mac:

- a separate, dedicated, non-interactive-login OS identity owns the Broker process, its home/state
  directory, and the compiled binary — installed **outside** this repository (e.g. under
  `/Library/Application Support/Mihver/...`), so the development user cannot modify the binary,
  config, private key, or state;
- the private key is readable only by that identity;
- the unprivileged client socket (`/var/run/mihver-broker.sock`) is reachable by the development
  user; the privileged admin socket (`/var/run/mihver-broker-admin.sock`) is **not**;
- the service starts via a human-installed macOS LaunchDaemon (or equivalent) — not this task, and
  not any automated path;
- the production `git` executable path is explicit and non-model-writable (`/usr/bin/git` or an
  equivalent the Broker identity, not the development user, controls).

This task deliberately did **not** run `sudo`, `dscl`, `sysadminctl`, `launchctl bootstrap/load`,
`chown`/`chmod` on any privileged path, `security import`, GitHub App creation, or any private-key
download — see "Security Stop Conditions" in the originating task prompt, none of which were reached.

## GitHub Main-Ruleset Design (Section 15 — NOT APPLIED by this task)

Recommended ruleset target for `main`, to be applied by a human in V3.1-C (never by this task, and
never via an automated GitHub Administration API call):

- Require a pull request before merging.
- Block force pushes.
- Restrict deletions.
- Require linear history (compatible with the repository's existing squash-merge policy).
- Restrict direct updates to `main`.
- **The Publication GitHub App must never be granted ruleset-bypass authority** — it can push a task
  branch and open/update a PR, and nothing else; it must never be able to update `main` directly, and
  the ruleset's bypass list must exclude it explicitly.
- The intended sole human merge identity is `mihvernetwork` — the ruleset's bypass/merge-permission
  configuration should name that identity (or the appropriate team/role holding it), never the
  Publication App, as the actor permitted to complete a PR merge into `main`.

## Audit Model (Section 17)

`internal/audit.Log` is a broker-owned, append-only, hash-chained JSONL log:
`entry_hash = sha256(prev_hash || canonical_entry_bytes)`, where `canonical_entry_bytes` excludes
`entry_hash` itself. `Verify` re-derives the whole chain and reports the first entry where either the
`prev_hash` linkage or the `entry_hash` recomputation disagrees — `internal/audit/audit_test.go`
proves a single tampered historical entry (content changed, hashes left as originally written) is
detected. Logged fields are exactly the non-secret operational facts Section 17 lists (timestamp,
request digest, grant id, repository, branch, base, commit SHA, state transition, remote head, PR
number, BLOCKED reason); `Append` additionally rejects any `Extra` key shaped like a secret field
name as defense in depth. **This is tamper-evident, not tamper-proof against a fully compromised
Broker process** — a compromised process could fabricate a consistent chain from scratch. No stronger
claim is made anywhere in this module.

### Concurrent Append Serialization (V3.1-B Closeout Pack A)

`ClientListener` and `AdminListener` serve connections concurrently and can share one `*audit.Log`.
Before this round, `Log` had no internal synchronization at all — concurrent `Append` calls could read
the same stale `lastHash`, produce two entries both claiming the same `prev_hash`, and interleave file
writes, despite this package's doc comment claiming the Broker "serializes all audit writes through one
in-process Log instance." That claim was aspirational, not enforced. `Log` now owns a `sync.Mutex`
(`mu`) held across the ENTIRE `Append` operation — forbidden-field validation, timestamp defaulting,
`PrevHash` assignment, hash computation, JSON encoding, the file open+write, and the `lastHash` update —
so a failed write (confirmed with a real filesystem failure, not simulated) never advances `lastHash`;
a later successful `Append` still chains correctly from the last entry whose `os.File.Write` call
actually succeeded (not `fsync`-confirmed durable against a crash/power loss — see below).
Different `*Log` instances (different `Open()` calls) remain fully independent — the mutex is a field on
`Log`, never a package-level global. This is still only in-process serialization: it does not, and does
not claim to, provide multi-process safety, `fsync`, WORM storage, or tamper-proof (vs. tamper-evident)
history.

## Runtime Path Trust (V3.1-B Closeout Pack A)

`internal/config.Config.Validate()` (production mode) previously validated only `PrivateKeyPath`
(containment outside the repository/dev-home, non-symlinked, not group/world-readable) and checked
`BrokerBinaryPath`/`BrokerConfigPath` for group/world-writability, with no containment check on either.
There was no validation at all of the grant store path, audit log path, client/admin socket paths, or
the Git binary path — `cmd/mihver-broker/main.go` opened `grant.Open`/`audit.Open` and started listening
on the configured sockets before any trust-root check on those locations. A production deployment (or,
more importantly, a model-writable-side actor with write access to the repository or dev home) could
otherwise place the grant store or audit log inside the model-writable repository or the development
user's home — collapsing the privilege boundary even with the private-key check correctly enforced,
since write access to `grants.json`/the audit JSONL could forge authorization or corrupt audit history
directly.

Five new `Config` fields — `GrantStorePath`, `AuditLogPath`, `ClientSocketPath`, `AdminSocketPath`,
`GitBinaryPath` — are now validated in production, reusing the same `RepositoryModelWritableRoot`/
`DevelopmentUserHome` trust roots and the same symlink-resolved-real-path containment technique the
private-key check already established: absolute-path required; real parent directory resolved via
`filepath.EvalSymlinks` and checked against both trust roots; an existing grant-store/audit-log file
must not itself be a symlink and must not be group/world-writable; client and admin socket paths must be
distinct and their real parent directories must not be inside either trust root; the Git binary must
exist, be a regular non-symlinked executable file, not be group/world-writable, and not resolve inside
either trust root. `BrokerBinaryPath`'s existing check was extended with the same symlink+containment
rules (previously writability-only), populated from `os.Executable()` — an authoritative process-derived
value, never a request- or flag-supplied one. All of this runs in `main.go`'s `run()` before
`grant.Open`, `audit.Open`, private-key loading, socket `ServeSocket`, or any token mint. This task does
not provision OS-level ownership/ACLs — path validation is a fail-closed check on locations, not a
substitute for the OS-identity boundary `PUBLICATION_BROKER.md`'s deployment design still requires.

## Production PR Client Composition (V3.1-B Closeout Pack A)

`cmd/mihver-broker/main.go`'s production `Deps.PRClientFactory` previously constructed a
`githubapp.PRClient{APIBaseURL: ..., Token: token}` with `Owner`/`Repo` left unset — every real PR
request would have targeted `/repos///pulls`, silently broken; test wiring never caught this because
every test factory already supplied `Owner`/`Repo` explicitly. `PRClientFactory`'s type is now
`func(token githubapp.Token, owner, repo string) githubapp.PRClient`; `runPRFinalizationPhase` (Phase B)
passes the trusted, already-validated `req.Envelope.Repository.Owner`/`.Name` — never a value derived
from an untrusted PR API response. Separately, `internal/githubapp.PRClient`'s path construction
(`FindOpenByHead`/`Create`/`UpdateTitleBody`) built its `/repos/<owner>/<repo>/...` URLs via bare
`fmt.Sprintf("%s", ...)` with no escaping; since `internal/protocol` only requires `Repository.Owner`/
`.Name` to be non-empty (no character-set restriction), an Owner/Repo/branch value containing `/` could
have injected extra path segments. Every Owner/Repo path component is now `url.PathEscape`d and the
`head=owner:branch` search-query value is built from individually `url.QueryEscape`d parts joined by a
literal `%3A` separator — a value containing `/` is confined to its own escaped path/query component,
never split into an extra URL segment or field. This closes the path/query-injection risk; it does not
by itself make an Owner or branch value containing a literal `:` unambiguous at the application level
(a percent-encoded colon inside an escaped Owner/branch is indistinguishable, after decoding, from the
`owner:branch` separator itself) — real GitHub owner/repo names cannot contain `:` in practice, so this
is a defense-in-depth boundary against URL structure injection, not a claim of semantic disambiguation
for an adversarial colon-containing value.

## Wire and Component Size Limits (V3.1-B Closeout Pack A)

`ClientListener.handleConn` previously decoded an unbounded `packageWireRequest` JSON object straight
off the socket — any caller reaching the unprivileged client socket could force unbounded memory
allocation before any schema/Git verification ever ran. Five documented constants now bound every
layer: `MaxEnvelopeBytes`/`MaxReceiptBytes`/`MaxManifestBytes` (1 MiB each, decoded),
`MaxBundleBytes` (64 MiB, decoded), `MaxWireBytes` (96 MiB, raw wire bytes — sized to clear base64's
~4/3 expansion of the 66 MiB of decoded content the four component limits allow, plus JSON overhead).
`decodeWireRequest` bounds the raw bytes read via a `countingReader` beneath `io.LimitReader(r,
MaxWireBytes+1)` (the `+1` distinguishes "exactly at the limit" from "one byte over"), then checks for
trailing content via `json.Decoder.Buffered()` — deliberately never `Decoder.More()`, which can issue a
further blocking read on a still-open, non-EOF-terminated connection: the client/server wire protocol is
one request followed by one response over the SAME connection, and the real client
(`cmd/mihver-publish`) never half-closes after sending, so a `More()`-based check would block a
legitimate request until the connection's own multi-minute deadline. `Buffered()` only inspects bytes
the decoder already pulled off the wire while parsing the one object, never triggering further I/O --
this is a best-effort check, not an absolute one: it catches trailing content the caller sent in the
same write/kernel-buffered burst as the JSON object (already present by the time the decoder finishes),
but a value that arrives on a later, separate write is never observed, since the server never reads the
connection again after acting on the first decoded object -- that second value is simply left unread and
discarded when the connection closes, never processed as part of any request. The trade-off is
deliberate: catching every conceivable trailing-data timing would require exactly the kind of blocking
read this design exists to avoid.
`decodePackageComponents` then base64-decodes and independently size-checks each of the four fields, in
a fixed order (envelope → receipt → bundle → manifest), short-circuiting on the first violation; no
`Deps` field (`Grants`/`Audit`/`TokenMinter`/`GitRemote`/`PRClientFactory`) and no `Orchestrate` call is
ever reached after a size rejection. Stable wire codes: `WIRE_REQUEST_TOO_LARGE`,
`ENVELOPE_TOO_LARGE`/`RECEIPT_TOO_LARGE`/`BUNDLE_TOO_LARGE`/`MANIFEST_TOO_LARGE`,
`MALFORMED_WIRE_REQUEST`, `MALFORMED_BASE64` — never the rejected payload itself. `decodeWireRequest`
takes an `io.Reader`, not `net.Conn` specifically (a behavior-preserving signature narrowing), which is
what lets its own boundary tests call it directly, in-process, against an in-memory buffer rather than a
real live socket — real end-to-end transfer of 64–96 MiB payloads under `go test -race` was measured to
take several minutes to over eight minutes purely from `-race`'s per-read instrumentation overhead on a
live, concurrently-drained socket (confirmed via direct comparison against an in-memory decode of the
identical bytes, which completes in single-digit seconds under the same `-race` build) — an artifact of
the test harness under race instrumentation, not of the size-gate logic itself, and calling the two pure
functions directly removes it while still exercising the exact same production code byte-for-byte.

## Manifest Cross-Validation (V3.1-B Closeout Pack A)

`PackageManifest`'s `EnvelopeDigest`/`ReceiptDigest`/`BundleDigest`/`CommitSHA` fields were previously
only checked for the right SHAPE (64-hex, 64-hex, 64-hex, 40-hex respectively) — `ParseRequest` never
proved these claimed digests actually matched the real bytes of the envelope/receipt/bundle that arrived
alongside the manifest, or that `manifest.CommitSHA` matched `receipt.CommitSHA`. `ParseRequest` now
verifies, using the RAW bytes it was given (never a re-marshaled/re-encoded copy):
`sha256(envelopeBytes)`/`sha256(receiptBytes)`/`sha256(bundleBytes)` hex-equal the manifest's claimed
digests, and `manifest.CommitSHA == receipt.CommitSHA`. Four new wrapped sentinel errors
(`ErrManifestEnvelopeDigestMismatch`/`ErrManifestReceiptDigestMismatch`/`ErrManifestBundleDigestMismatch`/
`ErrManifestCommitMismatch`, `errors.Is`-compatible) are returned before `ParseRequest` ever returns a
usable `*Request` — since `Orchestrate` already calls `ParseRequest` as its first step, no package
import, Git verification, token mint, or Grant mutation can ever follow a manifest mismatch. The
REQUEST DIGEST recipe (`ComputeRequestDigest`/`Request.RequestDigest()`) is completely unchanged by this
check — it remains byte-exact over the same four artifacts, independent of this new content-binding
validation layered on top of it.

## Canonical Repository Identity (V3.1-B Closeout Pack A.1)

`internal/protocol.Repository{RemoteName, Owner, Name}` previously required only non-empty strings.
The Git remote URL (`internal/gitremote.BuildGitHubRemoteURL`) was then built by raw string
concatenation, and `internal/githubapp.PRClient`'s REST paths were built the same way (with
percent-escaping added in an earlier round, but no validation that the *value itself* was a
sensible identity). A real local TLS Git endpoint demonstrated that `owner =
"expected/../../other-owner"`, `repo = "target"` could produce a normalized request path targeting
`/other-owner/target.git` instead of the authorized repository — the authorized identity and the
actual effect target could differ even though every individual field was syntactically "non-empty."

A new `internal/repoidentity` package is now the single, versioned, shared validator for owner,
repository name, and `remote_name`, used by `internal/protocol`'s `Envelope`/`Receipt` validation,
`internal/gitremote.BuildGitHubRemoteURL`, and `internal/githubapp.PRClient`. It deliberately
implements a conservative SUBSET of GitHub's actual naming rules — see the package's own doc comment
for the exact accepted grammar (owner: 1-39 ASCII alphanumeric-or-hyphen characters, alphanumeric
start/end, no consecutive hyphens; repository name: 1-100 ASCII alphanumeric/`.`/`_`/`-` characters,
never `.`/`..`/all-dots) — false rejection of an unusual-but-legal GitHub name is accepted as the
cost of guarding a privileged code path; false acceptance is not. `Envelope.Validate()`/
`Receipt.Validate()` now reject an invalid owner/name/remote_name before `ParseRequest` ever returns
a usable `*Request` — since `Orchestrate` calls `ParseRequest` first, no grant lookup, token mint,
Git execution, or PR HTTP request can ever proceed using an invalid identity.
`BuildGitHubRemoteURL(host, owner, repo string) (string, error)` and `PRClient`'s three methods
(`FindOpenByHead`/`Create`/`UpdateTitleBody`) each independently re-validate via
`repoidentity.Validate` before doing anything else — defense in depth, never trusting that an
upstream caller already validated. `schemas/dev/publication-envelope.schema.json` and
`publication-receipt.schema.json` mirror the same character-class/length constraints via JSON Schema
`pattern`/`maxLength`.

## Runtime Path Disjointness and Safe Socket Handling (V3.1-B Closeout Pack A.1)

The prior round's runtime-path validation (containment of the grant store, audit log, both sockets,
and the Git binary outside the repository/dev-home trust roots) did not check that these paths were
DISTINCT from each other or from the private key/Broker binary — a misconfiguration could point two
of them at the same real location (directly, or via a symlinked parent, or via a hardlink) without
being caught. `internal/config.validateRuntimePathDisjointness` now builds a canonical
(symlink-resolved-real-parent + basename) record for each of: the private key, grant store, audit
log, client socket, admin socket, Git binary, Broker binary, and Broker config (when set), and checks
every pair for either a matching canonical location or (where both candidates currently exist)
`os.SameFile` hardlink aliasing. `BrokerBinaryPath` is now REQUIRED in production (previously
optional/silently-skipped-when-empty) — `os.Executable()` failing at Broker startup is now fatal in
production (`cmd/mihver-broker/main.go`'s `resolveBrokerBinaryPath`), and the resolved path is
validated with the same regular-file/non-symlink/executable/not-group-world-writable/outside-trust-
roots battery `GitBinaryPath` already used.

Separately, `ClientListener.ServeSocket`/`AdminListener.ServeSocket` previously did an unconditional
`os.Remove(path)` before `net.Listen`, with no proof the node at that path was actually a stale Unix
socket — a misconfigured or aliased path could have silently deleted an unrelated file. A new
`internal/server/socket_safety.go` (`safeRemoveStaleSocket`) `Lstat`s the path first: absent or a
genuine Unix socket (`ModeSocket`) is removed; a regular file, directory, symlink, FIFO, or device is
rejected outright and left completely untouched, `os.Remove` never called. This check runs
immediately before `net.Listen`, at the point of use — not only once during `Config.Validate()` at
startup — narrowing, but not eliminating, a validate-to-use TOCTOU race; full elimination requires
the dedicated OS identity and trusted-directory ownership V3.1-C provisions, not this source-level
task.

## Length-Prefixed Wire Protocol (V3.1-B Closeout Pack A.1)

The prior round's trailing-content check (`json.Decoder.Buffered()`, replacing an earlier, actively
unsafe `Decoder.More()`) only ever inspected bytes the decoder had ALREADY pulled off the wire while
parsing the first JSON value — a second value arriving on a later, separate write was never detected
at all, so the design never actually proved "exactly one top-level JSON value," only "nothing else
was already buffered at check time." The client socket now uses one explicit length-prefixed frame
per connection: an 8-byte unsigned big-endian payload length, followed by exactly that many JSON
bytes. `decodeWireRequest` reads the header via `io.ReadFull`; a zero or otherwise-unreadable header
is `MALFORMED_FRAME`; a declared length over `MaxWireBytes` is rejected as `WIRE_REQUEST_TOO_LARGE`
from the header ALONE, strictly before any payload buffer of that size is ever allocated; the
payload is then read in full and strict-decoded (`DisallowUnknownFields`) from a finite, fully
in-memory `bytes.Reader` — a second `Decode` call against that same exhausted in-memory reader can
never perform further I/O and therefore can never block, so it deterministically returns `io.EOF` for
a well-formed single-object frame and anything else (a second value, or trailing garbage still
within the declared frame length) is `MALFORMED_WIRE_REQUEST`. Exactly one frame is read and
processed per connection; bytes a client sends after its one declared frame are never read at all —
not "accepted trailing JSON," simply outside the frame. `cmd/mihver-publish`'s `submit` writes the
same frame format before waiting for the response; neither side depends on a half-close or connection
EOF anywhere in this design. Separately, `decodePackageComponents` now bounds each of the four
components' ENCODED length via `minPossibleDecodedLen` (the smallest decoded length any base64 string
of that encoded length could represent, `(len/4)*3 - 2`) BEFORE calling `DecodeString` —
`MaxWireBytes` alone bounds only the sum of all four fields, so a single field could otherwise be
packed right up against the wire ceiling and force a decoded allocation far larger than that field's
own specific limit (e.g. an oversized `EnvelopeB64` while the total frame stays comfortably under
`MaxWireBytes`). This bound is the tightest derivable from encoded length alone, but is not, and
cannot be, byte-exact: base64's 4-byte-group/padding quantization means an encoded length can
legitimately represent up to 3 consecutive decoded lengths (whenever a component's limit ≡ 1 mod 3,
true for every limit in this file, that's exactly `limit`, `limit+1`, `limit+2`), so up to 2 bytes of
allocation slop past a component's limit can still reach `DecodeString` before the existing,
unconditional post-decode length check — kept as defense in depth for exactly this reason — closes
the gap exactly. What the pre-check guarantees is that the forced allocation is bounded near that
component's own limit, never proportional to a different (larger) component's limit or to
`MaxWireBytes`.

## Sustained Phase-B Block Evidence (V3.1-B Closeout Pack A.1; wording corrected in Closeout Pack A.2, Work Package E)

The Phase-A/Phase-B block-linearization integration tests (`internal/server/
orchestrate_block_linearization_test.go`) previously used a `100ms` non-completion window, after a
hook proving the competing goroutine had reached the block-attempt DISPATCH point, as the stated
proof that the phase gate correctly blocked it — a real, if narrow, scheduler-dependent gap (nothing
proved the goroutine had actually entered the blocking `Lock()` call, only that it was about to). A
non-timing-dependent SOURCE of evidence now lives directly in `internal/grant`:
`Store.waitingForTest(grantID) int32` (a test-only, never-production-read observability counter on
each Grant's `gateEntry`, incremented immediately BEFORE `acquirePhaseGate`'s `Lock()` call and
decremented immediately after it returns). A single observation of this counter only proves a
goroutine has reached that atomic increment — Go's `sync.Mutex` exposes no way to observe "currently
blocked inside the runtime wait queue" more precisely than this, a gap an external reviewer correctly
identified in an earlier version of this evidence, and a limit that no amount of sampling from user
code can remove.
`TestMarkBlocked_CannotCompleteWhileGateGenuinelyHeld_UnderSustainedYieldStress` narrows that gap with
SUSTAINED sampling instead of a single snapshot: once the counter is first observed non-zero, it
re-checks (via `runtime.Gosched`, never `time.Sleep`) both non-completion AND the counter staying
non-zero across thousands of further scheduler yields — since only the test's own holder goroutine can
legitimately cause the counter to drop back to zero (by releasing), observing it do so early is itself
independent evidence of a broken gate, and running that many real yields gives the runtime substantial
opportunity to advance a genuinely non-blocking (defective) lock if one existed. **This is sustained
stress evidence, not a mathematical proof that a goroutine has registered inside the Go runtime's
internal mutex wait queue** — no such proof is obtainable through the APIs `sync.Mutex` exposes, and
this document (like the test's own doc comment) does not claim otherwise. The only fixed-duration
element anywhere in the test is a generous outer DEADLOCK-GUARD deadline — a safety net that fails the
test with a clear message if a run genuinely hangs, never itself part of the positive evidence. That
guarantee is complemented, not replaced, by a plain structural fact confirmed by direct source
inspection: `MarkBlocked`, `MarkBlockedInPhase`, `AdmitPublicationPhase`, and `Revoke` all resolve the
exact same per-`GrantID` gate through `Store.gateFor`/`acquirePhaseGate` — there is no separate,
divergent locking path for any of them. The two `orchestrate_block_linearization_test.go` integration
tests keep their two-full-`Orchestrate`-calls-converge-on-one-`PUBLISHED`-result structure (a real,
fully proven end-to-end fact the grant-package test cannot provide on its own) and their `100ms`
checks as a best-effort, explicitly non-authoritative CI regression signal — their comments point to
the grant-package test by name as the strongest available evidence of gate mutual exclusion, without
claiming that either the grant-package test or these integration tests proves waiter registration in
the runtime's wait queue.

## Human Provisioning Checklist (V3.1-C)

Everything below is **out of scope for V3.1-B** and must not be silently assumed done:

1. Create the dedicated Broker OS identity on this Mac (no interactive login).
2. Build `cmd/mihver-broker`/`cmd/mihver-broker-admin`/`cmd/mihver-publish` and install the compiled
   binaries under a system-owned, non-model-writable path; verify the development user cannot write
   to them.
3. Create the GitHub App (`mihvernetwork` organization), grant it exactly `Contents: write` and
   `Pull requests: write`, install it on the `mihver` repository only.
4. Generate and download the App's private key **once**, store it at a path the Broker identity
   alone can read, and verify `internal/config.Config.Validate` accepts that exact production
   configuration (path outside repo/home, mode ≤ `0600`, not a symlink).
5. Configure the LaunchDaemon (or equivalent) to run `mihver-broker` as the dedicated identity, with
   the client socket world-accessible-to-the-development-user and the admin socket restricted to the
   Broker identity alone.
6. Apply the `main` ruleset described above, explicitly excluding the Publication App from any
   bypass, and confirm `mihvernetwork`'s human merge capability is unaffected.
7. Run one supervised end-to-end dogfood: an unprivileged `mihver-publish` request, a human-issued
   `mihver-broker-admin create-grant` for its exact digest, and confirm the resulting push/PR on a
   disposable test branch — before ever using this path for a real MIHVER task.
8. Only after step 7 passes may `docs/development/AGENT_POLICY.md`,
   `docs/development/TASK_TEMPLATE.md`, and `CLAUDE.md` be updated to say remote publication
   automation is available — not before, and not as part of V3.1-B or this checklist itself.
