/**
 * RFC 8785 — JSON Canonicalization Scheme (JCS).
 *
 * Scope and honesty note: this implements the subset of RFC 8785 relevant
 * to the types blind/v0.2's schemas actually admit — object, array,
 * string, boolean, null, and integers within the ECMAScript safe integer
 * range (±(2^53−1)). It does not implement the general ECMA-262
 * Number::toString algorithm for non-integer or out-of-range numbers,
 * because no v0.2 field is allowed to carry one (enforced by rejecting
 * them, not by silently mishandling them).
 *
 * Object member ordering follows RFC 8785 §3.2.3: compare member names as
 * sequences of UTF-16 code units. JavaScript's default string `<` already
 * does exactly this. Every key used anywhere in this project is ASCII, so
 * this is not exercised outside the Basic Multilingual Plane — see jcs.py
 * for the corresponding caveat on the Python side.
 *
 * Honesty about verification: with no Internet access in this environment,
 * this implementation could not be checked against RFC 8785's own
 * published test vectors, nor against a reference library (e.g. npm's
 * `canonicalize`). It was written carefully from the specification as
 * remembered, and validated here only by self-consistency — byte-identical
 * output between this file and jcs.py for every vector in
 * blind/v0.2/test-vectors/canonicalization-vectors.json. Do not present
 * this as externally-verified RFC 8785 conformance; present it as a
 * careful, self-consistent implementation of the subset in scope.
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

function quoteString(value) {
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
  if (!Number.isInteger(value) || !Number.isFinite(value)) {
    throw new JcsError(`JCS (scoped subset) rejects non-integer numbers: ${value}`);
  }
  if (value > MAX_SAFE_INTEGER || value < MIN_SAFE_INTEGER) {
    throw new JcsError(
      `JCS (scoped subset) rejects integers outside the safe interoperable range: ${value}`,
    );
  }
  if (Object.is(value, -0)) return "0";
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
    const keys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return (
      "{" +
      keys.map((key) => `${quoteString(key)}:${canonicalize(value[key])}`).join(",") +
      "}"
    );
  }
  throw new JcsError(`JCS (scoped subset) rejects unsupported value of type ${typeof value}`);
}

export function canonicalizeToBytes(value) {
  return Buffer.from(canonicalize(value), "utf8");
}
