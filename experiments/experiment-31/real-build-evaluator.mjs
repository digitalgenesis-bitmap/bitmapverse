// Bitmapverse — Experiment #31: first real, narrowly scoped build evaluation.
//
// Composition only:
//   1. ownership-evidence.mjs verifies the pinned two-provider capture and
//      Experiment #29's frozen evidence, and mints verified evidence;
//   2. Experiment #30 must confirm issuer authority at the grant's snapshot;
//   3. Experiment #28's authorizeBuild decides the permission (scope, expiry,
//      revocation, ownership at height, grantor signature).
//
// Not claimed: consensus-verified ownership, on-chain enforcement, interoperable
// revocation. Offline and deterministic; no network, no clock, no wallet.

import { EXPERIMENT_28_PROFILE, authorizeBuild } from "../experiment-28/permission-verifier.mjs";
import { EXPERIMENT_30_PROFILE, verifyIssuerAuthority } from "../experiment-30/issuer-authority-gate.mjs";
import {
  EvidenceError,
  PINNED_CAPTURE_SHA256,
  deriveOwnershipEvidence,
  loadCurrentCapture,
} from "./ownership-evidence.mjs";

export { PINNED_CAPTURE_SHA256, loadCurrentCapture };

export const EXPERIMENT_31_PROFILE = Object.freeze({
  real_source: "REAL_PROVIDER_CORROBORATED",
  synthetic_source: "SYNTHETIC_TEST_CAPTURE",
  real_classification: "CURRENT_AT_CAPTURE_TIP / ARCHIVED_INDEXER_LOCATION / BITCOIN_PROVIDER_CORROBORATED",
});

class Blocked extends Error {
  constructor(code, reason) {
    super(`${code}: ${reason}`);
    this.code = code;
    this.reason = reason;
  }
}

function ensure(condition, code, reason) {
  if (!condition) throw new Blocked(code, reason);
}

const LIMITATIONS = Object.freeze([
  "Ownership at the evaluation height rests on two third-party Esplora providers, not a local full node.",
  "The inscription's location in the output is Experiment #29's archived two-indexer observation; no sat-flow reconstruction.",
  "Tip and outspend were read in separate requests (about one second apart); a later unspent read implies unspent at the earlier tip, barring a reorganization.",
  "Revocation is LOCAL_ONLY; nothing is enforced on-chain.",
  "ALLOW applies only to this grant, builder, object and District at the evaluation height.",
]);

// request: { district, object_id, builder_address, evaluation_height } — evaluation_height must equal the capture tip.
export async function evaluateRealBuild(request, grant, {
  revocationState,
  capture,
  expectedHashes = PINNED_CAPTURE_SHA256,
} = {}) {
  const base = { consensus_verified: false, on_chain_enforcement: false, revocation: EXPERIMENT_28_PROFILE.revocation };
  try {
    const { evidence, observed, historical } = await deriveOwnershipEvidence({ capture, expectedHashes });

    ensure(request !== null && typeof request === "object", "INVALID_REQUEST", "request");
    ensure(
      request.evaluation_height === observed.tip_height,
      "EVALUATION_HEIGHT_NOT_OBSERVED",
      `ownership was observed at ${observed.tip_height}, not ${request.evaluation_height}`,
    );

    const issuer = await verifyIssuerAuthority(grant, { mode: "EXP29_FROZEN" });
    ensure(issuer.result === EXPERIMENT_30_PROFILE.real_positive, "ISSUER_AUTHORITY_DENIED", String(issuer.code));

    const policy = authorizeBuild(request, grant, { ownershipEvidence: evidence, revocationState });
    const allowed = policy.result === "ALLOW";
    return {
      result: policy.result,
      ...(allowed ? {} : { code: policy.code, reason: policy.reason }),
      evidence_source: evidence.source,
      classification: allowed && observed.pinned ? EXPERIMENT_31_PROFILE.real_classification : null,
      evaluation_height: observed.tip_height,
      evaluation_block_hash: observed.tip_hash,
      holder: historical.holder_address,
      issuer_authority: issuer.result,
      permission_id: issuer.permission_id,
      policy_authority_mode: policy.authority_mode,
      ...base,
      ...(allowed ? { limitations: [...LIMITATIONS] } : {}),
    };
  } catch (error) {
    const known = error instanceof Blocked || error instanceof EvidenceError;
    return {
      result: "DENY",
      code: known ? error.code : "VERIFICATION_ERROR",
      reason: known ? error.reason : String(error?.message ?? error),
      evidence_source: null,
      classification: null,
      ...base,
    };
  }
}
