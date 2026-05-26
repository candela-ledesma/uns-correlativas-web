# Issues — Ingeniería Civil

Score v22: 23/100 | Score v23: 21/100

## Diagnóstico: fallo estructural, no de prompt

El PDF tiene 3 orientaciones (Construcciones, Hidráulica, Vías de Comunicación) que repiten los mismos IDs en secciones separadas. Gemini no colapsa los duplicados a pesar de la instrucción explícita en v23 — produce 15 IDs duplicados y sigue desacoplando nombres de IDs. El prompt no puede resolver este caso: es un límite de la lectura visual del modelo sobre este layout específico.

**v23 vs v22:** el score bajó (21 < 23), se perdieron 2 materias más (`3057`, `5014`), y los 15 IDs duplicados persisten.

## Problema principal: IDs desacoplados de nombres

Gemini extrajo solo 30 de 65 materias (v22) / 26 (v23) y asignó nombres incorrectos a casi todos los IDs comunes.
Los nombres están corridos respecto a los IDs — el modelo lee la tabla desalineado entre columnas de ID y nombre.

| Issue | Gemini | Parser |
|---|---|---|
| Cobertura de materias | ❌ 30/65 (46%) | ✅ 65/65 |
| IDs sin correspondencia en ref | ❌ 513, 5170, 6304 | — |
| Nombres correctos (de 27 comunes) | ❌ 2/27 | ✅ 27/27 |
| IDs con nombre corrido (ejemplos) | ❌ 3051→"DISEÑO E INNOVACION", 5539→"SISTEMAS DE RE" | ✅ 3051→"FISICA I", 5539→"ALGEBRA Y GEOMETRIA" |
| Años correctos (de 27 comunes) | ❌ 8/27 | ✅ 27/27 |
| Correlativas perfectas (de 27 comunes) | ❌ 3/27 | ✅ 27/27 |
| I0012 (idioma) reconocido | ❌ Ausente | ✅ Presente |
| `10012` en lugar de `I0012` | ❌ Registrado como `10012` | ✅ `I0012` |
| plan.carrera casing | ❌ "Ingeniería Civil" (con tilde) | ✅ "Ingenieria Civil" |
| Agrupadores | ❌ 6/7 | ✅ 7/7 |

## Materias completamente ausentes en Gemini (38)

`1709`, `2710`, `5005`, `5008`, `5009`, `5012`, `5013`, `5041`, `5042`, `5065`,
`5080`, `5085`, `5114`, `5115`, `5122`, `5148`, `5180`, `5181`, `5189`, `5220`,
`5225`, `5229`, `5270`, `5293`, `5320`, `5335`, `5340`, `5341`, `5360`, `5362`,
`5405`, `5411`, `5412`, `5424`, `5467`, `5475`, `7887`, `I0012`
