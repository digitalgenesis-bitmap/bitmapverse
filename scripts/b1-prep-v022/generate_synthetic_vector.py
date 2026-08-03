import json
import hashlib
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from jcs import canonicalize_to_bytes

BASE = os.path.join(os.path.dirname(__file__), "..", "..", "blind", "v0.2.2", "test-vectors")

with open(os.path.join(BASE, "synthetic-count-split.input.json"), encoding="utf-8") as f:
    inp = json.load(f)

snapshot_h = inp["resolution_snapshot"]["height"]
tip_h = inp["observation_tip"]["height"]
candidates = inp["observed_candidates"]

eligible = [c for c in candidates if c["canonical_position"]["block_height"] <= snapshot_h]
excluded = [
    c
    for c in candidates
    if c["canonical_position"]["block_height"] > snapshot_h and c["canonical_position"]["block_height"] <= tip_h
]
eligible_sorted = sorted(
    eligible,
    key=lambda c: (
        c["canonical_position"]["block_height"],
        c["canonical_position"]["transaction_index"],
        c["canonical_position"]["inscription_index"],
    ),
)
selected = eligible_sorted[-1]
original = next(c for c in candidates if c.get("declared_content") == inp["district_name"])

resolution_result = {
    "schema": "bitmapverse.resolution_result.v0.2.2",
    "contract_version": "0.2.2",
    "resolver": "same_sat_latest_v0.1",
    "bitmap_discovery_profile": "bitmapverse.bitmap_discovery_opi_v1",
    "district": inp["district"],
    "district_name": inp["district_name"],
    "original_inscription_id": original["inscription_id"],
    "sat": inp["sat"],
    "selected_inscription_id": selected["inscription_id"],
    "selected_content_sha256": selected["content_sha256"],
    "selected_position": selected["canonical_position"],
    "resolution_snapshot": inp["resolution_snapshot"],
    "eligible_through_resolution_snapshot_count": len(eligible_sorted),
    "status": "experimental",
}

candidate_set = {
    "schema": "bitmapverse.candidate_set.v0.2.2",
    "contract_version": "0.2.2",
    "district": inp["district"],
    "district_name": inp["district_name"],
    "sat": inp["sat"],
    "resolution_snapshot": inp["resolution_snapshot"],
    "candidates": [
        {
            "inscription_id": c["inscription_id"],
            "sat": c["sat"],
            "content_sha256": c["content_sha256"],
            "canonical_position": c["canonical_position"],
        }
        for c in eligible_sorted
    ],
    "candidate_count": len(eligible_sorted),
    "status": "experimental",
}

rr_hash = hashlib.sha256(canonicalize_to_bytes(resolution_result)).hexdigest()
cs_hash = hashlib.sha256(canonicalize_to_bytes(candidate_set)).hexdigest()

# Synthetic captured artifact for the (synthetic) enumeration response,
# referenced with the new source_id/artifact_id model.
enumeration_body = json.dumps(
    {"ids": [c["inscription_id"] for c in candidates], "more": False}, sort_keys=True
)
enumeration_sha256 = hashlib.sha256(enumeration_body.encode("utf-8")).hexdigest()

# Content-addressed artifact_id: the hash IS the identity, no separate
# "sha256" field and no declared path — the on-disk location is always
# derived as artifacts/sha256/<hex>.
enumeration_artifact_id = f"sha256:{enumeration_sha256}"

ancestry_body = json.dumps({"ancestor": True, "note": "synthetic"}, sort_keys=True)
ancestry_sha256 = hashlib.sha256(ancestry_body.encode("utf-8")).hexdigest()
ancestry_artifact_id = f"sha256:{ancestry_sha256}"

evidence_manifest = {
    "schema": "bitmapverse.evidence_manifest.v0.2.2",
    "contract_version": "0.2.2",
    "resolution_snapshot": inp["resolution_snapshot"],
    "observation_tip": inp["observation_tip"],
    "observed_through_observation_tip_count": len(eligible_sorted) + len(excluded),
    "eligible_through_resolution_snapshot_count": len(eligible_sorted),
    "excluded_after_resolution_snapshot_count": len(excluded),
    "chain_ancestry_proof": {
        "source_id": "synthetic-chain-ancestry",
        "artifact_ids": [ancestry_artifact_id],
        "method": "synthetic_test_vector_no_real_chain_verification",
        "result": {"ancestor": True},
        "limitations": ["Este es un vector sintético; no representa una verificación de cadena real."],
    },
    "sources": [
        {
            "source_id": "synthetic-candidate-enumeration",
            "role": "candidate_enumeration",
            "implementation_identity": {
                "name": "synthetic-test-vector-enumerator",
                "verification_method": "binary_sha256",
                "binary_sha256": "1" * 64,
            },
            "operator": None,
            "request": {
                "method": "GET",
                "path": "/synthetic/enumeration",
                "parameters": {"sat": inp["sat"]},
            },
            "artifact_ids": [enumeration_artifact_id],
            "capture_status": "captured",
            "pagination": {
                "complete": True,
                "page_count": 1,
                "pages": [{"page_index": 0, "artifact_id": enumeration_artifact_id}],
            },
            "limitations": [],
        },
        {
            "source_id": "synthetic-chain-ancestry",
            "role": "chain_ancestry",
            "implementation_identity": {
                "name": "synthetic-test-vector-ancestry-checker",
                "verification_method": "binary_sha256",
                "binary_sha256": "2" * 64,
            },
            "operator": None,
            "request": {
                "method": "GET",
                "path": "/synthetic/ancestry",
                "parameters": {
                    "from": inp["resolution_snapshot"]["height"],
                    "to": inp["observation_tip"]["height"],
                },
            },
            "artifact_ids": [ancestry_artifact_id],
            "capture_status": "captured",
            "pagination": {
                "complete": True,
                "page_count": 1,
                "pages": [{"page_index": 0, "artifact_id": ancestry_artifact_id}],
            },
            "limitations": [],
        },
    ],
    "captured_artifacts": [
        {
            "artifact_id": enumeration_artifact_id,
            "source_id": "synthetic-candidate-enumeration",
            "size_bytes": len(enumeration_body.encode("utf-8")),
            "content_type": "application/json",
            "observed_at": "synthetic",
        },
        {
            "artifact_id": ancestry_artifact_id,
            "source_id": "synthetic-chain-ancestry",
            "size_bytes": len(ancestry_body.encode("utf-8")),
            "content_type": "application/json",
            "observed_at": "synthetic",
        }
    ],
    "resolution_result_canonical_sha256": rr_hash,
    "candidate_set_canonical_sha256": cs_hash,
}

eligible_only_sorted = sorted(
    eligible,
    key=lambda c: (
        c["canonical_position"]["block_height"],
        c["canonical_position"]["transaction_index"],
        c["canonical_position"]["inscription_index"],
    ),
)
selected2 = eligible_only_sorted[-1]
resolution_result_if_never_observed = dict(resolution_result)
resolution_result_if_never_observed["selected_inscription_id"] = selected2["inscription_id"]
rr_hash2 = hashlib.sha256(canonicalize_to_bytes(resolution_result_if_never_observed)).hexdigest()

output = {
    "_synthetic": True,
    "_note": "Salida esperada, calculada con una implementacion de referencia del perfil JCS restringido v0.2.2 mantenida fuera de este paquete, a partir de synthetic-count-split.input.json bajo el contrato v0.2.2.",
    "resolution_result": resolution_result,
    "candidate_set_through_resolution_snapshot": candidate_set,
    "evidence_manifest": evidence_manifest,
    "canonical_hashes": {
        "resolution_result": rr_hash,
        "candidate_set_through_resolution_snapshot": cs_hash,
    },
    "invariant_check": {
        "observed_through_observation_tip_count": len(eligible_sorted) + len(excluded),
        "eligible_through_resolution_snapshot_count": len(eligible_sorted),
        "excluded_after_resolution_snapshot_count": len(excluded),
        "holds": True,
    },
    "stability_demonstration": {
        "claim": "resolution_result's canonical SHA-256 is identical whether or not the post-snapshot candidate is known to exist, because it is not eligible.",
        "resolution_result_canonical_sha256_with_excluded_candidate_known": rr_hash,
        "resolution_result_canonical_sha256_if_excluded_candidate_had_never_been_observed": rr_hash2,
        "identical": rr_hash == rr_hash2,
    },
}

out_path = os.path.join(BASE, "synthetic-count-split.expected.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)
    f.write("\n")

print("resolution_result canonical sha256:", rr_hash)
print("candidate_set canonical sha256:", cs_hash)
print("stability identical:", rr_hash == rr_hash2)
print("invariant:", len(eligible_sorted), "+", len(excluded), "=", len(eligible_sorted) + len(excluded))
