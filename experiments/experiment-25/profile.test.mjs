import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { verifyBip322P2TR } from "../experiment-1/resolvers/resolver-js.mjs";
import {
  EXPERIMENT_25_PROFILE,
  PREPARED_BINDINGS,
} from "./profile.mjs";

const frozen = JSON.parse(await readFile(new URL("./prepared-bindings.json", import.meta.url), "utf8"));
const experiment23 = JSON.parse(await readFile(
  new URL("../experiment-23/public-authorization-artifact.v0.1.json", import.meta.url),
  "utf8",
));

test("both prepared bindings reproduce their frozen messages byte for byte", () => {
  assert.deepEqual(PREPARED_BINDINGS, frozen);
  assert.deepEqual(PREPARED_BINDINGS.map(({ message_bytes }) => message_bytes), [1080, 1080]);
  assert.deepEqual(PREPARED_BINDINGS.map(({ message_sha256 }) => message_sha256), [
    "3de168c726f012be3a96f40430f759fcd481d227cb07f750669f50911fec9d7f",
    "2e16880d1f06d8977779e8bbe9d8a5550518b10565c80cd12b4d9729129e7ba5",
  ]);
});

test("independent Name bindings coexist while sharing exactly one District", () => {
  assert.equal(new Set(PREPARED_BINDINGS.map(({ binding_id }) => binding_id)).size, 2);
  assert.deepEqual(PREPARED_BINDINGS.map(({ district }) => district), ["937336.bitmap", "937336.bitmap"]);
  for (const prepared of PREPARED_BINDINGS) {
    const event = JSON.parse(prepared.message.slice(prepared.message.indexOf("\n") + 1));
    assert.equal(event.district_inscription_id, EXPERIMENT_25_PROFILE.district_inscription_id);
    assert.equal(event.scope, "bitmapverse-authorization");
    assert.equal(event.binding_id, prepared.binding_id);
  }
});

test("the Experiment #23 signatures cannot authorize either new Name", () => {
  for (const prepared of PREPARED_BINDINGS) {
    assert.equal(
      verifyBip322P2TR(
        EXPERIMENT_25_PROFILE.name_controller.address,
        prepared.message,
        experiment23.signatures.name.signature,
      ),
      false,
    );
    assert.equal(
      verifyBip322P2TR(
        EXPERIMENT_25_PROFILE.district_controller.address,
        prepared.message,
        experiment23.signatures.district.signature,
      ),
      false,
    );
  }
});

test("both unsigned prepared bindings remain REJECT/AUTHORIZATION_ABSENT", () => {
  for (const prepared of PREPARED_BINDINGS) {
    assert.deepEqual(prepared.authorization, {
      status: "REJECT",
      code: "AUTHORIZATION_ABSENT",
      required_signatures: ["name", "district"],
    });
  }
});
