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

## Deuda técnica — módulos a borrar cuando estén desacoplados

- [ ] `core/llm/` — marcado deprecated; bloqueado por `core/parser/cli.py` que lo importa para `--mode=llm` y `--mode=hybrid`; eliminar cuando se decida quitar esos modos del CLI
- [ ] `tests/test_llm_*.py` (5 archivos) — se eliminan junto con `core/llm/`
- [ ] `web/data/llm/` (8 JSONs) — referencia de comparación; eliminar cuando el pipeline del admin panel quede estable

## Deuda técnica — README desactualizado

- [x] `README.md` menciona `scripts/generar_json.py` (eliminado) y `core/correlativas/` (eliminado); actualizar las referencias
