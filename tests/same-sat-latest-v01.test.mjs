import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  compareCanonicalPosition,
  resolveSameSatLatestV01,
} from "../src/resolvers/same-sat-latest-v01.mjs";

async function fixture(name) {
  return JSON.parse(
    await readFile(new URL(`../fixtures/${name}.snapshot.json`, import.meta.url)),
  );
}

function setEnumerationIds(evidence, ids) {
  const responseBody = JSON.stringify({
    ids,
    more: false,
    page: 0,
  });
  evidence.candidate_enumeration = {
    ...evidence.candidate_enumeration,
    reported_count: ids.length,
    response_body: responseBody,
    response_sha256: createHash("sha256")
      .update(responseBody)
      .digest("hex"),
  };
  evidence.source_manifest = {
    ...evidence.source_manifest,
    ord: {
      ...evidence.source_manifest.ord,
      enumeration_response_sha256:
        evidence.candidate_enumeration.response_sha256,
    },
  };
}

test("507999.bitmap resuelve a la reinscripción confirmada de Freedeon", async () => {
  const evidence = await fixture("507999");
  const result = resolveSameSatLatestV01(evidence);

  assert.equal(
    result.selected_inscription_id,
    evidence.expected_selected_inscription_id,
  );
  assert.equal(result.snapshot_height, 959531);
  assert.equal(result.candidate_count, 2);
  assert.equal(result.status, "experimental");
  assert.equal(
    result.scope,
    "convención interna de Bitmapverse v0.1",
  );
  assert.equal(
    result.selected_content_sha256,
    "177e29dbaaf7cb10440535b4da29cd669332a336779dd96f0b0a408d4909775f",
  );
});

test("7187.bitmap resuelve a la última reinscripción Organa dentro del snapshot", async () => {
  const evidence = await fixture("7187");
  const result = resolveSameSatLatestV01(evidence);

  assert.equal(
    result.selected_inscription_id,
    evidence.expected_selected_inscription_id,
  );
  assert.equal(result.candidate_count, 3);
});

test("el resultado no depende del orden entregado por una API", async () => {
  const evidence = await fixture("7187");
  const shuffled = {
    ...evidence,
    candidates: [
      evidence.candidates[2],
      evidence.candidates[0],
      evidence.candidates[1],
    ],
  };

  assert.equal(
    resolveSameSatLatestV01(shuffled).selected_inscription_id,
    evidence.expected_selected_inscription_id,
  );
});

test("una inscripción posterior al snapshot queda excluida", async () => {
  const evidence = await fixture("507999");
  evidence.candidates.push({
    inscription_id:
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffi0",
    sat: evidence.sat,
    content_sha256:
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    canonical_position: {
      block_height: evidence.snapshot_height + 1,
      block_hash:
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      transaction_id:
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      transaction_index: 0,
      inscription_index: 0,
    },
  });
  setEnumerationIds(
    evidence,
    evidence.candidates.map(({ inscription_id }) => inscription_id),
  );

  assert.equal(
    resolveSameSatLatestV01(evidence).selected_inscription_id,
    evidence.expected_selected_inscription_id,
  );
});

test("rechaza candidatos pertenecientes a otro sat", async () => {
  const evidence = await fixture("507999");
  evidence.candidates[0].sat += 1;

  assert.throws(
    () => resolveSameSatLatestV01(evidence),
    /sat no coincide/i,
  );
});

test("si solo existe la original, devuelve la original", async () => {
  const evidence = await fixture("507999");
  evidence.candidates = evidence.candidates.filter(
    ({ inscription_id }) =>
      inscription_id === evidence.original_inscription_id,
  );
  evidence.expected_selected_inscription_id =
    evidence.original_inscription_id;
  setEnumerationIds(evidence, [evidence.original_inscription_id]);

  assert.equal(
    resolveSameSatLatestV01(evidence).selected_inscription_id,
    evidence.original_inscription_id,
  );
});

test("desempata dentro de un bloque por transacción e índice de inscripción", () => {
  const earlier = {
    block_height: 100,
    transaction_index: 7,
    inscription_index: 2,
  };
  const laterTransaction = {
    block_height: 100,
    transaction_index: 8,
    inscription_index: 0,
  };
  const laterInscription = {
    block_height: 100,
    transaction_index: 7,
    inscription_index: 3,
  };

  assert.ok(compareCanonicalPosition(earlier, laterTransaction) < 0);
  assert.ok(compareCanonicalPosition(earlier, laterInscription) < 0);
});

test("rechaza dos candidatos con la misma posición canónica", async () => {
  const evidence = await fixture("7187");
  evidence.candidates[1].canonical_position = {
    ...evidence.candidates[0].canonical_position,
    transaction_id:
      evidence.candidates[1].canonical_position.transaction_id,
    inscription_index:
      evidence.candidates[1].canonical_position.inscription_index,
  };

  assert.throws(
    () => resolveSameSatLatestV01(evidence),
    /posición canónica duplicada/i,
  );
});

test("rechaza una lista incompleta frente a la enumeración congelada", async () => {
  const evidence = await fixture("7187");
  evidence.candidates.pop();

  assert.throws(
    () => resolveSameSatLatestV01(evidence),
    /lista de candidatos no coincide con el total enumerado/i,
  );
});

test("rechaza una enumeración cuyo cuerpo no coincide con su hash", async () => {
  const evidence = await fixture("507999");
  evidence.candidate_enumeration.response_body += " ";

  assert.throws(
    () => resolveSameSatLatestV01(evidence),
    /hash de la enumeración no coincide/i,
  );
});

test("rechaza un candidato fronterizo con otro hash de bloque", async () => {
  const evidence = await fixture("7187");
  const boundary = evidence.candidates.find(
    ({ canonical_position }) =>
      canonical_position.block_height === evidence.snapshot_height,
  );
  boundary.canonical_position.block_hash =
    "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

  assert.throws(
    () => resolveSameSatLatestV01(evidence),
    /hash del bloque fronterizo no coincide/i,
  );
});

test("rechaza un contenido sin hash de integridad válido", async () => {
  const evidence = await fixture("507999");
  evidence.candidates[0].content_sha256 = "pendiente";

  assert.throws(
    () => resolveSameSatLatestV01(evidence),
    /content_sha256 inválido/i,
  );
});

test("conserva la ausencia explícita de una respuesta OPI no capturada", async () => {
  const evidence = await fixture("507999");
  const result = resolveSameSatLatestV01(evidence);

  assert.equal(
    result.source_manifest.opi.response_status,
    "not_captured_no_public_instance",
  );
  assert.equal(result.source_manifest.opi.response_sha256, null);
});
