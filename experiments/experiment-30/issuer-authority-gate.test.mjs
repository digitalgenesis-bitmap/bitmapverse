import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { EXPERIMENT_28_PROFILE, grantMessage, permissionId } from "../experiment-28/permission-verifier.mjs";
import { EXPERIMENT_29_PROFILE, loadFrozenEvidence } from "../experiment-29/ownership-evaluator.mjs";
import { controllerForSecret, signBip322 } from "../experiment-1/tests/test-support.mjs";
import { EXPERIMENT_30_PROFILE, verifyIssuerAuthority } from "./issuer-authority-gate.mjs";

// Deterministic test keys. None of them is the real 937336.bitmap holder.
const FIXTURE_HOLDER_SECRET = 29n;
const BUILDER_SECRET = 31n;
const OTHER_SECRET = 37n;
const fixtureHolder = controllerForSecret(FIXTURE_HOLDER_SECRET);
const builder = controllerForSecret(BUILDER_SECRET);
const otherKey = controllerForSecret(OTHER_SECRET);

// Real historical holder from Experiment #29 (public address; no key available here).
const REAL_HOLDER = Object.freeze({
  address: "bc1psphv4vlce9f37zqc7jt8w3gnynfxxh3zmjuvxpqv0vjs3t3mcdesyfk5tk",
  script_pubkey: "5120806ecab3f8c9531f0818f49677451324d2635e22dcb8c3040c7b2508ae3bc373",
});
const REAL_SNAPSHOT = Object.freeze({
  height: 972169,
  block_hash: "00000000000000000000634ef8bc8d9e4d893a836896b62a3e9bab888dd8bbf7",
});
const FIXTURE_SNAPSHOT = Object.freeze({ height: 972300, block_hash: "f".repeat(64) }); // synthetic
const INSCRIPTION = EXPERIMENT_28_PROFILE.district_inscription_id;

const FIXTURE = Object.freeze({
  source: "TEST_KEY_FIXTURE",
  district_inscription_id: INSCRIPTION,
  authority_snapshot: FIXTURE_SNAPSHOT,
  holder: fixtureHolder,
});

function makePayload({ grantor, snapshot, district = "937336.bitmap", inscription = INSCRIPTION }) {
  return {
    schema: EXPERIMENT_28_PROFILE.schema,
    district,
    district_inscription_id: inscription,
    authority_snapshot: { ...snapshot },
    grantor: { ...grantor },
    grantee: { ...builder },
    action: "build",
    object_id: "test-object-001",
    expires_at_height: snapshot.height + 2016,
    nonce: "2".repeat(64),
  };
}

function signedGrant({ secret, ...options }) {
  const message = grantMessage(makePayload(options));
  return { message, signature: signBip322(secret, options.grantor.address, message) };
}

const REAL = { mode: "EXP29_FROZEN" };
const FIX = { mode: "TEST_KEY_FIXTURE", fixture: FIXTURE };

const observed = [];
async function run(grant, options) {
  const result = await verifyIssuerAuthority(grant, options);
  observed.push({ options: options?.mode, result });
  return result;
}

function assertDeny(result, code) {
  assert.equal(result.result, "DENY", JSON.stringify(result));
  assert.equal(result.code, code, JSON.stringify(result));
  assert.equal(result.authority_classification, null);
}

// ---- 1. Real evidence rejects a test-key grantor ----

test("1. EXP29_FROZEN: test-key grantor at the real snapshot → ISSUER_NOT_HISTORICAL_HOLDER", async () => {
  const grant = signedGrant({ secret: FIXTURE_HOLDER_SECRET, grantor: fixtureHolder, snapshot: REAL_SNAPSHOT });
  assertDeny(await run(grant, REAL), "ISSUER_NOT_HISTORICAL_HOLDER");
});

// ---- 2. Real holder address with a test-key signature ----

test("2. EXP29_FROZEN: real holder as grantor, signed by a test key → INVALID_SIGNATURE", async () => {
  for (const secret of [FIXTURE_HOLDER_SECRET, BUILDER_SECRET, OTHER_SECRET]) {
    const grant = signedGrant({ secret, grantor: REAL_HOLDER, snapshot: REAL_SNAPSHOT });
    assertDeny(await run(grant, REAL), "INVALID_SIGNATURE");
  }
});

// ---- 3. Snapshot height or hash mismatch ----

test("3. snapshot height or block hash mismatch → SNAPSHOT_NOT_COVERED (both modes)", async () => {
  const wrongHeight = { ...REAL_SNAPSHOT, height: 972170 };
  const wrongHash = { ...REAL_SNAPSHOT, block_hash: "1".repeat(64) };
  for (const snapshot of [wrongHeight, wrongHash]) {
    const grant = signedGrant({ secret: FIXTURE_HOLDER_SECRET, grantor: REAL_HOLDER, snapshot });
    assertDeny(await run(grant, REAL), "SNAPSHOT_NOT_COVERED");
  }
  const fixtureMismatch = signedGrant({ secret: FIXTURE_HOLDER_SECRET, grantor: fixtureHolder, snapshot: REAL_SNAPSHOT });
  assertDeny(await run(fixtureMismatch, FIX), "SNAPSHOT_NOT_COVERED");
});

// ---- 4. Experiment #23 signature replay ----

const exp23 = JSON.parse(readFileSync(new URL("../experiment-23/public-authorization-artifact.v0.1.json", import.meta.url), "utf8"));

test("4a. Experiment #23 message and real District signature replayed as a grant → MESSAGE_MISMATCH", async () => {
  const grant = { message: exp23.message.text, signature: exp23.signatures.district.signature };
  assertDeny(await run(grant, REAL), "MESSAGE_MISMATCH");
});

test("4b. real Experiment #23 District signature attached to a real-holder grant → INVALID_SIGNATURE", async () => {
  const message = grantMessage(makePayload({ grantor: REAL_HOLDER, snapshot: REAL_SNAPSHOT }));
  const grant = { message, signature: exp23.signatures.district.signature };
  assertDeny(await run(grant, REAL), "INVALID_SIGNATURE");
});

// ---- 5. Tampered historical evidence ----

test("5. tampered, missing or absent Experiment #29 evidence → AUTHORITY_EVIDENCE_REJECTED", async () => {
  const grant = signedGrant({ secret: FIXTURE_HOLDER_SECRET, grantor: REAL_HOLDER, snapshot: REAL_SNAPSHOT });
  const frozen = await loadFrozenEvidence();

  const tampered = { ...frozen };
  const key = Object.keys(tampered).find((path) => path.endsWith("blocks_tip_height"));
  tampered[key] = Buffer.from("973732");
  const t = await run(grant, { mode: "EXP29_FROZEN", exp29Evidence: tampered });
  assertDeny(t, "AUTHORITY_EVIDENCE_REJECTED");
  assert.equal(t.reason, "HASH_MISMATCH");

  const missing = { ...frozen };
  delete missing[key];
  const m = await run(grant, { mode: "EXP29_FROZEN", exp29Evidence: missing });
  assertDeny(m, "AUTHORITY_EVIDENCE_REJECTED");
  assert.equal(m.reason, "MISSING_EVIDENCE");

  assertDeny(await run(grant, { mode: "EXP29_FROZEN", exp29Evidence: null }), "AUTHORITY_EVIDENCE_REJECTED");
});

// ---- 6. Wrong District or inscription ----

test("6. wrong District or wrong inscription → WRONG_SCOPE (both modes)", async () => {
  const wrongDistrict = signedGrant({ secret: FIXTURE_HOLDER_SECRET, grantor: REAL_HOLDER, snapshot: REAL_SNAPSHOT, district: "937337.bitmap" });
  const wrongInscription = signedGrant({ secret: FIXTURE_HOLDER_SECRET, grantor: REAL_HOLDER, snapshot: REAL_SNAPSHOT, inscription: `${"a".repeat(64)}i0` });
  assertDeny(await run(wrongDistrict, REAL), "WRONG_SCOPE");
  assertDeny(await run(wrongInscription, REAL), "WRONG_SCOPE");

  const fixtureOtherInscription = { ...FIXTURE, district_inscription_id: `${"b".repeat(64)}i0` };
  const grant = signedGrant({ secret: FIXTURE_HOLDER_SECRET, grantor: fixtureHolder, snapshot: FIXTURE_SNAPSHOT });
  assertDeny(await run(grant, { mode: "TEST_KEY_FIXTURE", fixture: fixtureOtherInscription }), "WRONG_SCOPE");
});

// ---- 7. Valid local fixture ----

test("7. TEST_KEY_FIXTURE: fixture holder signs a canonical grant → FIXTURE_ISSUER_MATCH", async () => {
  const grant = signedGrant({ secret: FIXTURE_HOLDER_SECRET, grantor: fixtureHolder, snapshot: FIXTURE_SNAPSHOT });
  const result = await run(grant, FIX);
  assert.equal(result.result, "FIXTURE_ISSUER_MATCH");
  assert.equal(result.mode, "TEST_KEY_FIXTURE");
  assert.equal(result.authority_classification, "TEST_KEY_FIXTURE");
  assert.notEqual(result.authority_classification, EXPERIMENT_29_PROFILE.classification);
  assert.equal(result.issuer, fixtureHolder.address);
  assert.deepEqual(result.authority_snapshot, FIXTURE_SNAPSHOT);
  assert.equal(result.permission_id, permissionId(grant.message));
  assert.deepEqual(await verifyIssuerAuthority(grant, FIX), result, "deterministic");
});

// ---- 8. Different fixture key ----

test("8. TEST_KEY_FIXTURE: other key as grantor → ISSUER_NOT_FIXTURE_HOLDER; holder grant signed by other key → INVALID_SIGNATURE", async () => {
  const otherGrantor = signedGrant({ secret: OTHER_SECRET, grantor: otherKey, snapshot: FIXTURE_SNAPSHOT });
  assertDeny(await run(otherGrantor, FIX), "ISSUER_NOT_FIXTURE_HOLDER");
  const forged = signedGrant({ secret: OTHER_SECRET, grantor: fixtureHolder, snapshot: FIXTURE_SNAPSHOT });
  assertDeny(await run(forged, FIX), "INVALID_SIGNATURE");
});

// ---- Fail-closed: malformed input and evidence separation ----

test("malformed grants → NO_GRANT / MALFORMED_GRANT / MESSAGE_MISMATCH", async () => {
  const good = signedGrant({ secret: FIXTURE_HOLDER_SECRET, grantor: fixtureHolder, snapshot: FIXTURE_SNAPSHOT });
  assertDeny(await run(null, FIX), "NO_GRANT");
  assertDeny(await run({ ...good, extra: 1 }, FIX), "MALFORMED_GRANT");
  assertDeny(await run({ ...good, signature: ` ${good.signature}` }, FIX), "MALFORMED_GRANT");
  assertDeny(await run({ ...good, signature: "" }, FIX), "MALFORMED_GRANT");

  const payload = makePayload({ grantor: fixtureHolder, snapshot: FIXTURE_SNAPSHOT });
  const variants = [
    `${EXPERIMENT_28_PROFILE.domain}${JSON.stringify(payload, null, 1).replaceAll("\n", "")}`,
    `${EXPERIMENT_28_PROFILE.domain}${JSON.stringify({ ...payload, extra: true })}`,
    grantMessage((({ nonce, ...rest }) => rest)(payload)),
    grantMessage({ ...payload, schema: "other.schema" }),
    `${grantMessage(payload)}\n`,
    `${EXPERIMENT_28_PROFILE.domain}not-json`,
  ];
  for (const message of variants) {
    const grant = { message, signature: signBip322(FIXTURE_HOLDER_SECRET, fixtureHolder.address, message) };
    assertDeny(await run(grant, FIX), "MESSAGE_MISMATCH");
  }
});

test("options and evidence separation → UNKNOWN_MODE / AMBIGUOUS_AUTHORITY_INPUT / INVALID_OPTIONS", async () => {
  const grant = signedGrant({ secret: FIXTURE_HOLDER_SECRET, grantor: fixtureHolder, snapshot: FIXTURE_SNAPSHOT });
  assertDeny(await run(grant, {}), "UNKNOWN_MODE");
  assertDeny(await run(grant, { mode: "LIVE" }), "UNKNOWN_MODE");
  assertDeny(await run(grant, null), "INVALID_OPTIONS");
  assertDeny(await run(grant, { mode: "EXP29_FROZEN", fixture: FIXTURE }), "AMBIGUOUS_AUTHORITY_INPUT");
  assertDeny(await run(grant, { mode: "TEST_KEY_FIXTURE", fixture: FIXTURE, exp29Evidence: {} }), "AMBIGUOUS_AUTHORITY_INPUT");
});

test("fixture integrity → MISSING_AUTHORITY_EVIDENCE / INVALID_FIXTURE / FIXTURE_CLAIMS_REAL_HOLDER", async () => {
  const grant = signedGrant({ secret: FIXTURE_HOLDER_SECRET, grantor: fixtureHolder, snapshot: FIXTURE_SNAPSHOT });
  assertDeny(await run(grant, { mode: "TEST_KEY_FIXTURE" }), "MISSING_AUTHORITY_EVIDENCE");
  for (const fixture of [
    { ...FIXTURE, source: "EXP29_FROZEN" },
    { ...FIXTURE, classification: EXPERIMENT_29_PROFILE.classification },
    { ...FIXTURE, authority_snapshot: { height: 1 } },
    { ...FIXTURE, holder: { address: fixtureHolder.address, script_pubkey: otherKey.script_pubkey } },
  ]) {
    assertDeny(await run(grant, { mode: "TEST_KEY_FIXTURE", fixture }), "INVALID_FIXTURE");
  }
  const realHolderFixture = { ...FIXTURE, holder: REAL_HOLDER };
  const realHolderGrant = signedGrant({ secret: FIXTURE_HOLDER_SECRET, grantor: REAL_HOLDER, snapshot: FIXTURE_SNAPSHOT });
  assertDeny(await run(realHolderGrant, { mode: "TEST_KEY_FIXTURE", fixture: realHolderFixture }), "FIXTURE_CLAIMS_REAL_HOLDER");
});

// ---- 9. No result claims current ownership or build authorization ----

test("9. every observed result: no current ownership, no build decision, no operational permission; modes never cross labels", () => {
  assert.equal(observed.length, 39, "every gate call from tests 1–8 and the fail-closed tests is inspected");
  for (const { options, result } of observed) {
    assert.equal(result.current_ownership, false);
    assert.equal(result.build_permission_decided, false);
    assert.equal(result.operational_permission, false);
    assert.notEqual(result.result, EXPERIMENT_30_PROFILE.real_positive, "real positive must be unreachable with test keys");
    if (result.result === "FIXTURE_ISSUER_MATCH") {
      assert.equal(options, "TEST_KEY_FIXTURE");
      assert.equal(result.authority_classification, "TEST_KEY_FIXTURE");
    }
    if (options === "EXP29_FROZEN") assert.equal(result.result, "DENY");
  }
});

// ---- 10. Prior frozen implementations unchanged ----

test("10. reused implementations are byte-identical to their frozen versions", () => {
  const pinned = {
    "../experiment-1/resolvers/resolver-js.mjs": "edd210c4ee4e6ecb62243adc535426f2e1ccbf38a6413d2de5aec017effa5d60",
    "../experiment-1/tests/test-support.mjs": "6b30fa45ab192e9ff1106c6d36ee362445089e3594f4d8a6056876db4d942de0",
    "../experiment-28/permission-verifier.mjs": "e5f54ea6f315aef18fdd218da8db291ce9e4d4762e53e3b4ec52b1ecdee74cdd",
    "../experiment-29/ownership-evaluator.mjs": "cde01524b1821569b002d4dec79947d359786f94bc66e08989cf02089328b32f",
    "../experiment-23/public-authorization-artifact.v0.1.json": "7be8b35184a6ee4381448fd4e67bf586b57b628302c7d2db26fd2699332b2efb",
  };
  for (const [path, expected] of Object.entries(pinned)) {
    const actual = createHash("sha256").update(readFileSync(new URL(path, import.meta.url))).digest("hex");
    assert.equal(actual, expected, path);
  }
});
