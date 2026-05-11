# TODO

## Panel admin — features pendientes (según CLAUDE.md)

- [ ] **Procesar en paralelo** — botón "Ambos" que dispara Gemini + parser local simultáneamente y va directo a la vista de comparación sin pasos manuales
- [ ] **Selector de modelo con rate limits** — mostrar requests restantes / límite diario / cooldown por modelo antes de elegir; deshabilitar visualmente si no hay cuota
- [ ] **Validación de schema completo** — validar el JSON contra el schema completo de PlanData, no solo IDs/años/correlativas
- [ ] **Bloquear guardado si falla validación** — hoy la validación es informativa; errores críticos deben impedir publicar
- [ ] **Diff antes de confirmar reemplazo** — al detectar conflicto mostrar exactamente qué cambió entre el JSON publicado y el nuevo antes de confirmar
- [ ] **Botones ConfigTab sin handler** — "Mejorar prompt" y "Guardar" no tienen lógica; definir si se implementan o se eliminan
- [ ] **Temperatura en ConfigTab** — slider existe pero no se persiste ni se pasa a la API; decidir si se conecta o se saca
- [ ] **Prompt en ConfigTab** — textarea muestra un texto fijo; decidir si debe leer/escribir el prompt real que usa la API

## Código hardcodeado — mejoras menores

- [ ] `web/app/perfil/page.tsx:15` — fallback `"sin-email@uns.local"` puede aparecer en producción; reemplazar por `""` o `"sin email"`
- [ ] `web/prisma/seed.ts:11` — fallback `"admin@uns.local"` si no hay `ADMIN_SEED_EMAIL` en `.env`; documentar en `.env.example`
- [ ] `web/components/auth/LoginActions.tsx:115` — placeholder `"usuario@uns.local"`; cosmético, reemplazar por algo genérico

## Google Calendar — integración con el planificador horario

El planificador actual (`WeeklySchedule`, `useSchedule`, `/api/planificador`) maneja bloques con `dia`, `horaInicio`, `horaFin`, `materiaNombre`, `comision` y `notas`. La integración debe exportar esos bloques como eventos recurrentes semanales a Google Calendar.

- [ ] **OAuth con Google** — agregar `google` como provider en NextAuth con scope `https://www.googleapis.com/auth/calendar.events`; guardar `access_token` y `refresh_token` en sesión
- [ ] **Endpoint de exportación** — `POST /api/planificador/exportar-gcal` que tome los bloques del usuario y los convierta a eventos Google Calendar con recurrencia semanal (`RRULE:FREQ=WEEKLY`)
- [ ] **Mapeo de bloques a eventos** — convertir `dia` (1–5) + `horaInicio`/`horaFin` (minutos desde medianoche) a `dateTime` en formato ISO 8601; usar `materiaNombre` como título y `notas`/`comision` como descripción
- [ ] **Botón "Exportar a Google Calendar"** en `WeeklySchedule.tsx` — visible solo si hay bloques cargados; maneja estado de loading/error/éxito
- [ ] **Manejo de token expirado** — refresh automático con `refresh_token` antes de llamar a la API de Google
- [ ] **Evitar duplicados** — al re-exportar, detectar eventos ya creados por esta app (via `extendedProperties`) y actualizarlos en lugar de crear nuevos
- [ ] **Variable de entorno** — documentar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env.example`

## Deuda técnica — módulos a borrar cuando estén desacoplados

- [ ] `core/llm/` — marcado deprecated; bloqueado por `core/parser/cli.py` que lo importa para `--mode=llm` y `--mode=hybrid`; eliminar cuando se decida quitar esos modos del CLI
- [ ] `tests/test_llm_*.py` (5 archivos) — se eliminan junto con `core/llm/`
- [ ] `web/data/llm/` (8 JSONs) — referencia de comparación; eliminar cuando el pipeline del admin panel quede estable

## Deuda técnica — README desactualizado

- [x] `README.md` menciona `scripts/generar_json.py` (eliminado) y `core/correlativas/` (eliminado); actualizar las referencias
