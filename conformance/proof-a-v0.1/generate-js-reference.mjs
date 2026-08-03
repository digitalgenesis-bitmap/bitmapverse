#!/usr/bin/env node
/**
 * Runs the unmodified JavaScript resolver against the frozen, already-
 * committed fixtures (fixtures/507999.snapshot.json, fixtures/7187.snapshot.json
 * — the same two files app/page.tsx feeds to resolveSameSatLatestV01 in the
 * live portal) and writes the raw output to conformance/proof-a-v0.1/derived/.
 *
 * There is no historically sealed JavaScript output equivalent to
 * bitmapverse-blind-submission-a-001.zip's result.json — Prueba A sealed
 * only the independent Python submission. Every file this script writes is
 * therefore explicitly labeled "derived_after_prueba_a": generated now, from
 * the current resolver and the frozen fixtures, not a historical artifact.
 *
 * Does not modify src/resolvers/same-sat-latest-v01.mjs.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolveSameSatLatestV01 } from "../../src/resolvers/same-sat-latest-v01.mjs";

const projectRoot = new URL("../../", import.meta.url);
const derivedDir = new URL("./derived/", import.meta.url);

const CASES = [
  { fixtureId: "507999-at-959531", path: "fixtures/507999.snapshot.json" },
  { fixtureId: "7187-at-959531", path: "fixtures/7187.snapshot.json" },
];

export async function generateJsReference() {
  await mkdir(derivedDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const outputs = {};

  for (const { fixtureId, path } of CASES) {
    const fixture = JSON.parse(await readFile(new URL(path, projectRoot), "utf8"));
    const resolverOutput = resolveSameSatLatestV01(fixture);
    const wrapped = {
      provenance_label: "derived_after_prueba_a",
      note:
        "No existe una salida JavaScript históricamente sellada equivalente a la entrega Python de Prueba A. Esta salida se generó después de Prueba A, ejecutando el resolutor JavaScript actual (sin modificar) contra los fixtures congelados ya existentes en el repositorio.",
      generated_at: generatedAt,
      fixture_id: fixtureId,
      source_fixture_path: path,
      resolver_output: resolverOutput,
      // Campos estáticos de la evidencia congelada que resolveSameSatLatestV01
      // valida pero no conserva en su salida. Se incluyen aquí, leídos una
      // sola vez junto al fixture que ya alimenta al resolutor, para que
      // js-adapter.mjs pueda construir evidence_manifest sin volver a tocar
      // el fixture ni reejecutar la selección.
      evidence_snapshot: {
        observed_at: fixture.candidate_enumeration.observed_at,
        reported_count: fixture.candidate_enumeration.reported_count,
        complete_through_snapshot: fixture.candidate_enumeration.complete_through_snapshot,
        ord_endpoint: fixture.candidate_enumeration.endpoint,
      },
    };
    outputs[fixtureId] = wrapped;
    await writeFile(
      new URL(`js-reference-${fixtureId}.json`, derivedDir),
      JSON.stringify(wrapped, null, 2) + "\n",
      "utf8",
    );
  }

  return outputs;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  generateJsReference().then((outputs) => {
    console.log(`wrote ${Object.keys(outputs).length} derived_after_prueba_a JS reference file(s)`);
  });
}
