import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as mod from "../../scripts/dev/shadow-council-candidate-requirements.mjs";
import { buildCandidateRequirementSpec,renderCandidateRequirementEvidenceItems,renderHardRuleInstruction,validateCandidateAgainstRequirementSpec,assertGateResultAccepted,HARD_RULE_OPS } from "../../scripts/dev/shadow-council-candidate-requirements.mjs";
const build=(hardGate,councilReview=[])=>buildCandidateRequirementSpec({specId:"test-spec",hardGate,councilReview});
const validate=(rule,payload)=>validateCandidateAgainstRequirementSpec({spec:build([rule]),candidatePayload:payload});
const idsIn=text=>[...text.matchAll(/^\[([^\]]+)\]/gm)].map(x=>x[1]);

const many=[
  {requirementId:"present",path:["present"],op:"PATH_PRESENT"},{requirementId:"type",path:["count"],op:"TYPE",expectedType:"integer"},
  {requirementId:"equals",path:["mode"],op:"EQUALS",expected:"SAFE"},{requirementId:"enum",path:["mode"],op:"ENUM",allowed:["SAFE","DRY"]},
  {requirementId:"null",path:["none"],op:"NULL"},{requirementId:"boolean",path:["enabled"],op:"BOOLEAN",expected:true},
  {requirementId:"range",path:["count"],op:"INTEGER_RANGE",min:1,max:3},{requirementId:"keys",path:["obj"],op:"EXACT_KEYS",keys:["a"]},
  {requirementId:"unknown",path:["obj"],op:"NO_UNKNOWN_FIELDS",allowed:["a"]},{requirementId:"object",path:["obj"],op:"OBJECT_EXACT",expected:{a:1}},
  {requirementId:"length",path:["rows"],op:"ARRAY_LENGTH",length:2},{requirementId:"unique",path:["rows"],op:"ARRAY_UNIQUE",idField:"id"},
  {requirementId:"ids",path:["rows"],op:"ARRAY_EXACT_IDS",idField:"id",ids:["A","B"]},
];
const payload={present:null,count:2,mode:"SAFE",none:null,enabled:true,obj:{a:1},rows:[{id:"A"},{id:"B"}]};
const review=[{requirementId:"review-only",criterion:"Assess operational clarity."}],spec=build(many,review),rendered=renderCandidateRequirementEvidenceItems(spec).join("\n"),result=validateCandidateAgainstRequirementSpec({spec,candidatePayload:payload});
assert.equal(result.ok,true);for(const rule of many){assert.equal(spec.hardGate.filter(x=>x.requirementId===rule.requirementId).length,1);assert.match(rendered,new RegExp(`\\[${rule.requirementId}\\]`));assert.ok(result.evaluatedRequirementIds.includes(rule.requirementId))}
assert.deepEqual(new Set(idsIn(rendered)),new Set([...result.evaluatedRequirementIds,...review.map(x=>x.requirementId)]));
const removed=build(many.slice(1),review),removedText=renderCandidateRequirementEvidenceItems(removed).join("\n"),removedResult=validateCandidateAgainstRequirementSpec({spec:removed,candidatePayload:payload});assert.doesNotMatch(removedText,/\[present\]/);assert.ok(!removedResult.evaluatedRequirementIds.includes("present"));
const changed=build(many.map(x=>x.requirementId==="equals"?{...x,expected:"CHANGED"}:x),review);assert.notEqual(renderHardRuleInstruction(changed.hardGate[2]),renderHardRuleInstruction(spec.hardGate[2]));assert.equal(validateCandidateAgainstRequirementSpec({spec:changed,candidatePayload:payload}).ok,false);

const {present:_omitted,...withoutPresent}=payload;const cases=[
 [many[0],payload,withoutPresent,"PATH_MISSING"],[many[1],payload,{...payload,count:"2"},"TYPE_MISMATCH"],[many[2],payload,{...payload,mode:"NO"},"VALUE_MISMATCH"],[many[3],payload,{...payload,mode:"NO"},"ENUM_VIOLATION"],
 [many[4],payload,{...payload,none:0},"VALUE_MISMATCH"],[many[5],payload,{...payload,enabled:false},"VALUE_MISMATCH"],[many[6],payload,{...payload,count:4},"RANGE_VIOLATION"],[many[7],payload,{...payload,obj:{a:1,b:2}},"KEYSET_MISMATCH"],
 [many[8],payload,{...payload,obj:{a:1,b:2}},"UNKNOWN_FIELDS_PRESENT"],[many[9],payload,{...payload,obj:{a:2}},"VALUE_MISMATCH"],[many[10],payload,{...payload,rows:[{id:"A"}]},"ARRAY_LENGTH_MISMATCH"],
 [many[11],payload,{...payload,rows:[{id:"A"},{id:"A"}]},"ARRAY_DUPLICATE_ID"],[many[12],payload,{...payload,rows:[{id:"B"},{id:"A"}]},"ARRAY_ID_MISMATCH"],
];
assert.deepEqual(HARD_RULE_OPS,many.map(x=>x.op));for(const [rule,good,bad,code] of cases){assert.equal(validate(rule,good).ok,true,rule.op);const failed=validate(rule,bad);assert.equal(failed.ok,false);assert.equal(failed.failures[0].requirementId,rule.requirementId);assert.equal(failed.failures[0].errorCode,code)}
assert.deepEqual(new Set(cases.map(([rule])=>rule.op)),new Set(HARD_RULE_OPS));assert.equal(Object.isFrozen(HARD_RULE_OPS),true);assert.equal(Object.hasOwn(mod,"OP_TABLE"),false);
const schema=JSON.parse(readFileSync(new URL("../../schemas/dev/shadow-candidate-requirement-spec.schema.json",import.meta.url),"utf8"));assert.deepEqual(schema.$defs.op.enum,HARD_RULE_OPS);assert.equal(schema.properties.hardGate.minItems,1);
assert.throws(()=>buildCandidateRequirementSpec({specId:"empty",hardGate:[],councilReview:[]}),/INVALID_REQUIREMENT_SPEC/);
for(const nonObject of [[],"candidate",null]){const failed=validateCandidateAgainstRequirementSpec({spec,candidatePayload:nonObject});assert.equal(failed.ok,false);assert.deepEqual(failed.failures,[{requirementId:"__payload__",errorCode:"PAYLOAD_NOT_OBJECT",path:[]}])}
assert.equal(assertGateResultAccepted({spec,result}),true);assert.equal(assertGateResultAccepted({spec,result:{ok:true}}),false);
for(const field of ["ok","specHash","evaluatedRequirementIds","failedRequirementIds","failures"]){let ran=false;const accessorResult={...result};Object.defineProperty(accessorResult,field,{enumerable:true,get(){ran=true;throw new Error("GETTER_EXECUTED")}});assert.doesNotThrow(()=>assert.equal(assertGateResultAccepted({spec,result:accessorResult}),false));assert.equal(ran,false)}
let benignRan=false;const benignAccessor={...result};Object.defineProperty(benignAccessor,"ok",{enumerable:true,get(){benignRan=true;return true}});assert.equal(assertGateResultAccepted({spec,result:benignAccessor}),false);assert.equal(benignRan,false);
const genuineResult=validateCandidateAgainstRequirementSpec({spec,candidatePayload:payload});assert.equal(assertGateResultAccepted({spec,result:genuineResult}),true);
const hostileInputs=[undefined,null,1,[],new Proxy({},{getPrototypeOf(){throw new Error("TRAP_EXECUTED")}}),{toString(){throw new Error("TO_STRING_EXECUTED")}}];for(const hostileInput of hostileInputs)assert.doesNotThrow(()=>assert.equal(assertGateResultAccepted({spec,result:hostileInput}),false));
const tamperedHash={...structuredClone(spec),requirementSpecHash:"sha256:"+"0".repeat(64)};assert.equal(assertGateResultAccepted({spec:tamperedHash,result:{...result,specHash:tamperedHash.requirementSpecHash}}),false);
const malformedRule={...structuredClone(spec),hardGate:[{requirementId:"x"}],requirementSpecHash:"sha256:"+"1".repeat(64)};assert.equal(assertGateResultAccepted({spec:malformedRule,result:{ok:true,specHash:malformedRule.requirementSpecHash,evaluatedRequirementIds:["x"],failedRequirementIds:[],failures:[]}}),false);
const extraField={...structuredClone(spec),unknown:true};assert.equal(assertGateResultAccepted({spec:extraField,result}),false);
const staleBody=structuredClone(spec);staleBody.hardGate[0].path=["changed-after-build"];assert.equal(assertGateResultAccepted({spec:staleBody,result}),false);
const validationBeforeExportMutation=validate(many[2],payload);assert.equal(Reflect.set(HARD_RULE_OPS,0,"EQUALS"),false);assert.equal(validate(many[2],payload).ok,validationBeforeExportMutation.ok);
const hostile={};Object.defineProperty(hostile,"present",{enumerable:true,get(){throw new Error("GETTER_EXECUTED")}});const hostileResult=validate(many[0],hostile);assert.equal(hostileResult.ok,false);assert.equal(hostileResult.failures[0].errorCode,"PATH_MISSING");
assert.match(rendered,/NOT machine-gated/);assert.ok(!result.evaluatedRequirementIds.includes("review-only"));assert.ok(!result.failedRequirementIds.includes("review-only"));

const packed=build(Array.from({length:18},(_,i)=>({requirementId:`PACK-${String(i).padStart(2,"0")}`,path:[`field-${i}`],op:"EQUALS",expected:"x".repeat(100)})));
const items=renderCandidateRequirementEvidenceItems(packed);assert.ok(items.length>1);assert.ok(items.every(x=>x.length<=1000&&!x.includes("...")));assert.deepEqual(new Set(idsIn(items.join("\n"))),new Set(packed.hardGate.map(x=>x.requirementId)));assert.deepEqual(items,renderCandidateRequirementEvidenceItems(packed));
const huge=build([{requirementId:"TOO-LONG",path:["x"],op:"EQUALS",expected:"x".repeat(950)}]);assert.throws(()=>renderCandidateRequirementEvidenceItems(huge),e=>e.message==="REQUIREMENT_SPEC_PROMPT_BUDGET_EXCEEDED"&&e.details.requirementId==="TOO-LONG");assert.throws(()=>renderCandidateRequirementEvidenceItems(packed,{maxItems:1}),/REQUIREMENT_SPEC_PROMPT_BUDGET_EXCEEDED/);

const qids=Array.from({length:17},(_,i)=>`Q${String(i+1).padStart(2,"0")}`),dids=Array.from({length:12},(_,i)=>`D${String(i+1).padStart(2,"0")}`),matrix=[...qids,...dids].map(id=>({id,answer:"NO"}));
const matrixRules=[{requirementId:"matrix-length",path:["matrix"],op:"ARRAY_LENGTH",length:29},{requirementId:"matrix-ids",path:["matrix"],op:"ARRAY_EXACT_IDS",idField:"id",ids:[...qids,...dids]},{requirementId:"matrix-unique",path:["matrix"],op:"ARRAY_UNIQUE",idField:"id"},...matrix.map((_,i)=>({requirementId:`answer-${i}`,path:["matrix",i,"answer"],op:"EQUALS",expected:"NO"}))];
const matrixSpec=build(matrixRules);assert.equal(validateCandidateAgainstRequirementSpec({spec:matrixSpec,candidatePayload:{matrix}}).ok,true);const wrong=structuredClone(matrix);wrong[16].answer="YES";assert.deepEqual(validateCandidateAgainstRequirementSpec({spec:matrixSpec,candidatePayload:{matrix:wrong}}).failedRequirementIds,["answer-16"]);

const reordered=buildCandidateRequirementSpec({councilReview:structuredClone(review),hardGate:structuredClone(many),specId:"test-spec"});assert.equal(reordered.requirementSpecHash,spec.requirementSpecHash);const mutated=build(many.map((x,i)=>i?x:{...x,path:["different"]}),review);assert.notEqual(mutated.requirementSpecHash,spec.requirementSpecHash);
console.log("Shadow Council candidate requirements tests: passed");
