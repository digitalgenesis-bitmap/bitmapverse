# Contrato Bitmapverse v0.1

Estado: experimental  
Fecha: 2026-07-29  
Responsable público: The Source Revelator  
Regla implementada: `same_sat_latest_v0.1`

## 1. Hipótesis mínima

Dados:

- un District Bitmap original resuelto mediante una implementación compatible de OPI;
- el satoshi asignado a esa inscripción;
- el conjunto completo de inscripciones observadas sobre ese mismo satoshi;
- una altura y un hash de bloque congelados;

dos implementaciones independientes deben seleccionar la misma inscripción vigente hasta ese snapshot.

Bitmapverse v0.1 no afirma que esta regla sea el estándar universal de Bitmap. Es una convención interna, versionada y refutable.

## 2. Resultado esperado

La regla devuelve:

- el District consultado;
- la inscripción original;
- el satoshi compartido;
- la inscripción seleccionada;
- la posición canónica utilizada;
- el snapshot aplicado;
- la procedencia de la evidencia;
- advertencias que impidan confundir resolución con seguridad, autoridad o vigencia posterior.

Si solo existe la inscripción original dentro del snapshot, devuelve la original.

## 3. Snapshot canónico

Cada fixture declara obligatoriamente:

- `snapshot_height`;
- `snapshot_block_hash`.
- `candidate_enumeration`, incluido el cuerpo de respuesta congelado y su SHA-256;
- `source_manifest`, con la implementación, versión o commit y estado de cada fuente;
- `content_sha256` para cada candidato.

El hash identifica el bloque exacto observado en esa altura. Antes de resolver, una implementación conectada debe comprobar que ese hash continúa siendo canónico.

Si una reorganización sustituye ese bloque:

- el fixture histórico no se reescribe silenciosamente;
- la resolución devuelve una advertencia de snapshot no canónico;
- un snapshot sucesor debe publicarse como evidencia nueva.

Esta implementación pura opera sobre evidencia ya congelada. La comprobación contra una cadena viva pertenece al adaptador de infraestructura, no al núcleo determinista.

## 4. Orden canónico

“Latest” nunca depende del orden de una respuesta de API.

Las inscripciones elegibles se ordenan ascendentemente mediante la tupla:

1. `block_height`;
2. `transaction_index`;
3. `inscription_index`.

Definiciones:

- `block_height`: altura del bloque que contiene la transacción reveal;
- `transaction_index`: posición cero-basada de esa transacción dentro del bloque Bitcoin;
- `inscription_index`: sufijo `iN` del inscription ID, que identifica la inscripción dentro de la transacción.

La inscripción vigente es la última tupla que no exceda `snapshot_height`.

Un fixture es inválido si:

- omite cualquiera de esos tres componentes;
- contiene dos candidatos con la misma posición;
- contiene una inscripción cuyo sat no coincide con el sat declarado;
- no incluye la inscripción original;
- declara como original una inscripción distinta de la encontrada por su ID.
- su lista no coincide exactamente con la enumeración congelada;
- la enumeración declara páginas adicionales;
- el cuerpo de enumeración no coincide con su SHA-256;
- un candidato situado en `snapshot_height` declara otro hash de bloque.

`complete_through_snapshot` significa que la fuente de enumeración reportó el conjunto completo observado hasta el corte. No demuestra por sí solo que el proveedor carezca de errores; la segunda implementación ciega deberá reconstruir y contrastar esa igualdad.

## 5. Algoritmo `same_sat_latest_v0.1`

1. Leer el District original previamente descubierto mediante OPI.
2. Verificar que el contenido declarado del original coincide con `<district>.bitmap`.
3. Identificar el sat de esa inscripción.
4. Reunir todas las inscripciones asignadas al mismo sat hasta el snapshot.
5. Validar sus posiciones canónicas.
6. Ordenarlas por la tupla canónica.
7. Seleccionar la última.
8. Si solo existe la original, seleccionar la original.
9. Entregar resultado, evidencia, procedencia y advertencias.

## 6. Límites de v0.1

Quedan expresamente fuera:

- children alojados en otros sats;
- delegates;
- Names.bitmap y su vínculo con Districts;
- interpretación de Bitmap Metadata;
- portales universales;
- relaciones inferidas;
- resolución posterior al snapshot;
- disputas entre reglas alternativas;
- autoridad actual, firmas del controlador o seguridad del contenido;
- ejecución de código de terceros dentro de un contexto privilegiado.

La pregunta sobre Names.bitmap permanece abierta y no bloquea esta implementación.

## 7. Casos iniciales

### Freedeon — `507999.bitmap`

Debe resolver desde la inscripción original del District hacia la reinscripción HTML confirmada de Freedeon.

Esto demuestra publicación territorial on-chain de un artefacto HTML autocontenido. No demuestra autonomía, cognición, continuidad de ejecución ni soberanía ontológica.

### Organa — `7187.bitmap`

Debe resolver desde la inscripción original hacia la segunda reinscripción Organa observada hasta el snapshot.

Esto demuestra un linaje de reinscripciones sobre el mismo sat. No adopta las afirmaciones de Organa sobre ejecución privada, agentes u organización autónoma.

## 8. Criterios de refutación

La hipótesis mínima falla si:

- dos clientes honestos, con los mismos fixtures y esta versión del contrato, seleccionan IDs diferentes;
- el resultado cambia al reordenar los candidatos de entrada;
- una inscripción posterior al snapshot altera el resultado;
- se acepta un candidato de otro sat;
- el resultado no muestra suficiente evidencia para repetir la selección;
- la implementación presenta esta convención interna como estándar universal.

## 9. Terminología

- **EMV — Experiencia Mínima Verificable:** experiencia más pequeña que permite observar, repetir y refutar la afirmación central.
- **Autocontenido:** contiene su aplicación, aunque puede consultar infraestructura Ord compatible.
- **Reproducible:** otra implementación obtiene el mismo resultado desde la misma evidencia.
- **Experimental:** convención interna versionada; no estándar universal.
- **Histórico:** una declaración anterior permanece registrada aunque una sucesora la reemplace.

## 10. Secuencia de construcción

1. Portal experimental privado de ida y vuelta entre Freedeon y Organa.
2. Consejo de Señales en sombra.
3. Segunda implementación ciega de la regla y reconstrucción de fixtures.
4. Solo si ambas implementaciones coinciden, promoción del portal a **EMV pública**.

La interfaz puede construirse y probarse antes de la implementación ciega, pero no debe recibir todavía el nombre de Experiencia Mínima Verificable. El portal será una interfaz sobre evidencia; no será un estándar de interconexión entre todos los Bitmap.

## 11. Consejo de Señales en sombra v0.1

El Consejo recibe un expediente estructurado que referencia —sin duplicarlos— los fixtures congelados de `507999.bitmap` y `7187.bitmap` mediante sus hashes SHA-256.

Tres roles evalúan el mismo expediente sin leer las respuestas de sus pares:

- **SCOUT:** busca posibilidades y propone continuar el experimento;
- **KEEPER:** protege memoria, procedencia y reversibilidad;
- **VOID:** intenta refutar la promoción y explicita evidencia faltante.

Estas funciones son roles. No son automáticamente EONs ni Hypheons.

El Consejo opera exclusivamente en sombra:

- no autoriza transiciones;
- no modifica estado;
- no mueve fondos;
- no establece verdad;
- no convierte el portal en EMV;
- no resuelve conflictos entre reglas alternativas.

La salida deliberadamente disonante es información: v0.1 debe conservar las tres señales, no reducirlas por mayoría ni fingir consenso.
