import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidBitmapCandidate,
  getBitmapNumber,
  isBlockExisting,
  indexBlockCandidates,
  indexBlocksInOrder,
} from "../scripts/b1-prep-v022/bitmap_discovery_opi_v1.mjs";
import { validateReferentialIntegrity } from "../scripts/b1-prep-v022/evidence-manifest-integrity.mjs";
import { resolveSameSatLatestV01 } from "../src/resolvers/same-sat-latest-v01.mjs";

const TEXT_PLAIN_HEX = "746578742f706c61696e"; // "text/plain"
const TEXT_PLAIN_CHARSET_HEX = Buffer.from("text/plain;charset=utf-8", "utf8").toString("hex");
const APPLICATION_JSON_HEX = Buffer.from("application/json", "utf8").toString("hex");

function hexOf(text) {
  return Buffer.from(text, "utf8").toString("hex");
}

// These 25 tests correspond 1:1 to CONTRACT.md TASK's "Pruebas obligatorias
// nuevas" list. They demonstrate conformidad interna con el contrato
// v0.2.2 — no independencia de infraestructura, tal como exige esa
// sección.

// 1. inscripción negativa rechazada
test("1. inscription_number negativo es rechazado", () => {
  const ok = isValidBitmapCandidate({ inscriptionNumber: -1, isJson: false, contentTypeHex: TEXT_PLAIN_HEX });
  assert.equal(ok, false);
});

// 2. is_json == true rechazada
test("2. is_json === true es rechazado", () => {
  const ok = isValidBitmapCandidate({ inscriptionNumber: 100, isJson: true, contentTypeHex: TEXT_PLAIN_HEX });
  assert.equal(ok, false);
});

// 3. content type que no comienza con el prefijo hex de text/plain rechazado
test("3. content_type_hex que no empieza con el prefijo de text/plain es rechazado", () => {
  const ok = isValidBitmapCandidate({ inscriptionNumber: 100, isJson: false, contentTypeHex: APPLICATION_JSON_HEX });
  assert.equal(ok, false);
});

// 4. text/plain;charset=utf-8 aceptado por coincidencia de prefijo
test("4. content_type_hex de text/plain;charset=utf-8 es aceptado por coincidencia de prefijo", () => {
  const ok = isValidBitmapCandidate({
    inscriptionNumber: 100,
    isJson: false,
    contentTypeHex: TEXT_PLAIN_CHARSET_HEX,
  });
  assert.equal(ok, true);
});

// 5. hexadecimal inválido rechazado
test("5. content_hex hexadecimal inválido es rechazado", () => {
  assert.equal(getBitmapNumber("zz"), null); // not hex at all
  assert.equal(getBitmapNumber("abc"), null); // odd length
});

// 6. UTF-8 inválido rechazado
test("6. content_hex que decodifica a UTF-8 inválido es rechazado", () => {
  // 0xFF is never valid as a UTF-8 continuation/lead byte on its own.
  assert.equal(getBitmapNumber("ff"), null);
});

// 7. contenido sin .bitmap rechazado
test("7. contenido sin sufijo .bitmap es rechazado", () => {
  assert.equal(getBitmapNumber(hexOf("507999")), null);
});

// 8. contenido con espacios rechazado
test("8. contenido con espacios es rechazado", () => {
  assert.equal(getBitmapNumber(hexOf("507999 .bitmap")), null);
  assert.equal(getBitmapNumber(hexOf(" 507999.bitmap")), null);
});

// 9. mayúsculas alternativas rechazadas
test("9. mayúsculas alternativas en el sufijo son rechazadas", () => {
  assert.equal(getBitmapNumber(hexOf("507999.BITMAP")), null);
  assert.equal(getBitmapNumber(hexOf("507999.Bitmap")), null);
});

// 10. parte numérica vacía rechazada
test("10. parte numérica vacía (\".bitmap\" solo) es rechazada", () => {
  assert.equal(getBitmapNumber(hexOf(".bitmap")), null);
});

// 11. caracteres no ASCII rechazados
test("11. dígitos Unicode no-ASCII son rechazados aunque parezcan dígitos", () => {
  // U+FF15 FULLWIDTH DIGIT FIVE, etc. — visually digit-like, not ASCII '0'-'9'.
  assert.equal(getBitmapNumber(hexOf("５０７９９９.bitmap")), null);
});

// 12. "00.bitmap" rechazado
test("12. \"00.bitmap\" es rechazado (cero inicial, longitud > 1)", () => {
  assert.equal(getBitmapNumber(hexOf("00.bitmap")), null);
});

// 13. "01.bitmap" rechazado
test("13. \"01.bitmap\" es rechazado (cero inicial, longitud > 1)", () => {
  assert.equal(getBitmapNumber(hexOf("01.bitmap")), null);
});

// 14. "0.bitmap" aceptado
test("14. \"0.bitmap\" es aceptado (caso exacto permitido de cero inicial)", () => {
  assert.equal(getBitmapNumber(hexOf("0.bitmap")), 0);
});

// 15. bloque futuro rechazado
test("15. bitmap_number mayor que block_height es rechazado (bloque todavía inexistente)", () => {
  assert.equal(isBlockExisting(500000, 499999), false);
  assert.equal(isBlockExisting(500000, 500000), true);
});

// 16. primera reclamación válida conservada
test("16. la primera reclamación válida para un bitmap_number se conserva", () => {
  const candidates = [
    {
      inscriptionId: "a".repeat(64) + "i0",
      inscriptionNumber: 10,
      contentHex: hexOf("999.bitmap"),
      isJson: false,
      contentTypeHex: TEXT_PLAIN_HEX,
      blockHeight: 999,
    },
  ];
  const claims = indexBlockCandidates(candidates);
  assert.equal(claims.get(999).inscriptionId, "a".repeat(64) + "i0");
});

// 17. duplicado posterior ignorado
test("17. una reclamación válida posterior para el mismo bitmap_number se ignora", () => {
  const candidates = [
    {
      inscriptionId: "a".repeat(64) + "i0",
      inscriptionNumber: 10,
      contentHex: hexOf("999.bitmap"),
      isJson: false,
      contentTypeHex: TEXT_PLAIN_HEX,
      blockHeight: 999,
    },
    {
      inscriptionId: "b".repeat(64) + "i0",
      inscriptionNumber: 11, // later inscription_number, same bitmap_number
      contentHex: hexOf("999.bitmap"),
      isJson: false,
      contentTypeHex: TEXT_PLAIN_HEX,
      blockHeight: 999,
    },
  ];
  const claims = indexBlockCandidates(candidates);
  assert.equal(claims.size, 1);
  assert.equal(claims.get(999).inscriptionId, "a".repeat(64) + "i0");
});

// 18. dos candidatas dentro del mismo bloque ordenadas por inscription_number
test("18. dos candidatas del mismo bloque se procesan en orden de inscription_number, no de llegada", () => {
  const candidates = [
    {
      inscriptionId: "b".repeat(64) + "i0",
      inscriptionNumber: 20, // arrives first in the array...
      contentHex: hexOf("1000.bitmap"),
      isJson: false,
      contentTypeHex: TEXT_PLAIN_HEX,
      blockHeight: 1000,
    },
    {
      inscriptionId: "a".repeat(64) + "i0",
      inscriptionNumber: 5, // ...but has the lower inscription_number
      contentHex: hexOf("1000.bitmap"),
      isJson: false,
      contentTypeHex: TEXT_PLAIN_HEX,
      blockHeight: 1000,
    },
  ];
  const claims = indexBlockCandidates(candidates);
  // Lower inscription_number wins the ON CONFLICT DO NOTHING race, matching
  // server.rs's sort_by(inscription_number) before bitmap_index.py inserts.
  assert.equal(claims.get(1000).inscriptionId, "a".repeat(64) + "i0");
});

// 19. orden de respuesta de entrada alterado no cambia el resultado
test("19. alterar el orden de entrada de los candidatos no cambia el resultado tras aplicar el orden OPI", () => {
  const candidates = [
    {
      inscriptionId: "a".repeat(64) + "i0",
      inscriptionNumber: 1,
      contentHex: hexOf("2000.bitmap"),
      isJson: false,
      contentTypeHex: TEXT_PLAIN_HEX,
      blockHeight: 2000,
    },
    {
      inscriptionId: "c".repeat(64) + "i0",
      inscriptionNumber: 3,
      contentHex: hexOf("2001.bitmap"),
      isJson: false,
      contentTypeHex: TEXT_PLAIN_HEX,
      blockHeight: 2001,
    },
    {
      inscriptionId: "b".repeat(64) + "i0",
      inscriptionNumber: 2,
      contentHex: hexOf("2002.bitmap"),
      isJson: false,
      contentTypeHex: TEXT_PLAIN_HEX,
      blockHeight: 2002,
    },
  ];
  const forward = indexBlockCandidates(candidates);
  const shuffled = indexBlockCandidates([...candidates].reverse());
  assert.deepEqual([...forward.entries()], [...shuffled.entries()]);
});

// 20. ausencia de inscription_number bloquea el descubrimiento
test("20. un candidato sin inscription_number utilizable no puede reclamar un District", () => {
  // Modeled as: a candidate object missing inscriptionNumber must not be
  // silently treated as eligible. isValidBitmapCandidate requires a
  // numeric comparison against 0 — undefined fails that comparison and is
  // therefore never valid, which is the intended fail-closed behavior.
  const ok = isValidBitmapCandidate({ inscriptionNumber: undefined, isJson: false, contentTypeHex: TEXT_PLAIN_HEX });
  assert.equal(ok, false);
});

const A1 = "sha256:" + "a".repeat(64);
const VALID_IDENTITY = { name: "test-tool", verification_method: "binary_sha256", binary_sha256: "b".repeat(64) };

function capturedSource(overrides = {}) {
  return {
    source_id: "s1",
    role: "candidate_enumeration",
    implementation_identity: VALID_IDENTITY,
    operator: null,
    request: { method: "GET", path: "/x", parameters: {} },
    capture_status: "captured",
    artifact_ids: [A1],
    pagination: { complete: true, page_count: 1, pages: [{ page_index: 0, artifact_id: A1 }] },
    limitations: [],
    ...overrides,
  };
}

function notCapturedSource(overrides = {}) {
  return {
    source_id: "s1",
    role: "candidate_enumeration",
    implementation_identity: VALID_IDENTITY,
    operator: null,
    request: { method: "GET", path: "/x", parameters: {} },
    capture_status: "not_captured_no_public_instance",
    artifact_ids: [],
    pagination: { complete: false, page_count: 0, pages: [] },
    limitations: ["no public instance available"],
    ...overrides,
  };
}

// 21. integridad source_id <-> artifact_id
test("21. una fuente y un artefacto coherentes bidireccionalmente son aceptados", () => {
  const manifest = {
    sources: [capturedSource()],
    captured_artifacts: [{ artifact_id: A1, source_id: "s1" }],
  };
  const { valid, errors } = validateReferentialIntegrity(manifest);
  assert.equal(valid, true, errors.join("; "));
});

// 22. referencias inexistentes rechazadas
test("22. una referencia a un source_id o artifact_id inexistente es rechazada", () => {
  const manifestBadArtifact = {
    sources: [capturedSource({ artifact_ids: ["sha256:" + "9".repeat(64)] })],
    captured_artifacts: [],
  };
  assert.equal(validateReferentialIntegrity(manifestBadArtifact).valid, false);

  const manifestBadSource = {
    sources: [],
    captured_artifacts: [{ artifact_id: A1, source_id: "does-not-exist" }],
  };
  assert.equal(validateReferentialIntegrity(manifestBadSource).valid, false);
});

// 23. identificadores duplicados rechazados
test("23. source_id o artifact_id duplicados son rechazados", () => {
  const dupSource = {
    sources: [notCapturedSource(), notCapturedSource()],
    captured_artifacts: [],
  };
  assert.equal(validateReferentialIntegrity(dupSource).valid, false);

  const dupArtifact = {
    sources: [],
    captured_artifacts: [
      { artifact_id: A1, source_id: "s1" },
      { artifact_id: A1, source_id: "s1" },
    ],
  };
  assert.equal(validateReferentialIntegrity(dupArtifact).valid, false);
});

// 24. operador no observado no puede fabricar artefactos ni observed_at
test("24. una fuente no capturada no puede declarar artefactos", () => {
  const manifest = {
    sources: [notCapturedSource({ artifact_ids: [A1] })], // fabricated — must be rejected
    captured_artifacts: [{ artifact_id: A1, source_id: "s1" }],
  };
  const { valid, errors } = validateReferentialIntegrity(manifest);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("must be empty when capture_status")));
});

test("24b. una fuente no capturada sin limitations es rechazada", () => {
  const manifest = {
    sources: [notCapturedSource({ limitations: [] })],
    captured_artifacts: [],
  };
  const { valid, errors } = validateReferentialIntegrity(manifest);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("limitations must be non-empty")));
});

// --- Point 4: implementation_identity by role.

test("bitmap_discovery exige el commit OPI fijado; otros roles aceptan identidades reproducibles alternativas", () => {
  const good = capturedSource({
    role: "bitmap_discovery",
    implementation_identity: {
      name: "OPI",
      verification_method: "commit",
      repository: "https://github.com/bestinslot-xyz/OPI",
      commit: "da24fb6cf4c2ef3f99d030ea2ef18ba9099b0633",
    },
  });
  assert.equal(validateReferentialIntegrity({ sources: [good], captured_artifacts: [{ artifact_id: A1, source_id: "s1" }] }).valid, true);

  const wrongCommit = capturedSource({
    role: "bitmap_discovery",
    implementation_identity: {
      name: "OPI",
      verification_method: "commit",
      repository: "https://github.com/bestinslot-xyz/OPI",
      commit: "0".repeat(40),
    },
  });
  assert.equal(validateReferentialIntegrity({ sources: [wrongCommit], captured_artifacts: [{ artifact_id: A1, source_id: "s1" }] }).valid, false);

  const otherRoleWithReleaseHash = capturedSource({
    role: "chain_ancestry",
    implementation_identity: {
      name: "some-chain-checker",
      verification_method: "release_hash",
      release: "v1.2.3",
      release_hash_sha256: "c".repeat(64),
    },
  });
  assert.equal(
    validateReferentialIntegrity({ sources: [otherRoleWithReleaseHash], captured_artifacts: [{ artifact_id: A1, source_id: "s1" }] }).valid,
    true,
  );
});

test("no se acepta inventar un commit para un binario/release sin uno real", () => {
  const bad = capturedSource({
    role: "candidate_enumeration",
    implementation_identity: {
      name: "some-binary-tool",
      verification_method: "commit",
      // claims verification_method "commit" but never supplies commit/repository
    },
  });
  const { valid, errors } = validateReferentialIntegrity({
    sources: [bad],
    captured_artifacts: [{ artifact_id: A1, source_id: "s1" }],
  });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('"commit" requires both repository and commit')));
});

// --- Point 5: chain_ancestry_proof references source_id/artifact_ids only.

test("chain_ancestry_proof válido: referencia una fuente role=chain_ancestry con su propio artefacto", () => {
  const manifest = {
    sources: [capturedSource({ source_id: "ca1", role: "chain_ancestry" })],
    captured_artifacts: [{ artifact_id: A1, source_id: "ca1" }],
    chain_ancestry_proof: {
      source_id: "ca1",
      artifact_ids: [A1],
      method: "header-walk",
      result: { ancestor: true },
      limitations: [],
    },
  };
  const { valid, errors } = validateReferentialIntegrity(manifest);
  assert.equal(valid, true, errors.join("; "));
});

test("chain_ancestry_proof rechaza fuente inexistente, rol incorrecto, y artefacto ajeno", () => {
  const baseArtifacts = [{ artifact_id: A1, source_id: "ca1" }];
  const baseSources = [capturedSource({ source_id: "ca1", role: "chain_ancestry" })];

  const nonexistentSource = {
    sources: baseSources,
    captured_artifacts: baseArtifacts,
    chain_ancestry_proof: { source_id: "does-not-exist", artifact_ids: [A1], method: "x", result: { ancestor: true }, limitations: [] },
  };
  assert.equal(validateReferentialIntegrity(nonexistentSource).valid, false);

  const wrongRole = {
    sources: [capturedSource({ source_id: "ce1", role: "candidate_enumeration" })],
    captured_artifacts: [{ artifact_id: A1, source_id: "ce1" }],
    chain_ancestry_proof: { source_id: "ce1", artifact_ids: [A1], method: "x", result: { ancestor: true }, limitations: [] },
  };
  assert.equal(validateReferentialIntegrity(wrongRole).valid, false);

  const nonexistentArtifact = {
    sources: baseSources,
    captured_artifacts: baseArtifacts,
    chain_ancestry_proof: {
      source_id: "ca1",
      artifact_ids: ["sha256:" + "9".repeat(64)],
      method: "x",
      result: { ancestor: true },
      limitations: [],
    },
  };
  assert.equal(validateReferentialIntegrity(nonexistentArtifact).valid, false);

  const foreignArtifact = {
    sources: [...baseSources, capturedSource({ source_id: "other", role: "chain_ancestry", artifact_ids: ["sha256:" + "7".repeat(64)] })],
    captured_artifacts: [...baseArtifacts, { artifact_id: "sha256:" + "7".repeat(64), source_id: "other" }],
    chain_ancestry_proof: {
      source_id: "ca1",
      artifact_ids: ["sha256:" + "7".repeat(64)], // belongs to "other", not "ca1"
      method: "x",
      result: { ancestor: true },
      limitations: [],
    },
  };
  assert.equal(validateReferentialIntegrity(foreignArtifact).valid, false);
});

// 25. same_sat_latest_v0.1 conserva exactamente su comportamiento histórico
test("25. same_sat_latest_v0.1 (resolutor sin modificar) conserva su comportamiento histórico", async () => {
  const { readFile } = await import("node:fs/promises");
  const fixture507999 = JSON.parse(
    await readFile(new URL("../fixtures/507999.snapshot.json", import.meta.url), "utf8"),
  );
  const result = resolveSameSatLatestV01(fixture507999);
  // Same real, already-public (Prueba A) selection — this test does not
  // introduce any new secret; these values are long public.
  assert.equal(
    result.selected_inscription_id,
    "16c5bedd987167d6d5e7a8097d2dacb22ac112eaa0d6d5b1ff030578e75f9675i0",
  );
  assert.equal(result.candidate_count, 2);
});

// --- Cross-language: bitmap_discovery_opi_v1 behaves identically in Python.

test("bitmap_discovery_opi_v1 se comporta igual en Python para los casos clave", async () => {
  const { execFileSync } = await import("node:child_process");
  const script = `
import sys
sys.path.insert(0, ${JSON.stringify(new URL("../scripts/b1-prep-v022", import.meta.url).pathname)})
from bitmap_discovery_opi_v1 import is_valid_bitmap_candidate, get_bitmap_number, is_block_existing

assert is_valid_bitmap_candidate(-1, False, "${TEXT_PLAIN_HEX}") == False
assert is_valid_bitmap_candidate(100, True, "${TEXT_PLAIN_HEX}") == False
assert is_valid_bitmap_candidate(100, False, "${APPLICATION_JSON_HEX}") == False
assert is_valid_bitmap_candidate(100, False, "${TEXT_PLAIN_CHARSET_HEX}") == True
assert get_bitmap_number("zz") is None
assert get_bitmap_number("ff") is None
assert get_bitmap_number("${hexOf("00.bitmap")}") is None
assert get_bitmap_number("${hexOf("0.bitmap")}") == 0
assert get_bitmap_number("${hexOf("507999.bitmap")}") == 507999
assert is_block_existing(500000, 499999) == False
assert is_block_existing(500000, 500000) == True
print("OK")
`;
  const output = execFileSync("python3", ["-c", script], { encoding: "utf8" });
  assert.match(output, /^OK/);
});

// --- Combined synthetic vector: end-to-end demonstration of every filter
// plus the ordering rule, checked against the recorded expected output.

test("vector sintético de descubrimiento OPI: gana la reclamación válida de menor inscription_number, no la primera en llegar", async () => {
  const { readFile } = await import("node:fs/promises");
  const input = JSON.parse(
    await readFile(new URL("../blind/v0.2.2/test-vectors/synthetic-opi-discovery.input.json", import.meta.url), "utf8"),
  );
  const expected = JSON.parse(
    await readFile(new URL("../blind/v0.2.2/test-vectors/synthetic-opi-discovery.expected.json", import.meta.url), "utf8"),
  );

  const blocks = input.blocks_ascending.map((b) =>
    b.candidates.map((c) => ({
      inscriptionId: c.inscription_id,
      inscriptionNumber: c.inscription_number,
      contentHex: c.content_hex,
      isJson: c.is_json,
      contentTypeHex: c.content_type_hex,
      blockHeight: c.block_height,
    })),
  );
  const global = indexBlocksInOrder(blocks);
  const claim = global.get(input.district);

  assert.equal(claim.inscriptionId, expected.winning_inscription_id);
  assert.equal(claim.inscriptionNumber, expected.winning_inscription_number);
  assert.equal(expected.rejected_candidates.length, 3);
});

test("indexBlocksInOrder respeta primera reclamación global a través de bloques", () => {
  const block1 = [
    {
      inscriptionId: "a".repeat(64) + "i0",
      inscriptionNumber: 1,
      contentHex: hexOf("3000.bitmap"),
      isJson: false,
      contentTypeHex: TEXT_PLAIN_HEX,
      blockHeight: 3000,
    },
  ];
  const block2 = [
    {
      inscriptionId: "b".repeat(64) + "i0",
      inscriptionNumber: 1,
      contentHex: hexOf("3000.bitmap"), // same bitmap_number claimed again, later block
      isJson: false,
      contentTypeHex: TEXT_PLAIN_HEX,
      blockHeight: 3001,
    },
  ];
  const global = indexBlocksInOrder([block1, block2]);
  assert.equal(global.get(3000).inscriptionId, "a".repeat(64) + "i0");
});
