import { createHash } from "node:crypto";

const HEX_64 = /^[0-9a-f]{64}$/;
const ROLES = ["SCOUT", "KEEPER", "VOID"];

function invariant(condition, message) {
  if (!condition) throw new Error(`Expediente inválido: ${message}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseFixture(raw, reference, signalCase) {
  invariant(typeof raw === "string", `falta ${reference.fixture}`);
  invariant(
    sha256(raw) === reference.fixture_sha256,
    `el hash de ${reference.fixture} no coincide`,
  );

  let fixture;
  try {
    fixture = JSON.parse(raw);
  } catch {
    invariant(false, `${reference.fixture} no contiene JSON válido`);
  }

  invariant(
    fixture.schema === "bitmapverse.same_sat_latest.fixture.v0.1",
    `${reference.fixture} usa un schema desconocido`,
  );
  invariant(
    fixture.district === reference.district,
    `${reference.fixture} no coincide con su District`,
  );
  invariant(
    fixture.resolver === signalCase.resolver,
    `${reference.fixture} usa otro resolver`,
  );
  invariant(
    fixture.snapshot_height === signalCase.snapshot.height &&
      fixture.snapshot_block_hash === signalCase.snapshot.block_hash,
    `${reference.fixture} no coincide con el snapshot común`,
  );
  invariant(
    fixture.candidate_enumeration?.complete_through_snapshot === true &&
      fixture.candidate_enumeration?.reported_more === false,
    `${reference.fixture} no declara una enumeración completa`,
  );

  return fixture;
}

export function validateSignalCaseV01(signalCase, evidenceByPath) {
  invariant(
    signalCase?.schema === "bitmapverse.signal_case.v0.1",
    "schema desconocido",
  );
  invariant(signalCase.status === "shadow", "status debe ser shadow");
  invariant(signalCase.authority === "none", "authority debe ser none");
  invariant(
    signalCase.resolver === "same_sat_latest_v0.1",
    "resolver fuera del alcance v0.1",
  );
  invariant(
    Number.isSafeInteger(signalCase.snapshot?.height) &&
      signalCase.snapshot.height >= 0,
    "altura de snapshot inválida",
  );
  invariant(
    HEX_64.test(signalCase.snapshot?.block_hash ?? ""),
    "hash de snapshot inválido",
  );
  invariant(
    JSON.stringify(signalCase.evaluation?.roles) === JSON.stringify(ROLES),
    "los roles deben ser SCOUT, KEEPER y VOID",
  );
  invariant(
    signalCase.evaluation?.blind_to_peer_signals === true,
    "las evaluaciones deben ser independientes",
  );
  invariant(
    signalCase.limits?.may_authorize_transition === false &&
      signalCase.limits?.may_mutate_state === false,
    "el Consejo en sombra no puede recibir autoridad",
  );

  const originReference = signalCase.evidence?.origin;
  const destinationReference = signalCase.evidence?.destination;
  invariant(originReference && destinationReference, "faltan referencias de evidencia");
  invariant(
    originReference.district !== destinationReference.district,
    "origen y destino deben ser territorios distintos",
  );

  const origin = parseFixture(
    evidenceByPath[originReference.fixture],
    originReference,
    signalCase,
  );
  const destination = parseFixture(
    evidenceByPath[destinationReference.fixture],
    destinationReference,
    signalCase,
  );

  return { origin, destination };
}

function baseSignal(role, signalCase) {
  return {
    schema: "bitmapverse.shadow_signal.v0.1",
    signal_id: `${signalCase.case_id}-${role.toLowerCase()}`,
    case_id: signalCase.case_id,
    case_canonical_sha256: sha256(JSON.stringify(signalCase)),
    role,
    status: "shadow",
    authority: "none",
    authorizes_transition: false,
    mutates_state: false,
  };
}

export function evaluateShadowRoleV01(role, signalCase, evidenceByPath) {
  invariant(ROLES.includes(role), `rol desconocido: ${role}`);
  const { origin, destination } = validateSignalCaseV01(
    signalCase,
    evidenceByPath,
  );

  if (role === "SCOUT") {
    return {
      ...baseSignal(role, signalCase),
      recommendation: "continue_experiment",
      confidence: "medium",
      observations: [
        `Los Districts ${origin.district} y ${destination.district} comparten un snapshot válido.`,
        "Ambas enumeraciones Ord congeladas declaran more:false y están completas hasta el corte.",
      ],
      risks: [
        "La exploración todavía depende de fixtures preparados por la primera implementación.",
        "No existe aún una reconstrucción independiente desde infraestructura viva.",
      ],
    };
  }

  if (role === "KEEPER") {
    return {
      ...baseSignal(role, signalCase),
      recommendation: "preserve_with_warnings",
      confidence: "high",
      observations: [
        "El expediente referencia los fixtures sin duplicarlos y verifica sus hashes exactos.",
        "La evidencia histórica conserva snapshot, procedencia y límites epistemológicos.",
      ],
      risks: [
        "Un hash preserva integridad, pero la recuperabilidad requiere conservar los datos originales.",
        "Promover el portal antes de la implementación ciega debilitaría el significado de EMV.",
      ],
    };
  }

  return {
    ...baseSignal(role, signalCase),
    recommendation: "do_not_promote",
    confidence: "high",
    observations: [
      "La respuesta OPI original no fue capturada desde una instancia pública independiente.",
      "Todavía no existe una segunda implementación ciega que reconstruya el mismo resultado.",
    ],
    risks: [
      "Una coincidencia interna podría confundirse con reproducibilidad externa.",
      "La interfaz podría presentarse prematuramente como estándar universal o estado vivo.",
    ],
  };
}

export function runShadowCouncilV01(signalCase, evidenceByPath) {
  validateSignalCaseV01(signalCase, evidenceByPath);

  return {
    schema: "bitmapverse.shadow_council_run.v0.1",
    case_id: signalCase.case_id,
    case_canonical_sha256: sha256(JSON.stringify(signalCase)),
    status: "shadow",
    authority: "none",
    independent_inputs: true,
    signals: ROLES.map((role) =>
      evaluateShadowRoleV01(role, signalCase, evidenceByPath),
    ),
    transition: {
      authorized: false,
      state_mutated: false,
      reason: "Las señales interpretan y recomiendan; no autorizan transiciones.",
    },
  };
}
