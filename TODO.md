# TODO

> Prioridades: `alta` — `media` — `baja`

---

## Admin en producción (Vercel) — opciones a evaluar

El panel admin usa escritura en disco y subprocesos Python que no funcionan en Vercel.
Actualmente el flujo completo (parser local, validar, guardar) solo funciona en local.
Opciones para resolverlo a futuro:

- `baja` [x] **Opción 1: Python API separada en Render** — `uns-parser-api` deployado en Render (FastAPI). Parser local y Gemini corren desde ahí; Vercel delega ambos cuando `PARSER_API_URL` está definida.

- `baja` [ ] **Opción 2: Reemplazar JSONs por base de datos** — en lugar de guardar carreras como `.json` en el repo, guardarlas en Supabase o PlanetScale. Las rutas admin harían CRUD directo a la DB; Vercel lee/escribe sin problemas desde serverless functions. El parser Python correría una sola vez para migrar los JSONs existentes.


### Admin prod (Vercel + Render) — resuelto

- [x] **Filesystem read-only en Vercel** — JSONs y carreras migrados a Neon (tablas `PlanPublicado`, `CarreraConfig`). `planDataLoader` lee desde DB como fallback.
- [x] **SSE no funciona en Vercel** — route Gemini convertido a JSON directo.
- [x] **Timeout de Vercel (60s) para Gemini** — el browser llama directo a Render (`NEXT_PUBLIC_PARSER_API_URL`), evitando el límite serverless. Render no tiene límite de tiempo para requests externos.
- [x] **CORS** — `CORSMiddleware` en FastAPI con origen `uns-correlativas.vercel.app`.
- [x] **Auth en `/parse-gemini`** — eliminada; el acceso lo controla la sesión de Next.js.
- [x] **Parseo Gemini desde prod (Vercel) no funciona** — causa raíz: el cliente llamaba directo a Render sin incluir `system_prompt`, por lo que Gemini respondía en markdown libre. Fix: nuevo `GET /api/admin/planes/parsear` devuelve el prompt activo (ADMIN/MODERATOR); el cliente lo fetchea al montar y lo incluye en el FormData antes de llamar a Render.

### Migraciones a Neon priorizadas

- `media` [x] **`admin-config.json` → tabla `AdminConfig` en Neon** — migrado. Routes `admin/config` y `admin/planes/parsear` leen/escriben desde Neon.
- `media` [x] **`data/gemini/*_pendiente.json` → tabla `PlanPendiente` en Neon** — migrado. Routes `pendientes`, `pendientes/[slug]` y `enviar-revision` usan Prisma.
- `baja` [x] **`data/local/*.json` + `carreras.ts` → migrado a Neon** — nuevas tablas `PlanPublicado` y `CarreraConfig`. Routes `guardar`, `existe`, `publicados`, `publicados/[slug]`, `departamentos` y `api/planes` usan Prisma. `planDataLoader` lee desde DB como fallback cuando el filesystem no está disponible (Vercel).
- `media` [x] **`data/local/` y `data/gemini/` → tabla `PlanBorrador` en Neon** — nueva tabla con `@@unique([slug, fuente])`. Los parseos de Gemini y parser local se autoguardan en `PlanBorrador` al terminar. El endpoint `guardar` separa borradores (`PlanBorrador`) de publicados (`PlanPublicado`). El endpoint `existe` lee desde `PlanBorrador`. Migración inicial cargó 12 JSONs locales + 11 Gemini. Los archivos en disco se mantienen como backup.

---

## Roles de usuario

- `alta` [x] **Agregar enum de roles en Prisma** — campo `role` (USER/MODERATOR/ADMIN) ya existía en el schema con default USER. Migración ya aplicada.

- `alta` [x] **Proteger rutas por rol** — `web/middleware.ts` verifica JWT en cada request a `/admin/*` y `/api/admin/*`: redirige a login si no hay sesión, 403/redirect a `/` si no es ADMIN.

- `media` [x] **Gestión de usuarios desde el panel admin** — disponible en `/admin/dashboard`: tabla de usuarios reales con selector de rol y motivo obligatorio.

- `baja` [x] **Flujo de carga de planes para MODERADOR** — MODERATOR accede al mismo panel admin, puede subir y procesar PDFs con Gemini o parser local, pero el botón de publicar está deshabilitado. Solo ADMIN puede publicar.

---

## Panel admin — gestión de planes

- `alta` [x] **Notificar al admin cuando un MODERATOR envía un plan a revisión** — email via Resend cuando se registra un `PLAN_PENDING_REVIEW`. Requiere `RESEND_API_KEY` y `ADMIN_NOTIFY_EMAIL` en `.env.local`.

- `alta` [x] **Vista de revisión de planes pendientes** — sección en `/admin/dashboard` (o `/admin/revisiones`) que lista los planes con estado `pendiente_revision` leídos de `data/gemini/*_pendiente.json`, con opción de publicar o rechazar cada uno.

- `alta` [x] **Auto-guardado de Gemini sin confirmación** — actualmente el JSON generado por Gemini se guarda en `data/gemini/` de forma silenciosa al terminar de parsear. Agregar confirmación explícita del usuario antes de escribir el archivo (o al menos un modal con resumen antes de persistir).

- `media` [x] **Gestión de planes publicados desde el panel admin** — además de crear planes (ya existe), el admin debe poder modificar y eliminar planes publicados: editar el JSON directamente o eliminarlo de `data/local/` y desregistrarlo de `carreras.ts`.
- `media` [x] **Editor estructurado de planes** — reemplaza el textarea JSON crudo por un formulario con campos para nombre (CarreraConfig), departamento, carrera/universidad/código_plan (JSON), y tabla editable de materias con correlativas. Toggle entre modo formulario y modo JSON, ambos sincronizados. API PATCH extendida para actualizar nombre/departamento en `CarreraConfig`.

- `baja` [x] **UX panel admin** — botones ← Inicio y Perfil a la izquierda del header; título + badge + ícono a la derecha. Texto hardcodeado "Sin materias registradas aún" en perfil reemplazado por conteo real de actividad.

---

## Panel admin — features pendientes (según CLAUDE.md)

- `alta` [x] **Bloquear guardado si falla validación** — hoy la validación es informativa; errores críticos deben impedir publicar
- `alta` [x] **Procesar en paralelo** — botón "Ambos" que dispara Gemini + parser local simultáneamente y va directo a la vista de comparación sin pasos manuales
- `alta` [x] **Auto-guardar JSON de Gemini en data/gemini/** — best-effort al terminar de parsear; no sobreescribe si ya existe (requiere acción explícita del usuario)
- `alta` [x] **Confirmar antes de regenerar** — si ya existe JSON para esa fuente, mostrar modal con metadatos del archivo existente antes de reemplazar
- `alta` [x] **Comparar con versión anterior** — tras regenerar, botón para ver diff side-by-side entre el resultado nuevo y el JSON que había antes
- `alta` [x] **ConfigTab — versión y fecha del prompt** — muestra versión (ej. v25) y timestamp de última modificación debajo del textarea
- `media` [ ] **Validación de schema completo** — validar el JSON contra el schema completo de PlanData, no solo IDs/años/correlativas
- `media` [ ] **Merge interactivo de diferencias (estilo GitHub)** — al comparar parser vs Gemini, el admin puede resolver diferencia por diferencia eligiendo qué bloque conservar (parser, Gemini, o edición manual). El resultado es un JSON merged que se puede publicar directamente. Aplica a: correlativas extra/faltantes, requisito_especial distinto, campos de metadata distintos. Ejemplo: Gemini genera 8 correlativas para una materia y el parser genera 3 — el admin ve ambos bloques side-by-side y elige cuál es correcto antes de publicar.
- `media` [x] **Navegación entre tabs sin perder estado de generación** — `CargarPlanTab` se mantiene montado con `display:none` al cambiar de tab; los demás tabs se montan en su primera visita (lazy mount) para no disparar fetches innecesarios al cargar el panel.
- `media` [x] **Editor estructurado de planes publicados** — reemplaza el textarea JSON crudo por formulario con campos para nombre (CarreraConfig), departamento, carrera/universidad/código_plan (JSON), y tabla editable de materias con correlativas. Toggle formulario ↔ JSON sincronizado.
- `baja` [x] **Simulación temporal de rol para admin** — desde el topbar del panel admin, el admin puede ver la app como USER o MODERADOR sin tocar la DB. El JWT guarda `effectiveRole`; al volver a loguear recupera ADMIN automáticamente.
- `media` [x] **Selector de modelo con rate limits** — barra de progreso de RPD por modelo en el dropdown; verde/amarillo/rojo según consumo diario
- `baja` [x] **Botones ConfigTab sin handler** — "Guardar" persiste prompt en `data/admin-config.json`; "Restaurar" vuelve al prompt default; temperatura eliminada
- `baja` [x] **Temperatura en ConfigTab** — eliminada; `temperature: 0` hardcodeado en el route de parsear
- `baja` [x] **Prompt en ConfigTab** — lee y escribe el prompt real desde `lib/ai/prompt.ts`; el route lo carga en cada request con fallback al default

---

## UX — navegación y estado

- `media` [x] **Persistir tab activo al hacer refresh en plan** — `?tab=vista|planificador|mapa` en la URL; `plan` es el default y no aparece. Implementado en `PlanViewer.tsx`.
- `media` [x] **Persistir tab activo al hacer refresh en panel admin** — `?tab=planes|historial|config` en la URL; `cargar` es el default. Implementado en `AdminPanel.tsx`.
- `media` [ ] **Persistir tab activo al hacer refresh en panel de usuario** — mismo comportamiento que el plan: al recargar el perfil, volver al tab que estaba activo. Implementar via query param.

---

## Compartir plan con progreso

- `media` [x] **Generar link compartible con snapshot de progreso** — tabla `ProgressShare` en Neon con token único. Botón "Compartir progreso" en PlanHeader genera el link y lo copia al portapapeles. Si el clipboard no está disponible (HTTP/sin foco), abre un modal con el link pre-seleccionado, botón Copiar y cierre con Escape. El destinatario ve el plan en `/planes/[carrera]/share/[token]` en modo lectura (sin auth requerida).

---

## Búsqueda y navegación de carreras

- `media` [x] **Filtrar carreras por departamento** — chips de filtro en la página de inicio incluyendo "Todas"; campo `departamento` agregado a todas las carreras en `carreras.ts`; selector de departamento al guardar un plan nuevo desde el panel admin.

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

- `alta` [x] **OAuth con Google** — `google` provider en NextAuth con scope `calendar.events`; `access_token` y `refresh_token` guardados en sesión
- `alta` [x] **Endpoint de exportación** — `POST /api/planificador/exportar-gcal` convierte bloques a eventos Google Calendar con recurrencia semanal (`RRULE:FREQ=WEEKLY`)
- `alta` [x] **Mapeo de bloques a eventos** — `dia` + `horaInicio`/`horaFin` convertidos a `dateTime` ISO 8601; `materiaNombre` como título, `notas`/`comision` como descripción
- `alta` [x] **Botón "Exportar a Google Calendar"** en `WeeklySchedule.tsx` — visible solo si hay bloques cargados; maneja loading/error/éxito con badge de estado
- `media` [x] **Manejo de token expirado** — refresh automático con `refresh_token` antes de llamar a la API de Google
- `media` [x] **Evitar duplicados** — al re-exportar usa delete-then-create aislado por carrera (via `extendedProperties`); fix para no borrar eventos de otras carreras
- `baja` [ ] **Variable de entorno** — documentar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env.example`

---

## Código hardcodeado — mejoras menores

- `media` [x] `web/app/perfil/page.tsx:15` — fallback `"sin-email@uns.local"` puede aparecer en producción; reemplazar por `""` o `"sin email"`
- `baja` [x] `web/prisma/seed.ts:11` — fallback `"admin@uns.local"` si no hay `ADMIN_SEED_EMAIL` en `.env`; documentar en `.env.example`
- `baja` [x] `web/components/auth/LoginActions.tsx:115` — placeholder `"usuario@uns.local"`; cosmético, reemplazar por algo genérico
- `baja` [x] `web/app/api/admin/planes/parsear/route.ts` — `_llm_confidence = 1.0` hardcodeado eliminado; badge de confianza ya maneja null
- `baja` [x] `web/components/materias/AnioSection.tsx` — `PunteroGrupo` redefinido localmente; ahora importado de `planAgrupacion.ts`
- `baja` [x] `web/app/api/debug/auth-config/route.ts` — endpoint de debug sin guard de producción; agregado `NODE_ENV === "production"` check

---

## Prompt Gemini — issues conocidos por carrera

| Carrera | Score Gemini (v30) | Issues principales |
|---|---|---|
| ingenieria_electricista | 98.9/100 | Solo tildes en nombre del plan |
| agrimensura | 98.6/100 | 2 correlativas distintas, 1 req solo en ref |
| ingenieria_agronomica | 98.6/100 | 17 requisito_especial que parser detecta pero Gemini omite |
| ingenieria_en_sistemas_de_informacion | 98.7/100 | Nombre en mayúsculas, 1 req diferente |
| ingenieria_electronica | 97.8/100 | 31 `anio_aprobado` solo en Gemini, 2 agrupadores extra (G0723/G0724), 3 correlativas distintas |
| contador_publico | 95.6/100 | 5 parciales, 2 distintas |
| arquitectura | 95.9/100 | `I2201 → 12201` corregido por post-proceso; materia `858` extra |
| bioquimica | 90.8/100 | 3 materias ausentes en candidato |
| abogacia | 89.5/100 | 4 agrupadores extra, nombre mal, 2 req solo en ref |
| farmacia | 86.0/100 | I0902 ausente, 13 correlativas parciales |
| ingenieria_en_computacion | 93.6/100 | `I0022 → 10022` corregido por post-proceso; 9 parciales, 5 distintas en optativas |
| ingenieria_civil | 23.0/100 | Fallo estructural: orientaciones múltiples con IDs repetidos; Gemini no deduplica |

**Prompt actual**: v32 — `web/lib/ai/prompt.ts` / `web/data/admin-config.json`

**Cambios v32**: nuevo tipo `minimo_examenes_finales` para requisitos del estilo "haber aprobado N exámenes finales de las materias disciplinares" (detectado en Profesorado en Filosofía, materia 4844). Agregado en schema, tabla de tipos, ejemplo concreto, `planValidation.ts`, `requisitoEspecial.ts` y `correlativa_prosa.py`.

**Cambios v31**: (sin cambio de comportamiento — bump interno).

**Cambios v30**: `requisito_especial` migrado a array; nuevos tipos `cuatrimestre_cursado` y `anio_y_anio_cursado`; la versión del prompt siempre se lee desde el código (no del JSON guardado).

**Post-proceso automático**: `corregirIdsIdioma()` en `parsear/route.ts` corrige `1XXXX → IXXXX` en tiempo real al parsear con Gemini.

**Few-shot**: herramienta de exportación manual en el panel admin (botón "Exportar diff como few-shot") que genera bloques de correcciones para pegar en el prompt.

**Carreras procesadas con parser local**: abogacia, agrimensura, arquitectura, bioquimica, contador_publico, farmacia, ingenieria_civil, ingenieria_en_sistemas_de_informacion, lic_computacion, ingenieria_agronomica, ingenieria_electricista, ingenieria_en_computacion, ingenieria_mecanica, ingenieria_industrial, profesorado_en_letras, profesorado_en_filosofia, licenciatura_en_economia.

---

## Planes de estudio — carreras pendientes de generar

Carreras ya procesadas: abogacia, agrimensura, arquitectura, bioquimica, contador_publico, farmacia, ingenieria_civil, ingenieria_en_sistemas_de_informacion, lic_computacion, ingenieria_agronomica, ingenieria_electricista, ingenieria_en_computacion, ingenieria_mecanica, ingenieria_industrial, profesorado_en_letras, profesorado_en_filosofia, licenciatura_en_economia.

| Carrera | Departamento | Duración |
|---|---|---|
| [x] INGENIERIA AGRONOMICA | Agronomía | 10 Cuat. |
| [x] INGENIERIA ELECTRICISTA | Ingeniería Eléctrica y de Computadoras | 10 Cuat. |
| [x] INGENIERIA ELECTRONICA | Ingeniería Eléctrica y de Computadoras | 10 Cuat. |
| [ ] INGENIERIA EN ALIMENTOS | Ingeniería Química | 10 Cuat. |
| [x] INGENIERIA EN COMPUTACION | Ciencias e Ingeniería de la Computación | 10 Cuat. |
| [ ] INGENIERÍA EN TELECOMUNICACIONES | Ingeniería Eléctrica y de Computadoras | 10 Cuat. |
| [x] INGENIERIA INDUSTRIAL | Ingeniería | 10 Cuat. |
| [x] INGENIERIA MECANICA | Ingeniería | 10 Cuat. |
| [ ] INGENIERIA QUIMICA | Ingeniería Química | 10 Cuat. |
| [ ] LICENCIATURA EN ADMINISTRACION | Ciencias de la Administración | 10 Cuat. |
| [ ] LICENCIATURA EN CIENCIAS AMBIENTALES | Química | 10 Cuat. |
| [ ] LICENCIATURA EN CIENCIAS BIOLOGICAS | Biología, Bioquímica y Farmacia | 10 Cuat. |
| [ ] LICENCIATURA EN CIENCIAS DE LA EDUCACION | Ciencias de la Educación | 10 Cuat. |
| [ ] LICENCIATURA EN CIENCIAS GEOLOGICAS | Geología | 10 Cuat. |
| [x] LICENCIATURA EN ECONOMIA | Economía | 9 Cuat. |
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
| [x] PROFESORADO EN FILOSOFIA | Humanidades | 10 Cuat. |
| [ ] PROFESORADO EN FISICA | Física | 8 Cuat. |
| [ ] PROFESORADO EN GEOCIENCIAS | Geología | 8 Cuat. |
| [ ] PROFESORADO EN GEOGRAFIA | Geografía y Turismo | 9 Cuat. |
| [ ] PROFESORADO EN HISTORIA | Humanidades | 10 Cuat. |
| [x] PROFESORADO EN LETRAS | Humanidades | 10 Cuat. |
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
- `media` [x] **Nuevo tipo `minimo_examenes_finales`** — detecta "haber aprobado N exámenes finales de las materias disciplinares" como requisito especial. Agregado en parser, planValidation.ts, requisitoEspecial.ts y prompt Gemini v32.
- `media` [x] **Nuevo tipo `prueba_idioma` extendido** — cubre "Examen de Comprensión de Inglés I/II" además de "Prueba de Suficiencia de Idioma". El cleaner fusiona líneas de prosa partidas con artículo/preposición colgante.
- `media` [x] **Nombre de agrupadores limpio** — el sufijo " Horaria" (encabezado de columna del PDF) se eliminaba correctamente de materias pero no de agrupadores. Ahora `limpiar_sufijos_encabezado()` se aplica también al crear agrupadores.
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
