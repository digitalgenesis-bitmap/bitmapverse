# Contrato ciego `same_sat_latest_v0.1` — sucesor v0.2

Estado: experimental
Prueba: reconstrucción independiente de evidencia (Prueba B1)
Algoritmo: `same_sat_latest_v0.1` (sin cambios respecto a v0.1)
Contrato de salida: `v0.2` (cambia respecto a v0.1)

## 1. Qué prueba B1 y qué no prueba

Prueba A (`blind/v0.1/`) demostró que dos implementaciones independientes,
partiendo de la **misma evidencia ya congelada**, seleccionan la misma
inscripción. Prueba B1 pide algo más fuerte: que un implementador
independiente **reconstruya esa evidencia desde infraestructura
compatible con Ord/OPI**, sin recibir fixtures preparados, y llegue al
mismo resultado histórico estable y al mismo conjunto semántico de
candidatos.

Prueba B1 no prueba:

- que exista una única infraestructura correcta (`BITMAP_DISCOVERY_PROFILE.md`
  distingue perfil normativo de implementación de operador);
- estándar universal de Bitmap;
- autoridad, seguridad o vigencia posterior del contenido seleccionado;
- Names.bitmap ni portales universales.

## 2. `resolution_result` — resultado histórico estable

Ver `RESOLUTION_RESULT_SCHEMA.json` para la definición formal. Debe ser
estable — bytes canónicos y SHA-256 idénticos — para:

- el mismo District;
- el mismo perfil normativo de descubrimiento Bitmap
  (`bitmap_discovery_profile`, ver `BITMAP_DISCOVERY_PROFILE.md`);
- el mismo `resolver` (`same_sat_latest_v0.1`);
- la misma altura y hash de `resolution_snapshot`;
- la misma cadena Bitcoin observada;
- enumeración completa de candidatos hasta el snapshot.

`resolution_result` **no** incluye:

- `block_timestamp` (pertenece, si acaso, al manifiesto de evidencia como
  contexto opcional — nunca al núcleo estable, porque el timestamp de
  bloque no determina el corte; la altura sí);
- ningún conteo que dependa de qué tan lejos observó un operador concreto
  (`observed_through_observation_tip_count`, `excluded_after_resolution_snapshot_count`
  — esos viven en `evidence_manifest`, porque dependen de la observación,
  no de la selección);
- procedencia de fuentes (vive en `evidence_manifest`).

Campo por campo: ver `FIELD_PROVENANCE.md`.

## 3. `candidate_set_through_resolution_snapshot` — conjunto semántico de candidatos

Objeto separado de `resolution_result`. Ver `CANDIDATE_SET_SCHEMA.json`.

Contiene **todos** los candidatos válidos hasta `resolution_snapshot`
(no solo el seleccionado), ordenados ascendentemente por:

1. `block_height`;
2. `transaction_index`;
3. `inscription_index`.

Cada candidato incluye `inscription_id`, `sat`, `content_sha256` y su
posición canónica completa. Este conjunto tiene su propia
canonicalización y su propio SHA-256 — independiente del de
`resolution_result`.

**La selección y el conjunto completo son afirmaciones distintas.**
Que dos implementaciones coincidan en `selected_inscription_id` no prueba
que hayan observado el mismo conjunto de candidatos — podrían coincidir en
el ganador por casualidad mientras difieren en cuántos candidatos había.
Prueba B1 exige verificar ambas cosas por separado.

## 4. `evidence_manifest` — manifiesto dependiente de la observación

Ver `EVIDENCE_MANIFEST_SCHEMA.json`.

Distingue explícitamente dos alturas:

- `resolution_snapshot`: la altura que define el corte de elegibilidad
  para `resolution_result` y `candidate_set_through_resolution_snapshot`.
  Fijada por este contrato — igual para todos los implementadores.
- `observation_tip`: la altura hasta la cual un operador concreto observó
  la cadena al construir su manifiesto. Puede variar legítimamente entre
  implementadores, y debe cumplir `observation_tip.height >= resolution_snapshot.height`.

Invariante obligatorio:

```text
observed_through_observation_tip_count
  = eligible_through_resolution_snapshot_count
  + excluded_after_resolution_snapshot_count
```

Donde:

- `observed_through_observation_tip_count`: todas las inscripciones
  observadas sobre el sat hasta `observation_tip` (inclusive).
- `eligible_through_resolution_snapshot_count`: el subconjunto situado
  hasta `resolution_snapshot` (inclusive) — el mismo número que
  `resolution_result.eligible_through_resolution_snapshot_count`.
- `excluded_after_resolution_snapshot_count`: candidatos posteriores a
  `resolution_snapshot` pero no posteriores a `observation_tip`.

Una implementación que solo reporte `eligible_through_resolution_snapshot_count`
sin los otros dos términos no permite verificar el invariante, y por lo
tanto no satisface `evidence_manifest.v0.2` aunque `resolution_result` sea
correcto — esto es exactamente el defecto que una corrección posterior a
Prueba A identificó en la entrega Python sellada: un conteo total sin
desglose no permite distinguir "nada excluido" de "no sé cuánto se
excluyó".

## 5. Prueba de cadena y ancestralidad

No basta con declarar `resolution_snapshot` y `observation_tip`. El
contrato exige demostrar:

1. que ambos bloques existen en la cadena observada;
2. que `resolution_snapshot.block_hash` corresponde exactamente a la
   altura declarada — no un hash cualquiera, el hash real de ese bloque;
3. que `observation_tip.block_hash` corresponde exactamente a su altura;
4. que el bloque de `resolution_snapshot` es **ancestro** del bloque de
   `observation_tip` en la cadena observada — no simplemente que su altura
   es menor, sino que hay una cadena de bloques válida entre ambos.

Una reorganización puede sustituir silenciosamente qué bloque ocupa una
altura dada. Este contrato prohíbe tratar "la altura X hoy" como
intercambiable con "el hash que se registró para la altura X" sin
verificarlo explícitamente. El manifiesto debe registrar:

- método de verificación usado (p. ej. seguir cabeceras de bloque desde
  `observation_tip` hasta `resolution_snapshot`, o una consulta a un
  servicio que exponga esa cadena);
- operador o infraestructura que realizó la verificación;
- evidencia capturada (no solo un resultado — la evidencia que lo
  sustenta);
- SHA-256 de esa evidencia;
- resultado (`ancestor: true|false`);
- limitaciones conocidas del método usado.

Una afirmación booleana sin evidencia (`"ancestor": true` sin nada más)
**no satisface este contrato**.

## 6. Perfil normativo de descubrimiento Bitmap

Ver `BITMAP_DISCOVERY_PROFILE.md`. Distingue:

- reglas normativas (qué cuenta como District, cómo se descubre la
  inscripción fundacional, qué API/convención define "bitmap_number");
- implementación usada para aplicar esas reglas;
- operador que ejecutó esa implementación.

Un implementador de Prueba B1 no está obligado a usar el mismo software
que produjo el compromiso del oráculo — solo el mismo perfil normativo.
Define niveles futuros de esa distinción:

- **B1a**: mismo perfil normativo, operador diferente (misma
  implementación, infraestructura distinta);
- **B1b**: mismo perfil normativo, implementación diferente.

## 7. Canonicalización

Ver `CANONICALIZATION.md`. RFC 8785 (JCS) para el subconjunto de tipos
que estos esquemas admiten. La conformidad se verifica contra
`test-vectors/canonicalization-vectors.json`, no se afirma sin probarla.

## 8. Validaciones obligatorias

Un implementador debe rechazar su propia reconstrucción si:

- `resolution_result.schema`, `contract_version`, `resolver` o
  `bitmap_discovery_profile` no coinciden con los valores fijados en este
  contrato;
- `district_name` no coincide con `<district>.bitmap`;
- `resolution_snapshot.block_hash` no corresponde exactamente a
  `resolution_snapshot.height` en la cadena observada;
- `observation_tip.height < resolution_snapshot.height`;
- `observation_tip.block_hash` no corresponde exactamente a su altura;
- no puede demostrarse (con evidencia registrada, no solo afirmarse) que
  el bloque de `resolution_snapshot` es ancestro del bloque de
  `observation_tip`;
- el invariante `observed = eligible + excluded` no se cumple;
- `candidate_set_through_resolution_snapshot` contiene dos candidatos con
  la misma posición canónica, o un candidato de otro sat, o omite la
  inscripción original;
- `selected_position.block_height` excede `resolution_snapshot.height`;
- un candidato situado exactamente en `resolution_snapshot.height` declara
  un `block_hash` distinto al de `resolution_snapshot`;
- falta cualquier componente de una posición canónica, o alguno es un
  entero negativo o fuera del rango entero seguro;
- un `inscription_id` no coincide con su `transaction_id` e
  `inscription_index`;
- falta un `content_sha256` válido para cualquier candidato.

## 9. Casos bajo prueba

### `507999.bitmap`

District bajo prueba. `resolution_snapshot.height`: `959531`.
`resolution_snapshot.block_hash`:
`000000000000000000008d94f099ecc2e05da35160cabb2c3d6332db0130269e`.

### `7187.bitmap`

District bajo prueba. Mismo `resolution_snapshot` que el caso anterior.

Ninguna otra evidencia de estos dos casos —inscripción original, sat,
candidatos, hashes de contenido— se publica en este paquete. Vive
únicamente en un oráculo reservado, fuera de cualquier ZIP ciego,
comprometido por hash antes de revelarse.

## 10. Criterios de refutación

La hipótesis de Prueba B1 falla si:

- una reconstrucción independiente, honesta y conforme a este contrato,
  selecciona un `selected_inscription_id` distinto del oráculo para el
  mismo District y el mismo `resolution_snapshot`;
- dos reconstrucciones honestas producen `candidate_set_through_resolution_snapshot`
  distintos para el mismo District y snapshot;
- el resultado cambia según el orden en que la infraestructura devolvió
  los candidatos;
- se acepta un candidato de otro sat o posterior al snapshot;
- se acepta una prueba de ancestralidad sin evidencia registrada;
- la implementación presenta esta convención interna como estándar
  universal de Bitmap.

## 11. Terminología nueva en v0.2

- **`resolution_snapshot`**: la altura y hash que fijan el corte de
  elegibilidad — igual para todos los implementadores de un mismo caso.
- **`observation_tip`**: la altura hasta la cual un operador concreto
  observó la cadena — puede variar entre implementadores, siempre
  `>= resolution_snapshot.height`.
- **Resultado vs. evidencia**: `resolution_result` y
  `candidate_set_through_resolution_snapshot` son estables y comparables
  byte a byte entre implementaciones conformes; `evidence_manifest` no lo
  es — documenta cómo *esta* implementación observó la evidencia, no
  redefine la selección.
- **Perfil normativo vs. implementación vs. operador**: tres capas
  distintas de "quién hizo qué", que Prueba A no separaba con suficiente
  precisión (ver `blind/audits/proof-a-001.md`, "Divergencias de
  representación observadas").
