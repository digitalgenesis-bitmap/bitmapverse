import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const expectedNames = [
  "bitmapverse.bitmap",
  "bitmapworld.bitmap",
  "bitmapmetaverse.bitmap",
];
const expectedDistrict = "937336.bitmap";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

async function render(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("experiment-27", `${process.pid}-${Date.now()}-${path}`);
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

test("Experiment #27 exposes exactly three public Name entry identities for one District", async () => {
  const [identity, bitmapverse, bitmapworld, bitmapmetaverse] = await Promise.all([
    readJson("../data/bitmapverse-name-identity.json"),
    readJson("../experiments/experiment-23/public-authorization-artifact.v0.1.json"),
    readJson("../experiments/experiment-26/bitmapworld.public-authorization-artifact.v0.1.json"),
    readJson("../experiments/experiment-26/bitmapmetaverse.public-authorization-artifact.v0.1.json"),
  ]);
  const artifacts = [bitmapverse, bitmapworld, bitmapmetaverse];
  const names = artifacts.map((artifact) => {
    const match = identity.identities.find(
      ({ canonical_inscription_id }) =>
        canonical_inscription_id === artifact.binding.name_inscription_id,
    );
    assert.ok(match, "every public binding must match one canonical Name identity");
    return match.name;
  });

  assert.deepEqual(names, expectedNames);
  assert.equal(new Set(names).size, 3);
  assert.equal(
    new Set(artifacts.map(({ binding }) => binding.district_inscription_id)).size,
    1,
  );
});

test("Experiment #27 renders the three-name selector without claiming current ACCEPT", async () => {
  const html = await render("/");
  for (const name of expectedNames) assert.match(html, new RegExp(`>${name}<`));
  assert.match(html, /Three names\. One District\./);
  assert.match(html, /PUBLIC AUTHORIZATION — CURRENT VERIFICATION NOT RUN/);
  assert.doesNotMatch(html, /CURRENT (?:AUTHORIZATION|VERIFICATION)[^<]*ACCEPT/i);
});

test("Experiment #27 preserves each selected Name while resolving one shared District", async () => {
  for (const name of expectedNames) {
    const html = await render(`/?district=${name}`);
    assert.match(html, new RegExp(`data-selected-entry="">${name}<`));
    assert.match(html, new RegExp(`data-selected-entry="">${name}<[\\s\\S]*?DESTINATION[\\s\\S]*?>${expectedDistrict}<`));
    assert.match(html, /PUBLIC AUTHORIZATION — CURRENT VERIFICATION NOT RUN/);
  }
});

test("Experiment #27 keeps one 3D scene and retains interaction and cleanup behavior", async () => {
  const [portalSource, experienceSource] = await Promise.all([
    readFile(new URL("../app/portal-explorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/bitmapverse-3d-experience.tsx", import.meta.url), "utf8"),
  ]);

  assert.equal(portalSource.match(/<Bitmapverse3DExperience/g)?.length, 1);
  assert.match(portalSource, /entryName=\{selectedEntry\?\.name\}/);
  assert.match(portalSource, /onChange=\{\(event\) => selectNameEntry\(event\.target\.value\)\}/);
  assert.match(experienceSource, /event\.code === "KeyE"/);
  assert.match(experienceSource, /window\.removeEventListener\("keydown", onKeyDown\)/);
  assert.match(experienceSource, /renderer\.dispose\(\)/);
  assert.match(experienceSource, /ENTRY IDENTITY/);
});
