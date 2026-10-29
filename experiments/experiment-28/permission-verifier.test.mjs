import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPERIMENT_28_PROFILE,
  authorizeBuild,
  grantMessage,
  permissionId,
} from "./permission-verifier.mjs";
import { controllerForSecret, signBip322 } from "../experiment-1/tests/test-support.mjs";

// Two separate deterministic test-key controllers. Neither is the real 937336.bitmap holder.
const GRANTOR_TEST_SECRET = 29n;
const BUILDER_TEST_SECRET = 31n;
const grantor = controllerForSecret(GRANTOR_TEST_SECRET);
const builder = controllerForSecret(BUILDER_TEST_SECRET);

// Synthetic heights and hashes. They do not describe any real Bitcoin block.
const SNAPSHOT_HEIGHT = 972300;
const EXPIRES_AT_HEIGHT = SNAPSHOT_HEIGHT + 100;
const VALID_EVALUATION_HEIGHT = SNAPSHOT_HEIGHT + 10;
const SYNTHETIC_HASH = "f".repeat(64);
const TEST_OBJECT_ID = "test-object-001";

const grantPayload = {
  schema: EXPERIMENT_28_PROFILE.schema,
  district: EXPERIMENT_28_PROFILE.district,
  district_inscription_id: EXPERIMENT_28_PROFILE.district_inscription_id,
  authority_snapshot: { height: SNAPSHOT_HEIGHT, block_hash: SYNTHETIC_HASH },
  grantor,
  grantee: builder,
  action: "build",
  object_id: TEST_OBJECT_ID,
  expires_at_height: EXPIRES_AT_HEIGHT,
  nonce: "1".repeat(64),
};
const message = grantMessage(grantPayload);
const validGrant = { message, signature: signBip322(GRANTOR_TEST_SECRET, grantor.address, message) };
const validPermissionId = permissionId(message);

function request(overrides = {}) {
  return {
    district: "937336.bitmap",
    object_id: TEST_OBJECT_ID,
    builder_address: builder.address,
    evaluation_height: VALID_EVALUATION_HEIGHT,
    ...overrides,
  };
}

// Fixture ownership, pinned to the evaluation height and labelled as fixture.
function fixtureOwnership(height = VALID_EVALUATION_HEIGHT) {
  return {
    source: "TEST_KEY_FIXTURE",
    tip: { height, block_hash: SYNTHETIC_HASH },
    inscriptions: {
      [EXPERIMENT_28_PROFILE.district_inscription_id]: {
        inscription_id: EXPERIMENT_28_PROFILE.district_inscription_id,
        output: `${"a".repeat(64)}:0`,
        address: grantor.address,
        script_pubkey: grantor.script_pubkey,
        confirmed: true,
        confirmation_height: SNAPSHOT_HEIGHT,
        spent: false,
      },
    },
  };
}

function revocations(revoked = []) {
  return { schema: EXPERIMENT_28_PROFILE.revocation_schema, district: "937336.bitmap", revoked };
}

function context(overrides = {}) {
  return { ownershipEvidence: fixtureOwnership(), revocationState: revocations(), ...overrides };
}

function assertLabelled(result) {
  assert.equal(result.authority_mode, "TEST_KEY_FIXTURE");
  assert.equal(result.revocation, "LOCAL_ONLY");
}

test("fixture sanity: separate test controllers, deterministic grant bytes", () => {
  assert.notEqual(grantor.address, builder.address);
  assert.notEqual(grantor.address, "bc1psphv4vlce9f37zqc7jt8w3gnynfxxh3zmjuvxpqv0vjs3t3mcdesyfk5tk");
  assert.equal(message.split("\n").length, 2);
  assert.equal(signBip322(GRANTOR_TEST_SECRET, grantor.address, message), validGrant.signature);
});

// ---- The seven required cases ----

test("1. no permission → DENY", () => {
  const result = authorizeBuild(request(), null, context());
  assert.equal(result.result, "DENY");
  assert.equal(result.code, "NO_PERMISSION");
  assertLabelled(result);
});

test("2. valid permission → ALLOW", () => {
  const result = authorizeBuild(request(), validGrant, context());
  assert.equal(result.result, "ALLOW");
  assert.equal(result.code, "DELEGATED_BUILD_PERMITTED");
  assert.equal(result.permission_id, validPermissionId);
  assert.equal(result.district, "937336.bitmap");
  assert.equal(result.object_id, TEST_OBJECT_ID);
  assert.equal(result.builder, builder.address);
  assert.equal(result.grantor, grantor.address);
  assert.equal(result.evaluation_height, VALID_EVALUATION_HEIGHT);
  assertLabelled(result);
});

test("3. revoked permission → DENY", () => {
  const result = authorizeBuild(request(), validGrant, context({ revocationState: revocations([validPermissionId]) }));
  assert.equal(result.result, "DENY");
  assert.equal(result.code, "REVOKED");
  assertLabelled(result);
});

test("4. expired permission → DENY (expiry boundary is exclusive)", () => {
  const atExpiry = authorizeBuild(
    request({ evaluation_height: EXPIRES_AT_HEIGHT }),
    validGrant,
    context({ ownershipEvidence: fixtureOwnership(EXPIRES_AT_HEIGHT) }),
  );
  assert.equal(atExpiry.result, "DENY");
  assert.equal(atExpiry.code, "EXPIRED");
  assertLabelled(atExpiry);

  const lastValid = authorizeBuild(
    request({ evaluation_height: EXPIRES_AT_HEIGHT - 1 }),
    validGrant,
    context({ ownershipEvidence: fixtureOwnership(EXPIRES_AT_HEIGHT - 1) }),
  );
  assert.equal(lastValid.result, "ALLOW");
});

test("5. invalid signature → DENY", () => {
  const signedByBuilder = { message, signature: signBip322(BUILDER_TEST_SECRET, builder.address, message) };
  const result = authorizeBuild(request(), signedByBuilder, context());
  assert.equal(result.result, "DENY");
  assert.equal(result.code, "INVALID_SIGNATURE");
  assertLabelled(result);
});

test("6. wrong District → DENY", () => {
  const result = authorizeBuild(request({ district: "937337.bitmap" }), validGrant, context());
  assert.equal(result.result, "DENY");
  assert.equal(result.code, "WRONG_SCOPE");
  assert.equal(result.reason, "district");
  assertLabelled(result);
});

test("7. wrong object → DENY", () => {
  const result = authorizeBuild(request({ object_id: "test-object-002" }), validGrant, context());
  assert.equal(result.result, "DENY");
  assert.equal(result.code, "WRONG_SCOPE");
  assert.equal(result.reason, "object");
  assertLabelled(result);
});

// ---- Authorization conditions 6–8: evidence height, fail-closed revocation, labels ----

test("condition: missing revocation state fails closed", () => {
  const result = authorizeBuild(request(), validGrant, context({ revocationState: undefined }));
  assert.equal(result.result, "DENY");
  assert.equal(result.code, "REVOCATION_STATE_UNAVAILABLE");
  assertLabelled(result);
});

test("condition: malformed revocation state fails closed", () => {
  for (const state of [
    { ...revocations(), revoked: "not-a-list" },
    { ...revocations(), extra: true },
    { ...revocations(), schema: "other" },
    { ...revocations(), district: "937337.bitmap" },
    revocations(["B".repeat(64)]),
    revocations(["b".repeat(64), "a".repeat(64)]),
    revocations(["a".repeat(64), "a".repeat(64)]),
  ]) {
    const result = authorizeBuild(request(), validGrant, context({ revocationState: state }));
    assert.equal(result.result, "DENY");
    assert.equal(result.code, "REVOCATION_STATE_INVALID");
  }
});

test("condition: ownership evidence must match the explicit evaluation height", () => {
  const result = authorizeBuild(request(), validGrant, context({ ownershipEvidence: fixtureOwnership(VALID_EVALUATION_HEIGHT + 1) }));
  assert.equal(result.result, "DENY");
  assert.equal(result.code, "OWNERSHIP_HEIGHT_MISMATCH");
});

test("condition: evidence not labelled TEST_KEY_FIXTURE is never accepted", () => {
  const evidence = { ...fixtureOwnership(), source: "LIVE" };
  const result = authorizeBuild(request(), validGrant, context({ ownershipEvidence: evidence }));
  assert.equal(result.result, "DENY");
  assert.equal(result.code, "UNSUPPORTED_EVIDENCE_SOURCE");
  assertLabelled(result);
});
