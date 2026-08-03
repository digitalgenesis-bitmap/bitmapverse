# Ambigüedades — documento sucesor

Clasifica las once decisiones interpretativas registradas en `AMBIGUITIES.md`
dentro de la entrega Python sellada (leída únicamente desde una copia
extraída de `bitmapverse-blind-submission-a-001.zip` en un directorio
temporal; el original no fue modificado). Añade además cuatro ambigüedades
nuevas descubiertas al construir esta capa de conformidad, que
`AMBIGUITIES.md` no podía haber anticipado porque surgen precisamente de
comparar las dos salidas nativas entre sí.

Categorías: `resuelta` (el esquema/adaptador de esta intervención la cierra
para los dos fixtures de Prueba A), `pospuesta` (queda registrada pero
abierta — algunas bloquean la conformidad completa hoy, otras solo
bloquearán una versión futura del contrato; cada entrada dice cuál es su
caso), `fuera_de_alcance` (pertenece a la validación interna de cada
resolutor, no a la capa de interoperabilidad que esta intervención
construye).

> **Corrección aplicada a este documento:** la ambigüedad #12 se
> reclasificó tras una revisión que identificó que su tratamiento original
> —verificar `candidate_count` contra el fixture congelado dentro del
> propio adaptador de `resolution_result`— convertía una afirmación no
> demostrable en una que parecía demostrada. Ver la entrada #12 para el
> detalle completo y `REPORT.md` para el efecto en el veredicto general.

---

## 1. Constantes literales de schema/versión/estado/alcance/resolver

- **Formulación original:** ningún valor literal estaba fijado en
  `CONTRACT.md`; la entrega Python los infirió de los dos fixtures.
- **Decisión:** `resolution_result.v0.1` fija `schema`, `resolver` y
  `status` como `const` literales; `district_name` como patrón
  `^[0-9]+\.bitmap$`.
- **Fundamento:** una capa de interoperabilidad no puede permitir que cada
  lado infiera sus propias constantes; deben declararse una sola vez, en un
  lugar, y validarse contra eso.
- **Artefacto:** `schemas/resolution-result-v01.schema.json`.
- **Consecuencia para v0.1:** cualquier tercera implementación que use
  literales distintos para estos campos fallará la validación de esquema,
  no solo una comparación de valores.
- **Clasificación:** `resuelta`.

## 2. Campos "hash" sujetos a validación de formato

- **Formulación original:** "un hash tiene formato inválido" sin enumerar
  cuáles.
- **Decisión:** no se toca aquí. Los adaptadores no revalidan hashes que
  cada resolutor nativo ya validó; solo verifican que los que aparecen en
  `resolution_result`/`evidence_manifest` cumplan el patrón `^[0-9a-f]{64}$`
  vía el esquema estable.
- **Fundamento:** revalidar hashes ya validados por el resolutor de origen
  duplicaría lógica de selección/validación dentro del adaptador, prohibido
  por esta intervención.
- **Artefacto:** ninguno nuevo; sigue dependiendo de `resolver.py` /
  `same-sat-latest-v01.mjs`.
- **Clasificación:** `pospuesta`.

## 3. Cota de formato de `sat`

- **Decisión:** sin cambios; `resolution_result.sat` solo exige entero no
  negativo, sin techo.
- **Fundamento:** ninguna de las dos implementaciones nativas impone un
  techo; imponerlo aquí sería inventar una regla nueva, no traducir una
  existente.
- **Clasificación:** `pospuesta`.

## 4. `district`: ¿número o `<district>.bitmap`?

- **Decisión:** el esquema estable exige **ambos** — `district` (entero) y
  `district_name` (string), con la restricción cruzada
  `district_name === \`${district}.bitmap\`` verificada en código (ver
  `CANONICALIZATION.md`, sección de restricciones entre campos).
- **Fundamento:** JavaScript ya emitía ambos; Python solo emitía el string.
  Exigir los dos evita elegir un ganador arbitrario y hace visible la
  reconstrucción del entero en `python-adapter.py` (`DISTRICT_NAME_RE`).
- **Artefacto:** `schemas/resolution-result-v01.schema.json`,
  `conformance/proof-a-v0.1/adapters/python_adapter.py`.
- **Consecuencia:** una tercera implementación que solo emita uno de los
  dos falla en el adaptador con un error claro, no con un valor inventado.
- **Clasificación:** `resuelta`.

## 5. Candidatos presentes pero ninguno elegible

- **Decisión:** no se introdujo un fixture con esta condición en esta
  intervención; ambos fixtures de Prueba A tienen 100% de candidatos
  elegibles. JavaScript ya trata esto como fallo duro
  (`eligible.length === 0` lanza); el comportamiento equivalente de Python
  para este caso no se ejercitó aquí porque no hay evidencia congelada que
  lo dispare y esta intervención no puede inventar un tercer fixture sin
  salirse de "trabajar únicamente con los dos casos de Prueba A".
- **Clasificación:** `fuera_de_alcance`.

## 6. Consistencia interna del manifiesto OPI

- **Decisión:** `evidence_manifest.sources.opi` ahora declara
  `response_status` y `response_sha256` como campos requeridos y
  paralelos entre JS y Python, pero el esquema **no** codifica la regla
  específica "`not_captured_*` implica `response_sha256: null`" como una
  restricción de esquema — solo como una verificación que cada resolutor
  nativo ya hace en su propia validación de fixture.
- **Fundamento:** codificar esa regla en el esquema estable requeriría
  `$data` (no estándar en draft 2020-12 sin extensiones) o una segunda capa
  de validación cruzada; se dejó fuera para no exceder el alcance de "cinco
  artefactos" pedido.
- **Clasificación:** `pospuesta`.

## 7. Igualdad de enumeración: ¿conjunto o secuencia?

- **Decisión:** sin cambios. Los adaptadores no leen `candidate_enumeration`
  para revalidar; solo lo usan (del lado de la evidencia congelada) para
  poblar `evidence_manifest.observed_at` / `reported_count` /
  `complete_through_snapshot`, ya validados aguas arriba.
- **Clasificación:** `fuera_de_alcance`.

## 8. Hash de enumeración por recomputación, no por confianza

- **Decisión:** sin cambios; sigue siendo responsabilidad exclusiva de cada
  resolutor nativo (`resolver.py`, `same-sat-latest-v01.mjs`), ambos ya
  probados para esto en sus propias 31 y 13 pruebas respectivamente.
- **Clasificación:** `fuera_de_alcance`.

## 9. Alcance de "enteros negativos" en posición canónica

- **Decisión:** `resolution_result.selected_position.*` y
  `resolution_result.snapshot.block_height` exigen `minimum: 0` en el
  esquema estable — la restricción sí se propaga a la capa de
  interoperabilidad, aunque su verificación primaria sigue ocurriendo en
  cada resolutor nativo antes de que el adaptador reciba el dato.
- **Artefacto:** `schemas/resolution-result-v01.schema.json`.
- **Clasificación:** `resuelta`.

## 10. `test_resolver.py` autocontenido (fixtures embebidos)

- **Decisión:** decisión de empaquetado específica de la entrega Python
  sellada; no aplica a `conformance/proof-a-v0.1/tests/`, que sí puede leer
  fixtures y el ZIP sellado extraído porque esta intervención no está sujeta
  al mismo aislamiento ciego que Prueba A.
- **Clasificación:** `fuera_de_alcance`.

## 11. Orden de validaciones no especificado

- **Decisión:** sin cambios respecto a `blind/audits/proof-a-001.md`, que ya
  señalaba: "declarar el orden de validaciones solamente si los códigos de
  error forman parte del contrato". Todavía no lo son.
- **Clasificación:** `fuera_de_alcance`.

---

## Ambigüedades nuevas, descubiertas al construir esta capa de conformidad

Estas cuatro no podían aparecer en la auditoría de Prueba A porque solo se
hacen visibles al intentar traducir ambas salidas nativas a un esquema
compartido.

### 12. `candidate_count` de Python: ¿total observado o elegible tras snapshot?

- **Formulación:** el `result.json` sellado de Python declara
  `candidate_count`, pero `resolver.py` lo definió como el **total** de
  candidatos del fixture — no como el subconjunto que sobrevive el filtro
  `block_height <= snapshot_height` (a diferencia de JavaScript, que sí
  distingue `candidate_count` elegible de `excluded_after_snapshot`). Esta
  ambigüedad no fue señalada en `AMBIGUITIES.md` original.
- **Decisión (corregida):** una versión anterior de este documento
  clasificaba esta ambigüedad como `pospuesta` porque `python_adapter.py`
  consultaba el fixture congelado dentro del propio adaptador de
  `resolution_result`, verificaba que total y elegible coincidieran para
  los dos fixtures existentes, y dejaba pasar `candidate_count` como
  `eligible_candidate_count`. Esa verificación hacía que una afirmación no
  demostrable *pareciera* demostrada — precisamente lo que una corrección
  posterior de esta intervención identificó y prohibió. La decisión
  vigente es: `python_adapter.py` (el adaptador puro) **nunca** lee el
  fixture y **nunca** produce `eligible_candidate_count`;
  `to_resolution_result_core` construye todo lo demás, y
  `to_resolution_result` (el intento de producir el objeto completo)
  **siempre falla**, citando el campo exacto y la razón exacta. El conteo
  elegible/excluido por fixture solo existe en
  `evidence_enrichment.py`/`.mjs`, explícitamente etiquetado como
  enriquecimiento de evidencia, y solo alimenta `evidence_manifest` —
  nunca `resolution_result`.
- **Fundamento:** un adaptador de resultado no debe alcanzar más allá de
  su entrada para hacer que un resultado parezca más completo de lo que
  es. Verificar una hipótesis contra el fixture y luego usar esa
  verificación para completar el propio objeto que se está evaluando es
  circular: usa la respuesta para producir la pregunta que se supone debe
  responder.
- **Artefacto:** `conformance/proof-a-v0.1/adapters/python_adapter.py`
  (puro), `conformance/proof-a-v0.1/adapters/evidence_enrichment.py`
  (impuro, separado), `CANONICALIZATION.md`, `REPORT.md`.
- **Consecuencia para v0.1:** esta es ahora la causa raíz directa y citada
  del veredicto **NO CONFORME** del informe de conformidad. No queda
  enmascarada por la coincidencia numérica de los dos fixtures existentes
  — se declara explícitamente como no demostrable, independientemente de
  si los números coinciden o no en la evidencia.
- **Clasificación:** `pospuesta` — y ahora, además, **bloqueante** para la
  conformidad completa hasta que exista una v0.2 de `CONTRACT.md` que
  especifique esta semántica en la salida mínima de Python.

### 13. Ausencia de la clave `resolver` en la salida mínima de Python

- **Formulación:** la lista de "Salida mínima" en `blind/v0.1/CONTRACT.md`
  nunca incluyó `resolver` entre los campos obligatorios, así que
  `resolver.py` no la emite. JavaScript sí la emite
  (`resolver: "same_sat_latest_v0.1"`).
- **Decisión:** `python_adapter.py` completa `resolution_result.resolver`
  con la constante fija del propio esquema, documentado inline como una
  brecha de formato, no como un dato inventado sobre el contenido — el
  valor es la identidad misma de este experimento, no una inferencia sobre
  la evidencia.
- **Clasificación:** `resuelta` para efectos de interoperabilidad;
  `pospuesta` para el texto de `CONTRACT.md`, que debería añadir `resolver`
  a su lista de salida mínima en una v0.2.

### 14. `block_timestamp` no declarado en ningún fixture congelado

- Ver `CANONICALIZATION.md`, sección "Excepción documentada". Ninguna
  salida nativa ni fixture lo declara; ambos adaptadores emiten `null` sin
  inventarlo.
- **Clasificación:** `pospuesta` — es el límite real más importante de este
  informe.

### 15. `operator` de las fuentes OPI / Ord no declarado

- **Formulación:** ningún fixture congelado declara quién ejecutó la
  consulta OPI o la enumeración Ord.
- **Decisión:** `evidence_manifest.sources.{opi,ord}.operator` es
  nullable; ambos adaptadores emiten `null` en vez de fabricar un nombre de
  operador o asumir `ordinals.com` como operador (prohibido explícitamente
  para la fuente OPI).
- **Clasificación:** `pospuesta`.
