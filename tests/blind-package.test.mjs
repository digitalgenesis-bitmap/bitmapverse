import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../blind/v0.1/", import.meta.url);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function collectFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(
        ...(await collectFiles(new URL(`${entry.name}/`, directory), `${relative}/`)),
      );
    } else {
      files.push(relative);
    }
  }
  return files.sort();
}

function hasForbiddenKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  return Object.entries(value).some(
    ([key, child]) =>
      /expected|selected/i.test(key) || hasForbiddenKey(child),
  );
}

test("el manifiesto enumera todos y solamente los archivos autorizados", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("PACKAGE_MANIFEST.json", root), "utf8"),
  );
  const observed = await collectFiles(root);
  const expected = [...Object.keys(manifest.files), "PACKAGE_MANIFEST.json"].sort();

  assert.deepEqual(observed, expected);
});

test("cada hash del manifiesto coincide con el archivo entregado", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("PACKAGE_MANIFEST.json", root), "utf8"),
  );

  for (const [path, expectedHash] of Object.entries(manifest.files)) {
    assert.equal(sha256(await readFile(new URL(path, root))), expectedHash, path);
  }
});

test("los fixtures ciegos no etiquetan ningún resultado esperado o seleccionado", async () => {
  for (const name of ["507999", "7187"]) {
    const fixture = JSON.parse(
      await readFile(new URL(`fixtures/${name}.snapshot.json`, root), "utf8"),
    );
    assert.equal(hasForbiddenKey(fixture), false, name);
  }
});

test("el paquete no referencia el código, las pruebas, las ejecuciones ni los casos semánticos previos", async () => {
  const forbidden = [
    "src/resolvers",
    "same-sat-latest-v01.test",
    "shadow/runs",
    "oracle/reserved",
    "Freedeon",
    "Organa",
    "expected_selected_inscription_id",
  ];

  for (const path of await collectFiles(root)) {
    const content = await readFile(new URL(path, root), "utf8");
    for (const fragment of forbidden) {
      assert.equal(content.includes(fragment), false, `${path}: ${fragment}`);
    }
  }
});
