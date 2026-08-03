/**
 * Normative comparison protocol (CONTRACT.md, "Comparación normativa del
 * resultado"). Two genuinely different comparison rules for two
 * genuinely different kinds of object:
 *
 *   - resolution_result: schema-validate both -> canonicalize (JCS) ->
 *     SHA-256 -> exact hash equality required. A semantic diff is
 *     available ONLY as a post-hoc diagnostic when the hashes differ,
 *     and it can never upgrade a hash mismatch into approval — it exists
 *     to help a human understand WHY two results differ, not to decide
 *     whether they're "close enough".
 *
 *   - evidence_manifest: NEVER compared byte-for-byte between two
 *     operators (they're allowed, expected, to differ — different
 *     observation_tip, different operator, different capture times).
 *     Instead each one is validated independently: schema conformance,
 *     internal hash consistency, referential integrity (source_id /
 *     artifact_id), and that its declared candidate_set/position/count
 *     data is internally coherent. This module's evidence_manifest
 *     function validates ONE manifest, not two against each other — that
 *     asymmetry with compareResolutionResults is intentional, not an
 *     oversight.
 */
import { canonicalize } from "./jcs.mjs";
import { createHash } from "node:crypto";
import { validate } from "./json-schema-lite.mjs";
import { validateReferentialIntegrity } from "./evidence-manifest-integrity.mjs";

function canonicalSha256(value) {
  return createHash("sha256").update(Buffer.from(canonicalize(value), "utf8")).digest("hex");
}

/**
 * Best-effort, informational-only structural diff — lists top-level keys
 * whose canonical serialization differs. Never consulted by `approved`.
 */
function diagnosticSemanticDiff(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const differences = {};
  for (const key of keys) {
    const av = key in a ? canonicalize(a[key]) : undefined;
    const bv = key in b ? canonicalize(b[key]) : undefined;
    if (av !== bv) {
      differences[key] = { a: a[key] ?? null, b: b[key] ?? null };
    }
  }
  return differences;
}

/**
 * The ONLY normative comparison for resolution_result.v0.2.2. `approved`
 * is true if and only if both objects are schema-valid AND their
 * canonical SHA-256 hashes are identical — nothing else can make it true.
 */
export function compareResolutionResults(resultA, resultB, resolutionResultSchema) {
  const schemaA = validate(resolutionResultSchema, resultA);
  const schemaB = validate(resolutionResultSchema, resultB);

  const canonicalShaA = canonicalSha256(resultA);
  const canonicalShaB = canonicalSha256(resultB);
  const hashesEqual = canonicalShaA === canonicalShaB;

  const approved = schemaA.valid && schemaB.valid && hashesEqual;

  return {
    schema_valid_a: schemaA.valid,
    schema_errors_a: schemaA.errors,
    schema_valid_b: schemaB.valid,
    schema_errors_b: schemaB.errors,
    canonical_sha256_a: canonicalShaA,
    canonical_sha256_b: canonicalShaB,
    hashes_equal: hashesEqual,
    approved,
    // Populated only for human diagnosis when hashes differ and both
    // sides are at least schema-valid enough to compare meaningfully.
    // This field carries no authority — see module docstring.
    diagnostic_semantic_diff:
      !hashesEqual && schemaA.valid && schemaB.valid ? diagnosticSemanticDiff(resultA, resultB) : null,
  };
}

/**
 * Validates ONE evidence_manifest on its own terms — schema conformance,
 * referential integrity, and that its own two canonical-hash fields
 * actually match the resolution_result/candidate_set they claim to
 * describe (if those are supplied). Never compares against a second
 * evidence_manifest — see module docstring for why that would be wrong.
 */
export function validateEvidenceManifestIndependently(
  evidenceManifest,
  evidenceManifestSchema,
  { resolutionResult, candidateSet } = {},
) {
  const schemaResult = validate(evidenceManifestSchema, evidenceManifest);
  const integrityResult = validateReferentialIntegrity(evidenceManifest);

  const hashChecks = [];
  if (resolutionResult !== undefined) {
    const actual = canonicalSha256(resolutionResult);
    const declared = evidenceManifest.resolution_result_canonical_sha256;
    if (actual !== declared) {
      hashChecks.push(
        `resolution_result_canonical_sha256 (${declared}) does not match the recomputed canonical hash of the supplied resolution_result (${actual})`,
      );
    }
  }
  if (candidateSet !== undefined) {
    const actual = canonicalSha256(candidateSet);
    const declared = evidenceManifest.candidate_set_canonical_sha256;
    if (actual !== declared) {
      hashChecks.push(
        `candidate_set_canonical_sha256 (${declared}) does not match the recomputed canonical hash of the supplied candidate_set (${actual})`,
      );
    }
  }

  return {
    schema_valid: schemaResult.valid,
    schema_errors: schemaResult.errors,
    referential_integrity_valid: integrityResult.valid,
    referential_integrity_errors: integrityResult.errors,
    hash_checks_passed: hashChecks.length === 0,
    hash_check_errors: hashChecks,
    valid: schemaResult.valid && integrityResult.valid && hashChecks.length === 0,
  };
}
