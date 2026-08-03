/**
 * Evidence enrichment for evidence_manifest.v0.1 — NOT a result adapter.
 *
 * Deliberately impure: reads `wrapped.evidence_snapshot` (fields
 * generate-js-reference.mjs copied out of the frozen fixture alongside
 * running the resolver — see that file) to populate provenance data
 * resolveSameSatLatestV01's own return value doesn't carry
 * (candidate_enumeration.observed_at / complete_through_snapshot / endpoint).
 *
 * This module never decides which inscription is selected — that fact
 * only ever comes from `wrapped.resolver_output`, already produced by
 * js-adapter.mjs's toResolutionResult. It only adds provenance context
 * around that already-settled fact. See adapters/evidence_enrichment.py
 * for the Python twin and its more consequential role (Python's sealed
 * output needs fixture-derived counts that JS's native output already
 * carries on its own).
 */

class EnrichmentError extends Error {}

function requireField(value, path) {
  if (value === undefined) {
    throw new EnrichmentError(`evidence-enrichment: missing required datum at ${path}`);
  }
  return value;
}

export function buildEvidenceManifest(wrapped, resolutionResultCanonicalSha256Hex) {
  const r = requireField(wrapped.resolver_output, "resolver_output");
  const snapshot = requireField(wrapped.evidence_snapshot, "evidence_snapshot");
  const manifest = requireField(r.source_manifest, "resolver_output.source_manifest");

  const observedCandidateCount = r.candidate_count + r.excluded_after_snapshot;

  return {
    schema: "bitmapverse.evidence_manifest.v0.1",
    observed_at: requireField(snapshot.observed_at, "evidence_snapshot.observed_at"),
    observed_candidate_count: observedCandidateCount,
    eligible_candidate_count: r.candidate_count,
    excluded_after_snapshot: r.excluded_after_snapshot,
    enumeration_complete_through_snapshot: requireField(
      snapshot.complete_through_snapshot,
      "evidence_snapshot.complete_through_snapshot",
    ),
    reconstruction_method: {
      district_discovery: "opi",
      sat_resolution: "ord",
      candidate_enumeration: "same_sat",
      snapshot_boundary: "bitcoin_block",
    },
    sources: {
      opi: {
        // Not declared in the frozen evidence — never fabricated as
        // ordinals.com or any other party. See CANONICALIZATION.md.
        operator: null,
        implementation: requireField(manifest.opi?.implementation, "source_manifest.opi.implementation"),
        version: requireField(manifest.opi?.commit, "source_manifest.opi.commit"),
        query_or_endpoint: requireField(manifest.opi?.query, "source_manifest.opi.query"),
        response_status: requireField(manifest.opi?.response_status, "source_manifest.opi.response_status"),
        response_sha256: manifest.opi?.response_sha256 ?? null,
      },
      ord: {
        operator: null,
        implementation: requireField(manifest.ord?.implementation, "source_manifest.ord.implementation"),
        version: requireField(manifest.ord?.version, "source_manifest.ord.version"),
        query_or_endpoint: requireField(snapshot.ord_endpoint, "evidence_snapshot.ord_endpoint"),
        response_status: manifest.ord?.enumeration_response_sha256 ? "captured" : "not_captured",
        response_sha256: manifest.ord?.enumeration_response_sha256 ?? null,
      },
    },
    resolution_result_canonical_sha256: requireField(
      resolutionResultCanonicalSha256Hex,
      "resolutionResultCanonicalSha256Hex",
    ),
  };
}

export { EnrichmentError };
