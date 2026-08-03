"""Real, executable semantic validators for resolution_result.v0.1.

Python twin of resolution-result-rules.mjs. Every function raises
ValidationError on violation; none merely computes a boolean for a caller
to check. Tests must invoke these directly, not reimplement the check
inline.
"""

from __future__ import annotations

import re

HEX64 = re.compile(r"^[0-9a-f]{64}$")
INSCRIPTION_ID = re.compile(r"^[0-9a-f]{64}i[0-9]+$")

CORE_REQUIRED_FIELDS = [
    "schema",
    "district",
    "district_name",
    "resolver",
    "original_inscription_id",
    "selected_inscription_id",
    "selected_content_sha256",
    "sat",
    "selected_position",
    "snapshot",
    "status",
]
FULL_REQUIRED_FIELDS = CORE_REQUIRED_FIELDS + ["eligible_candidate_count"]

POSITION_FIELDS = ["block_height", "block_hash", "transaction_id", "transaction_index", "inscription_index"]
SNAPSHOT_FIELDS = ["block_height", "block_hash", "block_timestamp"]


class ValidationError(Exception):
    pass


def assert_required_fields_present(rr: dict, required_fields=None) -> None:
    required_fields = FULL_REQUIRED_FIELDS if required_fields is None else required_fields
    missing = [key for key in required_fields if key not in rr]
    if missing:
        raise ValidationError(f"missing required field(s): {', '.join(missing)}")
    if "selected_position" in required_fields:
        position = rr.get("selected_position") or {}
        missing_pos = [key for key in POSITION_FIELDS if key not in position]
        if missing_pos:
            raise ValidationError(f"selected_position missing field(s): {', '.join(missing_pos)}")
    if "snapshot" in required_fields:
        snapshot = rr.get("snapshot") or {}
        missing_snap = [key for key in SNAPSHOT_FIELDS if key not in snapshot]
        if missing_snap:
            raise ValidationError(f"snapshot missing field(s): {', '.join(missing_snap)}")


def assert_valid_ids_and_hashes(rr: dict) -> None:
    original = rr.get("original_inscription_id")
    if not isinstance(original, str) or not INSCRIPTION_ID.match(original):
        raise ValidationError(f"original_inscription_id is not a valid inscription id: {original!r}")
    selected = rr.get("selected_inscription_id")
    if not isinstance(selected, str) or not INSCRIPTION_ID.match(selected):
        raise ValidationError(f"selected_inscription_id is not a valid inscription id: {selected!r}")
    content_hash = rr.get("selected_content_sha256")
    if not isinstance(content_hash, str) or not HEX64.match(content_hash):
        raise ValidationError(f"selected_content_sha256 is not a valid sha256 hex digest: {content_hash!r}")
    position = rr.get("selected_position") or {}
    if not isinstance(position.get("block_hash"), str) or not HEX64.match(position["block_hash"]):
        raise ValidationError(f"selected_position.block_hash is not a valid sha256 hex digest: {position.get('block_hash')!r}")
    if not isinstance(position.get("transaction_id"), str) or not HEX64.match(position["transaction_id"]):
        raise ValidationError(
            f"selected_position.transaction_id is not a valid sha256 hex digest: {position.get('transaction_id')!r}"
        )
    snapshot = rr.get("snapshot") or {}
    if not isinstance(snapshot.get("block_hash"), str) or not HEX64.match(snapshot["block_hash"]):
        raise ValidationError(f"snapshot.block_hash is not a valid sha256 hex digest: {snapshot.get('block_hash')!r}")


def assert_district_name_matches_district(rr: dict) -> None:
    expected = f"{rr.get('district')}.bitmap"
    if rr.get("district_name") != expected:
        raise ValidationError(
            f"district_name ({rr.get('district_name')!r}) does not match district (expected {expected!r})"
        )


def assert_selected_position_not_after_snapshot(rr: dict) -> None:
    if rr["selected_position"]["block_height"] > rr["snapshot"]["block_height"]:
        raise ValidationError(
            "selected_position.block_height "
            f"({rr['selected_position']['block_height']}) is after snapshot.block_height "
            f"({rr['snapshot']['block_height']})"
        )


def assert_boundary_block_hash_agrees(rr: dict) -> None:
    position = rr["selected_position"]
    snapshot = rr["snapshot"]
    if position["block_height"] == snapshot["block_height"] and position["block_hash"] != snapshot["block_hash"]:
        raise ValidationError(
            "selected_position sits at snapshot.block_height but declares a different block_hash "
            f"({position['block_hash']} != {snapshot['block_hash']})"
        )


def validate_resolution_result_core(rr: dict) -> None:
    """Every rule that doesn't depend on eligible_candidate_count — safe to
    call against resolution_result_core, which never has that field."""
    assert_required_fields_present(rr, CORE_REQUIRED_FIELDS)
    assert_valid_ids_and_hashes(rr)
    assert_district_name_matches_district(rr)
    assert_selected_position_not_after_snapshot(rr)
    assert_boundary_block_hash_agrees(rr)


def validate_resolution_result(rr: dict) -> None:
    """Every rule, including presence of eligible_candidate_count."""
    assert_required_fields_present(rr, FULL_REQUIRED_FIELDS)
    assert_valid_ids_and_hashes(rr)
    assert_district_name_matches_district(rr)
    assert_selected_position_not_after_snapshot(rr)
    assert_boundary_block_hash_agrees(rr)
