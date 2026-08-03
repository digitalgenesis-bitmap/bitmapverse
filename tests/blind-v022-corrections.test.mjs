import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  isValidArtifactId,
  hashOfArtifactId,
  artifactPathFor,
  verifyArtifactOnDisk,
} from "../scripts/b1-prep-v022/artifact-addressing.mjs";
import {
  compareResolutionResults,
  validateEvidenceManifestIndependently,
} from "../scripts/b1-prep-v022/comparison-protocol.mjs";
import { indexBlocksInOrder } from "../scripts/b1-prep-v022/bitmap_discovery_opi_v1.mjs";

// --- Point 3: content-addressed artifacts — format rejection.

test("artifact_id: formato válido es aceptado", () => {
  assert.equal(isValidArtifactId("sha256:" + "a".repeat(64)), true);
});

test("artifact_id: mayúsculas son rechazadas", () => {
  assert.equal(isValidArtifactId("sha256:" + "A".repeat(64)), false);
});

test("artifact_id: longitud incorrecta es rechazada", () => {
  assert.equal(isValidArtifactId("sha256:" + "a".repeat(63)), false);
  assert.equal(isValidArtifactId("sha256:" + "a".repeat(65)), false);
});

test("artifact_id: '..' es rechazado", () => {
  assert.equal(isValidArtifactId("sha256:../../etc/passwd"), false);
  assert.equal(isValidArtifactId(".." + "a".repeat(62)), false);
});

test("artifact_id: ruta absoluta es rechazada", () => {
  assert.equal(isValidArtifactId("sha256:/etc/passwd"), false);
  assert.equal(isValidArtifactId("/sha256:" + "a".repeat(64)), false);
});

test("artifact_id: separador no POSIX (barra invertida) es rechazado", () => {
  assert.equal(isValidArtifactId("sha256:" + "a".repeat(60) + "\\..\\"), false);
});

test("artifact_id: prefijo distinto de 'sha256:' es rechazado", () => {
  assert.equal(isValidArtifactId("md5:" + "a".repeat(64)), false);
  assert.equal(isValidArtifactId("a".repeat(64)), false); // no prefix at all
});

test("artifact_id: carácter no hexadecimal en el hash es rechazado", () => {
  assert.equal(isValidArtifactId("sha256:" + "g".repeat(64)), false);
});

test("artifactPathFor deriva siempre artifacts/sha256/<hex>, nunca otra ubicación", () => {
  const id = "sha256:" + "c".repeat(64);
  assert.equal(artifactPathFor(id), "artifacts/sha256/" + "c".repeat(64));
  assert.equal(hashOfArtifactId(id), "c".repeat(64));
});

// --- Point 3: physical on-disk verification.

let tmpRoot;

test.before(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), "bitmapverse-artifact-verify-"));
  await mkdir(join(tmpRoot, "artifacts", "sha256"), { recursive: true });
});

test.after(async () => {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
});

async function writeRealArtifact(content) {
  const hash = createHash("sha256").update(content).digest("hex");
  const id = `sha256:${hash}`;
  await writeFile(join(tmpRoot, "artifacts", "sha256", hash), content);
  return { id, hash, size: content.length };
}

test("verifyArtifactOnDisk: archivo regular con hash y tamaño correctos es aceptado", async () => {
  const content = Buffer.from("hello world");
  const { id, size } = await writeRealArtifact(content);
  const { valid, errors } = await verifyArtifactOnDisk(id, size, tmpRoot);
  assert.equal(valid, true, errors.join("; "));
});

test("verifyArtifactOnDisk: hash incorrecto (contenido no coincide con el nombre) es rechazado", async () => {
  const content = Buffer.from("some content");
  const wrongId = "sha256:" + "d".repeat(64);
  await writeFile(join(tmpRoot, "artifacts", "sha256", "d".repeat(64)), content);
  const { valid, errors } = await verifyArtifactOnDisk(wrongId, content.length, tmpRoot);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("does not match artifact_id hash")));
});

test("verifyArtifactOnDisk: tamaño incorrecto es rechazado", async () => {
  const content = Buffer.from("another payload");
  const { id } = await writeRealArtifact(content);
  const { valid, errors } = await verifyArtifactOnDisk(id, content.length + 1, tmpRoot);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("does not match declared size_bytes")));
});

test("verifyArtifactOnDisk: enlace simbólico es rechazado, nunca tratado como archivo regular", async () => {
  const content = Buffer.from("target file content");
  const { hash, size } = await writeRealArtifact(content);
  // Create a second, different hash whose "file" is actually a symlink
  // pointing at the real artifact — must be rejected regardless of the
  // fact that following the link would produce matching bytes.
  const symlinkHash = "e".repeat(64);
  await symlink(
    join(tmpRoot, "artifacts", "sha256", hash),
    join(tmpRoot, "artifacts", "sha256", symlinkHash),
  );
  const { valid, errors } = await verifyArtifactOnDisk(`sha256:${symlinkHash}`, size, tmpRoot);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("symbolic link")));
});

test("verifyArtifactOnDisk: archivo ausente (fuera de artifacts/sha256/) es rechazado", async () => {
  const missingId = "sha256:" + "f".repeat(64);
  const { valid, errors } = await verifyArtifactOnDisk(missingId, 10, tmpRoot);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("no file at expected path")));
});

test("verifyArtifactOnDisk: artifact_id con formato inválido se rechaza antes de tocar el disco", async () => {
  const { valid, errors } = await verifyArtifactOnDisk("not-a-valid-id", 10, tmpRoot);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("invalid artifact_id format")));
});

// --- Point 2: normative comparison protocol.

test("compareResolutionResults: aprueba solo con igualdad exacta de hash canónico", async () => {
  const expected = JSON.parse(
    await readFile(new URL("../blind/v0.2.2/test-vectors/synthetic-count-split.expected.json", import.meta.url), "utf8"),
  );
  const schema = JSON.parse(
    await readFile(new URL("../blind/v0.2.2/RESOLUTION_RESULT_SCHEMA.json", import.meta.url), "utf8"),
  );
  const identical = compareResolutionResults(expected.resolution_result, expected.resolution_result, schema);
  assert.equal(identical.approved, true);
  assert.equal(identical.hashes_equal, true);
});

test("compareResolutionResults: una diferencia semántica mínima nunca se aprueba, aunque el diagnóstico la explique", async () => {
  const expected = JSON.parse(
    await readFile(new URL("../blind/v0.2.2/test-vectors/synthetic-count-split.expected.json", import.meta.url), "utf8"),
  );
  const schema = JSON.parse(
    await readFile(new URL("../blind/v0.2.2/RESOLUTION_RESULT_SCHEMA.json", import.meta.url), "utf8"),
  );
  const almostIdentical = { ...expected.resolution_result, eligible_through_resolution_snapshot_count: expected.resolution_result.eligible_through_resolution_snapshot_count + 1 };
  const result = compareResolutionResults(expected.resolution_result, almostIdentical, schema);
  assert.equal(result.approved, false);
  assert.equal(result.hashes_equal, false);
  // The diagnostic exists and correctly identifies the one differing
  // field — but its existence must never flip `approved` to true.
  assert.ok(result.diagnostic_semantic_diff);
  assert.deepEqual(Object.keys(result.diagnostic_semantic_diff), ["eligible_through_resolution_snapshot_count"]);
});

test("compareResolutionResults: un resultado inválido contra el esquema nunca se aprueba, incluso si los hashes coinciden por casualidad", async () => {
  const schema = JSON.parse(
    await readFile(new URL("../blind/v0.2.2/RESOLUTION_RESULT_SCHEMA.json", import.meta.url), "utf8"),
  );
  const notASchemaValidObject = { foo: "bar" };
  const result = compareResolutionResults(notASchemaValidObject, notASchemaValidObject, schema);
  assert.equal(result.hashes_equal, true); // identical objects, so hashes trivially match...
  assert.equal(result.approved, false); // ...but schema invalidity still blocks approval
});

test("validateEvidenceManifestIndependently: valida un manifiesto bien formado, y sus propios hashes contra los objetos que dice describir", async () => {
  const expected = JSON.parse(
    await readFile(new URL("../blind/v0.2.2/test-vectors/synthetic-count-split.expected.json", import.meta.url), "utf8"),
  );
  const emSchema = JSON.parse(
    await readFile(new URL("../blind/v0.2.2/EVIDENCE_MANIFEST_SCHEMA.json", import.meta.url), "utf8"),
  );
  const result = validateEvidenceManifestIndependently(expected.evidence_manifest, emSchema, {
    resolutionResult: expected.resolution_result,
    candidateSet: expected.candidate_set_through_resolution_snapshot,
  });
  assert.equal(result.valid, true, JSON.stringify(result));
});

test("validateEvidenceManifestIndependently: un hash declarado que no reproduce el objeto real es rechazado", async () => {
  const expected = JSON.parse(
    await readFile(new URL("../blind/v0.2.2/test-vectors/synthetic-count-split.expected.json", import.meta.url), "utf8"),
  );
  const emSchema = JSON.parse(
    await readFile(new URL("../blind/v0.2.2/EVIDENCE_MANIFEST_SCHEMA.json", import.meta.url), "utf8"),
  );
  const tampered = { ...expected.evidence_manifest, resolution_result_canonical_sha256: "0".repeat(64) };
  const result = validateEvidenceManifestIndependently(tampered, emSchema, {
    resolutionResult: expected.resolution_result,
  });
  assert.equal(result.valid, false);
  assert.ok(result.hash_check_errors.length > 0);
});

test("dos evidence_manifest válidos e independientes nunca se comparan entre sí byte a byte", async () => {
  // There is deliberately no function in comparison-protocol.mjs that
  // takes two evidence_manifest objects and compares them — this test
  // documents that absence as intentional, not an oversight, by
  // asserting the module's exported surface.
  const comparisonProtocol = await import("../scripts/b1-prep-v022/comparison-protocol.mjs");
  assert.equal(typeof comparisonProtocol.compareEvidenceManifests, "undefined");
  assert.equal(typeof comparisonProtocol.compareResolutionResults, "function");
  assert.equal(typeof comparisonProtocol.validateEvidenceManifestIndependently, "function");
});

// --- Point 6: discovery order is a genuine permutation invariant, not
// just robust to .reverse().

test("permutación: cualquier orden de entrada produce el mismo ganador y el mismo conteo de rechazos", async () => {
  const input = JSON.parse(
    await readFile(new URL("../blind/v0.2.2/test-vectors/synthetic-opi-discovery.input.json", import.meta.url), "utf8"),
  );
  const flatCandidates = input.blocks_ascending.flatMap((b) =>
    b.candidates.map((c) => ({
      inscriptionId: c.inscription_id,
      inscriptionNumber: c.inscription_number,
      contentHex: c.content_hex,
      isJson: c.is_json,
      contentTypeHex: c.content_type_hex,
      blockHeight: c.block_height,
    })),
  );

  // Group by block_height (required: blocks must still be processed in
  // ascending height order — only the within-block and overall candidate
  // *array* order is being permuted here, not the block-height grouping
  // itself, which CONTRACT.md §9 also fixes independently).
  function toBlocksAscending(candidates) {
    const byHeight = new Map();
    for (const c of candidates) {
      if (!byHeight.has(c.blockHeight)) byHeight.set(c.blockHeight, []);
      byHeight.get(c.blockHeight).push(c);
    }
    return [...byHeight.entries()].sort((a, b) => a[0] - b[0]).map(([, cs]) => cs);
  }

  function seededShuffle(array, seed) {
    const a = [...array];
    let s = seed;
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor((s / 233280) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const baseline = indexBlocksInOrder(toBlocksAscending(flatCandidates));
  const baselineEntries = [...baseline.entries()].sort();

  for (const seed of [1, 2, 3, 42, 12345]) {
    const shuffled = seededShuffle(flatCandidates, seed);
    const result = indexBlocksInOrder(toBlocksAscending(shuffled));
    const resultEntries = [...result.entries()].sort();
    assert.deepEqual(resultEntries, baselineEntries, `seed ${seed} produced a different winner set`);
  }
});
