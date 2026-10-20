// Bitmapverse 3D — Experiment #20: one target, one proximity condition,
// one action, one deterministic response. Pure logic only (no WebGL).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { toDistrictParcelsV01 } from "../src/parcels/district-parcels-v01.mjs";
import {
  DISTRICT_STRUCTURE as T,
  INTERACTION_RADIUS as R,
  inspectDistrictStructure,
  isInInteractionRange,
} from "../src/world/district-structure-interaction.mjs";

const artifact = JSON.parse(
  await readFile(
    new URL("../data/parcels/937336.parcel-identities.json", import.meta.url),
    "utf8",
  ),
);
const parcels = toDistrictParcelsV01(artifact);
const district = {
  blockHeight: parcels.block_height,
  transactionCount: parcels.transaction_count,
};
const at = (dz) => ({ x: T.x, z: T.z + dz });

test("A. outside range: unavailable (#19 start position z=7)", () => {
  assert.equal(isInInteractionRange({ x: 0, z: 7 }), false);
});
test("B. inside range: available", () => {
  assert.equal(isInInteractionRange(at(R / 2)), true);
});
test("C. exactly at boundary: available", () => {
  assert.equal(isInInteractionRange(at(R)), true);
  assert.equal(isInInteractionRange({ x: T.x + R, z: T.z }), true);
});
test("D. just outside boundary: unavailable", () => {
  assert.equal(isInInteractionRange(at(R + 0.001)), false);
});
test("E. leaving range: unavailable again", () => {
  const path = [at(R + 3), at(R - 1), at(R + 1)];
  assert.deepEqual(path.map((p) => isInInteractionRange(p)), [false, true, false]);
});
test("F. out-of-range action returns no response", () => {
  const r = inspectDistrictStructure(T, at(R + 1), district);
  assert.deepEqual(r, { ok: false, reason: "out-of-range" });
  assert.equal("response" in r, false);
});
test("F2. unknown target returns no response", () => {
  const r = inspectDistrictStructure({ id: "other", x: 0, z: 0 }, at(0), district);
  assert.equal(r.ok, false);
});
test("G. in-range action: deterministic District response from canonical data", () => {
  const r = inspectDistrictStructure(T, at(2), district);
  assert.equal(r.ok, true);
  assert.deepEqual(r.response, {
    title: "BITMAPVERSE / 937336.bitmap",
    district: "937336.bitmap",
    transactions: "6,778",
  });
  assert.equal(district.transactionCount, parcels.parcels.length);
});
test("H. same input and data give the same response", () => {
  const a = inspectDistrictStructure(T, at(2), district);
  const b = inspectDistrictStructure(T, at(2), { ...district });
  assert.deepEqual(a, b);
});
