"""'Perfil JCS restringido' v0.2.1 - Python twin of jcs.mjs (v0.2.1 profile).

Independent from scripts/b1-prep/jcs.py (v0.2's canonicalizer, left
untouched since blind/v0.2/ is superseded but preserved unmodified).

Unlike JavaScript, Python's `str` stores Unicode CODE POINTS, not UTF-16
code units, so `sorted(str)` compares by code point -- which disagrees
with RFC 8785's UTF-16-code-unit key ordering for any pair of keys where
one contains a character above the Basic Multilingual Plane (an "astral"
character, code point > U+FFFF) and the other contains a BMP character in
0xE000-0xFFFF. Example: comparing "\\uffff" against "\U00010000" ("an
astral character): by code point, 0xFFFF < 0x10000. By UTF-16 code unit
sequence, U+10000 encodes as the surrogate pair [0xD800, 0xDC00], and
0xD800 < 0xFFFF, so the astral character sorts FIRST under RFC 8785's
actual rule -- the opposite of naive code-point sorting. This module
fixes that by explicitly converting each key to its UTF-16 code unit
sequence before comparing (see _utf16_code_units), rather than relying on
Python's default string comparison.

Scope, honesty caveats, and rejection rules (isolated surrogates, -0,
non-integers, out-of-range integers): see jcs.mjs's module docstring --
identical here.
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


def _utf16_code_units(s: str) -> tuple:
    """Encodes a Python str (sequence of code points) as the sequence of
    UTF-16 code units it would occupy -- surrogate pairs for anything
    above the BMP -- so it can be compared the way RFC 8785 requires.
    """
    units = []
    for ch in s:
        cp = ord(ch)
        if cp > 0xFFFF:
            cp -= 0x10000
            units.append(0xD800 + (cp >> 10))
            units.append(0xDC00 + (cp & 0x3FF))
        else:
            units.append(cp)
    return tuple(units)


def has_isolated_surrogate(s: str) -> bool:
    """A well-formed Python str should never contain a raw surrogate code
    point (0xD800-0xDFFF) as a scalar value on its own -- Python already
    decodes valid UTF-16/UTF-8 surrogate pairs into single astral code
    points when constructing str. Any surrogate code point present is
    therefore inherently isolated/ill-formed, unlike in JS where surrogate
    pairs are a normal, valid internal representation to check for pairing.
    """
    return any(0xD800 <= ord(ch) <= 0xDFFF for ch in s)


def _quote_string(value: str) -> str:
    if has_isolated_surrogate(value):
        raise JcsError(
            f"JCS restringido v0.2.1 rejects strings containing isolated UTF-16 surrogates: {value!r}"
        )
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
        raise JcsError(f"JCS restringido v0.2.1 rejects non-integer numbers: {value!r}")
    # Python ints have no distinct -0 (unlike IEEE-754 doubles / JS
    # numbers), so there is nothing to special-case here -- documented in
    # jcs.mjs and CANONICALIZATION.md, not silently assumed.
    if value > MAX_SAFE_INTEGER or value < MIN_SAFE_INTEGER:
        raise JcsError(f"JCS restringido v0.2.1 rejects integers outside the safe interoperable range: {value}")
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
        keys = sorted(value.keys(), key=_utf16_code_units)
        parts = [f"{_quote_string(key)}:{canonicalize(value[key])}" for key in keys]
        return "{" + ",".join(parts) + "}"
    raise JcsError(f"JCS restringido v0.2.1 rejects unsupported value of type {type(value)}")


def canonicalize_to_bytes(value) -> bytes:
    return canonicalize(value).encode("utf-8")
