import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from bitmap_discovery_opi_v1 import index_blocks_in_order

BASE = os.path.join(os.path.dirname(__file__), "..", "..", "blind", "v0.2.2", "test-vectors")

TEXT_PLAIN_HEX = "746578742f706c61696e"
APPLICATION_JSON_HEX = "6170706c69636174696f6e2f6a736f6e"


def hexof(s: str) -> str:
    return s.encode("utf-8").hex()


# Entirely synthetic district (1234567 — distinct from every other
# synthetic/real number used elsewhere in this project) and four
# candidates in the SAME block, deliberately out of inscription_number
# order in the input, to demonstrate every filter and the ordering rule
# in one vector. Only one candidate should survive as the foundational
# inscription.
block_height = 2000000
candidates_block_2000000 = [
    {
        "inscription_id": "e" * 64 + "i0",
        "inscription_number": 40,  # arrives... but is_json, so rejected regardless of order
        "content_hex": hexof("1234567.bitmap"),
        "is_json": True,
        "content_type_hex": APPLICATION_JSON_HEX,
        "block_height": block_height,
        "_rejected_reason": "is_json is true",
    },
    {
        "inscription_id": "d" * 64 + "i0",
        "inscription_number": 30,
        "content_hex": hexof("1234567.bitmap"),
        "is_json": False,
        "content_type_hex": APPLICATION_JSON_HEX,  # wrong content type
        "block_height": block_height,
        "_rejected_reason": "content_type_hex does not start with the text/plain hex prefix",
    },
    {
        "inscription_id": "c" * 64 + "i0",
        "inscription_number": 20,
        "content_hex": hexof("1234567.bitmap"),
        "is_json": False,
        "content_type_hex": TEXT_PLAIN_HEX,
        "block_height": block_height,
        "_rejected_reason": None,  # a genuinely valid, later candidate — should lose to inscription_number 10
    },
    {
        "inscription_id": "a" * 64 + "i0",
        "inscription_number": 10,  # lowest inscription_number among the valid candidates
        "content_hex": hexof("1234567.bitmap"),
        "is_json": False,
        "content_type_hex": TEXT_PLAIN_HEX,
        "block_height": block_height,
        "_rejected_reason": None,  # winner
    },
]

# A fifth candidate, in an EARLIER block whose height is itself less than
# the bitmap_number being claimed, demonstrates the block-existence check
# independently of the is_json/content-type filters: District 1234567
# cannot be claimed at block_height 1000000, because block 1234567 did
# not exist yet at that point in the chain.
early_block_height = 1000000
candidates_block_1000000 = [
    {
        "inscription_id": "b" * 64 + "i0",
        "inscription_number": 5,
        "content_hex": hexof("1234567.bitmap"),  # bitmap_number > this block's height
        "is_json": False,
        "content_type_hex": TEXT_PLAIN_HEX,
        "block_height": early_block_height,
        "_rejected_reason": f"bitmap_number (1234567) > block_height ({early_block_height}): block does not exist yet",
    }
]

input_doc = {
    "_synthetic": True,
    "_note": "Caso completamente inventado (District 1234567), sin relación con 507999.bitmap ni 7187.bitmap. Demuestra, en un solo vector: rechazo por is_json, rechazo por content_type_hex incorrecto, rechazo por bloque inexistente, y que la primera reclamación válida gana por inscription_number ascendente — no por orden de llegada ni por posición de transacción.",
    "district": 1234567,
    "district_name": "1234567.bitmap",
    "blocks_ascending": [
        {"block_height": early_block_height, "candidates": candidates_block_1000000},
        {"block_height": block_height, "candidates": candidates_block_2000000},
    ],
}

with open(os.path.join(BASE, "synthetic-opi-discovery.input.json"), "w", encoding="utf-8") as f:
    json.dump(input_doc, f, ensure_ascii=False, indent=2)
    f.write("\n")

blocks_ascending = [
    [
        {
            "inscriptionId": c["inscription_id"],
            "inscriptionNumber": c["inscription_number"],
            "contentHex": c["content_hex"],
            "isJson": c["is_json"],
            "contentTypeHex": c["content_type_hex"],
            "blockHeight": c["block_height"],
        }
        for c in block["candidates"]
    ]
    for block in input_doc["blocks_ascending"]
]

# Re-key for the python reference implementation (snake_case).
blocks_ascending_py = [
    [
        {
            "inscription_id": c["inscription_id"],
            "inscription_number": c["inscription_number"],
            "content_hex": c["content_hex"],
            "is_json": c["is_json"],
            "content_type_hex": c["content_type_hex"],
            "block_height": c["block_height"],
        }
        for c in block["candidates"]
    ]
    for block in input_doc["blocks_ascending"]
]

global_claims = index_blocks_in_order(blocks_ascending_py)
claim = global_claims.get(1234567)

expected = {
    "_synthetic": True,
    "_note": "Salida esperada, calculada con la implementación de referencia de bitmap_discovery_opi_v1 mantenida fuera de este paquete, a partir de synthetic-opi-discovery.input.json.",
    "winning_inscription_id": claim["inscription_id"] if claim else None,
    "winning_inscription_number": claim["inscription_number"] if claim else None,
    "rejected_candidates": [
        {"inscription_id": c["inscription_id"], "reason": c["_rejected_reason"]}
        for block in input_doc["blocks_ascending"]
        for c in block["candidates"]
        if c["_rejected_reason"] is not None
    ],
    "explanation": f"El ganador es inscription_number 10 (id empieza con 'a'), no el que aparece primero en el array de entrada (is_json, inscription_number 40) ni el segundo candidato válido (inscription_number 20). El candidato del bloque {early_block_height} se rechaza porque 1234567 > {early_block_height} (el District todavía no existía como bloque en ese momento).",
}

with open(os.path.join(BASE, "synthetic-opi-discovery.expected.json"), "w", encoding="utf-8") as f:
    json.dump(expected, f, ensure_ascii=False, indent=2)
    f.write("\n")

print("winning_inscription_id:", expected["winning_inscription_id"])
print("winning_inscription_number:", expected["winning_inscription_number"])
print("rejected count:", len(expected["rejected_candidates"]))
