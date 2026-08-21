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

## Current-Run Scope Anchor: RunContext

**A Brain memory must never authenticate its own applicability.** An earlier draft of this document
let `MemoryContext` production verify a memory's scope by consulting a Brain `project` record for
"the current project's identity" — using a record stored *inside* the system being checked as the
authority for checking it. This is circular in exactly the shape the `cwd-is-not-a-filesystem-
isolation-boundary` lesson names for a different mechanism: an apparent isolation/identity check is
not a real one merely because it looks like one. Fixed by introducing a minimal, non-memory concept
this design calls **`RunContext`** (name illustrative, not a schema commitment):

- **What it is.** The current run's own identity anchor — which project, if any, this invocation of
  MIHVER belongs to, and any stable identifier needed to relate it to a prior engagement. It answers
  "which run/project is this," never "what does the user want" (that remains Intent Parsing's
  question) and never "what happened before" (that is what Brain, filtered through `RunContext`,
  might supply).
- **Where it originates.** Outside Brain entirely, and outside the M0 pipeline's own artifact chain
  (`UserIdea` → ... → `MihverArchitectureSpec`) as currently scoped — from whatever invokes MIHVER
  for a given engagement (a session, workspace, or invocation binding established before Intent
  Parsing even runs). It is established once, by the invoking context, not derived, inferred, or
  reconstructed from anything Brain stores.
- **Why it is authoritative relative to Brain.** Because it is established independently of Brain, by
  a party (the invoking context) that is not itself a retrievable memory record, it cannot be
  contaminated by a stale, incorrect, or adversarially-crafted Brain entry the way a Brain-sourced
  identity check could be. Brain may be *asked about* a project matching this identity; it may never
  *supply* the identity being asked about.
- **Optional for projectless runs.** `RunContext` may be absent — a genuinely new, exploratory, or
  one-off engagement with no established project identity. This is a valid, complete state, not an
  error requiring escalation.
- **Global vs. project-scoped memory when no `RunContext` exists.** With no `RunContext`, **only
  `global`-scoped Brain memory is eligible for retrieval at all** — no project-scoped record can be
  admitted, because there is no anchor to verify it against, and "admit it anyway, it looks relevant"
  is exactly the retrieval-relevance-as-authority conflation M-01 already forbids. This is the
  strictest possible reading of "no anchor, no project-scoped admission," not a judgment call left to
  production.
- **What a Brain `project` memory may do instead.** Once `RunContext` already establishes an
  identity (e.g. a project slug), a Brain `project` record matching that same slug may
  **corroborate** it — supplying additional durable description, history, or metadata about a project
  whose identity is already independently known. It may never **establish** that identity in the
  first place, and it may never be consulted *before* `RunContext` exists to decide what `RunContext`
  should be. This directly replaces the earlier, circular treatment of `project` records as an
  identity anchor (see Case 14 in `MEMORY_CONTEXT_CASES.md`, corrected).

## MemoryContext Producer: Role and Authority

Model C's dedicated retrieval boundary needs its own semantic role — M0 currently contains no
stage or boundary that produces `MemoryContext`, and nothing about Model C requires inventing a new
linear pipeline stage to supply one.

**This is a cross-cutting compiler boundary, not a first-class linear pipeline stage** — derived,
not assumed: `M0_SCOPE.md`'s stage table describes a single linear chain, each stage transforming
one primary artifact into the next. `MemoryContext` production does not fit that shape — it is
invoked repeatedly, by whichever *already-authorized* stage needs it, at that stage's own point in
the pipeline, for that stage's own purpose, each invocation producing its own fresh, immutable,
narrowly-scoped `MemoryContext` — never a single once-per-run artifact sitting between two fixed
pipeline stages. This mirrors `ADR-0001`'s own acknowledgment that "MIHVER has more stages than a
typical compiler's textbook depiction" and its "bounded transformation with explicit IR" pattern
without forcing a service used by several different stages into one fixed slot in a linear diagram.

Conceptually, the producer boundary:

- **Inputs:** the current run's `RunContext` (or its explicit absence); a stated retrieval purpose;
  the identity of the specific consuming stage invoking it; and, where that purpose requires checking
  against something already interpreted (see "Separating Admissibility from Interpretation" below),
  the specific version of whichever upstream artifact that judgment already rests on (e.g. the
  current `IntentSpec` version, supplied *to* the producer, never re-derived by it).
- **Output:** one immutable `MemoryContext`, bound to exactly that input combination (see "Lifecycle
  and Invalidation" below).
- **Allowed to decide:** retrieval and filtering against the stated purpose; resolving Brain's own
  lifecycle and supersession chain; mechanical scope admissibility against `RunContext` (identity
  match only, never inference about applicability — this includes `global`-scope admission, which is
  scope-tag equality only, never a judgment that the record's content is genuinely project-agnostic,
  see "Cross-Project Scope Verification" below); flagging mechanical, age/lifecycle-based staleness
  from the record's own `created`/`updated` timestamps (never a judgment that the underlying claim is
  no longer true, see M-05); source/provenance capture; the classification needed to deliver entries
  under least authority (Phase 4's authority axes).
- **Not allowed to decide, under any circumstance:** what the current user means; whether a current
  `UserIdea` phrase semantically contradicts a memory — **unless** that judgment has already been
  settled by an authoritative upstream artifact supplied to it as an input (in which case the
  producer may mechanically apply that *already-settled* judgment, never form a new one of its own);
  Requirements; technology eligibility; Evidence truth; or architecture selection. Every one of these
  remains exclusively the authority of the stage that already owns it.

## What Qualifies as a MemoryContext Entry

A `MemoryContext` entry is a **retrieved, classified reference** to a Brain memory record, produced
at a specific retrieval boundary for a specific purpose. It is eligible for inclusion only when:

- it was retrieved by an explicit query, for a stated purpose, at a recorded retrieval time — never
  a blanket dump of everything Brain holds (Threat I, `ADR-0004`);
- its `type` is not `inbox` — an `inbox` record is unclassified by definition and is excluded from
  production entirely, not merely deprioritized (see "Semantic Authority Classes" below);
- its Brain-recorded `scope` has been checked, mechanically, against the current run's own
  `RunContext` (see "Current-Run Scope Anchor" above) — never against another Brain record's content,
  and never merely assumed compatible because it happens to carry a matching-looking slug (see
  "Cross-Project Scope Verification"); with no `RunContext`, only `global`-scoped records are
  eligible at all;
- its supersession chain (`supersedes`/`superseded_by`, `status: superseded`) has been resolved —
  a superseded record is never admitted as though it were still live (Invariant M-04).

## Semantic Authority Classes

Brain's `type` field is a **weak prior**, not a determinant — nothing in Brain's schema encodes
whether a record describes a specific user's own historical statement versus MIHVER's own process
decision; both would naturally be stored as `decision` records. `MemoryContext` production must
inspect scope and content, not merely read `type`, before assigning an authority class:

| Brain type | Typical authority class (prior) | What production must actually verify |
|---|---|---|
| `project` | Durable project *description*, corroborating an already-established `RunContext` identity — **never itself the anchor establishing that identity** (see "Current-Run Scope Anchor" above). | Content is a description of the project itself, not a smuggled requirement; never consulted to determine what the current project *is*, only to enrich an identity `RunContext` already supplied. |
| `decision` | **Historical user statement/preference** (project-scoped, describing something a user said or chose) *or* prior project decision/outcome (describing MIHVER's own process). | Which of the two this actually is — Brain does not distinguish them; production must read the body. |
| `lesson` | `PROCESS_ONLY` always (see "Influence Taxonomy" below). | Never carries content framed as a user-facing requirement; if it does, it is misfiled and excluded, not reclassified into a semantic use. |
| `incident` | `DISCOVERY_ATTENTION` by default — may motivate a research hint about a specific named technology. | Never admitted as an Evidence entry directly (see "Memory and Evidence Boundary"). |
| `pattern` | Prior architecture outcome; `DISCOVERY_ATTENTION` when shaping search. | May inform candidate search only; never bypasses Requirements/Evidence/Evaluation. |
| `playbook` | `PROCESS_ONLY` always. | Describes a process, not a user's system. |
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
7. **Allowed use by stage** — which specific stage(s) may use this entry, and for which Influence
   Taxonomy tier (`PROCESS_ONLY`/`DISCOVERY_ATTENTION`/`SEMANTIC_PREMISE`, see "Influence Taxonomy"
   below), assigned at production, never left to the consuming stage's own discretion.

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

## Separating Admissibility from Interpretation

An earlier draft let `MemoryContext` production itself mark a memory "stale-for-this-run" whenever it
judged the memory to contradict the current `UserIdea`. That judgment — does this historical
proposition mean something incompatible with what the user is currently saying — is an act of
*interpreting current meaning*, which belongs exclusively to whichever stage already holds that
authority (Intent Parsing, for `UserIdea`/`IntentSpec`-level questions). The producer boundary must
never become a hidden Intent Parser. Two categorically different kinds of judgment are distinguished,
and only one belongs to production:

- **A. Production-time mechanical/lifecycle judgments** — scope mismatch against `RunContext`,
  Brain supersession resolution, `inbox`-type exclusion, record age/lifecycle, retrieval relevance.
  These require no interpretation of what the current user means; they are structural facts about
  Brain's own records and the (non-memory) `RunContext` anchor. These remain squarely within the
  producer's authority.
- **B. Semantic contradiction/applicability judgments** — does this memory's content conflict with,
  or no longer apply given, what the current run's user actually means. This requires an
  authoritative current-run interpretation and belongs entirely to the stage that owns it. Production
  may apply such a judgment only when it is handed one *already settled* by that stage, supplied to
  production as an explicit input (e.g. "the current `IntentSpec` version already resolved X to mean
  Y") — production may mechanically apply an already-settled judgment; it may never form a new one.

**If a semantic contradiction is discovered by a consuming stage** (the ordinary case — a stage
interpreting its own artifact notices a cited memory entry no longer applies), that fact is recorded
in **that consuming stage's own provenance** — e.g. "this candidate Inferred Claim's premise,
`MemoryContext` entry X, is superseded in effect by the current `UserIdea`'s own statement Y; entry X
is not used" — never by mutating the already-frozen `MemoryContext` snapshot, and never by production
attempting to detect the contradiction itself in the first place (see "Reproducibility" below for the
general frozen-snapshot-vs-consuming-artifact-provenance split this also follows).

## Current Input Must Win

Deterministic precedence — the current run's own authoritative input always wins. Category-A
(mechanical) exclusions happen at production; category-B (semantic) contradictions are detected and
recorded only by the consuming stage, never by production:

| Current-run authority | Memory | Precedence | Who detects/records the conflict |
|---|---|---|---|
| Current `UserIdea` | Historical preference | Current wins, always | The **consuming stage** (Intent Parsing), in its own artifact's provenance — never `MemoryContext` production, and never recorded as an `IntentSpec` Conflict either, since the memory was never elevated to Claim status; `IntentSpec`'s Conflict machinery is defined over Claims (Invariant M-09). |
| Current `UserIdea` | Past project decision | Current wins, always | Same as above. |
| Current project canonical state | Historical Brain summary | Current wins, always | Whichever stage relies on the canonical state; Brain summary treated as advisory/candidate-recall only. |
| Current authoritative Evidence | Cached/stale technology memory | Current wins, always | Research + Evidence Collection, at re-verification time; cached memory may prompt re-verification (a research hint per "Memory and Evidence Boundary"); never substitutes for the current Evidence entry. |

Whether a contradiction additionally triggers clarification depends on the contradicted item's own
Decision Impact, computed by the ordinary rules already governing that computation — memory
contradiction is **not an independent blocking mechanism** layered on top, and is never something
production itself decides to escalate, since production never detects it in the first place. A
HIGH/CRITICAL-level contradiction, once the consuming stage detects it, may shape what gets asked
(never bypasses asking); a LOW/MEDIUM-level one is simply not used, recorded in that stage's own
provenance, with no clarification required, since current input already authoritatively answered the
question (Invariant M-10). What must never happen, at any impact level, is silently applying memory
content over current-run authoritative input.

## Influence Taxonomy: Process-Only, Discovery/Attention, Semantic Premise

An earlier draft used a two-way procedural/semantic split, and called both "review decomposition"
and "expanding what Research Planning searches for" equally "procedural" — but the second one can
change `ResearchPlan`'s or `ArchitectureCandidate`'s actual search space and content, which the first
never can. Collapsing these two, materially different effects into one label was itself a defect,
corrected here into three properties of a specific *use* of a memory entry, not fixed properties of
the entry itself:

- **`PROCESS_ONLY` influence** changes *how* a stage or reviewer performs its own internal work —
  review decomposition, verification rigor, which axes get tested, how many independent reviewers are
  dispatched. It has **zero** pipeline-artifact-content effect, in either direction, ever. (Note:
  *what a stage searches for* — including the producer's own retrieval query construction — is never
  `PROCESS_ONLY`, since it can change which records are found and therefore the search space; that
  belongs to `DISCOVERY_ATTENTION` below whenever memory content shapes it.) Requires no epistemic
  gate beyond the ordinary stage-authorization gate (no stage may consume `MemoryContext`, for any
  purpose, until separately authorized). `lesson` and `playbook`-classified entries are `PROCESS_ONLY`
  under every use — they have no other category available to them.
- **`DISCOVERY_ATTENTION` influence** proposes additional research questions, candidate technology
  categories, or architecture shapes for a stage to *consider* — it **may** alter that stage's search
  space and, downstream, the content of `ResearchPlan`, `TechnologyCandidateSet`, or
  `ArchitectureCandidate` (which is exactly why it is not `PROCESS_ONLY`), but it **never itself
  establishes** truth, eligibility, a Requirement, or a preference — those still require their own
  disciplined mechanism entirely independent of the memory (Evidence sourcing, Technology Candidate
  Identification's eligibility screening, Evaluation's scoring). Two conditions apply without
  exception: it must be **additive** (expanding what gets checked, never narrowing or substituting
  for what would otherwise be checked) and **provenance-visible** (the stage's own record of why it
  looked where it looked must be able to cite the memory, never silently absorb its influence).
  `pattern`, `incident`, and `reference`-classified entries are typically `DISCOVERY_ATTENTION` when
  used to shape *where a stage looks*.
- **`SEMANTIC_PREMISE` influence** is the capacity to directly support a `Claim`, `Requirement`, or
  equivalent pipeline-artifact content. This is only ever reached by separately clearing the full
  corresponding epistemic or evidence gate for where it is used (the Historical User Memory Rule for
  Claims; "Memory and Evidence Boundary" for Evidence) — a memory entry never arrives at this level
  by mere retrieval or by accumulating enough `DISCOVERY_ATTENTION` uses. A historical user statement
  reaches `SEMANTIC_PREMISE` only as a cited Inference premise (pending its own required amendment);
  `pattern`/`incident`/`reference` entries reach it only once independently re-verified into an actual
  `EvidenceBundle`/`TechnologyCandidateSet` entry.

**Reclassification, corrected against this three-way model:**

| Memory kind | Typical classification | Notes |
|---|---|---|
| `lesson`, `playbook` (engineering lessons, process guidance) | `PROCESS_ONLY` always | No path to any other category, under any use. |
| `pattern`, `incident` (prior architecture outcomes/failures) | `DISCOVERY_ATTENTION` when shaping search; `SEMANTIC_PREMISE` only once independently re-verified into `EvidenceBundle`/`TechnologyCandidateSet` | Never skips the eligibility/Evaluation gate merely by having shaped the search that found a candidate. |
| `reference` (cached technology knowledge) | `DISCOVERY_ATTENTION` as a research lead; `SEMANTIC_PREMISE` only after Principle-5-complete re-verification | See "Memory and Evidence Boundary." |
| `decision` read as a historical user statement | `DISCOVERY_ATTENTION` when shaping a current-run clarification question; `SEMANTIC_PREMISE` only as a cited Inference premise (pending required amendment) | Never `SEMANTIC_PREMISE` merely because the historical statement is confident or repeated (M-07). |

A `pattern` memory describing a past message-queue architecture illustrates the full chain: it may
(once Research Planning is authorized) shape its search strategy as `DISCOVERY_ATTENTION` — additive,
provenance-visible — while remaining only a candidate lead requiring full Evidence-gate clearance, via
Research + Evidence Collection and then Technology Candidate Identification's ordinary eligibility
screening, before reaching `SEMANTIC_PREMISE` standing in a `TechnologyCandidateSet` or
`ArchitectureCandidate`. It never influences `RequirementSpec` at any tier: Requirement Derivation's
only declared input is `IntentSpec` (`M0_SCOPE.md`), so no amount of Evidence-gate clearance gives a
technology-knowledge memory a path into `RequirementSpec`'s content (Invariant M-11).

**Worked precedent, recorded honestly:** the `cross-axis-invariants-require-explicit-review-
contracts` engineering lesson, retrieved and applied during M0 Step 03A's later review rounds, is
`PROCESS_ONLY` — it changed *how* Claude reviewed `REQUIREMENT_SPEC.md` (added pairwise-interaction
scrutiny) and never touched what the user's actual Requirements were. That is the shape every future
`lesson`/`playbook` memory must be held to, and the shape the three-tier taxonomy exists to keep
possible without collapsing it together with the genuinely different `DISCOVERY_ATTENTION` tier that
*can* touch artifact content.

## Memory and Evidence Boundary

`EvidenceBundle` itself is not designed by this document (`ADR-0001` explicitly defers it). This
section fixes only the boundary a future `EvidenceBundle` design must respect:

| Path | Allowed? | Condition |
|---|---|---|
| memory → search/research hint (`DISCOVERY_ATTENTION`) | Allowed once Research Planning is separately authorized to consume `MemoryContext` (not yet performed) | Informs Research Planning's own query strategy; must be *additive* (expanding what gets checked), never *substitutive* (narrowing or skipping requirement-derived research coverage); never appears directly as `RequirementSpec` or `ArchitectureCandidate` content. |
| memory → candidate evidence requiring freshness/source verification (`DISCOVERY_ATTENTION`, en route to `SEMANTIC_PREMISE`) | Allowed, gated | Hands Research + Evidence Collection a lead to independently re-source, re-**version** (identify the exact current technology/product version the re-verification actually applies to — Principle 5 names version as its own, distinct required property, not implied by a fresh date), re-date, and re-confidence per Principle 5 — the cached *memory record* is never itself the citation. |
| memory → direct `EvidenceBundle` entry | **Never allowed, absolutely** | A Brain memory record itself can never satisfy Principle 5's requirements merely by being remembered confidently (Invariant M-12) — this rule concerns the *memory record*, not the general question of Evidence reuse. |

**This does not foreclose a future `EvidenceBundle` design deciding, on its own deterministic terms,
that a *prior, already-produced `EvidenceBundle` artifact* — not a Brain memory record — may be
re-admitted without a fresh network fetch when its own recorded source/version/date/confidence still
satisfy whatever freshness rule that future design specifies.** "Memory is never Evidence" is
absolute and this document does not weaken it. "Every technology observation must be re-fetched from
the network on every single run, forever" is a materially stronger, separate claim this document does
not make and explicitly declines to freeze — that is a future `EvidenceBundle`-design decision (how
*its own* prior artifacts may or may not be reused), not something `ADR-0004` or this contract decides
by implication. The distinction is which prior thing is being reused: a Brain memory record (never
sufficient by itself) versus a prior `EvidenceBundle` entry that a future, dedicated freshness policy
might validate as still current (a question this document leaves entirely open).

This preserves Principle 2 (no material recommendation on assertion alone, including a remembered
one) and Principle 5 (freshness is explicit).

## Cross-Project Scope Verification

Brain's `scope` field (`global` or a lowercase project slug) is a necessary filter and never, by
itself, a sufficient isolation boundary — an apparent isolation mechanism is not automatically a
real one (the same caution the `cwd-is-not-a-filesystem-isolation-boundary` lesson names for a
different mechanism, and the same caution that motivated introducing `RunContext` as a genuinely
external anchor rather than a Brain-internal one). `MemoryContext` production must verify the
memory's recorded `scope` against `RunContext` — never against another Brain record, and never
against the memory's own content — before admission: a project-scoped record's slug must match
`RunContext`'s identity exactly, with no content-based override in either direction; and with no
`RunContext` at all, only `global`-scope records are eligible (Invariant M-13, M-16).

**Admission of a `global`-scoped record is purely mechanical (scope-tag equality — `scope ==
"global"`), the same as any other scope check** — production never inspects a `global` record's
content to decide whether it is "genuinely project-agnostic" before admitting it into
`MemoryContext`. Judging whether a `global`-scoped record's *content* actually generalizes to the
current project, as opposed to merely being tagged that way (a mis-scoped or over-broadly-scoped
record is a real, expected failure mode, not a hypothetical), requires reading and interpreting the
record's subject matter — that is a semantic judgment about applicability, squarely inside the
producer's "not allowed to decide" boundary (see "MemoryContext Producer: Role and Authority"
above), never a mechanical identity check. This judgment is therefore **deferred to the consuming
stage**, exactly as semantic-contradiction detection is (see "Separating Admissibility from
Interpretation" below): production admits every scope-eligible `global` record into `MemoryContext`
unfiltered by content, tagged only with its mechanical scope; a consuming stage must independently
confirm genuine project-agnosticism before treating any such entry as a `SEMANTIC_PREMISE`, or as
`DISCOVERY_ATTENTION` with content-shaping effect, for the current project. An entry a consuming
stage judges not actually project-agnostic is simply not used for that purpose in that run — this
does not mutate the frozen `MemoryContext` (Invariant M-17), it is recorded in the consuming
artifact's own provenance, the same as any other consuming-stage interpretive act.

## MemoryContext Lifecycle and Invalidation

`MemoryContext` is immutable — but immutability alone does not say what current-run state a specific
`MemoryContext` was produced *against*, or when it stops being the right one to consult. A
`MemoryContext` produced while reasoning about `UserIdea` v1 must never be silently reused once its
bound `UserIdea` is superseded by v2 — unconditionally, not merely when the supersession happens to
"materially change" something (that judgment would itself be a semantic one, which production is not
authorized to make; see "Separating Admissibility from Interpretation"). The old artifact remains
historical and immutable (never deleted, never mutated in place, per Principle 11), but it is no
longer *current* for any new reasoning once its bound version is superseded.

Every `MemoryContext` is bound, at production time, to:

- the specific `RunContext` (or its explicit absence) it was verified against;
- the specific consuming stage it was produced for;
- the specific retrieval purpose that motivated it;
- the specific version of any upstream artifact its purpose depended on (e.g. "produced to inform
  Intent Parsing's processing of `UserIdea` v2," if the retrieval purpose was version-specific).

**What supersession invalidates:** if any bound upstream artifact (`UserIdea`, `IntentSpec`, or
whatever else it was produced against) is itself superseded to a new version, per `M0_SCOPE.md`'s
own "Stage Failure and Revision" invariant, any `MemoryContext` bound to the *old* version is no
longer current — the consuming stage, if it still needs memory context at all, must obtain a fresh
`MemoryContext` bound to the new version, mirroring exactly the existing rule that "every stage that
declared \[the amended artifact\] as an input reruns against that new version." This is invalidation
*semantics*, fixed here; the mechanics of *when* a stage notices and re-produces are scheduling
concerns, deferred, per this task's own scope, to implementation — but the semantic fact that an old
`MemoryContext` is no longer current once its bound version is superseded is not deferred, and is not
merely an implementation detail.

**What does not require a new `MemoryContext`:** *within the exact bound invocation* — the same
`RunContext`-or-absence, consuming stage, retrieval purpose, and upstream artifact version — a
retrieval purpose or consumer stage does not change merely because time has passed with no upstream
supersession; `MemoryContext` does not expire on a clock within that single use.

**This never authorizes cross-run reuse.** A `MemoryContext` produced for one run is never carried
forward and reused, as-is, by a later run — even a later run bound to the identical `RunContext`
(or the identical explicit absence of one) and the identical upstream artifact version. Each run's
own authorized invocation of the producer boundary must produce its own fresh snapshot, which
recomputes each memory's age/lifecycle freshness flag against the new run's own retrieval time (M-05)
— an old snapshot's frozen freshness judgment must never be read as still current simply because
nothing it was bound to has since been superseded. "Does not expire on a clock" describes the
snapshot's own internal validity during the single invocation it was produced for; it is not license
to skip producing a fresh one for a new run.

The superseded `MemoryContext` itself remains part of the historical record exactly as a superseded
`IntentSpec`/`RequirementSpec` version does — inspectable, never deleted, simply no longer the current
one to consult (Invariant M-17).

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

- the identities this `MemoryContext` is bound to (per "Lifecycle and Invalidation" above): the
  `RunContext` (or its explicit absence) it was verified against, the consuming stage, the retrieval
  purpose, and the specific version of any upstream artifact that purpose depended on — this is what
  lets a later audit determine whether a given `MemoryContext` was still current at the time it was
  used, not merely what it contained;
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
  Requirement. (Violates M-11's Influence Taxonomy — a `lesson` is `PROCESS_ONLY` always.)
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
- **M-05** A memory's freshness for the current run is flagged at `MemoryContext` production time as
  a **mechanical, age/lifecycle-based fact** (e.g. time elapsed since the record was written or last
  updated), distinct from Brain's own `status` field — an `active` Brain record can still be flagged
  stale-by-age for this run's purposes (Case 9). Production never itself judges whether the
  underlying real-world claim the memory describes is still true; that is always a re-verification
  question for whichever stage actually establishes current facts (typically Research + Evidence
  Collection), never something production settles by inspecting the memory's content.
- **M-06** A memory's Brain-recorded `scope` is verified against `RunContext` before admission —
  never assumed compatible from a matching-looking slug alone, and never established by content
  inspection. A `global`-scope record is admitted on scope-tag equality alone (mechanical, like any
  other scope check); whether its content is genuinely project-agnostic enough to use for a
  particular semantic purpose is a judgment deferred to the consuming stage, never made by production
  (see "Cross-Project Scope Verification").
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
- **M-11** A memory's influence classification (`PROCESS_ONLY`, `DISCOVERY_ATTENTION`, or
  `SEMANTIC_PREMISE`) is a property of a specific *use*, not a fixed property of the memory record; a
  `lesson`/`playbook`-classified entry is `PROCESS_ONLY` under every use and has no path to
  `DISCOVERY_ATTENTION` or `SEMANTIC_PREMISE`. `DISCOVERY_ATTENTION` use must be additive and
  provenance-visible, and never itself establishes truth, eligibility, a Requirement, or a
  preference — reaching `SEMANTIC_PREMISE` always requires separately clearing the full
  corresponding epistemic or evidence gate.
- **M-12** No Brain memory record may become a direct `EvidenceBundle` entry; it may only motivate
  re-verification that independently satisfies all five of Principle 5's requirements — source,
  **version** (the exact current technology/product version the re-verification actually applies to,
  not merely inherited from the memory's own), verification date, confidence, and freshness — at the
  time of that verification, not at the time the memory was written. This invariant constrains Brain
  memory records specifically; it does not decide whether a future `EvidenceBundle` design may permit
  re-admitting one of its *own* prior, already-verified artifacts under a deterministic freshness
  rule — that is a separate, future decision this document leaves open (see "Memory and Evidence
  Boundary").
- **M-13** Brain's `scope` field is a necessary filter, never a sufficient stage-isolation or
  cross-project boundary by itself; `MemoryContext` production must independently verify project
  identity against `RunContext` (never against another Brain record's content, and never against the
  memory's own content) before admission.
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
- **M-16** A Brain `project` record may corroborate a `RunContext` identity already established
  independently of Brain; it may never establish that identity itself, and it is never consulted
  before `RunContext` exists to help decide what `RunContext` should be. With no `RunContext`, only
  `global`-scope Brain memory is eligible for retrieval at all.
- **M-17** A `MemoryContext` is bound, at production, to a specific `RunContext`, consuming stage,
  retrieval purpose, and upstream artifact version; if any bound upstream artifact is superseded, the
  `MemoryContext` produced against its prior version is no longer current and must not be reused —
  a fresh one, bound to the new version, is required if memory context is still needed. This
  supersession trigger is unconditional, never contingent on whether the new version "materially
  changes" anything — that judgment would itself be an unauthorized semantic act by production. A
  `MemoryContext` is also never reused across runs, even by a later run bound to an identical
  `RunContext`-or-absence and identical upstream version: every run's own authorized invocation
  produces its own fresh snapshot, recomputing each memory's freshness flag against that run's own
  retrieval time. The superseded or prior-run `MemoryContext` itself remains historical and immutable,
  never deleted or mutated in place.

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
