# Perfil de descubrimiento Bitmap — `bitmap_discovery_opi_v1`

Separa tres capas que versiones anteriores de este contrato mezclaban con
distinto grado de precisión (ver `PREDECESSOR_STATUS.md`):

```text
Bitmap Theory                              principio general
        ↓
bitmap_discovery_opi_v1                    compatibilidad exacta con OPI
        ↓
inscripción fundacional + sat
        ↓
same_sat_latest_v0.1                       convención de Bitmapverse
```

## Capa 1 — Bitmap Theory (principio general, no técnico)

Fuente primaria: `https://gitbook.bitmap.land/bitmap-theory-whitepaper/theory`
(consultada el 2026-08-01).

Bitmap Theory establece que un Bitcoin Block se representa como un
"District", y que la propiedad de un District se reclama inscribiendo su
número de bloque en el formato `{block-height}.bitmap`. La página fuente
declara textualmente, en su recuadro de instrucción de inscripción:

> "`{block-height}.bitmap` : first to inscribe an existing block-height as
> bitmap is valid owner"

Dos condiciones normativas se derivan directamente de esa frase, y solo
esas dos:

1. `N` en `N.bitmap` debe representar un bloque de Bitcoin **existente**
   en el momento de la inscripción.
2. La **primera** reclamación válida gana.

Bitmap Theory, tal como se pudo verificar en esta fuente, **no
especifica** ningún filtro técnico adicional (formato de content-type,
tratamiento de inscripciones "cursed", codificación de caracteres,
manejo de ceros iniciales, etc.). Esos filtros —documentados en la Capa
2— son decisiones de implementación de OPI, no del principio general. No
se le atribuyen aquí a Bitmap Theory.

## Capa 2 — `bitmap_discovery_opi_v1` (compatibilidad exacta con OPI)

Reproduce el comportamiento verificado del commit fijado de OPI (ver
`OPI_SOURCE_PROVENANCE.json` para cada regla con archivo, líneas, URL
permanente y SHA-256). Esta capa es intencionalmente más estricta y más
específica que la Capa 1 — es una implementación concreta de "primera
reclamación válida", no una redefinición del principio.

### 2.1 Filtro de candidatos (`is_valid_bitmap`)

Fuente: `OPI_SOURCE_PROVENANCE.json`, archivo
`ord/db_reader/src/server.rs`, líneas 309-323.

Una inscripción candidata es válida solo si, simultáneamente:

1. `inscription_number >= 0`.
2. `is_json` es `false`. Este campo se lee ya calculado desde el fork de
   Ord incluido en el propio repositorio OPI (`server.rs` línea 69); esta
   especificación no redefine ni recalcula cómo se decide que una
   inscripción "es JSON" — es una dependencia declarada, reproducida
   literalmente, no reinterpretada.
3. `content_type_hex.to_lowercase()` empieza con `746578742f706c61696e`
   (el prefijo hexadecimal exacto de `text/plain`, verificado por
   decodificación manual byte a byte). Es coincidencia de **prefijo**, no
   de igualdad completa de la cadena — `text/plain;charset=utf-8`
   satisface la condición porque comparte ese prefijo.

### 2.2 Decodificación y validación del contenido (`get_bitmap_number`)

Fuente: `modules/bitmap_index/bitmap_index.py`, líneas 133-147.

1. Decodificar `content_hex` de hexadecimal a bytes.
2. Decodificar esos bytes como UTF-8.
3. Si cualquiera de los dos pasos falla, el candidato es inválido.
4. El contenido decodificado debe terminar exactamente en `.bitmap`.
5. Retirar solo ese sufijo.
6. La parte restante no puede estar vacía.
7. La parte restante debe estar compuesta exclusivamente por dígitos
   ASCII `'0'`-`'9'` — la comparación es por punto de código Unicode
   contra los dígitos ASCII, así que un dígito Unicode que no sea ASCII
   (p. ej. dígitos de otro sistema de numeración) no cuenta como dígito
   válido, aunque visualmente parezca uno.
8. Rechazar ceros iniciales, excepto el caso exacto `"0"` (equivalente a
   `0.bitmap`).
9. Convertir la parte decimal resultante a entero: ese es `bitmap_number`.

No se acepta ningún espacio, salto de línea, signo, mayúscula alternativa,
carácter Unicode que se asemeje a un dígito, ni texto antes o después del
número — la comparación es literal, byte a byte tras decodificación.

### 2.3 Bloque existente

Fuente: `bitmap_index.py`, líneas 203-205.

La reclamación es inválida si `bitmap_number > inscription_block_height`
— reproduce el rechazo de Districts correspondientes a bloques todavía
inexistentes en el momento de la inscripción, satisfaciendo la condición
1 de Bitmap Theory (Capa 1).

### 2.4 Orden y primera reclamación válida

Fuentes: `server.rs` línea 727 (orden), `bitmap_index.py` líneas 206-211
y 329-362 (unicidad e iteración secuencial de bloques).

1. Los bloques se procesan en orden ascendente de altura.
2. **Dentro de cada bloque**, los candidatos se ordenan por
   `inscription_number` ascendente — esta ordenación ocurre del lado del
   servidor OPI (`server.rs`), antes de que el indexador Python los reciba.
3. Se aplican los filtros de 2.1-2.3.
4. Se conserva la primera reclamación válida para cada `bitmap_number`,
   mediante un índice único sobre esa columna
   (`bitmaps_bitmap_number_idx`, `db_init.sql` línea 17) y una inserción
   `ON CONFLICT (bitmap_number) DO NOTHING`.
5. Toda reclamación válida posterior para el mismo `bitmap_number` se
   ignora silenciosamente.

**No se usa la tupla `(block_height, transaction_index, inscription_index)`
para este descubrimiento.** `inscription_number` es un ordinal global
asignado por Ord, distinto de la posición de transacción dentro de un
bloque; no se afirma equivalencia general entre ambos. La posición
canónica sí se usa, pero solo en la Capa 3, para un propósito distinto
(resolución de reinscripciones sobre el mismo sat, no descubrimiento
fundacional).

**Si `inscription_number` no puede obtenerse o reproducirse** para un
candidato, el descubrimiento OPI de ese District debe declararse no
reproducible, y B1 permanece bloqueada para ese caso — nunca se sustituye
silenciosamente por otro orden (p. ej. por posición de transacción).

### 2.5 Consulta documentada

Fuente: `modules/bitmap_api/api.js`, líneas 113-133.

```text
GET /v1/bitmap/get_inscription_id_of_bitmap
    ?bitmap_number=N
```

No existe una ruta `/bitmap/{district}` en el código fuente verificado.
No se asume ni se inventa una URL base de operador — mientras no exista
una captura real de una instancia pública, cualquier registro de esta
fuente debe declarar `"operator": null` y
`"capture_status": "not_captured_no_public_instance"`, sin `observed_at`,
respuesta, hash de respuesta ni tamaño inventados (ver
`EVIDENCE_MANIFEST_SCHEMA.json`).

## Capa 3 — `same_sat_latest_v0.1` (convención de Bitmapverse)

Algoritmo histórico, sin cambios de comportamiento. Declarado
expresamente como:

- estado: experimental;
- alcance: convención interna de Bitmapverse;
- compatible con inscripciones y posiciones de Ordinals en general;
- **no** demostrado como parte de Bitmap Theory (Capa 1 no lo menciona);
- **no** implementado por OPI como mecanismo de resolución posterior a la
  inscripción fundacional (los archivos de OPI verificados en
  `OPI_SOURCE_PROVENANCE.json` no contienen ninguna lógica de
  reinscripción sobre el mismo sat — solo descubren `bitmap_number
  → inscription_id` una vez);
- independiente del perfil de descubrimiento fundacional: opera después
  de que la Capa 2 ya identificó la inscripción fundacional y su sat.

Para ordenar las inscripciones posteriores sobre ese mismo sat, esta capa
usa exclusivamente:

```text
block_height → transaction_index → inscription_index
```

`inscription_number` no participa aquí — es exclusivo de la Capa 2. La
frontera entre ambas capas es explícita y no se cruza en ninguna
dirección.

## Bloqueo B1a — `PREPARADA PERO BLOQUEADA`

El contrato y los esquemas son suficientes para que dos operadores
ejecutando la misma implementación (OPI, mismo commit) contra la misma
cadena Bitcoin reconstruyan el mismo resultado. Falta, para autorizar la
ejecución (no la especificación):

1. Repositorio y commit exactos — **ya fijados y verificados aquí**
   (`da24fb6cf4c2ef3f99d030ea2ef18ba9099b0633`).
2. Dependencia relevante del fork de Ord incluido (`ord/`) fijada por el
   mismo commit — **ya cubierta**, es el mismo árbol de commit.
3. Procedimiento reproducible de instalación de ese commit — no
   verificado en esta intervención.
4. Consulta exacta — **ya documentada** (`GET
   /v1/bitmap/get_inscription_id_of_bitmap?bitmap_number=N`).
5. Un segundo operador verdaderamente independiente, con infraestructura,
   control administrativo y cadena de custodia de datos genuinamente
   separados. Dos URLs sobre el mismo backend no cuentan.
6. Captura completa y verificable de evidencia por ese segundo operador.

Puntos 1, 2 y 4 quedan resueltos por esta intervención. Los puntos 3, 5 y
6 son operativos, no normativos, y siguen sin resolver.

### Procedimiento OPI pendiente (bloqueo operativo, no normativo)

**Ningún comando de instalación o ejecución de OPI en este paquete ha
sido probado realmente contra el commit fijado.** No se inventan aquí
comandos ilustrativos presentados como si fueran un procedimiento
verificado — eso sería exactamente el tipo de precisión fabricada que
esta corrección existe para eliminar. Lo que falta comprobar, de forma
real y documentada antes de que B1a pueda declararse ejecutable:

1. **Instalación desde el commit fijado** — clonar
   `https://github.com/bestinslot-xyz/OPI` en
   `da24fb6cf4c2ef3f99d030ea2ef18ba9099b0633` y confirmar que compila/
   levanta sin parches no documentados.
2. **Dependencias y versiones** — versión de Rust/Cargo para `ord/`,
   versión de Python para `modules/bitmap_index/`, versión de Node para
   `modules/bitmap_api/`, y PostgreSQL — ninguna fijada ni verificada
   todavía en esta intervención.
3. **Sincronización del indexador** — cuánto tarda, contra qué nodo
   Bitcoin, y cómo se verifica que alcanzó `resolution_snapshot.height`
   antes de consultar.
4. **Consulta de descubrimiento** — ya documentada estructuralmente
   (`BITMAP_DISCOVERY_PROFILE.md` §2.5), pero nunca ejecutada contra una
   instancia real levantada para esta verificación.
5. **Exposición opcional del endpoint** — si el segundo operador expone
   `modules/bitmap_api` públicamente o solo consulta su base de datos
   directamente; ambas son válidas, pero deben declararse explícitamente
   en `sources[].operator` y `sources[].request`.
6. **Segundo operador o réplica propia verdaderamente independiente** —
   sin este punto, B1a no tiene con qué comparar. Ver punto 5 de la lista
   principal.

Este bloqueo permanece abierto hasta que exista un procedimiento
reproducible real (no ilustrativo) para los seis puntos, ejecutado y
documentado por al menos un operador.

## Bloqueo B1b — `BLOQUEADA`

Sigue sin existir, ni se inventa aquí, una regla normativa de
descubrimiento de District independiente de una implementación concreta.
`bitmap_discovery_opi_v1` especifica exactamente lo que hace OPI en el
commit fijado — no lo que "debería" hacer cualquier implementación
conforme a Bitmap Theory en abstracto. Una segunda implementación sin OPI
no tiene, todavía, una definición normativa independiente contra la cual
demostrar equivalencia.
