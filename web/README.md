# Web

Aplicacion Next.js para visualizar planes de estudio y correlativas.

## Comandos principales

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test -- --run
npm run test:e2e
```

## Multiusuario (Incremento 5)

Este incremento agrega:

- login por credenciales de desarrollo,
- sesiones seguras con NextAuth,
- sincronizacion de progreso por usuario en base de datos,
- roles (`USER`, `MODERATOR`, `ADMIN`) en backend,
- auditoria inmutable de cambios.

### Variables de entorno

Copiá `.env.example` a `.env.local` y completá:

```bash
DATABASE_URL="postgresql://usuario:password@host:5432/uns_correlativas?schema=public"
DATABASE_URL_E2E="postgresql://usuario:password@host:5432/uns_correlativas_e2e?schema=public"
NEXTAUTH_SECRET="un-secreto-largo"
NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="un-secreto-largo"
AUTH_URL="http://localhost:3000"

ADMIN_SEED_EMAIL="admin@uns.local"

# Solo desarrollo/tests
AUTH_ENABLE_DEV_LOGIN="true"
NEXT_PUBLIC_ENABLE_DEV_LOGIN="true"
AUTH_ALLOW_DEV_ROLE_OVERRIDE="true"
NEXT_PUBLIC_ALLOW_DEV_ROLE_OVERRIDE="true"
AUTH_DEV_LOGIN_EMAIL_ALLOWLIST=""
```

En produccion, el login de desarrollo queda deshabilitado por defecto salvo habilitacion explicita.

Para endurecer al maximo en produccion:

```bash
AUTH_ENABLE_DEV_LOGIN="false"
NEXT_PUBLIC_ENABLE_DEV_LOGIN="false"
AUTH_ALLOW_DEV_ROLE_OVERRIDE="false"
NEXT_PUBLIC_ALLOW_DEV_ROLE_OVERRIDE="false"
```

Si por soporte temporal necesitás habilitar dev-login en produccion, recomendacion minima:

```bash
AUTH_ENABLE_DEV_LOGIN="true"
NEXT_PUBLIC_ENABLE_DEV_LOGIN="true"
AUTH_ALLOW_DEV_ROLE_OVERRIDE="false"
NEXT_PUBLIC_ALLOW_DEV_ROLE_OVERRIDE="false"
AUTH_DEV_LOGIN_EMAIL_ALLOWLIST="admin@uns.local"
```

### Base de datos, migraciones y seed

Importante: Prisma CLI toma variables desde `.env`, no desde `.env.local`.
Creá `web/.env` con al menos `DATABASE_URL` para poder ejecutar migraciones y seed local.

```bash
npm run prisma:generate
npm run prisma:deploy
npm run db:seed
```

Para desarrollo local con historial de migraciones:

```bash
npm run prisma:migrate
```

### Matriz de permisos

- `USER`:
	- login/logout,
	- ver planes,
	- modificar solo su propio progreso,
	- sincronizar progreso con DB.
- `MODERATOR`:
	- todo lo de `USER`,
	- acceso a vista de moderacion,
	- consulta de auditoria de eventos operativos (sin cambios de rol).
- `ADMIN`:
	- todo lo de `MODERATOR`,
	- panel de administracion,
	- cambio de roles (motivo obligatorio),
	- acceso a auditoria global.

### Auditoria

Cada cambio relevante genera evento con:

- actor (`actorUserId`, `actorEmail`, `actorRole`),
- accion,
- entidad (`entityType`, `entityId`),
- `before` y `after`,
- `reason`,
- `createdAt`,
- `authProvider`.

Consulta por API:

```bash
GET /api/admin/auditoria?limit=50
```

### Sincronizacion y conflictos

Estrategia: **last-write-wins por timestamp**.

- En el primer login, se intenta migrar snapshot local a DB.
- Si hay conflicto entre local y remoto, gana el snapshot con timestamp mas nuevo.
- Se guarda una marca local para no repetir migracion inicial en cada sesión.

## Validacion de datos (Incremento 4)

El proyecto incluye un validador batch para todos los JSON de `data/` configurados en el manifest de carreras.

### Scripts

```bash
# reporte human-readable
npm run validate:data

# reporte machine-readable por stdout
npm run validate:data:json

# modo estricto (warnings tambien fallan)
npm run validate:data:strict

# flujo sugerido para pre-merge local
npm run check:premerge
```

### CLI avanzada

```bash
npm run validate:data -- --format=both --json-out=./tmp/data-validation.json
npm run validate:data -- --strict --include-hidden
npm run validate:data -- --data-dir=./data
```

Opciones disponibles:

- `--strict`: trata warnings como fallo.
- `--include-hidden`: incluye versiones ocultas del manifest.
- `--include-unavailable`: incluye versiones marcadas no disponibles.
- `--format=human|json|both`: formato de salida.
- `--json-out=<ruta>`: escribe reporte JSON a archivo.
- `--data-dir=<ruta>`: directorio de datos alternativo.

## Politica de severidades

- `critical` (bloqueante): shape invalido, IDs duplicados, referencias esenciales rotas.
- `medium` (warning): inconsistencias toleradas de legado o referencias cruzadas no bloqueantes.
- `low` (warning): calidad de datos no critica (por ejemplo carga horaria vacia).

Regla de exit code:

- Falla (`exit 1`) si hay issues `critical`.
- En modo `--strict`, tambien falla si hay `medium` o `low`.

## Reporte

El reporte incluye:

- resumen global por severidad
- conteo por tipo de issue
- detalle por carrera/version
- estado final (`PASS` o `FAIL`)
