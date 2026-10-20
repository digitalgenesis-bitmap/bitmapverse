import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { canonicalParentForName } from "../experiments/experiment-9/resolver.mjs";

const EXPECTED_NAME = "bitmapverse.bitmap";
const EXPECTED_ID = "9acf85a192845d64b55d20dcec6af4589cd28dff6f0ad19b73b219f2551a57cbi0";
const SECOND_NAME = "freedeon.bitmap";
const SECOND_ID = "54cddbef036061623679d1b7e608704da0268c83fb822430375782c62960f446i0";
const THIRD_NAME = "bitmapworld.bitmap";
const THIRD_ID = "f1aeada2eabe8e5ef2c0232bcfdcadf0f38d17ecbd45481ded0b4d35ab366545i0";
const FOURTH_NAME = "bitmapmetaverse.bitmap";
const FOURTH_ID = "868445efe742649fd9d885df257722226a9eb689c8da07441e87bc64af35afffi0";
const IDENTITY_URL = new URL("../data/bitmapverse-name-identity.json", import.meta.url);
const RESOLVER_URL = new URL("../experiments/experiment-9/resolver.mjs", import.meta.url);

test("the tracked canonical source provides the established bitmapverse.bitmap identity to #9", async () => {
  const identity = JSON.parse(await readFile(IDENTITY_URL, "utf8"));
  assert.deepEqual(Object.keys(identity), ["identities"]);
  assert.equal(identity.identities.length, 4);
  assert.deepEqual(identity.identities[0], {
    name: EXPECTED_NAME,
    canonical_inscription_id: EXPECTED_ID,
  });
  assert.equal(canonicalParentForName(EXPECTED_NAME, identity), EXPECTED_ID);
  assert.deepEqual(identity.identities[1], {
    name: SECOND_NAME,
    canonical_inscription_id: SECOND_ID,
  });
  assert.equal(canonicalParentForName(SECOND_NAME, identity), SECOND_ID);
  assert.deepEqual(identity.identities[2], {
    name: THIRD_NAME,
    canonical_inscription_id: THIRD_ID,
  });
  assert.equal(canonicalParentForName(THIRD_NAME, identity), THIRD_ID);
  assert.deepEqual(identity.identities[3], {
    name: FOURTH_NAME,
    canonical_inscription_id: FOURTH_ID,
  });
  assert.equal(canonicalParentForName(FOURTH_NAME, identity), FOURTH_ID);

  const resolverSource = await readFile(RESOLVER_URL, "utf8");
  assert.equal(resolverSource.includes("data/bitmapverse-name-identity.json"), true);
  assert.equal(resolverSource.includes("experiment-0/experiment.json"), false);
});
