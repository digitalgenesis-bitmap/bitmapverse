# Prueba B1 — Reconstrucción independiente de evidencia

**Este archivo describe la tarea que se le dará a un implementador cuando
Prueba B1 se autorice explícitamente. Prueba B1 no se ha ejecutado.**

## Objetivo

Reconstruir, desde infraestructura compatible con Ord/OPI —sin recibir
fixtures preparados—, la cadena completa:

```text
District
  → inscripción fundacional (vía el perfil normativo de descubrimiento Bitmap)
  → sat asignado a esa inscripción
  → todas las inscripciones observadas sobre ese sat
  → cadena y posiciones canónicas de cada una
  → candidate_set_through_resolution_snapshot
  → selección same_sat_latest_v0.1
  → resolution_result
  → evidence_manifest propio
```

para los dos Districts declarados en `CONTRACT.md` (`507999.bitmap`,
`7187.bitmap`), usando el `resolution_snapshot` fijado allí.

## Material autorizado

- `CONTRACT.md`
- `RESOLUTION_RESULT_SCHEMA.json`
- `CANDIDATE_SET_SCHEMA.json`
- `EVIDENCE_MANIFEST_SCHEMA.json`
- `BITMAP_DISCOVERY_PROFILE.md`
- `CANONICALIZATION.md`
- `FIELD_PROVENANCE.md`
- `test-vectors/synthetic-count-split.input.json` y `.expected.json`
- `test-vectors/canonicalization-vectors.json`
- `PACKAGE_MANIFEST.json`
- `ORACLE_COMMITMENT.txt` (solo el compromiso — no el oráculo)

No solicites ni consultes código, pruebas, resultados o ejecuciones de
otra implementación (incluida cualquier implementación previa de
Bitmapverse, Prueba A, o la capa de conformidad de Prueba A).

## Entregables

1. Código independiente (cualquier lenguaje, biblioteca estándar más
   dependencias estrictamente necesarias para hablar con infraestructura
   Ord/OPI, fijadas por versión y declaradas).
2. Pruebas creadas desde el contrato, no copiadas.
3. `resolution_result.json` — para cada District bajo prueba.
4. `candidate_set.json` — para cada District bajo prueba.
5. `evidence_manifest.json` — propio, con el invariante
   `observed = eligible + excluded` verificable.
6. Hashes JCS (RFC 8785, ver `CANONICALIZATION.md`) de cada
   `resolution_result` y cada `candidate_set`.
7. `AMBIGUITIES.md` — decisiones interpretativas encontradas. Ninguna
   ambigüedad puede resolverse consultando la evidencia que se supone
   debe verificar.
8. Fuentes utilizadas — API, commit o versión de cada componente de
   infraestructura, con su propio perfil de descubrimiento declarado
   (`BITMAP_DISCOVERY_PROFILE.md`).
9. Procedimiento de cadena y ancestralidad (`CONTRACT.md` §5) — método,
   operador, evidencia capturada, su hash, resultado, limitaciones.
10. Manifiesto sellado de entrega, con SHA-256 de todos los archivos
    anteriores.

## Cierre

La entrega debe sellarse **antes** de recibir cualquier comparación
externa contra el oráculo reservado y **antes** de que se revele el
nonce. Cualquier corrección posterior a conocer el oráculo debe
publicarse como una segunda versión explícita, nunca como una edición
silenciosa de la primera entrega.
