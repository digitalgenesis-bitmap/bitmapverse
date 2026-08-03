# Procedencia campo por campo — v0.2.2

Tipos: **metadato contractual** (fijo, igual en toda entrega conforme),
**input** (fijado por este contrato para la prueba), **descubrimiento**
(obtenido aplicando `bitmap_discovery_opi_v1` a un input, `CONTRACT.md`
§2), **calculado** (derivado determinísticamente de un descubrimiento más
`same_sat_latest_v0.1`, `CONTRACT.md` §3-§8), **evidencia dependiente de
la observación** (puede variar legítimamente entre implementadores
honestos).

## `resolution_result.v0.2.2`

| Campo | Tipo | Origen | Condición de refutación |
|---|---|---|---|
| `schema`, `contract_version`, `resolver`, `bitmap_discovery_profile` | metadato contractual | Este contrato | Cualquier otro valor |
| `district`, `district_name` | input | `CONTRACT.md` §17 | `district_name` no coincide con `district` |
| `original_inscription_id` | descubrimiento | `bitmap_discovery_opi_v1` (`CONTRACT.md` §2, `BITMAP_DISCOVERY_PROFILE.md` Capa 2) | No satisface `is_valid_bitmap`, o no es la primera reclamación válida por `inscription_number` |
| `sat` | descubrimiento | `CONTRACT.md` §3 | Sat distinto entre dos reconstrucciones honestas |
| `selected_inscription_id`, `selected_content_sha256`, `selected_position` | calculado | `same_sat_latest_v0.1` (`CONTRACT.md` §6-§8) | Selección o posición distinta con el mismo candidate set |
| `resolution_snapshot` | input | `CONTRACT.md` §17 | `block_hash` no corresponde a `height` |
| `eligible_through_resolution_snapshot_count` | calculado | `len(candidate_set.candidates)` | No coincide con `candidate_set.candidate_count` |
| `status` | metadato contractual | Este contrato | Cualquier otro valor |

## `candidate_set_through_resolution_snapshot.v0.2.2`

Sin cambios de procedencia respecto a v0.2.1 (ver
`blind/v0.2.1/FIELD_PROVENANCE.md` para referencia histórica no
normativa) — `inscription_number` no participa en ningún campo de este
objeto, exclusivo de `resolution_result.original_inscription_id`.

| Campo | Tipo | Origen | Condición de refutación |
|---|---|---|---|
| `candidates[].*` | descubrimiento | Enumeración sobre el sat (`CONTRACT.md` §4) | ID inválido, sat distinto, posición duplicada |
| `candidate_count` | calculado | `len(candidates)` | No coincide con la longitud real |

## `evidence_manifest.v0.2.2`

| Campo | Tipo | Origen | Condición de refutación |
|---|---|---|---|
| `observation_tip` | evidencia dependiente de la observación | Observación propia | `height < resolution_snapshot.height` |
| `observed_through_observation_tip_count`, `excluded_after_resolution_snapshot_count` | evidencia dependiente de la observación | Enumeración propia | Invariante `observed = eligible + excluded` roto |
| `chain_ancestry_proof.source_id`, `.artifact_ids` | evidencia dependiente de la observación | Debe referenciar una fuente con `role === "chain_ancestry"` y artefactos que le pertenecen | Fuente inexistente, rol incorrecto, artefacto inexistente o perteneciente a otra fuente — ver `CONTRACT.md` §14-§15. Sin `evidence_captured`/`evidence_sha256` propios: esos datos viven solo en `captured_artifacts[]`. |
| `chain_ancestry_proof.method`, `.result`, `.limitations` | evidencia dependiente de la observación | Verificación propia | `result.ancestor` sin `method` ni `limitations` |
| `sources[].source_id` | evidencia dependiente de la observación | Asignado por el implementador | Duplicado dentro de `sources[]` |
| `sources[].role` | metadato contractual (valor fijo del enum) | `EVIDENCE_MANIFEST_SCHEMA.json` | Valor fuera del enum declarado |
| `sources[].implementation_identity` | descubrimiento (declarado), validado según el rol | `CONTRACT.md` §17 | Para `role: "bitmap_discovery"`: distinto del repositorio/commit fijados en `OPI_SOURCE_PROVENANCE.json`. Para otros roles: identidad incoherente con `verification_method`, o un commit inventado para un binario/release sin uno real. |
| `sources[].operator` | evidencia dependiente de la observación | Declarado por el implementador, o `null` si no hubo captura real | `null` con `capture_status: "captured"`, o fabricado sin base |
| `sources[].request` | metadato + evidencia | Consulta realmente usada | No coincide con la documentada en `BITMAP_DISCOVERY_PROFILE.md` 2.5 para `role: "bitmap_discovery"` |
| `sources[].artifact_ids` | evidencia dependiente de la observación | Referencias a `captured_artifacts[]` | No vacío con `capture_status` distinto de `"captured"`, o referencia a un artefacto inexistente/ajeno — `CONTRACT.md` §15 |
| `sources[].capture_status` | evidencia dependiente de la observación | Declarado honestamente por el implementador | `"captured"` sin artefactos reales que lo sustenten |
| `sources[].limitations` | evidencia dependiente de la observación | Declarado por el implementador | Vacío cuando `capture_status !== "captured"` |
| `captured_artifacts[].artifact_id` | evidencia dependiente de la observación (formato fijo) | `CONTRACT.md` §16 | Duplicado, formato inválido (`^sha256:[0-9a-f]{64}$`), o archivo físico que no coincide en hash/tamaño |
| `captured_artifacts[].source_id` | evidencia dependiente de la observación | Debe referenciar una fuente existente | Fuente inexistente, o incoherencia bidireccional |
| `captured_artifacts[].size_bytes`, `.content_type`, `.observed_at` | evidencia dependiente de la observación | Captura real | Cualquiera ausente o inventado para una captura no realmente ocurrida. Sin `local_path`: la ubicación se deriva siempre de `artifact_id` — `CONTRACT.md` §16. |
| `resolution_result_canonical_sha256`, `candidate_set_canonical_sha256` | calculado | JCS restringido sobre los objetos propios | No coincide al recomputar sobre el `resolution_result`/`candidate_set` que ese mismo operador entregó |

## Frontera `inscription_number` vs. posición canónica

`inscription_number` participa **exclusivamente** en el descubrimiento de
`original_inscription_id` (capa `bitmap_discovery_opi_v1`). Ningún otro
campo de `resolution_result`, `candidate_set_through_resolution_snapshot`
ni `evidence_manifest` lo usa. La posición canónica
(`block_height`/`transaction_index`/`inscription_index`) participa
exclusivamente en `same_sat_latest_v0.1`, después de que la inscripción
fundacional y su sat ya se determinaron. Esta frontera es intencional y
no se cruza en ninguna dirección — ver `CONTRACT.md` §2 y §4-§6.
