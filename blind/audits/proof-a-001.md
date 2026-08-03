# Auditoría de la Prueba A — `same_sat_latest_v0.1`

Fecha de comparación: 2026-07-31  
Estado: **APROBADA para la selección central en los dos fixtures congelados**

## Cadena de custodia

- Paquete entregado: `bitmapverse-blind-v0.1.zip`
- SHA-256 del paquete: `20e2e66890a469e853487acb124e2e938c3a3bb303bd6d9439fa538af25ae0d4`
- Cierre independiente: `2026-07-31T15:44:40Z`
- Archivo preservado: `bitmapverse-blind-submission-a-001.zip`
- SHA-256 de la entrega preservada: `e882577e231043a0556d22a8348e4d90f607ccee188250341c1415df64ed1de3`

Los hashes de `resolver.py`, `test_resolver.py`, `AMBIGUITIES.md` y `result.json` coinciden con `SUBMISSION.json`. La entrega quedó archivada sin reescritura.

## Ejecución independiente

- Lenguaje: Python, biblioteca estándar.
- Pruebas independientes: 31 aprobadas.
- Acceso declarado: solamente el paquete autorizado; sin Internet, código previo, tests previos, ejecuciones ni oráculo.
- El código fue revisado antes de ejecutarse y no contiene acceso de red ni procesos externos.

## Revelación del oráculo

- Compromiso publicado antes de la entrega: `2db6191f46954904e51e29daac4900d475cb5fac1d2159ec5b7bda8dd9879783`
- SHA-256 del oráculo revelado: `2db6191f46954904e51e29daac4900d475cb5fac1d2159ec5b7bda8dd9879783`
- Resultado: coincidencia exacta del compromiso.

## Comparación

| Fixture | Resultado independiente | Oráculo | Estado |
|---|---|---|---|
| `507999-at-959531` | `16c5bedd987167d6d5e7a8097d2dacb22ac112eaa0d6d5b1ff030578e75f9675i0` | mismo ID | Coincide |
| `7187-at-959531` | `a40f8c3af2058c9178c758d500f16f314ef2384fcf8a28a233ceda5ec7fd698ei0` | mismo ID | Coincide |

## Qué demuestra

Para estos dos fixtures, una implementación Python construida sin consultar el resolver JavaScript seleccionó los mismos inscription IDs. La regla normativa fue suficiente para reproducir la selección central desde evidencia congelada.

La comparación comprometida por el oráculo cubría los inscription IDs seleccionados, no igualdad byte por byte del JSON completo.

## Divergencias de representación observadas

Los resultados completos no tienen todavía un formato interoperable idéntico:

- Python emite `district` como `"507999.bitmap"`; JavaScript emite `district: 507999` y añade `district_name`.
- Python utiliza `selected_canonical_position`; JavaScript utiliza `selected_position`.
- JavaScript incluye campos adicionales como `schema`, `version`, `resolver`, `excluded_after_snapshot` y `source_manifest`.
- Las advertencias no son idénticas porque el paquete sanitizó referencias semánticas y JavaScript añade una advertencia sobre canonicidad viva.

Estas diferencias no alteran la inscripción seleccionada, pero impiden afirmar que ambas implementaciones produzcan todavía el mismo objeto de salida. Antes de exigir interoperabilidad de clientes debe definirse un schema de resultado literal y versionado.

## Qué no demuestra

- Reconstrucción independiente de los fixtures desde Ord u OPI.
- Ausencia de ambigüedades en todas las salidas o casos futuros.
- Igualdad completa del formato JSON producido por ambas implementaciones.
- Canonicidad posterior al snapshot.
- Estándar universal de Bitmap.
- Seguridad, autoridad o ejecución de los contenidos seleccionados.
- Resolución de Names.bitmap o portales on-chain.

## Ambigüedades aprendidas

La implementación registró once decisiones interpretativas. Las más importantes para una futura versión contractual son:

1. declarar literalmente las constantes de schema, versión, estado, alcance y resolver;
2. definir si `district` de salida es número o `<district>.bitmap`;
3. definir el caso con candidatos presentes pero ninguno elegible;
4. especificar completamente las validaciones internas del manifiesto OPI;
5. fijar si la igualdad de enumeración es por conjunto o por secuencia;
6. declarar el orden de validaciones solamente si los códigos de error forman parte del contrato.

Ninguna de estas ambigüedades produjo divergencia en la inscripción seleccionada para los dos fixtures.

## Próximo experimento

Prueba B: reconstruir la evidencia desde infraestructura Ord compatible sin recibir los fixtures preparados. Hasta entonces, la formulación correcta es:

> Bitmapverse v0.1 superó la Prueba A de independencia del resolver sobre dos fixtures congelados.
