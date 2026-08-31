import { createHash } from "node:crypto";
import { canonicalizeJson } from "./canonical-json.mjs";

export const CANDIDATE_REQUIREMENT_SPEC_DOMAIN = "MIHVER:ShadowCouncil:CandidateRequirementSpec:v1\0";
const TYPES=new Set(["string","number","integer","boolean","object","array","null"]),HASH=/^sha256:[0-9a-f]{64}$/;
const plain=v=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const exact=(v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const str=(v,n)=>typeof v==="string"&&v.length>=1&&v.length<=n;
const json=v=>{try{canonicalizeJson(v);return true}catch{return false}};
const scalar=v=>v===null||["string","number","boolean"].includes(typeof v)&&json(v);
const strings=(v,max=200)=>Array.isArray(v)&&v.length<=max&&v.every(x=>str(x,200));
function invalid(){throw new Error("INVALID_REQUIREMENT_SPEC")}
const type=v=>v===null?"null":Array.isArray(v)?"array":Number.isInteger(v)?"integer":typeof v==="number"?"number":plain(v)?"object":typeof v;
const bounded=v=>typeof v==="string"?v.slice(0,200):Array.isArray(v)?v.slice(0,50).map(bounded):plain(v)?Object.fromEntries(Object.entries(v).slice(0,50).map(([k,x])=>[k,bounded(x)])):v;
const deepFreeze=value=>{if(value!==null&&typeof value==="object"&&!Object.isFrozen(value)){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value)}return value};
const OP_TABLE=deepFreeze({
  PATH_PRESENT:{args:[],validateArgs:()=>true,evaluate:()=>null},
  TYPE:{args:["expectedType"],validateArgs:r=>TYPES.has(r.expectedType),evaluate:(v,r)=>((r.expectedType==="number"&&typeof v==="number"&&Number.isFinite(v))||type(v)===r.expectedType)?null:{errorCode:"TYPE_MISMATCH",details:{expected:r.expectedType,actualType:type(v)}}},
  EQUALS:{args:["expected"],validateArgs:r=>json(r.expected),evaluate:(v,r)=>canonicalizeJson(v)===canonicalizeJson(r.expected)?null:{errorCode:"VALUE_MISMATCH",details:{expected:bounded(r.expected),actualType:type(v)}}},
  ENUM:{args:["allowed"],validateArgs:r=>Array.isArray(r.allowed)&&r.allowed.length>=1&&r.allowed.length<=200&&r.allowed.every(scalar),evaluate:(v,r)=>r.allowed.some(x=>canonicalizeJson(x)===canonicalizeJson(v))?null:{errorCode:"ENUM_VIOLATION",details:{expected:bounded(r.allowed),actualType:type(v)}}},
  NULL:{args:[],validateArgs:()=>true,evaluate:v=>v===null?null:{errorCode:"VALUE_MISMATCH",details:{expected:null,actualType:type(v)}}},
  BOOLEAN:{args:["expected"],validateArgs:r=>typeof r.expected==="boolean",evaluate:(v,r)=>v===r.expected?null:{errorCode:"VALUE_MISMATCH",details:{expected:r.expected,actualType:type(v)}}},
  INTEGER_RANGE:{args:["min","max"],validateArgs:r=>Number.isInteger(r.min)&&Number.isInteger(r.max)&&r.min<=r.max,evaluate:(v,r)=>Number.isInteger(v)&&v>=r.min&&v<=r.max?null:{errorCode:"RANGE_VIOLATION",details:{expected:{min:r.min,max:r.max},actualType:type(v)}}},
  EXACT_KEYS:{args:["keys"],validateArgs:r=>strings(r.keys)&&new Set(r.keys).size===r.keys.length,evaluate:(v,r)=>plain(v)&&canonicalizeJson(Object.keys(v).sort())===canonicalizeJson([...r.keys].sort())?null:{errorCode:"KEYSET_MISMATCH",details:{missingIds:plain(v)?r.keys.filter(k=>!Object.hasOwn(v,k)):r.keys,extraKeys:plain(v)?Object.keys(v).filter(k=>!r.keys.includes(k)).slice(0,50):[]}}},
  NO_UNKNOWN_FIELDS:{args:["allowed"],validateArgs:r=>strings(r.allowed)&&new Set(r.allowed).size===r.allowed.length,evaluate:(v,r)=>plain(v)&&!Object.keys(v).some(k=>!r.allowed.includes(k))?null:{errorCode:"UNKNOWN_FIELDS_PRESENT",details:{extraKeys:plain(v)?Object.keys(v).filter(k=>!r.allowed.includes(k)).slice(0,50):[]}}},
  OBJECT_EXACT:{args:["expected"],validateArgs:r=>plain(r.expected),evaluate:(v,r)=>canonicalizeJson(v)===canonicalizeJson(r.expected)?null:{errorCode:"VALUE_MISMATCH",details:{expected:bounded(r.expected),actualType:type(v)}}},
  ARRAY_LENGTH:{args:["length"],validateArgs:r=>Number.isInteger(r.length)&&r.length>=0,evaluate:(v,r)=>Array.isArray(v)&&v.length===r.length?null:{errorCode:"ARRAY_LENGTH_MISMATCH",details:{length:Array.isArray(v)?v.length:null,expected:r.length}}},
  ARRAY_UNIQUE:{args:["idField"],validateArgs:r=>str(r.idField,200),evaluate:(v,r)=>{const ids=Array.isArray(v)?v.map(x=>plain(x)&&Object.hasOwn(x,r.idField)&&typeof x[r.idField]==="string"?x[r.idField]:null):[];return!Array.isArray(v)||ids.includes(null)?{errorCode:"ARRAY_ID_MISMATCH"}:new Set(ids).size!==ids.length?{errorCode:"ARRAY_DUPLICATE_ID"}:null}},
  ARRAY_EXACT_IDS:{args:["idField","ids"],validateArgs:r=>str(r.idField,200)&&strings(r.ids)&&new Set(r.ids).size===r.ids.length,evaluate:(v,r)=>{const ids=Array.isArray(v)?v.map(x=>plain(x)&&typeof x[r.idField]==="string"?x[r.idField]:null):[];return Array.isArray(v)&&canonicalizeJson(ids)===canonicalizeJson(r.ids)?null:{errorCode:"ARRAY_ID_MISMATCH",details:{expected:r.ids,length:Array.isArray(v)?v.length:null}}}},
});
export const HARD_RULE_OPS=Object.freeze(Object.keys(OP_TABLE));
function normalizeRule(rule){
  if(!plain(rule)||!str(rule.requirementId,120)||!Array.isArray(rule.path)||rule.path.length>100||rule.path.some(x=>!(str(x,200)||Number.isInteger(x)&&x>=0))||!HARD_RULE_OPS.includes(rule.op))invalid();
  const entry=OP_TABLE[rule.op],args=entry.args;if(!exact(rule,["requirementId","path","op",...args])||!entry.validateArgs(rule))invalid();
  if(!json(rule))invalid();return structuredClone(rule);
}
function normalize(input,withHash=false){
  try{canonicalizeJson(input)}catch{invalid()}
  const keys=withHash?["kind","schemaVersion","specId","hardGate","councilReview","requirementSpecHash"]:["specId","hardGate","councilReview"];
  if(!exact(input,keys)||withHash&&(input.kind!=="ShadowCandidateRequirementSpec"||input.schemaVersion!=="1.0.0"||!HASH.test(input.requirementSpecHash))||!str(input.specId,200)||!Array.isArray(input.hardGate)||input.hardGate.length<1||input.hardGate.length>200||!Array.isArray(input.councilReview)||input.councilReview.length>50)invalid();
  const hardGate=input.hardGate.map(normalizeRule),councilReview=input.councilReview.map(x=>{if(!exact(x,["requirementId","criterion"])||!str(x.requirementId,120)||!str(x.criterion,600))invalid();return structuredClone(x)});
  const ids=[...hardGate,...councilReview].map(x=>x.requirementId);if(new Set(ids).size!==ids.length)invalid();
  const body={kind:"ShadowCandidateRequirementSpec",schemaVersion:"1.0.0",specId:input.specId,hardGate,councilReview};
  if(withHash&&computeRequirementSpecHash(body)!==input.requirementSpecHash)invalid();return body;
}
export function computeRequirementSpecHash(specWithoutHash){return `sha256:${createHash("sha256").update(Buffer.from(CANDIDATE_REQUIREMENT_SPEC_DOMAIN,"utf8")).update(Buffer.from(canonicalizeJson(specWithoutHash),"utf8")).digest("hex")}`}
export function buildCandidateRequirementSpec(input){const body=normalize(input);return{...body,requirementSpecHash:computeRequirementSpecHash(body)}}
const pathText=path=>`payload${path.map(x=>typeof x==="number"?`[${x}]`:/^[A-Za-z_$][\w$]*$/.test(x)?`.${x}`:`[${JSON.stringify(x)}]`).join("")}`;
export function renderHardRuleInstruction(rule){normalizeRule(rule);const args=OP_TABLE[rule.op].args.map(k=>`${k}=${canonicalizeJson(rule[k])}`).join(" ");return`[${rule.requirementId}] ${pathText(rule.path)} ${rule.op}${args?` ${args}`:""}`}
function budgetError(details){const e=new Error("REQUIREMENT_SPEC_PROMPT_BUDGET_EXCEEDED");e.details=details;throw e}
function packSection(label,lines,spec,maxItemLength){
  if(!lines.length)return[];let total=1,parts;
  for(let attempt=0;attempt<10;attempt++){
    parts=[];let current=[];
    for(const line of lines){const header=n=>`${label} (part ${n}/${total}) — spec ${spec.specId} ${spec.requirementSpecHash}`;const candidate=[header(parts.length+1),...current,line].join("\n");if(candidate.length<=maxItemLength){current.push(line);continue}if(!current.length)budgetError({requirementId:/^\[([^\]]+)/.exec(line)?.[1],maxItemLength});parts.push(current);current=[line]}
    if(current.length)parts.push(current);if(parts.length===total)return parts.map((part,i)=>[`${label} (part ${i+1}/${total}) — spec ${spec.specId} ${spec.requirementSpecHash}`,...part].join("\n"));total=parts.length;
  }budgetError({requiredItems:total,maxItemLength});
}
export function renderCandidateRequirementEvidenceItems(spec,{maxItemLength=1000,maxItems=20,reservedItems=0}={}){
  normalize(spec,true);if(!Number.isInteger(maxItemLength)||maxItemLength<1||!Number.isInteger(maxItems)||maxItems<0||!Number.isInteger(reservedItems)||reservedItems<0)budgetError({maxItemLength});
  if(reservedItems>maxItems)budgetError({requiredItems:0,availableItems:maxItems-reservedItems,maxItemLength});
  const hard=packSection("SHADOW CANDIDATE HARD GATE",spec.hardGate.map(renderHardRuleInstruction),spec,maxItemLength);
  const review=packSection("SHADOW CANDIDATE COUNCIL REVIEW — assessed by Council voters; NOT machine-gated",spec.councilReview.map(x=>`[${x.requirementId}] criterion=${canonicalizeJson(x.criterion)}`),spec,maxItemLength);
  const items=[...hard,...review],availableItems=Math.max(0,maxItems-reservedItems);if(items.length>availableItems)budgetError({requiredItems:items.length,availableItems,maxItemLength});return items;
}
function resolve(root,path){let value=root;for(const key of path){if(value===null||typeof value!=="object")return{present:false};const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor||Object.hasOwn(descriptor,"get"))return{present:false};value=descriptor.value}return{present:true,value}}
export function validateCandidateAgainstRequirementSpec({spec,candidatePayload}){
  const body=normalize(spec,true);if(!plain(candidatePayload)){const failures=[{requirementId:"__payload__",errorCode:"PAYLOAD_NOT_OBJECT",path:[]}];return{ok:false,specHash:spec.requirementSpecHash,evaluatedRequirementIds:[],failedRequirementIds:["__payload__"],failures}}
  const failures=[];for(const rule of body.hardGate){const r=resolve(candidatePayload,rule.path),base={requirementId:rule.requirementId,path:structuredClone(rule.path)},failure=r.present?OP_TABLE[rule.op].evaluate(r.value,rule):{errorCode:"PATH_MISSING"};if(failure)failures.push({...base,errorCode:failure.errorCode,...failure.details})}
  return{ok:failures.length===0,specHash:spec.requirementSpecHash,evaluatedRequirementIds:body.hardGate.map(x=>x.requirementId),failedRequirementIds:failures.map(x=>x.requirementId),failures};
}
export function assertGateResultAccepted(input){try{const{spec,result}=input,fields=["ok","specHash","evaluatedRequirementIds","failedRequirementIds","failures"];if(!plain(result))return false;const descriptors=Object.fromEntries(fields.map(key=>[key,Object.getOwnPropertyDescriptor(result,key)]));if(fields.some(key=>!descriptors[key]||!Object.hasOwn(descriptors[key],"value")))return false;const body=normalize(spec,true),ok=descriptors.ok.value,specHash=descriptors.specHash.value,evaluatedRequirementIds=descriptors.evaluatedRequirementIds.value,failedRequirementIds=descriptors.failedRequirementIds.value,failures=descriptors.failures.value;if(ok!==true||specHash!==spec.requirementSpecHash||!Array.isArray(evaluatedRequirementIds)||!Array.isArray(failedRequirementIds)||!Array.isArray(failures)||failedRequirementIds.length||failures.length)return false;const expected=body.hardGate.map(x=>x.requirementId);return evaluatedRequirementIds.length===expected.length&&expected.every((id,i)=>evaluatedRequirementIds[i]===id)}catch{return false}}
