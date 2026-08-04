# Bitmapverse

Primera construcción experimental de Bitmapverse: una experiencia de descubrimiento, resolución, verificación y navegación entre territorios Bitmap.

## Estado actual

La fase v0.1 implementa `same_sat_latest_v0.1`, un portal experimental privado entre Freedeon y Organa y el primer Consejo de Señales en sombra.

No contiene todavía:

- EMV pública;
- segunda implementación ciega;
- vínculo resuelto entre `bitmapverse.bitmap` y un District anfitrión;
- Names.bitmap;
- portales universales;
- interpretación de metadata;
- inscripción on-chain.

## Evidencia inicial

- `507999.bitmap` → reinscripción confirmada de Freedeon.
- `7187.bitmap` → segunda reinscripción Organa observada en el snapshot.
- Snapshot común: bloque `959531`.
- Enumeraciones Ord congeladas: 2 candidatos para Freedeon y 3 para Organa, ambas con `more:false`.
- Hash SHA-256 del contenido de cada candidato.
- Código OPI fijado por commit; respuesta de una instancia pública todavía no capturada.

Véase [BITMAPVERSE_V01_CONTRACT.md](./BITMAPVERSE_V01_CONTRACT.md).

## Candidato EMV local

El portal Freedeon ↔ Organa se organiza en dos niveles pensados para una
persona no técnica:

- **Experiencia** (vista inicial): explica en lenguaje simple qué es
  Bitmapverse, qué territorios participan, la ruta Freedeon ↔ Organa (con
  opción de invertirla) y qué contenido fue resuelto, sin abrir con hashes.
- **Verificación** (se abre desde Experiencia): conserva toda la evidencia
  técnica existente — District, inscripción original, inscripción
  seleccionada, sat, posición canónica, hashes, snapshot, regla aplicada,
  enlaces a Ord, y qué evidencia sigue ausente.

Esto lo convierte en un **Candidato de Experiencia Mínima Verificable (EMV)
local**: todavía no es una EMV pública ni un estándar universal de Bitmap,
como también indica la lista anterior.

## Verificación local

```bash
npm install
npm run test:resolver
npm run test:signals
npm run test:blind
npm test
```

`npm test` ejecuta trece pruebas del resolver, seis pruebas del Consejo en sombra, cuatro pruebas de aislamiento del paquete ciego, compila la aplicación y verifica mediante dos pruebas de renderizado que el portal presenta ambos territorios, el snapshot, la regla y sus límites epistemológicos.

La interfaz permite:

- inspeccionar la evidencia resuelta de `507999.bitmap` y `7187.bitmap`;
- invertir la dirección narrativa del portal;
- abrir en Ord el contenido seleccionado;
- consultar IDs, sat, posición canónica y hashes de integridad;
- ver la ausencia todavía abierta de una respuesta OPI capturada.

## Consejo de Señales en sombra

El expediente `portal-507999-7187-001` referencia los dos fixtures por SHA-256 y congela una pregunta concreta: si el portal debe promoverse ahora a EMV pública.

SCOUT, KEEPER y VOID lo evalúan por separado. Sus señales enlazan el hash canónico del expediente, registran observaciones y riesgos, y carecen explícitamente de autoridad para cambiar estado. La primera ejecución produce disonancia útil: explorar, preservar con advertencias y no promover todavía.

Los tres nombres describen roles, no entidades. Solo serían Hypheons si más adelante existieran como procesos diferenciados, con memoria, límites y responsabilidades propias, todavía dependientes de otra entidad.

La primera ejecución reproducible se conserva en `shadow/runs/portal-507999-7187-001.run.json`; su hash del expediente corresponde a la serialización JSON canónica usada por el evaluador.

Esta ejecución demuestra el protocolo estructural del Consejo, no deliberación autónoma: las tres respuestas están definidas determinísticamente en el código. SCOUT, KEEPER y VOID todavía no investigan ni razonan como tres Hypheons independientes.

## Implementación independiente

La Prueba A fue ejecutada mediante una implementación Python independiente. Sus 31 pruebas pasaron y los dos inscription IDs seleccionados coincidieron con el oráculo reservado, cuyo compromiso SHA-256 previo también coincidió. La auditoría está en `blind/audits/proof-a-001.md` y la entrega original quedó preservada en `bitmapverse-blind-submission-a-001.zip`.

El protocolo completo se documenta en `BLIND_IMPLEMENTATION_PROTOCOL.md`. La Prueba A demostró independencia del resolver para estos fixtures; la reconstrucción desde infraestructura Ord será una Prueba B posterior y separada.

## Disciplina

Esta implementación es una convención interna experimental. No se presenta como estándar universal de Bitmap. Los fixtures históricos no se reescriben silenciosamente ante una reorganización o nueva evidencia.
