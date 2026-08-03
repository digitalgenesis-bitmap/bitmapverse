# Prueba B1 — Reconstrucción independiente de evidencia (contrato v0.2.2)

**Este archivo describe la tarea que se le dará a un implementador cuando
Prueba B1 se autorice explícitamente. Prueba B1 no se ha ejecutado. Este
paquete es un borrador auditable, no sellado — ver `PACKAGE_MANIFEST.draft.json`.**

## Objetivo

Reconstruir, desde infraestructura compatible con el commit OPI fijado
—sin recibir fixtures preparados, sin leer `blind/v0.1/`, `blind/v0.2/`
ni `blind/v0.2.1/`—, la cadena completa descrita en `CONTRACT.md` §2-§8 y
`BITMAP_DISCOVERY_PROFILE.md`:

```text
District
  → inscripción fundacional vía bitmap_discovery_opi_v1 (CONTRACT.md §2)
  → sat asignado (§3)
  → todas las inscripciones sobre ese sat (§4)
  → corte por resolution_snapshot (§5)
  → orden canónico same_sat_latest_v0.1 (§6)
  → selección (§7)
  → fallback a la original si aplica (§8)
  → resolution_result.v0.2.2
  → candidate_set_through_resolution_snapshot.v0.2.2
  → evidence_manifest.v0.2.2 propio, con integridad referencial fuente↔artefacto
```

para los dos Districts declarados en `CONTRACT.md` §17
(`507999.bitmap`, `7187.bitmap`).

## Material autorizado

- `CONTRACT.md`
- `BITMAP_DISCOVERY_PROFILE.md`
- `OPI_SOURCE_PROVENANCE.json`
- `RESOLUTION_RESULT_SCHEMA.json`
- `CANDIDATE_SET_SCHEMA.json`
- `EVIDENCE_MANIFEST_SCHEMA.json`
- `FIELD_PROVENANCE.md`
- `CANONICALIZATION.md`
- `COMMIT_REVEAL_PROTOCOL.md`
- `test-vectors/`
- `PACKAGE_MANIFEST.draft.json` (borrador — no representa un paquete sellado)

No solicites ni consultes código, pruebas, resultados o ejecuciones de
ninguna implementación previa de Bitmapverse (v0.1, v0.2, v0.2.1, la capa
de conformidad de Prueba A). Puedes, y debes, consultar directamente el
repositorio y el commit fijados en `OPI_SOURCE_PROVENANCE.json` — eso es
la fuente normativa de `bitmap_discovery_opi_v1`, no una implementación
previa de Bitmapverse.

## Entregables

1. Código independiente, dependencias fijadas por versión y declaradas.
2. Pruebas creadas desde el contrato, no copiadas.
3. `resolution_result.json` por District.
4. `candidate_set.json` por District.
5. `evidence_manifest.json` propio — con `source_id`/`artifact_id`
   coherentes bidireccionalmente (ver `EVIDENCE_MANIFEST_SCHEMA.json`),
   `artifact_id` en formato `sha256:<64-hex>` con los archivos reales
   guardados en `artifacts/sha256/<hex>` (sin ningún campo de ruta
   declarada), `implementation_identity` correcta según el rol de cada
   fuente (`CONTRACT.md` §17), `chain_ancestry_proof` referenciando una
   fuente `role: "chain_ancestry"` ya declarada (nunca evidencia propia
   en paralelo), paginación completa declarada, y ninguna fuente con
   datos fabricados si no fue realmente observada (`capture_status`
   honesto, con `limitations` explicando por qué si no hubo captura).
6. Hashes JCS restringido v0.2.2 de cada `resolution_result` y
   `candidate_set` — la comparación contra el oráculo se hace únicamente
   por igualdad exacta de estos hashes (`CONTRACT.md` §18), nunca por
   similitud semántica.
7. `AMBIGUITIES.md` — ninguna ambigüedad puede resolverse consultando la
   evidencia que se supone debe verificar.
8. Declaración explícita del nivel alcanzado (`B1a` u observaciones hacia
   `B1b`), y de qué precondiciones de `BITMAP_DISCOVERY_PROFILE.md`
   ("Bloqueo B1a") quedaron satisfechas por esta entrega específicamente.
9. Procedimiento de cadena y ancestralidad (`CONTRACT.md` §14).
10. Manifiesto sellado de entrega, con SHA-256 de todos los archivos
    anteriores.

## Cierre

**Nota sobre el estado de este paquete:** mientras `PACKAGE_MANIFEST.draft.json`
declare `"status": "draft_auditable_not_sealed"`, este paquete no debe
usarse para iniciar una entrega real de Prueba B1 — está pendiente de
auditoría y congelamiento. Cuando el contrato se congele, se publicará un
`PACKAGE_MANIFEST.json` definitivo y un ZIP sellado, y el oráculo
reservado se generará únicamente después de eso.

Cuando Prueba B1 se autorice formalmente, la entrega debe sellarse
**antes** de recibir cualquier comparación externa contra el oráculo
reservado y **antes** de que se revele el nonce.
