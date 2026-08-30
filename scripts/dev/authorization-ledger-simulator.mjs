/**
 * Deterministic, in-process NON-PRODUCTION authorization-ledger simulator.
 *
 * This module models ADR-0006 re-verification, fencing, and consume-once behavior for tests. It is
 * not the privileged production Ledger/Grant store, has no executor, performs no I/O, and an
 * ALLOW_ONCE result means only that the simulated gate permits one downstream handoff.
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

import Ajv2020 from "ajv/dist/2020.js";

import { canonicalizeJson } from "./canonical-json.mjs";
import { computeTaskRecordHash, valueWithoutHash } from "./canonical-record-hash.mjs";
import { verifyCouncilQuorumProof } from "./council-quorum-proof.mjs";
import { computeDecisionRecordHash } from "./decision-council-kernel.mjs";

export const SIMULATOR_PROTOCOL_VERSION = "1.0.0";
export const POLICY_VERSION = "authorization-policy/v1";

const AUTHORIZATION_ID_DOMAIN = "MIHVER:AuthorizationEnvelope:AuthorizationId:v1\0";
const ENVELOPE_HASH_DOMAIN = "MIHVER:AuthorizationEnvelope:v1\0";
const HASH64 = /^sha256:[0-9a-f]{64}$/;
const HEX40 = /^[0-9a-f]{40}$/;
const PROHIBITED_EFFECTS = Object.freeze([
  "GIT_PUSH", "GIT_FORCE_PUSH", "PR_CREATE", "PR_MERGE", "MAIN_BRANCH_MUTATION",
  "PUBLICATION_BROKER_INVOCATION", "CREDENTIAL_ACCESS", "TOOL_EXECUTION",
  "COUNCIL_SCOPE_SELF_EXPANSION", "EXECUTION_GATEWAY_BYPASS",
]);
const RISK_DISPOSITIONS = Object.freeze({
  R0: "COUNCIL_NOT_REQUIRED", R1: "COUNCIL_APPROVED", R2: "COUNCIL_APPROVED",
  R3: "HUMAN_APPROVAL_REQUIRED", R4: "DENIED",
});

const require = createRequire(import.meta.url);
const ajv = new Ajv2020({ allErrors: true, strict: true });
const decisionCouncilSchema = require("../../schemas/dev/decision-council.schema.json");
const taskRecordSchema = require("../../schemas/dev/task-record.schema.json");
ajv.addSchema(decisionCouncilSchema);
const validateDecisionRecordShape = ajv.compile({
  $ref: `${decisionCouncilSchema.$id}#/$defs/DecisionRecord`,
});
const validateTaskRecordShape = ajv.compile(taskRecordSchema);

const ownObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const nonempty = (value) => typeof value === "string" && value.length > 0;
const validStopEpoch = (value) => Number.isSafeInteger(value) && value >= 0;
const validContext = (value) => ownObject(value) && HASH64.test(value.contextHash)
  && HEX40.test(value.repositoryHead);

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const item of Object.values(value)) deepFreeze(item, seen);
  return Object.freeze(value);
}

function immutableCopy(value) {
  return deepFreeze(structuredClone(value));
}

function digest(domain, value) {
  return `sha256:${createHash("sha256").update(domain, "utf8").update(value, "utf8").digest("hex")}`;
}

export function deriveCanonicalAuthorizationId(decisionRequestId, recordHash) {
  return digest(AUTHORIZATION_ID_DOMAIN, `${decisionRequestId}\0${recordHash}`);
}

export function computeCanonicalEnvelopeHash(envelopeWithoutHash) {
  return digest(ENVELOPE_HASH_DOMAIN, canonicalizeJson(envelopeWithoutHash));
}

function result(outcome, reason, canonicalAuthorizationId = null) {
  return Object.freeze({
    protocolVersion: SIMULATOR_PROTOCOL_VERSION,
    outcome,
    reason,
    canonicalAuthorizationId,
    ledgerDisposition: outcome === "ALLOW_ONCE" ? "POLICY_SATISFIED" : null,
  });
}

function deny(reason, canonicalAuthorizationId = null) {
  return result("DENY", reason, canonicalAuthorizationId);
}

function structurallyBoundedEnvelope(value) {
  if (!ownObject(value) || !ownObject(value.decisionRecordRef)) return false;
  const id = value.decisionRecordRef.decisionRequestId;
  return nonempty(id) && id.length <= 4096 && Object.keys(value).length <= 64
    && Object.keys(value.decisionRecordRef).length <= 16;
}

function validDecisionRecord(record) {
  if (!validateDecisionRecordShape(record)) return false;
  const immediate = record.riskClass === "R0" || record.riskClass === "R4";
  const expectedTerminal = record.riskClass === "R0"
    ? ["COUNCIL_NOT_REQUIRED", "COUNCIL_NOT_REQUIRED"]
    : record.riskClass === "R4"
      ? ["DENIED", "DENIED"]
      : record.disposition === "NO_QUORUM"
        ? ["NO_QUORUM", "NO_QUORUM"]
        : ["DECIDED", RISK_DISPOSITIONS[record.riskClass]];
  if (record.state !== expectedTerminal[0] || record.disposition !== expectedTerminal[1]) return false;
  if (immediate) {
    if (record.candidateHash !== null || record.proposerSeatId !== null || record.votes.length !== 0) return false;
  } else {
    if (!HASH64.test(record.candidateHash) || !nonempty(record.proposerSeatId)
        || record.votes.length !== 3
        || new Set(record.votes.map((vote) => vote.seatId)).size !== 3
        || record.votes.some((vote) => (vote.voteValue === "MISSING"
          ? vote.candidateHash !== null
          : vote.candidateHash !== record.candidateHash))) return false;
    // Keep record shape and binding checks here as defense-in-depth. Quorum semantics are not
    // approximated on the privileged side: the independently verified proof is authoritative.
  }
  try {
    return computeDecisionRecordHash(valueWithoutHash(record, "recordHash")) === record.recordHash;
  } catch { return false; }
}

function validTaskRecord(record) {
  if (!validateTaskRecordShape(record)) return false;
  try {
    return computeTaskRecordHash(valueWithoutHash(record, "taskRecordHash")) === record.taskRecordHash;
  } catch { return false; }
}

function canonicalScope(taskRecord) {
  const forbidden = new Set(Array.isArray(taskRecord.forbiddenScope) ? taskRecord.forbiddenScope : []);
  const seen = new Set();
  const scope = [];
  for (const token of taskRecord.allowedScope ?? []) {
    if (!forbidden.has(token) && !seen.has(token)) {
      seen.add(token);
      scope.push(token);
    }
  }
  return scope;
}

function rederiveEnvelope(decisionRecord, taskRecord, currentContext, currentStopEpoch, policyVersion) {
  if (policyVersion !== POLICY_VERSION) return { blocked: "UNSUPPORTED_POLICY_VERSION" };
  if (!validContext(currentContext)) return { blocked: "INVALID_CURRENT_CONTEXT" };
  if (!validStopEpoch(currentStopEpoch)) return { blocked: "INVALID_STOP_EPOCH" };
  if (decisionRecord.disposition === "DENIED" || decisionRecord.riskClass === "R4") {
    return { blocked: "R4_HARD_DENY" };
  }
  if (decisionRecord.disposition === "NO_QUORUM") return { blocked: "COUNCIL_GATE_NOT_MET" };
  if (RISK_DISPOSITIONS[decisionRecord.riskClass] !== decisionRecord.disposition) {
    return { blocked: "RISK_DISPOSITION_MISMATCH" };
  }
  if (taskRecord.disposition === "BLOCKED") return { blocked: "TASK_RECORD_BLOCKED" };
  if (decisionRecord.contextHash !== currentContext.contextHash
      || decisionRecord.repositoryHead !== currentContext.repositoryHead) {
    return { blocked: "CONTEXT_ALREADY_STALE" };
  }
  const humanRequired = decisionRecord.disposition === "HUMAN_APPROVAL_REQUIRED";
  const body = {
    protocolVersion: "1.0.0",
    authorizationId: deriveCanonicalAuthorizationId(
      decisionRecord.decisionRequestId, decisionRecord.recordHash,
    ),
    decisionRecordRef: {
      decisionRequestId: decisionRecord.decisionRequestId,
      recordHash: decisionRecord.recordHash,
    },
    candidateHash: decisionRecord.candidateHash,
    taskId: decisionRecord.taskId,
    riskClass: decisionRecord.riskClass,
    contextHash: decisionRecord.contextHash,
    repositoryHead: decisionRecord.repositoryHead,
    councilEpochId: decisionRecord.councilEpochId,
    stopEpoch: currentStopEpoch,
    policyVersion,
    actionType: "UNDEFINED_PENDING_EXECUTION_GATEWAY",
    allowedScope: canonicalScope(taskRecord),
    prohibitedEffects: [...PROHIBITED_EFFECTS],
    humanApproval: { required: humanRequired, grantRef: null },
    singleUse: true,
    disposition: humanRequired ? "PENDING_HUMAN_APPROVAL" : "POLICY_SATISFIED",
  };
  return { envelope: { ...body, envelopeHash: computeCanonicalEnvelopeHash(body) } };
}

class PromiseMutex {
  #tail = Promise.resolve();

  async runExclusive(fn) {
    let release;
    const predecessor = this.#tail;
    this.#tail = new Promise((resolve) => { release = resolve; });
    await predecessor;
    try { return await fn(); } finally { release(); }
  }
}

class AsyncReaderWriterLock {
  #readers = 0;
  #writer = false;
  #queue = [];

  async read(fn) {
    await this.#acquire("read");
    try { return await fn(); } finally { this.#release("read"); }
  }

  async write(fn) {
    await this.#acquire("write");
    try { return await fn(); } finally { this.#release("write"); }
  }

  #acquire(type) {
    return new Promise((resolve) => {
      this.#queue.push({ type, resolve });
      this.#drain();
    });
  }

  #release(type) {
    if (type === "read") this.#readers -= 1;
    else this.#writer = false;
    this.#drain();
  }

  #drain() {
    if (this.#writer || this.#readers > 0 && this.#queue[0]?.type === "write") return;
    if (this.#queue[0]?.type === "write") {
      this.#writer = true;
      this.#queue.shift().resolve();
      return;
    }
    while (this.#queue[0]?.type === "read" && !this.#writer) {
      this.#readers += 1;
      this.#queue.shift().resolve();
    }
  }
}

function parseInstant(value) {
  if (typeof value !== "string") return NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function validGrant(grant) {
  return ownObject(grant) && nonempty(grant.grantId) && HASH64.test(grant.envelopeHash)
    && nonempty(grant.approverIdentity) && validStopEpoch(grant.boundStopEpoch)
    && ["AUTHORIZED", "CONSUMED", "REVOKED", "EXPIRED"].includes(grant.state)
    && Number.isFinite(parseInstant(grant.expiresAt))
    && Number.isFinite(parseInstant(grant.authorizedAt))
    && Number.isFinite(parseInstant(grant.stateChangedAt));
}

function decisionRecordIdentity(decisionRequestId, recordHash) {
  return `${decisionRequestId}\0${recordHash}`;
}

function proofEntries(councilQuorumProofs) {
  if (councilQuorumProofs instanceof Map) return councilQuorumProofs.entries();
  if (ownObject(councilQuorumProofs)) return Object.entries(councilQuorumProofs);
  if (councilQuorumProofs == null) return [];
  throw new TypeError("invalid simulator councilQuorumProofs");
}

/** Non-production, in-memory simulation of the ADR-0006 privileged boundary. */
export class LedgerSimulation {
  #decisionRecords = new Map();
  #councilQuorumProofs = new Map();
  #taskRecords = [];
  #grantsByHash = new Map();
  #ledger = new Map();
  #locks = new Map();
  #epochLock = new AsyncReaderWriterLock();
  #currentContext;
  #currentStopEpoch;
  #policyVersion;
  #privilegedApproverIdentity;
  #trustedRegistry;
  #testHooks;

  constructor({
    decisionRecords, taskRecords, councilQuorumProofs, trustedRegistry, currentContext,
    currentStopEpoch, policyVersion = POLICY_VERSION,
    privilegedApproverIdentity = "simulated-admin:test-human", testHooks = {},
  }) {
    if (!nonempty(privilegedApproverIdentity)) {
      throw new TypeError("invalid simulator privilegedApproverIdentity");
    }
    for (const source of decisionRecords ?? []) {
      const record = immutableCopy(source);
      if (!validDecisionRecord(record)) throw new TypeError("invalid canonical DecisionRecord");
      const existing = this.#decisionRecords.get(record.decisionRequestId);
      if (existing && existing.recordHash !== record.recordHash) {
        throw new TypeError("ambiguous canonical DecisionRecord identity");
      }
      this.#decisionRecords.set(record.decisionRequestId, record);
    }
    for (const [identity, source] of proofEntries(councilQuorumProofs)) {
      if (!nonempty(identity)) throw new TypeError("invalid canonical CouncilQuorumProof identity");
      this.#councilQuorumProofs.set(identity, immutableCopy(source));
    }
    this.#taskRecords = (taskRecords ?? []).map((source) => {
      const record = immutableCopy(source);
      if (!validTaskRecord(record)) throw new TypeError("invalid canonical TaskRecord");
      return record;
    });
    this.#currentContext = structuredClone(currentContext);
    this.#currentStopEpoch = currentStopEpoch;
    this.#policyVersion = policyVersion;
    this.#privilegedApproverIdentity = privilegedApproverIdentity;
    this.#trustedRegistry = immutableCopy(trustedRegistry ?? {});
    this.#testHooks = testHooks;
  }

  /**
   * Simulates the privileged ADR-0006 grant-creation path. The envelope is an untrusted lookup
   * pointer; its canonical hash and stop epoch are re-derived while locked. Approver identity is
   * captured from constructor-owned privileged configuration, never accepted in grantDetails.
   */
  async issueGrant(submittedEnvelope, { grantId, expiresAt, authorizedAt } = {}) {
    if (!structurallyBoundedEnvelope(submittedEnvelope)) throw new TypeError("invalid envelope shape");
    if (!nonempty(grantId) || !Number.isFinite(parseInstant(expiresAt))
        || !Number.isFinite(parseInstant(authorizedAt))) {
      throw new TypeError("invalid simulator grant details");
    }
    const decisionRecord = this.#decisionRecords.get(
      submittedEnvelope.decisionRecordRef.decisionRequestId,
    );
    if (!decisionRecord || !validDecisionRecord(decisionRecord)) {
      throw new Error("canonical decision record unavailable or invalid");
    }
    const canonicalAuthorizationId = deriveCanonicalAuthorizationId(
      decisionRecord.decisionRequestId, decisionRecord.recordHash,
    );
    const lock = this.#lockFor(canonicalAuthorizationId);
    return lock.runExclusive(() => this.#epochLock.read(async () => {
      const matches = this.#taskRecords.filter((record) => record.taskId === decisionRecord.taskId);
      if (matches.length !== 1 || !validTaskRecord(matches[0])) {
        throw new Error("canonical task record unavailable, ambiguous, or invalid");
      }
      const recomputed = rederiveEnvelope(
        decisionRecord, matches[0], structuredClone(this.#currentContext),
        this.#currentStopEpoch, this.#policyVersion,
      );
      if (recomputed.blocked || recomputed.envelope.envelopeHash !== submittedEnvelope.envelopeHash) {
        throw new Error(`grant subject re-verification failed: ${recomputed.blocked ?? "ENVELOPE_RECOMPUTATION_MISMATCH"}`);
      }
      if (recomputed.envelope.stopEpoch !== this.#currentStopEpoch) {
        throw new Error("grant subject stopEpoch is not current");
      }
      if (this.#grantsByHash.has(recomputed.envelope.envelopeHash)) {
        throw new Error("simulator already has a grant for this envelopeHash");
      }
      if (["R1", "R2", "R3"].includes(decisionRecord.riskClass)) {
        const proofResult = this.#verifyCanonicalCouncilProof(decisionRecord);
        if (!proofResult.authorizationEvidenceEligible) {
          throw new Error(`grant subject re-verification failed: COUNCIL_PROOF_INELIGIBLE:${proofResult.errorCode ?? "MISSING"}`);
        }
      }
      const grant = {
        grantId,
        envelopeHash: recomputed.envelope.envelopeHash,
        approverIdentity: this.#privilegedApproverIdentity,
        boundStopEpoch: this.#currentStopEpoch,
        state: "AUTHORIZED",
        expiresAt,
        authorizedAt,
        stateChangedAt: authorizedAt,
      };
      if (!validGrant(grant)) throw new TypeError("invalid simulator AuthorizationGrant");
      this.#grantsByHash.set(grant.envelopeHash, grant);
      return immutableCopy(grant);
    }));
  }

  /** Simulator-only privileged revocation, serialized with grant creation and consumption. */
  async revokeGrant(submittedEnvelope, { stateChangedAt } = {}) {
    if (!structurallyBoundedEnvelope(submittedEnvelope)
        || !Number.isFinite(parseInstant(stateChangedAt))) {
      throw new TypeError("invalid simulator grant revocation");
    }
    const decisionRecord = this.#decisionRecords.get(
      submittedEnvelope.decisionRecordRef.decisionRequestId,
    );
    if (!decisionRecord || !validDecisionRecord(decisionRecord)) {
      throw new Error("canonical decision record unavailable or invalid");
    }
    const canonicalAuthorizationId = deriveCanonicalAuthorizationId(
      decisionRecord.decisionRequestId, decisionRecord.recordHash,
    );
    return this.#lockFor(canonicalAuthorizationId).runExclusive(() => this.#epochLock.read(async () => {
      const grant = this.#grantsByHash.get(submittedEnvelope.envelopeHash);
      if (!grant) throw new Error("simulator grant not found");
      if (grant.state !== "AUTHORIZED") throw new Error("simulator grant is not revocable");
      grant.state = "REVOKED";
      grant.stateChangedAt = stateChangedAt;
    }));
  }

  setCurrentContext(currentContext) {
    if (!validContext(currentContext)) throw new TypeError("invalid simulator currentContext");
    this.#currentContext = structuredClone(currentContext);
  }

  async bumpStopEpoch(currentStopEpoch) {
    if (!validStopEpoch(currentStopEpoch) || currentStopEpoch <= this.#currentStopEpoch) {
      throw new TypeError("simulator stopEpoch bump must strictly increase");
    }
    return this.#epochLock.write(async () => { this.#currentStopEpoch = currentStopEpoch; });
  }

  ledgerState(authorizationId) {
    return this.#ledger.get(authorizationId) ?? null;
  }

  grantState(envelopeHash) {
    return this.#grantsByHash.get(envelopeHash)?.state ?? null;
  }

  #lockFor(canonicalAuthorizationId) {
    let lock = this.#locks.get(canonicalAuthorizationId);
    if (!lock) {
      lock = new PromiseMutex();
      this.#locks.set(canonicalAuthorizationId, lock);
    }
    return lock;
  }

  #verifyCanonicalCouncilProof(decisionRecord) {
    const proof = this.#councilQuorumProofs.get(decisionRecordIdentity(
      decisionRecord.decisionRequestId, decisionRecord.recordHash,
    ));
    if (!proof) return { authorizationEvidenceEligible: false, errorCode: "PROOF_MISSING" };
    return verifyCouncilQuorumProof({
      proof,
      decisionRecord,
      trustedRegistry: this.#trustedRegistry,
    });
  }

  /**
   * @param {object} submittedEnvelope Untrusted candidate; only its decisionRequestId lookup pointer
   * and bound freshness/hash claims are consulted as ADR-0006 specifies.
   * @param {{now:string}} options Explicit trusted simulator observation used only for grant expiry.
   */
  async checkAndConsume(submittedEnvelope, { now } = {}) {
    if (!structurallyBoundedEnvelope(submittedEnvelope)) return deny("INVALID_ENVELOPE_SHAPE");

    // Normative lock order 1-3: resolve immutable canonical identity, derive its ID, then choose lock.
    const decisionRecord = this.#decisionRecords.get(
      submittedEnvelope.decisionRecordRef.decisionRequestId,
    );
    if (!decisionRecord) return deny("DECISION_RECORD_NOT_FOUND");
    if (!validDecisionRecord(decisionRecord)) return deny("RECORD_HASH_MISMATCH");
    const canonicalAuthorizationId = deriveCanonicalAuthorizationId(
      decisionRecord.decisionRequestId, decisionRecord.recordHash,
    );
    const lock = this.#lockFor(canonicalAuthorizationId);

    // Normative lock order 4-6: acquire, re-read/re-derive mutable facts, atomically decide/consume.
    return lock.runExclusive(() => this.#epochLock.read(async () => {
      const currentStopEpoch = this.#currentStopEpoch;
      const currentContext = structuredClone(this.#currentContext);
      const matches = this.#taskRecords.filter((record) => record.taskId === decisionRecord.taskId);
      if (matches.length !== 1) return deny("TASK_RECORD_LOOKUP_AMBIGUOUS", canonicalAuthorizationId);
      const taskRecord = matches[0];
      if (!validTaskRecord(taskRecord)) return deny("TASK_RECORD_HASH_MISMATCH", canonicalAuthorizationId);

      if (decisionRecord.contextHash !== currentContext.contextHash
          || decisionRecord.repositoryHead !== currentContext.repositoryHead) {
        return deny("EXPIRED_BY_DRIFT", canonicalAuthorizationId);
      }

      const recomputed = rederiveEnvelope(
        decisionRecord, taskRecord, currentContext, currentStopEpoch, this.#policyVersion,
      );
      if (recomputed.blocked) return deny(recomputed.blocked, canonicalAuthorizationId);
      const envelope = recomputed.envelope;

      await this.#testHooks.afterLockedRederivation?.({ canonicalAuthorizationId });

      if (envelope.stopEpoch !== submittedEnvelope.stopEpoch) {
        return deny("REVOKED_BY_STOP_EPOCH", canonicalAuthorizationId);
      }
      if (envelope.contextHash !== submittedEnvelope.contextHash
          || envelope.repositoryHead !== submittedEnvelope.repositoryHead) {
        return deny("EXPIRED_BY_DRIFT", canonicalAuthorizationId);
      }
      if (envelope.envelopeHash !== submittedEnvelope.envelopeHash) {
        return deny("ENVELOPE_RECOMPUTATION_MISMATCH", canonicalAuthorizationId);
      }
      if (this.#ledger.get(canonicalAuthorizationId) === "CONSUMED") {
        return deny("REPLAY_REJECTED", canonicalAuthorizationId);
      }

      let grantToConsume = null;
      if (envelope.disposition === "PENDING_HUMAN_APPROVAL") {
        const grant = this.#grantsByHash.get(envelope.envelopeHash);
        if (!grant || grant.state !== "AUTHORIZED") {
          return deny("NO_VALID_GRANT", canonicalAuthorizationId);
        }
        if (grant.boundStopEpoch !== currentStopEpoch) {
          return deny("GRANT_REVOKED_BY_STOP_EPOCH", canonicalAuthorizationId);
        }
        const nowInstant = parseInstant(now);
        if (!Number.isFinite(nowInstant)) {
          return deny("INVALID_NOW", canonicalAuthorizationId);
        }
        if (nowInstant >= parseInstant(grant.expiresAt)) {
          return deny("GRANT_EXPIRED", canonicalAuthorizationId);
        }
        grantToConsume = grant;
      } else if (envelope.disposition !== "POLICY_SATISFIED") {
        return deny("INVALID_STATE", canonicalAuthorizationId);
      }

      if (["R1", "R2", "R3"].includes(decisionRecord.riskClass)
          && !this.#verifyCanonicalCouncilProof(decisionRecord).authorizationEvidenceEligible) {
        return deny("COUNCIL_GATE_NOT_MET", canonicalAuthorizationId);
      }

      if (grantToConsume !== null) grantToConsume.state = "CONSUMED";
      this.#ledger.set(canonicalAuthorizationId, "CONSUMED");
      return result("ALLOW_ONCE", "POLICY_SATISFIED", canonicalAuthorizationId);
    }));
  }
}
