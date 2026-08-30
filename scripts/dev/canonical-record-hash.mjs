import { createHash } from "node:crypto";

import { canonicalizeJson } from "./canonical-json.mjs";

export const TASK_RECORD_HASH_DOMAIN = "MIHVER:TaskRecord:v1\0";

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function computeTaskRecordHash(value) {
  const domainBytes = Buffer.from(TASK_RECORD_HASH_DOMAIN, "utf8");
  const canonicalBytes = Buffer.from(canonicalizeJson(value), "utf8");
  return sha256(Buffer.concat([domainBytes, canonicalBytes]));
}

export function valueWithoutHash(value, hashField) {
  const copy = { ...value };
  delete copy[hashField];
  return copy;
}
