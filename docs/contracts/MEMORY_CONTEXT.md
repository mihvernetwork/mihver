# Contract: MemoryContext

Status: part of M0 `ADR-0004` (Memory Context Authority Boundary, Status: **Accepted** — see that
ADR's own "Acceptance Gate" for exactly what Acceptance did and did not authorize: dependency A
alone, not dependencies B/C/D).
This semantic contract remains implementation-independent — no serialization or field names are
defined here, mirroring [REQUIREMENT_SPEC](./REQUIREMENT_SPEC.md)'s relationship to its own schema.
A separate machine-readable representation now exists at
[schemas/m0/memory-context.schema.json](../../schemas/m0/memory-context.schema.json), with its
invariant-by-invariant enforcement mapping at
[MEMORY_CONTEXT_SCHEMA_MAPPING](./MEMORY_CONTEXT_SCHEMA_MAPPING.md). This semantic contract remains
authoritative for meaning; the schema and its mapping represent and enforce that meaning where
mechanically possible, and neither redefines or supersedes this document. **This document does not
itself authorize any stage to consume `MemoryContext`** — that authority belongs exclusively to
`M0_SCOPE.md`. Research Planning is, as of `M0_SCOPE.md`'s Dependency-A amendment, the first and
only stage so authorized, restricted to the `DISCOVERY_ATTENTION` influence tier — see "Stage
Consumption Authorization" below for exactly what is, and is not, authorized today.

## Purpose

`MemoryContext` is the sole, bounded artifact through which durable memory (MIHVER Brain,
`../mihver-brain`) may ever reach a pipeline stage. It exists to make one thing impossible by
construction: a stage silently reading raw, mutable, unscoped memory as if it were a declared input
of equal standing to `UserIdea`, `IntentSpec`, `RequirementSpec`, or `Evidence`.

`MemoryContext` is not a `Claim`. It is not `Evidence`. It is not part of `UserIdea`. It carries no
authority of its own — only a classified, provenance-preserving record of what was retrieved, from
where, when, and for what purpose. **`MemoryContext` itself never records whether an entry actually
mattered to a consuming artifact's output** — that fact is only knowable after consumption, and is
recorded solely in the *consuming artifact's own* provenance, never written back into, or presented as
part of, the frozen `MemoryContext` snapshot (see "Reproducibility" below for the full split). A stage that consumes
it must still separately earn any semantic effect that retrieved content has on that stage's own
output, through the same disciplined mechanisms (Inference Policy, Requirement-Level Inference,
Evidence sourcing) that already govern every other external input to the pipeline.

## Stage Consumption Authorization

Per Principle 3 (Structured Artifacts Between Stages) and `M0_SCOPE.md`'s stage table, a stage may
consume only its explicitly declared inputs. `M0_SCOPE.md` currently declares `MemoryContext` as an
input for exactly one stage: **Research Planning**, and only at the `DISCOVERY_ATTENTION` influence
tier — optional, additive, provenance-visible, non-authoritative, and never permitted to narrow,
skip, or replace `RequirementSpec`-derived research coverage. This document defines what
`MemoryContext` *would* mean and how it *would* have to be constrained if and when any *further*
stage's `M0_SCOPE.md` entry is amended to declare it. Until each such further amendment happens,
separately, with explicit human authorization, **every stage other than Research Planning (at
DISCOVERY_ATTENTION) may not consume `MemoryContext` at all, and no stage — Research Planning
included — may ever query MIHVER Brain directly.** This is not a placeholder rule pending
implementation; it is the hard boundary this whole document exists to protect. Dependencies B, C,
and D (citing a `MemoryContext` entry as an Inferred Claim premise, a Requirement-Level Inference
premise, or a memory-informed R-19 rationale, respectively) remain unavailable regardless of
Research Planning's own authorization — see `ADR-0004`'s "Acceptance Gate" for the precise
dependency boundaries.

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
  the identity of the specific consuming stage invoking it; and, where that purpose requires applying
  something already interpreted (see "Separating Admissibility from Interpretation" below), **the
  specific, already-computed semantic fact or verdict itself** — e.g. "`IntentSpec` Open Item/Conflict
  #N resolved topic T to mean V" — supplied *to* the producer as an explicit, discrete input, never
  re-derived by it. **Merely supplying an upstream artifact or its version identifier (e.g. "the
  current `IntentSpec` version") is not, by itself, a settled judgment and confers no authority to
  form one** — an artifact reference tells production *which version exists*, not *what any specific
  memory entry means in light of it*; only an explicit, already-stated fact about a specific question
  can be mechanically applied. Where no such explicit fact is supplied, production has no Category-B
  input at all and may only perform Category-A (mechanical) checks for that entry.
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
  `UserIdea` phrase semantically contradicts a memory — **unless the specific, already-computed
  verdict about that specific memory entry** has itself been supplied to production as an explicit
  input (in which case the producer may mechanically apply that literal, already-stated verdict,
  never form a new one of its own). **Merely supplying an upstream artifact or its version — the
  current `IntentSpec` version, say — is never sufficient by itself; an artifact reference is not a
  judgment, and production may never treat "an authoritative artifact was supplied" as license to read
  it and decide anything from it.** Also never allowed: Requirements; technology eligibility; Evidence
  truth; or architecture selection. Every one of these remains exclusively the authority of the stage
  that already owns it.

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
inspect scope and content, not merely read `type`, before assigning an authority class. **This
weak-prior status cuts both ways, and cuts across every row of the table below, not only the
`decision` row:** a record's stored type is a hint about where to look, never a guarantee of what the
record actually is. A record stored as `reference`, `incident`, `pattern`, or any other type may, on
inspection of its actual content, turn out to describe a historical user statement (a misfiling, not
a hypothetical — nothing in Brain's write path prevents it) — and when production's own content
inspection reveals this, the record is gated by "Historical User Provenance Gate" below exactly as a
correctly-filed `decision` record would be, regardless of which row its stored type would otherwise
place it in. Brain's `type` is never an epistemic shortcut past that gate; it is only ever a starting
point for production's own inspection.

| Brain type | Typical authority class (prior) | What production must actually verify |
|---|---|---|
| `project` | Durable project *description*, corroborating an already-established `RunContext` identity — **never itself the anchor establishing that identity** (see "Current-Run Scope Anchor" above). | Content is a description of the project itself, not a smuggled requirement; never consulted to determine what the current project *is*, only to enrich an identity `RunContext` already supplied. |
| `decision` | **Historical user statement/preference** (project-scoped, describing something a user said or chose) *or* prior project decision/outcome (describing MIHVER's own process). When the former, further gated by "Historical User Provenance Gate" below — reading the body only establishes *that* it describes a past user preference, never *how directly* it traces to the user's own words. | Which of the two this actually is — Brain does not distinguish them; production must read the body. |
| `lesson` | `PROCESS_ONLY` always (see "Influence Taxonomy" below). | Never carries content framed as a user-facing requirement; if it does, it is misfiled and excluded, not reclassified into a semantic use. |
| `incident` | `DISCOVERY_ATTENTION` by default — may motivate a research hint about a specific named technology. | Never admitted as an Evidence entry directly (see "Memory and Evidence Boundary"). |
| `pattern` | Prior architecture outcome; `DISCOVERY_ATTENTION` when shaping search. | May inform candidate search only; never bypasses Requirements/Evidence/Evaluation. |
| `playbook` | `PROCESS_ONLY` always. | Describes a process, not a user's system. |
| `reference` | Candidate technology/evidence knowledge. | Must clear the full Evidence-freshness gate before any semantic use — see "Memory and Evidence Boundary." |
| `inbox` | **Excluded from production entirely.** | Not a lower-priority class — genuinely not retrievable into any stage-facing `MemoryContext` until a human or Claude re-files it into a real type. |

**Every classification in the table above — including words like "always," "permanently," and
"only" — is conditioned on content inspection actually confirming the record matches that row's
typical class.** None of these words describes an unconditional, type-determined outcome that
survives contrary content. A `lesson`, `playbook`, `incident`, `pattern`, `reference`, or `project`
record whose actual body, on inspection, describes a historical user statement is **not** "misfiled
and excluded" (as an earlier, now-corrected reading of the `lesson` row implied) and is **not**
"always"/"permanently"/"only" whatever that row's typical class says — it is redirected to the
Historical User Provenance Gate below, exactly as a `decision`-type record making the same claim
would be (Case 23 in `MEMORY_CONTEXT_CASES.md` works this through concretely for a misfiled
`reference` record). Only `inbox` is a genuine, unconditional, type-determined exclusion — the one
row this override does not touch, since `inbox` exclusion happens on `type` alone, before content is
even inspected for classification purposes.

## Historical User Provenance Gate

Inspecting an admitted Brain record's body tells production **that** it describes a past user
preference or statement. It does not tell production **how directly** that description traces to the
user's own words. A Brain record reading "user prefers PostgreSQL" does not, by that content alone,
prove the user directly said so in those or equivalent terms — it may equally be an agent-authored
summary, paraphrase, or inference about the user's preference, written to Brain by a caller who never
quoted the user at all. Treating "the body says the user prefers X" as equivalent to "the user
directly stated a preference for X" is exactly the laundering risk this gate exists to close —
content-based classification (the previous section) tells production *what kind of claim* a record
makes; it cannot, by itself, tell production *how reliably grounded* that claim is in an actual
historical user utterance.

**This gate applies by what a record's content actually is, never by its stored Brain `type`.** Brain
`type` is a weak classification prior (per "Semantic Authority Classes" above) — it is never an
epistemic shortcut past this gate. A record stored as `reference`, `incident`, `pattern`, `project`, or
any other non-`inbox` type, that production's own content inspection reveals actually describes a
historical user statement, is gated exactly as a `decision`-type record would be: **any admitted
Brain record that production classifies as describing a historical user statement must pass the same
Category A/Category B test below, regardless of stored Brain type.** `inbox` remains excluded before
this question ever arises (per "What Qualifies as a MemoryContext Entry" above) — a record cannot be
misfiled *into* eligibility; `inbox` exclusion happens first, on `type` alone, and this gate only
applies to records that have already cleared that earlier bar.

Two categories, deliberately exhaustive — every admitted Brain record production classifies as
describing a historical user statement, of whatever stored type, falls into exactly one:

- **A. Direct historical user statement.** Inspectably traceable, via the record's own recorded
  provenance, to an original historical user-authored source — a specific past `UserIdea` version/
  turn, or an equivalent immutable source artifact — such that a later auditor could follow the
  citation back to the actual originating user utterance, not merely trust the record's own
  characterization of itself. **An apparent citation string is not, by itself, sufficient**: the
  referenced historical source must actually be inspectable and resolvable enough for an auditor to
  verify the originating user statement it names — a citation to a turn/version that cannot actually
  be located, resolved, or checked (a dangling reference, a vague "the user said this once," or a
  citation to an artifact no longer available to inspect) is not Category A merely because it has the
  surface shape of a citation. The test is whether the citation actually resolves to something
  checkable, not whether the record contains citation-shaped text. Only Category A entries may ever
  be eligible to serve as a direct historical-memory premise for the future Inferred-Claim path
  ("Historical User Memory Rule" above), once its required amendment exists.
- **B. Derived or unverified user memory.** Says something about the user's past preference or
  intent, but lacks that inspectable, resolvable direct-user-source linkage — including every record
  whose body merely reads as if it quotes or paraphrases the user, with no traceable citation to the
  originating artifact, *and* every record whose citation is present but unresolvable/uninspectable.
  This is the **default** classification for any admitted Brain record read as a historical user
  statement, of whatever stored type, absent the inspectable and resolvable linkage Category A
  requires.

**Category B is not a lesser-confidence version of Category A — it is a different authority
ceiling.** A Category B entry may at most reach `DISCOVERY_ATTENTION`: it may shape a candidate
clarification question, or help retrieval find what to look for — exactly as any other
`DISCOVERY_ATTENTION` use must be, additive and provenance-visible (see "Influence Taxonomy" below).
It may never be cited as the premise of an Inferred Claim, or otherwise presented, labeled, or relied
upon as though its historical directness to the user were established — no accumulation of
`DISCOVERY_ATTENTION` uses, confidence, repetition (M-07), or apparent plausibility promotes a
Category B entry into Category A. Only an actual, inspectable citation to the originating artifact
does that, and production must never fabricate, infer, or assume one that the record does not
actually carry.

**Honest dependency, not invented here.** Brain's actual schema (`provenance.source`:
`manual`/`import`/`cli`, `provenance.author`) has **no field, on any of its eight types, that links a
record's body to a specific historical `UserIdea` version or turn.** Nothing in this document
proposes adding one — that would be a `../mihver-brain` schema change, out of scope for this task.
Under Brain's schema as it actually exists today, the *only* way any admitted record — whatever its
stored type — could satisfy Category A is by the record's own body containing an explicit,
self-declared citation to the originating artifact (e.g. quoting a specific `UserIdea` version/turn
verbatim, with that citation itself inspectable *and resolvable* in the record) — a weaker,
self-reported signal than a schema-enforced link would be, but still the honest maximum Brain's
current schema supports, and still meaningfully stronger than an undifferentiated paraphrase with no
citation at all. **This is recorded here as a named future Brain/integration dependency**: a schema or
convention change to `../mihver-brain` (e.g. a dedicated field capturing the originating `UserIdea`
version/turn at write time) would let Category A be established more reliably than a self-declared
citation can; until and unless such a change is separately proposed and made, most records read as
historical user statements, of whatever stored type, will, honestly, default to Category B, and the
Inferred-Claim-premise path will have correspondingly few eligible entries to exercise. That is the
correct, honest consequence of not having schema-level provenance today — not a reason to relax the
gate.

Historical provenance must remain visible end-to-end: a Claim's provenance that cites a Category A
`MemoryContext` entry as its premise must itself state that the entry is Category A and name the
originating artifact it was inspectably traced to — never merely "cites a memory," which would erase
exactly the distinction this gate exists to preserve (Invariant M-18).

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
   Taxonomy tier (`PROCESS_ONLY`/`DISCOVERY_ATTENTION`/`DECISION_OPTION`/`SEMANTIC_PREMISE`, see
   "Influence Taxonomy" below), assigned at production, never left to the consuming stage's own
   discretion.

## Classification Fail-Closed Rule

Assigning a semantic authority class (axis 3) or an Influence Taxonomy tier (axis 7) is not always a
mechanical lookup — Brain's `type` is a weak prior (per "Semantic Authority Classes" above),
production must read body content to distinguish a historical user statement from a process decision,
and the Historical User Provenance Gate requires judging whether a citation is genuinely inspectable.
None of these are guaranteed to have a single, deterministic answer for every record. Per Principle 6
(Deterministic Where Possible): "any check that is not deterministic must declare itself as heuristic
(model-assisted) or human-reviewed" — a classification production performs by reading and
interpreting free-text content, rather than by a mechanical field lookup, is exactly this kind of
non-deterministic check, and must be treated accordingly. Per Principle 7 (LLMs Are Reasoners, Not
Authorities): a heuristic classifier producing a label is not, by virtue of having produced one, an
authoritative determination — its output remains "an input to a stage, subject to the same validation
... requirements as any other proposal," never "a final answer by virtue of being model-generated."

For every classification `MemoryContext` production performs, it conceptually preserves (no schema
fields fixed here, per this document's own deferral pattern):

- **Classification basis** — what in the record (which field, or which specific content) the
  classification rests on;
- **Classification method** — whether this specific determination was reached deterministically (a
  mechanical field check, e.g. `type == "lesson"`) or heuristically/model-assisted (reading and
  interpreting free-text body content, e.g. distinguishing a historical user statement from a process
  decision, or judging whether a citation is genuinely inspectable);
- **Ambiguity/uncertainty**, where present — that the determination was not clean, and what the
  competing readings were.

**The fail-closed rule.** When a classification is ambiguous — when production cannot reach a
classification with the confidence its own "Allowed to decide" authority requires (see "MemoryContext
Producer: Role and Authority") — production must never resolve that ambiguity upward. Specifically,
and without exception:

- Ambiguity in classification must never promote an entry to `SEMANTIC_PREMISE`, nor to
  `DECISION_OPTION`. `SEMANTIC_PREMISE` is reached only by separately clearing a full epistemic or
  evidence gate (Historical User Memory Rule, Memory and Evidence Boundary); `DECISION_OPTION`
  requires the consuming stage to already, independently own the specific decision the memory would
  inform (R-19's own eligibility test, for the currently-named instance) — an ambiguous
  production-time classification can never substitute for, or shortcut, either determination.
- Retrieval relevance must never resolve classification ambiguity (extends M-01 — a high FTS5 rank is
  not evidence the record is what it appears to be).
- Brain's own `confidence` field must never resolve classification ambiguity (extends M-02 — the
  memory author's own confidence that the record is durable/useful says nothing about which authority
  class or provenance category production should assign it).
- When no classification can be defensibly assigned at the tier a particular use would require,
  production must choose the **lowest defensible influence tier** consistent with what it can
  actually establish — ordered `PROCESS_ONLY` < `DISCOVERY_ATTENTION` < `DECISION_OPTION` <
  `SEMANTIC_PREMISE` by how directly the tier can affect an artifact's actual content — and if even
  the lowest content-bearing tier (`DISCOVERY_ATTENTION`) cannot be defensibly assigned (e.g. the
  record's own type or scope is itself unclear), production must **exclude the entry from
  `MemoryContext` entirely**, recording why (M-14), rather than admit it under a default or
  best-guess classification.

**The exact fallback rule, derived:** production defaults toward *less* authority, never more, at
every point ambiguity appears — never "admit now, let a downstream stage catch the mistake," since a
downstream stage does not independently re-derive production's classification; it consumes what
`MemoryContext` states (Invariant M-19).

## Historical User Memory Rule

A statement genuinely User-Provided in a past run carries no automatic standing as a User-Provided
Claim in a new `IntentSpec`. `IntentSpec`'s own definition of User-Provided is "traceable directly to
something the user said in a specific `UserIdea` version" — a historical `MemoryContext` entry is
traceable to a *different* `UserIdea`, from a different run, and therefore fails that test by
definition, regardless of how directly it matches the current subject matter.

A historical user statement, once admitted into `MemoryContext`, may be used in exactly two ways —
never a third — by an authorized, memory-consuming Intent Parsing pass. **The first way is available
only to entries classified Category A (direct) under the "Historical User Provenance Gate" above; a
Category B (derived/unverified) entry is categorically restricted to the second way only** — this is
not a confidence-based restriction to be weighed case by case, it is a hard eligibility gate:

- **As a stated, cited premise for a current-run Inferred Claim** — **Category A only.** Carrying its own
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
  additional `INTENT_SPEC.md` amendment (dependency B, per `ADR-0004`'s "Acceptance Gate")** — the
  resulting Claim is an ordinary User-Provided Claim from the current `UserIdea`, produced exactly the
  way Intent Parsing already produces one — memory only shaped which question got asked. It still
  requires dependency A (Intent Parsing's own `M0_SCOPE.md` authorization to consume `MemoryContext`
  at all) like every other use; "no amendment beyond A" is what is meant here, never "no authorization
  needed at all." **Available to both Category A and Category B entries** — a Category B entry's lack of
  inspectable direct-user provenance does not disqualify it from motivating a question (the question
  itself is answered by the current user, not by the memory), it only disqualifies it from the first
  path above.

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

**Provenance requirement for a memory-informed R-19 default.** R-09 already requires any R-19-eligible
default Requirement Derivation fills to be marked **Requirement-Derivation-introduced**, with its own
stated rationale, distinct from any `IntentSpec`-recorded provenance. Where a `MemoryContext` entry
informed the choice of value, that provenance must additionally, explicitly cite the entry — labeled
as a **memory-informed rationale**, never presented as though it traces to an `IntentSpec` Claim or
User-Provided standing of any kind. This is the same discipline R-10/R-22 already apply to a
Requirement-Level Inference's premise citation, applied to R-09's simpler default-filling mechanism:
the memory motivates *which value* Requirement Derivation chose to fill with, exactly as it may
motivate *which clarifying question* Intent Parsing asks (per "Historical User Memory Rule" above) —
in neither case does the memory itself acquire `IntentSpec`/User-Provided standing merely because it
informed a downstream choice.

**This is `DECISION_OPTION` influence, not `DISCOVERY_ATTENTION`** (see "Influence Taxonomy" below,
corrected during a later closure round from an earlier draft that mislabeled it): the memory does not
merely expand a set of candidates for further, independent downstream screening — it proposes a
specific *value*, and if Requirement Derivation adopts it, that value becomes the Requirement's actual
content immediately, with no further independent gate standing between the suggestion and the compiled
Requirement. The memory supplies **zero independent authority** for that value either way: R-19's own
eligibility test, and Requirement Derivation's own judgment of whether the specific value is a
defensible choice, are what actually authorize it — the memory only narrows or proposes within a
decision Requirement Derivation already, independently owns. Requirement Derivation must be able to
justify the final value entirely under its own R-09/R-19 authority, without treating the memory's
suggestion as though it required or authorized that choice; it retains full authority to modify,
reject, or ignore the suggested value, or to leave the Unknown unresolved and carry it forward instead.
An entry of either Historical User Provenance Gate category may supply this kind of technical/
measurement suggestion in principle, but in practice a genuine historical *user statement* almost never
qualifies here at all: **R-19 categorically excludes any value that would add, remove, or narrow a
user-facing actor, target, capability, output, condition, permission, prohibition, obligation, or
preference** — exactly the content a historical user statement typically carries — so a memory
proposing an R-19-eligible technical/measurement value is typically a `pattern`, `incident`,
`reference`, or process-`decision` entry, not a historical-user-statement Category A/B entry (Case 24
works through both the eligible and the excluded case explicitly). Nothing about R-19 default-filling
ever elevates a memory entry to `SEMANTIC_PREMISE` standing, since the default's own authority comes
from Requirement Derivation's own R-09/R-19 mechanism, never from the memory. This provenance
requirement is itself part of the `REQUIREMENT_SPEC.md` amendment "Foundation Impact Analysis"
identifies as required (see `ADR-0004`) — not decided in the abstract here, but named precisely so
that future amendment does not under-scope itself the way an earlier Foundation Impact Analysis draft
did for the `INTENT_SPEC.md`/`REQUIREMENT_SPEC.md` Inference-premise question.

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

## Historical Force Is Not Current Force

A historical user statement's normative force (obligation, prohibition, permission, or preference)
describes **that statement's own historical standing**, at the past point in time and context in
which it was made. It is never mechanically copied into the force of a current-run Inferred Claim
that cites it as a premise.

This matters precisely because of how `REQUIREMENT_SPEC.md`'s "Force → Requirement Strength Mapping"
already works: strength maps from a Claim's own force alone, **never softened by confidence** — an
obligation-force Claim compiles to a hard **MUST**-level Requirement even at low derivation
confidence, and a prohibition-force Claim compiles to **MUST NOT** the same way. If a current-run
Inferred Claim's force were silently inherited from a historical statement's own force merely because
the statement is cited as its premise, a stale historical prohibition or obligation could harden into
a permanent current hard constraint through ordinary, uneventful downstream compilation — with no
confidence-based softening anywhere in the chain to catch it. This is exactly the failure this rule
forecloses: **old normative wording must not accidentally manufacture a current hard constraint.**

Instead, a current-run Inferred Claim's own force is an independent property of *that Inference* —
Intent Parsing must explicitly derive and state a reasoning basis for whichever force it assigns,
exactly as Inference Policy already requires for any other derived property (confidence, provisional/
reversible marking). If the Inference's own reasoning concludes the same force level the historical
statement carried still applies now, that conclusion must be an explicit, stated step — not a silent
default — and it remains fully subject to the ordinary Inferred-Claim discipline: provisional,
reversible, and never elevated past what Inference Policy's "premises genuinely support the
conclusion" test can actually bear. Explicitly, per ADR-0003's own force model: a current-run
Inferred **obligation** compiles to **MUST**; a current-run Inferred **prohibition** compiles to
**MUST NOT** — precisely because force compiles hard regardless of confidence, assigning either
force to a current Inferred Claim is a consequential, independently-reasoned act, never a
pass-through of whatever force the historical statement happened to carry.

**Force provenance is recorded separately from historical-content provenance.** A current Inferred
Claim's provenance must show both: (a) which historical `MemoryContext` entry (Category A, per
"Historical User Provenance Gate") supplied the *content* of the premise, and (b) the independent
reasoning basis for the Claim's *own* force — these are two distinct provenance facts, and collapsing
them into "cites memory entry X" alone loses exactly the information an auditor would need to tell
whether the current force was actually reasoned about or merely inherited (Invariant M-20).

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
  may apply such a judgment only when it is handed the **specific, already-computed verdict itself**
  as an explicit input (e.g. "`IntentSpec` Open Item/Conflict #N already resolved topic T to mean
  Y") — never merely a reference to an upstream artifact or its version (e.g. "the current
  `IntentSpec` version"), which is not a judgment and confers no license for production to read that
  artifact and decide anything from it. Supplying an authoritative artifact is not the same as
  supplying an already-made contradiction judgment about a *specific* memory entry — production may
  mechanically apply an already-settled, explicitly-stated verdict; it may never form a new one, and it
  may never treat "an authoritative artifact exists and was supplied" as itself sufficient grounds to
  infer that any particular memory entry contradicts it.

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

## Influence Taxonomy: Process-Only, Discovery/Attention, Decision Option, Semantic Premise

An earlier draft used a two-way procedural/semantic split, and called both "review decomposition"
and "expanding what Research Planning searches for" equally "procedural" — but the second one can
change `ResearchPlan`'s or `ArchitectureCandidate`'s actual search space and content, which the first
never can. Collapsing these two, materially different effects into one label was itself a defect,
corrected here into four properties of a specific *use* of a memory entry, not fixed properties of
the entry itself. **A fourth tier, `DECISION_OPTION`, was added during a later closure round** —
re-deriving the taxonomy found that a memory-informed R-19 working default (see "No Assumed-Origin
Path for Memory" below) does not actually fit `DISCOVERY_ATTENTION`'s own invariant: `DISCOVERY_ATTENTION`
is additive-only and never itself establishes a Requirement's content, but an R-19 default's *specific
chosen value* genuinely does become Requirement content, immediately, with no further independent
screening step standing between the memory's suggestion and the compiled Requirement. Forcing that
case into `DISCOVERY_ATTENTION` would have required either silently weakening
`DISCOVERY_ATTENTION`'s additive-only invariant (rejected — no rigorous re-derivation justified it) or
misclassifying a genuinely different kind of influence as though it were the same as search-space
expansion. `DECISION_OPTION` names that different kind precisely, without touching
`DISCOVERY_ATTENTION`'s own definition:

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
- **`DECISION_OPTION` influence** proposes a candidate *value* within a decision a stage **already,
  independently owns and is already authorized to make** — it never expands what the stage is
  *allowed* to decide (that boundary is fixed entirely by the stage's own pre-existing authority,
  e.g. R-19's own eligibility test, untouched by the memory's presence), and it supplies **zero
  independent authority** for whichever value is ultimately chosen: the stage's own existing
  decision-making authority is what settles the matter, never the memory. This is structurally
  different from `DISCOVERY_ATTENTION`, not merely a relabeling of it — the distinction is not that
  `DISCOVERY_ATTENTION` has zero content effect before some later gate (it does not: it may directly
  alter `ResearchPlan`'s or `TechnologyCandidateSet`'s own intermediate content the moment a stage
  acts on it, additively). The real distinction is what the tier can ever **establish**:
  `DISCOVERY_ATTENTION` proposes candidates that still require a **further, independent mechanism**
  (Evidence-gate clearance, eligibility screening, Evaluation's scoring) to establish truth,
  eligibility, or final selection — a `DISCOVERY_ATTENTION`-shaped candidate is never itself the
  settled answer to anything. `DECISION_OPTION`'s adoption, by contrast, **is** the immediate
  establishment of the Requirement's actual content, in the very same step, under the consuming
  stage's own pre-existing authority — there is no further mechanism still to clear afterward. Two
  conditions apply without exception:
  it must be **provenance-visible** (the stage's own record of its choice must be able to cite the
  memory as part of its stated rationale) and **non-obligating** (the consuming stage must be able to
  justify the final choice entirely under its own pre-existing authority, without the memory's
  suggestion being treated as though it required or authorized that choice — the stage could equally
  have chosen a different value, or declined to fill the decision at all, and the memory's absence
  would not have changed what the stage was allowed to decide in the first place). Reaching
  `SEMANTIC_PREMISE` is categorically unavailable to a `DECISION_OPTION` use: this tier never
  establishes truth, eligibility, a Requirement's own scope or boundary, or user intent — it only ever
  narrows a choice within a scope the consuming stage's own, already-existing authority had already
  fixed. **The only currently-named instance of this tier is a memory-informed R-19-eligible working
  default at Requirement Derivation** (see "No Assumed-Origin Path for Memory" below); this is not a
  general license to invent new memory-authorized decision points elsewhere in the pipeline —
  extending `DECISION_OPTION` to any other stage/decision requires the same rigorous re-derivation
  this tier itself received, not an assumption that it now applies wherever convenient.
- **`SEMANTIC_PREMISE` influence** is the capacity to directly support a `Claim`, `Requirement`, or
  equivalent pipeline-artifact content. This is only ever reached by separately clearing the full
  corresponding epistemic or evidence gate for where it is used (the Historical User Memory Rule for
  Claims; "Memory and Evidence Boundary" for Evidence) — a memory entry never arrives at this level
  by mere retrieval or by accumulating enough `DISCOVERY_ATTENTION` uses. **These two paths are not
  symmetric, and must not be read as though they were:**
  - A Category A historical user statement (per "Historical User Provenance Gate") reaches
    `SEMANTIC_PREMISE` **directly** — the `MemoryContext` entry itself is cited, by reference, as an
    Inferred Claim's premise (pending the Inference-premise path's own required amendment). The entry
    remains a `MemoryContext` entry; it does not become a `Claim`, but it is directly relied upon.
  - A `pattern`/`incident`/`reference` entry **never itself reaches `SEMANTIC_PREMISE` at all, under
    any amount of re-verification.** "Memory is never Evidence" (see "Memory and Evidence Boundary")
    is an **identity boundary**, not a freshness gate that a sufficiently-fresh or well-re-verified
    memory eventually clears. What reaches `SEMANTIC_PREMISE` is an entirely separate, newly-produced
    `EvidenceBundle`/`TechnologyCandidateSet` entry, independently re-verified by Research + Evidence
    Collection — the *originating memory entry* is never itself elevated, upgraded, promoted, or
    treated as having "become" that new artifact. Its own classification remains `DISCOVERY_ATTENTION`
    permanently; only its role as the search lead that prompted the new artifact's creation is ever
    recorded, in the new artifact's own provenance, never as the new artifact's basis.

**Reclassification, corrected against this four-way model:**

| Memory kind | Typical classification | Notes |
|---|---|---|
| `lesson`, `playbook` (engineering lessons, process guidance) | `PROCESS_ONLY` always | No path to any other category, under any use. |
| `pattern`, `incident` (prior architecture outcomes/failures) | `DISCOVERY_ATTENTION` when shaping search — **permanently; never itself reaches `SEMANTIC_PREMISE`** | A new, independently re-verified `EvidenceBundle`/`TechnologyCandidateSet` entry may reach `SEMANTIC_PREMISE`; the originating memory entry never does, regardless of re-verification (identity boundary, not a freshness gate). |
| `reference` (cached technology knowledge) | `DISCOVERY_ATTENTION` as a research lead — **permanently; never itself reaches `SEMANTIC_PREMISE`** | Same identity boundary as `pattern`/`incident`. See "Memory and Evidence Boundary." |
| Any classified type (typically `pattern`, `incident`, `reference`, or a process-`decision`; **never** a historical-user-statement Category A/B entry — see below) proposing a candidate value for an R-19-eligible technical/measurement default | `DECISION_OPTION` at Requirement Derivation, once separately authorized — **never** `SEMANTIC_PREMISE`, since the default's authority always comes from Requirement Derivation's own R-09/R-19 mechanism, never the memory | Never eligible for an intent-level, want-shaping value — R-19 itself excludes those regardless of what memory suggests (see Case 24's contrast). |
| Any admitted record (whatever its stored Brain type) read as a historical user statement, **Category A (direct)** | `DISCOVERY_ATTENTION` when shaping a current-run clarification question; `SEMANTIC_PREMISE` only as a cited Inference premise (pending required amendment) | Never `SEMANTIC_PREMISE` merely because the historical statement is confident or repeated (M-07); its own historical force is never mechanically copied into the current Inferred Claim's force either (see "Historical Force Is Not Current Force"). Category assignment depends on inspectable, resolvable traceability, never on stored `type`. |
| Any admitted record (whatever its stored Brain type) read as a historical user statement, **Category B (derived/unverified)** | `DISCOVERY_ATTENTION` only, when shaping a current-run clarification question — **never** `SEMANTIC_PREMISE`, under any circumstance, at any confidence or repetition level | Lacks the inspectable and resolvable direct-user provenance "Historical User Provenance Gate" requires for Inference-premise eligibility; no accumulation of uses, confidence, or stored `type` promotes it to Category A. |

A `pattern` memory describing a past message-queue architecture illustrates the full chain: now that
Research Planning is authorized to consume `MemoryContext` (`M0_SCOPE.md`), it may shape its search
strategy as `DISCOVERY_ATTENTION` — additive,
provenance-visible — while **itself remaining permanently `DISCOVERY_ATTENTION`**, never advancing any
further. Research + Evidence Collection may use that lead to independently produce a wholly new
`EvidenceBundle` entry, and, after Technology Candidate Identification's ordinary eligibility
screening, a separately-produced `TechnologyCandidateSet`/`ArchitectureCandidate` entry may reach
`SEMANTIC_PREMISE` standing — the originating memory is never what reaches it. It never influences
`RequirementSpec` at any tier either way: Requirement Derivation's only declared input is `IntentSpec`
(`M0_SCOPE.md`), so no amount of Evidence-gate clearance gives a technology-knowledge memory a path
into `RequirementSpec`'s content (Invariant M-11).

**Worked precedent, recorded honestly:** the `cross-axis-invariants-require-explicit-review-
contracts` engineering lesson, retrieved and applied during M0 Step 03A's later review rounds, is
`PROCESS_ONLY` — it changed *how* Claude reviewed `REQUIREMENT_SPEC.md` (added pairwise-interaction
scrutiny) and never touched what the user's actual Requirements were. That is the shape every future
`lesson`/`playbook` memory must be held to, and the shape the four-tier taxonomy exists to keep
possible without collapsing it together with the genuinely different `DISCOVERY_ATTENTION` tier that
*can* touch artifact content.

## Memory and Evidence Boundary

`EvidenceBundle` itself is not designed by this document (`ADR-0001` explicitly defers it). This
section fixes only the boundary a future `EvidenceBundle` design must respect:

| Path | Allowed? | Condition |
|---|---|---|
| memory → search/research hint (`DISCOVERY_ATTENTION`) | Allowed — Research Planning is authorized to consume `MemoryContext`, `DISCOVERY_ATTENTION` tier only (`M0_SCOPE.md`) | Informs Research Planning's own query strategy; must be *additive* (expanding what gets checked), never *substitutive* (narrowing or skipping requirement-derived research coverage); never appears directly as `RequirementSpec` or `ArchitectureCandidate` content. |
| memory → candidate evidence requiring freshness/source verification (`DISCOVERY_ATTENTION`; the memory itself never advances beyond this tier — see "Identity Boundary" below) | Allowed, gated | Hands Research + Evidence Collection a lead to independently re-source, re-**version** (identify the exact current technology/product version the re-verification actually applies to — Principle 5 names version as its own, distinct required property, not implied by a fresh date), re-date, and re-confidence per Principle 5, producing a wholly new artifact that alone may reach `SEMANTIC_PREMISE` — the cached *memory record* is never itself the citation, and never itself becomes that new artifact. |
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

### Identity Boundary, Not Merely a Freshness Gate

"Memory is never Evidence" is stated above as a freshness/sourcing requirement (a memory record
cannot supply a current verification date). It is also, independently, an **identity boundary**: no
amount of re-verification, however thorough, causes the *originating memory entry itself* to become,
graduate into, or be treated as an `EvidenceBundle`/`TechnologyCandidateSet` entry. When Research +
Evidence Collection independently re-verifies a technology lead a memory prompted, the result is a
**wholly new, separately-produced artifact** — its own provenance, its own verification date/version/
source/confidence, entirely of Research + Evidence Collection's own making. The memory entry that
prompted the search is cited in that new artifact's provenance as *why the search happened*, never as
the new artifact's basis, and the memory entry's own `MemoryContext` record is never edited, upgraded,
or reclassified to reflect that a new artifact now exists downstream of it (per "Reproducibility" —
the frozen `MemoryContext` snapshot is never mutated after the fact for any reason). A memory entry's
Influence Taxonomy tier for this purpose is, and remains, `DISCOVERY_ATTENTION` forever — there is no
tier transition, only a new artifact's independent creation.

This is deliberately asymmetric with the Historical User Memory Rule's Category A path, where the
`MemoryContext` entry itself, once the required amendment exists, may be **directly** cited as an
Inferred Claim's premise — no new, separately-produced artifact stands between the entry and the
Claim there. The asymmetry is intentional, not an oversight: an Inferred Claim's own epistemic
machinery (derivation confidence, provisional/reversible marking, explicit premise citation) already
disciplines direct citation of an external premise, exactly as it disciplines any other Inference: no
analogous per-use, freshness-checked re-derivation step exists or is needed for a historical
statement the way it structurally must for a technology capability claim (Principle 5's freshness
requirement is specific to technology/Evidence claims, not to what a user once said).

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
- the authority classification assigned at production (not re-derivable from Brain alone), together
  with its classification basis, its classification method (deterministic or heuristic/model-assisted,
  per Principle 6), and any classification ambiguity encountered — all genuinely production-time
  facts, per "Classification Fail-Closed Rule";
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
  document's "Stage Consumption Authorization.")
- **Direct-provenance fabrication**: treating any admitted record's body reading like a user quote as
  proof the user directly said it, with no inspectable and resolvable citation to an originating
  artifact — including a record stored under a non-`decision` type that happens to describe a
  historical user statement, where the stored `type` is mistaken for an epistemic shortcut past the
  gate. (Violates M-18's Category A/B gate.)
- **Ambiguity promotion**: admitting an entry at `SEMANTIC_PREMISE`, or resolving a classification
  ambiguity using retrieval relevance or Brain's own `confidence`, when production cannot defensibly
  classify the entry. (Violates M-19.)
- **Memory-as-Evidence identity violation**: treating a `pattern`/`incident`/`reference` entry as
  itself having "become" an `EvidenceBundle`/`TechnologyCandidateSet` entry after re-verification,
  rather than recognizing the new artifact as wholly separate. (Violates M-11/M-12's identity
  boundary.)
- **Force inheritance**: silently assigning a current Inferred Claim the same obligation/prohibition
  force a historical statement carried, with no independent current-run reasoning stated. (Violates
  M-20.)

## Deterministic Invariants

- **M-01** Retrieval relevance is never read as truth or authority; it is a query-time ranking
  signal, not a stored property of the memory record, and never substitutes for a semantic authority
  classification.
- **M-02** A Brain memory's author-supplied `confidence` is never copied into, or presented as,
  MIHVER's own Inference-derivation confidence or Evidence confidence — those are computed
  independently, at the point the memory actually becomes a premise or a candidate lead.
- **M-03** A historical user statement never becomes a current-run User-Provided Claim merely
  because the user originally said it, however directly it matches or however recently it was
  stated. **Only a Category A (direct) entry** (M-18) may become a cited premise for a current-run
  Inferred Claim (pending the `SEMANTIC_AMENDMENT_REQUIRED` change this requires, per `ADR-0004`);
  **a Category B (derived/unverified) entry may never serve as such a premise, at any confidence or
  repetition level.** Either category may serve as informational input to a clarification question
  whose current answer (if given) is what becomes User-Provided. **Neither category may ever become
  an Assumed Claim under any Decision Impact level** — Assumption Policy restricts Assumptions to
  narrowly interpretive gaps, never operational defaults, and a historical preference is the latter,
  not the former.
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
- **M-07** Repetition, paraphrase, or multi-pass agreement across multiple past memories, projects,
  or runs never **by itself** increases a historical statement's authority, standing, or the
  `derivation_confidence` of any Inference citing it — extending I-16's own "not by itself" wording to
  the memory axis exactly as literally as I-16 states it, not strengthened into a broader claim I-16
  does not make. This invariant does **not** freeze the position that repetition can never be part of
  any confidence reasoning under any circumstance whatsoever: a genuinely independent additional
  signal (a materially different source, context, or corroborating fact — not merely a duplicate or
  correlated record of the same original statement) may contribute to a confidence assessment, but
  only via its **own, separately-stated reasoning basis and provenance** — never merely by virtue of
  being an additional count of similar-sounding memories. The discipline this invariant actually
  enforces: (a) repetition or count alone, with no further reasoning, never increases authority or
  confidence; (b) repetition never promotes an item's origin (a repeated Inferred statement never
  becomes User-Provided merely by recurring); (c) duplicate or correlated memories — several records
  that all trace back to the same original historical statement, restated or paraphrased — must never
  be counted as though they were independent corroboration of each other, since they are not
  independent evidence at all, merely the same fact recorded more than once.
- **M-08** Memory alone never closes a HIGH or CRITICAL Decision Impact item; resolution requires a
  new Intent Parsing pass grounded in the current `UserIdea`. Memory may inform what clarifying
  question is asked; it never substitutes for asking it or for the current user's answer.
- **M-09** A memory contradicting current-run authoritative input is never recorded as an
  `IntentSpec` Conflict — `IntentSpec`'s Conflict machinery is defined over Claims, and a
  `MemoryContext` entry, never having been elevated to Claim status, is not one. Production itself
  never *detects* this contradiction — it has no authority to interpret whether a memory's content
  conflicts with current-run meaning (see "Separating Admissibility from Interpretation"). The only
  way a contradiction is reflected within `MemoryContext`'s own record at production time is if the
  consuming stage's own, already-computed verdict about that *specific* entry was supplied to
  production as an explicit input — never merely because an `IntentSpec`/`UserIdea` artifact or
  version was supplied, which is not itself a verdict and licenses no inference. In the ordinary
  case, the contradiction is discovered later, by a stage consuming the entry, and is recorded
  entirely within that consuming artifact's own provenance, never by mutating the already-frozen
  `MemoryContext` snapshot (see "Reproducibility").
- **M-10** Memory contradiction is never an independent blocking mechanism; whether it triggers
  clarification depends entirely on the contradicted item's own, ordinarily-computed Decision
  Impact — never on the fact of contradiction alone.
- **M-11** A memory's influence classification (`PROCESS_ONLY`, `DISCOVERY_ATTENTION`,
  `DECISION_OPTION`, or `SEMANTIC_PREMISE`) is a property of a specific *use*, not a fixed property of
  the memory record; a `lesson`/`playbook`-classified entry is `PROCESS_ONLY` under every use and has
  no path to any other tier. `DISCOVERY_ATTENTION` use must be additive and provenance-visible, and
  never itself establishes truth, eligibility, a Requirement, or a preference; it always leaves a
  further, independent downstream gate (Evidence sourcing, eligibility screening, Evaluation) between
  itself and any actual content effect. `DECISION_OPTION` use (M-21) supplies zero independent
  authority for the value it proposes and never expands what the consuming stage was already,
  independently authorized to decide. Reaching `SEMANTIC_PREMISE` always requires separately clearing
  the full corresponding epistemic or evidence gate — and for `pattern`/`incident`/`reference` entries
  specifically, that gate is never cleared by the entry itself; only a wholly new, independently-
  produced `EvidenceBundle`/`TechnologyCandidateSet` artifact reaches `SEMANTIC_PREMISE` (see "Identity
  Boundary, Not Merely a Freshness Gate"). The Historical User Memory Rule's Category A path is the
  sole exception where the `MemoryContext` entry itself, not a separately-produced artifact, is what
  reaches `SEMANTIC_PREMISE` standing (as a directly-cited Inference premise).
- **M-12** No Brain memory record may become a direct `EvidenceBundle` entry, under any circumstance
  or amount of re-verification — this is an **identity boundary**, not merely an insufficient-
  freshness defect a well-verified memory could eventually clear. A memory record may only motivate
  re-verification that independently produces a **wholly new, separately-provenanced** artifact
  satisfying all five of Principle 5's requirements — source, **version** (the exact current
  technology/product version the re-verification actually applies to, not merely inherited from the
  memory's own), verification date, confidence, and freshness — at the time of that verification, not
  at the time the memory was written; the originating memory entry itself is never reclassified,
  upgraded, or treated as having become that new artifact. This invariant constrains Brain memory
  records specifically; it does not decide whether a future `EvidenceBundle` design may permit
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
  assigned authority classification (together with its basis, its deterministic-or-heuristic method,
  and any classification ambiguity encountered — M-19) and freshness judgment, why each was admitted
  or excluded, and which stage was authorized to use it. Whether an entry actually influenced a
  consuming artifact's
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
- **M-18** **Any admitted Brain record that production classifies as describing a historical user
  statement is Category A (direct) only when inspectably traceable, via its own recorded provenance,
  to an original historical user-authored source — regardless of the record's stored Brain `type`.**
  Brain `type` is a weak classification prior only, never an epistemic shortcut past this gate: a
  record misfiled under a type other than `decision` (e.g. `reference`, `incident`, `pattern`) that
  production's own inspection reveals actually describes a historical user statement is gated
  identically to a correctly-filed `decision` record. An apparent citation is not sufficient by
  itself — the referenced historical source must actually be inspectable and resolvable enough for an
  auditor to verify the originating statement; a dangling, vague, or unresolvable citation does not
  satisfy Category A merely by having citation-shaped text. Absent that inspectable and resolvable
  linkage, the record is Category B (derived/unverified) by default. Only Category A may ever be cited
  as the premise of a current-run Inferred Claim (pending the Inference-premise path's own required
  amendment); Category B is restricted to `DISCOVERY_ATTENTION` use (shaping a clarification question,
  informing retrieval) under every circumstance, regardless of confidence, repetition, or apparent
  plausibility. `inbox`-type records are excluded before this question is ever reached (per "What
  Qualifies as a MemoryContext Entry"), so this gate never rescues an `inbox` record into eligibility.
  Brain's actual schema has no field guaranteeing this linkage today, on any type; this is a named
  future Brain/integration dependency, not a gap this document closes by relaxing the gate.
- **M-19** When `MemoryContext` production cannot defensibly assign a classification (semantic
  authority class or Influence Taxonomy tier) with the confidence its own authority requires, it must
  resolve the ambiguity toward *less* authority, never more: ambiguity never promotes an entry to
  `SEMANTIC_PREMISE`; neither retrieval relevance nor Brain's own `confidence` field may resolve a
  classification ambiguity; and where no tier can be defensibly assigned, the entry is excluded from
  `MemoryContext` entirely, with the exclusion and its reason recorded (M-14), rather than admitted
  under a default or best-guess classification. A heuristic (model-assisted) classification is
  recorded as such, per Principle 6; it is an input to be validated, per Principle 7, never an
  authoritative determination by virtue of having been produced.
- **M-20** A historical statement's own normative force (obligation/prohibition/permission/preference)
  is never mechanically copied into the force of a current-run Inferred Claim that cites it as a
  premise. The current Claim's force is an independently reasoned, explicitly stated property of that
  Inference, subject to the same provisional/reversible discipline as any other Inferred property —
  because `REQUIREMENT_SPEC.md`'s Force → Strength Mapping compiles force to hard MUST/MUST NOT
  regardless of confidence, silent force-inheritance from history risks manufacturing a current hard
  constraint with no confidence-based safeguard anywhere downstream. Force provenance (the reasoning
  basis for the Claim's own current force) is recorded separately from historical-content provenance
  (which `MemoryContext` entry supplied the premise's content).
- **M-21** `DECISION_OPTION` influence — the currently-named instance being a memory-informed
  R-19-eligible working default at Requirement Derivation — proposes a candidate value within a
  decision the consuming stage already, independently owns; it supplies zero independent authority for
  the value ultimately chosen, and it never expands what the stage was already authorized to decide
  (R-19's own eligibility test is untouched by the memory's presence). The consuming stage must be
  able to justify the final value entirely under its own pre-existing authority (R-09's "Requirement-
  Derivation-introduced, with its own stated rationale"), citing the memory only as an additional,
  explicitly-labeled **memory-informed rationale** — never as though the memory required, authorized,
  or established the choice. `DECISION_OPTION` never applies to an intent-level, want-shaping value —
  R-19 itself categorically excludes those regardless of what memory proposes — and it is not, by
  default, available to any other stage or decision point beyond the one named here without its own
  equally rigorous re-derivation.

## Examples

- Memory: a `decision`-type record, project-scoped, inspectably citing the exact past `UserIdea`
  turn it traces to (Category A), "user decided against a message queue for v1, citing team
  unfamiliarity" (Brain confidence: medium). Current run: same project, no current statement about
  message queues. → Legitimate use: a cited premise for an Inferred Claim ("the system SHOULD avoid
  introducing a message queue, Inference-derived, moderate confidence, provisional") — never a
  User-Provided prohibition, and never a stronger force than "SHOULD" without its own independently
  stated reasoning (M-20). If this same record instead lacked any inspectable citation to its
  originating turn (Category B), it could still shape a clarification question, but could never be
  cited as the Inferred Claim's premise at all (M-18).
- Memory: a `lesson`-type record, "review coverage should be decomposed by invariant axis." →
  Legitimate use: informs how a future review task decomposes its own reviewer dispatch. Illegitimate
  use: appearing anywhere in `RequirementSpec` or an `ArchitectureCandidate`.
- Memory: a `reference`-type record, "Framework X added native WebSocket support (verified against
  vendor docs, dated six months ago)." Current run needs WebSocket support today. → Legitimate use:
  a research hint prompting Research + Evidence Collection to re-verify current support and
  re-record it with a fresh date; illegitimate use: citing the six-month-old memory itself as the
  `EvidenceBundle` entry.
- Memory: a `pattern`-type record, same-project, "a prior requirement in this project used
  exponential backoff with 3 retries for background job failures." Current run: an already-settled
  Requirement obligates retrying failed background jobs; a surviving Unknown asks how many attempts
  and what backoff strategy (R-19-eligible — a measurement detail within an already-settled
  Requirement, per Case 24). → Legitimate use: `DECISION_OPTION` — Requirement Derivation may adopt
  "3 retries, exponential backoff" as its own R-19-introduced default, citing the memory as a
  memory-informed rationale, but only after independently judging the value defensible under its own
  R-19 authority; illegitimate use: treating the memory as though it authorized or required that exact
  value, or using the same mechanism to decide *whether retries happen at all* (a want-level question
  R-19 excludes regardless of what memory proposes).

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
- Citing a `decision`-type memory that merely reads as if it quotes the user, with no inspectable
  citation to an originating `UserIdea` turn, as the premise of an Inferred Claim. (Violates M-18 —
  a Category B entry may shape a clarification question, never serve as a premise.)
- Treating a `reference`-type record whose body actually reads "user said they want offline-first
  behavior" as automatically Category B-only-and-therefore-safe-to-ignore-the-gate-question, on the
  reasoning that "the Historical User Provenance Gate is about `decision` records" — the gate applies
  because production's own inspection reveals this record describes a historical user statement,
  regardless of its stored `reference` type; skipping the Category A/B test because the stored type
  isn't `decision` is itself the violation. (Violates M-18's type-independence.)
- Assigning a current-run Inferred Claim the same "MUST NOT" force a historical statement carried,
  purely because the historical statement was itself phrased as a prohibition, with no independent
  current-run reasoning stated for why that force level still applies. (Violates M-20.)
- Admitting an entry at `SEMANTIC_PREMISE` because its Brain `confidence` is `high`, when
  production's own classification of what kind of statement it is remains genuinely ambiguous.
  (Violates M-19 — Brain confidence never resolves classification ambiguity.)
- Requirement Derivation adopting a memory-suggested R-19 default value without independently judging
  it defensible under its own authority — treating the memory's suggestion as itself sufficient
  justification, rather than as one input to a decision the stage must still own and justify itself.
  (Violates M-21.)
- Using a memory-informed "R-19 default" mechanism to decide whether a capability exists at all, or
  to narrow a user-facing actor/target/output/condition/permission/prohibition/obligation/preference —
  any of which is a want-level question R-19 itself excludes, regardless of what the memory proposes
  or how the choice is labeled. (Violates R-19 and M-21 together.)
