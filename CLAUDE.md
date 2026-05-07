# Contexto del proyecto

## Objetivo del sistema

Construir un pipeline basado únicamente en IA que convierta planes de estudio en PDFs a JSON válidos para la web, sin depender de adapters, parsers intermedios ni postprocesamiento externo.
La IA debe generar directamente el JSON final correcto.

El parser actual NO se reemplaza y los JSON existentes NO se descartan:
- sirven como dataset de referencia
- sirven para comparar resultados
- sirven como ground truth para evaluar calidad
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
1. JSON generado por el parser actual → `web/data/` (ground truth)
2. JSON generado por el modelo LLM → `web/data/llm/`

Ambos se almacenan en carpetas distintas para comparar estructura, detectar diferencias, evaluar precisión, ajustar prompts y probar distintos modelos.

## Objetivo de investigación

Optimizar prompts, estructura de instrucciones, ejemplos few-shot, formato del contexto, chunking del PDF, modelos LLM, temperatura y estrategias de extracción, hasta encontrar una configuración suficientemente robusta para generalizar a PDFs arbitrarios.

## Qué debe hacer el agente

El agente debe actuar como un sistema de investigación y evaluación automática:
- probar distintos prompts y modelos
- generar JSONs y comparar outputs
- detectar errores frecuentes e identificar campos problemáticos
- sugerir mejoras de prompt
- medir similitud contra ground truth
- registrar métricas de calidad

## Métricas importantes

Evaluar: validez JSON, cumplimiento del schema, materias faltantes, correlativas incorrectas, pérdida de información, errores de estructura, normalización de nombres y consistencia general.

## Arquitectura conceptual

```
PDF → extracción de texto → LLM → JSON final → validación → persistencia
```

NO: `PDF → LLM → adapter → parser → fixups`

## Estado actual (mayo 2026)

- **Modelo principal**: `gemini-2.5-flash` (prompt v8, temperatura 0)
- **Modelos alternativos probados**: `gemma-4-31b-it`, `gemini-2.5-flash-lite`, `gemma-4-26b-a4b-it`
- **JSONs LLM generados**: 8/8 carreras en `web/data/llm/`
- **Score promedio vs ground truth**: 93.4/100
- **Problema sistemático conocido**: año/cuatrimestre de optativas cuando el agrupador no tiene año explícito en el PDF (afecta principalmente abogacia y lic_computacion)
- **Script de evaluación**: `python -m scripts.comparar_json <ref.json> <candidato.json>`

## Prioridad actual

Prioridad máxima: mejorar la calidad del prompting y elegir el mejor modelo.
NO optimizar parsers ni adapters.

## Idea futura

Dataset incremental: cada nuevo plan correcto se convierte en otro ejemplo de entrenamiento/few-shot. Mientras más PDFs procese el sistema, mejor deberían funcionar los prompts.
