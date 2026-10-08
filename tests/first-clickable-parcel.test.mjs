// Bitmapverse WORLD v0.1 — Experiment #4.
// Automated boundary checks complement, but do not replace, a genuine browser click.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { toDistrictParcelsV01 } from "../src/parcels/district-parcels-v01.mjs";

const CONTROL_INDEX = 130;
const CONTROL_TXID =
  "7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1";

const artifact = JSON.parse(
  await readFile(
    new URL("../data/parcels/937336.parcel-identities.json", import.meta.url),
    "utf8",
  ),
);
const districtParcels = toDistrictParcelsV01(artifact);

async function renderHtml() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  return response.text();
}

test("Experiment #4 control is the real parcel at array position 130", async () => {
  assert.equal(districtParcels.parcels.length, 6778);
  assert.equal(
    districtParcels.parcels[CONTROL_INDEX].transaction_index,
    CONTROL_INDEX,
  );
  assert.equal(
    districtParcels.parcels[CONTROL_INDEX].transaction_id,
    CONTROL_TXID,
  );

  const source = await readFile(
    new URL("../app/portal-explorer.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /controlParcel = districtParcels\.parcels\[130\]/);
  assert.match(source, /onClick=\{\(\) => setSelectedParcel\(controlParcel\)\}/);
  assert.match(source, /selectedParcel\.transaction_id/);
  assert.doesNotMatch(source, new RegExp(CONTROL_TXID));
});

test("Experiment #4 initial visible UI has the control and total but no selected txid", async () => {
  const html = await renderHtml();
  const visibleHtml = html.replace(/<script\b[\s\S]*?<\/script>/gi, "");

  assert.match(visibleHtml, /Parcels: (?:<!-- -->)?6778/);
  assert.match(
    visibleHtml,
    /<button[^>]*data-parcel-index="130"[^>]*>PARCEL (?:<!-- -->)?130<\/button>/,
  );
  assert.doesNotMatch(visibleHtml, new RegExp(CONTROL_TXID));
  assert.doesNotMatch(visibleHtml, /Parcel index: (?:<!-- -->)?130/);
});
