// Canonical JSON serializer for a restricted JSON value domain: null, boolean, finite number,
// string, array (order-preserving), and plain object (recursively key-sorted). Pure function, no
// filesystem/process/Git/network access.
//
// RFC 8785 (JSON Canonicalization Scheme) compatibility, stated precisely rather than claimed in
// full: for the supported value domain, this implementation sorts object keys by UTF-16 code unit
// (JavaScript's native `Array#sort` on strings), which matches RFC 8785's required UTF-16
// code-unit ordering, and serializes finite numbers via `Number#toString`'s shortest round-trip
// form (through `JSON.stringify`), which matches RFC 8785's ECMAScript-number-to-string
// requirement. It does NOT perform RFC 8785's separate optional recommendation of Unicode NFC
// normalization on strings — this implementation serializes string content byte-for-byte as given,
// with ordinary JSON string escaping only. Do not treat two Unicode-equivalent-but-differently-
// normalized strings as canonically identical here; they are not.

export function canonicalizeJson(value) {
  return serialize(value, new Set());
}

function isPlainObject(value) {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function serialize(value, seen) {
  if (value === null) return "null";

  const t = typeof value;

  if (t === "boolean") return value ? "true" : "false";

  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("canonicalizeJson: non-finite numbers (NaN/Infinity/-Infinity) are not supported");
    }
    return JSON.stringify(value);
  }

  if (t === "string") return JSON.stringify(value);

  if (t === "undefined") throw new TypeError("canonicalizeJson: undefined is not supported");
  if (t === "function") throw new TypeError("canonicalizeJson: functions are not supported");
  if (t === "symbol") throw new TypeError("canonicalizeJson: symbols are not supported");
  if (t === "bigint") throw new TypeError("canonicalizeJson: BigInt is not supported");

  if (t !== "object") {
    throw new TypeError(`canonicalizeJson: unsupported value type "${t}"`);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError("canonicalizeJson: cyclic structure detected");
    for (let i = 0; i < value.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(value, i)) {
        throw new TypeError("canonicalizeJson: sparse arrays are not supported");
      }
    }
    seen.add(value);
    const items = value.map((item) => serialize(item, seen));
    seen.delete(value);
    return `[${items.join(",")}]`;
  }

  if (!isPlainObject(value)) {
    throw new TypeError("canonicalizeJson: only plain objects (or Object.create(null)) are supported");
  }

  if (seen.has(value)) throw new TypeError("canonicalizeJson: cyclic structure detected");
  seen.add(value);
  const keys = Object.keys(value).sort();
  const parts = keys.map((key) => `${JSON.stringify(key)}:${serialize(value[key], seen)}`);
  seen.delete(value);
  return `{${parts.join(",")}}`;
}
