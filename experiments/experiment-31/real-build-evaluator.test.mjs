import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { p2trScriptPubKey } from "../experiment-1/resolvers/resolver-js.mjs";
import { EXPERIMENT_28_PROFILE, grantMessage, permissionId } from "../experiment-28/permission-verifier.mjs";
import { EXPERIMENT_29_PROFILE } from "../experiment-29/ownership-evaluator.mjs";
import {
  EXPERIMENT_31_PROFILE,
  PINNED_CAPTURE_SHA256,
  evaluateRealBuild,
  loadCurrentCapture,
} from "./real-build-evaluator.mjs";

const TXID = EXPERIMENT_29_PROFILE.txid;
const controller = (address) => ({ address, script_pubkey: p2trScriptPubKey(address).toString("hex") });
const OWNER = controller("bc1psphv4vlce9f37zqc7jt8w3gnynfxxh3zmjuvxpqv0vjs3t3mcdesyfk5tk");
const BUILDER = controller("bc1pv40yl4jyne02pulahpdrl98d2x3z9yd7g3c9kzm4ktyz69mdwe2qhmmrqz");

// The real grant signed by the owner wallet (UniSat, BIP-322 Simple), verified in Experiment #30.
const MESSAGE = grantMessage({
  schema: EXPERIMENT_28_PROFILE.schema,
  district: "937336.bitmap",
  district_inscription_id: EXPERIMENT_28_PROFILE.district_inscription_id,
  authority_snapshot: { height: 972169, block_hash: "00000000000000000000634ef8bc8d9e4d893a836896b62a3e9bab888dd8bbf7" },
  grantor: OWNER,
  grantee: BUILDER,
  action: "build",
  object_id: "inert-test-object-001",
  expires_at_height: 976201,
  nonce: "cf87497d4c3ceac199fe773fb05dd6dd0c1d9b400cd89f364418c943d4cb9cfc",
});
const GRANT = Object.freeze({
  message: MESSAGE,
  signature: "AUBTQqumuDdg50A1TuQFfi0Hw4oEH2PA2SG5BtALOzQ5mD7+AANZkPMcs2LLY4hsrEFRx8yxFw3q6gtNGJji8m4A",
});
const PERMISSION_ID = "35bf794a2097a30cc22e6e239b767bba9c5ea56fe29063b821c1b8d774007b46";
const TIP = 973822;

const request = (overrides = {}) => ({
  district: "937336.bitmap",
  object_id: "inert-test-object-001",
  builder_address: BUILDER.address,
  evaluation_height: TIP,
  ...overrides,
});
const revocations = (revoked = []) => ({ schema: EXPERIMENT_28_PROFILE.revocation_schema, district: "937336.bitmap", revoked });

const pinned = await loadCurrentCapture();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Synthetic capture: both providers report the given tip/outspend. Never pinned, so never labelled real.
function synthetic({ height = TIP, hash = "1".repeat(64), outspend = '{"spent":false}', mempool = {} } = {}) {
  const capture = {};
  for (const provider of EXPERIMENT_29_PROFILE.providers) {
    const values = provider === "mempool.space" ? { height, hash, outspend, ...mempool } : { height, hash, outspend };
    capture[`bitcoin-capture/${provider}.blocks_tip_height`] = Buffer.from(String(values.height));
    capture[`bitcoin-capture/${provider}.blocks_tip_hash`] = Buffer.from(values.hash);
    capture[`bitcoin-capture/${provider}.tx_${TXID}_outspend_15`] = Buffer.from(values.outspend);
  }
  const expectedHashes = Object.fromEntries(Object.entries(capture).map(([path, bytes]) => [path, sha256(bytes)]));
  return { capture, expectedHashes };
}

function assertDeny(result, code) {
  assert.equal(result.result, "DENY", JSON.stringify(result));
  assert.equal(result.code, code, JSON.stringify(result));
  assert.equal(result.classification, null);
  assert.equal(result.consensus_verified, false);
  assert.equal(result.on_chain_enforcement, false);
}

test("grant bytes are the signed 845-byte grant", () => {
  assert.equal(Buffer.byteLength(MESSAGE, "utf8"), 845);
  assert.equal(permissionId(MESSAGE), PERMISSION_ID);
});

test("POSITIVE: real grant, real capture at 973822 → ALLOW (provider-corroborated, LOCAL_ONLY)", async () => {
  const result = await evaluateRealBuild(request(), GRANT, { revocationState: revocations() });
  assert.equal(result.result, "ALLOW", JSON.stringify(result));
  assert.equal(result.evidence_source, "REAL_PROVIDER_CORROBORATED");
  assert.equal(result.policy_authority_mode, "REAL_PROVIDER_CORROBORATED");
  assert.equal(result.classification, EXPERIMENT_31_PROFILE.real_classification);
  assert.equal(result.evaluation_height, TIP);
  assert.equal(result.evaluation_block_hash, "0000000000000000000098554e1a8018b5413e9c1dbdd3eb0d41902c27182dc6");
  assert.equal(result.holder, OWNER.address);
  assert.equal(result.issuer_authority, "ISSUER_WAS_HISTORICAL_HOLDER_AT_SNAPSHOT");
  assert.equal(result.permission_id, PERMISSION_ID);
  assert.equal(result.revocation, "LOCAL_ONLY");
  assert.equal(result.consensus_verified, false);
  assert.equal(result.on_chain_enforcement, false);
  assert.deepEqual(await evaluateRealBuild(request(), GRANT, { revocationState: revocations() }), result, "deterministic");
});

test("wrong builder → DENY WRONG_SCOPE", async () => {
  const other = "bc1pupqk7jjtm7mucm9uvr2324c8jpm467ncgsy5zwe0g8szt906jk7s08k5jq";
  const result = await evaluateRealBuild(request({ builder_address: other }), GRANT, { revocationState: revocations() });
  assertDeny(result, "WRONG_SCOPE");
  assert.equal(result.reason, "builder");
});

test("wrong object → DENY WRONG_SCOPE", async () => {
  const result = await evaluateRealBuild(request({ object_id: "inert-test-object-002" }), GRANT, { revocationState: revocations() });
  assertDeny(result, "WRONG_SCOPE");
  assert.equal(result.reason, "object");
});

test("expired grant (synthetic tip 976201) → DENY EXPIRED; 976200 allowed but never labelled real", async () => {
  const atExpiry = synthetic({ height: 976201 });
  assertDeny(await evaluateRealBuild(request({ evaluation_height: 976201 }), GRANT, { revocationState: revocations(), ...atExpiry }), "EXPIRED");

  const lastBlock = synthetic({ height: 976200 });
  const result = await evaluateRealBuild(request({ evaluation_height: 976200 }), GRANT, { revocationState: revocations(), ...lastBlock });
  assert.equal(result.result, "ALLOW");
  assert.equal(result.evidence_source, "SYNTHETIC_TEST_CAPTURE");
  assert.equal(result.policy_authority_mode, "SYNTHETIC_TEST_CAPTURE");
  assert.equal(result.classification, null);
});

test("revoked grant → DENY REVOKED; missing revocation state → DENY REVOCATION_STATE_UNAVAILABLE", async () => {
  assertDeny(await evaluateRealBuild(request(), GRANT, { revocationState: revocations([PERMISSION_ID]) }), "REVOKED");
  assertDeny(await evaluateRealBuild(request(), GRANT, {}), "REVOCATION_STATE_UNAVAILABLE");
});

test("insufficient ownership evidence → fail closed", async () => {
  const opts = (extra) => ({ revocationState: revocations(), ...extra });
  assertDeny(await evaluateRealBuild(request(), GRANT, opts(synthetic({ outspend: '{"spent":true}' }))), "OUTPUT_SPENT_AT_CAPTURE");
  assertDeny(await evaluateRealBuild(request(), GRANT, opts(synthetic({ outspend: '{"spent"}' }))), "MALFORMED_CAPTURE");
  assertDeny(await evaluateRealBuild(request(), GRANT, opts(synthetic({ mempool: { height: TIP + 1 } }))), "PROVIDER_DISAGREEMENT");
  assertDeny(await evaluateRealBuild(request(), GRANT, opts(synthetic({ height: 973900 }))), "EVALUATION_HEIGHT_NOT_OBSERVED");
  assertDeny(await evaluateRealBuild(request({ evaluation_height: 973730 }), GRANT, opts(synthetic({ height: 973730 }))), "CAPTURE_OLDER_THAN_HISTORICAL_EVIDENCE");

  const missing = { ...pinned };
  delete missing[`bitcoin-capture/blockstream.info.tx_${TXID}_outspend_15`];
  assertDeny(await evaluateRealBuild(request(), GRANT, opts({ capture: missing })), "MISSING_CAPTURE");

  const tampered = { ...pinned, "bitcoin-capture/mempool.space.blocks_tip_height": Buffer.from("973823") };
  assertDeny(await evaluateRealBuild(request(), GRANT, opts({ capture: tampered })), "HASH_MISMATCH");

  assertDeny(await evaluateRealBuild(request({ evaluation_height: TIP + 1 }), GRANT, opts()), "EVALUATION_HEIGHT_NOT_OBSERVED");
});

test("invalid signature → DENY ISSUER_AUTHORITY_DENIED", async () => {
  const forged = { ...GRANT, signature: `${GRANT.signature.slice(0, 10)}${GRANT.signature[10] === "A" ? "B" : "A"}${GRANT.signature.slice(11)}` };
  const result = await evaluateRealBuild(request(), forged, { revocationState: revocations() });
  assertDeny(result, "ISSUER_AUTHORITY_DENIED");
});

// ---- Trust boundary: direct calls to Experiment #28 ----

const { authorizeBuild } = await import("../experiment-28/permission-verifier.mjs");
const { deriveOwnershipEvidence, isVerifiedOwnershipEvidence } = await import("./ownership-evidence.mjs");
const INSCRIPTION = EXPERIMENT_28_PROFILE.district_inscription_id;

function forgedEvidence(source, height = 975000) {
  return {
    source,
    tip: { height, block_hash: "9".repeat(64) },
    inscriptions: {
      [INSCRIPTION]: {
        inscription_id: INSCRIPTION,
        output: `${TXID}:15`,
        address: OWNER.address,
        script_pubkey: OWNER.script_pubkey,
        confirmed: true,
        confirmation_height: 942807,
        spent: false,
      },
    },
  };
}

test("ADVERSARIAL: direct authorizeBuild with forged REAL / SYNTHETIC evidence → DENY UNVERIFIED_EVIDENCE", () => {
  for (const source of ["REAL_PROVIDER_CORROBORATED", "SYNTHETIC_TEST_CAPTURE"]) {
    const result = authorizeBuild(request({ evaluation_height: 975000 }), GRANT, {
      ownershipEvidence: forgedEvidence(source),
      revocationState: revocations(),
    });
    assert.equal(result.result, "DENY", source);
    assert.equal(result.code, "UNVERIFIED_EVIDENCE", source);
    assert.notEqual(result.authority_mode, source, "a forged label is never echoed");
  }
});

test("ADVERSARIAL: copies, proxies and mutations of verified evidence are refused", async () => {
  const { evidence } = await deriveOwnershipEvidence();
  assert.equal(isVerifiedOwnershipEvidence(evidence), true);
  assert.equal(Object.isFrozen(evidence.inscriptions[INSCRIPTION]), true);
  assert.throws(() => { evidence.tip.height = 975000; }, TypeError);
  assert.throws(() => { evidence.inscriptions[INSCRIPTION].address = BUILDER.address; }, TypeError);

  const copy = structuredClone(evidence);
  const proxy = new Proxy(evidence, {});
  for (const candidate of [copy, proxy]) {
    const result = authorizeBuild(request(), GRANT, { ownershipEvidence: candidate, revocationState: revocations() });
    assert.equal(result.result, "DENY");
    assert.equal(result.code, "UNVERIFIED_EVIDENCE");
  }
});

test("BOUNDARY: verified evidence passed directly to Experiment #28 → ALLOW labelled REAL", async () => {
  const { evidence } = await deriveOwnershipEvidence();
  const result = authorizeBuild(request(), GRANT, { ownershipEvidence: evidence, revocationState: revocations() });
  assert.equal(result.result, "ALLOW");
  assert.equal(result.authority_mode, "REAL_PROVIDER_CORROBORATED");
  assert.equal(result.revocation, "LOCAL_ONLY");
});

test("ADVERSARIAL: real-holder grant + TEST_KEY_FIXTURE evidence → DENY FIXTURE_CANNOT_AUTHORIZE_REAL_HOLDER", () => {
  const fixture = { ...forgedEvidence("TEST_KEY_FIXTURE", TIP) };
  const result = authorizeBuild(request(), GRANT, { ownershipEvidence: fixture, revocationState: revocations() });
  assert.equal(result.result, "DENY");
  assert.equal(result.code, "FIXTURE_CANNOT_AUTHORIZE_REAL_HOLDER");
  assert.equal(result.authority_mode, "TEST_KEY_FIXTURE");
});

test("pinned capture manifest names exactly the six frozen files", () => {
  assert.equal(Object.keys(PINNED_CAPTURE_SHA256).length, 6);
  for (const [path, hash] of Object.entries(PINNED_CAPTURE_SHA256)) assert.equal(sha256(pinned[path]), hash, path);
});
