# Diagnóstico y plan de migración — Plan ↔ CarreraVersion

Fecha: 2026-05-25  
Rama actual: `feat/cerrar-bd-plan-carreraversion`  
Estado: implementación completa. Ver sección 7 para deuda técnica residual.

---

## 1. Problema de fondo

### 1.1 Tres representaciones del mismo JSON

El contenido de un plan de estudios existe simultáneamente en tres lugares:

| Representación | Dónde | Cuándo manda |
|---|---|---|
| `Plan.planJson` | BD (tabla `Plan`) | Durante el ciclo editorial (borrador → publicado) |
| `CarreraVersion.jsonFile` | BD (string con nombre de archivo) | Referencia al archivo en disco |
| Archivo físico en disco | `frontend/data/local/*.json` | En producción — lo que la app sirve al usuario |

El flujo de publicación escribe el JSON en disco y crea la `CarreraVersion`. Después de publicar, `Plan.planJson` queda como registro histórico sin rol activo: la app lee el archivo, no la BD.

**Resultado:** hay dos fuentes de verdad según el estado del plan.

---

### 1.2 `Plan` y `CarreraVersion` no tienen conexión formal

`Plan` y `CarreraVersion` apuntan conceptualmente al mismo contenido pero no tienen FK entre sí. La consistencia depende del código de la action de publicación. Si ese proceso falla a mitad, puede quedar un `Plan` en estado `PUBLICADO` sin `CarreraVersion` correspondiente, o viceversa.

---

### 1.3 Dos modelos de carrera coexisten en el schema

El schema tiene dos modelos de carrera activos simultáneamente:

**`CarreraConfig`** (modelo viejo):
- Un `jsonFile` por carrera (sin soporte de versiones)
- Solo registra carreras dinámicas (las nuevas subidas desde el admin)
- Las carreras estáticas del array `CARRERAS` en `carreras.ts` no tienen fila acá

**`Carrera` + `CarreraVersion`** (modelo nuevo):
- Soporta múltiples versiones por carrera
- Existe en el schema y tiene datos de progreso de usuario anclados a él
- Pero el data loader **no lo usa** para leer metadatos

---

### 1.4 `loadPlanData` ignora la BD para metadatos

`planDataLoader.ts` resuelve carreras desde `getCarreraById()`, que lee el array `CARRERAS` hardcodeado en `carreras.ts`. Solo toca Prisma en dos casos:

1. **Fallback de contenido:** si el archivo en disco no existe, busca en `Plan.planJson` con `estado = PUBLICADO`.
2. **Fallback de metadatos:** si la carrera no está en `carreras.ts`, busca en `prisma.carreraConfig`.

El modelo `Carrera` de la BD nunca se consulta para resolver metadatos de carreras.

---

### 1.5 `CarreraConfig` está deprecado en la práctica pero activo en el código

Luego del refactor que introdujo `Carrera` + `CarreraVersion`, `CarreraConfig` debería haberse eliminado. En cambio:

- Sigue en el schema con su propia tabla en la BD
- El código lo referencia activamente:
  - `planDataLoader.ts:139` — fallback de metadatos
  - `/api/planes/route.ts:9` — lista combinada de carreras
  - `/api/admin/planes/publicados/route.ts:18` — panel admin
  - `/api/admin/planes/guardar/route.ts:36` — upsert al publicar

**El estado real:** hay dos definiciones paralelas de los metadatos de una carrera — `carreras.ts` (estáticas) + `CarreraConfig` (dinámicas) — cuando el objetivo es que `Carrera` + `CarreraVersion` sea la única fuente de verdad.

---

### 1.6 `defaultVersionId` en `Carrera` es un string libre sin FK

`Carrera.defaultVersionId` guarda el `versionId` string (ej: `"v1"`) de la versión por defecto. No es FK a `CarreraVersion.id`. Si la versión se elimina o renombra, el campo queda apuntando a algo inexistente sin que la BD lo detecte.

---

## 2. Arquitectura objetivo

```
loadPlanData(carreraId, versionId)
    │
    ├── lee Carrera + CarreraVersion desde BD   (metadatos)
    │       ↓
    │   CarreraVersion.jsonFile
    │       ↓
    ├── lee archivo en disco                    (contenido)
    │       ↓ (fallback si no existe)
    └── lee Plan.planJson con estado PUBLICADO  (contenido desde BD)
```

- `carreras.ts` desaparece o se convierte en script de seed únicamente.
- `CarreraConfig` se elimina del schema.
- `Carrera` + `CarreraVersion` son la única fuente de metadatos.
- El archivo en disco sigue siendo la fuente de verdad del contenido en producción (opción B — conservadora, sin cambiar cómo Next.js sirve los datos).
- `Plan.planJson` sigue siendo staging temporal durante el ciclo editorial.

---

## 3. Plan de implementación

### Paso A — Seedear `Carrera` y `CarreraVersion` desde `carreras.ts`

**Objetivo:** poblar la BD con todas las carreras que hoy solo existen en el array estático.

**Archivos:**
- `frontend/prisma/seed.ts` — agregar bloque que lea `CARRERAS` y haga upsert en `Carrera` + `CarreraVersion`

**Lógica del seed:**
- Para cada entrada en `CARRERAS`: upsert en `Carrera` (id, nombre, descripcion, departamentoId, disponible)
- Para cada versión en `carrera.versions`: upsert en `CarreraVersion` (carreraId, versionId, label, jsonFile, disponible, hidden)
- Poblar `Carrera.defaultVersionId` con el CUID de la `CarreraVersion` correspondiente (ver Paso B)

**Resultado:** `Carrera` + `CarreraVersion` tienen todos los datos que hoy están en el código.

---

### Paso B — Cambiar `Carrera.defaultVersionId` a FK real

**Objetivo:** hacer que `defaultVersionId` apunte al CUID de `CarreraVersion`, no al string `"v1"`.

**Cambio en schema:**
```prisma
model Carrera {
  // antes:
  defaultVersionId String?  // string libre, ej: "v1"

  // después:
  defaultCarreraVersionId String?
  defaultVersion          CarreraVersion? @relation("DefaultVersion", fields: [defaultCarreraVersionId], references: [id])
}
```

**Nota:** requiere relación con nombre para no colisionar con la relación `versions` existente.

**Migración de datos:** en el mismo seed del Paso A, después de crear las `CarreraVersion`, hacer update de `Carrera.defaultCarreraVersionId` con el id real.

---

### Paso C — Reescribir `loadPlanData` para leer de la BD

**Objetivo:** eliminar la dependencia de `getCarreraById()` (que lee `carreras.ts`).

**Archivo:** `frontend/lib/data/planDataLoader.ts`

**Cambio central:** reemplazar el bloque que llama a `getCarreraById()` por una query a Prisma:

```ts
const carrera = await prisma.carrera.findUnique({
  where: { id: carreraId },
  include: {
    versions: { where: { disponible: true } },
    defaultVersion: true,
  },
});
```

La función `readPlanJson` no cambia: sigue leyendo desde disco con fallback a `Plan.planJson`.

**Tipos a actualizar:** `CarreraInfo`, `CarreraInfoWithVersions` y `VersionInfo` pasan a derivarse del tipo Prisma en lugar de `CarreraConfig` de `carreras.ts`.

---

### Paso D — Reescribir `/api/planes` y `/api/admin/planes/publicados`

**Objetivo:** eliminar referencias a `CarreraConfig` y a `CARRERAS` en las rutas API.

**`/api/planes/route.ts`** — hoy mezcla `CARRERAS` + `CarreraConfig`. Reemplazar por:
```ts
const carreras = await prisma.carrera.findMany({
  where: { disponible: true },
  include: { departamento: true },
});
```

**`/api/admin/planes/publicados/route.ts`** — idem, reemplazar `prisma.carreraConfig.findMany()` por `prisma.carrera.findMany()`.

---

### Paso E — Reescribir `/api/admin/planes/guardar` para registrar en `Carrera`

**Objetivo:** al publicar una carrera nueva, registrarla en `Carrera` + `CarreraVersion` en lugar de `CarreraConfig`.

**Archivo:** `frontend/app/api/admin/planes/guardar/route.ts`

**Función a reemplazar:** `registrarCarreraEnDB()` — actualmente hace upsert en `carreraConfig`. Cambiar por upsert en `Carrera` + `CarreraVersion`.

---

### Paso F — Eliminar `CarreraConfig` del schema

**Prerequisito:** Pasos A–E completos y verificados en staging.

**Acciones:**
1. Confirmar que no hay referencias a `prisma.carreraConfig` en el código (`grep -r "carreraConfig" frontend/`)
2. Eliminar el modelo `CarreraConfig` del schema
3. Generar migración: `prisma migrate dev --name remove-carrera-config`
4. Eliminar `carreras.ts` o moverlo a `scripts/` como referencia histórica del seed

---

### Paso G — FK opcional de `CarreraVersion` hacia `Plan` (mejora de integridad)

**Objetivo:** garantizar a nivel BD que no puede existir una `CarreraVersion` sin un `Plan` publicado que la respalde.

**Cambio en schema:**
```prisma
model CarreraVersion {
  planId String?
  plan   Plan?   @relation(fields: [planId], references: [id], onDelete: SetNull)
}
```

FK nullable: versiones existentes (pre-migración) quedan con `planId = null`. Solo las nuevas versiones publicadas post-migración tienen el vínculo garantizado.

**Cuándo ejecutar:** después del Paso F, una vez que el flujo editorial esté completamente sobre `Plan`.

---

## 4. Orden y dependencias

```
A (seed Carrera/CarreraVersion)
│
├─► B (defaultVersionId como FK)     — depende de A (necesita los CUIDs)
│
├─► C (reescribir loadPlanData)       — depende de A (necesita datos en BD)
│
├─► D (reescribir /api/planes)        — depende de A
│
├─► E (reescribir /api/admin/guardar) — depende de A
│
└─► F (eliminar CarreraConfig)        — depende de C + D + E (todos deben estar migrados)
        │
        └─► G (FK CarreraVersion → Plan) — depende de F (mejora de integridad, no bloqueante)
```

El Paso G es opcional para cerrar la BD — mejora la integridad pero no es prerequisito del flujo.

---

## 5. Lo que NO cambia

- El schema de `Plan` (tabla unificada del ciclo editorial) — ya está correcto.
- La lógica de `readPlanJson`: disco primero, `Plan.planJson` como fallback.
- `CarreraVersion` como ancla de FK para `UserPlanProgress`, `ScheduleBlock`, `UserRecentPlan` y `ProgressShare`.
- El `@@unique([slug, fuente, estado])` en `Plan`.
- Los archivos JSON en disco como fuente de verdad del contenido publicado.

---

## 6. Issues conocidos que quedan fuera de este plan

Estos temas están diagnosticados pero no se resuelven en esta migración:

- **`PlanVersion` deprecated** — sigue en el schema. Verificar si tiene datos antes de eliminar.
- **`esBackup` vs estado `ARCHIVADO`** — boolean por ahora; se puede evaluar moverlo al enum `PlanEstado` en un refactor posterior.
- **Múltiples versiones publicadas simultáneas** — el schema lo permite estructuralmente pero falta UX para exponerlo. `defaultCarreraVersionId` asume una sola versión activa por carrera.

---

## 7. Estado al cerrar la rama `feat/cerrar-bd-plan-carreraversion` (2026-05-26)

### 7.1 Qué se completó

| Paso | Descripción | Estado |
|---|---|---|
| A | Seed de `Carrera` + `CarreraVersion` desde `carreras.ts` | Completado en `main` (pull 2026-05-25) |
| B | `defaultVersionId` como FK real | Diferido — ver deuda técnica |
| C | `loadPlanData` lee de la BD | Completado en `main` (pull 2026-05-25) |
| D | `/api/planes` y `/api/admin/planes/publicados` sin `CarreraConfig` | Completado en `main` (pull 2026-05-25) |
| E | `/api/admin/planes/guardar` registra en `Carrera` + `CarreraVersion` | Completado en `main` (pull 2026-05-25) |
| F | `CarreraConfig` eliminada del schema y la BD | Completado en `main` (pull 2026-05-25) |
| G | FK nullable `CarreraVersion.planId → Plan` | Completado en esta rama |
| — | Backfill retroactivo de `planId` en las 19 `CarreraVersion` existentes | Completado en esta rama (script puntual, no migración) |

### 7.2 Estado del schema hoy

- `Plan` — tabla unificada del ciclo editorial. Fuente de verdad del contenido (la app lee `Plan.planJson`, ya no hay archivos en disco).
- `Carrera` + `CarreraVersion` — única fuente de metadatos. `CarreraVersion` ancla FK de progreso de usuario y ahora también apunta al `Plan` publicado que la respalda.
- `UserPlanProgress`, `ScheduleBlock`, `UserRecentPlan`, `ProgressShare` — todos tienen FK real a `CarreraVersion.id`.
- `CarreraConfig` — eliminada de schema y BD.
- `carreras.ts` — eliminado del código.

### 7.3 Deuda técnica residual

**1. `PlanVersion` deprecated sigue en el schema**

El modelo está marcado como `DEPRECATED` desde la migración `20260525_normalize_carreras`, que eliminó la tabla de la BD. La tabla ya no existe en producción (`P2021` al intentar consultarla), pero el modelo sigue en `schema.prisma`. No bloquea nada —Prisma no falla si el modelo existe en el schema pero la tabla fue eliminada manualmente— pero es ruido y puede confundir.

Acción: eliminar el bloque `model PlanVersion` del schema y generar una migración vacía (`--create-only`) solo para sincronizar el estado.

**2. `Carrera.defaultVersionId` es un string libre sin FK**

`defaultVersionId` guarda el string `"v1"` en lugar del CUID de `CarreraVersion`. No hay integridad referencial: si una versión se elimina o renombra, el campo queda apuntando a algo inexistente sin que la BD lo detecte.

El cambio no se hizo en esta rama porque todos los usos actuales comparan `defaultVersionId` contra `CarreraVersion.versionId` (el string), y cambiar a CUID requeriría reescribir `carreraRepository.getVersionForCarrera`, `publicados/route.ts` y el componente `PlanViewer`. No es urgente mientras no haya versiones que se eliminen o renombren.

Acción futura: cambiar `defaultVersionId String?` por `defaultCarreraVersionId String?` con FK a `CarreraVersion.id`, y actualizar los puntos de uso.

**3. `esBackup` como boolean en lugar de estado del enum**

`Plan.esBackup = true` con `estado = PUBLICADO` es semánticamente ambiguo. Un `ARCHIVADO` en `PlanEstado` expresaría lo mismo con más claridad y simplificaría queries que hoy filtran `esBackup: false` explícitamente.

No es urgente: la convención está documentada y el `@@index([slug, esBackup])` hace el filtro eficiente.

**4. `PUT /api/admin/planes/publicados/[slug]` no actualiza `CarreraVersion.planId` ⚠️**

Hoy el `PUT` muta `Plan.planJson` sobre el registro existente — el `planId` en `CarreraVersion` sigue apuntando al mismo `Plan`, lo cual es correcto.

El riesgo aparece si en algún momento "editar un plan publicado" pasa a significar "crear una nueva versión del `Plan`" en lugar de "mutar el existente". En ese caso, el `PUT` actual rompería la integridad construida en el paso G: se crearía un `Plan` nuevo sin actualizar `CarreraVersion.planId`, dejando la versión apuntando al registro anterior.

A diferencia de los otros tres puntos de deuda, este no es cosmético — es una trampa de regresión silenciosa. Cuando se diseñe la funcionalidad de "nueva versión desde edición", hay que revisar este endpoint y asegurarse de que el flujo de publicación pase siempre por `registrarCarreraEnDB` (o su equivalente) para mantener el vínculo.
