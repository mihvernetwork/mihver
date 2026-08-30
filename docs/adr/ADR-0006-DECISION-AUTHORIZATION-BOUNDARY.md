# ADR-0006: Decision Authorization Boundary (V1A Design)

## Status

Proposed

**This ADR defines a design only.** No code, schema file, script, executor, or wiring of any kind
exists yet for anything described below. Nothing in this document authorizes execution,
publication, bounded autonomy, Publication Broker activation, or any council→tool/action path.
Reaching `Status: Accepted` on this ADR in the future would still not, by itself, authorize any of
those things — see "Non-Goals" and "Staged Implementation Plan" below.

## Context

`docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md` (frozen, Accepted) defines a `DecisionRecord`: "evidence
of a council disposition — nothing more... explicitly not: an `ExecutionEnvelope`, publication
authority, merge authority, permission to mutate the repository, permission to call tools, permission
to run Claude, or permission to launch workers." ADR-0005 deliberately stops there — it proves the
council protocol is sound and explicitly defers "whatever later phase actually authorizes council
output to gate an action" as future, separately-gated work.

That gap is still completely open today. If a future task ever builds an execution capability, the
only artifact it would have to consult is a bare `DecisionRecord` — a typed fact about three votes,
with no scope binding, no freshness re-check, no replay protection, no STOP/fencing concept, and no
distinction between "council said yes" and "a human, specifically, said yes to this exact thing."
Building an executor against a bare `DecisionRecord` directly would force it to invent all of that
machinery itself, under time pressure, at the exact moment it is most dangerous to improvise: the
one where a model-adjacent system might act on the world.

This ADR designs the missing intermediate layer — an `AuthorizationEnvelope` — so that if and when an
Execution Gateway is ever separately authorized, it is designed against an already-hardened contract
instead of the contract being invented around whichever gateway shows up first. This mirrors exactly
why ADR-0005 built the Decision Council kernel before any real Shadow Council seat existed (ADR-0005,
"Consequences": "A future Shadow Council phase can plug real provider-backed seats into this exact
kernel... no protocol redesign, only a new artifact producer").

**This ADR does not modify ADR-0005.** `DecisionRecord`, `CandidateDecision`, `AgentVote`, the
kernel's state machine, its hashing recipes, and its R0–R4 quorum semantics are read here exactly as
ADR-0005 defines them, byte-for-byte, and treated as frozen inputs. Nothing in this document adds a
field to, removes a field from, or reinterprets any Decision Council artifact.

**Central design thesis.** This ADR defines exactly one ceiling for every risk class:
`POLICY_SATISFIED`. Reaching it means "this decision has cleared every gate this ADR defines" — it
does **not** mean "may now execute." No risk class, including R0, is granted anything beyond that
shared ceiling by this design; risk classes differ only in which gates they must clear to reach it
(see "R0–R4 Authorization Mapping" below). Whether some future, separately-authorized bounded-autonomy
policy ever treats a `POLICY_SATISFIED` envelope as sufficient to actually do something is explicitly
**not** decided by this ADR — see "Non-Goals".

**A necessary honesty about `ALLOW_ONCE`, from adversarial review.** An independent reviewer correctly
pushed back on an earlier, stronger version of this thesis: `ALLOW_ONCE` is a positive fact that a
specific decision has now been authorized-and-consumed, and once V1C (the privileged Ledger/Grant
store — see "Staged Implementation Plan") exists, the *authorization* side of what a future Execution
Gateway would need is largely already built — V1D would then only need to attach an effect. That is
true, and this ADR does not claim otherwise: `POLICY_SATISFIED`/`ALLOW_ONCE` are necessary
infrastructure for any future execution capability, not proof that no such infrastructure exists. What
this ADR does claim, and what actually keeps V1A–V1C from constituting execution capability, is
narrower and mechanical, not rhetorical: **nothing built at any stage before V1D is ever called by
anything** — exactly the same state `PUBLICATION_BROKER.md`'s own Publication Broker source is in today
("IMPLEMENTED... NOT PROVISIONED/ACTIVATED... no code path... pushes a branch or touches a PR").
`checkAndConsume` producing `ALLOW_ONCE` in a test fixture is not different in kind from
`internal/server.Orchestrate` successfully minting a token against a fake GitHub server in the
Broker's own test suite — both are real, working code, sitting completely inert because nothing
authorized to invoke them against anything real exists yet. See the V1C exit-gate requirement in
"Staged Implementation Plan" for how this is kept true by construction, not merely by intention.

## Threat Model

**Assets to protect:** the repository's integrity (`main`, any branch, any file), any credential or
tool-calling capability a future system might hold, and the meaning of "a human approved this" —
specifically, that the phrase can never be satisfied by anything Claude, a council seat, or a model
response produced on its own.

**Adversary model.** This is **not** a defense against a malicious human operator, a compromised
GitHub account, or a compromised OS-level identity — those are out of scope for a design document
(they are the Publication Broker's own deployment/credential concerns, `PUBLICATION_BROKER.md`). The
adversary this ADR defends against is **structural, not malicious**: a well-intentioned future task,
under time or complexity pressure, that wires an executor too close to raw model output because
nothing else was available. Concretely, the threats this design must make structurally impossible:

1. A future Execution Gateway (or an ad hoc script standing in for one) treats a bare `DecisionRecord`
   as sufficient authorization, skipping scope binding, freshness checks, or human-approval binding
   entirely because no intermediate artifact existed to force the issue.
2. Claude, a council seat, or a candidate's own `proposalContent` supplies or expands the *scope* of
   what an action may touch — a confused-deputy pattern where the thing being authorized also gets to
   describe its own authorization.
3. An authorization computed against one repository/context state is presented for use after that
   state has moved — a stale-context attack, structurally identical to the one the Decision Council
   kernel's own `expectedContext` check and the Publication Builder's `expected_pre_publish_head` check
   both already defend against one layer down.
4. An authorization already acted upon is replayed — resubmitted to trigger the same effect twice, or
   submitted after the specific decision it named has since been superseded.
5. A human's STOP/kill-switch action, given because something is going wrong, fails to reach an
   authorization that is already mid-flight — a fencing gap.
6. A `DecisionRecord`'s `riskClass` is silently reinterpreted as a lower class somewhere in the
   authorization path, letting an R3 decision be treated as R1.
7. An R3 decision's `HUMAN_APPROVAL_REQUIRED` disposition is satisfied by anything less than a human
   action cryptographically/deterministically bound to the *exact* candidate being approved — a
   generic "task approved" click, a PR approval, or a Slack thumbs-up that names the task but not the
   exact `candidateHash`/`recordHash`.
8. An R4 (`DENIED`) decision is ever wrapped, retried, or reframed into an authorizable shape.
9. Claude constructs both the thing to be authorized and the approval that authorizes it — a
   self-authorization loop.
10. A future executor parses free-form natural language (a `proposalContent.summary`, a chat message,
    a commit message) as if it were a permission grant, instead of checking closed, typed fields.

Each of these ten threats maps 1:1 to the "FAIL-CLOSED PRINCIPLES" the originating task named; see
"Adversarial Cases" below for how each is defeated mechanically, not just by policy statement.

## Decision

### Position in the pipeline

```text
ProjectContextPack ──────────────┐  (contextHash, repository.head — PROJECT_CONTINUITY.md, unmodified)
TaskRecord ───────────────────────┤  (taskId, allowedScope, forbiddenScope — RUN_BUNDLE.md, unmodified)
DecisionRecord ────────────────────┤  (riskClass, disposition, candidateHash, councilEpochId, recordHash
(ADR-0005, frozen)                 │   — ADR-0005, unmodified)
global STOP epoch (NEW, this ADR) ─┤
                                    ▼
                    ┌───────────────────────────────┐
                    │   Authorization Binder (NEW)   │  deterministic, non-LLM, network-free —
                    │   scripts/dev/authorization-   │  same idiom as decision-council-kernel.mjs /
                    │   binder.mjs (NOT YET WRITTEN) │  publication-builder.mjs — proposed name/path
                    └───────────────┬────────────────┘  only, no file created by this task
                                    ▼
                    AuthorizationEnvelope (NEW artifact, candidate)
                    disposition ∈ {no envelope, PENDING_HUMAN_APPROVAL, POLICY_SATISFIED}
                                    │
                    ┌───────────────┴────────────────┐
                    │ R0/R1/R2 path: no human gate    │ R3 path: PENDING_HUMAN_APPROVAL
                    │ needed by this ADR              │        │
                    │                                 │        ▼  (out-of-band, privileged,
                    │                                 │        human-only — never Claude/Codex)
                    │                                 │  AuthorizationGrant (NEW artifact),
                    │                                 │  bound to the EXACT envelopeHash
                    └───────────────┬─────────────────┴────────┘
                                    ▼
                    Authorization Ledger (NEW, privileged — NOT PROVISIONED, see
                    "Trust Boundaries") — atomic single-use consumption check
                                    ▼
                    POLICY_SATISFIED, consumed exactly once ──▶ [ Execution Gateway —
                                                                   NOT DEFINED, NOT BUILT,
                                                                   explicitly out of scope —
                                                                   this ADR's boundary ends here ]
```

Everything above the `Authorization Binder` box already exists and is unmodified. Everything at and
below the dashed boundary at the bottom (`Execution Gateway`) does not exist and is not designed here.
This ADR's entire scope is the box in between.

### Relationship to Existing Artifacts

Per-fact ownership — this design introduces no field that duplicates an existing owner's fact; it only
ever *reads* and *re-verifies* facts other artifacts already own:

| Fact | Owner (unchanged) | How `AuthorizationEnvelope` relates |
|---|---|---|
| `contextHash`, `repository.head` (live repository/context-freshness fact) | `ProjectContextPack` — `docs/development/PROJECT_CONTINUITY.md`, `schemas/dev/project-context-pack.schema.json` | Copies `contextHash`/`repositoryHead` from the `DecisionRecord` **and independently re-verifies both against the current live pack** at every evaluation (construction time and consumption time) — never redefines what `contextHash` means or how it is computed. |
| `taskId`, `allowedScope`, `forbiddenScope`, task disposition | `TaskRecord` — `docs/development/RUN_BUNDLE.md`, `schemas/dev/task-record.schema.json` | A `BLOCKED` task disposition fails closed with no envelope. Otherwise, treat `TaskRecord.forbiddenScope` (or an empty set if absent) as a membership set, scan `TaskRecord.allowedScope` left to right, exclude every token in that set, and retain each surviving token only on its first occurrence. `AuthorizationEnvelope.allowedScope` is therefore ordered by first appearance and contains each surviving token exactly once — never independently authored, never wider. A forbidden token is a fail-closed `TaskRecord`-level exclusion, not merely an omission; duplicate multiplicity in either input array can never expand authority or otherwise alter authorization meaning. This canonical derivation makes conformant implementations produce byte-identical scope output, and therefore a byte-identical `envelopeHash`, from the same `TaskRecord`. |
| `riskClass`, `candidateHash`, `councilEpochId`, `disposition`, `recordHash` (the council's own decision) | `DecisionRecord`/`CandidateDecision`/`AgentVote` — `docs/adr/ADR-0005-DECISION-COUNCIL-PROTOCOL.md`, `schemas/dev/decision-council.schema.json` | Copied verbatim, never re-derived or overridden. `councilEpochId` here always means ADR-0005's per-`CouncilConfig` session identity (`CouncilConfig.epochId`, echoed onto every council artifact as `councilEpochId`) — **never** the new global `stopEpoch` this ADR defines (see "Two Distinct 'Epoch' Concepts" below). |
| Git-publication mechanics: fingerprinting, ancestry, branch safety, remote push authorization | `PublicationEnvelope` / Local Publication Builder / Publication Broker / `PublicationGrant` — `docs/development/PUBLICATION_BROKER.md`, `docs/development/CODEX_ROLES.md` | `AuthorizationEnvelope` is a separate, broader, **upstream** gate over a different question ("is this decision allowed to result in *any* action at all") than Publication's own question ("is this exact commit/push/PR mechanically well-formed and authorized"). **This ADR takes no position on, and does not authorize, who or what may ever construct a `PublicationEnvelope`** — `CODEX_ROLES.md`'s Publication Protocol already states that only Claude does, "never a worker," and nothing here changes, widens, or adds a producer to that. If a future Execution Gateway is ever separately authorized and ever defines a `PUBLICATION` action kind, *whether and how* it may relate to Publication's own pipeline is that future ADR's own question to answer, under its own explicit amendment to `CODEX_ROLES.md`'s Publication Protocol if needed — not a relationship this design pre-establishes. |
| STOP epoch / fencing | **Nobody, today.** `ROADMAP.md` §17.2 lists "STOP epoch simulation" and "idempotency and fencing simulation" as `PLANNED` scope for a Decision Council kernel v0; the kernel that actually shipped (ADR-0005, frozen) implements neither — confirmed by literal search of `scripts/dev/decision-council-kernel.mjs` and `schemas/dev/decision-council.schema.json` (zero hits for `STOP`, `fence`, `fencing`; the only `epoch` hits are `CouncilConfig.epochId`/`councilEpochId`, a per-session identifier, not a global kill-switch). | **This ADR is the first to define and own the global `stopEpoch` concept.** It does not amend ADR-0005 to add this — ADR-0005's kernel remains exactly as frozen, with no STOP/fencing field of its own. |
| Lifecycle gate vocabulary (`AUTHORIZED` → ... → `HUMAN MERGE`) | `docs/development/REVIEW_PROTOCOL.md` | Unrelated axis — `REVIEW_PROTOCOL.md`'s gates describe a *task's* lifecycle through human review; `AuthorizationEnvelope`'s state machine (below) describes a *single decision's* lifecycle toward (never into) execution. Neither redefines the other. |

### V1B Amendment — Council Quorum Proof Requirement

**This ADR remains Status: Proposed; this subsection amends the design, not the Status.** MIHVER
task `DECISION-COUNCIL-QUORUM-PROOF-V1B` added a `CouncilQuorumProof` sidecar
(`scripts/dev/council-quorum-proof.mjs`, `schemas/dev/council-quorum-proof.schema.json`) alongside
the frozen, unmodified ADR-0005 `DecisionRecord` — see that ADR's own "Future Work" amendment for
the sidecar's exact fields and hash graph. A bare `DecisionRecord` is self-consistent (its
`recordHash` proves it has not been tampered with) but does not, by itself, let a verifier
independently recompute R1's provider/model-family diversity, R2's proposer exclusion, or R3's 3-of-3
requirement — those depend on `CouncilConfig` seat identities the `DecisionRecord` does not carry.

Accordingly, wherever this ADR's design (`evaluateAuthorization`, `resolveCanonicalRecord`,
`independentlyRederive`, `checkAndConsume`) treats a `DecisionRecord` as canonical council-decision
input, a future implementation of this design MUST additionally require and independently verify
(via `verifyCouncilQuorumProof`) a `CouncilQuorumProof` bound to that exact `DecisionRecord.recordHash`
whenever the applicable authorization policy requires independently provable council legitimacy —
specifically:

- `authorizationEvidenceEligible` (from `verifyCouncilQuorumProof`) must be `true` — hashes valid,
  config trust-anchored against a registry (never merely self-consistent), bindings valid, and
  quorum independently recomputed to match the `DecisionRecord`'s own `state`/`disposition`.
- The proof's `provenanceClass` must be `"CONTEMPORANEOUS"` — a legacy/historical `DecisionRecord`
  with no proof, or only a `"RECONSTRUCTED"` one, is insufficient and MUST fail closed
  (`NO_ENVELOPE`/`BLOCKED` with a reason such as `COUNCIL_PROOF_MISSING` or
  `COUNCIL_PROOF_NOT_CONTEMPORANEOUS`) rather than being treated as authorization-grade merely
  because its `recordHash` is valid.
- The proof's `quorumRuleVersion`/`proofVersion` must be a version this ADR's implementation
  recognizes; an unknown version fails closed the same way an unknown `policyVersion` would.

This amendment adds a required upstream evidence check; it does not change `evaluateAuthorization`'s
own risk-specific disposition mapping or the Independent Re-Verification discipline above, it grants
no execution authority, and it does not change this ADR's Status from `Proposed`.

### `AuthorizationEnvelope` — artifact schema proposal

Illustrative shape only (no `schemas/dev/*.schema.json` file is created by this task — see
"Non-Goals"). Hash fields reuse the exact `sha256:<64 hex>` domain-separated recipe ADR-0005 and
`PROJECT_CONTINUITY.md` already use (`canonicalizeJson` + a domain-tag prefix), introducing no
competing canonicalizer:

```text
AuthorizationEnvelope {
  protocolVersion: "1.0.0",

  // exact identity
  authorizationId: <deterministic — sha256("MIHVER:AuthorizationEnvelope:AuthorizationId:v1\0" +
                     decisionRequestId + "\0" + recordHash); never caller-chosen, never random — see
                     "Policy-Evaluation Algorithm" for why determinism here closes a replay vector>,

  // exact DecisionRecord identity/hash — the sole council-decision input
  decisionRecordRef: { decisionRequestId, recordHash },

  // copied verbatim from DecisionRecord — never re-derived, never caller-suppliable as a parameter
  candidateHash, taskId, riskClass, contextHash, repositoryHead, councilEpochId,

  // NEW — global STOP/fencing epoch observed at construction time (see below)
  stopEpoch,

  // NEW — version/hash of the exact deterministic policy-evaluation algorithm that produced this
  // envelope (see "Policy-Evaluation Algorithm"); a future amendment to the algorithm must never be
  // silently applied to an envelope minted under an older version
  policyVersion: "authorization-policy/v1",

  // explicit action type — closed enum, single value, never free text, never a set.
  // V1A defines only the field's shape requirement; the real action-kind catalog (PUBLICATION,
  // TOOL_CALL, TASK_TRANSITION, ...) is explicitly deferred to whichever future task defines the
  // Execution Gateway (see "Non-Goals") — inventing it now would be speculative design for a
  // capability that does not exist. V1A's only legal value:
  actionType: "UNDEFINED_PENDING_EXECUTION_GATEWAY",

  // explicit allowed scope — exact tokens only. Treat TaskRecord.forbiddenScope (or an empty set if
  // absent) as a membership set; scan TaskRecord.allowedScope left to right; exclude every forbidden
  // token; otherwise retain a token only on its first occurrence. The result is ordered by first
  // appearance and contains each surviving token exactly once. Forbidden membership is a fail-closed
  // TaskRecord-level exclusion, not merely an omission; duplicate multiplicity in either input array
  // can never expand authority or otherwise alter authorization meaning. Never wider, never sourced
  // from proposalContent.
  allowedScope: [ <each non-forbidden TaskRecord.allowedScope token exactly once, in first-appearance order> ],

  // explicit prohibited effects — a FIXED, ADR-0006-owned closed list, restated machine-legibly so a
  // future Execution Gateway has an explicit, mechanical checklist. Not configurable narrower or
  // wider per envelope in V1A; always exactly this set:
  prohibitedEffects: [
    "GIT_PUSH", "GIT_FORCE_PUSH", "PR_CREATE", "PR_MERGE", "MAIN_BRANCH_MUTATION",
    "PUBLICATION_BROKER_INVOCATION", "CREDENTIAL_ACCESS", "TOOL_EXECUTION",
    "COUNCIL_SCOPE_SELF_EXPANSION", "EXECUTION_GATEWAY_BYPASS"
  ],

  // human-approval requirement — derived from riskClass/disposition, never caller-supplied
  humanApproval: {
    required: <true iff DecisionRecord.disposition == "HUMAN_APPROVAL_REQUIRED">,
    grantRef: null   // permanently null in this canonical, immutable envelope; grant association and
                     // consumption are recorded only in the privileged Ledger — see "Human Approval Binding"
  },

  singleUse: true,   // fixed, non-configurable in V1A

  // resulting authorization disposition — SET ONCE AT CONSTRUCTION, NEVER MUTATED AFTERWARD. Exactly
  // two values are possible here, because envelopeHash (below) covers this field: if disposition
  // could later be rewritten to CONSUMED/EXPIRED_BY_DRIFT/REVOKED_BY_STOP_EPOCH, the envelope's own
  // hash would change, which would silently invalidate any AuthorizationGrant already bound to it —
  // exactly the tamper-evidence property this design depends on. CONSUMED/EXPIRED_BY_DRIFT/
  // REVOKED_BY_STOP_EPOCH/REPLAY_REJECTED are never values of this field; they are outcomes of a
  // checkAndConsume ATTEMPT against this authorizationId, tracked by the Ledger (below), external to
  // this immutable object — see "State Machine".
  disposition: "PENDING_HUMAN_APPROVAL" | "POLICY_SATISFIED",
             // ("R4_HARD_DENY" and "COUNCIL_GATE_NOT_MET" never reach this shape at all — no envelope
             // object is ever constructed for those two cases, immutable or otherwise)

  envelopeHash: "sha256:" + sha256("MIHVER:AuthorizationEnvelope:v1\0" + canonicalizeJson(envelope minus envelopeHash))
}
```

**No wall-clock timestamp field** — same rationale ADR-0005 gives for `DecisionRecord` ("a wall-clock
stamp would break 'same inputs → byte-identical output' unless it were itself a deterministic
caller-supplied input"). Staleness here is condition-based (drift in `contextHash`/`repositoryHead`/
`stopEpoch`), not clock-based — see "Replay / Staleness / Fencing Semantics".

### `AuthorizationGrant` — artifact schema proposal (human approval binding)

Modeled directly on `schemas/dev/publication-grant.schema.json`'s `PublicationGrant` — same
privilege-separation pattern (created only through a privileged, out-of-band path structurally
unreachable by Claude/Codex), same digest-binding idea (`request_digest` → here, `envelopeHash`) —
with one deliberate addition `PublicationGrant` does not have:

```text
AuthorizationGrant {
  grantId,                    // analogous to PublicationGrant.grant_id
  envelopeHash,                // the EXACT, independently-recomputed AuthorizationEnvelope digest this
                                // grant authorizes — a grant is bound to at most one envelopeHash,
                                // ever, exactly like PublicationGrant.request_digest; creation itself
                                // recomputes this from canonical sources, never trusting a submitted claim
  approverIdentity,            // NEW relative to PublicationGrant — captured from the admin path's own
                                // authentication mechanism, never caller-asserted — see below
  boundStopEpoch,               // the global stopEpoch read atomically at grant-creation time; creation
                                // refuses outright if this disagrees with the recomputed envelope's own
                                // stopEpoch — closes a gap PublicationGrant does not need to close
  state: "AUTHORIZED" | "CONSUMED" | "REVOKED" | "EXPIRED",
  expiresAt,                   // wall-clock — checked inside checkAndConsume's atomic section (see
                                // "Policy-Evaluation Algorithm"); never left to background maintenance
  authorizedAt, stateChangedAt
}
```

**Grant creation is itself a privileged operation subject to the same Independent Re-Verification as
consumption, under the same fencing rigor — not a looser, prose-only version of it.** An adversarial
reviewer correctly noted that a grant naively bound only to a submitter-claimed `envelopeHash` could
approve something that was never actually re-derived, or — in a first-pass fix that only described this
step in prose, without pinning it to the same RW-lock the consumption path already specifies — could
still be created in a gap between checking the current epoch and durably persisting the grant, exactly
the kind of window "Policy-Evaluation Algorithm" already closes for consumption. Grant creation
therefore normatively: (1) validates the submitted input's structurally bounded shape; (2) **ungated
and before acquiring any lock**, runs `resolveCanonicalRecord` to resolve the canonical, hash-verified
`DecisionRecord`/envelope identity; (3) derives the canonical `authorizationId` from that resolution,
never from the submitted envelope's claimed value; (4) only then acquires the appropriate privileged
gate for that canonical identity and the **shared/reader** form of the same global `stopEpoch`
reader-writer lock `checkAndConsume` uses (so a concurrent `stopEpoch` bump, which needs the exclusive
form, cannot land mid-creation); (5) while holding both, reads the current global `stopEpoch` and
current context fresh and runs `independentlyRederive` against the human-reviewed `envelopeHash` —
never trusting a submitted envelope's other fields — and **refuses to create the grant at all** if the
independently-recomputed envelope's own `stopEpoch` does not equal that current epoch; (6) creates the
grant with `boundStopEpoch` set to that freshly-read epoch; and (7) atomically commits the grant and
its Ledger association, still inside both held locks, before releasing either. That Ledger-owned
association records, separately from the immutable envelope, the canonical `authorizationId`, exact
`envelopeHash`, exact grant identity/hash, grant-consumed state, and consumption result. The pre-lock
resolution does not reopen a TOCTOU gap: it reads only immutable, already-hash-verified canonical data
(`DecisionRecord` and `recordHash`) that cannot change beneath the operation; it neither reads nor
relies on mutable epoch, context, grant, or Ledger state, all of which is read or re-derived only after
the locks are held in step 5.

**Why `approverIdentity` exists here but not on `PublicationGrant`.** `PublicationGrant` relies solely
on OS-level admin-socket access control — anyone who can reach the privileged admin socket is, by
construction, "the human," and no further identity is recorded. That is a reasonable bar for routine
publication. R3 decisions are higher-consequence and rarer, and the originating task requires "exact-
bound approval identity where applicable" specifically — so this design adds a named identity field
`PublicationGrant` does not carry. **`approverIdentity` is captured, never asserted**: it MUST be
derived by the privileged admin path from its own authentication mechanism at the moment of grant
creation (whatever that mechanism turns out to be at V1C — an OS user identity, a certificate subject,
an equivalent) — it is never accepted as a free-text parameter the caller of the admin path supplies,
which is what would let anyone who merely *reaches* the admin path claim to be any identity they like.
**What "exact-bound" mechanically guarantees in V1A, and what it does not:** capturing identity this way
prevents Claude/Codex from fabricating an approval (they cannot reach the admin path at all — see
"Trust Boundaries") and prevents a caller of the admin path from mislabeling *whose* access it used. It
does **not**, in V1A, prove non-repudiation against a compromised OS-level session (a cryptographic
signature over the exact `envelopeHash`, verified independently of whatever process captured the
identity string, would close that gap), and it does **not** define *which* identities are eligible to
approve an R3 decision at all (an allowed-approver roster/policy) — both are named explicitly as Open
Questions deferred to V1C, not resolved here, to avoid this design task deciding a cryptography or
operator-roster implementation question it does not need to answer to satisfy "human/risk gate."

**`boundStopEpoch` closes a gap `PublicationGrant` does not have.** Nothing in the Publication Broker's
model needs a global kill-switch epoch, because `AdminHandle.Revoke` already gives per-grant
revocation. This ADR's global `stopEpoch` (below) is coarser and faster — a single counter bump
invalidates *every* outstanding grant and envelope at once, without enumerating them — so a grant must
record the epoch it was authorized under; if the global epoch has since moved, the grant is dead
regardless of its own `state`.

### Two Distinct "Epoch" Concepts — Not to Be Confused

| | `councilEpochId` (ADR-0005, frozen, unmodified) | `stopEpoch` (NEW, this ADR) |
|---|---|---|
| Scope | One `CouncilConfig` / one council session | Global, cross-session, cross-task |
| Who sets it | The orchestrator constructing a `DecisionRequest`/`CouncilConfig` (Claude, today) | Only a human, via a privileged path structurally unreachable by Claude/Codex — see "Trust Boundaries" |
| Purpose | Identifies which seat roster a vote belongs to (`WRONG_COUNCIL_EPOCH` rejects a vote from a stale roster) | A kill-switch: bumping it instantly invalidates every outstanding `AuthorizationEnvelope`/`AuthorizationGrant`, system-wide, with no enumeration required |
| Where it lives | `schemas/dev/decision-council.schema.json` (existing) | Not yet implemented — proposed to live in the same privileged trust zone as the Authorization Ledger (see "Trust Boundaries") |

Conflating these two would let a routine council-session rollover be mistaken for a STOP action, or
vice versa. They are kept as two separate fields, on two separate artifacts, owned by two separate
ADRs.

### State Machine

**This diagram is the Ledger's tracked lifecycle for one `authorizationId`, not a mutation of the
envelope object itself.** An `AuthorizationEnvelope`'s own fields, including `disposition`, are fixed
forever at construction and never rewritten (see the schema proposal above — this is required for
`envelopeHash` to stay meaningful as tamper-evidence). What the Ledger tracks, keyed by
`authorizationId`, is the *outcome of each `checkAndConsume` attempt* against that immutable envelope —
`CONSUMED`, or an attempt's `BLOCKED`/`DENY` reason (`EXPIRED_BY_DRIFT`, `REVOKED_BY_STOP_EPOCH`,
`REPLAY_REJECTED`, ...). "disposition = POLICY_SATISFIED" below means the immutable envelope's own
field; every state after that line describes the Ledger's own separate record of what happened when
someone tried to consume it — exactly the same distinction ADR-0005 draws between `DecisionRecord`'s
immutable content and the kernel session's own `transitionLog`.

```text
DecisionRecord.disposition ──┐
                              │
   == "DENIED" (R4) ─────────┼────────────────────▶  NO ENVELOPE  (reason: R4_HARD_DENY)
   == "NO_QUORUM" ───────────┼────────────────────▶  NO ENVELOPE  (reason: COUNCIL_GATE_NOT_MET)
   taskId / TaskRecord mismatch ─────────────────────▶  NO ENVELOPE  (reason: TASK_IDENTITY_MISMATCH)
   TaskRecord.disposition == "BLOCKED" ──────────────▶  NO ENVELOPE  (reason: TASK_RECORD_BLOCKED)
   contextHash/repositoryHead already stale ──────────▶  NO ENVELOPE  (reason: CONTEXT_ALREADY_STALE)
                              │
   == "COUNCIL_NOT_REQUIRED" (R0)  ─┐
   == "COUNCIL_APPROVED" (R1/R2)    ├──▶ CONSTRUCTED ──▶ disposition = POLICY_SATISFIED
                                    │
   == "HUMAN_APPROVAL_REQUIRED" (R3)──▶ CONSTRUCTED ──▶ disposition = PENDING_HUMAN_APPROVAL
                                                                  │
                                                (out-of-band, privileged, human-only:
                                                 AuthorizationGrant created, bound to
                                                 this exact envelopeHash)
                                                                  │
                                                    ┌─────────────┴─────────────┐
                                              no matching valid grant      matching valid grant,
                                              found  ──▶ remains            boundStopEpoch still
                                              PENDING_HUMAN_APPROVAL        current ──▶ atomically
                                              (no timeout-based fallback    consume grant + ledger
                                              approval exists)              entry together
                                                                                  │
                                                                                  ▼
                                                                          Ledger consumption result =
                                                                          POLICY_SATISFIED; immutable
                                                                          envelope remains unchanged

Any of {PENDING_HUMAN_APPROVAL, POLICY_SATISFIED}, checked on every read/consumption attempt:
   current global stopEpoch != envelope.stopEpoch  ──▶  REVOKED_BY_STOP_EPOCH   (terminal)
   current contextHash/repositoryHead has drifted   ──▶  EXPIRED_BY_DRIFT        (terminal)

POLICY_SATISFIED, first (and only) consumption attempt by any consumer:
   ledger records authorizationId as CONSUMED, atomically, exactly once  ──▶  CONSUMED (terminal)

POLICY_SATISFIED or CONSUMED, any later attempt referencing the same authorizationId:
   ledger already shows CONSUMED  ──▶  REPLAY_REJECTED (no state change; the original CONSUMED fact
                                        stands, unaffected — a replay is refused, not un-done)
```

`REVOKED_BY_STOP_EPOCH` and `EXPIRED_BY_DRIFT` are checked **lazily, on every read/consumption
attempt** — never via a background sweep that enumerates outstanding envelopes. This is deliberate:
correctness requires only that a stale/revoked envelope fail closed *the next time anything tries to
use it*, exactly like `ProjectContextPack`'s own staleness model ("any HEAD, working-tree, or
manifested-source change invalidates it; recompile/compare is the only signal" —
`PROJECT_CONTINUITY.md`) and the Publication Broker's own "always re-observe fresh, never trust a
cached fact" pattern (`internal/gitremote`'s remote-head re-observation before every push). No
polling loop, timer, or enumeration is required for this design to be correct.

### Policy-Evaluation Algorithm

**Adversarial review finding, incorporated.** Three independent Codex Reviewers, on three different
axes, converged on the same root defect in an earlier draft of this section: it let a candidate
`AuthorizationEnvelope` cross from the model-writable zone into the privileged consumption step as
data whose *fields* — `disposition`, `envelopeHash`, `riskClass`, scope — were then trusted rather than
independently re-derived. That is exactly the mistake `PUBLICATION_BROKER.md`'s own "Independent
Commit/Tree Verification" section exists to name and refuse ("the Broker never trusts the Envelope,
the Receipt, or the package manifest's own claims about them"). The design below is corrected to the
same discipline: **the privileged side never trusts a claim about itself; it only ever trusts what it
independently recomputes from canonical sources.**

`evaluateAuthorization` (below) is a **pure function with no privileged/unprivileged distinction of its
own** — it may be run by the model-writable zone (to produce a *candidate* for human/Claude
inspection) or, independently, by the privileged zone (to check a candidate's claims). What makes a
zone privileged is never "which function it calls"; it is **which inputs it is entitled to treat as
canonical** (its own freshly-observed context/epoch, and a canonically-verified `DecisionRecord`/
`TaskRecord`) versus which inputs it must treat as merely an untrusted hint (anything read from a
submitted candidate envelope).

**1. Construction** (`evaluateAuthorization` — proposed home: `scripts/dev/authorization-binder.mjs`,
model-writable zone, Claude may invoke it exactly as Claude invokes the Local Publication Builder
today; pure function, no `Date.now()`, no `Math.random()`, no network, mirrors
`decision-council-kernel.mjs`'s own determinism discipline):

```text
function evaluateAuthorization(decisionRecord, taskRecord, currentContext, currentStopEpoch, policyVersion):
  # Step 1 — hard gates. No envelope object is ever constructed past this point for these cases.
  if decisionRecord.disposition == "DENIED":            return NO_ENVELOPE("R4_HARD_DENY")
  if decisionRecord.disposition == "NO_QUORUM":          return NO_ENVELOPE("COUNCIL_GATE_NOT_MET")
  if decisionRecord.taskId != taskRecord.taskId:         return NO_ENVELOPE("TASK_IDENTITY_MISMATCH")
  if taskRecord.disposition == "BLOCKED":                return NO_ENVELOPE("TASK_RECORD_BLOCKED")
  if decisionRecord.contextHash != currentContext.contextHash
     or decisionRecord.repositoryHead != currentContext.repositoryHead:
                                                          return NO_ENVELOPE("CONTEXT_ALREADY_STALE")

  # Step 2 — canonical scope binding. Treat taskRecord.forbiddenScope (or an empty set if absent) as
  # a membership set, then scan taskRecord.allowedScope left to right. Exclude each token that is a
  # member of forbiddenScope; this is a TaskRecord-level fail-closed exclusion, not merely an omission.
  # Otherwise retain the token only if it has not already been retained. A later duplicate of an
  # already-retained token contributes nothing: it does not expand, narrow, or otherwise alter the
  # result. candidateScope is therefore ordered by first appearance in taskRecord.allowedScope and
  # contains each surviving token exactly once. Duplicate multiplicity in allowedScope or
  # forbiddenScope can never expand authority or otherwise alter authorization meaning. No other input
  # affects this derivation, so conformant Binder and Ledger implementations derive byte-identical
  # candidateScope, and therefore byte-identical envelopeHash, from the same TaskRecord.
  candidateScope = orderedSetDifference(taskRecord.allowedScope, taskRecord.forbiddenScope or [])
  if not isSubsetOf(candidateScope, taskRecord.allowedScope):
                                                          return NO_ENVELOPE("SCOPE_EXCEEDS_TASK_RECORD")

  # Step 3 — deterministic, non-caller-choosable identity (closes a replay vector an earlier draft
  # had: a random/caller-chosen authorizationId let the same DecisionRecord be wrapped in many
  # differently-identified envelopes, each separately consumable). One DecisionRecord ever produces
  # exactly one authorizationId, no matter how many times evaluateAuthorization is invoked against it.
  authorizationId = "sha256:" + sha256("MIHVER:AuthorizationEnvelope:AuthorizationId:v1\0"
                                        + decisionRecord.decisionRequestId + "\0" + decisionRecord.recordHash)

  # Step 4 — construct the candidate envelope (fields as in the schema proposal above)
  envelope = buildEnvelope(authorizationId, decisionRecord, candidateScope, currentStopEpoch, policyVersion)

  # Step 5 — risk-specific disposition. Read only from decisionRecord.disposition — never a
  # caller-supplied riskClass parameter; there is no parameter through which a downgraded risk class
  # could enter this function at all.
  if decisionRecord.disposition in ("COUNCIL_NOT_REQUIRED", "COUNCIL_APPROVED"):
      envelope.disposition = "POLICY_SATISFIED"
      envelope.humanApproval = { required: false, grantRef: null }
  elif decisionRecord.disposition == "HUMAN_APPROVAL_REQUIRED":
      envelope.disposition = "PENDING_HUMAN_APPROVAL"
      envelope.humanApproval = { required: true, grantRef: null }

  envelope.envelopeHash = hash(envelope)
  return ENVELOPE(envelope)
```

**2. Independent Re-Verification (mandatory, privileged — this is the corrected boundary).** Before
`checkAndConsume` (below) does anything else, it treats a submitted candidate envelope as **nothing
more than a lookup pointer** (which `decisionRequestId` to look up) — never as a source of truth for
any field the authorization decision depends on:

**Second-round adversarial review, incorporated.** A follow-up fresh reviewer, checking this exact
fix, found the fix itself still had a bug: gating on `submittedEnvelope.authorizationId` (as an
earlier version of this section did) gates on an **untrusted** value — two concurrent submissions of
the same real decision, each carrying a different fabricated `authorizationId`, would acquire two
different gates and could both reach `ALLOW_ONCE` before either marked the ledger, because the
canonical, trustworthy `authorizationId` is only known *after* re-derivation, which is exactly what the
gate was supposed to make safe. The fix below splits re-derivation into an **ungated lookup/verify
phase** (safe to run concurrently — it only reads canonical storage, it mutates nothing) that produces
the one trustworthy value to gate on, and a **gated phase** that does everything else:

```text
function resolveCanonicalRecord(submittedEnvelope, canonicalStore):
  # Ungated on purpose: a pure read against canonical storage, safe under any concurrency, and the
  # ONLY way to obtain a trustworthy authorizationId to gate on in the first place. submittedEnvelope
  # is used here strictly as a lookup pointer (which decisionRequestId to fetch) — its other fields,
  # including its own claimed authorizationId, are not read anywhere in this function.
  decisionRecord = canonicalStore.getDecisionRecord(submittedEnvelope.decisionRecordRef.decisionRequestId)
  if decisionRecord is None:                                     return BLOCKED("DECISION_RECORD_NOT_FOUND")
  if recomputeRecordHash(decisionRecord) != decisionRecord.recordHash:
                                                                  return BLOCKED("RECORD_HASH_MISMATCH")
  canonicalAuthorizationId = "sha256:" + sha256("MIHVER:AuthorizationEnvelope:AuthorizationId:v1\0"
                                                 + decisionRecord.decisionRequestId + "\0" + decisionRecord.recordHash)
  return RESOLVED(decisionRecord, canonicalAuthorizationId)

function independentlyRederive(decisionRecord, canonicalStore, currentStopEpoch, currentContext, policyVersion, submittedEnvelope):
  # Called only AFTER the caller (checkAndConsume, below) has already resolved and gated on
  # canonicalAuthorizationId — decisionRecord here is already hash-verified, not re-fetched.
  # taskId lookup must resolve to exactly one canonical TaskRecord — zero or multiple matches both
  # fail closed, closing a distinct gap an earlier draft had (equality-check against a
  # caller-supplied TaskRecord is tautological if the caller also supplies the TaskRecord)
  matches = canonicalStore.findTaskRecordsByTaskId(decisionRecord.taskId)
  if length(matches) != 1:                                       return BLOCKED("TASK_RECORD_LOOKUP_AMBIGUOUS")
  taskRecord = matches[0]
  if recomputeTaskRecordHash(taskRecord) != taskRecord.taskRecordHash:
                                                                  return BLOCKED("TASK_RECORD_HASH_MISMATCH")
  if taskRecord.disposition == "BLOCKED":                         return BLOCKED("TASK_RECORD_BLOCKED")

  # currentContext/currentStopEpoch here are the PRIVILEGED PROCESS'S OWN fresh observations, taken by
  # the caller inside the gate — never parameters a submitter can influence
  recomputed = evaluateAuthorization(decisionRecord, taskRecord, currentContext, currentStopEpoch, policyVersion)
  if recomputed is NO_ENVELOPE:                                  return BLOCKED(recomputed.reason)

  # Field-by-field, in this precedence order — this orders which label is REPORTED when several
  # fields simultaneously disagree; it is a diagnostic precedence, not a forensic claim about which
  # field an attacker actually changed (a submission could fabricate several fields at once, and the
  # first-listed mismatch is simply what gets named):
  if recomputed.envelope.stopEpoch != submittedEnvelope.stopEpoch:
                                                                  return BLOCKED("REVOKED_BY_STOP_EPOCH")
  if recomputed.envelope.contextHash != submittedEnvelope.contextHash
     or recomputed.envelope.repositoryHead != submittedEnvelope.repositoryHead:
                                                                  return BLOCKED("EXPIRED_BY_DRIFT")
  if recomputed.envelope.envelopeHash != submittedEnvelope.envelopeHash:
                                                                  return BLOCKED("ENVELOPE_RECOMPUTATION_MISMATCH")
  return VERIFIED(recomputed.envelope)   # the independently-recomputed envelope, never the submitted one, is
                                          # what every subsequent step (below) actually acts on
```

A mismatch at any line above is `BLOCKED`, fail-closed, with **no partial trust** of whatever the
submission claimed — this is the direct, mechanical answer to the reviewer finding that an earlier
draft would have let a submitter mutate `disposition`, widen `allowedScope`, or fabricate a
`DecisionRecord`/`TaskRecord` outright: none of those fields are ever read from the submission for any
decision this design makes. This mirrors `PUBLICATION_BROKER.md`'s own commit/tree verification
exactly ("independently re-derives every remote-effect-critical fact from the Broker's own imported
Git object graph... never trusts the Envelope, the Receipt, or the package manifest's own claims").

**3. Consumption** (`checkAndConsume` — proposed home: the privileged Authorization Ledger, NOT
provisioned by this task — see "Trust Boundaries"; every branch not explicitly listed denies; the
gated portion executes inside **one atomic critical section keyed by the CANONICAL
`authorizationId`** — resolved before the gate is acquired, never the submission's own claimed value —
closing both the original check-then-mutate TOCTOU window and the untrusted-lock-key gap the follow-up
review found):

```text
function checkAndConsume(submittedEnvelope, canonicalStore, ledger, grantStore, policyVersion):
  if not isStructurallyBounded(submittedEnvelope):                 return DENY("INVALID_ENVELOPE_SHAPE")
  resolved = resolveCanonicalRecord(submittedEnvelope, canonicalStore)   # UNGATED — see above
  if resolved is BLOCKED:                                        return DENY(resolved.reason)

  canonicalAuthorizationId = resolved.canonicalAuthorizationId
  acquire the exclusive gate for canonicalAuthorizationId and the shared/reader global stopEpoch lock
  (blocks a concurrent second
  attempt against the SAME real decision — regardless of what authorizationId any submission for it
  claims — until this one fully completes; a stopEpoch bump cannot interleave)

  currentStopEpoch  = readCurrentGlobalStopEpoch()   # privileged process's own fresh read, taken now,
  currentContext    = readCurrentProjectContextPack() # inside this same gated section — not a parameter

  result = independentlyRederive(resolved.decisionRecord, canonicalStore, currentStopEpoch, currentContext, policyVersion, submittedEnvelope)
  if result is BLOCKED:                                          release locks; return DENY(result.reason)
  envelope = result.envelope   # the independently-recomputed one — the submission is now discarded

  if ledger.stateOf(envelope.authorizationId) == "CONSUMED":     release locks; return DENY("REPLAY_REJECTED")
  # stopEpoch/contextHash/repositoryHead drift is already fully closed by independentlyRederive's own
  # field-by-field comparison, above — no separate staleness check is performed here against a
  # caller-supplied value; nothing below this line ever reads a field from submittedEnvelope again

  if envelope.disposition == "PENDING_HUMAN_APPROVAL":
      # envelope.envelopeHash is the INDEPENDENTLY-RECOMPUTED hash — if stopEpoch/contextHash drifted
      # since a human approved some earlier version of this envelope, this lookup legitimately finds
      # no grant (the approved hash no longer exists) rather than needing a separate revocation call
      grant = grantStore.findByEnvelopeHash(envelope.envelopeHash)   # exact-hash lookup only
      if grant is None or grant.state != "AUTHORIZED":               release locks; return DENY("NO_VALID_GRANT")
      # Redundant-by-invariant, kept as an explicit belt-and-suspenders backstop (matching this
      # repository's own Publication Builder precedent of re-checking a fact more than once rather
      # than trusting a single upstream guarantee): grant creation's own rule already forces
      # grant.boundStopEpoch to equal whatever stopEpoch was baked into the approved envelope's hash,
      # so by the time a hash match is found here this can never actually disagree — it is not the
      # load-bearing check (the hash lookup itself already is), only a second independent assertion
      # of the same fact.
      if grant.boundStopEpoch != currentStopEpoch:                   release locks; return DENY("GRANT_REVOKED_BY_STOP_EPOCH")
      if now() >= grant.expiresAt:                                   release locks; return DENY("GRANT_EXPIRED")
      # This trusted privileged wall-clock read is used only to gate this consumption attempt; it
      # never constructs or mutates the immutable AuthorizationEnvelope (see Replay / Staleness /
      # Fencing Semantics).
      atomically (still inside this gate): grant.state = "CONSUMED"; ledger.mark(envelope.authorizationId, "CONSUMED")
      release locks; return ALLOW_ONCE("POLICY_SATISFIED")

  elif envelope.disposition == "POLICY_SATISFIED":
      atomically (still inside this gate): ledger.mark(envelope.authorizationId, "CONSUMED")
      release locks; return ALLOW_ONCE("POLICY_SATISFIED")

  else:                                                              release locks; return DENY("INVALID_STATE")
```

This ordering is normative: structurally validate first; resolve the canonical, hash-verified
`DecisionRecord` identity ungated; derive its canonical `authorizationId`; only then acquire the
canonical-identity gate and shared global epoch lock; once held, re-read/re-derive every mutable
privileged fact; then consume and atomically commit the Ledger result before releasing. The ungated
resolution does not reopen a TOCTOU gap because it reads only immutable, already-hash-verified
canonical data (`DecisionRecord` and `recordHash`) that cannot change beneath it. It reads or relies on
no mutable epoch, context, grant, or Ledger state; those facts are read or re-derived only inside the
held locks.

**Global `stopEpoch` fencing is a reader-writer lock, not a per-`authorizationId` gate.** Because
`stopEpoch` is a single global value guarding every concurrent consumption attempt at once (unlike
`PublicationGrant`'s per-grant `Revoke`, which only ever needs to fence one grant), the per-
`authorizationId` gate above is not by itself sufficient to linearize a `stopEpoch` bump against
consumption — a bump must be a globally exclusive operation relative to `readCurrentGlobalStopEpoch()`
calls: every `checkAndConsume` invocation holds a shared ("reader") lock on the global epoch register
for the duration of its own atomic section; bumping the epoch requires the exclusive ("writer") form of
that same lock, so a bump can never interleave with an in-flight consumption's read, and any
consumption that acquires its reader lock strictly after a bump has released the writer lock is
guaranteed to observe the new epoch. This is a deliberately simpler mechanism than
`PUBLICATION_BROKER.md`'s per-Grant `PhaseGate` (appropriate because `stopEpoch` protects one coarse,
global invariant, not many independent per-object ones) — not a claim that it copies the Broker's
mechanism exactly.

**This design's fencing guarantee ends at `ALLOW_ONCE`; it does not, and cannot, reach into an effect
that does not yet exist.** If a future Execution Gateway's actual effect is not atomic with
`checkAndConsume` itself (e.g., it needs to perform I/O afterward), **V1D's own design is required to
hold an equivalent exclusive lease spanning from `ALLOW_ONCE` through to the actual effect** — mirroring
`PUBLICATION_BROKER.md`'s Phase A/B gate-holding-through-remote-I/O pattern — so that a `stopEpoch` bump
occurring after `ALLOW_ONCE` but before the effect still has a defined, fenced outcome. This ADR states
the requirement; it cannot design or verify the mechanism, because no Gateway exists yet.

`ALLOW_ONCE` is this design's entire positive output — it is a fact ("this exact, independently-
reverified `DecisionRecord` has now been consumed exactly once"), not a capability grant, not a
command, and not itself connected to anything that acts. What a future Execution Gateway does with
that fact is explicitly outside this ADR's scope — see "Non-Goals" and the V1C exit-gate requirement in
"Staged Implementation Plan" for why standing up this Ledger alone still grants nothing.

### Replay / Staleness / Fencing Semantics

- **Replay** is closed two ways, not one: first, `authorizationId` is now a **deterministic**
  derivation of `(decisionRequestId, recordHash)` (see "Policy-Evaluation Algorithm"), so re-running
  the Binder against the same `DecisionRecord` — whether by Claude retrying, or by an adversary
  attempting to mint a second, differently-labeled envelope for an already-consumed decision — always
  produces the *same* `authorizationId`, never a fresh one an adversary could choose to dodge the
  ledger check. Second, the ledger's atomic check-and-mark is the *only* way the Ledger state ever
  becomes `CONSUMED` (the envelope remains immutable), and `checkAndConsume` denies outright the
  instant `ledger.stateOf(authorizationId) ==
  "CONSUMED"` — with the check and the mark executing inside one atomic per-`authorizationId` gate (no
  separate read-then-write steps an adversary could race), precisely the pattern `internal/grant`'s
  per-Grant `PhaseGate` already proves out for `PublicationGrant` (`PUBLICATION_BROKER.md`,
  "Linearizable Grant Revocation"); this design reuses that proven pattern rather than inventing a new
  one.
- **Staleness** is condition-based, not clock-based, for the `AuthorizationEnvelope`/Binder: the
  deterministic Authorization Binder / `evaluateAuthorization` envelope construction never reads
  wall-clock time. Deterministic context/staleness evaluation (`contextHash`/`repositoryHead` drift and
  `stopEpoch` fencing) uses only explicit, bound inputs — the caller's or privileged process's own
  freshly-observed values passed as parameters — never ambient or implicit time. The one narrow,
  named exception is privileged `AuthorizationGrant` validation/consumption: `checkAndConsume` may
  consult a trusted privileged wall clock solely for its `now() >= grant.expiresAt` check (mirroring
  `PublicationGrant.expires_at` exactly). That read never constructs or mutates the immutable
  `AuthorizationEnvelope`; it only gates whether that `checkAndConsume` attempt succeeds, and expiry
  fails closed with `GRANT_EXPIRED`. This exception does not make privileged policy evaluation
  generally nondeterministic; the pure-function/no-clock discipline remains unchanged for Binder/
  Envelope construction and deterministic context/fencing evaluation.
- **Fencing** is the global `stopEpoch`: bumping it is a single human action (via the same privileged
  path that creates `AuthorizationGrant`s — see "Trust Boundaries") that instantly invalidates every
  outstanding envelope and grant, because every consumption check re-reads the *current* epoch and
  compares it to the *bound* one. No enumeration, no per-envelope revocation call, and no possibility
  of "missing one" — a bump-and-forget kill switch is deliberately the coarsest, fastest lever
  available, on the theory that the moment a human needs the STOP epoch at all, speed and certainty
  matter more than surgical precision (any legitimately-still-wanted decision can simply be
  re-authorized under the new epoch).

### Human Approval Binding

Directly implementing the originating task's own instruction: *"Do not assume a human click is
sufficient unless it is cryptographically/deterministically bound to the exact authorization
subject."* Concretely:

- Approval binds to `envelopeHash` — **never** to `taskId`, `decisionRequestId`, a PR number, or any
  narrative description. "I approve task X" without the exact hash is not an `AuthorizationGrant`
  under this design; `checkAndConsume` has no code path that accepts anything less.
- The immutable envelope's `humanApproval.grantRef` remains permanently `null`; consuming a grant
  never mutates any hash-covered envelope field. The privileged Ledger alone records the association
  between canonical `authorizationId`, exact `envelopeHash`, exact grant identity/hash, grant state,
  and consumption result.
- `envelopeHash` is a domain-separated SHA-256 over the *entire* envelope (minus itself) — a one-byte
  change anywhere (scope, riskClass, contextHash, stopEpoch, anything) produces a different hash and
  silently invalidates any prior approval, mechanically, exactly as `PUBLICATION_BROKER.md`'s REQUEST
  DIGEST does for publication ("a single byte changed anywhere... changes the final REQUEST DIGEST —
  this is what makes 'one-byte modification after authorization invalidates the grant' a mechanical
  fact, not a policy statement").
- The `AuthorizationGrant`-creation path is structurally unreachable by Claude or any Codex role — the
  same privilege-separation the Broker's admin/client Unix-socket split already proves is achievable at
  the type level (`internal/grant.Store.Admin()` vs. `.Client()`, disjoint handles). Claude may
  construct and display (never approve) a *candidate* envelope and print its `envelopeHash` for a human
  to review — exactly as `mihver-publish` prints the REQUEST DIGEST without acting on it — but no tool
  Claude holds can both compute that hash and independently satisfy the approval requirement for it.
- The Publication Builder/Broker separation is fully preserved and untouched: even after a
  `POLICY_SATISFIED` envelope exists, the Local Publication Builder and Publication Broker still
  perform every one of their own existing checks unchanged (`PUBLICATION_BROKER.md`'s "Independent
  Commit/Tree Verification", "Server-Side PublicationGrant" — "A Claude-authored PublicationEnvelope is
  not sufficient evidence that a human authorized remote publication" applies here without
  modification: neither is a Claude-authored `AuthorizationEnvelope`, for the analogous reason).

### R0–R4 Authorization Mapping

Re-derived from ADR-0005's own R0–R4 semantics (unmodified) — this table is this ADR's own
interpretation layer, not a change to ADR-0005:

| Risk | `DecisionRecord.disposition` (ADR-0005, unmodified) | Council component | Human component (this ADR) | Reachable `AuthorizationEnvelope.disposition` |
|---|---|---|---|---|
| R0 | `COUNCIL_NOT_REQUIRED` | N/A — no council gate applies (ADR-0005) | none required by this ADR | `POLICY_SATISFIED` (same ceiling as every other class — **not** a grant of executability; see "Central design thesis") |
| R1 | `COUNCIL_APPROVED` (≥2 approvals + provider diversity) | satisfied | none required by this ADR | `POLICY_SATISFIED` |
| R2 | `COUNCIL_APPROVED` (both Reviewers approve) | satisfied | none required by this ADR | `POLICY_SATISFIED` |
| R3 | `HUMAN_APPROVAL_REQUIRED` (3/3 approved, but ADR-0005 itself already says "council approval alone is never sufficient") | satisfied (necessary, not sufficient) | **required** — exact-bound `AuthorizationGrant` must be consumed | Immutable envelope remains `PENDING_HUMAN_APPROVAL`; successful grant consumption yields the Ledger result `POLICY_SATISFIED` |
| R4 | `DENIED` | hard deny (ADR-0005) | irrelevant — never reached | **no envelope constructed, ever** — `R4_HARD_DENY` short-circuits before any envelope object exists, mirroring ADR-0005's own kernel never entering `FINALIZE` for R4 |
| (any) | `NO_QUORUM` | not met | irrelevant — never reached | **no envelope constructed** — `COUNCIL_GATE_NOT_MET` |

The council and human components are **structurally ANDed, never merged into one condition**: nothing
in `evaluateAuthorization` or `checkAndConsume` computes "3/3 approved OR human approved" — R3's path
requires both facts, verified independently, at two different steps, by two different trust-zone
actors (Step 4 of construction reads only `decisionRecord.disposition`; `checkAndConsume`'s grant
lookup is a wholly separate check that construction cannot see or influence).

### Authority Matrix

| Actor | Construct candidate envelope | Evaluate policy (Step 1–4 above) | Bump global `stopEpoch` | Create `AuthorizationGrant` | Revoke a grant | Mark envelope `CONSUMED` | Read the Ledger | Invoke a future Execution Gateway |
|---|---|---|---|---|---|---|---|---|
| Human (privileged/admin path) | no | no | **yes — only actor who can** | **yes — only actor who can** | **yes** | no (system does this atomically) | yes | policy TBD by a future, separate ADR |
| Human (ordinary PR/merge review) | no | no | no | no | no | no | no (unless also the privileged operator) | no |
| Claude (Orchestrator) | **yes** — invokes the deterministic Binder, exactly as it invokes the Local Publication Builder today | no — the Binder is a pure function Claude calls, not a decision Claude makes | **no** | **no** | no | no | read-only, for reporting | **no — never** |
| Codex (any role) | no | no | no | no | no | no | no | no |
| Authorization Binder (deterministic, model-writable zone) | (is the mechanism) | (is the mechanism) | no | no | no | no | no | no |
| Authorization Ledger / Grant Store (privileged zone, NOT provisioned) | no | no | no (only via the human's admin path) | (is the mechanism) | (is the mechanism) | (is the mechanism) | (is the store) | no |
| Future Execution Gateway (NOT BUILT) | no | no | no | no | no | may *attempt* `checkAndConsume` exactly once per envelope — outcome is the Ledger's, not the Gateway's | read-only | **out of scope for this ADR entirely** |
| Publication Broker (existing, separate) | no | no | no | no | no | no | no | n/a — orthogonal system; see "Relationship to Existing Artifacts" |

No row grants Claude or any Codex role anything in the "privileged" columns — this is the mechanical
answer to fail-closed principle 9 ("Claude self-authorizing"): there is no cell in this matrix where
Claude can.

### Trust Boundaries

Three zones, directly reusing `PUBLICATION_BROKER.md`'s own trust-zone vocabulary rather than
inventing a new model:

```text
┌───────────────────────────────────────────────────────────────────────┐
│ MODEL-WRITABLE ZONE (Claude / Codex / development user)                │
│  scripts/dev/authorization-binder.mjs (PROPOSED, NOT YET WRITTEN)      │
│    -> pure function: DecisionRecord + TaskRecord + live ProjectContext │
│       Pack + observed stopEpoch -> a candidate AuthorizationEnvelope   │
│    -> prints envelopeHash for human review; never acts on it           │
└───────────────────────────────────┬───────────────────────────────────┘
                                     │ untrusted candidate object, never a command
                                     ▼
┌───────────────────────────────────────────────────────────────────────┐
│ PRIVILEGE BOUNDARY -- NOT PROVISIONED BY THIS TASK                     │
│  Authorization Ledger (authorizationId -> state, atomic compare-and-   │
│  set, append-only audit) + AuthorizationGrant store + the global       │
│  stopEpoch register -- proposed to co-locate with, or sit directly     │
│  adjacent to, the Publication Broker's own privileged process/OS       │
│  identity (PUBLICATION_BROKER.md), reusing its already-designed        │
│  privilege-separation rather than standing up a second one; NOT        │
│  decided by this ADR which of the two shapes is chosen (see "Open      │
│  Questions") -- reachable for grant-creation/stopEpoch-bump only via   │
│  a privileged admin path structurally unreachable by Claude/Codex,     │
│  exactly like the Broker's admin Unix socket vs. its client socket.    │
│  MUST (V1C, normative): the admin/client capability split is           │
│  implemented as DISJOINT TYPES/HANDLES (as internal/grant.Store's      │
│  Admin()/Client() are disjoint Go types), not merely two socket paths  │
│  on one shared object -- a bare textual "unreachable" claim without an │
│  equivalent compile-time-checkable separation is declarative, not      │
│  structural, and does not satisfy this design's privilege-separation   │
│  requirement                                                           │
└───────────────────────────────────┬───────────────────────────────────┘
                                     │ ALLOW_ONCE("POLICY_SATISFIED") fact only
                                     ▼
┌───────────────────────────────────────────────────────────────────────┐
│ EXECUTION GATEWAY -- DOES NOT EXIST. NOT DEFINED. NOT DESIGNED HERE.   │
│  Whatever a future, separately-authorized ADR defines this to be, it   │
│  consumes at most one ALLOW_ONCE fact per envelope and is contractually│
│  required (by whichever future ADR defines it) to treat allowedScope/  │
│  actionType/prohibitedEffects as its ONLY authorization surface --     │
│  never proposalContent, never free text, never a chat message.        │
└───────────────────────────────────────────────────────────────────────┘
```

**No component in the middle zone is provisioned, installed, or run by this task** — same status as
`PUBLICATION_BROKER.md`'s own source-vs-activation distinction, one step earlier: this ADR does not
even reach "source implemented, not provisioned" (`tools/publication-broker/`'s status). It reaches
only "designed, nothing written."

## Rationale

**Why not just extend `DecisionRecord` itself with these fields?** `DecisionRecord` is frozen by
Accepted ADR-0005; amending it would be exactly the "protocol-boundary blocker" the originating task
warns against, and would conflate "what the council said" with "what is authorized to happen next" —
two facts ADR-0005 itself already insists must stay separate (`disposition` vs. `state`, and the
Authority Boundary section's explicit list of things a `DecisionRecord` is *not*). A new, separate
artifact preserves ADR-0005's own boundary instead of eroding it.

**Why reuse the Publication Broker's trust-zone/digest-binding pattern instead of designing a new
one?** MIHVER already has exactly one precedent for "a privileged, non-model-writable component
independently verifies a fact and only a human can create the record of authorization to act" —
`PublicationGrant`/the admin-socket split. Inventing a second, differently-shaped trust model for a
structurally identical problem (bind an approval to an exact digest, prevent replay, prevent the
model-writable zone from self-authorizing) would be needless novelty. Where this design deviates
(`approverIdentity`, `boundStopEpoch`) it says so explicitly and gives a reason tied to what's actually
different about R3 decisions versus routine publication.

**Why one shared ceiling (`POLICY_SATISFIED`) instead of a per-risk-class "executable" flag?** Because
this task's own risk mapping requirement ("R0: council not required does NOT automatically equal
executable") generalizes: nothing decided by this ADR should equal executable, for any risk class.
Introducing a flag that meant "may execute" for even one risk class would immediately become the
attack surface every other fail-closed principle exists to close. A single ceiling with no
"executable" bit anywhere in the schema makes the boundary impossible to cross by construction, not
merely by convention.

**Why lazy, on-read staleness/fencing checks instead of an active revocation sweep?** An active sweep
needs to enumerate every outstanding envelope, which requires a durable index this design would then
have to get right under concurrency — genuinely new complexity for a case that lazy checking already
covers correctly: nothing can *act* on a stale/revoked envelope without first passing
`checkAndConsume`, and that function always re-reads the current epoch/context fresh. This mirrors
`ProjectContextPack`'s own "recompile/compare is the only signal" staleness model and the Publication
Broker's "always re-observe fresh" discipline — both already-accepted precedents for exactly this
trade-off.

## Consequences

- A future task that designs the Execution Gateway inherits an already-hardened contract
  (`AuthorizationEnvelope`, the Ledger, `AuthorizationGrant`, the global `stopEpoch`) instead of having
  to invent scope-binding, replay-protection, and human-approval-binding under its own time pressure —
  exactly the benefit ADR-0005 cites for having built the kernel before Shadow Council existed.
- `AuthorizationEnvelope`'s shape (no execution-authority field, no "may execute" bit, no timestamp) is
  now load-bearing for any later implementation task — a V1B Implementer task should treat this shape
  as a given input, not redesign it away, exactly as ADR-0005 asks of any later Run Bundle integration
  for `DecisionRecord`.
- Any future task touching `TaskRecord.allowedScope`'s or `TaskRecord.forbiddenScope`'s semantics must
  now also consider that `AuthorizationEnvelope.allowedScope` is their canonical first-occurrence-
  ordered, duplicate-free set difference as defined above — a change to
  `TaskRecord`'s scope model is no longer purely local to `RUN_BUNDLE.md`.
- The ~150-line/2-file Implementer-delegation threshold in `AGENT_POLICY.md` will very likely be
  exceeded once a V1B task actually implements the Binder + schema + adversarial test suite — per that
  policy, that future implementation work goes to a Codex Implementer, not Claude directly, exactly as
  ADR-0005's own kernel did.

## Alternatives Considered

- **Extend `DecisionRecord` directly with scope/human-approval/replay fields** — rejected: would
  require amending a frozen, Accepted ADR for a purpose ADR-0005 itself explicitly defers ("whatever
  later phase actually authorizes council output to gate an action... this ADR explicitly does not
  define or imply"); also conflates council fact with authorization fact, which ADR-0005's `state`/
  `disposition` split already establishes as a bad pattern.
- **Fold `AuthorizationEnvelope`/`AuthorizationGrant` into one schema file alongside**
  the ADR-0005 kernel's five-typed-artifact wire model directly (`DecisionRequest`, `AgentProposal`,
  `AgentVote`, etc. already live in one file) — rejected here for the opposite reason: this ADR's
  artifacts serve a structurally different purpose (authorization, not council deliberation) and gain
  nothing from sharing a file; keeping them separate makes "which ADR owns this fact" unambiguous by
  file boundary alone, matching the Document Authority Model's Owner principle in `AGENT_POLICY.md`.
- **A per-envelope revocation list instead of a global `stopEpoch` counter** — rejected for the STOP/
  kill-switch use case specifically (though `AuthorizationGrant.state == REVOKED`, an existing
  per-grant mechanism, remains available for ordinary single-grant revocation): a global emergency stop
  that requires enumerating and individually revoking every outstanding envelope is exactly the kind of
  mechanism that can silently miss one under the time pressure a STOP action implies. A single counter
  bump that invalidates everything at once, unconditionally, is the safer default for the specific case
  this field exists for.
- **A fixed wall-clock TTL on `AuthorizationEnvelope` itself** (e.g., "expires after 24 hours") —
  rejected for the Binder/Envelope layer: it would reintroduce a clock dependency into what is
  otherwise a pure function, for a staleness signal (`contextHash`/`repositoryHead` drift) that already
  exists and is strictly more precise (a HEAD move in 5 minutes is caught; an untouched HEAD at 23
  hours is not falsely expired). A wall-clock `expiresAt` is retained only on the separately-precedented,
  already-non-pure `AuthorizationGrant` (mirroring `PublicationGrant.expires_at` exactly), not on the
  envelope.
- **Skip `approverIdentity` and rely purely on admin-socket-equivalent access control, matching
  `PublicationGrant` exactly** — rejected because the originating task explicitly requires "exact-bound
  approval identity where applicable," and R3's higher consequence/lower frequency profile justifies
  the extra field even though routine publication does not need it.

## Risks

- **This design cannot mechanically enforce "no free-form natural-language permission interpretation"
  (fail-closed principle 10) against a future Execution Gateway that hasn't been written yet.** The
  schema proposal makes `allowedScope`/`actionType`/`prohibitedEffects` the only closed, typed
  authorization surface, but nothing in this ADR can stop a future implementation from also reading
  `proposalContent.summary` and treating it as permission — that is a code-review/architecture-
  invariant obligation for whichever future task builds the Gateway, not something this design document
  can enforce today. Recorded here so that future review has an explicit invariant to check.
- **`approverIdentity` is captured non-spoofably from the admin path's own authentication mechanism,
  but is still a plain string, not (in V1A) a cryptographic signature — and this ADR does not define
  which identities are eligible to approve at all.** It proves "the privileged path attributed this
  approval to this specific identity, and that attribution wasn't a caller's own free-text claim," not
  "this specific named human, provably, approved this exact byte sequence, non-repudiably," and not
  "this identity was authorized to approve R3 decisions in the first place." Both gaps (signature-based
  non-repudiation; an allowed-approver roster/policy) are named as Open Questions below, not resolved
  here — resolving them is an implementation/operational-policy decision this design task is not scoped
  to make.
- **Where the Authorization Ledger/Grant store should actually live (co-located with the Publication
  Broker's privilege boundary, or a separate one) is left open.** Reusing the Broker's boundary reduces
  provisioning burden (one OS identity, one set of deployment mechanics instead of two) but couples two
  systems that are otherwise orthogonal (an R3 decision need not be about publication at all); standing
  up a separate boundary avoids that coupling at the cost of duplicating deployment work. This design
  does not resolve the trade-off — see "Open Questions."
- **Nothing in this design has been implemented or tested against real fixtures.** ADR-0005's own kernel
  was proven via a deterministic fake-agent simulator and an adversarial test matrix before being
  trusted; this ADR's Binder/policy-evaluation algorithm has undergone only adversarial *design* review
  (see "Adversarial Review" in the final report), not adversarial *test* review, because no
  implementation exists yet to test.

## Adversarial Cases

Each maps to one threat from "Threat Model" and one fail-closed principle from the originating task:

| # | Attack | Mechanical defense |
|---|---|---|
| A1 | A future Gateway treats a bare `DecisionRecord` as sufficient | Structural — no Gateway exists yet; when one does, this ADR's contract is what a future task is required to design against, per its own authorization (out of this task's power to enforce beyond documenting it) |
| A2 | `proposalContent` (council/model output) supplies or widens scope | `evaluateAuthorization` never reads `proposalContent` for scope at all; `allowedScope` is the canonical first-occurrence-ordered, duplicate-free result of excluding exact `TaskRecord.forbiddenScope` tokens from `TaskRecord.allowedScope` |
| A3 | Stale `contextHash`/`repositoryHead` presented after repository state moved | Independent Re-Verification re-derives `contextHash`/`repositoryHead` freshly, inside the same atomic gate as consumption, from the privileged process's own observation — never from anything the submission claims; construction-time's own `CONTEXT_ALREADY_STALE` check additionally stops an already-stale candidate from ever being built at all |
| A4 | Replay of an already-consumed authorization, including via a freshly-minted, differently-labeled envelope for the same decision | `authorizationId` is a deterministic function of `(decisionRequestId, recordHash)`, not caller-chosen — closes the "mint a new ID to dodge the ledger" vector — combined with the atomic per-`authorizationId` ledger compare-and-set; `REPLAY_REJECTED` on any second attempt |
| A5 | STOP action given but an in-flight authorization still lands | Consumption holds a shared lock on the global `stopEpoch` register for its entire atomic section; a bump requires the exclusive form of that same lock, so the two can never interleave — see "Policy-Evaluation Algorithm"'s reader-writer-lock fencing model |
| A6 | Risk class silently downgraded (R3 treated as R1) | `riskClass`/`disposition` are read from the privileged side's own independently-retrieved, hash-verified `DecisionRecord` — never from the submitted envelope's claims and never a function parameter a caller controls |
| A7 | R3 "approved" by something short of an exact-bound grant | `checkAndConsume`'s grant lookup is by an *independently recomputed* `envelopeHash`, never the submission's own claimed hash; no fallback path accepts a `taskId`-only or narrative approval |
| A8 | An R4 decision retried/reframed into an authorizable shape | `R4_HARD_DENY` is checked first, unconditionally, against the independently-retrieved canonical `DecisionRecord` — mirrors ADR-0005's own kernel never entering `FINALIZE` for R4 |
| A9 | Claude authors both the envelope and its own approval | Grant creation is in the privileged zone; no Claude-held tool can reach it (see "Trust Boundaries", "Authority Matrix"); grant creation also independently re-verifies the envelope it approves, so even a Claude-fabricated candidate cannot be rubber-stamped |
| A10 | A future executor parses `proposalContent`/a commit message as permission | Named explicitly as an enforcement obligation this design cannot mechanically guarantee — see "Risks" |
| A11 | A `BLOCKED` TaskRecord or a scope token it explicitly forbids reaches authorization | Construction and privileged re-derivation both return `TASK_RECORD_BLOCKED` for disposition `BLOCKED`; otherwise both compute the identical first-occurrence-ordered, duplicate-free result after fail-closed exclusion of every forbidden token |

**Confused-deputy check (adversarial axis A).** The `TaskRecord` a given `DecisionRecord` binds scope
from is looked up by `taskId` equality, not supplied by whoever is constructing the envelope — so a
caller cannot present `DecisionRecord` for task X alongside a differently-scoped `TaskRecord` for task
Y to smuggle in broader scope; `TASK_IDENTITY_MISMATCH` fails closed the moment the two disagree.

## Non-Goals

Restated explicitly, matching the originating task's own list — none of the following exists, is
activated, or is implied by this ADR:

- Bounded autonomy of any kind is not activated. Reaching `POLICY_SATISFIED` for any risk class,
  including R0, grants no execution authority.
- No real Shadow Council provider is called; nothing here touches Shadow Council's runtime.
- ADR-0005 and its kernel/simulator/schema are not modified — every field, hash recipe, and state
  transition ADR-0005 defines remains byte-identical.
- The Publication Broker is not activated, provisioned, or touched.
- No executor exists; no code in this task calls a tool, mutates Git, or runs a command as a result of
  any authorization concept defined here.
- No council→tool path exists; nothing a council seat or `proposalContent` says can reach any action.
- No autonomous task selection is enabled.
- Claude is granted no execution authority — see the Authority Matrix's Claude row, every cell "no".
- The real `actionType` catalog for a future Execution Gateway is not defined — V1A's field carries
  exactly one placeholder value.
- Where the Authorization Ledger/Grant store is actually hosted is not decided — see "Open Questions".

## Open Questions

- Should the Authorization Ledger/Grant store co-locate with the Publication Broker's privilege
  boundary (one OS identity, shared deployment mechanics) or stand up as a fully separate privileged
  service? Left open for whichever future task actually implements V1C (see "Staged Implementation
  Plan") — a decision that should weigh operational burden against keeping R3 decisions (which need not
  be about publication at all) decoupled from the Broker's git-specific concerns.
- Should `approverIdentity` be hardened into a cryptographic signature over the exact `envelopeHash`
  (closing the non-repudiation gap named in "Risks"), and if so, under what key-custody model? Not
  resolved here — an implementation/cryptography decision, not a V1A design-scope question.
- Should a future, separate bounded-autonomy policy ever be permitted to treat a `POLICY_SATISFIED`
  envelope as sufficient for *some* narrowly-scoped R0/R1 action classes (per `ROADMAP.md` §17.5,
  itself still `PLANNED`, not authorized)? This ADR deliberately takes no position — see "Central design
  thesis" and "Non-Goals". Any such policy would need its own ADR, its own Acceptance Gate, and its own
  explicit human authorization; it would not fall out of this design automatically.
- **Where does the privileged zone's canonical, trusted copy of a `DecisionRecord`/`TaskRecord` actually
  come from?** "Policy-Evaluation Algorithm"'s Independent Re-Verification step requires the privileged
  side to look these up from its own `canonicalStore`, never from a submission — but *how* a
  `DecisionRecord` (produced today only by the model-writable-zone kernel/simulator, with no persistent
  store and, per the existing Run Bundle scout inventory, no `DecisionRecord` evidence kind yet defined
  in `schemas/dev/evidence-manifest.schema.json`) gets imported into that trusted store, and by what
  mechanism it is kept from being tampered with in transit, is left entirely to V1C. This mirrors the
  Publication Broker's own `internal/pkgimport` ("imports an untrusted Git bundle into a fresh,
  broker-owned bare repository... never executes bundle content") as the closest existing precedent for
  "import untrusted bytes into a trusted store without trusting their claims," but V1C must design its
  own equivalent for `DecisionRecord`/`TaskRecord` specifically — this ADR states the requirement
  (independent re-verification against a canonical copy), not the import mechanism.
- Who, specifically, is an eligible R3 approver — an allowed-approver roster or policy — is not defined
  by this ADR. `approverIdentity` (this ADR) specifies *how* an identity is captured non-spoofably; it
  does not specify *which* identities the privileged admin path should accept at all. Left to V1C.

## Future Work / Staged Implementation Plan

Mirroring ADR-0005's own staging discipline (kernel → real exercise → acceptance, each separately
authorized): no stage below is authorized by this ADR. Each requires its own separate, explicit human
task instruction, exactly like every checkpoint in `.project/PROJECT_STATE.md`'s "Next Authorized
Action" already insists on.

1. **V1A — Design (this task).** This ADR only, `Status: Proposed`. No code, no schema file, no
   executor.
2. **V1B — Deterministic Binder + schema (future, separately authorized).** Implement
   `scripts/dev/authorization-binder.mjs` (pure, non-LLM, network-free — same idiom as
   `decision-council-kernel.mjs`/`publication-builder.mjs`) and
   `schemas/dev/authorization-envelope.schema.json`, plus an adversarial test suite exercising every
   row of the "Adversarial Cases" table above against real fixtures. Still **no** privileged Ledger, no
   Grant store, no Gateway — the Binder only ever produces a candidate envelope for inspection, exactly
   as the Decision Council simulator stage did before Shadow Council existed. Per `AGENT_POLICY.md`'s
   mandatory Implementer-delegation threshold, the bulk of this implementation would go to a Codex
   Implementer, not Claude directly, once scoped.
3. **V1C — Privileged Authorization Ledger + `AuthorizationGrant` admin path (future, separately
   authorized).** Resolves the "Open Questions" hosting decision, then implements the privileged
   component itself, with its own human-provisioning checklist analogous to
   `PUBLICATION_BROKER.md`'s — a separate OS identity or shared one, an admin-path equivalent to the
   Broker's admin socket, and its own adversarial test suite against disposable local fixtures only,
   never a live credential, matching the Broker's own testing discipline
   (`tools/publication-broker/**`). **V1C exit-gate requirement, normative:** V1C's own completion
   report must confirm that **no consumer of `checkAndConsume` or the Ledger exists anywhere in the
   repository** — no script, no Night Runner integration, no wiring of any kind connects a
   `POLICY_SATISFIED`/`ALLOW_ONCE` result to any effect. An implemented-but-uncalled Ledger, exactly
   like the Publication Broker's own implemented-but-unprovisioned source, is what keeps V1C from
   itself constituting execution capability — this must be verified, not merely asserted, by V1C's own
   Codex Verifier pass (a repository-wide search for any call site) before V1C can be reported
   complete.
4. **V1D — Execution Gateway (future, separately authorized, its own ADR).** Explicitly out of scope
   for every stage above. Defines the real `actionType` catalog, the Gateway's own policy for what a
   `POLICY_SATISFIED` fact is actually sufficient for (which may still require additional gates this
   ADR does not define), and its own Acceptance Gate. No stage before this one implies, authorizes, or
   pre-designs any part of it beyond the closed, typed surface (`allowedScope`/`actionType`/
   `prohibitedEffects`) this ADR requires any future Gateway to treat as its only authorization input.

Each stage requires independent adversarial review before the next is authorized, exactly as ADR-0005's
own Acceptance Gate required for Shadow Council.
