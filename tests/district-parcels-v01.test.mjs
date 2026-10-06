// Bitmapverse WORLD v0.1 — Experiment #2.
// Verifies that the frozen Experiment #1 parcel-identities artifact reaches
// browser-delivered application state through app/page.tsx → PortalExplorer.
// Expected constants below are assertion targets only; every value under test
// comes from the loaded artifact or the served HTML.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { toDistrictParcelsV01 } from "../src/parcels/district-parcels-v01.mjs";

const ARTIFACT_URL = new URL(
  "../data/parcels/937336.parcel-identities.json",
  import.meta.url,
);
const EXPECTED_SHA256 =
  "60710768ff0ae61699f8a84147a6f44db5385836990d6583ecfe08d00588d3ef";
const EXPECTED_HEIGHT = 937336;
const EXPECTED_HASH =
  "000000000000000000008e42644fe63120248b979cc04532647ee2cd0ae00ac0";
const EXPECTED_COUNT = 6778;
const CONTROL_INDEX = 130;
const CONTROL_TXID =
  "7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1";

const raw = await readFile(ARTIFACT_URL);
const verified = JSON.parse(raw.toString("utf8"));
const app = toDistrictParcelsV01(JSON.parse(raw.toString("utf8")));

function assertPositionalEquality(actual, label) {
  assert.equal(actual.length, verified.transactions.length, `${label} length`);
  for (let i = 0; i < verified.transactions.length; i += 1) {
    assert.equal(actual[i].transaction_index, i, `${label} index at ${i}`);
    assert.equal(
      actual[i].transaction_index,
      verified.transactions[i].transaction_index,
      `${label} transaction_index at ${i}`,
    );
    assert.equal(
      actual[i].transaction_id,
      verified.transactions[i].transaction_id,
      `${label} transaction_id at ${i}`,
    );
  }
}

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

test("TEST 1 — input artifact integrity (SHA-256)", () => {
  assert.equal(createHash("sha256").update(raw).digest("hex"), EXPECTED_SHA256);
});

test("TEST 2 — District identity is the District block, not the snapshot", () => {
  assert.equal(app.block_height, EXPECTED_HEIGHT);
  assert.equal(app.block_hash, EXPECTED_HASH);
  assert.notEqual(app.block_height, 959531);
});

test("TEST 3 — parcel count", () => {
  assert.equal(app.transaction_count, EXPECTED_COUNT);
  assert.equal(app.parcels.length, EXPECTED_COUNT);
  assert.equal(app.transaction_count, app.parcels.length);
});

test("TEST 4 — complete positional index/transaction-ID integrity", () => {
  assertPositionalEquality(app.parcels, "application state");
  assert.deepEqual(Object.keys(app.parcels[0]).sort(), [
    "transaction_id",
    "transaction_index",
  ]);
});

test("TEST 5 — known parcel control from the loaded collection", () => {
  assert.equal(app.parcels[CONTROL_INDEX].transaction_index, CONTROL_INDEX);
  assert.equal(app.parcels[CONTROL_INDEX].transaction_id, CONTROL_TXID);
});

test("TEST 6 — browser-delivered state carries the real collection", async () => {
  const html = await renderHtml();

  // Visible proof rendered by PortalExplorer from districtParcels.parcels.length.
  assert.match(
    html,
    /<div data-parcel-proof=""><span>District: 937336\.bitmap<\/span><strong>Parcels: 6778<\/strong><\/div>/,
  );

  // Hydration payload shipped to the browser for PortalExplorer's props.
  const pattern =
    /transaction_index\\*":(\d+),\\*"transaction_id\\*":\\*"([0-9a-f]{64})\\*"/g;
  const delivered = [...html.matchAll(pattern)].map((m) => ({
    transaction_index: Number(m[1]),
    transaction_id: m[2],
  }));
  assertPositionalEquality(delivered, "browser payload");
  assert.equal(delivered[CONTROL_INDEX].transaction_index, CONTROL_INDEX);
  assert.equal(delivered[CONTROL_INDEX].transaction_id, CONTROL_TXID);
});
