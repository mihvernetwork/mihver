# Memory Context Semantic Test Corpus

A worked-example corpus for [MEMORY_CONTEXT](../contracts/MEMORY_CONTEXT.md) and
[ADR-0004](../adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md), the same role
[REQUIREMENT_CASES](./REQUIREMENT_CASES.md) plays for
[REQUIREMENT_SPEC](../contracts/REQUIREMENT_SPEC.md). Each case assumes a `MemoryContext` has
already been produced by the dedicated retrieval boundary `ADR-0004` designs — **not** a stage
querying Brain directly, which is never legitimate under this model (M-15). No stage is currently
authorized to consume `MemoryContext` at all (see "Stage Consumption Is Not Yet Authorized" in
`MEMORY_CONTEXT.md`); these cases describe what *would* be correct once a specific stage's
`M0_SCOPE.md` input list is amended to declare it, and are written now so that amendment has a
tested semantic target to implement against.

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

**Read every "Allowed use" and "Expected stage behavior" line below as implicitly prefixed by "once
that specific stage is separately authorized to consume `MemoryContext` (not yet performed)."** This
applies uniformly to every case and every stage named in it — Intent Parsing, Research Planning,
Research + Evidence Collection, Technology Candidate Identification, Architecture Synthesis, and
Evaluation alike — with no exceptions and no case-by-case re-statement needed. Where a case
additionally describes citing a `MemoryContext` entry as the premise of an Inferred Claim or a
Requirement-Level Inference specifically, read that as further conditioned on the corresponding
`INTENT_SPEC.md`/`REQUIREMENT_SPEC.md` amendment identified in `ADR-0004`'s Foundation Impact
Analysis, which is a distinct, additional requirement from the `M0_SCOPE.md` input-declaration
amendment. No case in this corpus authorizes any consumption today.

---

## 1. Stable historical preference, no current mention

**Memory input:** `decision`, project-scoped, "user stated a preference for PostgreSQL over other
databases" (Brain confidence: medium, `status: active`, no supersession).

**Current-run input:** Same project. Current `UserIdea` contains no statement about databases at
all.

**Allowed use:** Cited as the premise for an Inferred Claim ("the system SHOULD use PostgreSQL,
Inference-derived from a historical statement, moderate confidence, provisional/reversible") — or
as informational input shaping a candidate clarification question ("a prior statement of yours
named PostgreSQL — still your preference here?"). Both require the `MemoryContext` entry to be
explicitly cited as the premise.

**Forbidden transformation:** Compiling directly into a User-Provided Requirement ("the system MUST
use PostgreSQL") with no Inference layer, no confidence, and no provisional marking. (Violates M-03.)

**Clarification required?** Not mandatory (MEDIUM-territory default-technology preference) — either
path above is defensible; silently doing neither (dropping the memory without any record) is not.

**Expected provenance behavior:** The Inferred Claim's provenance names the `MemoryContext` entry as
its premise, explicitly labeled "historical, not current-run"; the historical origin is never
compressed into looking like a current-run statement.

**Expected stage behavior:** Intent Parsing (once authorized) may use this; it never mints a
User-Provided Claim from it directly.

---

## 2. Historical preference contradicted by current UserIdea

**Memory input:** `decision`, project-scoped to this same current project, "user preferred
local-only execution" (medium confidence, active).

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
administrative action for audit purposes" (high confidence, active).

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
plain JavaScript" (each medium confidence).

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

**Expected stage behavior:** Intent Parsing (once authorized) must apply the same confidence
discipline whether one or many historical statements are retrieved.

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
originating lead). May also become a `TechnologyCandidateSet` entry, but **only** after
independently clearing Technology Candidate Identification's hard eligibility constraints against
*this* `RequirementSpec`, informed by a freshly-produced `EvidenceBundle` — never admitted, ranked,
or preferred merely because it worked before (Threat D, Principle 9 — best-fit, not universal
best).

**Forbidden transformation:** Recommending LangGraph in the final `ArchitectureCandidate`/
`ArchitectureDecision` on the strength of the memory alone, bypassing Evaluation's actual scoring
against the current `RequirementSpec`.

**Clarification required?** No — this is an architecture-stage concern, not an intent-stage one;
no user clarification is implicated.

**Expected provenance behavior:** If it does become a `TechnologyCandidateSet` entry, its
provenance cites the fresh `EvidenceBundle` entry that qualified it, not the memory directly — the
memory's role recorded as "originating research lead," never as the qualifying basis itself.

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
own required `M0_SCOPE.md` amendment — not named among the plausible candidates in `ADR-0004`'s
Phase 11 and flagged there as an omission this case exposes), it is `DISCOVERY_ATTENTION`: it may add
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

**Memory input:** Two linked `decision` records, both scoped to the current project: an original
"user wants a $100/month budget ceiling" (now `status: superseded`, `superseded_by` pointing at the
second) and a correction, "user corrected: budget is actually $500/month" (`status: active`,
`supersedes` pointing at the first).

**Current-run input:** No current statement about budget.

**Allowed use:** Only the live ($500/month) record may be cited as a premise; the superseded
$100/month record is excluded from `MemoryContext` production entirely once its supersession is
resolved.

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
system" (high confidence, active).

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
because it carries a `global` tag.

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
earlier phase), "user previously indicated a preference for weekly (not daily or monthly) reporting
cadence" (medium confidence, active).

**Current-run input:** Current `UserIdea` requests "a report," with no cadence specified — a MEDIUM
Decision Impact item (tunes a detail, doesn't change the shape of the solution).

**Allowed use:** May defensibly reduce a repeated question — but only via the Inferred-Claim path at
Intent Parsing ("weekly cadence, Inference-derived from a historical statement, moderate confidence,
provisional"), pending its own required amendment (see "Historical User Memory Rule"), or via a
current-run clarification question shaped by the memory. **Not** via Requirement Derivation's R-19
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
linked via supersession, both project-scoped to the current project: one states "user wants minimal
infrastructure cost," the other states "user wants maximum reliability regardless of cost" —
genuinely in tension, with neither marked as correcting the other.

**Current-run input:** No current statement resolving this tension.

**Allowed use:** Both may be retrieved and cited, separately, as premises for two separate candidate
Inferred Claims (a cost-sensitivity preference and a reliability preference) — `MemoryContext`
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
provenance, and the full Evidence/eligibility/Evaluation gates before it could ever reach
`SEMANTIC_PREMISE` standing. Record (a) is excluded outright: with no `RunContext` to match a project
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
