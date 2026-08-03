/**
 * bitmapverse.canonical_json.v0.1
 *
 * A hand-rolled canonical JSON encoder. It is *inspired by* RFC 8785 (JCS) —
 * specifically its key-ordering discipline — but it is not a certified JCS
 * implementation: JCS also mandates ECMAScript Number::ToString serialization
 * for floating-point values, which this codec deliberately never needs to
 * reproduce because every numeric field in scope here is a non-negative
 * integer. Calling this "JCS" would overclaim; see CANONICALIZATION.md.
 *
 * Rules (must match canonical_json.py byte-for-byte):
 *   1. UTF-8 output.
 *   2. Object keys sorted ascending by Unicode code point.
 *   3. No insignificant whitespace.
 *   4. Array order preserved as given.
 *   5. Numbers: integers only, bare decimal digits, optional leading "-",
 *      no leading zeros other than a lone "0". Floats/NaN/Infinity rejected.
 *   6. Strings: JSON-escaped with the minimal required escapes; characters
 *      above U+007F are emitted as raw UTF-8 bytes, never \\u-escaped.
 *   7. true / false / null as literals.
 *   8. Any other JS value (undefined, function, symbol, bigint, NaN) is a
 *      hard error — no admitted-value fallback.
 */

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function encodeString(value) {
  let out = '"';
  for (const ch of value) {
    const code = ch.codePointAt(0);
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (code === 0x08) out += "\\b";
    else if (code === 0x09) out += "\\t";
    else if (code === 0x0a) out += "\\n";
    else if (code === 0x0c) out += "\\f";
    else if (code === 0x0d) out += "\\r";
    else if (code < 0x20) out += "\\u" + code.toString(16).padStart(4, "0");
    else out += ch;
  }
  return out + '"';
}

function encodeNumber(value) {
  if (!Number.isInteger(value) || !Number.isFinite(value)) {
    throw new TypeError(
      `bitmapverse.canonical_json.v0.1 rejects non-integer numbers: ${value}`,
    );
  }
  if (Object.is(value, -0)) return "0";
  return String(value);
}

export function canonicalize(value) {
  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "string") return encodeString(value);
  if (typeof value === "number") return encodeNumber(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return (
      "{" +
      keys
        .map((key) => `${encodeString(key)}:${canonicalize(value[key])}`)
        .join(",") +
      "}"
    );
  }
  throw new TypeError(
    `bitmapverse.canonical_json.v0.1 rejects unsupported value of type ${typeof value}`,
  );
}

export function canonicalizeToBytes(value) {
  return Buffer.from(canonicalize(value), "utf8");
}
