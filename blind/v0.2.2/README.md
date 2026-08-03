# Paquete ciego Bitmapverse v0.2.2 — borrador auditable, compatible con OPI

Sucesor de `blind/v0.2.1/` (marcado `SUPERSEDED` como candidato de Prueba
B1 — ver `PREDECESSOR_STATUS.md`, que no modifica ni elimina
`blind/v0.2.1/`).

**Este es un borrador auditable, no un paquete sellado.**
`PACKAGE_MANIFEST.draft.json` lo declara explícitamente
(`"status": "draft_auditable_not_sealed"`). No existe todavía ZIP final,
oráculo, nonce ni compromiso criptográfico para v0.2.2 — se generarán
solo después de que este contrato se audite y se confirme un segundo
operador OPI verdaderamente independiente. **Prueba B1 no se ha
ejecutado.**

## Qué corrige v0.2.2 respecto a v0.2.1

v0.2.1 era técnicamente sólido para sus propias reglas, pero su
descubrimiento de la inscripción fundacional (`CONTRACT.md` §1 de v0.2.1)
no reproducía completamente el perfil real que un indexador OPI
implementa — describía "coincidencia de contenido más posición canónica
más antigua" en términos genéricos, sin verificar contra el código fuente
real de OPI qué filtros adicionales existen (`is_json`, prefijo de
content-type, orden por `inscription_number`). v0.2.2 corrige esto
fijando `bitmap_discovery_opi_v1`: un perfil de descubrimiento verificado
línea por línea contra el commit exacto de OPI, con cada regla citada por
archivo, número de línea, URL permanente y SHA-256 — ver
`OPI_SOURCE_PROVENANCE.json`.

Separa además tres capas que antes no se distinguían con precisión
suficiente: el principio general de Bitmap Theory (la whitepaper), el
comportamiento operativo concreto de OPI (`bitmap_discovery_opi_v1`), y
la convención experimental `same_sat_latest_v0.1` de Bitmapverse — ver
`BITMAP_DISCOVERY_PROFILE.md`.

`evidence_manifest.v0.2.2` también corrige un modelo de v0.2.1 donde un
artefacto capturado no declaraba de forma verificable a qué fuente
pertenecía: ahora exige `source_id`/`artifact_id` con integridad
referencial bidireccional obligatoria.

## Correcciones de cierre de v0.2.2

Una segunda corrección, posterior a la primera versión de v0.2.2,
resolvió:

- **Protocolo commit–reveal explícito** — ver `COMMIT_REVEAL_PROTOCOL.md`:
  13 pasos, once estados nombrados, condición de aborto por plazo
  vencido (`inconclusive_aborted`, nunca `rejected`). Nunca se le llama
  "revelación atómica".
- **Comparación normativa separada** — `resolution_result` se aprueba
  únicamente por igualdad exacta de hash canónico (esquema → JCS →
  SHA-256); `evidence_manifest` nunca se compara byte a byte entre
  operadores, se valida de forma independiente (ver `CONTRACT.md` §18).
- **Artefactos direccionados por contenido** — `artifact_id =
  sha256:<64-hex>`, sin ningún campo de ruta declarada; la ubicación se
  deriva siempre como `artifacts/sha256/<hex>` (ver `CONTRACT.md` §16).
- **Identidad de implementación según el rol** — `bitmap_discovery` exige
  el commit OPI fijado; otros roles aceptan `release_hash`,
  `binary_sha256` o `container_digest` sin fabricar un commit inexistente
  (ver `CONTRACT.md` §17).
- **`chain_ancestry_proof` sin sistema paralelo de procedencia** —
  referencia `source_id`/`artifact_ids` ya declarados, nunca su propia
  evidencia embebida.

## Qué NO contiene

Igual que v0.2.1: sin fixtures reales, candidatos reales, inscription IDs
reales, sats reales, hashes de contenido reales, resultado de Prueba A,
código de resolutores o capas de conformidad anteriores. Tampoco contiene
todavía: nonce, oráculo, compromiso criptográfico, ni ZIP final — ver
arriba.

## Estado

`BORRADOR AUDITABLE — CONTRATO CONGELABLE — B1 BLOQUEADA`.

Cierre de correcciones (2026-08-02): las 10 áreas numeradas de la
corrección de cierre están implementadas, probadas (66/66 en
`test:blind-v022`, más el resto de la suite histórica) y verificadas
contra `PACKAGE_MANIFEST.draft.json` regenerado. El contrato en sí es
congelable. B1 permanece bloqueada por motivos ajenos a este contrato:
falta confirmar un segundo operador OPI verdaderamente independiente
(ver "Bloqueo B1a" en `BITMAP_DISCOVERY_PROFILE.md`) y quedan pasos de
verificación OPI pendientes y no ejecutados (ver "Procedimiento OPI
pendiente" en el mismo documento).
