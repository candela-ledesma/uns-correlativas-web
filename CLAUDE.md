# Tarea: Rediseño del flujo de administración de planes de estudio

## Contexto
Existe un sistema que convierte PDFs de planes de estudio a JSON.
Actualmente hay dos pipelines separados: un parser local y Gemini.
El panel admin vive en `localhost:3000/admin`.

## Nuevo objetivo
El admin debe poder:
1. Subir un PDF y elegir cómo procesarlo (parser local, Gemini, o ambos en paralelo)
2. Ver y comparar los resultados lado a lado
3. Elegir cuál JSON publicar (o editarlo antes de publicar)
4. Validar el JSON antes de publicar
5. Si el plan ya existe en la web, decidir si reemplazarlo o fusionarlo

## Cambios concretos a implementar

### 1. Flujo de subida
- Input: PDF + selector de método (Local / Gemini / Ambos)
- Si elige "Ambos": procesa en paralelo y va directo a la vista de comparación
- Si elige uno solo: muestra resultado y permite editarlo antes de publicar

### 2. Selector de modelo Gemini
- Mostrar lista de modelos disponibles con la free API
  (gemini-2.5-flash, gemini-2.5-flash-lite, gemma-4-31b-it, gemma-4-26b-a4b-it)
- Para cada modelo mostrar:
  - requests restantes / límite diario
  - si está disponible ahora o en cooldown
- Si un modelo no tiene requests disponibles, deshabilitarlo visualmente

### 3. Vista de comparación
- Panel lado a lado: JSON parser local vs JSON Gemini
- Diferencias resaltadas visualmente (usar el comparador existente
  `python -m scripts.comparar_json`)
- Score de similitud visible
- Botón "Usar este" en cada panel
- Botón "Editar antes de publicar" en cada panel

### 4. Validación antes de publicar
- Correr las mismas validaciones que ya existen en el panel:
  campos del plan, IDs únicos, año asignado, correlativas válidas, agrupadores
- Agregar: validación de schema completo
- El JSON no se puede publicar si falla validación (mostrar errores específicos)
- Advertencia (no bloqueo) si el score vs ground truth baja de 90

### 5. Detección de plan existente
- Antes de publicar, verificar si ya existe un plan con mismo
  codigo_plan + universidad en `web/data/`
- Si existe: mostrar modal con tres opciones:
  - Reemplazar (sobreescribe el JSON actual)
  - Cancelar
- Mostrar diff entre el JSON actual publicado y el nuevo antes de confirmar

## Restricciones que NO cambian
- No usar adapters para corregir JSON
- El parser local se mantiene intacto
- Los JSON en `web/data/` siguen siendo ground truth
- Los JSON de LLM van a `web/data/llm/`
- NO hay postprocesamiento automático: el admin elige y confirma todo

## Criterio de done
- Un admin puede subir un PDF, comparar parser vs Gemini, ver diferencias,
  validar el resultado elegido, y publicarlo (o reemplazar uno existente)
  sin tocar código ni terminal
- Los rate limits de Gemini son visibles antes de elegir el modelo
- Ningún JSON inválido puede llegar a producción sin confirmación explícita