# Conformidad de salida posterior a Prueba A — Informe

**Estado completo: NO CONFORME**
**Estado del núcleo común de selección y posición: CONFORME**

> "CONFORME para el núcleo común de selección y posición."

Esta es la única afirmación que las pruebas sostienen. La afirmación más
amplia — "las dos salidas pueden normalizarse al mismo resultado semántico
completo" — **no se sostiene** y esta versión del informe ya no la hace:
depende de que el lado Python declare `eligible_candidate_count`, y el
`result.json` sellado no permite demostrar ese campo sin consultar el
fixture congelado. Este informe corrige una versión anterior que sí hacía
esa afirmación más amplia apoyándose, sin decirlo con suficiente claridad,
en una verificación cruzada contra el fixture dentro del propio adaptador.

Reproducible con un único comando offline:

```bash
npm run conformance:proof-a
```

Escribe [`report.json`](report.json) y corre la suite de pruebas
([`tests/conformance.test.mjs`](tests/conformance.test.mjs), 25 pruebas)
como parte del mismo comando.

## Por qué NO CONFORME

`resolution_result.v0.1` exige `eligible_candidate_count`: el número de
candidatos válidos hasta `snapshot.block_height`, después de filtrar. La
salida JavaScript ya distingue ese subconjunto de forma nativa
(`resolveSameSatLatestV01` calcula `candidate_count` como
`eligible.length`, después de aplicar el filtro). La salida Python sellada
declara `candidate_count`, pero `resolver.py` la definió como el **total**
de candidatos del fixture — nunca como el subconjunto elegible. El
`result.json` sellado no lleva ningún desglose elegible/excluido que
permita saber, mirando solo ese archivo, si ambos números coinciden.

La versión anterior de esta intervención resolvía esto dentro del propio
adaptador: leía el fixture congelado, contaba los candidatos elegibles, y
si coincidía con `candidate_count` sellado, lo usaba como
`eligible_candidate_count`. Eso convertía una afirmación no verificable en
un valor que *parecía* verificado — exactamente lo que esta corrección
prohíbe. `python_adapter.py` ya no recibe el fixture en absoluto para
construir `resolution_result`: [`to_resolution_result_core`](adapters/python_adapter.py)
construye todo excepto `eligible_candidate_count` desde `sealed_result`
puro, y [`to_resolution_result`](adapters/python_adapter.py) **siempre
falla**, con una explicación que cita el campo exacto y la razón exacta.
El único lugar donde el fixture congelado puede intervenir es
[`evidence_enrichment.py`](adapters/evidence_enrichment.py), un módulo
distinto, nombrado explícitamente como enriquecimiento de evidencia — y
solo alimenta `evidence_manifest`, nunca `resolution_result`.

Por lo tanto, el estado completo es **NO CONFORME**: el `result.json`
sellado de Python no puede satisfacer `resolution_result.v0.1` sin
consultar evidencia externa a sí mismo.

## Qué sí es CONFORME: el núcleo común

Quitando `eligible_candidate_count`, los once campos restantes de
`resolution_result` (`schema`, `district`, `district_name`, `resolver`,
`original_inscription_id`, `selected_inscription_id`,
`selected_content_sha256`, `sat`, `selected_position`, `snapshot`,
`status`) sí se construyen exclusivamente desde cada salida nativa ya
producida, sin tocar ningún fixture, y coinciden exactamente:

| Fixture | SHA-256 canónico del núcleo (ambos lados) | Igualdad semántica | Bytes canónicos | SHA-256 |
|---|---|---|---|---|
| `507999-at-959531` | `94ab3b07427ccf41fa3bb5cf88865a156da83b187f35c6ff5f6b5d8a6fd5b533` | ✅ | ✅ | ✅ |
| `7187-at-959531` | `961e2151f276810043c923331a96d881945c7a0fad03eb3eab4cb784368b9599` | ✅ | ✅ | ✅ |

Estos hashes son distintos de los reportados en la versión anterior de
este informe porque ahora se calculan sobre el núcleo (sin
`eligible_candidate_count`), no sobre el objeto completo.

## Validadores reales, no condiciones calculadas

La versión anterior de las pruebas de rechazo calculaba una condición
booleana en la propia prueba y comprobaba que fuera falsa — nunca invocaba
código de validación real. Esta versión sustituye eso por
[`adapters/resolution-result-rules.mjs`](adapters/resolution-result-rules.mjs)
y [`adapters/resolution_result_rules.py`](adapters/resolution_result_rules.py):
funciones que **lanzan** `ValidationError` ante cada violación, invocadas
por las pruebas mediante `assert.throws` (JavaScript) o `except
ValidationError` (Python, vía subproceso). Ambos adaptadores llaman a estos
validadores sobre su propia salida antes de devolverla — no son solo
utilidades de prueba, son parte del camino real.

Reglas cubiertas, cada una con su propia prueba de rechazo:

- `district_name !== district + ".bitmap"`
- posición seleccionada posterior a `snapshot.block_height`
- hash de bloque fronterizo distinto al hash del snapshot
- campos obligatorios ausentes
- IDs de inscripción y hashes con formato inválido

## Cadena de custodia — comparaciones reales, no una verificación vacía

La versión anterior de la prueba "historical artifacts remain untouched"
solo comprobaba que un hash tuviera 64 caracteres — verdadero para
cualquier SHA-256, incluido el de un archivo ya alterado. Esta versión
([`custody.mjs`](custody.mjs)) compara cada artefacto contra un compromiso
previo real y citado:

| Artefacto | Hash esperado | Fuente del compromiso | Coincide |
|---|---|---|---|
| `bitmapverse-blind-submission-a-001.zip` | `e882577e...ed1de3` | `blind/audits/proof-a-001.md`, "SHA-256 de la entrega preservada" | ✅ |
| `bitmapverse-blind-v0.1.zip` | `20e2e668...25ae0d4` | `blind/audits/proof-a-001.md`, "SHA-256 del paquete" | ✅ |
| `blind/v0.1/{README.md,TASK.md,CONTRACT.md,ORACLE_COMMITMENT.txt,case.json,fixtures/*.json}` (7 archivos) | — | `blind/v0.1/PACKAGE_MANIFEST.json` | ✅ (7/7) |
| `oracle/reserved/same-sat-latest-v01.oracle.json` | `2db6191f...9879783` | `blind/v0.1/ORACLE_COMMITMENT.txt` (publicado antes de revelar el oráculo) | ✅ |

Para `blind/audits/proof-a-001.md` no existe ningún compromiso previo
registrado en este repositorio — ni manifiesto, ni archivo compañero, ni
mensaje anterior que fije su hash. En vez de omitir la verificación o
inventar un valor esperado, `custody.mjs` lo declara explícitamente:

> "Su integridad retrospectiva no puede demostrarse criptográficamente; se
> establece una línea base desde esta revisión."

Hash de esa línea base (2026-07-31, esta revisión):
`ad373899b1157523085604bf9cf4d4c5974408f8832a7fc1cf93f3fb052d8308`.

Las 10 comparaciones reales coincidieron; la línea base nueva se registró
sin fabricar una coincidencia. `run.mjs` corre esta verificación antes y
después de todo el proceso, y confirma además que el propio hash de línea
base de `proof-a-001.md` no cambió durante la corrida.

## Qué se construyó (correcciones sobre la intervención anterior)

- **`adapters/python_adapter.py`** — ahora genuinamente puro: solo recibe
  `sealed_result`. `to_resolution_result_core` construye todo salvo
  `eligible_candidate_count`; `to_resolution_result` siempre falla con una
  explicación citando el campo y la razón exactos.
- **`adapters/evidence_enrichment.py`** (nuevo) — el único lugar donde
  Python lee el fixture congelado; construye solamente `evidence_manifest`,
  nunca `resolution_result`.
- **`adapters/evidence-enrichment.mjs`** (nuevo) — separación equivalente
  del lado JavaScript: `js-adapter.mjs` ya era puro para
  `resolution_result` (no necesitaba el fixture), pero `toEvidenceManifest`
  vivía en el mismo archivo; ahora vive aquí, nombrada explícitamente.
- **`adapters/resolution-result-rules.mjs` / `resolution_result_rules.py`**
  (nuevo) — los cinco validadores reales, ejecutables, que lanzan en vez de
  solo describir una regla.
- **`custody.mjs`** (nuevo) — verificación de cadena de custodia con
  compromisos previos reales y citados, y declaración explícita donde no
  existen.
- **`python_conformance_cli.py`** (nuevo, sustituye el CLI que antes vivía
  dentro de `python_adapter.py`) — orquesta el adaptador puro y el
  enriquecimiento de evidencia por separado, y expone el error completo de
  `to_resolution_result` como un hecho de primera clase, no un valor
  oculto.

## Restricciones respetadas

- Ningún resolutor fue modificado.
- La entrega Python sellada nunca se editó; se leyó solo desde copias en
  `mkdtemp`, verificadas antes y después contra su hash real.
- Prueba A, el oráculo, Prueba B, Names.bitmap, Bitcoin, el HTML y el portal
  visual no fueron tocados.
- Ningún adaptador de `resolution_result` lee un fixture. El único lugar
  donde una lectura de fixture ocurre para Python es
  `evidence_enrichment.py`, y solo alimenta `evidence_manifest`.
- Ningún commit histórico se afirma sin poder demostrarse: el único commit
  citado (`da24fb6cf4c2ef3f99d030ea2ef18ba9099b0633`) es el de OPI
  declarado dentro del propio fixture congelado.

## Pruebas ejecutadas

```
node --test conformance/proof-a-v0.1/tests/conformance.test.mjs
```

25 pruebas, 25 aprobadas, 0 fallidas. Cambios respecto a la versión
anterior: las pruebas de "rechazo" ahora invocan
`resolution-result-rules.mjs` / `resolution_result_rules.py` con
`assert.throws` / `except ValidationError` en vez de calcular una
condición inline; se añadieron pruebas que confirman que Python
**nunca** puede construir un `resolution_result` completo y que el motivo
citado es el correcto; se añadieron pruebas de cadena de custodia que
comparan contra compromisos reales en vez de solo medir la longitud de un
hash.

## Ambigüedades

Ver [`AMBIGUITIES-SUCCESSOR.md`](AMBIGUITIES-SUCCESSOR.md), actualizado
para reflejar esta corrección — en particular la ambigüedad #12
(`candidate_count`: total vs. elegible), que ya no se reporta como
"pospuesta pero sin efecto práctico": ahora es la causa directa y citada
del veredicto NO CONFORME.

## Límites reales

1. **`eligible_candidate_count` de Python no es demostrable desde la
   evidencia sellada.** Esta es la causa raíz del NO CONFORME general.
2. **`snapshot.block_timestamp` no disponible** en ningún fixture
   congelado; ambos lados emiten `null`, no inventado.
3. **Asimetría histórica del lado JavaScript** — `derived_after_prueba_a`,
   no un artefacto sellado contemporáneo a Prueba A.
4. **`operator` de las fuentes OPI/Ord no disponible**; `null` en ambos
   lados.
5. **`blind/audits/proof-a-001.md` no tiene compromiso previo
   verificable**; su hash se trata como línea base nueva, no como prueba
   retrospectiva.

## Intervención mínima necesaria antes de Prueba B1

Una sola adición al contrato desbloquearía la conformidad completa sin
tocar ningún artefacto sellado: una v0.2 de `blind/v0.1/CONTRACT.md` (o un
sucesor explícito, nunca una reescritura silenciosa del original) que
declare, para la "Salida mínima" de cualquier implementación ciega futura:

1. un campo `eligible_candidate_count` (o una redefinición explícita de
   `candidate_count` como el subconjunto elegible, no el total observado);
2. un campo `resolver` en la salida mínima, con el identificador fijo del
   resolutor.

Con esas dos adiciones, una tercera implementación ciega podría producir
un `resolution_result` completo y comparable sin que ningún adaptador
necesite tocar un fixture. Hasta entonces, la afirmación honesta sigue
siendo la que sostienen las pruebas de este informe: conformidad del
núcleo de selección y posición, no conformidad completa.

No se recomienda iniciar Prueba B1 todavía — no por un problema en la
reconstrucción de evidencia (que Prueba B1 existe para probar), sino
porque partir de un contrato que no distingue "total" de "elegible" en su
propia salida mínima propagaría la misma ambigüedad no resuelta a una capa
que sí necesita esa distinción.
