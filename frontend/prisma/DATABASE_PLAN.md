# Plan de normalización — base de datos

Fecha: 2026-05-24  
Rama: `feat/normalize-database-schema`  
Estado: plan aprobado, sin cambios aplicados aún.

---

## 1. Estado actual — tablas y relaciones

### 1.1 Mapa de relaciones

```
                        ┌─────────────────────────────────────────────────────────────┐
                        │                          User                               │
                        │  id · name · email · role · createdAt                      │
                        └──────────────────────┬──────────────────────────────────────┘
                                               │ 1
               ┌───────────────────────────────┼──────────────────────────────────────┐
               │                               │                                      │
               │ N                             │ N                                    │ N
    ┌──────────▼──────────┐       ┌────────────▼────────────┐           ┌─────────────▼──────────────┐
    │  UserCareerEnroll.  │       │    UserPlanProgress      │           │       UserActivity          │
    │  userId · careerId* │       │  userId · planId* ·      │           │  userId · type · careerId*  │
    │                     │       │  versionId* · stateJson  │           │  planId* · versionId*       │
    └─────────────────────┘       └─────────────────────────┘           └─────────────────────────────┘

               │ 1 (1-a-1)                     │ N                                    │ N
    ┌──────────▼──────────┐       ┌─────────────▼───────────┐           ┌─────────────▼──────────────┐
    │   UserPreference    │       │     UserRecentPlan       │           │       ScheduleBlock         │
    │  userId · activeC.* │       │  userId · careerId* ·    │           │  userId · careerId* ·       │
    │  onboarding...      │       │  planId* · versionId*    │           │  planId* · versionId*       │
    └─────────────────────┘       └─────────────────────────┘           └─────────────────────────────┘

               │ N                                                                     │ N (read-only)
    ┌──────────▼──────────┐
    │     AuditLog        │       ┌─────────────────────────┐           ┌─────────────────────────────┐
    │  actorUserId (FK?)  │       │      ProgressShare       │           │         Account             │
    │  actorEmail† ·      │       │  token · planId* ·       │           │  (NextAuth — no tocar)      │
    │  actorRole†         │       │  versionId* · stateJson† │           └─────────────────────────────┘
    └─────────────────────┘       └─────────────────────────┘
                                                                         ┌─────────────────────────────┐
                                                                         │         Session             │
    ┌────────────────────────────────────────────────────────────┐       │  (NextAuth — no tocar)      │
    │                    Tablas de planes                        │       └─────────────────────────────┘
    │                                                            │
    │  PlanBorrador      PlanPendiente      PlanPublicado        │       ┌─────────────────────────────┐
    │  slug · fuente*    slug               slug · fuente*       │       │     VerificationToken       │
    │  planJson          planJson           planJson             │       │  (NextAuth — no tocar)      │
    │  createdBy         submittedBy        savedBy              │       └─────────────────────────────┘
    │  (sin FK entre ellas — mismo objeto en distintos estados)  │
    └────────────────────────────────────────────────────────────┘
                                                                         ┌─────────────────────────────┐
    ┌────────────────────────────────────────────────────────────┐       │       CarreraConfig         │
    │                    AdminConfig                             │       │  id=slug · nombre ·         │
    │  id="singleton" · systemPrompt · genericPrompt            │       │  disponible                 │
    └────────────────────────────────────────────────────────────┘       │  (solo carreras dinámicas)  │
                                                                         └─────────────────────────────┘

  *  string suelto sin FK
  †  dato duplicado / copiado desde otra tabla
```

### 1.2 Descripción de cada tabla

#### Tablas de autenticación (NextAuth — no se modifican)

| Tabla | Propósito |
|-------|-----------|
| `User` | Usuario autenticado. Central del sistema — todas las tablas de usuario tienen FK a esta. |
| `Account` | Cuenta OAuth vinculada (Google). Gestión exclusiva de NextAuth. |
| `Session` | Sesión activa. Gestión exclusiva de NextAuth. |
| `VerificationToken` | Token de verificación de email. Gestión exclusiva de NextAuth. |

**Relaciones:** `Account`, `Session` → `User` (N-a-1, Cascade delete).

---

#### Tablas de perfil y actividad del usuario

**`UserCareerEnrollment`**  
Inscripciones del usuario a carreras. Una fila por `(userId, careerId)`.  
`careerId` es un string suelto (slug de la carrera, ej: `"ingenieria_civil"`) sin FK a ninguna tabla, porque las carreras estáticas no están en la base de datos.  
→ `User` (N-a-1, Cascade delete)

**`UserPreference`**  
Preferencias globales del usuario. Exactamente una fila por usuario (1-a-1 con `User`).  
Almacena la carrera activa seleccionada en el dashboard y los timestamps del flujo de onboarding.  
→ `User` (1-a-1, Cascade delete)

**`UserRecentPlan`**  
Último plan abierto por el usuario en cada carrera. Una fila por `(userId, careerId)`, con upsert en cada navegación.  
Se usa para mostrar "continuar donde lo dejaste".  
`planId`, `versionId` y `careerId` son strings sueltos sin FK.  
→ `User` (N-a-1, Cascade delete)

**`UserPlanProgress`**  
Estado del progreso del usuario en un plan específico. Una fila por `(userId, planId, versionId)`.  
`stateJson` es un objeto `{ [materiaId]: "aprobada" | "cursada" | "no_cursada" }` que se sobreescribe completo en cada sync.  
`planId` y `versionId` son strings sueltos sin FK.  
→ `User` (N-a-1, Cascade delete)

**`UserActivity`**  
Log append-only de eventos del usuario (marcar materia, abrir plan, completar onboarding, etc.).  
Nunca se modifica. Se usa en la pantalla de perfil para mostrar actividad reciente.  
Los campos `careerId`, `planId`, `versionId` son opcionales y dependen del tipo de evento.  
→ `User` (N-a-1, Cascade delete)

**`ScheduleBlock`**  
Bloques del planificador semanal de cuatrimestre. Cada fila es una materia ubicada en un día y rango horario.  
`dia` va de 0 (lunes) a 6 (domingo). `horaInicio` y `horaFin` son enteros en formato HHMM.  
`planId`, `versionId` y `careerId` son strings sueltos sin FK.  
→ `User` (N-a-1, Cascade delete)

**`ProgressShare`**  
Snapshot inmutable de progreso para compartir por URL pública (`/progreso/share/[token]`).  
Se crea copiando el `stateJson` desde el cliente en el momento de compartir. El link siempre muestra el estado de ese momento, aunque el usuario modifique su progreso después.  
`planId` y `versionId` son strings sueltos sin FK. `stateJson` es una copia del de `UserPlanProgress`.  
→ Sin FK a `User` (solo guarda `createdBy` como string nullable).

---

#### Tablas de planes (flujo admin)

Las tres tablas representan el mismo objeto —un plan de estudios— en distintos estados del ciclo de vida:

```
PDF → parsear → PlanBorrador (fuente: parser | gemini)
                     ↓ [admin elige cuál publicar]
             PlanPendiente (moderator envía a revisión)
                     ↓ [admin aprueba]
             PlanPublicado  ←→  CarreraConfig (se crea/actualiza en paralelo)
```

**`PlanBorrador`**  
Borrador generado automáticamente al parsear un PDF. Puede haber hasta dos por carrera: uno de fuente `"parser"` y otro de `"gemini"`, para comparar side-by-side.  
Clave única: `(slug, fuente)`.  
Sin FK entre sí ni hacia `PlanPublicado`. Sin relación con `User` (solo guarda `createdBy` como string).

**`PlanPendiente`**  
Cola de planes enviados por moderadores esperando aprobación. Máximo uno por carrera (slug único).  
`fuente` no es columna — se guarda dentro de `planJson` como campo `_fuente` (inconsistencia con las otras dos tablas).  
Sin relación con `User` (solo guarda `submittedBy` como string).

**`PlanPublicado`**  
Plan visible para los usuarios. Uno por carrera (slug único).  
Al actualizar un plan existente, el anterior se guarda como backup con slug `"{slug}_v1_backup"` — un hack dentro de esta misma tabla.  
`fuente` es `String` libre (`"parser"` | `"gemini"`), debería ser enum.  
Sin relación con `User` (solo guarda `savedBy` como string).

**`CarreraConfig`**  
Metadata de carreras dinámicas (agregadas desde el panel admin). `id` es el slug de la carrera.  
Las carreras estáticas hardcodeadas en `carreras.ts` **no tienen fila acá**.  
La API `/api/planes` mezcla ambas fuentes para devolver la lista completa.  
→ Sin FK desde otras tablas (las tablas de usuario usan `careerId` como string suelto).

---

#### Tablas de configuración y auditoría

**`AdminConfig`**  
Singleton (siempre `id = "singleton"`). Almacena los prompts que se envían a Gemini para parsear PDFs.  
Sin relaciones.

**`AuditLog`**  
Log append-only de acciones administrativas (publicar plan, cambiar rol, editar config, etc.).  
Nunca se modifica ni elimina.  
`actorEmail` y `actorRole` están desnormalizados intencionalmente: reflejan la identidad del actor en el momento del evento, no la actual.  
`actorUserId` es FK a `User` con `SET NULL` en delete — si el usuario se borra, el log se preserva con el email/rol copiados.  
→ `User` (N-a-1, SET NULL on delete)

---

### 1.3 Problemas identificados

| # | Problema | Tablas afectadas |
|---|----------|-----------------|
| P1 | `versionId`, `planId`, `careerId` como strings sueltos sin FK | `UserPlanProgress`, `UserRecentPlan`, `ScheduleBlock`, `ProgressShare`, `UserActivity` |
| P2 | Tres tablas para el mismo objeto (plan) en distintos estados | `PlanBorrador`, `PlanPendiente`, `PlanPublicado` |
| P3 | `stateJson` copiado desde el cliente al crear un share (riesgo de inconsistencia) | `ProgressShare` |
| P4 | `fuente` como string libre en lugar de enum | `PlanBorrador`, `PlanPublicado` |
| P5 | Backup de plan como `"{slug}_v1_backup"` dentro de `PlanPublicado` (sin versionado real) | `PlanPublicado` |

Los problemas P4, P5 se resuelven como parte de P2.  
P3 no requiere cambio de schema — solo cambio de lógica en un endpoint.

---

## 2. Estado objetivo — schema normalizado

### 2.1 Cambios por problema

#### P2 + P4 + P5 → Unificar tablas de planes en `Plan`

Reemplazar `PlanBorrador`, `PlanPendiente` y `PlanPublicado` por una única tabla `Plan`:

```prisma
enum PlanEstado {
  BORRADOR
  PENDIENTE
  PUBLICADO
}

enum PlanFuente {
  PARSER
  GEMINI
}

model Plan {
  id          String     @id @default(cuid())
  slug        String
  estado      PlanEstado
  fuente      PlanFuente
  planJson    String
  publicado   Boolean    @default(true)   // solo relevante cuando estado=PUBLICADO
  esBackup    Boolean    @default(false)  // reemplaza el hack "{slug}_v1_backup"
  autorId     String?                    // unifica createdBy/submittedBy/savedBy
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@unique([slug, fuente, estado])        // máximo un borrador por (slug, fuente)
  @@index([slug, estado])
  @@index([slug, esBackup])
}
```

**Mapeo de campos actuales → nuevos:**

| Tabla actual | Campo actual | Campo nuevo en `Plan` |
|---|---|---|
| `PlanBorrador` | `createdBy` | `autorId` |
| `PlanPendiente` | `submittedBy` | `autorId` |
| `PlanPublicado` | `savedBy` | `autorId` |
| `PlanPublicado` | `publicado` | `publicado` |
| `PlanPublicado` | `savedAt` | `createdAt` |
| `PlanPendiente` | `_fuente` (dentro de planJson) | `fuente` (columna) |
| hack `{slug}_v1_backup` | — | `esBackup = true` |

#### P1 → Crear `PlanVersion`

Crear una tabla que ancle los `versionId` que hoy flotan como strings en cuatro tablas:

```prisma
model PlanVersion {
  id        String   @id @default(cuid())
  planSlug  String                        // FK conceptual a CarreraConfig/Plan
  versionId String                        // el string de versión tal como existe hoy
  createdAt DateTime @default(now())

  progresses     UserPlanProgress[]
  recentPlans    UserRecentPlan[]
  scheduleBlocks ScheduleBlock[]
  shares         ProgressShare[]

  @@unique([planSlug, versionId])
}
```

Las tablas afectadas reemplazan `(planId, versionId)` por `planVersionId String` con FK a `PlanVersion.id`.

#### P3 → Leer stateJson desde DB al crear share

No requiere cambio de schema. En `POST /api/progreso/share`:
- leer `UserPlanProgress` para el `(userId, planId, versionId)` del request
- usar ese `stateJson` en lugar del que viene del body del cliente

---

### 2.2 Mapa de relaciones objetivo

```
                        ┌──────────────────────────────────────────┐
                        │                  User                    │
                        └──────────────┬───────────────────────────┘
                                       │ 1
          ┌────────────────────────────┼──────────────────────────────────┐
          │                            │                                  │
          │ N                          │ N                                │ N
┌─────────▼──────────┐    ┌────────────▼────────────┐      ┌─────────────▼──────────────┐
│ UserCareerEnroll.  │    │   UserPlanProgress       │      │      ScheduleBlock          │
│ userId · careerId* │    │  userId · planVersionId ─┼──┐   │  userId · planVersionId ───┼──┐
└────────────────────┘    └─────────────────────────┘  │   └─────────────────────────────┘  │
                                                        │                                    │
┌────────────────────┐    ┌─────────────────────────┐  │   ┌─────────────────────────────┐  │
│  UserPreference    │    │    UserRecentPlan        │  │   │       ProgressShare         │  │
│  userId            │    │  userId · planVersionId ─┼──┤   │  planVersionId ─────────────┼──┤
└────────────────────┘    └─────────────────────────┘  │   └─────────────────────────────┘  │
                                                        │                                    │
┌────────────────────┐    ┌─────────────────────────┐  └───►┌─────────────────────────────┐◄┘
│    UserActivity    │    │       AuditLog           │       │        PlanVersion          │
│  userId · careerId*│    │  actorUserId             │       │  id · planSlug · versionId  │
└────────────────────┘    └─────────────────────────┘       └─────────────┬───────────────┘
                                                                           │ N
                                                             ┌─────────────▼───────────────┐
                                                             │            Plan             │
                                                             │  slug · estado · fuente     │
                                                             │  planJson · esBackup        │
                                                             └─────────────────────────────┘

  * string suelto sin FK (no cambia en esta normalización)
```

---

## 3. Pasos de implementación

### Paso 1 — Corrección de `ProgressShare` (sin migración de schema)

**Alcance:** un solo endpoint.  
**Archivo:** `app/api/progreso/share/route.ts`  
**Cambio:** en el `POST`, ignorar el `stateJson` del body y leerlo desde `UserPlanProgress` usando `(userId, planId, versionId)`. Si no existe progreso guardado, devolver 404.

- Sin migración de Prisma.
- Sin impacto en datos existentes.
- Elimina el riesgo de que el cliente envíe un stateJson adulterado.

---

### Paso 2 — Enum `PlanFuente` y unificación de tablas de planes

**Alcance:** schema + migración + rutas API del panel admin.

**2a. Agregar enums al schema:**
```prisma
enum PlanEstado { BORRADOR PENDIENTE PUBLICADO }
enum PlanFuente { PARSER GEMINI }
```

**2b. Crear tabla `Plan` (nueva).**

**2c. Migración de datos:**
- Copiar todas las filas de `PlanBorrador` → `Plan` con `estado = BORRADOR`.
- Copiar todas las filas de `PlanPendiente` → `Plan` con `estado = PENDIENTE`, extrayendo `fuente` desde `planJson._fuente`.
- Copiar todas las filas de `PlanPublicado` → `Plan` con `estado = PUBLICADO`. Los slugs que terminan en `_v1_backup` se insertan con `esBackup = true`.

**2d. Actualizar rutas API** que leen/escriben `PlanBorrador`, `PlanPendiente` o `PlanPublicado`:
- `app/api/admin/planes/guardar/route.ts`
- `app/api/admin/planes/parsear/route.ts`
- `app/api/admin/planes/parsear-local/route.ts`
- `app/api/admin/planes/existe/route.ts`
- `app/api/admin/planes/pendientes/route.ts`
- `app/api/admin/planes/pendientes/[slug]/route.ts`
- `app/api/admin/planes/publicados/route.ts`
- `app/api/admin/planes/publicados/[slug]/route.ts`
- `app/api/admin/planes/enviar-revision/route.ts`
- `lib/data/planDataLoader.ts`

**2e. Eliminar tablas antiguas** una vez verificado que no hay referencias.

---

### Paso 3 — Tabla `PlanVersion` y FK en tablas de usuario

**Alcance:** schema + migración + rutas API de progreso y planificador.

**3a. Crear tabla `PlanVersion`** con `(planSlug, versionId)` único.

**3b. Poblar `PlanVersion`** con todos los `(planId, versionId)` distintos que existen hoy en:
- `UserPlanProgress`
- `UserRecentPlan`
- `ScheduleBlock`
- `ProgressShare`

**3c. Agregar columna `planVersionId`** en cada tabla afectada y llenarla con el `id` correspondiente de `PlanVersion`.

**3d. Eliminar columnas `planId` y `versionId`** de esas tablas una vez migradas.

**3e. Actualizar rutas API:**
- `app/api/progreso/route.ts`
- `app/api/progreso/sync/route.ts`
- `app/api/progreso/share/route.ts`
- `app/api/progreso/share/[token]/route.ts`
- `app/api/planificador/route.ts`
- `app/api/planificador/[id]/route.ts`
- `app/api/planificador/exportar-gcal/route.ts`
- `lib/db/progressRepository.ts`
- `lib/db/userProductContext.ts`

---

### Resumen de pasos

| Paso | Qué cambia | Schema | Migración de datos | Rutas API |
|------|-----------|--------|-------------------|-----------|
| 1 | `ProgressShare` lee desde DB | No | No | 1 endpoint |
| 2 | Unificar tablas de planes | Sí | Sí (3 tablas → 1) | ~10 archivos |
| 3 | `PlanVersion` + FK | Sí | Sí (poblar desde strings) | ~8 archivos |

**Orden:** 1 → 2 → 3. El paso 3 depende del paso 2 para saber a qué `Plan` apunta cada versión.
