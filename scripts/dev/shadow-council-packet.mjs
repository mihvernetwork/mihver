import { createHash } from "node:crypto";
import { canonicalizeJson } from "./canonical-json.mjs";

const DOMAIN = "MIHVER:ShadowCouncil:ShadowDecisionPacket:v1\0";
const HASH = /^sha256:[0-9a-f]{64}$/; const HEAD = /^[0-9a-f]{40}$/;
const BASE = ["councilEpochId","seatId","riskClass","taskId","decisionRequestId","contextHash","repositoryHead","decisionQuestion","evidence"];
const plain = v => v !== null && typeof v === "object" && !Array.isArray(v) && [Object.prototype,null].includes(Object.getPrototypeOf(v));
const exact = (v, keys) => plain(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v,k));
const nonempty = v => typeof v === "string" && v.length > 0;
function fail(code) { throw new Error(code); }
function validateBase(input, keys) {
  if (!exact(input, keys)) fail("INVALID_PACKET_INPUT");
  for (const k of ["councilEpochId","seatId","taskId","decisionRequestId"]) if (!nonempty(input[k]) || input[k].length > 200) fail("INVALID_PACKET_INPUT");
  if (!new Set(["R0","R1","R2","R3","R4"]).has(input.riskClass) || !HASH.test(input.contextHash) || !HEAD.test(input.repositoryHead)) fail("INVALID_PACKET_INPUT");
  if (!nonempty(input.decisionQuestion) || input.decisionQuestion.length > 2000) fail("INVALID_PACKET_INPUT");
  if (!Array.isArray(input.evidence) || input.evidence.length > 20 || input.evidence.some(x => typeof x !== "string" || x.length < 1 || x.length > 1000)) fail("INVALID_PACKET_INPUT");
}
export function computePacketHash(value) { return `sha256:${createHash("sha256").update(DOMAIN).update(canonicalizeJson(value)).digest("hex")}`; }
function finish(value) { return { packetHash: computePacketHash(value), ...value }; }
export function buildProposalPacket(input) { validateBase(input, BASE); return finish({...input,seatRole:"PROPOSER",outputContract:{artifact:"AgentProposal",requiredFields:["summary","payload"],jsonOnly:true}}); }
export function validCandidateDecision(v) {
  const keys=["decisionRequestId","taskId","riskClass","contextHash","repositoryHead","councilEpochId","proposerSeatId","candidateOrdinal","proposalContent","candidateHash"];
  return exact(v,keys) && ["decisionRequestId","taskId","councilEpochId","proposerSeatId"].every(k=>nonempty(v[k])) && new Set(["R0","R1","R2","R3","R4"]).has(v.riskClass) && HASH.test(v.contextHash) && HASH.test(v.candidateHash) && HEAD.test(v.repositoryHead) && Number.isInteger(v.candidateOrdinal) && v.candidateOrdinal>=0 && exact(v.proposalContent,["summary","payload"]) && nonempty(v.proposalContent.summary) && plain(v.proposalContent.payload);
}
export function buildVotePacket(input) { validateBase(input,[...BASE,"candidateHash","candidateDecision"]); if(!validCandidateDecision(input.candidateDecision)) fail("INVALID_CANDIDATE_DECISION_SHAPE"); if(input.candidateHash!==input.candidateDecision.candidateHash) fail("CANDIDATE_HASH_MISMATCH"); return finish({...input,seatRole:"REVIEWER",outputContract:{artifact:"ShadowVoteAssessment",requiredFields:["voteValue","rationale"],jsonOnly:true}}); }
export function renderPacketPrompt(packet) {
  const evidence=packet.evidence.map((x,i)=>`${i+1}. ${x}`).join("\n");
  if(packet.seatRole==="REVIEWER") return `You are an advisory reviewer. Do NOT answer the substantive question. Evaluate only the frozen candidate.\nQuestion: ${packet.decisionQuestion}\nEvidence:\n${evidence}\nCandidate: ${canonicalizeJson(packet.candidateDecision)}\nEmit ONLY a JSON object with exactly the fields voteValue (APPROVE, REJECT, or ABSTAIN) and rationale (a non-empty string of at most 1200 characters naming the decisive grounds for the vote). Give concise decision grounds/justification; do not provide chain-of-thought or hidden reasoning. No markdown or other fields.`;
  return `You are an advisory proposer.\nQuestion: ${packet.decisionQuestion}\nEvidence:\n${evidence}\nEmit ONLY a JSON object with exactly the fields summary (a non-empty string) and payload (an object). No markdown, chain-of-thought, explanation, or other fields.`;
}
