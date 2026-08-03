# Perfil normativo de descubrimiento Bitmap — `bitmapverse.bitmap_discovery.v0.2`

Separa tres capas que Prueba A no distinguía con suficiente precisión (ver
`blind/audits/proof-a-001.md`, "Divergencias de representación
observadas"):

1. **Reglas normativas** — qué cuenta como un District Bitmap válido y
   cuál es su inscripción fundacional, en términos independientes de
   cualquier software concreto.
2. **Implementación** — el software que aplica esas reglas (p. ej. OPI,
   un indexador propio, `ord` directamente).
3. **Operador** — quién ejecuta esa implementación y con qué
   infraestructura (nodo Bitcoin, base de datos, versión desplegada).

## Lo que sí puede especificarse con precisión desde este repositorio

- **Validación de contenido.** Una inscripción candidata a original de un
  District solo es válida si su contenido declarado coincide
  exactamente, byte a byte, con `<district>.bitmap` (ver
  `blind/v0.1/CONTRACT.md` §5.2: `original.declared_content ===
  district_name`). Esta regla es normativa, no depende de ningún software
  concreto, y ya está probada en ambas implementaciones existentes de
  Prueba A.
- **Todo lo posterior al descubrimiento.** Una vez identificada la
  inscripción original y su sat, `same_sat_latest_v0.1` (algoritmo de
  selección sobre reinscripciones del mismo sat) está completamente
  especificado en `blind/v0.1/CONTRACT.md` §4 y `blind/v0.2/CONTRACT.md`
  §2-3, sin dependencia de ninguna implementación concreta.

## El bloqueo exacto

**Este proyecto no tiene, hoy, una especificación normativa e
independiente de implementación para "cuál inscripción es la original
fundacional de un District dado su número".** Lo que existe es una
dependencia de facto: `blind/v0.1/CONTRACT.md` §5.1 dice "leer el
District original previamente descubierto mediante OPI", y los fixtures
existentes registran `source_manifest.opi.implementation`,
`source_manifest.opi.commit` y una consulta
`/v1/bitmap/get_inscription_id_of_bitmap?bitmap_number=N` — es decir, el
proyecto **pin-ea qué software y qué commit responder la pregunta**, no
**qué algoritmo responde la pregunta** en términos que un implementador
independiente pudiera reproducir sin ejecutar ese mismo software.

Preguntas concretas que este repositorio no responde de forma
independiente de OPI:

- si dos inscripciones distintas declaran el mismo contenido
  `<district>.bitmap`, ¿cuál es "la" original — la primera por posición
  canónica, la primera indexada, u otro criterio?;
- qué hace un implementador si su propio indexador Ord observa una
  inscripción candidata que OPI no reporta, o viceversa;
- si el propio OPI tiene un error de indexación, no hay una regla
  normativa independiente contra la cual contrastarlo — el proyecto
  heredaría ese error silenciosamente.

**No se inventa aquí una respuesta a estas preguntas.** Inventar una regla
de desempate plausible sin haberla derivado de una fuente normativa real
sería exactamente el tipo de afirmación no verificable que las
correcciones anteriores de este proyecto existen para prevenir.

## Consecuencia para B1a / B1b

- **B1a — mismo perfil normativo, operador diferente.** Alcanzable hoy:
  dos operadores ejecutando la misma implementación (OPI, mismo commit
  pinneado) contra la misma cadena Bitcoin deberían coincidir en la
  inscripción fundacional, porque están ejecutando literalmente el mismo
  algoritmo. Esto es lo que Prueba B1 puede exigir con el contrato actual.
- **B1b — mismo perfil normativo, implementación diferente.** **No
  alcanzable con rigor todavía.** Sin una especificación normativa
  independiente de OPI, no hay forma de que una segunda implementación
  (p. ej. un indexador Ord propio, sin OPI) demuestre que está aplicando
  "el mismo perfil normativo" en vez de simplemente "coincidir por
  casualidad" o "heredar la misma respuesta consultando la misma OPI de
  todos modos". B1b queda bloqueado hasta que exista una v0.3 de este
  contrato con una definición normativa de descubrimiento independiente
  de cualquier indexador concreto.

Prueba B1, tal como este paquete la define, exige reconstruir la selección
`same_sat_latest_v0.1` de forma independiente (candidate set, posiciones,
snapshot) — pero permite (no exige eliminar) que el descubrimiento de la
inscripción fundacional siga apoyándose en OPI como fuente pinneada por
commit, exactamente como hizo Prueba A. Esto es una limitación declarada
de v0.2, no un descuido.
