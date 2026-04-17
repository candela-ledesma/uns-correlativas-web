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

- login con Google (principal en produccion),
- sesiones seguras con NextAuth,
- sincronizacion de progreso por usuario en base de datos,
- roles (`USER`, `MODERATOR`, `ADMIN`) en backend,
- auditoria inmutable de cambios.

### Variables de entorno

Copiá `.env.example` a `.env.local` y completá:

```bash
DATABASE_URL="file:./prisma/dev.db"
AUTH_SECRET="un-secreto-largo"
AUTH_URL="http://localhost:3000"

AUTH_GOOGLE_CLIENT_ID="..."
AUTH_GOOGLE_CLIENT_SECRET="..."

ADMIN_SEED_EMAIL="admin@uns.local"

# Solo desarrollo/tests
AUTH_ENABLE_DEV_LOGIN="false"
NEXT_PUBLIC_ENABLE_DEV_LOGIN="false"
```

### Configurar Google OAuth

1. Crear credenciales OAuth 2.0 en Google Cloud Console.
2. Configurar callback:
	 - `http://localhost:3000/api/auth/callback/google` (local)
	 - `https://tu-dominio/api/auth/callback/google` (produccion)
3. Cargar `AUTH_GOOGLE_CLIENT_ID` y `AUTH_GOOGLE_CLIENT_SECRET`.

### Base de datos, migraciones y seed

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
