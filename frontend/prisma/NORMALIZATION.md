# Análisis de normalización — schema.prisma

Fecha: 2026-05-24  
Estado: análisis completo, sin cambios aplicados aún.

Este documento describe los cinco problemas de redundancia identificados, su impacto real
medido en el código, y una recomendación de acción para cada uno.

---

## Problema 1 — `versionId` duplicado en 4 tablas

### Descripción

`UserPlanProgress`, `UserRecentPlan`, `ScheduleBlock` y `ProgressShare` almacenan cada una
su propio `versionId` como `String` suelto. No existe ninguna tabla `PlanVersion` a la que
apunten: el string se copia en cada inserción sin validación referencial.

### Uso real en el código

Todas las tablas usan `versionId` como parte de su clave primaria compuesta o como filtro
obligatorio en los `WHERE`. No es un campo opcional: sin él no se puede leer ni escribir
ningún registro.

El problema es que `PlanPublicado` **no tiene `versionId`**. Las versiones de planes no
existen como entidad en la base de datos — el versionado está hardcodeado en el array
`CARRERAS` del código estático (`carreras.ts`). Entonces `versionId` en estas cuatro tablas
es un string que replica datos del código, no de la base de datos.

### Impacto

- Si una versión de plan cambia en el código pero no se migran los registros existentes,
  los usuarios pierden su progreso porque el `(planId, versionId)` ya no matchea.
- No hay forma de listar qué versiones existen sin leer el código fuente.
- No se puede saber si un `versionId` almacenado corresponde a una versión que todavía existe.

### Recomendación

**Crear tabla `PlanVersion`** que centralice las versiones y sirva de FK para las cuatro
tablas. Esto requiere también revisar cómo se genera `versionId` hoy (hardcodeado vs dinámico).

**Complejidad:** alta — implica migración de datos y cambios en múltiples rutas API.  
**Riesgo:** alto — afecta el mecanismo de recuperación de progreso del usuario.

---

## Problema 2 — `PlanPublicado`, `PlanBorrador` y `PlanPendiente` son la misma tabla

### Descripción

Las tres tablas representan distintos estados del mismo objeto (un plan de estudios) y
comparten exactamente los mismos campos de contenido: `slug`, `fuente`, `planJson`,
`createdBy`/`savedBy`/`submittedBy`. La separación es artificial: el estado del plan
(borrador / pendiente / publicado) debería ser un campo, no una tabla distinta.

### Diferencias reales entre las tablas

| Campo           | PlanBorrador        | PlanPendiente         | PlanPublicado         |
|-----------------|---------------------|-----------------------|-----------------------|
| `slug`          | `String`            | `String @unique`      | `String @unique`      |
| `fuente`        | `String`            | — (dentro de planJson)| `String`              |
| `planJson`      | `String`            | `String`              | `String`              |
| autor           | `createdBy String?` | `submittedBy String?` | `savedBy String?`     |
| timestamp autor | `createdAt`         | `createdAt`           | `savedAt`             |
| `publicado`     | —                   | —                     | `Boolean @default(true)` |

`PlanPendiente` no tiene columna `fuente` — la guarda dentro del `planJson` como campo
`_fuente`, lo cual es inconsistente con las otras dos tablas.

### Flujo real del ciclo de vida

```
PDF → parsear → PlanBorrador (parser) + PlanBorrador (gemini)
                      ↓ [admin elige uno]
              PlanPendiente (moderator envía a revisión)
                      ↓ [admin aprueba]
              PlanPublicado  ←→  CarreraConfig (se crea/actualiza en paralelo)
                      ↓ [admin actualiza]
              PlanPublicado con backup en slug "{slug}_v1_backup"
```

No hay transición de borrador a pendiente que esté modelada como relación — son filas
independientes en tablas distintas, sin FK entre ellas.

### Impacto

- Tres tablas para gestionar en vez de una.
- Nombres de campo inconsistentes (`createdBy` vs `submittedBy` vs `savedBy`) para la
  misma semántica.
- `PlanPendiente` guarda `fuente` dentro del JSON en lugar de como columna, lo que requiere
  parsear el JSON para saber de dónde vino el plan.
- El backup `{slug}_v1_backup` es un hack dentro de `PlanPublicado` — no hay versionado real.

### Recomendación

**Unificar en una tabla `Plan`** con columna `estado: enum(BORRADOR, PENDIENTE, PUBLICADO)`
y normalizar los nombres de campo. Absorbe también el hack del backup con un campo
`esCopiaDeSeguridad Boolean`.

**Complejidad:** media-alta — el flujo admin depende de las tres tablas; hay que migrar datos
y actualizar varias rutas.  
**Riesgo:** medio — el flujo admin es interno, no afecta a usuarios finales directamente.

---

## Problema 3 — `stateJson` duplicado entre `UserPlanProgress` y `ProgressShare`

### Descripción

Cuando un usuario comparte su progreso, la ruta `POST /api/progreso/share` copia el
`stateJson` entero desde `UserPlanProgress` hacia una nueva fila en `ProgressShare`.
Son dos strings JSON idénticos en el momento de la copia, en dos tablas distintas.

### Uso real en el código

**Creación del share** (`/app/api/progreso/share/route.ts`):
```typescript
// el cliente envía stateJson desde su estado local
await prisma.progressShare.create({
  data: { planId, versionId, stateJson: JSON.stringify(state), createdBy }
})
```

**Lectura del share** (`/app/api/progreso/share/[token]/route.ts`):
```typescript
const share = await prisma.progressShare.findUnique({ where: { token } })
// devuelve share.planId, share.versionId, share.stateJson
```

El share se crea con el `stateJson` que el cliente envía en el body de la request —
no se lee `UserPlanProgress` para generarlo. Eso significa que la fuente de verdad
al compartir es el estado local del cliente, no la base de datos.

### Análisis del "snapshot inmutable"

El comentario actual en el schema dice que el share es "una copia inmutable". Eso es
intencional: el usuario puede seguir modificando su progreso después de compartir, y
el link debe mostrar el estado en el momento en que se compartió, no el actual.

### Impacto

- Duplicación de datos: el mismo JSON puede existir en ambas tablas.
- Si la intención es realmente un snapshot inmutable, la duplicación **es correcta**
  y la alternativa (FK a `UserPlanProgress`) rompería esa inmutabilidad.
- Sin embargo, como el share se crea desde el estado del cliente (no desde la DB),
  hay un riesgo de inconsistencia: el cliente podría enviar un stateJson diferente al
  que está guardado en `UserPlanProgress`.

### Recomendación

**Depende del requisito de inmutabilidad:**

- Si el share debe ser siempre una foto del estado en ese momento → la duplicación es
  correcta y no debe cambiar. Solo agregar validación server-side para que el stateJson
  se lea desde `UserPlanProgress` en lugar de aceptarlo del cliente.

- Si el share puede ser dinámico (mostrar el progreso actual del usuario) → reemplazar
  `stateJson` por FK a `UserPlanProgress` y eliminar la copia.

**La recomendación es la primera opción**: mantener el snapshot, pero leerlo desde la DB
en lugar de confiar en el cliente. Eso elimina la inconsistencia sin cambiar la semántica.

**Complejidad:** baja — cambiar un endpoint para leer desde DB en lugar del body.  
**Riesgo:** bajo — no afecta datos existentes, solo la lógica de creación.

---

## Problema 4 — `careerId` redundante en `UserRecentPlan`

### Descripción

`UserRecentPlan` tiene `careerId` como parte de su clave única `(userId, careerId)`.
La pregunta es si ese dato es derivable desde otra tabla y por lo tanto redundante.

### Análisis real

`PlanPublicado` tiene `slug` que equivale al `careerId` de la carrera. Sin embargo:

- `UserRecentPlan.planId` no es un FK a `PlanPublicado.id` — es otro string suelto.
- No hay forma de ir de `UserRecentPlan.planId` → `PlanPublicado` sin conocer el slug.
- `careerId` **no** es redundante respecto a `PlanPublicado` porque no existe esa relación.

El `careerId` en `UserRecentPlan` existe por diseño: un usuario puede haber abierto un plan
de una carrera que luego fue eliminada de la base de datos. Si se derivara desde
`PlanPublicado`, esa historia se perdería al borrar el plan.

### Uso real en el código

`careerId` se usa como clave de agrupación en `userProductContext.ts`:
```typescript
// lastPlanByCareer: Record<careerId, { planId, versionId, openedAt }>
const result: Record<string, UserLastPlan> = {}
for (const r of recentPlans) {
  result[r.careerId] = { planId: r.planId, versionId: r.versionId, openedAt: r.openedAt }
}
```

Se necesita `careerId` para construir ese mapa. Si no estuviera en `UserRecentPlan`, habría
que obtenerlo de otra forma (join con `PlanPublicado`, o desde el código estático).

### Impacto

- `careerId` en `UserRecentPlan` no es redundante en el sentido estricto: no hay otra tabla
  de la que se pueda derivar sin romper el histórico.
- El problema real es que `careerId` **no tiene FK** a ninguna tabla, igual que en las
  otras tablas. Es un string suelto sin integridad referencial.

### Recomendación

**Este problema no es redundancia — es ausencia de FK.** El campo debe quedarse donde está.
La corrección correcta es parte del Problema 1: crear `PlanVersion` y establecer relaciones
formales entre las tablas de usuario y los planes.

**No requiere cambio de schema por sí solo.**

---

## Problema 5 — `actorEmail` y `actorRole` desnormalizados en `AuditLog`

### Descripción

`AuditLog` guarda `actorEmail` y `actorRole` como strings copiados desde `User` en el
momento de cada evento. Si el email del usuario cambia después, el log queda con el email
antiguo. Si el rol cambia, el log queda con el rol antiguo.

### Uso real en el código

Ninguna query filtra por `actorEmail` o `actorRole` directamente (confirmado por búsqueda
en el código). Solo se leen después de traer el registro para mostrarlos en la UI de auditoría.

El campo `actorUserId` existe y es FK a `User` (con `SET NULL` si se borra el usuario).
O sea: para usuarios que aún existen, se podría obtener el email y rol actuales haciendo
un join con `User`.

### Análisis de la desnormalización

El argumento original para copiar estos campos era: *"si el usuario se borra, se pierde
la identidad del actor"*. Eso es correcto — el `SET NULL` en `actorUserId` hace que la
FK quede nula al borrar el usuario.

Pero hay un problema adicional que el esquema actual no resuelve bien:

- El email en el log puede ser incorrecto si cambió después del evento.
- El rol en el log puede ser incorrecto si cambió después del evento (por ejemplo, un admin
  que luego fue degradado a USER aparece como ADMIN en logs históricos).

Para auditoría real, lo que importa es **qué rol tenía el actor en el momento del evento**,
no cuál tiene hoy. En ese sentido, copiar `actorRole` al momento del evento es correcto.
Para `actorEmail`, la misma lógica aplica: si alguien cambió su email, el log histórico
debería mostrar el email que tenía entonces.

### Impacto

- Los campos están desnormalizados intencionalmente y la desnormalización tiene justificación.
- El riesgo de inconsistencia no es un bug — es una característica del diseño de auditoría.
- No hay queries que filtren por ellos, así que la inconsistencia no afecta la lógica.

### Recomendación

**No cambiar.** La desnormalización es correcta para un log de auditoría. Lo que sí
conviene agregar es una nota explícita en el código de creación de eventos para asegurarse
de que `actorEmail` y `actorRole` siempre se lean de la sesión activa (no de la DB de User),
lo que garantiza que reflejen el estado en el momento del evento.

**No requiere cambio de schema.**

---

## Tabla de decisiones

| # | Problema | Acción | Prioridad | Complejidad | Riesgo |
|---|----------|--------|-----------|-------------|--------|
| 1 | `versionId` sin FK | Crear `PlanVersion` | Media | Alta | Alto |
| 2 | 3 tablas de planes | Unificar en `Plan` con `estado` enum | Alta | Media-alta | Medio |
| 3 | `stateJson` duplicado | Leer desde DB al crear share | Baja | Baja | Bajo |
| 4 | `careerId` en `UserRecentPlan` | No cambiar (no es redundancia real) | — | — | — |
| 5 | `actorEmail/Role` en `AuditLog` | No cambiar (desnormalización intencional) | — | — | — |

---

## Orden de ejecución sugerido

1. **Problema 3** (share desde DB) — cambio quirúrgico, sin migración, bajo riesgo.
2. **Problema 2** (unificar tablas de planes) — elimina complejidad del flujo admin, habilita versionado real.
3. **Problema 1** (crear `PlanVersion`) — depende de que el Problema 2 esté resuelto para saber dónde anclar las versiones.
