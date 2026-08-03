/**
 * Real, executable semantic validators for resolution_result.v0.1 — the
 * cross-field rules JSON Schema alone cannot express (see
 * CANONICALIZATION.md). Every function here throws ValidationError on
 * violation; none of them merely compute a boolean for a caller to check.
 * Tests must invoke these via assert.throws, not reimplement the check
 * inline.
 */

export class ValidationError extends Error {}

const HEX64 = /^[0-9a-f]{64}$/;
const INSCRIPTION_ID = /^[0-9a-f]{64}i[0-9]+$/;

export const CORE_REQUIRED_FIELDS = [
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
];

export const FULL_REQUIRED_FIELDS = [...CORE_REQUIRED_FIELDS, "eligible_candidate_count"];

const POSITION_FIELDS = ["block_height", "block_hash", "transaction_id", "transaction_index", "inscription_index"];
const SNAPSHOT_FIELDS = ["block_height", "block_hash", "block_timestamp"];

export function assertRequiredFieldsPresent(rr, requiredFields = FULL_REQUIRED_FIELDS) {
  const missing = requiredFields.filter((key) => !(key in rr) || rr[key] === undefined);
  if (missing.length > 0) {
    throw new ValidationError(`missing required field(s): ${missing.join(", ")}`);
  }
  if (requiredFields.includes("selected_position")) {
    const missingPos = POSITION_FIELDS.filter((key) => !(key in (rr.selected_position ?? {})));
    if (missingPos.length > 0) {
      throw new ValidationError(`selected_position missing field(s): ${missingPos.join(", ")}`);
    }
  }
  if (requiredFields.includes("snapshot")) {
    const missingSnap = SNAPSHOT_FIELDS.filter((key) => !(key in (rr.snapshot ?? {})));
    if (missingSnap.length > 0) {
      throw new ValidationError(`snapshot missing field(s): ${missingSnap.join(", ")}`);
    }
  }
}

export function assertValidIdsAndHashes(rr) {
  if (typeof rr.original_inscription_id !== "string" || !INSCRIPTION_ID.test(rr.original_inscription_id)) {
    throw new ValidationError(`original_inscription_id is not a valid inscription id: ${rr.original_inscription_id}`);
  }
  if (typeof rr.selected_inscription_id !== "string" || !INSCRIPTION_ID.test(rr.selected_inscription_id)) {
    throw new ValidationError(`selected_inscription_id is not a valid inscription id: ${rr.selected_inscription_id}`);
  }
  if (typeof rr.selected_content_sha256 !== "string" || !HEX64.test(rr.selected_content_sha256)) {
    throw new ValidationError(`selected_content_sha256 is not a valid sha256 hex digest: ${rr.selected_content_sha256}`);
  }
  const position = rr.selected_position ?? {};
  if (typeof position.block_hash !== "string" || !HEX64.test(position.block_hash)) {
    throw new ValidationError(`selected_position.block_hash is not a valid sha256 hex digest: ${position.block_hash}`);
  }
  if (typeof position.transaction_id !== "string" || !HEX64.test(position.transaction_id)) {
    throw new ValidationError(`selected_position.transaction_id is not a valid sha256 hex digest: ${position.transaction_id}`);
  }
  const snapshot = rr.snapshot ?? {};
  if (typeof snapshot.block_hash !== "string" || !HEX64.test(snapshot.block_hash)) {
    throw new ValidationError(`snapshot.block_hash is not a valid sha256 hex digest: ${snapshot.block_hash}`);
  }
}

export function assertDistrictNameMatchesDistrict(rr) {
  const expected = `${rr.district}.bitmap`;
  if (rr.district_name !== expected) {
    throw new ValidationError(
      `district_name (${JSON.stringify(rr.district_name)}) does not match district (expected ${JSON.stringify(expected)})`,
    );
  }
}

export function assertSelectedPositionNotAfterSnapshot(rr) {
  if (rr.selected_position.block_height > rr.snapshot.block_height) {
    throw new ValidationError(
      `selected_position.block_height (${rr.selected_position.block_height}) is after snapshot.block_height (${rr.snapshot.block_height})`,
    );
  }
}

export function assertBoundaryBlockHashAgrees(rr) {
  if (
    rr.selected_position.block_height === rr.snapshot.block_height &&
    rr.selected_position.block_hash !== rr.snapshot.block_hash
  ) {
    throw new ValidationError(
      `selected_position sits at snapshot.block_height but declares a different block_hash ` +
        `(${rr.selected_position.block_hash} !== ${rr.snapshot.block_hash})`,
    );
  }
}

/**
 * Runs every rule that does not depend on eligible_candidate_count — safe
 * to call against resolution_result_core, which never has that field.
 */
export function validateResolutionResultCore(rr) {
  assertRequiredFieldsPresent(rr, CORE_REQUIRED_FIELDS);
  assertValidIdsAndHashes(rr);
  assertDistrictNameMatchesDistrict(rr);
  assertSelectedPositionNotAfterSnapshot(rr);
  assertBoundaryBlockHashAgrees(rr);
}

/** Runs every rule, including presence of eligible_candidate_count. */
export function validateResolutionResult(rr) {
  assertRequiredFieldsPresent(rr, FULL_REQUIRED_FIELDS);
  assertValidIdsAndHashes(rr);
  assertDistrictNameMatchesDistrict(rr);
  assertSelectedPositionNotAfterSnapshot(rr);
  assertBoundaryBlockHashAgrees(rr);
}
