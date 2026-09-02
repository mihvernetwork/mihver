// Forensic pre-freeze evidence only: this artifact carries zero vote, quorum, DecisionRecord, or authorization authority.
import { createHash } from "node:crypto";
import { canonicalizeJson } from "./canonical-json.mjs";
export const UNFROZEN_PROPOSAL_DOMAIN="MIHVER:ShadowCouncil:UnfrozenProposal:v1\0";
const HASH=/^sha256:[0-9a-f]{64}$/,plain=v=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v)),str=v=>typeof v==="string"&&v.length>0&&v.length<=200;
export function buildShadowUnfrozenProposal(input){
  const keys=["decisionRequestId","councilEpochId","seatId","packetHash","attestationHash","requirementSpecHash","proposalContent"];
  if(!plain(input)||Object.keys(input).length!==keys.length||!keys.every(k=>Object.hasOwn(input,k))||![input.decisionRequestId,input.councilEpochId,input.seatId].every(str)||!HASH.test(input.packetHash)||!HASH.test(input.attestationHash)||!(input.requirementSpecHash===null||HASH.test(input.requirementSpecHash))||!plain(input.proposalContent)||Object.keys(input.proposalContent).length!==2||!Object.hasOwn(input.proposalContent,"summary")||!Object.hasOwn(input.proposalContent,"payload")||typeof input.proposalContent.summary!=="string"||input.proposalContent.summary.length===0||!plain(input.proposalContent.payload))throw new Error("INVALID_UNFROZEN_PROPOSAL");
  try{canonicalizeJson(input.proposalContent)}catch{throw new Error("INVALID_UNFROZEN_PROPOSAL")}
  const body={kind:"ShadowUnfrozenProposal",schemaVersion:"1.0.0",...structuredClone(input)};const unfrozenProposalHash=`sha256:${createHash("sha256").update(Buffer.from(UNFROZEN_PROPOSAL_DOMAIN,"utf8")).update(Buffer.from(canonicalizeJson(body),"utf8")).digest("hex")}`;return{...body,unfrozenProposalHash};
}
