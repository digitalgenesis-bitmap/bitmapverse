#!/usr/bin/env python3
"""CLI harness for the Python side of the conformance check — NOT part of
the adapter's translation contract, just plumbing so the Node test suite
and run.mjs can subprocess this without reimplementing Python logic.

Deliberately orchestrates two modules with different purity guarantees:
python_adapter (pure: resolution_result_core, and the always-failing
to_resolution_result) and evidence_enrichment (impure: reads the frozen
fixture for evidence_manifest only). Emits both, plus the specific reason
the full resolution_result could not be built, as JSON on stdout.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "adapters"))

from canonical_json import canonicalize_to_bytes  # noqa: E402
from evidence_enrichment import build_evidence_manifest  # noqa: E402
from python_adapter import AdapterError, to_resolution_result, to_resolution_result_core  # noqa: E402


def main() -> None:
    if len(sys.argv) != 4:
        print(
            "usage: python_conformance_cli.py <sealed_result.json> <fixture_id> <frozen_fixture.json>",
            file=sys.stderr,
        )
        raise SystemExit(2)

    sealed_result_path, fixture_id, frozen_fixture_path = sys.argv[1:4]

    with open(sealed_result_path, "r", encoding="utf-8") as fh:
        sealed = json.load(fh)
    with open(frozen_fixture_path, "r", encoding="utf-8") as fh:
        frozen_fixture = json.load(fh)

    sealed_entry = sealed[fixture_id]

    core = to_resolution_result_core(sealed_entry)
    core_canonical_sha256 = hashlib.sha256(canonicalize_to_bytes(core)).hexdigest()

    try:
        to_resolution_result(sealed_entry)
        full_error = None
    except AdapterError as exc:
        full_error = str(exc)

    # evidence_manifest links to the CORE canonical hash, not a full one —
    # no full, schema-valid resolution_result exists for the sealed Python
    # submission. This is declared here, not silently substituted; see
    # REPORT.md's "Asimetría del vínculo evidence_manifest" section.
    evidence_manifest = build_evidence_manifest(frozen_fixture, core_canonical_sha256)

    print(
        json.dumps(
            {
                "resolution_result_core": core,
                "resolution_result_core_canonical_sha256": core_canonical_sha256,
                "resolution_result_full_error": full_error,
                "evidence_manifest": evidence_manifest,
            }
        )
    )


if __name__ == "__main__":
    main()
