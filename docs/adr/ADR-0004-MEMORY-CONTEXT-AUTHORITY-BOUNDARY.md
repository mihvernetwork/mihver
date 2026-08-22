# ADR-0004: Memory Context Authority Boundary

## Status

Accepted

**Acceptance note (this revision):** per this ADR's own "Acceptance Gate" (below), Accepted status
requires dependency A alone — the core `M0_SCOPE.md` integration boundary (`RunContext`, the
`MemoryContext` Producer's own contract, and at least one consuming stage's declared `MemoryContext`
input), separately, explicitly human-authorized, completed, and adversarially reviewed against real
cases. That condition is now met: dependency A merged via PR #17
(`9416e857b549bea07d4ce06a5c365524fdf1d51a`), amending `docs/foundation/M0_SCOPE.md` to introduce
`RunContext`, the `MemoryContext` Producer as a declared cross-cutting boundary, and Research
Planning as the first and only authorized `MemoryContext`-consuming stage (`DISCOVERY_ATTENTION`
tier only); four independent read-only Codex reviewers adversarially reviewed that amendment, and
three confirmed findings were fixed before merge (see `.project/REVIEW_STATE.md`'s history for
`M0-FOUNDATION-MEMORY-BOUNDARY-A`). This Status transition changes nothing else: dependencies B, C,
and D remain exactly as structurally disabled as before — see "Acceptance Gate" below — and are not
prerequisites for, and are not enabled by, this Acceptance. No `MemoryContext` runtime, schema, or
Brain adapter exists; Research Planning does not currently retrieve any actual memory; and this
Acceptance does not change `ADR-0003`'s own Status.

## Context

**Remediation note (this revision):** an external human review of the first draft accepted Model C
but found six cross-boundary issues requiring resolution before any foundation-amendment work
begins: (1) a circular scope-anchor problem (a Brain record was being used to authenticate its own
applicability); (2) an undefined `MemoryContext` producer role; (3) an authority leak letting
production perform semantic contradiction-detection that belongs to Intent Parsing; (4) a false
procedural/semantic binary that mislabeled search-space-altering influence as "procedural"; (5) an
undefined `MemoryContext` lifecycle/invalidation model; (6) unresolved cross-project scope ambiguity
in several worked cases. All six are resolved below — see "Current-Run Scope Anchor: `RunContext`,"
"MemoryContext Producer: Role and Authority," "Separating Admissibility from Interpretation,"
"Influence Taxonomy," and "MemoryContext Lifecycle and Invalidation" in `MEMORY_CONTEXT.md`, and the
corrected cases in `MEMORY_CONTEXT_CASES.md`. Model C itself was not found unsound by this review and
is retained unchanged as the selected model.

**Second remediation pass (this revision, continued):** four independent Codex reviewers, dispatched
by interaction axis (A: Scope Anchor × Producer Authority; B: Lifecycle × Reproducibility; C: Process
× Discovery × Semantic Authority; D: cross-document/corpus contradiction), each independently
re-verified against the actual text before any fix was applied, found and this revision fixes: a
stale table entry in this ADR still describing `project` records as an identity anchor rather than a
corroborating description (propagated from an earlier fix applied only to `MEMORY_CONTEXT.md`); a
genuine self-contradiction where the Producer's "mechanical scope admissibility only" authority limit
conflicted with pre-existing text requiring it to judge whether `global`-scoped content is "genuinely
project-agnostic" (resolved by deferring that specific content judgment to the consuming stage,
mirroring how semantic-contradiction detection is already deferred elsewhere); an under-specified
"freshness" judgment that could be misread as production judging real-world truth rather than a
mechanical, age-based fact; residual "produced by one stage, at a specific point in a run" language
throughout this ADR's Phase 3, Phase 6, Phase 9, Rationale, Consequences, and Open Questions sections,
left over from before the cross-cutting-boundary model was adopted; an incomplete migration of the
old two-way procedural/semantic split to the three-tier Influence Taxonomy, left in place in several
worked cases (7, 8, 9, 10, 20) and this ADR's own Phase 4/7/8 tables even after `MEMORY_CONTEXT.md`'s
copies were corrected; a functional-exclusion loophole in Case 8 that let memory contribute partial
weight toward excluding a candidate under cover of "never the sole reason"; several worked cases with
still-ambiguous memory scope (5, 6, 9, 10, 13, 16, 20); a coverage gap where no case exercised
`RunContext`'s explicit absence (closed with new Case 21); a cross-run reuse gap in the Lifecycle
model that did not prohibit reusing a `MemoryContext` snapshot across separate runs bound to the same
identity; and a genuine cardinality inconsistency in Case 18 that simultaneously said no
`MemoryContext` is produced on Brain-unavailability and that a production record exists for that
outcome. All are fixed below and in the two companion documents; none required abandoning Model C.

**Third remediation pass (this revision, continued): `M0-ADR-0004-AUTHORITY-PROVENANCE-CLOSURE`.**
A narrow semantic-closure pass, before any foundation-amendment work begins, closes six further gaps:
(1) a **Historical User Provenance Gate** distinguishing direct historical user statements
(inspectably traceable to an original user-authored source) from derived/unverified user memory
(reads like a user statement but lacks that traceable linkage) — only the former may ever be cited as
an Inference premise; the latter is permanently capped at `DISCOVERY_ATTENTION`; (2) a **Classification
Fail-Closed Rule** requiring production to record classification basis/method/ambiguity and, on
ambiguity, resolve toward less authority, never more — never promoting to `SEMANTIC_PREMISE`, never
letting retrieval relevance or Brain confidence resolve the ambiguity; (3) removal of residual wording
that let production treat "an authoritative artifact was supplied" as equivalent to "a contradiction
judgment was supplied" — production may only mechanically apply an explicit, already-computed verdict
about a *specific* entry, never derive one from an artifact reference; (4) an explicit **identity
boundary** distinguishing "memory is never Evidence" from a mere freshness gate — a `pattern`/
`incident`/`reference` entry never itself reaches `SEMANTIC_PREMISE`, regardless of re-verification;
only a wholly new, independently-produced Evidence/TechnologyCandidateSet artifact does; (5) an
explicit Foundation Impact item for memory-informed R-19 defaults, closing a gap where the ADR
required this capability's provenance discipline without naming the `REQUIREMENT_SPEC.md` amendment
it needs; (6) a **Historical Force Is Not Current Force** rule, plus a new adversarial case (22), and
an M-07 correction restoring I-16's "not by itself" qualifier that an earlier revision had silently
strengthened into a broader claim I-16 does not make. See "Historical User Provenance Gate,"
"Classification Fail-Closed Rule," "Identity Boundary, Not Merely a Freshness Gate," and "Historical
Force Is Not Current Force" in `MEMORY_CONTEXT.md`, and Case 22 in `MEMORY_CONTEXT_CASES.md`. Model C
remains retained unchanged; none of these six findings bears on whether Model C itself is sound.

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
| `96500b29` — "Cross-axis invariants require explicit review contracts" | Reviewing two axes separately (there: provenance and normative force) can still miss a defect that only appears in their *interaction*. Observed during M0 Step 03A's RequirementSpec work. | This is the single most load-bearing memory for this design. It is used, honestly, as **Phase 7's worked example**: it changed *how* Claude reviewed (added pairwise-interaction scrutiny to the verification step) and never changed *what* the user's Requirements were. That is exactly the `PROCESS_ONLY` tier of the Influence Taxonomy this ADR makes first-class (see "Influence Taxonomy: Process-Only, Discovery/Attention, Semantic Premise" below). It also directly motivates Reviewer D's cross-axis contradiction-matrix mandate in Phase 12. |
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
  user's system Requirement. Defeated by: Phase 4's `lesson`/`playbook` → `PROCESS_ONLY`-always
  authority class, and Phase 7's Influence Taxonomy, under which `lesson`/`playbook` have no path to
  any other tier.
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
  `MemoryContext` production, but (per the CWD lesson above) not by itself sufficient — production
  must also verify the memory's scope against `RunContext`, a non-memory identity anchor established
  independently of Brain (see `MEMORY_CONTEXT.md`'s "Current-Run Scope Anchor"; corrected during this
  remediation from an earlier draft that let a Brain `project` record serve as its own identity
  check, which was itself circular — Case 12/14 below).
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
dedicated retrieval boundary produces from Brain, with its own recorded provenance (which memories,
at what retrieval time, for what purpose, under what authority classification — Phase 9). This
boundary is **not a first-class linear pipeline stage**: it is a cross-cutting compiler boundary/
service, invoked repeatedly, once per authorized retrieval, by whichever consuming stage currently
needs it — each invocation produces its own fresh, independently immutable `MemoryContext` (see
"MemoryContext Producer: Role and Authority" in `MEMORY_CONTEXT.md`). Each resulting `MemoryContext`
is then passed to a stage **only if that stage's `M0_SCOPE.md` input list has been explicitly
amended to declare it** (Principle 3 respected, at the cost of an honest, named required amendment —
see "Foundation Impact Analysis"). This partially mirrors the pattern `ADR-0001` already established
for `RequirementSpec`/`ArchitectureCandidate` — a bounded, versioned IR, never a live query
surface — but differs from that pattern in cardinality: instead of one artifact produced once by one
stage in the linear sequence, `MemoryContext` is produced fresh, on demand, by a boundary invoked
from multiple points in the pipeline. Every property Models A/B
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
   distinction (User-Provided/Inferred/Assumed has no Brain equivalent). This classification is not
   always mechanical — reading body content to distinguish, e.g., a historical user statement from a
   process decision is a heuristic act, subject to `MEMORY_CONTEXT.md`'s "Classification Fail-Closed
   Rule": ambiguity must resolve toward less authority, never more, and never toward `SEMANTIC_PREMISE`.
4. **Freshness/temporal standing** — Brain's `status` (`active`/`draft`/`superseded`/`archived`)
   plus `created`/`updated` describe the record's *own* lifecycle inside Brain. `MemoryContext`
   production additionally flags a **mechanical, age/lifecycle-based** freshness signal for this
   run — a record can be `active` in Brain and still be flagged stale-by-age (Case 9 below); this is
   never a judgment that the record's underlying real-world claim is still true, which production is
   not authorized to make (see `MEMORY_CONTEXT.md`'s M-05) — that question belongs to whichever stage
   or mechanism actually re-verifies current facts (typically Research + Evidence Collection). Only
   this mechanical flag is a production-time fact; it governs Evidence eligibility only in the sense
   that it prompts re-verification, never in the sense of production deciding the content is stale
   (Principle 5).
5. **Scope/project applicability** — Brain's `scope` field (`global` or a project slug) is a
   necessary filter, checked against `RunContext` (a non-memory anchor, never another Brain record),
   never a sufficient isolation boundary by itself (per the CWD lesson) — see "Current-Run Scope
   Anchor" and "Cross-Project Scope Verification" in `MEMORY_CONTEXT.md`.
6. **Confidence, where meaningful** — Brain's `confidence` (`low`/`medium`/`high`) is the memory
   *author's* judgment that the record is durable/useful. It is not, and must never be presented
   as, MIHVER's own Inference-derivation confidence (ADR-0002) or an Evidence confidence score
   (Principle 5) — those are separately computed at the point a memory actually becomes a premise
   for an Inference or a candidate for Evidence, never inherited wholesale from Brain's field.
7. **Allowed use by stage** — which specific stage(s) may consume this entry at all, and for which
   Influence Taxonomy tier (`PROCESS_ONLY`/`DISCOVERY_ATTENTION`/`DECISION_OPTION`/`SEMANTIC_PREMISE`,
   Phase 7) — assigned at `MemoryContext` production, never left to the consuming stage's own
   judgment.

### Mapping Brain's actual eight types to semantic authority classes

Per this task's explicit instruction, Brain's real taxonomy is the source of truth — no new Brain
type is proposed. But **Brain's `type` field is a weak prior, not a determinant**: nothing in
Brain's schema encodes "this record describes a specific user's own historical statement" as
opposed to, say, MIHVER's own process decision — both would naturally be stored as `decision`
records, distinguished only by `scope` and body content, which `MemoryContext` production must
actually read and classify, not infer from `type` alone. **This weak-prior status is not confined to
the `decision`/`decision` ambiguity** — a record stored under any other non-`inbox` type that
production's own content inspection reveals actually describes a historical user statement is gated
by the Historical User Provenance Gate (`MEMORY_CONTEXT.md`, M-18) exactly as a correctly-filed
`decision` record would be, regardless of which row of the table below its stored type would
otherwise place it in. `type` never supplies an epistemic shortcut past that gate.

| Brain type | Typical semantic authority class (a prior, not a guarantee) | Notes |
|---|---|---|
| `project` | Durable project *description*, corroborating an already-established `RunContext` identity. | Never itself the anchor establishing that identity (see "Current-Run Scope Anchor" in `MEMORY_CONTEXT.md`); its content is not automatically current-run authoritative either way. |
| `decision` | **Historical user statement/preference** (when project-scoped and describing something a user said or chose) **or** prior project decision/outcome (when describing MIHVER's own process). Brain does not distinguish these — production must. When the former, further gated into Category A (direct)/Category B (derived/unverified) by `MEMORY_CONTEXT.md`'s "Historical User Provenance Gate" — reading the body only tells production *what kind* of statement this is, never *how directly* it traces to the user's own words. | This is the type most likely to carry Threat-A material; treat with the most scrutiny — but not the only type that can carry it: any other row's type may, on inspection, turn out to describe a historical user statement too, and is gated identically (see above). |
| `lesson` | `PROCESS_ONLY` always (Phase 7). | Never semantic content of any pipeline artifact. |
| `incident` | `DISCOVERY_ATTENTION` by default, permanently; may motivate a research hint if it names a specific technology's failure. The entry itself never becomes Evidence — only a wholly new, independently-produced artifact clearing the Evidence gate (Phase 8) may. | |
| `pattern` | Prior architecture outcome; `DISCOVERY_ATTENTION` when shaping search. | May propose/search candidates (Threat D); never bypasses Requirements/Evidence/Evaluation. |
| `playbook` | `PROCESS_ONLY` always. | Describes a process/runbook, not a user's system. |
| `reference` | Candidate technology/evidence knowledge; `DISCOVERY_ATTENTION`, permanently. | Exactly Threat E's shape — the entry itself never becomes Evidence; only a wholly new, independently-produced artifact clearing Principle 5's freshness/source/date gate (Phase 8) has `EvidenceBundle` eligibility. |
| `inbox` | **Excluded entirely — not a low authority tier, a non-classification.** Not retrievable into any stage-facing `MemoryContext` until re-filed into a real type. | Default-excluded from production, not merely low-priority or low-ranked. |

**Every classification above — including "always," "permanently," and "only" — is conditioned on
content inspection actually confirming the record matches that row's typical class**, per
`MEMORY_CONTEXT.md`'s identical override note. A `lesson`/`playbook`/`incident`/`pattern`/
`reference`/`project` record whose body, on inspection, actually describes a historical user
statement is redirected to the Historical User Provenance Gate, never treated as "misfiled and
excluded" or foreclosed by its row's typical label — `inbox` alone is a genuine, unconditional,
type-determined exclusion.

## Phase 5 — Historical User Memory Rule

A direct statement made by the user in a prior run was genuinely User-Provided *in that historical
interaction*. It has no automatic standing as a User-Provided Claim in a *new* `IntentSpec`:

> A historical user statement, retrieved via `MemoryContext` — **whatever the record's stored Brain
> `type`, since `type` is only a weak classification prior, never an epistemic shortcut past this
> gate** — may serve as a stated, cited premise for a current-run Inferred Claim — **only when
> classified Category A (direct): inspectably and resolvably traceable to an original historical
> user-authored source, per `MEMORY_CONTEXT.md`'s "Historical User Provenance Gate."** A
> citation-shaped string that does not actually resolve to a checkable source does not qualify. A
> Category B (derived/unverified) entry — reading like a user statement but lacking that inspectable,
> resolvable traceability, the honest default given Brain's actual schema has no field guaranteeing it
> on any type — may never serve as such a premise, at any confidence or repetition level; it is
> restricted to the second path below. Where Category A applies, the premise carries its own
> confidence, its own provisional/reversible marking, and explicit premise citation — exactly
> Inference Policy's existing discipline, extended to a premise that happens to be an external,
> well-provenanced artifact rather than another `IntentSpec` Claim. Either category may serve as
> informational input shaping a candidate clarification question posed to the *current* user. It
> never becomes a current-run User-Provided Claim merely because the user originally said it —
> regardless of how directly it matches, how recent it is, or how many times it was repeated
> (extending I-16 to the memory axis: repetition never *by itself* increases a memory's authority,
> though a genuinely independent additional signal may contribute via its own stated reasoning —
> see `MEMORY_CONTEXT.md`'s M-07). Nor does its own historical normative force (obligation,
> prohibition, permission, preference) become the current Inferred Claim's force merely by
> citation — the current Claim's force is independently, explicitly reasoned (see "Historical Force
> Is Not Current Force" in `MEMORY_CONTEXT.md`).

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
clarifying question gets asked* (`DISCOVERY_ATTENTION` — it may shape the question's content, never
answer it), never substitute for asking it.

**LOW/MEDIUM Decision Impact: memory may defensibly reduce repeated clarification.** Conditions,
all required: (a) surfaced as an explicitly-marked, provisional, reversible candidate — either a
marked default (mirroring how Requirement Derivation may fill an R-19-eligible Unknown) or a
labeled Inferred Claim, never presented as settled without qualification; (b) remains visible in
provenance, never silently applied; (c) yields immediately to the current `UserIdea` if it says
anything relevant at all (Phase 6); (d) repetition across past occurrences never **by itself**
increases its standing or confidence (I-16, extended) — a genuinely independent additional signal may
still contribute, but only via its own separately stated reasoning and provenance, never via mere
count (see `MEMORY_CONTEXT.md`'s M-07).

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

Deterministic precedence, in all cases: the current run's own authoritative input wins. Production
performs only Category-A (mechanical/lifecycle) admissibility checks (see "Separating Admissibility
from Interpretation" in `MEMORY_CONTEXT.md`); detecting that a memory's content actually contradicts
current-run meaning is a Category-B semantic judgment, and belongs exclusively to whichever consuming
stage already owns that interpretation — never to `MemoryContext` production itself.

| Current-run authority | vs. | Memory | Precedence | Who detects/records the conflict |
|---|---|---|---|---|
| Current `UserIdea` | vs. | Historical preference | Current wins, always | The **consuming stage** (Intent Parsing), in its own artifact's provenance — never `MemoryContext` production, and never recorded as an `IntentSpec` Conflict (the memory was never elevated to Claim status, so `IntentSpec`'s Conflict machinery, defined over Claims, does not apply; see `MEMORY_CONTEXT.md`) |
| Current `UserIdea` | vs. | Past project decision | Current wins, always | Same as above |
| Current project canonical state | vs. | Historical Brain summary | Current wins, always | Whichever stage relies on the canonical state; Brain summary treated as advisory/candidate-recall only |
| Current authoritative Evidence | vs. | Cached/stale technology memory | Current wins, always | Research + Evidence Collection, at re-verification time; cached memory may prompt re-verification (a research hint), never substitutes for the current Evidence entry |

Whether a contradiction should additionally trigger clarification depends on the contradicted
item's own Decision Impact, computed exactly as `INTENT_SPEC.md` already computes it for any other
item — memory contradiction is **not a new, independent blocking mechanism**, and is never something
production itself decides to escalate, since production never detects it in the first place. If the
contradicted question would be HIGH/CRITICAL on its own merits, the consuming stage's detection may
shape *what* clarifying question gets asked (Phase 5); if LOW/MEDIUM, the consuming stage simply does
not use the entry, recorded in that stage's own provenance, with no clarification required, since
current input already authoritatively answered the question. If the contradiction is instead known
at production time — because the consuming stage's specific, already-computed verdict about that
specific memory entry was itself supplied to production as an explicit input (see "Separating
Admissibility from Interpretation") — production may mechanically record that literal, already-stated
verdict within `MemoryContext`'s own record; it may never form the judgment itself, and merely
supplying an upstream artifact or its version is never sufficient by itself to license this. What must
never happen, at any impact level: silently applying memory
content over current-run authoritative input, or mutating an already-frozen `MemoryContext` snapshot
to reflect a contradiction discovered after production (see Phase 9).

## Phase 7 — Influence Taxonomy: Process-Only, Discovery/Attention, Decision Option, Semantic Premise

An earlier draft of this design used a two-way procedural/semantic split, and called both "review
decomposition" and "expanding what Research Planning searches for" equally "procedural" — but the
second can change `ResearchPlan`'s or `ArchitectureCandidate`'s actual search space and content,
which the first never can. Collapsing these two, materially different effects into one label was
itself a defect, corrected into four properties of a specific *use* of a memory entry, not fixed
properties of the entry itself (full detail in `MEMORY_CONTEXT.md`'s "Influence Taxonomy"). **A
fourth tier, `DECISION_OPTION`, was added during a later closure round**: re-deriving the taxonomy
found a memory-informed R-19 default's specific chosen value becomes Requirement content immediately,
with no further independent screening step the way `DISCOVERY_ATTENTION`'s candidates always have —
forcing it into `DISCOVERY_ATTENTION` would have required weakening that tier's additive-only
invariant, which was rejected:

- **`PROCESS_ONLY`**: changes *how* MIHVER performs its own internal work — review decomposition,
  verification rigor, which invariant axes get tested, how many independent reviewers are dispatched.
  Has **zero** pipeline-artifact-content effect, in either direction, ever. `lesson` and `playbook`
  types are `PROCESS_ONLY` under every use and structurally cannot cross into another category.
- **`DISCOVERY_ATTENTION`**: proposes additional research questions, candidate technology
  categories, or architecture shapes for a stage to *consider* — it may alter that stage's search
  space and, downstream, the content of `ResearchPlan`, `TechnologyCandidateSet`, or
  `ArchitectureCandidate` (which is exactly why it is not `PROCESS_ONLY`; this tier is not "zero
  content effect until a later gate" — it can affect intermediate content immediately, additively),
  but it never itself **establishes** truth, eligibility, a Requirement, or a preference: a further,
  independent mechanism (Evidence sourcing, eligibility screening, Evaluation) is always still
  required before any candidate this tier proposes counts as settled. It must be **additive** (never
  narrowing or substituting for what would otherwise be checked) and **provenance-visible** (the
  stage's own record of why it looked where it looked must cite the memory). `pattern`, `incident`,
  and `reference` types are typically `DISCOVERY_ATTENTION` when used to shape where a stage looks.
- **`DECISION_OPTION`**: proposes a candidate *value* within a decision a stage **already,
  independently owns and is already authorized to make** — unlike `DISCOVERY_ATTENTION`, its adoption
  **is** the immediate establishment of the Requirement's actual content, in the same step, under
  authority the stage already had; no further independent mechanism remains to clear afterward. It
  supplies **zero independent authority** for the value chosen and never expands what the stage was
  already allowed to decide. Must be **provenance-visible** and **non-obligating** (the stage must be
  able to justify the final choice under its own pre-existing authority alone). The only
  currently-named instance is a memory-informed R-19-eligible working default at Requirement
  Derivation (Phase 11) — not a general license to invent new memory-authorized
  decision points elsewhere.
- **`SEMANTIC_PREMISE`**: the capacity to directly support a Claim, Requirement, or equivalent
  pipeline-artifact content — reached only by separately clearing the full corresponding epistemic
  or evidence gate (Phase 5's Historical User Memory Rule for Claims; Phase 8 for Evidence), never by
  mere retrieval or by accumulating `DISCOVERY_ATTENTION` or `DECISION_OPTION` uses (`DECISION_OPTION`
  is in fact categorically barred from ever reaching `SEMANTIC_PREMISE` — see above). **This is not
  symmetric across memory kinds:** a Category A historical statement reaches `SEMANTIC_PREMISE` *directly* — the
  `MemoryContext` entry itself is cited as the Inference's premise. A `pattern`/`incident`/`reference`
  entry **never** itself reaches `SEMANTIC_PREMISE`, at any amount of re-verification — "memory is
  never Evidence" is an identity boundary, not a freshness gate a well-verified memory eventually
  clears. What reaches `SEMANTIC_PREMISE` there is an entirely separate, newly-produced
  `EvidenceBundle`/`TechnologyCandidateSet` artifact; the originating memory's own classification
  stays `DISCOVERY_ATTENTION` permanently (see `MEMORY_CONTEXT.md`'s "Identity Boundary, Not Merely a
  Freshness Gate").

The same `pattern` memory ("past architecture used a message queue for decoupling") illustrates the
full chain: it may inform Research Planning's search strategy as `DISCOVERY_ATTENTION` — additive,
provenance-visible, never narrowing what would otherwise be checked — while **itself remaining
permanently `DISCOVERY_ATTENTION`**. A wholly new `EvidenceBundle` entry, independently produced by
Research + Evidence Collection, and then a separately-produced `TechnologyCandidateSet`/
`ArchitectureCandidate` entry (after Technology Candidate Identification's eligibility screening), may
reach `SEMANTIC_PREMISE` standing — the originating memory is never itself what reaches it (see
"Identity Boundary, Not Merely a Freshness Gate" in `MEMORY_CONTEXT.md`).

**Honest worked example, per this task's explicit instruction:** the `cross-axis-invariants-
require-explicit-review-contracts` lesson (`96500b29`), retrieved and applied during M0 Step 03A's
own later review rounds, is precisely this pattern. It changed *how* Claude reviewed
`REQUIREMENT_SPEC.md` — adding pairwise-interaction scrutiny to independent verification — and it
never touched, and could never legitimately have touched, what the user's own Requirements were.
That is the exact shape every future engineering-lesson memory must be held to.

## Phase 8 — Memory and Evidence (boundary only; `EvidenceBundle` itself remains undesigned)

| Path | Allowed? | Condition |
|---|---|---|
| memory → search/research hint (`DISCOVERY_ATTENTION`) | Allowed once Research Planning is separately authorized to consume `MemoryContext` (not yet performed) | Only *additive* — informs Research Planning's own query strategy without narrowing or skipping requirement-derived coverage; never appears in `RequirementSpec`/`ArchitectureCandidate` content directly. |
| memory → candidate evidence requiring freshness/source verification (`DISCOVERY_ATTENTION`; the memory itself never advances beyond this tier) | Allowed, gated | Hands Research + Evidence Collection a lead to independently re-source, re-version, re-date, and re-confidence per Principle 5, producing a wholly new artifact that alone may reach `SEMANTIC_PREMISE` — the cached memory is never itself the citation, and never itself becomes that new artifact. |
| memory → direct `EvidenceBundle` entry | **Never allowed** | A cached "Framework X supports feature Y" cannot supply a *current* verification date, and Principle 5 requires one. Re-verification, not memory recall, is what produces a valid entry. |

This preserves Principle 2 (no material recommendation on assertion alone — a remembered assertion
included) and Principle 5 (freshness is explicit — a cached claim's age is exactly what memory
cannot make current by being remembered confidently).

## Phase 9 — Reproducibility

A past `ArchitectureDecision` must remain reconstructable (Principle 11). Brain's own vault is
mutable — records get superseded, reindexed, potentially edited — so **the raw Brain index is not
sufficient to reproduce a past run's memory context; only a frozen `MemoryContext` snapshot is.**
Two genuinely different kinds of fact are involved, and they must not be conflated into one mutable
record: facts knowable **at production time** belong to the frozen snapshot itself; facts only
knowable **later, at or after consumption** belong to the *consuming artifact's own* provenance,
never written back into, or used to mutate, the frozen snapshot (see `MEMORY_CONTEXT.md`'s
"Reproducibility" for the full split).

Conceptually (no JSON fields chosen here — deferred per `M0_SCOPE.md`'s own field-design deferral
pattern), **preserved in the frozen `MemoryContext` snapshot itself, fixed at production time:**

- the identities this `MemoryContext` is bound to (`RunContext`-or-absence, consuming stage,
  retrieval purpose, upstream artifact version — see "MemoryContext Lifecycle and Invalidation" in
  `MEMORY_CONTEXT.md`);
- which memories were retrieved (stable Brain memory IDs), and an explicit retrieval-outcome
  discriminator (admitted, successfully-empty, or retrieval-unavailable — three distinct facts);
- each memory's own content, retained as an actual copy at production time — not merely a hash or
  pointer into Brain's mutable vault — plus its canonical version/identity;
- retrieval time/snapshot, distinct from the memory's own `created`/`updated` timestamps;
- the retrieval query and its purpose;
- each memory's Brain-recorded scope and provenance (`source`/`author`);
- the authority classification assigned at production (Phase 4) — not re-derivable from Brain alone —
  together with its classification basis, method (deterministic or heuristic/model-assisted), and any
  ambiguity encountered (`MEMORY_CONTEXT.md`'s "Classification Fail-Closed Rule");
- the freshness/temporal-standing judgment made at production time (distinct from Brain's own
  `status`) — a mechanical, age/lifecycle-based fact, never a judgment that the underlying claim is
  still true (`MEMORY_CONTEXT.md`'s M-05);
- why it was admitted or excluded (the retrieval rationale, for both outcomes);
- which stage was authorized to use it.

**Preserved separately, in whichever consuming artifact's own provenance actually uses the entry, not
in the frozen snapshot:**

- **whether it actually influenced output** — a post-hoc fact, not knowable at retrieval time,
  essential to Explainability (Principle 10) and to honestly distinguishing "retrieved but unused"
  from "retrieved and load-bearing," the same distinction Phase 7's worked example depends on;
- whether a later-discovered contradiction marks the entry stale-for-this-run (Phase 6) — recorded in
  the contradicting artifact's own provenance, never by editing the frozen `MemoryContext` snapshot.

## Phase 11 — Foundation Impact Analysis

No frozen document is modified in this task. Required future changes, classified:

- **`M0_SCOPE.md` — `SEMANTIC_AMENDMENT_REQUIRED`, broader than originally scoped.** An earlier draft
  of this ADR framed the required `M0_SCOPE.md` amendment as narrowly as "add `MemoryContext` to a
  stage's declared `Input:` list." On independent review this undercounts what is actually required,
  in three distinct ways:
  1. **A non-memory scope anchor must be introduced.** M0's current milestone input is declared as
     only `UserIdea` (`M0_SCOPE.md`'s own "Milestone Input and Output"). This design's
     `RunContext` — the current run's project-identity anchor, established outside Brain and outside
     the pipeline's own artifact chain (see `MEMORY_CONTEXT.md`'s "Current-Run Scope Anchor") — has
     no home in the current foundation at all. The amendment must introduce this concept (name
     illustrative, not fixed here) as something the milestone or its stages may consult, not merely
     add a new artifact name to an existing stage's input list.
  2. **The `MemoryContext` producer boundary needs its own documented contract, not just a
     consumer-side input declaration.** Per this ADR's "MemoryContext Producer: Role and Authority,"
     production is a cross-cutting compiler boundary invoked by multiple stages, not a linear
     pipeline stage — `M0_SCOPE.md`'s existing stage-table format (one row per linear stage) does not
     naturally accommodate it. The amendment must define this boundary's own semantic role (inputs,
     output, allowed/not-allowed decisions) somewhere in the foundation, the way `M0_SCOPE.md`
     already documents each pipeline stage — not merely note, on the consuming stage's own row, that
     `MemoryContext` is now an accepted input.
  3. **Each consuming stage's own `Input:` list amendment remains required, and remains
     stage-specific** — Intent Parsing, Research Planning, Architecture Synthesis (per
     `MEMORY_CONTEXT_CASES.md`'s Cases 7, 8, 20 — corrected during review from an earlier draft that
     named only the first two as "plausible"), **and Requirement Derivation** (added this remediation
     round — `MEMORY_CONTEXT.md`'s "No Assumed-Origin Path for Memory" already grants Requirement
     Derivation a concrete memory-informed-R-19-default capability, contingent on its own separate
     `M0_SCOPE.md` amendment; omitting it from this list left Foundation Impact Analysis silently
     incomplete for a capability this ADR itself keeps) are named as candidates, not an exhaustive
     list; each stage's own amendment must be separately, explicitly authorized.
  None of this is performed by this task — it is named here precisely so a future amendment task
  does not under-scope itself the way this ADR's own earlier draft did.
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
- **`REQUIREMENT_SPEC.md` — `SEMANTIC_AMENDMENT_REQUIRED`, two distinct dependencies, not one:**
  1. **Requirement-Level Inference mechanism** (corrected on independent review, for the identical
     reason as the `INTENT_SPEC.md` item above — an earlier draft classified this `NO_CHANGE`, which
     did not hold up once the parallel case was checked). R-10/R-22 define a Requirement-Derivation-
     level inference's premise as "the accepted Claim or Requirement it derives from" — not an
     external `MemoryContext` entry. The same broadening problem recurs one stage later: citing a
     memory entry as such a premise requires `REQUIREMENT_SPEC.md` to recognize a new premise kind,
     not merely the `M0_SCOPE.md` input-declaration amendment already identified above. Until both
     amendments exist, Requirement Derivation may not cite a `MemoryContext` entry as a
     Requirement-Level Inference's premise either.
  2. **Memory-informed R-19 default provenance** (added this remediation round — an earlier draft of
     this ADR permitted a memory-derived value to inform an R-19-eligible working default at
     Requirement Derivation, per "No Assumed-Origin Path for Memory" in `MEMORY_CONTEXT.md`, but did
     not name the corresponding `REQUIREMENT_SPEC.md` amendment this capability actually requires,
     leaving Foundation Impact silently incomplete for a capability the ADR itself keeps). R-09
     already requires an R-19-eligible default to be marked Requirement-Derivation-introduced with its
     own stated rationale; where a `MemoryContext` entry informed the choice of value, that rationale
     must additionally, explicitly cite the entry as a **memory-informed rationale**, distinct from
     any `IntentSpec`-recorded provenance — mirroring R-10/R-22's own premise-citation discipline, at
     R-09's simpler default-filling mechanism. This is `DECISION_OPTION` influence (Phase 7, corrected
     during a later closure round from an earlier draft that mislabeled it `DISCOVERY_ATTENTION`) —
     the memory supplies zero independent authority for the value chosen; R-09/R-19's own mechanism is
     what authorizes it. This is a narrower amendment than item 1 (R-09/R-19 already exists and
     permits memory-informed defaults in principle; only the citation/labeling requirement is new), but
     it is still a required, separate, explicit amendment, not something this ADR performs or
     pre-authorizes.
- **Future `EvidenceBundle` — `CLARIFICATION_ONLY`.** `EvidenceBundle` does not exist yet (`ADR-0001`
  explicitly defers its design). Phase 8's boundary is a constraint on that future design ("memory
  may motivate re-verification, never substitute for it"), not a change to anything currently
  written, since nothing is currently written.
- **Final `MihverArchitectureSpec` — `NO_CHANGE`.** This design introduces no new claim about what
  the final spec must contain; `MemoryContext`'s influence, if any, is already fully absorbed into
  `RequirementSpec`/`EvidenceBundle`/`ArchitectureCandidate` content upstream, by the time
  Specification Generation runs.

### Acceptance Gate — decided explicitly, not left ambiguous

Four distinct amendment dependencies are named above, and they do not all gate the same thing.
**Core `MemoryContext` consumption** — retrieval, mechanical/lifecycle admissibility, `PROCESS_ONLY`
and `DISCOVERY_ATTENTION` use by any given stage — requires only that stage's `M0_SCOPE.md` amendment
(dependency A: `RunContext` + the producer's own documented contract + that stage's declared
`Input:` entry). **Citing a historical-memory entry as an Inferred Claim's premise** additionally
requires the separate `INTENT_SPEC.md` amendment (dependency B). **Citing a memory entry as a
Requirement-Level Inference's premise** additionally requires the separate `REQUIREMENT_SPEC.md`
Requirement-Level-Inference amendment (dependency C). **A memory-informed R-19 default**
(`DECISION_OPTION` influence) additionally requires the separate, narrower `REQUIREMENT_SPEC.md`
provenance amendment (dependency D). Dependencies B, C, and D are each independently required only
for the specific, narrower semantic path they gate — none of them is a precondition for dependency A,
and dependency A is not a precondition for any specific one of B/C/D beyond the general one of "that
stage must already be authorized to consume `MemoryContext` at all" before it can go further.

**This ADR becomes eligible for Accepted status once dependency A alone — the core `M0_SCOPE.md`
integration boundary (`RunContext`, the producer's own contract, and at least one consuming stage's
declared `MemoryContext` input) — is separately, explicitly human-authorized, completed, and has
itself been adversarially reviewed against real cases: the same condition `ADR-0002` was actually
held to and satisfied (Status: Accepted), and the same kind of condition `ADR-0003` has separately
proposed for its own eventual Acceptance (Status, as of this writing: still Proposed — it is a
parallel precedent for the *shape* of the condition, not a completed example of this ADR's own
criterion being met).** It does **not** require dependencies B, C, and D to all be complete first.
Reaching `SEMANTIC_PREMISE` via the historical-user-memory path (dependency B/C) and reaching
`DECISION_OPTION` via a memory-informed R-19 default (dependency D) remain **explicitly, structurally
disabled** — not merely "future work," but unavailable by construction, exactly as they are today —
until their own respective amendments are separately, explicitly human-authorized and completed, each
its own future task, independent of this ADR's own Status.

**Why this option, not requiring every amendment first:** (1) it mirrors `ADR-0001`'s own IR-per-stage
pattern, where a bounded artifact's core definition is accepted independently of every future consumer
that might eventually cite it — `RequirementSpec` did not wait for `ArchitectureCandidate` to exist
before `ADR-0001` could describe it soundly; (2) the core boundary (`RunContext`, the producer's own
authority, least-authority classification, the admissibility/interpretation split, the influence
taxonomy) is what actually requires adversarial scrutiny as a foundational compiler-authority-boundary
decision — dependencies B, C, and D are narrower, additive semantic capabilities layered *on top* of
an already-sound boundary, not part of the boundary's own soundness; (3) gating Acceptance on every
possible downstream semantic capability would make this ADR hostage to separately-scoped future
amendment tasks with their own independent review timelines, unnecessarily coupling independently
scoped amendment timelines and working against Principle 12's (Evolvability) underlying objective —
introducing a new capability without redesigning MIHVER's core — and against this ADR's own repeated
practice of naming amendments honestly and narrowly rather
than bundling them into one all-or-nothing gate.

## Decision

Adopt **Model C**: a typed, immutable `MemoryContext` artifact, produced by a dedicated retrieval
boundary from MIHVER Brain, carrying an explicit authority classification per entry (Phase 4),
consumable by a stage only once that stage's `M0_SCOPE.md` input list is separately amended to
declare it (dependency A) — and, for any use that would cite a `MemoryContext` entry as the premise
of an Inferred Claim (dependency B) or a Requirement-Level Inference (dependency C), or would inform
a memory-informed R-19 default (dependency D), only once the corresponding `INTENT_SPEC.md` and/or
`REQUIREMENT_SPEC.md` amendment is *also* separately completed (Phase 11 / "Acceptance Gate" — each a
distinct, additional requirement from the `M0_SCOPE.md` input-declaration amendment, not subsumed by
it, and not a precondition for this ADR's own Acceptance). `MemoryContext` is never a `Claim`, never
`Evidence`, never merged into `UserIdea`, and never queried directly by any stage. Full semantic
detail is in [MEMORY_CONTEXT](../contracts/MEMORY_CONTEXT.md); worked adversarial cases are in
[MEMORY_CONTEXT_CASES](../examples/MEMORY_CONTEXT_CASES.md).

## Rationale

- **Extends, rather than reinvents, the compiler-IR pattern (`ADR-0001`).** Each `MemoryContext` is a
  bounded, immutable IR like `RequirementSpec` or `ArchitectureCandidate` — never a live conversational
  surface — though produced repeatedly, once per authorized invocation, by a cross-cutting boundary
  rather than once by a single linear stage (Phase 3, Model C).
- **Extends ADR-0002's origin discipline instead of adding a parallel one.** Historical memory, when
  it does become an `IntentSpec` Claim at all, is folded into the *Inferred* origin Claims already
  use — never a fourth, unprincipled origin category, and never Assumed: Assumption Policy restricts
  Assumptions to narrowly interpretive gaps, never operational defaults, and a historical preference
  is exactly the latter, not the former (see "Historical User Memory Rule" in `MEMORY_CONTEXT.md`).
- **Makes the four-tier Influence Taxonomy (Phase 7) load-bearing, not incidental** — it is what
  lets MIHVER benefit from engineering-lesson memory (as this very session already has) without any
  risk of that benefit leaking into a user's actual Requirements.
- **Names its own cost honestly.** Model C is the most complex option and requires a real,
  separate `M0_SCOPE.md` amendment — this ADR does not hide that behind "Proposed" status; it names
  exactly what the amendment is and why (Phase 11).

## Consequences

- No stage may consume `MemoryContext` until `M0_SCOPE.md` is amended for that specific stage; this
  ADR's Status stays Proposed until dependency A (see "Acceptance Gate") is separately, explicitly
  human-authorized, completed, and adversarially reviewed — not until every possible consuming stage
  is amended, only the core boundary plus at least one.
- Every future memory-consuming stage must additionally state, in its own future contract work,
  which authority classes it is permitted to use for which of the four Influence Taxonomy tiers
  (`PROCESS_ONLY`/`DISCOVERY_ATTENTION`/`DECISION_OPTION`/`SEMANTIC_PREMISE`, Phase 7) —
  `MemoryContext`'s existence does not itself grant blanket permission.
- `MemoryContext` production becomes a new, disciplined boundary. Its authority boundaries are
  designed here (mechanical scope admissibility against `RunContext`, age/lifecycle-based freshness
  flagging, admissibility-vs-interpretation separation — see "MemoryContext Producer: Role and
  Authority" in `MEMORY_CONTEXT.md`); only its machine-readable schema and runtime query-construction
  mechanics remain deferred design work.
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
  content from being stored as `reference`, `pattern`, `incident`, or another non-`decision` type
  instead. **Mitigation, corrected this closure round from an earlier draft that only named the risk
  without closing it:** the Historical User Provenance Gate (`MEMORY_CONTEXT.md`, Invariant M-18) is
  explicitly type-independent — any admitted record that production's own content inspection reveals
  as describing a historical user statement is gated into Category A/Category B identically,
  regardless of its stored Brain `type`; a misfiling into `reference`/`pattern`/`incident` does not
  bypass the gate, since the gate is triggered by what content-inspection reveals, never by which
  table row the stored `type` would otherwise suggest. A misfiling into `inbox` specifically is not an
  admission-safety risk at all: `inbox` records are excluded from `MemoryContext` production entirely,
  on `type` alone, before any content inspection or provenance-gate question is reached — the residual
  cost of such a misfiling is coverage loss (a legitimate historical statement never surfaces at all),
  not a laundering risk requiring content-level detection.
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
  granting a stage a blanket `DISCOVERY_ATTENTION` allowance.
- Within each authorized stage/purpose/upstream-version binding (the settled cardinality — production
  is invoked repeatedly, once per authorized retrieval, never once per run as a singular artifact; see
  "MemoryContext Producer: Role and Authority" in `MEMORY_CONTEXT.md`), exactly when should a given
  invocation be scheduled or repeated (e.g. once per clarification cycle, or freshly on every
  consuming-stage entry)? Deferred as an implementation/scheduling concern, per this task's explicit
  scope — the cardinality itself is not open, only the scheduling mechanics are.
- Should Brain ever gain a dedicated memory type or field for "historical user statement," rather
  than relying on the `decision`-type convention this design recommends? Deferred — would require a
  `mihver-brain` change, explicitly out of scope for this task.
- What does `MemoryContext`'s relationship to a future `EvidenceBundle` look like once
  `EvidenceBundle` itself is actually designed? Deferred, per Phase 8's explicit scope limit.

## Future Work

- Design and human-authorize the core `M0_SCOPE.md` amendment identified in "Foundation Impact
  Analysis" (dependency A: `RunContext`, the producer's own contract, at least one consuming stage's
  declared input).
- Only once that amendment lands: design `MemoryContext`'s machine-readable schema (deliberately not
  done here, mirroring `ADR-0002`/`ADR-0003`'s own schema deferral).
- Design the actual retrieval-boundary implementation (query construction, scope/supersession
  verification, freshness judgment) that produces `MemoryContext` from Brain.
- **Revisit this ADR's Status (Proposed → Accepted) once dependency A is completed and at least one
  adversarial review pass has exercised the model against real cases** — per "Acceptance Gate" above,
  this does not require dependencies B/C/D (the `INTENT_SPEC.md` amendment, the
  `REQUIREMENT_SPEC.md` Requirement-Level-Inference amendment, or the `REQUIREMENT_SPEC.md` R-19
  provenance amendment) to be complete first; those remain their own, separate, later tasks, each
  gating only the specific narrower semantic path it names, never this ADR's own Acceptance.
- As separate, later, explicitly human-authorized tasks, whenever undertaken: the `INTENT_SPEC.md`
  amendment (dependency B), the `REQUIREMENT_SPEC.md` Requirement-Level-Inference amendment
  (dependency C), and the `REQUIREMENT_SPEC.md` R-19 provenance amendment (dependency D) — each
  enabling exactly the one narrower semantic path it names, per "Acceptance Gate" above.
