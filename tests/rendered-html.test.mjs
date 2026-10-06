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

test("renders the experimental portal with both results resolved", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Bitmapverse v0\.1 — Portal experimental<\/title>/i,
  );
  assert.match(html, /Three territories\./);
  assert.match(html, /One verifiable route\./);
  assert.match(html, /507999\.bitmap/);
  assert.match(html, /7187\.bitmap/);
  assert.match(html, /937336\.bitmap/);
  assert.match(html, /HEIGHT (?:<!-- -->)?959531/);
  assert.match(html, /same_sat_latest_v0\.1/);
  assert.match(html, /Internal Bitmapverse v0\.1 convention/);
  assert.match(html, /Not yet a public MVE/);
  assert.doesNotMatch(html, /Your site is taking shape|Codex is working/);
});

test("the interface preserves evidence, limits, and interaction without the starter", async () => {
  const [page, explorer, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/portal-explorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /resolveSameSatLatestV01\(freedeonFixture\)/);
  assert.match(page, /resolveSameSatLatestV01\(organaFixture\)/);
  assert.match(page, /resolveSameSatLatestV01\(bitmapverseFixture\)/);
  assert.match(explorer, /setRouteDirection/);
  assert.match(explorer, /selected_content_sha256/);
  assert.match(explorer, /enumeration_response_sha256/);
  assert.match(explorer, /OPI response not captured/);
  assert.match(explorer, /target="_blank"/);
  assert.match(explorer, /rel="noreferrer"/);
  assert.match(layout, /lang="en"/);
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

test("the local MVE Candidate keeps Experience as the initial view, Verification available, and the required epistemic limits", async () => {
  const response = await render();
  const html = await response.text();
  const explorerSource = await readFile(
    new URL("../app/portal-explorer.tsx", import.meta.url),
    "utf8",
  );

  // 1. The initial view is "Experience": its controls are present and
  // the content exclusive to "Verification" is not rendered by default.
  assert.match(html, /LOCAL MVE CANDIDATE/);
  assert.match(html, /EXPERIENCE/);
  assert.match(html, /OPEN SELECTED CONTENT/);
  assert.doesNotMatch(html, /ORIGINAL INSCRIPTION/);
  assert.doesNotMatch(html, /SELECTED RESULT/);

  // 2. "Verification" can be opened: the control exists in the initial
  // view and, at the source level, its technical content is gated
  // exactly on that same state (this test does not simulate clicks in a
  // real browser).
  assert.match(html, /VERIFICATION/);
  assert.match(html, /VIEW TECHNICAL VERIFICATION/);
  assert.match(explorerSource, /onClick=\{\(\) => setView\("verification"\)\}/);
  assert.match(explorerSource, /view === "verification" && \(/);
  assert.match(explorerSource, /ORIGINAL INSCRIPTION/);

  // 3. Freedeon and Organa remain visible; Bitmapverse joins as a third
  // territory produced by the same resolver mechanism.
  assert.match(html, /Freedeon/);
  assert.match(html, /Organa/);
  assert.match(html, /Bitmapverse/);

  // 4. The route can be reversed.
  assert.match(html, /REVERSE ROUTE/);
  assert.match(explorerSource, /setRouteDirection/);

  // 5. The EXPERIMENTAL label remains visible.
  assert.match(html, /EXPERIMENTAL/);

  // 6. It is not presented as a public MVE or as a universal standard.
  assert.match(
    html,
    /Not yet a public MVE or a universal Bitmap standard/,
  );
  assert.doesNotMatch(html, /\bis\s+(?:the|a)\s+public\s+MVE\b/i);
  assert.doesNotMatch(html, /\bpublic MVE\b(?!\s+or)/);
});
