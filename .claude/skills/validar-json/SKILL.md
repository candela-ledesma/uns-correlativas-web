---
name: validar-json
description: Valida JSONs generados desde PDFs UNS comparando estructura, correlativas, agrupadores, orientaciones y ground_truth.
---

Cuando el usuario pida validar JSONs de planes UNS:

1. Revisar `web/data/`.
2. Revisar si existe `ground_truth/`.
3. Ejecutar validadores existentes si los hay.
4. Si no existen, proponer `scripts/validate_plan_json.py`.
5. Validar:
   - estructura
   - IDs duplicados
   - correlativas inexistentes
   - agrupadores inválidos
   - conteos esperados
   - orientaciones mezcladas
6. Devolver resultado por carrera:
   - OK
   - WARNING
   - ERROR

No modificar el parser en esta skill.