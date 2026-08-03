# Paquete ciego Bitmapverse v0.2.1 — preparación de Prueba B1 (autosuficiente)

Sucesor de `blind/v0.2/` (marcado `SUPERSEDED` — ver
`PREDECESSOR_STATUS.md`, que no modifica ni elimina `blind/v0.2/`).
**Prueba B1 todavía no se ha ejecutado.**

## Qué cambia respecto a v0.2

- **Autosuficiencia real.** `CONTRACT.md` define completamente el
  algoritmo de descubrimiento, selección, validaciones, errores, límites
  y estructuras de salida. Un implementador no necesita leer `blind/v0.1/`
  ni `blind/v0.2/` — se mencionan solo como antecedente histórico.
- **Secretos fuera del repositorio.** El oráculo reservado y su nonce
  viven exclusivamente en una carpeta privada externa, con permisos
  restringidos (`700` directorios, `600` archivos), protegida además por
  `.gitignore` y una comprobación automática que falla si Git llega a
  rastrear algo bajo `oracle/reserved/` (ver
  `tests/oracle-secrets-git-protection.test.mjs` en la raíz del proyecto).
- **`evidence_manifest` mucho más granular.** Fuentes múltiples con
  operador, implementación, versión/commit, endpoint, consulta, tiempos,
  tamaños, tipo de contenido, conteos reportados y paginación completa
  declarada por separado; cada respuesta capturada se referencia como un
  artefacto verificable individual (hash, tamaño, tipo).
- **"Perfil JCS restringido" v0.2.1** — corrige dos gaps reales de v0.2:
  orden de claves por unidad de código UTF-16 verificado explícitamente
  fuera del plano multilingüe básico, y rechazo (no normalización
  silenciosa) de `-0`. Rechaza también sustitutos Unicode aislados.
  Sigue sin ser una implementación certificada de RFC 8785 completo — ver
  `CANONICALIZATION.md`.
- **B1a declarado `PREPARADA PERO BLOQUEADA`**, no simplemente
  "alcanzable": este paquete lista las precondiciones exactas que faltan
  (implementación OPI exacta, commit exacto, consulta exacta,
  procedimiento reproducible de instalación, un segundo operador
  verdaderamente independiente — dos URLs sobre el mismo backend no
  cuentan). B1b sigue `BLOQUEADA` por la misma razón que en v0.2: no
  existe una regla normativa de descubrimiento de District independiente
  de una implementación concreta, y este paquete no la inventa.

## Qué NO contiene

Igual que v0.2: sin fixtures reales, candidatos reales, inscription IDs
reales, sats reales, hashes de contenido reales, resultado de Prueba A,
código de resolutores o capas de conformidad anteriores, el oráculo
reservado o su nonce.

## Estado

Preparación completa. Prueba B1 **no se ha ejecutado**.
