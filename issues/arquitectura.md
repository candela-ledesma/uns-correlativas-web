# Issues — Arquitectura

Score v22: ~30/100 (estimado) | Score v24: 83/100 | Score v25: 85.4/100

## Problema principal: I2201 leído como 12201 (persistente)

Gemini confunde la letra `I` con el dígito `1` en el ID `I2201`.
Persiste en v24 a pesar de la instrucción reforzada — afecta 31 materias en correlativas.

| Issue | Gemini v24 | Parser |
|---|---|---|
| I2201 en correlativas (31 materias) | ❌ `12201` | ✅ `I2201` |
| I2201 en materias[] | ✅ Presente | ✅ Presente |
| I2201 en agrupadores[] | ✅ Presente | ✅ Presente |
| 3820 correlativas | ❌ Distintas (page break) | ✅ 5488, 5489 |
| 3892 correlativas | ❌ Extra `12201` | ✅ Sin I2201 |
| Materia 858 extra | ❌ Generada (no en ref) | — |
| plan.carrera / universidad | ✅ Correcto | ✅ Correcto |
| Nombres (51 comunes) | ✅ 49/49 correctos | ✅ |
| Agrupadores | ✅ 2/2 | ✅ 2/2 |

## Issues pendientes

- `I2201 → 12201`: el modelo lo corrige en `materias[]` y `agrupadores[]` pero no en las correlativas de otras materias. Necesita ejemplo few-shot explícito o post-procesamiento.
- `3820`: page break — las correlativas de la segunda aparición se mezclan con las de la primera.
- `858`: materia extra generada (posiblemente leída del PDF pero no está en el ground truth).
