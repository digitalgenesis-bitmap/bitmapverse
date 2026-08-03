# Contrato ciego `same_sat_latest_v0.1`

Estado: experimental  
Prueba: independencia del resolver sobre evidencia congelada

## Hipótesis

Dados un District Bitmap original, el sat de esa inscripción, el conjunto completo de inscripciones observadas sobre el mismo sat y un snapshot Bitcoin, dos implementaciones independientes deben seleccionar la misma inscripción mediante este contrato.

## Orden canónico

La entrada nunca se considera ordenada. Los candidatos elegibles son aquellos cuya `block_height` no excede `snapshot_height`. Se ordenan ascendentemente por:

1. `block_height`;
2. `transaction_index`;
3. `inscription_index`.

La inscripción seleccionada es la última tupla elegible. Si solamente existe la original, se selecciona la original.

## Validaciones obligatorias

La implementación debe rechazar el fixture si:

- el schema, versión, estado, alcance o resolver no coinciden con v0.1;
- el nombre del District no coincide con `<district>.bitmap`;
- el snapshot, el sat o un hash tienen formato inválido;
- no existe ningún candidato;
- falta la inscripción original o su contenido declarado no coincide con el District;
- un candidato pertenece a otro sat;
- un inscription ID no coincide con su `transaction_id` e `inscription_index`;
- falta una posición canónica o contiene enteros negativos;
- dos candidatos comparten la misma tupla canónica;
- un candidato situado en `snapshot_height` declara otro `block_hash`;
- falta un `content_sha256` válido;
- la enumeración no declara estar completa, contiene más páginas, tiene un hash incorrecto o no coincide exactamente con los candidatos;
- el manifiesto Ord no referencia el mismo hash de enumeración;
- la consulta OPI no corresponde al District o su manifiesto es inconsistente.

## Salida mínima

Por cada fixture válido, producir JSON con:

- `district`;
- `original_inscription_id`;
- `sat`;
- `selected_inscription_id`;
- `selected_content_sha256`;
- `selected_canonical_position`;
- `snapshot_height`;
- `snapshot_block_hash`;
- `candidate_count`;
- `status: experimental`;
- `scope: convención interna de Bitmapverse v0.1`;
- advertencias y procedencia preservadas desde la entrada.

## Restricciones del experimento

- Usar Python y únicamente su biblioteca estándar.
- No consultar Internet durante la Prueba A.
- No consultar ninguna implementación previa ni sus pruebas.
- Registrar toda ambigüedad encontrada antes de entregar los resultados.
- No afirmar que esta regla sea un estándar universal de Bitmap.

Este paquete prueba independencia del resolver. No prueba reconstrucción independiente de la evidencia desde infraestructura Ord viva.
