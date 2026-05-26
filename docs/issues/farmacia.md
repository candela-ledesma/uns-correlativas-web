# Issues — Farmacia (Plan 2025 - Versión 1)

## Errores persistentes en Gemini (prompt v32–v37, irresolubles con prompting)

Causa raíz común: **salto de página** — el PDF termina la página 1 con `1142 FISIOPATOLOGIA HUMANA 100hs. 1149 Cursada Cursada` y la página 2 abre con `1376 Aprobada Aprobada` (correlativa de continuación de 1142). Gemini cierra 1142 al ver el encabezado de tabla repetido al inicio de la nueva página y asigna `1376` a 1228 que viene justo después.

| Materia | Issue | Gemini | Parser |
|---|---|---|---|
| 1142 FISIOPATOLOGIA HUMANA | Omite correlativa 1376 (page break) | ❌ Solo 1149 | ✅ 1149 + 1376 |
| 1228 HIGIENE Y SANIDAD | Correlativa errónea 1376 (page break spill) | ❌ 1376 | ✅ 1291 |

**Solución recomendada:** post-proceso en el servidor que detecte este patrón de boundary cross-page.

## Errores corregidos en versiones anteriores del prompt

| Issue | Estado |
|---|---|
| I0902 escrito como 10902 | ✅ Corregido (corregirIdsIdioma + cross-check) |
| 6018 / 1116 / 1055 omiten I0902 como correlativa | ✅ Corregido |
| G0903 Año/Cuatrimestre incorrecto | ✅ Corregido |
| I0902 año de materias asociadas incorrecto | ✅ Corregido |
| Case sensitivity (MAYÚSCULAS → Title Case) | ✅ Corregido |

## Otros errores observados (prompt v32)

| Materia | Issue | Gemini | Parser |
|---|---|---|---|
| 6008 FISICOQUIMICA F | 8161 para_cursar null en vez de aprobada | ❌ null/aprobada | ✅ aprobada/aprobada |
| 4525 BIOÉTICA | Correlativas de 6023 asignadas a 4525 | ❌ 6008+6156 | ✅ {} |
| 6023 ANALISIS ESPECTROSCOPICO | Sin correlativas (se las llevó 4525) | ❌ {} | ✅ 6008+6156 |
| I0902 materia | Correlativas erróneas asignadas | ❌ 1291+1376 | ✅ {} |
| 1115 FARMACIA ASISTENCIAL | 1130 para_rendir cursada en vez de aprobada | ❌ aprobada/cursada | ✅ aprobada/aprobada |
