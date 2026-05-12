# TODO

> Prioridades: `alta` — `media` — `baja`

---

## Roles de usuario

- `alta` [ ] **Agregar enum de roles en Prisma** — agregar campo `rol` al modelo
  `User` con valores `ESTUDIANTE | PROFESOR | ADMIN`. Default: `ESTUDIANTE`.
  Migrar la base de datos de desarrollo.

- `alta` [ ] **Proteger rutas por rol** — middleware que verifique rol en sesión:
  - `/admin/*` → solo ADMIN
  - rutas de carga de planes → ADMIN y PROFESOR
  - resto de la app → cualquier usuario autenticado (ESTUDIANTE+)

- `media` [ ] **Gestión de usuarios desde el panel admin** — el admin debe poder
  ver la lista de usuarios, cambiar el rol de cualquiera (ej: promover a
  PROFESOR).

- `baja` [ ] **Flujo de carga de planes para PROFESOR** — una vez que el panel
  admin de carga de PDFs esté terminado, exponer una versión simplificada
  para profesores: pueden subir y procesar un PDF, pero el JSON queda en
  estado "pendiente de aprobación" hasta que un ADMIN lo revise y publique.
  (Implementar después de cerrar el flujo core del admin)

---

## Panel admin — features pendientes (según CLAUDE.md)

- `alta` [x] **Bloquear guardado si falla validación** — hoy la validación es informativa; errores críticos deben impedir publicar
- `alta` [x] **Procesar en paralelo** — botón "Ambos" que dispara Gemini + parser local simultáneamente y va directo a la vista de comparación sin pasos manuales
- `alta` [x] **Auto-guardar JSON de Gemini en data/gemini/** — best-effort al terminar de parsear; no sobreescribe si ya existe (requiere acción explícita del usuario)
- `alta` [x] **Confirmar antes de regenerar** — si ya existe JSON para esa fuente, mostrar modal con metadatos del archivo existente antes de reemplazar
- `alta` [x] **Comparar con versión anterior** — tras regenerar, botón para ver diff side-by-side entre el resultado nuevo y el JSON que había antes
- `alta` [x] **ConfigTab — versión y fecha del prompt** — muestra versión (ej. v25) y timestamp de última modificación debajo del textarea
- `media` [ ] **Validación de schema completo** — validar el JSON contra el schema completo de PlanData, no solo IDs/años/correlativas
- `media` [x] **Selector de modelo con rate limits** — barra de progreso de RPD por modelo en el dropdown; verde/amarillo/rojo según consumo diario
- `baja` [x] **Botones ConfigTab sin handler** — "Guardar" persiste prompt en `data/admin-config.json`; "Restaurar" vuelve al prompt default; temperatura eliminada
- `baja` [x] **Temperatura en ConfigTab** — eliminada; `temperature: 0` hardcodeado en el route de parsear
- `baja` [x] **Prompt en ConfigTab** — lee y escribe el prompt real desde `lib/ai/prompt.ts`; el route lo carga en cada request con fallback al default

---

## Búsqueda y navegación de carreras

- `media` [ ] **Filtrar carreras por departamento** — en la página de inicio, permitir filtrar/agrupar carreras por departamento. La info de departamento está disponible en `web/data/planes_uns.json`; no requiere nueva fuente de datos, solo cruzar con las carreras ya cargadas en `carreras.ts`.

---

## Mapa de correlativas — UX y responsividad

- `media` [ ] **Validación incompleta del mapa** — terminar de validar que el grafo
  refleja correctamente las correlativas del JSON: nodos faltantes,
  conexiones incorrectas, estados (aprobada/cursada/disponible/bloqueada)
  mal calculados. Cruzar contra el mismo ground truth que usa el comparador

- `media` [ ] **UX del mapa confusa** — revisar la experiencia general de la vista Mapa:
  el grafo aparece pequeño y descentrado, sin feedback visual claro sobre
  cómo interactuar (zoom, drag, selección). Evaluar: centrar el grafo al
  cargar, agregar hint de "arrastrá para explorar / scroll para zoom",
  mejorar contraste y legibilidad de nodos bloqueados vs disponibles,
  revisar si el minimap aporta valor o agrega ruido

- `baja` [ ] **Mapa no es responsive** — la vista Mapa no funciona en pantallas
  chicas; el canvas se desborda o queda inutilizable en mobile/tablet.
  Definir si se adapta el grafo (nodos más chicos, layout vertical) o se
  muestra un fallback con mensaje "disponible solo en desktop"

---

## Google Calendar — integración con el planificador horario

El planificador actual (`WeeklySchedule`, `useSchedule`, `/api/planificador`) maneja bloques con `dia`, `horaInicio`, `horaFin`, `materiaNombre`, `comision` y `notas`. La integración debe exportar esos bloques como eventos recurrentes semanales a Google Calendar.

- `alta` [ ] **OAuth con Google** — agregar `google` como provider en NextAuth con scope `https://www.googleapis.com/auth/calendar.events`; guardar `access_token` y `refresh_token` en sesión
- `alta` [ ] **Endpoint de exportación** — `POST /api/planificador/exportar-gcal` que tome los bloques del usuario y los convierta a eventos Google Calendar con recurrencia semanal (`RRULE:FREQ=WEEKLY`)
- `alta` [ ] **Mapeo de bloques a eventos** — convertir `dia` (1–5) + `horaInicio`/`horaFin` (minutos desde medianoche) a `dateTime` en formato ISO 8601; usar `materiaNombre` como título y `notas`/`comision` como descripción
- `alta` [ ] **Botón "Exportar a Google Calendar"** en `WeeklySchedule.tsx` — visible solo si hay bloques cargados; maneja estado de loading/error/éxito
- `media` [ ] **Manejo de token expirado** — refresh automático con `refresh_token` antes de llamar a la API de Google
- `media` [ ] **Evitar duplicados** — al re-exportar, detectar eventos ya creados por esta app (via `extendedProperties`) y actualizarlos en lugar de crear nuevos
- `baja` [ ] **Variable de entorno** — documentar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env.example`

---

## Código hardcodeado — mejoras menores

- `media` [ ] `web/app/perfil/page.tsx:15` — fallback `"sin-email@uns.local"` puede aparecer en producción; reemplazar por `""` o `"sin email"`
- `baja` [ ] `web/prisma/seed.ts:11` — fallback `"admin@uns.local"` si no hay `ADMIN_SEED_EMAIL` en `.env`; documentar en `.env.example`
- `baja` [ ] `web/components/auth/LoginActions.tsx:115` — placeholder `"usuario@uns.local"`; cosmético, reemplazar por algo genérico

---

## Prompt Gemini — issues conocidos por carrera

| Carrera | Score Gemini | Issues principales |
|---|---|---|
| arquitectura | 85.4/100 | `I2201 → 12201` en correlativas (29 materias); `G2324` generado en `materias[]`; materia `858` extra |
| agrimensura | — | Casing mayúsculas resuelto (v22); `5175` correlativa en `5464` resuelto en parser; issues menores pendientes en issue file |
| ingenieria_civil | 21/100 | Fallo estructural: 3 orientaciones con IDs repetidos; Gemini no puede deduplicar; límite del modelo |
| abogacia | — | Ver `issues/abogacia.md` |
| bioquimica | — | Ver `issues/bioquimica.md` |
| farmacia | — | Ver `issues/farmacia.md` |
| contador_publico | — | Ver `issues/contador_publico.md` |
| ingenieria_en_sistemas_de_informacion | — | Ver `issues/ingenieria_en_sistemas_de_informacion.md` |

**Prompt actual**: v25 — `web/lib/ai/prompt.ts` / `web/data/admin-config.json`

**Problema abierto más relevante**: `I#### → 1####` en claves de `correlativas`. El modelo corrige en `materias[]` y `agrupadores[]` pero no en correlativas de otras materias. La instrucción de cross-check (v25) no fue suficiente — posible candidato para few-shot o postprocesamiento ligero.

---

## Planes de estudio — carreras pendientes de generar

Carreras ya procesadas: abogacia, agrimensura, arquitectura, bioquimica, contador_publico, farmacia, ing_civil, ingenieria_en_sistemas_de_informacion, lic_computacion.

| Carrera | Departamento | Duración |
|---|---|---|
| [ ] INGENIERIA AGRONOMICA | Agronomía | 10 Cuat. |
| [ ] INGENIERIA ELECTRICISTA | Ingeniería Eléctrica y de Computadoras | 10 Cuat. |
| [ ] INGENIERIA ELECTRONICA | Ingeniería Eléctrica y de Computadoras | 10 Cuat. |
| [ ] INGENIERIA EN ALIMENTOS | Ingeniería Química | 10 Cuat. |
| [ ] INGENIERIA EN COMPUTACION | Ciencias e Ingeniería de la Computación | 10 Cuat. |
| [ ] INGENIERÍA EN TELECOMUNICACIONES | Ingeniería Eléctrica y de Computadoras | 10 Cuat. |
| [ ] INGENIERIA INDUSTRIAL | Ingeniería | 10 Cuat. |
| [ ] INGENIERIA MECANICA | Ingeniería | 10 Cuat. |
| [ ] INGENIERIA QUIMICA | Ingeniería Química | 10 Cuat. |
| [ ] LICENCIATURA EN ADMINISTRACION | Ciencias de la Administración | 10 Cuat. |
| [ ] LICENCIATURA EN CIENCIAS AMBIENTALES | Química | 10 Cuat. |
| [ ] LICENCIATURA EN CIENCIAS BIOLOGICAS | Biología, Bioquímica y Farmacia | 10 Cuat. |
| [ ] LICENCIATURA EN CIENCIAS DE LA EDUCACION | Ciencias de la Educación | 10 Cuat. |
| [ ] LICENCIATURA EN CIENCIAS GEOLOGICAS | Geología | 10 Cuat. |
| [ ] LICENCIATURA EN ECONOMIA | Economía | 9 Cuat. |
| [ ] LICENCIATURA EN ENFERMERIA | Ciencias de la Salud | 10 Cuat. |
| [ ] LICENCIATURA EN FILOSOFIA | Humanidades | 10 Cuat. |
| [ ] LICENCIATURA EN FISICA | Física | 10 Cuat. |
| [ ] LICENCIATURA EN GEOFISICA | Física | 10 Cuat. |
| [ ] LICENCIATURA EN GEOGRAFIA | Geografía y Turismo | 10 Cuat. |
| [ ] LICENCIATURA EN GESTIÓN UNIVERSITARIA | Ciencias de la Administración | 10 Cuat. |
| [ ] LICENCIATURA EN HISTORIA | Humanidades | 10 Cuat. |
| [ ] LICENCIATURA EN LETRAS | Humanidades | 10 Cuat. |
| [ ] LICENCIATURA EN MATEMATICA | Matemática | 10 Cuat. |
| [ ] LICENCIATURA EN MATEMATICA APLICADA | Matemática | 10 Cuat. |
| [ ] LICENCIATURA EN OBSTETRICIA | Ciencias de la Salud | - |
| [ ] LICENCIATURA EN OCEANOGRAFIA | Geografía y Turismo | 10 Cuat. |
| [ ] LICENCIATURA EN OPTICA Y CONTACTOLOGÍA | Física | 8 Cuat. |
| [ ] LICENCIATURA EN QUIMICA | Química | 10 Cuat. |
| [ ] LICENCIATURA EN SEGURIDAD PÚBLICA | Derecho | 4 Cuat. |
| [ ] LICENCIATURA EN TURISMO | Geografía y Turismo | 9 Cuat. |
| [ ] MEDICINA | Ciencias de la Salud | 12 Cuat. |
| [ ] PROFESORADO DE EDUCACION INICIAL | Ciencias de la Educación | 8 Cuat. |
| [ ] PROFESORADO DE EDUCACION PRIMARIA | Ciencias de la Educación | 8 Cuat. |
| [ ] PROFESORADO EN CIENCIAS BIOLÓGICAS | Biología, Bioquímica y Farmacia | 8 Cuat. |
| [ ] PROFESORADO EN ECONOMIA | Economía | 10 Cuat. |
| [ ] PROFESORADO EN ECONOMIA PARA LA ENSEÑANZA SECUNDARIA | Economía | 8 Cuat. |
| [ ] PROFESORADO EN EDUCACION SECUNDARIA EN CIENCIAS DE LA ADMINISTRACION | Ciencias de la Administración | 8 Cuat. |
| [ ] PROFESORADO EN EDUCACION SECUNDARIA Y SUPERIOR EN CIENCIAS DE LA ADMINISTRACION | Ciencias de la Administración | 10 Cuat. |
| [ ] PROFESORADO EN FILOSOFIA | Humanidades | 10 Cuat. |
| [ ] PROFESORADO EN FISICA | Física | 8 Cuat. |
| [ ] PROFESORADO EN GEOCIENCIAS | Geología | 8 Cuat. |
| [ ] PROFESORADO EN GEOGRAFIA | Geografía y Turismo | 9 Cuat. |
| [ ] PROFESORADO EN HISTORIA | Humanidades | 10 Cuat. |
| [ ] PROFESORADO EN LETRAS | Humanidades | 10 Cuat. |
| [ ] PROFESORADO EN MATEMATICA | Matemática | 8 Cuat. |
| [ ] PROFESORADO EN QUIMICA | Química | 10 Cuat. |
| [ ] PROFESORADO EN QUIMICA DE LA ENSEÑANZA MEDIA | Química | 8 Cuat. |
| [ ] PROFESORADO UNIVERSITARIO EN GEOGRAFIA | Geografía y Turismo | 10 Cuat. |
| [ ] TECNICATURA SUPERIOR AGRARIA EN SUELOS Y AGUAS | Agronomía | 5 Cuat. |
| [ ] TECNICATURA SUPERIOR EN ADMINISTRACION Y GESTION DE RECURSOS | Ciencias de la Administración | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA APICOLA | Agronomía | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN ACOMPAÑAMIENTO TERAPÉUTICO | Ciencias de la Salud | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN CARTOGRAFIA, TELEDETECCION Y SIG | Geografía y Turismo | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN DEPORTE | Economía | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN ECONOMÍA Y GESTIÓN DE EMPRESAS ALIMENTARIAS | Economía | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN EMPRENDIMIENTOS AGROALIMENTARIOS | Ingeniería Química | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN EMPRENDIMIENTOS AGROPECUARIOS | Economía | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN EMPRENDIMIENTOS AUDIOVISUALES | Ingeniería Eléctrica y de Computadoras | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN GESTION CULTURAL Y EMPRENDIMIENTOS CULTURALES | Geografía y Turismo | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN MANEJO Y COMERCIALIZACION DE GRANOS | Agronomía | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN MEDIO AMBIENTE | Geología | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN OCEANOGRAFÍA | Geografía y Turismo | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN OPERACIONES INDUSTRIALES | Ingeniería Química | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN OPTICA | Física | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN PARQUES Y JARDINES | Agronomía | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN PETRÓLEO Y GAS | Ingeniería Química | 6 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN PROGRAMACIÓN WEB Y MÓVIL | Ciencias e Ingeniería de la Computación | 5 Cuat. |
| [ ] TECNICATURA UNIVERSITARIA EN SISTEMAS ELECTRÓNICOS INDUSTRIALES INTELIGENTES | Ingeniería Eléctrica y de Computadoras | 6 Cuat. |

---

## Deuda técnica — parser local

- `media` [x] **`--mode regex` en parsear-local** — argumento inexistente removido del route `parsear-local/route.ts`
- `media` [x] **Correlativas inline con `requisito_especial`** — parser ahora extrae correlativas estructuradas embebidas en líneas de prosa (ej. `5175 Aprobada` en misma línea que texto de requisito cuantitativo)
- `baja` [ ] **`5293` cuatrimestre `null` en agrimensura** — parser devuelve `null`, debería ser `"Anual"`; ver `issues/agrimensura.md`
- `baja` [ ] **`3616` correlativas incorrectas en agrimensura** — parser asigna `3051, 5415, 5539` en lugar de solo `6323`; ver `issues/agrimensura.md`

---

## Deuda técnica — módulos a borrar cuando estén desacoplados

- `media` [x] `core/llm/` — eliminado
- `media` [x] `tests/test_llm_*.py` (5 archivos) — eliminados junto con `core/llm/`
- `baja` [x] `web/data/llm/` (8 JSONs) — eliminado

---

## Deuda técnica — README desactualizado

- `baja` [x] `README.md` menciona `scripts/generar_json.py` (eliminado) y `core/correlativas/` (eliminado); actualizar las referencias
