/**
 * External adapter: JavaScript resolver output -> stable resolution_result
 * schema (bitmapverse.resolution_result.v0.1).
 *
 * Pure translation only. This module does not import or call
 * resolveSameSatLatestV01 — it consumes an already-produced wrapped object
 * (the shape written by generate-js-reference.mjs) and reshapes it. It
 * touches only `wrapped.resolver_output`; it never reads
 * `wrapped.evidence_snapshot`, which exists solely to feed
 * evidence-enrichment.mjs (a separate, explicitly-labeled, fixture-reading
 * module — see that file). It does not invent data that isn't present in
 * `resolver_output`; where a stable-schema field has no source, it fails
 * loudly (missing required datum) or emits a documented null
 * (block_timestamp — see CANONICALIZATION.md).
 *
 * Unlike the Python side, this adapter *can* produce a schema-valid
 * eligible_candidate_count purely from resolver_output: resolveSameSatLatestV01
 * already computes and returns the post-snapshot-filtered `candidate_count`
 * itself (see src/resolvers/same-sat-latest-v01.mjs), so there is no
 * unverified semantic claim to launder here — it's a rename, not a guess.
 */
import { validateResolutionResult } from "./resolution-result-rules.mjs";

class AdapterError extends Error {}

function requireField(value, path) {
  if (value === undefined) {
    throw new AdapterError(`js-adapter: missing required datum at ${path}`);
  }
  return value;
}

export function toResolutionResult(wrapped) {
  const r = requireField(wrapped.resolver_output, "resolver_output");

  const result = {
    schema: "bitmapverse.resolution_result.v0.1",
    district: requireField(r.district, "resolver_output.district"),
    district_name: requireField(r.district_name, "resolver_output.district_name"),
    resolver: requireField(r.resolver, "resolver_output.resolver"),
    original_inscription_id: requireField(
      r.original_inscription_id,
      "resolver_output.original_inscription_id",
    ),
    selected_inscription_id: requireField(
      r.selected_inscription_id,
      "resolver_output.selected_inscription_id",
    ),
    selected_content_sha256: requireField(
      r.selected_content_sha256,
      "resolver_output.selected_content_sha256",
    ),
    sat: requireField(r.sat, "resolver_output.sat"),
    selected_position: {
      block_height: requireField(
        r.selected_position?.block_height,
        "resolver_output.selected_position.block_height",
      ),
      block_hash: requireField(
        r.selected_position?.block_hash,
        "resolver_output.selected_position.block_hash",
      ),
      transaction_id: requireField(
        r.selected_position?.transaction_id,
        "resolver_output.selected_position.transaction_id",
      ),
      transaction_index: requireField(
        r.selected_position?.transaction_index,
        "resolver_output.selected_position.transaction_index",
      ),
      inscription_index: requireField(
        r.selected_position?.inscription_index,
        "resolver_output.selected_position.inscription_index",
      ),
    },
    snapshot: {
      block_height: requireField(r.snapshot_height, "resolver_output.snapshot_height"),
      block_hash: requireField(r.snapshot_block_hash, "resolver_output.snapshot_block_hash"),
      // Documented exception: no fixture in this package declares the
      // snapshot block's timestamp. Not invented; see CANONICALIZATION.md.
      block_timestamp: null,
    },
    // JS's native `candidate_count` is already the post-filter eligible
    // count (see resolveSameSatLatestV01: eligible.length), so this is a
    // direct rename, not a reinterpretation.
    eligible_candidate_count: requireField(r.candidate_count, "resolver_output.candidate_count"),
    status: requireField(r.status, "resolver_output.status"),
  };

  validateResolutionResult(result);
  return result;
}

export { AdapterError };
