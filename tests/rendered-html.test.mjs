import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renderiza el portal experimental con ambos resultados resueltos", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Bitmapverse v0\.1 — Portal experimental<\/title>/i,
  );
  assert.match(html, /Dos territorios\./);
  assert.match(html, /Una ruta verificable\./);
  assert.match(html, /507999\.bitmap/);
  assert.match(html, /7187\.bitmap/);
  assert.match(html, /HEIGHT (?:<!-- -->)?959531/);
  assert.match(html, /same_sat_latest_v0\.1/);
  assert.match(html, /Convención interna de Bitmapverse v0\.1/);
  assert.match(html, /No es todavía una EMV pública/);
  assert.doesNotMatch(html, /Your site is taking shape|Codex is working/);
});

test("la interfaz conserva evidencia, límites e interacción sin el starter", async () => {
  const [page, explorer, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/portal-explorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /resolveSameSatLatestV01\(freedeonFixture\)/);
  assert.match(page, /resolveSameSatLatestV01\(organaFixture\)/);
  assert.match(explorer, /setRouteDirection/);
  assert.match(explorer, /selected_content_sha256/);
  assert.match(explorer, /enumeration_response_sha256/);
  assert.match(explorer, /Respuesta OPI no capturada/);
  assert.match(explorer, /target="_blank"/);
  assert.match(explorer, /rel="noreferrer"/);
  assert.match(layout, /lang="es"/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(
    access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)),
  );
  await assert.rejects(
    access(new URL("../app/_sites-preview/preview.css", import.meta.url)),
  );
  await assert.rejects(access(new URL("public/_sites-preview", projectRoot)));
});
