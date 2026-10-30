// Bitmapverse — Experiment #28: Delegated Build Permission (local, test-key).
//
// One grantor (District holder), one grantee (builder), one object, one action.
// Deterministic and synchronous: no network, no clock, no persistent state.
//
// Distinctions kept explicit in every result:
// - BIP-322 signature validity is not District ownership (checked separately).
// - District ownership is not delegated permission (grant + scope + expiry + revocation).
// - Delegated permission is not rendering (object_id is opaque, not a renderer reference).
// - Local revocation is not interoperable revocation (revocation: "LOCAL_ONLY").
// - Fixture ownership is not live ownership (authority_mode: "TEST_KEY_FIXTURE").

import { createHash } from "node:crypto";

import {
  p2trScriptPubKey,
  verifyBip322P2TR,
} from "../experiment-1/resolvers/resolver-js.mjs";
import { isVerifiedOwnershipEvidence } from "../experiment-31/ownership-evidence.mjs";

export const EXPERIMENT_28_PROFILE = Object.freeze({
  domain: "BITMAPVERSE DELEGATED PERMISSIONS / BUILD GRANT / v0.1\n",
  schema: "bitmapverse.permission.grant.v0.1",
  revocation_schema: "bitmapverse.permission.revocations.local.v0.1",
  district: "937336.bitmap",
  district_inscription_id: "7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1i0",
  action: "build",
  authority_mode: "TEST_KEY_FIXTURE",
  // Evidence sources this policy accepts. The source is echoed as authority_mode; it is never rewritten.
  accepted_evidence_sources: Object.freeze(["TEST_KEY_FIXTURE", "REAL_PROVIDER_CORROBORATED", "SYNTHETIC_TEST_CAPTURE"]),
  revocation: "LOCAL_ONLY",
  // Known real District holders. TEST_KEY_FIXTURE evidence may never authorize their grants.
  known_real_holders: Object.freeze(["bc1psphv4vlce9f37zqc7jt8w3gnynfxxh3zmjuvxpqv0vjs3t3mcdesyfk5tk"]),
});

const HEX64 = /^[0-9a-f]{64}$/;
const OUTPOINT = /^[0-9a-f]{64}:[0-9]+$/;
const OBJECT_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const MAX_SIGNATURE_LENGTH = 4096;

class Denial extends Error {
  constructor(code, reason) {
    super(`${code}: ${reason}`);
    this.code = code;
    this.reason = reason;
  }
}

function ensure(condition, code, reason) {
  if (!condition) throw new Denial(code, reason);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isPlainObject(value)
    && JSON.stringify(Object.keys(value).toSorted()) === JSON.stringify([...keys].toSorted());
}

function isSafeHeight(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isController(value) {
  if (!hasExactKeys(value, ["address", "script_pubkey"])) return false;
  if (typeof value.address !== "string" || !/^bc1p[0-9a-z]+$/.test(value.address)) return false;
  if (typeof value.script_pubkey !== "string" || !/^[0-9a-f]+$/.test(value.script_pubkey)) return false;
  try {
    return p2trScriptPubKey(value.address).toString("hex") === value.script_pubkey;
  } catch {
    return false;
  }
}

// Fixed key order. The signed bytes are always rebuilt from this function.
export function canonicalGrantPayload(grant) {
  return {
    schema: grant.schema,
    district: grant.district,
    district_inscription_id: grant.district_inscription_id,
    authority_snapshot: {
      height: grant.authority_snapshot.height,
      block_hash: grant.authority_snapshot.block_hash,
    },
    grantor: { address: grant.grantor.address, script_pubkey: grant.grantor.script_pubkey },
    grantee: { address: grant.grantee.address, script_pubkey: grant.grantee.script_pubkey },
    action: grant.action,
    object_id: grant.object_id,
    expires_at_height: grant.expires_at_height,
    nonce: grant.nonce,
  };
}

export function grantMessage(grant) {
  return `${EXPERIMENT_28_PROFILE.domain}${JSON.stringify(canonicalGrantPayload(grant))}`;
}

export function permissionId(message) {
  return createHash("sha256").update(message, "utf8").digest("hex");
}

const GRANT_KEYS = [
  "schema", "district", "district_inscription_id", "authority_snapshot", "grantor", "grantee",
  "action", "object_id", "expires_at_height", "nonce",
];

function parseGrantMessage(message) {
  ensure(typeof message === "string" && message.length > 0, "MESSAGE_MISMATCH", "message missing");
  ensure(message.startsWith(EXPERIMENT_28_PROFILE.domain), "MESSAGE_MISMATCH", "wrong domain");
  ensure(
    !message.includes("\r") && !message.endsWith("\n") && message.split("\n").length === 2,
    "MESSAGE_MISMATCH",
    "line structure is not canonical",
  );
  let payload;
  try {
    payload = JSON.parse(message.slice(EXPERIMENT_28_PROFILE.domain.length));
  } catch {
    throw new Denial("MESSAGE_MISMATCH", "payload is not JSON");
  }
  ensure(hasExactKeys(payload, GRANT_KEYS), "MESSAGE_MISMATCH", "missing or unknown grant fields");
  ensure(payload.schema === EXPERIMENT_28_PROFILE.schema, "MESSAGE_MISMATCH", "unknown schema");
  ensure(
    hasExactKeys(payload.authority_snapshot, ["height", "block_hash"])
      && isSafeHeight(payload.authority_snapshot.height)
      && typeof payload.authority_snapshot.block_hash === "string"
      && HEX64.test(payload.authority_snapshot.block_hash),
    "MESSAGE_MISMATCH",
    "invalid authority_snapshot",
  );
  ensure(isController(payload.grantor), "MESSAGE_MISMATCH", "invalid grantor");
  ensure(isController(payload.grantee), "MESSAGE_MISMATCH", "invalid grantee");
  ensure(payload.grantor.address !== payload.grantee.address, "MESSAGE_MISMATCH", "grantor equals grantee");
  ensure(typeof payload.object_id === "string" && OBJECT_ID.test(payload.object_id), "MESSAGE_MISMATCH", "invalid object_id");
  ensure(
    isSafeHeight(payload.expires_at_height) && payload.expires_at_height > payload.authority_snapshot.height,
    "MESSAGE_MISMATCH",
    "invalid expires_at_height",
  );
  ensure(typeof payload.nonce === "string" && HEX64.test(payload.nonce), "MESSAGE_MISMATCH", "invalid nonce");
  ensure(grantMessage(payload) === message, "MESSAGE_MISMATCH", "bytes are not canonical");
  return payload;
}

function validateRequest(request) {
  ensure(
    hasExactKeys(request, ["district", "object_id", "builder_address", "evaluation_height"])
      && typeof request.district === "string"
      && typeof request.object_id === "string"
      && typeof request.builder_address === "string"
      && isSafeHeight(request.evaluation_height),
    "INVALID_REQUEST",
    "request shape",
  );
}

function checkScope(payload, request) {
  ensure(
    payload.district === EXPERIMENT_28_PROFILE.district
      && payload.district_inscription_id === EXPERIMENT_28_PROFILE.district_inscription_id
      && request.district === payload.district,
    "WRONG_SCOPE",
    "district",
  );
  ensure(payload.action === EXPERIMENT_28_PROFILE.action, "WRONG_SCOPE", "action");
  ensure(request.object_id === payload.object_id, "WRONG_SCOPE", "object");
  ensure(request.builder_address === payload.grantee.address, "WRONG_SCOPE", "builder");
}

function checkExpiry(payload, request) {
  ensure(
    request.evaluation_height >= payload.authority_snapshot.height,
    "NOT_YET_VALID",
    `${request.evaluation_height} < ${payload.authority_snapshot.height}`,
  );
  ensure(
    request.evaluation_height < payload.expires_at_height,
    "EXPIRED",
    `${request.evaluation_height} >= ${payload.expires_at_height}`,
  );
}

// Explicit deterministic input. Missing or malformed state fails closed.
function checkRevocation(revocationState, id) {
  ensure(revocationState !== undefined && revocationState !== null, "REVOCATION_STATE_UNAVAILABLE", "no state supplied");
  ensure(
    hasExactKeys(revocationState, ["schema", "district", "revoked"])
      && revocationState.schema === EXPERIMENT_28_PROFILE.revocation_schema
      && revocationState.district === EXPERIMENT_28_PROFILE.district
      && Array.isArray(revocationState.revoked)
      && revocationState.revoked.every((entry) => typeof entry === "string" && HEX64.test(entry))
      && revocationState.revoked.every((entry, index, list) => index === 0 || list[index - 1] < entry),
    "REVOCATION_STATE_INVALID",
    "state is malformed or not sorted-unique",
  );
  ensure(!revocationState.revoked.includes(id), "REVOKED", id);
}

// Fixture ownership only. Evidence must declare itself TEST_KEY_FIXTURE and be
// pinned to the exact evaluation height; it is never treated as live ownership.
function checkOwnership(payload, request, evidence) {
  ensure(isPlainObject(evidence), "OWNERSHIP_EVIDENCE_UNAVAILABLE", "no evidence supplied");
  ensure(
    hasExactKeys(evidence, ["source", "tip", "inscriptions"])
      && hasExactKeys(evidence.tip, ["height", "block_hash"])
      && isSafeHeight(evidence.tip.height)
      && typeof evidence.tip.block_hash === "string"
      && HEX64.test(evidence.tip.block_hash)
      && isPlainObject(evidence.inscriptions),
    "INVALID_OWNERSHIP_EVIDENCE",
    "evidence shape",
  );
  ensure(
    EXPERIMENT_28_PROFILE.accepted_evidence_sources.includes(evidence.source),
    "UNSUPPORTED_EVIDENCE_SOURCE",
    "evidence source is not an accepted authority mode",
  );
  ensure(
    evidence.source === EXPERIMENT_28_PROFILE.authority_mode || isVerifiedOwnershipEvidence(evidence),
    "UNVERIFIED_EVIDENCE",
    "non-fixture evidence must be the exact object minted by the Experiment #31 evidence verifier",
  );
  ensure(
    !(evidence.source === EXPERIMENT_28_PROFILE.authority_mode
      && EXPERIMENT_28_PROFILE.known_real_holders.includes(payload.grantor.address)),
    "FIXTURE_CANNOT_AUTHORIZE_REAL_HOLDER",
    "a real District holder grant requires verified real evidence",
  );
  ensure(
    evidence.tip.height === request.evaluation_height,
    "OWNERSHIP_HEIGHT_MISMATCH",
    `${evidence.tip.height} !== ${request.evaluation_height}`,
  );
  const current = evidence.inscriptions[payload.district_inscription_id];
  ensure(current, "MISSING_OWNERSHIP_EVIDENCE", "district");
  ensure(
    hasExactKeys(current, [
      "inscription_id", "output", "address", "script_pubkey", "confirmed", "confirmation_height", "spent",
    ])
      && current.inscription_id === payload.district_inscription_id
      && typeof current.output === "string"
      && OUTPOINT.test(current.output)
      && isController({ address: current.address, script_pubkey: current.script_pubkey })
      && isSafeHeight(current.confirmation_height)
      && current.confirmation_height <= evidence.tip.height,
    "INVALID_OWNERSHIP_EVIDENCE",
    "district record",
  );
  ensure(current.confirmed === true, "UNCONFIRMED_OWNERSHIP", "district");
  ensure(current.spent === false, "SPENT_OWNERSHIP", "district");
  ensure(
    current.address === payload.grantor.address && current.script_pubkey === payload.grantor.script_pubkey,
    "OWNERSHIP_MISMATCH",
    "grantor is not the District holder in the evidence",
  );
}

function evidenceMode(evidence) {
  return isPlainObject(evidence)
    && (evidence.source === EXPERIMENT_28_PROFILE.authority_mode || isVerifiedOwnershipEvidence(evidence))
    ? evidence.source
    : EXPERIMENT_28_PROFILE.authority_mode;
}

function labels(mode = EXPERIMENT_28_PROFILE.authority_mode) {
  return {
    authority_mode: mode,
    revocation: EXPERIMENT_28_PROFILE.revocation,
  };
}

// request: { district, object_id, builder_address, evaluation_height }
// grant:   { message, signature } | null
export function authorizeBuild(request, grant, { ownershipEvidence, revocationState } = {}) {
  const mode = evidenceMode(ownershipEvidence);
  try {
    ensure(grant !== undefined && grant !== null, "NO_PERMISSION", "no grant supplied");
    validateRequest(request);
    ensure(
      hasExactKeys(grant, ["message", "signature"])
        && typeof grant.signature === "string"
        && grant.signature.length > 0
        && grant.signature.length <= MAX_SIGNATURE_LENGTH
        && !/\s/.test(grant.signature),
      "MESSAGE_MISMATCH",
      "grant shape",
    );
    const payload = parseGrantMessage(grant.message);
    const id = permissionId(grant.message);
    checkScope(payload, request);
    checkExpiry(payload, request);
    checkRevocation(revocationState, id);
    checkOwnership(payload, request, ownershipEvidence);
    ensure(
      verifyBip322P2TR(payload.grantor.address, grant.message, grant.signature),
      "INVALID_SIGNATURE",
      "BIP-322 signature is not valid for the grantor",
    );
    return {
      result: "ALLOW",
      code: "DELEGATED_BUILD_PERMITTED",
      permission_id: id,
      district: payload.district,
      object_id: payload.object_id,
      builder: payload.grantee.address,
      grantor: payload.grantor.address,
      evaluation_height: request.evaluation_height,
      expires_at_height: payload.expires_at_height,
      ...labels(mode),
    };
  } catch (error) {
    return {
      result: "DENY",
      code: error instanceof Denial ? error.code : "VERIFICATION_ERROR",
      reason: error instanceof Denial ? error.reason : String(error?.message ?? error),
      ...labels(mode),
    };
  }
}
