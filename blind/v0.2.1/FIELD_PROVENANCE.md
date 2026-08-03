# Procedencia campo por campo — v0.2.1

Tipos: **metadato contractual**, **input**, **descubrimiento**,
**calculado**, **evidencia dependiente de la observación** — mismas
definiciones que en `blind/v0.2/FIELD_PROVENANCE.md` (preservado sin
cambios), reproducidas aquí para autosuficiencia:

- **metadato contractual**: fijo, igual en toda entrega conforme.
- **input**: fijado por este contrato para la prueba.
- **descubrimiento**: obtenido aplicando el perfil normativo (`CONTRACT.md`
  §1-§3) a un input.
- **calculado**: derivado determinísticamente de un descubrimiento más el
  algoritmo `same_sat_latest_v0.1` (`CONTRACT.md` §4-§7).
- **evidencia dependiente de la observación**: puede variar
  legítimamente entre implementadores honestos.

## `resolution_result.v0.2.1`

| Campo | Tipo | Origen | Condición de refutación |
|---|---|---|---|
| `schema`, `contract_version`, `resolver`, `bitmap_discovery_profile` | metadato contractual | Este contrato | Cualquier otro valor |
| `district`, `district_name` | input | `CONTRACT.md` §14 | `district_name` no coincide con `district` |
| `original_inscription_id` | descubrimiento | `CONTRACT.md` §1 | Contenido declarado no coincide con `district_name` |
| `sat` | descubrimiento | `CONTRACT.md` §2 | Sat distinto entre dos reconstrucciones honestas |
| `selected_inscription_id`, `selected_content_sha256`, `selected_position` | calculado | `CONTRACT.md` §4-§7 | Selección o posición distinta con el mismo candidate set |
| `resolution_snapshot` | input | `CONTRACT.md` §14 | `block_hash` no corresponde a `height` en la cadena observada |
| `eligible_through_resolution_snapshot_count` | calculado | `len(candidate_set.candidates)` | No coincide con `candidate_set.candidate_count` |
| `status` | metadato contractual | Este contrato | Cualquier otro valor |

## `candidate_set_through_resolution_snapshot.v0.2.1`

| Campo | Tipo | Origen | Condición de refutación |
|---|---|---|---|
| `candidates[].*` | descubrimiento | Enumeración sobre el sat (`CONTRACT.md` §3) | ID inválido, sat distinto, posición duplicada |
| `candidate_count` | calculado | `len(candidates)` | No coincide con la longitud real |

## `evidence_manifest.v0.2.1`

| Campo | Tipo | Origen | Condición de refutación |
|---|---|---|---|
| `observation_tip` | evidencia dependiente de la observación | Observación propia | `height < resolution_snapshot.height`, o `block_hash` no corresponde a `height` |
| `observed_through_observation_tip_count`, `excluded_after_resolution_snapshot_count` | evidencia dependiente de la observación | Enumeración propia hasta `observation_tip` | Invariante `observed = eligible + excluded` roto |
| `eligible_through_resolution_snapshot_count` | calculado (duplicado aquí para verificación cruzada) | Igual a `resolution_result` | No coincide entre los dos objetos |
| `chain_ancestry_proof` | evidencia dependiente de la observación | Verificación propia (`CONTRACT.md` §13) | `result.ancestor` sin `evidence_captured`/`evidence_sha256`/`method` |
| `bitmap_discovery.implementation`, `.operator` | evidencia dependiente de la observación | Declarado por el implementador | Ausente o fabricado sin base |
| `sources[]` | evidencia dependiente de la observación | Cada fuente consultada | Falta `pagination.complete`, o declara más páginas de las capturadas en `captured_artifacts` |
| `sources[].response_sha256`, `.response_size_bytes`, `.response_content_type` | evidencia dependiente de la observación | Respuesta capturada de la fuente | Ausente para una fuente cuyo `response_status` indica éxito |
| `sources[].pagination.pages[]` | evidencia dependiente de la observación | Cada página capturada de una fuente paginada | `reported_count_this_page` no coincide con el contenido real de la página |
| `captured_artifacts[]` | evidencia dependiente de la observación | Cada respuesta o página, referenciada individualmente | `sha256` no reproducible desde la evidencia realmente capturada |
| `resolution_result_canonical_sha256`, `candidate_set_canonical_sha256` | calculado | JCS restringido v0.2.1 sobre los objetos propios | No coincide al recomputar |

## Nota sobre granularidad de `evidence_manifest` respecto a v0.2

`blind/v0.2/EVIDENCE_MANIFEST_SCHEMA.json` (preservado, `SUPERSEDED`)
representaba las fuentes OPI y Ord como dos objetos fijos
(`sources.opi`, `sources.ord`). v0.2.1 los reemplaza por un array
`sources[]` de longitud variable, con un `role` explícito por entrada,
más `captured_artifacts[]` como registro independiente de cada
respuesta/página capturada. Esto permite declarar más de una fuente por
rol (p. ej. dos consultas de enumeración paginadas) sin forzar una forma
fija que v0.2 no anticipaba — ver `PREDECESSOR_STATUS.md`, "Por qué está
superseded".
