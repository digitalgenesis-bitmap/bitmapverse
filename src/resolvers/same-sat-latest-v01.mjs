import { createHash } from "node:crypto";

const HEX_64 = /^[0-9a-f]{64}$/;
const HEX_40 = /^[0-9a-f]{40}$/;
const INSCRIPTION_ID = /^([0-9a-f]{64})i(\d+)$/;

function invariant(condition, message) {
  if (!condition) {
    throw new Error(`Fixture inválido: ${message}`);
  }
}

function assertNonNegativeInteger(value, label) {
  invariant(
    Number.isSafeInteger(value) && value >= 0,
    `${label} debe ser un entero no negativo`,
  );
}

function validatePosition(position, inscriptionId) {
  invariant(
    position && typeof position === "object",
    `${inscriptionId} no declara posición canónica`,
  );

  assertNonNegativeInteger(position.block_height, "block_height");
  assertNonNegativeInteger(position.transaction_index, "transaction_index");
  assertNonNegativeInteger(position.inscription_index, "inscription_index");

  invariant(
    typeof position.block_hash === "string" &&
      HEX_64.test(position.block_hash),
    `${inscriptionId} contiene un block_hash inválido`,
  );
  invariant(
    typeof position.transaction_id === "string" &&
      HEX_64.test(position.transaction_id),
    `${inscriptionId} contiene un transaction_id inválido`,
  );

  const match = INSCRIPTION_ID.exec(inscriptionId);
  invariant(match, `${inscriptionId} no es un inscription ID válido`);
  invariant(
    match[1] === position.transaction_id,
    `${inscriptionId} no coincide con su transaction_id`,
  );
  invariant(
    Number(match[2]) === position.inscription_index,
    `${inscriptionId} no coincide con su inscription_index`,
  );
}

export function compareCanonicalPosition(left, right) {
  return (
    left.block_height - right.block_height ||
    left.transaction_index - right.transaction_index ||
    left.inscription_index - right.inscription_index
  );
}

function positionKey(position) {
  return [
    position.block_height,
    position.transaction_index,
    position.inscription_index,
  ].join(":");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validateEnumeration(fixture) {
  const enumeration = fixture.candidate_enumeration;
  invariant(
    enumeration && typeof enumeration === "object",
    "falta candidate_enumeration",
  );
  invariant(
    enumeration.complete_through_snapshot === true,
    "la enumeración no está declarada completa hasta el snapshot",
  );
  invariant(
    enumeration.reported_more === false,
    "la fuente declaró páginas adicionales sin capturar",
  );
  assertNonNegativeInteger(enumeration.reported_count, "reported_count");
  invariant(
    typeof enumeration.response_body === "string",
    "falta el cuerpo de enumeración congelado",
  );
  invariant(
    HEX_64.test(enumeration.response_sha256),
    "response_sha256 de enumeración inválido",
  );
  invariant(
    sha256(enumeration.response_body) === enumeration.response_sha256,
    "el hash de la enumeración no coincide con su cuerpo",
  );

  let response;
  try {
    response = JSON.parse(enumeration.response_body);
  } catch {
    invariant(false, "el cuerpo de enumeración no es JSON válido");
  }

  invariant(Array.isArray(response.ids), "la enumeración no contiene ids");
  invariant(
    response.more === false && response.page === 0,
    "la enumeración congelada no representa una respuesta completa de una página",
  );
  invariant(
    response.ids.length === enumeration.reported_count,
    "reported_count no coincide con la respuesta congelada",
  );
  invariant(
    fixture.candidates.length === enumeration.reported_count,
    "la lista de candidatos no coincide con el total enumerado",
  );

  const candidateIds = new Set(
    fixture.candidates.map(({ inscription_id }) => inscription_id),
  );
  invariant(
    response.ids.every((id) => candidateIds.has(id)) &&
      candidateIds.size === response.ids.length,
    "los candidatos no coinciden con la enumeración congelada",
  );
}

function validateSourceManifest(fixture) {
  const manifest = fixture.source_manifest;
  invariant(
    manifest && typeof manifest === "object",
    "falta source_manifest",
  );
  invariant(
    typeof manifest.opi?.implementation === "string" &&
      manifest.opi.implementation.length > 0,
    "falta la implementación OPI",
  );
  invariant(
    typeof manifest.opi.commit === "string" &&
      HEX_40.test(manifest.opi.commit),
    "commit OPI inválido",
  );
  invariant(
    typeof manifest.opi.api_source_sha256 === "string" &&
      HEX_64.test(manifest.opi.api_source_sha256),
    "hash del código API de OPI inválido",
  );
  invariant(
    typeof manifest.opi.query === "string" &&
      manifest.opi.query.includes(`bitmap_number=${fixture.district}`),
    "consulta OPI no coincide con el District",
  );
  invariant(
    manifest.opi.response_status === "captured" ||
      manifest.opi.response_status === "not_captured_no_public_instance",
    "estado de respuesta OPI desconocido",
  );
  if (manifest.opi.response_status === "captured") {
    invariant(
      typeof manifest.opi.response_sha256 === "string" &&
        HEX_64.test(manifest.opi.response_sha256),
      "respuesta OPI capturada sin hash válido",
    );
  } else {
    invariant(
      manifest.opi.response_sha256 === null,
      "una respuesta OPI no capturada no debe declarar un hash",
    );
  }
  invariant(
    typeof manifest.ord?.implementation === "string" &&
      manifest.ord.implementation.length > 0,
    "falta la implementación Ord",
  );
  invariant(
    typeof manifest.ord.version === "string" &&
      manifest.ord.version.length > 0,
    "falta el estado de versión Ord",
  );
  invariant(
    manifest.ord.enumeration_response_sha256 ===
      fixture.candidate_enumeration.response_sha256,
    "el manifiesto Ord no coincide con la enumeración",
  );
}

function validateFixture(fixture) {
  invariant(
    fixture?.schema === "bitmapverse.same_sat_latest.fixture.v0.1",
    "schema desconocido",
  );
  invariant(
    fixture.resolver === "same_sat_latest_v0.1",
    "resolver distinto de same_sat_latest_v0.1",
  );
  invariant(fixture.version === "0.1.0", "versión de fixture desconocida");
  invariant(fixture.status === "experimental", "estado distinto de experimental");
  invariant(
    fixture.scope === "convención interna de Bitmapverse v0.1",
    "alcance no declarado como convención interna",
  );
  assertNonNegativeInteger(fixture.district, "district");
  invariant(
    fixture.district_name === `${fixture.district}.bitmap`,
    "district_name no coincide con el District",
  );
  assertNonNegativeInteger(fixture.snapshot_height, "snapshot_height");
  invariant(
    typeof fixture.snapshot_block_hash === "string" &&
      HEX_64.test(fixture.snapshot_block_hash),
    "snapshot_block_hash inválido",
  );
  invariant(
    Number.isSafeInteger(fixture.sat) && fixture.sat >= 0,
    "sat inválido",
  );
  invariant(
    Array.isArray(fixture.candidates) && fixture.candidates.length > 0,
    "no hay candidatos",
  );
  validateEnumeration(fixture);
  validateSourceManifest(fixture);

  const original = fixture.candidates.find(
    ({ inscription_id }) =>
      inscription_id === fixture.original_inscription_id,
  );
  invariant(original, "no incluye la inscripción original");
  invariant(
    original.declared_content === fixture.district_name,
    "el contenido original no coincide con el District",
  );

  const positions = new Set();
  for (const candidate of fixture.candidates) {
    invariant(
      candidate.sat === fixture.sat,
      `${candidate.inscription_id}: el sat no coincide`,
    );
    invariant(
      typeof candidate.content_sha256 === "string" &&
        HEX_64.test(candidate.content_sha256),
      `${candidate.inscription_id}: content_sha256 inválido`,
    );
    validatePosition(candidate.canonical_position, candidate.inscription_id);
    if (
      candidate.canonical_position.block_height === fixture.snapshot_height
    ) {
      invariant(
        candidate.canonical_position.block_hash ===
          fixture.snapshot_block_hash,
        `${candidate.inscription_id}: el hash del bloque fronterizo no coincide con el snapshot`,
      );
    }

    const key = positionKey(candidate.canonical_position);
    invariant(
      !positions.has(key),
      `posición canónica duplicada: ${key}`,
    );
    positions.add(key);
  }
}

export function resolveSameSatLatestV01(fixture) {
  validateFixture(fixture);

  const eligible = fixture.candidates
    .filter(
      ({ canonical_position }) =>
        canonical_position.block_height <= fixture.snapshot_height,
    )
    .toSorted((left, right) =>
      compareCanonicalPosition(
        left.canonical_position,
        right.canonical_position,
      ),
    );

  invariant(
    eligible.length > 0,
    "ningún candidato pertenece al snapshot",
  );
  invariant(
    eligible.some(
      ({ inscription_id }) =>
        inscription_id === fixture.original_inscription_id,
    ),
    "la inscripción original queda fuera del snapshot",
  );

  const selected = eligible.at(-1);

  return {
    schema: "bitmapverse.same_sat_latest.result.v0.1",
    version: fixture.version,
    status: fixture.status,
    scope: fixture.scope,
    resolver: fixture.resolver,
    district: fixture.district,
    district_name: fixture.district_name,
    original_inscription_id: fixture.original_inscription_id,
    sat: fixture.sat,
    selected_inscription_id: selected.inscription_id,
    selected_content_sha256: selected.content_sha256,
    selected_position: { ...selected.canonical_position },
    snapshot_height: fixture.snapshot_height,
    snapshot_block_hash: fixture.snapshot_block_hash,
    candidate_count: eligible.length,
    excluded_after_snapshot:
      fixture.candidates.length - eligible.length,
    provenance: [...(fixture.provenance ?? [])],
    source_manifest: structuredClone(fixture.source_manifest),
    warnings: [
      ...(fixture.warnings ?? []),
      "La canonicidad viva del snapshot debe comprobarse fuera del núcleo determinista.",
    ],
  };
}
