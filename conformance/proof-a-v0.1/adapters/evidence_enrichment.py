"""Evidence enrichment for evidence_manifest.v0.1 — NOT a result adapter.

This module is deliberately impure: it reads the frozen fixture
(fixtures/<district>.snapshot.json) to populate fields evidence_manifest
needs that the sealed Python result.json never carried in the first place
(source_manifest, candidate_enumeration.observed_at/complete_through_snapshot,
and — critically — the post-snapshot eligible/excluded candidate split).

The correction that produced this file exists because that fixture-reading
behavior used to live inside python_adapter.py's resolution_result builder,
where it quietly made an unverified claim (candidate_count ==
eligible_candidate_count) look verified by cross-checking it against the
fixture. That was wrong for a *result* adapter: a pure translator must not
reach past its input. It is legitimate here, in a module whose only job is
evidence provenance and whose name says so — evidence_manifest.v0.1 was
designed to carry exactly this kind of fixture-derived context
(reconstruction_method, sources, counts), and nothing here ever selects,
re-selects, or overrides which inscription resolution_result names as
selected.
"""

from __future__ import annotations


class EnrichmentError(Exception):
    pass


def _require(value, path: str):
    if value is None:
        raise EnrichmentError(f"evidence-enrichment: missing required datum at {path}")
    return value


def eligible_candidate_count_from_fixture(frozen_fixture: dict) -> tuple[int, int]:
    """Returns (observed_total, eligible). Arithmetic counting over the
    frozen fixture's candidates against snapshot_height — not a re-run of
    same_sat_latest_v0.1's tie-break/selection, which only ever decides
    which single candidate to name, never how many are eligible.
    """
    snapshot_height = frozen_fixture["snapshot_height"]
    total = len(frozen_fixture["candidates"])
    eligible = sum(
        1
        for c in frozen_fixture["candidates"]
        if c["canonical_position"]["block_height"] <= snapshot_height
    )
    return total, eligible


def build_evidence_manifest(
    frozen_fixture: dict,
    resolution_result_canonical_sha256_hex: str,
) -> dict:
    enumeration = _require(frozen_fixture.get("candidate_enumeration"), "frozen_fixture.candidate_enumeration")
    manifest = _require(frozen_fixture.get("source_manifest"), "frozen_fixture.source_manifest")

    total, eligible = eligible_candidate_count_from_fixture(frozen_fixture)

    opi = _require(manifest.get("opi"), "source_manifest.opi")
    ord_ = _require(manifest.get("ord"), "source_manifest.ord")

    return {
        "schema": "bitmapverse.evidence_manifest.v0.1",
        "observed_at": _require(enumeration.get("observed_at"), "candidate_enumeration.observed_at"),
        "observed_candidate_count": total,
        "eligible_candidate_count": eligible,
        "excluded_after_snapshot": total - eligible,
        "enumeration_complete_through_snapshot": _require(
            enumeration.get("complete_through_snapshot"), "candidate_enumeration.complete_through_snapshot"
        ),
        "reconstruction_method": {
            "district_discovery": "opi",
            "sat_resolution": "ord",
            "candidate_enumeration": "same_sat",
            "snapshot_boundary": "bitcoin_block",
        },
        "sources": {
            "opi": {
                # Not declared in the frozen evidence — never fabricated.
                "operator": None,
                "implementation": _require(opi.get("implementation"), "source_manifest.opi.implementation"),
                "version": _require(opi.get("commit"), "source_manifest.opi.commit"),
                "query_or_endpoint": _require(opi.get("query"), "source_manifest.opi.query"),
                "response_status": _require(
                    opi.get("response_status"), "source_manifest.opi.response_status"
                ),
                "response_sha256": opi.get("response_sha256"),
            },
            "ord": {
                "operator": None,
                "implementation": _require(ord_.get("implementation"), "source_manifest.ord.implementation"),
                "version": _require(ord_.get("version"), "source_manifest.ord.version"),
                "query_or_endpoint": _require(enumeration.get("endpoint"), "candidate_enumeration.endpoint"),
                "response_status": "captured" if ord_.get("enumeration_response_sha256") else "not_captured",
                "response_sha256": ord_.get("enumeration_response_sha256"),
            },
        },
        "resolution_result_canonical_sha256": _require(
            resolution_result_canonical_sha256_hex, "resolution_result_canonical_sha256_hex"
        ),
    }
