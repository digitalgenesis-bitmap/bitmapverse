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
add("negative_and_zero_integers", {"neg": -5, "zero": 0, "neg_zero_input": 0})
add("max_safe_integer", {"n": 9007199254740991})
add("min_safe_integer", {"n": -9007199254740991})
add("unicode_beyond_ascii_raw_utf8", {"s": "canonicalización — 中文 — ✅"})
add(
    "string_escapes",
    {
        "s": "quote\" backslash\\ tab\tnewline\ncarriage\rformfeed\fbackspace\b control"
    },
)
add("array_order_preserved_not_sorted", [5, 4, 3, 2, 1])
add(
    "realistic_shape_synthetic_ids_only",
    {
        "schema": "bitmapverse.resolution_result.v0.2",
        "district": 999999999,
        "district_name": "999999999.bitmap",
        "selected_position": {
            "block_height": 999999,
            "block_hash": "4" * 64,
            "transaction_id": "c" * 64,
            "transaction_index": 5,
            "inscription_index": 0,
        },
    },
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

doc = {
    "_note": "Vectores generados con scripts/b1-prep/jcs.py, verificados byte-identicos contra scripts/b1-prep/jcs.mjs. No contrastados contra los vectores oficiales de RFC 8785 (sin acceso a Internet en este entorno) - ver CANONICALIZATION.md, 'Alcance y honestidad de la verificacion'.",
    "vectors": vectors,
    "rejection_vectors": rejections,
}

out_path = os.path.join(
    os.path.dirname(__file__), "..", "..", "blind", "v0.2", "test-vectors", "canonicalization-vectors.json"
)
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(f"wrote {len(vectors)} vectors, {len(rejections)} rejection vectors to {out_path}")
