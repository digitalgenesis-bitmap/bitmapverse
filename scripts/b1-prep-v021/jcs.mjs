/**
 * "Perfil JCS restringido" v0.2.1 — a documented, honestly-scoped subset of
 * RFC 8785 (JSON Canonicalization Scheme). This is NOT a claim of full
 * RFC 8785 conformance; see "Diferencias frente a RFC 8785 completo" below
 * and blind/v0.2.1/CANONICALIZATION.md for the normative version of this
 * same list.
 *
 * Independent from scripts/b1-prep/jcs.mjs (v0.2's canonicalizer, frozen —
 * blind/v0.2/ is superseded but preserved unmodified, and its own test
 * suite re-verifies its vectors against that exact, unmodified file).
 * v0.2.1 fixes two real correctness gaps found in the v0.2 profile:
 *
 *   1. Key ordering was only ever exercised on ASCII keys, so it never
 *      proved the RFC 8785 rule (compare UTF-16 code UNIT sequences, not
 *      Unicode code points) actually holds outside the BMP. It matters:
 *      compare the BMP character U+FFFF against the astral character
 *      U+10000 ("𐀀"). By code point, U+FFFF < U+10000. By UTF-16 code
 *      unit sequence, U+10000 encodes as the surrogate pair
 *      [0xD800, 0xDC00], and 0xD800 < 0xFFFF — so U+10000 sorts FIRST
 *      under the RFC's actual rule, the opposite of naive code-point
 *      sorting. JavaScript strings are natively UTF-16, so JS's default
 *      `<` on strings has always been correct here without extra work —
 *      but this was never actually tested against such a pair before.
 *      See test-vectors/canonicalization-vectors.json,
 *      "utf16_vs_codepoint_key_order".
 *   2. -0 was silently normalized to "0" instead of rejected. v0.2.1
 *      rejects it explicitly instead — see serializeNumber below.
 *
 * Scope (unchanged from v0.2): object, array, string, boolean, null, and
 * integers within the ECMAScript safe integer range (±(2^53−1)). No
 * general ECMA-262 Number::toString for non-integers — none of
 * blind/v0.2.1's schemas admit one.
 *
 * Diferencias frente a RFC 8785 completo (documentadas, no ocultas):
 *   - No implementa Number::toString de ECMA-262 para números que no sean
 *     enteros seguros (rechazados en vez de serializados).
 *   - No fue contrastado contra los vectores de prueba oficiales de
 *     RFC 8785 ni contra una biblioteca de referencia externa — sin
 *     acceso a Internet en este entorno. Solo autoconsistencia JS/Python.
 */

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER; // 2^53 - 1
const MIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER;

export class JcsError extends TypeError {}

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

/**
 * Detects an unpaired ("isolated") UTF-16 surrogate code unit: a high
 * surrogate (0xD800-0xDBFF) not immediately followed by a low surrogate
 * (0xDC00-0xDFFF), or a low surrogate not immediately preceded by one.
 * Such sequences cannot be encoded as valid UTF-8 and are rejected rather
 * than silently mangled (e.g. into U+FFFD).
 */
export function hasIsolatedSurrogate(str) {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const isHigh = code >= 0xd800 && code <= 0xdbff;
    const isLow = code >= 0xdc00 && code <= 0xdfff;
    if (isHigh) {
      const next = str.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i++; // consume the paired low surrogate
    } else if (isLow) {
      return true; // an unpaired low surrogate reached without a preceding high
    }
  }
  return false;
}

function quoteString(value) {
  if (hasIsolatedSurrogate(value)) {
    throw new JcsError(
      `JCS restringido v0.2.1 rejects strings containing isolated UTF-16 surrogates: ${JSON.stringify(value)}`,
    );
  }
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

function serializeNumber(value) {
  if (Object.is(value, -0)) {
    throw new JcsError("JCS restringido v0.2.1 explicitly rejects -0 (no silent normalization to 0)");
  }
  if (!Number.isInteger(value) || !Number.isFinite(value)) {
    throw new JcsError(`JCS restringido v0.2.1 rejects non-integer numbers: ${value}`);
  }
  if (value > MAX_SAFE_INTEGER || value < MIN_SAFE_INTEGER) {
    throw new JcsError(`JCS restringido v0.2.1 rejects integers outside the safe interoperable range: ${value}`);
  }
  return String(value);
}

export function canonicalize(value) {
  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "string") return quoteString(value);
  if (typeof value === "number") return serializeNumber(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (isPlainObject(value)) {
    // JavaScript strings are UTF-16 internally; the default relational
    // comparison on strings compares UTF-16 code units in order, which is
    // exactly RFC 8785 §3.2.3's key-ordering rule. No manual UTF-16
    // re-encoding is needed here (contrast with jcs.py, where it is).
    const keys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return (
      "{" +
      keys.map((key) => `${quoteString(key)}:${canonicalize(value[key])}`).join(",") +
      "}"
    );
  }
  throw new JcsError(`JCS restringido v0.2.1 rejects unsupported value of type ${typeof value}`);
}

export function canonicalizeToBytes(value) {
  return Buffer.from(canonicalize(value), "utf8");
}
