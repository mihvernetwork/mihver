import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function fail(message) {
  throw new Error(message);
}

function unique(values, label) {
  if (new Set(values).size !== values.length) fail(`${label} must be unique`);
}

function validateUserIdea(document) {
  const turns = new Map(document.turns.map((turn) => [turn.turn_id, turn]));
  unique([...turns.keys()], "turn_id values");
  unique(document.turns.map((turn) => turn.sequence), "turn sequence values");
  for (let index = 1; index < document.turns.length; index += 1) {
    if (document.turns[index - 1].sequence >= document.turns[index].sequence) {
      fail("turns must be ordered by increasing sequence");
    }
  }
  for (const turn of document.turns) {
    if (turn.source_id !== document.source.source_id) {
      fail(`turn ${turn.turn_id} source_id must match the UserIdea source_id`);
    }
    for (const content of turn.contents) {
      if (content.kind !== "attachment") continue;
      const bytes = Buffer.from(content.content_base64, "base64");
      if (bytes.toString("base64") !== content.content_base64) fail("attachment content_base64 must be canonical base64");
      const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
      if (digest !== content.content_digest) fail("attachment content_digest must match the supplied bytes");
    }
  }
  for (const relation of document.supersessions) {
    const newer = turns.get(relation.superseding_turn_id);
    const older = turns.get(relation.superseded_turn_id);
    if (!newer || !older) fail("supersession turn references must resolve in this cumulative version");
    if (newer.sequence <= older.sequence) fail("a superseding turn must occur after the superseded turn");
    const textualContents = newer.contents.filter((content) => ["text", "transcription"].includes(content.kind));
    if (!textualContents.some((content) => content.text.includes(relation.explicit_signal_quote))) {
      fail("explicit_signal_quote must occur verbatim in the superseding turn");
    }
  }
}

// Resolves a MemoryContext companion by its own stable identity (memory_context_id) out of a flat
// list of candidates -- never by array position. `memoryContexts` is always an array (possibly
// empty), never a single pre-selected document, so a fixture that supplies several MemoryContext
// companions for different purposes (e.g. one bound to Intent Parsing, one bound to Requirement
// Derivation) resolves each citation against the one it actually names.
function resolveMemoryContext(memoryContexts, memoryContextId) {
  return memoryContexts.find((candidate) => candidate.memory_context_id === memoryContextId) ?? null;
}

function validateMemoryPremiseAgainstCompanion(claimId, memoryPremise, memoryContexts) {
  const companion = resolveMemoryContext(memoryContexts, memoryPremise.memory_context_id);
  if (!companion) {
    fail(`inference ${claimId} memory premise memory_context_id "${memoryPremise.memory_context_id}" does not resolve to the supplied companion MemoryContext`);
  }
  const entry = companion.admitted_entries.find((candidate) => candidate.entry_id === memoryPremise.entry_id);
  if (!entry) {
    const excluded = companion.excluded_entries.some((candidate) => candidate.entry_id === memoryPremise.entry_id);
    if (excluded) fail(`inference ${claimId} memory premise entry_id "${memoryPremise.entry_id}" is an excluded entry in the supplied MemoryContext, not admitted`);
    fail(`inference ${claimId} memory premise entry_id "${memoryPremise.entry_id}" does not resolve in the supplied companion MemoryContext`);
  }
  if (companion.consuming_stage !== "intent_parsing") {
    fail(`inference ${claimId} cites a MemoryContext produced for consuming_stage "${companion.consuming_stage}", not "intent_parsing"`);
  }
  const classification = entry.classification;
  if (!classification.is_historical_user_statement || classification.historical_user_category !== "A") {
    fail(`inference ${claimId} memory premise entry "${memoryPremise.entry_id}" is not a Category A historical user statement in the supplied MemoryContext`);
  }
  if (classification.influence_tier !== "SEMANTIC_PREMISE") {
    fail(`inference ${claimId} memory premise entry "${memoryPremise.entry_id}" does not carry influence_tier "SEMANTIC_PREMISE" in the supplied MemoryContext`);
  }
  const citation = classification.historical_citation;
  const claimed = memoryPremise.historical_citation;
  const citationMatches = citation && citation.idea_id === claimed.idea_id && citation.user_idea_version === claimed.user_idea_version
    && citation.turn_id === claimed.turn_id && citation.quote === claimed.quote;
  if (!citationMatches) {
    fail(`inference ${claimId} memory premise historical_citation does not match the citation recorded on entry "${memoryPremise.entry_id}" in the supplied MemoryContext`);
  }
}

function validateDiscoveryRefAgainstCompanion(openItemId, ref, memoryContexts) {
  const companion = resolveMemoryContext(memoryContexts, ref.memory_context_id);
  if (!companion) {
    fail(`open item ${openItemId} memory_discovery_refs memory_context_id "${ref.memory_context_id}" does not resolve to any supplied companion MemoryContext`);
  }
  const entry = companion.admitted_entries.find((candidate) => candidate.entry_id === ref.entry_id);
  if (!entry) fail(`open item ${openItemId} memory_discovery_refs entry_id "${ref.entry_id}" does not resolve to an admitted entry in the supplied companion MemoryContext`);
  if (companion.consuming_stage !== "intent_parsing") {
    fail(`open item ${openItemId} memory_discovery_refs cites a MemoryContext produced for consuming_stage "${companion.consuming_stage}", not "intent_parsing"`);
  }
  const classification = entry.classification;
  if (!classification.is_historical_user_statement || (classification.historical_user_category !== "A" && classification.historical_user_category !== "B")) {
    fail(`open item ${openItemId} memory_discovery_refs entry "${ref.entry_id}" is not a historical user statement (Category A or B) in the supplied MemoryContext -- Intent Parsing's discovery path is restricted to historical-user memory, per MEMORY_CONTEXT.md's Historical User Memory Rule; a non-historical entry (pattern/incident/reference/process-decision) must not leak into Intent Parsing clarification provenance merely because it carries DISCOVERY_ATTENTION`);
  }
  if (classification.influence_tier !== "DISCOVERY_ATTENTION") {
    fail(`open item ${openItemId} memory_discovery_refs entry "${ref.entry_id}" does not carry influence_tier "DISCOVERY_ATTENTION" in the supplied MemoryContext`);
  }
}

function validateIntentSpec(document, memoryContextCompanions = []) {
  const claims = new Map(document.claims.map((item) => [item.claim_id, item]));
  const openItems = new Map(document.open_items.map((item) => [item.open_item_id, item]));
  const conflicts = new Map(document.conflicts.map((item) => [item.conflict_id, item]));
  const allIds = [...claims.keys(), ...openItems.keys(), ...conflicts.keys()];
  unique(allIds, "claim/open-item/conflict IDs");

  const sourceRefs = new Set(document.user_idea_refs.map((ref) => `${ref.idea_id}@${ref.version}`));
  unique([...document.user_idea_refs.map((ref) => `${ref.idea_id}@${ref.version}`)], "UserIdea references");
  if (new Set(document.user_idea_refs.map((ref) => ref.idea_id)).size !== 1) {
    fail("all IntentSpec user_idea_refs must belong to the same idea_id");
  }

  for (const companionMemoryContext of memoryContextCompanions) {
    if (companionMemoryContext.consuming_stage === "intent_parsing" && companionMemoryContext.upstream_artifact_binding) {
      const binding = companionMemoryContext.upstream_artifact_binding;
      if (binding.artifact_type === "user_idea") {
        const key = `${binding.artifact_id}@${binding.version}`;
        if (!sourceRefs.has(key)) {
          fail(`companion MemoryContext is bound to UserIdea ${key}, which is not among this IntentSpec's user_idea_refs`);
        }
      } else {
        fail(`companion MemoryContext produced for consuming_stage "intent_parsing" carries a non-null upstream_artifact_binding of artifact_type "${binding.artifact_type}", which is incompatible -- a MemoryContext consumed by Intent Parsing has no declared upstream artifact other than UserIdea, so a present binding must name "user_idea" (a null binding remains legitimate for a retrieval purpose that does not depend on any upstream artifact version)`);
      }
    }
  }

  for (const claim of document.claims) {
    if (claim.origin === "user_provided") {
      const key = `${claim.provenance.idea_id}@${claim.provenance.user_idea_version}`;
      if (!sourceRefs.has(key)) fail(`user-provided claim ${claim.claim_id} must trace to a listed UserIdea version`);
    }
    if (claim.origin === "inferred") {
      const premiseClaimIds = claim.provenance.premise_claim_ids ?? [];
      const memoryPremises = claim.provenance.memory_premises ?? [];
      if (premiseClaimIds.length === 0 && memoryPremises.length === 0) {
        fail(`inference ${claim.claim_id} must carry at least one Claim or MemoryContext premise`);
      }
      for (const premiseId of premiseClaimIds) {
        if (!claims.has(premiseId)) fail(`inference premise ${premiseId} does not resolve`);
        if (premiseId === claim.claim_id) fail(`inference ${claim.claim_id} cannot be its own premise`);
      }
      const memoryPairKeys = memoryPremises.map((premise) => JSON.stringify([premise.memory_context_id, premise.entry_id]));
      unique(memoryPairKeys, `memory premise (memory_context_id, entry_id) pairs of inference ${claim.claim_id}`);
      if (memoryPremises.length > 0) {
        if (claim.provenance.provisional !== true || claim.provenance.reversible !== true) {
          fail(`inference ${claim.claim_id} cites a memory premise and must carry provisional:true and reversible:true`);
        }
        if (claim.force !== undefined) {
          if (!claim.provenance.force_reasoning) {
            fail(`inference ${claim.claim_id} carries force and a memory premise; force_reasoning is required so historical force is never mistaken for independently-reasoned current force`);
          }
          if (claim.provenance.force_reasoning.basis.trim().length === 0) {
            fail(`inference ${claim.claim_id} force_reasoning.basis must not be whitespace-only`);
          }
        }
        if (claim.force === undefined && claim.provenance.force_reasoning) {
          fail(`inference ${claim.claim_id} has no force but carries force_reasoning; force_reasoning is only meaningful when the Claim carries force`);
        }
        if (memoryContextCompanions.length === 0) {
          fail(`inference ${claim.claim_id} cites a memory premise but no companion MemoryContext was supplied for deterministic resolution -- an IntentSpec must not become trustworthy merely by self-asserting Category A standing or copying a historical citation into its own provenance`);
        }
        for (const memoryPremise of memoryPremises) {
          validateMemoryPremiseAgainstCompanion(claim.claim_id, memoryPremise, memoryContextCompanions);
        }
      }
    }
  }

  for (const openItem of document.open_items) {
    if (openItem.kind === "ambiguity") {
      unique(openItem.candidate_readings.map((reading) => reading.reading_id), `reading IDs of ambiguity ${openItem.open_item_id}`);
      unique(openItem.candidate_readings.map((reading) => reading.reading), `reading texts of ambiguity ${openItem.open_item_id}`);
      for (const wordingRef of openItem.wording_refs) {
        const key = `${wordingRef.idea_id}@${wordingRef.user_idea_version}`;
        if (!sourceRefs.has(key)) fail(`ambiguity ${openItem.open_item_id} must trace to a listed UserIdea version`);
      }
    }
    const discoveryRefs = openItem.memory_discovery_refs ?? [];
    const discoveryPairKeys = discoveryRefs.map((ref) => JSON.stringify([ref.memory_context_id, ref.entry_id]));
    unique(discoveryPairKeys, `memory_discovery_refs pairs of open item ${openItem.open_item_id}`);
    if (discoveryRefs.length > 0) {
      if (memoryContextCompanions.length === 0) {
        fail(`open item ${openItem.open_item_id} carries memory_discovery_refs but no companion MemoryContext was supplied for deterministic resolution`);
      }
      for (const ref of discoveryRefs) {
        validateDiscoveryRefAgainstCompanion(openItem.open_item_id, ref, memoryContextCompanions);
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(claimId) {
    if (visiting.has(claimId)) fail("inference provenance must be acyclic");
    if (visited.has(claimId)) return;
    visiting.add(claimId);
    const claim = claims.get(claimId);
    if (claim?.origin === "inferred") (claim.provenance.premise_claim_ids ?? []).forEach(visit);
    visiting.delete(claimId);
    visited.add(claimId);
  }
  claims.forEach((_, id) => visit(id));

  const confidenceRank = { low: 0, moderate: 1, high: 2 };
  for (const claim of document.claims) {
    if (claim.origin !== "inferred") continue;
    const childConfidence = confidenceRank[claim.provenance.derivation_confidence];
    for (const premiseId of claim.provenance.premise_claim_ids ?? []) {
      const premise = claims.get(premiseId);
      if (premise.origin !== "inferred") continue;
      const premiseConfidence = confidenceRank[premise.provenance.derivation_confidence];
      if (childConfidence > premiseConfidence) {
        fail(`inference ${claim.claim_id} confidence cannot exceed inferred premise ${premiseId} confidence`);
      }
    }
  }

  for (const conflict of document.conflicts) {
    const refs = conflict.participants.map((participant) => participant.kind === "claim"
      ? `claim:${participant.claim_id}`
      : `ambiguity_reading:${participant.open_item_id}:${participant.reading_id}`);
    unique(refs, `participants of conflict ${conflict.conflict_id}`);
    for (const participant of conflict.participants) {
      if (participant.kind === "claim") {
        if (!claims.has(participant.claim_id)) fail(`conflict participant ${participant.claim_id} does not resolve`);
      } else {
        const ambiguity = openItems.get(participant.open_item_id);
        if (!ambiguity || ambiguity.kind !== "ambiguity") fail(`conflict ambiguity ${participant.open_item_id} does not resolve`);
        if (!ambiguity.candidate_readings.some((reading) => reading.reading_id === participant.reading_id)) {
          fail(`conflict ambiguity reading ${participant.reading_id} does not resolve`);
        }
      }
    }
  }

  const clarificationSubjects = [];
  for (const decision of document.clarification_decisions) {
    const targets = decision.subject_kind === "open_item" ? openItems : conflicts;
    if (!targets.has(decision.subject_id)) fail(`clarification subject ${decision.subject_id} does not resolve`);
    clarificationSubjects.push(`${decision.subject_kind}:${decision.subject_id}`);
  }
  unique(clarificationSubjects, "clarification subjects");
  const expectedSubjects = [
    ...[...openItems.keys()].map((id) => `open_item:${id}`),
    ...[...conflicts.keys()].map((id) => `conflict:${id}`)
  ];
  if (clarificationSubjects.length !== expectedSubjects.length || expectedSubjects.some((key) => !clarificationSubjects.includes(key))) {
    fail("every Open Item and Conflict must have exactly one separate clarification decision");
  }

  const impactLevels = [
    ...document.open_items.map((item) => item.decision_impact.level),
    ...document.conflicts.map((item) => item.decision_impact.level)
  ];
  const requiresBlock = impactLevels.some((level) => level === "high" || level === "critical");
  if (requiresBlock && document.handoff.status !== "blocked") {
    fail("an IntentSpec with a HIGH/CRITICAL unresolved item must be Blocked");
  }
  if (document.handoff.status === "blocked" && !requiresBlock) {
    fail("a Blocked IntentSpec must contain an unresolved HIGH/CRITICAL item");
  }
}

function validateMemoryContextClassification(label, classification) {
  if (classification.semantic_authority_class.trim().length === 0) {
    fail(`${label} semantic_authority_class must not be whitespace-only`);
  }
  if (classification.is_historical_user_statement) {
    if (classification.historical_user_category === null) {
      fail(`${label} is a historical user statement and must carry historical_user_category "A" or "B"`);
    }
  } else if (classification.historical_user_category !== null || classification.historical_citation !== null) {
    fail(`${label} is not a historical user statement and must not carry historical_user_category or historical_citation`);
  }
  if (classification.historical_user_category === "A" && classification.historical_citation === null) {
    fail(`${label} is Category A and must carry historical_citation`);
  }
  if (classification.historical_user_category === "B" && classification.historical_citation !== null) {
    fail(`${label} is Category B and must not carry historical_citation`);
  }
  if (classification.classification_method === "deterministic" && classification.classification_ambiguity !== null) {
    fail(`${label} has classification_method "deterministic" and must not carry classification_ambiguity`);
  }
}

function validateMemoryContext(document) {
  const outcomeCount = document.admitted_entries.length + document.excluded_entries.length;
  if (document.retrieval_outcome === "retrieval_unavailable" && outcomeCount !== 0) {
    fail("a retrieval_unavailable MemoryContext must carry zero admitted or excluded entries");
  }
  if (document.retrieval_outcome === "admitted" && document.admitted_entries.length < 1) {
    fail("an admitted MemoryContext must carry at least one admitted entry");
  }
  if (document.retrieval_outcome === "successfully_empty" && document.admitted_entries.length !== 0) {
    fail("a successfully_empty MemoryContext must carry zero admitted entries");
  }

  const allEntryIds = [
    ...document.admitted_entries.map((entry) => entry.entry_id),
    ...document.excluded_entries.map((entry) => entry.entry_id)
  ];
  unique(allEntryIds, "entry_id values across admitted_entries and excluded_entries");
  const allBrainMemoryIds = [
    ...document.admitted_entries.map((entry) => entry.source.brain_memory_id),
    ...document.excluded_entries.map((entry) => entry.source.brain_memory_id)
  ];
  unique(allBrainMemoryIds, "source.brain_memory_id values across admitted_entries and excluded_entries");

  const runContext = document.run_context;
  for (const entry of document.admitted_entries) {
    const scope = entry.source.scope;
    if (runContext.status === "absent" && scope !== "global") {
      fail(`admitted entry ${entry.entry_id} scope must be "global" when run_context is explicitly absent`);
    }
    if (runContext.status === "present" && scope !== "global" && scope !== runContext.project_slug) {
      fail(`admitted entry ${entry.entry_id} scope must be "global" or match run_context.project_slug`);
    }

    if (entry.source.brain_status === "superseded") {
      fail(`admitted entry ${entry.entry_id} must not carry brain_status "superseded" -- a superseded record is never admitted as though it were still live`);
    }
    if (entry.source.superseded_by !== null) {
      fail(`admitted entry ${entry.entry_id} carries a non-null superseded_by and must not be admitted -- being linked as superseded by another record means it is not the current live version`);
    }

    const classification = entry.classification;
    validateMemoryContextClassification(`admitted entry ${entry.entry_id}`, classification);

    const tier = classification.influence_tier;
    const isReclassifiedHistorical = classification.is_historical_user_statement;
    if (["lesson", "playbook"].includes(entry.source.brain_type) && !isReclassifiedHistorical && tier !== "PROCESS_ONLY") {
      fail(`admitted entry ${entry.entry_id} has brain_type "${entry.source.brain_type}" and is not reclassified as a historical user statement, so it must carry influence_tier "PROCESS_ONLY" -- lesson/playbook is PROCESS_ONLY-always only when content inspection does not redirect it to the Historical User Provenance Gate`);
    }
    if (isReclassifiedHistorical && tier === "DECISION_OPTION") {
      fail(`admitted entry ${entry.entry_id} is a historical user statement and must not carry influence_tier "DECISION_OPTION" -- MemoryContext source eligibility (Gate 2, M-21) categorically excludes any historical-user-statement entry from DECISION_OPTION regardless of category or content, independent of R-19 content eligibility (Gate 1); see MEMORY_CONTEXT.md's "No Assumed-Origin Path for Memory"`);
    }
    if (tier === "SEMANTIC_PREMISE" && !(isReclassifiedHistorical && classification.historical_user_category === "A")) {
      fail(`admitted entry ${entry.entry_id} carries influence_tier "SEMANTIC_PREMISE" but is not a Category A historical user statement -- only a Category A entry may reach SEMANTIC_PREMISE directly`);
    }
    if (classification.classification_method === "heuristic" && classification.classification_ambiguity !== null && ["DECISION_OPTION", "SEMANTIC_PREMISE"].includes(tier)) {
      fail(`admitted entry ${entry.entry_id} has an ambiguous heuristic classification and must not carry influence_tier "${tier}" -- ambiguity must resolve toward less authority, never more`);
    }
  }

  for (const entry of document.excluded_entries) {
    if (entry.classification !== null) {
      validateMemoryContextClassification(`excluded entry ${entry.entry_id}`, entry.classification);
    }
  }
}

// --- RequirementSpec (M0 Step 03B) --------------------------------------------------------------
//
// Companions are resolved by stable artifact identity (intent_spec_id@version, memory_context_id),
// never by array position -- `companions` is the full flat list of {contract, document} pairs the
// fixture supplied (see normalizeCompanions/resolveCompanions below), which may include more than
// one MemoryContext (e.g. one bound to Intent Parsing for the consumed IntentSpec's own Dependency-B
// memory_premises, and a separate one bound to Requirement Derivation for an R-24 citation).

const FORCE_TO_STRENGTH = {
  obligation: () => "MUST",
  prohibition: () => "MUST_NOT",
  permission: () => "MAY",
  preference: (strength) => (strength === "weak" ? "MAY" : "SHOULD")
};

// Returns the Force -> Requirement Strength Mapping's result for a claim, or null when the claim
// supplies no determinate strength: a force-absent (descriptive) claim (R-02), or -- since
// intent-spec.schema.json permits a `preference` claim with no `strength` sub-field at all -- a
// preference whose own strength was itself never resolved. Silently defaulting the latter to SHOULD
// would be exactly the kind of unauthorized strengthening R-05/R-06's non-inflation rule forbids;
// treating it as no-strength-at-all (structurally the same as R-20's unresolved-force case) is the
// non-inflationary reading.
function mappedStrength(claim) {
  if (!claim.force) return null;
  if (claim.force.modality === "preference" && claim.force.strength === undefined) return null;
  return FORCE_TO_STRENGTH[claim.force.modality](claim.force.strength);
}

// Provisional/reversible standing, per the *default* pairing "Treatment of Claim Origin" states for
// Inferred and Requirement-Level-Inference content: provisional:true always pairs with
// reversible:true; settled (provisional:false) requires a stated settled_rationale, and forbids one
// otherwise. Assumed-origin content has a *stricter*, unconditional rule with no settled escape --
// see validateOriginProvisionalStanding, which calls this only for the non-Assumed cases.
function validateProvisionalStanding(label, provisional) {
  if (provisional.provisional === false && !provisional.settled_rationale) {
    fail(`${label} is marked settled (provisional: false) and must state settled_rationale -- silence is not a stated reason continued reconsideration isn't warranted`);
  }
  if (provisional.provisional === true) {
    if (provisional.settled_rationale) fail(`${label} is provisional and must not carry settled_rationale`);
    if (provisional.reversible !== true) fail(`${label} is provisional and must also carry reversible: true -- the contract's stated default pairs the two`);
  }
}

// Origin-conditioned provisional-standing rule for a direct-compilation clause, per "Treatment of
// Claim Origin": Assumed origin "does require... provisional and reversible", unconditionally --
// unlike Inferred, Assumed carries no stated settled exception anywhere in REQUIREMENT_SPEC.md, so
// origins.has("assumed") is checked first and is strictest. A clause whose origins are exclusively
// user_provided carries no provisional concept at all.
function validateOriginProvisionalStanding(label, origins, provisional) {
  if (origins.has("assumed")) {
    if (!provisional) fail(`${label} origins include "assumed" and must carry provisional standing (R-04)`);
    if (provisional.provisional !== true || provisional.reversible !== true || provisional.settled_rationale) {
      fail(`${label} origins include "assumed" and must be unconditionally provisional: true / reversible: true -- Assumed origin, unlike Inferred, has no settled exception`);
    }
    return;
  }
  if (origins.has("inferred")) {
    if (!provisional) fail(`${label} origins include "inferred" and must carry provisional standing (default provisional/reversible, R-03)`);
    validateProvisionalStanding(label, provisional);
    return;
  }
  if (provisional) fail(`${label} origins are all "user_provided" and must not carry provisional standing`);
}

function validateMemoryInformedRationale(label, ref, memoryContexts) {
  const companion = resolveMemoryContext(memoryContexts, ref.memory_context_id);
  if (!companion) {
    fail(`${label} memory-informed rationale cites MemoryContext "${ref.memory_context_id}", which does not resolve to any supplied companion MemoryContext -- an R-24 citation must not become trustworthy merely by self-asserting`);
  }
  const entry = companion.admitted_entries.find((candidate) => candidate.entry_id === ref.entry_id);
  if (!entry) {
    const excluded = companion.excluded_entries.some((candidate) => candidate.entry_id === ref.entry_id);
    if (excluded) fail(`${label} memory-informed rationale entry "${ref.entry_id}" is an excluded entry in the supplied MemoryContext, not admitted`);
    fail(`${label} memory-informed rationale entry "${ref.entry_id}" does not resolve in the supplied companion MemoryContext`);
  }
  if (companion.consuming_stage !== "requirement_derivation") {
    fail(`${label} cites a MemoryContext produced for consuming_stage "${companion.consuming_stage}", not "requirement_derivation"`);
  }
  const classification = entry.classification;
  if (classification.influence_tier !== "DECISION_OPTION") {
    fail(`${label} memory-informed rationale entry "${ref.entry_id}" does not carry influence_tier "DECISION_OPTION"`);
  }
  if (classification.is_historical_user_statement) {
    fail(`${label} memory-informed rationale entry "${ref.entry_id}" is a historical user statement and categorically fails MemoryContext source eligibility (Gate 2, R-24/M-21) for DECISION_OPTION use, regardless of category -- see MEMORY_CONTEXT.md's "No Assumed-Origin Path for Memory"`);
  }
}

function validateRequirementDerivationMemoryContextBinding(mc, consumedIntentSpecRef) {
  if (mc.consuming_stage !== "requirement_derivation") return;
  if (!mc.upstream_artifact_binding) {
    fail(`companion MemoryContext "${mc.memory_context_id}" produced for consuming_stage "requirement_derivation" must carry a non-null upstream_artifact_binding -- per M0_SCOPE.md's "Stage: Requirement Derivation", this MemoryContext's own retrieval purpose exists only after a specific surviving Unknown in a specific IntentSpec version has already been established as R-19-eligible, so (unlike Intent Parsing's own, genuinely version-independent DISCOVERY_ATTENTION retrieval) a null binding is never legitimate here`);
  }
  const binding = mc.upstream_artifact_binding;
  if (binding.artifact_type !== "intent_spec" || binding.artifact_id !== consumedIntentSpecRef.intent_spec_id || binding.version !== consumedIntentSpecRef.version) {
    fail(`companion MemoryContext "${mc.memory_context_id}" produced for consuming_stage "requirement_derivation" carries an upstream_artifact_binding incompatible with the consumed IntentSpec "${consumedIntentSpecRef.intent_spec_id}@${consumedIntentSpecRef.version}" -- a MemoryContext consumed by Requirement Derivation for this purpose must be bound to the exact IntentSpec version containing the surviving Unknown its retrieval purpose depends on`);
  }
}

function validateWorkingDefault(label, workingDefault, openItems, memoryContexts) {
  const source = openItems.get(workingDefault.source_open_item_id);
  if (!source) fail(`${label} working default source_open_item_id "${workingDefault.source_open_item_id}" does not resolve in the consumed IntentSpec`);
  if (source.kind !== "unknown") fail(`${label} working default source_open_item_id "${workingDefault.source_open_item_id}" is an "${source.kind}", not an "unknown" -- R-19 only ever fills a surviving Unknown, never an Ambiguity or Conflict`);
  if (workingDefault.memory_informed_rationale) {
    validateMemoryInformedRationale(`${label} R-24`, workingDefault.memory_informed_rationale, memoryContexts);
  }
}

function validateDirectCompilationClause(label, clause, claims, openItems, memoryContexts, conflictedClaimIds) {
  const basisClaims = [];
  for (const ref of clause.basis) {
    const claim = claims.get(ref.claim_id);
    if (!claim) fail(`${label} basis claim "${ref.claim_id}" does not resolve in the consumed IntentSpec`);
    if (conflictedClaimIds.has(ref.claim_id)) {
      fail(`${label} basis claim "${ref.claim_id}" is a participant in an unresolved Conflict in the consumed IntentSpec -- R-08 forbids deriving a Requirement against one side of an unresolved Conflict`);
    }
    basisClaims.push(claim);
  }
  const declaredOrigins = new Set(clause.origins);
  if (basisClaims.length > 0) {
    for (const claim of basisClaims) {
      const mapped = mappedStrength(claim);
      if (mapped === null) fail(`${label} basis claim "${claim.claim_id}" is force-absent, or a preference whose own strength never resolved, and must not be normative basis for a clause -- R-02/R-05; use rationale_refs instead`);
      if (mapped !== clause.strength) {
        fail(`${label} strength "${clause.strength}" does not match basis claim "${claim.claim_id}"'s mapped strength "${mapped}" -- R-05/R-06 forbid inflating or weakening force-mapped strength`);
      }
    }
    const actualOrigins = new Set(basisClaims.map((claim) => claim.origin));
    if (actualOrigins.size !== declaredOrigins.size || [...actualOrigins].some((o) => !declaredOrigins.has(o))) {
      fail(`${label} origins ${JSON.stringify([...declaredOrigins])} does not match the exact set of basis claim origins ${JSON.stringify([...actualOrigins])} -- origin must be preserved, never collapsed (Information-Loss Rules)`);
    }
    if (actualOrigins.has("inferred")) {
      const actualConfidences = new Set(basisClaims.filter((claim) => claim.origin === "inferred").map((claim) => claim.provenance.derivation_confidence));
      const declaredConfidences = new Set(clause.derivation_confidences ?? []);
      if (actualConfidences.size !== declaredConfidences.size || [...actualConfidences].some((confidence) => !declaredConfidences.has(confidence))) {
        fail(`${label} derivation_confidences ${JSON.stringify([...declaredConfidences])} does not match the exact set of Inferred basis claim confidence values ${JSON.stringify([...actualConfidences])}`);
      }
    } else if (clause.derivation_confidences !== undefined) {
      fail(`${label} carries derivation_confidences but no basis claim is Inferred-origin`);
    }
    const anyScopeCondition = basisClaims.some((claim) => claim.scope_condition !== undefined);
    if (anyScopeCondition && !clause.scope_condition) {
      fail(`${label} a basis claim carries scope_condition but the clause records none -- R-07 forbids silently flattening a preserved condition`);
    }
  }
  validateOriginProvisionalStanding(label, declaredOrigins, clause.provisional);
  for (const ref of clause.rationale_refs ?? []) {
    if (ref.kind === "claim" && !claims.has(ref.claim_id)) fail(`${label} rationale claim "${ref.claim_id}" does not resolve in the consumed IntentSpec`);
    if (ref.kind === "open_item" && !openItems.has(ref.open_item_id)) fail(`${label} rationale open_item "${ref.open_item_id}" does not resolve in the consumed IntentSpec`);
  }
  for (const workingDefault of clause.working_defaults ?? []) {
    validateWorkingDefault(label, workingDefault, openItems, memoryContexts);
  }
  validateTestability(label, clause.testability, openItems);
}

function validateTestability(label, testability, openItems) {
  if (testability.status !== "complete_indeterminate") return;
  const source = openItems.get(testability.grounding_open_item_id);
  if (!source) fail(`${label} testability grounding_open_item_id "${testability.grounding_open_item_id}" does not resolve in the consumed IntentSpec`);
  if (source.kind !== "unknown") {
    fail(`${label} testability routes to INDETERMINATE via "${testability.grounding_open_item_id}", which is an "${source.kind}", not an "unknown" -- R-21 condition 1 permits only a surviving Unknown, never an Ambiguity or Conflict, to route a candidate to INDETERMINATE`);
  }
}

function validateRliClause(label, clause, claims, clauseIndex, requirementIndex, openItems, conflictedClaimIds) {
  let premiseStrength;
  let premiseScopeCondition;
  if (clause.premise.kind === "claim") {
    const claim = claims.get(clause.premise.claim_id);
    if (!claim) fail(`${label} RLI premise claim "${clause.premise.claim_id}" does not resolve in the consumed IntentSpec`);
    if (conflictedClaimIds.has(clause.premise.claim_id)) {
      fail(`${label} RLI premise claim "${clause.premise.claim_id}" is a participant in an unresolved Conflict in the consumed IntentSpec -- R-08 forbids inferring from one side of an unresolved Conflict`);
    }
    const mapped = mappedStrength(claim);
    if (mapped === null) fail(`${label} RLI premise claim "${clause.premise.claim_id}" is force-absent, or a preference whose own strength never resolved, and supplies no strength for R-22 inheritance`);
    premiseStrength = mapped;
    premiseScopeCondition = claim.scope_condition;
  } else if (clause.premise.kind === "requirement") {
    const premiseRequirement = requirementIndex.get(clause.premise.requirement_id);
    if (!premiseRequirement) fail(`${label} RLI premise requirement "${clause.premise.requirement_id}" does not resolve in this RequirementSpec`);
    if (premiseRequirement.status === "invalidated") {
      fail(`${label} RLI premise requirement "${clause.premise.requirement_id}" is invalidated -- an inference whose premise no longer holds is itself unsupported ("Requirement Invalidation and Re-Derivation")`);
    }
    const strengths = new Set(premiseRequirement.clauses.map((premiseClause) => premiseClause.strength));
    if (strengths.size !== 1) {
      fail(`${label} RLI premise requirement "${clause.premise.requirement_id}" has no single strength across its clauses (${[...strengths].join(", ")}) -- premise a specific clause instead ('requirement_clause'), per R-22`);
    }
    [premiseStrength] = strengths;
    premiseScopeCondition = premiseRequirement.clauses.length === 1 ? premiseRequirement.clauses[0].scope_condition : undefined;
  } else {
    const entry = clauseIndex.get(clause.premise.clause_id);
    if (!entry || entry.requirement.requirement_id !== clause.premise.requirement_id) {
      fail(`${label} RLI premise clause "${clause.premise.requirement_id}/${clause.premise.clause_id}" does not resolve in this RequirementSpec`);
    }
    if (entry.requirement.status === "invalidated") {
      fail(`${label} RLI premise clause "${clause.premise.requirement_id}/${clause.premise.clause_id}" belongs to an invalidated Requirement -- an inference whose premise no longer holds is itself unsupported`);
    }
    premiseStrength = entry.clause.strength;
    premiseScopeCondition = entry.clause.scope_condition;
  }
  if (premiseStrength !== clause.strength) {
    fail(`${label} strength "${clause.strength}" does not match its Requirement-Level Inference premise's own strength "${premiseStrength}" -- R-22 forbids independently choosing, strengthening, or weakening it`);
  }
  if (premiseScopeCondition !== undefined && !clause.scope_condition) {
    fail(`${label} its Requirement-Level Inference premise carries scope_condition but the clause records none -- R-07 forbids silently flattening a preserved condition`);
  }
  validateProvisionalStanding(label, clause.provisional);
  validateTestability(label, clause.testability, openItems);
}

function validateRequirementSpec(document, companions) {
  const intentSpecCompanions = companions.filter((c) => c.contract === "intent-spec").map((c) => c.document);
  const memoryContexts = companions.filter((c) => c.contract === "memory-context").map((c) => c.document);
  unique(intentSpecCompanions.map((doc) => `${doc.intent_spec_id}@${doc.version}`), "companion IntentSpec identities (intent_spec_id@version)");
  unique(memoryContexts.map((doc) => doc.memory_context_id), "companion MemoryContext identities (memory_context_id)");

  const ref = document.consumed_intent_spec;
  const intentSpec = intentSpecCompanions.find((doc) => doc.intent_spec_id === ref.intent_spec_id && doc.version === ref.version);
  if (!intentSpec) fail(`consumed_intent_spec "${ref.intent_spec_id}@${ref.version}" does not resolve to a supplied companion IntentSpec`);
  if (intentSpec.handoff.status === "blocked") {
    fail(`consumed IntentSpec "${ref.intent_spec_id}@${ref.version}" is Blocked -- Requirement Derivation may never consume a Blocked IntentSpec, in whole or in part`);
  }

  const claims = new Map(intentSpec.claims.map((claim) => [claim.claim_id, claim]));
  const openItems = new Map(intentSpec.open_items.map((item) => [item.open_item_id, item]));
  const conflicts = new Map(intentSpec.conflicts.map((item) => [item.conflict_id, item]));
  const conflictedClaimIds = new Set();
  for (const conflict of intentSpec.conflicts) {
    for (const participant of conflict.participants) {
      if (participant.kind === "claim") conflictedClaimIds.add(participant.claim_id);
    }
  }

  for (const mc of memoryContexts) validateRequirementDerivationMemoryContextBinding(mc, ref);

  if (document.version === 1 && document.revision !== null) fail("a version-1 RequirementSpec must carry revision: null -- there is nothing to revise yet");
  if (document.version > 1 && document.revision === null) fail(`RequirementSpec version ${document.version} must carry a non-null revision (R-12/R-13)`);
  if (document.revision !== null) {
    const { affected_requirement_ids: affectedReqs, affected_open_item_ids: affectedItems } = document.revision;
    if (affectedReqs.length === 0 && affectedItems.length === 0) {
      fail('revision must name at least one of affected_requirement_ids/affected_open_item_ids -- "Requirement Identity and Versioning" requires recording which Requirement(s)/Open Item(s) a revision affects');
    }
  }

  unique(document.requirements.map((requirement) => requirement.requirement_id), "requirement_id values");
  const allClauseIds = [];
  const clauseIndex = new Map();
  const requirementIndex = new Map(document.requirements.map((requirement) => [requirement.requirement_id, requirement]));
  for (const requirement of document.requirements) {
    unique(requirement.clauses.map((clause) => clause.clause_id), `clause_id values of requirement ${requirement.requirement_id}`);
    for (const clause of requirement.clauses) {
      allClauseIds.push(clause.clause_id);
      clauseIndex.set(clause.clause_id, { requirement, clause });
    }
    if (requirement.status === "invalidated" && requirement.invalidation === null) {
      fail(`requirement ${requirement.requirement_id} is invalidated and must carry a non-null invalidation -- R-14`);
    }
    if (requirement.status === "valid" && requirement.invalidation !== null) {
      fail(`requirement ${requirement.requirement_id} is valid and must not carry invalidation`);
    }
  }
  unique(allClauseIds, "clause_id values across the whole RequirementSpec");
  unique(document.open_items.map((item) => item.open_item_id), "open_item_id values");

  let anyBlockingItem = false;
  const workingDefaultMemoryKeys = [];
  const workingDefaultSourceItems = [];
  for (const requirement of document.requirements) {
    for (const clause of requirement.clauses) {
      const label = `requirement ${requirement.requirement_id} clause ${clause.clause_id}`;
      if (clause.derivation === "direct_compilation") {
        validateDirectCompilationClause(label, clause, claims, openItems, memoryContexts, conflictedClaimIds);
        for (const workingDefault of clause.working_defaults ?? []) {
          workingDefaultSourceItems.push(workingDefault.source_open_item_id);
          if (workingDefault.memory_informed_rationale) {
            workingDefaultMemoryKeys.push(JSON.stringify([
              workingDefault.source_open_item_id,
              workingDefault.memory_informed_rationale.memory_context_id,
              workingDefault.memory_informed_rationale.entry_id
            ]));
          }
        }
      } else {
        validateRliClause(label, clause, claims, clauseIndex, requirementIndex, openItems, conflictedClaimIds);
      }
      if (clause.testability.status === "blocked") anyBlockingItem = true;
    }
  }
  // A surviving Unknown is filled at most once across the whole document -- two working defaults
  // for the same source_open_item_id (with or without a memory citation) would otherwise let a
  // document record contradictory values for one Unknown with nothing to catch it; this check
  // subsumes the narrower (source_open_item_id, memory_context_id, entry_id) case.
  unique(workingDefaultSourceItems, "R-19 working_defaults source_open_item_id values across the whole RequirementSpec");
  unique(workingDefaultMemoryKeys, "R-24 (source_open_item_id, memory_context_id, entry_id) working-default citations");

  const unfillableSourceIds = new Set();
  for (const item of document.open_items) {
    const label = `open item ${item.open_item_id}`;
    if (item.kind === "ambiguity") {
      const source = openItems.get(item.source_open_item_id);
      if (!source || source.kind !== "ambiguity") fail(`${label} source_open_item_id "${item.source_open_item_id}" does not resolve to an ambiguity in the consumed IntentSpec`);
      anyBlockingItem = true;
    } else if (item.kind === "conflict") {
      if (!conflicts.has(item.source_conflict_id)) fail(`${label} source_conflict_id "${item.source_conflict_id}" does not resolve in the consumed IntentSpec`);
      anyBlockingItem = true;
    } else if (item.kind === "unfillable_unknown") {
      const source = openItems.get(item.source_open_item_id);
      if (!source || source.kind !== "unknown") fail(`${label} source_open_item_id "${item.source_open_item_id}" does not resolve to an unknown in the consumed IntentSpec`);
      unfillableSourceIds.add(item.source_open_item_id);
      anyBlockingItem = true;
    } else if (item.kind === "unfilled_r19_unknown") {
      const source = openItems.get(item.source_open_item_id);
      if (!source || source.kind !== "unknown") fail(`${label} source_open_item_id "${item.source_open_item_id}" does not resolve to an unknown in the consumed IntentSpec`);
    } else if (item.kind === "unresolved_constraint_candidate") {
      const source = claims.get(item.source_claim_id);
      if (!source) fail(`${label} source_claim_id "${item.source_claim_id}" does not resolve in the consumed IntentSpec`);
      if (source.force !== undefined) {
        fail(`${label} source_claim_id "${item.source_claim_id}" carries a resolved force -- R-20 applies only to a Claim whose force never resolved to obligation/prohibition/permission/preference`);
      }
      anyBlockingItem = true;
    }
  }

  for (const sourceId of workingDefaultSourceItems) {
    if (unfillableSourceIds.has(sourceId)) {
      fail(`source_open_item_id "${sourceId}" is both recorded as an "unfillable_unknown" open item (fails R-19) and filled by a working_default (requires R-19 eligibility) -- these are mutually exclusive dispositions for the same surviving Unknown`);
    }
  }

  if (anyBlockingItem && document.status !== "partial") {
    fail('a RequirementSpec with an unresolved ambiguity/conflict/unfillable-unknown/unresolved-constraint-candidate open item, or a testability-blocked clause, must carry status "partial"');
  }

  // R-23 acyclicity: a Requirement-Level Inference premise graph over clause_ids must be acyclic.
  // A clause premising itself is caught here too (visiting a clause already on the current path).
  // A whole-Requirement premise ('requirement' kind) fans out to every clause of that Requirement --
  // a cycle through any one of them is still a cycle.
  const visiting = new Set();
  const visited = new Set();
  function visit(clauseId) {
    if (visiting.has(clauseId)) fail("Requirement-Level Inference premises must be acyclic");
    if (visited.has(clauseId)) return;
    const entry = clauseIndex.get(clauseId);
    if (!entry) return;
    visiting.add(clauseId);
    if (entry.clause.derivation === "requirement_level_inference") {
      if (entry.clause.premise.kind === "requirement_clause") {
        visit(entry.clause.premise.clause_id);
      } else if (entry.clause.premise.kind === "requirement") {
        const premiseRequirement = requirementIndex.get(entry.clause.premise.requirement_id);
        (premiseRequirement?.clauses ?? []).forEach((premiseClause) => visit(premiseClause.clause_id));
      }
    }
    visiting.delete(clauseId);
    visited.add(clauseId);
  }
  allClauseIds.forEach(visit);
}

// --- Multi-companion fixture harness ------------------------------------------------------------
//
// Backward compatible: the existing singular `fixture.companion` shape keeps working unchanged.
// `fixture.companions` (plural, array of {contract, document}) is the smallest addition needed for
// RequirementSpec's own multi-companion needs (a consumed IntentSpec, plus zero or more MemoryContext
// documents for R-24 citations and/or the IntentSpec's own Dependency-B memory references) --
// resolved by each companion's own stable identity inside its semantic validator (see
// resolveMemoryContext, and validateRequirementSpec's intent_spec_id@version lookup), never by which
// position it occupies in this array.
function normalizeCompanions(fixture) {
  const list = [];
  if (fixture.companion) list.push(fixture.companion);
  if (fixture.companions) list.push(...fixture.companions);
  return list;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const userSchema = await json("schemas/m0/user-idea.schema.json");
const intentSchema = await json("schemas/m0/intent-spec.schema.json");
const memoryContextSchema = await json("schemas/m0/memory-context.schema.json");
const requirementSpecSchema = await json("schemas/m0/requirement-spec.schema.json");
const validateSchema = ajv.compile({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object"
});
assert.equal(validateSchema(userSchema), true, "UserIdea schema must itself be valid JSON Schema");
assert.equal(validateSchema(intentSchema), true, "IntentSpec schema must itself be valid JSON Schema");
assert.equal(validateSchema(memoryContextSchema), true, "MemoryContext schema must itself be valid JSON Schema");
assert.equal(validateSchema(requirementSpecSchema), true, "RequirementSpec schema must itself be valid JSON Schema");
const validators = {
  "user-idea": { schema: ajv.compile(userSchema), semantic: validateUserIdea },
  "intent-spec": { schema: ajv.compile(intentSchema), semantic: validateIntentSpec },
  "memory-context": { schema: ajv.compile(memoryContextSchema), semantic: validateMemoryContext },
  "requirement-spec": { schema: ajv.compile(requirementSpecSchema), semantic: validateRequirementSpec }
};

async function fixtureFiles(directory) {
  const base = path.join(root, "tests/contracts/fixtures", directory);
  return (await readdir(base)).filter((name) => name.endsWith(".json")).sort().map((name) => path.join(base, name));
}

// The extra positional argument(s) each contract's semantic validator needs, derived from the full
// flat companions list by contract-filtering (never by position) -- "user-idea" and "memory-context"
// need none of their own.
function semanticArgsFor(contract, companions) {
  if (contract === "intent-spec") return [companions.filter((c) => c.contract === "memory-context").map((c) => c.document)];
  if (contract === "requirement-spec") return [companions];
  return [];
}

let checked = 0;
for (const expectation of ["valid", "invalid"]) {
  for (const file of await fixtureFiles(expectation)) {
    const fixture = JSON.parse(await readFile(file, "utf8"));
    const validator = validators[fixture.contract];
    assert.ok(validator, `${file}: unknown contract selector`);
    let valid = validator.schema(fixture.document);
    let diagnostic = valid ? "" : JSON.stringify(validator.schema.errors);

    const companions = normalizeCompanions(fixture);
    if (valid) {
      for (const companion of companions) {
        const companionValidator = validators[companion.contract];
        assert.ok(companionValidator, `${file}: unknown companion contract selector "${companion.contract}"`);
        if (!companionValidator.schema(companion.document)) {
          valid = false;
          diagnostic = JSON.stringify(companionValidator.schema.errors);
          break;
        }
      }
    }
    if (valid) {
      for (const companion of companions) {
        const companionValidator = validators[companion.contract];
        try { companionValidator.semantic(companion.document, ...semanticArgsFor(companion.contract, companions)); }
        catch (error) { valid = false; diagnostic = error.message; break; }
      }
    }
    if (valid) {
      try { validator.semantic(fixture.document, ...semanticArgsFor(fixture.contract, companions)); }
      catch (error) { valid = false; diagnostic = error.message; }
    }
    if (expectation === "valid") assert.equal(valid, true, `${file} should be valid:\n${diagnostic}`);
    else {
      assert.equal(valid, false, `${file} should be invalid`);
      assert.ok(diagnostic.length > 0, `${file} must produce a deterministic diagnostic`);
      assert.ok(fixture.expected_error, `${file} must declare its intended expected_error`);
      assert.ok(diagnostic.includes(fixture.expected_error), `${file} failed for the wrong reason:\n${diagnostic}`);
    }
    checked += 1;
  }
}

console.log(`Contract validation passed: ${checked} fixtures checked.`);
