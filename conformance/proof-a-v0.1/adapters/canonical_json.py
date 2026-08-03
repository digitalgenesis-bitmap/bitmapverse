"""bitmapverse.canonical_json.v0.1

Python twin of canonical-json.mjs. Must produce byte-identical output for
any value that is valid input to both. See CANONICALIZATION.md for the
rule set; see canonical-json.mjs's docstring for why this is not called
"JCS" despite being inspired by RFC 8785's key-ordering discipline.
"""

from __future__ import annotations

ESCAPES = {
    '"': '\\"',
    "\\": "\\\\",
    "\b": "\\b",
    "\t": "\\t",
    "\n": "\\n",
    "\f": "\\f",
    "\r": "\\r",
}


class CanonicalizationError(TypeError):
    pass


def _encode_string(value: str) -> str:
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


def _encode_number(value) -> str:
    if isinstance(value, bool) or not isinstance(value, int):
        raise CanonicalizationError(
            f"bitmapverse.canonical_json.v0.1 rejects non-integer numbers: {value!r}"
        )
    return str(value)


def canonicalize(value) -> str:
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return _encode_string(value)
    if isinstance(value, int):
        return _encode_number(value)
    if isinstance(value, list):
        return "[" + ",".join(canonicalize(item) for item in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value.keys())
        parts = [f"{_encode_string(key)}:{canonicalize(value[key])}" for key in keys]
        return "{" + ",".join(parts) + "}"
    raise CanonicalizationError(
        f"bitmapverse.canonical_json.v0.1 rejects unsupported value of type {type(value)}"
    )


def canonicalize_to_bytes(value) -> bytes:
    return canonicalize(value).encode("utf-8")
