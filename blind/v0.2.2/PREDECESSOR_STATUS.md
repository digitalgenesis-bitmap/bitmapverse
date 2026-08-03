# Estado de `blind/v0.2.1/`

**`blind/v0.2.1/` permanece históricamente intacto.** Este documento no
modifica, sobrescribe ni elimina nada dentro de `blind/v0.2.1/`, su ZIP,
su compromiso público, ni ningún artefacto asociado. Solo registra su
estado como candidato para Prueba B1.

## Veredicto

- v0.2.1 fue **técnicamente sólido para sus propias reglas** — sus
  esquemas, su canonicalización, su cadena de custodia de secretos y sus
  pruebas internas cumplían exactamente lo que su propio contrato exigía.
- v0.2.1 **queda supersedido como candidato para Prueba B1**, no
  invalidado retroactivamente.

## Razón exacta

Su descubrimiento de la inscripción fundacional (`blind/v0.2.1/CONTRACT.md`
§1) **no reproducía completamente el perfil OPI fijado**. Describía la
regla en términos genéricos —coincidencia exacta de contenido más
desempate por la posición canónica más antigua— sin verificar contra el
código fuente real del commit de OPI qué filtros adicionales existen
realmente:

- no exigía `is_json == false`;
- no exigía que `content_type_hex` comenzara con el prefijo hexadecimal
  de `text/plain`;
- no distinguía `inscription_number` (el ordinal que OPI usa realmente
  para determinar la primera reclamación) de la tupla canónica
  `(block_height, transaction_index, inscription_index)` que
  `same_sat_latest_v0.1` usa para un propósito distinto y posterior.

v0.2.2 corrige esto fijando `bitmap_discovery_opi_v1`, verificado línea
por línea contra `da24fb6cf4c2ef3f99d030ea2ef18ba9099b0633` — ver
`OPI_SOURCE_PROVENANCE.json`.

## Sin evidencia de corrupción, modificación retroactiva ni filtración

Esta corrección no encontró, y no fue motivada por, ninguna corrupción de
`blind/v0.2.1/`, ninguna modificación retroactiva de su contenido, ni
ninguna filtración de secretos causada por su diseño. La causa es
exclusivamente una brecha de especificación: la regla de descubrimiento
declarada era menos precisa de lo que un indexador real implementa, no
insegura ni comprometida.

## Qué corrige v0.2.2

v0.2.2 corrige la frontera entre tres capas que v0.2.1 no separaba con
suficiente precisión: el principio general de Bitmap Theory, el
comportamiento operativo concreto y verificado de OPI
(`bitmap_discovery_opi_v1`), y la convención experimental de Bitmapverse
(`same_sat_latest_v0.1`) — ver `BITMAP_DISCOVERY_PROFILE.md`.

## Hashes públicos de referencia (sin secretos)

| Artefacto | SHA-256 |
|---|---|
| `bitmapverse-blind-v0.2.1.zip` | `4e45c1e33146bd49732bca1a0561aae93d2574ab33bd296c56fc7580a3091997` |
| Compromiso público del oráculo v0.2.1 (`blind/v0.2.1/ORACLE_COMMITMENT.txt`) | `0108d43656a55b9d5ffcf307e481c11c8176f0c8cfe732375eb2d37a711fbe9f` |

Ninguno de estos valores es un secreto. Este registro no incluye, y nunca
incluirá, el nonce ni el contenido del oráculo de v0.2.1 (que permanecen
en la carpeta privada fuera del repositorio) ni de v0.2.2 (que todavía no
existen — ver `PACKAGE_MANIFEST.draft.json`).
