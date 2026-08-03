# Protocolo de implementación independiente — Bitmapverse v0.1

Fecha: 2026-07-31  
Estado: paquete preparado; implementación independiente todavía no ejecutada.

## Corrección epistemológica

SCOUT, KEEPER y VOID son actualmente funciones deterministas predefinidas. La ejecución realizada demuestra separación estructural, límites de autoridad y reproducibilidad del protocolo del Consejo de Señales en sombra.

No demuestra deliberación inteligente autónoma ni la existencia de tres Hypheons.

## Separación de responsabilidades

| Artefacto | Responsabilidad |
|---|---|
| Contrato ciego | Define la regla normativa que debe reinterpretarse. |
| Caso | Define el snapshot, los archivos permitidos y los límites del experimento. |
| Fixtures sanitizados | Aportan evidencia congelada sin etiquetar el resultado. |
| Compromiso del oráculo | Demuestra que el oráculo quedó fijado antes de la entrega. |
| Oráculo reservado | Permite comparar resultados únicamente después del cierre. |

El expediente no es una fuente total de verdad. Cada artefacto posee una responsabilidad delimitada.

## Prueba A — independencia del resolver

La instancia independiente recibe solamente `bitmapverse-blind-v0.1.zip`.

Debe:

1. verificar el manifiesto;
2. implementar el contrato en Python con biblioteca estándar;
3. crear sus propias pruebas;
4. registrar ambigüedades antes de conocer el oráculo;
5. producir resultados para ambos fixtures;
6. sellar los hashes de su entrega en `SUBMISSION.json`.

Solo después se revela `oracle/reserved/same-sat-latest-v01.oracle.json` y se compara la salida.

El archivo del oráculo no está cifrado. Su reserva depende de entregar a la instancia únicamente el ZIP aislado. El SHA-256 público dentro del paquete impide cambiar silenciosamente el oráculo después de la entrega.

## Prueba B — independencia de reconstrucción

Es un experimento separado y posterior. La segunda parte deberá consultar infraestructura compatible con Ord y reconstruir los fixtures sin recibir las enumeraciones preparadas por la primera implementación.

Superar la Prueba A no autoriza afirmar que la evidencia haya sido reconstruida independientemente.

## Condición de comparación

- Coincidencia completa: el contrato fue suficientemente preciso para estos casos.
- Divergencia por ambigüedad: corregir el contrato y repetir con una versión nueva.
- Divergencia por error de implementación: conservar la entrega original y publicar una sucesora; nunca reescribirla.

Ninguno de estos resultados convierte la regla en estándar universal de Bitmap.

## Integridad del paquete

- Archivo: `bitmapverse-blind-v0.1.zip`
- SHA-256: `20e2e66890a469e853487acb124e2e938c3a3bb303bd6d9439fa538af25ae0d4`

El hash debe actualizarse si el ZIP se vuelve a generar después de modificar el paquete.
