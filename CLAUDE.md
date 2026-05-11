# Contexto del proyecto

## Objetivo del sistema

Construir un pipeline basado únicamente en IA que convierta planes de estudio en PDFs a JSON válidos para la web, sin depender de adapters, parsers intermedios ni postprocesamiento externo.
La IA debe generar directamente el JSON final correcto.

El parser actual NO se reemplaza y los JSON existentes NO se descartan:
- sirven como dataset de referencia (ground truth)
- sirven para comparar resultados contra el output de Gemini
- sirven para evaluar calidad del prompting
- y eventualmente servirán para mejorar prompts/modelos

## Objetivo final del producto

Permitir que un administrador:
1. Suba un PDF desde la web
2. La IA procese el documento
3. La IA genere directamente un JSON válido
4. El plan quede agregado automáticamente al sistema

Idealmente sin intervención manual, sin adapters, sin correcciones posteriores, y compatible con planes de cualquier universidad, no solo UNS.

## Restricciones importantes

- NO usar adapters para corregir JSON
- NO usar código externo para "arreglar" outputs de IA
- El JSON debe salir correcto desde el modelo
- El parser actual se mantiene intacto
- Los JSON actuales generados manualmente/parser siguen existiendo como referencia

## Estrategia actual

Se generan dos outputs separados:
1. JSON generado por el parser local (Python) → `web/data/` (ground truth)
2. JSON generado por Gemini → visualizado en el panel admin para comparar

El admin puede comparar ambos side by side, validar el resultado elegido, y publicarlo.

## Input al modelo: PDF nativo (visión)

El PDF se envía directamente a Gemini como `inlineData` (base64, mimeType `application/pdf`).
Gemini lo procesa con visión nativa — lee la estructura visual del documento, no texto plano extraído.

**Esto cambia la estrategia de prompting:**
- Ya no hay ruido de OCR ni texto fragmentado
- No se necesita describir el formato del texto fuente (antes: `<id> Cursada Aprobada`)
- El modelo puede inferir año/cuatrimestre del layout visual (encabezados de sección, tablas)
- Las instrucciones deben referenciar la estructura visual del PDF, no el texto plano
- El prompt debe ser más declarativo (qué extraer y cómo mapearlo) en lugar de instructivo (cómo parsear texto roto)

**Lo que NO cambia:**
- El schema JSON de salida (idéntico)
- Las reglas de agrupadores (POSITION A/B, idioma_grupo, agrupador_requisito)
- Temperatura 0
- "Return ONLY valid JSON, no markdown, no explanations"

## Objetivo de investigación

Optimizar prompts para visión nativa: estructura de instrucciones, ejemplos few-shot, formato del contexto, modelos, temperatura y estrategias de extracción, hasta encontrar una configuración suficientemente robusta para generalizar a PDFs arbitrarios.

## Qué debe hacer el agente

El agente debe actuar como un sistema de investigación y evaluación automática:
- probar distintos prompts y modelos
- generar JSONs y comparar outputs contra ground truth
- detectar errores frecuentes e identificar campos problemáticos
- sugerir mejoras de prompt
- medir similitud contra ground truth
- registrar métricas de calidad

## Métricas importantes

Evaluar: validez JSON, cumplimiento del schema, materias faltantes, correlativas incorrectas, pérdida de información, errores de estructura, normalización de nombres y consistencia general.

## Arquitectura conceptual

```
PDF → Gemini (visión nativa) → JSON final → validación → persistencia
```

NO: `PDF → extracción de texto → LLM → adapter → fixups`

## Estado actual (mayo 2026)

- **Modelo principal**: `gemini-2.5-flash` (prompt v15, temperatura 0)
- **Input**: PDF directo como `inlineData` (visión nativa, sin extracción de texto previa)
- **Modelos alternativos disponibles**: `gemini-2.5-flash-lite`, `gemini-2.5-pro`, `gemma-4-26b-a4b-it`
- **Script de evaluación**: `python -m scripts.comparar_json <ref.json> <candidato.json>`
- **Panel admin**: `localhost:3000/admin` — sube PDF, corre parser local y/o Gemini en paralelo, compara side by side, publica

## Prompt actual (v15)

Ubicación: `web/app/api/admin/planes/parsear/route.ts` — constante `SYSTEM_PROMPT`.

El prompt v15 fue diseñado originalmente para RAW_TEXT y tiene instrucciones de parseo de texto que ya no aplican con visión nativa. **Necesita ser reescrito** para aprovechar que Gemini ve el PDF visualmente:

- Eliminar referencias a `RAW_TEXT`, `OCR issues`, `broken formatting`
- Eliminar la sección `RAW_TEXT correlativas format` (formato `<id> Cursada Aprobada`)
- Reemplazar por instrucciones visuales: "en la tabla de correlativas, la primera columna es para_cursar y la segunda es para_rendir"
- Mantener todas las reglas de agrupadores (POSITION A/B, idioma_grupo) — siguen siendo válidas
- Mantener el schema de salida exacto

## Problema pendiente conocido

`agrupador_requisito` (G####) e `idioma` (I####) que el modelo pone en `agrupadores[]` pero omite en `materias[]`, a pesar de ser requeridos ahí cuando aparecen en POSITION A. El modelo aplica la regla "no duplicar" incorrectamente en estos casos.

## Prioridad actual

Prioridad máxima: reescribir el prompt para visión nativa y medir el impacto en los scores.
NO optimizar parsers ni adapters.

## Idea futura

Dataset incremental: cada nuevo plan correcto se convierte en otro ejemplo de entrenamiento/few-shot. Mientras más PDFs procese el sistema, mejor deberían funcionar los prompts.
