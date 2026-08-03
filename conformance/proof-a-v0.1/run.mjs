#!/usr/bin/env node
/**
 * Single, offline command to reproduce the Prueba A output-conformance
 * check: `node conformance/proof-a-v0.1/run.mjs` (wired as
 * `npm run conformance:proof-a`).
 *
 * 1. Verifies every protected historical artifact against a real, cited
 *    prior commitment where one exists (custody.mjs) — before and after.
 * 2. Extracts the sealed submission to a fresh OS temp directory (never
 *    edits inside the ZIP).
 * 3. Generates the derived_after_prueba_a JS reference outputs (unmodified
 *    resolver, frozen fixtures).
 * 4. Builds JS's full resolution_result (pure) and Python's
 *    resolution_result_core (pure) + its always-failing full attempt, via
 *    python_conformance_cli.py.
 * 5. Compares JS-core vs Python-core: semantic equality, canonical bytes,
 *    canonical SHA-256.
 * 6. Runs conformance/proof-a-v0.1/tests/conformance.test.mjs via `node --test`.
 * 7. Writes conformance/proof-a-v0.1/report.json.
 *
 * Overall status is NO CONFORME whenever the sealed Python submission
 * cannot satisfy resolution_result.v0.1 without consulting evidence
 * external to itself — which is a structural fact about this sealed
 * submission, not something that varies by fixture. The narrower,
 * separately-reported claim "CONFORME para el núcleo común de selección y
 * posición" is only made if the core fields actually match, byte for byte,
 * for every case.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalize } from "./adapters/canonical-json.mjs";
import { validate } from "./adapters/json-schema-lite.mjs";
import { toResolutionResult } from "./adapters/js-adapter.mjs";
import { buildEvidenceManifest } from "./adapters/evidence-enrichment.mjs";
import { generateJsReference } from "./generate-js-reference.mjs";
import { verifyCustodyChain } from "./custody.mjs";

const projectRoot = new URL("../../", import.meta.url);
const sealedZipPath = new URL("bitmapverse-blind-submission-a-001.zip", projectRoot);

const CASES = [
  { fixtureId: "507999-at-959531", fixturePath: "fixtures/507999.snapshot.json" },
  { fixtureId: "7187-at-959531", fixturePath: "fixtures/7187.snapshot.json" },
];

function toCore(resolutionResult) {
  const { eligible_candidate_count, ...core } = resolutionResult;
  void eligible_candidate_count;
  return core;
}

function runPythonConformanceCli(sealedResultPath, fixtureId, frozenFixturePath) {
  const cliPath = new URL("./python_conformance_cli.py", import.meta.url).pathname;
  const stdout = execFileSync(
    "python3",
    [cliPath, sealedResultPath, fixtureId, frozenFixturePath],
    { encoding: "utf8" },
  );
  return JSON.parse(stdout);
}

async function main() {
  const startedAt = new Date().toISOString();

  const custodyBefore = await verifyCustodyChain();
  if (!custodyBefore.allVerifiedMatch) {
    throw new Error("custody chain check failed before running conformance — see custodyBefore.results");
  }

  const sealedDir = await mkdtemp(join(tmpdir(), "bitmapverse-proof-a-sealed-"));
  execFileSync("unzip", ["-o", "-q", sealedZipPath.pathname, "-d", sealedDir]);

  const jsReferences = await generateJsReference();

  const schemas = {
    resolutionResult: JSON.parse(
      await readFile(new URL("schemas/resolution-result-v01.schema.json", projectRoot), "utf8"),
    ),
    evidenceManifest: JSON.parse(
      await readFile(new URL("schemas/evidence-manifest-v01.schema.json", projectRoot), "utf8"),
    ),
  };

  const cases = {};
  let coreConformanceHolds = true;

  for (const { fixtureId, fixturePath } of CASES) {
    const wrapped = jsReferences[fixtureId];
    const jsResult = toResolutionResult(wrapped);
    const jsFullValidation = validate(schemas.resolutionResult, jsResult);
    const jsCore = toCore(jsResult);
    const jsCoreCanonical = canonicalize(jsCore);
    const jsCoreHash = createHash("sha256").update(Buffer.from(jsCoreCanonical, "utf8")).digest("hex");

    const jsFullCanonical = canonicalize(jsResult);
    const jsFullHash = createHash("sha256").update(Buffer.from(jsFullCanonical, "utf8")).digest("hex");
    const jsManifest = buildEvidenceManifest(wrapped, jsFullHash);
    const jsManifestValidation = validate(schemas.evidenceManifest, jsManifest);

    const pyOutput = runPythonConformanceCli(
      join(sealedDir, "result.json"),
      fixtureId,
      new URL(fixturePath, projectRoot).pathname,
    );
    const pyCoreValidationAgainstFullSchema = validate(schemas.resolutionResult, pyOutput.resolution_result_core);
    const pyManifestValidation = validate(schemas.evidenceManifest, pyOutput.evidence_manifest);

    const pyCoreCanonicalFromJsCodec = canonicalize(pyOutput.resolution_result_core);
    const coreSemanticEqual = JSON.stringify(jsCore) === JSON.stringify(pyOutput.resolution_result_core);
    const coreCanonicalBytesEqual = jsCoreCanonical === pyCoreCanonicalFromJsCodec;
    const coreCanonicalHashEqual = jsCoreHash === pyOutput.resolution_result_core_canonical_sha256;

    const pythonCoreValidationOnlyMissingCount =
      !pyCoreValidationAgainstFullSchema.valid &&
      pyCoreValidationAgainstFullSchema.errors.length === 1 &&
      /eligible_candidate_count/.test(pyCoreValidationAgainstFullSchema.errors[0]);

    if (
      !coreSemanticEqual ||
      !coreCanonicalBytesEqual ||
      !coreCanonicalHashEqual ||
      !jsFullValidation.valid ||
      !jsManifestValidation.valid ||
      !pyManifestValidation.valid ||
      !pythonCoreValidationOnlyMissingCount
    ) {
      coreConformanceHolds = false;
    }

    cases[fixtureId] = {
      js: {
        resolution_result_full: jsResult,
        resolution_result_full_schema_valid: jsFullValidation.valid,
        resolution_result_core_canonical_sha256: jsCoreHash,
        evidence_manifest: jsManifest,
        evidence_manifest_schema_valid: jsManifestValidation.valid,
      },
      python: {
        resolution_result_core: pyOutput.resolution_result_core,
        resolution_result_core_canonical_sha256: pyOutput.resolution_result_core_canonical_sha256,
        resolution_result_full_error: pyOutput.resolution_result_full_error,
        resolution_result_core_validated_against_full_schema: pyCoreValidationAgainstFullSchema,
        evidence_manifest: pyOutput.evidence_manifest,
        evidence_manifest_schema_valid: pyManifestValidation.valid,
      },
      core_semantic_equal: coreSemanticEqual,
      core_canonical_bytes_equal: coreCanonicalBytesEqual,
      core_canonical_sha256_equal: coreCanonicalHashEqual,
      core_canonical_sha256: jsCoreHash,
    };
  }

  await rm(sealedDir, { recursive: true, force: true });

  let testSummary;
  try {
    const output = execFileSync(
      "node",
      ["--test", new URL("./tests/conformance.test.mjs", import.meta.url).pathname],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    testSummary = { ok: true, output };
  } catch (error) {
    testSummary = { ok: false, output: `${error.stdout ?? ""}\n${error.stderr ?? ""}` };
  }
  const passMatch = /ℹ pass (\d+)/.exec(testSummary.output);
  const failMatch = /ℹ fail (\d+)/.exec(testSummary.output);
  const totalMatch = /ℹ tests (\d+)/.exec(testSummary.output);
  const testsPass = testSummary.ok && failMatch?.[1] === "0";

  const custodyAfter = await verifyCustodyChain();
  if (!custodyAfter.allVerifiedMatch) {
    throw new Error("custody chain check failed after running conformance — see custodyAfter.results");
  }
  const auditBaselineBefore = custodyBefore.results.find((r) => r.path === "blind/audits/proof-a-001.md");
  const auditBaselineAfter = custodyAfter.results.find((r) => r.path === "blind/audits/proof-a-001.md");
  const auditFileUnchangedDuringRun = auditBaselineBefore.actual_sha256 === auditBaselineAfter.actual_sha256;

  // Structural fact about this sealed submission, independent of fixture:
  // resolver.py's sealed candidate_count cannot be proven to mean
  // eligible_candidate_count without consulting the frozen fixture, which
  // the pure adapter refuses to do. So the *full* schema can never be
  // satisfied by sealed_result alone.
  const fullConformancePossibleFromSealedDataAlone = false;

  const status = "NO CONFORME";
  const coreStatus = testsPass && coreConformanceHolds && auditFileUnchangedDuringRun ? "CONFORME" : "NO CONFORME";

  const report = {
    schema: "bitmapverse.proof_a_conformance_report.v0.1",
    version: "0.2.0",
    generated_at: startedAt,
    status,
    core_status: coreStatus,
    full_conformance_possible_from_sealed_data_alone: fullConformancePossibleFromSealedDataAlone,
    claims: {
      full: "NO CONFORME: el result.json sellado de Python no puede satisfacer resolution_result.v0.1 sin consultar evidencia externa (el fixture congelado) para eligible_candidate_count.",
      core:
        coreStatus === "CONFORME"
          ? "CONFORME para el núcleo común de selección y posición: district, district_name, resolver, original_inscription_id, selected_inscription_id, selected_content_sha256, sat, selected_position y snapshot son semántica y canónicamente idénticos entre JavaScript y Python en ambos fixtures."
          : "NO CONFORME también para el núcleo común — ver cases[*].core_semantic_equal / core_canonical_*_equal.",
      pending_successor_contract:
        "La conformidad completa (incluyendo eligible_candidate_count) queda pendiente de una v0.2 de blind/v0.1/CONTRACT.md que especifique si `candidate_count` en la salida mínima de Python significa total observado o elegible tras el snapshot, y que declare explícitamente el campo `resolver`.",
    },
    custody: {
      before: custodyBefore,
      after: custodyAfter,
      audit_file_unchanged_during_run: auditFileUnchangedDuringRun,
    },
    cases,
    tests: {
      command: "node --test conformance/proof-a-v0.1/tests/conformance.test.mjs",
      total: totalMatch ? Number(totalMatch[1]) : null,
      passed: passMatch ? Number(passMatch[1]) : null,
      failed: failMatch ? Number(failMatch[1]) : null,
      ok: testsPass,
    },
    limits: [
      "El result.json sellado de Python nunca declaró un desglose elegible/excluido; su candidate_count es el total observado por definición de resolver.py, no el subconjunto elegible que exige resolution_result.v0.1.",
      "snapshot.block_timestamp no está declarado en ningún fixture congelado; ambos lados emiten null (ver CANONICALIZATION.md).",
      "El lado JavaScript es derived_after_prueba_a (generado ahora contra los fixtures congelados); no existe una salida JavaScript históricamente sellada equivalente al result.json de Python.",
      "evidence_manifest.sources.*.operator es null en ambos lados: ningún fixture congelado declara quién operó la consulta OPI o la enumeración Ord.",
      "blind/audits/proof-a-001.md no tiene un compromiso criptográfico previo registrado en este repositorio; su hash se trata como una línea base nueva desde esta revisión, no como una verificación retrospectiva.",
    ],
  };

  await writeFile(
    new URL("./report.json", import.meta.url),
    JSON.stringify(report, null, 2) + "\n",
    "utf8",
  );

  console.log(`Estado completo: ${status}`);
  console.log(`Estado del núcleo común: ${coreStatus}`);
  console.log(`Pruebas: ${report.tests.passed}/${report.tests.total} pasaron`);
  for (const [fixtureId, c] of Object.entries(cases)) {
    console.log(
      `  ${fixtureId}: core_canonical_sha256=${c.core_canonical_sha256} equal=${c.core_canonical_sha256_equal}`,
    );
  }
  console.log(`Cadena de custodia verificada (antes y después): ${custodyBefore.allVerifiedMatch && custodyAfter.allVerifiedMatch}`);
  console.log("report.json escrito en conformance/proof-a-v0.1/report.json");

  if (coreStatus !== "CONFORME") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
