#!/usr/bin/env node
/**
 * Builds blind/v0.2/PACKAGE_MANIFEST.json: SHA-256 of every file in
 * blind/v0.2/ except the manifest itself (same self-exclusion convention
 * as blind/v0.1/PACKAGE_MANIFEST.json — the manifest cannot hash its own
 * final bytes without circularity; completeness is instead verified by a
 * test that checks the file list on disk equals manifest.files' keys plus
 * "PACKAGE_MANIFEST.json" itself, mirroring tests/blind-package.test.mjs).
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const root = new URL("../../blind/v0.2/", import.meta.url);

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

async function main() {
  const allFiles = await collectFiles(root);
  const files = {};
  for (const relative of allFiles) {
    if (relative === "PACKAGE_MANIFEST.json") continue;
    const buffer = await readFile(new URL(relative, root));
    files[relative] = sha256(buffer);
  }

  const manifest = {
    schema: "bitmapverse.blind_package_manifest.v0.2",
    package_id: "same-sat-latest-b1-prep-v0.2",
    created_at: new Date().toISOString().slice(0, 10),
    purpose:
      "Preparación de Prueba B1 — reconstrucción independiente de evidencia. No incluye fixtures, candidatos, IDs, sats ni hashes de contenido reales.",
    self_exclusion_note:
      "Este manifiesto se excluye a sí mismo de su propio listado 'files' para evitar circularidad (no puede hashear sus propios bytes finales antes de terminar de escribirse). La completitud del paquete se verifica comparando la lista de archivos en disco contra Object.keys(files) más 'PACKAGE_MANIFEST.json' — ver tests/blind-v02-package.test.mjs.",
    files,
    excluded: [
      "oráculo reservado",
      "nonce del oráculo reservado",
      "instrucciones de revelación del oráculo reservado",
      "fixtures reales",
      "candidatos reales",
      "inscription IDs reales",
      "sats reales",
      "hashes de contenido reales",
      "resultado de Prueba A",
      "hashes canónicos de resultados reales",
      "código de los resolutores existentes",
      "código de la capa de conformidad de Prueba A",
      "pruebas anteriores",
      "herramientas de preparación (scripts/b1-prep/)",
    ],
  };

  await writeFile(new URL("PACKAGE_MANIFEST.json", root), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`wrote PACKAGE_MANIFEST.json with ${Object.keys(files).length} file entries`);
  for (const f of Object.keys(files)) console.log(" -", f);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
