# Canonicalización — "perfil JCS restringido" v0.2.1, reutilizado sin cambios de código

v0.2.2 usa exactamente el mismo "perfil JCS restringido" auditado en
`blind/v0.2.1/CANONICALIZATION.md` (preservado, no modificado). No hay
cambios de código: `evidence_manifest.v0.2.2` introduce objetos nuevos
(`operator`, `request`, `pagination_status`) pero ninguno usa un tipo de
dato que el perfil no soportara ya — siguen siendo objetos, arrays,
strings, enteros seguros, booleanos y `null`, anidados de forma distinta,
no tipos nuevos.

**No se amplía el alcance declarado ni se afirma más conformidad de la ya
demostrada en v0.2.1.**

## Alcance (sin cambios)

Objeto, array, string, entero dentro del rango entero seguro
(`±(2^53−1)`), booleano, `null`. Sin números de punto flotante. Ver
`blind/v0.2.1/CANONICALIZATION.md` para la especificación completa de las
ocho reglas (UTF-8, orden de claves por unidad de código UTF-16, sin
espacio insignificante, orden de arrays preservado, enteros seguros con
`-0` explícitamente rechazado, escapes de cadena con sustitutos Unicode
aislados rechazados, literales booleanos/null, rechazo de valores no
admitidos).

## Restricciones entre campos que JSON Schema no expresa

Además de las ya declaradas en v0.2.1
(`district_name === \`${district}.bitmap\``, orden ascendente de
`candidates`, `sat` compartido, `selected_position.block_height <=
resolution_snapshot.height`), v0.2.2 añade las restricciones de
integridad referencial `source_id`/`artifact_id` de
`EVIDENCE_MANIFEST_SCHEMA.json` (x_referential_integrity_rules) — verificadas en código, nunca
expresables como restricción de esquema puro.

## Honestidad de la verificación

Sin cambios respecto a v0.2.1: sin acceso a Internet para contrastar
contra los vectores oficiales de RFC 8785 ni contra una biblioteca de
referencia externa. La única verificación es autoconsistencia entre la
implementación de referencia JavaScript y Python, mantenida fuera de este
paquete.
