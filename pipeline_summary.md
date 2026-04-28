# Pipeline Summary — UNS Correlativas Parser

## Estado global por carrera

| Carrera | Versión | Estado | Materias | Agrupadores | Blocking | Warnings | Notas |
|---|---|---|---|---|---|---|---|
| arquitectura | v2 | ✅ OK | 52 | 2 | 0 | 11 | EMPTY_HOURS (10), OPTIONAL_SUBTYPE_MISSING (1) |
| lic_computacion | v1 | ⚠️ WARNING | 75 | 3 | 0 | 97 | LEGACY_GROUP_CROSS_REFERENCE (45), EMPTY_HOURS (50) |
| bioquimica | v1 | ✅ OK | 48 | 2 | 0 | 10 | EMPTY_HOURS (9), OPTIONAL_SUBTYPE_MISSING (1) |
| ing_civil | v1 | ⚠️ WARNING | 71 | 7 | 0 | 75 | LEGACY_GROUP_CROSS_REFERENCE (58), EMPTY_HOURS (11) |
| abogacia | v1 | ⚠️ WARNING | 101 | 5 | 0 | 159 | LEGACY_GROUP_CROSS_REFERENCE (150), EMPTY_HOURS (9); 5 colisiones ID resueltas por fix |
| agrimensura | v1 | ✅ OK | 35 | 0 | 0 | 2 | EMPTY_HOURS (2); correlativa 5175 inferida en prosa para 5464 |
| farmacia | v1 | ✅ OK | 40 | 2 | 0 | 3 | EMPTY_HOURS (3); 2 colisiones ID resueltas por fix |
| contador_publico | v1 | ✅ OK | 51 | 1 | 0 | 10 | EMPTY_HOURS (10); 1 colisión ID resuelta por fix |

**Total materias:** 473 | **Total agrupadores:** 22 | **Blocking issues:** 0

---

## Bugs corregidos

### Ronda 1 — 2026-04-28
| Bug | Fix | Carreras afectadas | Estado |
|---|---|---|---|
| Caso 3 — nombres de materias partidos en dos líneas (uppercase continuación) | `cleaner.py: recomponer_lineas_partidas` | agrimensura, potencialmente todas | ✅ Resuelto |
| Colisión ID entre materias[] y agrupadores[] | `parser_plan.py`: guarda en inserción + `contract_validator.py`: WARNING | abogacia, farmacia, contador_publico | ✅ Resuelto |
| Correlativas en prosa libre (ej: "Para aprobar... 5175 Aprobada") | `correlativa_prosa.py` + fallback en `parser_plan.py` | agrimensura (5464) | ✅ Resuelto |

### Ronda 2 — 2026-04-28
| Bug | Fix | Carreras afectadas | Estado |
|---|---|---|---|
| Caso 3 absorbía líneas de correlativas en prosa como continuación de nombre (ej: "Para aprobar Debe rendir..." pegado al nombre de materia) | `cleaner.py`: `PATRON_INICIO_CORRELATIVA_PROSA` — guarda por palabras clave al inicio de línea (`Para`, `Haber`, `Tener`, `Aprobar`, `Cursar`, `Debe`, `Deberá`) | contador_publico (visible), agrimensura (5464 corregido como efecto secundario) | ✅ Resuelto |

---

## Warnings pendientes conocidos

| Código | Descripción | Carreras | Acción sugerida |
|---|---|---|---|
| `LEGACY_GROUP_CROSS_REFERENCE` | Materias en opciones[] del agrupador no apuntan de vuelta con `grupo_opcion` | abogacia (150), ing_civil (58), lic_computacion (45) | Fix en parser: asignar `grupo_opcion` correcto al parsear optativas |
| `EMPTY_HOURS` | Carga horaria vacía en materia | Todas las carreras | El PDF no siempre tiene horas; aceptable como low |
| `OPTIONAL_SUBTYPE_MISSING` | Subtipo vacío en materia no estándar | arquitectura, lic_computacion, bioquimica, ing_civil | Bajo impacto; requiere clasificador de subtipos |

---

## Historial de regeneraciones

| Fecha | Carreras regeneradas | Motivo |
|---|---|---|
| 2026-04-28 | abogacia, agrimensura, farmacia, contador_publico | Primera generación + fixes ronda 1: Caso 3 cleaner, colisión ID, correlativas en prosa |
| 2026-04-28 | contador_publico | Fix ronda 2: guarda Caso 3 por palabras clave en inicio de línea |
