import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const CANONICAL_ID = "9acf85a192845d64b55d20dcec6af4589cd28dff6f0ad19b73b219f2551a57cbi0";

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
  return (await response.text()).replace(/<script\b[\s\S]*?<\/script>/gi, "");
}

function activeDistrict(html) {
  const match = html.match(
    /<button class="territory-card [^"]* active"[^>]*aria-pressed="true"[^>]*>[\s\S]*?<span class="district-name">([^<]+)<\/span>/,
  );
  assert.ok(match, "rendered HTML must contain one active territory");
  return match[1];
}

test("Experiment #11 resolves the canonical Name through #9 and reaches the existing District experience", async () => {
  const [identity, pageSource] = await Promise.all([
    readFile(new URL("../data/bitmapverse-name-identity.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.equal(identity.name, "bitmapverse.bitmap");
  assert.equal(identity.canonical_inscription_id, CANONICAL_ID);
  assert.match(pageSource, /resolveName\(requestedEntry/);
  assert.match(pageSource, /nameIdentity: bitmapverseNameIdentity/);
  assert.doesNotMatch(pageSource, /62b1268600254cf9717350a21c3f02b37f195965bd68732a1a8081339847b1b3i0/);

  const nameEntry = await render("/?district=bitmapverse.bitmap");
  assert.equal(activeDistrict(nameEntry), "937336.bitmap");
  assert.match(nameEntry, /<h1>\s*937336\.bitmap/);
  assert.match(nameEntry, /Parcels: (?:<!-- -->)?6778/);

  const negativeEntry = await render("/?district=unknown.bitmap");
  assert.equal(activeDistrict(negativeEntry), "507999.bitmap");
  assert.doesNotMatch(negativeEntry, /<h1>\s*937336\.bitmap/);
});
