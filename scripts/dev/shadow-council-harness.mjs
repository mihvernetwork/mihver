import { applyEvent,computeCommitmentHash,getDecisionRecord } from "./decision-council-kernel.mjs";
import { buildProposalPacket,buildVotePacket,renderPacketPrompt } from "./shadow-council-packet.mjs";
import { buildAttestation,checkAdmission,computeInvocationConfigHash,computeOutputHash,attestSeatOriginRegistry,assertStableExecutableAcrossRun } from "./shadow-council-attestation.mjs";
import { buildShadowVoteAssessment,deriveAgentVote } from "./shadow-council-vote-assessment.mjs";
import { buildShadowSeatInvocationFailure } from "./shadow-council-invocation-failure.mjs";
import { SEAT_ADAPTERS,buildInvocationArgv,spawnSeat,parseSeatOutput } from "./shadow-council-cli-transport.mjs";
attestSeatOriginRegistry(Object.entries(SEAT_ADAPTERS).map(([seatId,a])=>({seatId,provider:a.provider,cliExecutableRealpath:a.cli})));
const plain=v=>v&&typeof v==="object"&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const exact=(v,k)=>plain(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const responseShapeDetails=(value,required)=>{const keys=plain(value)?Object.keys(value):[],present=new Set(keys);return{missingFields:required.filter(x=>!present.has(x)),extraFields:keys.filter(x=>!required.includes(x)),...(present.has("voteValue")&&!new Set(["APPROVE","REJECT","ABSTAIN"]).has(value.voteValue)?{invalidVoteValue:value.voteValue}:{})}};
const code=e=>typeof e?.message==="string"&&e.message.length?e.message:String(e);
const base=(s,o,seatId)=>({councilEpochId:s.decisionRequest.councilEpochId,seatId,riskClass:s.decisionRequest.riskClass,taskId:s.decisionRequest.taskId,decisionRequestId:s.decisionRequest.decisionRequestId,contextHash:s.decisionRequest.contextHash,repositoryHead:s.decisionRequest.repositoryHead,decisionQuestion:o.decisionQuestion,evidence:o.evidence??[]});
function capture(opts,c,stage,error,details={},assessmentFailure=null){
  const built=buildShadowSeatInvocationFailure({decisionRequestId:c.decisionRequestId,councilEpochId:c.councilEpochId,seatId:c.seatId,provider:c.provider,requestedModelId:c.requestedModelId,invocationRole:c.invocationRole,candidateHash:c.candidateHash,stage,errorCode:code(error),details,packetHash:c.packetHash??null,invocationConfigHash:c.invocationConfigHash??null,stdoutHash:c.stdoutHash??null,stderrHash:c.stderrHash??null,stdoutByteLength:c.stdoutByteLength??null,stderrByteLength:c.stderrByteLength??null,outputHash:c.outputHash??null,attestationHash:c.attestationHash??null,assessmentFailure});
  if(!built.ok)throw new Error("INVOCATION_FAILURE_ARTIFACT_CONSTRUCTION_FAILED");
  opts.hooks?.onInvocationFailure?.(built.failure);
}
function invoke(packet,opts,invocationRole){
  const id=packet.seatId,a=SEAT_ADAPTERS[id];
  if(!a)throw new Error("UNKNOWN_SEAT");
  const c={decisionRequestId:packet.decisionRequestId,councilEpochId:packet.councilEpochId,seatId:id,provider:a.provider,requestedModelId:a.model,invocationRole,candidateHash:invocationRole==="VOTER"?packet.candidateHash:null,packetHash:packet.packetHash};
  const prompt=renderPacketPrompt(packet),build=opts.buildInvocationArgvImpl??buildInvocationArgv;let argv,env;
  try{argv=build(id,prompt);env={PATH:process.env.PATH,HOME:process.env.HOME,USER:process.env.USER};}catch(e){capture(opts,c,"INVOCATION_CONFIG",e);throw e;}
  try{c.invocationConfigHash=computeInvocationConfigHash(argv,env);}catch(e){capture(opts,c,"ATTESTATION_BUILD",e);throw e;}
  let run;try{run=(opts.spawnSeatImpl??spawnSeat)(id,prompt);}catch(e){capture(opts,c,"SPAWN",e);throw e;}
  try{c.stdoutByteLength=Buffer.byteLength(run.stdout);c.stderrByteLength=Buffer.byteLength(run.stderr);c.stdoutHash=computeOutputHash(run.stdout);c.stderrHash=computeOutputHash(run.stderr);}catch(e){capture(opts,c,"ATTESTATION_BUILD",e);throw e;}
  let parsed;try{parsed=(opts.parseSeatOutputImpl??parseSeatOutput)(id,run.stdout);}catch(e){capture(opts,c,"PROVIDER_ENVELOPE_PARSE",e);throw e;}
  let att;try{c.outputHash=computeOutputHash(run.stdout);att=(opts.buildAttestationImpl??buildAttestation)({seatId:id,councilEpochId:packet.councilEpochId,provider:a.provider,requestedModelId:a.model,cliExecutableRealpath:run.cliExecutableRealpath,cliVersion:run.cliVersion,childProcessId:run.childProcessId,invocationConfigHash:c.invocationConfigHash,packetHash:packet.packetHash,outputHash:c.outputHash,exitCode:run.exitCode,...parsed});c.attestationHash=att.attestationHash;}catch(e){capture(opts,c,"ATTESTATION_BUILD",e);throw e;}
  try{checkAdmission(att,{seatId:id,provider:a.provider,requestedModelId:a.model,packetHash:packet.packetHash,outputHash:c.outputHash});}catch(e){try{opts.hooks?.onAttestationRejected?.(att,{seatId:id,reason:code(e)});}catch(hookError){Object.defineProperty(e,"rejectedAttestationHookError",{value:hookError,configurable:true});}capture(opts,c,"ADMISSION",e);throw e;}
  opts.hooks?.onAttestationAdmitted?.(att,{seatId:id,packetHash:packet.packetHash,outputHash:c.outputHash});
  let value;try{value=JSON.parse(parsed.text);}catch{const e=new Error("MALFORMED_SEAT_OUTPUT");capture(opts,c,"SHADOW_RESPONSE_JSON_PARSE",e);throw e;}
  return{value,attestation:att,outputHash:c.outputHash,context:c};
}
function kernel(session,event,opts,c){const r=(opts.applyEventImpl??applyEvent)(session,event);if(r.error){const e=new Error(r.error.code);capture(opts,c,"KERNEL_EVENT",e,{eventType:event.type});throw e;}return r.session;}
export function runProposerFlow(session,opts){
  const seatId=session.expectedProposerSeatId,packet=buildProposalPacket(base(session,opts,seatId));opts.hooks?.onPacketBuilt?.(packet,{seatId,invocationRole:"PROPOSER"});
  const {value,attestation,context}=invoke(packet,opts,"PROPOSER");if(!exact(value,["summary","payload"])||typeof value.summary!=="string"||!value.summary||!plain(value.payload)){const e=new Error("MALFORMED_SEAT_OUTPUT");capture(opts,context,"SHADOW_RESPONSE_SHAPE",e,responseShapeDetails(value,["summary","payload"]));throw e;}
  const common={decisionRequestId:session.decisionRequest.decisionRequestId,seatId,councilEpochId:session.decisionRequest.councilEpochId};let s=kernel(session,{type:"SUBMIT_COMMITMENT",commitment:{...common,commitmentHash:computeCommitmentHash(value)}},opts,context);s=kernel(s,{type:"REVEAL_PROPOSAL",proposal:{...common,proposalContent:value}},opts,context);s=kernel(s,{type:"FREEZE_CANDIDATE"},opts,context);return{session:s,packet,attestation,proposalContent:value,invocationContext:context};
}
export function runVotingFlow(session,opts){
  const seatIds=opts.seatIds;if(session.decisionRequest.riskClass==="R2"&&seatIds.includes(session.expectedProposerSeatId))throw new Error("PROPOSER_CANNOT_VOTE");const packets=[],votes=[],attestations=[],assessments=[],invocationContexts=[];let s=session;
  for(const seatId of seatIds){const packet=buildVotePacket({...base(session,opts,seatId),candidateHash:session.candidateDecision.candidateHash,candidateDecision:session.candidateDecision});opts.hooks?.onPacketBuilt?.(packet,{seatId,invocationRole:"VOTER"});const {value,attestation,outputHash,context}=invoke(packet,opts,"VOTER");
    if(!exact(value,["voteValue","rationale"])||!new Set(["APPROVE","REJECT","ABSTAIN"]).has(value.voteValue)){const e=new Error("MALFORMED_SEAT_OUTPUT");capture(opts,context,"SHADOW_RESPONSE_SHAPE",e,responseShapeDetails(value,["voteValue","rationale"]));throw e;}
    const built=buildShadowVoteAssessment({decisionRequestId:session.decisionRequest.decisionRequestId,candidateHash:session.candidateDecision.candidateHash,seatId,councilEpochId:session.decisionRequest.councilEpochId,packetHash:packet.packetHash,outputHash,attestationHash:attestation.attestationHash,voteValue:value.voteValue,rationale:value.rationale});
    if(!built.ok){const e=new Error("MALFORMED_SEAT_OUTPUT");capture(opts,context,"ASSESSMENT_VALIDATION",built.errorCode,built.details,{errorCode:built.errorCode,details:built.details});throw e;}
    const assessment=built.assessment;opts.hooks?.onAssessmentBuilt?.(assessment,{seatId});let vote;try{vote=(opts.deriveAgentVoteImpl??deriveAgentVote)(assessment);}catch(e){capture(opts,context,"VOTE_DERIVATION",e);throw e;}packets.push(packet);attestations.push(attestation);invocationContexts.push(context);assessments.push(assessment);votes.push(vote);s=kernel(s,{type:"CAST_VOTE",vote},opts,context);
  }
  const c=invocationContexts.at(-1)??{decisionRequestId:session.decisionRequest.decisionRequestId,councilEpochId:session.decisionRequest.councilEpochId,seatId:seatIds.at(-1)??session.expectedProposerSeatId,provider:SEAT_ADAPTERS[seatIds.at(-1)??session.expectedProposerSeatId]?.provider,requestedModelId:SEAT_ADAPTERS[seatIds.at(-1)??session.expectedProposerSeatId]?.model,invocationRole:"VOTER",candidateHash:session.candidateDecision.candidateHash};s=kernel(s,{type:"FINALIZE"},opts,c);return{session:s,votes,packets,attestations,assessments,invocationContexts};
}
export function runShadowExercise(session,opts){
  const p=runProposerFlow(session,opts),v=runVotingFlow(p.session,opts),attestations=[p.attestation,...v.attestations];
  try{(opts.assertStableExecutableAcrossRunImpl??assertStableExecutableAcrossRun)(attestations);}catch(e){let index=1,seen=new Map();for(let i=0;i<attestations.length;i++){const a=attestations[i];if(seen.has(a.seatId)&&seen.get(a.seatId)!==a.cliExecutableRealpath){index=i;break;}seen.set(a.seatId,a.cliExecutableRealpath);}const contexts=[p.invocationContext,...v.invocationContexts],c=contexts[index]??contexts.at(-1);capture(opts,c,"RUN_POSTCONDITION",e);throw e;}
  return{session:v.session,decisionRecord:getDecisionRecord(v.session),packets:[p.packet,...v.packets],attestations,proposalContent:p.proposalContent,votes:v.votes,assessments:v.assessments};
}
