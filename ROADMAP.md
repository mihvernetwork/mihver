# MIHVER — Master Roadmap

> Durable navigation for the evolution of Mihver Architect, MIHVER Brain, unattended execution, and future governed autonomy.

**Document status:** Living roadmap / navigation document — **not** a replacement for ADRs, contracts, schemas, or `.project/PROJECT_STATE.md`.

**Live repository state:** run `npm run context` and consult `git`/`gh` directly. This roadmap
deliberately does not pin current `main`'s `HEAD` — that field goes stale after virtually every
merge and works against this document's own anti-drift purpose. Historical PR/commit references
below describe completed checkpoints, not current `HEAD`.

**Current product milestone:** **M0 — Idea → Architecture**.

---

## 0. How to use this document

This file exists to prevent long-running MIHVER development from becoming dependent on chat history or one person's memory. It records the **direction, dependency graph, historical checkpoints, subsystem boundaries, and intended future architecture** in one place.

It is intentionally **not** the authority for live repository state.

When sources disagree, use this priority order:

1. **Live git / GitHub reality** — branch, HEAD, merge state, working tree.
2. **The artifact that owns the fact** — e.g. an ADR's own `## Status`, a contract's own invariant, an accepted schema.
3. **`.project/PROJECT_STATE.md`** — durable global checkpoint summary.
4. **`.project/CURRENT_TASK.md` / `.project/REVIEW_STATE.md`** — branch-scoped work and review state.
5. **This `ROADMAP.md`** — direction and system-wide navigation.
6. Conversation summaries, prompts, notes, and research reports.

A roadmap entry marked "planned" is not authorization to start it. `REVIEW_PROTOCOL.md` and `.project/PROJECT_STATE.md` remain the gate for what is authorized next.

### Editing policy

This document is a **MIRROR / NAVIGATION** file, not an OWNER — see `docs/development/AGENT_POLICY.md`'s
"Document Authority Model". A new or updated entry should state status, dependency order, its
PR/commit checkpoint, and a pointer to the artifact that actually owns the semantic content, plus a
short reason for its place in the ordering — not restate that artifact's full invariant model. Prefer:

```text
Dependency D — DONE
Authority:
  M0_SCOPE.md / Stage: Requirement Derivation
  REQUIREMENT_SPEC.md / R-24
Merge:
  PR #27 / bb70a9e
```

over reproducing R-24's entire semantic model inline (see section 10.13 below for the fuller worked
entry this repository's history actually used before this policy was written — not itself rewritten
by this policy note). This is a standing editing rule for future entries; it does not require
reworking the existing sections below to the compact shape.

### Status legend

- **DONE** — merged, stable checkpoint on `main`.
- **RETIRED** — a planned capability was deliberately not implemented, after a mandatory
  pre-implementation re-derivation found it redundant or unsound; distinct from **DONE** (the
  capability exists) and **PLANNED**/**NEXT** (not yet authorized, still a live future candidate).
- **ACCEPTED** — ADR/decision has explicitly reached Accepted status.
- **PROPOSED** — merged design exists, but its acceptance gate is not yet satisfied.
- **NEXT** — recommended next dependency when separately human-authorized.
- **PLANNED** — directional roadmap item; not yet authorized.
- **EXPERIMENTAL** — useful implementation/research exists, but is not yet part of the authoritative M0 product pipeline.
- **PRIVATE / VERIFY LOCALLY** — known from the private MIHVER Brain development track; exact state must be re-checked in the private repository before action.

---

# 1. Product thesis

MIHVER is **Mihver Architect**: an architecture intelligence platform that compiles a user's idea into an evidence-backed, validated, best-fit system architecture.

The M0 product promise is:

```text
UserIdea
    ↓
IntentSpec
    ↓
RequirementSpec
    ↓
ResearchPlan
    ↓
EvidenceBundle
    ↓
TechnologyCandidateSet
    ↓
ArchitectureCandidate[]
    ↓
ArchitectureDecision
    ↓
MihverArchitectureSpec
```

The platform is not a chatbot, IDE, or fixed agent framework. It may internally use LLMs, agents, memory, orchestration, sandboxes, and evaluation systems, but those are implementation mechanisms — not the product definition.

A valid MIHVER output may contain:

- zero agents,
- one model call,
- a deterministic workflow,
- one agent,
- a multi-agent system,
- or a hybrid architecture,

provided the choice is justified by the requirements and current evidence.

The platform therefore optimizes for **best fit**, not "most agentic", "newest", or "most complex".

---

# 2. Architectural invariants that constrain the roadmap

The roadmap must preserve the accepted principles in `docs/foundation/PRINCIPLES.md`.

The most important roadmap-level invariants are:

1. **Provider agnosticism** — model/vendor/runtime choices must remain replaceable behind stable contracts.
2. **Evidence before recommendation** — model assertion alone is never enough for a material architecture choice.
3. **Structured artifacts between stages** — stages consume only explicitly declared inputs and emit declared outputs.
4. **Facts and decisions remain separate** — evidence is not a recommendation and memory is not evidence.
5. **Freshness is explicit** — technology knowledge carries source/version/date/confidence/freshness.
6. **Deterministic where possible** — validation, policy, schema, compatibility, and reproducible checks should become code.
7. **LLMs are reasoners, not authorities** — models may propose, interpret, or review; authority lives in contracts, policy, evidence, deterministic gates, or humans.
8. **Multiple architecture candidates** — MIHVER should not turn the first plausible answer into the final decision.
9. **Best fit, not universal best** — architecture is contextual to `RequirementSpec`.
10. **Explainability** — selected, rejected, supporting evidence, tradeoffs, and uncertainty must be inspectable.
11. **Reproducibility** — past decisions must be reconstructable from retained versioned artifacts.
12. **Evolvability** — new models/frameworks/memory approaches should not require redesigning the compiler core.
13. **Security by architecture** — powerful capabilities need an explicit reason and boundary.
14. **Complexity must be justified** — MIHVER must be able to say "you do not need an agent".

These invariants also constrain MIHVER's own future autonomous development system.

---

# 3. Two architectures that must never be conflated

MIHVER development now has two related but separate architectural tracks.

## 3.1 The product compiler

This is the user-facing architecture intelligence pipeline:

```text
UserIdea → IntentSpec → RequirementSpec → ResearchPlan → EvidenceBundle
→ TechnologyCandidateSet → ArchitectureCandidate[] → ArchitectureDecision
→ MihverArchitectureSpec
```

Its contracts and authority boundaries are the primary M0 product.

## 3.2 The internal governed-autonomy stack

This is how MIHVER itself may eventually reason, remember, decide, execute development work, verify it, and run unattended:

```text
Human / Goal
      ↓
Current Repository + Durable State
      +
MIHVER Brain
      ↓
MemoryContext / bounded context
      ↓
Future Decision Council
      ↓
Deterministic Control Plane / Policy
      ↓
Night Runner vNext / unattended coordinator
      ↓
Claude Orchestrator
      ↓
Bounded Workers
      ↓
Independent Verification
      ↓
Accepted Outcome
      ↓
Durable State + governed Brain write-back
```

The second stack must not silently redefine the first stack's contracts. It is internal machinery for developing and eventually operating Mihver Architect.

---

# 4. Historical evolution — what has already been built

## 4.1 Architecture foundation — DONE

**Initial foundation commit:** `56836ee9ae3dcce831c780c14099351ecbaa9c90` — `docs: establish MIHVER architecture foundation`.

Created the first durable architectural baseline:

- `docs/foundation/VISION.md`
- `docs/foundation/PRINCIPLES.md`
- `docs/foundation/M0_SCOPE.md`
- `docs/adr/ADR-0001-ARCHITECTURE-COMPILER-MODEL.md`

### ADR-0001 — ACCEPTED

MIHVER was deliberately modeled as an **architecture compiler**, not one monolithic autonomous chatbot.

This established:

- explicit intermediate artifacts,
- bounded stage authority,
- rejection/failure as valid stage outcomes,
- deterministic checks where possible,
- orchestration technology as replaceable implementation detail,
- Requirement IR (`RequirementSpec`) and Architecture IR (`ArchitectureCandidate`) as first-class design concepts.

This remains the structural foundation for everything that follows.

---

## 4.2 M0 Step 02A — Intent semantic contract — DONE

**Merged via PR #1:** `218bced`.

Primary artifacts:

- `docs/contracts/USER_IDEA.md`
- `docs/contracts/INTENT_SPEC.md`
- `docs/adr/ADR-0002-EPISTEMIC-PROVENANCE-MODEL.md`
- `docs/examples/INTENT_CASES.md`

The key result was an epistemically explicit Intent model.

### Core concepts established

- `UserIdea` remains the immutable source record of what the user actually supplied.
- `IntentSpec` distinguishes:
  - User-Provided Claims,
  - Inferred Claims,
  - Assumed Claims,
  - Open Items (`Unknown` / `Ambiguity`),
  - Conflict relationships.
- Normative force, user hedging, discourse role, speaker attribution, condition/scope, and provenance are independent axes.
- A user assertion is not automatically an objective fact.
- HIGH / CRITICAL unresolved items block Requirement Derivation.
- A Blocked `IntentSpec` version never becomes eligible later in place; resolution creates a superseding version.
- Assumptions may bridge narrow interpretive gaps, not invent arbitrary technical defaults.
- Intent Parsing must not leak architecture or technology recommendations forward.

---

## 4.3 M0 Step 02B — Intent schemas and validation — DONE

**Merged checkpoint:** `0683e84`.

Created:

- `schemas/m0/user-idea.schema.json`
- `schemas/m0/intent-spec.schema.json`
- contract fixtures,
- `tests/contracts/validate-contracts.mjs`,
- `docs/contracts/SCHEMA_MAPPING.md`.

Current contract suite: **32/32**.

The important architectural lesson was that semantic contracts and machine-enforced schema validation are separate layers. Some invariants are structurally enforceable; others remain semantic/review invariants.

---

# 5. Development operating model and context infrastructure

## 5.1 Human / Claude / Codex model — DONE as current development process

The present development model is documented in:

- `CLAUDE.md`
- `docs/development/AGENT_POLICY.md`
- `docs/development/REVIEW_PROTOCOL.md`
- `docs/development/TASK_TEMPLATE.md`

Current roles:

```text
Human
  ↓ final authority / merge gate
Claude
  ↓ Principal Architect / Orchestrator
Codex workers
  ↓ bounded implementation / review tasks
Independent review
  ↓
Human merge decision
```

Important operating rules:

- no direct development on `main`,
- branch-first,
- bounded task scope,
- explicit forbidden scope,
- worker cannot self-approve,
- producer should not be sole reviewer,
- completion of one task does not authorize the next,
- merge is a separate human gate,
- state files are scoped by role and lifetime.

This model is intentionally transitional: the future Decision Council may remove the human/ChatGPT manual decision-transport loop for low-risk work, but not the governance principles behind it.

---

## 5.2 Project Context Bootstrap — DONE

**PR #3:** `c5d3dc8`.

Later state/review hardening:

- PR #4 — `6a399c7`
- PR #5 — `fdc27d4`
- PR #6 — `3f0b53b`

Created the durable context reconstruction layer:

- `.project/PROJECT_STATE.md` — global durable checkpoint only.
- `.project/CURRENT_TASK.md` — branch/task scoped current work.
- `.project/REVIEW_STATE.md` — current review gate + history.
- `.project/CONTEXT_INDEX.md` — context discovery index.
- `.project/DECISIONS_LOG.md` — append-only durable decision/merge facts.
- `scripts/dev/project-context.mjs`
- `npm run context`

### Why this matters

This subsystem is the first explicit defense against long conversation context drift.

A fresh Claude/session should bootstrap from repository truth:

```text
CLAUDE.md
  ↓
npm run context
  ↓
PROJECT_STATE / CURRENT_TASK / REVIEW_STATE
  ↓
required authoritative contracts / ADRs only
```

The model must not rely on a giant historical transcript as its record of truth.

---

# 6. Night Runner — unattended execution foundation

## 6.1 Night Runner planner — DONE / EXPERIMENTAL development infrastructure

**PR #7:** `9a61a0b`.

`docs/development/NIGHT_RUNNER.md` and `scripts/dev/night-runner.mjs` created a deterministic dry-run planner for already-authorized tasks.

Current foundation properties include:

- deterministic queue simulation,
- topologically ordered task dependencies,
- `authorized` gate enforcement,
- `main` rejection,
- per-task timeout,
- bounded retries,
- global runtime/task limits,
- `.project/STOP` whole-queue kill switch,
- explicit `BLOCKED`, `FAILED`, `STOPPED`, and `READY_FOR_HUMAN` outcomes,
- no hidden work invention.

The original planner is deliberately incapable of real execution.

## 6.2 Fresh-Claude single-task executor — DONE / EXPERIMENTAL

**PR #8:** `4590f7a`.

Added `scripts/dev/night-runner-executor.mjs` as the first execution-capable layer.

Important characteristics:

- exactly one explicitly authorized task per invocation,
- one fresh Claude process,
- executor-owned temporary workspace,
- positive tool allowlist,
- bounded timeout,
- `.project/STOP` checks,
- task branch must not be `main`,
- no claim that temp workspace alone is a security sandbox,
- no queue-level autonomous decision authority.

### Long-term role

Night Runner should **not be deleted** when the Decision Council arrives.

Its future role becomes:

> **Unattended Run Coordinator / outer execution loop**

It should own scheduling concerns — queue, dependency order, retry, timeout, budget window, pause, STOP, overnight execution — while authorization comes from a future deterministic Control Plane.

Future shape:

```text
Decision Council
    ↓ DecisionRecord
Control Plane / Policy
    ↓ ExecutionEnvelope
Night Runner vNext
    ↓ scheduled authorized execution
Claude Orchestrator
    ↓
Workers
```

Night Runner must never become the authority that decides whether a task is architecturally correct or permitted.

---

# 7. ADR-0002 adversarial review and acceptance

## 7.1 Adversarial review / remediation — DONE

Key checkpoints:

- PR #10 — adversarial review: `548bb75`
- PR #11 — remediation/final consistency/handoff fixes: `63429c9`
- PR #12 — ADR acceptance: `a20d647`

The review process established a durable engineering lesson:

> Reviewer coverage must be decomposed by invariant axis, and cross-axis interactions must be reviewed explicitly.

This lesson later influenced RequirementSpec and MemoryContext reviews.

## 7.2 ADR-0002 — ACCEPTED

The Intent epistemic model is now a frozen accepted checkpoint.

Any later memory, council, or automation feature must preserve its provenance discipline instead of silently redefining `User-Provided`, `Inferred`, or `Assumed`.

---

# 8. M0 Step 03A — Requirement Derivation semantic contract

**PR #13:** `fe79098`.

Created:

- `docs/contracts/REQUIREMENT_SPEC.md`
- `docs/adr/ADR-0003-REQUIREMENT-DERIVATION-MODEL.md`
- `docs/examples/REQUIREMENT_CASES.md`

## 8.1 RequirementSpec semantics — DONE

Major established rules include:

- only eligible, non-Blocked `IntentSpec` versions may be consumed,
- Requirement provenance must remain traceable through `IntentSpec` to `UserIdea`,
- epistemic standing and normative strength are independent,
- force must not inflate or weaken during compilation,
- obligation → MUST,
- prohibition → MUST NOT,
- permissions/preferences preserve their own lower force,
- force-absent descriptive Claims do not automatically become normative Requirements,
- unresolved interpretive Ambiguity/Conflict is never resolved by Requirement Derivation,
- only narrowly eligible operational/measurement Unknowns may receive R-19 working defaults,
- Requirement-Level Inference is bounded,
- Requirement completeness uses intrinsic satisfaction/testability semantics,
- architecture/technology selection remains downstream.

## 8.2 ADR-0003 — PROPOSED

The semantic contract is merged and heavily adversarially reviewed, but ADR-0003 has not yet moved to Accepted.

## 8.3 Step 03B — NOT YET DONE

Still missing:

- `RequirementSpec` JSON Schema,
- fixtures,
- validator mapping/enforcement,
- schema-level adversarial coverage,
- acceptance reconsideration for ADR-0003.

This remains an important near-term M0 dependency.

---

# 9. MIHVER Brain — second-brain subsystem

**Repository:** private sibling project (`mihver-brain`).

**Status in this roadmap:** PRIVATE / VERIFY LOCALLY before modification.

The public MIHVER repository does not contain the Brain implementation. The interface-level role is now constrained by ADR-0004, but exact private-repo implementation state must be checked locally before each Brain task.

## 9.1 Durable architecture developed so far

Known architecture from the Brain track:

```text
Markdown/YAML vault      = canonical source of truth
        ↓
SQLite / FTS5            = rebuildable structured + lexical index
        ↓
Vector index             = rebuildable semantic index/cache
        ↓
CLI / future MCP adapter = agent interface
        ↓
Optional Obsidian        = human UI
```

The design deliberately keeps generated indexes disposable and the human-readable vault canonical.

## 9.2 SB-01 foundation — PRIVATE / STABLE TRACK

The private track has developed concepts including:

- typed Markdown frontmatter,
- deterministic validation,
- `doctor`, `remember`, `search`, `context`, `reindex`, and project-scoped operations,
- Windows-safe atomic writes,
- operation locking,
- explicit supersession relationships,
- rebuildable vector interface,
- deterministic tests.

## 9.3 SB-02 retrieval work — PRIVATE / EXPERIMENTAL

A local model bakeoff selected BGE-M3 over smaller e5 variants for bilingual semantic retrieval.

A later hybrid-retrieval test exposed a key invariant bug: the semantic leg must receive the raw natural-language query, while only the lexical FTS leg receives FTS-safe translation.

The protected Brain retrieval branch must be re-verified locally before any merge/rebase/cherry-pick or integration action.

## 9.4 Brain's long-term role

Brain is **not** the decision authority and is **not** a hidden stage input.

Its role is durable memory:

- historical user statements/preferences,
- project decisions,
- engineering lessons,
- prior architecture outcomes,
- cached research leads,
- stable project knowledge.

The governing invariant is:

```text
memory relevance ≠ truth ≠ authority
```

---

# 10. ADR-0004 — Memory Context Authority Boundary

**PR #15:** `aa1fe66072ae780a910eb458f8263c4886fd37fd`.

**State sync PR #16:** `9fb4ab5e0f64b050c9399a2d24376b688d44d082`.

Created:

- `docs/adr/ADR-0004-MEMORY-CONTEXT-AUTHORITY-BOUNDARY.md`
- `docs/contracts/MEMORY_CONTEXT.md`
- `docs/examples/MEMORY_CONTEXT_CASES.md`

## 10.1 ADR-0004 — ACCEPTED

**Accepted per its own "Acceptance Gate" (10.8): Dependency A alone.** Dependency A merged via
PR #17 (see 10.9) and was adversarially reviewed before that merge; Acceptance itself was recorded
in a later, separate task (`ADR-0004-ACCEPTANCE`). Accepting the core authority model did **not**,
by itself, enable dependencies B/C/D, or imply a `MemoryContext` runtime/Brain adapter exists — B has
since been separately authorized and implemented, C has since been separately re-derived and retired,
and **D has since been separately authorized and implemented** — see 10.7/10.9/10.10/10.11/10.12/10.13
and Phase 9 below for current status.

Selected **Model C**:

```text
Brain
  ↓
MemoryContext Producer
  ↓
immutable, typed, least-authority MemoryContext
  ↓
explicitly-authorized consumer stage
```

No pipeline stage may query Brain directly.

## 10.2 RunContext

ADR-0004 introduced a non-memory `RunContext` concept as the independent run/project identity anchor.

A Brain record can corroborate an already-known project identity, but can never authenticate its own applicability.

Projectless runs remain valid; in that case only globally-scoped memory can mechanically pass scope admission.

## 10.3 MemoryContext Producer

The producer is a **cross-cutting compiler boundary**, not a new linear M0 stage.

Its authority is intentionally narrow:

- retrieval/filtering,
- mechanical scope admission,
- Brain lifecycle/supersession handling,
- mechanical age/lifecycle freshness flags,
- provenance capture,
- least-authority classification,
- fail-closed exclusion.

It may not decide:

- current user meaning,
- semantic contradiction,
- Requirements,
- Evidence truth,
- technology eligibility,
- architecture selection,
- candidate ranking.

## 10.4 Historical user provenance

Any admitted Brain record whose content is classified as a historical user statement must pass the same type-independent provenance gate:

- **Category A — direct historical user statement:** inspectably and resolvably traceable to a user-authored historical source.
- **Category B — derived/unverified user memory:** describes past user intent/preference but lacks direct inspectable provenance.

Only Category A may later become a direct premise for a current Inferred Claim, and only after the corresponding `INTENT_SPEC` amendment.

Category B remains non-authoritative discovery/context.

## 10.5 Four influence tiers

ADR-0004 defines four memory influence modes:

1. **PROCESS_ONLY** — changes how work is performed; zero pipeline-content effect.
2. **DISCOVERY_ATTENTION** — adds things worth researching/considering; additive and provenance-visible, but does not establish truth/eligibility/preference.
3. **DECISION_OPTION** — proposes a value inside a decision a stage already independently owns; supplies zero authority. Currently intended for a memory-informed R-19 working default.
4. **SEMANTIC_PREMISE** — direct support for artifact semantics after the corresponding epistemic gate. Only a qualified Category A historical-user memory may itself be directly cited this way; technology/reference memories never become Evidence.

## 10.6 Memory is never Evidence

Technology/reference/pattern/incident memory may trigger research, but the memory record itself never graduates into Evidence.

The valid shape is:

```text
Memory
  ↓ DISCOVERY_ATTENTION
research lead
  ↓
independent verification
  ↓
NEW Evidence artifact
```

A future Evidence design may decide whether its own prior immutable Evidence artifacts can be re-admitted under a deterministic freshness policy. ADR-0004 does not require a live network refetch on every run.

## 10.7 Dependency gates

ADR-0004 separates four dependencies (Dependencies A and B are now complete — see 10.9/10.10 below;
C has since been retired, not implemented — see 10.11 below; **D has since been implemented — see
10.12/10.13 below**):

### Dependency A — core `M0_SCOPE` integration

Required before **any** MemoryContext consumption.

Must introduce:

- `RunContext`,
- MemoryContext Producer boundary,
- explicit stage-level `MemoryContext` inputs.

### Dependency B — `INTENT_SPEC`

Required only for:

```text
Category A MemoryContext entry
→ current Inferred Claim premise
```

### Dependency C — `REQUIREMENT_SPEC` R-10/R-22

Would have been required for a MemoryContext entry to become a Requirement-Level-Inference premise
directly. **Status: RETIRED, not implemented — see 10.11 below.**

### Dependency D — `REQUIREMENT_SPEC` R-19 provenance

Required only for memory-informed `DECISION_OPTION` working defaults and their explicit rationale
citation. **Status: DONE — see 10.13 below.** Its own prerequisite source-eligibility policy (which
`MemoryContext` entries may ever be a `DECISION_OPTION` candidate) was separately settled first — see
10.12 below.

## 10.8 ADR-0004 acceptance gate

ADR-0004 becomes Accepted-eligible when **Dependency A** is completed and adversarially reviewed.

At the time this Acceptance Gate was originally written, dependencies B/C/D all remained
independently disabled until their own amendments land; they were not required to all exist before
ADR-0004 itself could become Accepted. **B has since been implemented (PR #22), C has since been
re-derived and retired, not implemented (PR #24), and D has since been implemented (PR #27) — see
10.10/10.11/10.13 below.**

**This condition is now satisfied and ADR-0004 is Accepted.** Dependency A merged via PR #17 (merge commit `9416e857b549bea07d4ce06a5c365524fdf1d51a`), was adversarially reviewed before that merge, and the Status transition itself was performed by a later, separate, explicitly human-authorized task (`ADR-0004-ACCEPTANCE`). `ADR-0004`'s own `## Status` field is authoritative for the current Status; `.project/PROJECT_STATE.md`'s "Current Capability Snapshot" mirrors it — not restated further here to avoid this document drifting out of sync with them again. Dependencies B/C/D were not, and are not, prerequisites for this Acceptance. **At the time of this Acceptance, they remained independently disabled; B has since landed, C has since been retired, and D has since been implemented — see 10.10/10.11/10.13 and Phase 9 below for current status.**

## 10.9 Dependency A — DONE (PR #17)

**PR #17:** `9416e857b549bea07d4ce06a5c365524fdf1d51a` — `M0: integrate core MemoryContext boundary into foundation`.

Amended `docs/foundation/M0_SCOPE.md` to establish:

- `RunContext` as a non-memory, cross-cutting run/invocation identity anchor, distinct from `UserIdea` (M0's sole milestone semantic input),
- the `MemoryContext` Producer as a declared cross-cutting compiler boundary (not a new linear pipeline stage),
- **Research Planning** as the first and only stage whose declared `Input:` list includes an optional `MemoryContext`,
- consumption restricted to the `DISCOVERY_ATTENTION` influence tier only — additive and provenance-visible, never authoritative,
- no stage may query MIHVER Brain directly; the only path is `Brain → MemoryContext Producer → immutable MemoryContext → explicitly-authorized stage`,
- Dependencies B/C/D remained, at the time of this checkpoint, structurally disabled;
  `INTENT_SPEC.md`/`REQUIREMENT_SPEC.md` untouched. **B has since landed, C has since been retired,
  and D has since been implemented — see 10.10/10.11/10.13 below.**

**This is a semantic/foundation authorization, not an implemented runtime.** At the time of this
checkpoint there was still no `MemoryContext` schema; one has since been added — see Phase 10 below
(PR #20). No Brain read adapter, and no executable Research Planning pipeline
that actually retrieves anything from MIHVER Brain, exists even now. Research Planning is
*permitted*, under the M0 contract, to consume an optional `MemoryContext` once one is actually
produced — it does not yet receive one in practice.

## 10.10 Dependency B — DONE (PR #22)

**PR #22:** `2cee16af702804127472af0470b3ce4ef2600f88` — `M0: implement Dependency B for Intent
Parsing memory provenance`.

Amended `docs/foundation/M0_SCOPE.md`, `docs/contracts/INTENT_SPEC.md`,
`schemas/m0/intent-spec.schema.json`, and `tests/contracts/validate-contracts.mjs` to establish:

- **Intent Parsing** as the second stage whose declared `Input:` list includes an optional
  `MemoryContext` (Research Planning remains the first, unchanged),
- exactly two authorized influence tiers: `DISCOVERY_ATTENTION` and `SEMANTIC_PREMISE`,
- `DISCOVERY_ATTENTION` — a Category A or Category B historical-user `MemoryContext` entry may shape
  a provenance-visible candidate clarification question; it never itself creates a Claim, resolves
  an Open Item, or substitutes for the current user's own answer,
- `SEMANTIC_PREMISE` — only a Category A entry may be cited directly, by the stable
  `(memory_context_id, entry_id)` reference, as a premise of a current-run Inferred Claim; Category B
  is categorically ineligible at this tier,
- a mandatory companion immutable `MemoryContext` for deterministic validation of any
  `memory_premises`/`memory_discovery_refs` reference — an `IntentSpec` cannot pass validation by
  self-asserting Category A standing,
- memory-derived Claim origin remains Inferred only — never User-Provided, never Assumed,
- current `UserIdea` always wins over historical memory,
- historical force is never mechanically copied into current force,
- HIGH/CRITICAL is never closed by memory alone.

Contract suite at merged head: **83/83**. Adversarially reviewed across two rounds — four
independent read-only Codex reviewers by invariant axis on the initial implementation, then two
further independent read-only Codex reviewers on a focused cross-artifact gate-closure pass that
made companion-`MemoryContext` resolution mandatory (previously only checked when a fixture happened
to supply one).

**Did not do, at the time of this checkpoint:** Requirement Derivation was still not a `MemoryContext`
consumer; Dependencies C and D remained unimplemented; no MIHVER Brain adapter or retrieval runtime
existed. **Dependency C has since been retired, not implemented, and Dependency D has since been
implemented — see 10.11/10.13 below.** No MIHVER Brain adapter or retrieval runtime exists even now.

## 10.11 Dependency C — RETIRED (PR #24)

**PR #24:** `54ef91c181134487a50cb7b7c3d3ebeb66716b78` — `docs: retire redundant Dependency C after
Dependency B`.

A mandatory pre-implementation re-derivation (task `M0-DEPENDENCY-C-REQUIREMENT-MEMORY-PREMISE`),
run before any edit, found Dependency C's originally planned direct path —
`MemoryContext → Requirement-Level Inference premise` at Requirement Derivation — structurally
incoherent against `REQUIREMENT_SPEC.md`'s own R-10/R-22 semantics, and stopped without implementing
anything: verdict `DEPENDENCY_C_REDUNDANT_AFTER_B`. A follow-up task (`M0-DEPENDENCY-C-DISPOSITION`,
plus its own narrow wording-closure round) formally recorded the retirement across the owning
contracts. **The full reasoning is authoritative in `ADR-0004`'s "Post-Acceptance Dependency B/C/D
Disposition" section, `REQUIREMENT_SPEC.md`'s new invariant R-23, and `MEMORY_CONTEXT.md`'s "There
is no third way, and none is coming" paragraph — not reproduced here.**

- **Dependency C was not implemented** — no new `MemoryContext` consumer, no new
  normative-strength source, no schema/runtime change.
- **Canonical path, unchanged:** Category A historical-user `MemoryContext` → Intent Parsing /
  Dependency B → accepted current-run Inferred Claim → Requirement Derivation → existing
  R-03/R-10/R-22 authority.
- **At the time of this checkpoint, Requirement Derivation remained not authorized** to consume
  `MemoryContext` for `SEMANTIC_PREMISE` use, and its `M0_SCOPE.md` `Input:` list was `IntentSpec`
  only. **Requirement Derivation has since been separately, narrowly authorized as a third
  `MemoryContext` consumer — restricted to exactly `DECISION_OPTION`, a wholly different purpose
  than the one C's retirement foreclosed — see 10.13 below.** Retiring C did not itself authorize,
  and is not the basis for, D's later authorization.
- **Dependency D is not retired** — a separate, later, narrower path
  (`MemoryContext → DECISION_OPTION → an R-19-eligible working default → memory-informed
  rationale`). **At the time of this checkpoint it remained unimplemented and unauthorized; it has
  since been implemented — see 10.12/10.13 below.**

Contract suite at merged head: **83/83**. One fresh independent read-only Codex reviewer verified
the retirement across the four owning files with no findings, per that task's own review round —
see `.project/REVIEW_STATE.md`'s history for the full detail.

## 10.12 `DECISION_OPTION` historical-source gate — DONE (PR #26)

**PR #26:** `a16491d41d93f4edac9378b6184de071aa681f32` — `M0: close DECISION_OPTION historical-source
gate`.

Settled a prerequisite policy question before Dependency D could be implemented: whether a
`MemoryContext` entry classified as a historical user statement — Category A **or** Category B — may
ever be eligible for `DECISION_OPTION` standing. Human decision: **categorically never** — the
existing deterministic validator behavior (`tests/contracts/validate-contracts.mjs`) was already
correct and preserved unchanged; only the surrounding contract prose and error-message text were
brought into consistency with it.

- Establishes **two independent, both-required gates** for any Dependency D `DECISION_OPTION`
  candidate: **Gate 1** — R-19 content eligibility (does Requirement Derivation already,
  independently own the fill decision); **Gate 2** — `MemoryContext` source eligibility (is the
  entry itself an eligible source at all — historical-user Category A/B entries categorically fail
  Gate 2, regardless of content).
- Historical-user semantics remain Intent Parsing-owned (Dependency B); Dependency D may not become
  a backdoor around Dependency B.
- A separately-recorded, non-historical technical/project outcome may still be
  `DECISION_OPTION`-eligible — Gate 2 excludes historical-user statements specifically, not every
  `MemoryContext` entry.
- Raw historical-user memory may never be relabeled or laundered to gain eligibility.
- **Dependency D itself was not implemented by PR #26** — this PR settled source-eligibility policy
  only, ahead of D's own separate implementation (10.13 below).
- Contract suite at merged head: **85/85**.

## 10.13 Dependency D — DONE (PR #27)

**PR #27:** `bb70a9ec92da1a17fbb4129f3c062626ecd00cd5` — `M0: implement Dependency D memory-informed
R-19 defaults`.

Amended `docs/foundation/M0_SCOPE.md` and `docs/contracts/REQUIREMENT_SPEC.md` (new invariant
**R-24**) to establish:

- **Requirement Derivation** as the third stage whose declared `Input:` list includes an optional
  `MemoryContext`, restricted to exactly the `DECISION_OPTION` influence tier,
- the canonical ordering: accepted `IntentSpec` → an existing surviving Unknown → R-19 eligibility
  (Gate 1) → optional `MemoryContext` → source eligibility (Gate 2, 10.12 above) →
  `DECISION_OPTION` candidate → Requirement Derivation's own decision → `RequirementSpec`,
- memory supplies **zero independent authority** — R-19/R-09 remain what authorizes any value
  chosen, either way,
- an adopted value remains Requirement-Derivation-introduced (R-09), with its own independent
  rationale, plus an additional, distinctly-labeled memory-informed rationale citing the stable
  `(memory_context_id, entry_id)` identity (R-24),
- `MemoryContext` is bound to the specific consumed `IntentSpec` version containing the surviving
  Unknown — never to `RequirementSpec`, which is this stage's own output.

Current `MemoryContext` consumers, per `M0_SCOPE.md`:

```text
Intent Parsing          — DISCOVERY_ATTENTION, SEMANTIC_PREMISE
Research Planning       — DISCOVERY_ATTENTION
Requirement Derivation  — DECISION_OPTION only
```

- R-19 unchanged; R-23 unchanged; Dependency C remains retired (unaffected by D).
- The historical A/B categorical source-gate exclusion (10.12 above) applies unweakened.
- `MemoryContext` is not, and does not become, Evidence.
- `MemoryContext` absence/unavailability is non-blocking — Requirement Derivation functions
  identically either way.
- No `RequirementSpec` schema exists yet; no Brain adapter or runtime exists.
- Contract suite at merged head: **85/85**. Adversarially reviewed across the implementation and two
  follow-up closure rounds on the same PR — see `.project/REVIEW_STATE.md`'s history for the full
  detail.

---

# 11. The three loops in the target autonomous architecture

Future autonomy does **not** eliminate loops. It replaces the current manual human/ChatGPT/Claude transport loop with three explicit governed loops.

## 11.1 Decision loop

```text
Observe current state
    ↓
3-agent Decision Council
    ↓
proposal / objections / exact candidate
    ↓
quorum
    ↓
DecisionRecord
```

If there is no quorum:

```text
NO_QUORUM → revision / escalation → council again
```

This is the future replacement for the current manual sequence:

```text
Claude result → human/ChatGPT review → new prompt → Claude revision
```

## 11.2 Execution loop

```text
DecisionRecord
    ↓
Policy / authorization
    ↓
ExecutionEnvelope
    ↓
Night Runner
    ↓
Claude Orchestrator
    ↓
Workers
    ↓
Verification
    ↓
accepted / retry / escalate
```

## 11.3 Learning / memory loop

```text
Brain read
    ↓
MemoryContext
    ↓
Decision / Execution
    ↓
Verification
    ↓
accepted outcome
    ↓
Memory Write Candidate
    ↓
provenance/policy validation
    ↓
Brain
```

An LLM's free-form conclusion must never write directly into trusted long-term memory.

Future Brain write-back should be based on accepted outcomes, explicit provenance, and memory-policy classification.

---

# 12. Architecture Intelligence Engine — planned product moat

Beyond the basic M0 artifact pipeline, MIHVER needs an evidence-backed architecture intelligence layer.

Target conceptual stack:

```text
Technology Registry
    +
Compatibility Graph
    +
Evidence History
    +
Architecture Rules
    +
Evaluation Data
    +
Memory
    +
future M1 Experiment Results
```

## 12.1 Technology Registry — PLANNED

Track named technology facts with:

- provider/project identity,
- exact version,
- capability claims,
- source,
- verification date,
- freshness,
- confidence,
- licensing/deployment/security properties.

## 12.2 Compatibility Graph — PLANNED

Potential edge semantics:

- `works_with`
- `conflicts_with`
- `requires`
- `supports`
- `prohibits`
- `degrades`
- `recommended_when`
- `avoid_when`

## 12.3 Candidate synthesis — PLANNED

Architecture Synthesis should search materially distinct system shapes, including the valid zero-agent case.

## 12.4 Evaluation — PLANNED

Use hard constraints first, then multi-objective comparison.

Potential dimensions:

- cost,
- latency,
- security,
- reliability,
- maintainability,
- autonomy,
- vendor lock-in,
- team skill,
- maturity,
- operational complexity.

The final M0 promise should remain:

> evidence-backed best-fit architecture among evaluated candidates under the current requirements and evidence.

M0 must not claim mathematical/global optimality.

---

# 13. Decision Council — future governed decision plane

A detailed external research report prepared on 22 Aug 2026 informed this section. It is a
historical research input, not an accepted MIHVER artifact, and is not required to reconstruct the
roadmap; the durable conclusions relevant to MIHVER are summarized below.

Its strongest candidate architecture is a separated heterogeneous rotating council:

```text
3 heterogeneous decision seats
        ↓
Rotating proposer / chair
        +
Two independent reviewers
        ↓
Exact-candidate quorum
        ↓
Deterministic control plane
        ↓
separate Claude orchestrator
```

## 13.1 Research recommendation — NOT YET ACCEPTED

Candidate pattern:

- three independent model/provider seats,
- blind/isolated first proposal round,
- rotating proposer/chair,
- deterministic typed candidate compilation,
- exact candidate hashing,
- 2-of-3 governance quorum for lower-risk decision classes,
- stronger reviewer-recusal rules for architecture/public-contract changes,
- 3-of-3 + human for high-impact effects,
- deterministic policy outside the models,
- Claude orchestrator does not vote,
- workers cannot self-approve,
- independent verifier remains separate.

The report calls this **Separated Heterogeneous Rotating Council (SHRC)**.

This name and exact protocol remain **research candidates until formal MIHVER ADRs are written and reviewed**.

## 13.2 Why the council does not replace Night Runner

Council decides **what should be done**.

Night Runner coordinates **when/how an already-authorized action is executed unattended**.

Claude orchestrates **how to decompose an authorized execution task**.

Verifier determines **whether the result satisfies acceptance gates**.

Human remains the authority for high-risk governance and merge/deploy policies until explicitly reduced by future risk-class evidence.

---

# 14. Target internal control architecture

Long-term internal model:

```text
                         Human
                           │
                           ▼
                    Goal / Request
                           │
                ┌──────────┴──────────┐
                │                     │
                ▼                     ▼
          MIHVER Brain          Current State
                │          repo / artifacts / tests
                │                     │
                └──── MemoryContext ──┘
                           │
                           ▼
                  Decision Council
                           │
                      exact quorum
                           │
                           ▼
                  Deterministic
                   Control Plane
             policy / scope / budget / STOP
                           │
                           ▼
                  Night Runner vNext
                           │
                           ▼
                  Claude Orchestrator
                           │
                           ▼
                    Bounded Workers
                           │
                           ▼
                 Independent Verifier
                           │
              ┌────────────┴────────────┐
              │                         │
           accepted                  defect
              │                         │
              ▼                         ▼
      state + memory write       classify / retry /
           candidate               re-decide
```

A concise responsibility rule:

> **Brain remembers. Council decides. Control Plane authorizes. Night Runner schedules the loop. Claude executes. Workers perform bounded work. Verifier proves. Human governs high-risk transitions.**

---

# 15. Master dependency roadmap

The following order is designed to minimize semantic churn and rework.

## Phase 1 — Foundation and compiler model — DONE

- Vision
- Principles
- M0 Scope
- ADR-0001 Accepted

**Exit:** staged architecture-compiler model established.

---

## Phase 2 — Intent semantics — DONE

- UserIdea contract
- IntentSpec contract
- ADR-0002 semantic model
- adversarial corpus

**Exit:** provenance-safe intent representation exists.

---

## Phase 3 — Intent schemas — DONE

- UserIdea schema
- IntentSpec schema
- validator + fixtures
- 32/32 contract suite

**Exit:** Step 02 semantic model is machine-representable and enforced where possible.

---

## Phase 4 — Development context and deterministic tooling — DONE

- `.project` durable context system
- `npm run context`
- branch/review/gate operating model
- Night Runner deterministic planner
- fresh-Claude single-task executor

**Exit:** fresh sessions can reconstruct state; bounded unattended execution experiments exist without becoming architecture authority.

---

## Phase 5 — Requirement semantics — DONE / ADR PROPOSED

- RequirementSpec semantic contract
- ADR-0003 Proposed
- adversarial corpus

**Exit:** `IntentSpec → RequirementSpec` semantics are defined.

**Remaining:** schema + acceptance path.

---

## Phase 6 — Memory authority boundary — DONE / ADR ACCEPTED

- ADR-0004 (Accepted — see 10.1/10.8; Acceptance required Dependency A alone, completed in Phase 7)
- MemoryContext contract
- 24-case adversarial corpus
- RunContext concept
- Producer authority
- four influence tiers
- A/B/C/D dependency model

**Exit:** memory authority semantics are designed and the core authority boundary is Accepted; consumption remains limited to what Phase 7 explicitly authorized (Research Planning, `DISCOVERY_ATTENTION` only) — Accepted Status does not by itself widen consumption or imply a runtime exists.

---

## Phase 7 — Foundation Memory Boundary / Dependency A — DONE

**PR #17:** `9416e857b549bea07d4ce06a5c365524fdf1d51a` — `M0: integrate core MemoryContext boundary into foundation`.

Amended `M0_SCOPE.md` to introduce the **core memory integration boundary**:

1. defined `RunContext` as cross-cutting invocation context, not semantic user input,
2. defined MemoryContext Producer as a declared cross-cutting boundary,
3. declared the first consumer's optional `MemoryContext` input,
4. preserved Brain-unavailable / empty-memory graceful behavior,
5. preserved lifecycle binding to run, consumer, purpose, upstream artifact version,
6. explicitly kept dependencies B/C/D disabled.

### First consumer: Research Planning

Why Research Planning first:

- memory can add research leads without becoming user intent,
- memory can broaden attention without becoming Evidence,
- it exercises the core boundary while minimizing provenance risk,
- failure/absence of Brain can degrade gracefully to ordinary RequirementSpec-derived research planning.

Authorized capability:

```text
MemoryContext
→ DISCOVERY_ATTENTION
→ add research questions/categories/directions
```

Forbidden:

- remove RequirementSpec-derived coverage,
- determine source authority,
- weaken evidence sufficiency,
- establish technology facts,
- choose technologies,
- alter Requirements or intent.

**Exit gate met:** Dependency A implemented and adversarially reviewed (four independent read-only Codex reviewers, by axis) with no hidden Brain read or stage-authority leak — see `.project/PROJECT_STATE.md` / `.project/DECISIONS_LOG.md` for the durable record.

**Still not implemented, at the time of this checkpoint:** `MemoryContext` schema, Brain read
adapter, and an executable Research Planning pipeline that actually retrieves memory. This phase is
a semantic/foundation authorization only — see 10.9 above. A machine-readable schema has since been
added (Phase 10 below, PR #20); a Brain read adapter and executable retrieval pipeline still do not
exist even now.

---

## Phase 8 — ADR-0004 Acceptance checkpoint — DONE

Dependency A merged and was adversarially reviewed (Phase 7, PR #17), which made ADR-0004 Acceptance the recommended next checkpoint. A separate, explicit human task (`ADR-0004-ACCEPTANCE`) then:

- reconsidered ADR-0004 `Proposed → Accepted` and confirmed the transition,
- verified the core boundary exists in foundation (it does, as of PR #17),
- did not wait for B/C/D, which at that time all remained structurally disabled — B has since
  landed and C has since been retired; see Phase 9.

**Exit:** MemoryContext core authority model is Accepted. `ADR-0004`'s own `## Status` field is
authoritative for confirming this — not restated here beyond this checkpoint.

---

## Phase 9 — Dependencies B/C/D — B DONE, C RETIRED, D DONE

Now that ADR-0004 itself is Accepted (Phase 8), dependencies B, C, and D are this roadmap area's
family. **Dependency B is now complete (PR #22, see 10.10 above). Dependency C has since been
re-derived and retired, not implemented (PR #24, see 10.11 above) — it required no further
authorization since it was never started. Dependency D is now complete (PR #27, see 10.13 above) —
its own prerequisite source-eligibility policy was settled first, by explicit separate human decision
(PR #26, see 10.12 above).** Retirement of C was not, by itself, authorization to start D; D required
its own separate, explicit human task instruction, exactly as Dependencies A and B each required.

**Sequencing correction (historical), discovered from actual repository state before Dependency B
was implemented:** at that time, `schemas/m0/intent-spec.schema.json` represented an Inferred
Claim's premises only as `premise_claim_ids[]`, resolved by `tests/contracts/validate-contracts.mjs`
only against Claims inside the same `IntentSpec`. Implementing dependency B before `MemoryContext`
had its own stable, machine-readable entry identity would have forced a choice between leaving
`INTENT_SPEC` semantics ahead of its own schema, or inventing an ad-hoc `MemoryContext` reference
shape likely to churn once `MemoryContext`'s schema was actually designed. The lowest-churn order
adopted was therefore: **ADR-0004 Accepted (Phase 8) → MemoryContext schema foundation (Phase 10) →
Dependency B (now done, PR #22) → Dependency C (re-derived and retired, PR #24) →
`DECISION_OPTION` historical-source gate (now done, PR #26) → Dependency D (now done, PR #27) →
RequirementSpec Step 03B (Phase 11)** — see Section 22's ordered list for the authoritative current sequence. This note is
preserved as the historical reasoning for that order, not a currently pending decision.

### B — Intent historical-memory premise — DONE (PR #22)

See 10.10 above for the full delivered shape. Preserved, as implemented:

- current input wins,
- historical force is not current force,
- provenance to inspectable historical user source,
- Category B cannot become a premise,
- HIGH/CRITICAL memory cannot close the issue alone.

### C — Requirement-Level Inference premise — RETIRED (PR #24)

A mandatory pre-implementation re-derivation found the direct path (amending R-10/R-22 to recognize a
`MemoryContext` entry as a Requirement-Level Inference premise) structurally incoherent, and it was
retired rather than implemented — see 10.11 above for the full disposition. **At the time of this
checkpoint, Requirement Derivation remained not authorized to consume `MemoryContext` for this or any
purpose; it has since been separately, narrowly authorized for a wholly different purpose
(`DECISION_OPTION` only) — see 10.13 below.**

### `DECISION_OPTION` historical-source gate — DONE (PR #26)

See 10.12 above for the full delivered shape. Settled, as a prerequisite to Dependency D, that a
`MemoryContext` entry classified as a historical user statement (Category A or Category B) is
categorically ineligible for `DECISION_OPTION` — establishing the two-gate model (R-19 content
eligibility; `MemoryContext` source eligibility) Dependency D's own implementation then relied on.

### D — R-19 memory-informed default provenance — DONE (PR #27)

See 10.13 above for the full delivered shape. Requirement Derivation may consume `MemoryContext`
restricted to exactly `DECISION_OPTION`, to optionally inform a working-default value for a surviving
Unknown it has already, independently established as R-19-eligible. Memory supplies no authority; an
adopted value's provenance is a Requirement-Derivation-introduced, independently-rationaled
Requirement, plus an additional memory-informed-rationale citation (R-24).

**Exit:** all enabled memory paths have explicit contract authority and provenance. Met for
Dependency B, the historical-source gate, and Dependency D; Dependency C is retired, not applicable.

---

## Phase 10 — MemoryContext schema foundation — DONE

**PR #20:** `b8fc6fe6558adbb560b48f1bbe937db53ac09555` — `M0: add MemoryContext schema foundation`
(plus one same-branch/PR follow-up commit closing four reviewer-found structural gaps: an explicit
`semantic_authority_class` axis, an explicit `admission_reason`, required non-null `freshness` on
excluded entries, and canonical Brain-memory-identity uniqueness across admitted+excluded). Merged,
ahead of dependencies B/C/D (Phase 9) per the sequencing correction above. Established:

- machine-readable `MemoryContext` schema (`schemas/m0/memory-context.schema.json`),
- `RunContext`-present-vs-explicitly-absent representation,
- retrieval-outcome representation, structurally distinguishing admitted / successfully-empty /
  retrieval-unavailable,
- scope/lifecycle/classification/freshness/provenance metadata, mapped invariant-by-invariant in
  `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`,
- a stable `(memory_context_id, entry_id)` identity pair future dependency B/C/D amendments may cite
  — without itself defining `IntentSpec`/`RequirementSpec`'s side of that citation,
- deterministic validator checks and fixtures in `tests/contracts/validate-contracts.mjs` (59/59 at
  merge-ready head).

Did **not** authorize any new `MemoryContext` consumer, change `M0_SCOPE.md`, or implement any of
dependencies B/C/D. At the time of this checkpoint, Research Planning, `DISCOVERY_ATTENTION` only,
was the sole authorized consumer — **Dependency B has since authorized Intent Parsing as a second,
see 10.10 above.** Schema design created no new semantic authority beyond what `MEMORY_CONTEXT.md`
(unchanged) already establishes. **Schema representability is not stage authorization**: the schema
represents all four Influence Taxonomy tiers and an open `consuming_stage` identifier so a future
authorized consumer never requires redesigning the artifact's shape, but that representability is
not itself an authorization — `M0_SCOPE.md` alone grants that. No MIHVER Brain adapter, retrieval
runtime, or executable Producer implementation exists — see the next subsection.

### Brain read-side adapter / runtime — PLANNED, separate, later

**Distinct from the schema foundation above — do not conflate the two.** Dependency B is now
implemented, Dependency C has since been retired (not applicable), and Dependency D is now
implemented (10.13 above) — schema/consumer semantics are now settled through D; this remains
future, separate work regardless, requiring its own separate authorization when undertaken:

- build a provider-independent Brain adapter boundary,
- implement the actual `MemoryContext` Producer (retrieval, scope/supersession resolution, freshness
  computation) against `../mihver-brain`,
- add deterministic fixtures exercising real retrieval outcomes end-to-end.

No runtime code, MCP surface, or network retrieval exists yet. This remains entirely future work,
not started or implied by the schema foundation above.

---

## Phase 11 — RequirementSpec Step 03B schema — PLANNED / HIGH PRIORITY

Build:

- `RequirementSpec` JSON Schema,
- valid/invalid fixtures,
- schema mapping,
- validator integration,
- referential/lifecycle checks where structurally enforceable,
- adversarial coverage against the Requirement cases.

Then reconsider ADR-0003 acceptance.

### Ordering note

Memory provenance amendments should be settled before finalizing RequirementSpec schema if they change Requirement provenance/premise shape; otherwise schema churn is likely.

---

## Phase 12 — ResearchPlan contract — PLANNED

Define:

- research questions,
- required coverage,
- source authority policy,
- evidence sufficiency criteria,
- provenance for requirement-derived vs memory-added discovery,
- failure/partial semantics.

This is where the first authorized `DISCOVERY_ATTENTION` MemoryContext consumer becomes concretely testable.

---

## Phase 13 — EvidenceBundle contract — PLANNED

Define:

- observation identity,
- source,
- version,
- verification date,
- confidence,
- freshness,
- claim/evidence separation,
- contradiction/update handling,
- prior-Evidence reuse rules.

Memory itself remains non-Evidence.

---

## Phase 14 — Technology Candidate Set — PLANNED

Define deterministic hard-eligibility screening against:

- RequirementSpec,
- EvidenceBundle,
- compatibility constraints.

No ranking yet.

---

## Phase 15 — Architecture Synthesis — PLANNED

Produce one or more materially distinct complete architecture candidates.

Must support:

- zero-agent architecture,
- one-agent architecture,
- multi-agent architecture,
- deterministic/non-LLM alternatives,
- explicit tradeoffs and consequences,
- architecture search provenance.

---

## Phase 16 — Evaluation and ArchitectureDecision — PLANNED

Evaluate candidates under multi-objective criteria derived from requirements.

Recommended pattern:

1. hard constraints first,
2. Pareto / multi-objective comparison,
3. explainability of rejected alternatives,
4. selected candidate or explicit no-qualified-candidate result.

---

## Phase 17 — MihverArchitectureSpec — PLANNED

Emit the selected architecture as a portable, self-contained specification.

M0 stops at specification. It does not empirically prove the architecture works in reality.

---

# 16. MIHVER Brain integration roadmap

The Brain should evolve on two explicitly separate paths.

## 16.1 Read path

```text
Brain
→ producer
→ MemoryContext
→ authorized stage / council consumer
```

Near-term priorities:

1. re-verify SB-02 private branch state locally,
2. close semantic-vs-lexical hybrid parity invariant,
3. freeze retrieval behavior,
4. define provider-independent MIHVER ↔ Brain read adapter,
5. implement MemoryContext production behind ADR-0004 contracts.

## 16.2 Write-back path

Future separate ADR/task:

```text
Accepted Decision / VerificationResult / project outcome
→ MemoryWriteCandidate
→ deterministic + semantic classification
→ provenance + scope + supersession rules
→ Brain write
```

Rules:

- free-form model rationale is never trusted memory,
- a worker cannot directly write trusted semantic memory,
- project outcomes require retained provenance,
- technology claims remain evidence leads unless independently verified,
- memory write should be auditable and reversible/supersedable.

This write-back loop is essential if Brain is to become a learning subsystem rather than a static archive.

---

# 17. Decision Council roadmap

The three-agent council should be introduced **after** memory and core M0 provenance boundaries are sufficiently stable, so autonomy does not amplify contract churn.

## 17.1 Council ADR set — PLANNED

Formalize the research report into separate bounded decisions, likely covering:

1. Council topology and separation of duties.
2. Candidate assembly / exact-candidate quorum.
3. Risk classes and human-autonomy policy.
4. Control plane authority and policy boundary.
5. Council membership/model diversity and replacement policy.
6. Dissent, retry, no-quorum, and revision semantics.

Do not freeze exact providers as architectural constants.

## 17.2 Deterministic Decision Council Kernel v0 — PLANNED

First implementation should have **no real LLM, no shell, no network, no Claude execution**.

Target capabilities:

- typed decision artifacts,
- canonicalization + domain-separated hash,
- fake three-seat council,
- exact-candidate ballot,
- quorum validation,
- risk reference policy,
- pure state reducer,
- append-only event history,
- STOP epoch simulation,
- idempotency and fencing simulation,
- property/fault tests.

The purpose is to prove protocol invariants before nondeterministic models are introduced.

## 17.3 Shadow Council — PLANNED

Introduce three real heterogeneous model adapters with **zero execution authority**.

Measure:

- pairwise error correlation,
- false consensus,
- minority-correct cases,
- dissent usefulness,
- no-response/timeout behavior,
- decision cost and latency,
- comparison to the current human/Claude baseline.

## 17.4 Advisory Council — PLANNED

Council may produce recommendations / proposed ExecutionEnvelopes, but human remains required for all effects.

This phase integrates:

```text
Council → Control Plane → Night Runner → Claude → Workers → Verifier
```

without granting unsupervised authority.

## 17.5 Bounded autonomy — PLANNED

Graduate narrowly defined reversible R0/R1 classes only after evaluation evidence.

Possible unattended actions:

- read-only research preparation,
- deterministic validation,
- formatting,
- allowed-path test generation,
- bounded task-branch patches,
- PR draft preparation.

Still no automatic `main` merge.

## 17.6 Governed autonomy — LATER

Selected R2 classes may eventually become autonomous after sufficient evidence.

High-risk R3 remains exact-bound human approved.

R4 remains prohibited regardless of council vote.

---

# 18. Night Runner vNext roadmap

Night Runner becomes the outer unattended control loop **after** Decision Council + Control Plane exist.

Target responsibility:

```text
while (!STOP && budgetRemaining) {
  observeCurrentState();
  obtainAuthorizedDecision();
  scheduleAuthorizedExecution();
  executeWithClaude();
  verify();
  refreshState();
  routeSuccessFailureOrEscalation();
}
```

Night Runner vNext should own:

- scheduling windows,
- queue ordering,
- dependency readiness,
- retry timing,
- timeouts,
- overall task/run budget,
- pause/resume-as-new,
- STOP enforcement integration,
- durable unattended run status.

It should not own:

- architectural decision authority,
- quorum,
- risk downgrades,
- policy override,
- merge authority,
- evidence truth,
- worker self-acceptance.

The existing planner and single-task executor are useful reference implementations and test foundations, not dead code.

---

# 19. Durable control-plane roadmap

The three-agent research report recommends a deterministic control plane around all nondeterministic reasoning.

This remains future ADR territory, but the intended layers are:

## Prototype

- pure TypeScript reducer,
- deterministic state machine,
- fake agents,
- no external effects.

## Reliable single-server MVP

Research candidate stack:

- TypeScript,
- PostgreSQL,
- DBOS durable workflow,
- typed reference policy / OPA parity,
- rootless Docker,
- OpenTelemetry.

## Distributed production

Research candidate stack:

- Temporal,
- HA PostgreSQL,
- OPA/Rego,
- gVisor sandbox pool,
- versioned object storage,
- workload identity / signing,
- OpenTelemetry + durable audit.

These technology choices are **research recommendations, not accepted MIHVER architecture until evidence-backed ADRs are completed**.

---

# 20. M1, M2, M3 milestones

## M0 — Idea → Architecture — CURRENT

Output:

```text
MihverArchitectureSpec
```

Validation means contract/evidence/invariant validation — not empirical execution of the candidate architecture.

## M1 — Architecture Experimentation — PLANNED

Purpose:

- instantiate selected architecture candidates in controlled experiments,
- benchmark latency/cost/reliability/compatibility,
- test assumptions that M0 could only reason about,
- compare candidate behavior empirically,
- feed verified experimental outcomes back into architecture intelligence and memory.

This is required before MIHVER can make strong claims about "best working / optimized in practice".

Potential future product mode:

```text
FAST ARCHITECT
→ current contracts + registry + evidence + memory

VERIFIED ARCHITECT
→ M0 + M1 sandbox experiments / benchmarks
```

These mode names remain product concepts until formal contracts exist.

## M2 — Architecture Build — PLANNED

Purpose:

- generate/provision/build from accepted architecture specification,
- bounded implementation,
- artifact/infra generation,
- policy-controlled capability usage,
- verification against the spec.

## M3 — Architecture Run — PLANNED

Purpose:

- operate generated systems,
- lifecycle management,
- monitoring,
- adaptation,
- production governance,
- feedback into evidence and experiment history.

---

# 21. Current capability map

## Exists today on public `main`

- architecture compiler foundation,
- Vision / Principles / M0 Scope,
- ADR-0001 Accepted,
- UserIdea semantic contract + schema,
- IntentSpec semantic contract + schema,
- ADR-0002 Accepted,
- RequirementSpec semantic contract,
- ADR-0003 Proposed,
- **85/85 current contract fixtures** (32 at Step 02B/Phase 3, 59 after the MemoryContext Schema
  Foundation/Phase 10, 83 after Dependency B/Phase 9, 85 after the `DECISION_OPTION` historical-
  source gate (PR #26) — Dependency D (PR #27) added no new fixtures — see each phase for its own
  checkpoint count),
- durable `.project` context bootstrap,
- `npm run context`,
- Claude/Codex/human development operating model,
- Night Runner deterministic planner,
- fresh-Claude single-task executor,
- ADR-0004 MemoryContext authority design, **Accepted** (per Dependency A's completion and adversarial review — see section 10.1/10.8),
- MemoryContext semantic contract + 24-case adversarial corpus,
- ADR-0004 Dependency A / Foundation Memory Boundary merged into `docs/foundation/M0_SCOPE.md` (PR #17): `RunContext`, the cross-cutting MemoryContext Producer boundary, and Research Planning as an authorized `MemoryContext` consumer (`DISCOVERY_ATTENTION` only) — semantic authorization only, no runtime. At the time of this checkpoint, Dependencies B/C/D remained unimplemented and unauthorized; **B has since landed, C has since been retired, and D has since been implemented — see below.**
- MemoryContext Schema Foundation merged (PR #20, squash commit `b8fc6fe6558adbb560b48f1bbe937db53ac09555`): `schemas/m0/memory-context.schema.json`, deterministic validator integration, `docs/contracts/MEMORY_CONTEXT_SCHEMA_MAPPING.md`, and a stable `(memory_context_id, entry_id)` reference primitive for a future Dependency B/C/D citation shape — schema representability only, not stage authorization. At the time of this checkpoint, Research Planning (`DISCOVERY_ATTENTION` only) remained the sole authorized consumer; **Dependency B has since authorized a second, and Dependency D a third — see below.**
- ADR-0004 Dependency B / Intent historical-memory premise merged (PR #22, squash commit `2cee16af702804127472af0470b3ce4ef2600f88`): **Intent Parsing is now the second authorized `MemoryContext` consumer** (`docs/foundation/M0_SCOPE.md`), at exactly `DISCOVERY_ATTENTION` (Category A or B historical-user memory shaping a provenance-visible candidate clarification question) and `SEMANTIC_PREMISE` (Category A only, directly cited as a current-run Inferred Claim premise via the stable `(memory_context_id, entry_id)` reference — deterministic validation requires a mandatory companion immutable `MemoryContext`). Memory-derived Claim origin remains Inferred only; current `UserIdea` always wins; historical force is never mechanically copied into current force; HIGH/CRITICAL is never closed by memory alone. Contract suite at merged head: **83/83**. At the time of this checkpoint, Requirement Derivation remained unauthorized to consume `MemoryContext` and Dependency D remained unimplemented; no Brain adapter/runtime exists even now. **Dependency C has since been retired, not implemented, and Dependency D has since been implemented — see below.**
- ADR-0004 Dependency C — retired, not implemented (PR #24, squash commit `54ef91c181134487a50cb7b7c3d3ebeb66716b78`): a mandatory pre-implementation re-derivation found the direct `MemoryContext → Requirement-Level Inference premise` path structurally incoherent against `REQUIREMENT_SPEC.md`'s own R-10/R-22 semantics, and it was retired rather than implemented — full reasoning in `ADR-0004`'s "Post-Acceptance Dependency B/C/D Disposition" section and `REQUIREMENT_SPEC.md`'s new invariant R-23, not reproduced here. No new `MemoryContext` consumer, no new normative-strength source, no schema/runtime change. **At the time of this checkpoint, Requirement Derivation `MemoryContext` remained NOT AUTHORIZED and Dependency D remained not implemented — both have since changed, see below.**
- `DECISION_OPTION` historical-source gate merged (PR #26, squash commit `a16491d41d93f4edac9378b6184de071aa681f32`): settled, by explicit human decision, that a `MemoryContext` entry classified as a historical user statement (Category A or Category B) is categorically ineligible for `DECISION_OPTION` — established the two-gate model (R-19 content eligibility; `MemoryContext` source eligibility) as a prerequisite policy for Dependency D. The existing deterministic validator behavior was already correct and unchanged. Dependency D itself was not implemented by this PR. Contract suite at merged head: **85/85**.
- ADR-0004 Dependency D / Requirement Derivation memory-informed R-19 defaults — **DONE** (PR #27, squash commit `bb70a9ec92da1a17fbb4129f3c062626ecd00cd5`): **Requirement Derivation is now the third authorized `MemoryContext` consumer** (`docs/foundation/M0_SCOPE.md`), restricted to exactly `DECISION_OPTION`, to optionally inform a working-default value for a surviving Unknown it has already, independently established as R-19-eligible (Gate 1), with the entry's own source separately clearing Gate 2 (PR #26 above). Memory supplies zero independent authority; an adopted value remains Requirement-Derivation-introduced (R-09) with an independent rationale plus an additional memory-informed-rationale citation of the stable `(memory_context_id, entry_id)` identity (new invariant **R-24**). R-19/R-23 unchanged; Dependency C remains retired, unaffected. `MemoryContext` is not Evidence; its absence/unavailability is non-blocking. **Capability snapshot as of this checkpoint (historical — for current status see `.project/PROJECT_STATE.md`'s "Current Capability Snapshot"):** Intent Parsing `MemoryContext` — **AUTHORIZED** (`DISCOVERY_ATTENTION`, `SEMANTIC_PREMISE`); Research Planning `MemoryContext` — **AUTHORIZED** (`DISCOVERY_ATTENTION`); Requirement Derivation `MemoryContext` — **AUTHORIZED** (`DECISION_OPTION` only); Dependency B — **implemented**; Dependency C — **retired**; `DECISION_OPTION` historical-source gate — **done**; Dependency D — **implemented**; `RequirementSpec` schema — **not implemented**; Brain adapter/runtime — **not implemented**; contract tests — **85/85**.

## Does not exist yet as an M0 product capability

- actual end-user `UserIdea → MihverArchitectureSpec` executable pipeline,
- RequirementSpec schema,
- ResearchPlan contract/schema,
- EvidenceBundle contract/schema,
- Technology Registry,
- Compatibility Graph,
- TechnologyCandidateSet runtime,
- Architecture Synthesis runtime,
- Evaluation engine,
- MihverArchitectureSpec schema/runtime,
- product CLI/API,
- a Brain read adapter and an executable retrieval path — the `MemoryContext` schema itself now exists on `main` (Phase 10 above), but none of Research Planning, Intent Parsing (Phase 9, Dependency B), or Requirement Derivation (Phase 9, Dependency D) actually retrieves or produces any real `MemoryContext` yet; no MIHVER Brain adapter, retrieval runtime, or executable Producer implementation exists,
- governed Brain write-back,
- accepted three-agent Decision Council,
- Decision Council deterministic kernel,
- production control plane,
- production policy engine,
- autonomous overnight development loop,
- M1 experiment runtime.

This distinction must remain explicit: merged architecture design is not the same as operational capability.

---

# 22. Recommended near-term order

This is the current lowest-rework sequence.

```text
1. Dependency A — Foundation Memory Boundary — DONE (PR #17)
      RunContext
      MemoryContext Producer
      first Research Planning consumer (DISCOVERY_ATTENTION only)

2. ADR-0004 Acceptance checkpoint — DONE

3. MemoryContext Schema Foundation — DONE (PR #20)
      machine-readable MemoryContext schema
      deterministic validator + fixtures (59/59 at merge-ready head)
      stable (memory_context_id, entry_id) reference primitive for B/C/D to later cite
      schema representability is not stage authorization -- at the time of this
      checkpoint, Research Planning (DISCOVERY_ATTENTION only) was the sole
      authorized consumer; Dependency B (below) has since authorized a second,
      and Dependency D (below) a third

4. Dependency B — DONE (PR #22)
      Intent Parsing became the second authorized MemoryContext consumer
      (M0_SCOPE.md), at exactly two tiers:
        DISCOVERY_ATTENTION -- Category A or B historical-user memory may
          shape a provenance-visible candidate clarification question
        SEMANTIC_PREMISE -- Category A only, directly cited as a current-run
          Inferred Claim premise via the stable (memory_context_id, entry_id)
          reference (INTENT_SPEC.md, intent-spec.schema.json,
          validate-contracts.mjs)
      deterministic companion-MemoryContext resolution is mandatory for any
      memory_premises/memory_discovery_refs reference
      memory-derived Claim origin remains Inferred only; current UserIdea
      always wins; historical force is not current force; HIGH/CRITICAL is
      never closed by memory alone
      contract suite at merged head: 83/83

5. Dependency C — RETIRED / REDUNDANT_AFTER_B (PR #24, 54ef91c181134487a50cb7b7c3d3ebeb66716b78)
      REQUIREMENT_SPEC R-10/R-22 Requirement-Level-Inference premise --
      re-derived before implementation, found structurally incoherent given
      Dependency B, retired rather than implemented -- see 10.11 above
      at the time of this checkpoint, Requirement Derivation remained not
      authorized to consume MemoryContext for this or any purpose; it has
      since been separately, narrowly authorized for DECISION_OPTION only --
      see step 7 below

6. DECISION_OPTION historical-source gate — DONE (PR #26, a16491d41d93f4edac9378b6184de071aa681f32)
      prerequisite policy for Dependency D, settled by explicit human decision:
      a MemoryContext entry classified as a historical user statement
      (Category A or Category B) is categorically ineligible for
      DECISION_OPTION -- see 10.12 above
      established the two-gate model: Gate 1 (R-19 content eligibility),
      Gate 2 (MemoryContext source eligibility) -- both independently required
      existing deterministic validator behavior preserved unchanged
      Dependency D itself not implemented by this PR
      contract suite at merged head: 85/85

7. Dependency D — DONE (PR #27, bb70a9ec92da1a17fbb4129f3c062626ecd00cd5)
      REQUIREMENT_SPEC R-19 DECISION_OPTION provenance -- see 10.13 above
      Requirement Derivation is now the third authorized MemoryContext
      consumer, restricted to exactly DECISION_OPTION
      memory supplies zero independent authority; new invariant R-24 requires
      a distinct memory-informed-rationale citation via
      (memory_context_id, entry_id); R-19/R-23 unchanged
      no RequirementSpec schema or Brain adapter/runtime exists yet
      contract suite at merged head: 85/85

8. RequirementSpec Step 03B — NEXT, not authorized
      schema + validator + fixtures
      ADR-0003 acceptance reconsideration
      RequirementSpec machine provenance can now be designed once, since its
      memory-informed default semantics (Dependency D) are settled --
      this is a sequencing observation, not authorization to begin; see
      PROJECT_STATE.md's "Next Authorized Action"

9. Brain SB-02 retrieval parity/freeze
      then MIHVER ↔ Brain adapter/runtime afterward -- distinct from the schema
      foundation in step 3, not started by it

10. ResearchPlan

11. EvidenceBundle

12. Technology Registry + Compatibility Graph

13. Technology Candidate Identification

14. Architecture Synthesis

15. Evaluation + ArchitectureDecision

16. MihverArchitectureSpec + user-facing CLI/API

17. Decision Council ADRs

18. Decision Council Deterministic Kernel v0

19. Night Runner vNext / Control Plane integration

20. Shadow Council — real 3 models, no execution authority

21. Advisory autonomy
      Council → Control Plane → Night Runner → Claude → Workers → Verifier
      human approves all effects

22. Bounded overnight autonomy
      graduated R0/R1 only
      PR preparation allowed
      automatic main merge still forbidden

23. M1 Architecture Experimentation

24. M2 Architecture Build

25. M3 Architecture Run / governed production operation
```

### Ordering rule

If a future semantic dependency changes an upstream artifact's provenance or declared-input model, resolve it **before** freezing that artifact's schema. This is why ADR-0004 memory provenance work precedes final RequirementSpec schema freeze.

---

# 23. Context-recovery protocol for future sessions

When a chat/session becomes large, slow, or ambiguous, do **not** continue by relying on conversation memory.

Use this recovery sequence:

```text
1. git status
2. git log --oneline --decorate -15
3. npm run context
4. read .project/PROJECT_STATE.md
5. read .project/CURRENT_TASK.md if branch-scoped task exists
6. read .project/REVIEW_STATE.md for the matching task
7. read ROADMAP.md only for system-wide direction/dependencies
8. read the authoritative ADR/contract files named by the current task
9. if Brain is relevant, query Brain through its supported read interface
10. never infer authorization from roadmap position alone
```

### Context minimization rule

A fresh agent should receive:

- current task,
- required context list,
- relevant contract/ADR sections,
- current repo facts,
- bounded MemoryContext if authorized,

not the full history of every past PR or conversation.

Historical detail remains available here and in git, but should not be injected into every reasoning turn.

---

# 24. Roadmap maintenance policy

This roadmap should be updated when one of these happens:

- a major M0 stage contract is added/frozen,
- an ADR materially changes system direction,
- a new cross-cutting subsystem becomes accepted,
- a milestone boundary changes,
- Brain/Council/Night Runner ownership boundaries materially change,
- M1/M2/M3 scope is formally defined.

It should **not** be updated for every small task, review fix, or branch.

Detailed task history belongs in:

- git/PR history,
- `.project/DECISIONS_LOG.md`,
- `.project/REVIEW_STATE.md`.

Current truth belongs in:

- the owning artifact,
- live git/GitHub,
- `.project/PROJECT_STATE.md`.

The roadmap should stay readable enough that a new Claude/Codex/human can reconstruct the whole architecture without reading months of chat history.

---

# 25. Do not do yet

Until the relevant prerequisites are complete, avoid these shortcuts:

- do not let pipeline stages query Brain directly,
- do not treat remembered technology facts as Evidence,
- do not freeze RequirementSpec schema before memory provenance shape is settled if that shape affects the schema,
- do not give a three-agent council execution authority before a deterministic kernel exists,
- do not make Claude both voter and executor under the same authority identity,
- do not use simple majority vote as proof of correctness,
- do not replace deterministic validation with LLM review,
- do not make Night Runner the architecture decision authority,
- do not grant Night Runner/Claude automatic `main` merge,
- do not build custom distributed infrastructure before the domain state machine and contracts are proven,
- do not turn private Brain implementation details into public M0 assumptions without an explicit interface contract,
- do not add agents/complexity merely because the internal development platform itself uses agents.

---

# 26. End-state picture

The intended mature platform has three product cores and one governed operating stack.

## Product cores

```text
1. Compiler Contracts
   UserIdea → IntentSpec → RequirementSpec → ... → MihverArchitectureSpec

2. Architecture Intelligence
   Registry + compatibility + evidence + candidate synthesis + evaluation

3. Durable Memory
   Brain + MemoryContext + governed read/write provenance
```

## Governed operating stack

```text
Decision Council
+ Deterministic Control Plane
+ Night Runner unattended coordination
+ Claude execution orchestration
+ bounded workers
+ independent verification
+ human risk gates
```

The final architecture should make it possible for MIHVER to develop and operate increasingly autonomously **without turning model agreement into authority, memory into truth, or execution convenience into permission**.

---

# 27. One-sentence roadmap summary

> Build the architecture compiler and provenance model first; make memory explicit and bounded; finish machine-readable M0 artifacts; add architecture intelligence; then add a deterministic decision/control kernel; only after that graduate three-model council, Night Runner, Claude workers, and Brain write-back from shadow mode to bounded governed autonomy.
