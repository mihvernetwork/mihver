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

function validateIntentSpec(document) {
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

  for (const claim of document.claims) {
    if (claim.origin === "user_provided") {
      const key = `${claim.provenance.idea_id}@${claim.provenance.user_idea_version}`;
      if (!sourceRefs.has(key)) fail(`user-provided claim ${claim.claim_id} must trace to a listed UserIdea version`);
    }
    if (claim.origin === "inferred") {
      for (const premiseId of claim.provenance.premise_claim_ids) {
        if (!claims.has(premiseId)) fail(`inference premise ${premiseId} does not resolve`);
        if (premiseId === claim.claim_id) fail(`inference ${claim.claim_id} cannot be its own premise`);
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
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(claimId) {
    if (visiting.has(claimId)) fail("inference provenance must be acyclic");
    if (visited.has(claimId)) return;
    visiting.add(claimId);
    const claim = claims.get(claimId);
    if (claim?.origin === "inferred") claim.provenance.premise_claim_ids.forEach(visit);
    visiting.delete(claimId);
    visited.add(claimId);
  }
  claims.forEach((_, id) => visit(id));

  const confidenceRank = { low: 0, moderate: 1, high: 2 };
  for (const claim of document.claims) {
    if (claim.origin !== "inferred") continue;
    const childConfidence = confidenceRank[claim.provenance.derivation_confidence];
    for (const premiseId of claim.provenance.premise_claim_ids) {
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
      fail(`admitted entry ${entry.entry_id} is a historical user statement and must not carry influence_tier "DECISION_OPTION"`);
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

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const userSchema = await json("schemas/m0/user-idea.schema.json");
const intentSchema = await json("schemas/m0/intent-spec.schema.json");
const memoryContextSchema = await json("schemas/m0/memory-context.schema.json");
const validateSchema = ajv.compile({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object"
});
assert.equal(validateSchema(userSchema), true, "UserIdea schema must itself be valid JSON Schema");
assert.equal(validateSchema(intentSchema), true, "IntentSpec schema must itself be valid JSON Schema");
assert.equal(validateSchema(memoryContextSchema), true, "MemoryContext schema must itself be valid JSON Schema");
const validators = {
  "user-idea": { schema: ajv.compile(userSchema), semantic: validateUserIdea },
  "intent-spec": { schema: ajv.compile(intentSchema), semantic: validateIntentSpec },
  "memory-context": { schema: ajv.compile(memoryContextSchema), semantic: validateMemoryContext }
};

async function fixtureFiles(directory) {
  const base = path.join(root, "tests/contracts/fixtures", directory);
  return (await readdir(base)).filter((name) => name.endsWith(".json")).sort().map((name) => path.join(base, name));
}

let checked = 0;
for (const expectation of ["valid", "invalid"]) {
  for (const file of await fixtureFiles(expectation)) {
    const fixture = JSON.parse(await readFile(file, "utf8"));
    const validator = validators[fixture.contract];
    assert.ok(validator, `${file}: unknown contract selector`);
    let valid = validator.schema(fixture.document);
    let diagnostic = valid ? "" : JSON.stringify(validator.schema.errors);
    if (valid) {
      try { validator.semantic(fixture.document); }
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
