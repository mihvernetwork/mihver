import assert from "node:assert/strict";
import { createSession,applyEvent } from "../../scripts/dev/decision-council-kernel.mjs";
import { runProposerFlow,runVotingFlow,runShadowExercise } from "../../scripts/dev/shadow-council-harness.mjs";
import { verifyAssessmentHash } from "../../scripts/dev/shadow-council-vote-assessment.mjs";
import { verifyInvocationFailureHash } from "../../scripts/dev/shadow-council-invocation-failure.mjs";
import { computePacketHash } from "../../scripts/dev/shadow-council-packet.mjs";
import { buildAttestation,computeOutputHash } from "../../scripts/dev/shadow-council-attestation.mjs";
let p=0,f=0;const test=async(n,fn)=>{try{await fn();p++;console.log(`PASS: ${n}`)}catch(e){f++;console.error(`FAIL: ${n}\n${e.stack}`)}};const h=`sha256:${"1".repeat(64)}`,head="2".repeat(40);const seats=[{seatId:"seat-openai",provider:"openai",modelFamily:"gpt",modelId:"gpt-5.6-sol",councilEpochId:"e"},{seatId:"seat-anthropic",provider:"anthropic",modelFamily:"claude",modelId:"claude-opus-5",councilEpochId:"e"},{seatId:"seat-google",provider:"google",modelFamily:"gemini",modelId:"gemini-3.7-flash-medium",councilEpochId:"e"}];const ids=seats.map(x=>x.seatId);
const fresh=(riskClass="R1")=>createSession({decisionRequestId:"d",taskId:"t",riskClass,contextHash:h,repositoryHead:head,councilEpochId:"e",rotationOrdinal:0},{epochId:"e",seats},{contextHash:h,repositoryHead:head}).session;
const normalizedAnswer=(answer,id)=>typeof answer==="string"?{voteValue:answer,rationale:`grounds:${id}`}:(answer??{voteValue:"APPROVE",rationale:`grounds:${id}`});
const fake=(answers={},paths={})=>{let calls=0;return{get calls(){return calls},spawn:(id,prompt)=>{calls++;const text=prompt.includes("frozen candidate")?JSON.stringify(normalizedAnswer(answers[id],id)):JSON.stringify({summary:"S",payload:{x:1}});return{stdout:text,stderr:"",exitCode:0,childProcessId:0,cliExecutableRealpath:paths[id]??`/${id}`,cliVersion:"1"}},parse:(id,s)=>({text:s,reportedModelId:null,modelUsage:{},providerSessionId:null,observedToolUsage:[],usageMetadata:null})}};
const opts=(fixture,seatIds=ids)=>({decisionQuestion:"Q",evidence:["E"],seatIds,spawnSeatImpl:fixture.spawn,parseSeatOutputImpl:fixture.parse});const frozen=(fixture=fake())=>runProposerFlow(fresh(),opts(fixture)).session;
await test("proposer once and committed reveal identical",()=>{const x=fake();const r=runProposerFlow(fresh(),opts(x));assert.equal(x.calls,1);assert.deepEqual(r.session.proposal.proposalContent,r.proposalContent)});
await test("APPROVE rationale produces bound assessment and derived vote",()=>{const x=fake({"seat-openai":{voteValue:"APPROVE",rationale:"approve exactly"}});const r=runVotingFlow(frozen(x),opts(x,["seat-openai"]));assert.equal(r.assessments.length,1);assert.equal(r.assessments[0].rationale,"approve exactly");assert.equal(r.assessments[0].voteValue,r.votes[0].voteValue);assert.deepEqual(r.votes[0],{decisionRequestId:"d",candidateHash:r.assessments[0].candidateHash,seatId:"seat-openai",councilEpochId:"e",voteValue:"APPROVE"});assert.equal(verifyAssessmentHash(r.assessments[0]),true)});
await test("REJECT rationale is persisted byte-for-byte",()=>{const rationale="reject\nwith ütf-8 and  spaces ";const x=fake({"seat-openai":{voteValue:"REJECT",rationale}});assert.equal(runVotingFlow(frozen(x),opts(x,["seat-openai"])).assessments[0].rationale,rationale)});
await test("ABSTAIN rationale is persisted byte-for-byte",()=>{const rationale="abstain:\tinsufficient evidence";const x=fake({"seat-openai":{voteValue:"ABSTAIN",rationale}});assert.equal(runVotingFlow(frozen(x),opts(x,["seat-openai"])).assessments[0].rationale,rationale)});
await test("R1 all approve",()=>{const x=fake();const r=runVotingFlow(frozen(x),opts(x));assert.equal(r.session.state,"DECIDED");assert.equal(new Set(r.packets.map(q=>q.packetHash)).size,3);assert.equal(r.assessments.length,3)});
await test("stale hash rejected by kernel",()=>{const x=fake();const s=frozen(x);const r=applyEvent(s,{type:"CAST_VOTE",vote:{decisionRequestId:"d",candidateHash:`sha256:${"0".repeat(64)}`,seatId:"seat-openai",councilEpochId:"e",voteValue:"APPROVE"}});assert.equal(r.error.code,"CANDIDATE_HASH_MISMATCH")});
await test("R2 excludes proposer and reviewers decide",()=>{const x=fake();const reviewerIds=["seat-anthropic","seat-google"];const p1=runProposerFlow(fresh("R2"),opts(x,reviewerIds));assert.equal(runVotingFlow(p1.session,opts(x,reviewerIds)).session.state,"DECIDED");assert.throws(()=>runVotingFlow(p1.session,opts(x)),/PROPOSER_CANNOT_VOTE/)});
await test("malformed proposer does not advance",()=>{const x=fake();x.parse=()=>({text:'{"summary":""}',reportedModelId:null,modelUsage:{},providerSessionId:null,observedToolUsage:[],usageMetadata:null});const s=fresh();assert.throws(()=>runProposerFlow(s,opts(x)),/MALFORMED/);assert.equal(s.state,"CREATED")});
for(const [name,response] of [["missing rationale",{voteValue:"APPROVE"}],["empty rationale",{voteValue:"APPROVE",rationale:""}],["whitespace rationale",{voteValue:"APPROVE",rationale:" \t\n"}],["over-1200 rationale",{voteValue:"APPROVE",rationale:"x".repeat(1201)}],["extra reviewer field",{voteValue:"APPROVE",rationale:"valid",extra:true}]])await test(`${name} fails closed without advancing the supplied session`,()=>{const x=fake({"seat-openai":response});const s=frozen(x),before=structuredClone(s);assert.throws(()=>runVotingFlow(s,opts(x,["seat-openai"])),/MALFORMED_SEAT_OUTPUT/);assert.deepEqual(s,before);assert.equal(s.state,"CANDIDATE_FROZEN")});
await test("assessment hash detects one-byte mutations",()=>{const x=fake();const a=runVotingFlow(frozen(x),opts(x,["seat-openai"])).assessments[0];for(const mutation of [{rationale:`${a.rationale}!`},{voteValue:"REJECT"},{candidateHash:`sha256:${"0".repeat(64)}`}])assert.equal(verifyAssessmentHash({...a,...mutation}),false)});
await test("candidate seat packet and output-attestation substitutions fail binding",()=>{const x=fake();const s=frozen(x);const r=runVotingFlow(s,opts(x,["seat-openai"]));const a=r.assessments[0];for(const mutation of [{candidateHash:`sha256:${"0".repeat(64)}`},{seatId:"seat-google"},{packetHash:`sha256:${"0".repeat(64)}`},{outputHash:`sha256:${"0".repeat(64)}`},{attestationHash:`sha256:${"0".repeat(64)}`}])assert.equal(verifyAssessmentHash({...a,...mutation}),false);assert.equal(a.candidateHash,s.candidateDecision.candidateHash);assert.equal(a.seatId,"seat-openai");assert.equal(a.packetHash,r.packets[0].packetHash);assert.equal(a.outputHash,r.attestations[0].outputHash);assert.equal(a.attestationHash,r.attestations[0].attestationHash)});
await test("rationale has zero effect on quorum and DecisionRecord",()=>{const votes={"seat-openai":"APPROVE","seat-anthropic":"APPROVE","seat-google":"ABSTAIN"};const answersA=Object.fromEntries(ids.map(id=>[id,{voteValue:votes[id],rationale:`A:${id}`}])) ;const answersB=Object.fromEntries(ids.map(id=>[id,{voteValue:votes[id],rationale:`completely different B rationale for ${id}`}])) ;const a=runShadowExercise(fresh(),opts(fake(answersA))),b=runShadowExercise(fresh(),opts(fake(answersB)));assert.deepEqual(a.decisionRecord,b.decisionRecord);assert.equal(a.decisionRecord.recordHash,b.decisionRecord.recordHash);assert.equal(a.session.state,b.session.state)});
await test("reject once no retry",()=>{const x=fake({"seat-openai":"REJECT","seat-anthropic":"APPROVE","seat-google":"ABSTAIN"});const r=runVotingFlow(frozen(x),opts(x));assert.equal(r.session.state,"NO_QUORUM");assert.equal(x.calls,4)});
await test("full exercise returns assessments and one attestation per invocation",()=>{const x=fake();const r=runShadowExercise(fresh(),opts(x));assert.equal(r.attestations.length,4);assert.equal(r.assessments.length,3);assert.equal(r.decisionRecord.state,"DECIDED")});
const failureHooks=()=>{const failures=[];return{failures,hooks:{onInvocationFailure:x=>failures.push(x)}}};
await test("thrown spawn failure is journaled as SPAWN before the original error propagates",()=>{
  const x=fake(),j=failureHooks(),o={...opts(x),hooks:j.hooks,spawnSeatImpl:()=>{throw new Error("SPAWN_BROKE")}};
  assert.throws(()=>runProposerFlow(fresh(),o),e=>e.message==="SPAWN_BROKE");
  assert.equal(j.failures.length,1);assert.equal(j.failures[0].stage,"SPAWN");assert.equal(j.failures[0].errorCode,"SPAWN_BROKE");assert.equal(verifyInvocationFailureHash(j.failures[0]),true);
});
await test("nonzero process exit is journaled at ADMISSION",()=>{
  const x=fake(),j=failureHooks(),spawn=x.spawn,o={...opts(x),hooks:j.hooks,spawnSeatImpl:(id,prompt)=>({...spawn(id,prompt),exitCode:9})};
  assert.throws(()=>runProposerFlow(fresh(),o),e=>e.message==="NONZERO_EXIT");
  assert.equal(j.failures[0].stage,"ADMISSION");assert.equal(j.failures[0].errorCode,"NONZERO_EXIT");assert.equal(verifyInvocationFailureHash(j.failures[0]),true);
});
await test("provider envelope parse failure is journaled before propagation",()=>{
  const x=fake(),j=failureHooks(),o={...opts(x),hooks:j.hooks,parseSeatOutputImpl:()=>{throw new Error("BAD_PROVIDER_ENVELOPE")}};
  assert.throws(()=>runProposerFlow(fresh(),o),e=>e.message==="BAD_PROVIDER_ENVELOPE");
  assert.equal(j.failures[0].stage,"PROVIDER_ENVELOPE_PARSE");assert.equal(j.failures[0].stdoutByteLength>0,true);assert.equal(verifyInvocationFailureHash(j.failures[0]),true);
});
await test("invalid Shadow-Council JSON is journaled without changing the public error",()=>{
  const x=fake(),j=failureHooks(),o={...opts(x),hooks:j.hooks,parseSeatOutputImpl:()=>({text:"{",reportedModelId:null,modelUsage:{},providerSessionId:null,observedToolUsage:[],usageMetadata:null})};
  assert.throws(()=>runProposerFlow(fresh(),o),e=>e.message==="MALFORMED_SEAT_OUTPUT");
  assert.equal(j.failures[0].stage,"SHADOW_RESPONSE_JSON_PARSE");assert.equal(verifyInvocationFailureHash(j.failures[0]),true);
});
await test("extra or missing response fields are journaled as SHADOW_RESPONSE_SHAPE",()=>{
  for(const [value,details] of [[{voteValue:"APPROVE"},{missingFields:["rationale"],extraFields:[]}],[{voteValue:"APPROVE",rationale:"valid",extra:true},{missingFields:[],extraFields:["extra"]}]]){
    const x=fake({"seat-openai":value}),j=failureHooks();
    assert.throws(()=>runVotingFlow(frozen(x),{...opts(x,["seat-openai"]),hooks:j.hooks}),/MALFORMED_SEAT_OUTPUT/);
    assert.equal(j.failures[0].stage,"SHADOW_RESPONSE_SHAPE");assert.deepEqual(j.failures[0].details,details);assert.equal(verifyInvocationFailureHash(j.failures[0]),true);
  }
});
await test("invalid vote value is identified in response-shape details",()=>{
  const x=fake({"seat-openai":{voteValue:"MAYBE",rationale:"unclear"}}),j=failureHooks();
  assert.throws(()=>runVotingFlow(frozen(x),{...opts(x,["seat-openai"]),hooks:j.hooks}),/MALFORMED_SEAT_OUTPUT/);
  assert.deepEqual(j.failures[0].details,{missingFields:[],extraFields:[],invalidVoteValue:"MAYBE"});
});
await test("failure evidence carries resolved provider and requested model",()=>{
  const x=fake({"seat-openai":{voteValue:"APPROVE"}}),j=failureHooks();
  assert.throws(()=>runVotingFlow(frozen(x),{...opts(x,["seat-openai"]),hooks:j.hooks}),/MALFORMED_SEAT_OUTPUT/);
  assert.equal(j.failures[0].provider,"openai");assert.equal(j.failures[0].requestedModelId,"gpt-5.6-sol");
});
await test("argv construction failure is INVOCATION_CONFIG",()=>{
  const x=fake(),j=failureHooks(),e=new Error("ARGV_CONFIG_BROKE");
  assert.throws(()=>runProposerFlow(fresh(),{...opts(x),hooks:j.hooks,buildInvocationArgvImpl:()=>{throw e}}),x=>x===e);
  assert.equal(j.failures[0].stage,"INVOCATION_CONFIG");
});
await test("attestation construction failure is ATTESTATION_BUILD",()=>{
  const x=fake(),j=failureHooks(),e=new Error("ATTESTATION_CONSTRUCTION_BROKE");
  assert.throws(()=>runProposerFlow(fresh(),{...opts(x),hooks:j.hooks,buildAttestationImpl:()=>{throw e}}),x=>x===e);
  assert.equal(j.failures[0].stage,"ATTESTATION_BUILD");assert.notEqual(j.failures[0].stdoutHash,null);
});
await test("vote derivation failure is VOTE_DERIVATION",()=>{
  const x=fake(),j=failureHooks(),e=new Error("VOTE_DERIVATION_BROKE");
  assert.throws(()=>runVotingFlow(frozen(x),{...opts(x,["seat-openai"]),hooks:j.hooks,deriveAgentVoteImpl:()=>{throw e}}),x=>x===e);
  assert.equal(j.failures[0].stage,"VOTE_DERIVATION");
});
await test("duplicate seat vote is KERNEL_EVENT and retains exact invocation hashes",()=>{
  const x=fake(),s=frozen(x),candidateHash=s.candidateDecision.candidateHash;
  const pre=applyEvent(s,{type:"CAST_VOTE",vote:{decisionRequestId:"d",candidateHash,seatId:"seat-openai",councilEpochId:"e",voteValue:"APPROVE"}}).session,j=failureHooks();
  const stdout=JSON.stringify({voteValue:"APPROVE",rationale:"grounds:seat-openai"});
  assert.throws(()=>runVotingFlow(pre,{...opts(x,["seat-openai"]),hooks:j.hooks}),/DUPLICATE_SEAT_VOTE/);
  const failure=j.failures[0];assert.equal(failure.stage,"KERNEL_EVENT");assert.equal(failure.stdoutHash,computeOutputHash(stdout));assert.equal(failure.stderrHash,computeOutputHash(""));assert.equal(failure.stdoutByteLength,Buffer.byteLength(stdout));assert.notEqual(failure.invocationConfigHash,null);
});
await test("executable drift is RUN_POSTCONDITION and retains the drifting invocation hashes",()=>{
  let invocation=0;const x=fake(),spawn=(id,prompt)=>{const run=x.spawn(id,prompt);invocation++;return{...run,cliExecutableRealpath:id==="seat-openai"?`/seat-openai-${invocation}`:run.cliExecutableRealpath}},j=failureHooks();
  const o={...opts(x),spawnSeatImpl:spawn,hooks:j.hooks};
  assert.throws(()=>runShadowExercise(fresh(),o),/EXECUTABLE_IDENTITY_DRIFT/);
  const failure=j.failures[0],stdout=JSON.stringify({voteValue:"APPROVE",rationale:"grounds:seat-openai"});
  assert.equal(failure.stage,"RUN_POSTCONDITION");assert.equal(failure.seatId,"seat-openai");assert.equal(failure.stdoutHash,computeOutputHash(stdout));assert.equal(failure.stderrHash,computeOutputHash(""));assert.equal(failure.stdoutByteLength,Buffer.byteLength(stdout));assert.notEqual(failure.invocationConfigHash,null);
});
await test("invalid rationales journal exact assessment validation failures",()=>{
  for(const rationale of [""," \t\n","x".repeat(1201)]){
    const answer={voteValue:"APPROVE",rationale};
    const x=fake({"seat-openai":answer}),j=failureHooks();
    assert.throws(()=>runVotingFlow(frozen(x),{...opts(x,["seat-openai"]),hooks:j.hooks}),/MALFORMED_SEAT_OUTPUT/);
    const failure=j.failures[0];assert.equal(failure.stage,"ASSESSMENT_VALIDATION");assert.deepEqual(failure.assessmentFailure,{errorCode:"MALFORMED_ASSESSMENT_INPUT",details:rationale?.length>1200?{field:"rationale",reason:"CHARACTER_LIMIT"}:{field:"rationale"}});
    assert.equal(failure.errorCode,failure.assessmentFailure.errorCode);assert.deepEqual(failure.details,failure.assessmentFailure.details);assert.equal(verifyInvocationFailureHash(failure),true);
  }
});
await test("success evidence is observable before the next seat fails and later seats are skipped",()=>{
  const x=fake({"seat-anthropic":{voteValue:"APPROVE"}}),events=[],packets=[],attestations=[],assessments=[],failures=[];
  const hooks={onPacketBuilt:(artifact,meta)=>{events.push(`packet:${meta.seatId}`);packets.push(artifact)},onAttestationAdmitted:(artifact,meta)=>{events.push(`attestation:${meta.seatId}`);attestations.push(artifact)},onAssessmentBuilt:(artifact,meta)=>{events.push(`assessment:${meta.seatId}`);assessments.push(artifact)},onInvocationFailure:artifact=>{events.push(`failure:${artifact.seatId}`);failures.push(artifact)}};
  const s=frozen(x);const callsBefore=x.calls;
  assert.throws(()=>runVotingFlow(s,{...opts(x),hooks}),/MALFORMED_SEAT_OUTPUT/);
  assert.deepEqual(events,["packet:seat-openai","attestation:seat-openai","assessment:seat-openai","packet:seat-anthropic","attestation:seat-anthropic","failure:seat-anthropic"]);
  assert.equal(x.calls-callsBefore,2);assert.equal(events.some(e=>e.includes("seat-google")),false);
  const {packetHash,...packetBody}=packets[0];assert.equal(computePacketHash(packetBody),packetHash);
  const {attestationHash,...attestationBody}=attestations[0];assert.equal(buildAttestation(attestationBody).attestationHash,attestationHash);
  assert.equal(verifyAssessmentHash(assessments[0]),true);assert.equal(verifyInvocationFailureHash(failures[0]),true);
});
console.log(`shadow-council-harness: ${p} passed, ${f} failed`);if(f)process.exitCode=1;
