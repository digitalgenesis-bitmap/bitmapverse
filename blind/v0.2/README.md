# Paquete ciego Bitmapverse v0.2 — preparación de Prueba B1

Este directorio contiene el material que será autorizado para **Prueba B1:
reconstrucción independiente de evidencia**, sucesora de Prueba A.

**Este paquete todavía no se ha usado para ejecutar Prueba B1.** Existe
para que el contrato, los esquemas y el compromiso del oráculo queden
fijados y sellados *antes* de que cualquier implementador —incluida una
instancia futura de este mismo asistente— reciba la tarea.

## Qué cambia respecto a v0.1

El algoritmo no cambia: sigue siendo `same_sat_latest_v0.1`. Lo que cambia
es el contrato alrededor del algoritmo:

- **Separación estricta entre resultado y evidencia.** v0.1 mezclaba
  ambos en un solo objeto de salida. v0.2 define tres objetos distintos:
  `resolution_result` (estable, mínimo), `candidate_set_through_resolution_snapshot`
  (el conjunto completo de candidatos elegibles, verificable por
  separado), y `evidence_manifest` (dependiente de cuándo y cómo se
  observó la evidencia, con un invariante numérico explícito).
- **Reconstrucción independiente, no evidencia congelada.** Prueba A
  entregó fixtures ya preparados. Prueba B1 pedirá reconstruir la
  evidencia desde infraestructura compatible con Ord/OPI — este paquete
  no contiene fixtures reales, candidatos reales, IDs reales, sats reales
  ni hashes de contenido reales. Ver `PACKAGE_MANIFEST.json` y las pruebas
  de fuga en `tests/blind-v02-package.test.mjs` (fuera de este directorio,
  en la raíz del proyecto) para la verificación automática de esta regla.
- **Prueba de cadena y ancestralidad.** v0.2 exige demostrar, con
  evidencia registrada (no una afirmación booleana), que el bloque del
  snapshot de resolución es ancestro del bloque usado como tope de
  observación.
- **Canonicalización real RFC 8785 (JCS)**, no la regla propia "inspirada
  en RFC 8785" que usó la capa de conformidad de Prueba A. Ver
  `CANONICALIZATION.md` para el alcance exacto y sus límites de
  verificación en este entorno sin acceso a Internet.
- **Compromiso del oráculo con nonce de 32 bytes** y una fórmula de
  compromiso con separación de dominio explícita, en vez de un compromiso
  de hash simple sobre el archivo del oráculo.

## Qué NO contiene este paquete

- fixtures reales, candidatos reales, inscription IDs reales, sats reales,
  hashes de contenido reales;
- el resultado de Prueba A ni sus hashes canónicos;
- código de los resolutores existentes ni de la capa de conformidad de
  Prueba A;
- el oráculo reservado ni su nonce (viven fuera de este directorio y
  fuera de cualquier ZIP ciego, en una ubicación reservada no publicada
  en este paquete);
- rutas que permitan llegar directamente a una inscripción específica.

## Qué SÍ contiene

- los dos Districts bajo prueba (`507999.bitmap`, `7187.bitmap` — sus
  números ya son públicos en este repositorio, no son el secreto);
- la altura y el hash de bloque del snapshot de resolución;
- las reglas normativas de descubrimiento y resolución;
- los tres esquemas estables;
- la especificación de canonicalización y sus vectores sintéticos;
- el compromiso opaco del oráculo (solo su hash);
- un caso sintético completo, sin IDs reales, que demuestra el invariante
  `observed = eligible + excluded`.

## Estado

Preparación completa. Prueba B1 **no se ha ejecutado**. Este README, junto
con `TASK.md`, será lo primero que lea cualquier implementador cuando
Prueba B1 se autorice explícitamente.
