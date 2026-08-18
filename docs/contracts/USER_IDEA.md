# Contract: UserIdea

Status: part of M0 Step 02A (Intent semantic contract). Implementation-independent — no
serialization, field names, or schema are defined here.

## Purpose

`UserIdea` is the pipeline's entry artifact: the immutable record of what the user actually
supplied to MIHVER before any interpretation happens. It exists so that every later artifact —
`IntentSpec`, `RequirementSpec`, and ultimately `ArchitectureDecision` — can be traced back to an
unmodified record of the original input, per Principle 11 (Reproducibility) and Principle 3
(Structured Artifacts Between Stages) in
[PRINCIPLES](../foundation/PRINCIPLES.md).

`UserIdea` is not an interpretation. It is not cleaned up, summarized, disambiguated, or
completed. Interpretation begins at Intent Parsing and is recorded in `IntentSpec`
(see [INTENT_SPEC](./INTENT_SPEC.md)).

## Semantic Meaning

A `UserIdea` instance means exactly this:

> "This is what the user supplied, at this point in time, in this form."

It does not mean:

- that the content is true,
- that the content is complete,
- that the content is internally consistent,
- that the content is technically feasible,
- that MIHVER understood it correctly.

Those are all questions for later stages. `UserIdea` only answers "what was supplied," never "what
it means" or "whether it's right."

## Source and Provenance Expectations

Every `UserIdea` must be traceable to:

- **who supplied it** — the identity of the source (a specific user or an equivalent input
  channel); this does not need to resolve to a verified real-world identity, only to a stable
  reference MIHVER can use consistently across a run;
- **when and in what turn/message it was supplied** — its position in the sequence of inputs the
  user has given MIHVER for this idea, so that a later correction or addition can be ordered
  relative to it;
- **what form it was supplied in** — at minimum, its source language, since translation (if any)
  is itself an interpretive act that belongs to Intent Parsing, not to `UserIdea` itself.

`UserIdea` may also carry **contextual input the user explicitly attached** — e.g., a pasted
document, a screenshot description, or a reference/link to material — as long as the user supplied
it as part of describing the idea. Context MIHVER independently gathers (research, prior evidence,
inferred history) is not part of `UserIdea`; it belongs to later stages (`ResearchPlan`,
`EvidenceBundle`). Where "attached" and "referenced" differ in kind, not just degree, see "Attached
content vs. external references" below.

### Attached content vs. external references

These are not the same thing, and `UserIdea` must not blur them:

- **Attached content** is bytes or text the user directly supplied — pasted, uploaded, or
  transcribed as part of the submission itself. This is genuinely user-supplied and belongs in
  `UserIdea` like any other statement.
- **An external reference** — a URL, file path, or other pointer the user supplies — is itself
  user-supplied (the reference string belongs in `UserIdea`, attributable exactly like anything
  else the user said — see "Relationship to IntentSpec" below for why this is content, not yet a
  Claim, while it's still part of `UserIdea`). But **content later fetched from that reference is
  not automatically user-authored and is not equivalent to attached bytes.** The user supplying a link
  establishes only that they pointed at it — not that they wrote, reviewed, or endorsed whatever
  MIHVER (or any later stage) subsequently retrieves from it. Fetched content, if and when MIHVER
  retrieves it, carries its own provenance as externally-sourced material — closer in kind to
  `Evidence` gathered during research than to something the user handed over directly — and is
  never folded into `UserIdea` or attributed to the user as if they had pasted it themselves.

## Immutability

A `UserIdea` instance is immutable once recorded. Nothing may edit its content in place —
not Intent Parsing, not a later correction from the user, not a bug-fix to a parsing error.

This exists so that every downstream artifact's provenance chain points at a fixed, historically
accurate record of what was actually said, per the Reproducibility principle. If an artifact could
be silently rewritten, "what the user said" would stop being a reliable anchor for anything built
on top of it.

## Revision and Version Semantics

Users correct themselves, add information, and change their minds. `UserIdea` accommodates this
through **versioned supersession**, consistent with the frozen "Stage Failure and Revision"
invariant in [M0_SCOPE](../foundation/M0_SCOPE.md).

### What a version is

A `UserIdea` **version** is the cumulative idea-state as of a point in time: everything the user
has supplied so far, up to and including the latest turn. It is *composed of* individually
immutable, individually attributable turns — version N is not a replacement for version N-1's
turns, it is version N-1's turns plus the new one. This resolves an otherwise-real ambiguity: a
version is aggregate in what it represents (the whole idea so far), while remaining strictly
per-turn in what's immutable and separately attributable (each individual statement, still
traceable to exactly when and how it was supplied).

- A follow-up statement that adds to, corrects, or withdraws part of an earlier `UserIdea` produces
  a **new `UserIdea` version** — the prior turns plus the new one. It does not rewrite any prior
  turn or any prior version.
- The prior version remains intact and retrievable. It is superseded, not deleted.
- A new `UserIdea` version does not retroactively change what an already-produced `IntentSpec`
  said. It creates the occasion for a new `IntentSpec` version (or an explicit Intent Parsing
  failure — see "Failure Semantics" in [INTENT_SPEC](./INTENT_SPEC.md)), per M0's general revision
  invariant: supersession, never in-place mutation.

### Explicit vs. implicit correction

`UserIdea` only records a supersession relationship — *this new turn supersedes that specific
earlier statement* — when the user's own words make that relationship explicit (e.g. "Ignore what
I said about the budget — it's actually $500/month," or "actually, scratch that"). Recording this
is not a violation of `UserIdea`'s "no interpretation" rule, because the linkage is what the user
said, not MIHVER's reading of it.

When a later statement merely *appears* to update or conflict with an earlier one without the user
explicitly framing it as a correction (e.g. the user simply states a different number without
saying "actually" or "ignore that"), `UserIdea` does **not** resolve which earlier statement is
affected — doing so would require interpretation, which belongs to Intent Parsing, not to this
artifact. In that case, both statements are preserved as their own turns, and it is `IntentSpec`'s
job (via the Conflict Policy in [INTENT_SPEC](./INTENT_SPEC.md)) to record the apparent
inconsistency — as a Conflict, not a silent supersession — unless and until the user makes the
relationship explicit.

## What UserIdea May Contain

- The user's own words, in the form they were supplied (text, or a faithful transcription/capture
  of another input modality).
- Content the user explicitly attached as part of describing the idea (pasted specs, examples,
  uploaded documents) — clearly attributable to the user's submission.
- A reference or link to material the user points at, as its own attributable statement — not the
  material itself (see "Attached content vs. external references" above).
- Multiple turns/messages that together make up the evolving idea, each individually attributable
  and ordered.

## What UserIdea Must Never Contain

- MIHVER's interpretation of what the user meant — that is `IntentSpec`'s job.
- Inferred, assumed, or defaulted information not actually supplied by the user.
- Corrections, normalizations, or "cleaned up" rewrites of the user's own words.
- Research findings, evidence, or technology information MIHVER gathered on its own.
- A merged or flattened view that erases which specific turn/version a given statement came from.
- Content fetched from a user-supplied URL or reference, treated as if the user had pasted it
  themselves — the reference belongs in `UserIdea`; the fetched content does not (see "Attached
  content vs. external references" above).

## Relationship to IntentSpec

`IntentSpec` is produced *from* one or more `UserIdea` versions by Intent Parsing. `UserIdea` is
the input; `IntentSpec` is the interpretation. Every claim in `IntentSpec` that is attributed to
the user must be traceable to a specific `UserIdea` version (and, where practical, to the specific
statement within it). `UserIdea` itself carries no epistemic categories (claim / inference /
assumption / unknown) — those categories exist only in `IntentSpec`, because they describe how
MIHVER related to the content, not what the content was.

## Invariants

- **UI-01 Immutability.** A recorded `UserIdea` version is never edited in place.
- **UI-02 Attribution.** Every `UserIdea` version is traceable to its source, turn, and time.
- **UI-03 No inference contamination.** `UserIdea` contains only what was supplied — never MIHVER's
  reading of it.
- **UI-04 Supersession, not mutation.** Corrections and additions produce new versions; prior
  versions remain retrievable.
- **UI-05 Explicit supersession linkage.** A supersession relationship is recorded only when the
  user's own wording explicitly signals correction or withdrawal ("ignore what I said," "actually,
  scratch that," "correction:") — never inferred merely because a new statement appears to conflict
  with or update an earlier one. When that explicit signal is present, the relationship is recorded,
  not left for downstream stages to infer silently; when it is absent, `UserIdea` records both
  statements as their own turns and leaves any apparent inconsistency for `IntentSpec`'s Conflict
  Policy to handle (see "Explicit vs. implicit correction" above).
- **UI-06 Faithful capture.** Any transcription or capture step (e.g. speech-to-text) must preserve
  the user's words as given; normalization for meaning happens only in `IntentSpec`.
- **UI-07 Reference vs. fetched content.** A user-supplied reference (URL, path, pointer) is
  user-supplied and belongs in `UserIdea`. Content later retrieved from that reference is not
  user-supplied, is not attributed to the user, and is never merged into `UserIdea`.

## Examples

- `UserIdea` (v1): "I want an assistant that answers customer emails."
- `UserIdea` (v2, supersedes part of v1): "Actually, it should only draft replies for a human to
  approve, not send them automatically."
- `UserIdea` (v1) with attached context: "Here's our current email volume report [attached]. I want
  something that helps us keep up with it."
- `UserIdea` (v1) with an external reference: "Our current process is documented here:
  https://example.com/our-process. Build something better." — the URL itself is user-supplied
  content, attributable to the user like any other statement in `UserIdea` (it becomes a
  User-Provided Claim only once `IntentSpec` represents it — `UserIdea` itself carries no epistemic
  categories, per "Relationship to IntentSpec" below); whatever text or content that page actually
  contains, if MIHVER later fetches it, is not part of this `UserIdea` and is not user-authored.

## Non-Examples

These are not valid `UserIdea` content, because they are not things the user supplied:

- "The user probably wants this to run in the cloud." — this is an inference; it belongs in
  `IntentSpec`, attributed as MIHVER's inference, not folded into `UserIdea`.
- "Users typically want email systems to be GDPR-compliant." — this is general knowledge MIHVER
  brought in, not something the user said; it does not belong in `UserIdea` (and even in
  `IntentSpec` it could only appear as an inference or a flagged assumption, never as a
  user-provided claim).
- A summarized, reworded version of three separate user messages merged into one paragraph with no
  record of which words came from which message.
