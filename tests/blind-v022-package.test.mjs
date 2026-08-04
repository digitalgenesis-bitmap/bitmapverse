import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

const packageRoot = new URL("../blind/v0.2.2/", import.meta.url);
// The real-secret leak scan (which needs the private oracle to know what
// values to scan for) moved to tests/private-oracle-audit.test.mjs
// (npm run test:private-audit, local-only, never part of npm run test:all).
// Everything below runs on the package's own files and the public
// fixtures/ only.

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function collectFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(new URL(`${entry.name}/`, directory), `${relative}/`)));
    } else {
      files.push(relative);
    }
  }
  return files.sort();
}

test("PACKAGE_MANIFEST.draft.json se declara explícitamente como borrador no sellado", async () => {
  const manifest = JSON.parse(await readFile(new URL("PACKAGE_MANIFEST.draft.json", packageRoot), "utf8"));
  assert.equal(manifest.status, "draft_auditable_not_sealed");
  assert.match(manifest.warning, /invalida los hashes/);
});

test("no existe PACKAGE_MANIFEST.json definitivo ni ZIP final para v0.2.2", async () => {
  const files = await collectFiles(packageRoot);
  assert.equal(files.includes("PACKAGE_MANIFEST.json"), false);

  let zipExists = true;
  try {
    await stat(new URL("../bitmapverse-blind-v0.2.2.zip", import.meta.url));
  } catch {
    zipExists = false;
  }
  assert.equal(zipExists, false);
});

test("el borrador enumera todos y solamente los archivos actuales (draft — puede regenerarse)", async () => {
  const manifest = JSON.parse(await readFile(new URL("PACKAGE_MANIFEST.draft.json", packageRoot), "utf8"));
  const observed = await collectFiles(packageRoot);
  const expected = [...Object.keys(manifest.files), "PACKAGE_MANIFEST.draft.json"].sort();
  assert.deepEqual(observed, expected);
});

test("cada hash del borrador coincide con el archivo entregado en este momento", async () => {
  const manifest = JSON.parse(await readFile(new URL("PACKAGE_MANIFEST.draft.json", packageRoot), "utf8"));
  for (const [path, expectedHash] of Object.entries(manifest.files)) {
    const actual = sha256(await readFile(new URL(path, packageRoot)));
    assert.equal(actual, expectedHash, path);
  }
});

test("el paquete no referencia código, pruebas, herramientas o resultados previos", async () => {
  // Citing blind/v0.1, blind/v0.2, or blind/v0.2.1 by path (public
  // predecessor documents) is legitimate meta-documentation and
  // intentionally NOT in this list. Nor is "switch-900"/"BitmapOCI" —
  // OPI_SOURCE_PROVENANCE.json is REQUIRED to name it explicitly, inside
  // explicitly_not_used_as_normative_source, precisely to document that
  // it was never consulted (CONTRACT.md §5's "no utilizar ni mencionar
  // como fuente normativa" prohibits USING it as a source, not
  // documenting that it was deliberately excluded). Forbidden here:
  // actual code/tooling/reserved-evidence paths.
  const forbidden = [
    "src/resolvers",
    "resolver.py",
    "same-sat-latest-v01.test",
    "conformance/proof-a-v0.1",
    "bitmapverse-blind-submission-a-001",
    "shadow/runs",
    "oracle/reserved/same-sat-latest-v01.oracle",
    "scripts/b1-prep",
    "Freedeon",
    "Organa",
  ];
  const files = await collectFiles(packageRoot);
  for (const relative of files) {
    const content = await readFile(new URL(relative, packageRoot), "utf8");
    for (const fragment of forbidden) {
      assert.equal(content.includes(fragment), false, `${relative}: ${fragment}`);
    }
  }
});

test("el paquete no referencia fixtures reales por ruta", async () => {
  const forbidden = ["fixtures/507999.snapshot.json", "fixtures/7187.snapshot.json"];
  const files = await collectFiles(packageRoot);
  for (const relative of files) {
    const content = await readFile(new URL(relative, packageRoot), "utf8");
    for (const fragment of forbidden) {
      assert.equal(content.includes(fragment), false, `${relative}: ${fragment}`);
    }
  }
});

test("el paquete declara solamente los dos Districts bajo prueba, sin evidencia adicional", async () => {
  const contract = await readFile(new URL("CONTRACT.md", packageRoot), "utf8");
  assert.match(contract, /507999\.bitmap/);
  assert.match(contract, /7187\.bitmap/);
  assert.match(contract, /959531/);
});

test("el paquete es autosuficiente: CONTRACT.md define el algoritmo completo sin depender normativamente de v0.1, v0.2 o v0.2.1", async () => {
  const contract = await readFile(new URL("CONTRACT.md", packageRoot), "utf8");
  assert.match(contract, /## 2\. Descubrimiento de la inscripción fundacional/);
  assert.match(contract, /## 6\. Orden canónico/);
  assert.match(contract, /## 7\. Selección/);
  assert.match(contract, /## 8\. Fallback a la original/);
  const algorithmSection = contract.slice(
    contract.indexOf("## 2. Descubrimiento"),
    contract.indexOf("## 9. Validaciones"),
  );
  assert.equal(algorithmSection.includes("blind/v0.1"), false);
  assert.equal(algorithmSection.includes("blind/v0.2"), false);
});

test("OPI_SOURCE_PROVENANCE.json cita el commit correcto y no cita BitmapOCI", async () => {
  const provenance = JSON.parse(await readFile(new URL("OPI_SOURCE_PROVENANCE.json", packageRoot), "utf8"));
  assert.equal(provenance.repository, "https://github.com/bestinslot-xyz/OPI");
  assert.equal(provenance.commit, "da24fb6cf4c2ef3f99d030ea2ef18ba9099b0633");
  assert.ok(provenance.explicitly_not_used_as_normative_source.includes("switch-900/BitmapOCI"));
  for (const file of provenance.files) {
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    assert.ok(file.permanent_url.includes(provenance.commit));
  }
});
