#!/usr/bin/env node
/**
 * Builds blind/v0.2.2/PACKAGE_MANIFEST.draft.json — explicitly a DRAFT,
 * not a sealed manifest. Unlike v0.2/v0.2.1's PACKAGE_MANIFEST.json, this
 * is expected to be regenerated repeatedly while the contract is still
 * being audited; every regeneration invalidates the previous hashes,
 * which is why the file says so about itself.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const root = new URL("../../blind/v0.2.2/", import.meta.url);

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
    if (relative === "PACKAGE_MANIFEST.draft.json") continue;
    const buffer = await readFile(new URL(relative, root));
    files[relative] = sha256(buffer);
  }

  const manifest = {
    schema: "bitmapverse.blind_package_manifest_draft.v0.2.2",
    status: "draft_auditable_not_sealed",
    package_id: "same-sat-latest-b1-prep-v0.2.2",
    generated_at: new Date().toISOString(),
    purpose:
      "Preparación de Prueba B1, contrato v0.2.2 (compatible con OPI). Borrador auditable — no representa un paquete sellado ni definitivo.",
    warning:
      "Cualquier modificación posterior a este archivo dentro de blind/v0.2.2/ invalida los hashes aquí registrados. Este documento se regenera cada vez que el contrato cambia; no debe tratarse como un compromiso de integridad estable. No existe todavía un PACKAGE_MANIFEST.json definitivo, ni un ZIP, ni un oráculo, ni un nonce, ni un compromiso criptográfico para v0.2.2 — se generarán únicamente después de que este contrato se audite y se congele, y solo después de confirmar un segundo operador OPI verdaderamente independiente (ver BITMAP_DISCOVERY_PROFILE.md, 'Bloqueo B1a').",
    self_exclusion_note:
      "Este manifiesto se excluye a sí mismo de su propio listado 'files' para evitar circularidad.",
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
      "los paquetes blind/v0.2 y blind/v0.2.1 superseded (referenciados solo por estado, no incluidos)",
      "herramientas internas de preparación del paquete",
      "ZIP final (no existe todavía)",
    ],
  };

  await writeFile(
    new URL("PACKAGE_MANIFEST.draft.json", root),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );
  console.log(`wrote PACKAGE_MANIFEST.draft.json with ${Object.keys(files).length} file entries`);
  for (const f of Object.keys(files)) console.log(" -", f);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
