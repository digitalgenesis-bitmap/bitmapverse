# Canonicalización — "perfil JCS restringido" v0.2.1

v0.2.1 adopta un **subconjunto documentado** de RFC 8785 (JSON
Canonicalization Scheme, JCS) para `resolution_result.v0.2.1` y
`candidate_set_through_resolution_snapshot.v0.2.1`. Se denomina
explícitamente **"perfil JCS restringido"**, no "JCS" a secas ni
"conformidad RFC 8785" — ver "Diferencias frente a RFC 8785 completo"
antes de asumir más de lo que este perfil realmente cubre.

Los vectores de `test-vectors/canonicalization-vectors.json` se generaron
con una implementación de referencia mantenida fuera de este paquete
ciego. Un implementador de Prueba B1 debe escribir su propia
canonicalización a partir de este documento y verificarla contra los
vectores incluidos — no recibe ese código de referencia.

## Qué corrige v0.2.1 respecto al perfil de v0.2

`blind/v0.2/CANONICALIZATION.md` (preservado sin cambios, `SUPERSEDED`)
nunca ejercitó dos aspectos de su propia regla declarada:

1. **Orden de claves fuera del plano multilingüe básico (BMP).** RFC 8785
   ordena los nombres de miembro de un objeto comparando sus secuencias
   de **unidades de código UTF-16**, no sus puntos de código Unicode. Para
   claves ASCII (todo lo que v0.2 probó) ambos órdenes coinciden, así que
   el gap nunca se manifestó. Mezclando un carácter del BMP en el rango
   `0xE000`-`0xFFFF` con un carácter astral (`> U+FFFF`), los dos órdenes
   **discrepan**: comparando `U+FFFF` contra `U+10000`, por punto de
   código `0xFFFF < 0x10000` (U+FFFF primero), pero por unidad de código
   UTF-16, `U+10000` se codifica como el par sustituto `[0xD800, 0xDC00]`,
   y `0xD800 < 0xFFFF` — así que `U+10000` ordena **primero** bajo la
   regla real del RFC. JavaScript ya lo hacía bien de forma nativa (sus
   strings son UTF-16); Python no (`sorted(str)` compara por punto de
   código). Una implementación conforme debe convertir cada clave a su
   secuencia de unidades UTF-16 antes de ordenar, en vez de ordenar la
   cadena directamente. Ver el vector `utf16_vs_codepoint_key_order`.
2. **`-0` se normalizaba silenciosamente a `"0"`.** v0.2.1 lo **rechaza
   explícitamente** en JavaScript (`Object.is(value, -0)` lanza). Python
   no tiene un `-0` entero distinto de `0` (a diferencia de los dobles
   IEEE-754 de JavaScript), así que este caso nunca puede surgir del lado
   Python — documentado, no ignorado.

Además, v0.2.1 añade el rechazo explícito de **sustitutos Unicode
aislados** (una unidad UTF-16 alta sin su par baja inmediatamente
siguiente, o viceversa) en ambos lenguajes — ver
`hasIsolatedSurrogate`/`has_isolated_surrogate`. Una cadena con un
sustituto aislado no puede codificarse como UTF-8 válido; en vez de
mutilarla silenciosamente (p. ej. sustituyendo por `U+FFFD`), este perfil
lanza un error.

## Reglas

1. **UTF-8.** Salida final en bytes UTF-8.
2. **Orden de claves.** Comparación por secuencia de unidades de código
   UTF-16 (RFC 8785 §3.2.3) — ahora verificado explícitamente dentro y
   fuera del BMP, no solo asumido para ASCII.
3. **Sin espacio insignificante.**
4. **Arrays.** Orden de entrada preservado.
5. **Enteros.** Dentro de `±(2^53−1)` (rango entero seguro de
   ECMAScript). `-0` rechazado explícitamente (no normalizado). Fuera de
   rango, rechazado. No enteros (incluidos todos los floats), rechazados.
6. **Cadenas.** Escapes JSON mínimos requeridos; caracteres por encima de
   `U+007F` como bytes UTF-8 crudos. Sustitutos UTF-16 aislados,
   rechazados explícitamente (nuevo en v0.2.1).
7. **Booleanos y null.** Literales `true`, `false`, `null`.
8. **Rechazo de valores no admitidos.** `NaN`, `Infinity`, valores
   indefinidos, y cualquier tipo fuera de
   `{object, array, string, integer, boolean, null}`.

## Diferencias frente a RFC 8785 completo

- No implementa `Number::toString` de ECMA-262 para números que no sean
  enteros seguros — se rechazan en vez de serializarse. ninguno de los
  esquemas v0.2.1 admite un campo numérico que no sea un entero seguro,
  así que esto nunca se ejercita con datos válidos.
- **No se contrastó contra los vectores de prueba oficiales de RFC 8785**
  ni contra una biblioteca de referencia externa (p. ej. npm
  `canonicalize`, Python `python-jcs`) — sin acceso a Internet en este
  entorno. La única verificación es autoconsistencia: bytes idénticos
  entre `jcs.mjs` y `jcs.py` para cada vector en
  `test-vectors/canonicalization-vectors.json`, incluidos ahora vectores
  Unicode dentro y fuera del BMP, sustitutos aislados, y `-0`.
- Un implementador de Prueba B1 que use una biblioteca JCS de terceros ya
  validada externamente debería preferirla sobre reimplementar esto desde
  cero, fijar su versión exacta, y verificarla offline contra
  `test-vectors/canonicalization-vectors.json` antes de confiar en ella —
  declarando esa elección en su `AMBIGUITIES.md`.

## Restricciones entre campos que JSON Schema no expresa

`district_name === \`${district}.bitmap\``, el orden ascendente de
`candidates` por tupla canónica, `sat` compartido entre todos los
candidatos de un `candidate_set`, y
`selected_position.block_height <= resolution_snapshot.height` se
verifican en código, no en el `.schema.json`.
