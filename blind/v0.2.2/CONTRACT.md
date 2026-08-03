# Contrato ciego `same_sat_latest_v0.1` — v0.2.2 (compatible con OPI, autosuficiente)

Estado: experimental
Prueba: reconstrucción independiente de evidencia (Prueba B1)
Algoritmo histórico: `same_sat_latest_v0.1` (sin cambios de comportamiento)
Perfil de descubrimiento fundacional: `bitmap_discovery_opi_v1` (nuevo en v0.2.2)
Contrato de salida: `v0.2.2`

## 0. Autosuficiencia

Este documento, junto con `BITMAP_DISCOVERY_PROFILE.md`,
`OPI_SOURCE_PROVENANCE.json` y `FIELD_PROVENANCE.md`, define completamente
el algoritmo, las validaciones, los errores, los límites y las
estructuras de salida. Un implementador de Prueba B1 no necesita leer
`blind/v0.1/`, `blind/v0.2/` ni `blind/v0.2.1/` — se mencionan solo como
antecedente histórico no normativo (ver `PREDECESSOR_STATUS.md`).

## 1. Qué cambia respecto a v0.2.1

v0.2.1 especificaba el descubrimiento de la inscripción fundacional en
términos genéricos ("coincidencia exacta de contenido más desempate por
posición canónica más antigua"), sin fijar exactamente el perfil que un
indexador real (OPI) implementa. v0.2.2 corrige eso: fija
`bitmap_discovery_opi_v1`, un perfil verificado línea por línea contra el
commit exacto de OPI declarado en `OPI_SOURCE_PROVENANCE.json`. El
algoritmo `same_sat_latest_v0.1` que opera después del descubrimiento no
cambia.

## 2. Descubrimiento de la inscripción fundacional del District

Aplicar `bitmap_discovery_opi_v1` (ver `BITMAP_DISCOVERY_PROFILE.md` Capa
2) al número de District `N`:

1. Reunir todas las inscripciones candidatas cuyo contenido decodificado
   pase el filtro `is_valid_bitmap` y la decodificación de
   `get_bitmap_number` produzcan exactamente `N`.
2. Ordenar las candidatas de cada bloque por `inscription_number`
   ascendente; procesar los bloques en orden ascendente de altura.
3. La inscripción fundacional es la primera candidata válida para `N`
   bajo ese orden.
4. Si `bitmap_number > block_height` de la candidata, la reclamación es
   inválida (bloque todavía inexistente en ese momento).
5. Si no existe ninguna candidata válida, el District `N` no tiene
   inscripción fundacional bajo este contrato.

## 3. Identificación del sat

El sat asignado a la inscripción fundacional es el sat de la salida
donde reside esa inscripción en el momento de su transacción reveal,
según las reglas de asignación de sats de Ordinals. Este contrato no
redefine esas reglas.

## 4. Enumeración completa de inscripciones sobre ese sat

Reunir todas las inscripciones observadas sobre el sat de §3, cada una
con `inscription_id`, `sat`, `content_sha256`, y `canonical_position`
completa (`block_height`, `block_hash`, `transaction_id`,
`transaction_index`, `inscription_index`). `inscription_number` **no**
participa a partir de aquí — es exclusivo del descubrimiento fundacional
(§2).

## 5. Corte por snapshot

Fija, para cada District bajo prueba, un `resolution_snapshot` (`height`
+ `block_hash`). Un candidato es elegible si y solo si
`canonical_position.block_height <= resolution_snapshot.height`.

## 6. Orden canónico (Capa 3 — `same_sat_latest_v0.1`)

Los candidatos elegibles sobre el sat se ordenan ascendentemente por:

1. `canonical_position.block_height`;
2. `canonical_position.transaction_index`;
3. `canonical_position.inscription_index`.

## 7. Selección

La inscripción seleccionada es la última tupla elegible en el orden de
§6.

## 8. Fallback a la original

Si la única inscripción elegible sobre el sat es la propia inscripción
fundacional, la inscripción seleccionada es la fundacional — consecuencia
directa de aplicar §6-§7 a un conjunto de tamaño 1.

## 9. Validaciones obligatorias

Un implementador debe rechazar su propia reconstrucción si:

- una candidata a inscripción fundacional no satisface simultáneamente
  los tres filtros de `is_valid_bitmap` (§2, `BITMAP_DISCOVERY_PROFILE.md`
  2.1): `inscription_number >= 0`, `is_json == false`,
  `content_type_hex` con el prefijo hexadecimal de `text/plain`;
- la decodificación de contenido (§2, `BITMAP_DISCOVERY_PROFILE.md` 2.2)
  falla en cualquiera de sus pasos, o el contenido no termina en
  `.bitmap`, o la parte numérica está vacía, contiene caracteres no
  ASCII-dígito, o tiene ceros iniciales no permitidos;
- `bitmap_number > block_height` de la candidata;
- se usa un orden distinto de `inscription_number` ascendente para
  determinar la primera reclamación válida dentro de un bloque, o un
  orden distinto de altura ascendente entre bloques;
- `inscription_number` no puede obtenerse o reproducirse para una
  candidata — en ese caso, el descubrimiento debe declararse no
  reproducible, nunca sustituirse silenciosamente por otro criterio;
- el sat de algún candidato posterior no coincide con el sat de la
  inscripción fundacional;
- un `inscription_id` no coincide con su propio `transaction_id` +
  `inscription_index`;
- falta cualquier componente de `canonical_position`, o alguno es
  negativo o excede el rango entero seguro;
- dos candidatos comparten la misma tupla canónica completa;
- falta un `content_sha256` válido para cualquier candidato;
- `resolution_snapshot.block_hash` no corresponde exactamente a
  `resolution_snapshot.height`;
- `observation_tip.height < resolution_snapshot.height`, o su
  `block_hash` no corresponde a su altura;
- no puede demostrarse, con evidencia registrada, que el bloque de
  `resolution_snapshot` es ancestro del de `observation_tip`;
- el invariante `observed = eligible + excluded` no se cumple;
- una fuente no declara `pagination.complete`, o declara más páginas de
  las capturadas en `captured_artifacts`;
- existe un `source_id` o `artifact_id` duplicado, una referencia
  fuente↔artefacto inexistente, o un artefacto asociado a más de una
  fuente (ver `EVIDENCE_MANIFEST_SCHEMA.json`, x_referential_integrity_rules);
- se declaran hashes, tamaños, fechas u operador para una fuente cuya
  `capture_status` indica que no fue realmente observada.

## 10. Errores

Cada validación fallida de §9 debe reportarse con el nombre de la regla
violada, los valores observados, y el candidato o fuente involucrada.
Este contrato no fija un vocabulario cerrado de códigos de error — la
misma limitación declarada, sin resolver, desde v0.1.

## 11. Límites

Quedan expresamente fuera de v0.2.2:

- children alojados en otros sats;
- delegates;
- Names.bitmap y su vínculo con Districts;
- interpretación de Bitmap Metadata;
- portales universales;
- relaciones inferidas;
- resolución posterior al snapshot;
- disputas entre reglas alternativas;
- autoridad actual, firmas del controlador o seguridad del contenido;
- ejecución de código de terceros dentro de un contexto privilegiado.

Además:

- este contrato no redefine ni recalcula `is_json` — lo consume como una
  dependencia declarada del fork de Ord incluido en OPI;
- no se afirma que `bitmap_discovery_opi_v1` sea la única implementación
  válida de Bitmap Theory — es una compatibilidad exacta con un commit
  concreto, no un estándar (ver `BITMAP_DISCOVERY_PROFILE.md`, Capa 1 vs.
  Capa 2);
- B1b permanece bloqueada — no existe una regla normativa de
  descubrimiento independiente de implementación.

## 12. Estructuras de salida

### `resolution_result`

Ver `RESOLUTION_RESULT_SCHEMA.json`. Mismos campos mínimos que v0.2.1,
más `bitmap_discovery_profile` fijo en `"bitmapverse.bitmap_discovery_opi_v1"`.

### `candidate_set_through_resolution_snapshot`

Ver `CANDIDATE_SET_SCHEMA.json`. Sin cambios de forma respecto a v0.2.1.

### `evidence_manifest`

Ver `EVIDENCE_MANIFEST_SCHEMA.json`. Reestructurado respecto a v0.2.1 para
usar `source_id`/`artifact_id` con integridad referencial bidireccional
explícita (ver `EVIDENCE_MANIFEST_SCHEMA.json`) — corrige un modelo de v0.2.1 donde un artefacto no
declaraba a qué fuente pertenecía de forma verificable.

## 13. Campos estables vs. dependientes de observación

`resolution_result` y `candidate_set_through_resolution_snapshot` deben
ser idénticos —semántica y canónicamente— entre dos reconstrucciones
independientes y honestas del mismo District bajo el mismo
`resolution_snapshot` y el mismo `bitmap_discovery_opi_v1`.
`evidence_manifest` no lo es — documenta cómo *esta* implementación
observó la evidencia.

## 14. Invariante de observación y ancestralidad

```text
observed_through_observation_tip_count
  = eligible_through_resolution_snapshot_count
  + excluded_after_resolution_snapshot_count
```

`observation_tip.height >= resolution_snapshot.height`. El bloque de
`resolution_snapshot` debe demostrarse ancestro del de `observation_tip`.
Esa prueba (`chain_ancestry_proof`) no lleva su propia evidencia en
paralelo: referencia un `source_id` ya declarado en `sources[]` con
`role === "chain_ancestry"`, y uno o más `artifact_ids` que pertenecen a
esa misma fuente — ver §15 y §16. Nunca sustituir silenciosamente un hash
histórico por el bloque que actualmente ocupa la misma altura.

## 15. Integridad referencial fuente ↔ artefacto

Ver `EVIDENCE_MANIFEST_SCHEMA.json`, `x_referential_integrity_rules`, para
la especificación completa. Resumen normativo:

- cada `sources[]` tiene un `source_id` único y una lista `artifact_ids`;
- cada `captured_artifacts[]` tiene un `artifact_id` único y un
  `source_id` que debe existir entre las fuentes declaradas;
- la relación debe ser bidireccionalmente coherente (si la fuente lista
  el artefacto, el artefacto debe declarar esa misma fuente, y
  viceversa); un artefacto pertenece exactamente a una fuente;
- `chain_ancestry_proof.source_id` debe referenciar una fuente con
  `role === "chain_ancestry"`, y cada `chain_ancestry_proof.artifact_ids`
  debe pertenecer a esa fuente — sin excepción, sin un segundo sistema de
  procedencia corriendo en paralelo a `sources[]`/`captured_artifacts[]`;
- si `sources[].capture_status !== "captured"`: `artifact_ids` debe ser
  `[]`, `pagination.complete` debe ser `false`, `pagination.pages` debe
  ser `[]`, y `limitations` no puede estar vacío — debe explicar por qué
  no hubo captura. Ninguna fuente no capturada puede declarar hash,
  tamaño ni cuerpo de respuesta.

## 16. Artefactos direccionados por contenido

Todo artefacto capturado se identifica exclusivamente por:

```text
artifact_id = sha256:<64-hex-minúsculas>
```

y su ubicación se **deriva**, nunca se declara, como:

```text
artifacts/sha256/<64-hex-minúsculas>
```

`captured_artifacts[]` no lleva ningún campo de ruta — no hay nada que
pueda divergir del hash. `artifact_id` debe rechazarse si contiene
cualquier carácter fuera de `[0-9a-f]` en la parte del hash, cualquier
`/` o `\`, cualquier prefijo distinto de `sha256:`, o si la parte
hexadecimal no tiene exactamente 64 caracteres en minúsculas.

Un verificador debe además comprobar, sobre el archivo físico en
`artifacts/sha256/<hex>`:

- que es un archivo regular — **nunca** un enlace simbólico;
- que su ubicación resuelta permanece dentro de `artifacts/sha256/` (sin
  escape mediante `..` ni rutas absolutas);
- que su SHA-256 real coincide exactamente con el hex del `artifact_id`;
- que su tamaño real coincide con `size_bytes` declarado en el
  manifiesto.

## 17. Identidad de implementación según el rol

`sources[].implementation_identity` reemplaza el par rígido
`{repository, commit}` de una versión anterior de este contrato por una
identidad que depende del rol:

- **`bitmap_discovery`**: obligatoriamente `verification_method: "commit"`,
  `repository` igual al repositorio oficial de OPI, y `commit` igual al
  commit fijado en `OPI_SOURCE_PROVENANCE.json`
  (`da24fb6cf4c2ef3f99d030ea2ef18ba9099b0633`). No hay alternativa para
  este rol — es la única pieza de este contrato donde "reproducible"
  tiene una sola respuesta correcta.
- **Cualquier otro rol** (`sat_resolution`, `candidate_enumeration`,
  `chain_ancestry`): exige al menos una identidad genuinamente
  reproducible, coherente con el `verification_method` declarado —
  `commit` + `repository`, o `release` + `release_hash_sha256`, o
  `binary_sha256`, o `container_digest`. **No se inventa un commit de Git
  para un binario o release que no lo tiene** — si la infraestructura
  real se distribuye como binario o imagen de contenedor sin un commit
  correspondiente, el `verification_method` correcto es
  `"binary_sha256"` o `"container_digest"`, no `"commit"`.

## 18. Comparación normativa del resultado

La comparación obligatoria para `resolution_result` es, en este orden:

1. validar ambos objetos contra `RESOLUTION_RESULT_SCHEMA.json` —
   rechazar campos, tipos o valores inválidos;
2. canonicalizar ambos mediante el perfil JCS restringido
   (`CANONICALIZATION.md`);
3. calcular SHA-256 de los bytes canónicos de cada uno;
4. exigir **igualdad exacta** de ambos hashes.

Una comparación semántica (campo por campo) solo puede usarse **después**
de que los hashes resulten distintos, y únicamente como diagnóstico para
un humano — nunca puede convertir dos resultados con hashes distintos en
una aprobación. No existe ninguna vía de aprobación que evite el paso 4.

`evidence_manifest` de operadores independientes **nunca se compara byte
a byte** entre sí — es esperable y correcto que difiera (distinto
`observation_tip`, distinto operador, distintos tiempos de captura). Cada
`evidence_manifest` se valida de forma **independiente**:

- conformidad de esquema;
- consistencia de sus propios hashes (`resolution_result_canonical_sha256`
  y `candidate_set_canonical_sha256` deben reproducirse recomputando
  sobre los objetos que ese mismo operador entregó);
- procedencia (§17);
- conjunto semántico de candidatos y posiciones canónicas
  (`candidate_set_through_resolution_snapshot`, comparado sí bajo la
  misma regla del §18 que `resolution_result`, porque ese objeto sí es
  estable);
- integridad de artefactos (§15-§16);
- conteos e invariantes (§14);
- prueba de ancestralidad (§14-§15).

## 19. Protocolo commit–reveal y estados de entrega

Ver `COMMIT_REVEAL_PROTOCOL.md` para la secuencia normativa de 13 pasos y
los once estados (`draft`, `frozen`, `packaged`, `oracle_committed`,
`running`, `implementer_committed`, `implementer_revealed`,
`oracle_revealed`, `approved`, `rejected`, `inconclusive_aborted`). No se
denomina "revelación atómica" en ningún documento de este paquete —
ninguna revelación de este protocolo es una operación indivisible; el
orden entre el compromiso del implementador y la revelación del custodio
es lo que preserva la independencia de la prueba.

Tres estados de entrega merecen definición explícita por sí mismos,
porque son los que un auditor externo necesita distinguir sin leer las
13 etapas completas:

- **Congelado** (`frozen`): contrato y esquemas declarados inmutables —
  ningún archivo normativo de `blind/v0.2.2/` cambia después de este
  punto salvo mediante un sucesor explícito (v0.2.3 o posterior).
- **Empaquetado** (`packaged`): existe un paquete reproducible con su
  propio manifiesto (`PACKAGE_MANIFEST.json` definitivo, no el borrador)
  y su propio hash de ZIP.
- **Oráculo comprometido** (`oracle_committed`): el resultado privado y
  el nonce ya existen, pero **solo su compromiso criptográfico es
  visible** — nunca el oráculo ni el nonce dentro del paquete ciego, ni
  antes ni después de la revelación del implementador.

## 20. Canonicalización

Ver `CANONICALIZATION.md`. Conserva el "perfil JCS restringido" auditado
en v0.2.1, con los cambios estrictamente necesarios para los campos
nuevos de `evidence_manifest.v0.2.2`. No se amplía su alcance declarado
ni se afirma más conformidad de la ya demostrada.

## 21. Casos bajo prueba

### `507999.bitmap`

District bajo prueba. `resolution_snapshot.height`: `959531`.
`resolution_snapshot.block_hash`:
`000000000000000000008d94f099ecc2e05da35160cabb2c3d6332db0130269e`.

### `7187.bitmap`

District bajo prueba. Mismo `resolution_snapshot`.

Ninguna otra evidencia de estos dos casos se publica en este paquete.

## 22. Sucesión de `same_sat_latest_v0.1`

`same_sat_latest_v0.1` es, y permanece siendo, una **convención
experimental de Bitmapverse** — no una regla derivada de Bitmap Theory ni
implementada por OPI como mecanismo de resolución posterior (§ capa 3 de
`BITMAP_DISCOVERY_PROFILE.md`). Esta corrección no modifica el resolutor
ni su comportamiento. Documenta, en cambio, bajo qué condiciones una
versión sucesora estaría justificada:

1. **Nueva evidencia de mayor reproducibilidad** — p. ej. que
   `same_sat_latest_v0.1` produzca resultados distintos entre
   implementaciones honestas en casos no cubiertos por Prueba A/B1, lo
   que exigiría una regla de desempate más precisa.
2. **Nueva evidencia sobre intención territorial** — si la comunidad de
   Bitmap Theory documenta una convención distinta y más ampliamente
   adoptada para qué reinscripción sobre un sat representa la "vigente".
3. **Adopción voluntaria de otra convención** por Bitmapverse, declarada
   explícitamente como tal — nunca presentada como si siempre hubiera
   sido la regla original.
4. **Conservación histórica y verificable de la versión anterior** — una
   sucesora nunca reescribe silenciosamente qué seleccionó
   `same_sat_latest_v0.1` para un caso ya resuelto; coexiste como una
   convención con su propio identificador de versión, igual que v0.2.2
   coexiste con v0.2.1 sin modificarlo.

## 23. Criterios de refutación

La hipótesis de Prueba B1 falla si: dos reconstrucciones honestas del
mismo caso, bajo `bitmap_discovery_opi_v1`, seleccionan una inscripción
fundacional distinta, un sat distinto, o un `candidate_set` distinto; el
resultado depende del orden de entrega de una fuente en vez del orden
`block_height` ascendente y, dentro de cada bloque, `inscription_number`
ascendente (una permutación del orden de entrada nunca debe cambiar la
selección — ver la prueba de permutación en la suite de pruebas); se
acepta un candidato de otro sat, posterior al snapshot, o que no
satisface `is_valid_bitmap`; se acepta una prueba de ancestralidad sin
`source_id`/`artifact_ids` verificables; se acepta una referencia
fuente↔artefacto incoherente; se aprueban dos `resolution_result` con
hashes canónicos distintos por similitud semántica; se compara
`evidence_manifest` byte a byte entre operadores en vez de validarlo de
forma independiente; o la implementación presenta `bitmap_discovery_opi_v1`
como equivalente a Bitmap Theory en general, en vez de como una
compatibilidad exacta con un commit concreto.
