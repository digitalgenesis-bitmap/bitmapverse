# Perfil normativo de descubrimiento Bitmap — `bitmapverse.bitmap_discovery.v0.2.1`

Separa tres capas:

1. **Reglas normativas** — qué cuenta como un District Bitmap válido y
   cuál es su inscripción fundacional, en términos independientes de
   cualquier software concreto. Definidas completa y autosuficientemente
   en `CONTRACT.md` §1: coincidencia exacta de contenido
   (`<district>.bitmap`) más desempate por posición canónica más
   antigua.
2. **Implementación** — el software que aplica esas reglas para
   *enumerar* las candidatas del paso 1 de `CONTRACT.md` §1 (p. ej. OPI,
   un indexador propio, `ord` directamente).
3. **Operador** — quién ejecuta esa implementación y con qué
   infraestructura (nodo Bitcoin, base de datos, versión desplegada).

## Lo que sí está completamente especificado

Todo lo posterior al descubrimiento de la inscripción fundacional y su
sat —enumeración sobre el sat, corte por snapshot, orden canónico,
selección, fallback a la original— está definido íntegramente en
`CONTRACT.md` §2-§7, sin dependencia de ningún software concreto. Esto
es una ampliación deliberada respecto al perfil anterior: antes ese texto
vivía en un contrato distinto y se citaba por referencia; ahora está
inline.

## El bloqueo exacto (sin resolver, declarado)

**No existe una especificación normativa e independiente de
implementación para "cuál inscripción es la original fundacional de un
District dado su número" a nivel de *enumeración de candidatas*.**
`CONTRACT.md` §1 especifica QUÉ hace válida a una candidata (contenido
exacto) y CÓMO desempatar si hay varias — pero no especifica CÓMO
enumerar de forma completa y verificable todas las inscripciones que
podrían ser candidatas, sin depender de un indexador concreto (OPI, un
indexador Ord propio, u otro). Esta es la misma laguna que v0.2 heredó de
v0.1, ahora declarada explícitamente en el propio contrato normativo
(`CONTRACT.md` §1, último párrafo) en vez de vivir solo en este
documento.

No se inventa aquí una respuesta. Preguntas concretas que siguen sin
respuesta normativa independiente de implementación:

- si dos indexadores distintos observan conjuntos de candidatas
  ligeramente distintos (uno se retrasó, uno tiene un error), no hay una
  fuente de verdad normativa contra la cual arbitrar sin volver a
  depender de una implementación concreta;
- qué constituye "haber enumerado completamente" las candidatas de forma
  verificable por un tercero sin volver a ejecutar la misma
  infraestructura.

## B1a — mismo perfil normativo, operador diferente

**Estado: PREPARADA PERO BLOQUEADA.**

El contrato (`CONTRACT.md`) y los esquemas están completos y son
suficientes para que dos operadores ejecutando la *misma implementación*
contra la *misma cadena Bitcoin* reconstruyan el mismo resultado. Lo que
falta para poder EJECUTAR B1a, no para especificarla, es:

1. **Implementación OPI exacta** — repositorio y verificación de que el
   código realmente disponible corresponde a lo declarado (no solo un
   nombre de proyecto).
2. **Commit exacto** — un hash de commit específico, no una rama móvil
   (`main`, `master`) ni una versión etiquetada sin hash de commit
   verificable.
3. **Consulta exacta** — el endpoint y los parámetros exactos que un
   segundo operador debe usar, verificados contra lo que produjo el
   oráculo reservado (sin revelar el oráculo mismo).
4. **Procedimiento reproducible de instalación** — pasos que un segundo
   operador, sin acceso al primero, pueda seguir para levantar una
   instancia funcional desde el commit exacto del punto 2 y obtener
   resultados comparables.
5. **Un segundo operador verdaderamente independiente.** Dos URLs que
   responden a través del mismo backend, la misma base de datos, o la
   misma instancia desplegada por la misma parte **no cuentan como
   independencia** — eso sería una única implementación con dos nombres,
   no una reconstrucción independiente. La independencia exige
   infraestructura, control administrativo y cadena de custodia de datos
   genuinamente separados.

Ninguno de estos cinco puntos está resuelto en este paquete. B1a queda
preparada (el contrato no bloquea su ejecución por falta de
especificación) pero bloqueada operativamente (falta la infraestructura
concreta de los cinco puntos). No se debe declarar B1a lista para
ejecutarse hasta que los cinco estén satisfechos y documentados.

## B1b — mismo perfil normativo, implementación diferente

**Estado: BLOQUEADA.**

Bloqueada por la laguna descrita arriba: sin una regla normativa de
enumeración de candidatas independiente de una implementación concreta,
no hay forma de que una segunda implementación (sin OPI) demuestre que
está aplicando "el mismo perfil normativo" en vez de simplemente heredar
o coincidir por casualidad con la respuesta de OPI. B1b permanece
bloqueada hasta que exista una v0.3 de este contrato con esa definición.
No se inventa aquí.
