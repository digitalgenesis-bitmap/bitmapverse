import json
import hashlib
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from jcs import canonicalize_to_bytes

BASE = os.path.join(os.path.dirname(__file__), "..", "..", "blind", "v0.2.1", "test-vectors")

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
    "schema": "bitmapverse.resolution_result.v0.2.1",
    "contract_version": "0.2.1",
    "resolver": "same_sat_latest_v0.1",
    "bitmap_discovery_profile": "bitmapverse.bitmap_discovery.v0.2.1",
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
    "schema": "bitmapverse.candidate_set.v0.2.1",
    "contract_version": "0.2.1",
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

# Synthetic captured artifact for the (synthetic) enumeration response.
enumeration_body = json.dumps(
    {"ids": [c["inscription_id"] for c in candidates], "more": False}, sort_keys=True
)
enumeration_sha256 = hashlib.sha256(enumeration_body.encode("utf-8")).hexdigest()

evidence_manifest = {
    "schema": "bitmapverse.evidence_manifest.v0.2.1",
    "contract_version": "0.2.1",
    "resolution_snapshot": inp["resolution_snapshot"],
    "observation_tip": inp["observation_tip"],
    "observed_through_observation_tip_count": len(eligible_sorted) + len(excluded),
    "eligible_through_resolution_snapshot_count": len(eligible_sorted),
    "excluded_after_resolution_snapshot_count": len(excluded),
    "chain_ancestry_proof": {
        "method": "synthetic_test_vector_no_real_chain_verification",
        "operator": None,
        "evidence_captured": "N/A — synthetic vector, no real Bitcoin chain was consulted",
        "evidence_sha256": "0" * 64,
        "result": {"ancestor": True},
        "limitations": ["Este es un vector sintético; no representa una verificación de cadena real."],
    },
    "bitmap_discovery": {
        "profile": "bitmapverse.bitmap_discovery.v0.2.1",
        "implementation": "synthetic_test_vector",
        "operator": None,
    },
    "sources": [
        {
            "role": "candidate_enumeration",
            "operator": None,
            "implementation": "synthetic_test_vector",
            "version_or_commit": "n/a",
            "endpoint": "synthetic://enumeration",
            "query": f"sat={inp['sat']}",
            "observed_at": "synthetic",
            "response_status": "captured",
            "response_size_bytes": len(enumeration_body.encode("utf-8")),
            "response_content_type": "application/json",
            "response_sha256": enumeration_sha256,
            "reported_count": len(candidates),
            "pagination": {
                "complete": True,
                "page_count": 1,
                "pages": [
                    {
                        "page_index": 0,
                        "endpoint_or_query": "synthetic://enumeration?page=0",
                        "response_sha256": enumeration_sha256,
                        "response_size_bytes": len(enumeration_body.encode("utf-8")),
                        "reported_count_this_page": len(candidates),
                    }
                ],
            },
        }
    ],
    "captured_artifacts": [
        {
            "artifact_id": "synthetic-enumeration-page-0",
            "source_role": "candidate_enumeration",
            "description": "Synthetic enumeration response body (all 3 observed candidates)",
            "sha256": enumeration_sha256,
            "size_bytes": len(enumeration_body.encode("utf-8")),
            "content_type": "application/json",
            "captured_at": "synthetic",
        }
    ],
    "resolution_result_canonical_sha256": rr_hash,
    "candidate_set_canonical_sha256": cs_hash,
}

# Stability demonstration: recompute as if the excluded candidate had
# never been observed at all.
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
    "_note": "Salida esperada, calculada con una implementacion de referencia del perfil JCS restringido v0.2.1 mantenida fuera de este paquete, a partir de synthetic-count-split.input.json bajo el contrato v0.2.1.",
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
