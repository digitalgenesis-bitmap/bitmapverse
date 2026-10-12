// Bitmapverse WORLD v0.1 — Experiment #7.
// Proves that direct District entry receives hero identity precedence.
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

test("Experiment #7 gives direct District entry hero identity precedence", async () => {
  const directEntry = await render("/?district=937336");
  const rootEntry = await render("/");

  assert.match(directEntry, /<h1>\s*937336\.bitmap/);
  assert.match(
    directEntry,
    /6,778(?:<!-- -->)? real(?:<!-- -->)? parcels(?:<!-- -->)? to(?:<!-- -->)? explore/,
  );
  assert.doesNotMatch(directEntry, /Three territories\./);

  assert.match(rootEntry, /Three territories\./);
  assert.match(rootEntry, /One verifiable route\./);
  assert.doesNotMatch(rootEntry, /6,778(?:<!-- -->)? real parcels to explore/);
});
