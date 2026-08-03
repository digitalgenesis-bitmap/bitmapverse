/**
 * Role-conditional validation of sources[].implementation_identity —
 * expressible only in code, not in this project's JSON Schema subset
 * (no if/then on a sibling field).
 *
 * bitmap_discovery: must be pinned to the exact fixed OPI commit — never
 * a movable branch, never a different repository. This is the one role
 * where "reproducible" has a single, non-negotiable answer.
 *
 * Every other role: needs at least one genuinely reproducible identity
 * consistent with its declared verification_method. Never invents a Git
 * commit for a binary or release that doesn't have one — that's exactly
 * the kind of fabricated-precision this validator exists to block.
 */

export class ImplementationIdentityError extends Error {}

const OFFICIAL_OPI_REPOSITORY = "https://github.com/bestinslot-xyz/OPI";
const FIXED_OPI_COMMIT = "da24fb6cf4c2ef3f99d030ea2ef18ba9099b0633";

export function validateImplementationIdentity(role, identity) {
  const errors = [];

  if (role === "bitmap_discovery") {
    if (identity.verification_method !== "commit") {
      errors.push(
        `bitmap_discovery requires verification_method "commit", got ${JSON.stringify(identity.verification_method)}`,
      );
    }
    if (identity.repository !== OFFICIAL_OPI_REPOSITORY) {
      errors.push(`bitmap_discovery requires repository ${OFFICIAL_OPI_REPOSITORY}, got ${JSON.stringify(identity.repository)}`);
    }
    if (identity.commit !== FIXED_OPI_COMMIT) {
      errors.push(`bitmap_discovery requires commit ${FIXED_OPI_COMMIT}, got ${JSON.stringify(identity.commit)}`);
    }
    return { valid: errors.length === 0, errors };
  }

  // Every other role: at least one reproducible identity, coherent with
  // the declared verification_method. We check coherence, not just
  // presence — declaring verification_method: "commit" but supplying
  // only a binary_sha256 is still rejected, because it claims a
  // verification path it doesn't actually back up.
  switch (identity.verification_method) {
    case "commit":
      if (!identity.repository || !identity.commit) {
        errors.push('verification_method "commit" requires both repository and commit');
      }
      break;
    case "release_hash":
      if (!identity.release || !identity.release_hash_sha256) {
        errors.push('verification_method "release_hash" requires both release and release_hash_sha256');
      }
      break;
    case "binary_sha256":
      if (!identity.binary_sha256) {
        errors.push('verification_method "binary_sha256" requires binary_sha256');
      }
      break;
    case "container_digest":
      if (!identity.container_digest) {
        errors.push('verification_method "container_digest" requires container_digest');
      }
      break;
    default:
      errors.push(`unknown verification_method: ${JSON.stringify(identity.verification_method)}`);
  }

  return { valid: errors.length === 0, errors };
}
