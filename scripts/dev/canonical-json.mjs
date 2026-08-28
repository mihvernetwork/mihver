// Canonical JSON serializer for a restricted JSON value domain: null, boolean, finite number,
// string, array (order-preserving), and plain object (recursively key-sorted). Pure function, no
// filesystem/process/Git/network access.
//
// RFC 8785 (JSON Canonicalization Scheme, "JCS") compatibility, stated precisely: for the
// supported value domain, this implementation sorts object keys by UTF-16 code unit (JavaScript's
// native `Array#sort` on strings), which matches JCS's required UTF-16 code-unit ordering, and
// serializes finite numbers via `Number#toString`'s shortest round-trip form (through
// `JSON.stringify`), which matches JCS's ECMAScript-number-to-string requirement. JCS itself does
// NOT normalize Unicode (there is no NFC/NFD/NFKC/NFKD step in RFC 8785 at all) -- it instead
// requires valid Unicode input and preserves valid strings exactly as supplied, which is exactly
// what this implementation does: string content (and object keys) is serialized byte-for-byte as
// given, with ordinary JSON string escaping only, no normalization performed or implied. "Valid
// Unicode input" is enforced here by rejecting any string or object-property-name containing a
// lone (unpaired) UTF-16 surrogate code unit -- see `hasLoneSurrogate` below -- since a lone
// surrogate cannot be re-encoded as well-formed UTF-8/UTF-16 text and JCS's own well-formedness
// requirement excludes it. Two Unicode-equivalent-but-differently-normalized valid strings are
// never treated as canonically identical here (no normalization is performed); they remain
// distinct. A non-enumerable own property (which Object.keys()/for-in never see) is rejected
// rather than silently omitted -- see assertNoHiddenNonEnumerableProps below -- for the same
// "never silently discard data outside the declared domain" reason own symbol-keyed properties and
// accessor properties are also rejected rather than ignored/evaluated.

export function canonicalizeJson(value) {
  return serialize(value, new Set());
}

function isPlainObject(value) {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// True if `str` contains a UTF-16 surrogate code unit not part of a valid high+low surrogate
// pair -- i.e. text that cannot be re-encoded as well-formed UTF-8/UTF-16. JCS requires valid
// Unicode input; this is the well-formedness check that enforces that requirement.
function hasLoneSurrogate(str) {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = str.charCodeAt(i + 1);
      if (Number.isNaN(next) || next < 0xdc00 || next > 0xdfff) return true;
      i += 1; // valid pair consumed
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true; // low surrogate not preceded by a consumed high surrogate
    }
  }
  return false;
}

function assertNoSymbolKeys(value) {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError("canonicalizeJson: own symbol-keyed properties are not supported");
  }
}

// A non-enumerable own property (e.g. via Object.defineProperty(obj, "k", {enumerable:false, ...}))
// would otherwise be silently invisible to Object.keys()/for-in and simply omitted from the
// canonical output -- exactly the "silently discard data outside the declared domain" failure mode
// this serializer must not have. `excludeNames` lets the array branch ignore "length", which is
// always a legitimate non-enumerable own property of every array and never hidden data.
function assertNoHiddenNonEnumerableProps(value, excludeNames) {
  const allNames = Object.getOwnPropertyNames(value).filter((name) => !excludeNames.includes(name));
  const enumerableNames = Object.keys(value);
  if (allNames.length !== enumerableNames.length) {
    const enumerableSet = new Set(enumerableNames);
    const hidden = allNames.filter((name) => !enumerableSet.has(name));
    throw new TypeError(
      `canonicalizeJson: non-enumerable own propert${hidden.length === 1 ? "y" : "ies"} not supported: ${hidden.join(", ")}`
    );
  }
}

function assertNotAccessor(value, key) {
  const desc = Object.getOwnPropertyDescriptor(value, key);
  if (desc && (desc.get || desc.set)) {
    throw new TypeError(`canonicalizeJson: accessor property "${String(key)}" is not supported`);
  }
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

  if (t === "string") {
    if (hasLoneSurrogate(value)) {
      throw new TypeError("canonicalizeJson: string contains a lone (unpaired) UTF-16 surrogate -- not valid Unicode");
    }
    return JSON.stringify(value);
  }

  if (t === "undefined") throw new TypeError("canonicalizeJson: undefined is not supported");
  if (t === "function") throw new TypeError("canonicalizeJson: functions are not supported");
  if (t === "symbol") throw new TypeError("canonicalizeJson: symbols are not supported");
  if (t === "bigint") throw new TypeError("canonicalizeJson: BigInt is not supported");

  if (t !== "object") {
    throw new TypeError(`canonicalizeJson: unsupported value type "${t}"`);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError("canonicalizeJson: cyclic structure detected");
    assertNoSymbolKeys(value);
    assertNoHiddenNonEnumerableProps(value, ["length"]);
    for (let i = 0; i < value.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(value, i)) {
        throw new TypeError("canonicalizeJson: sparse arrays are not supported");
      }
    }
    const ownKeys = Object.keys(value);
    if (ownKeys.length !== value.length) {
      // An extra own enumerable string property beyond the dense index range (e.g. arr.foo = 1)
      // would otherwise be silently discarded by serializing only via numeric indices below.
      throw new TypeError("canonicalizeJson: array has an extraneous own property outside its index range");
    }
    for (const key of ownKeys) assertNotAccessor(value, key);
    seen.add(value);
    const items = value.map((item) => serialize(item, seen));
    seen.delete(value);
    return `[${items.join(",")}]`;
  }

  if (!isPlainObject(value)) {
    throw new TypeError("canonicalizeJson: only plain objects (or Object.create(null)) are supported");
  }

  if (seen.has(value)) throw new TypeError("canonicalizeJson: cyclic structure detected");
  assertNoSymbolKeys(value);
  assertNoHiddenNonEnumerableProps(value, []);
  const keys = Object.keys(value).sort();
  for (const key of keys) {
    if (hasLoneSurrogate(key)) {
      throw new TypeError(`canonicalizeJson: object key "${key}" contains a lone (unpaired) UTF-16 surrogate -- not valid Unicode`);
    }
    assertNotAccessor(value, key);
  }
  seen.add(value);
  const parts = keys.map((key) => `${JSON.stringify(key)}:${serialize(value[key], seen)}`);
  seen.delete(value);
  return `{${parts.join(",")}}`;
}
