# Contract: MemoryContext

Status: part of M0 `ADR-0004` (Memory Context Authority Boundary, Status: Proposed).
Implementation-independent — no serialization, field names, or schema are defined here, mirroring
[REQUIREMENT_SPEC](./REQUIREMENT_SPEC.md)'s relationship to its own future schema. **This document
does not itself authorize any stage to consume `MemoryContext`.** Consumption requires the
`M0_SCOPE.md` amendment `ADR-0004` identifies as required and not yet performed — see "Stage
Consumption Is Not Yet Authorized" below.

## Purpose

`MemoryContext` is the sole, bounded artifact through which durable memory (MIHVER Brain,
`../mihver-brain`) may ever reach a pipeline stage. It exists to make one thing impossible by
construction: a stage silently reading raw, mutable, unscoped memory as if it were a declared input
of equal standing to `UserIdea`, `IntentSpec`, `RequirementSpec`, or `Evidence`.

`MemoryContext` is not a `Claim`. It is not `Evidence`. It is not part of `UserIdea`. It carries no
authority of its own — only a classified, provenance-preserving record of what was retrieved, from
where, when, for what purpose, and (once known) whether it actually mattered. A stage that consumes
it must still separately earn any semantic effect that retrieved content has on that stage's own
output, through the same disciplined mechanisms (Inference Policy, Requirement-Level Inference,
Evidence sourcing) that already govern every other external input to the pipeline.

## Stage Consumption Is Not Yet Authorized

Per Principle 3 (Structured Artifacts Between Stages) and `M0_SCOPE.md`'s stage table, a stage may
consume only its explicitly declared inputs. No stage currently declares `MemoryContext` — or any
memory/Brain artifact — as an input. This document defines what `MemoryContext` *would* mean and
how it *would* have to be constrained if and when a specific stage's `M0_SCOPE.md` entry is amended
to declare it. Until that amendment happens, separately, with explicit human authorization,
**no stage may consume `MemoryContext` at all, and no stage may query MIHVER Brain directly.** This
is not a placeholder rule pending implementation; it is the hard boundary this whole document exists
to protect.

## Relationship to MIHVER Brain

MIHVER Brain (`../mihver-brain`) stores eight memory types — `project`, `decision`, `lesson`,
`incident`, `pattern`, `playbook`, `reference`, `inbox` — each carrying `status`, `scope`,
`confidence`, `created`/`updated`, `tags`, a `supersedes`/`superseded_by` chain, and
`provenance.source`/`provenance.author`. This is the actual, complete taxonomy (verified against
`../mihver-brain`'s own schema, not assumed) — this document maps onto it; it does not propose a
new one.

Brain's schema is deliberately generic and encodes no MIHVER-specific epistemic distinction. In
particular:

- Brain's `confidence` (`low`/`medium`/`high`) is the memory *author's* judgment, at write time,
  that the record is durable and useful. **It is never MIHVER's own Inference-derivation confidence
  (`INTENT_SPEC.md`'s Confidence Policy) and must never be copied into that role.** A memory's Brain
  confidence and the confidence of any Inference that later cites it are computed independently, at
  different times, by different processes, for different questions.
- Brain's `status: active`/`superseded`/etc. describes the record's own lifecycle *inside Brain*. It
  is not the same question as "is this still true for the current MIHVER run" — a record can be
  `active` in Brain and stale for this run's purposes (see Invariant M-05).
- Brain's `scope` (`global` or a lowercase project slug) is a necessary filter and never, by itself,
  a sufficient stage-isolation or cross-project boundary (see "Cross-Project Scope Verification"
  below).
- FTS5 search relevance is not stored on the record at all — it is a property of one specific search
  call, gone the moment the call returns. Nothing about a memory's stored fields represents "how
  relevant it was to some past query."

## What Qualifies as a MemoryContext Entry

A `MemoryContext` entry is a **retrieved, classified reference** to a Brain memory record, produced
at a specific retrieval boundary for a specific purpose. It is eligible for inclusion only when:

- it was retrieved by an explicit query, for a stated purpose, at a recorded retrieval time — never
  a blanket dump of everything Brain holds (Threat I, `ADR-0004`);
- its `type` is not `inbox` — an `inbox` record is unclassified by definition and is excluded from
  production entirely, not merely deprioritized (see "Semantic Authority Classes" below);
- its Brain-recorded `scope` has been checked against the current run's own project identity, not
  merely assumed compatible because it happens to carry a matching-looking slug (see "Cross-Project
  Scope Verification");
- its supersession chain (`supersedes`/`superseded_by`, `status: superseded`) has been resolved —
  a superseded record is never admitted as though it were still live (Invariant M-04).

## Semantic Authority Classes

Brain's `type` field is a **weak prior**, not a determinant — nothing in Brain's schema encodes
whether a record describes a specific user's own historical statement versus MIHVER's own process
decision; both would naturally be stored as `decision` records. `MemoryContext` production must
inspect scope and content, not merely read `type`, before assigning an authority class:

| Brain type | Typical authority class (prior) | What production must actually verify |
|---|---|---|
| `project` | Durable project-identity anchor. | Content is a description of the project itself, not a smuggled requirement. |
| `decision` | **Historical user statement/preference** (project-scoped, describing something a user said or chose) *or* prior project decision/outcome (describing MIHVER's own process). | Which of the two this actually is — Brain does not distinguish them; production must read the body. |
| `lesson` | Procedural-only. | Never carries content framed as a user-facing requirement; if it does, it is misfiled and excluded, not reclassified into a semantic use. |
| `incident` | Procedural by default; may motivate a research hint about a specific named technology. | Never admitted as an Evidence entry directly (see "Memory and Evidence Boundary"). |
| `pattern` | Prior architecture outcome. | May inform candidate search only; never bypasses Requirements/Evidence/Evaluation. |
| `playbook` | Procedural-only. | Describes a process, not a user's system. |
| `reference` | Candidate technology/evidence knowledge. | Must clear the full Evidence-freshness gate before any semantic use — see "Memory and Evidence Boundary." |
| `inbox` | **Excluded from production entirely.** | Not a lower-priority class — genuinely not retrievable into any stage-facing `MemoryContext` until a human or Claude re-files it into a real type. |

## The Seven Independent Authority Axes

None of the following substitutes for, caps, or is derived from another. Collapsing any pair
reproduces, for memory, the exact failure `ADR-0002` already forbids for Claims (force/origin/
confidence collapse):

1. **Retrieval relevance** — a query-time ranking signal only. Never read as truth or authority
   (Invariant M-01).
2. **Source/provenance** — Brain's `provenance.source`/`provenance.author`, mechanically recorded.
   Describes how the record entered Brain, not whether its content currently governs anything.
3. **Semantic authority class** — assigned at production per the table above; not present in
   Brain's own schema.
4. **Freshness/temporal standing** — Brain's own lifecycle fields, plus a separate, production-time
   judgment of currency for this run (Invariant M-05).
5. **Scope/project applicability** — Brain's `scope` field, verified (not assumed) against the
   current run's project identity (Invariant M-06).
6. **Confidence, where meaningful** — Brain's author-supplied confidence, kept distinct from any
   Inference-derivation or Evidence confidence computed later (Invariant M-02).
7. **Allowed use by stage** — which specific stage(s) may use this entry, and for which purpose
   class (procedural vs. semantic-eligible), assigned at production, never left to the consuming
   stage's own discretion.

## Historical User Memory Rule

A statement genuinely User-Provided in a past run carries no automatic standing as a User-Provided
Claim in a new `IntentSpec`. `IntentSpec`'s own definition of User-Provided is "traceable directly to
something the user said in a specific `UserIdea` version" — a historical `MemoryContext` entry is
traceable to a *different* `UserIdea`, from a different run, and therefore fails that test by
definition, regardless of how directly it matches the current subject matter.

A historical user statement, once admitted into `MemoryContext`, may be used in exactly two ways —
never a third — by an authorized, memory-consuming Intent Parsing pass:

- **As a stated, cited premise for a current-run Inferred Claim** — carrying its own
  `derivation_confidence`, its own provisional/reversible marking, and explicit citation of the
  `MemoryContext` entry as its premise. The resulting Claim's origin is **Inferred, and only
  Inferred — never User-Provided, and never Assumed either** (Assumption Policy restricts
  Assumptions to narrowly interpretive gaps, never operational defaults, and a historical preference
  is exactly the latter, not the former — see "No Assumed-Origin Path for Memory" below) — no matter
  how confident the match or how recently the historical statement was made. **This path is not yet
  available**: `INTENT_SPEC.md`'s Inference Policy and Provenance model, as frozen, define an
  Inference's premises as other `IntentSpec` Claims tracing to the current `UserIdea`; a
  `MemoryContext` entry satisfies neither, and citing one as an Inference's premise requires the
  `SEMANTIC_AMENDMENT_REQUIRED` change `ADR-0004`'s Foundation Impact Analysis identifies, not yet
  performed. Until then, this path is described here as the eventual target shape, not a currently
  authorized mechanism.
- **As informational input shaping a candidate clarification question** posed to the *current*
  user — e.g. "a prior project of yours used PostgreSQL; is that still your preference here?" The
  memory motivates the question; only the current user's *current* answer, if given, becomes a
  User-Provided Claim. The memory itself never substitutes for that answer. **This path requires no
  amendment**: the resulting Claim is an ordinary User-Provided Claim from the current `UserIdea`,
  produced exactly the way Intent Parsing already produces one — memory only shaped which question
  got asked.

It may never, under any circumstance, be recorded, labeled, or silently treated as a User-Provided
Claim (Invariant M-03) — the same discipline I-01/I-02 already apply to model inferences and
assumptions, extended to this additional source.

### No Assumed-Origin Path for Memory

A memory-derived value must never be represented as an **Assumed** Claim at Intent Parsing, under
any Decision Impact level. Assumption Policy is unequivocal: assumptions are restricted to "narrowly
interpretive gaps... never technical or operational working defaults." A historical preference
(a database choice, a reporting cadence, a technology default) is precisely an operational default,
not an interpretive gap about what the user meant — it is categorically the kind of content
Assumption Policy already excludes. The only Intent-Parsing-stage path for a memory-derived Claim is
the Inferred-origin path above (pending its own required amendment); there is no Assumed-origin
path, and none is introduced by this document.

This is distinct from **Requirement Derivation's own, already-existing, non-`IntentSpec` default
mechanism** (`REQUIREMENT_SPEC.md`'s R-19-eligible-Unknown filling, R-09): if Requirement Derivation
is *separately* authorized to consume `MemoryContext` (its own required `M0_SCOPE.md` amendment,
distinct from Intent Parsing's), a memory-derived value may inform an R-19-eligible working default
there — but that mechanism is not an `IntentSpec` Assumption at all, was not invented by this
document, and does not touch `IntentSpec`'s Claim taxonomy in any way. Conflating the two — "a
memory-derived default" at Intent Parsing versus at Requirement Derivation — is exactly the
ambiguity this section exists to foreclose.

**Repetition never increases standing.** A historical statement repeated across many past
occurrences, many past projects, or many past runs does not thereby become more authoritative —
extending `INTENT_SPEC.md`'s I-16 (repetition, paraphrase, or multi-pass agreement does not by
itself increase confidence or promote an item's origin) to the memory axis (Invariant M-07).

### HIGH/CRITICAL Decision Impact

Memory alone may never close a HIGH or CRITICAL Decision Impact item. A HIGH/CRITICAL item makes the
produced `IntentSpec` version permanently Blocked; resolution requires a genuinely new Intent
Parsing pass grounded in the *current* `UserIdea`, never a later stage silently completing the same
version. Assumption Policy already forbids Assumptions for the kind of goal-level or
architecture-shape questions HIGH/CRITICAL Decision Impact concerns by definition, and a historical
statement from a different run essentially never satisfies Inference Policy's "premises
genuinely support the conclusion" test strongly enough to responsibly settle a
materially-different-architecture question on its own. At most, memory may shape *what clarifying
question gets asked* — never substitute for asking it, and never silently close the item
(Invariant M-08).

### LOW/MEDIUM Decision Impact

Memory may defensibly reduce repeated clarification, subject to all of:

- surfaced as an explicitly marked, provisional, reversible candidate — at Intent Parsing, only ever
  as a labeled Inferred Claim (pending its required amendment) or a clarification-question input,
  per "Historical User Memory Rule" above; **never** as an Assumed Claim, per "No Assumed-Origin
  Path for Memory"; at Requirement Derivation (once separately authorized), an R-19-eligible working
  default is a distinct, already-existing, non-`IntentSpec` mechanism, not a third Intent-Parsing
  option — never presented as settled without qualification either way;
- remains visible in provenance — never silently applied without a trace an auditor could follow;
- yields immediately and completely to the current `UserIdea` if it says anything relevant at all
  (see "Current Input Must Win" below);
- subject to the same no-repetition-bonus rule as HIGH/CRITICAL items (Invariant M-07).

## Current Input Must Win

Deterministic precedence — the current run's own authoritative input always wins; a contradicted
memory is marked stale for this run, never silently overridden into applying anyway, and never
silently discarded without a trace either:

| Current-run authority | Memory | Precedence | On contradiction |
|---|---|---|---|
| Current `UserIdea` | Historical preference | Current wins, always | Memory entry marked stale-for-this-run *within `MemoryContext`'s own record* — never recorded as an `IntentSpec` Conflict, because the memory was never elevated to Claim status; `IntentSpec`'s Conflict machinery is defined over Claims, and a `MemoryContext` entry is not one (Invariant M-09). |
| Current `UserIdea` | Past project decision | Current wins, always | Same as above. |
| Current project canonical state | Historical Brain summary | Current wins, always | Brain summary treated as advisory/candidate-recall only for this run. |
| Current authoritative Evidence | Cached/stale technology memory | Current wins, always | Cached memory may prompt re-verification (a research hint per "Memory and Evidence Boundary"); never substitutes for the current Evidence entry. |

Whether a contradiction additionally triggers clarification depends on the contradicted item's own
Decision Impact, computed by the ordinary rules already governing that computation — memory
contradiction is **not an independent blocking mechanism** layered on top. A HIGH/CRITICAL-level
contradiction may shape what gets asked (never bypasses asking); a LOW/MEDIUM-level one is marked
stale silently, with no clarification required, since current input already authoritatively answered
the question (Invariant M-10). What must never happen, at any impact level, is silently applying
memory content over current-run authoritative input.

## Procedural vs. Semantic Influence

Two independent properties of a specific *use* of a memory entry, not fixed properties of the entry
itself:

- **Procedural influence** changes *how* a stage or reviewer performs its own internal work —
  decomposition strategy, verification rigor, retrieval query construction, which axes get tested.
  It never changes the *content* of any pipeline artifact and requires no epistemic gate — but it
  still requires the ordinary stage-authorization gate (no stage may consume `MemoryContext`, for
  any purpose, until separately authorized per "Stage Consumption Is Not Yet Authorized"): once
  authorized, a `lesson` or `playbook` entry may be applied procedurally without further gating,
  per its Phase 4 classification, and only *additively* — expanding what a stage checks, never
  narrowing or substituting for requirement-derived coverage it would otherwise perform.
- **Semantic authority** is the capacity to become, or directly determine, part of a pipeline
  artifact's actual content. Any entry with semantic-eligible classification (`decision` read as a
  historical user statement, `pattern`, `reference`, `incident`) must still separately clear the
  disciplined mechanism appropriate to where it's used (Historical User Memory Rule for Claims,
  "Memory and Evidence Boundary" for Evidence) before it counts as anything more than a candidate
  lead.

The same entry may carry both potentials for different uses simultaneously: a `pattern` memory
describing a past message-queue architecture may (once Research Planning is authorized) procedurally
shape its search strategy additively, while remaining only a *candidate* lead requiring full
Evidence-gate clearance — via Research + Evidence Collection and then Technology Candidate
Identification's ordinary eligibility screening — before it may influence a `TechnologyCandidateSet`
or `ArchitectureCandidate`'s actual content. It never influences `RequirementSpec` at all: Requirement
Derivation's only declared input is `IntentSpec` (`M0_SCOPE.md`), so no Evidence-gate clearance of any
kind gives a technology-knowledge memory a path into `RequirementSpec`'s content (Invariant M-11).

**Worked precedent, recorded honestly:** the `cross-axis-invariants-require-explicit-review-
contracts` engineering lesson, retrieved and applied during M0 Step 03A's later review rounds,
changed *how* Claude reviewed `REQUIREMENT_SPEC.md` (added pairwise-interaction scrutiny) and never
touched what the user's actual Requirements were. That is the shape every future engineering-lesson
memory must be held to, and the shape this document's procedural/semantic split exists to keep
possible without risking the reverse.

## Memory and Evidence Boundary

`EvidenceBundle` itself is not designed by this document (`ADR-0001` explicitly defers it). This
section fixes only the boundary a future `EvidenceBundle` design must respect:

| Path | Allowed? | Condition |
|---|---|---|
| memory → search/research hint | Allowed once Research Planning is separately authorized to consume `MemoryContext` (not yet performed) | Procedural use — informs Research Planning's own query strategy; must be *additive* (expanding what gets checked), never *substitutive* (narrowing or skipping requirement-derived research coverage); never appears directly as `RequirementSpec` or `ArchitectureCandidate` content. |
| memory → candidate evidence requiring freshness/source verification | Allowed, gated | Hands Research + Evidence Collection a lead to independently re-source, re-**version** (identify the exact current technology/product version the re-verification actually applies to — Principle 5 names version as its own, distinct required property, not implied by a fresh date), re-date, and re-confidence per Principle 5 — the cached memory is never itself the citation. |
| memory → direct `EvidenceBundle` entry | **Never allowed** | A cached "Framework X supports feature Y" cannot supply a *current* verification date; Principle 5 requires one, and memory recall alone cannot make a stale claim current (Invariant M-12). |

This preserves Principle 2 (no material recommendation on assertion alone, including a remembered
one) and Principle 5 (freshness is explicit).

## Cross-Project Scope Verification

Brain's `scope` field (`global` or a lowercase project slug) is a necessary filter and never, by
itself, a sufficient isolation boundary — an apparent isolation mechanism is not automatically a
real one (the same caution the `cwd-is-not-a-filesystem-isolation-boundary` lesson names for a
different mechanism). `MemoryContext` production must additionally verify the current run's own
project identity actually matches the memory's recorded scope before admission — never assume a
matching-looking slug is sufficient, and never admit a `global`-scope record into a project-specific
semantic use without confirming its content is genuinely project-agnostic (Invariant M-13).

## Reproducibility

Because Brain's vault is mutable — records get superseded, reindexed, potentially edited — the raw
Brain index is never sufficient to reproduce a past run's memory context (Principle 11). Only a
frozen `MemoryContext` snapshot is. Two genuinely different kinds of fact are involved here, and they
must not be conflated into one mutable record: facts knowable **at production time** belong to the
frozen `MemoryContext` snapshot itself; facts only knowable **later, at or after consumption** belong
to the *consuming artifact's own* provenance (e.g. an Inferred Claim's provenance entry, which already
must cite its premise per Inference Policy) — they are never written back into, or used to mutate,
the frozen snapshot. A "frozen" artifact that must still be edited after the fact to stay accurate is
not actually frozen; this split is what keeps it genuinely immutable while still preserving both
kinds of fact somewhere.

**Preserved in the frozen `MemoryContext` snapshot itself, fixed at production time** (conceptually —
no JSON fields chosen here, deferred per `M0_SCOPE.md`'s own field-design deferral pattern):

- which memories were retrieved (stable Brain memory IDs), and, separately, an explicit
  retrieval-outcome discriminator — a successful search that admitted zero records is not the same
  fact as retrieval failing to complete at all (Brain/index unavailable), and both are distinct from
  admitting one or more records; conflating any two of these three outcomes loses information an
  audit would need (see Cases 17–18);
- each memory's own content, retained as an actual copy at production time — not merely a hash or
  pointer into Brain's mutable vault, which could later be edited, superseded, or reindexed out from
  under a bare reference — plus its canonical version/identity, so a later audit can confirm the copy
  matches what Brain held at retrieval time;
- retrieval time/snapshot, distinct from the memory's own `created`/`updated` timestamps;
- the retrieval query and its stated purpose;
- each memory's Brain-recorded scope and provenance;
- the authority classification assigned at production (not re-derivable from Brain alone);
- the freshness/temporal-standing judgment made at production time (distinct from Brain's own
  `status`);
- why it was admitted or excluded — the retrieval rationale, for both outcomes (M-14);
- which stage was authorized to use it.

**Preserved separately, in whichever consuming artifact's own provenance actually uses the entry, not
in the frozen snapshot:**

- whether this specific entry actually influenced that artifact's content — knowable only once the
  artifact exists, essential to Explainability (Principle 10) and to honestly distinguishing
  "retrieved but unused" from "retrieved and load-bearing";
- whether a later-discovered contradiction marks the entry stale-for-this-run (M-09/M-10) — if
  discovered after production, this is recorded in the contradicting artifact's own provenance (e.g.
  "this Inferred Claim's premise conflicts with `MemoryContext` entry X, which is accordingly treated
  as stale for this run"), never by editing the frozen `MemoryContext` snapshot itself.

## Common Violations

- **Historical-statement laundering**: compiling a past run's "I usually prefer PostgreSQL" directly
  into a current-run User-Provided Requirement. (Violates M-03.)
- **Relevance-as-authority conflation**: treating a high FTS5 rank as evidence of truth or authority.
  (Violates M-01.)
- **Engineering-lesson leakage**: compiling "review by invariant axis" into a user-facing system
  Requirement. (Violates M-11's procedural/semantic split.)
- **Architecture lock-in**: recommending a past project's framework now merely because it worked
  before, without independently clearing Requirements/Evidence/Evaluation. (Violates the
  Evidence Boundary and Model C's core design intent.)
- **Cached-evidence laundering**: recording a remembered "Framework X supports feature Y" directly
  as an `EvidenceBundle` entry without re-verification. (Violates M-12.)
- **Silent override**: letting a memory silently take precedence over a contradicting current
  `UserIdea` statement. (Violates M-09/M-10.)
- **Repetition-as-authority**: treating a historical statement as more trustworthy because it
  recurs across several past memories. (Violates M-07.)
- **Cross-project bleed**: admitting a project-scoped memory into a different project's run without
  verifying the scope actually matches. (Violates M-13.)
- **Raw Brain access**: any stage querying `../mihver-brain` directly instead of consuming a
  produced `MemoryContext`. (Violates the hard constraint in `ADR-0004`'s Authority Map and this
  document's "Stage Consumption Is Not Yet Authorized.")

## Deterministic Invariants

- **M-01** Retrieval relevance is never read as truth or authority; it is a query-time ranking
  signal, not a stored property of the memory record, and never substitutes for a semantic authority
  classification.
- **M-02** A Brain memory's author-supplied `confidence` is never copied into, or presented as,
  MIHVER's own Inference-derivation confidence or Evidence confidence — those are computed
  independently, at the point the memory actually becomes a premise or a candidate lead.
- **M-03** A historical user statement never becomes a current-run User-Provided Claim merely
  because the user originally said it, however directly it matches or however recently it was
  stated. It may only become a cited premise for a current-run Inferred Claim (pending the
  `SEMANTIC_AMENDMENT_REQUIRED` change this requires, per `ADR-0004`), or informational input to a
  clarification question whose current answer (if given) is what becomes User-Provided. **It may
  never become an Assumed Claim under any Decision Impact level** — Assumption Policy restricts
  Assumptions to narrowly interpretive gaps, never operational defaults, and a historical preference
  is the latter, not the former.
- **M-04** A superseded Brain record (`status: superseded`, or linked via `supersedes`/
  `superseded_by`) is never admitted into `MemoryContext` as though it were still live; supersession
  must be resolved before admission, and both the superseded and superseding record are never
  treated as independent, simultaneously-live support for the same conclusion. This trusts Brain's
  own supersession mechanism as accurately reflecting its author's intent — Brain records
  supersession only via an explicit caller action (`remember --supersedes`), never by inferring a
  relationship between two records itself, the same explicit-act discipline `USER_IDEA.md`'s UI-05
  requires for `UserIdea` turns, applied at a different layer (Brain's own record lifecycle, not
  `UserIdea`'s turn-correction model) — the two are not the same mechanism and this document does not
  claim they are, only that each is independently sound.
- **M-05** A memory's freshness for the current run is a judgment made at `MemoryContext` production
  time, distinct from Brain's own `status` field; an `active` Brain record can still be judged stale
  for this run's purposes.
- **M-06** A memory's Brain-recorded `scope` is verified against the current run's actual project
  identity before admission — never assumed compatible from a matching-looking slug alone, and a
  `global`-scope record is never admitted into a project-specific semantic use without confirming
  its content is genuinely project-agnostic.
- **M-07** Repetition of the same historical statement across multiple past memories, projects, or
  runs never increases its authority, standing, **or the `derivation_confidence` of any Inference
  citing it** — confidence and authority are independent axes (Phase 4), and I-16's prohibition on
  repetition-based confidence increases applies to the memory axis exactly as literally as it applies
  to `IntentSpec` itself, not merely to some looser "standing" that leaves confidence unconstrained.
- **M-08** Memory alone never closes a HIGH or CRITICAL Decision Impact item; resolution requires a
  new Intent Parsing pass grounded in the current `UserIdea`. Memory may inform what clarifying
  question is asked; it never substitutes for asking it or for the current user's answer.
- **M-09** A memory contradicting current-run authoritative input is never recorded as an
  `IntentSpec` Conflict — `IntentSpec`'s Conflict machinery is defined over Claims, and a
  `MemoryContext` entry, never having been elevated to Claim status, is not one. It is instead marked
  stale-for-this-run — if the contradiction is known at production time, within `MemoryContext`'s own
  record; if discovered later (e.g. by a stage consuming it), within that consuming artifact's own
  provenance, never by mutating the already-frozen `MemoryContext` snapshot (see "Reproducibility").
- **M-10** Memory contradiction is never an independent blocking mechanism; whether it triggers
  clarification depends entirely on the contradicted item's own, ordinarily-computed Decision
  Impact — never on the fact of contradiction alone.
- **M-11** A memory's procedural influence (on process, review, or retrieval strategy) and its
  semantic authority (capacity to affect pipeline-artifact content) are independent properties of a
  specific use, not fixed properties of the memory record; a `lesson`/`playbook`-classified entry has
  no semantic authority under any use.
- **M-12** No memory entry may become a direct `EvidenceBundle` entry; it may only motivate
  re-verification that independently satisfies all five of Principle 5's requirements — source,
  **version** (the exact current technology/product version the re-verification actually applies to,
  not merely inherited from the memory's own), verification date, confidence, and freshness — at the
  time of that verification, not at the time the memory was written.
- **M-13** Brain's `scope` field is a necessary filter, never a sufficient stage-isolation or
  cross-project boundary by itself; `MemoryContext` production must independently verify project
  identity before admission.
- **M-14** A `MemoryContext` production record (frozen at production time) must preserve enough to
  answer, for any later audit: which memories were retrieved and their retrieval-outcome
  discriminator (admitted, successfully-empty, or retrieval-unavailable — three distinct facts, never
  conflated), their canonical identity and a retained content copy (not merely a hash or pointer into
  Brain's mutable vault), the retrieval time/query/purpose, their Brain scope/provenance, their
  assigned authority classification and freshness judgment, why each was admitted or excluded, and
  which stage was authorized to use it. Whether an entry actually influenced a consuming artifact's
  output, and whether it was later found stale-for-this-run by contradiction, are recorded separately
  in that consuming artifact's own provenance once known — never by mutating the frozen
  `MemoryContext` snapshot itself (see "Reproducibility" above).
- **M-15** No stage may query MIHVER Brain directly; a `MemoryContext` produced by the dedicated
  retrieval boundary is the only path by which memory may reach a stage, and only once that stage's
  `M0_SCOPE.md` input list explicitly declares it (Principle 3).

## Examples

- Memory: a `decision`-type record, project-scoped, "user decided against a message queue for v1,
  citing team unfamiliarity" (Brain confidence: medium). Current run: same project, no current
  statement about message queues. → Legitimate use: a cited premise for an Inferred Claim ("the
  system SHOULD avoid introducing a message queue, Inference-derived, moderate confidence,
  provisional") — never a User-Provided prohibition.
- Memory: a `lesson`-type record, "review coverage should be decomposed by invariant axis." →
  Legitimate use: informs how a future review task decomposes its own reviewer dispatch. Illegitimate
  use: appearing anywhere in `RequirementSpec` or an `ArchitectureCandidate`.
- Memory: a `reference`-type record, "Framework X added native WebSocket support (verified against
  vendor docs, dated six months ago)." Current run needs WebSocket support today. → Legitimate use:
  a research hint prompting Research + Evidence Collection to re-verify current support and
  re-record it with a fresh date; illegitimate use: citing the six-month-old memory itself as the
  `EvidenceBundle` entry.

## Anti-Examples

- Compiling a `decision`-type memory ("user prefers PostgreSQL") directly into "the system MUST use
  PostgreSQL" as a User-Provided Requirement, with no Inference layer and no confidence/provisional
  marking. (Violates M-03.)
- Treating three separately-stored memories that all repeat the same historical preference as
  stronger support than one would be. (Violates M-07.)
- A stage silently calling `../mihver-brain`'s search CLI itself, bypassing any produced
  `MemoryContext`. (Violates M-15.)
- Letting a historical "user prefers local execution" memory silently override a current `UserIdea`
  stating "this project must run in our cloud account," with no marked contradiction anywhere.
  (Violates M-09/M-10 and "Current Input Must Win.")
- Admitting a `superseded` Brain record and its superseding replacement as two independent pieces of
  supporting memory for the same conclusion. (Violates M-04.)
