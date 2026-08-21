# ADR-0004: Memory Context Authority Boundary

## Status

Proposed

## Context

MIHVER Brain (`../mihver-brain`, a sibling repository — see "Brain Architecture Summary" below) is
a durable, file-based, deterministic second-brain: engineering lessons, decisions, and project
records persist across sessions and can be retrieved by later work. This session has already used
it twice, informally, as a source of pre-review engineering lessons for M0 Step 03A's later review
rounds. That worked, narrowly, but it was never designed — Brain was consulted ad hoc, inside a
review task, with no declared authority boundary. This ADR asks the question properly, before any
runtime integration exists: **if Mihver Architect is to consult durable memory at all, what may it
consume, when, with what authority, and through what boundary — without silently violating the
compiler-stage model (ADR-0001), the epistemic-provenance model (ADR-0002), or the
Requirement-Derivation model (ADR-0003)?**

This is semantic/architectural design only. No runtime integration, schema, or MCP surface is
built here; `../mihver-brain` is not modified; `feat/sb-02-hybrid-retrieval` is untouched.

### Brain Architecture Summary (as verified against the actual sibling repository, not assumed)

Read directly from `../mihver-brain`'s `README.md`, `ARCHITECTURE.md`, `CLAUDE.md`, and
`src/core/memorySchema.js` for this task:

- Canonical storage is plain Markdown with strict frontmatter under `vault/`; `.mihver/catalog.db`
  is a derived, disposable SQLite/FTS5 index, always reconstructable via `reindex`.
- **Eight memory types**, one-to-one with vault folders: `project`, `decision`, `lesson`,
  `incident`, `pattern`, `playbook`, `reference`, `inbox`. This is the actual, complete taxonomy —
  not the subset ("decision," "lesson," "reference," "project") that happened to be mentioned in
  earlier README excerpts read in prior sessions.
- Every record carries: `id` (UUID), `type`, `title`, `status` (`active` / `draft` / `superseded` /
  `archived`), `scope` (`global` or a lowercase project slug), `confidence` (`low` / `medium` /
  `high`), `created`/`updated` (canonical UTC timestamps), `tags`, `supersedes`/`superseded_by`
  (a UUID chain), and `provenance.source` (`manual` / `import` / `cli`) / `provenance.author`.
- `search` performs literal, natural-language, FTS5-backed lexical search with an explicit
  translation boundary (raw query text is tokenized into quoted literal words before reaching
  FTS5's own query grammar — see the `natural-language-interfaces-must-be-separated-from-backend-
  query-languages` lesson, retrieved below) — it is not semantic/embedding search. `VectorIndex` is
  an explicit SB-02 seam; SB-01 (Brain's current state) does no ranking beyond lexical relevance.
- Brain's schema defines **no authority, truth, or epistemic-origin field at all**. `confidence` is
  a caller-supplied property of the *memory record* (how durable/useful the author judged it to
  be at write time) — it is not MIHVER's own epistemic confidence (ADR-0002's Inference-derivation
  confidence), and conflating the two is one of this ADR's central hazards (Threat B, below).
  `status: superseded` marks a record's own lifecycle within Brain; it says nothing about whether
  the *content* is still true for a specific current MIHVER run.

This is the actual taxonomy this ADR designs against — no Brain schema change is proposed or
assumed.

## Phase 0 — Memory Retrieval Before Planning

Brain's own CLI (`search`, `context --scope`) was queried for engineering lessons before any design
choice below was made, per this task's explicit instruction. All `mihver`/`mihver-brain`-scope
lessons currently in the vault were retrieved (a full `context --scope <scope>` dump for both
scopes was also run to confirm no others exist):

| Memory | What it says | Where it concretely influenced this design |
|---|---|---|
| `4250a08b` — "Review coverage should be decomposed by invariant axis" | Independent reviewers miss shared blind spots unless work is explicitly decomposed across axes (classification, calibration, provenance, lifecycle, schema enforcement, cross-axis interaction). | Directly shapes Phase 12's reviewer dispatch (A/B/C/D by interaction axis, not file range) — already prescribed by this task, and confirmed sound by this memory rather than merely assumed. |
| `96500b29` — "Cross-axis invariants require explicit review contracts" | Reviewing two axes separately (there: provenance and normative force) can still miss a defect that only appears in their *interaction*. Observed during M0 Step 03A's RequirementSpec work. | This is the single most load-bearing memory for this design. It is used, honestly, as **Phase 7's worked example**: it changed *how* Claude reviewed (added pairwise-interaction scrutiny to the verification step) and never changed *what* the user's Requirements were. That is exactly the procedural/semantic distinction this ADR makes first-class (see "Procedural vs. Semantic Influence" below). It also directly motivates Reviewer D's cross-axis contradiction-matrix mandate in Phase 12. |
| `37a0ce2b` — "Natural-language interfaces must be separated from backend query languages" | A parameterized query can still be unsafe if one of its own parameters is itself interpreted by a nested sub-language (Brain's own FTS5 MATCH-operand bug). Correct shape: raw input → explicit translation boundary → backend-safe representation, never raw input straight into the backend language. | Used as a structural analogy, not a security finding about MIHVER: the same "explicit translation boundary" discipline that fixed Brain's own search bug is the argument *for* Model C (a dedicated MemoryContext-production boundary) over Model A (stages querying raw Brain directly) in Phase 3 below — a stage consuming raw retrieval results is structurally the same shape as passing raw text into FTS5, one layer up. |
| `64d5e902` — "CWD is not a filesystem isolation boundary" (`global` scope) | An apparent isolation mechanism (child-process CWD) does not by itself provide real isolation. | Used as a caution against a specific design temptation: assuming Brain's own `scope` field, by itself, is a sufficient stage-isolation/authority boundary. It is a useful *filter*, not a substitute for an explicit production boundary and declared per-stage input (see "Stage Isolation" under Model C). |

All four are treated as **advisory engineering context**, per this task's explicit instruction —
none is an authoritative MIHVER semantic rule, and none overrides ADR-0002, ADR-0003, or
`PRINCIPLES.md`. Where a memory suggested a structural analogy rather than a settled fact, that is
stated explicitly above, not silently treated as established.

## Phase 1 — Authority Map (as currently frozen)

Built from direct reads of `PRINCIPLES.md`, `M0_SCOPE.md`, `ADR-0001`, `ADR-0002`, `ADR-0003`,
`USER_IDEA.md`, `INTENT_SPEC.md`, and `REQUIREMENT_SPEC.md` on `main` at this task's base commit —
not from memory of earlier sessions.

1. **What may create User-Provided Claims?** Only Intent Parsing, only from a `UserIdea` version of
   *the current run*. `INTENT_SPEC.md`'s own definition is exact: "traceable directly to something
   the user said in a specific `UserIdea` version." `USER_IDEA.md` independently confirms `UserIdea`
   itself "carries no epistemic categories... those categories exist only in `IntentSpec`."
2. **What may create Inferred Claims?** Intent Parsing, per `INTENT_SPEC.md`'s Inference Policy
   ("derived by MIHVER from one or more other Claims through an identifiable reasoning step").
   Separately, Requirement Derivation may create its *own*, differently-labeled
   "Requirement-Derivation-level inference" (`REQUIREMENT_SPEC.md`'s "Requirement-Level Inference"
   section, R-10, R-22) — about technical implications of an already-accepted Claim/Requirement,
   never about intent. These are two distinct inference mechanisms at two distinct stages, never
   collapsed into one.
3. **What may create Assumed Claims?** Only Intent Parsing, and only for narrowly interpretive gaps
   ("what the user meant"), never technical/operational defaults — Assumption Policy.
4. **What may create Requirements?** Only Requirement Derivation, only from an eligible (non-Blocked)
   `IntentSpec` — `M0_SCOPE.md`'s stage table, `REQUIREMENT_SPEC.md`'s Input Eligibility.
5. **What may influence architecture candidate generation?** Only `TechnologyCandidateSet` and
   `RequirementSpec` — Architecture Synthesis's declared inputs (`M0_SCOPE.md`).
6. **What may count as Evidence?** Only Research + Evidence Collection's own output, governed by
   Principle 5 (source, version, verification date, confidence, freshness, all explicit) and
   Principle 2 (no material recommendation on an LLM's or a cached record's assertion alone).
7. **What is merely advisory/process context?** Anything that changes *how* MIHVER reasons, reviews,
   retrieves, or verifies without becoming the semantic content of any pipeline artifact — the exact
   category `96500b29` above is a real, lived example of.
8. **Which stages may read which inputs?** Exactly the `M0_SCOPE.md` stage table's declared `Input:`
   lists — nothing else, per Principle 3: "A stage consumes only the upstream artifacts explicitly
   declared as its inputs... must never read another stage's undeclared internal state or an
   artifact not named as one of its inputs."

**Hard constraint, following directly from item 8:** no stage in `M0_SCOPE.md`'s current table
declares any memory or Brain artifact as an input. Therefore **no stage may silently query MIHVER
Brain directly** — not as a convenience, not as a fallback, not "just for context." This is not a
new rule this ADR invents; it is Principle 3 applied to a system that did not exist when
`M0_SCOPE.md` was written. Any stage this design authorizes to consult memory requires that stage's
`M0_SCOPE.md` input list to be explicitly amended first — a required, separate, human-authorized
change (see "Foundation Impact Analysis" below). This ADR does not perform that amendment; it
identifies exactly where it is needed.

## Phase 2 — Memory Threat Model

Nine failure modes, identified before any model is chosen, so the model is selected *because* it
defeats these, not merely evaluated against them afterward:

- **A. Historical-user-statement laundering.** A past run's "I usually prefer PostgreSQL" becomes a
  current-run **User-Provided** Requirement ("the system MUST use PostgreSQL") despite the current
  `UserIdea` never mentioning databases. Defeated by: Phase 5's rule (historical statements are
  never automatically current-run User-Provided, full stop) plus a structural one — MemoryContext
  is never itself a `UserIdea` or Claim; only Intent Parsing, from the *current* `UserIdea`, may
  mint a User-Provided Claim, and MemoryContext is not a `UserIdea`.
- **B. Retrieval-relevance laundering.** A high FTS5 rank is silently read as "high truth" or "high
  authority." Defeated by: Phase 4's independent-axes model — relevance is a query-time, ephemeral
  ranking signal (not even stored on the Brain record), never conflated with the separately-tracked
  authority classification.
- **C. Engineering-lesson semantic leakage.** "Review by invariant axis" (a `lesson`) becomes a
  user's system Requirement. Defeated by: Phase 4's `lesson`/`playbook` → procedural-only authority
  class, and Phase 7's first-class procedural/semantic split.
- **D. Past-architecture lock-in.** A prior project's LangGraph success gets recommended now merely
  because it worked before. Defeated by: past outcomes (`pattern`/`decision`) may propose or shape
  the *search* for candidates, never bypass current Requirements/Evidence/Evaluation — Phase 3's
  model comparison and Phase 8's evidence boundary both enforce this directly.
- **E. Cached-evidence laundering.** A remembered "Framework X supports feature Y" is treated as
  current Evidence without satisfying Principle 5's freshness/source/date/confidence requirements.
  Defeated by: Phase 8's explicit boundary — memory may motivate re-verification, never substitute
  for it.
- **F. Current-intent contradiction.** A memory ("user prefers local execution") silently overrides
  a current `UserIdea` ("this project must run in our cloud account"). Defeated by: Phase 6's
  precedence rule — current authoritative input always wins; a contradicted memory is marked stale
  for this run, never silently applied.
- **G. Stale/superseded memory.** A corrected historical statement and its correction are both
  retrieved and treated as two independent pieces of supporting memory. Defeated by: MemoryContext
  production must resolve Brain's own `supersedes`/`superseded_by`/`status: superseded` chain before
  admission — a superseded record is never presented as live, current standing (Case 11 below).
- **H. Cross-project scope leakage.** A constraint recorded for Project A silently becomes a
  constraint in Project B. Defeated by: Brain's own `scope` field is a necessary filter at
  MemoryContext production, but (per the CWD lesson above) not by itself sufficient — production
  must also verify the *current run's own* project identity matches before admitting a
  project-scoped record (Case 12 below).
- **I. Privacy/scope leakage by mere existence.** A stage receives an unrelated memory only because
  it happens to be stored somewhere. Defeated by: MemoryContext is stage-scoped and
  purpose-retrieved (an explicit query/purpose, per Phase 9), never a blanket dump of everything
  Brain holds.

## Phase 3 — Integration Model Comparison

Four models evaluated against: provenance, stage isolation, reproducibility, least authority,
stale-memory handling, privacy/scope isolation, reduction of repeated questions, compatibility with
`IntentSpec`'s origin model, compatibility with `RequirementSpec`, compatibility with a future
`EvidenceBundle`, implementation complexity, and future Brain evolution.

### Model A — Stages query raw Brain directly

Rejected. Violates Principle 3 outright today (no stage declares Brain as an input) and, even if
that were fixed by declaring it, collapses every other property: no frozen snapshot exists to
reproduce (Brain's vault is live and mutable — Principle 11 breaks), every stage gets unfiltered
raw access (no least-authority boundary), nothing marks a result stale-for-this-run, and nothing
stops a stage from pasting retrieved content directly into what looks like a Claim (Threat A) or an
Evidence entry (Threat E) — the exact shape of bug the natural-language/FTS5 lesson (`37a0ce2b`)
describes one layer down: raw input reaching a consumer without an explicit translation boundary in
between.

### Model B — Brain memories merged into `UserIdea` before Intent Parsing

Rejected, more severely than Model A. This does not merely risk Threat A — it *is* Threat A as
default behavior, and it requires silently violating a frozen document this task must not touch:
`USER_IDEA.md` states explicitly that `UserIdea` must never contain "research findings, evidence,
or technology information MIHVER gathered on its own" or "a merged or flattened view that erases
which specific turn/version a given statement came from," and that it is immutable (UI-01) precisely
so that "what the user said" remains a reliable anchor. Merging retrieved memory into `UserIdea`
would corrupt that anchor permanently, contaminate every downstream artifact's provenance chain at
its root, and — because `UserIdea` content becomes User-Provided Claims in `IntentSpec` by
construction — hands memory the single highest authority level that exists in the entire model.

### Model C — A typed, immutable, stage-scoped `MemoryContext` artifact, produced at a separate retrieval boundary, passed as an explicitly-declared input where authorized

Selected. `MemoryContext` is a new artifact — not a `Claim`, not `Evidence`, not `UserIdea` — that a
dedicated retrieval step produces from Brain at a specific point in a run, with its own recorded
provenance (which memories, at what retrieval time, for what purpose, under what authority
classification — Phase 9). It is then passed to a stage **only if that stage's `M0_SCOPE.md` input
list has been explicitly amended to declare it** (Principle 3 respected, at the cost of an honest,
named required amendment — see "Foundation Impact Analysis"). This mirrors the exact pattern
`ADR-0001` already established for `RequirementSpec`/`ArchitectureCandidate`: a bounded IR, produced
by one stage, consumed by declared others, never a live query surface. Every property Models A/B
sacrifice is what this model buys back: a frozen, versioned artifact restores reproducibility; an
explicit production boundary enforces least authority and stale-memory/scope checks in one place
instead of trusting every consumer independently; and because `MemoryContext` is not itself a Claim
or Evidence entry, it is structurally incapable of becoming one by accident — it can only become one
through the same disciplined mechanisms (Inference Policy, Requirement-Level Inference, Evidence
sourcing) that already govern every other external input. The cost is real and is named, not
hidden: this is the most implementation-complex of the four models, and it requires a genuine,
separate `M0_SCOPE.md` amendment before any stage may use it.

### Model D — Separate memory artifacts per authority domain or stage

Rejected as the primary model, though its underlying insight is preserved. Splitting memory into
several dedicated artifact types (one per authority domain, or one per consuming stage) achieves
authority separation at the *type* level rather than via an internal classification field, which
sounds tighter — but multiplies the number of new pipeline artifact types the foundation must define
and maintain, directly cutting against Principle 12 (Evolvability: "a newly released... memory
approach should be introducible without redesigning MIHVER's core") and `ADR-0001`'s named "IR churn
risk." It also fragments the audit trail Phase 9 needs (Explainability, Principle 10) across
multiple artifacts instead of one inspectable record. Model D's actual benefit — that different
authority domains must never be silently conflated — is fully captured inside Model C's internal
authority-classification field (Phase 4) without paying Model D's structural cost twice.

**Model C is selected on this comparison, not because this task named it.** It is the only model
that is simultaneously compatible with Principle 3 (via an honest, named amendment rather than a
silent violation), with `USER_IDEA.md`/`INTENT_SPEC.md` as frozen and unmodified, and with the
existing IR-per-stage pattern `ADR-0001` already committed MIHVER to.

## Phase 4 — Memory Authority Model

Seven axes, kept independent — collapsing any pair into another reproduces one of ADR-0002's
already-named failure modes (force/confidence/origin collapse) one layer up, for memory instead of
for Claims:

1. **Retrieval relevance** — a query-time FTS5 ranking signal. Not stored on the Brain record at
   all; exists only as an artifact of a specific search call. Never read as truth or authority.
2. **Source/provenance** — Brain's `provenance.source` (`manual`/`import`/`cli`) and
   `provenance.author`, mechanically recorded at write time. Describes *how the memory entered
   Brain*, not whether its content is currently true or binding.
3. **Semantic authority class** — see the mapping below. Not present in Brain's schema at all;
   this is the classification `MemoryContext` production must assign, because Brain's schema is
   deliberately generic across all eight types and encodes no MIHVER-specific epistemic
   distinction (User-Provided/Inferred/Assumed has no Brain equivalent).
4. **Freshness/temporal standing** — Brain's `status` (`active`/`draft`/`superseded`/`archived`)
   plus `created`/`updated` describe the record's *own* lifecycle inside Brain. `MemoryContext`
   production must additionally judge freshness *for this run* — a record can be `active` in Brain
   and still be stale for the current project's current state (Case 9 below); the two freshness
   notions are related but not identical, and only the second one governs Evidence eligibility
   (Principle 5).
5. **Scope/project applicability** — Brain's `scope` field (`global` or a project slug) is a
   necessary filter, never a sufficient isolation boundary by itself (per the CWD lesson) — see
   "Cross-Project Scope Verification" in `MEMORY_CONTEXT.md`.
6. **Confidence, where meaningful** — Brain's `confidence` (`low`/`medium`/`high`) is the memory
   *author's* judgment that the record is durable/useful. It is not, and must never be presented
   as, MIHVER's own Inference-derivation confidence (ADR-0002) or an Evidence confidence score
   (Principle 5) — those are separately computed at the point a memory actually becomes a premise
   for an Inference or a candidate for Evidence, never inherited wholesale from Brain's field.
7. **Allowed use by stage** — which specific stage(s) may consume this entry at all, and for what
   *purpose class* (procedural-only vs. semantic-eligible-with-full-gate) — assigned at
   `MemoryContext` production, never left to the consuming stage's own judgment.

### Mapping Brain's actual eight types to semantic authority classes

Per this task's explicit instruction, Brain's real taxonomy is the source of truth — no new Brain
type is proposed. But **Brain's `type` field is a weak prior, not a determinant**: nothing in
Brain's schema encodes "this record describes a specific user's own historical statement" as
opposed to, say, MIHVER's own process decision — both would naturally be stored as `decision`
records, distinguished only by `scope` and body content, which `MemoryContext` production must
actually read and classify, not infer from `type` alone.

| Brain type | Typical semantic authority class (a prior, not a guarantee) | Notes |
|---|---|---|
| `project` | Durable project-identity/context anchor. | Helps scope retrieval correctly; its content is not automatically current-run authoritative. |
| `decision` | **Historical user statement/preference** (when project-scoped and describing something a user said or chose) **or** prior project decision/outcome (when describing MIHVER's own process). Brain does not distinguish these — production must. | This is the type most likely to carry Threat-A material; treat with the most scrutiny. |
| `lesson` | Procedural-only (Phase 7). | Never semantic content of any pipeline artifact. |
| `incident` | Procedural by default; may motivate a research hint if it names a specific technology's failure — must still clear the Evidence gate (Phase 8) before counting as Evidence. | |
| `pattern` | Prior architecture outcome. | May propose/search candidates (Threat D); never bypasses Requirements/Evidence/Evaluation. |
| `playbook` | Procedural-only. | Describes a process/runbook, not a user's system. |
| `reference` | Candidate technology/evidence knowledge. | Exactly Threat E's shape — must clear Principle 5's freshness/source/date gate before EvidenceBundle eligibility (Phase 8). |
| `inbox` | **Excluded entirely — not a low authority tier, a non-classification.** Not retrievable into any stage-facing `MemoryContext` until re-filed into a real type. | Default-excluded from production, not merely low-priority or low-ranked. |

## Phase 5 — Historical User Memory Rule

A direct statement made by the user in a prior run was genuinely User-Provided *in that historical
interaction*. It has no automatic standing as a User-Provided Claim in a *new* `IntentSpec`:

> A historical user statement, retrieved via `MemoryContext`, may serve as a stated, cited premise
> for a current-run Inferred Claim (with its own confidence, its own provisional/reversible marking,
> and explicit premise citation — exactly Inference Policy's existing discipline, extended to a
> premise that happens to be an external, well-provenanced artifact rather than another `IntentSpec`
> Claim), or as informational input shaping a candidate clarification question posed to the
> *current* user. It never becomes a current-run User-Provided Claim merely because the user
> originally said it — regardless of how directly it matches, how recent it is, or how many times it
> was repeated (extending I-16 to the memory axis: repetition across past occurrences never
> increases a memory's authority).

**HIGH/CRITICAL Decision Impact: memory alone may never close the item.** Per `INTENT_SPEC.md`'s own
model, a HIGH/CRITICAL item makes the produced `IntentSpec` version permanently Blocked; resolution
requires a *new* Intent Parsing pass grounded in the current `UserIdea`, never "the same version,
now resolved" by a later stage. Assumption Policy already forbids Assumptions for goal-level or
architecture-shape questions — precisely what HIGH/CRITICAL Decision Impact concerns by definition.
A historical statement from a different run, about a different point in time, essentially never
satisfies Inference Policy's "premises support the conclusion" test strongly enough to responsibly
settle a materially-different-architecture-level question — and even where it plausibly could, doing
so would still require an Inferred Claim exactly as disciplined as any other, at HIGH/CRITICAL-level
consequences, which this ADR judges as never appropriate: at most, memory may inform *what
clarifying question gets asked* (procedural aid, reducing friction in *how* the user is asked),
never substitute for asking it.

**LOW/MEDIUM Decision Impact: memory may defensibly reduce repeated clarification.** Conditions,
all required: (a) surfaced as an explicitly-marked, provisional, reversible candidate — either a
marked default (mirroring how Requirement Derivation may fill an R-19-eligible Unknown) or a
labeled Inferred Claim, never presented as settled without qualification; (b) remains visible in
provenance, never silently applied; (c) yields immediately to the current `UserIdea` if it says
anything relevant at all (Phase 6); (d) repetition across past occurrences never increases its
standing (I-16, extended).

**Dependency flagged, corrected on independent review, not resolved here:** an earlier draft of this
ADR mis-cited this dependency as resting on the "Inference Policy" section specifically and
classified it as `CLARIFICATION_ONLY`. On independent verification against the actual frozen text,
neither is accurate. The literal source of the constraint is `INTENT_SPEC.md`'s Epistemic Model
("Inferred — derived by MIHVER from one or more other Claims") together with its Provenance section,
which requires "every Claim it emits [to] carry enough of this chain that a `RequirementSpec` item
derived from it can, in turn, point back through `IntentSpec` to the original `UserIdea`." A
`MemoryContext` entry is not an `IntentSpec` Claim and does not trace to the *current* `UserIdea` at
all — it traces to a different `UserIdea`, from a different run. Allowing it as an Inference's
premise does not merely apply an existing test to a new input; it introduces a premise type, and a
provenance topology, the frozen Provenance model does not contemplate. That is a genuine semantic
broadening, not a reading already available within the existing rule. This dependency is therefore
reclassified as **`SEMANTIC_AMENDMENT_REQUIRED`** in "Foundation Impact Analysis" below, not
`CLARIFICATION_ONLY` — until `INTENT_SPEC.md` is separately, explicitly amended to recognize an
external, well-provenanced retrieved artifact as a valid premise kind (with its own required
provenance-chain treatment), **Intent Parsing may not cite a `MemoryContext` entry as the premise of
an Inferred Claim at all.** Until that amendment exists, the only memory-informed path available to
Intent Parsing is the clarification-question path (Phase 5's second option) — which requires no
change to `INTENT_SPEC.md`, since the resulting Claim is User-Provided from the *current* user's
*current* answer, exactly as ordinary Intent Parsing already produces.

## Phase 6 — Current Input Must Win

Deterministic precedence, in all cases: the current run's own authoritative input wins; a
contradicted memory is marked stale-for-this-run, never silently overridden into applying anyway,
and never silently discarded without a trace either.

| Current-run authority | vs. | Memory | Precedence | On contradiction |
|---|---|---|---|---|
| Current `UserIdea` | vs. | Historical preference | Current wins, always | Memory entry marked stale-for-this-run in `MemoryContext`'s own record; **not** an `IntentSpec` Conflict (the memory was never elevated to Claim status, so `IntentSpec`'s Conflict machinery — which is defined over Claims — does not apply; see `MEMORY_CONTEXT.md`) |
| Current `UserIdea` | vs. | Past project decision | Current wins, always | Same as above |
| Current project canonical state | vs. | Historical Brain summary | Current wins, always | Brain summary treated as advisory/candidate-recall only for this run |
| Current authoritative Evidence | vs. | Cached/stale technology memory | Current wins, always | Cached memory may prompt re-verification (a research hint); never substitutes for the current Evidence entry |

Whether a contradiction should additionally trigger clarification depends on the contradicted
item's own Decision Impact, computed exactly as `INTENT_SPEC.md` already computes it for any other
item — memory contradiction is **not a new, independent blocking mechanism**. If the contradicted
question would be HIGH/CRITICAL on its own merits, the contradiction is surfaced as context that may
shape *what* clarifying question gets asked (Phase 5); if LOW/MEDIUM, it is silently marked stale
with no clarification required, since the current input already authoritatively answered the
question. What must never happen, at any impact level: silently applying memory content over
current-run authoritative input.

## Phase 7 — Procedural vs. Semantic Memory (first-class distinction)

**Procedural influence**: changes *how* MIHVER performs its own internal work — review
decomposition, verification rigor, retrieval query strategy, which invariant axes get tested, how
many independent reviewers are dispatched, what gets double-checked. Never changes the *content* of
any pipeline artifact.

**Semantic authority**: the capacity to become, or directly determine, part of a pipeline artifact's
actual content — a Claim, a Requirement, a technology eligibility judgment, an architecture
constraint.

These are properties of a specific *use*, not fixed properties of a memory record: the same
`pattern` memory ("past architecture used a message queue for decoupling") may procedurally inform
Research Planning's search strategy ("check message-queue options" — free, low-risk, no gate) while
also being a *candidate* technology lead that must separately clear the full Evidence gate (Phase 8)
before it may influence `RequirementSpec` or an `ArchitectureCandidate`'s actual content. `lesson`
and `playbook` types are procedural-only by default classification (Phase 4's table) and structurally
cannot cross into semantic authority under this design at all.

**Honest worked example, per this task's explicit instruction:** the `cross-axis-invariants-
require-explicit-review-contracts` lesson (`96500b29`), retrieved and applied during M0 Step 03A's
own later review rounds, is precisely this pattern. It changed *how* Claude reviewed
`REQUIREMENT_SPEC.md` — adding pairwise-interaction scrutiny to independent verification — and it
never touched, and could never legitimately have touched, what the user's own Requirements were.
That is the exact shape every future engineering-lesson memory must be held to.

## Phase 8 — Memory and Evidence (boundary only; `EvidenceBundle` itself remains undesigned)

| Path | Allowed? | Condition |
|---|---|---|
| memory → search/research hint | Allowed once Research Planning is separately authorized to consume `MemoryContext` (not yet performed) | Procedural use only, and only *additive* — informs Research Planning's own query strategy without narrowing or skipping requirement-derived coverage; never appears in `RequirementSpec`/`ArchitectureCandidate` content directly. |
| memory → candidate evidence requiring freshness/source verification | Allowed, gated | Hands Research + Evidence Collection a lead to independently re-source, re-date, and re-confidence per Principle 5 — the cached memory is never itself the citation. |
| memory → direct `EvidenceBundle` entry | **Never allowed** | A cached "Framework X supports feature Y" cannot supply a *current* verification date, and Principle 5 requires one. Re-verification, not memory recall, is what produces a valid entry. |

This preserves Principle 2 (no material recommendation on assertion alone — a remembered assertion
included) and Principle 5 (freshness is explicit — a cached claim's age is exactly what memory
cannot make current by being remembered confidently).

## Phase 9 — Reproducibility

A past `ArchitectureDecision` must remain reconstructable (Principle 11). Brain's own vault is
mutable — records get superseded, reindexed, potentially edited — so **the raw Brain index is not
sufficient to reproduce a past run's memory context; only a frozen `MemoryContext` snapshot is.**
Conceptually (no JSON fields chosen here — deferred per `M0_SCOPE.md`'s own field-design deferral
pattern), a production step must preserve:

- which memories were retrieved (stable Brain memory IDs);
- each memory's canonical content/version/hash-equivalent identity (e.g. Brain's own `updated`
  timestamp plus a content digest, or equivalent) — so a later re-run against a changed vault can
  still show exactly what was seen;
- retrieval time/snapshot (when `MemoryContext` was produced, distinct from when the memory itself
  was created/updated in Brain);
- the retrieval query and its purpose (what was searched for, and why);
- each memory's Brain-recorded scope and provenance (`source`/`author`);
- the authority classification assigned at production (Phase 4) — not re-derivable from Brain alone;
- the freshness/temporal-standing judgment made at production time (distinct from Brain's own
  `status`);
- why it was admitted (the retrieval rationale);
- which stage was authorized to use it;
- **whether it actually influenced output** — a post-hoc fact, not knowable at retrieval time,
  essential to Explainability (Principle 10) and to honestly distinguishing "retrieved but unused"
  from "retrieved and load-bearing," the same distinction Phase 7's worked example depends on.

## Phase 11 — Foundation Impact Analysis

No frozen document is modified in this task. Required future changes, classified:

- **`M0_SCOPE.md` stage input declarations — `SEMANTIC_AMENDMENT_REQUIRED`.** No stage currently
  declares `MemoryContext` (or any memory artifact) as an input (Phase 1, item 8; Principle 3). Any
  stage this design would authorize to consume `MemoryContext` requires its own, separate
  `M0_SCOPE.md` entry amendment to add it to that stage's declared `Input:` list — this is a real
  amendment to a frozen document, not a clarification of existing wording, and is not performed by
  this task. **Corrected on independent review:** an earlier draft of this ADR named only two
  "plausible" candidate stages (Intent Parsing, Research Planning), but `MEMORY_CONTEXT_CASES.md`'s
  own worked cases (7, 8, 20) describe Architecture Synthesis making comparable procedural use of
  memory for architecture-*shape* reasoning (distinct from named-technology discovery, which remains
  Technology Candidate Identification's gate) — meaning Architecture Synthesis is at minimum a third
  stage requiring its own amendment, undercounted in the original list. This ADR does not attempt to
  enumerate every stage that might eventually want `MemoryContext`; it corrects the earlier
  undercount to make clear the list was illustrative, not exhaustive, and that each stage's amendment
  must be separately, explicitly authorized — no stage is added to that list by this correction
  itself.
- **`PRINCIPLES.md` — `NO_CHANGE`.** Every principle this design leans on (2, 3, 5, 6, 7, 10, 11, 12)
  already supports the chosen model without modification; this ADR applies them to a new subsystem,
  it does not extend or reinterpret any of them.
- **`USER_IDEA.md` — `NO_CHANGE`.** Nothing about `MemoryContext` touches `UserIdea`'s own model;
  `MemoryContext` is never merged into it (Model B was rejected explicitly for this reason).
- **`INTENT_SPEC.md`'s Inference Policy/Provenance model — `SEMANTIC_AMENDMENT_REQUIRED`** (corrected
  on independent review — an earlier draft of this ADR classified this `CLARIFICATION_ONLY`; that
  was wrong, per the corrected reasoning in Phase 5 above). `INTENT_SPEC.md` defines an Inference's
  premises as other Claims, and requires every emitted Claim's provenance chain to point back
  through `IntentSpec` to *the* `UserIdea` it was produced from. A `MemoryContext` entry is not a
  Claim and traces to a *different* `UserIdea`, from a different run — citing it as an Inference's
  premise requires `INTENT_SPEC.md` to recognize a genuinely new premise kind and provenance
  topology, not merely apply its existing test to a new input. Until this amendment is separately,
  explicitly authorized and completed, **Intent Parsing may not cite a `MemoryContext` entry as an
  Inference's premise at all** — only the clarification-question path (Phase 5's second option,
  which requires no `INTENT_SPEC.md` change) is available in the meantime.
- **`REQUIREMENT_SPEC.md`'s Requirement-Level Inference mechanism — `SEMANTIC_AMENDMENT_REQUIRED`**
  (corrected on independent review, for the identical reason as the `INTENT_SPEC.md` item above — an
  earlier draft classified this `NO_CHANGE`, which did not hold up once the parallel case was
  checked). R-10/R-22 define a Requirement-Derivation-level inference's premise as "the accepted
  Claim or Requirement it derives from" — not an external `MemoryContext` entry. The same broadening
  problem recurs one stage later: citing a memory entry as such a premise requires
  `REQUIREMENT_SPEC.md` to recognize a new premise kind, not merely the `M0_SCOPE.md` input-
  declaration amendment already identified above. Until both amendments exist, Requirement
  Derivation may not cite a `MemoryContext` entry as a Requirement-Level Inference's premise either.
- **Future `EvidenceBundle` — `CLARIFICATION_ONLY`.** `EvidenceBundle` does not exist yet (`ADR-0001`
  explicitly defers its design). Phase 8's boundary is a constraint on that future design ("memory
  may motivate re-verification, never substitute for it"), not a change to anything currently
  written, since nothing is currently written.
- **Final `MihverArchitectureSpec` — `NO_CHANGE`.** This design introduces no new claim about what
  the final spec must contain; `MemoryContext`'s influence, if any, is already fully absorbed into
  `RequirementSpec`/`EvidenceBundle`/`ArchitectureCandidate` content upstream, by the time
  Specification Generation runs.

**This ADR remains Proposed until the required `M0_SCOPE.md` amendment is separately, explicitly
human-authorized and completed** — mirroring exactly how `ADR-0002` and `ADR-0003` stayed Proposed
pending their own respective completion conditions.

## Decision

Adopt **Model C**: a typed, immutable `MemoryContext` artifact, produced by a dedicated retrieval
boundary from MIHVER Brain, carrying an explicit authority classification per entry (Phase 4),
consumable by a stage only once that stage's `M0_SCOPE.md` input list is separately amended to
declare it — and, for any use that would cite a `MemoryContext` entry as the premise of an Inferred
Claim or a Requirement-Level Inference specifically, only once `INTENT_SPEC.md` and/or
`REQUIREMENT_SPEC.md` are *also* separately amended (Phase 11 — a distinct, additional requirement
from the `M0_SCOPE.md` input-declaration amendment, not subsumed by it). `MemoryContext` is never a
`Claim`, never `Evidence`, never merged into `UserIdea`, and never queried directly by any stage. Full
semantic detail is in [MEMORY_CONTEXT](../contracts/MEMORY_CONTEXT.md); worked adversarial cases are
in [MEMORY_CONTEXT_CASES](../examples/MEMORY_CONTEXT_CASES.md).

## Rationale

- **Extends, rather than reinvents, the compiler-IR pattern (`ADR-0001`).** `MemoryContext` is a
  bounded IR like `RequirementSpec` or `ArchitectureCandidate` — produced once, consumed by
  declared stages, never a live conversational surface.
- **Extends ADR-0002's origin discipline instead of adding a parallel one.** Historical memory, when
  it does become an `IntentSpec` Claim at all, is folded into the *Inferred* origin Claims already
  use — never a fourth, unprincipled origin category, and never Assumed: Assumption Policy restricts
  Assumptions to narrowly interpretive gaps, never operational defaults, and a historical preference
  is exactly the latter, not the former (see "Historical User Memory Rule" in `MEMORY_CONTEXT.md`).
- **Makes the procedural/semantic distinction (Phase 7) load-bearing, not incidental** — it is what
  lets MIHVER benefit from engineering-lesson memory (as this very session already has) without any
  risk of that benefit leaking into a user's actual Requirements.
- **Names its own cost honestly.** Model C is the most complex option and requires a real,
  separate `M0_SCOPE.md` amendment — this ADR does not hide that behind "Proposed" status; it names
  exactly what the amendment is and why (Phase 11).

## Consequences

- No stage may consume `MemoryContext` until `M0_SCOPE.md` is amended for that specific stage; this
  ADR's Status stays Proposed until then.
- Every future memory-consuming stage must additionally state, in its own future contract work,
  which authority classes it is permitted to use for which purpose (procedural vs. semantic) —
  `MemoryContext`'s existence does not itself grant blanket permission.
- `MemoryContext` production becomes a new, disciplined boundary requiring its own future rigor
  (query construction, scope verification, supersession resolution, freshness judgment) — deferred
  design work, not designed here.
- Brain's own evolution (including any future SB-02 hybrid-retrieval capability) can proceed
  independently of MIHVER's pipeline contracts, as long as it continues to produce records
  `MemoryContext` production can classify under Phase 4's model — this is exactly Principle 12
  (Evolvability) working as intended.

## Alternatives Considered

See "Phase 3 — Integration Model Comparison" above for Models A, B, and D, each rejected with reasons
specific to this design, not merely because Model C was suggested by the task.

## Risks

- **Amendment-sequencing risk.** If a future task amends `M0_SCOPE.md` without also carrying forward
  this ADR's authority classification and precedence rules faithfully, the exact laundering threats
  this ADR defeats on paper could reappear in the amendment itself. Mitigation: the amendment task
  must cite this ADR and `MEMORY_CONTEXT.md` directly, not re-derive the rules from scratch.
- **Brain-taxonomy-drift risk.** Phase 4's type-to-authority-class mapping is a *prior*, not a
  guarantee, precisely because Brain's schema has no epistemic field. If Brain's own taxonomy
  changes (e.g. under SB-02), the mapping table must be revisited; it is not automatically correct
  forever. Mitigation: the mapping is explicitly framed as content-dependent, not type-alone-
  dependent, so a taxonomy change narrows the review surface rather than silently invalidating it.
- **Historical-statement mis-storage risk.** Brain has no dedicated type for "a user's own
  historical statement." This design recommends `decision` (project-scoped) as the natural fit, but
  that is a MIHVER usage convention, not a Brain schema guarantee — nothing currently prevents such
  content from being stored as `reference` or `inbox` instead, which would require production-time
  content inspection to catch. Mitigation: named explicitly here rather than assumed solved.
- **Amendment-scope risk (resolved during this design's own review, recorded for transparency).** An
  earlier draft of this ADR under-classified the `INTENT_SPEC.md`/`REQUIREMENT_SPEC.md` premise-
  extension question as `CLARIFICATION_ONLY`, reasoning that citing a `MemoryContext` entry as an
  Inference's premise was a natural reading of existing wording. Independent review found this
  reasoning did not hold up against the frozen Provenance model's actual requirement (every emitted
  Claim's chain must point back through `IntentSpec` to *the* `UserIdea` it came from) and corrected
  it to `SEMANTIC_AMENDMENT_REQUIRED` for both documents (see "Foundation Impact Analysis"). This
  risk entry exists to flag the general pattern, not just this one instance: a future reviewer of
  *this* ADR should specifically re-check whether any other "premises already accommodate X" claim
  in this document holds up the same way this one did not.

## Open Questions

- Exactly which stages should ever be authorized to consume `MemoryContext` (at minimum Intent
  Parsing, Research Planning, and Architecture Synthesis are named as plausible in this design, per
  Phase 11's correction — not an exhaustive list), and under what per-stage authority-class
  restriction? A specific gap flagged during review, not resolved here: a stage like Research
  Planning makes *several* distinct decisions (`M0_SCOPE.md`: what questions need answers, what
  technology categories are in scope, which sources count as authoritative, what evidence coverage is
  sufficient) — this design does not specify which of those, if any, memory may influence versus
  which must remain fully independent of it. Not decided here — deferred to the `M0_SCOPE.md`
  amendment task, which must specify this per-stage, per-decision granularity explicitly rather than
  granting a stage blanket "procedural use."
- How should `MemoryContext` production itself be triggered (per-run, per-clarification-cycle, on
  demand)? Deferred as an implementation concern, per this task's explicit scope.
- Should Brain ever gain a dedicated memory type or field for "historical user statement," rather
  than relying on the `decision`-type convention this design recommends? Deferred — would require a
  `mihver-brain` change, explicitly out of scope for this task.
- What does `MemoryContext`'s relationship to a future `EvidenceBundle` look like once
  `EvidenceBundle` itself is actually designed? Deferred, per Phase 8's explicit scope limit.

## Future Work

- Design and human-authorize the `M0_SCOPE.md` amendment identified in "Foundation Impact Analysis."
- Only once that amendment lands: design `MemoryContext`'s machine-readable schema (deliberately not
  done here, mirroring `ADR-0002`/`ADR-0003`'s own schema deferral).
- Design the actual retrieval-boundary implementation (query construction, scope/supersession
  verification, freshness judgment) that produces `MemoryContext` from Brain.
- Revisit this ADR's Status once the `M0_SCOPE.md` amendment is completed and at least one
  adversarial review pass has exercised the model against real cases — the same condition
  `ADR-0002` and `ADR-0003` were each held to before being considered for acceptance.
