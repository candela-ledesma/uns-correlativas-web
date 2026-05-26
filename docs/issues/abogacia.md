# Issues — Abogacía (Plan 2020 - Versión 2)

## Errores persistentes en Gemini (prompt v32, irresolubles con prompting)

Causa raíz común: **multi-line correlativas y saltos de página** — el PDF compacta varias materias en columnas donde las correlativas de continuación (sin nombre de materia) aparecen entre dos materias distintas. Gemini cierra la materia actual demasiado pronto y asigna esas correlativas a la siguiente.

| Materia | Issue | Gemini | Parser |
|---|---|---|---|
| 9005 DERECHO CONSTITUCIONAL | Correlativas mal asignadas (4675 para_rendir cursada, 9001 aprobada en vez de cursada) | ❌ | ✅ |
| 9055 CIENCIA POLITICA | Correlativa fantasma 9004 (pertenece a 9006) | ❌ 9004 | ✅ {} |
| 9006 DERECHO DE LAS OBLIGACIONES | Omite 9004 (se la llevó 9055) | ❌ Solo 9098 | ✅ 9004 + 9098 |
| 9008 DERECHO PENAL I | Omite 9005 (se la llevó 9006) | ❌ Solo 9001 | ✅ 9001 + 9005 |
| 9110 TALLER DE NEGOCIACION | Correlativa fantasma 9005 (pertenece a 9008) | ❌ 9005 + 9105 | ✅ Solo 9105 |
| 9100 DERECHO TRIBUTARIO | Omite 9113 (page break — inicio de página 3) | ❌ 3 correlativas | ✅ 4 correlativas |

**Solución recomendada:** post-proceso en el servidor que detecte este patrón de boundary cross-page y cross-subject.

## Error de requisito_especial (prompt v32)

| Materia | Issue | Gemini | Parser |
|---|---|---|---|
| 9140 PRACTICA PROFESIONAL SUPERVISADA D | No detecta `minimo_materias_aprobadas` (30) — el texto "Para cursar Tener 30 asignaturas..." aparece mezclado con "128hs." en la misma línea | ❌ Sin requisito | ✅ min 30 |
| 9116 TALLER DE PRACTICA PROFESIONAL SUPERVISADA | Mismo problema | ❌ Sin requisito | ✅ min 30 |

## I0002 — idioma

| Issue | Gemini | Parser |
|---|---|---|
| I0002 aparece en materias[] con correlativas erróneas asignadas | ❌ Con correlativas | ✅ {} |

## Errores corregidos en versiones anteriores del prompt

| Issue | Estado |
|---|---|
| G2349 cuatrimestre incorrecto (2do → 1er) | ✅ Corregido |
| Año de optativas incorrecto | ✅ Corregido |
| `30_asignaturas_cursadas` como ID de correlativa | ✅ Corregido |
