# Contrato ciego `same_sat_latest_v0.1` — v0.2.1 (autosuficiente)

Estado: experimental
Prueba: reconstrucción independiente de evidencia (Prueba B1)
Algoritmo: `same_sat_latest_v0.1` (histórico, sin cambios desde v0.1)
Contrato de salida: `v0.2.1`

## 0. Autosuficiencia

**Este documento define completamente el algoritmo, las validaciones, los
errores, los límites y las estructuras de salida.** Un implementador de
Prueba B1 no necesita, y no debe, leer `blind/v0.1/` ni ninguna
implementación anterior para completar la tarea. `blind/v0.1/` se
menciona en este contrato únicamente como antecedente histórico no
normativo — nunca como fuente de una regla que este documento no repita
íntegramente.

`blind/v0.2/` quedó marcado `SUPERSEDED` (ver `PREDECESSOR_STATUS.md`)
precisamente porque su contrato dependía normativamente de `blind/v0.1/`
para partes del algoritmo. v0.2.1 corrige eso.

## 1. Descubrimiento de la inscripción fundacional del District

Dado un número de District `N` (entero no negativo):

1. Enumerar candidatas a inscripción fundacional: toda inscripción cuyo
   contenido declarado, byte a byte, sea exactamente la cadena
   `N.bitmap` (sin espacios, sin mayúsculas alternativas, sin caracteres
   adicionales antes o después).
2. Si existe más de una inscripción con ese contenido exacto, la
   inscripción fundacional es la que tiene la tupla canónica
   `(block_height, transaction_index, inscription_index)` más pequeña
   (orden ascendente, ver §5) entre las candidatas.
3. Si no existe ninguna candidata, el District `N` no tiene inscripción
   fundacional válida bajo este contrato — ver §9, "no existe inscripción
   fundacional".

Esta regla (paso 1: coincidencia exacta de contenido; paso 2: la más
antigua por posición canónica gana) es completa y no depende de ningún
software concreto. **No cubre**, y explícitamente no resuelve, la
pregunta de qué INFRAESTRUCTURA usar para *enumerar* las candidatas del
paso 1 — eso es responsabilidad del perfil de implementación de cada
operador, declarado en `evidence_manifest.bitmap_discovery` (ver §6 y
`BITMAP_DISCOVERY_PROFILE.md`, que documenta honestamente hasta dónde
llega esta regla normativa y dónde empieza la dependencia de
implementación).

## 2. Identificación del sat

El sat asignado a la inscripción fundacional es el sat de la salida
(output) donde reside esa inscripción en el momento de su transacción
reveal, según las reglas de asignación de sats de Ordinals (first-in-
first-out sobre las entradas de la transacción). Este contrato no
redefine las reglas de asignación de sats de Ordinals; las asume como
dadas por el protocolo Bitcoin/Ordinals subyacente, no por ninguna
implementación de indexador concreta.

## 3. Enumeración completa de inscripciones sobre ese sat

Reunir **todas** las inscripciones observadas sobre el sat identificado
en §2, sin importar su posición respecto al snapshot todavía. Cada
inscripción candidata debe registrar:

- `inscription_id` (formato `<txid de 64 hex>i<índice entero no
  negativo>`);
- `sat` (debe coincidir con el sat de §2 — un candidato de otro sat es
  inválido, ver §8);
- `content_sha256` (SHA-256 del contenido de la inscripción);
- `canonical_position`: `block_height`, `block_hash`, `transaction_id`,
  `transaction_index`, `inscription_index` — los cinco componentes
  completos, no un subconjunto.

La enumeración debe ser **completa**: un implementador debe declarar
explícitamente, en `evidence_manifest`, que no quedan páginas adicionales
sin consultar (ver §6, `sources[].pagination.complete`). Una enumeración
parcial presentada como completa es una violación del contrato, no una
ambigüedad.

## 4. Corte por snapshot

Este contrato fija, para cada District bajo prueba, un
`resolution_snapshot` (`height` + `block_hash`) — ver §11. Un candidato es
**elegible** si y solo si `canonical_position.block_height <=
resolution_snapshot.height`. Todo candidato con `block_height` mayor
queda excluido del resultado histórico estable, sin excepción.

## 5. Orden canónico

Los candidatos elegibles se ordenan ascendentemente por la tupla:

1. `canonical_position.block_height`;
2. `canonical_position.transaction_index` (posición cero-basada de la
   transacción reveal dentro de su bloque);
3. `canonical_position.inscription_index` (el sufijo `iN` del
   `inscription_id`).

Ninguna otra señal —orden de respuesta de una API, orden de descubrimiento,
`inscription_number` global— participa en este orden. Un resultado que
dependa del orden de entrega de una fuente de datos en vez de esta tupla
es inválido.

## 6. Selección

La inscripción **seleccionada** es la última tupla elegible en el orden
de §5 (la de mayor `block_height`, desempatando por `transaction_index` y
luego `inscription_index`). Esto es `same_sat_latest_v0.1`: la
reinscripción vigente hasta el snapshot es la más reciente, no la
original, salvo que no exista ninguna reinscripción elegible.

## 7. Fallback a la original

Si la única inscripción elegible sobre el sat es la propia inscripción
fundacional (es decir, no existe ninguna reinscripción con
`block_height <= resolution_snapshot.height`), la inscripción
seleccionada es la fundacional. Esto no es un caso especial en el código:
es la consecuencia directa de aplicar §5-§6 a un conjunto elegible de
tamaño 1.

## 8. Validaciones obligatorias

Un implementador debe rechazar su propia reconstrucción, sin producir
`resolution_result`, si:

- no existe ninguna candidata a inscripción fundacional válida para el
  District (§1);
- existe más de una candidata a inscripción fundacional y no se aplicó el
  desempate de §1.2;
- el sat de algún candidato no coincide con el sat de la inscripción
  fundacional (§2-§3);
- un `inscription_id` no coincide con su propio `transaction_id` +
  `inscription_index`;
- falta cualquier componente de `canonical_position`, o alguno es un
  entero negativo o excede el rango entero seguro
  (`±(2^53−1)`, ver `CANONICALIZATION.md`);
- dos candidatos comparten la misma tupla canónica completa;
- falta un `content_sha256` con formato válido (64 caracteres hexadecimales
  en minúscula) para cualquier candidato;
- `resolution_snapshot.block_hash` no corresponde exactamente a
  `resolution_snapshot.height` en la cadena observada;
- `observation_tip.height < resolution_snapshot.height`;
- `observation_tip.block_hash` no corresponde exactamente a su altura;
- no puede demostrarse, con evidencia registrada (§6 del manifiesto, no
  una afirmación booleana), que el bloque de `resolution_snapshot` es
  ancestro del bloque de `observation_tip`;
- el invariante `observed_through_observation_tip_count =
  eligible_through_resolution_snapshot_count +
  excluded_after_resolution_snapshot_count` no se cumple;
- la enumeración de alguna fuente no se declara completa
  (`pagination.complete !== true`), o declara más páginas de las
  capturadas;
- falta el hash, tamaño o tipo de contenido de alguna respuesta capturada
  referenciada en `evidence_manifest.captured_artifacts`.

## 9. Errores

Cada validación fallida de §8 debe reportarse con:

- el nombre de la regla violada (una cadena estable, ver
  `FIELD_PROVENANCE.md`);
- los valores observados que causaron el fallo;
- si aplica, el candidato o fuente específica involucrada.

Este contrato no fija todavía un vocabulario cerrado de códigos de error
(la misma limitación que v0.1 documentó y nunca cerró — ver
`AMBIGUITIES-SUCCESSOR.md` #11 de la capa de conformidad anterior). Un
implementador debe declarar su propio vocabulario de errores en su
`AMBIGUITIES.md` de entrega si el contrato no lo fija.

## 10. Límites

Quedan expresamente fuera de v0.2.1, igual que en v0.1:

- children alojados en otros sats;
- delegates;
- Names.bitmap y su vínculo con Districts;
- interpretación de Bitmap Metadata;
- portales universales;
- relaciones inferidas;
- resolución posterior al snapshot;
- disputas entre reglas alternativas;
- autoridad actual, firmas del controlador o seguridad del contenido;
- ejecución de código de terceros dentro de un contexto privilegiado;
- una regla normativa de descubrimiento de District independiente de toda
  implementación concreta (ver `BITMAP_DISCOVERY_PROFILE.md` — bloqueo
  declarado, no resuelto aquí).

## 11. Estructuras de salida

### `resolution_result` — resultado histórico estable

Ver `RESOLUTION_RESULT_SCHEMA.json`. Estable para el mismo District, el
mismo `bitmap_discovery_profile`, el mismo `resolver`, el mismo
`resolution_snapshot` y la misma cadena Bitcoin observada, con
enumeración completa hasta el snapshot. Campos mínimos: `schema`,
`contract_version`, `resolver`, `bitmap_discovery_profile`, `district`,
`district_name`, `original_inscription_id`, `sat`,
`selected_inscription_id`, `selected_content_sha256`, `selected_position`
(completa), `resolution_snapshot` (height + block_hash, sin timestamp),
`eligible_through_resolution_snapshot_count`, `status`.

### `candidate_set_through_resolution_snapshot` — conjunto semántico

Ver `CANDIDATE_SET_SCHEMA.json`. Todos los candidatos elegibles (§4),
ordenados (§5), cada uno con `inscription_id`, `sat`, `content_sha256`,
`canonical_position` completa. Canonicalización y SHA-256 propios,
independientes de `resolution_result`.

### `evidence_manifest` — manifiesto de observación

Ver `EVIDENCE_MANIFEST_SCHEMA.json` y §12. Registra cómo *esta*
implementación observó la evidencia: fuentes, operadores, versiones,
endpoints, consultas, tiempos, respuestas capturadas con hash/tamaño/tipo,
paginación completa, prueba de ancestralidad, límites conocidos.

## 12. Campos estables vs. campos dependientes de observación

Ver `FIELD_PROVENANCE.md` para la tabla completa. Regla general: todo
campo de `resolution_result` y `candidate_set_through_resolution_snapshot`
debe ser idéntico —semántica y canónicamente— entre dos reconstrucciones
independientes y honestas del mismo District bajo el mismo
`resolution_snapshot`. Todo campo de `evidence_manifest` puede variar
legítimamente entre operadores (`observation_tip`, fuentes, tiempos,
tamaños) sin que eso implique que alguna de las dos reconstrucciones sea
incorrecta.

## 13. Invariante de observación y ancestralidad

```text
observed_through_observation_tip_count
  = eligible_through_resolution_snapshot_count
  + excluded_after_resolution_snapshot_count
```

`observation_tip.height >= resolution_snapshot.height`. El bloque de
`resolution_snapshot` debe demostrarse ancestro del bloque de
`observation_tip` en la cadena observada, con evidencia registrada — método,
operador, evidencia capturada, su hash, resultado, limitaciones (ver
`EVIDENCE_MANIFEST_SCHEMA.json`, `chain_ancestry_proof`). Nunca sustituir
silenciosamente un hash histórico por el bloque que actualmente ocupa la
misma altura.

## 14. Casos bajo prueba

### `507999.bitmap`

District bajo prueba. `resolution_snapshot.height`: `959531`.
`resolution_snapshot.block_hash`:
`000000000000000000008d94f099ecc2e05da35160cabb2c3d6332db0130269e`.

### `7187.bitmap`

District bajo prueba. Mismo `resolution_snapshot`.

Ninguna otra evidencia de estos dos casos se publica en este paquete —
vive en un oráculo reservado fuera del repositorio, comprometido por hash
antes de revelarse (ver `ORACLE_COMMITMENT.txt`).

## 15. Criterios de refutación

La hipótesis de Prueba B1 falla si: dos reconstrucciones honestas del
mismo caso seleccionan una inscripción distinta; producen un
`candidate_set` distinto; el resultado depende del orden de entrega de
una fuente; se acepta un candidato de otro sat o posterior al snapshot;
se acepta una prueba de ancestralidad sin evidencia registrada; o la
implementación presenta esta convención interna como estándar universal
de Bitmap.
