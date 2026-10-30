// Bitmapverse — Experiment #30: Snapshot-Bound Issuer Authority Gate.
//
// Question answered: was the signer of a delegated build grant the holder of
// 937336.bitmap at the grant's authority snapshot?
//
// Questions NOT answered (every result says so explicitly):
// - Does the issuer hold the District now?            current_ownership: false
// - Is the build permission valid (scope, expiry,
//   revocation, builder)? That stays with Exp #28.    build_permission_decided: false
// - Is anything operationally permitted?             operational_permission: false
//
// Offline and deterministic. No network, no clock, no wallet, no new signatures.
// Reuses unchanged: Exp #1 BIP-322 primitives, Exp #28 grant canonicalization,
// Exp #29 frozen historical ownership evaluator.

import { p2trScriptPubKey, verifyBip322P2TR } from "../experiment-1/resolvers/resolver-js.mjs";
import {
  EXPERIMENT_28_PROFILE,
  canonicalGrantPayload,
  grantMessage,
  permissionId,
} from "../experiment-28/permission-verifier.mjs";
import {
  EXPERIMENT_29_PROFILE,
  evaluateHistoricalOwnership,
  loadFrozenEvidence,
} from "../experiment-29/ownership-evaluator.mjs";

export const EXPERIMENT_30_PROFILE = Object.freeze({
  modes: Object.freeze(["EXP29_FROZEN", "TEST_KEY_FIXTURE"]),
  real_positive: "ISSUER_WAS_HISTORICAL_HOLDER_AT_SNAPSHOT",
  fixture_positive: "FIXTURE_ISSUER_MATCH",
  fixture_source: "TEST_KEY_FIXTURE",
  exp29_classification: EXPERIMENT_29_PROFILE.classification,
  real_historical_holder: EXPERIMENT_29_PROFILE.expected_controller,
});

const HEX64 = /^[0-9a-f]{64}$/;
const MAX_SIGNATURE_LENGTH = 4096;

const CLAIM_FLAGS = Object.freeze({
  current_ownership: false,
  build_permission_decided: false,
  operational_permission: false,
});

const LIMITATIONS = Object.freeze([
  "Issuer authority is evaluated only at the grant's authority snapshot, never at the present.",
  "Build permission validity (scope, expiry, revocation, builder) is not decided here; see Experiment #28.",
  "EXP29_FROZEN authority inherits Experiment #29's limits: archived indexer location, provider-corroborated Bitcoin facts, no sat-flow reconstruction, no full-node validation.",
  "TEST_KEY_FIXTURE results describe deterministic test keys, not any real District holder.",
]);

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

function isSnapshot(value) {
  return hasExactKeys(value, ["height", "block_hash"])
    && Number.isSafeInteger(value.height) && value.height >= 0
    && typeof value.block_hash === "string" && HEX64.test(value.block_hash);
}

function isController(value) {
  if (!hasExactKeys(value, ["address", "script_pubkey"])) return false;
  if (typeof value.address !== "string" || typeof value.script_pubkey !== "string") return false;
  try {
    return p2trScriptPubKey(value.address).toString("hex") === value.script_pubkey;
  } catch {
    return false;
  }
}

// ---- Check 1: canonical grant message (Exp #28 canonicalization, unchanged) ----

function parseGrant(grant) {
  ensure(grant !== undefined && grant !== null, "NO_GRANT", "no grant supplied");
  ensure(
    hasExactKeys(grant, ["message", "signature"])
      && typeof grant.message === "string"
      && typeof grant.signature === "string"
      && grant.signature.length > 0
      && grant.signature.length <= MAX_SIGNATURE_LENGTH
      && !/\s/.test(grant.signature),
    "MALFORMED_GRANT",
    "grant must be { message, signature } with a non-empty, whitespace-free signature",
  );
  const { message, signature } = grant;
  const { domain, schema } = EXPERIMENT_28_PROFILE;
  ensure(message.startsWith(domain), "MESSAGE_MISMATCH", "wrong domain");
  ensure(
    !message.includes("\r") && !message.endsWith("\n") && message.split("\n").length === 2,
    "MESSAGE_MISMATCH",
    "line structure is not canonical",
  );
  let payload;
  try {
    payload = JSON.parse(message.slice(domain.length));
  } catch {
    throw new Denial("MESSAGE_MISMATCH", "payload is not JSON");
  }
  ensure(isPlainObject(payload), "MESSAGE_MISMATCH", "payload is not an object");
  let canonical;
  let canonicalKeys;
  try {
    canonical = grantMessage(payload);
    canonicalKeys = Object.keys(canonicalGrantPayload(payload));
  } catch {
    throw new Denial("MESSAGE_MISMATCH", "payload cannot be canonicalized");
  }
  ensure(hasExactKeys(payload, canonicalKeys), "MESSAGE_MISMATCH", "missing or unknown grant fields");
  ensure(canonical === message, "MESSAGE_MISMATCH", "bytes are not canonical");
  ensure(payload.schema === schema, "MESSAGE_MISMATCH", "unknown schema");
  ensure(isSnapshot(payload.authority_snapshot), "MESSAGE_MISMATCH", "invalid authority_snapshot");
  ensure(isController(payload.grantor), "MESSAGE_MISMATCH", "invalid grantor controller");
  return { payload, message, signature };
}

// ---- Check 4: authority source ----

async function historicalAuthority(exp29Evidence) {
  const evidence = exp29Evidence === undefined ? await loadFrozenEvidence() : exp29Evidence;
  const result = evaluateHistoricalOwnership(evidence);
  ensure(result?.result === "HISTORICAL_HOLDER", "AUTHORITY_EVIDENCE_REJECTED", String(result?.code));
  ensure(
    result.classification === EXPERIMENT_29_PROFILE.classification
      && result.independent_ordinal_reconstruction === false
      && result.full_node_validation === false
      && result.delegated_building_authority === false,
    "AUTHORITY_EVIDENCE_REJECTED",
    "unexpected Experiment #29 classification",
  );
  return {
    classification: result.classification,
    district: result.district,
    district_inscription_id: result.district_inscription_id,
    snapshot: { height: result.height, block_hash: result.block_hash },
    holder: { address: result.holder_address, script_pubkey: result.holder_script_pubkey },
  };
}

function fixtureAuthority(fixture) {
  ensure(fixture !== undefined && fixture !== null, "MISSING_AUTHORITY_EVIDENCE", "no fixture supplied");
  ensure(
    hasExactKeys(fixture, ["source", "district_inscription_id", "authority_snapshot", "holder"])
      && fixture.source === EXPERIMENT_30_PROFILE.fixture_source
      && typeof fixture.district_inscription_id === "string"
      && isSnapshot(fixture.authority_snapshot)
      && isController(fixture.holder),
    "INVALID_FIXTURE",
    "fixture must be exactly { source: TEST_KEY_FIXTURE, district_inscription_id, authority_snapshot, holder }",
  );
  ensure(
    fixture.holder.address !== EXPERIMENT_30_PROFILE.real_historical_holder,
    "FIXTURE_CLAIMS_REAL_HOLDER",
    "a fixture may not present the real historical holder",
  );
  return {
    classification: EXPERIMENT_30_PROFILE.fixture_source,
    district: EXPERIMENT_28_PROFILE.district,
    district_inscription_id: fixture.district_inscription_id,
    snapshot: { ...fixture.authority_snapshot },
    holder: { ...fixture.holder },
  };
}

// ---- Gate ----

export async function verifyIssuerAuthority(grant, options = {}) {
  const mode = isPlainObject(options) ? options.mode : undefined;
  const knownMode = EXPERIMENT_30_PROFILE.modes.includes(mode) ? mode : null;
  try {
    ensure(isPlainObject(options), "INVALID_OPTIONS", "options must be an object");
    ensure(knownMode !== null, "UNKNOWN_MODE", String(mode));
    const allowed = knownMode === "EXP29_FROZEN" ? ["mode", "exp29Evidence"] : ["mode", "fixture"];
    ensure(
      Object.keys(options).every((key) => allowed.includes(key)),
      "AMBIGUOUS_AUTHORITY_INPUT",
      `mode ${knownMode} accepts only: ${allowed.join(", ")}`,
    );

    // 1. Canonical grant message.
    const { payload, message, signature } = parseGrant(grant);

    // 2. District and inscription scope.
    ensure(
      payload.district === EXPERIMENT_28_PROFILE.district
        && payload.district_inscription_id === EXPERIMENT_28_PROFILE.district_inscription_id,
      "WRONG_SCOPE",
      "grant District or inscription",
    );

    // 4. Authority source (evaluated before comparison so evidence failures surface first).
    const authority = knownMode === "EXP29_FROZEN"
      ? await historicalAuthority(options.exp29Evidence)
      : fixtureAuthority(options.fixture);
    ensure(
      authority.district === payload.district
        && authority.district_inscription_id === payload.district_inscription_id,
      "WRONG_SCOPE",
      "authority District or inscription",
    );

    // 3. Exact authority snapshot height and block hash.
    ensure(
      payload.authority_snapshot.height === authority.snapshot.height
        && payload.authority_snapshot.block_hash === authority.snapshot.block_hash,
      "SNAPSHOT_NOT_COVERED",
      `grant snapshot ${payload.authority_snapshot.height} is not the authority snapshot ${authority.snapshot.height}`,
    );

    // 5. Grantor address and scriptPubKey match the authority holder.
    ensure(
      payload.grantor.address === authority.holder.address
        && payload.grantor.script_pubkey === authority.holder.script_pubkey,
      knownMode === "EXP29_FROZEN" ? "ISSUER_NOT_HISTORICAL_HOLDER" : "ISSUER_NOT_FIXTURE_HOLDER",
      payload.grantor.address,
    );

    // 6. BIP-322 signature over the exact grant bytes.
    ensure(
      verifyBip322P2TR(payload.grantor.address, message, signature),
      "INVALID_SIGNATURE",
      "BIP-322 signature is not valid for the grantor over the exact grant bytes",
    );

    return {
      result: knownMode === "EXP29_FROZEN" ? EXPERIMENT_30_PROFILE.real_positive : EXPERIMENT_30_PROFILE.fixture_positive,
      mode: knownMode,
      authority_classification: authority.classification,
      district: payload.district,
      district_inscription_id: payload.district_inscription_id,
      authority_snapshot: { ...authority.snapshot },
      issuer: payload.grantor.address,
      permission_id: permissionId(message),
      ...CLAIM_FLAGS,
      limitations: [...LIMITATIONS],
    };
  } catch (error) {
    return {
      result: "DENY",
      code: error instanceof Denial ? error.code : "VERIFICATION_ERROR",
      reason: error instanceof Denial ? error.reason : String(error?.message ?? error),
      mode: knownMode,
      authority_classification: null,
      ...CLAIM_FLAGS,
    };
  }
}
