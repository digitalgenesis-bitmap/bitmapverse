# Procedencia campo por campo — v0.2

Tipos: **metadato contractual** (fijo, igual en toda entrega conforme, no
depende de ninguna observación), **input** (fijado por este contrato para
la prueba, no descubierto por el implementador), **descubrimiento**
(obtenido aplicando el perfil normativo de descubrimiento a un input),
**calculado** (derivado determinísticamente de un descubrimiento más el
algoritmo `same_sat_latest_v0.1`), **evidencia dependiente de la
observación** (puede variar legítimamente entre implementadores honestos).

## `resolution_result.v0.2`

| Campo | Objeto | Origen | Tipo | Validación | Estabilidad | Condición de refutación |
|---|---|---|---|---|---|---|
| `schema` | resolution_result | Este contrato | metadato contractual | `const` | Idéntico siempre | Cualquier otro valor |
| `contract_version` | resolution_result | Este contrato | metadato contractual | `const "0.2.0"` | Idéntico siempre | Cualquier otro valor |
| `resolver` | resolution_result | Este contrato | metadato contractual | `const "same_sat_latest_v0.1"` | Idéntico siempre | Cualquier otro valor |
| `bitmap_discovery_profile` | resolution_result | Este contrato | metadato contractual | `const` | Idéntico siempre | Cualquier otro valor |
| `district` | resolution_result | `CONTRACT.md` §9 | input | entero, `district_name` coincide | Fijado por caso | `district_name` no coincide |
| `district_name` | resolution_result | `CONTRACT.md` §9 | input | `^[0-9]+\.bitmap$` | Fijado por caso | Formato inválido |
| `original_inscription_id` | resolution_result | Aplicar el perfil de descubrimiento al `district` | descubrimiento | contenido declarado == `district_name` | Estable si el perfil normativo y su implementación pinneada no cambian (ver `BITMAP_DISCOVERY_PROFILE.md`, bloqueo B1b) | Contenido declarado no coincide con `district_name` |
| `sat` | resolution_result | Sat asignado a `original_inscription_id` en la cadena Bitcoin | descubrimiento | entero seguro no negativo | Estable — hecho de la cadena Bitcoin, no de ninguna implementación | Sat distinto entre dos reconstrucciones honestas |
| `selected_inscription_id` | resolution_result | `same_sat_latest_v0.1` sobre `candidate_set_through_resolution_snapshot` | calculado | pertenece a `candidate_set`, tupla canónica máxima elegible | Estable — determinístico dado el candidate set | Selección distinta con el mismo candidate set |
| `selected_content_sha256` | resolution_result | Contenido de `selected_inscription_id` | calculado (lectura directa, no derivado por selección) | hex64 | Estable — hecho de la cadena Bitcoin | Hash distinto para el mismo `selected_inscription_id` |
| `selected_position` | resolution_result | Posición canónica de `selected_inscription_id` | calculado | ver `CANDIDATE_SET_SCHEMA.json` | Estable — hecho de la cadena Bitcoin | `inscription_id` no coincide con `transaction_id`+`inscription_index` |
| `resolution_snapshot` | resolution_result | `CONTRACT.md` §9 | input | altura+hash corresponden exactamente | Fijado por caso | `block_hash` no corresponde a `height` en la cadena observada |
| `eligible_through_resolution_snapshot_count` | resolution_result | `len(candidate_set.candidates)` | calculado | == `candidate_set.candidate_count` | Estable — determinístico dado el candidate set | No coincide con `candidate_set.candidate_count` |
| `status` | resolution_result | Este contrato | metadato contractual | `const "experimental"` | Idéntico siempre | Cualquier otro valor |

## `candidate_set_through_resolution_snapshot.v0.2`

| Campo | Objeto | Origen | Tipo | Validación | Estabilidad | Condición de refutación |
|---|---|---|---|---|---|---|
| `candidates[].inscription_id` | candidate_set | Enumeración de inscripciones sobre `sat` | descubrimiento | `^[0-9a-f]{64}i[0-9]+$` | Estable si la enumeración es completa hasta el snapshot | ID inválido o duplicado |
| `candidates[].sat` | candidate_set | Igual a `resolution_result.sat` para cada candidato | descubrimiento | == `candidate_set.sat` | Estable | Un candidato con otro sat |
| `candidates[].content_sha256` | candidate_set | Contenido de cada inscripción | descubrimiento | hex64 | Estable — hecho de la cadena | Hash inválido o ausente |
| `candidates[].canonical_position` | candidate_set | Posición de la transacción reveal en la cadena | descubrimiento | ver esquema | Estable — hecho de la cadena | Posición duplicada entre dos candidatos |
| `candidate_count` | candidate_set | `len(candidates)` | calculado | == longitud real del array | Estable dado el candidate set | No coincide con la longitud real |

## `evidence_manifest.v0.2`

| Campo | Objeto | Origen | Tipo | Validación | Estabilidad | Condición de refutación |
|---|---|---|---|---|---|---|
| `observation_tip` | evidence_manifest | Observación propia del implementador | evidencia dependiente de la observación | `height >= resolution_snapshot.height`, hash corresponde a la altura | **No estable entre implementadores** — cada uno observa hasta donde pudo | `block_hash` no corresponde a `height` |
| `observed_through_observation_tip_count` | evidence_manifest | Enumeración propia hasta `observation_tip` | evidencia dependiente de la observación | == `eligible_... + excluded_...` | No estable entre implementadores | Invariante roto |
| `eligible_through_resolution_snapshot_count` | evidence_manifest | Igual a `resolution_result` | calculado (duplicado aquí por conveniencia de verificación) | == `resolution_result.eligible_through_resolution_snapshot_count` | Estable | No coincide entre los dos objetos |
| `excluded_after_resolution_snapshot_count` | evidence_manifest | `observed - eligible` | calculado | == diferencia exacta | No estable entre implementadores (depende de `observation_tip`) | Invariante roto |
| `chain_ancestry_proof` | evidence_manifest | Verificación propia de ancestralidad | evidencia dependiente de la observación | ver `CONTRACT.md` §5 | No estable — depende del método y operador | `result.ancestor` sin `evidence_captured`/`evidence_sha256` |
| `bitmap_discovery.implementation` | evidence_manifest | Declarado por el implementador | evidencia dependiente de la observación | string no vacía | No estable entre implementadores (ver bloqueo B1b) | Ausente |
| `bitmap_discovery.operator` | evidence_manifest | Declarado por el implementador | evidencia dependiente de la observación | string o `null` | No estable | Fabricado sin base |
| `resolution_result_canonical_sha256` | evidence_manifest | JCS de `resolution_result` propio | calculado | hex64, recomputable | Estable si `resolution_result` lo es | No coincide al recomputar |
| `candidate_set_canonical_sha256` | evidence_manifest | JCS de `candidate_set` propio | calculado | hex64, recomputable | Estable si `candidate_set` lo es | No coincide al recomputar |

## Nota sobre la ausencia deliberada de `block_timestamp` en el núcleo estable

`resolution_snapshot.block_timestamp` existe únicamente dentro de
`evidence_manifest.resolution_snapshot`, como contexto opcional
(`type: ["integer","null"]`, no `required`). No aparece en
`resolution_result.resolution_snapshot`. Motivo: el timestamp de un
bloque Bitcoin no participa en la definición de elegibilidad —
`block_height` sí — y añadirlo al núcleo estable habría forzado a
declarar procedencia y estabilidad para un dato que ninguna de las dos
implementaciones de Prueba A pudo demostrar tener disponible. v0.2 no
repite ese problema: lo mueve fuera del objeto que exige estabilidad.
