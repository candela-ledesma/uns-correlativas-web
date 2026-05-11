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
- `media` [ ] **Validación de schema completo** — validar el JSON contra el schema completo de PlanData, no solo IDs/años/correlativas
- `media` [ ] **Diff antes de confirmar reemplazo** — al detectar conflicto mostrar exactamente qué cambió entre el JSON publicado y el nuevo antes de confirmar
- `media` [ ] **Selector de modelo con rate limits** — mostrar requests restantes / límite diario / cooldown por modelo antes de elegir; deshabilitar visualmente si no hay cuota
- `baja` [ ] **Botones ConfigTab sin handler** — "Mejorar prompt" y "Guardar" no tienen lógica; definir si se implementan o se eliminan
- `baja` [ ] **Temperatura en ConfigTab** — slider existe pero no se persiste ni se pasa a la API; decidir si se conecta o se saca
- `baja` [ ] **Prompt en ConfigTab** — textarea muestra un texto fijo; decidir si debe leer/escribir el prompt real que usa la API

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

## Deuda técnica — módulos a borrar cuando estén desacoplados

- `media` [ ] `core/llm/` — marcado deprecated; bloqueado por `core/parser/cli.py` que lo importa para `--mode=llm` y `--mode=hybrid`; eliminar cuando se decida quitar esos modos del CLI
- `media` [ ] `tests/test_llm_*.py` (5 archivos) — se eliminan junto con `core/llm/`
- `baja` [ ] `web/data/llm/` (8 JSONs) — referencia de comparación; eliminar cuando el pipeline del admin panel quede estable

---

## Deuda técnica — README desactualizado

- `baja` [x] `README.md` menciona `scripts/generar_json.py` (eliminado) y `core/correlativas/` (eliminado); actualizar las referencias
