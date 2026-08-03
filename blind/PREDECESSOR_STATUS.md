# Estado de `blind/v0.2/`

**SUPERSEDED — contrato insuficiente; no existe evidencia de filtración de
secretos; B1 nunca fue ejecutada.**

`blind/v0.2/` y `bitmapverse-blind-v0.2.zip` **no fueron modificados ni
eliminados** por la creación de `blind/v0.2.1/`. Se conservan íntegros
como borrador histórico. Este documento solo registra su estado; no altera
su contenido.

## Por qué está superseded

- Su contrato dependía normativamente de `blind/v0.1/CONTRACT.md` para
  partes del algoritmo de descubrimiento, en vez de ser autosuficiente
  (v0.2.1 exige y cumple autosuficiencia — ver `CONTRACT.md` §0).
- Su `evidence_manifest.v0.2` no exigía procedencia granular por fuente
  (operador, endpoint, consulta, tiempos, tamaños, tipo de contenido,
  paginación completa, artefactos capturados por separado) — v0.2.1 sí.
- Su compromiso del oráculo y el nonce se guardaban dentro del árbol del
  repositorio (`oracle/reserved/b1-v0.2/`), sin controles de permisos ni
  protección explícita contra que Git los rastreara — un riesgo
  estructural, no un incidente. v0.2.1 mueve todo secreto fuera del
  repositorio, con permisos restringidos, y añade protección explícita en
  `.gitignore` más una comprobación automática que falla si Git llega a
  rastrear algo bajo `oracle/reserved/`.
- Su perfil de canonicalización nunca se probó fuera del plano
  multilingüe básico (BMP) ni contra sustitutos Unicode aislados ni
  contra `-0` — v0.2.1 corrige y prueba explícitamente los tres casos.

## Por qué no hay evidencia de filtración

Ninguna entrega independiente de Prueba B1 fue recibida bajo el contrato
v0.2 — Prueba B1 nunca se ejecutó contra ese paquete. El oráculo v0.2
nunca se reveló. El material reservado de v0.2
(`oracle/reserved/b1-v0.2/oracle.json`, `nonce.hex`,
`REVEAL_INSTRUCTIONS.md`) fue archivado íntegramente —verificado bit a
bit antes y después de la copia— en una carpeta privada fuera del
repositorio, con permisos `700`/`600`, y retirado del árbol del
repositorio. No existió ninguna ventana en la que ese material reservado
estuviera expuesto públicamente ni rastreado por Git (el repositorio no
tenía ningún commit en el momento de esta migración).

## Hashes públicos de referencia (sin secretos)

| Artefacto | SHA-256 |
|---|---|
| `bitmapverse-blind-v0.2.zip` | `3672603df5f7245ea5bdee6c1c66653ae415b02fef927d79141dad8714473485` |
| `blind/v0.2/PACKAGE_MANIFEST.json` (archivo completo) | `e4f34dcf012cdaed965920803f48f88bba787dbaead50907b2479ae7c7db9320` |
| Compromiso público del oráculo v0.2 (`blind/v0.2/ORACLE_COMMITMENT.txt`) | `d4f5317d70482fcff1f6eae947a16afcfe7c6fe26da9413f5defe83e7d7bbc2a` |

Ninguno de estos valores es un secreto — son compromisos e identificadores
de integridad ya públicos desde que `blind/v0.2/` se completó. Este
registro no incluye, y nunca incluirá, el nonce, el contenido del oráculo,
ni ningún resultado esperado reservado de v0.2 o de v0.2.1.

## Artefactos de Prueba A (verificados sin cambios en esta migración)

`blind/v0.1/`, `bitmapverse-blind-v0.1.zip`,
`bitmapverse-blind-submission-a-001.zip`,
`oracle/reserved/same-sat-latest-v01.oracle.json` y
`blind/audits/proof-a-001.md` fueron verificados hash por hash antes y
después de esta migración (ver `conformance/proof-a-v0.1/custody.mjs`,
ejecutado sin modificar) — sin cambios.
