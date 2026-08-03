# Protocolo commit–reveal con plazo y condición de aborto

Este es el nombre normativo del protocolo bilateral que gobierna Prueba
B1. No se le llama "revelación atómica" en ningún documento de este
paquete — no lo es: hay dos partes revelando en momentos distintos, con
un orden fijo y una condición de aborto explícita, no una única operación
indivisible.

**Este documento describe el protocolo. No lo ejecuta.** Ninguna de sus
13 etapas se ha iniciado. No existe todavía contrato congelado, paquete
empaquetado, oráculo, nonce, ni compromiso.

## Secuencia normativa

1. **Congelar** el contrato y los esquemas (`CONTRACT.md`,
   `RESOLUTION_RESULT_SCHEMA.json`, `CANDIDATE_SET_SCHEMA.json`,
   `EVIDENCE_MANIFEST_SCHEMA.json`, `BITMAP_DISCOVERY_PROFILE.md`,
   `CANONICALIZATION.md`) — quedan declarados inmutables.
2. **Empaquetar** el paquete reproducible: `PACKAGE_MANIFEST.json`
   definitivo (sucesor de `PACKAGE_MANIFEST.draft.json`) con SHA-256 de
   cada archivo, y el ZIP correspondiente.
3. Crear **privadamente** el oráculo (`resolution_result` y
   `candidate_set_through_resolution_snapshot` reales para cada District
   bajo prueba) y un **nonce nuevo** de 32 bytes, fuera del repositorio,
   con los mismos controles de permisos usados para v0.2.1
   (`700`/`600`).
4. **Publicar únicamente el compromiso criptográfico** del oráculo — el
   hash, nunca el oráculo ni el nonce.
5. **Entregar** el paquete ciego al implementador.
6. El implementador **reconstruye** el resultado de forma independiente.
7. El implementador **publica el compromiso criptográfico de su propio
   resultado** — antes de revelarlo.
8. El implementador **revela** su resultado.
9. Se **verifica** que el resultado revelado coincide con el compromiso
   que el implementador publicó en el paso 7.
10. **Recién entonces** el custodio revela el oráculo y el nonce.
11. Se **verifica el compromiso del oráculo** — que el oráculo y el nonce
    revelados reproducen el hash publicado en el paso 4.
12. Se **comparan** los resultados conforme al protocolo de comparación
    normativa (ver `CONTRACT.md`, sección de comparación): esquema → JCS
    → SHA-256 para `resolution_result`; validación independiente (no
    comparación byte a byte) para `evidence_manifest`.
13. **Si alguna parte no revela dentro del plazo acordado, B1 queda
    `inconclusive_aborted` — nunca `approved` ni `rejected`.** La ausencia
    de revelación no es evidencia de nada sobre la corrección del
    resultado no revelado; es un fallo del protocolo, no del contenido.

## Por qué el orden importa

El paso 7 (el implementador se compromete a su propio resultado) debe
ocurrir **antes** del paso 10 (el custodio revela el oráculo). Si el
custodio revelara primero, el implementador podría ajustar su entrega
para coincidir — invalidando la prueba de independencia que es el
propósito entero de Prueba B1. El compromiso del implementador en el
paso 7 es lo que hace que la revelación del custodio en el paso 10 sea
segura.

## Estados

Cada intento de Prueba B1 se encuentra, en todo momento, en exactamente
uno de estos once estados:

| Estado | Significado |
|---|---|
| `draft` | Contrato en preparación, puede cambiar libremente. Estado actual de v0.2.2. |
| `frozen` | Contrato y esquemas declarados inmutables (paso 1). |
| `packaged` | Paquete reproducible con manifiesto y ZIP propios (paso 2). |
| `oracle_committed` | Oráculo y nonce existen privadamente; solo su compromiso es público (pasos 3-4). |
| `running` | Paquete entregado; el implementador está reconstruyendo (pasos 5-6). |
| `implementer_committed` | El implementador publicó el compromiso de su resultado, sin revelarlo todavía (paso 7). |
| `implementer_revealed` | El implementador reveló su resultado; verificado contra su propio compromiso (pasos 8-9). |
| `oracle_revealed` | El custodio reveló el oráculo y el nonce; verificado contra el compromiso publicado (pasos 10-11). |
| `approved` | La comparación normativa (paso 12) declaró coincidencia — solo alcanzable desde `oracle_revealed`. |
| `rejected` | La comparación normativa (paso 12) declaró no coincidencia — solo alcanzable desde `oracle_revealed`. |
| `inconclusive_aborted` | Alguna parte no reveló dentro del plazo. Alcanzable desde cualquier estado posterior a `oracle_committed` y anterior a `approved`/`rejected`. No es equivalente a `rejected` — no afirma que el resultado fuera incorrecto, solo que el protocolo no se completó. |

Transiciones válidas: `draft → frozen → packaged → oracle_committed →
running → implementer_committed → implementer_revealed →
oracle_revealed → {approved | rejected}`. Desde `oracle_committed`,
`running`, `implementer_committed`, `implementer_revealed`, u
`oracle_revealed`, un vencimiento de plazo transiciona a
`inconclusive_aborted` en lugar de continuar la secuencia. No existe
ninguna transición directa hacia `approved` o `rejected` que evite
`oracle_revealed`.

## Esta intervención

Esta corrección documenta el protocolo. No ejecuta ninguna de sus etapas.
El estado real de v0.2.2 en este momento es `draft` — ni siquiera
`frozen` todavía, porque esta misma intervención sigue corrigiendo el
contrato. Ningún nonce, oráculo ni compromiso fue generado, revelado ni
rotado por este documento.
