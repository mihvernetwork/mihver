# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

DEVELOPMENT-ORCHESTRATION-V3.1-B-PRIVILEGED-PUBLICATION-BROKER-FOUNDATION

## Objective

Implement the repository-side source, deterministic protocol, tests, and deployment specification for
a privilege-separated, non-LLM Publication Broker (Go, stdlib only) — the foundation V3.1-C will later
provision and activate. Core invariant carried through every design decision: the repository source
code is NOT the privilege boundary (Claude/Codex can write every file here); real credential
separation exists only once a reviewed, compiled Broker artifact is installed outside this repository
under a distinct OS identity, which this task explicitly does not do.

## Branch / Base

Branch: `chore/publication-broker-v3-1b`.
Base: `main` at `02f55522542591f518ebc4b2ec56e8350a02e8bc`.

## Status

**Complete, pending human review.**

**Publication:**
- Local Publication Builder authorized: no.
- Remote publication: human manual fallback only (unchanged — this task does not touch that).
- Do not commit/push/PR — awaiting human review of the implementation first, per this task's own
  explicit instruction.

**Deliverable**: `tools/publication-broker/` — a new Go module (`mihver.network/publication-broker`,
stdlib only, no third-party dependency added) implementing:
- `internal/protocol` — Envelope/Receipt/PackageManifest wire types (strict-decoded, mirroring
  `schemas/dev/publication-envelope.schema.json`/`publication-receipt.schema.json` field-for-field)
  and the ambiguity-free, explicitly length-prefixed REQUEST DIGEST recipe.
- `internal/grant` — server-side PublicationGrant store; `AdminHandle` (create/revoke) and
  `ClientHandle` (begin/resume/mark-published/mark-blocked) are disjoint Go types, so "an
  unprivileged client cannot create/modify/extend/revoke a grant" is a compile-time property.
- `internal/pkgimport` — imports an untrusted Git bundle into a fresh broker-owned bare repository
  under a sterile environment (`internal/gitexec`); never executes bundle content.
- `internal/verifier` — the Broker's own independent re-verification of every remote-effect-critical
  fact (Envelope/Receipt cross-checks, commit parent/ancestry, exact changed-path/action agreement,
  the canonical fingerprint recomputed from the actual imported commit tree using the V3.1-A UTF-8
  byte-order recipe) — never trusts the Envelope/Receipt/manifest's own claims.
- `internal/githubapp` — GitHub App JWT minting (RS256, stdlib `crypto/rsa`), installation-token
  minting scoped to exactly one repository and the minimal `{contents, pull_requests}: write`
  permission set (read-scoped minted first, write-scoped minted late), an opaque `Token` type that
  redacts on `String()`/`MarshalJSON()`, and narrow PR create/update/search mechanics (`PRClient` has
  no merge/close/approve method).
- `internal/gitremote` — branch-safety validation (categorically rejects main/master/base_branch/ref
  paths/`-`-prefixed names) and non-force, expected-head-verified push, with the token kept out of
  argv/URL/logs via a per-push `GIT_ASKPASS` environment handoff.
- `internal/audit` — broker-owned, hash-chained, append-only JSONL audit log (tamper-evident, not
  tamper-proof against a fully compromised process — documented as such, not oversold).
- `internal/config` — fail-closed production configuration validation (repo-root/dev-home containment
  roots required non-empty — an omitted flag no longer silently disables the check; key path checked
  against the symlink-resolved real path of its parent directory, not the path as given, so a
  symlinked ancestor directory can't evade containment; key not itself symlinked, not
  group/world-readable; fixed GitHub API/remote hosts in production; malformed App/installation IDs
  rejected).
- `internal/server` — `Orchestrate` (the full publish flow as one pure, injectable-dependency
  function) plus `ClientListener`/`AdminListener` (separate Unix socket transports).
- `cmd/mihver-broker`, `cmd/mihver-broker-admin`, `cmd/mihver-publish` — thin, functional entrypoints;
  never run against real infrastructure by this task.
- `docs/development/PUBLICATION_BROKER.md` — new semantic owner of the Broker's architecture,
  protocol, macOS deployment design, GitHub main-ruleset design, and the V3.1-C human provisioning
  checklist.
- `schemas/dev/publication-broker-request.schema.json`, `publication-grant.schema.json`,
  `publication-broker-result.schema.json`, `publication-package-manifest.schema.json` — new
  machine-readable contracts mirroring the actual Go wire/state types exactly.
- `package.json`: added `test:publication-broker` (`cd tools/publication-broker && go test ./...`) —
  not folded into `npm test`, which remains the M0 contract suite only.

**Policy mirror synchronization** (`docs/development/CODEX_ROLES.md`, `CLAUDE.md`,
`docs/development/AGENT_POLICY.md`, `.project/CONTEXT_INDEX.md`, and one comment line in
`scripts/dev/publication-builder.mjs`): corrected flatly-false "the Broker is NOT IMPLEMENTED"
statements (Broker *source* is now implemented) to the accurate intermediate state — "source
implemented, NOT provisioned/activated" — without ever claiming remote publication automation is
available. `CODEX_ROLES.md`'s former "Future Publication Broker Interface" section (a bare
Envelope+Receipt sketch, superseded by the actual implemented PublicationPackage/grant/digest
transport) now points to `PUBLICATION_BROKER.md` as the semantic owner instead of restating a stale
interface description. `scripts/dev/publication-builder.mjs`'s one-line comment cross-reference to
that renamed heading was fixed as a direct, narrow Conditional Consistency touch this heading rename
made stale — not originally enumerated in this task's own file-scope list, but squarely within
`AGENT_POLICY.md`'s general Conditional Consistency policy (fixing a cross-reference the Primary
change broke). **`REMOTE PUBLICATION AUTOMATION = NOT AVAILABLE` remains true and is stated
explicitly everywhere touched** — no file was flipped to claim automation is available.

**Validation (as of Hardening Round 1.1, run directly by Claude, after all confirmed reviewer findings
were fixed)**: `npm run test:publication-broker` / `go test ./...` inside `tools/publication-broker/`
— 107/107 test functions passing across 9 packages (`protocol`, `grant`, `pkgimport`, `verifier`,
`gitremote`, `audit`, `config`, `githubapp`, `server`; up from 95 at the original foundation round,
101 after Round 1, 107 after Round 1.1); `go build ./...`, `go vet ./...`, and `go test -race ./...`
clean; `gofmt -l .` clean (no formatting
violations). `npm run test:publication-builder` 42/42 (unaffected). `npm test` 170/170. `npm run
test:project-consistency` 19/19. `npm run check:project-consistency` 7/7. `git diff --check` clean.
All Go tests run against disposable local Git repositories, local Unix sockets under a scratch temp
directory, and `httptest` fake HTTP servers — zero real GitHub credential, zero real network call,
zero real push/PR in any test.

**Codex delegation**: one Scout (V3.1-A protocol surface, Go toolchain, policy-mirror inventory,
package.json shape) before implementation; Claude implemented the module directly rather than via
Implementer sub-tasks — adjudicated exception per `AGENT_POLICY.md`'s "Claude Responsibilities"
(a single coherent, tightly-coupled security protocol across 9 interdependent packages was judged
higher-risk to fragment across parallel Implementer contracts than for Claude to write directly,
with Codex serving the required independent-check role instead); one Verifier (two of its five
Go-test-related checks could not run under its own sandbox's socket/port-binding restriction —
independently re-confirmed passing in Claude's own environment, the same category of sandbox
limitation already documented for V3.1-A's Verifier); three parallel Reviewers (privilege/credential
boundary, git/package/TOCTOU, GitHub/PR/deployment/policy) found and Claude fixed 1 BLOCKER, 3 MAJOR,
and 1 MAJOR documentation-consistency finding — see `.project/REVIEW_STATE.md` for every finding,
the fix applied, and Claude's adjudication.

**Hardening Round 1 — exact remote-transition binding**
(`DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R1-EXACT-REMOTE-TRANSITION`, this pass, uncommitted, on
the same branch): fixed a real BLOCKER security defect confirmed by a deterministic local
reproduction before any production code changed. `internal/server.Orchestrate` previously passed the
raw freshly-observed remote head straight through to `GitRemote.Push` as its own "expected head" —
since a non-force push of `receipt.commit_sha` is a valid git fast-forward from *any* of its
ancestors, not only from `envelope.expected_pre_publish_head`, a remote sitting at an older,
unreviewed commit (`A` in a real `A → B → C` chain where the Envelope only ever authorized the
`B → C` transition) could still receive a successful push carrying the unreviewed intermediate
commit `B` along with `C`. Reproduced with a real disposable git repository and bare remote
(`TestOrchestrate_ExistingBranchAtUnauthorizedAncestor_Blocked`, run against the pre-fix code first
and confirmed to fail — i.e. the unauthorized publish actually happened). Fixed by replacing the
single push call with an exact four-case remote-transition decision table (already-published /
existing-branch-at-exact-predecessor / absent-branch-safe-to-create / everything else fails closed),
binding `Push`'s expected-head argument to Envelope-derived values only, never to the raw
observation — see `docs/development/PUBLICATION_BROKER.md`'s "Remote Branch Safety / Idempotency"
section for the full table. Six new regression tests added in
`internal/server/orchestrate_remote_transition_test.go` (unauthorized-ancestor block, absent-branch
multi-commit block, safe new-branch creation, safe existing-branch advancement, idempotent
already-published retry with zero write-token mints, cross-call drift detection after a partial
success), all against real local git repositories/bare remotes — no test doubles for git state
itself. One fresh, independent read-only Codex Reviewer found 2 MAJOR findings, both confirmed and
fixed: the sixth test's name/comment overclaimed proving an intra-call TOCTOU race when it actually
demonstrated cross-call retry drift (renamed to
`TestOrchestrate_RetryDetectsExternalRemoteDriftAfterPushSucceeds` with an honest scope note,
deliberately not fabricating the narrower race since doing so would require a test-only production
seam nothing else needs); the same test was missing a final real-remote-state assertion after the
blocked retry (added). Existing commit-parent/changed-path/fingerprint/branch-name/token/PR
validation left untouched, per this round's own explicit constraints. Small test-only addition to
`internal/testutil/gitfixture.go` (`PushTo`, `FetchAndSetRef`) required for realistic multi-commit
graph construction in tests — not originally enumerated in this round's file scope but pure test
infrastructure, no production behavior. Validation: `go build`/`go vet`/`gofmt -l`/`go test -race`
all clean; 107/107 Go test functions passing (up from 101 pre-round); repo-wide `npm run test:publication-broker`,
`test:publication-builder` (42/42), `npm test` (170/170), `test:project-consistency` (19/19),
`check:project-consistency` (7/7), `git diff --check` all clean. No commit/push/PR/merge/real network
publication occurred.

**Hardening Round 1.1 — atomic remote compare-and-swap**
(`DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R1.1-ATOMIC-REMOTE-CAS`, this pass, uncommitted, same
branch): closed a narrower, remaining time-of-check/time-of-use gap purely inside
`internal/gitremote.Client.Push` itself. An ordinary non-force push necessarily performs its
"does the remote match what I expect" check and the real `git push` subprocess as two separate
client-side steps; a remote mutation landing in the gap between them — even though `Push`'s own
pre-check had already correctly observed the authorized predecessor `B` — could still let an
ordinary fast-forward push of `C` succeed from wherever the remote had moved to (e.g. rewound to an
earlier ancestor `A`), publishing an unauthorized `A → C` transition. Reproduced first with two new
tests using a real disposable git repo/bare remote and a new test-only `RaceInjectingRunner`
(`internal/testutil`) that deterministically mutates the remote at the exact boundary between
`Push`'s pre-check and the real `git push` subprocess — both confirmed to fail against the prior
plain-push implementation before the fix, then confirmed to pass after. Fixed by making the update
an atomic compare-and-swap: `Client.Push` now issues exactly one explicit, exact-OID
`--force-with-lease=refs/heads/<branch>:<expect>` argument per push (`<expect>` is exactly the same
`expectedHead` value the pre-check already required; the literal empty string for a not-yet-existing
branch), evaluated server-side as a single atomic operation. `Client.Sterile` changed from a concrete
`gitexec.Sterile` field to a small internal `gitRunner` interface solely to make the race-seam
injection possible — production wiring is unaffected since `gitexec.Sterile` still satisfies it
unmodified. Categorically still forbidden and tested against: a bare `--force`/`-f`, a `+`-prefixed
refspec, an implicit (value-less) `--force-with-lease`, a lease on any ref other than exactly
`refs/heads/<branch>`, and more than one lease argument
(`TestPush_ArgvUsesOnlyExactExplicitLease`, using exact-match — never substring — comparisons so the
allowed lease itself is never misclassified as the forbidden bare flag). A fresh independent Codex
Reviewer found the atomic-lease design itself correct (explicitly confirmed: no, an actor cannot
change the remote from `B` to `A` after `Push`'s pre-check and still cause `C` to be accepted) but
found 1 real MAJOR correctness defect in the failure-classification branch: a push that actually
*succeeded* server-side but returned a client-visible error (e.g. a dropped connection after
acceptance) was misclassified as `ErrRemoteHeadChanged`, which would have permanently `BLOCK`ed a
grant whose authorized commit was in fact already published. Confirmed by reproducing it directly
(temporarily reverted the fix, confirmed a new regression test failed exactly as predicted, restored
the fix, confirmed the same test then passed) and fixed by re-observing the remote after a push
error and checking `after == commitSHA` first — treating that as success — before ever considering
`ErrRemoteHeadChanged`. Production `GitRemote.Push` call-site review: exactly 2 call sites, both in
`internal/server.Orchestrate`, both structurally unreachable except after package import, the
verifier's exact-parent check, and branch-name validation have already run (single function, no
branch skips them) — proven by a dedicated new test
(`TestOrchestrate_VerifierGateBlocksInvalidParentEvenWhenRemoteMatchesLease`) constructing a commit
whose real git parent disagrees with what the Envelope/Receipt claim, with the remote positioned to
otherwise satisfy the lease, confirming the verifier blocks before `Push` is ever reachable (zero
write-token mints). `docs/development/PUBLICATION_BROKER.md`'s "Remote Branch Safety / Idempotency"
section rewritten to replace the now-inaccurate "no code path ever constructs a --force argument /
git's fast-forward check is the final backstop" claim with the actual atomic-lease mechanism and its
three-way failure classification. Validation: `go build`/`go vet`/`gofmt -l`/`go test -race` all
clean; 107/107 Go test functions passing (up from 101). No commit/push/PR/merge/real network
publication occurred.

**Hardening Round 2 — linearizable grant revocation barrier**
(`DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R2-LINEARIZABLE-GRANT-REVOCATION`, this pass, uncommitted,
same branch): closed a live-revocation race that neither R1 nor R1.1 addressed. `Orchestrate` called
`BeginOrResume` once at the start of a request and then relied on that single Grant snapshot through
every subsequent write-capable step; if `AdminHandle.Revoke` returned success for that Grant while a
concurrent `Orchestrate` call for it was already in flight, the in-flight call could still mint a
write-capable token, push, and/or create or update a PR — repeated read-only state checks alone cannot
close this (the check-then-act gap is exactly where the race lives). Reproduced directly
(`TestOrchestrate_LiveRevocationDefect_ReproducedAgainstPreFixBehavior`): captured a single
`BeginOrResume` snapshot, called `Revoke` (confirmed success), then performed the exact pre-fix
vulnerable subsequence (mint token, push) using only that stale snapshot — confirmed the push actually
succeeded against the real disposable remote after revocation had already returned success. Fixed with
a broker-owned, per-Grant, exclusive **phase gate** (`internal/grant.Store.gates`, a `*sync.Mutex` per
`GrantID` in its own map guarded by a separate `gatesMu`, never `Store.mu` itself): `AdminHandle.Revoke`
acquires a Grant's gate first, before touching any state, so it blocks for the duration of any already-
admitted publication phase and cannot be pre-empted by a new one; `ClientHandle.AdmitPublicationPhase`
acquires the same gate and re-reads live state fresh, returning the held gate to the caller
(`Release()`d via `defer`, idempotent through `sync.Once` — a double-release never panics). Lock order
is fixed and documented: phase gate first, then `Store.mu` briefly for the in-memory read/write (the
one I/O `Store.mu` is ever held across is its own bounded local persistence write — never Git, HTTP,
token-mint, or filesystem-import activity); the reverse order never occurs. `internal/server.Orchestrate`
was restructured into two independently-gated phases — Phase A (`runRemotePublicationPhase`: the
existing R1/R1.1 remote-transition decision table and push, admitted once) and Phase B
(`runPRFinalizationPhase`: PR search/create/update, admitted again, fresh) — releasing the gate between
phases specifically so a revoke landing after a successful push but before PR finalization still wins.
A revocation race maps to the stable `GRANT_REVOKED` failure code, never a generic `PUSH_FAILED`/
`PR_CREATE_FAILED`; `MarkBlocked` is never called on a revocation race. `AdminHandle.Revoke` itself was
also found (via my own re-reading of the required transition table while implementing this round, not
from an external finding) to have a real pre-existing defect: it special-cased only `PUBLISHED` and
`REVOKED`, so a `BLOCKED` or `EXPIRED` grant would previously have been silently overwritten to
`REVOKED` — fixed as part of the same rewrite (`TestRevoke_DoesNotOverwriteBlocked`/
`TestRevoke_DoesNotOverwriteExpired`/`TestRevoke_DoesNotOverwritePublished`). 15 new regression tests
added across `internal/grant/grant_test.go` and the new `internal/server/orchestrate_revocation_test.go`
(122 Go test functions total, up from 107), including deterministic channel-synchronized interleaving
tests for: revoke racing an existing-branch push, revoke racing new-branch creation, an admitted no-PR
phase linearizing before revoke, revoke landing in the released gap between Phase A and Phase B within
one invocation (the specific interleaving a fresh reviewer found the round's first Phase-B test did not
actually exercise — see below), cross-Grant non-interference (holding one Grant's gate never blocks
another Grant's `Orchestrate` call — no single global I/O mutex), and concurrent-identical-request
idempotency for both no-PR and PR-expected flows (no duplicate push, no duplicate PR). One fresh,
independent read-only Codex Reviewer answered the round's core question explicitly: **NO**, a
write-capable operation cannot begin after `Revoke` returns success, tracing the actual lock-order
evidence in the current code. It found 1 MAJOR, 2 MINOR, and 1 NIT, all adjudicated and the MAJOR/MINOR
findings fixed: (MAJOR, ACCEPTED) the round's original "push succeeds, then revoke prevents PR
finalization" test only revoked *after* a full `Orchestrate` call had already returned and checked a
*separate retry* — a defect deleting Phase B's fresh admission entirely could still have passed that
test, since the retry's own initial `BeginOrResume` already rejects a `REVOKED` grant on its own;
fixed by adding a new test-only `Deps.testHookBetweenPhaseAAndB` seam and a new test
(`TestOrchestrate_RevokeWinsInSameInvocationBetweenPhaseAAndPhaseB`) that races `Revoke` into the actual
released gap between Phase A and Phase B *within one Orchestrate call* whose push already succeeded —
confirmed by the same revert-confirm-restore empirical pattern used in R1/R1.1 (temporarily bypassed
Phase B's `AdmitPublicationPhase` call entirely; the new test failed exactly as predicted,
`FailureReason: PR_CREATE_FAILED` instead of `GRANT_REVOKED`, with a duplicate/permitted PR API call;
restored the fix, confirmed the test then passed). (MINOR, ACCEPTED) `Store`'s doc comment overclaimed
`Store.mu` is held only across "I/O-free" work when `persistLocked` in fact performs a bounded local
file write under it — corrected the comment to describe that write precisely rather than deny it exists
(no behavior change; this bounded broker-owned-file write was never the Git/HTTP/token-mint/
filesystem-import activity the "never held during I/O" guarantee is actually about, and was already
true before this round). (MINOR, REJECTED_WITH_REASON — not a defect) the reviewer's own read-only
sandbox could not establish that `internal/gitremote/gitremote.go`/`gitremote_test.go` are byte-for-byte
unchanged from before this round (the files are untracked, so it has no baseline to diff against);
independently confirmed byte-identical by Claude via direct comparison against a full local copy saved
immediately after R1.1 completed (`diff` clean, matching MD5 for both files) — a reviewer-sandbox
information-access limitation, not a code defect, the same category already documented for this
Broker's prior Verifier/Reviewer sandbox limitations. (NIT, ACCEPTED) the new test file's header
comment claimed synchronization "never sleeps," which was one clause too strong — one test
(`TestOrchestrate_DifferentGrantsAreNotSerialized`) uses a single short, non-correctness-critical
`time.Sleep` purely to give an unrelated goroutine a head start before an independent bounded
`time.After` assertion, never to make a test's pass/fail depend on winning a sleep-timing race —
corrected the comment to say so precisely. `docs/development/PUBLICATION_BROKER.md` gained a new
"Linearizable Grant Revocation (V3.1-B Hardening R2)" subsection under "Server-Side PublicationGrant"
describing the phase-gate design, lock order, and the two-phase Orchestrate restructuring; no other
section was touched, and the existing R1/R1.1 "non-force push" wording was left as-is since this round
never directly touched it. `internal/gitremote/gitremote.go` and `gitremote_test.go` remained frozen
throughout, confirmed byte-for-byte identical to their R1.1 state via direct file comparison against a
saved copy (not merely by absence of a diff, since the whole module is untracked on this branch).
Validation: `go build`/`go vet`/`gofmt -l`/`go test -race ./...` all clean; 122/122 Go test functions
passing (server package run 3x, grant package run under `-race` with `-v`, the two new
interleaving-sensitive tests each run 5x, zero flakiness observed); `npm run test:publication-broker`,
`npm run test:publication-builder` (42/42), `npm test` (170/170), `npm run test:project-consistency`
(19/19), `npm run check:project-consistency` (7/7), `git diff --check` all clean; a repository-wide
untracked-file whitespace/trailing-space/final-newline sweep found nothing to fix. No commit, push, PR,
merge, or real network publication occurred at any point in this round.

**Hardening Round 2.1 — persistence-truthful revoke and copy-safe phase lease**
(`DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R2.1-REVOKE-PERSISTENCE-AND-PHASE-LEASE`, this pass,
uncommitted, same branch): a narrow remediation pass closing two defects in R2's own implementation
that R2's independent reviewer did not surface but a subsequent review pass found. Neither weakens the
R2 linearization guarantee itself (once `AdminHandle.Revoke` returns success, no new write-capable
operation may begin for that Grant) — both are internal correctness defects in how `Revoke` and
`PhaseGate` were implemented.

**Finding A (false-success revoke retry)**: `AdminHandle.Revoke`'s `case StateRevoked` was a bare
`return nil` short-circuit. If an earlier call transitioned the in-memory state to `REVOKED` but its
own `persistLocked()` call failed (disk full, permission error), that call correctly returned an
error — but a LATER call would see the in-memory state already `REVOKED` and return `nil` immediately
without ever attempting to persist again, reporting success while the on-disk store still showed the
grant `IN_PROGRESS`; a Broker restart would then load the grant as still active, silently undoing the
revoke. Reproduced deterministically before fixing: a real file-backed `Store`, persistence
obstructed by creating a real directory at the store's `<path>.tmp` target (so `persistLocked`'s
`os.WriteFile` genuinely fails, not a simulated result) — confirmed the second Revoke call incorrectly
returned `nil` while the reopened Store still showed `IN_PROGRESS`. Fixed by making the `REVOKED` case
never a bare no-op: every call, including a retry of an already-in-memory-`REVOKED` grant,
unconditionally re-attempts `persistLocked()` and propagates its exact result — `nil` only once that
specific attempt actually succeeds. In-memory state remains `REVOKED` (fail-closed) the moment a
genuine transition happens, independent of persistence outcome, so `AdmitPublicationPhase` still
denies phase admission in the same process regardless of whether the durable write has landed.

**Finding B (copy-unsafe PhaseGate)**: `PhaseGate` embedded `*sync.Mutex` and `sync.Once` directly as
struct fields. Copying a `PhaseGate` value (`copied := *gate`) copies `sync.Once` BY VALUE, producing
a second, independent Once guarding the same underlying mutex — releasing both the original and the
copy then physically unlocks that mutex twice, the second call panicking with `fatal error: sync:
unlock of unlocked mutex`. Reproduced directly (reverted `PhaseGate` to the pre-fix embedded shape,
ran the new regression test, confirmed the exact predicted panic, restored the fix, confirmed pass).
Fixed by indirecting through a new unexported `phaseGateState` (`{mu *sync.Mutex; once sync.Once}`):
every `PhaseGate` value naming the same acquisition shares one `phaseGateState`/`Once`, however many
times it is copied or aliased, so `Release()` is safe any number of times, from any number of copies,
concurrently or sequentially — while a LATER, distinct acquisition of the same Grant's gate gets a
brand-new `phaseGateState`, so a stale alias from an earlier, fully-released acquisition can never
unlock a later, unrelated one (`acquirePhaseGate` mints a fresh `phaseGateState` on every call, sharing
only the persistent per-Grant `*sync.Mutex` itself).

**Also added (Finding C)**: `AdminHandle.Revoke`'s three terminal-state refusals are now stable
sentinel errors (`ErrCannotRevokePublished`/`ErrCannotRevokeBlocked`/`ErrCannotRevokeExpired`, each
wrapped with grant-ID context via `%w` so `errors.Is` works, never substring-matched); the admin
listener (`internal/server/listener.go`) maps them to stable wire codes (`GRANT_ALREADY_PUBLISHED`,
`GRANT_PREVIOUSLY_BLOCKED`, `GRANT_EXPIRED`, plus `GRANT_NOT_FOUND` and a `GRANT_REVOKE_FAILED`
catch-all) on a new `AdminResult.Code` field, verified through the real admin Unix socket transport,
not merely the in-process `AdminHandle` directly.

**9 new regression tests** (131 Go test functions total, up from 122): 8 in `internal/grant/grant_test.go`
(persistence-failure-never-false-success, repeated-persistence-failure-never-succeeds,
already-durably-revoked-idempotent, fail-closed-admission-after-persistence-failure,
copied-lease-double-release-safe, concurrent-alias-release-safe, stale-alias-cannot-unlock-later-holder,
terminal-state-stable-sentinels) and 1 in `internal/server/listener_test.go` (admin-socket
stable-code mapping for all three terminal states). `docs/development/PUBLICATION_BROKER.md` gained
"Persistence-Truthful Revoke", "Copy-Safe Phase Lease", and "Stable Revoke Error Model" subsections,
and its `Store` doc comment was corrected to precisely distinguish the actual temp-file-plus-rename
persistence contract from fsync/power-loss durability (never claiming the latter).

**One fresh, independent read-only Codex Reviewer**, explicitly required to answer both "(A) can
Revoke return success after a previous persistence failure while the on-disk Grant is still
IN_PROGRESS?" and "(B) can copying a PhaseGate value create a second independent Release authority
over the same mutex?" — both answered **NO**, with direct file:line evidence for each. Found exactly
1 NIT (no MAJOR/CRITICAL, no revocation or deadlock finding — nothing requiring mandatory
non-deferral): `AdminResult.Code`'s doc comment implied `Code` could be left empty on an unclassified
failure, when in fact every `revoke_grant` failure specifically always gets a code (a specific one or
the `GRANT_REVOKE_FAILED` catch-all) — **ACCEPTED**, comment corrected to state this precisely,
including the accurate caveat that `create_grant` failures and malformed-request rejections do not
currently populate `Code` (unrelated to this round's scope, not a defect). The reviewer separately
noted it could not independently establish `internal/gitremote/gitremote.go`/`gitremote_test.go` are
byte-for-byte unchanged (untracked files, no git baseline in its environment) — independently
confirmed byte-identical by Claude via direct comparison against a saved local copy (`diff` clean,
matching MD5 for both files against the same baseline used in R1.1/R2's confirmations) — the same
reviewer-sandbox information-access limitation already documented for this Broker's prior
Verifier/Reviewer rounds, not a code defect.

**Validation (after the one reviewer finding was fixed, run directly by Claude)**: `go build ./...`,
`go vet ./...`, `gofmt -l .`, `go test -race ./...` all clean; 131/131 Go test functions passing;
`npm run test:publication-broker`, `npm run test:publication-builder` (42/42), `npm test` (170/170),
`npm run test:project-consistency` (19/19), `npm run check:project-consistency` (7/7), `git diff
--check` all clean; untracked-file whitespace/trailing-space/final-newline sweep clean.
`internal/gitremote/gitremote.go`/`gitremote_test.go`, `internal/audit/**`, `internal/githubapp/**`,
and `internal/server/orchestrate.go` all confirmed byte-for-byte unchanged this round via direct file
comparison. No commit, push, PR, merge, or real network publication occurred at any point in this
round.

**Hardening Round 3 — persistence-truthful Grant state machine**
(`DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R3-PERSISTENCE-TRUTHFUL-GRANT-STATE-MACHINE`, this pass,
uncommitted, same branch): extends the persistence-truthful pattern R2.1 established for
`AdminHandle.Revoke` to every other Grant state mutation — `AdminHandle.Create`,
`ClientHandle.BeginOrResume`, `ClientHandle.MarkPublished`, `ClientHandle.MarkBlocked`, and
`ClientHandle.RecordRemoteHead`. The common pre-existing defect class: each mutated the in-memory
`Grant` first, attempted `persistLocked()`, and on failure either silently discarded the error
(`_ = persistLocked()`) or returned it without undoing the in-memory mutation — so a LATER call could
see the already-mutated state and report success even though the on-disk store file never actually
recorded it. Five defects reproduced deterministically (real file-backed Store, a real directory
created at `<path>.tmp` to obstruct `persistLocked`, never a simulated result) before any production
code changed: (A) a failed `Create` left a fully usable Grant behind; (B) a `BeginOrResume` retry after
a failed persist returned success while disk still showed `AUTHORIZED`; (C) a `MarkPublished` retry
after a failed persist returned success while disk still showed `IN_PROGRESS`, and a non-identical
retry (different remote head/PR number) was silently accepted, overwriting the recorded outcome; (D) a
failed `MarkBlocked` had no repair path at all — a second identical-reason call returned `ErrWrongState`
since in-memory state was already `BLOCKED`; (E) an expiry-transition persistence error was silently
discarded. All five reproduced by temporarily reverting `grant.go` to its pre-R3 (R2.1) state (with
stub sentinel declarations added so the new test file could compile against it) and confirming every
new regression test failed exactly as predicted; restored and re-confirmed passing.

Fixed with two repair strategies, chosen by whether a remote effect has already genuinely happened:
**rollback** for `Create` and `BeginOrResume`'s own `AUTHORIZED → IN_PROGRESS`/`AUTHORIZED → EXPIRED`
transitions (no remote effect yet — undo the in-memory mutation on persist failure so the grant remains
fully usable and a later call re-attempts cleanly, no pending/dirty marker needed); **fail-closed-
forward** for `MarkPublished`/`MarkBlocked` (mirroring `Revoke`'s R2.1 pattern — a real remote effect or
decided fact already happened, so the in-memory state stays `PUBLISHED`/`BLOCKED` even while
persistence fails, denying phase admission throughout; an identical-outcome/-reason retry re-attempts
`persistLocked()` and propagates its exact result; a DIFFERENT outcome/reason is rejected outright via
new sentinels `ErrPublishedOutcomeMismatch`/`ErrBlockedReasonMismatch`, never silently overwriting the
recorded fact). `RecordRemoteHead` (a non-authoritative cache — Orchestrate always re-observes the real
remote fresh) rolls its in-memory value back on failure rather than letting it drift ahead of disk.
Additionally: since `MarkBlocked` is only ever called by `Orchestrate`, and a `BLOCKED` grant's own
`BeginOrResume` denial is what stops `Orchestrate` from ever reaching a `MarkBlocked` call site again
for that Grant, `BeginOrResume`'s `BLOCKED` case now also opportunistically re-attempts `persistLocked()`
on every call (result ignored, since the reported fact — `BLOCKED` — never changes either way) — this
closes a genuine reachability gap found while writing the orchestrate-level regression test: without
it, `MarkBlocked`'s new repair capability would never actually be exercised by any real caller, since
Orchestrate's own top-level `BeginOrResume` check would short-circuit before ever calling `MarkBlocked`
again. No new field was added to the `Grant` struct or its persisted JSON shape — every guarantee is
achieved purely through what is mutated/rolled-back/re-attempted in memory before `persistLocked()` is
called.

`internal/server/orchestrate.go`'s error handling closed to match: all 11 previously-`_ =`-discarded
`MarkBlocked` call sites now route through a new `blockGrant` helper reporting the stable
`GRANT_BLOCK_PERSIST_FAILED` code (original intended reason preserved in the audit record's detail
field) when persistence itself fails. `mapGrantError` changed from bare equality
(`switch err { case grant.ErrX: ...}`) to `errors.Is` comparisons so it correctly classifies the new
wrapped sentinels, adding `GRANT_BEGIN_PERSIST_FAILED`/`GRANT_EXPIRE_PERSIST_FAILED` as distinct,
retryable codes (deliberately never the terminal-sounding `GRANT_EXPIRED`, since a failed expiry
transition rolls back to `AUTHORIZED`). `MarkPublished`'s two call sites distinguish
`GRANT_PUBLISH_OUTCOME_MISMATCH` from `GRANT_PUBLISH_PERSIST_FAILED` via a new
`publishPersistFailureReason` helper. `docs/development/PUBLICATION_BROKER.md` gained a
"Persistence-Truthful Grant State Machine (V3.1-B Hardening R3)" subsection describing both repair
strategies precisely, without overstating the durability contract (still no
`fsync`/power-loss/crash-consistency claim — explicitly V3.1-C scope). `internal/gitremote/gitremote.go`/
`gitremote_test.go`, `internal/audit/**`, and `internal/githubapp/**` confirmed byte-for-byte unchanged
this round via direct file comparison (matching MD5 against the same saved R1.1 baseline used in every
prior round's confirmations).

One fresh, independent read-only Codex Reviewer, explicitly required to answer four core questions
(can a failed Create leave a Grant usable / can BeginOrResume return success while disk still shows
AUTHORIZED / can MarkPublished return success while disk still shows IN_PROGRESS / can a failed
MarkBlocked transition be silently reported as durably BLOCKED) — all four answered **NO** with
file:line evidence, but additionally surfaced a real gap outside the four questions' literal scope.
Findings, all adjudicated:
- **MAJOR, ACCEPTED**: `BeginOrResume`'s and `AdmitPublicationPhase`'s own idempotent `PUBLISHED`
  short-circuits read the in-memory snapshot directly and returned it as a successful `Result` —
  without ever giving `MarkPublished`'s own repair-retry logic a chance to run again, since nothing
  else calls `MarkPublished` again for an already-in-memory-`PUBLISHED` grant. Concretely: a push (and
  in the no-PR flow, the entire publication) succeeds, `MarkPublished`'s own persist fails, and a
  resubmission of the identical package would report `PUBLISHED` forever while the on-disk Store still
  showed `IN_PROGRESS` — the EXACT same reachability gap already identified and fixed for `BLOCKED`
  during this round's own implementation, just missed for `PUBLISHED`. Fixed with the identical
  opportunistic-re-persist pattern in both `BeginOrResume`'s and `AdmitPublicationPhase`'s `PUBLISHED`
  cases, empirically confirmed via the established revert-confirm-restore pattern (temporarily removed
  both additions; the new regression test
  `TestOrchestrate_RetryCannotReportPublishedWithoutRepairingPersistence` failed exactly as predicted —
  reopened Store showed `IN_PROGRESS` instead of `PUBLISHED`; restored, confirmed passing).
- **MAJOR, REJECTED_WITH_REASON**: the reviewer read my own review-prompt wording ("is `Store.mu` (or
  the per-Grant phase gate) ever held across Git/HTTP/token-mint activity... it must never be") too
  literally and concluded the per-Grant `PhaseGate` being held across remote I/O in `orchestrate.go`'s
  Phase A/B violates that rule. This is not a defect — it is the deliberate, explicitly documented R2
  design (the whole point of the phase gate is to linearize `Revoke` against the in-flight remote-
  effect phase, which requires holding it across exactly that I/O); only `Store.mu` itself — a
  completely different lock — is the one required to never span remote I/O, and it does not. My own
  review-prompt phrasing conflated the two locks; the actual codebase, its doc comments, and every
  prior round's documentation are consistent and correct on this point. No code change.
- **MINOR, ACCEPTED**: the reviewer noted the original `persistence_test.go` `MarkPublished` repair
  test called `MarkPublished` directly rather than through a full `Orchestrate` retry, so it could not
  have caught the MAJOR finding above on its own. Addressed by the new orchestrate-level regression
  test described above, which exercises the real end-to-end retry path.
- **NIT, REJECTED_WITH_REASON**: the reviewer's own sandbox could not establish byte-for-byte identity
  for `gitremote.go`/`gitremote_test.go`/`internal/audit/**`/`internal/githubapp/**` (untracked files,
  no git baseline in its environment) — independently confirmed unchanged by Claude via direct file
  comparison (matching MD5 against the same saved baseline used in every prior round), the same
  reviewer-sandbox limitation already documented repeatedly.

10 new tests total across `internal/grant/persistence_test.go` (new file) and
`internal/server/orchestrate_persistence_test.go` (new file) — 141 Go test functions total, up from
131 — all against real file-backed Stores with genuinely obstructed persistence, never simulated.

Validation (after the MAJOR finding was fixed, run directly by Claude): `go build`/`go vet`/`gofmt -l`/
`go test -race ./...` all clean; 141/141 Go test functions passing; `npm run test:publication-broker`,
`npm run test:publication-builder` (42/42), `npm test` (170/170), `npm run test:project-consistency`
(19/19), `npm run check:project-consistency` (7/7), `git diff --check` all clean; untracked-file
whitespace/trailing-space/final-newline sweep clean. See `.project/REVIEW_STATE.md` for the full
itemized findings/adjudication. No commit, push, PR, merge, or real network publication occurred at
any point in this round.

**Hardening Round 3.1 — terminal persistence acknowledgement**
(`DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R3.1-TERMINAL-PERSISTENCE-ACKNOWLEDGEMENT`, this pass,
uncommitted, same branch): a narrow remediation of R3's own "opportunistic repair" implementation,
whose repair attempts silently discarded their own result (`_ = h.s.persistLocked()`) and reported the
terminal fact as settled regardless of whether the repair actually succeeded. Reproduced the exact
scenario the R3 external reviewer's follow-up finding described: obstruct persistence, fail
`MarkPublished` (grant fail-closed `PUBLISHED` in memory, disk still `IN_PROGRESS`), resubmit the
identical package — R3's `BeginOrResume` silently re-attempted (and re-failed) the same write, then
returned the `PUBLISHED` snapshot anyway, letting `Orchestrate`'s idempotent short-circuit report
success to the caller while disk still showed `IN_PROGRESS`. Confirmed this exact defect empirically:
temporarily reverted the corrected orchestrate-level test's assertion pattern and reran it against
R3's grant.go (with R3.1's new sentinels stubbed in so it would compile) — the test failed exactly as
predicted (`Status: PUBLISHED` returned while disk showed `IN_PROGRESS`); restored, confirmed passing.
The identical defect existed symmetrically for `BLOCKED` via `MarkBlocked`.

Fixed by distinguishing **pending** (fail-closed in memory, not yet confirmed included in any
successful `persistLocked()` call) from **clean** (durably acknowledged), via a new runtime-only,
never-serialized `Store.pending map[string]struct{}` set keyed by `GrantID`. Every production
`persistLocked()` call site now goes through a new `persistLockedAcknowledging()` wrapper, which
clears every pending entry — not just the one being mutated — on any successful call, since a
successful write always serializes the full, current `byDigest` map and therefore necessarily included
every still-pending Grant's unchanged content (the outcome/reason-mismatch rejections already in place
since R3 guarantee a pending Grant's content never silently changes without going through this same
path). `BeginOrResume`'s `BLOCKED`/`PUBLISHED` cases and `AdmitPublicationPhase`'s `PUBLISHED` case now
check pending/clean explicitly: while pending, they propagate the repair attempt's own result via two
new sentinels (`ErrBlockPersistFailed`, `ErrPublishPersistFailed`) — never the plain
`ErrBlocked`/a `PUBLISHED` snapshot, which now mean "durably acknowledged" specifically — and only
report the durable outcome once persistence actually succeeds. `MarkPublished`/`MarkBlocked` skip an
unnecessary rewrite when an identical retry is already clean. `mapGrantError` and
`publishPersistFailureReason` (`internal/server/orchestrate.go`) updated to classify the two new
sentinels distinctly, and `publishPersistFailureReason` no longer misclassifies `ErrNotFound`/
`ErrWrongState` as persistence failures. No new field was added to `Grant` or its persisted JSON shape
— `pending` is pure runtime state.

Corrected one existing R3 test per this round's own explicit requirement:
`TestOrchestrate_RetryCannotReportPublishedWithoutRepairingPersistence`'s "still obstructed" assertion
only failed on `ErrNotFound` (a condition that never actually occurs), so it silently passed even when
Orchestrate incorrectly returned `PUBLISHED` — replaced with the exact required assertion (`BLOCKED`/
`GRANT_PUBLISH_PERSIST_FAILED`, reopened Store still `IN_PROGRESS`). Verified the corrected assertion
actually fails against R3's pre-R3.1 implementation via the same revert-confirm-restore pattern used
throughout this project. 12 new tests across `internal/grant/persistence_test.go` and
`internal/server/orchestrate_persistence_test.go` — 150 Go test functions total, up from 141.
`docs/development/PUBLICATION_BROKER.md` gained a "Terminal Persistence Acknowledgement (V3.1-B
Hardening R3.1)" subsection precisely distinguishing "in-memory fail-closed terminal fact" from
"successfully acknowledged Store snapshot," without claiming `fsync`/crash/power-loss durability.
`internal/gitremote/gitremote.go`/`gitremote_test.go`, `internal/audit/**`, and `internal/githubapp/**`
confirmed byte-for-byte unchanged this round via direct file comparison against the same saved
baseline used in every prior round's confirmations.

**Explicitly deferred, not fixed in this round**: `MarkBlocked` still does not share the per-Grant
phase gate with an already-admitted publication phase — a race where Request A is admitted for push
while Request B's pre-phase failure marks the grant `BLOCKED`, and Request A still pushes anyway,
remains a known, documented, unresolved issue, queued as
`DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R3.2-LINEARIZABLE-BLOCK-TRANSITIONS`. Not weakened, hidden,
or claimed fixed by this round.

Validation: `go build`/`go vet`/`gofmt -l`/`go test -race ./...` all clean; 150/150 Go test functions
passing; `npm run test:publication-broker`, `npm run test:publication-builder` (42/42), `npm test`
(170/170), `npm run test:project-consistency` (19/19), `npm run check:project-consistency` (7/7),
`git diff --check` all clean; untracked-file whitespace/trailing-space/final-newline sweep clean. See
`.project/REVIEW_STATE.md` for the independent reviewer's findings and adjudication. No commit, push,
PR, merge, or real network publication occurred at any point in this round.

**Hardening Round 3.1.1 — terminal pending truth across all API surfaces**
(`DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R3.1.1-TERMINAL-PENDING-TRUTH-ALL-API-SURFACES`, this
pass, uncommitted, same branch): closes two API surfaces R3.1 itself missed when applying its own
pending/clean distinction. R3.1 correctly closed `BeginOrResume`'s `PUBLISHED`/`BLOCKED` cases and
`AdmitPublicationPhase`'s `PUBLISHED` case, but left `AdmitPublicationPhase`'s own `BLOCKED` case, and
`AdminHandle.Revoke`'s `PUBLISHED`/`BLOCKED` refusal cases (plus the admin socket's wire-code mapping
derived from them), returning their plain/terminal-refusal sentinels unconditionally regardless of
pending/clean status — silently conflating "fail-closed in memory" with "durably acknowledged." All
three findings reproduced deterministically before fixing (real file-backed Store, real `<path>.tmp`
directory obstruction): (A) a pending-BLOCKED grant's `AdmitPublicationPhase` returned plain
`ErrBlocked`; (B) a pending-BLOCKED grant's `Revoke` returned `ErrCannotRevokeBlocked`
(`errors.Is` true) while disk still showed `IN_PROGRESS`; (C) the identical defect for pending
PUBLISHED via `Revoke`/`ErrCannotRevokePublished`. Confirmed the two corrected existing test
assertions (which had encoded the pre-fix behavior) actually fail against genuine pre-fix
`grant.go` via the established revert-confirm-restore pattern; restored, confirmed passing.

Fixed with the identical bounded-local-repair pattern R3.1 already established elsewhere (no remote
I/O, always under the phase gate / a brief `Store.mu` hold): `AdmitPublicationPhase`'s `BLOCKED` case
now re-attempts `persistLockedAcknowledging()` while pending and propagates the repair's own result —
`ErrBlockPersistFailed` (no gate, no snapshot) on failure, plain `ErrBlocked` only once acknowledged.
`AdminHandle.Revoke`'s `PUBLISHED`/`BLOCKED` cases do the same, returning
`ErrPublishPersistFailed`/`ErrBlockPersistFailed` instead of the terminal-refusal sentinels while
pending — revocation remains denied either way (the remote effect already happened for PUBLISHED; the
decision is already made for BLOCKED), only the concealment of a still-failing Store acknowledgement
behind an also-true refusal is what's closed. `internal/server/listener.go`'s `adminRevokeErrorCode`
gained matching `GRANT_PUBLISH_PERSIST_FAILED`/`GRANT_BLOCK_PERSIST_FAILED` cases, checked before the
terminal-refusal codes, verified through the real admin Unix socket transport. No new field, no
`Store.pending`/`persistLockedAcknowledging()` redesign — purely applying R3.1's existing mechanism to
the two surfaces it missed. `internal/server/orchestrate.go` required no change this round (its
`mapGrantError` already recognized both sentinels from R3.1).

13 new tests + 2 corrected existing assertions (161 Go test functions total, up from 150).
`docs/development/PUBLICATION_BROKER.md` gained a "Terminal Pending Truth Across All API Surfaces
(V3.1-B Hardening R3.1.1)" subsection, and its R3.2-deferred-race note was updated to list R3.1.1
among the rounds that do NOT close that separate, still-unresolved race (`MarkBlocked` not sharing the
phase gate with an already-admitted phase).

**One fresh, independent read-only Codex Reviewer**, required to answer five core questions about
whether pending BLOCKED/PUBLISHED can be misreported as clean across `AdmitPublicationPhase`,
`Revoke`, and the admin socket — **all answered NO**, with file:line evidence, and explicit confirmation
clean terminal states still work correctly when later persistence is unavailable. Found 2 findings,
both adjudicated:
- **MINOR, REJECTED_WITH_REASON**: the reviewer's own sandbox could not establish byte-for-byte
  frozen-file identity or confirm `orchestrate.go` was unchanged (untracked files, no git baseline in
  its environment) — independently confirmed by Claude via direct file comparison/MD5 against the same
  saved baselines used in every prior round, the same reviewer-sandbox limitation documented
  repeatedly across this hardening series.
- **NIT, ACCEPTED**: `AdmitPublicationPhase`'s own doc comment inaccurately credited R3.1 (rather than
  R3.1.1) with closing `Revoke`'s pending/clean gap — corrected.

Validation: `go build`/`go vet`/`gofmt -l`/`go test -race ./...` all clean; 161/161 Go test functions
passing; `npm run test:publication-broker`, `npm run test:publication-builder` (42/42), `npm test`
(170/170), `npm run test:project-consistency` (19/19), `npm run check:project-consistency` (7/7),
`git diff --check` all clean; untracked-file whitespace/trailing-space/final-newline sweep clean.
The R3.2 `MarkBlocked`/phase-gate race remains explicitly documented as deferred, not fixed, not
hidden, not touched by this round. No commit, push, PR, merge, or real network publication occurred
at any point in this round.

**Hardening Round 3.2 — linearizable block transitions**
(`DEVELOPMENT-ORCHESTRATION-V3.1-B-HARDENING-R3.2-LINEARIZABLE-BLOCK-TRANSITIONS`, this pass,
uncommitted, same branch): closes the race R3.1/R3.1.1 explicitly deferred. `AdminHandle.Revoke` and
an admitted remote-effect phase (`AdmitPublicationPhase`) already competed for the same per-Grant
phase gate, but `ClientHandle.MarkBlocked` did not — so a concurrent block transition for the identical
request digest could complete while another request's admitted phase was still mid-flight, and that
request's real local push could still succeed AFTER the Grant had already become `BLOCKED`. Reproduced
directly with a real local git repo/bare remote before any fix (temporarily bypassed `MarkBlocked`'s
gate acquisition, restored the fix afterward): Request B's block completed while Request A still held
the gate; Request A's real push then still succeeded; final Grant state was `BLOCKED`; final remote
head equalled the pushed commit SHA — the exact defect this round's task described.

Fixed with two mechanically distinct entry points sharing one transition state machine
(`Store.markBlockedCore`): the existing outside-phase `ClientHandle.MarkBlocked` now acquires the
Grant's phase gate itself (mirroring `AdmitPublicationPhase`/`Revoke`), and a new
`ClientHandle.MarkBlockedInPhase(gate, grantID, reason)` lets a caller already holding an admitted
phase's gate transition to `BLOCKED` without re-acquiring the underlying non-reentrant per-Grant mutex
(which would deadlock). The supplied lease is mechanically validated — never a caller assertion —
against the exact `Store`/`GrantID` it was acquired for (`PhaseGate.leaseFor`, wrapped
`ErrInvalidPhaseLease` on any mismatch). `phaseGateState` gained an `operationMu` mutex shared by both
`Release()` and `MarkBlockedInPhase`'s liveness recheck-plus-mutation, which is what makes "`Release()`
versus a gate-bound mutation on the same lease" linearizable: whichever wins acquiring `operationMu`
first either completes its mutation entirely before the underlying mutex is ever physically unlocked,
or observes the lease as already released and mutates nothing. A late block attempt that loses the race
to an already-completed `PUBLISHED` transition (`ErrCannotBlockPublished`) now converges, outside a
phase, on the exact real `PUBLISHED` `Result` via a fresh `AdmitPublicationPhase` re-read — never a
misleading `BLOCKED` result. All 11 production block call sites in `internal/server/orchestrate.go`
rewired through a new `blockGrantResult(client, activeLease, ...)` helper (4 outside-phase sites using
the gate-acquiring path, 4 inside-Phase-A and 3 inside-Phase-B sites using the gate-bound path with
their own already-held gate) and a new `blockOutcomeReason` helper mapping every block-transition error
to a stable `errors.Is`-based code (previously every non-nil error folded into one generic
`GRANT_BLOCK_PERSIST_FAILED` catch-all).

17 new regression tests across `internal/grant/block_linearization_test.go` (new file) and
`internal/server/orchestrate_block_linearization_test.go` (new file) — 178 Go test functions total, up
from 161 — including: released/foreign/cross-Store/cross-Grant/stale-alias lease rejection, a
25-iteration `Release()`-versus-`MarkBlockedInPhase` linearizability race, concurrent-different-reasons
first-writer-wins, `Revoke`-versus-`MarkBlocked` racing to a consistent outcome, and, at the
orchestrate level, a block attempt genuinely blocking while Phase A holds the gate (converging to the
same real `PUBLISHED` result once released), a block winning before Phase A admission (zero push), a
block winning in the Phase A/B gap (already-pushed commit preserved, PR work never begins), and a block
attempt genuinely blocking while Phase B holds the gate (converging to the same real `PUBLISHED`/PR
outcome once released) — all against real disposable git repos/bare remotes and channel-based
synchronization, never sleeps for correctness. `docs/development/PUBLICATION_BROKER.md` gained a
"Linearizable Block Transitions (V3.1-B Hardening R3.2)" subsection describing the two-entry-point
design, the `operationMu` linearizability mechanism, the three valid partial-effect orderings, and the
convergence-to-real-`PUBLISHED` behavior — without claiming cross-process fencing, `fsync`, or
power-loss durability. `internal/gitremote/gitremote.go`/`gitremote_test.go`, `internal/audit/**`, and
`internal/githubapp/**` were never touched this round (confirmed via Claude's own edit log, since no
round-specific baseline copy of `internal/audit`/`internal/githubapp` exists locally to diff against —
`gitremote.go` itself independently confirmed byte-for-byte unchanged via direct comparison against the
same saved R1.1 baseline used in every prior round).

**One fresh, independent read-only Codex Reviewer**, required to answer eight core A–H questions about
block-versus-phase concurrency, deadlock, lease binding, and terminal-outcome integrity — **all
answered NO/NO/NO/NO/NO/NO/YES/YES exactly as required** (block cannot complete during an admitted
phase; a phase cannot mint a write token after a block has won the gate; no inside-phase deadlock; no
released/foreign/cross-Grant/stale lease can mutate a Grant; no late block can overwrite a completed or
pending `PUBLISHED` outcome; `Revoke` cannot be overwritten by a later block; a block legitimately wins
the Phase A→B gap preserving the already-pushed commit; all eleven production paths use the correct
API), with file:line evidence for each. Found 4 findings, all adjudicated:
- **MINOR, ACCEPTED**: the round's primary Phase-A-contention regression test asserted Request B's
  block attempt had not completed after a fixed 100ms window without first synchronizing that B had
  actually reached the block-attempt dispatch point — a scheduling-dependent false-pass window (an
  unusually delayed goroutine could pass the test even with the fix reverted). Fixed by adding a new
  test-only `Deps.testHookBeforeBlockAttempt` seam (fires in `blockGrantResult` immediately before
  dispatching to `MarkBlocked`/`MarkBlockedInPhase`) and rewriting the test to wait for that hook before
  asserting non-completion.
- **MINOR, ACCEPTED**: no orchestration-level test exercised an outside block competing with an active
  admitted Phase B (only Phase A and the Phase A/B gap were covered). Fixed by adding
  `TestBlockVersusPhaseB_CannotCompleteWhilePhaseBHoldsGate` (a new `Deps.testHookAfterPhaseBAdmitted`
  seam pauses Phase B after admission but before its PR create call; a concurrent `MarkBlocked` is
  proven not to complete until Phase B releases the gate, then converges on the exact real
  `PUBLISHED`/PR-99 outcome).
- **NIT, ACCEPTED**: `PUBLICATION_BROKER.md`'s new subsection overstated `operationMu`'s critical
  section as covering "the validation plus the actual mutation," when `leaseFor`'s `Store`/`GrantID`
  identity check actually runs before `operationMu` is acquired — only the liveness recheck and the
  mutation itself run inside it. Corrected the wording; no behavior change (the identity fields are
  immutable after acquisition, so this was a documentation precision issue, not a safety gap).
- **NIT, REJECTED_WITH_REASON**: the reviewer's own sandbox could not establish frozen-file byte
  identity for `internal/gitremote`/`internal/audit`/`internal/githubapp` (untracked files, no git
  baseline in its environment, and it also could not run `go build`/`go vet`/`go test` at all in its
  read-only sandbox this round) — the same reviewer-sandbox information-access limitation already
  documented repeatedly across this hardening series; independently confirmed via Claude's own edit log
  (only `grant.go`, `orchestrate.go`, the two new test files, and `PUBLICATION_BROKER.md` were touched
  this round) plus direct `gitremote.go` comparison against the saved R1.1 baseline.

Validation (after all 3 ACCEPTED findings were fixed, run directly by Claude): `go build`/`go vet`/
`gofmt -l` all clean; `go test ./... -timeout 60s` 178/178 passing; a full `go test ./... -race` pass
clean; `internal/grant`'s block/phase/gate/lease tests repeated `-count=50` clean; `internal/server`'s
block/phase/concurrent tests repeated `-count=30` clean; `npm run test:publication-broker`, `npm run
test:publication-builder` (42/42), `npm test` (170/170), `npm run test:project-consistency` (19/19),
`npm run check:project-consistency` (7/7), `git diff --check` all clean; untracked-file
whitespace/trailing-space/final-newline sweep clean. See `.project/REVIEW_STATE.md` for the full
itemized findings/adjudication. No commit, push, PR, merge, or real network publication occurred at any
point in this round.

**V3.1-B Closeout Pack A — composition, audit serialization, runtime path trust, input boundary
hardening** (`DEVELOPMENT-ORCHESTRATION-V3.1-B-CLOSEOUT-A-COMPOSITION-AUDIT-INPUT-BOUNDARIES`, this
pass, uncommitted, same branch): a consolidated closeout pass across six remaining source-level
blockers, delegated to three Codex implementation workers with disjoint write scopes (audit package;
config/orchestrate/main.go; protocol/listener), integrated and validated by Claude.

**A. Audit concurrent-append serialization**: `audit.Log` had no synchronization despite its own doc
comment claiming the Broker serializes all writes through one instance — concurrent `Append` calls
could race on `lastHash`, fork the hash chain, and interleave file writes. Fixed with a `sync.Mutex`
field on `Log` held across the entire `Append` operation; a failed write (confirmed via a real
filesystem obstruction, not simulated) never advances `lastHash`. 4 new tests (300-goroutine concurrent
append chain integrity, no-duplicate-`prev_hash` invariant, failed-append-does-not-advance, two
independent `Log` instances never cross-contaminate) — all clean under `-race` and `-count=20`.

**B. Production PRClient composition**: `cmd/mihver-broker/main.go`'s production `PRClientFactory`
never set `Owner`/`Repo`, so every real PR request would have targeted `/repos///pulls`; test wiring
never caught it since every test factory already hardcoded valid values. `PRClientFactory`'s type
changed to `func(token githubapp.Token, owner, repo string) githubapp.PRClient`; `runPRFinalizationPhase`
now passes the trusted `req.Envelope.Repository.Owner`/`.Name`. Separately, `internal/githubapp.PRClient`
built its `/repos/<owner>/<repo>/...` paths via unescaped `fmt.Sprintf`, and `internal/protocol` never
restricted Owner/Repo's character set — fixed (by Claude directly, since `internal/githubapp` sits
outside every worker's declared write scope but the fix is squarely required by this work package) with
`url.PathEscape` on every path segment and `url.QueryEscape`-plus-literal-`%3A` for the `head=owner:branch`
search query, so a `/`-containing value can never inject an extra path segment or query field.

**C. Broker-owned runtime path trust**: `internal/config.Config.Validate()` previously validated only
`PrivateKeyPath`'s containment; the grant store, audit log, client/admin socket paths, and Git binary
path had no trust-root check at all, letting a misconfiguration (or a model-writable-side actor) place
authorization/audit state inside the model-writable repository or dev home despite the private-key
boundary being correctly enforced elsewhere. Five new `Config` fields (`GrantStorePath`, `AuditLogPath`,
`ClientSocketPath`, `AdminSocketPath`, `GitBinaryPath`) now reuse the existing symlink-resolved
containment technique; `BrokerBinaryPath`'s check extended from writability-only to the same
symlink+containment rules, populated from `os.Executable()`. `main.go`'s `run()` validates all of this
before `grant.Open`/`audit.Open`/private-key loading/socket listen/any token mint. 20 new tests covering
every required scenario (containment inside repo/dev-home for each of the 5 fields, symlinked-ancestor
evasion, existing-file symlink/writability, relative paths, equal socket paths, missing/directory/
non-executable/symlinked/writable Git binary, a positive-control happy path).

**D. Wire and component size limits**: the client socket decoded an unbounded JSON object before any
schema/Git verification ran. Five documented constants (`MaxEnvelopeBytes`/`MaxReceiptBytes`/
`MaxManifestBytes` 1 MiB each, `MaxBundleBytes` 64 MiB, `MaxWireBytes` 96 MiB) are now enforced via a
`countingReader` beneath `io.LimitReader` for the raw wire bytes, then independent per-component
decoded-size checks in a fixed order, short-circuiting before `Orchestrate`/any `Deps` field is ever
touched. A real defect was found and fixed during implementation: the trailing-content check must use
`json.Decoder.Buffered()`, never `Decoder.More()` — `More()` can issue a further blocking read on a
still-open, non-half-closed connection (the real client, `cmd/mihver-publish`, never half-closes after
sending), which hung a legitimate request until the connection's multi-minute deadline; `Buffered()`
inspects only already-fetched bytes, never triggering further I/O. `decodeWireRequest` was additionally
narrowed to take `io.Reader` rather than `net.Conn`, letting its own large-payload boundary tests call it
directly in-process rather than over a real live socket — real end-to-end transfer of 64–96 MiB payloads
was measured to take several minutes to over eight minutes under `go test -race` purely from race
instrumentation's per-read overhead on a live, concurrently-drained socket (confirmed via a direct
in-memory-decode comparison of the identical bytes completing in single-digit seconds under the same
`-race` build) — a test-harness artifact under race instrumentation, not a defect in the size-gate logic,
and the in-process call exercises the exact same production functions byte-for-byte. Tests cover at/over
each of the 5 limits, an oversized single field, combined-under-own-limits-but-over-wire, a trailing
second JSON value, unchanged invalid-base64 behavior, and a happy path proving the gate doesn't
over-reject, all with an instrumented `TokenMinter` proving zero calls on any size rejection.

**E. Manifest cross-validation**: `PackageManifest`'s digest fields were previously only checked for
SHAPE (hex length/pattern), never proven to match the actual bytes of the envelope/receipt/bundle that
arrived alongside the manifest. `ParseRequest` now verifies, against the RAW bytes (never a re-marshaled
copy), `sha256(envelopeBytes)`/`sha256(receiptBytes)`/`sha256(bundleBytes)` equal the manifest's claimed
digests and `manifest.CommitSHA == receipt.CommitSHA`, via four new `errors.Is`-compatible sentinels,
before `ParseRequest` ever returns a usable `*Request` — since `Orchestrate` calls `ParseRequest` first,
no package import, Git verification, token mint, or Grant mutation can follow a mismatch. The REQUEST
DIGEST recipe itself is completely unchanged. 9 new tests (valid case; each of the four mismatch
sentinels individually; post-manifest single-byte tampering for envelope/receipt/bundle; byte-exact vs.
semantic-equivalence — a re-ordered/whitespace-padded but semantically identical JSON re-encoding still
fails unless the manifest digest is recomputed against the new bytes; nil-`*Request`-on-mismatch;
existing golden digest tests unaffected).

**F. R3.2 evidence correction**: `TestBlockVersusPhaseB_CannotCompleteWhilePhaseBHoldsGate` (added in
R3.2) used a `time.Sleep(20ms)` and a direct `MarkBlocked` call rather than a full second `Orchestrate`
invocation. Rewritten to mirror `TestBlockVersusPhaseA_CannotCompleteWhilePhaseAHoldsGate`'s pattern
exactly: two complete `Orchestrate` calls, Request A pausing at Phase B admission via
`Deps.testHookAfterPhaseBAdmitted` (new seam), Request B triggered via a deterministic canceled-context
pre-phase failure synchronized through the existing `Deps.testHookBeforeBlockAttempt` seam — no sleeps.
Confirms B cannot complete while A holds Phase B's gate, A creates/updates exactly one PR, both converge
on the identical `PUBLISHED` result once A releases, and exactly one PR exists at the end. Passes
`-race -count=50`.

**Frozen packages** (`internal/grant/**`, `internal/gitremote/**`) confirmed byte-for-byte unchanged
this round via direct comparison against saved baselines — no worker was granted write access to
either, and neither needed a mechanical signature-only fix.

**218 Go test functions total** (up from 178 at the R3.2 baseline; the task's own stated R3.2-baseline
figure of 175 was inaccurate — 178 is the number this round's own prior-round report and validation
runs actually recorded and is the correct comparison point). `docs/development/PUBLICATION_BROKER.md`
gained "Concurrent Append Serialization", "Runtime Path Trust", "Production PR Client Composition",
"Wire and Component Size Limits", and "Manifest Cross-Validation" subsections (all V3.1-B Closeout Pack
A), none claiming `fsync`, cross-process fencing, IN_PROGRESS TTL redesign, or any other activation-only
guarantee explicitly deferred to V3.1-C.

**One fresh, independent read-only Codex Reviewer** covering the round's 16 numbered review points and
required A–G yes/no questions — see `.project/REVIEW_STATE.md` for the full itemized findings and
adjudication.

Validation: `go build`/`go vet`/`gofmt -l` all clean; `go test ./... -timeout 300s` 218/218 passing; a
full `go test ./... -race` pass clean; the task's own required scoped test subsets (audit
concurrent/append/chain/failure `-count=20`, config path/production/runtime/socket/git, protocol
manifest/digest/commit/trailing/limit, server wire/size/manifest/composition/PhaseB/concurrent) all
clean; the Phase-B evidence-correction test repeated `-race -count=50` clean; repo-root `npm run
test:publication-broker`, `test:publication-builder` (42/42), `npm test` (170/170), `test:project-
consistency` (19/19), `check:project-consistency` (7/7), `git diff --check` all clean; untracked-file
whitespace/final-newline sweep and a secret-pattern scan both clean. The stray `.DS_Store` untracked
file present at the start of this round was removed per the task's own explicit authorization. No
commit, push, PR, merge, or real GitHub credential/network use occurred at any point in this round.

**V3.1-B Closeout Pack A.1 — canonical authority and boundary completion**
(`DEVELOPMENT-ORCHESTRATION-V3.1-B-CLOSEOUT-A1-CANONICAL-AUTHORITY-BOUNDARIES`, this pass,
uncommitted, same branch): one consolidated external-review remediation pass across five work
packages, following up on Closeout Pack A. Delegated to three Codex implementation workers with
disjoint write scopes (Worker A: canonical repository identity — `internal/repoidentity` (new),
`internal/protocol`, `internal/githubapp`, `internal/gitremote`, envelope/receipt schemas; Worker B:
runtime path disjointness — `internal/config`, `cmd/mihver-broker/main.go`, a new
`internal/server/socket_safety.go`; Worker C, run sequentially after A and B since it owns the rest
of `listener.go` — length-prefixed wire framing, `cmd/mihver-publish/main.go`,
`internal/server/listener.go`/`listener_test.go`, `orchestrate_block_linearization_test.go`),
integrated and validated by Claude, who also added one small, explicitly-authorized mechanical test
seam to `internal/grant/grant.go` (needed for Work Package 5, outside every worker's declared scope)
and reconciled the `RemoteURLBuilder` signature change across `orchestrate.go`/`main.go`/two test
files that no single worker's scope covered.

**1. Canonical repository identity**: `internal/protocol.Repository{RemoteName, Owner, Name}`
previously required only non-empty strings; the Git remote URL and PR API paths were built by raw
string concatenation. A real local TLS Git endpoint demonstrated `owner =
"expected/../../other-owner"` could target `/other-owner/target.git` instead of the authorized
repository. New `internal/repoidentity` package (a single, versioned, conservative validator —
owner: 1-39 ASCII alphanumeric-or-hyphen; repository name: 1-100 ASCII alphanumeric/`.`/`_`/`-`,
never `.`/`..`/all-dots; both categorically reject `/ \ % ? # @ :`, control/non-ASCII bytes, and
leading/trailing whitespace) is now shared by `Envelope.Validate()`/`Receipt.Validate()`,
`gitremote.BuildGitHubRemoteURL(host, owner, repo string) (string, error)` (signature changed from a
bare `string` return), and `githubapp.PRClient`'s three methods (each independently re-validating
before any HTTP request — defense in depth). `FindOpenByHead`'s query construction switched from
hand-concatenated escaped strings to `url.Values`. Schemas mirror the same constraints via JSON
Schema `pattern`/`maxLength`.

**2. Runtime path disjointness and safe socket handling**: the prior round's path validation checked
containment but not DISJOINTNESS — two of (private key, grant store, audit log, both sockets, Git
binary, Broker binary, Broker config) could alias the same real location (directly, via a symlinked
parent, or via a hardlink) without being caught. `internal/config.validateRuntimePathDisjointness`
now builds a canonical (resolved-real-parent + basename) record for each and checks every pair for
equality or `os.SameFile` hardlink aliasing. `BrokerBinaryPath` is now REQUIRED in production
(previously optional/silently-skipped-when-empty); `os.Executable()` failing at startup is now fatal
in production (`resolveBrokerBinaryPath` in `main.go`). New `internal/server/socket_safety.go`
(`safeRemoveStaleSocket`) replaces both `ServeSocket` methods' unconditional `os.Remove(path)` with a
fail-closed check: absent or a genuine Unix socket is removed; a regular file, directory, symlink,
FIFO, or device is rejected and left untouched — checked immediately before `net.Listen`, not only
during `Config.Validate()`.

**3. Length-prefixed wire protocol**: the prior round's `json.Decoder.Buffered()`-based
trailing-content check only ever saw bytes already pulled off the wire — a second value arriving on
a later, separate write was never detected, so it never actually proved "exactly one top-level JSON
value." The client socket now uses one explicit frame per connection (8-byte big-endian payload
length + exactly that many JSON bytes); `decodeWireRequest` rejects an oversized declared length
(`WIRE_REQUEST_TOO_LARGE`) from the header alone, before any payload buffer is allocated, and strict-
decodes the payload from a finite in-memory `bytes.Reader` where a second `Decode` call can never
block and therefore deterministically proves single-value-or-reject (`MALFORMED_WIRE_REQUEST`). A
truncated/zero-length header is `MALFORMED_FRAME`. `cmd/mihver-publish`'s `submit` writes the
matching frame; neither side depends on half-close/EOF timing anywhere. `decodePackageComponents`
also now bounds each component's ENCODED length against `base64.StdEncoding.EncodedLen(limit)`
before decoding, closing a gap where a single field packed near the wire ceiling could force a
decoded allocation far larger than that field's own specific limit while the total frame stayed under
`MaxWireBytes`.

**4. Deterministic Phase-B evidence**: the Phase-A/Phase-B integration tests' `100ms` non-completion
window (after a hook proving the competing goroutine had reached the block-attempt dispatch point,
but not proving it had actually entered the blocking `Lock()` call) was a real, if narrow,
scheduler-dependent gap in what it claimed to prove. A new, fully deterministic, non-sleep-dependent
proof now lives in `internal/grant`: a per-Grant `gateEntry.waiting` atomic counter (incremented the
instant `acquirePhaseGate` genuinely enters `Lock()`, decremented once it returns), exposed via
`Store.waitingForTest`, lets a new test
(`TestMarkBlocked_CannotCompleteWhileGateGenuinelyHeld_Deterministic`) spin-wait (never sleep) until
it observes real contention, then assert non-completion via an immediate non-blocking channel check —
no timing window anywhere in the positive proof. The two orchestrate-level integration tests keep
their real end-to-end (real push / real PR API) convergence-on-one-`PUBLISHED`-result structure and
their `100ms` checks, now honestly reframed as a best-effort, non-authoritative CI regression signal
pointing to the grant-package test by name as the actual proof, never re-claiming that property
independently.

**69 new Go test functions this round** (287 total, up from 218 at the Closeout Pack A baseline — one
of the 69 was added during reviewer-finding remediation, see below).
`docs/development/PUBLICATION_BROKER.md` gained "Canonical Repository Identity", "Runtime Path
Disjointness and Safe Socket Handling", "Length-Prefixed Wire Protocol", and "Deterministic Phase-B
Evidence" subsections (all V3.1-B Closeout Pack A.1). All accepted R1–R3.2 and Closeout Pack A
invariants preserved (audit append serialization, manifest raw-byte digest matching, request-bound PR
factory composition, exact remote predecessor, exact expected-OID CAS, linearizable revoke/block
transitions, persistence-truthful terminal state) — confirmed via full regression + a fresh
independent reviewer's own explicit question set. A stray `mihver-broker` compiled binary
(a `go build ./...` byproduct, never part of source) was found in the working tree during validation
and removed before the review bundle was generated.

**One fresh, independent read-only Codex Reviewer** covering the round's 16 numbered review points
and required A–J yes/no questions found 9 of 10 required answers matching exactly; it answered D
(`Can a socket startup remove a non-socket file?`) as `YES` due to an inherent `Lstat`-then-`Remove`
TOCTOU window this round's own task text explicitly pre-authorized as a residual, V3.1-C-activation-
scope gap ("do not claim this eliminates all validate-to-use races"). It found 4 findings: 1 MAJOR
(`TestMarkBlocked_CannotCompleteWhileGateGenuinelyHeld_Deterministic`'s single-snapshot check didn't
strictly prove the competing goroutine had entered `Lock()`, only that it reached the atomic counter
immediately before it) — **ACCEPTED and fixed**, since a genuine deterministic-evidence finding may
never be deferred: the test now sustains its check across `waitingSampleIterations` (20,000) real
scheduler yields after first observing contention, additionally treating any observed drop of the
waiting-counter back to zero before release as independent, unambiguous proof of a broken gate — closing
the gap without ever depending on a fixed sleep/timeout. 1 MINOR (the base64 pre-decode bound's
`EncodedLen(limit)`-based formula was imprecise by up to 2 bytes whenever a component's limit ≡ 1 mod
3, true for every limit in this file) — **ACCEPTED and fixed**: replaced with a mathematically tight
`minPossibleDecodedLen` formula (`(len/4)*3 - 2`, the smallest decoded length any base64 string of
that encoded length could represent); the residual ≤2-byte ambiguity is an information-theoretic
property of base64 encoded-length alone (impossible to close without decoding), always still caught by
the pre-existing, unconditional post-decode length check — documented precisely rather than
overclaimed as eliminated. 1 MINOR (the socket-removal TOCTOU window, same root cause as the D answer
above) — **REJECTED_WITH_REASON**: already explicitly disclosed in both the source doc comment and
`PUBLICATION_BROKER.md` as a narrowed-not-eliminated gap requiring V3.1-C's OS-identity/trusted-
directory provisioning, exactly matching this round's own explicit non-goal; not a new or
previously-hidden gap. 1 NIT (the "Deterministic Phase-B Evidence" doc section's "the instant
`acquirePhaseGate` genuinely enters `Lock()`" phrasing overstated the counter's actual placement) —
**ACCEPTED and fixed**, corrected to describe the sustained-sampling technique precisely. See
`.project/REVIEW_STATE.md` for the full itemized findings and point-by-point evidence.

Validation (after the 3 ACCEPTED findings were fixed, re-run directly by Claude): `go build`/`go vet`/
`gofmt -l` all clean; `go test ./... -timeout 300s` 287/287 passing; a
full `go test ./... -race` pass clean; the task's own required repeated-test commands
(`internal/config -run Alias|Collision|Socket|Binary|Hardlink -count=30`, `internal/server -run
Frame|Wire|PhaseB -count=50`, `internal/protocol|githubapp|gitremote -run
Repository|Owner|Repo|Target -count=30`) all clean; repo-root `npm run test:publication-broker`,
`test:publication-builder` (42/42), `npm test` (170/170), `test:project-consistency` (19/19),
`check:project-consistency` (7/7), `git diff --check` all clean; untracked-file whitespace/final-
newline sweep and a secret-pattern scan both clean. No commit, push, PR, merge, or real GitHub
credential/network use occurred at any point in this round.

**Remaining V3.1-C work** (explicitly out of scope for this task): provision the dedicated Broker OS
identity; build and install the compiled binaries outside this repository; create the GitHub App and
install its private key where only the Broker identity can read it; configure the LaunchDaemon (or
equivalent) with the client/admin socket boundary actually enforced; apply the `main` GitHub ruleset
excluding the Publication App from bypass; run one supervised end-to-end live dogfood before any real
task ever uses this path. See `docs/development/PUBLICATION_BROKER.md`'s "Human Provisioning
Checklist (V3.1-C)" for the exact ordered list.

---

**Closeout Pack A.2 — `DEVELOPMENT-ORCHESTRATION-V3.1-B-CLOSEOUT-A2-TRUST-ROOT-AND-CONTRACT-EXACTNESS`**
(this pass, uncommitted, same branch): a consolidated external-review remediation of four confirmed
defects in Closeout Pack A.1, plus one wording-only correction. Does not provision or activate the
Broker; does not implement fsync, TTL redesign, cross-process fencing, GitHub App installation,
rulesets, live dogfood, DBOS/Temporal/OPA/Decision Council. Primary scope:
`tools/publication-broker/internal/config/config.go` (+ 2 new test files),
`tools/publication-broker/internal/server/listener.go` (+ 1 new test file),
`schemas/dev/publication-envelope.schema.json`/`publication-receipt.schema.json` (+ 1 new Node/AJV
test file, + 1 new Go matrix test), `tools/publication-broker/internal/grant/grant.go`/
`block_linearization_test.go`, `tools/publication-broker/internal/server/orchestrate_block_linearization_test.go`
(wording only), `docs/development/PUBLICATION_BROKER.md`, `package.json` (one new npm script), this
file, `.project/REVIEW_STATE.md`.

**Work Package A (absolute canonical trust roots)**: `RepositoryModelWritableRoot`/
`DevelopmentUserHome` were only required non-empty. A relative trust root remains relative after
`filepath.EvalSymlinks`; comparing it to an absolute protected path via `filepath.Rel` then fails, and
the pre-fix `isInside` converted that failure to `false` ("not inside") — so a protected path
genuinely inside the repository/home could be accepted merely because its trust root was supplied
relatively. Reproduced directly before fixing (a real key placed genuinely inside a real repository
root, with that root supplied as a relative path, was accepted by the pre-fix `isInside`/`filepath.Rel`
combination). Fixed: both roots are now validated once, up front in `validateProduction` (before any
protected-path check and before any protected resource is opened), via a new `validateTrustRoot`/
`resolveTrustRoots` pair requiring non-empty, absolute, resolvable (`EvalSymlinks`), existing-directory
roots, returned as a `trustRoots` value threaded through every downstream check instead of re-resolved
per call. `isInside` now returns `(bool, error)`; every caller (via a new `checkContainment` helper)
fails closed on a comparison error instead of treating it as "outside." 19 new tests in
`internal/config/config_trust_root_test.go` (relative-root-with-genuinely-inside-key/runtime-paths,
relative-dev-home, missing root, regular-file root, FIFO root, safe-absolute-roots positive control,
trust-root-validation-runs-before-any-protected-resource-is-opened, `isInside`'s own
comparison-error-fails-closed and ordinary-containment unit tests) — all confirmed to fail against the
pre-fix code before the fix was applied, then confirmed passing after.

**Work Package B (derived grant persistence path disjointness)**: grant persistence writes to
`GrantStorePath + ".tmp"` and renames it over `GrantStorePath` (`internal/grant.Store.persistLocked`),
but `validateRuntimePathDisjointness` compared only the CONFIGURED paths — so
`AuditLogPath == GrantStorePath+".tmp"` passed validation even though a real `AdminHandle.Create` then
writes through the configured audit path and renames it over the Grant Store. Fixed: a new
`grantTempPath` helper (single source of truth for the derivation, mirroring `grant.go`'s own
`s.path + ".tmp"`) is folded into the same pairwise `validateRuntimePathDisjointness` comparison every
other protected path already goes through, plus a new `validateGrantTempPathNode` classifying whatever,
if anything, sits at that exact path (absent or a safe non-writable regular file accepted — this
implementation does not attempt content recovery, `persistLocked`'s own `os.WriteFile` simply
overwrites it; symlink/directory/FIFO/device/group-or-world-writable-regular-file rejected outright;
hardlink aliasing to another protected existing file is caught by the existing `os.SameFile` pairwise
check). 14 new tests in `internal/config/config_grant_temp_path_test.go`, including a "real operational
regression" test (`TestGrantPersistence_RealOperationalRegression`) that, beyond confirming
`Config.Validate` rejects the vulnerable configuration, uses a REAL `internal/grant.Store` and a real
`AdminHandle.Create` to demonstrate the actual consequence being prevented: the colliding "audit log"
path is genuinely consumed (renamed away) by grant persistence.

**Work Package C (JSON Schema / Go validator parity)**: both publication schemas' `remote_name`
pattern checked only the FIRST character against `-`, so a one-character `/`, `\`, whitespace, `\n`,
`@`, `:`, `?`, or `[` passed schema validation while `internal/repoidentity.ValidateRemoteName`
correctly rejects every one of them. Fixed: the first-character class now excludes the full disallowed
set (control/whitespace bytes, non-ASCII, and the nine special characters), not merely `-`, in both
`schemas/dev/publication-envelope.schema.json` and `publication-receipt.schema.json`. A shared literal
parity matrix (`remoteNameParityMatrix`) exists once in
`tools/publication-broker/internal/repoidentity/repoidentity_test.go` (checked against the real Go
validator, new `TestValidateRemoteName_ParityMatrix`) and once, kept in sync, in
`tests/dev/publication-remote-name-parity.test.mjs` (checked against the actual AJV 2020-12 validation
path for both schemas, plus a full-document sanity check) — 37/37 Node-side cases passing. New npm
script `test:publication-remote-name-parity`.

**Work Package D (canonical standard padded base64)**: `decodePackageComponents` used
`base64.StdEncoding.DecodeString` directly, which silently skips embedded CR/LF bytes (confirmed
empirically: `"aGVs\nbG8gd29ybGQ="` decoded without error) and, in non-`Strict` mode, accepts a final
quantum with non-zero unused padding bits — neither round-trips through
`base64.StdEncoding.EncodeToString`. Fixed with a new `decodeCanonicalBase64` helper implementing the
required exact order: reject embedded CR/LF, require encoded length to be a positive multiple of 4,
decode with `base64.StdEncoding.Strict()`, then require re-encoding the decoded bytes to reproduce the
original input byte-for-byte — any mismatch is `MALFORMED_BASE64`, with no Orchestrate call, no Grant
lookup, no token mint, and no logging of rejected payload content. 5 new tests in
`internal/server/canonical_base64_test.go` covering the pure decision function (rejecting embedded
LF/CRLF, missing/extra padding, URL-safe alphabet, invalid alphabet, non-zero padding bits, empty
string, non-multiple-of-4 length; accepting canonical forms across a range of sizes including exact
component-size boundaries) and the real client-socket wire path (noncanonical input rejected with zero
token mints; a canonical, exactly-at-limit component still reaches Orchestrate).

**Work Package E (evidence claim accuracy)**: the Closeout Pack A.1 stress test proving `MarkBlocked`
cannot complete while another goroutine holds the same Grant's phase gate was named and documented as
a "deterministic proof," including in its own test name
(`TestMarkBlocked_CannotCompleteWhileGateGenuinelyHeld_Deterministic`) and in
`docs/development/PUBLICATION_BROKER.md`'s "Deterministic Phase-B Evidence" section — overclaiming a
guarantee the underlying mechanism (repeated `runtime.Gosched` sampling of a counter) cannot actually
establish, since Go's `sync.Mutex` exposes no API to observe "a goroutine has registered inside my
internal wait queue." Fixed by renaming the test to
`..._UnderSustainedYieldStress` and rewriting every "deterministic proof"/"deterministic in practice"
claim (in `internal/grant/grant.go`, `internal/grant/block_linearization_test.go`,
`internal/server/orchestrate_block_linearization_test.go`, and the doc section, renamed "Sustained
Phase-B Block Evidence") to describe it precisely as sustained stress evidence across thousands of real
scheduler yields, with the outer timeout named explicitly as a deadlock guard, never part of the
positive evidence. The structural fact that `MarkBlocked`/`MarkBlockedInPhase`/`AdmitPublicationPhase`/
`Revoke` all resolve the identical per-`GrantID` gate via `Store.gateFor`/`acquirePhaseGate` — confirmed
by direct source inspection — is retained and now stated as complementary evidence rather than folded
into an overclaimed single "proof." The two-full-`Orchestrate`-calls-converge-on-one-`PUBLISHED`-result
integration tests and their honest "best-effort, non-authoritative" framing are unchanged; no claim is
made that either the grant-package test or the integration tests proves goroutine registration in the
runtime's wait queue. No production locking or authority behavior changed in this work package.

**Validation (run directly by Claude)**: from `tools/publication-broker/`: `go build ./...`,
`go vet ./...`, `gofmt -l .` all clean; `go test ./...` 320/320 test functions passing across every
package; `go test -race ./...` clean; `go test ./internal/config -run
'TrustRoot|Relative|Derived|Temp|Alias|Collision'` and the same set at `-count=30`, `go test
./internal/repoidentity ./internal/protocol`, `go test ./internal/server -run
'Base64|Canonical|Size|Wire|Frame'` and at `-count=50`, `go test ./internal/grant -run
'Block|Gate|Waiting|Concurrent'` and at `-count=30` all clean with zero flakiness observed. From the
repository root: `npm run test:publication-broker`, `npm run test:publication-builder` (42/42), `npm
run test:publication-remote-name-parity` (37/37, new), `npm test` (170/170), `npm run
test:project-consistency` (19/19), `npm run check:project-consistency` (7/7), `git diff --check` all
clean; a whitespace/trailing-space/final-newline sweep of every file touched or added this round found
nothing to fix; a secret-pattern scan of the same files found nothing. A full external review bundle
(complete tracked+untracked diff, no Git index mutation) was generated at
`/tmp/mihver-v3.1-b-closeout-a2-review-bundle.patch` for external inspection.

**One fresh, independent read-only reviewer**, given no prior context from this task and required to
answer the round's six core questions (A–F) with file:line evidence and to independently run the full
build/vet/test/race suite — see `.project/REVIEW_STATE.md` for its verbatim findings and Claude's
adjudication of each.

**Provenance note (added by the Provenance Correction task):** this reviewer was a Claude/Sonnet
`general-purpose` subagent (the `Agent` tool), not an actual Codex MCP invocation. No
`mcp__codex__codex` call was made anywhere in Closeout Pack A.2. See
`DEVELOPMENT-ORCHESTRATION-V3.1-B-PROVENANCE-CORRECTION-AND-CODEX-VERIFICATION`'s own entry below for
the first actual Codex MCP Verifier/Reviewer invocations on this branch.

No commit, push, PR, merge, credential use, or real publication occurred at any point in this round.

---

**Closeout Pack A.2.1 — `DEVELOPMENT-ORCHESTRATION-V3.1-B-CLOSEOUT-A21-FINAL-SOURCE-BOUNDARY`**
(this pass, uncommitted, same branch): a consolidated external-review remediation of Closeout Pack
A.2, closing five confirmed defects/hygiene issues. Does not provision or activate the Broker; no
commit/push/PR/merge. Primary scope: `cmd/mihver-broker/main.go`/`main_test.go`,
`internal/config/config.go` (+1 new test file), `internal/protocol/protocol.go` (+1 new test file),
both publication schemas (+ astral cases in the existing Node/AJV and Go parity matrices),
`docs/development/PUBLICATION_BROKER.md`, this file, `.project/REVIEW_STATE.md`. Local-only:
`.git/info/exclude` (untracked, not part of any patch). Forbidden-and-confirmed-untouched:
`internal/grant/**`, `internal/gitremote/**`, `internal/audit/**`, `internal/githubapp/**`,
`internal/server/orchestrate*.go`.

**Work Package A (remove test-mode bypass from the privileged binary)**: `cmd/mihver-broker` exposed
a public `--mode=production|test` flag. `config.ModeTest` skips every production-only path/host rule
(by design, for `internal/config`'s own package-level unit tests), but this main still unconditionally
wired up real `api.github.com`/`github.com`-targeting dependencies (`TokenMinter`, `GitRemote`,
`PRClientFactory`) regardless of which mode was selected — so an operator who merely passed
`--mode=test` got a live-credential-capable process with every fail-closed containment/host check
silently disabled. Fixed: the `--mode` flag is gone entirely; `run()` always composes
`config.Config{Mode: config.ModeProduction, ...}`; `resolveBrokerBinaryPath` no longer takes a mode
parameter and unconditionally fails closed on an `os.Executable()` error. `config.ModeTest` itself
still exists (unchanged) purely for `internal/config`'s own package-internal Go unit tests. 7 new tests
in `main_test.go`, several of them structural source-inspection checks (no `--mode` flag registered;
every `Mode:` field literal is `config.ModeProduction` or derives from it; `cfg.Validate()` is called
exactly once, unconditionally, and textually precedes `grant.Open`/`audit.Open`/`loadRSAPrivateKey`;
`ModeTest` is never referenced in this binary's actual code; no `Mode ==` branch exists anywhere in the
file) — a deliberate choice given `run()` itself cannot safely be invoked from a unit test (real
`flag.Parse()` against process args, real sockets served forever once past validation).

**Work Package B (require regular protected file nodes)**: `validatePrivateKeyPath`,
`validateStoreFilePath` (GrantStorePath/AuditLogPath), and `rejectWritableByOthers` (BrokerConfigPath)
checked only "not a symlink" plus permission bits — a FIFO, Unix domain socket, directory, or device
node created with safe permission bits (e.g. 0600) would have passed undetected, since none of those
checks inspected the node's TYPE. Fixed: all three now additionally require `info.Mode().IsRegular()`
for any EXISTING node at that path (absence remains accepted for GrantStorePath/AuditLogPath, which the
Broker may create; PrivateKeyPath must still exist; BrokerConfigPath, when configured, must still exist
— both unchanged pre-existing requirements). 24 new tests in the new
`internal/config/config_regular_node_test.go`, covering FIFO/Unix-socket/directory/symlink/
group-world-writable rejection and regular-safe/absent acceptance for each of the four paths, plus
bounded (2-second-deadline) tests proving `Config.Validate` rejects a FIFO at
PrivateKeyPath/GrantStorePath/AuditLogPath without ever blocking — `os.Lstat` is metadata-only and
never opens the node, so rejection happens before `grant.Open`/`audit.Open`/`loadRSAPrivateKey` could
ever be reached (see Work Package A's ordering proof) or could ever attempt to open a FIFO with no
peer.

**Work Package C (close astral Unicode schema parity)**: Closeout Pack A.2's own fix for `remote_name`
used a negated range (`[^\x00-\x20\x7f-￿...]`) to exclude non-ASCII code points, but JSON Schema
regex engines are Unicode-CODE-POINT-aware (AJV compiles `pattern` with the `u` flag) — a code point
ABOVE U+FFFF (an astral character like 😀 U+1F600 or 𐀀 U+10000) is simply not a member of the range
`[\x7f,￿]` at all, so the negated class did not exclude it, and both schemas silently ACCEPTED an
astral `remote_name` that `internal/repoidentity.ValidateRemoteName` correctly rejects. Confirmed
empirically (AJV compiled against the actual pre-fix pattern accepted 😀/𐀀/𝕒) before fixing. Fixed by
replacing the negated-range approach with a POSITIVE printable-ASCII range,
`^(?!-)(?!.*[/\\~^:?*\[@])[\x21-\x7E]+$`, in both `schemas/dev/publication-envelope.schema.json` and
`publication-receipt.schema.json` — an astral code point can never be a member of `[\x21,\x7E]`
regardless of internal representation, so it always fails to match, closing the gap without relying on
any upper-bound range at all. Verified against the full required 21-case matrix (the existing 15 plus
😀/𐀀/𝕒) through the actual AJV validation path, all 21 agreeing exactly with
`ValidateRemoteName`. The shared parity matrix in both
`tests/dev/publication-remote-name-parity.test.mjs` (44/44 passing, up from 37) and
`internal/repoidentity/repoidentity_test.go`'s `remoteNameParityMatrix`/`TestValidateRemoteName_ParityMatrix`
gained the three astral cases identically; one new full-document AJV sanity test added for an astral
`remote_name`. The Go validator itself was not weakened or touched.

**Work Package D (exactly one JSON value per artifact)**: `internal/protocol.strictDecode` used
`dec.More()` to detect trailing data after the first JSON value — unsound for that purpose, since
`More` reports whether ANOTHER JSON VALUE could be decoded next, not merely whether unconsumed bytes
remain. Confirmed empirically before fixing: `dec.More()` returned `false` (i.e. "accept") for input
shaped like `{...}]` or `{...}}` immediately following a valid top-level object — a lone `]`/`}` is not
itself the start of a value `More` looks for, so real leftover bytes went completely undetected (a
second full JSON object, or unrelated trailing garbage, WAS already correctly caught by the pre-fix
code — only the bare-delimiter case was the actual gap). Fixed by decoding a second time into
`new(struct{})` and requiring that second `Decode` to return exactly `io.EOF` — mirroring the identical
pattern `internal/server/listener.go`'s own wire-request decoder already used for the same purpose, so
this repository now has one consistent trailing-data idiom rather than two. Applied centrally (single
shared `strictDecode` implementation `ParseEnvelope`/`ParseReceipt`/`ParseManifest` all call). 19 new
tests in the new `internal/protocol/strict_json_test.go`: a shared table-driven contract
(`assertStrictArtifactContract`) exercising all five required cases (whitespace passes; second object,
trailing `]`, trailing `}`, and trailing garbage all reject) applied identically to Envelope, Receipt,
and Manifest, plus unknown-field rejection tests for Receipt and Manifest (Envelope's was
pre-existing), plus one explicit happy-path regression test confirming `ParseRequest`'s manifest
cross-validation and request-digest recipe are unchanged by this round.

**Work Package E (local Claude permission file must not enter the PR)**: `.claude/settings.local.json`
is useful local developer configuration (already untracked, never committed) but was still appearing
in `git status --short`/`git ls-files --others --exclude-standard` and therefore in every review
bundle generated by copying that listing. Fixed by adding `**/.claude/settings.local.json` to the
repository-local `.git/info/exclude` (itself untracked, never part of any commit or patch) — its local
content is completely untouched; it is simply no longer treated as an untracked *project* file.
Confirmed: `git status --short` and `git ls-files --others --exclude-standard` no longer list it or
any `.claude` entry at all (every other file under `.claude/` was already covered by pre-existing
exclude rules), and the regenerated review bundle contains zero references to it.

**Evidence correction**: the actual, source-derived Go test-function count for this branch is now
**353** (`go test -list '.*' ./...` summed across every package), up from Closeout Pack A.2's own
correctly-measured baseline of **320** — a delta of **+33** this round (`internal/config` 76→98 = +22;
`internal/protocol` 22→28 = +6; `cmd/mihver-broker` 3→8 = +5; `internal/repoidentity`'s existing
parity-matrix test gained 3 new matrix entries without adding a new `Test` function, so its own count
is unchanged at 25; `internal/grant`/`internal/server` unchanged, confirming no behavioral change
leaked into forbidden scope).

**Validation (run directly by Claude)**: from `tools/publication-broker/`: `go build ./...`,
`go vet ./...`, `gofmt -l .` all clean; `go test ./...` 353/353 passing across every package; `go test
-race ./...` clean; the required scoped commands (`./cmd/mihver-broker -run
'Mode|Production|Executable|Bypass'`, `./internal/config -run
'Regular|FIFO|Socket|Directory|Device|Key|Store|Audit'`, `./internal/protocol -run
'Strict|Trailing|Envelope|Receipt|Manifest'`) all clean. From the repository root: `npm run
test:publication-remote-name-parity` (44/44, up from 37), `npm run test:publication-broker`, `npm run
test:publication-builder` (42/42), `npm test` (170/170), `npm run test:project-consistency` (19/19),
`npm run check:project-consistency` (7/7), `git diff --check` all clean; a whitespace/trailing-space/
final-newline sweep and a secret-pattern scan of every file touched or added this round both clean. A
full external review bundle (complete tracked+untracked diff, zero Git index mutation, confirmed zero
references to `.claude/settings.local.json`) was generated at
`/tmp/mihver-v3.1-b-closeout-a21-review-bundle.patch`.

**One fresh, independent read-only reviewer**, given no prior context from this task and required to
answer this round's six core questions (A–F) with file:line evidence and to independently run the full
build/vet/test/race suite — see `.project/REVIEW_STATE.md` for its verbatim findings and Claude's
adjudication of each.

**Provenance note (added by the Provenance Correction task):** this reviewer was a Claude/Sonnet
`general-purpose` subagent (the `Agent` tool), not an actual Codex MCP invocation. No
`mcp__codex__codex` call was made anywhere in Closeout Pack A.2.1 either. See
`DEVELOPMENT-ORCHESTRATION-V3.1-B-PROVENANCE-CORRECTION-AND-CODEX-VERIFICATION`'s own entry below for
the first actual Codex MCP Verifier/Reviewer invocations on this branch.

No commit, push, PR, merge, credential use, or real publication occurred at any point in this round.

---

**Source Merge Preparation — `DEVELOPMENT-ORCHESTRATION-V3.1-B-SOURCE-MERGE-PREPARATION`** (this
pass, same branch): closes external review of the Publication Broker source
(R1 → R1.1 → R2 → R2.1 → R3 → R3.1 → R3.1.1 → R3.2 → Closeout Pack A → A.1 → A.2 → A.2.1) and
prepares the reviewed source for a **local commit only**. Scope for this task: durable project state
(`.project/CURRENT_TASK.md`, `.project/REVIEW_STATE.md`, `.project/CONTEXT_INDEX.md`),
`docs/development/PUBLICATION_BROKER.md`'s status section, plus the local commit itself.

**External review closure recorded**: Closeout Pack A.2.1's external patch-review bundle
(`mihver-v3.1-b-closeout-a21-review-bundle.patch`) verdict is
`CLOSEOUT_A.2.1_EXTERNAL_PATCH_REVIEW = PASS`. Exact evidence: SHA-256
`6c90cc87249056a49b46f356ef69aa2fd239546495805cf868041550df0646e9`, 1,055,327 bytes, 20,530 lines, 63
diff sections (10 tracked + 53 untracked), actual top-level Go test-function count **353** (up from the
Closeout Pack A.2 baseline of 320, a delta of **+33** this round — see that round's own entry above for
the per-package breakdown). Source status: **MERGE CANDIDATE**, source only. Activation status:
**NOT PROVISIONED / NOT ACTIVATED** — unchanged, see `docs/development/PUBLICATION_BROKER.md`'s
updated Status section for the full source-vs-activation distinction and the still-explicit V3.1-C
provisioning checklist (dedicated OS identity, trusted-directory ownership/ACLs, GitHub App
creation/installation, private-key installation, GitHub ruleset + no-bypass verification,
LaunchDaemon/service provisioning, fsync/parent-directory durability decision, restart/unknown-effect
reconciliation, IN_PROGRESS TTL policy, global STOP/cross-process fencing, one supervised live
dogfood — none of these are touched by this task).

**On the task prompt's own race-test provenance claim**: this task's own prompt asserted that "the
external environment did not complete the entire all-package race suite within its execution limit."
This session has no actual record of a separate external bundle-extraction environment ever running —
the only race validation this project has direct evidence of is (a) Claude's own direct
`go test -race ./...` runs during Closeout Pack A.2 and A.2.1, both full, complete, and clean, and (b)
both independent reviewer subagents' own full `go test -race ./...` runs, also reported complete and
clean (see `.project/REVIEW_STATE.md`'s Closeout Pack A.2/A.2.1 entries). Per this project's own
review-protocol discipline (never invent or assume an outcome that wasn't actually observed), this
entry records what was actually observed rather than the unverified claim, while still treating this
task's own repository-run `go test -race ./...` (below) as the mandatory pre-commit gate regardless.

**Publication policy conflict — push and PR creation refused**: this task's own instructions asked
Claude to `git push` the branch and open/update a pull request. Per `CLAUDE.md`'s "Publication"
section and `docs/development/AGENT_POLICY.md`'s "Push"/"Pull Requests" sections (both permanent,
frozen policy documents), **remote publication automation is unconditionally NOT AVAILABLE — "regardless
of what a task's own Publication fields say"** — and this is explicitly not a rule any task prompt can
opt back into, including this one. Claude therefore performed the durable-state edits, final
validation, and (once validation passed) a single local commit — all of which the task legitimately
authorized and which policy permits Claude to do directly — but did **not** run `git push` or
`gh pr create`. Pushing this commit and opening the PR remain exclusively human manual actions from
this local commit, exactly as under every prior round on this branch.

**Provenance note (added by the Provenance Correction task):** this task's own final validation
(`go build`/`go vet`/`gofmt -l`/`go test`/`go test -race`, plus every repo-root npm script) was run
directly by Claude, with no Codex delegation considered at all — a real, acknowledged gap, since this
work is Verifier-role-shaped per `docs/development/CODEX_ROLES.md` and should have at least been
offered to an actual Codex Verifier. No exception was named in this task's own report for that choice,
which `docs/development/AGENT_POLICY.md`'s "Claude Responsibilities" requires when substantial
role-mapped work is done directly instead of delegated. See
`DEVELOPMENT-ORCHESTRATION-V3.1-B-PROVENANCE-CORRECTION-AND-CODEX-VERIFICATION`'s own entry below for
the first actual Codex MCP Verifier/Reviewer invocations on this branch, and
`docs/development/AGENT_POLICY.md`'s new mandatory-Codex-routing rule this task adds.

**Validation, commit inventory, and final commit details**: see this task's own final report (not
duplicated here) for exact command-by-command results, the reviewed-source hash-freeze
before/after comparison, the staged-diff review, and the resulting commit SHA.

No push, PR, merge, credential use, or real publication occurred at any point in this task.

---

**Provenance Correction and Mandatory Real-Codex Verification —
`DEVELOPMENT-ORCHESTRATION-V3.1-B-PROVENANCE-CORRECTION-AND-CODEX-VERIFICATION`** (this pass, same
branch, amends the unpushed local commit). Corrects an execution-provenance gap: Closeout Pack A.2,
A.2.1, and Source Merge Preparation's "independent reviewer"/direct-validation work never actually
invoked Codex — Closeout A.2/A.2.1 used Claude/Sonnet `general-purpose` `Agent` subagents (not Codex),
and Source Merge Preparation ran validation directly with no delegation considered at all. This task
does not dispute that finding (supplied directly by the human) and corrects the record — see the
"Provenance note" additions on each of those three entries above.

**ACTUAL CODEX MCP VERIFICATION** (first real Codex MCP invocation on this branch): tool
`mcp__codex__codex`, role CODEX VERIFIER, one invocation, completed. Confirmed exact HEAD
(`7c57b0ed35336c4b932a75ba2fcfa49cbdc16cd9`) before running anything. Results:
`git status --short` PASS (clean); `git diff HEAD^ HEAD --check` PASS; `go build ./...` PASS;
`go vet ./...` PASS; `gofmt -l .` PASS (no files listed); `npm run test:publication-remote-name-parity`
PASS (44/44); `npm run test:publication-builder` PASS (42/42); `npm test` PASS (170/170 fixtures);
`npm run test:project-consistency` PASS (19/19); `npm run check:project-consistency` PASS (7/7).
`go test ./...`, `go test -race ./...`, and `npm run test:publication-broker` (which wraps the same
`go test ./...`) were **NOT RUN — ENVIRONMENT LIMITATION**: the Codex sandbox prohibited TCP and Unix
domain socket binding (`listen tcp6 [::1]:0: bind: operation not permitted`), affecting exactly 2 of
the module's packages that create real sockets in their own tests (9 packages `ok`, 4 `[no test
files]`) — the same category of sandbox capability gap already documented for this Broker's prior
Codex Verifier/Reviewer rounds (R1-A.2.1). Codex self-identified as "Codex, based on GPT-5"; no more
specific runtime/build identifier was exposed to it.

**CLAUDE-RUN** (per this task's own labeling requirement — never presented as a Codex result): Claude
directly re-ran the two sandbox-blocked commands fresh (not from cache): `go test ./...` — PASS,
353/353 test functions across every package; `go test -race -count=1 ./...` — PASS, clean, full
coverage including the 2 socket-dependent packages Codex's sandbox could not reach; `npm run
test:publication-broker` — PASS (wraps the same clean `go test ./...`).

**ACTUAL CODEX MCP REVIEW** (first real Codex MCP review on this branch): tool `mcp__codex__codex`,
role CODEX REVIEWER, one invocation, completed, read-only (no file writes, no build/test execution).
Confirmed exact HEAD before reviewing; reviewed the actual `git diff
02f55522542591f518ebc4b2ec56e8350a02e8bc HEAD` diff directly. Verdicts across the 10 required axes:
8 PASS (publication authority boundaries; repository/branch/commit binding; exact-OID remote CAS;
runtime path trust boundaries; manifest/canonical artifact binding; credential/local-permission-file
leakage — confirmed zero secrets/keys/`.claude/settings.local.json` content in the actual diff;
source-merge-vs-activation distinction), 1 PASS-with-qualification (linearizable revoke/block —
confirmed the requested linearization guarantee holds), 1 MAJOR (Grant persistence truthfulness), 1
MINOR (admin-socket wire framing). Explicit final answers, all as required: commit suitable for human
PR review (no BLOCKER) — **YES**; source NOT activation-ready — **YES**; merging grants Claude/Codex no
push/PR/merge authority — **NO** (correctly, none granted). Codex self-identified as "OpenAI Codex,
GPT-5-family runtime."

**Claude adjudication of both Codex Reviewer findings** (neither dismissed merely because the commit
already exists — both independently re-verified against the actual source):
- **MAJOR (Grant persistence truthfulness / no fsync)** — **CONFIRMED accurate, ADJUDICATED as
  already-disclosed and explicitly deferred, not a new or hidden defect.** Independently verified:
  `internal/grant/grant.go`'s own doc comment (lines 142-145) already states, in the source itself,
  "It is NOT fsync-durable: neither the temp file nor its containing directory entry is explicitly
  fsync'd, so a hard crash or power loss between the rename and the OS actually flushing that
  directory entry to disk can still lose an already-'successful' write." This exact limitation has
  been documented across every prior hardening round (R2.1 onward) as an explicit V3.1-C durability
  concern, and this task's own instructions explicitly forbid implementing fsync in this round. Not a
  BLOCKER: it does not enable any Grant bypass, unauthorized push, or unauthorized PR during ordinary
  (non-crash) operation — it is a durability gap under crash/power-loss specifically, already named as
  out of scope for source-level closure. Does not block this commit's merge-candidate status.
- **MINOR (admin-socket wire framing)** — **CONFIRMED as a genuine, new finding, not previously
  identified by any R1-A.2.1 round.** Independently verified: `internal/server/listener.go`'s
  `AdminListener.handleConn` (around line 422) decodes with a bare `json.NewDecoder(bufio.NewReader
  (conn)).Decode(&op)` — no explicit wire-size limit, unlike the extensively bounded unprivileged
  client socket (`MaxWireBytes`, per-component limits, canonical base64). Correctly classified MINOR,
  not MAJOR/BLOCKER: the admin socket is privileged-local-only (`0600`, reachable only by the Broker's
  own admin identity once provisioned), so this is an availability/robustness gap for a trusted local
  caller, not an unprivileged-actor publication-boundary bypass. **ACCEPTED, explicitly DEFERRED** —
  not fixed in this task (which forbids changing Publication Broker source), flagged here as a
  legitimate candidate for a future hardening round (a bounded wire-size limit on the admin socket,
  mirroring the client socket's own).

**EXTERNAL CHATGPT REVIEW** (human-supplied fact, recorded as reported, not independently verified by
Claude or Codex in this session): per the task author, an external ChatGPT-based review extracted and
tested the uploaded Closeout Pack A.2.1 review bundle. The non-race Go suite passed in that external
environment; focused race tests for the modified/security-relevant packages passed; the external
environment did not complete the entire all-package `go test -race ./...` within its execution-time
limit. This is recorded as a distinct evidence source from Claude's own direct validation and from the
actual Codex MCP verification/review above — none of the three are conflated with each other.

**Evidence-source summary for this branch, kept distinguishable per this task's own requirement**:
- **EXTERNAL CHATGPT REVIEW** — human-supplied, non-race suite passed, full race suite not completed
  within its execution limit (see above).
- **CLAUDE DIRECT VALIDATION** — repository-local full `go test -race ./...` run directly by Claude
  during Closeout Pack A.2, A.2.1, Source Merge Preparation, and this task, always complete and clean.
- **ACTUAL CODEX MCP VERIFICATION** — this task's own Codex Verifier invocation (above); full
  non-race/vet/fmt/npm suite PASS, `go test`/`go test -race` NOT RUN due to sandbox socket
  restrictions, backfilled by a labeled CLAUDE-RUN.
- **ACTUAL CODEX MCP REVIEW** — this task's own Codex Reviewer invocation (above); 8 PASS, 1
  PASS-with-qualification, 1 MAJOR (already-disclosed, deferred), 1 MINOR (new, accepted, deferred).

**Source hash preservation**: 61 files hashed under `tools/publication-broker/`, `schemas/dev/`,
`tests/dev/`, `scripts/dev/` before any project-state edit in this task
(`/tmp/mihver-v3.1-b-pre-provenance-source.sha256`), re-hashed after — **identical, zero drift** (see
this task's own final report for the exact comparison).

**Amendment**: this task amended the unpushed local commit `7c57b0e` (never pushed, so amending it is
not a shared-history rewrite) to fold in these provenance corrections and the new Codex evidence —
see this task's own final report for the resulting new commit SHA. No production source, test, schema,
or builder file was touched by the amendment; only `.project/CURRENT_TASK.md`,
`.project/REVIEW_STATE.md`, and `docs/development/AGENT_POLICY.md` (the new mandatory-Codex-routing
rule) changed.

No push, PR, merge, credential use, or real publication occurred at any point in this task.
