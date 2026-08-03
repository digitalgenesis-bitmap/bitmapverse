import json
import hashlib
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from jcs import canonicalize, JcsError

vectors = []


def add(name, value):
    canonical = canonicalize(value)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    vectors.append(
        {
            "name": name,
            "input": value,
            "canonical_bytes_utf8": canonical,
            "sha256": digest,
        }
    )


add("empty_object", {})
add("empty_array", [])
add("null_true_false", {"a": None, "b": True, "c": False})
add("key_order_is_sorted_ascii", {"zebra": 1, "apple": 2, "mango": 3})
add("nested_object_and_array", {"b": [3, 1, 2], "a": {"z": 1, "y": 2}})
add("negative_integer_and_zero", {"neg": -5, "zero": 0})
add("max_safe_integer", {"n": 9007199254740991})
add("min_safe_integer", {"n": -9007199254740991})
add("array_order_preserved_not_sorted", [5, 4, 3, 2, 1])
add(
    "string_escapes",
    {"s": "quote\" backslash\\ tab\tnewline\ncarriage\rformfeed\fbackspace\b control"},
)

# --- New in v0.2.1: Unicode coverage within and beyond the BMP ---
add("bmp_cjk_characters", {"s": "中文測試"})
add("bmp_combining_characters", {"s": "é"})  # "e" + combining acute accent
add("astral_emoji", {"s": "😀🚀✅"})
add("astral_mixed_with_bmp", {"greeting": "héllo 😀 中文"})

# The vector that actually proves the UTF-16-vs-codepoint key-order fix
# matters: U+FFFF (BMP) vs U+10000 (astral, first character above BMP).
# By code point, 0xFFFF < 0x10000 (U+FFFF would sort first under naive
# codepoint ordering). By UTF-16 code unit sequence (the RFC 8785 rule),
# U+10000 encodes as the surrogate pair [0xD800, 0xDC00], and
# 0xD800 < 0xFFFF, so U+10000 sorts FIRST under the correct rule.
add(
    "utf16_vs_codepoint_key_order",
    {"￿": "bmp_boundary_char", "\U00010000": "first_astral_char"},
)
# A second, independent case for the same rule with different characters.
add(
    "utf16_vs_codepoint_key_order_2",
    {"": "bmp_private_use_start", "\U0001f600": "emoji"},
)

rejections = []


def add_rejection(name, value):
    try:
        canonicalize(value)
        rejections.append({"name": name, "input": value, "rejected": False, "error": None})
    except JcsError as e:
        rejections.append({"name": name, "input": value, "rejected": True, "error": str(e)})


add_rejection("float_not_admitted", {"x": 1.5})
add_rejection("integer_above_safe_range", {"x": 9007199254740992})
add_rejection("integer_below_safe_range", {"x": -9007199254740992})

# Isolated surrogates (lone 0xD800-0xDFFF code points) cannot be encoded
# as valid UTF-8, so they cannot be embedded directly in this JSON vector
# file's "input" field the way other rejection vectors are. Represented
# instead as a bare code-point hex value; each test harness reconstructs
# the actual string in-memory (String.fromCharCode / chr) before calling
# canonicalize(). This is itself a small demonstration of why the
# rejection rule exists: the value is not representable as ordinary JSON
# text at all.
surrogate_rejection_vectors = [
    {"name": "isolated_high_surrogate", "code_point_hex": "D800", "rejected": True},
    {"name": "isolated_low_surrogate", "code_point_hex": "DC00", "rejected": True},
]
for v in surrogate_rejection_vectors:
    ch = chr(int(v["code_point_hex"], 16))
    try:
        canonicalize({"x": ch})
        v["rejected_actual"] = False
    except JcsError as e:
        v["rejected_actual"] = True
        v["error"] = str(e)
    assert v["rejected_actual"] == v["rejected"], v["name"]

doc = {
    "_note": "Vectores generados con una implementacion de referencia del 'perfil JCS restringido' v0.2.1 mantenida fuera de este paquete, verificados byte-identicos entre sus gemelas JavaScript y Python. Incluye cobertura Unicode dentro y fuera del BMP, y un vector que demuestra por que el orden de claves por unidad de codigo UTF-16 difiere del orden por punto de codigo. No contrastados contra los vectores oficiales de RFC 8785 (sin acceso a Internet en este entorno) - ver CANONICALIZATION.md.",
    "vectors": vectors,
    "rejection_vectors": rejections,
    "surrogate_rejection_vectors": surrogate_rejection_vectors,
}

out_path = os.path.join(
    os.path.dirname(__file__), "..", "..", "blind", "v0.2.1", "test-vectors", "canonicalization-vectors.json"
)
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(f"wrote {len(vectors)} vectors, {len(rejections)} rejection vectors to {out_path}")
