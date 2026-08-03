# Canonicalización — RFC 8785 (JCS)

v0.2 adopta RFC 8785, JSON Canonicalization Scheme (JCS), para
`resolution_result.v0.2` y `candidate_set_through_resolution_snapshot.v0.2`.
**No se afirma compatibilidad JCS sin probarla** — ver la sección
"Alcance y honestidad de la verificación" antes de asumir que esto es una
implementación de referencia completa del RFC.

Este documento es la especificación normativa. La implementación de
referencia usada para generar `test-vectors/canonicalization-vectors.json`
vive fuera de este paquete ciego, en `scripts/b1-prep/jcs.mjs` y
`scripts/b1-prep/jcs.py` — un implementador de Prueba B1 debe escribir su
propia canonicalización a partir de este documento y de RFC 8785, y
verificarla contra los vectores incluidos, no recibir el código.

## Alcance

Cubre exactamente los tipos que `RESOLUTION_RESULT_SCHEMA.json` y
`CANDIDATE_SET_SCHEMA.json` admiten: objeto, array, string, entero
(dentro del rango entero seguro), booleano, null. No cubre números de
punto flotante fuera de esos enteros — están prohibidos por los esquemas,
no solo sin especificar.

## Reglas (RFC 8785)

1. **UTF-8.** Salida final en bytes UTF-8.
2. **Orden de claves de objeto.** RFC 8785 §3.2.3: las claves se ordenan
   comparando sus secuencias de unidades de código UTF-16. Todas las
   claves usadas en los esquemas v0.2 son ASCII — el orden por unidad
   UTF-16 y el orden por punto de código Unicode coinciden para cualquier
   carácter dentro del Plano Multilingüe Básico (BMP), así que esta regla
   no se ha ejercitado fuera del BMP en este proyecto.
3. **Sin espacio insignificante.** Ningún espacio después de `:` o `,`,
   sin salto de línea final.
4. **Arrays.** El orden de entrada se preserva.
5. **Enteros.** Serializados según el algoritmo `Number::toString` de
   ECMA-262, restringido aquí a enteros dentro de
   `±(2^53 − 1)` — el rango entero seguro de ECMAScript, exigido
   explícitamente por los esquemas (`maximum: 9007199254740991`). Ningún
   campo v0.2 admite un número fuera de ese rango o no entero; una
   implementación conforme debe rechazar, no truncar ni redondear, tales
   valores.
6. **Cadenas.** Escapes JSON mínimos requeridos según el algoritmo
   `Quote` usado por `JSON.stringify` (comillas, barra invertida, y
   caracteres de control `< 0x20` mediante escapes cortos donde existen
   o `\u00XX`). Caracteres por encima de `U+007F` se emiten como bytes
   UTF-8 crudos, nunca `\uXXXX`-escapados.
7. **Booleanos y null.** Literales `true`, `false`, `null`.
8. **Rechazo de valores no admitidos.** `NaN`, `Infinity`, valores
   indefinidos, enteros fuera de rango, y cualquier tipo fuera de
   `{object, array, string, integer, boolean, null}` deben producir un
   error, nunca una serialización silenciosa aproximada.

## Restricciones entre campos que JSON Schema no expresa

Igual que en la especificación de canonicalización de la capa de
conformidad anterior:
`district_name === \`${district}.bitmap\``, el orden ascendente de
`candidates` por tupla canónica, `sat` compartido entre todos los
candidatos de un `candidate_set`, y
`selected_position.block_height <= resolution_snapshot.height` se
verifican en código, no en el `.schema.json`.

## Alcance y honestidad de la verificación

Este entorno de preparación no tiene acceso a Internet. Como consecuencia:

- **No se contrastó esta especificación ni ninguna implementación de
  referencia contra los vectores de prueba oficiales publicados en
  RFC 8785**, ni contra una biblioteca de referencia externa (p. ej. la
  paquete npm `canonicalize` o el módulo Python `python-jcs`).
- La única verificación realizada es **autoconsistencia**: la
  implementación de referencia en `scripts/b1-prep/jcs.mjs` y
  `scripts/b1-prep/jcs.py` produce bytes idénticos entre sí para cada
  vector en `test-vectors/canonicalization-vectors.json`, y sus SHA-256
  coinciden.
- **Esto no es una prueba de conformidad RFC 8785 completa.** Es una
  implementación escrita cuidadosamente a partir de la especificación tal
  como fue recordada, con un alcance deliberadamente acotado (sin números
  de punto flotante generales) para reducir la superficie de posible
  error. Un implementador de Prueba B1 que use una biblioteca JCS de
  terceros ya validada externamente debería preferirla sobre reimplementar
  esto desde cero, y declarar esa elección en su `AMBIGUITIES.md`.

## Dependencias externas

Si un implementador de Prueba B1 adopta una biblioteca JCS de terceros:
debe fijar su versión exacta, declarar por qué la eligió, y verificarla
offline contra `test-vectors/canonicalization-vectors.json` antes de
confiar en ella para los hashes de entrega. No se autoriza adoptar una
dependencia sin fijar versión ni sin esa verificación.
