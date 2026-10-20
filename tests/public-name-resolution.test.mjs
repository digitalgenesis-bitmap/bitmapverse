import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const CANONICAL_ID = "9acf85a192845d64b55d20dcec6af4589cd28dff6f0ad19b73b219f2551a57cbi0";
const BITMAPWORLD_ID = "f1aeada2eabe8e5ef2c0232bcfdcadf0f38d17ecbd45481ded0b4d35ab366545i0";
const BITMAPMETAVERSE_ID = "868445efe742649fd9d885df257722226a9eb689c8da07441e87bc64af35afffi0";

async function render(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  const raw = await response.text();
  return {
    raw,
    html: raw.replace(/<script\b[\s\S]*?<\/script>/gi, ""),
  };
}

function activeDistrict(html) {
  const match = html.match(
    /<button class="territory-card [^"]* active"[^>]*aria-pressed="true"[^>]*>[\s\S]*?<span class="district-name">([^<]+)<\/span>/,
  );
  assert.ok(match, "rendered HTML must contain one active territory");
  return match[1];
}

function resolvedDistrict(raw) {
  const match = raw.match(/requestedDistrict\\\":\\\"([^\\\"]+)\\\"/);
  assert.ok(match, "rendered response must expose the District passed to the portal");
  return match[1];
}

test("Experiment #21 admits all tracked canonical Names while rejecting an unknown Name", async () => {
  const [identity, pageSource] = await Promise.all([
    readFile(new URL("../data/bitmapverse-name-identity.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.deepEqual(identity.identities.map(({ name }) => name), [
    "bitmapverse.bitmap",
    "freedeon.bitmap",
    "bitmapworld.bitmap",
    "bitmapmetaverse.bitmap",
  ]);
  assert.equal(identity.identities[0].canonical_inscription_id, CANONICAL_ID);
  assert.equal(identity.identities[2].canonical_inscription_id, BITMAPWORLD_ID);
  assert.equal(identity.identities[3].canonical_inscription_id, BITMAPMETAVERSE_ID);
  assert.match(pageSource, /resolveName\(requestedEntry/);
  assert.match(pageSource, /nameIdentity: bitmapverseNameIdentity/);
  assert.match(pageSource, /bitmapverseNameIdentity\.identities/);
  assert.doesNotMatch(pageSource, /freedeon\.bitmap/);
  assert.doesNotMatch(pageSource, /bitmapworld\.bitmap/);
  assert.doesNotMatch(pageSource, /bitmapmetaverse\.bitmap/);
  assert.doesNotMatch(pageSource, /62b1268600254cf9717350a21c3f02b37f195965bd68732a1a8081339847b1b3i0/);
  assert.doesNotMatch(pageSource, /671d0cd26273823019dc974653eccc787f0e166b6e5407cdacbe71b2df1cb025i0/);

  const nameEntry = await render("/?district=bitmapverse.bitmap");
  assert.equal(resolvedDistrict(nameEntry.raw), "937336");
  assert.equal(activeDistrict(nameEntry.html), "937336.bitmap");
  assert.match(nameEntry.html, /<h1>\s*937336\.bitmap/);
  assert.match(nameEntry.html, /Parcels: (?:<!-- -->)?6778/);

  const bitmapworldEntry = await render("/?district=bitmapworld.bitmap");
  assert.equal(resolvedDistrict(bitmapworldEntry.raw), "937336");
  assert.equal(activeDistrict(bitmapworldEntry.html), "937336.bitmap");

  const bitmapmetaverseEntry = await render("/?district=bitmapmetaverse.bitmap");
  assert.equal(resolvedDistrict(bitmapmetaverseEntry.raw), "937336");
  assert.equal(activeDistrict(bitmapmetaverseEntry.html), "937336.bitmap");

  const secondNameEntry = await render("/?district=freedeon.bitmap");
  assert.equal(resolvedDistrict(secondNameEntry.raw), "507999");
  assert.equal(activeDistrict(secondNameEntry.html), "507999.bitmap");

  const negativeEntry = await render("/?district=unknown.bitmap");
  assert.equal(resolvedDistrict(negativeEntry.raw), "unknown.bitmap");
  assert.equal(activeDistrict(negativeEntry.html), "507999.bitmap");
  assert.doesNotMatch(negativeEntry.html, /<h1>\s*937336\.bitmap/);

  const numericFreedeonEntry = await render("/?district=507999");
  assert.equal(resolvedDistrict(numericFreedeonEntry.raw), "507999");
  assert.equal(activeDistrict(numericFreedeonEntry.html), "507999.bitmap");

  const numericBitmapverseEntry = await render("/?district=937336");
  assert.equal(resolvedDistrict(numericBitmapverseEntry.raw), "937336");
  assert.equal(activeDistrict(numericBitmapverseEntry.html), "937336.bitmap");
});
