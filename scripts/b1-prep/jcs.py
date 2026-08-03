"""RFC 8785 — JSON Canonicalization Scheme (JCS). Python twin of jcs.mjs.

Same scope and honesty caveats as jcs.mjs: covers object, array, string,
boolean, null, and integers within the ECMAScript safe integer range
(+/-(2^53-1)); rejects everything else instead of mishandling it; not
verified against RFC 8785's own test vectors or any reference library
(no Internet access in this environment) — only validated by
self-consistency against jcs.mjs, byte for byte, on every vector in
blind/v0.2/test-vectors/canonicalization-vectors.json.

Key ordering: RFC 8785 sorts object member names by UTF-16 code unit
sequence. Python's `sorted(str)` compares by Unicode code point, which
agrees with UTF-16 code-unit order for every character in the Basic
Multilingual Plane. Every key used anywhere in this project is ASCII, so
this equivalence is never actually tested outside the BMP — flagged, not
silently assumed to generalize.
"""

from __future__ import annotations

MAX_SAFE_INTEGER = 2**53 - 1
MIN_SAFE_INTEGER = -(2**53 - 1)

ESCAPES = {
    '"': '\\"',
    "\\": "\\\\",
    "\b": "\\b",
    "\t": "\\t",
    "\n": "\\n",
    "\f": "\\f",
    "\r": "\\r",
}


class JcsError(TypeError):
    pass


def _quote_string(value: str) -> str:
    out = ['"']
    for ch in value:
        code = ord(ch)
        if ch in ESCAPES:
            out.append(ESCAPES[ch])
        elif code < 0x20:
            out.append(f"\\u{code:04x}")
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


def _serialize_number(value) -> str:
    if isinstance(value, bool) or not isinstance(value, int):
        raise JcsError(f"JCS (scoped subset) rejects non-integer numbers: {value!r}")
    if value > MAX_SAFE_INTEGER or value < MIN_SAFE_INTEGER:
        raise JcsError(f"JCS (scoped subset) rejects integers outside the safe interoperable range: {value}")
    return str(value)


def canonicalize(value) -> str:
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return _quote_string(value)
    if isinstance(value, int):
        return _serialize_number(value)
    if isinstance(value, list):
        return "[" + ",".join(canonicalize(item) for item in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value.keys())
        parts = [f"{_quote_string(key)}:{canonicalize(value[key])}" for key in keys]
        return "{" + ",".join(parts) + "}"
    raise JcsError(f"JCS (scoped subset) rejects unsupported value of type {type(value)}")


def canonicalize_to_bytes(value) -> bytes:
    return canonicalize(value).encode("utf-8")
