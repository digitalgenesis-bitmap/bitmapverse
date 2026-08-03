"""Reference implementation of bitmap_discovery_opi_v1
(blind/v0.2.2/BITMAP_DISCOVERY_PROFILE.md, Capa 2), faithfully
reproducing the verified OPI source at commit
da24fb6cf4c2ef3f99d030ea2ef18ba9099b0633 - see
blind/v0.2.2/OPI_SOURCE_PROVENANCE.json for exact file/line citations.
Not shipped inside the blind package; kept here as the reference used to
build and check test-vectors/.

This is, in fact, the same language (Python) OPI's own bitmap_index.py is
written in for the decoding/validation logic, so no leniency gap exists
here the way it does in the JS twin: codecs.decode(..., "hex") and
str.decode('utf-8') both raise on invalid input natively.
"""

from __future__ import annotations

import codecs

TEXT_PLAIN_HEX_PREFIX = "746578742f706c61696e"  # "text/plain"


class BitmapDiscoveryError(Exception):
    pass


def is_valid_bitmap_candidate(inscription_number, is_json: bool, content_type_hex: str) -> bool:
    """OPI_SOURCE_PROVENANCE.json: ord/db_reader/src/server.rs#L309-L323.

    Fails closed on a missing/non-integer inscription_number (returns
    False) rather than raising, matching the JS twin's explicit guard —
    "ausencia de inscription_number bloquea el descubrimiento".
    """
    if not isinstance(inscription_number, int) or isinstance(inscription_number, bool):
        return False
    if inscription_number < 0:
        return False
    if is_json:
        return False
    if not content_type_hex.lower().startswith(TEXT_PLAIN_HEX_PREFIX):
        return False
    return True


def get_bitmap_number(content_hex: str):
    """OPI_SOURCE_PROVENANCE.json: modules/bitmap_index/bitmap_index.py#L133-L147.
    Verbatim translation of the real function (same language as the source)."""
    content = None
    try:
        content = codecs.decode(content_hex, "hex").decode("utf-8")
    except Exception:
        pass
    if content is None:
        return None
    if not content.endswith(".bitmap"):
        return None
    content = content[: -len(".bitmap")]
    if len(content) == 0:
        return None
    for ch in content:
        if ord(ch) > ord("9") or ord(ch) < ord("0"):
            return None
    if ord(content[0]) == ord("0") and len(content) != 1:
        return None
    return int(content)


def is_block_existing(bitmap_number: int, block_height: int) -> bool:
    """OPI_SOURCE_PROVENANCE.json: modules/bitmap_index/bitmap_index.py#L203-L205."""
    return bitmap_number <= block_height


def index_block_candidates(candidates: list[dict]) -> dict:
    """Each candidate: {inscription_id, inscription_number, content_hex,
    is_json, content_type_hex, block_height}. Sorted defensively by
    inscription_number (server.rs#L727's guarantee, made explicit here).
    Returns {bitmap_number: candidate} for claims accepted in this block.
    """
    sorted_candidates = sorted(candidates, key=lambda c: c["inscription_number"])
    claims: dict = {}
    for candidate in sorted_candidates:
        if not is_valid_bitmap_candidate(
            candidate["inscription_number"], candidate["is_json"], candidate["content_type_hex"]
        ):
            continue
        bitmap_number = get_bitmap_number(candidate["content_hex"])
        if bitmap_number is None:
            continue
        if not is_block_existing(bitmap_number, candidate["block_height"]):
            continue
        if bitmap_number in claims:
            continue
        claims[bitmap_number] = {**candidate, "bitmap_number": bitmap_number}
    return claims


def index_blocks_in_order(blocks_ascending: list[list[dict]]) -> dict:
    global_claims: dict = {}
    for candidates in blocks_ascending:
        claims = index_block_candidates(candidates)
        for bitmap_number, claim in claims.items():
            if bitmap_number in global_claims:
                continue
            global_claims[bitmap_number] = claim
    return global_claims
