# UNS Correlativas — Web

Aplicación Next.js que permite a los estudiantes de la Universidad Nacional del Sur visualizar planes de estudio, registrar su progreso académico y explorar las correlativas entre materias.

## Qué hace el sistema

- **Planes de estudio**: visualización de materias por año y cuatrimestre, con sus correlativas.
- **Progreso personal**: cada usuario puede marcar materias como aprobadas o cursadas. El progreso se sincroniza con la base de datos y persiste entre sesiones.
- **Mapa de correlativas**: grafo interactivo que muestra dependencias entre materias y calcula el mejor camino de cursado.
- **Planificador semanal**: armado de horarios por cuatrimestre.
- **Panel admin**: subida de PDFs, procesamiento con IA (Gemini), revisión y publicación de planes de estudio.

## Stack

- **Framework**: Next.js 16 (App Router)
- **Base de datos**: PostgreSQL en [Neon](https://neon.tech), accedida con Prisma
- **Autenticación**: NextAuth v4 (Google OAuth + login de desarrollo)
- **IA**: Gemini (visión nativa sobre PDFs) para generar JSONs de planes de estudio
- **Tests**: Vitest (unitarios) + Playwright (E2E)

## Levantar en desarrollo

### 1. Variables de entorno

```bash
cp .env.example .env.local
```

Completar en `.env.local`:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | URL pooled de PostgreSQL (Neon/Supabase: usar pgBouncer) |
| `DIRECT_URL` | URL directa de PostgreSQL (requerida por Prisma para migraciones) |
| `AUTH_SECRET` | Secreto de NextAuth (cualquier string largo aleatorio) |
| `AUTH_URL` | URL base de la app (`http://localhost:3000` en desarrollo) |
| `ADMIN_SEED_EMAIL` | Email del primer usuario admin (se crea con `db:seed`) |
| `GEMINI_API_KEY` | API key de Google AI Studio (requerida para el panel admin) |

Variables opcionales para Google OAuth y login de desarrollo: ver `.env.example`.

### 2. Base de datos

```bash
# Aplicar migraciones y crear tablas
npm run db:prepare
```

`db:prepare` corre `prisma migrate deploy` + `db:seed`. El seed crea el usuario admin con el email de `ADMIN_SEED_EMAIL`.

> **Nota sobre Prisma CLI**: el CLI toma variables desde `.env`, no desde `.env.local`. Usar `npm run prisma:migrate:env` para correr migraciones en desarrollo local respetando `.env.local`.

### 3. Servidor de desarrollo

```bash
npm run dev
```

La app queda en `http://localhost:3000`.

## Comandos principales

```bash
npm run dev              # servidor de desarrollo
npm run build            # build de producción (incluye prisma generate)
npm run lint             # eslint
npm test -- --run        # tests unitarios (Vitest)
npm run test:e2e         # tests E2E (Playwright)
npm run check:premerge   # validación completa antes de mergear
npm run check:prod       # preflight de producción
```

## Estructura del proyecto

```
web/
├── app/                        # Next.js App Router — páginas y API routes
│   ├── api/
│   │   ├── admin/planes/       # Ciclo editorial: parsear, guardar, publicar
│   │   ├── progreso/           # Sync de progreso del usuario
│   │   └── planificador/       # Horarios semanales
│   └── planes/[carrera]/       # Página pública del plan de estudios
├── components/
│   ├── plan/                   # PlanViewer, PlanHeader, PlanFilters, PlanTabBar
│   ├── materias/               # MateriaCard, MateriasGrid, AnioSection
│   ├── kanban/                 # Vista kanban del plan
│   ├── mapa/                   # Grafo de correlativas (React Flow)
│   ├── schedule/               # Planificador semanal
│   └── admin/                  # Panel de administración
├── lib/
│   ├── plan/                   # Lógica de dominio: correlativas, estados, filtros
│   ├── mapa/                   # Lógica del grafo: graphUtils, bestPath
│   ├── data/                   # Carga y validación de planes
│   ├── db/                     # Capa de datos: prisma, audit, progreso, carreras
│   ├── services/               # Servicios de orquestación (entre handlers y repos)
│   │   ├── planRepository.ts   # Operaciones CRUD sobre Plan
│   │   ├── parserService.ts    # Parser Python local/remoto + comparar_json
│   │   └── geminiService.ts    # Google AI SDK + extracción de JSON + prompt activo
│   ├── utils/                  # Utilidades puras (slug, etc.)
│   └── auth/                   # Permisos: roles, authz
├── hooks/                      # usePlanState, useSchedule, useOnboarding
└── prisma/                     # Schema, migraciones y documentación de BD
```

## Arquitectura de datos

Los planes de estudio pasan por un ciclo editorial antes de ser visibles:

```
PDF → Gemini (visión nativa) → Plan.planJson (BORRADOR)
                                      ↓
                              revisión en panel admin
                                      ↓
                              Plan.planJson (PUBLICADO)
                                      ↓
                              CarreraVersion (ancla de progreso)
```

- `Plan` — tabla que contiene el JSON del plan durante todo el ciclo editorial. Una fila por estado (`BORRADOR`, `PENDIENTE`, `PUBLICADO`).
- `Carrera` + `CarreraVersion` — metadatos de la carrera y sus versiones de plan. `CarreraVersion` es el ancla estable a la que se conecta el progreso del usuario.
- `UserPlanProgress` — estado de cada materia por usuario, anclado a una `CarreraVersion` específica. Si se publica una nueva versión del plan, el progreso en la versión anterior no se pierde.

Documentación detallada del schema: `prisma/NORMALIZATION.md` y `prisma/PLAN_CARRERVERSION_MIGRATION.md`.

## Arquitectura de capas

Los route handlers de `app/api/admin/` son coordinadores puros (auth → input → servicio → respuesta). La lógica reside en:

| Capa | Ubicación | Qué hace |
|---|---|---|
| Dominio | `lib/plan/`, `lib/data/` | Lógica pura sin efectos de lado, testeada con Vitest |
| Servicios | `lib/services/` | Orquestación: `planRepository`, `parserService`, `geminiService` |
| Repositorios | `lib/db/` | Acceso a Prisma: carreras, audit, progreso |
| Utilidades | `lib/utils/` | Funciones puras (ej. `toSlug`) |

## Roles y permisos

| Rol | Capacidades |
|---|---|
| `USER` | Ver planes, registrar progreso propio, planificador |
| `MODERATOR` | Todo lo de USER + enviar planes a revisión |
| `ADMIN` | Todo lo de MODERATOR + panel admin, publicar planes, gestionar usuarios |

## Panel admin

Accesible en `/admin` para usuarios con rol `ADMIN`. Permite:

1. Subir un PDF de plan de estudios
2. Procesarlo con el parser local (Python) y/o con Gemini
3. Comparar ambos resultados side-by-side
4. Publicar el plan elegido

El JSON publicado queda en `Plan.planJson` con `estado = PUBLICADO` y se crea o actualiza la `CarreraVersion` correspondiente.

## Validación de datos

```bash
npm run validate:data            # reporte legible
npm run validate:data:strict     # falla también en warnings
npm run validate:data:json       # salida JSON para scripts
```

Severidades:

- `critical` — shape inválido, IDs duplicados, referencias rotas. Bloquea el build.
- `medium` / `low` — inconsistencias toleradas. Bloquean solo en modo `--strict`.

## Deploy

Antes de cada deploy:

```bash
npm run check:prod
```

Verifica variables de entorno críticas, genera el cliente Prisma, corre lint, tests unitarios y build. Para producción, usar `.env.production.example` como base y asegurarse de que `AUTH_ENABLE_DEV_LOGIN=false`.
