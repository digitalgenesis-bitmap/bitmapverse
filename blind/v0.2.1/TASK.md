# Prueba B1 — Reconstrucción independiente de evidencia (contrato v0.2.1)

**Este archivo describe la tarea que se le dará a un implementador cuando
Prueba B1 se autorice explícitamente. Prueba B1 no se ha ejecutado.**

## Objetivo

Reconstruir, desde infraestructura compatible con Ord/OPI —sin recibir
fixtures preparados, sin leer `blind/v0.1/` ni `blind/v0.2/`—, la cadena
completa descrita en `CONTRACT.md` §1-§7:

```text
District
  → inscripción fundacional (CONTRACT.md §1)
  → sat asignado (§2)
  → todas las inscripciones sobre ese sat (§3)
  → corte por resolution_snapshot (§4)
  → orden canónico (§5)
  → selección same_sat_latest_v0.1 (§6)
  → fallback a la original si aplica (§7)
  → resolution_result.v0.2.1
  → candidate_set_through_resolution_snapshot.v0.2.1
  → evidence_manifest.v0.2.1 propio
```

para los dos Districts declarados en `CONTRACT.md` §14
(`507999.bitmap`, `7187.bitmap`), usando el `resolution_snapshot` allí
fijado.

## Material autorizado

- `CONTRACT.md`
- `RESOLUTION_RESULT_SCHEMA.json`
- `CANDIDATE_SET_SCHEMA.json`
- `EVIDENCE_MANIFEST_SCHEMA.json`
- `BITMAP_DISCOVERY_PROFILE.md`
- `CANONICALIZATION.md`
- `FIELD_PROVENANCE.md`
- `test-vectors/`
- `PACKAGE_MANIFEST.json`
- `ORACLE_COMMITMENT.txt` (solo el compromiso)

No solicites ni consultes código, pruebas, resultados o ejecuciones de
ninguna implementación previa de Bitmapverse (v0.1, v0.2, la capa de
conformidad de Prueba A).

## Entregables

1. Código independiente, dependencias fijadas por versión y declaradas.
2. Pruebas creadas desde el contrato, no copiadas.
3. `resolution_result.json` por District.
4. `candidate_set.json` por District.
5. `evidence_manifest.json` propio — debe incluir, por cada fuente
   consultada: operador, implementación, versión o commit, endpoint,
   consulta, tiempo de observación, respuesta capturada (hash, tamaño,
   tipo de contenido), conteo reportado, y declaración explícita de
   paginación completa. Cada respuesta o página capturada debe
   referenciarse como un artefacto separado y verificable
   (`captured_artifacts`, ver `EVIDENCE_MANIFEST_SCHEMA.json`).
6. Hashes JCS restringido v0.2.1 de cada `resolution_result` y cada
   `candidate_set`.
7. `AMBIGUITIES.md` — ninguna ambigüedad puede resolverse consultando la
   evidencia que se supone debe verificar.
8. Declaración explícita del nivel alcanzado: `B1a` (mismo perfil
   normativo, operador distinto — ver `BITMAP_DISCOVERY_PROFILE.md` para
   las precondiciones exactas) o, si aplica, cualquier evidencia hacia
   `B1b` (bloqueada por diseño hasta que exista una regla normativa de
   descubrimiento independiente de implementación).
9. Procedimiento de cadena y ancestralidad (`CONTRACT.md` §13) — método,
   operador, evidencia capturada, su hash, resultado, limitaciones.
10. Manifiesto sellado de entrega, con SHA-256 de todos los archivos
    anteriores.

## Cierre

La entrega debe sellarse **antes** de recibir cualquier comparación
externa contra el oráculo reservado y **antes** de que se revele el
nonce. Cualquier corrección posterior a conocer el oráculo debe
publicarse como una segunda versión explícita.
