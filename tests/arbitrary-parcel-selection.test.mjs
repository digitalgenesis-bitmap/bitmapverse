// Bitmapverse WORLD v0.1 — Experiment #6.
// Verifies the generic selector boundary against the versioned real collection.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { toDistrictParcelsV01 } from "../src/parcels/district-parcels-v01.mjs";

const artifact = JSON.parse(
  await readFile(
    new URL("../data/parcels/937336.parcel-identities.json", import.meta.url),
    "utf8",
  ),
);
const districtParcels = toDistrictParcelsV01(artifact);
const controlIndexes = [0, 500, 6777, 130];

test("Experiment #6 addresses arbitrary controls from the real ordered collection", async () => {
  assert.equal(districtParcels.parcels.length, 6778);
  assert.equal(districtParcels.parcels[0].transaction_index, 0);
  assert.equal(districtParcels.parcels.at(-1).transaction_index, 6777);

  for (const index of controlIndexes) {
    assert.equal(districtParcels.parcels[index].transaction_index, index);
    assert.equal(
      districtParcels.parcels[index].transaction_id,
      artifact.transactions[index].transaction_id,
    );
  }

  const source = await readFile(
    new URL("../app/portal-explorer.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /districtParcels\.parcels\[index\]/);
  assert.match(source, /setSelectedParcel\(parcel\)/);
  assert.match(source, /type="number"/);
  assert.match(source, /SELECT PARCEL/);
  assert.match(source, /setSelectedParcel\(controlParcel\)/);

  for (const index of controlIndexes) {
    assert.doesNotMatch(
      source,
      new RegExp(artifact.transactions[index].transaction_id),
    );
  }
});
