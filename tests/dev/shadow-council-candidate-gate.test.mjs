import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync,readFileSync,realpathSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join,resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSession } from "../../scripts/dev/decision-council-kernel.mjs";
import { compileProjectContextPack } from "../../scripts/dev/project-context-pack.mjs";
import { buildCandidateRequirementSpec,validateCandidateAgainstRequirementSpec } from "../../scripts/dev/shadow-council-candidate-requirements.mjs";
import { runProposerFlow } from "../../scripts/dev/shadow-council-harness.mjs";
import { runShadowExerciseWithDurableEvidence } from "../../scripts/dev/shadow-council-run-bundle-evidence.mjs";
import { buildShadowCouncilConfig,SHADOW_COUNCIL_SEAT_ORDER } from "../../scripts/dev/shadow-council-cli-transport.mjs";
const REPO_ROOT=resolve(fileURLToPath(new URL(".",import.meta.url)),"..",".."),root=mkdtempSync(join(realpathSync(tmpdir()),"mihver-candidate-gate-")),epoch="candidate-gate-epoch",config=buildShadowCouncilConfig(epoch),contextPack=compileProjectContextPack(REPO_ROOT);
const taskRecord={taskId:"CANDIDATE-GATE-TEST",objective:"Test the pre-freeze structured candidate gate.",branch:"fix/shadow-council-candidate-gate-reliability-v1",baseCommit:"a".repeat(40),allowedScope:["scripts/dev/**","tests/dev/**"],disposition:"IN_PROGRESS",unresolvedRisks:[],humanActionRequested:"Inspect synthetic evidence."};
const fresh=id=>createSession({decisionRequestId:id,taskId:"gate-test",riskClass:"R1",contextHash:contextPack.contextHash,repositoryHead:contextPack.repository.head,councilEpochId:epoch,rotationOrdinal:0},config,{contextHash:contextPack.contextHash,repositoryHead:contextPack.repository.head}).session;
const candidate={serverDerivedIdentity:{authenticatedApproverUid:"uid-123"},immutableGrant:{grantHash:"sha256:"+"7".repeat(64)},lifecycle:{initialState:"PENDING"},outcome:"IDEMPOTENCY_KEY_REUSE",uidPolicy:{rejectUnknownTopLevelFields:true},prose:{description:"Unknown or extra top-level fields are rejected; identity and grant are safe."}};
const rules=[
 {requirementId:"V8-APPROVER-UID",path:["serverDerivedIdentity","authenticatedApproverUid"],op:"PATH_PRESENT"},
 {requirementId:"V8-GRANT-HASH",path:["immutableGrant","grantHash"],op:"TYPE",expectedType:"string"},
 {requirementId:"V8-INITIAL-STATE",path:["lifecycle","initialState"],op:"EQUALS",expected:"PENDING"},
 {requirementId:"V8-OUTCOME",path:["outcome"],op:"ENUM",allowed:["IDEMPOTENCY_KEY_REUSE"]},
 {requirementId:"V8-UID-POLICY",path:["uidPolicy","rejectUnknownTopLevelFields"],op:"BOOLEAN",expected:true},
],spec=buildCandidateRequirementSpec({specId:"v8-structured-regression",hardGate:rules,councilReview:[]});
assert.equal(validateCandidateAgainstRequirementSpec({spec,candidatePayload:candidate}).ok,true);
const mutations=[
 ["V8-APPROVER-UID",x=>delete x.serverDerivedIdentity.authenticatedApproverUid],["V8-UID-POLICY",x=>x.uidPolicy.rejectUnknownTopLevelFields=false],
 ["V8-OUTCOME",x=>x.outcome="UNKNOWN_FIELDS"],["V8-INITIAL-STATE",x=>x.lifecycle.initialState="ACTIVE"],["V8-GRANT-HASH",x=>x.immutableGrant.grantHash=7],
];
for(const [id,mutate] of mutations){const value=structuredClone(candidate);mutate(value);const r=validateCandidateAgainstRequirementSpec({spec,candidatePayload:value});assert.equal(r.ok,false);assert.ok(r.failedRequirementIds.includes(id))}
for(const wording of ["unknown or extra top-level fields","unknown fields"]){const value=structuredClone(candidate);value.uidPolicy.rejectUnknownTopLevelFields=false;value.prose.description=`The prose says ${wording} are rejected and every other semantic is correct.`;const r=validateCandidateAgainstRequirementSpec({spec,candidatePayload:value});assert.deepEqual(r.failedRequirementIds,["V8-UID-POLICY"])}

function fixture(proposal){let calls=[];return{calls,spawnSeatImpl(seatId,prompt){const role=prompt.includes("frozen candidate")?"VOTER":"PROPOSER";calls.push({seatId,role});return{stdout:"opaque",stderr:"",exitCode:0,childProcessId:calls.length,cliExecutableRealpath:`/${seatId}`,cliVersion:"1"}},parseSeatOutputImpl(seatId){const role=calls.at(-1).role,value=role==="PROPOSER"?{summary:"Structured candidate",payload:proposal}:{voteValue:"APPROVE",rationale:`Structured candidate passes for ${seatId}.`};return{text:JSON.stringify(value),reportedModelId:null,modelUsage:{},providerSessionId:null,observedToolUsage:[],usageMetadata:null}}}}
const baseOpts=f=>({decisionQuestion:"Does the candidate satisfy the structured contract?",evidence:["synthetic evidence"],seatIds:SHADOW_COUNCIL_SEAT_ORDER,...f});
const passingFixture=fixture(candidate),passing=runProposerFlow(fresh("direct-success"),{...baseOpts(passingFixture),candidateRequirementSpec:spec});assert.equal(passing.session.state,"CANDIDATE_FROZEN");assert.match(passing.session.candidateDecision.candidateHash,/^sha256:/);assert.notEqual(passing.unfrozenProposal.unfrozenProposalHash,passing.session.candidateDecision.candidateHash);assert.equal(JSON.stringify(passing.unfrozenProposal).includes(passing.session.candidateDecision.candidateHash),false);assert.equal(JSON.stringify(passing.session.candidateDecision).includes(passing.unfrozenProposal.unfrozenProposalHash),false);

function assertRejectedGate(name,validateCandidateImpl,candidateRequirementSpec=spec){const f=fixture(candidate),failures=[];let session=fresh(name);assert.throws(()=>runProposerFlow(session,{...baseOpts(f),candidateRequirementSpec,validateCandidateImpl,hooks:{onInvocationFailure:x=>failures.push(x)}}),/CANDIDATE_CONSTRUCTION_BLOCKER/);assert.equal(session.candidateDecision?.candidateHash,undefined);assert.equal(f.calls.filter(x=>x.role==="VOTER").length,0);assert.equal(failures.length,1);assert.equal(failures[0].errorCode,"CANDIDATE_CONSTRUCTION_BLOCKER");assert.equal(failures[0].details.gateResultInvalid,true)}
const genuine=validateCandidateAgainstRequirementSpec({spec,candidatePayload:candidate});
assertRejectedGate("bare-result",()=>({ok:true}));
assertRejectedGate("wrong-spec-hash",()=>({...genuine,specHash:"sha256:"+"0".repeat(64)}));
assertRejectedGate("truncated-ids",()=>({...genuine,evaluatedRequirementIds:genuine.evaluatedRequirementIds.slice(0,-1)}));
assertRejectedGate("reordered-ids",()=>({...genuine,evaluatedRequirementIds:[...genuine.evaluatedRequirementIds].reverse()}));
assertRejectedGate("nonempty-failures",()=>({...genuine,failures:[{requirementId:"injected"}]}));
assertRejectedGate("impl-without-spec",()=>({ok:true}),undefined);
const forgedSpec={kind:"ShadowCandidateRequirementSpec",schemaVersion:"1.0.0",specId:"forged",hardGate:[{requirementId:"x"}],councilReview:[],requirementSpecHash:"sha256:"+"1".repeat(64)};
assertRejectedGate("forged-spec",()=>({ok:true,specHash:forgedSpec.requirementSpecHash,evaluatedRequirementIds:["x"],failedRequirementIds:[],failures:[]}),forgedSpec);
const genuineFixture=fixture(candidate),genuinePass=runProposerFlow(fresh("genuine-result"),{...baseOpts(genuineFixture),candidateRequirementSpec:spec,validateCandidateImpl:validateCandidateAgainstRequirementSpec});assert.equal(genuinePass.session.state,"CANDIDATE_FROZEN");

function durableOpts(name,f,extra={}){const out=join(root,name);return{out,evidenceDir:join(out,"evidence"),runId:name,contextPack,taskRecord,...baseOpts(f),execFileSyncImpl:()=>"https://github.com/MIHVER/mihver.git\n",...extra}}
const invalid=structuredClone(candidate);invalid.lifecycle.initialState="ACTIVE";const blockedFixture=fixture(invalid),blockedOpts=durableOpts("blocked",blockedFixture,{candidateRequirementSpec:spec});assert.throws(()=>runShadowExerciseWithDurableEvidence(fresh("blocked"),blockedOpts),/CANDIDATE_CONSTRUCTION_BLOCKER/);
const manifest=JSON.parse(readFileSync(join(blockedOpts.out,"evidence-manifest.json"),"utf8")),runManifest=JSON.parse(readFileSync(join(blockedOpts.out,"run-manifest.json"),"utf8")),entries=manifest.evidence;
for(const prefix of ["shadow-decision-request:","shadow-council-config:","shadow-candidate-requirement-spec:","shadow-council-packet:","shadow-seat-attestation:","shadow-unfrozen-proposal:","shadow-seat-invocation-failure:"])assert.ok(entries.some(x=>x.evidenceId.startsWith(prefix)),prefix);
assert.equal(entries.filter(x=>x.evidenceId.startsWith("shadow-seat-invocation-failure:")).length,1);assert.equal(blockedFixture.calls.filter(x=>x.role==="VOTER").length,0);assert.equal(runManifest.status,"OPEN");
const allBytes=entries.map(x=>readFileSync(x.sourcePath,"utf8")).join("\n");assert.equal(/"candidateHash":"sha256:/.test(allBytes),false);assert.equal(entries.some(x=>/shadow-(decision-record|council-quorum-proof):/.test(x.evidenceId)),false);
const recovered=JSON.parse(execFileSync(process.execPath,["--input-type=module","-e",`import{readFileSync}from'node:fs';const m=JSON.parse(readFileSync(process.argv[1],'utf8'));const rows=m.evidence.map(e=>[e.evidenceId,JSON.parse(readFileSync(e.sourcePath,'utf8'))]);const find=p=>rows.find(([id])=>id.startsWith(p))[1];const u=find('shadow-unfrozen-proposal:'),s=find('shadow-candidate-requirement-spec:'),f=find('shadow-seat-invocation-failure:');process.stdout.write(JSON.stringify({proposalContent:u.proposalContent,spec:s,failed:f.details.failedRequirementIds,unfrozen:u}))`,join(blockedOpts.out,"evidence-manifest.json")],{encoding:"utf8"}));
assert.deepEqual(recovered.proposalContent,{summary:"Structured candidate",payload:invalid});assert.deepEqual(recovered.spec,spec);assert.deepEqual(recovered.failed,["V8-INITIAL-STATE"]);assert.equal(Object.hasOwn(recovered.unfrozen,"candidateHash"),false);assert.notEqual(recovered.unfrozen.kind,"CandidateDecision");

const throwingFixture=fixture(candidate),throwingOpts=durableOpts("throwing-validator",throwingFixture,{candidateRequirementSpec:spec,validateCandidateImpl:()=>{throw new Error("hostile validator failure "+"x".repeat(250))}});assert.throws(()=>runShadowExerciseWithDurableEvidence(fresh("throwing-validator"),throwingOpts),/CANDIDATE_CONSTRUCTION_BLOCKER/);
const throwingManifest=JSON.parse(readFileSync(join(throwingOpts.out,"evidence-manifest.json"),"utf8")),throwingRunManifest=JSON.parse(readFileSync(join(throwingOpts.out,"run-manifest.json"),"utf8")),throwingFailures=throwingManifest.evidence.filter(x=>x.evidenceId.startsWith("shadow-seat-invocation-failure:")).map(x=>JSON.parse(readFileSync(x.sourcePath,"utf8")));
assert.equal(throwingFailures.length,1);assert.equal(throwingFailures[0].errorCode,"CANDIDATE_CONSTRUCTION_BLOCKER");assert.match(throwingFailures[0].details.gateEvaluationError,/hostile validator failure/);assert.equal(throwingFailures[0].details.gateEvaluationError.length,200);assert.equal(throwingRunManifest.status,"OPEN");assert.equal(throwingFixture.calls.filter(x=>x.role==="VOTER").length,0);assert.equal(throwingManifest.evidence.map(x=>readFileSync(x.sourcePath,"utf8")).join("\n").includes('"candidateHash":"sha256:'),false);

const legacyFixture=fixture(candidate),legacyOpts=durableOpts("legacy",legacyFixture);const legacy=runShadowExerciseWithDurableEvidence(fresh("legacy"),legacyOpts);assert.equal(legacy.session.state,"DECIDED");assert.equal(legacy.evidence.some(x=>x.evidenceId.startsWith("shadow-candidate-requirement-spec:")||x.evidenceId.startsWith("shadow-unfrozen-proposal:")),false);
console.log("Shadow Council candidate gate tests: passed");
rmSync(root,{recursive:true,force:true});
