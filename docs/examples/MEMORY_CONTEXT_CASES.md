# Memory Context Semantic Test Corpus

A worked-example corpus for [MEMORY_CONTEXT](../contracts/MEMORY_CONTEXT.md) and
[ADR-0004](../adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md), the same role
[REQUIREMENT_CASES](./REQUIREMENT_CASES.md) plays for
[REQUIREMENT_SPEC](../contracts/REQUIREMENT_SPEC.md). Each case assumes a `MemoryContext` has
already been produced by the dedicated retrieval boundary `ADR-0004` designs — **not** a stage
querying Brain directly, which is never legitimate under this model (M-15). **Current status:**
Intent Parsing, Research Planning, and Requirement Derivation are the three stages currently
authorized to consume `MemoryContext` (see "Stage Consumption Authorization" in `MEMORY_CONTEXT.md`)
— Intent Parsing at `DISCOVERY_ATTENTION` and `SEMANTIC_PREMISE`, Research Planning at
`DISCOVERY_ATTENTION` only, Requirement Derivation at `DECISION_OPTION` only (dependency D, for an
already-established R-19-eligible working default — see Case 24 below and R-24). Every other stage
named below remains unauthorized; a case naming an unauthorized stage describes what *would* be
correct only once that stage's own separate `M0_SCOPE.md` amendment is authorized, and is written now
so any future such amendment has a tested semantic target to implement against.

Brain memory types referenced below (`project`, `decision`, `lesson`, `incident`, `pattern`,
`playbook`, `reference`, `inbox`) are the actual eight types `../mihver-brain` supports, verified
against its own schema — none is invented for this corpus.

**Every case assumes a `RunContext` (or its explicit absence) already established the current run's
project identity, independently of Brain, before any retrieval happened** (see "Current-Run Scope
Anchor: RunContext" in `MEMORY_CONTEXT.md`). No case treats a Brain `project` record as the source of
that identity — a `project` record may only *corroborate* an identity `RunContext` already
established (Case 14). Every memory's scope in every case below is stated explicitly (project-scoped
to the current project, `global`, or another project entirely and therefore excluded) — an earlier
draft left several cases' cross-project applicability ambiguous ("a prior project," "a different
past project"); every such instance has been resolved one way or the other, since ambiguous scope is
itself a defect this corpus should never model as acceptable.

**Every case that describes a record read as a historical user statement states explicitly whether it
is Category A (direct — inspectably and resolvably traceable to an original historical user-authored
source) or Category B (derived/unverified — reads like a user statement but lacks that traceable
linkage), per `MEMORY_CONTEXT.md`'s "Historical User Provenance Gate."** This gate applies by content,
never by stored Brain `type` — most cases below use `decision`-type records, since that is the natural
fit for this content, but the gate applies identically to a record of any other non-`inbox` type that
actually describes a historical user statement (Case 23 works this through explicitly, for a
misfiled `reference`-type record). Only Category A entries may ever be cited as the premise of a
current-run Inferred Claim; Category B entries are restricted to `DISCOVERY_ATTENTION` use (shaping a
clarification question, informing retrieval) under every circumstance, regardless of stored type.
Where a case's outcome does not depend on the distinction (the memory is excluded or never cited as a
premise regardless of category), this is stated explicitly rather than left ambiguous.

**Read every "Allowed use" and "Expected stage behavior" line below naming a stage other than Intent
Parsing, Research Planning, or Requirement Derivation as implicitly prefixed by "once that specific
stage is separately authorized to consume `MemoryContext` (not yet performed)."** This applies to
Research + Evidence Collection, Technology Candidate Identification, Architecture Synthesis, and
Evaluation alike — with no exceptions and no case-by-case re-statement needed; each such stage's own
authorization is **dependency A** in `ADR-0004`'s "Acceptance Gate" (the core `M0_SCOPE.md`
amendment: `RunContext`, the producer's own contract, and that stage's declared input), performed
separately per stage — already completed for Intent Parsing, Research Planning, and Requirement
Derivation, not yet performed for any other stage. Two further, narrower paths require a separate,
additional amendment on top of a stage's own dependency A, and are read as further conditioned on it
wherever a case describes them: citing a `MemoryContext` entry as the premise of an Inferred Claim
requires **dependency B** (`INTENT_SPEC.md`) — **implemented**, for Intent Parsing; a memory-informed
R-19 default's "memory-informed rationale" citation requires **dependency D**
(`REQUIREMENT_SPEC.md`'s R-24) — **implemented**, for Requirement Derivation, restricted to exactly
the `DECISION_OPTION` tier (see Case 24). **Dependency C** (citing a `MemoryContext` entry directly as
a Requirement-Level Inference's premise) was re-derived after dependency B landed and found
redundant/incoherent against `REQUIREMENT_SPEC.md`'s own R-10/R-22 semantics — it is **retired**, not
a pending future capability; no case below should be read as describing a future direct
Requirement-level `MemoryContext` premise, and Requirement Derivation's own dependency-D
authorization grants no path to it either. Where a case shows historical-user memory legitimately
affecting a Requirement, the correct path is `MemoryContext` → Intent Parsing (dependency B) → a
current-run Inferred Claim → Requirement Derivation consuming that Claim under its own existing,
unmodified authority (R-03/R-10/R-22/R-23) — see `ADR-0004`'s "Post-Acceptance Dependency B/C
Disposition" and `REQUIREMENT_SPEC.md`'s R-23 for the precise mapping. No case in this corpus
authorizes any consumption today for a stage, or influence tier, not already separately authorized on
`main`.

---

## 1. Stable historical preference, no current mention

**Memory input:** `decision`, project-scoped, **Category A (direct)** — the record's body inspectably
cites the specific past `UserIdea` version/turn it quotes ("`UserIdea` v1, turn 3: 'I'd like to use
PostgreSQL over other databases'"), so it is traceable, not merely paraphrased — "user stated a
preference for PostgreSQL over other databases" (Brain confidence: medium, `status: active`, no
supersession).

**Current-run input:** Same project. Current `UserIdea` contains no statement about databases at
all.

**Allowed use:** Because this entry is Category A, it may be cited as the premise for an Inferred
Claim ("the system SHOULD use PostgreSQL, Inference-derived from a historical statement, moderate
confidence, provisional/reversible") — or as informational input shaping a candidate clarification
question ("a prior statement of yours named PostgreSQL — still your preference here?"). Both require
the `MemoryContext` entry to be explicitly cited as the premise, and the Inferred Claim's provenance
must state that the entry is Category A and name the originating turn (M-18). **Contrast:** had this
record instead lacked the inspectable citation (Category B — e.g. it merely read "user prefers
PostgreSQL" with no traceable source), only the clarification-question path would be available; citing
it as the Inferred Claim's premise would violate M-18 regardless of how plausible or confidently
worded the record is.

**Forbidden transformation:** Compiling directly into a User-Provided Requirement ("the system MUST
use PostgreSQL") with no Inference layer, no confidence, and no provisional marking. (Violates M-03.)

**Clarification required?** Not mandatory (MEDIUM-territory default-technology preference) — either
path above is defensible; silently doing neither (dropping the memory without any record) is not.

**Expected provenance behavior:** The Inferred Claim's provenance names the `MemoryContext` entry as
its premise, explicitly labeled "historical, not current-run," states its Category A status and
originating turn (M-18), and separately states the reasoning basis for the Claim's own current force
(a preference here, so M-20's force-inheritance risk is lower-stakes than an obligation/prohibition
would be, but the same independent-reasoning discipline still applies); the historical origin is
never compressed into looking like a current-run statement.

**Expected stage behavior:** Intent Parsing may use this; it never mints a User-Provided Claim from
it directly.

---

## 2. Historical preference contradicted by current UserIdea

**Memory input:** `decision`, project-scoped to this same current project, "user preferred
local-only execution" (medium confidence, active). (Category A/B under "Historical User Provenance
Gate" is immaterial to this case's outcome — the entry is never used at all once contradicted,
regardless of how directly it traces to the user's own words.)

**Current-run input:** Current `UserIdea`: "this project must run in our cloud account."

**Allowed use:** The current statement is compiled normally as a User-Provided Claim. Intent
Parsing — the consuming stage with actual interpretive authority here, never `MemoryContext`
production itself (see "Separating Admissibility from Interpretation") — notices the cited memory
entry no longer applies and does not use it; that fact is recorded in `IntentSpec`'s own provenance.

**Forbidden transformation:** Silently letting the memory override or qualify the current cloud
statement; silently discarding the memory with no trace at all (both violate "Current Input Must
Win"); `MemoryContext` production itself attempting to detect this contradiction and pre-mark the
entry stale before any consuming stage has interpreted anything (that would make production a hidden
Intent Parser — exactly what "Separating Admissibility from Interpretation" forbids).

**Clarification required?** No — the current statement is unambiguous and already authoritative;
nothing about the contradiction itself needs to be surfaced to the user unless the contradicted
question happens to be independently HIGH/CRITICAL on its own merits (it is not, here — deployment
locality was already resolved by the current statement).

**Expected provenance behavior:** `IntentSpec`'s own provenance — not `MemoryContext`'s frozen
snapshot — records that this memory entry was considered and found contradicted by the current
statement; never folded into `IntentSpec`'s Conflict machinery either, since the memory was never a
Claim (M-09).

**Expected stage behavior:** Intent Parsing proceeds on the current statement alone and is the one
that determines and records the contradiction; `MemoryContext` production never attempts this
determination itself.

---

## 3. Historical user obligation from another project

**Memory input:** `decision`, scoped to Project A, "user stated: the system MUST log every
administrative action for audit purposes" (high confidence, active). (Category A/B under "Historical
User Provenance Gate" is immaterial here — the record is excluded mechanically on project-scope
mismatch, below, before any premise eligibility question is ever reached.)

**Current-run input:** Project B. Current `UserIdea` says nothing about audit logging.

**Allowed use:** None, by default. The "is this genuinely project-agnostic" question (M-06) is
never even reached here — that question only ever arises for a record Brain has actually tagged
`global`, and even then it is a consuming-stage judgment, never production's. A record explicitly
scoped to Project A carries no `global` tag at all, so it is excluded from Project B's
`MemoryContext` outright, on scope alone, with no content-inspection path — by production or by any
consuming stage — that could override its recorded, specific scope. (An earlier draft of this case
allowed production to judge a Project-A-scoped record "genuinely project-agnostic" and admit it into
Project B on that basis — that was itself the defect: it let content inspection silently override a
recorded, specific scope, which is a materially weaker isolation boundary than M-06 actually
establishes, and was corrected on independent review.) If the user's compliance posture is genuinely relevant to
Project B too, that is established by something in Project B's *own* history or current `UserIdea` —
never inherited from Project A's record.

**Forbidden transformation:** Admitting a Project-A-scoped obligation into Project B's Requirements
merely because it is stored in the same Brain vault, *or* because its content is judged likely to
generalize across projects. Both are the same underlying violation — cross-project scope leakage,
Threat H in `ADR-0004` — whether the excuse is "same vault" or "seems general enough." (Violates
M-06/M-13.)

**Clarification required?** No — there is nothing to clarify, because the premise (this obligation
applies to Project B) is never established at all; the record is excluded before reaching any
semantic use.

**Expected provenance behavior:** `MemoryContext`'s production record still notes the memory was
retrieved and excluded, with the reason (Project-A scope, current run is Project B) — silently
dropping it without a trace is itself a violation of M-14.

**Expected stage behavior:** Requirement Derivation never sees this entry at all in Project B's
`MemoryContext`; there is no "independent, current-run support" exception that admits it — exclusion
is unconditional at the scope-mismatch stage, before any stage-level use is even considered.

---

## 4. Repeated historical preference — repetition must not increase authority

**Memory input:** Three separate `decision` records, **all scoped to this same current project**
(from three different past phases of it — corrected from an earlier draft that used "different past
projects" without resolving the cross-project admissibility question Case 3 raises; same-project
scope avoids that ambiguity entirely and keeps this case's own teaching point — repetition does not
raise authority — uncomplicated by it), each independently stating "user prefers TypeScript over
plain JavaScript" (each medium confidence). **All three are Category A** (each inspectably cites its
own distinct originating `UserIdea` turn) — deliberately, so this case tests repetition-as-authority
in isolation, without also raising a Category A/B question; three Category-A citations of the *same*
underlying preference are still one fact repeated three times, not three independent facts (this is
exactly what makes them non-independent for M-07 purposes, regardless of each individually clearing
the provenance gate).

**Current-run input:** No current statement about language choice.

**Allowed use:** At most, cited as the (single) premise for one Inferred Claim — the fact that three
independent memories say the same thing does not license treating it as three times more
authoritative, or as a higher-confidence inference, than a single such memory would support.

**Forbidden transformation:** Treating three repetitions as corroborating evidence that raises
confidence or promotes the Claim toward User-Provided standing. (Violates M-07, extending
`INTENT_SPEC.md`'s I-16 to the memory axis.)

**Clarification required?** Not mandatory; same LOW/MEDIUM-territory handling as Case 1.

**Expected provenance behavior:** If multiple memories are cited, the Inferred Claim's confidence
must be justified independently of the *count* of corroborating memories — a stated reasoning basis
is required regardless of how many times the same preference was previously recorded.

**Expected stage behavior:** Intent Parsing must apply the same confidence discipline whether one or
many historical statements are retrieved.

---

## 5. Engineering lesson retrieved during Intent Parsing

**Memory input:** `lesson`, "review coverage should be decomposed by invariant axis" (Brain
confidence: high, project-scoped to the current project's slug — irrelevant to which one, since
`lesson` entries are `PROCESS_ONLY` regardless of scope).

**Current-run input:** Any `UserIdea` — irrelevant to this case, since the lesson is about MIHVER's
own process, not the user's system.

**Allowed use:** `PROCESS_ONLY` — if Intent Parsing itself involves any internal review/self-
verification step, this lesson may shape how thoroughly or how axis-wise that step decomposes its
own checking.

**Forbidden transformation:** Any appearance of this lesson's content in a Claim, Open Item, or any
`IntentSpec` output whatsoever. A `lesson`-type entry has no semantic authority under any use
(M-11).

**Clarification required?** No — this never touches user-facing content at all.

**Expected provenance behavior:** If `MemoryContext` records this entry as retrieved, it is marked
`PROCESS_ONLY` at production time and never appears in `IntentSpec`'s own provenance chain.

**Expected stage behavior:** Intent Parsing's own internal process may be shaped by it; its output
artifact is unaffected in content.

---

## 6. Engineering lesson influencing review strategy correctly

**Memory input:** `lesson`, "cross-axis invariants require explicit review contracts" — the actual
memory retrieved and applied during M0 Step 03A's later review rounds in this project's own history
(project-scoped to the current project's slug — again irrelevant to which one, since `lesson`
entries are `PROCESS_ONLY` regardless of scope).

**Current-run input:** A future review task on any pipeline-contract document.

**Allowed use:** Exactly what actually happened: the reviewer-dispatch plan was decomposed to
explicitly test cross-axis interactions (e.g. force × confidence) rather than each axis separately —
a change to *how* the review was conducted.

**Forbidden transformation:** Any claim that this lesson changed what the *user's* Requirements
were, or any leakage of its content into `RequirementSpec` itself. It changed review rigor, nothing
about system content — the honest, worked precedent `MEMORY_CONTEXT.md`'s Influence Taxonomy
section names directly as `PROCESS_ONLY`.

**Clarification required?** No.

**Expected provenance behavior:** Recorded (in a review report, not in the artifact under review)
as having influenced the review *plan*, with an explicit note distinguishing "changed review
behavior" from "changed artifact semantics."

**Expected stage behavior:** This is process-level influence outside the M0 pipeline stages
themselves (it shaped a Claude-orchestrated review task, not an `IntentSpec`/`RequirementSpec`
production step) — included here because it is the clearest real, already-lived instance of
Case 5's pattern, not a hypothetical.

---

## 7. Prior architecture success tempting framework reuse

**Memory input:** `pattern`, **`global` scope** (corrected from an earlier draft's ambiguous "a prior
... project" phrasing — a technical observation about a framework's suitability for a class of
problem is generalizable engineering knowledge, not a business-specific fact tied to one project;
production admits it mechanically on its `global` scope tag alone, and Research Planning, as the
consuming stage, is what must independently confirm the content is genuinely project-agnostic before
treating it as a search-shaping lead — see "Cross-Project Scope Verification"): "LangGraph-based
orchestration worked well for a prior multi-agent workload" (high confidence).

**Current-run input:** Current `RequirementSpec` (hypothetically, if this stage were authorized)
describes a system with very different concurrency/latency/team-skill constraints than the prior
project.

**Allowed use:** May inform Research Planning's search strategy ("consider checking LangGraph as a
candidate") — `DISCOVERY_ATTENTION`: additive (LangGraph is added to what gets checked, nothing
otherwise-required is skipped) and provenance-visible (the search record cites this memory as the
originating lead). LangGraph may go on to be the subject of a **wholly new, independently-produced**
`TechnologyCandidateSet` entry, but **only** after independently clearing Technology Candidate
Identification's hard eligibility constraints against *this* `RequirementSpec`, informed by a
freshly-produced `EvidenceBundle` — never admitted, ranked, or preferred merely because it worked
before (Threat D, Principle 9 — best-fit, not universal best). **The memory entry itself never
becomes that `TechnologyCandidateSet` entry, and its own classification never advances past
`DISCOVERY_ATTENTION`** — this is an identity boundary, not a threshold the memory eventually
crosses (see "Identity Boundary, Not Merely a Freshness Gate" in `MEMORY_CONTEXT.md`).

**Forbidden transformation:** Recommending LangGraph in the final `ArchitectureCandidate`/
`ArchitectureDecision` on the strength of the memory alone, bypassing Evaluation's actual scoring
against the current `RequirementSpec`.

**Clarification required?** No — this is an architecture-stage concern, not an intent-stage one;
no user clarification is implicated.

**Expected provenance behavior:** If a new `TechnologyCandidateSet` entry for LangGraph is produced,
its provenance cites the fresh `EvidenceBundle` entry that qualified it, not the memory directly — the
memory's role recorded as "originating research lead," never as the qualifying basis itself, and never
as though the memory entry had itself become the new entry.

**Expected stage behavior:** Technology Candidate Identification and Evaluation apply their full,
undiminished ordinary authority regardless of this memory's existence.

---

## 8. Prior architecture failure

**Memory input:** `incident`, **`global` scope** (corrected from an earlier draft's ambiguous "a prior
project's" phrasing — this is a generalizable engineering observation about a design shape's
consequences, not a business-specific fact tied to that project's own requirements, so `global` is
the correct scope; production admits it mechanically on the scope tag alone, and Architecture
Synthesis, as the consuming stage, is what must independently confirm the content is genuinely
project-agnostic before treating it as a search-shaping lead): "a synchronous single-worker design
caused unacceptable latency under load" (high confidence).

**Current-run input:** Current requirements describe a similarly latency-sensitive workload.

**Allowed use:** Once Architecture Synthesis is separately authorized to consume `MemoryContext` (its
own required `M0_SCOPE.md` amendment — Architecture Synthesis is explicitly named among the plausible
candidates in `ADR-0004`'s Phase 11, corrected in an earlier review round from a draft that had
omitted it), it is `DISCOVERY_ATTENTION`: it may add
asynchronous/multi-worker alternatives for Synthesis to *also* generate and consider — additive,
provenance-visible — without lowering the baseline consideration, generation, or eligibility of a
synchronous candidate shape in any way. This is legitimately Synthesis's own authority (M0_SCOPE.md:
"how candidates combine") because the memory concerns an architectural *shape* (synchronous vs.
asynchronous, worker topology), not a *named technology* — a named-technology lead would instead have
to flow through Research Planning → Evidence → Technology Candidate Identification's own eligibility
screening before Synthesis ever saw it as part of its `TechnologyCandidateSet` input.

**Forbidden transformation:** Silently ruling out a synchronous single-worker design as
categorically ineligible without any Evidence-grounded, current-`RequirementSpec`-grounded
justification — a past failure is a research lead, not an automatic constraint (mirrors Case 7's
reverse case: past failure must not silently veto a candidate any more than past success may
silently anoint one). Also forbidden, and this is the sharper failure mode: citing the memory as
*any part* of why a synchronous candidate "wasn't pursued" or was omitted from the candidate set —
even framed as one contributing reason among several, never the sole one. `DISCOVERY_ATTENTION`
material may only ever add candidates to consider; it may contribute **zero** negative weight toward
any candidate's omission or exclusion, under any framing. Any actual exclusion of a synchronous
design must be independently established from current `RequirementSpec` and, where a named
technology is involved, fresh Evidence — never from memory, in whole or in part.

**Clarification required?** No.

**Expected provenance behavior:** If Architecture Synthesis records why a candidate shape was or
wasn't pursued (Principle 8's "search itself is recorded" requirement), the memory may be cited only
as part of *why the search additionally looked at* asynchronous alternatives — never cited, in whole
or in part, as a reason any candidate (including a synchronous one) was not pursued or excluded.

**Expected stage behavior:** Evaluation still independently scores whichever candidates Architecture
Synthesis actually produces against the current `RequirementSpec`.

---

## 9. Cached stale framework capability

**Memory input:** `reference`, **`global` scope** (a general technical fact about the framework
itself, not tied to any one project's requirements), "Framework X does not support native streaming
responses" (recorded 18 months ago, Brain `status: active`, confidence: high at the time it was
written).

**Current-run input:** Current research question: does Framework X support streaming responses
today?

**Allowed use:** A research hint prompting Research + Evidence Collection to re-verify current
support — the memory's age alone (Brain's `status: active` notwithstanding) is exactly the M-05
distinction: Brain-`active` is not the same as fresh-for-this-run.

**Forbidden transformation:** Treating the 18-month-old memory as current fact because Brain has not
marked it superseded — Brain's own status field says nothing about whether the underlying claim
about the world is still true (Cached-evidence laundering, Threat E).

**Clarification required?** No user clarification — this is a research-freshness concern, resolved
by re-verification, not by asking the user.

**Expected provenance behavior:** If Research + Evidence Collection re-verifies and finds the
framework NOW supports streaming, the resulting `EvidenceBundle` entry cites the fresh verification
date, source, **and the exact current framework version the finding applies to** (all five of
Principle 5's properties, per M-12 — not just date and source); the stale memory is noted only as
"prompted this recheck," never as the entry's own basis.

**Expected stage behavior:** Research + Evidence Collection performs the verification itself; no
downstream stage treats the memory as already-satisfying Principle 5.

---

## 10. Fresh cached evidence with authoritative source provenance

**Memory input:** `reference`, **`global` scope** (a general technical fact about the framework
itself, not tied to any one project's requirements), "Framework Y added native WebSocket support,
verified against the vendor's own changelog, dated three weeks ago" (high confidence, `manual`
provenance, explicit source cited in the memory body).

**Current-run input:** Current research question: does Framework Y support WebSockets?

**Allowed use:** Even here — genuinely fresh, well-sourced, recently verified — the memory is still
only a **candidate lead**, not a substitute for a current `EvidenceBundle` entry: Research + Evidence
Collection must still independently confirm and record its own verification date at the time of
*this* run, per Principle 5's explicit requirement that freshness be tracked per-use, not merely
inherited.

**Forbidden transformation:** Skipping re-verification "because the memory is recent and well-
sourced" — recency and quality of the *memory's own* provenance never substitute for the
`EvidenceBundle`'s own required freshness at production time (M-12, applied even to the
best-case memory).

**Clarification required?** No.

**Expected provenance behavior:** The resulting `EvidenceBundle` entry's own verification date and
confirmed version are what Research + Evidence Collection actually re-confirmed in this run — not
the memory's own three-weeks-ago date and whatever version the vendor's changelog described then,
even though both are recent and credible; the framework may have shipped a new version since.

**Expected stage behavior:** Research + Evidence Collection still performs its own, full, ordinarily-
required check; the memory (`DISCOVERY_ATTENTION`) may only point at where a confirming source is
likely to be found — it must never shorten, narrow, or end the check earlier than it would otherwise
run, and never substitute for independently confirming source/version/date/confidence. Its role is
recorded in the resulting `EvidenceBundle` entry's provenance as "memory X prompted this source
check," distinct from the entry's own re-verified basis.

---

## 11. Superseded historical user statement

**Memory input:** Two linked `decision` records, both scoped to the current project, **both Category
A** (each inspectably cites its own originating `UserIdea` turn): an original "user wants a
$100/month budget ceiling" (now `status: superseded`, `superseded_by` pointing at the second) and a
correction, "user corrected: budget is actually $500/month" (`status: active`, `supersedes` pointing
at the first).

**Current-run input:** No current statement about budget.

**Allowed use:** Only the live ($500/month) record may be cited as a premise — and only because it is
Category A; the superseded $100/month record is excluded from `MemoryContext` production entirely
once its supersession is resolved, before its provenance category would even matter.

**Forbidden transformation:** Retrieving and citing both records as if they were two independent,
simultaneously-valid pieces of support (e.g. "the user has stated budget preferences of both $100
and $500, suggesting cost-sensitivity generally") — this reintroduces Threat G (stale/superseded
memory treated as independently corroborating). (Violates M-04.)

**Clarification required?** Not mandatory — same handling as any other LOW/MEDIUM historical
preference, once correctly resolved to the single live figure.

**Expected provenance behavior:** `MemoryContext` production resolves the `supersedes`/
`superseded_by` chain before admission; only the live record's ID appears as a candidate premise,
though the superseded record's existence may still be noted in the production audit trail as "seen,
superseded, excluded" (M-14), never silently vanished without any trace of the resolution having
happened.

**Expected stage behavior:** Any consuming stage sees, at most, one live figure — never a menu of
historical values to weigh against each other.

---

## 12. Cross-project memory leakage

**Memory input:** `decision`, scoped to Project A's slug, "user requires HIPAA compliance for this
system" (high confidence, active). (Category A/B under "Historical User Provenance Gate" is
immaterial here too, for the same reason as Case 3 — scope mismatch excludes the record before any
premise eligibility question is reached.)

**Current-run input:** Project B — a different, unrelated system for the same user, no health-data
involvement at all.

**Allowed use:** None, by default. This record's Brain-recorded scope is Project A's slug, which does
not match Project B's `RunContext` — Cross-Project Scope Verification (M-06, M-13) excludes it on
that mechanical mismatch alone; production never needs to, and never does, separately evaluate
whether HIPAA applicability is domain-specific to reach this exclusion (that would be exactly the
kind of content-inspection judgment the producer is not authorized to make — see "MemoryContext
Producer: Role and Authority"). The domain-specificity of HIPAA obligations is offered here only as
commentary on *why* the record was scoped to Project A in the first place, never as part of
production's own exclusion rationale.

**Forbidden transformation:** Admitting a HIPAA-compliance obligation into Project B's Requirements
merely because the same user's Brain vault contains it under a different project scope. (Violates
M-06/M-13 — the canonical instance of Threat H.)

**Clarification required?** No — this should simply never surface into Project B's semantic content
at all; there is nothing to clarify because the premise (this project involves health data) does
not hold.

**Expected provenance behavior:** If retrieval incidentally surfaces the record (e.g. a broad
`global`-adjacent search), production excludes it and records why: scope mismatch against
`RunContext` (Project A's slug vs. Project B's identity) — a mechanical fact, not a content judgment —
per M-14's "why it was admitted or excluded" requirement.

**Expected stage behavior:** No stage ever sees this entry as part of Project B's `MemoryContext`.

---

## 13. High-relevance but low-authority memory

**Memory input:** `inbox`, project-scoped to the current project's slug (scope is irrelevant to the
outcome here — "What Qualifies as a MemoryContext Entry" excludes every `inbox` record on `type`
alone, before any scope check is even reached), an unfiled capture reading "maybe the user wants
offline support?" (unclassified, no confidence assigned meaningfully, `status: draft`). This record
happens to rank very highly against the current retrieval query due to close lexical overlap.

**Current-run input:** Current `UserIdea` discusses offline usage scenarios extensively.

**Allowed use:** None. `inbox`-type records are excluded from `MemoryContext` production entirely
(per the authority-class table in `MEMORY_CONTEXT.md`), regardless of how highly they rank against
the current query.

**Forbidden transformation:** Admitting this entry into `MemoryContext`, or worse, into any
semantic use, because its retrieval relevance score is high — the canonical instance of Threat B
(retrieval-relevance laundering) and the reason M-01 exists.

**Clarification required?** No — if offline support genuinely matters, the current `UserIdea`'s own
extensive discussion of it already supplies real, current-run support; this unfiled memory adds
nothing legitimate regardless of its ranking.

**Expected provenance behavior:** If the retrieval boundary logs candidates before filtering, this
entry appears as "retrieved, excluded — `inbox` type" in that log, never in the `MemoryContext`
handed to any stage.

**Expected stage behavior:** No stage ever sees this entry.

---

## 14. Low-relevance project record corroborating, never establishing, identity

**Memory input:** `project`, a durable record describing the current project (high confidence,
active, `scope` matching the current project's slug). This record ranks poorly against a specific
narrow retrieval query (e.g. a query about database preferences) because its body text doesn't
lexically overlap much with that query.

**Current-run input:** The current run's own `RunContext` already independently establishes which
project this is — supplied by the invoking context, not by Brain (see "Current-Run Scope Anchor:
RunContext" in `MEMORY_CONTEXT.md`).

**Allowed use:** Once `RunContext` already establishes the project identity, this `project` record
may be retrieved and used to **corroborate** it — supplying additional durable description or
history about a project whose identity is already independently known — regardless of how it ranks
against an unrelated topical query; low topical relevance does not diminish its value for this
narrower, corroborating purpose. **This case was previously written the other way around** (this
record supplying/establishing the identity `MemoryContext` production would check other records
against) — that was itself the defect this correction fixes: a Brain record can never authenticate
its own applicability, per the `cwd-is-not-a-filesystem-isolation-boundary` lesson's caution against
mistaking an internal artifact for a real external boundary. `RunContext`, not this record, is the
anchor.

**Forbidden transformation:** Using this (or any) `project` record to *establish* what the current
project is, or consulting it *before* `RunContext` exists to help decide what `RunContext` should be
— either would recreate exactly the circularity this correction removes. Also forbidden: excluding
this record from its corroborating role merely because it ranks low against an unrelated topical
query — corroboration is a distinct retrieval purpose from topical relevance search and must not be
conflated with it.

**Clarification required?** No.

**Expected provenance behavior:** A corroboration retrieval and a topical retrieval are two distinct
purposes, so each produces its **own separate** `MemoryContext` (the producer's Output is exactly one
immutable `MemoryContext` per invocation, bound to exactly one retrieval purpose — see "MemoryContext
Producer: Role and Authority") — never one shared production record covering both purposes at once,
even if both happen to be invoked around the same time for the same consuming stage. The
corroboration-purpose `MemoryContext`'s own production record states its purpose as corroboration
(M-14: "the retrieval query and its purpose") and notes that `RunContext`, not this entry, was the
identity anchor scope-checking was performed against (M-16).

**Expected stage behavior:** No consuming stage, and no part of `MemoryContext` production, ever
treats this record as sufficient by itself to determine project identity; `RunContext` alone performs
that role, with this record only enriching an already-settled fact.

---

## 15. HIGH/CRITICAL clarification where memory appears to answer it

**Memory input:** `decision`, "user previously stated that an irreversible production delete action
should never be automatic" — **`global` scope** (corrected from an earlier draft's unresolved "a
different, past project," which Case 3 already establishes must be excluded outright unless actually
`global`-scoped; a blanket safety disposition about irreversible production actions is exactly the
kind of content that can legitimately be `global`-scoped, distinct from Case 3's project-specific
audit-logging obligation) — high confidence, admitted mechanically on its `global` scope tag (per
M-06/M-13); Intent Parsing, as the consuming stage, is what must independently confirm the content is
genuinely project-agnostic before using it to shape the clarification question below — not merely
because it carries a `global` tag. (Category A/B under "Historical User Provenance Gate" is
immaterial here too — M-08 already forbids memory alone from closing a HIGH/CRITICAL item regardless
of category, so only the clarification-shaping path, open to both categories, is ever reachable.)

**Current-run input:** Current `UserIdea` describes a system with an irreversible production delete
action, with no current statement on whether it may be automatic — a CRITICAL Decision Impact item
by `INTENT_SPEC.md`'s own definition (irreversible production action).

**Allowed use:** The memory may shape *what clarifying question gets asked* (e.g. prioritizing this
exact question, or phrasing it with the historical context attached: "you've previously said
irreversible deletes should never be automatic — should the same apply here?"). It may never close
the item.

**Forbidden transformation:** Treating the historical statement as already answering the current
CRITICAL item and producing an eligible (non-Blocked) `IntentSpec` on that basis. (Violates M-08 —
memory alone never closes a HIGH/CRITICAL item, however closely it appears to answer it.)

**Clarification required?** Yes, mandatorily — the item remains CRITICAL and the produced
`IntentSpec` version remains Blocked until a genuinely current-run answer (from the user, in this
run) is obtained, per Handoff Status: Blocked vs. Failed.

**Expected provenance behavior:** The Blocked `IntentSpec`'s Open Item records the CRITICAL gap
normally; `MemoryContext`'s own record separately notes the historical statement was retrieved and
used only to shape the clarification question, never as a resolution.

**Expected stage behavior:** Intent Parsing produces a Blocked version regardless of the memory's
apparent answer; Requirement Derivation never consumes it.

---

## 16. LOW/MEDIUM issue where memory may reduce repeated questioning

**Memory input:** `decision`, project-scoped to the current project's slug (from this same project's
earlier phase), **Category A** (inspectably cites its originating `UserIdea` turn), "user previously
indicated a preference for weekly (not daily or monthly) reporting cadence" (medium confidence,
active).

**Current-run input:** Current `UserIdea` requests "a report," with no cadence specified — a MEDIUM
Decision Impact item (tunes a detail, doesn't change the shape of the solution).

**Allowed use:** May defensibly reduce a repeated question — but only via the Inferred-Claim path at
Intent Parsing ("weekly cadence, Inference-derived from a historical statement, moderate confidence,
provisional"), available under dependency B (the separate `INTENT_SPEC.md` Inference-premise
amendment, implemented in addition to Intent Parsing's own dependency-A authorization — see
"Historical User Memory Rule" and `ADR-0004`'s "Acceptance Gate") and available here only because the
entry is Category A (a Category B entry could only shape the clarification question below, never
serve as this premise), or via a current-run clarification question shaped by the memory — available
to either category, and needing only dependency A. **Not** via Requirement Derivation's R-19
default-filling mechanism: an earlier draft of this case offered "Requirement-Derivation-introduced
default" as an equally valid alternative, which was itself a defect, corrected on independent review
— *which cadence the user prefers* is a question about what the user wants, not a measurement or
implementation detail of an already-settled requirement, and is exactly the kind of question R-19
excludes ("not when choosing among materially plausible values would add, remove, or narrow any
user-facing... output, condition..." — `REQUIREMENT_SPEC.md`). R-19 remains available for a
genuinely different kind of memory-informed default (e.g. a measurement/accounting parameter *within*
an already-accepted cadence requirement), never for deciding the cadence preference itself.

**Forbidden transformation:** Presenting the resulting cadence as a User-Provided Claim in the
current `IntentSpec`; presenting it as settled without any provisional/reversible marking; or
introducing it via Requirement Derivation's R-19 mechanism as though "which cadence the user wants"
were a technical/operational parameter rather than a preference question only Intent Parsing may
resolve.

**Clarification required?** Not mandatory — this is exactly the legitimate LOW/MEDIUM friction-
reduction case the Historical User Memory Rule authorizes, provided the marking/visibility
conditions are met.

**Expected provenance behavior:** The provenance chain shows this is a memory-derived candidate
default, explicitly distinct from a fresh current-run statement — an auditor can tell the cadence
was not re-asked in this run.

**Expected stage behavior:** If the current user, later in the same run, explicitly states a
different cadence, that current statement wins immediately and completely (Current Input Must
Win), no matter how well-supported the memory-derived default was.

---

## 17. Memory retrieval returns nothing

**Memory input:** A retrieval query is run against Brain for relevant historical context; no
matching records are found (empty result set).

**Current-run input:** Any.

**Allowed use:** Proceed exactly as if no `MemoryContext` had ever been consulted — an empty result
is a valid, complete, terminal outcome, not a failure requiring escalation or retry-until-something-
is-found.

**Forbidden transformation:** Manufacturing a plausible-sounding memory entry to avoid an "empty-
looking" `MemoryContext`; or drawing *any* inference from the absence itself — not even a cautious
one. "No memory exists, so the user has no prior preference" is **not** a valid inference, corrected
on independent review from an earlier draft that allowed it under narrow conditions: an empty result
means only that *this specific query, against Brain's current contents,* returned nothing — it says
nothing about whether the topic was ever discussed anywhere, whether Brain simply never captured it,
or whether a differently-worded query would have found something. The only accurate fact an empty
retrieval supports is "no matching record was found," recorded as exactly that and nothing more.

**Clarification required?** No — an empty `MemoryContext` changes nothing about the ordinary
clarification rules already governing the current run.

**Expected provenance behavior:** The retrieval query, its purpose, and the empty result are still
recorded (M-14) — an empty `MemoryContext` is itself a fact worth preserving for reproducibility,
not simply an absence of a record.

**Expected stage behavior:** The consuming stage proceeds on current-run input alone, exactly as it
would with no memory system at all.

---

## 18. Brain/index unavailable

**Memory input:** The retrieval boundary attempts to query Brain, but the vault or derived catalog
is unavailable (e.g. `doctor`-level failure, a corrupted or unreachable index).

**Current-run input:** Any.

**Allowed use:** The run proceeds without any admitted memory content to draw on — availability of
memory is never a precondition for any pipeline stage to function, since no stage's current, frozen
contract requires it as an input at all (and even after a future amendment, memory is designed as an
*additional*, optional-in-effect input whose absence degrades gracefully to "no memory available this
run," never a hard blocker). The producer still emits its one immutable `MemoryContext` for this
invocation, as always (see "MemoryContext Producer: Role and Authority" — the Output is always
exactly one `MemoryContext` per authorized invocation); here it carries zero admitted entries and the
`retrieval-unavailable` outcome discriminator (M-14), rather than there being no artifact at all.

**Forbidden transformation:** Blocking the pipeline run, or silently substituting stale/cached
results from a previous run's `MemoryContext` production as though they were freshly retrieved now.

**Clarification required?** No — this is an infrastructure/availability fact, not a content gap
requiring user clarification.

**Expected provenance behavior:** The production record explicitly notes "Brain unavailable at
retrieval time" rather than silently producing an empty `MemoryContext` indistinguishable from
Case 17's legitimate empty result — these are different facts (nothing relevant existed, vs.
retrieval could not even be attempted) and must not be conflated (extends M-14's audit-trail
discipline to failure, not only to success).

**Expected stage behavior:** Proceeds exactly as Case 17, with the distinction preserved in the
production record for later audit.

---

## 19. Memory content conflicts internally

**Memory input:** Two live (non-superseded), independently-scoped `decision` records that were never
linked via supersession, both project-scoped to the current project, **both Category A** (each
inspectably cites its own distinct originating `UserIdea` turn — this case tests genuine internal
tension between two independently-grounded statements, not a provenance question, so both are
deliberately given the strongest available provenance): one states "user wants minimal infrastructure
cost," the other states "user wants maximum reliability regardless of cost" — genuinely in tension,
with neither marked as correcting the other. (Had either record instead been Category B, it could not
be cited as a premise at all under M-18 — it would only be available to shape a clarification
question, which would sidestep the tension this case is designed to test, not resolve it.)

**Current-run input:** No current statement resolving this tension.

**Allowed use:** Both may be retrieved and cited, separately, as premises for two separate candidate
Inferred Claims (a cost-sensitivity preference and a reliability preference) — this premise-citation
path is available under dependency B (the separate `INTENT_SPEC.md` Inference-premise amendment,
implemented per `ADR-0004`'s "Acceptance Gate"); dependency A alone would not enable it on its own.
`MemoryContext`
production does not resolve which one "wins"; that is not its authority any more than `IntentSpec`'s
own Conflict Policy authorizes Intent Parsing to silently pick a side between two genuinely
conflicting User-Provided Claims.

**Forbidden transformation:** Silently resolving the internal tension at `MemoryContext` production
time by admitting only one of the two records, or by inventing a synthesized middle position
("moderate cost-consciousness with above-average reliability") that neither memory actually states.

**Clarification required?** If both candidate Inferred Claims would otherwise be admitted and they
materially conflict, the honest outcome mirrors `IntentSpec`'s own Conflict Policy applied one layer
up: surface both, unresolved, as competing candidate premises — and if a downstream stage would need
to pick between them to proceed, that is exactly the kind of question worth a current-run
clarification, not a silent resolution at the memory layer.

**Expected provenance behavior:** Both records appear in `MemoryContext`'s production record, each
independently classified and freshness-judged; neither is preferred over the other by the production
step itself.

**Expected stage behavior:** Whichever stage would consume both must apply its own ordinary
authority (e.g. Intent Parsing's Conflict Policy, if the resulting candidate Inferred Claims are
being considered together) — `MemoryContext` production does not pre-resolve this on the stage's
behalf.

---

## 20. Memory says "no agent needed previously" but current requirements differ

**Memory input:** `decision`, project-scoped to the current project's slug (from an earlier phase of
the same project), "for this project, MIHVER previously concluded no AI agent was needed — a
deterministic script sufficed" (high confidence).

**Current-run input:** Current `RequirementSpec` (hypothetically) describes new requirements
involving open-ended natural-language interpretation that a deterministic script cannot satisfy.

**Allowed use:** Once separately authorized, the memory may inform Architecture Synthesis's search
strategy as `DISCOVERY_ATTENTION` (e.g. "start by checking whether a deterministic approach still
suffices, per Principle 14," since that's exactly the discipline Principle 14 already demands
regardless of memory) — but the current `RequirementSpec` governs the actual candidate search, and if
the current requirements
genuinely need agentic reasoning, that conclusion is established by the ordinary chain of authority
that already produces it: Technology Candidate Identification's eligibility screening against
`EvidenceBundle` (its own declared input, which Architecture Synthesis does not directly consume —
`M0_SCOPE.md`), and Evaluation's scoring against `RequirementSpec` and `EvidenceBundle` (also its own
declared inputs). Architecture Synthesis itself reasons only from `TechnologyCandidateSet` and
`RequirementSpec`, exactly as `M0_SCOPE.md` already fixes; the memory changes at most where its own
search starts, never which artifacts it is permitted to consume.

**Forbidden transformation:** Either (a) silently ignoring the current requirements' actual needs
because a memory says "no agent was needed before," artificially constraining candidate generation
to non-agentic designs it shouldn't be constrained to; or (b) treating this memory as license to skip
Principle 14's "could a correct answer have zero agents" check going forward, in either direction —
the memory does not override the current, independent obligation to check both possibilities against
*this* run's `RequirementSpec`.

**Clarification required?** No — this is resolved by ordinary Architecture Synthesis/Evaluation
authority against current requirements, not by asking the user anything new.

**Expected provenance behavior:** If Architecture Synthesis records why it searched non-agentic and
agentic designs alike (Principle 8), the memory may be noted as part of the search's own history
("a prior phase of this project needed no agent"), never as the reason the current phase's
candidate set was constrained one way or the other.

**Expected stage behavior:** Architecture Synthesis and Evaluation apply their full, current-
`RequirementSpec`-grounded authority; the memory changes at most where the search starts looking,
never what it is allowed to conclude.

---

## 21. Projectless run — no RunContext established at all

**Memory input:** Two candidate records exist in Brain: (a) `pattern`, project-scoped to a specific
past project, "background job retries should use exponential backoff with jitter" (high confidence);
(b) `pattern`, **`global` scope**, the same substantive content, recorded independently.

**Current-run input:** This run has no `RunContext` — whatever invoked MIHVER this time supplied no
project identity at all (a genuinely projectless/exploratory run; see "Current-Run Scope Anchor:
RunContext" in `MEMORY_CONTEXT.md`). No Brain `project` record is consulted to manufacture one, since
a `project` record may only corroborate an already-established `RunContext`, never establish it in
the first place (Case 14).

**Allowed use:** Record (b) remains eligible for retrieval — `global` scope never depends on
`RunContext` existing — but eligibility is only mechanical admission, not semantic standing: once
admitted, record (b) is available to whichever stage is authorized to consume it only as
`DISCOVERY_ATTENTION`, subject to the same consuming-stage project-agnosticism confirmation as any
other `global`-scoped record (see "Cross-Project Scope Verification"), additive-only use, visible
provenance — and it **remains `DISCOVERY_ATTENTION` permanently, never itself reaching
`SEMANTIC_PREMISE`** (identity boundary, per "Identity Boundary, Not Merely a Freshness Gate"). Only
a wholly new, independently-produced artifact — a fresh `EvidenceBundle` entry Research + Evidence
Collection produces after its own verification, and, downstream, a separately-produced
`TechnologyCandidateSet`/`ArchitectureCandidate` entry that clears Technology Candidate
Identification's eligibility screening and Evaluation's scoring — may ever reach `SEMANTIC_PREMISE`
standing; record (b) itself never advances past `DISCOVERY_ATTENTION`, no matter how thoroughly a
downstream artifact it prompted is later verified. Record (a) is excluded outright: with no
`RunContext` to match a project
slug against, a project-scoped record has nothing to verify identity against and is never admitted
"by default" or "just in case" (M-16). This is the same mechanical scope check as any other run, not
a relaxed one — the absence of `RunContext` narrows eligibility, it never widens it.

**Forbidden transformation:** Admitting record (a) on the reasoning that "there's no project to
conflict with, so it can't cause cross-project bleed" — that inverts M-16's actual rule, which
requires a *positive* `RunContext` match for project-scoped admission, not merely the absence of a
*different* identity to collide with. Also forbidden: treating the retrieval-eligible set as evidence
that this run implicitly belongs to whichever project record (a) happens to name — `MemoryContext`
production never infers a `RunContext` from what memories happen to be retrievable.

**Clarification required?** No — this is a mechanical retrieval-scope fact, resolved identically
whether or not a human is ever asked anything.

**Expected provenance behavior:** `MemoryContext`'s production record notes record (a) was retrieved
by the query but excluded for lack of a `RunContext` to verify against (M-14's "why excluded"
requirement), and separately notes this `MemoryContext` itself is bound to "no `RunContext`" as its
identity (per "Lifecycle and Invalidation") — so a later run that *does* establish a `RunContext`
never mistakes this projectless `MemoryContext` for one already scoped to it.

**Expected stage behavior:** Whichever stage consumes this `MemoryContext` receives only
globally-scoped content; it must not, and structurally cannot, receive project-scoped material this
run never established an identity to be scoped to.

---

## 22. Historical prohibition, no current mention — force is not inherited from history

**Memory input:** `decision`, project-scoped to the current project, **Category A** — the record's
body inspectably cites its originating turn: "user stated (`UserIdea` v3, turn 5): 'notifications
must never be sent between 10pm and 7am'" (high confidence, `status: active`, no supersession). The
historical statement's own force, at the time it was made, was a **prohibition**.

**Current-run input:** Current `UserIdea` says nothing about notification timing at all — a
LOW/MEDIUM Decision Impact item (a UX/scheduling preference, not an irreversible or safety-critical
action; contrast Case 15's genuinely CRITICAL irreversible-deletion example).

**Allowed use:** Because this entry is Category A, it may be cited as the premise for a current-run
Inferred Claim. **What it may not do is hand its own historical force to that Claim automatically.**
The historical statement's own prohibition force is not, by itself, an independent current-run
reasoning basis for assigning the current Inferred Claim that same **MUST NOT**-compiling force —
citing "the historical statement was phrased as a prohibition" as the *entire* basis for a current
prohibition-force Claim is exactly the silent inheritance this case exists to forbid, whether or not
a sentence is wrapped around it. Absent anything beyond the bare historical citation, the defensible,
independently-reasoned conclusion is a **preference-strength** Inferred Claim — e.g. "notifications
SHOULD NOT be sent between 10pm and 7am, Inference-derived from a historical statement, moderate
confidence, provisional/reversible" — stated as its own, deliberately weaker force than the history's
own, precisely because nothing current-run yet independently supports compiling straight through to a
hard **MUST NOT**. Reaching current-run prohibition force instead requires an *additional*, genuinely
independent basis beyond the citation itself — most straightforwardly, an explicit current-run
confirmation via the clarification-question path ("you've previously said notifications should never
go out overnight — still a hard requirement here, or a preference?"), whose answer, if given, becomes
User-Provided and may then carry whatever force the user's current answer actually states.

**Forbidden transformation:** Assigning the current Inferred Claim prohibition-level force (which
`REQUIREMENT_SPEC.md`'s Force → Strength Mapping would then compile straight through to a hard
**MUST NOT** Requirement, regardless of the Inference's own confidence) **on the strength of the
historical citation alone**, with no additional independent basis beyond "the history said so." This
is the exact failure "Historical Force Is Not Current Force" forecloses: a stale historical
prohibition silently hardening into a permanent current hard constraint through ordinary, uneventful
downstream compilation, because nothing between the historical citation and the compiled Requirement
ever supplied an independent reason to compile it that hard. Also forbidden: presenting the
preference-strength Inferred Claim above as though it were somehow still "the same force as history,
just worded more cautiously" — it is not the same force; it is a genuinely weaker one, and the
provenance must say so plainly, never obscure the downgrade behind reassuring language.

**Clarification required?** Not mandatory — this is ordinary LOW/MEDIUM-territory handling, subject
to the same repetition/confidence discipline as any other memory-derived Claim (M-07) and to
`MEMORY_CONTEXT.md`'s LOW/MEDIUM Decision Impact conditions (provisional marking, provenance
visibility, immediate yield to any relevant current statement).

**Expected provenance behavior:** The Inferred Claim's provenance records **two separate facts**, per
M-20: (a) historical-content provenance — which `MemoryContext` entry supplied the premise's content,
its Category A status, and the originating turn it was inspectably traced to; and (b) force
provenance — the independent reasoning basis for the Claim's *own* current force, stated as its own
sentence, never collapsed into "cites memory entry X" alone. An auditor must be able to tell, from the
provenance alone, whether the current force was actually reasoned about or merely inherited.

**Expected stage behavior:** Intent Parsing states an explicit force-derivation step for this
Inferred Claim, exactly as it would for confidence or provisional marking; no stage compiles a
Requirement's normative strength from this Claim without that explicit step having been recorded
first.

---

## 23. Misfiled historical user statement stored as `reference` — the gate applies by content, not stored type

**Memory input:** `reference`-type record, project-scoped to the current project, body reads: "user
said their team will only accept an on-prem deployment option, never a managed cloud service" (Brain
confidence: high, `status: active`). This is a **misfiling** — the content is plainly a historical
user statement, not the candidate-technology/evidence knowledge `reference` records typically carry
(contrast Cases 9/10) — but nothing in Brain's write path prevented it from being stored this way, and
its stored `type` gives production no advance warning that this is what it actually is.

**Current-run input:** Current `UserIdea` describes a system with no stated deployment-target
constraint at all.

**Allowed use:** Production's own content inspection — not its stored `type` — is what reveals this
record describes a historical user statement, at which point the Historical User Provenance Gate
applies exactly as it would to a `decision`-type record making the same claim: production must
determine Category A or Category B before any semantic use is considered. Here, the record's body
contains no citation to a specific originating `UserIdea` version/turn at all — no citation-shaped
text of any kind, let alone a resolvable one — so it defaults to **Category B**. As Category B, it may
at most shape a current-run clarification question ("a past statement suggests on-prem-only
deployment may be required here — is that still the case?"); it may never be cited as the premise of
an Inferred Claim, regardless of its `high` Brain confidence or its `active` status. **Contrast:** had
this same record instead included an inspectable, resolvable citation ("per `UserIdea` v2, turn 7:
'..."), it would be Category A and could be cited as an Inferred Claim's premise — the stored `type`
being `reference` rather than `decision` would still be irrelevant to that determination either way.

**Forbidden transformation:** Two distinct violations, both forbidden: (a) treating the record's
stored `reference` type as license to skip the Historical User Provenance Gate entirely, reasoning
"the gate is about `decision` records, and this is a `reference` record" — the gate is triggered by
what production's content inspection reveals, never by stored `type` (M-18); (b) treating the record's
stored `reference` type as license to process it through the ordinary `reference`-type path instead
(a research hint under "Memory and Evidence Boundary," informing Research + Evidence Collection) — that
path is for candidate technology/evidence knowledge, not a historical statement about what the user
said; applying it here would silently launder the user's own historical statement into a technology
research lead, an unrelated category error compounding the first one.

**Clarification required?** Not mandatory — ordinary LOW/MEDIUM-territory handling, same as any other
Category B entry shaping a clarification question.

**Expected provenance behavior:** `MemoryContext`'s production record notes both facts distinctly:
the record's stored Brain `type` (`reference`) and production's own content-based classification
(historical user statement, Category B) — an auditor must be able to see that production correctly
looked past the stored type rather than trusting it, and that Category B was assigned for a stated
reason (no resolvable citation present), not merely asserted.

**Expected stage behavior:** Whichever stage consumes this entry treats it exactly as it would treat
a Category B `decision`-type record making the same claim — no stage grants it different treatment,
weaker or stronger, because of its stored `reference` type.

---

## 24. Memory-informed R-19 default — `DECISION_OPTION`, contrasted with an intent-level value memory must not fill

**Memory input:** `pattern`-type record, project-scoped to the current project (an earlier phase of
the same project), "a prior requirement in this project used exponential backoff with a maximum of 3
retry attempts for background job failures, and this worked well" (medium confidence, active). This
is a technical/measurement memory, not a historical user statement — the Historical User Provenance
Gate (Category A/B) is not the relevant test here at all; the relevant question is whether this memory
may inform an R-19-eligible default, per "No Assumed-Origin Path for Memory."

**Current-run input:** Requirement Derivation's own in-progress `RequirementSpec` already contains an
already-settled Requirement: "the system SHALL retry a failed background job automatically." A
surviving Unknown remains: exactly how many attempts,
and what backoff strategy, should be used. Per R-19's own test (`REQUIREMENT_SPEC.md`): this Unknown
selects an internal implementation/measurement detail *within* the already-settled Requirement — it
does not add, remove, or narrow the Requirement's own asserted actor, target, capability, output,
condition, permission, prohibition, obligation, or preference (retrying automatically is already
settled; only the retry count/backoff shape remains open) — so it is R-19-eligible.

**Allowed use:** This is `DECISION_OPTION` influence (see "Influence Taxonomy"), not
`DISCOVERY_ATTENTION` and not `SEMANTIC_PREMISE`: the memory proposes "3 retries, exponential backoff"
as a candidate value for a decision Requirement Derivation already, independently owns (whether and
how to fill this R-19-eligible Unknown) — it supplies **zero independent authority** for that choice.
This entire path requires **both** dependency A (the core `M0_SCOPE.md` `MemoryContext` Producer
boundary) **and** dependency D (Requirement Derivation's own `M0_SCOPE.md` authorization to consume
`MemoryContext` at the `DECISION_OPTION` tier, plus `REQUIREMENT_SPEC.md`'s R-24, which lets the
resulting Requirement's rationale cite the `MemoryContext` entry as a memory-informed rationale) —
both are now implemented (`ADR-0004`'s "Acceptance Gate"). Requirement Derivation may adopt the
suggested value, but only after independently judging it a defensible measurement/implementation
choice under its own R-19 authority (e.g. "3 retries with exponential backoff is a common, reasonable
strategy for this class of transient failure, and does not change what the Requirement itself
asserts") — never merely because the memory said so. If adopted, the resulting Requirement's
provenance is marked **Requirement-Derivation-introduced** (R-09) with an explicit stated rationale
that itself cites the `MemoryContext` entry as a **memory-informed rationale**, labeled distinctly,
never presented as `IntentSpec`-traced or User-Provided.

**Contrast — an intent-level value memory must NOT fill:** suppose instead the surviving Unknown were
"should failed background jobs be retried automatically **at all**, or surfaced to a human for manual
handling?" This is *not* R-19-eligible, regardless of what any memory suggests: deciding whether
automatic retry exists at all would add or remove a capability the Requirement itself asserts — a
want-level question about what the system does, not a measurement detail of how an already-settled
behavior is implemented. No memory-informed suggestion, however confidently stated or however well it
worked in a prior phase, changes this — R-19's own eligibility test excludes this Unknown before any
question of memory involvement even arises. A memory suggesting "no human review was needed before"
could, at most, inform a **clarification question** at Intent Parsing (an entirely different stage
and mechanism, per "Historical User Memory Rule"), never a Requirement Derivation "default."

**Forbidden transformation:** (a) Requirement Derivation adopting the memory's suggested retry
count/backoff value without independently judging it defensible — treating the memory's suggestion as
itself sufficient justification; (b) using the same "R-19 default" mechanism to decide whether
automatic retry exists at all, on the reasoning that "memory suggested it and R-19 lets Requirement
Derivation fill some things" — R-19's eligibility test does not bend merely because a memory happens
to have an opinion; (c) presenting the adopted value as though it derived from `IntentSpec` or User-
Provided standing, rather than as Requirement-Derivation's own R-09-marked, memory-informed choice.

**Clarification required?** No — this is Requirement Derivation's own R-19 authority being exercised
on a genuinely R-19-eligible Unknown, not an `IntentSpec`-level open item.

**Expected provenance behavior:** The Requirement's provenance shows, distinctly: (a) marked
Requirement-Derivation-introduced (R-09); (b) an explicit rationale independently justifying the
chosen value under R-19's own test; (c) an explicit citation of the `MemoryContext` entry as a
memory-informed rationale — three separate facts, never collapsed into "informed by memory" alone,
per M-21.

**Expected stage behavior:** Requirement Derivation retains full authority to adopt, modify, or
reject the suggested value, or to leave the Unknown unresolved and carry it forward instead — the
memory's presence never obligates a particular outcome, and never narrows what Requirement Derivation
was already permitted to decide under R-19.

---

## 25. The same R-19-eligible Unknown, but the candidate value comes from a historical user
statement — `DECISION_OPTION` is forbidden regardless of category or content

**Memory input, Category A:** `decision`-type record, project-scoped, inspectably citing the exact
past `UserIdea` turn it traces to — "User said (`UserIdea` v1, turn 3): 'let's use 3 retries with
exponential backoff for failed background jobs.'" (Brain confidence: medium).

**Memory input, Category B:** the same content, but with no inspectable, resolvable citation to an
originating turn — "User previously indicated a preference for 3 retries with exponential backoff for
background job failures," with no traceable linkage.

**Current-run input:** identical to Case 24 — an already-settled Requirement ("the system SHALL retry
a failed background job automatically") with a surviving, R-19-eligible Unknown (exact retry count and
backoff strategy). **Gate 1 (R-19 content eligibility) passes identically to Case 24** — the Unknown
itself is exactly as fillable here as it was there; nothing about R-19's own test changed.

**Forbidden use, both categories:** Neither entry may carry `influence_tier: DECISION_OPTION`, even
though the *numeric value proposed* ("3 retries, exponential backoff") is byte-identical to Case 24's
`pattern`-type entry and would, on content alone, read as exactly the kind of narrow technical/
measurement detail R-19 permits filling. **Gate 2 (`MemoryContext` source eligibility) fails
categorically for both**, because `is_historical_user_statement` is `true` — the entry's classified
source, not its content, is what disqualifies it here. This is not a confidence or reliability
judgment about either statement (the Category A entry is, if anything, more directly and reliably
attributable to the user than Case 24's `pattern` record is to any specific author) — it is that
historical-user semantic content has its own, separately disciplined routes (Category A → Intent
Parsing's `SEMANTIC_PREMISE` path per Dependency B; either category → a current-run clarification
question), and Requirement Derivation obtaining a second, independent channel for the same class of
content via `DECISION_OPTION` would let Dependency D become a backdoor around Dependency B's own gate.

**If historical semantics genuinely matter here, the correct routes are:** for the Category A entry,
Intent Parsing (already authorized, Dependency B) may cite it directly as the premise of a current-run
Inferred Claim — e.g. "the system SHOULD retry failed background jobs with a similar strategy to a
prior run's," an ordinary Inferred Claim Requirement Derivation would then compile from under its own
unmodified R-03/R-10/R-22 authority, exactly as Case 18's `REQUIREMENT_CASES.md` pattern works. For
either category, it may instead shape a current-run clarification question ("a prior project used 3
retries with exponential backoff for this kind of failure; does a similar approach work here?") whose
*current* answer, if given, becomes an ordinary User-Provided Claim. Neither route touches
`DECISION_OPTION` at all — both terminate before Requirement Derivation ever sees the memory directly.

**Forbidden transformation:** (a) admitting either entry at `DECISION_OPTION` on the reasoning that its
content is narrowly technical and therefore "should" be eligible, treating R-19's content test as
though it were the only gate; (b) reclassifying `is_historical_user_statement` to `false` for either
entry merely to make it DECISION_OPTION-eligible — content inspection already correctly identified
both as historical user statements, and relabeling them to escape Gate 2 is exactly the kind of
classification-fail-open move the Classification Fail-Closed Rule forbids; (c) treating the Category A
entry's stronger, resolvable citation as a reason it should be *more* eligible for `DECISION_OPTION`
than the Category B entry — Gate 2 excludes both identically; citation strength affects only Category
A's own `SEMANTIC_PREMISE` eligibility elsewhere, never `DECISION_OPTION` eligibility anywhere.

**Clarification required?** No new clarification is forced by this case alone — whether a
clarification question is warranted follows the ordinary Historical User Memory Rule analysis
(LOW/MEDIUM Decision Impact may reduce repeated clarification; HIGH/CRITICAL never closes on memory
alone), unrelated to this case's own point about `DECISION_OPTION` ineligibility.

**Expected provenance behavior:** No Requirement provenance may ever cite either entry as a
memory-informed rationale for a `DECISION_OPTION`-filled default. If the Category A entry instead
informed an Inferred Claim at Intent Parsing (the legitimate route above), *that* Claim's own
provenance, not any Requirement's, carries the citation — exactly Case 18's shape, not this case's.

---

## 26. A separately-recorded, accepted technical outcome remains D-eligible even when a user's
suggestion first prompted it — no provenance laundering

**Historical memory (not D-eligible, for contrast):** the same Category A entry as Case 25 — "User
said (`UserIdea` v1, turn 3): 'let's use 3 retries with exponential backoff for failed background
jobs.'" This entry's own classification, `is_historical_user_statement: true`, never changes; it
remains permanently ineligible for `DECISION_OPTION`, exactly as Case 25 establishes.

**A separate, later Brain record:** after the project actually shipped with that configuration, a
distinct `decision`-type (or `pattern`-type) record, project-scoped, with its own independent
provenance and no citation back to the original `UserIdea` turn, is written: "The accepted
implementation for background job retries uses a maximum of 3 attempts with exponential backoff; this
has been the project's adopted operational default since v1 and remains unchanged." (Brain confidence:
high, `provenance.author`: a project process record, not a restatement of the user's own words.)

**Why this second record is D-eligible where the first is not:** content inspection of this record
classifies it as a **prior project/process decision or outcome**, not a historical user statement —
`is_historical_user_statement: false`. It describes what the *project* did and adopted, not what the
*user* said; its own provenance traces to the implementation/process record, never to a `UserIdea`
turn. This is a genuinely separate artifact with its own independent classification, not the original
statement wearing a new label. Gate 2 (`MemoryContext` source eligibility) is therefore clear for this
record on its own terms, and — Gate 1 (R-19 content eligibility) being identical to Case 24/25 — it
may be admitted at `DECISION_OPTION`, subject to every ordinary D discipline: zero independent
authority, Requirement Derivation's own independent R-19 judgment, and an explicit memory-informed-
rationale citation if adopted.

**Forbidden transformation — the laundering move this case exists to name:** production (or any
downstream reasoning) treating the *original* historical-user-statement entry as though it had been
"promoted" or "converted" into the second, eligible record merely because they describe the same
underlying value — e.g. citing the original entry's `entry_id` as the `DECISION_OPTION` rationale on
the theory that "it's the same fact, just recorded twice." It is not the same fact for this purpose:
the second record's eligibility comes entirely from its own independent classification and provenance,
never inherited from, or unlocked by, the first. Each retains its own, permanently separate
classification; the first is never reclassified, relabeled, or silently treated as equivalent to the
second merely because they agree in content.

**Clarification required?** No — this case does not introduce a new Decision Impact question; it
distinguishes two already-classified records from each other.

**Expected provenance behavior:** If Requirement Derivation adopts the second record's suggested
value, the Requirement's provenance cites *that* record's `(memory_context_id, entry_id)` as the
memory-informed rationale — never the first, historical-user-statement record's identity, even
informationally alongside it.
