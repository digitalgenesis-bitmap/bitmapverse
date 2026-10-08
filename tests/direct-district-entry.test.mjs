// Bitmapverse WORLD v0.1 — Experiment #5.
// Exercises the actual query-param → rendered active-territory path.
import assert from "node:assert/strict";
import test from "node:test";

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

test("Experiment #5 entry controls select only an existing requested territory", async () => {
  const defaultEntry = await render("/");
  const directEntry = await render("/?district=937336");
  const unknownEntry = await render("/?district=999999999");

  assert.equal(activeDistrict(defaultEntry), "507999.bitmap");
  assert.equal(activeDistrict(directEntry), "937336.bitmap");
  assert.equal(activeDistrict(unknownEntry), "507999.bitmap");

  assert.match(directEntry, /District: 937336\.bitmap/);
  assert.match(directEntry, /Parcels: (?:<!-- -->)?6778/);
  assert.match(directEntry, />PARCEL (?:<!-- -->)?130<\/button>/);
});
