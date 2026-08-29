# ADR-0005: Decision Council Protocol (V1A Kernel)

## Status

Proposed

## Context

Every MIHVER task to date has been decided by a single actor — Claude, acting alone as Orchestrator
— even for R2+ risk work. That is a single point of failure for judgment: nothing today forces an
independent second (or third) opinion before a consequential decision is treated as council-grade,
and nothing binds "what was voted on" to "what actually gets acted on" with a verifiable,
tamper-evident artifact.

MIHVER's longer-term direction (see `.project/PROJECT_STATE.md`'s roadmap notes and the DecisionCouncil-BondingCommand context in prior task history) is a **Decision Council**: a small set of
independent reviewing seats that must reach quorum on an exact candidate before a decision is
treated as council-approved, with room for a later **Shadow Council** phase that runs real
model-backed seats in parallel with Claude's own judgment without yet acting on their output. This
ADR defines the protocol *foundation* only — the deterministic kernel and a non-LLM simulator that
prove the protocol is sound — so that Shadow Council, when authorized, plugs real agents into an
already-proven protocol instead of the protocol being redesigned around whichever agents show up
first.

This ADR is scoped exactly to `DECISION-COUNCIL-V1A-KERNEL-SIMULATOR`'s task prompt. It defines the
council topology, the typed artifacts that carry council reasoning, the deterministic state machine
that governs their lifecycle, the hashing/binding rules that make a decision tamper-evident, the
risk-specific quorum rules for R0–R4, and the authority boundary a `DecisionRecord` sits behind. It
does **not** define, and explicitly forbids in this phase: real provider adapters, Shadow Council,
model selection, Claude-orchestrator integration with the kernel's output, a scheduler, sandboxed
execution, an `ExecutionEnvelope`, or any autonomous action gated on a council decision. Those are
later, separately-gated phases — see "Future Work" below.

## Decision

Build a pure, deterministic, non-LLM **Decision Council kernel** plus a deterministic **fake-agent
simulator** around it. The kernel is the sole authority on protocol validity (state transitions,
hashing, quorum math); the simulator exists only to exercise the kernel with fixture data — it
models no intelligence and calls no model.

### Council topology

- Exactly **3 council seats** per decision, defined by a `CouncilConfig` (epoch identity + exactly
  3 `SeatIdentity` entries).
- The **Claude orchestrator is not a council seat**. Nothing in this kernel represents "Claude" as
  a seat, grants Claude a vote, or lets Claude's own judgment substitute for a seat's vote. Claude's
  role stops at constructing a `DecisionRequest` and the fixture/real artifacts that feed the
  kernel, and at reading the resulting `DecisionRecord` back out — never at participating in the
  vote itself.
- Council reasoning is represented **only** through the typed artifacts below, supplied to the
  kernel as data. The kernel never reasons, never calls a model, never generates a proposal or vote
  on its own.
- The kernel is deterministic non-LLM code: no `Date.now()`, no `Math.random()`, no network, no
  filesystem access, no environment reads. It is a pure function of its explicit inputs — this is
  what makes "same inputs → byte-identical output" (see Adversarial Testing in the task, and the
  test list below) a meaningful, checkable property rather than an aspiration.

### Orchestrator/council separation

The kernel exposes no API for "Claude decides" or "Claude votes." Its only inputs are: a
`DecisionRequest`, an `expectedContext` binding (see "Context freshness" below), and a sequence of
typed council events (`SUBMIT_COMMITMENT`, `REVEAL_PROPOSAL`, `FREEZE_CANDIDATE`, `CAST_VOTE`,
`FINALIZE`). Whoever constructs those events — the simulator today, a real provider adapter under a
future Shadow Council — is outside the kernel's authority boundary; the kernel only ever validates
and folds events into state.

### Decision pattern: Rotating Proposer + Two Independent Reviewers + Exact-Candidate Quorum

Exactly one of the 3 seats is the **Proposer** for a given `DecisionRequest`; the other two are
**Reviewers**. `DecisionRequest.rotationOrdinal` (a non-negative integer, orchestrator-supplied) and
`CouncilConfig.seats` (an ordered, exactly-3-entry array) together determine the Proposer
deterministically:

```text
expectedProposerSeatId = councilConfig.seats[ rotationOrdinal % 3 ].seatId
```

This is a pure function of already-known inputs — no kernel-side counter, no hidden state, no
network lookup of "whose turn it is." An orchestrator that wants proposer rotation across many
decisions over time increments `rotationOrdinal` itself between decisions; the kernel does not
track or enforce that increment across sessions, only that *within* one session the named proposer
matches this formula and only that seat may act as proposer.

Only the Proposer submits a `ProposalCommitment`/`AgentProposal`. The two Reviewer seats do not
propose in V1A's pattern — they vote on the Proposer's frozen candidate. This is what makes the
"quorum" in V1A a **review quorum over one candidate**, not a multi-candidate election; see
"Exact-candidate freezing" below for why only one candidate ever exists per decision in this
version.

### Commitment-before-reveal behavior

The Proposer's proposal content must not become visible to the Reviewer seats (or be usable to
compute the frozen candidate) before the Proposer has irrevocably committed to it. Concretely:

1. The Proposer submits a `ProposalCommitment { decisionRequestId, seatId, councilEpochId,
   commitmentHash }` — a domain-separated hash of its full proposal content, and nothing else. This
   is the only artifact the kernel will accept while the session is in `CREATED`. The recipe, reusing
   `canonicalizeJson`:

   ```text
   commitmentHash = "sha256:" + sha256( "MIHVER:DecisionCouncil:ProposalCommitment:v1\0" + canonicalizeJson(proposalContent) )
   ```

   where `proposalContent` is exactly the object the later `AgentProposal.proposalContent` will
   carry (`{ summary: string, payload: object }`) — the commitment is computable purely from content
   the seat already has in hand, with no dependency on fields the kernel itself will only assign
   later (e.g. `candidateOrdinal`).
2. Only after a commitment is recorded (session state has moved to `COMMITMENT_COLLECTION`) may the
   Proposer submit the `AgentProposal { decisionRequestId, seatId, councilEpochId, proposalContent }`
   (the full revealed content) via `REVEAL_PROPOSAL`. The kernel recomputes the same
   `commitmentHash` recipe over the revealed `proposalContent` and requires it to equal the stored
   `commitmentHash` exactly — any mismatch (`COMMITMENT_REVEAL_MISMATCH`) is rejected, the session
   state does not advance, and the revealed content is not retained.
3. Until step 2 succeeds, no accessor the kernel exposes returns the Proposer's proposal content —
   there is nothing to leak because nothing but the commitment hash has been stored yet.

The task is explicit that the simulator does not need to hide information from its own test
process — a single Node process necessarily "sees" both sides. What the kernel enforces instead is
the **protocol state transition** that represents this boundary: no code path lets `CAST_VOTE`,
`FREEZE_CANDIDATE`, or any read of proposal content succeed before `REVEAL_PROPOSAL` has succeeded,
and `REVEAL_PROPOSAL` itself is only valid from `COMMITMENT_COLLECTION`. A test process that chose
to peek at a closure variable before that point would be bypassing the kernel's own API, not
exercising it — that is out of scope for what a protocol kernel can enforce against its own host
process, and is exactly the line the task draws.

### Exact-candidate freezing

Once revealed, the kernel deterministically computes a single **`CandidateDecision`** — the exact,
frozen thing every vote must reference. `FREEZE_CANDIDATE` is a separate event from
`REVEAL_PROPOSAL` (see "Council phases" below) specifically so "voting before the candidate is
frozen" and "revealing before a commitment exists" are independently observable invalid-transition
cases, not one conflated failure mode.

There is exactly one `CandidateDecision` per decided session in V1A — the Proposer does not get a
second attempt within the same session; if its reveal fails to match its commitment, the session
simply cannot progress past `COMMITMENT_COLLECTION` (a stuck, non-terminal session is a caller-level
failure to retry with a *new* `DecisionRequest`/session, not a kernel-level "second candidate"
feature). `CandidateDecision.candidateOrdinal` is always `0` in V1A and exists only so a later
version could allow re-proposal without changing `CandidateDecision`'s shape.

### Candidate hashing

`candidateHash` is a SHA-256 hex digest, domain-separated exactly like `ProjectContextPack`'s
`contextHash` (`scripts/dev/project-context-pack.mjs:952-961`: domain string + NUL, then canonical
JSON bytes), reusing `canonicalizeJson` from `scripts/dev/canonical-json.mjs` — no competing
canonicalizer is introduced. Domain tag:

```text
MIHVER:DecisionCouncil:CandidateDecision:v1\0
```

`candidateHash` binds every field whose change could alter the decision's meaning — the full
`CandidateDecision` object (minus `candidateHash` itself) is canonicalized and hashed, including the
Proposer's full revealed `proposalContent` inline (not merely a hash-of-a-hash indirection — the
task requires binding "every field," and embedding content directly means there is only one place
meaning can drift from, not two structures that could silently decouple):

```text
CandidateDecision {
  decisionRequestId, taskId, riskClass, contextHash, repositoryHead, councilEpochId,
  proposerSeatId, candidateOrdinal, proposalContent
}
candidateHash = "sha256:" + sha256( "MIHVER:DecisionCouncil:CandidateDecision:v1\0" + canonicalizeJson(the object above) )
```

A one-byte mutation anywhere in that object — including inside `proposalContent` — produces a
different `candidateHash`. Votes bind to `candidateHash` alone, never to `proposalContent` directly
and never to an informal restatement of it: "approximately the same proposal" is not a concept this
protocol has room for.

### Vote binding

`AgentVote` carries `decisionRequestId`, `candidateHash`, `seatId`, `councilEpochId`, and
`voteValue` (`APPROVE` / `REJECT` / `ABSTAIN`). `CAST_VOTE` is rejected (and not counted) if any of:

- `candidateHash` does not exactly equal the session's frozen `CandidateDecision.candidateHash`
  (`CANDIDATE_HASH_MISMATCH`) — including the case where two different reviewers' votes reference
  two different hashes: neither forms quorum with the other, because quorum is always computed
  against the one session-frozen hash, not by comparing votes to each other;
- `decisionRequestId` does not match the session's (`DECISION_REQUEST_MISMATCH`);
- `councilEpochId` does not match the session's (`WRONG_COUNCIL_EPOCH`);
- `seatId` is not one of `CouncilConfig.seats` (`UNKNOWN_SEAT`);
- `seatId` has already cast a counted vote in this session (`DUPLICATE_SEAT_VOTE` — the first vote
  stands, the duplicate is rejected, so a seat can never count twice no matter how many times it
  votes);
- the session is not in `CANDIDATE_FROZEN` or `VOTING` state (`INVALID_STATE_TRANSITION`) — the
  first accepted vote is what moves a session from `CANDIDATE_FROZEN` into `VOTING`, so
  `CANDIDATE_FROZEN` must itself be a valid entry state for `CAST_VOTE`, not only `VOTING`; every
  other state remains invalid.

A seat that never votes is not synthesized into a vote of any kind — at `FINALIZE`, any configured
seat absent from the recorded vote set is carried into `DecisionRecord.votes` as an explicit
`voteValue: "MISSING"` entry (covering both "timeout" and "abstained by never responding") so the
audit trail is complete without that seat ever contributing to approval quorum. An explicit
`ABSTAIN` vote and an implicit `MISSING` (no vote at all) are both excluded from approval quorum,
but are recorded as observably different `voteValue`s — this is a deliberate distinction the
adversarial tests exercise separately ("abstain" vs. "timeout/missing vote representation" are two
different fixtures, not one).

### Quorum semantics (by risk class)

The `DecisionRequest.riskClass` (`R0`–`R4`) is the **sole, authoritative** input to which quorum
rule applies. Nothing in `AgentProposal` or `AgentVote` carries a risk field — there is structurally
nothing for either artifact to downgrade, because the kernel never reads risk from anywhere but
`DecisionRequest`.

- **R0** — council decision not required. `createSession` classifies the request and the session's
  terminal state is `COUNCIL_NOT_REQUIRED` immediately — no commitment/reveal/vote cycle happens at
  all, and any proposal/vote fixtures supplied alongside an R0 request are simply never consulted.
  This result authorizes no autonomous execution; it only records that council review was not the
  applicable gate for this request.
- **R1** — quorum is **≥ 2 `APPROVE` votes out of 3**, all referencing the exact same
  `candidateHash`, where the approving set additionally contains **at least 2 distinct
  (`provider`, `modelFamily`) identities** (`DIVERSITY_REQUIREMENT_NOT_MET` if not). Any seat,
  including the Proposer, may vote and count toward R1 quorum — R1 has no proposer exclusion.
- **R2** — the Proposer's vote, if any, is recorded in the audit trail but **excluded from quorum
  computation entirely**. Quorum requires **both** non-proposer (Reviewer) seats to `APPROVE` the
  exact same `candidateHash`; if either Reviewer rejects, abstains, is missing, or references a
  different hash, the session is `NO_QUORUM` regardless of what the Proposer's own vote says — a
  Proposer `APPROVE` can never substitute for a Reviewer's.
- **R3** — requires **3 of 3** seats (Proposer included) to `APPROVE` the exact same
  `candidateHash`. Even on full 3/3 approval, council approval alone is never sufficient: the
  session's terminal state is `DECIDED` but `DecisionRecord.disposition` is
  `HUMAN_APPROVAL_REQUIRED`, never a directly-actionable approval. This task does not implement
  human-approval execution — `HUMAN_APPROVAL_REQUIRED` is a recorded disposition, not a workflow.
- **R4** — deterministic hard deny. `createSession` short-circuits the same way R0 does, except the
  terminal state is `DENIED` and `disposition` is `DENIED` — no commitment/reveal/vote cycle runs,
  and any proposal/vote fixtures supplied are never consulted. No quorum outcome and no vote content
  can override this; it is checked before any council artifact is ever read.

`R1`/`R2`/`R3` share one `FINALIZE` quorum-evaluation function parameterized by risk class; `R0`/`R4`
never reach `FINALIZE` at all — they resolve inside `createSession`.

### Risk-specific disposition

`DecisionRecord.state` (the literal FSM terminal state — see below) and
`DecisionRecord.disposition` (the risk-aware semantic outcome) are deliberately two different
fields:

| state | disposition | meaning |
|---|---|---|
| `COUNCIL_NOT_REQUIRED` | `COUNCIL_NOT_REQUIRED` | R0 — no council gate applies |
| `DECIDED` | `COUNCIL_APPROVED` | R1/R2 quorum met |
| `DECIDED` | `HUMAN_APPROVAL_REQUIRED` | R3, 3/3 met — council approval insufficient alone |
| `NO_QUORUM` | `NO_QUORUM` | R1/R2/R3 quorum not met |
| `DENIED` | `DENIED` | R4 hard deny |

`state` alone would conflate R1/R2's "usable" approval with R3's "still needs a human" approval
under the same `DECIDED` label; `disposition` is what a future control plane must actually branch
on.

### Failure / no-quorum behavior

`NO_QUORUM` is a first-class terminal outcome, not an error: a session that completes voting without
meeting its risk class's quorum rule finalizes cleanly into `state: NO_QUORUM`,
`disposition: NO_QUORUM`, with `DecisionRecord.quorumDetail` and `reasonCode` naming exactly which
rule failed (e.g. `R2_REVIEWER_REJECTED`, `R1_DIVERSITY_REQUIREMENT_NOT_MET`,
`R3_INSUFFICIENT_APPROVALS`). Protocol-violation rejections (wrong hash, unknown seat, wrong epoch,
duplicate vote, malformed artifact, invalid transition) are a separate, distinct thing: they reject
the *individual event*, not the session — the session's state does not advance, the rejected event
is not recorded as if it succeeded, and the caller receives a structured `{ ok: false, errorCode,
details }` result it can act on (retry with a corrected event, or give up and report). Structurally
malformed input (fails basic shape validation against the typed-artifact contract) is rejected the
same way, as data, never thrown as an uncaught exception — a malformed fixture is exactly the kind
of input the adversarial test matrix exercises, and the kernel must reject it observably rather than
crash the caller.

### Authority boundary

A `DecisionRecord` is evidence of a council disposition — nothing more. It is explicitly **not**: an
`ExecutionEnvelope`, publication authority, merge authority, permission to mutate the repository,
permission to call tools, permission to run Claude, or permission to launch workers. Nothing in this
kernel, the simulator, or their schemas grants, implies, or gestures at any of those. This task
implements no execution gateway of any kind — a `DECIDED`/`COUNCIL_APPROVED` result is a fact about
what three typed votes said about one frozen candidate, full stop.

### Council phases (state machine)

Nine states — the eight the task names, plus `COUNCIL_NOT_REQUIRED` (the task's phase list is
explicitly "at minimum," and R0's own rule section separately requires this classification, so it is
a ninth terminal state alongside the required eight):

```text
CREATED → COMMITMENT_COLLECTION → PROPOSAL_REVEAL → CANDIDATE_FROZEN → VOTING → DECIDED
                                                                              ↘ NO_QUORUM
CREATED → COUNCIL_NOT_REQUIRED   (R0, immediate)
CREATED → DENIED                 (R4, immediate)
```

A session is admitted via `createSession(decisionRequest, councilConfig, expectedContext)`, which
validates the request's shape, the council config's shape (exactly 3 seats, distinct `seatId`, no
two seats sharing an identical (`provider`, `modelFamily`, `modelId`) triple —
`DUPLICATE_SEAT_IDENTITY`), and the context binding (below) — a request that fails admission never
enters the state machine at all and is reported as a construction-time `{ok: false, errorCode}`
result, distinct from the FSM's own terminal states. Admission that succeeds returns a session
already resolved to `COUNCIL_NOT_REQUIRED` or `DENIED` (R0/R4) or sitting in `CREATED` (R1/R2/R3),
awaiting events.

Five event types drive the remaining transitions, each valid from exactly one state and each
rejected (session state unchanged, structured error returned) from any other:

| Event | Valid from | Moves to | Effect |
|---|---|---|---|
| `SUBMIT_COMMITMENT` | `CREATED` | `COMMITMENT_COLLECTION` | records Proposer's `commitmentHash` |
| `REVEAL_PROPOSAL` | `COMMITMENT_COLLECTION` | `PROPOSAL_REVEAL` | verifies reveal hashes to the stored commitment; stores `AgentProposal` |
| `FREEZE_CANDIDATE` | `PROPOSAL_REVEAL` | `CANDIDATE_FROZEN` | deterministically computes `CandidateDecision`/`candidateHash` from already-known fields — no new external input |
| `CAST_VOTE` | `CANDIDATE_FROZEN` or `VOTING` | `VOTING` | records one seat's vote (see "Vote binding") |
| `FINALIZE` | `VOTING` | `DECIDED` or `NO_QUORUM` | applies the risk class's quorum rule |

`transitionLog` (an append-only array of `{from, to, event}` the session accumulates) makes every
phase — including the momentary `PROPOSAL_REVEAL`/`CANDIDATE_FROZEN` states a single caller might
traverse back-to-back — independently inspectable and replayable, without requiring a caller-visible
no-op event for phases that have no additional external input to wait on.

### Context freshness

`DecisionRequest` binds `contextHash` (exact `ProjectContextPack` `contextHash`, `sha256:<hex>`) and
`repositoryHead` (exact 40-hex commit SHA). `createSession` requires an explicit `expectedContext:
{contextHash, repositoryHead}` argument — supplied by the caller from whatever it already knows the
current pack/HEAD to be — and fails closed (`CONTEXT_HASH_MISMATCH` / `REPOSITORY_HEAD_MISMATCH`,
admission rejected, no session created) on any mismatch. The kernel performs no network or GitHub
lookup of its own to obtain this value; it only compares two caller-supplied strings. The simulator
proves mismatch handling with deterministic fixtures (a request whose declared context/head disagree
with the fixture "current" values) — no live repository state is involved in any test.

### Determinism

The kernel is a pure function of `(decisionRequest, councilConfig, expectedContext, event sequence)`
— no `Date.now()`, no `Math.random()`, no environment/filesystem/network access anywhere in
`scripts/dev/decision-council-kernel.mjs`. Consequently `DecisionRecord` carries no timestamp field
in V1A: a wall-clock stamp would break "same inputs → byte-identical output" unless it were itself a
caller-supplied deterministic input, and no requirement in this task needs one. A future
control-plane layer that stores a `DecisionRecord` as Run Bundle evidence is free to stamp *its own*
storage record with wall-clock time — that is outside this kernel's pure boundary.

`DecisionRecord.recordHash` is the same recipe as `candidateHash`, domain tag
`MIHVER:DecisionCouncil:DecisionRecord:v1\0`, over the full record (minus `recordHash` itself) —
proving the whole record, not just the candidate, is byte-deterministic and tamper-evident.

## Rationale

**Why a reducer/event-log kernel instead of a class with mutable methods?** `applyEvent(session,
event) → {session, error}` (session unchanged on rejection) makes every one of the required
adversarial cases — invalid transition, replay, wrong-order reveal — a direct, mechanical assertion
on a plain-data return value, with no hidden state to reset between test cases. It also matches
`scripts/dev/publication-builder.mjs`'s own idiom of returning `{status, reason}`-shaped results
rather than throwing for expected-protocol violations (Scout: `publication-builder.mjs:66-68`).

**Why embed full `proposalContent` in `CandidateDecision` instead of a content-hash indirection?**
The task requires the candidate hash to bind "every field whose change could alter the meaning of
the decision." A hash-of-a-hash chain adds a second place for content and its binding to silently
decouple (a bug that updates one but not the other); embedding directly leaves exactly one artifact
to canonicalize and hash.

**Why is `disposition` separate from `state`?** Collapsing R1/R2's immediately-usable
`COUNCIL_APPROVED` and R3's `HUMAN_APPROVAL_REQUIRED` into the same `DECIDED` state would force every
future consumer to re-derive risk-specific meaning from `riskClass` + `state` every time it reads a
record. Recording the derived meaning once, at decision time, is cheaper and less error-prone than
re-deriving it downstream repeatedly.

**Why does R1 allow the Proposer to count toward quorum but R2 doesn't?** This is the task's own
explicit specification, not a rationale this ADR invents — R1's rule is "≥ 2 approvals + provider
diversity," full stop; R2's rule explicitly separates proposer and reviewer roles. The kernel
implements both literally rather than unifying them, because unifying would silently change R1's
behavior to match R2's stricter rule (or vice versa) — exactly the kind of scope expansion
`CLAUDE.md` forbids without explicit authorization.

## Consequences

- A future Shadow Council phase can plug real provider-backed seats into this exact kernel by
  producing the same five typed artifacts (`ProposalCommitment`, `AgentProposal`, `AgentVote`, plus
  the caller-constructed `DecisionRequest`/`CouncilConfig`) — no protocol redesign, only a new
  artifact *producer*.
- `DecisionRecord`'s shape (no timestamp, explicit `recordHash`, no execution-authority fields) is
  now load-bearing for any later Run Bundle integration — a later task extending `RUN_BUNDLE.md`
  with an explicit extension point should treat this shape as a given input, not redesign it away.
- The 150-line/2-file Implementer-delegation threshold in `AGENT_POLICY.md` is far exceeded by this
  kernel + simulator + schema + test surface; per that policy, the bulk implementation is delegated
  to a Codex Implementer against this ADR as the authoritative spec, not written directly by Claude.
- R0/R4's "immediate short-circuit inside `createSession`" design means a caller cannot observe an
  R0/R4 session ever passing through `CREATED`/`COMMITMENT_COLLECTION`/etc. — this is intentional
  (matches "no quorum or model output can override" R4 literally, by never consulting one), but it
  does mean R0/R4 sessions have a visibly different shape (no `transitionLog` beyond the single
  admission step) than R1/R2/R3 sessions. A future reader of a `DecisionRecord` must not assume every
  record has a populated commitment/reveal/vote history.

## Alternatives Considered

- **Multi-candidate election** (every seat proposes, kernel picks a winner): rejected — the task's
  named pattern is "Rotating Proposer + Two Independent Reviewers," a review-quorum model, not an
  election. A multi-candidate kernel is a materially different protocol with its own tie-breaking
  and fairness questions this task does not ask for.
- **Cryptographic commit-reveal (real hiding via a separate process/actor)**: rejected for V1A — the
  task explicitly says the simulator does not need to hide information from its own test process,
  only enforce the state-transition boundary. Building real cross-process secrecy now would be
  effort spent on a non-goal; Shadow Council, with real independent provider processes, is where
  actual secrecy would matter, and this kernel does not claim to provide it (see
  "Identity/Independence" in Risks below).
- **Timestamped `DecisionRecord`**: rejected — breaks the byte-determinism the adversarial tests
  require unless the timestamp were itself a deterministic caller-supplied input with no test
  actually needing one; simplest to omit entirely in V1A.
- **Single flat JSON Schema per artifact file** (8 separate `schemas/dev/*.schema.json` files)
  instead of one file with `$defs`: rejected — the 8 types are mutually referential (votes reference
  candidates, candidates reference requests) and are always consumed together by the same kernel
  module; one coherent schema file with `$defs` matches the task's own instruction to "finalize the
  smallest coherent file plan" better than 8 small files that would need to `$ref` across files.

## Risks

- **Identity/independence is typed, not proven — and this is a hard boundary, not a soft one.** Per
  the task's own instruction ("do not claim this proves real-world provider independence... it
  proves only the typed protocol invariant that Shadow Council will later have to attest"), this
  kernel enforces exactly one identity invariant: within a single `CouncilConfig`, no two
  *registered* seats may declare an identical (`provider`, `modelFamily`, `modelId`) triple
  (`DUPLICATE_SEAT_IDENTITY`) — you cannot register the same underlying model twice under two seat
  labels to fake R1's diversity requirement. It proves **nothing** beyond that, and in particular:
  the kernel has no channel to authenticate that a submitted `ProposalCommitment`/`AgentProposal`/
  `AgentVote` actually originated from a process distinct from whatever produced any other seat's
  artifact — a single caller holding all three `SeatIdentity` records (exactly the situation this
  kernel's own simulator is in, running in one process) can construct and submit well-formed
  artifacts under all three `seatId`s, and the kernel accepts each on its own typed merits with no
  way to detect that one actor authored all three. No cryptographic signing, channel binding, or
  process-identity attestation exists anywhere in V1A — none was in scope for this task, and adding
  one now would be exactly the kind of speculative hardening the task's own Stopping Rule forbids.
  Real non-collusion/independence is a Shadow Council-era problem (real, separately-hosted provider
  processes each producing their own artifacts) that this kernel structurally cannot solve and does
  not claim to.
- **Rotation formula is not itself audited across sessions.** `rotationOrdinal % 3` is deterministic
  within one session, but nothing in this kernel prevents a caller from supplying a dishonest
  `rotationOrdinal` (e.g., always `0`, defeating rotation in practice). Cross-session rotation
  fairness is an orchestrator-level concern for a later phase, not something a stateless
  per-session kernel can enforce alone.

## Open Questions

- Should a future version persist `rotationOrdinal` state across decisions itself (making rotation
  self-enforcing) rather than trusting the caller? Left open for whichever task actually wires the
  kernel into a stateful orchestrator loop.
- Should `ABSTAIN` count differently from `MISSING` for some future risk class (e.g., an explicit
  abstain lowering effective quorum denominator)? V1A treats them identically for quorum purposes
  (both excluded, both recorded distinctly) — no requirement in this task asks for a different
  treatment, and none is added speculatively.

## Future Work

- Shadow Council: real provider-backed seats producing these exact typed artifacts, run in parallel
  with Claude's own judgment, not yet gating any action.
- A `RUN_BUNDLE.md` extension point that formally accepts a `DecisionRecord` as a typed evidence
  kind (V1A only proves this is *possible* via a test-only fixture — see the task's "Run Bundle
  Relationship" section — it does not modify `RUN_BUNDLE.md` itself).
- Whatever later phase actually authorizes council output to gate an action — an `ExecutionEnvelope`
  or equivalent — which this ADR explicitly does not define or imply.

## Acceptance Gate

**This ADR's Status is Proposed as of this writing, and this section does not change that.** It
defines, in advance, the evidence a *future* task must produce before a Status: Proposed → Accepted
change for this ADR can even be considered — mirroring `ADR-0002`'s and `ADR-0004`'s own precedent of
stating an Acceptance Gate explicitly rather than leaving "when is this Accepted" ambiguous.
`ADR-0005`'s own Acceptance decision, if and when its gate is met, remains a later, separate, explicit
human decision under the criteria below — writing this section is not that decision, and satisfying
every criterion here does not itself flip Status; it only makes the ADR *eligible* for that later,
separate human decision.

**None of the seven criteria below is satisfied by work completed as of this writing.** V1A's kernel
and simulator (frozen, PR #38) prove the protocol is internally sound against deterministic,
non-adversarial-collusion fixtures; they do not, and were never claimed to, exercise a real
provider-backed seat, so criteria 2–7 below require evidence that does not yet exist and cannot be
produced retroactively from the V1A kernel/simulator work alone.

This ADR becomes eligible for a Status: Accepted decision only once **all seven** of the following
are demonstrated, together, by a separately-authorized future task (a "Shadow Council exercise"):

1. **V1A remains frozen and green.** The Decision Council V1A kernel/simulator checkpoint (owned by
   this ADR, frozen per `.project/PROJECT_STATE.md`) is still frozen at the time of the exercise, and
   its full deterministic/adversarial test suite (`npm run test:decision-council-kernel`, `npm run
   test:decision-council-simulator`) still passes unmodified.
2. **A real Shadow Council exercise has actually run.** A separately-authorized Shadow Council task
   has exercised this exact protocol — the same kernel, the same five typed artifacts
   (`ProposalCommitment`, `AgentProposal`, `AgentVote`, `CandidateDecision`, `DecisionRecord`) — with
   **three real, provider-backed council seats** (not the fake-agent simulator), producing genuine
   `DecisionRecord`s from that exercise.
3. **Seat/provider origin attestation at the adapter/runtime boundary is demonstrated.** The Shadow
   Council exercise demonstrates a concrete mechanism — outside the kernel itself, at the
   adapter/runtime layer that produces each seat's artifacts — by which real seat/provider origin can
   be attested sufficiently to prevent one logical producer (one process, one credential, one
   underlying model instance) from silently satisfying multiple seats' identities in the same
   session. This closes the specific gap this ADR's own "Risks" section names ("the kernel has no
   channel to authenticate that a submitted artifact actually originated from a process distinct from
   any other seat's") — the closure must exist and be demonstrated at the adapter/runtime boundary,
   not merely asserted.
4. **Representative R1 and R2 decisions traverse the protocol unmodified.** At least one
   representative R1 decision and at least one representative R2 decision, run through the exercise,
   successfully traverse the exact existing `commitment → reveal → candidate freeze → vote →
   DecisionRecord` sequence end-to-end, reaching a terminal state, **without** any redesign of the
   kernel's state machine, hashing recipes, or R0–R4 quorum semantics as defined in this ADR.
5. **Council artifacts bind into the existing Run Bundle audit model without a semantic change.** A
   `DecisionRecord` produced by the exercise is shown to bind into `RUN_BUNDLE.md`'s existing typed
   evidence model as a genuine evidence kind, without altering `DecisionRecord`'s own fields or
   meaning as defined in this ADR to make that binding work.
6. **Shadow execution remained advisory only, for the whole exercise.** Across the entire exercise, no
   council result (a `DecisionRecord`, a quorum outcome, a disposition) directly caused any repository
   mutation, publication action, merge, tool execution, or autonomous task execution — every such
   action in the exercise, if any occurred at all, was performed (or authorized) by a human or by
   Claude under the repository's existing, unrelated authority rules, never triggered by the council
   result itself.
7. **At least one independent adversarial review of the real exercise finds no protocol-level redesign
   requirement.** A fresh, independent reviewer (a Codex Reviewer or equivalent, per
   `docs/development/CODEX_ROLES.md`, uninvolved in running the exercise) reviews the real Shadow
   Council exercise's artifacts and conduct, and finds no finding that requires changing the council
   topology, the candidate/vote binding rules, the risk/quorum semantics, the authority boundary, or
   the meaning of any core typed artifact this ADR defines. A finding that requires only an
   operational/adapter-level fix (see below) does not itself fail this criterion.

**What does not block acceptance.** Unresolved operational or provider-adapter issues discovered
during the exercise — flaky provider latency, adapter retry/error handling, credential/deployment
mechanics, seat-provisioning tooling, or similar — may remain open without blocking a Status: Accepted
decision, **provided** resolving them does not itself require changing the protocol this ADR defines
(the topology, the state machine, the hashing/binding recipes, the quorum rules, or the authority
boundary). Operational rough edges are expected and are not, by themselves, evidence the protocol is
unsound.

**What is a protocol redesign blocker.** Conversely, any evidence from the exercise that the council
topology (3 seats, Rotating Proposer + Two Independent Reviewers), the candidate/vote binding rules
(commitment-before-reveal, exact-candidate hashing, vote-to-`candidateHash` binding), the risk/quorum
semantics (R0–R4 as defined), the authority boundary (`DecisionRecord` carries no execution/
publication/merge authority), or the meaning of any core typed artifact (`ProposalCommitment`,
`AgentProposal`, `CandidateDecision`, `AgentVote`, `DecisionRecord`) needs to change **is** a blocker —
Status cannot move to Accepted until any such redesign is itself proposed, reviewed, and resolved
(which may require amending or superseding this ADR, not merely patching around the finding).

**What is explicitly not a prerequisite.** Publication Broker activation/provisioning and any bounded
autonomous execution capability are **not** prerequisites for this ADR's acceptance. This Acceptance
Gate concerns only the Decision Council protocol's own soundness under real, provider-backed,
adversarially-reviewed use — not whether MIHVER has yet authorized anything to *act* on a council
result. Criterion 6 above requires that nothing acted on a council result during the exercise itself;
it does not require that acting on one ever become authorized as a condition of this ADR's Status.
