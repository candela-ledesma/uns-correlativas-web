# Issues — Bioquímica

**Score actual (v28):** 90.8/100

| Issue | Gemini | Parser | Estado |
|---|---|---|---|
| `plan.carrera` casing | ❌ `"Bioquímica"` (con tilde) | ✅ `"Bioquimica"` | Abierto — cosmético |
| `1003`, `1211`, `1441` faltantes | ❌ ausentes | ✅ presentes (Quinto Año / 2do cuatrimestre) | Abierto — Gemini omite 3 materias del 5to año |
| Optativas año (16 materias) | ❌ `"Cuarto Año"` | ✅ `"Sexto Año"` | Abierto — Gemini asigna el año del agrupador G0654 en lugar del año visual del PDF |
| `I0654` año/cuatrimestre | ❌ Cuarto / 1er | ✅ Tercer / 2do | Resuelto en v28 ✅ |
| `G0654` año agrupador | ❌ Quinto / 1er | ✅ Cuarto / 2do | Resuelto en v28 ✅ |
| `1355` `requisito_especial` | ✅ detectado | ❌ faltaba | Resuelto — parser actualizado ✅ |
| `1355` `para_cursar`/`para_rendir` | ❌ invertido | ✅ correcto | Resuelto ✅ |
| `4527` nombre acento | ❌ con acento | ✅ sin acento | Resuelto ✅ |

**Problema principal abierto:** Gemini asigna a las optativas (G0654) el `año` del agrupador (`"Cuarto Año"`) en lugar del año visual en el PDF donde aparecen (`"Sexto Año"`). Afecta 16 materias. También omite `1003`, `1211` y `1441` del Quinto Año.
