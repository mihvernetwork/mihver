# Intent Semantic Test Corpus

A worked-example corpus for [INTENT_SPEC](../contracts/INTENT_SPEC.md), intended as the basis for
future contract validation / evaluation tests once schema design happens. Each case applies the
epistemic model — Claim (User-Provided / Inferred / Assumed), Open Item (Unknown / Ambiguity),
Conflict, and Decision Impact — defined there. No schema or field names are implied by the
formatting below; it is a readable worked form, not a serialization.

Terminology used throughout: **claim**, never "fact," for anything attributed to the user (see
"Terminology: Claim, Not Fact" in `INTENT_SPEC.md`). Where a case title below says "requirement"
(e.g. "Conditional requirement," "Negative requirement") that names the adversarial-case category
this test corpus was asked to cover — it does not mean a `RequirementSpec` artifact exists at this
stage. Every such case still resolves, in its body, to `IntentSpec`-level Claims only.

A HIGH/CRITICAL Decision Impact below generally means the resulting `IntentSpec` is **Blocked**
(produced, versioned, but not yet eligible for Requirement Derivation to consume) rather than a
hard Intent Parsing failure — see "Handoff Status: Blocked vs. Failed" in `INTENT_SPEC.md`. Cases
below say "needs clarification" for this Blocked disposition; even Case 19, the thinnest request in
this corpus, resolves to Blocked rather than outright failure, because a minimal but genuine
structure (domain, the "best possible" claim, and the under-specification itself) can still be
recorded — failure is reserved for input too thin for even that. A Blocked version is never
consumable — not now, not once whatever blocked it resolves. Resolution never unblocks that
version in place; it produces a new, superseding version, and that new version — not the Blocked
one — is what becomes eligible. The Blocked version itself remains in history, permanently
not-consumable, unchanged.

Two policies worth keeping in mind across every case below: **Assumptions are restricted to
narrowly interpretive gaps** — Intent Parsing never invents a technical/operational default
(a competitor list, a cost scope, a capacity figure) merely to help a downstream stage get started;
Unknown normally stays Unknown. And **Open Items must be relevant** — a case lists an Unknown or
Ambiguity only when resolving it is necessary to interpret, safely compile, or preserve a boundary
the stated idea directly implicates, not for every capability a similar system might someday need.

---

## 1. Coding agent system

**UserIdea:** "Build me a coding agent that can open pull requests against our repo to fix small
bugs."

- **User-provided claims:** the user wants a system that fixes small bugs; it should open
  pull requests against "our repo"; the user calls it a "coding agent."
- **Permissible inferences:** the user wants some degree of autonomous code modification, since PR
  creation implies acting on the repository without the user typing the diff themselves.
- **Unsafe assumptions:** that "small bugs" includes any particular bug category (typos, logic
  errors, security patches); that repo write/push access is already authorized.
- **Unknowns:** which repository/repositories (necessary to safely compile — nothing can target a
  bug fix without it); what counts as "small" (directly implicated — it's the stated scope
  boundary of the goal itself). *Not* listed, and excluded on the same basis: whether tests must
  pass before a PR is opened — nothing in the `UserIdea` addresses CI/testing policy at all, so
  resolving it isn't necessary to interpret, safely compile, or preserve any boundary the stated
  intent actually implicates. **Also not listed: merge authority** (who/what may merge the PR, or
  whether human review gates it). The stated capability is "open pull requests... to fix small
  bugs" — not "open and merge," and not "merge automatically." Opening a PR is a standard,
  self-contained capability in every PR-based workflow; merging is a separate, subsequent action
  that ordinary review conventions already gate, and nothing in this `UserIdea`'s wording raises a
  question about it. Treating merge authority as implicated by "opens PRs" — reasoning that opening
  a PR "presupposes" a merge decision someone must make — is exactly the adjacent-capability
  inference the Relevance Test forbids: it's a plausible thing a *coding agent system in general*
  might eventually need to address, not something *this* `UserIdea`'s wording actually raises. If
  the user's idea had instead said "open pull requests and merge them once tests pass," merge
  authority would be directly implicated and this exclusion wouldn't apply.
- **Conflicts:** none in this UserIdea alone.
- **Clarification needs:** MEDIUM for repository identity — deferrable, but genuinely necessary
  before the goal can be safely compiled into a requirement targeting a specific codebase. LOW for
  bug-category scope, which stays Unknown rather than being paired with an invented Assumption —
  per the Assumption Policy, "small" is the user's own stated scope boundary, and guessing which
  bug categories that covers would be inventing an operational default, not resolving an
  interpretive gap.
- **Decision-impact reasoning:** the unresolved item is which repository the agent targets; the
  downstream decision it changes is which codebase/environment context Requirement Derivation
  compiles against — necessary to proceed at all, but not safety- or architecture-shape-critical in
  itself; MEDIUM applies (not HIGH) because nothing in this `UserIdea` raises a safety-relevant
  question — that would require the idea itself to say something about merge, deployment, or
  production access, which it doesn't.
- **What IntentSpec must NOT decide:** whether this needs one agent or several; whether it uses a
  sandboxed execution environment; any CI/CD gating mechanism; who or what may merge the PRs this
  agent opens; whether "coding agent" implies any specific tool-use framework.

---

## 2. Research system

**UserIdea:** "I want something that researches our competitors weekly and writes me a report."

- **User-provided claims:** desired cadence is weekly; output is a report; subject is
  competitor research.
- **Permissible inferences:** the user wants ongoing (recurring), not one-off, operation, since
  "weekly" implies repetition.
- **Unsafe assumptions:** which competitors; which sources are acceptable to research (public web,
  paid data, internal sales notes); report format or length; that the report should be delivered
  automatically without review.
- **Unknowns:** competitor list; source scope; delivery channel; report depth/format.
- **Conflicts:** none.
- **Clarification needs:** competitor identity and source scope both stay Unknown, deferrable
  without an Assumption — naming a provisional competitor list (e.g. "assume the top 3-5 by public
  visibility") or a provisional source scope would be an invented operational default, not an
  interpretive gap, and the Assumption Policy forbids that. They carry different Decision Impact,
  assessed separately (see reasoning below): source scope is HIGH; competitor identity alone is
  MEDIUM.
- **Decision-impact reasoning:** two distinct unresolved items, assessed separately rather than
  bundled under one rating. Source scope's downstream decision is whether the architecture needs
  authenticated/licensed data access at all, versus purely public sources — a materially different
  architecture (credential management, licensing compliance, paid-data integration), not a detail
  within one architecture shape, so HIGH applies; this is assessed by that downstream consequence,
  not by whether an irreversible or sensitive action is implied today (that threshold governs
  CRITICAL, not HIGH). Competitor identity alone is a different question: which specific
  competitors are targeted tunes the scope of the already-established research-and-report
  capability (naming Acme instead of Contoso doesn't by itself change whether authenticated access
  is needed — that's what the separate source-scope item governs), so MEDIUM applies to identity on
  its own. The overall `IntentSpec` is Blocked because source scope's HIGH rating governs, not
  because identity independently reaches that level.
- **What IntentSpec must NOT decide:** whether this uses a scheduled job, an agent with memory, or
  a simple periodic script (zero-agent is plausible here — see Case 11); any specific search or
  data provider.

---

## 3. Customer email responder

**UserIdea:** "Auto-respond to customer emails with helpful answers."

- **User-provided claims:** the system should respond to customer emails; responses should
  be "helpful"; the user says "auto-respond."
- **Permissible inferences:** the user wants some degree of automation in the reply loop, since
  "auto-respond" implies the system initiates responses rather than only drafting for a human.
- **Unsafe assumptions:** that "auto-respond" means fully autonomous sending with no human review;
  that all email types are in scope (including billing disputes, legal complaints, refund
  requests); that "helpful" has an agreed definition.
- **Ambiguity:** "auto-respond" itself supports two materially different readings — fully
  autonomous sending, or automatic drafting for a human to approve — so this is an Ambiguity
  tracing to that specific word, not an Unknown (the user's wording does bear on the question, it
  just doesn't settle it).
- **Unknowns:** which email categories are included/excluded; escalation path for anything the
  system can't handle.
- **Conflicts:** none stated, but "auto-respond" and "helpful answers" could later prove to be in
  tension if literal automation produces poor-quality replies — not a Conflict yet, since nothing
  contradicts; flagged as a risk area for Requirement Derivation, not recorded as IntentSpec
  Conflict.
- **Clarification needs:** autonomous-send vs. draft-for-approval is HIGH impact (materially
  different safety/architecture); category scope (e.g. legal/billing exclusions) is HIGH if
  unaddressed, since a wrong autonomous reply to a dispute could be costly.
- **Decision-impact reasoning:** the unresolved item is whether "auto-respond" means autonomous
  sending or draft-for-approval; the downstream decision it changes is whether the architecture
  needs a human review/approval stage in the send path at all; HIGH applies (not CRITICAL) because
  a wrong autonomous reply to a dispute is a real reputational/legal risk, but not the kind of
  unsafe-or-irreversible outcome CRITICAL is reserved for — a bad email can be followed up and
  corrected, unlike an irreversible action.
- **What IntentSpec must NOT decide:** whether replies are generated by an LLM, a template engine,
  or a hybrid; whether there's a review queue; any escalation routing logic.

---

## 4. Local-only privacy requirement

**UserIdea:** "I don't want my source code leaving my computer."

- **User-provided claims:** a prohibition — source code must not leave the user's
  computer.
- **Permissible inferences:** the user likely has a privacy or confidentiality motivation (recorded
  separately as an Inference, with that basis stated, not merged into the Claim itself).
- **Unsafe assumptions:** that "leaving my computer" excludes local-network services; that it
  excludes encrypted/anonymized derivatives (embeddings, hashes, telemetry); that any specific
  local-only technology (e.g. a fully offline model) is thereby mandated.
- **Ambiguity:** "leaving my computer" supports multiple readings (device-only? local network
  included? self-hosted-but-remote infrastructure?) — an Ambiguity tracing to that phrase, not an
  Unknown, since the user's own wording is what generates the multiple readings.
- **Unknowns:** whether derived artifacts (not raw source) are covered by the same prohibition —
  this is a genuine Unknown, since nothing in the wording addresses derived artifacts at all.
- **Conflicts:** none in isolation — but see Case 8 for a structurally analogous conflict between a
  local-execution constraint and a cloud-only request (a different `UserIdea`, not this same
  statement, but the same Conflict pattern).
- **Clarification needs:** the exact boundary of "my computer" is CRITICAL if any architecture
  candidate would involve any external processing at all — this is exactly the kind of ambiguity
  that must not be silently resolved by picking the most convenient reading.
- **Decision-impact reasoning:** the unresolved item is what boundary "my computer" actually draws
  (device/network/premises); the downstream decision it changes is which candidate architectures
  are even eligible — anything involving external processing is disqualified under one reading and
  permitted under another. CRITICAL applies (not HIGH) because the least favorable materially
  plausible misreading permits the user's source code to cross their intended confidentiality
  boundary — a potentially unauthorized, non-reversible disclosure of sensitive code, not just an
  architecturally suboptimal fit. It is this data-exposure consequence that reaches CRITICAL, not
  the bare fact that the user phrased the constraint as a prohibition — an explicit prohibition
  alone doesn't automatically imply CRITICAL (contrast Cases 10 and 15, both HIGH, where an
  unfavorable reading could also violate an explicit prohibition but without this same
  confidentiality-disclosure consequence).
- **What IntentSpec must NOT decide:** `execution_location = LOCAL` or any other formal deployment
  constraint; any specific on-device technology.

---

## 5. Medical-data ambiguity

**UserIdea:** "I want a tool that reads clinic notes and flags patients who might need
follow-up."

- **User-provided claims:** the system reads clinic notes; it flags patients who might
  need follow-up.
- **Permissible inferences:** the domain involves healthcare-adjacent information; the described
  activity resembles clinical risk triage, which typically involves sensitive personal health
  information.
- **Unsafe assumptions:** that the clinic has authorization/consent to use the notes this way; that
  the output is advisory rather than a clinical determination; that generic text-processing privacy
  handling is sufficient.
- **Unknowns:** jurisdiction and applicable regulatory regime; whether patient consent exists;
  whether flags are advisory signals or treated as clinical conclusions by staff; who may see the
  output.
- **Conflicts:** none stated.
- **Clarification needs:** CRITICAL — whether this involves regulated health data and what the
  output's clinical weight is must be resolved; proceeding on an unsafe assumption here risks a
  materially unsafe or non-compliant architecture recommendation.
- **Decision-impact reasoning:** the unresolved items are the regulatory regime, consent status,
  and clinical weight of the output; the downstream decision they change is whether the
  architecture needs regulated-health-data safeguards (access control, audit, compliance
  boundaries) at all, and whether the output can be advisory-only or must meet a clinical-decision
  standard; CRITICAL applies (not HIGH) because proceeding on an unsafe assumption here risks a
  non-compliant or unsafe architecture recommendation involving real patients — not just an
  architecturally expensive one.
- **What IntentSpec must NOT decide:** any compliance framework (HIPAA or otherwise) as a
  requirement; any specific security/access-control architecture; whether the output constitutes
  medical advice.

---

## 6. Budget constraint

**UserIdea:** "I want it to cost under $100/month."

- **User-provided claims:** a cost ceiling of $100/month, as stated, with **preference** force —
  "I want" is desiderative language expressing what the user wants, not obligation language.
  Recording it as obligatory ("must") would silently upgrade "I want X" into "X is mandatory," which
  Information-Loss Rules forbid regardless of how important the underlying desire seems; if the
  user had written "it must cost under $100" or "needs to cost under $100," *that* wording would
  license obligatory force. "I want" alone licenses preference — a strong one, but a preference.
- **Permissible inferences:** the user is cost-sensitive generally (a weaker, separately recorded
  Inference distinct from the ceiling Claim's own force).
- **Unsafe assumptions:** what's included (infrastructure only? model API usage? third-party
  licenses? MIHVER's own usage, if any?); the currency, if not explicit.
- **Unknowns:** included cost categories; measurement period boundaries (calendar month? rolling
  30 days?); what happens if usage would exceed it — none of this is addressed by any wording in
  the `UserIdea`, so these are genuine Unknowns, not Ambiguities.
- **Conflicts:** potential future conflict if other stated requirements (e.g. high autonomy, large
  scale) are architecturally expensive — not yet a Conflict here, since no other cost-relevant
  claim exists in this UserIdea alone.
- **Clarification needs:** MEDIUM, and stays Unknown rather than being paired with an invented
  scope Assumption — "assume this covers infrastructure and model usage, excluding setup" would be
  a manufactured operational default (what's included in a budget is a cost-category decision the
  user never addressed, not an interpretive gap in what they meant), which the Assumption Policy
  forbids. Deferring with the gap left open is correct here.
- **Decision-impact reasoning:** the unresolved item is which cost categories the ceiling covers;
  the downstream decision it changes is which architecture candidates are cost-eligible under an
  already-established $100/month constraint — this tunes the scope of a capability (a budget
  ceiling) whose existence the Claim already settles, rather than determining whether the
  constraint exists at all, so MEDIUM applies, not HIGH. (Contrast Case 2, where the unresolved
  item determines whether an entire capability — authenticated/licensed data access — exists in
  the first place.) A separately discovered conflict between this constraint and some other stated
  need — e.g. if a later `UserIdea` version adds a requirement no architecture can satisfy under
  $100/month — would be a new Conflict with its own Decision Impact assessment in a new version, not
  a reason this same unresolved cost-category item is rated differently now.
- **What IntentSpec must NOT decide:** `max_monthly_cost = 100` as a formal requirement; which
  specific services fit the budget.

---

## 7. User-selected technology

**UserIdea:** "Build a customer-support system using LangGraph, GPT-5, Pinecone, and Kubernetes."

- **User-provided claims:** the goal is a customer-support system; the user names LangGraph, GPT-5,
  Pinecone, and Kubernetes as the technologies to build it with. Force: the wording ("using X, Y, Z,
  W") is a direct, unhedged statement of method — no "maybe," "like," "e.g.," or similar hedge
  qualifies it. Intent Parsing preserves it at that stated strength; it does not soften it into an
  "example" or "illustrative" reading the wording doesn't support, and it does not inflate it into
  formal obligation either — see the Unknowns bullet below for why negotiability itself stays open
  rather than resolved in either direction.
- **Permissible inferences:** none needed to establish the named-technology claims themselves —
  they're explicit, and no further inference is safely drawable from the tool list alone. (A
  temptation like "the user prefers a modern/scalable stack" has no stated premise beyond "these
  are the names given" and would not meet the Inference Policy's basis requirement — it belongs in
  Unsafe Assumptions, not Permissible Inferences.)
- **Unsafe assumptions:** two symmetric errors, both unsafe. (1) Assuming each named technology is
  a hard, non-negotiable requirement, when nothing in the wording says "must" or "required." (2)
  Equally unsafe in the other direction: assuming the list is "merely illustrative" or that the
  user would readily accept substitutes — nothing in "using LangGraph, GPT-5, Pinecone, and
  Kubernetes" hedges it as an example the way "something like LangGraph, for instance" would. Both
  directions are unsupported weakening or strengthening of what was actually said; the wording
  supports neither reading over the other, which is exactly why negotiability is recorded as
  Unknown rather than resolved. Also unsafe: assuming Pinecone implies a vector-search requirement,
  or Kubernetes implies a container-orchestration requirement, derived from the tool names rather
  than from any stated functional need.
- **Unknowns:** whether the list is negotiable or a hard constraint — genuinely unaddressed by the
  `UserIdea`'s wording, which states the technologies directly without hedging either toward
  "example" or toward "mandatory"; why each was chosen; whether the user would accept an
  evidence-backed alternative.
- **Conflicts:** none.
- **Clarification needs:** HIGH — negotiability stays Unknown rather than being resolved by default
  in either direction, and the unresolved answer determines whether Pinecone-, Kubernetes-,
  LangGraph-, and GPT-5-specific architecture branches are mandatory or may be omitted/replaced.
- **Decision-impact reasoning:** the unresolved item is whether the four named technologies are
  binding constraints or negotiable — recorded as Unknown, not defaulted either way. Unlike Case 6's
  budget ceiling (where a constraint's existence is already settled and only its scope is
  unresolved), nothing else in this `UserIdea` independently establishes that a vector-search
  component, a container-orchestration component, or this specific workflow/model integration are
  needed at all — that expectation exists only because these particular technologies were named. On
  the least favorable materially plausible reading (all four binding, non-negotiable), Architecture
  Synthesis must build specifically around Pinecone/Kubernetes/LangGraph/GPT-5 regardless of
  technical fit; on the other reading, it has ordinary freedom to select components on their
  merits. That is a materially different architecture, not a detail within one, so HIGH applies —
  this version is Blocked and permanently ineligible for Requirement Derivation; resolving
  negotiability must produce a new, superseding version, the same as any other HIGH-impact item.
- **What IntentSpec must NOT decide:** whether LangGraph/GPT-5/Pinecone/Kubernetes are
  *appropriate* — IntentSpec preserves "user explicitly requested X" and nothing more (see "No
  Architecture Leakage" in `INTENT_SPEC.md`).

---

## 8. Contradictory requirements

**UserIdea:** "Everything must run locally. ... Also, just use a managed cloud-only service, that's
easiest."

- **User-provided claims:** (a) everything must run locally; (b) use a managed
  cloud-only service.
- **Permissible inferences:** none that resolve the contradiction — inference cannot manufacture
  compatibility between mutually exclusive claims.
- **Unsafe assumptions:** picking either claim as "what the user really meant"; assuming the later
  statement automatically supersedes the earlier one without an explicit signal that it's a
  correction (see Case 20 for the case where it *is* explicit).
- **Unknowns:** which claim reflects the user's actual priority, if either.
- **Conflicts:** yes — Claim (a) and Claim (b) cannot both hold. Recorded as a Conflict; both
  Claims retained with their own origin and provenance. Both sides are User-Provided, so per the
  Conflict Policy this is the strict case: Intent Parsing has no authority to pick a winner by any
  means, and only an explicit `UserIdea` revision (naming which statement it supersedes) can
  resolve it — unlike a conflict involving an Inference or Assumption, which Intent Parsing could
  revise on its own in a later run.
- **Clarification needs:** CRITICAL — deferrable only in the sense that `IntentSpec` itself can
  still be produced (Blocked, not failed — see below); this specific Blocked version is never
  consumable by Requirement Derivation, full stop — proceeding requires an explicit `UserIdea`
  revision that produces a new, separately-eligible version, not this one becoming eligible.
- **Decision-impact reasoning:** the unresolved item is the Conflict itself (claims (a) and (b));
  the downstream decision it changes is which of two materially different architectures
  (on-premises vs. managed cloud) gets built; CRITICAL applies (not merely HIGH) because proceeding
  on either side without resolution risks building against a constraint the user explicitly and
  directly contradicted — not just a suboptimal choice, but one the user may have explicitly ruled
  out.
- **What IntentSpec must NOT decide:** which claim wins. This Conflict is fully representable —
  both claims, their incompatibility, and the CRITICAL rating are all statable — so per the
  Handoff Status policy the correct outcome is a **Blocked** `IntentSpec` (not a fabricated choice,
  and not outright failure): the artifact is produced with the Conflict recorded, permanently
  ineligible for Requirement Derivation to consume. An explicit `UserIdea` revision doesn't make
  this version eligible — it produces a new version, and that new version is what Requirement
  Derivation may consume. Outright Intent Parsing failure would only apply if the input were
  additionally incoherent beyond this Conflict.

---

## 9. Conditional requirement

**UserIdea:** "Only use cloud execution if local execution can't support the workload."

- **User-provided claims:** a single conditional claim, exactly as stated — cloud execution is
  permitted only when local execution is insufficient for the workload. Strictly, this establishes
  a necessary condition for cloud use; it does not by itself establish that local is "preferred" or
  "default" outside that condition, and the Claim must not be recorded as though it did (recording
  "local preferred/default" as part of the explicit claim would be exactly the kind of conditional
  strengthening this contract prohibits — see I-12).
- **Permissible inferences:** that the framing ("only use cloud if local can't...") suggests a
  local-first preference ordering is a plausible pragmatic reading, but it is an Inference, not
  part of the Claim itself, and should be recorded with moderate (not high) confidence and a stated
  basis ("the conditional framing itself, not any separate preference statement") — not treated as
  settled. It is not an absolute prohibition on cloud either way.
- **Unsafe assumptions:** resolving the condition one way or the other now (`cloud_execution =
  true` or `= false`) instead of preserving it as a condition; silently picking one of throughput,
  memory, or latency as "what 'can't support' means" instead of preserving the Ambiguity.
- **Ambiguity:** what "can't support the workload" means technically — the phrase itself bears on
  the question but supports multiple materially different readings (throughput exhaustion? memory
  exhaustion? latency degradation? some combination?), so this is an Ambiguity, not an Unknown.
- **Unknowns:** the actual workload characteristics the criterion would be evaluated against, once
  a reading is chosen — nothing in the `UserIdea` addresses expected load at all.
- **Conflicts:** none — this is a single coherent conditional claim, not two contradictory ones.
- **Clarification needs:** HIGH — the condition itself is clear enough for Intent Parsing to
  produce a valid `IntentSpec` (this is not a Failure), but the unresolved Ambiguity it depends on
  determines whether the eventual architecture needs a dynamic local/cloud switching capability at
  all, not merely how that capability is tuned, so this version is Blocked and permanently
  ineligible for Requirement Derivation; resolving the Ambiguity must produce a new, superseding
  version.
- **Decision-impact reasoning:** the unresolved item is what "can't support the workload" means
  quantitatively; the downstream decision it changes is whether the architecture needs a runtime
  monitoring-and-fallback subsystem (dynamic hybrid deployment) at all, or whether the workload is
  knowable enough in advance to settle local-vs-cloud once, statically, at design time — a
  materially different architecture, not a detail within one. The Claim ("only use cloud if local
  can't support the workload") states a necessary condition for cloud use; it does not settle that
  a runtime-switching mechanism must be built — a statically-resolved deployment choice can equally
  satisfy a conditional preference if the workload turns out to be knowable in advance without
  runtime monitoring. HIGH applies for the same reason it applies to Case 11's extraction-mechanics
  fork: the unresolved item determines whether an entire capability exists, not merely how an
  already-necessary one is configured.
- **What IntentSpec must NOT decide:** the workload threshold; whether the fallback, if triggered,
  is automatic or requires approval.

---

## 10. Negative requirement

**UserIdea:** "Help teachers spot struggling students, but do not rank students or assign risk
scores."

- **User-provided claims:** (a) positive: help teachers identify possibly-struggling
  students; (b) prohibition: do not rank students; (c) prohibition: do not assign risk scores.
- **Permissible inferences:** the user wants support without reductive quantification of students —
  a values-level motivation, recorded as an Inference distinct from the claims themselves.
- **Unsafe assumptions:** that an unlabeled numeric output ("not a score, just a number") satisfies
  the prohibition; that the positive goal and the prohibitions are in tension and one must be
  weakened to satisfy the other.
- **Ambiguity:** what "struggling" means operationally — the word itself bears on the question but
  supports multiple materially different readings (academic performance? attendance? engagement?
  some combination?), so this is an Ambiguity, not an Unknown.
- **Unknowns:** what form of output would be acceptable (alerts? qualitative flags? trend
  descriptions?) beyond what the prohibitions already rule out.
- **Conflicts:** none logically — "identify possible need" and "don't rank/score" are not mutually
  exclusive, though they constrain the solution space together.
- **Clarification needs:** HIGH — the acceptable output form isn't specified, and which output
  mechanisms are even eligible depends on resolving it, since getting it wrong risks building
  against an explicit prohibition, not merely leaving a detail underspecified. This version is
  Blocked and permanently ineligible for Requirement Derivation, not merely deferred within an
  otherwise-eligible artifact; resolving the Ambiguity must produce a new, superseding version.
- **Decision-impact reasoning:** the unresolved item is what output form counts as compliant with
  the prohibitions; the downstream decision it changes is which output mechanisms are even eligible
  (a raw numeric score is out; qualitative flags may be in) — a materially different output
  architecture, not a detail within one, so HIGH applies. This does not reach CRITICAL: nothing here
  is unsafe, irreversible, or non-compliant with an external regulatory standard the way Cases 4/5/17's
  CRITICAL ratings are — but HIGH does not require that bar, only a materially different
  architecture, which proceeding on the wrong output form would produce.
- **What IntentSpec must NOT decide:** the acceptable output format; whether any per-student
  numeric value is permissible in any form.

---

## 11. Zero-agent-suitable automation

**UserIdea:** "I want an AI agent that renames uploaded invoices to
`YYYY-MM-DD_VENDOR_AMOUNT.pdf` using fields already on the invoice."

- **User-provided claims:** invoices should be renamed to a fixed pattern; the values populating
  that pattern come from fields "already on the invoice" — this establishes *where the values come
  from* (the invoice itself, not some external lookup), not *how they get read*; the user calls it
  an "AI agent."
- **Permissible inferences:** the renaming logic itself, once the values are known, is a
  deterministic mapping to a fixed filename pattern; "AI agent" is the user's proposed solution
  framing, not proof that reasoning/autonomy is actually needed.
- **Unsafe assumptions:** that "fields already on the invoice" means no extraction, OCR, or parsing
  is required — invoices are typically documents (PDFs, scans, images), and getting a value that is
  "on" a document into a usable field is exactly what extraction does; assuming this away treats an
  unresolved technical question as already settled. Equally unsafe: assuming an agent (LLM-based or
  otherwise) is required purely because the user used that word; or, conversely, deciding at this
  stage that zero agents is the right answer — extraction mechanics and architecture shape are both
  Architecture Synthesis's call, not Intent Parsing's.
- **Unknowns:** how the field values are actually extracted from the invoice (structured data
  export? OCR on a scan/PDF? something else?) — genuinely unaddressed by the `UserIdea`, and
  directly implicated because the renaming goal can't be safely compiled without knowing whether
  extraction is even a solved input or a real technical problem; what should happen when a field is
  missing or malformed; how filename collisions are handled.
- **Conflicts:** none.
- **Clarification needs:** none for the core renaming-pattern goal itself — it is a resolved Claim,
  not an Open Item, and carries no Decision Impact (`INTENT_SPEC.md`'s levels apply "to an Open Item
  or Conflict — not to Claims in general"). Edge-case behavior (missing fields, collisions) is LOW.
  The extraction-mechanics Unknown is HIGH: this version is Blocked and permanently ineligible for
  Requirement Derivation, not merely deferred to a later stage on this same artifact — Intent
  Parsing must not silently assume it solved, but resolving it requires a new Intent
  Parsing/revision pass producing a new, superseding version, since the answer determines whether
  an entire document-parsing/OCR subsystem is needed at all.
- **Decision-impact reasoning:** the unresolved item is how field values get extracted from the
  source invoice; the downstream decision it changes is whether the architecture needs any
  document-parsing/OCR capability at all, versus operating on already-structured data — a
  materially different architecture, not a detail within one, so HIGH applies (not the MEDIUM this
  case previously carried: extraction is not "genuinely a non-issue" precisely because the
  architecture fork is real). Collision/missing-field handling is separately, and consistently,
  LOW: well-specified, low-risk, and reversible regardless of how extraction resolves — a detail
  within whichever extraction architecture is eventually chosen, not a fork of its own.
- **What IntentSpec must NOT decide:** whether an LLM, an OCR pipeline, a rules engine, or a plain
  script performs the extraction and renaming. That determination belongs to Architecture Synthesis,
  informed by Requirement Derivation — but only once a new, superseding `IntentSpec` version has
  resolved the HIGH-impact question of whether extraction is even required at all (this Blocked
  version's own extraction Unknown does not reach Requirement Derivation or Architecture Synthesis
  directly). Zero-agent is one *possible* later architecture on that eventual eligible version, per
  Principle 14 — not a conclusion reached here.

---

## 12. High autonomy

**UserIdea:** "Give me an agent that runs my online store while I'm asleep."

- **User-provided claims:** the system should operate the online store; it should do so
  during periods the user is unavailable ("asleep").
- **Permissible inferences:** some degree of unattended operation is intended, since the premise is
  explicitly operating while the user cannot supervise.
- **Unsafe assumptions:** that "runs my store" includes financial actions (refunds, pricing
  changes, supplier orders); that full autonomy over all store functions is intended rather than a
  narrower subset.
- **Unknowns:** which specific activities are in scope (customer replies? refunds? pricing?
  inventory? advertising?); what authority level is intended for each; what happens on exceptions.
- **Conflicts:** none stated.
- **Clarification needs:** HIGH — the scope of unattended authority, especially anything financial,
  materially changes the risk profile and the required safeguards.
- **Decision-impact reasoning:** the unresolved item is which store activities are in scope and at
  what authority level; the downstream decision it changes is whether the architecture needs
  per-action approval gates (especially for anything financial) or can run fully unattended; HIGH
  applies (not CRITICAL) because unattended operation over commerce functions has real financial
  and reputational consequences if scope is misjudged, but nothing here is inherently irreversible
  or unsafe in the way a destructive or medical action would be.
- **What IntentSpec must NOT decide:** which specific actions are auto-approved vs. gated; any
  specific autonomy/approval architecture.

---

## 13. Human approval requirement

**UserIdea:** "I need approval before any deployment."

- **User-provided claims:** the user says approval is needed before deployment, with obligatory
  force ("I need"). This preserves the statement itself — it does not yet establish a
  system-enforced mechanism ("gate"), nor whether the user means they personally need to obtain
  approval from someone else, or that the system must enforce approval from a third party before
  acting; both are plausible readings of "I need approval."
- **Permissible inferences:** the user is cautious about unreviewed changes reaching some
  environment(s).
- **Ambiguity:** which environments "deployment" covers (production only? staging too?) — the word
  "deployment" alone supports multiple readings, so this is an Ambiguity, not an Unknown; likewise
  whether "I need approval" means self-directed process discipline or a system-enforced approval
  requirement is an Ambiguity in the statement's force/subject, not a blank gap.
- **Unsafe assumptions:** who the approver is; whether emergency/rollback paths are exempt;
  resolving either Ambiguity above by picking the reading that's easiest to implement.
- **Unknowns:** approver identity/role; whether any automated exception path is acceptable.
- **Conflicts:** none stated, though this would conflict with a separately stated desire for fully
  autonomous deployment (see how Case 8 models such a conflict).
- **Clarification needs:** HIGH overall, from two Ambiguities with different downstream
  consequences, assessed separately rather than bundled: the self-directed-vs-system-enforced
  Ambiguity is HIGH — it determines whether any approval-gate mechanism needs to exist in the
  architecture at all. The environment-scope Ambiguity is MEDIUM on its own — once a gate is
  established as needed, which environments it covers scopes that already-necessary capability
  rather than determining whether it exists; it is carried forward unresolved rather than collapsed
  into "production deployments only" (picking one reading here would violate the Ambiguity's own
  candidate-readings model, see "Unsafe assumptions" above). The overall `IntentSpec` is Blocked
  because the self-directed-vs-system-enforced item reaches HIGH, not because environment scope
  independently does.
- **Decision-impact reasoning:** two distinct Ambiguities, not one bundled item. (1) Whether "I need
  approval" is self-directed process discipline or a system-enforced requirement: the downstream
  decision is whether any approval-gate mechanism needs to exist in the architecture at all — a
  materially different architecture, not a detail within one, so HIGH applies regardless of whether
  a competing claim happens to exist yet. A competing claim implying autonomous deployment would
  additionally surface as a Conflict (as in Case 8), but is not required to reach HIGH here —
  needing a competing claim to justify HIGH would be exactly the stage-/conflict-relative reasoning
  "Decision Impact Is Outcome-Relative" in `INTENT_SPEC.md` rejects. (2) Which environments
  "deployment" covers: the downstream decision is only where an already-necessary gate applies, not
  whether one exists — a detail within an already-determined capability (contrast (1)), so MEDIUM
  applies on its own, though it does not lower the case's overall HIGH/Blocked disposition, which
  (1) alone already establishes.
- **What IntentSpec must NOT decide:** `human_approval = REQUIRED` as a formal requirement; the
  specific approval mechanism (CI gate, two-person rule, manual sign-off, etc.).

---

## 14. Unknown scale

**UserIdea:** "I need a booking platform for local fitness instructors. It should be ready for when
we go viral."

- **User-provided claims:** the system is a booking platform for local fitness
  instructors; the user wants it to handle a large increase in usage ("go viral").
- **Permissible inferences:** the user has a scale concern, but "viral" gives no usable magnitude.
- **Unsafe assumptions:** assigning any specific number of users, requests/sec, or geographic
  footprint; treating "viral" as internet-scale by default.
- **Ambiguity:** what "local" bounds geographically — the word itself bears on the question but
  supports multiple materially different readings (a neighborhood? a city? a metro area?), so this
  is an Ambiguity, not an Unknown.
- **Unknowns:** actual expected number of instructors/customers/bookings; whether "viral" readiness
  is essential now or aspirational for later.
- **Conflicts:** none.
- **Clarification needs:** the booking-platform Claim itself is clear enough for Intent Parsing to
  produce a valid `IntentSpec` — that is not in question. But that clarity does not offset the
  separately HIGH-impact scale Unknown (see reasoning below), which makes this version Blocked and
  permanently ineligible for Requirement Derivation, regardless of how clear the rest of the intent
  is. A capacity/scale figure ("design for moderate headroom by default") is exactly the kind of
  technical/operational default the Assumption Policy forbids Intent Parsing from inventing: the
  user raised a scale concern without giving a number, and MIHVER has no interpretive basis to
  convert that into a working figure. Because this item is HIGH-impact, resolving it does not mean
  handing the same live Unknown to Requirement Derivation on this version — per "Handoff Status:
  Blocked vs. Failed" in `INTENT_SPEC.md`, Requirement Derivation never consumes a Blocked version.
  Resolution requires clarification, additional context, or another Intent Parsing/revision pass
  that produces a new, superseding `IntentSpec` version; only that new version, and only if its own
  scale assessment no longer carries HIGH/CRITICAL impact, may reach Requirement Derivation.
- **Decision-impact reasoning:** the unresolved item is expected scale/magnitude; the downstream
  decision it changes is whether the architecture needs elastic/distributed capacity or a simpler
  fixed-capacity design — a materially different architecture, not a detail within one, so HIGH
  applies. Reversibility (a fixed-capacity starting point can later be revised) is why this does not
  reach CRITICAL, not why it stays below HIGH: HIGH requires only a materially different or
  significantly more expensive architecture, which this case's own downstream-decision description
  already states — it does not additionally require an unsafe or irreversible outcome, which is
  CRITICAL's bar. Because this is HIGH, not MEDIUM, the live Unknown cannot be carried forward for
  Requirement Derivation to pick up on this same version, the way a MEDIUM item legitimately could
  (contrast Case 6's cost-scope Unknown); Intent Parsing still must not pre-empt resolution with a
  guessed default, but what actually clears this Unknown is a new Intent Parsing/revision pass
  producing a new version — not a downstream stage resolving it on the Blocked one.
- **What IntentSpec must NOT decide:** any concurrency, traffic, or capacity figures; any elastic
  or distributed-architecture decision.

---

## 15. Unknown deployment

**UserIdea:** "Create a knowledge assistant for our engineers, but none of our internal documents
can leave the company."

- **User-provided claims:** the system assists engineers with internal knowledge; internal
  documents must not "leave the company."
- **Permissible inferences:** the user intends a data-boundary constraint of some kind.
- **Ambiguity:** what infrastructure boundary "the company" refers to (on-premises only? a
  company-controlled cloud tenant? any network the company administers?) — this traces directly to
  the phrase "leave the company" itself, which supports multiple readings; it is not resolvable
  from wording alone and must not collapse into any single reading, including "on-premises only."
- **Unsafe assumptions:** translating "leave the company" directly into "on-premises only" instead
  of preserving the Ambiguity; assuming a company-controlled cloud tenant does or doesn't satisfy
  the constraint; deciding whether derived data (embeddings, logs, prompts) counts as "documents."
- **Unknowns:** whether external network access of any kind is permitted, independent of the
  storage-boundary question — nothing in the `UserIdea` addresses network access directly, making
  this a genuine Unknown rather than a reading of existing wording.
- **Conflicts:** none stated.
- **Clarification needs:** HIGH — the trust boundary is central to any architecture recommendation
  MIHVER could responsibly make here.
- **Decision-impact reasoning:** the unresolved item is which infrastructure boundary "the company"
  denotes; the downstream decision it changes is which hosting/network topologies are even
  eligible; HIGH applies (not CRITICAL, since unlike Case 4's "my computer" this isn't phrased as
  an absolute personal-device prohibition) because proceeding on the wrong reading could still
  produce a recommendation that violates an explicit user constraint on data leaving the company.
- **What IntentSpec must NOT decide:** any specific hosting environment, network topology, or model
  provider selection.

---

## 16. Multi-goal request

**UserIdea:** "I need one system that recruits candidates, monitors employee productivity, predicts
who will quit, and automatically adjusts their pay."

- **User-provided claims:** four distinct stated goals — recruiting, productivity monitoring,
  attrition prediction, automatic pay adjustment — **and a separate, explicit claim that must be
  preserved in its own right: the user said "one system."** This is not incidental phrasing folded
  into the goals list; it's a Claim (force = as stated, effectively a preference/requirement that
  the four goals be delivered as a single system rather than several). `IntentSpec` preserves it
  exactly because the user said it — independent of whether one system later turns out to be the
  right call.
- **Permissible inferences:** this is a compound intent, not a single narrowly scoped goal;
  several of the stated activities materially affect people's employment and compensation.
- **Unsafe assumptions:** collapsing the four goals into a single generic "HR platform" label that
  loses their distinctness; assuming automatic pay adjustment is authorized merely because it was
  requested; assuming all four goals share equal priority.
- **Ambiguity:** what "monitors employee productivity" means operationally — the phrase itself
  bears on the question but supports materially different readings (output/results tracking? time
  tracking? application activity? communications monitoring?), with real stakes since some readings
  carry surveillance/privacy implications others don't, so this is an Ambiguity, not an Unknown.
- **Unknowns:** relative priority among the four goals; whether they must ship together or could be
  phased; what governs automatic pay changes.
- **Conflicts:** none stated between the goals themselves, though automatic pay adjustment and
  (if present) any separately stated human-approval requirement would conflict — not present in
  this UserIdea alone.
- **Clarification needs:** CRITICAL specifically for automatic pay adjustment (compensation actions
  taken without described oversight); MEDIUM for the three remaining priority/phasing Unknowns;
  MEDIUM separately for the productivity-monitoring Ambiguity (see reasoning below).
- **Decision-impact reasoning:** the unresolved item driving the top-line rating is what governs
  automatic pay changes (authorization, approval, limits — none stated); the downstream decision it
  changes is whether the architecture needs a human-in-the-loop compensation-change safeguard at
  all; CRITICAL applies because unauthorized, unreviewed pay changes are the kind of outcome the
  Decision Impact model's CRITICAL tier exists for. The three priority/phasing Unknowns are
  individually MEDIUM by the same three-part reasoning (unresolved: sequencing; changes: whether
  phased delivery is architecturally acceptable; MEDIUM because getting it wrong shifts delivery
  shape, not safety). The productivity-monitoring Ambiguity is assessed separately: which reading
  applies changes what kind of monitoring infrastructure and privacy/compliance safeguards are
  needed, which is more than a scheduling detail, but nothing in the `UserIdea` establishes that any
  reading crosses into unsafe or non-compliant territory the way the pay-adjustment item does, so
  MEDIUM applies rather than HIGH or CRITICAL. None of the MEDIUM items are averaged down against
  the pay-adjustment component; the highest-impact component governs the overall clarification need.
- **What IntentSpec must NOT decide:** whether a one-system architecture is technically
  appropriate, feasible, or the one Architecture Synthesis ultimately recommends — that evaluation
  belongs downstream, per Principle 2 (Evidence Before Recommendation). To be precise about what
  this means: `IntentSpec` *must* preserve that the user explicitly asked for one system (dropping
  or softening that Claim would violate Information-Loss Rules); it must *not* independently
  bless the request as sound, second-guess it, or decide the four goals will in fact ship as a
  single system — that outcome is Architecture Synthesis's call, informed by this preserved Claim
  among its inputs, not Intent Parsing's to predetermine either way. Also out of scope: any
  specific compensation-adjustment logic or approval workflow.

---

## 17. Unsafe production action

**UserIdea:** "Build an autonomous cleanup bot that permanently deletes anything in our production
database that looks obsolete."

- **User-provided claims:** target is the production database; the action is permanent
  deletion; eligibility is "looks obsolete"; operation should be autonomous.
- **Permissible inferences:** the user wants unattended, recurring or continuous cleanup, not a
  one-time manual review, given "autonomous" and "permanently deletes."
- **Unsafe assumptions:** any specific definition of "obsolete" (old? unused? unreferenced?
  duplicated?); that backups make the deletion effectively reversible; that the requester has
  authority to authorize permanent deletion of production data.
- **Ambiguity:** what "looks obsolete" means as a deletion criterion — the phrase itself bears on
  eligibility but supports multiple materially different readings (old? unused? unreferenced?
  duplicated?), so this is an Ambiguity, not an Unknown.
- **Unknowns:** data ownership/authorization; retention, audit, or legal constraints that might
  apply; whether "permanently" and "autonomous" are both truly non-negotiable.
- **Conflicts:** none stated, though this would conflict with a separately stated approval
  requirement (see Case 13) if one existed in the same UserIdea.
- **Clarification needs:** CRITICAL — irreversible destructive action on production data, triggered
  by a subjective/unresolved criterion, run autonomously. This is the paradigm case for a Blocked
  `IntentSpec`: everything statable (the claims, the undefined "obsolete" criterion, the
  authorization Unknown) is recorded in full, but the artifact is marked ineligible for
  Requirement Derivation while unresolved. This Blocked version never flips to eligible in place —
  whatever resolves the obsolescence criterion and authorization question (a user clarification, or
  other means) produces a new `IntentSpec` version; this version remains Blocked, permanently, in
  the history. Outright failure (no `IntentSpec` produced at all) would only apply if the input
  were additionally incoherent, not merely dangerous.
- **Decision-impact reasoning:** the unresolved items are what "looks obsolete" permits the bot to
  delete and whether the requester has authority to authorize that deletion; the downstream
  decisions they change are which production records are eligible for permanent deletion and
  whether any autonomous deletion path may exist at all. On the least favorable materially
  plausible reading, an undefined criterion authorizes unattended, permanent deletion of production
  data without established authority — irreversibility plus autonomy plus an undefined eligibility
  rule is exactly the combination the Decision Impact model's CRITICAL tier exists for, since the
  risk is an unauthorized and irreversible outcome, not merely a different or more expensive
  architecture (which would only reach HIGH).
- **What IntentSpec must NOT decide:** any concrete obsolescence rule; any confirmation, backup, or
  safety-mechanism design; whether the action proceeds at all.

---

## 18. User-selected technical means with unresolved negotiability

**UserIdea:** "Make a blockchain so our employees can edit the same policy document at once without
conflicts."

- **User-provided claims:** two separate claims, both preserved as stated and *not* merged or
  weighed against each other by Intent Parsing: (a) employees should be able to concurrently edit a
  shared policy document without conflicts; (b) the user requests "a blockchain" as the means,
  named explicitly (preserved per "No Architecture Leakage" — the claim is "user explicitly
  requested blockchain," nothing about whether blockchain is a good fit for (a)). Force on (b):
  "Make a blockchain" is a direct imperative, not hedged as an example or suggestion ("maybe a
  blockchain," "something like a blockchain") — Intent Parsing preserves it at that stated
  strength, neither softened into "illustrative" nor inflated into a more formal obligation than
  the wording itself carries.
- **Permissible inferences:** none that would characterize *why* the user named blockchain — MIHVER
  has no stated premise for a belief about the user's reasoning, and asserting one (e.g. "the user
  believes blockchain solves concurrent editing") would be speculation about mental state with no
  traceable basis, which the Inference Policy does not permit as an Inference.
- **Unsafe assumptions:** deciding, at Intent Parsing, that blockchain is or isn't a good technical
  fit for claim (a) — that is a suitability judgment reserved for Technology Candidate
  Identification / Architecture Synthesis under Principle 2 (Evidence Before Recommendation), and
  Intent Parsing must not make it even informally (e.g. by calling it a "misconception" or a
  "mismatch," both of which are suitability judgments); silently dropping claim (b) because it
  looks technically dubious; silently merging (a) and (b) into a single requirement that presumes
  blockchain satisfies (a).
- **Unknowns:** whether "blockchain" is a hard, non-negotiable constraint or whether the user would
  accept a technically justified alternative — the direct imperative preserves it as a strong
  User-Provided Claim but does not itself establish negotiability either way; why the user
  specifically wants blockchain (auditability? decentralized trust among departments? no reason
  beyond familiarity with the term?) — nothing in the `UserIdea` says, so this stays an Unknown
  rather than an unsupported Inference about the user's motivation.
- **Conflicts:** none — claims (a) and (b) are not logically incompatible; whether blockchain
  technically satisfies (a) is an open technical question for later stages, not a Conflict between
  two IntentSpec claims.
- **Clarification needs:** HIGH — negotiability is genuinely unresolved, and on the least favorable
  materially plausible reading (blockchain treated as non-negotiable), Architecture Synthesis must
  build around distributed-ledger/consensus infrastructure rather than a conventional
  collaborative-editing approach, regardless of technical fit. Intent Parsing can still produce a
  valid `IntentSpec` (both claims are fully statable, and this is not a Failure), but this version
  is Blocked and permanently ineligible for Requirement Derivation; resolving negotiability must
  produce a new, superseding version — not a case where deferring past Intent Parsing lowers the
  impact.
- **Decision-impact reasoning:** the unresolved item is whether the explicitly requested blockchain
  is binding or negotiable; the downstream decision it changes is whether the architecture must
  include a distributed-ledger/consensus branch — with its associated identity, state-
  representation, latency, and cost implications — or may instead use a conventional
  collaborative-editing architecture (e.g. CRDT/OT-based synchronization with ordinary document
  storage and versioning). On the least favorable materially plausible reading, blockchain is
  non-negotiable, producing a materially different and likely more expensive architecture than the
  alternative — the same test that makes Case 7's named-technology negotiability HIGH applies here.
  It does not reach CRITICAL: nothing in this `UserIdea` establishes an unsafe, invalid,
  non-compliant, or irreversible consequence, only an architecturally costly one if resolved
  unfavorably.
- **What IntentSpec must NOT decide:** whether blockchain is technically appropriate for goal (a);
  whether a blockchain-based or a CRDT/OT-based design should ultimately be recommended; any
  characterization of the user's request as mistaken, a "misconception," or a "mismatch" — those are
  suitability judgments reserved for downstream stages, not conclusions Intent Parsing draws to
  justify its own Decision Impact rating.

---

## 19. Vague "build the best system" request

**UserIdea:** "Just build me the best possible system for managing my small business."

- **User-provided claims:** the domain is "managing my small business"; the user wants
  the "best possible system," with no further specification.
- **Permissible inferences:** none that meaningfully narrow the goal — "best possible" and "managing
  my small business" do not, by themselves, support any inference about specific functionality.
- **Unsafe assumptions:** selecting any specific business function (accounting, scheduling,
  inventory, CRM, all of the above) as the intended scope; treating "best" as license to add
  maximal complexity or features MIHVER judges impressive.
- **Ambiguity:** what "best possible" would mean to this user — the phrase itself bears on the
  question but supports multiple materially different readings (cheapest? simplest? most
  feature-rich?), so this is an Ambiguity, not an Unknown.
- **Unknowns:** what the business actually does; which management activities are painful enough to
  be worth addressing.
- **Conflicts:** none.
- **Clarification needs:** CRITICAL — the request is too underspecified to support any accepted
  intent beyond "the user wants business-management help." Intent Parsing should not manufacture
  scope. This *is* representable, though: the domain, the "best possible" claim, and the
  under-specification itself are all statable Claims and Open Items — so the correct outcome is a
  **Blocked** `IntentSpec` (see "Handoff Status" in `INTENT_SPEC.md`), not a best-effort guess and
  not outright failure. Outright Intent Parsing failure would only apply to something even thinner
  than this — input so minimal that not even "domain: small-business management" could be
  extracted as a Claim.
- **Decision-impact reasoning:** the unresolved item is essentially the entire functional scope
  (what the system does); the downstream decision it changes is which business function(s) the
  architecture even targets — not a detail, the goal itself; CRITICAL applies (not HIGH) because
  *any* concrete architecture decision made from this input alone would be almost entirely MIHVER's
  invention rather than the user's intent, which is precisely the hallucination risk this contract
  exists to prevent — this is a more severe case of underspecification than an ordinary HIGH-level
  architectural divergence.
- **What IntentSpec must NOT decide:** any business function, feature set, or "best" criterion.
  MIHVER should record the goal as under-specified and require narrowing before proceeding, rather
  than filling the gap with popular defaults.

---

## 20. Follow-up correction that supersedes an earlier statement

**UserIdea (v1):** "I want it to cost under $100/month."
**UserIdea (v2, explicit correction):** "Actually, ignore what I said about the budget — it's
actually up to $500/month."

- **User-provided claims (v2):** a budget ceiling of $500/month; an explicit statement
  that this supersedes the earlier $100/month claim.
- **Permissible inferences:** none needed — the supersession is stated directly ("ignore what I
  said"), not inferred.
- **Unsafe assumptions:** retaining the $100/month Claim as still active alongside the new one
  (treating this as a Conflict rather than a supersession); silently updating the v1 `IntentSpec`
  in place instead of producing a new version.
- **Unknowns:** none newly introduced by the correction itself, beyond whatever was already
  unknown about cost scope (see Case 6).
- **Conflicts:** none — this is explicit supersession, not an unresolved Conflict. The v1 Claim is
  marked superseded, not deleted, and remains part of the historical record; only the current
  (v2) `IntentSpec` treats $500/month as the live budget claim.
- **Clarification needs:** none for the correction event itself — the explicit, unambiguous
  supersession is a resolved revision, not an Open Item or Conflict, so there is nothing here for a
  clarification decision to be computed from. `INTENT_SPEC.md`'s Decision Impact levels apply "to an
  Open Item or Conflict (not to Claims in general — a resolved Claim has no open impact to
  assess)"; assigning any level, including LOW, to the correction mechanics would be a category
  error, not a low-impact judgment. The surviving cost-scope Unknown carried over from Case 6 is
  separately assessed below and does need a clarification decision.
- **Decision-impact reasoning:** no Decision Impact level applies to the correction mechanics
  themselves, for the reason above. The live $500/month figure's cost-scope Unknown is assessed the
  same way as in Case 6 — MEDIUM, because it tunes the scope of an already-established budget
  ceiling rather than determining whether that constraint exists — just carried forward with the
  corrected value.
- **What IntentSpec must NOT decide:** silently discarding the historical v1 claim rather than
  marking it superseded (violates provenance/reproducibility); anything about which dependent
  Inferences or Assumptions from v1 need reconsideration — that reconsideration must happen, per
  the Revision and Version Semantics policy, but *what* changes as a result is a case-by-case
  analysis, not a fixed rule this corpus entry can predetermine.

---

## Dependency B: Memory-Derived Inference Premises

Nine adversarial cases exercising `INTENT_SPEC.md`'s "Memory-Derived Inference Premises" amendment
(ADR-0004 Dependency B). Each assumes an admitted `MemoryContext` entry, produced specifically for
Intent Parsing, is already available — the classification shown on each entry (Category A/B,
`influence_tier`) is exactly what `MEMORY_CONTEXT.md`'s Historical User Provenance Gate and
Influence Taxonomy would have already assigned it before Intent Parsing ever sees it; these cases
test what Intent Parsing is and is not permitted to do with an entry already carrying that
classification, not how the classification itself was reached.

### A. Valid Category A premise

**UserIdea (v2):** "Build a support-ticket triage system for our team." (No statement about message
queues.)
**MemoryContext entry (admitted, Category A, `influence_tier: SEMANTIC_PREMISE`):** "User said
(UserIdea v1, turn 3): 'we decided against a message queue for v1, the team isn't familiar with
one.'" — inspectably citing that exact prior `UserIdea` turn.

- **User-provided claims:** the domain is support-ticket triage for "our team"; no current statement
  about message queues.
- **Permissible inferences:** the system SHOULD avoid introducing a message queue for this phase,
  Inferred, citing the Category A `MemoryContext` entry as its sole premise, `derivation_confidence`
  moderate, marked provisional and reversible.
- **Unsafe assumptions:** treating the historical preference as a User-Provided Claim because it
  matches so directly; treating it as an Assumption instead of an Inference (a historical preference
  is an operational default, not a narrowly interpretive gap — Assumption Policy already excludes
  it).
- **Unknowns:** none newly introduced by the memory citation itself.
- **Conflicts:** none — the memory entry is not a Conflict participant.
- **Clarification needs:** none — a moderate-confidence, provisional Inference with no HIGH/CRITICAL
  item in play does not itself require clarification.
- **Decision-impact reasoning:** not applicable to the Inference itself (Decision Impact applies to
  Open Items/Conflicts, not resolved Claims); no HIGH/CRITICAL item is closed by this memory
  citation.
- **What IntentSpec must NOT decide:** labeling the resulting Claim User-Provided or Assumed; citing
  the entry's underlying `brain_memory_id` instead of the stable `(memory_context_id, entry_id)`
  pair; copying the entry's Brain confidence into `derivation_confidence`.

### B. Category B ceiling

**UserIdea (v1):** "Build a support-ticket triage system." (No statement about notification
channels.)
**MemoryContext entry (admitted, Category B, `influence_tier: DISCOVERY_ATTENTION`):** paraphrased
notes reading "user wanted email notifications," with no inspectable citation to any originating
`UserIdea` turn.

- **User-provided claims:** the domain is support-ticket triage; no current statement about
  notifications.
- **Permissible inferences:** none from the memory entry directly — Category B is categorically
  ineligible as an Inference premise, at any confidence or repetition level.
- **Unsafe assumptions/inferences:** citing the Category B entry as the premise of an Inferred Claim
  that the system should support email notifications; treating its lack of citation as merely
  "lower confidence" rather than a hard eligibility gate.
- **Unknowns:** notification channel, if relevant to the stated scope — Intent Parsing may record a
  candidate clarification question, provenance-visible to the memory entry, without treating the
  memory as the answer.
- **Conflicts:** none.
- **Clarification needs:** LOW/MEDIUM depending on scope — resolvable via the shaped clarification
  question below, never via the memory entry itself.
- **Decision-impact reasoning:** the entry may shape *what question gets asked*; it never settles
  the answer, regardless of Decision Impact level.
- **What IntentSpec must NOT decide:** citing the Category B entry as an Inference premise under any
  circumstance; promoting it to Category A because it "seems" directly stated.

### C. Current input overrides memory

**MemoryContext entry (admitted, Category A, `influence_tier: SEMANTIC_PREMISE`):** "user decided
against a managed cloud service for v1," inspectably cited.
**UserIdea (current version):** "This time, use a managed cloud database — we don't want to run our
own infrastructure."

- **User-provided claims:** the user explicitly wants a managed cloud database this time; does not
  want to self-host infrastructure.
- **Permissible inferences:** none in the memory's direction — the current, explicit statement wins
  completely. If a prior version's `IntentSpec` had already recorded a memory-premised Inferred
  Claim against managed cloud, the new version withdraws or revises that Claim under ordinary
  version semantics.
- **Unsafe assumptions:** treating the historical preference and the current statement as a
  symmetric Conflict requiring clarification — the memory entry never had Claim standing to conflict
  with anything; recording it as a Conflict participant.
- **Unknowns:** none introduced by this case.
- **Conflicts:** none — see above; this is revision, not Conflict.
- **Clarification needs:** none — the current `UserIdea` already resolves the question
  authoritatively.
- **Decision-impact reasoning:** not applicable; nothing is left open.
- **What IntentSpec must NOT decide:** recording a Conflict between the user and memory; silently
  keeping the withdrawn Inferred Claim alongside the new one as though both were still live.

### D. HIGH/CRITICAL is never closed by memory alone

**UserIdea:** "Build a system to process customer payment data." (No statement about compliance
scope.)
**MemoryContext entry (admitted, Category A, `influence_tier: SEMANTIC_PREMISE`-eligible content,
but the unresolved item here is CRITICAL):** "user said their prior project was PCI-DSS scoped."

- **User-provided claims:** the system processes customer payment data.
- **Permissible inferences:** none that close the compliance-scope question — even though the memory
  entry is Category A and otherwise premise-eligible, a CRITICAL item is never closed by memory
  alone.
- **Unsafe assumptions/inferences:** citing the entry as the premise of an Inferred Claim that
  settles "this system is PCI-DSS scoped," and marking the `IntentSpec` eligible on that basis.
- **Unknowns:** what payment/cardholder data this system stores, processes, or transmits, and what
  role it plays in that flow — the facts that actually determine PCI-DSS applicability, not the
  user's own label for the prior project — CRITICAL, since proceeding on the wrong reading risks a
  non-compliant architecture.
- **Conflicts:** none.
- **Clarification needs:** CRITICAL — the produced `IntentSpec` is Blocked. The memory entry may at
  most shape the clarification question ("a prior project of yours was PCI-DSS scoped — is that true
  here too?"), provenance-visible to the entry, never the version's eligibility.
- **Decision-impact reasoning:** payment-data processing without a settled compliance scope risks an
  unsafe or non-compliant architecture — the defining CRITICAL case.
- **What IntentSpec must NOT decide:** marking this version eligible because a Category A memory
  entry "answers" the compliance question; treating memory-shaped clarification as equivalent to
  actually clarifying.

### E. Historical force is not current force

**MemoryContext entry (admitted, Category A, `influence_tier: SEMANTIC_PREMISE`):** "user said (v1,
turn 4): 'we must never store customer data outside our home region,'" force = prohibition, as
historically stated.
**UserIdea (current version):** no statement about data residency.

- **User-provided claims:** none about data residency in the current version.
- **Permissible inferences (force present, independently reasoned):** the system SHOULD avoid
  storing customer data outside the home region, Inferred, citing the entry as premise, force =
  preference (not prohibition) with an explicit, independent current-run reasoning basis ("no
  current statement addresses residency, and a historical prohibition is not, by itself, sufficient
  grounds to independently justify a current MUST-level constraint without further current-run
  support") — deliberately *not* mechanically inheriting the historical statement's prohibition
  force.
- **Permissible inferences (force absent, alternative valid disposition):** the same proposition
  Inferred with no force at all, if Intent Parsing judges no independent current-run basis exists
  for assigning any force level.
- **Unsafe assumptions/inferences:** assigning the current Inferred Claim `force: prohibition`
  (MUST NOT) solely because the historical statement carried that force, with no independent
  current-run reasoning stated — this would let a stale historical prohibition harden into a current
  hard constraint with no confidence-based safeguard.
- **Unknowns:** data residency, if the stated scope implicates it.
- **Conflicts:** none.
- **Clarification needs:** depends on the stated scope; not automatically CRITICAL merely because
  the historical statement was strongly worded.
- **Decision-impact reasoning:** case-specific; the point under test is force derivation, not impact
  level.
- **What IntentSpec must NOT decide:** copying "must never" into the current Claim's force without
  an explicit, independent reasoning basis recorded separately from the historical-content
  provenance.

### F. No Assumed path for memory

**MemoryContext entry (admitted, Category A, `influence_tier: SEMANTIC_PREMISE`):** a historical
preference for a specific reporting cadence.

- **Permissible inferences:** the same historical-preference-as-premise pattern as Case A, origin
  Inferred.
- **Unsafe assumptions:** recording the memory-derived value as an Assumed Claim instead ("assume
  weekly reporting, per a prior project") — a historical preference is an operational default in
  Assumption Policy's own terms, not a narrowly interpretive gap, so there is no Assumed-origin path
  for memory-derived content at Intent Parsing, regardless of Decision Impact level.
- **What IntentSpec must NOT decide:** using Assumption Policy as an alternate, lower-ceremony path
  for memory content that doesn't clear the Category A gate, or for content that does.

### G. Repetition confers no authority

**MemoryContext entries (three admitted, all Category A, `influence_tier: SEMANTIC_PREMISE`,
`historical_user_category: A`):** three separate past runs all recording the same team's preference
against a specific cloud provider.

- **Permissible inferences:** an Inferred Claim citing one, several, or all three entries as
  premises still carries whatever `derivation_confidence` the reasoning itself independently
  supports — not automatically "high" merely because three entries agree.
- **Unsafe assumptions/inferences:** raising `derivation_confidence` to high, or upgrading the
  Claim's standing, specifically because the preference recurs across three memories rather than
  one — consistent with I-16, repetition, paraphrase, or multi-pass agreement does not by itself
  increase confidence or promote an item's origin.
- **What IntentSpec must NOT decide:** treating three duplicate/correlated historical statements as
  independent corroboration of each other; citing all three as separate premises of separate
  Inferences on the theory that more citations look more thorough.

### H. Type independence

**MemoryContext entry (admitted, stored Brain `type: reference`, but content-inspected and
reclassified `is_historical_user_statement: true`, `historical_user_category: A`,
`influence_tier: SEMANTIC_PREMISE`):** a `reference`-typed record whose body, on inspection, directly
quotes and cites an originating `UserIdea` turn.

- **Permissible inferences:** citable as an Inference premise exactly as a correctly-filed
  `decision`-typed Category A entry would be — eligibility here comes entirely from the
  `MemoryContext` classification (`is_historical_user_statement`, `historical_user_category`,
  `influence_tier`) already assigned at production, never from the entry's stored Brain `type`.
- **Unsafe assumptions/inferences:** refusing to cite the entry as a premise on the reasoning that
  "the Historical User Provenance Gate is about `decision` records" — Intent Parsing consumes the
  classification `MemoryContext` already computed, and never re-derives or second-guesses stored
  `type` against that classification.
- **What IntentSpec must NOT decide:** re-deriving Category A/B status from Brain `type` itself;
  treating a non-`decision` stored type as automatically disqualifying, or automatically Category B.

### I. Discovery provenance stays visible

**UserIdea:** "Build an internal knowledge-base search tool." (No statement about deployment
target.)
**MemoryContext entry (admitted, Category A, `influence_tier: DISCOVERY_ATTENTION`):** "user said
(v1, turn 2): 'we run everything on-prem, no cloud.'"

- **User-provided claims:** the domain is internal knowledge-base search; no current statement about
  deployment target.
- **Permissible inferences:** none from the memory directly (it is not cleared for `SEMANTIC_PREMISE`
  here) — instead, the Open Item for deployment target records a candidate clarification question
  ("a prior project of yours used on-prem deployment — is that still your preference here?"),
  provenance-visible to this specific `MemoryContext` entry.
- **Unsafe assumptions/inferences:** treating the shaped question's plausible answer as already
  known; recording a Claim before the current user actually answers.
- **Unknowns:** deployment target — MEDIUM, shifts architecture detail but is safe to defer to a
  clarifying question.
- **Conflicts:** none.
- **Clarification needs:** the candidate question is recorded, citing the memory entry; only the
  current user's own answer, if and when given, becomes a User-Provided Claim in a later version.
- **Decision-impact reasoning:** deferrable detail, not goal-level — MEDIUM.
- **What IntentSpec must NOT decide:** recording "on-prem" as any kind of Claim before the current
  user answers; letting the discovery-path reference be mistaken for, or promoted into, an Inference
  premise.
