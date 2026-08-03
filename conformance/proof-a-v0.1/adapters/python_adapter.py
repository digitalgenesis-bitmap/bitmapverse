"""External adapter: sealed Python resolver output -> resolution_result.

Genuinely pure translation. This module takes exactly one input —
`sealed_result`, a single entry already produced and sealed in
bitmapverse-blind-submission-a-001.zip's result.json (read from an
extracted temporary copy, per the assignment's chain-of-custody rule) — and
never reads any fixture, any other file, or the network. It does not
import or call resolver.py's `resolve()`.

`evidence_manifest` construction is NOT here. It genuinely needs data the
sealed output doesn't carry (source_manifest, candidate_enumeration), and
the only legitimate place to get that is the frozen fixture — which would
make this module impure if it lived here. That logic lives in
evidence_enrichment.py instead, explicitly labeled as evidence enrichment,
not as a result adapter, per this package's correction: an adapter
translates what was already produced; it must never reach past its input
to make a result look more complete than it is.

The sharpest consequence of staying pure: `to_resolution_result` cannot
produce a schema-valid resolution_result.v0.1, because the schema requires
`eligible_candidate_count` and the sealed output's `candidate_count` was
defined by resolver.py as the *total* observed candidate count, not the
post-snapshot-eligible subset the schema means (see
AMBIGUITIES-SUCCESSOR.md #12). There is no way to tell, from sealed_result
alone, whether any candidates were excluded. Treating total-count as
eligible-count without proof would be presenting an unverified claim as
fact — exactly what this module refuses to do. It fails loudly instead.
"""

from __future__ import annotations

import re

from resolution_result_rules import validate_resolution_result_core


class AdapterError(Exception):
    pass


def _require(value, path: str):
    if value is None:
        raise AdapterError(f"python-adapter: missing required datum at {path}")
    return value


DISTRICT_NAME_RE = re.compile(r"^([0-9]+)\.bitmap$")


def to_resolution_result_core(sealed_result: dict) -> dict:
    """Every resolution_result.v0.1 field except eligible_candidate_count,
    built exclusively from sealed_result. Not schema-valid on its own (the
    schema requires eligible_candidate_count and forbids missing required
    properties) — this is deliberate: it isolates exactly which fields
    the sealed Python submission *can* prove, independent of the
    candidate-count problem. Validated against
    resolution_result_rules.validate_resolution_result_core before return.
    """
    district_name = _require(sealed_result.get("district"), "sealed_result.district")
    match = DISTRICT_NAME_RE.match(district_name)
    if not match:
        raise AdapterError(
            f"python-adapter: sealed_result.district {district_name!r} is not of the form <int>.bitmap"
        )
    district = int(match.group(1))

    position = _require(
        sealed_result.get("selected_canonical_position"),
        "sealed_result.selected_canonical_position",
    )

    core = {
        "schema": "bitmapverse.resolution_result.v0.1",
        "district": district,
        "district_name": district_name,
        # Not present in the sealed output (blind/v0.1/CONTRACT.md's minimal
        # output list never names a "resolver" key). This experiment is
        # scoped to exactly one resolver, so the adapter supplies the
        # schema's own fixed identifier rather than leaving it absent —
        # flagged as a format gap in AMBIGUITIES-SUCCESSOR.md #13, not
        # silently papered over. Unlike eligible_candidate_count, this is
        # not an unverified claim about the *evidence*: it is the fixed
        # identity of the one resolver this whole package is about.
        "resolver": "same_sat_latest_v0.1",
        "original_inscription_id": _require(
            sealed_result.get("original_inscription_id"), "sealed_result.original_inscription_id"
        ),
        "selected_inscription_id": _require(
            sealed_result.get("selected_inscription_id"), "sealed_result.selected_inscription_id"
        ),
        "selected_content_sha256": _require(
            sealed_result.get("selected_content_sha256"), "sealed_result.selected_content_sha256"
        ),
        "sat": _require(sealed_result.get("sat"), "sealed_result.sat"),
        "selected_position": {
            "block_height": _require(position.get("block_height"), "selected_canonical_position.block_height"),
            "block_hash": _require(position.get("block_hash"), "selected_canonical_position.block_hash"),
            "transaction_id": _require(
                position.get("transaction_id"), "selected_canonical_position.transaction_id"
            ),
            "transaction_index": _require(
                position.get("transaction_index"), "selected_canonical_position.transaction_index"
            ),
            "inscription_index": _require(
                position.get("inscription_index"), "selected_canonical_position.inscription_index"
            ),
        },
        "snapshot": {
            "block_height": _require(sealed_result.get("snapshot_height"), "sealed_result.snapshot_height"),
            "block_hash": _require(
                sealed_result.get("snapshot_block_hash"), "sealed_result.snapshot_block_hash"
            ),
            # Documented exception: not declared in any frozen fixture in
            # this package. Never invented. See CANONICALIZATION.md.
            "block_timestamp": None,
        },
        "status": _require(sealed_result.get("status"), "sealed_result.status"),
    }
    validate_resolution_result_core(core)
    return core


def to_resolution_result(sealed_result: dict) -> dict:
    """Always raises AdapterError. Kept as the explicit, named entry point
    for "the full stable resolution_result", so that its failure is a
    first-class, testable fact about this sealed submission rather than
    something a caller has to notice is silently absent. See module
    docstring and AMBIGUITIES-SUCCESSOR.md #12 for why.
    """
    core = to_resolution_result_core(sealed_result)
    claimed_count = sealed_result.get("candidate_count")
    raise AdapterError(
        "python-adapter: cannot produce a schema-valid resolution_result.v0.1 from sealed_result "
        f"alone. sealed_result['candidate_count'] = {claimed_count!r}, but resolver.py defined that "
        "field as the fixture's TOTAL observed candidate count, not the post-snapshot ELIGIBLE "
        "subset resolution_result.eligible_candidate_count means (see AMBIGUITIES-SUCCESSOR.md #12). "
        "The sealed output carries no eligible/excluded breakdown, so there is no way to tell from "
        "this input alone whether the two numbers coincide. A pure adapter must not consult the "
        "frozen fixture to settle this — that would silently convert an unverified semantic claim "
        "into a fact. All fields except eligible_candidate_count are available and schema-conformant "
        f"via to_resolution_result_core() (district={core['district']}, "
        f"selected_inscription_id={core['selected_inscription_id']})."
    )
