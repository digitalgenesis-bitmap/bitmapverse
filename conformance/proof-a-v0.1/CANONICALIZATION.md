# `bitmapverse.canonical_json.v0.1`

Regla propia, versionada explícitamente. **No es una implementación de
RFC 8785 (JCS)** — toma prestada su disciplina de ordenamiento de claves,
pero JCS también exige la serialización de números de punto flotante según
`Number::ToString` de ECMA-262, y esta regla nunca necesita reproducir eso
porque cada campo numérico dentro del alcance de `resolution_result` y
`evidence_manifest` es un entero no negativo. Llamar "JCS" a esto sería
una implementación parcial disfrazada de estándar completo, exactamente lo
que este experimento prohíbe.

Implementaciones gemelas: [`adapters/canonical-json.mjs`](adapters/canonical-json.mjs)
(JavaScript) y [`adapters/canonical_json.py`](adapters/canonical_json.py)
(Python). Deben producir bytes idénticos para cualquier valor válido en
ambas.

## Reglas

1. **UTF-8.** La salida final se codifica como bytes UTF-8.
2. **Orden de claves.** Las claves de cada objeto se ordenan ascendentemente
   por punto de código Unicode. Todas las claves usadas en
   `resolution_result` y `evidence_manifest` son ASCII, así que el orden
   por punto de código de Python (`sorted(str)`) y el orden por unidad
   UTF-16 de JavaScript (`Array.sort` sobre `string`) coinciden exactamente
   — esta regla no ha sido probada para claves fuera de BMP y no debe
   asumirse válida para ellas.
3. **Sin espacio insignificante.** Ningún espacio después de `:` o `,`, sin
   salto de línea final.
4. **Arrays.** El orden de entrada se preserva; nunca se reordenan.
5. **Enteros.** Solamente enteros; se serializan como dígitos decimales
   sin ceros a la izquierda (salvo el propio `0`), con `-` opcional. Todo
   valor de punto flotante, `NaN`, o `Infinity` es rechazado con una
   excepción — no existe una representación canónica para ellos en este
   dominio.
6. **Cadenas.** Escapes JSON mínimos requeridos (`\"`, `\\`, `\b`, `\t`,
   `\n`, `\f`, `\r`, y `\u00XX` para el resto de caracteres de control
   `< 0x20`). Los caracteres por encima de `U+007F` (por ejemplo,
   `convención`) se emiten como bytes UTF-8 crudos, nunca como `\uXXXX`.
7. **Booleanos y null.** Literales `true`, `false`, `null`.
8. **Rechazo de valores no admitidos.** `undefined`, funciones, símbolos,
   `bigint`, claves no-string, y cualquier tipo fuera de
   `{object, array, string, integer, boolean, null}` lanzan un error en
   vez de serializarse silenciosamente.

## Restricción entre campos que el JSON Schema no expresa

`resolution_result.v0.1` exige `district_name === \`${district}.bitmap\``,
`selected_position.block_height <= snapshot.block_height`, y que si
`selected_position.block_height === snapshot.block_height` entonces
`selected_position.block_hash === snapshot.block_hash`. JSON Schema (draft
2020-12) no tiene una forma nativa y legible de expresar restricciones
entre dos campos hermanos sin `$data` (extensión no estándar). Estas tres
reglas se verifican en código — en los adaptadores al construir el
`resolution_result`, y de nuevo en
[`tests/conformance.test.mjs`](tests/conformance.test.mjs) como pruebas de
rechazo independientes — no dentro del `.schema.json` mismo. Ver
`schemas/resolution-result-v01.schema.json`, campo `district`, para la nota
correspondiente.

## Excepción documentada: `snapshot.block_timestamp`

Ninguno de los dos fixtures congelados (`fixtures/507999.snapshot.json`,
`fixtures/7187.snapshot.json`, ni sus copias ciegas en `blind/v0.1/`)
declara el timestamp del bloque de snapshot. Ni el resolutor JavaScript ni
la entrega Python sellada lo producen en su salida nativa.

Por instrucción explícita de esta intervención, el adaptador **no lo
inventa**. Ambos adaptadores emiten `snapshot.block_timestamp: null` y
registran la procedencia de esa ausencia; ver
[`AMBIGUITIES-SUCCESSOR.md`](AMBIGUITIES-SUCCESSOR.md) y `REPORT.md`,
sección de límites. Esta es la razón principal por la que el veredicto de
conformidad es **CONFORME CON LÍMITES** y no **CONFORME** sin calificar:
el esquema estable reserva un campo para un dato que la evidencia
congelada actual no puede llenar sin consultar una fuente nueva, lo cual
está fuera del alcance de esta intervención (no se consulta Internet).

## `eligible_candidate_count` no es alcanzable de forma pura para Python — y no se finge que lo sea

La salida nativa de JavaScript ya distingue `candidate_count` (elegibles,
después de filtrar por `snapshot_height`) de `excluded_after_snapshot`
(candidatos posteriores al snapshot). La salida nativa de Python sellada
(`result.json` dentro de `bitmapverse-blind-submission-a-001.zip`) solo
declara `candidate_count`, que la implementación Python definió como el
**total** de candidatos observados en el fixture, no como el subconjunto
elegible — una ambigüedad de la Prueba A no señalada explícitamente en su
momento (ver ambigüedad sucesora #12 en `AMBIGUITIES-SUCCESSOR.md`).

Una versión anterior de esta intervención resolvía esto dentro del propio
adaptador de `resolution_result`: leía el fixture congelado, contaba los
candidatos elegibles, y si el conteo coincidía con `candidate_count`
sellado (como ocurre para los dos fixtures de Prueba A: 2 de 2 y 3 de 3),
dejaba pasar el valor como `eligible_candidate_count`. Una corrección
posterior señaló que esto era circular: usaba el fixture para *verificar*
una hipótesis sobre el dato, y luego usaba esa verificación para
*completar* el propio objeto que se suponía debía evaluarse de forma pura
— haciendo que una afirmación no demostrable pareciera demostrada.

La regla vigente:

- `adapters/python_adapter.py` (puro) **nunca** lee ningún fixture y
  **nunca** produce `eligible_candidate_count`.
  `to_resolution_result_core(sealed_result)` construye los once campos
  restantes de `resolution_result.v0.1`, exclusivamente desde
  `sealed_result`. `to_resolution_result(sealed_result)` — el intento de
  producir el objeto completo — **siempre lanza** `AdapterError`, citando
  el campo exacto (`eligible_candidate_count`) y la razón exacta (que
  `candidate_count` sellado no distingue total de elegible).
- `adapters/evidence_enrichment.py` (impuro, deliberadamente separado y
  nombrado como tal) sí lee el fixture congelado para construir
  `evidence_manifest` — un objeto cuyo propósito explícito es declarar
  procedencia derivada de evidencia, no traducir un resultado ya
  producido. Ahí, y solo ahí, cuenta candidatos elegibles/excluidos
  mediante aritmética directa sobre el fixture (nunca reejecutando el
  algoritmo de selección `same_sat_latest_v0.1`, que solo decide *cuál*
  candidato nombrar, nunca cuántos son elegibles).

Consecuencia directa: el estado completo de conformidad es **NO CONFORME**
para `resolution_result.v0.1` en el lado Python — no porque los datos
disponibles difieran de JavaScript, sino porque el dato que falta no puede
obtenerse sin consultar evidencia externa al propio `result.json` sellado,
y un adaptador puro se niega a hacerlo. Ver `REPORT.md` para el veredicto
completo y la comparación del núcleo común (todo excepto
`eligible_candidate_count`), que sí es idéntico byte a byte entre ambos
lados.
