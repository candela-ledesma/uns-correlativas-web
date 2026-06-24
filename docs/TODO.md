# TODO

> Prioridades: `alta` — `media` — `baja`

---

## Arquitectura y organización del código

### 1. ~~Unificar `lib/db/` y `lib/services/`~~ — completado

  `planRepository.ts` movido a `lib/db/planRepository.ts`. Imports actualizados en todos los handlers de `app/api/admin/planes/`. `lib/services/` queda solo para `geminiService.ts` y `parserService.ts`.

---

### 2. ~~Agregar helpers de auth para rutas de usuario~~ — completado

  `requireAuth()` agregado en `lib/auth/authz.ts` y aplicado a todos los handlers de `/api/perfil/*`, `/api/progreso/*` y `/api/planificador/*`. Los helpers `requireAdmin()`, `requireAdminOrModerator()` y `requireAdminReal()` se centralizaron en la misma sesión.

---

### 3. ~~Dividir `userProductContext.ts`~~ — completado

  `lib/db/userRepository.ts` creado con todo el CRUD de `UserPreference`, `PlanSeleccionado`, `UserRecentPlan`. `userProductContext.ts` reducido a ~110 líneas de orquestación pura.

---

### 4. ~~Auditar `lib/plan/planStorage.ts`~~ — descartado

  Auditado: `planStorage.ts` está en uso activo. Es el cache localStorage que `usePlanState` usa como buffer offline antes de sincronizar con Neon (carga inicial, guardado en cada cambio, migración de usuarios nuevos). No es código muerto.

---

### 5. ~~Tests unitarios para lógica de plan~~ — completado

  `frontend/test/calcularProgresoPlan.test.ts` creado con 8 tests de Vitest cubriendo estados vacíos, aprobadas/cursadas, optativas excluidas, agrupadores y plan completo. Suite total: 81 tests.

---

## Versionado de planes — panel admin

- `media` [ ] **Implementar "Guardar como nueva versión" en el flujo de publicación**

  Hoy la opción existe en la UI pero está deshabilitada: el backend siempre muta el `Plan` existente y hace upsert sobre `PlanVersion v1`, sin crear una segunda versión real. Ver diagnóstico completo en `web/prisma/PLAN_CARRERVERSION_MIGRATION.md §7.3 punto 4`.

  **Lo que debe hacer el flujo cuando `resolucion === "nueva_version"`:**
  1. Dejar `PlanVersion v1` y su `Plan` intactos
  2. Crear un `Plan` nuevo con `estado: PUBLICADO`
  3. Crear una `PlanVersion` nueva con `versionId: "v2"` apuntando al nuevo `Plan`
  4. Actualizar `Carrera.defaultVersionId` a `"v2"` para que la app sirva la nueva versión por defecto
  5. El progreso de usuarios en `v1` no se rompe — siguen anclados a su `PlanVersion`

  **Archivos a modificar:**
  - `web/app/api/admin/planes/guardar/route.ts` — lógica de publicación
  - `web/lib/db/carreraRepository.ts` — nueva función para crear versión sin upsert
  - `web/components/admin/tabs/GuardarPlanDrawer.tsx` — rehabilitar la opción (quitar `disabled: true`)

  **Prerequisito:** definir cómo se expone el selector de versiones en la web pública (`/planes/[carrera]`). Hoy `PlanViewer` recibe `versionOptions` pero la UX de selección no está diseñada para versiones coexistentes.

---


## Panel admin

- `media` [ ] **Validación de schema completo** — validar contra el schema completo de `PlanData` además de chequeos estructurales básicos.
- `media` [ ] **Eliminar carrera desde el admin borra en BD** — hoy la acción "eliminar" del panel solo desactiva el plan (estado=INACTIVO o disponible=false) pero deja filas huérfanas en `Carrera` y `PlanVersion`. Conectar esa acción a un delete real (o soft-delete con `disponible=false`) en `Carrera`, incluyendo la limpieza de `UserCareerEnrollment`, `UserRecentPlan` y `ScheduleBlock` asociados.

---

## Mapa de correlativas — UX y validación

- `media` [ ] **Validación del mapa** — completar validación de nodos, conexiones y estados contra el mismo ground truth del comparador.
- `media` [ ] **UX del mapa** — mejorar centrado inicial, hints de interacción (zoom/drag) y legibilidad.
- `baja` [ ] **Responsive mobile/tablet** — definir adaptación del grafo o fallback de solo desktop.


---

## Deuda técnica — parser local

- `baja` [ ] **Agrimensura (`5293`)** — `cuatrimestre` vuelve `null` y debería ser `"Anual"` (`issues/agrimensura.md`).
- `baja` [ ] **Agrimensura (`3616`)** — correlativas incorrectas; debería depender solo de `6323` (`issues/agrimensura.md`).

---

## Planes de estudio pendientes de generar

Carreras ya procesadas: abogacia, agrimensura, arquitectura, bioquimica, contador_publico, farmacia, ingenieria_civil, ingenieria_en_sistemas_de_informacion, lic_computacion, ingenieria_agronomica, ingenieria_electricista, ingenieria_en_computacion, ingenieria_mecanica, ingenieria_industrial, profesorado_en_letras, profesorado_en_filosofia, licenciatura_en_economia.

- [ ] INGENIERIA EN ALIMENTOS
- [ ] INGENIERÍA EN TELECOMUNICACIONES
- [ ] INGENIERIA QUIMICA
- [ ] LICENCIATURA EN ADMINISTRACION
- [ ] LICENCIATURA EN CIENCIAS AMBIENTALES
- [ ] LICENCIATURA EN CIENCIAS BIOLOGICAS
- [ ] LICENCIATURA EN CIENCIAS DE LA EDUCACION
- [ ] LICENCIATURA EN CIENCIAS GEOLOGICAS
- [ ] LICENCIATURA EN ENFERMERIA
- [ ] LICENCIATURA EN FILOSOFIA
- [ ] LICENCIATURA EN FISICA
- [ ] LICENCIATURA EN GEOFISICA
- [ ] LICENCIATURA EN GEOGRAFIA
- [ ] LICENCIATURA EN GESTIÓN UNIVERSITARIA
- [ ] LICENCIATURA EN HISTORIA
- [ ] LICENCIATURA EN LETRAS
- [ ] LICENCIATURA EN MATEMATICA
- [ ] LICENCIATURA EN MATEMATICA APLICADA
- [ ] LICENCIATURA EN OBSTETRICIA
- [ ] LICENCIATURA EN OCEANOGRAFIA
- [ ] LICENCIATURA EN OPTICA Y CONTACTOLOGÍA
- [ ] LICENCIATURA EN QUIMICA
- [ ] LICENCIATURA EN SEGURIDAD PÚBLICA
- [ ] LICENCIATURA EN TURISMO
- [ ] MEDICINA
- [ ] PROFESORADO DE EDUCACION INICIAL
- [ ] PROFESORADO DE EDUCACION PRIMARIA
- [ ] PROFESORADO EN CIENCIAS BIOLÓGICAS
- [ ] PROFESORADO EN ECONOMIA
- [ ] PROFESORADO EN ECONOMIA PARA LA ENSEÑANZA SECUNDARIA
- [ ] PROFESORADO EN EDUCACION SECUNDARIA EN CIENCIAS DE LA ADMINISTRACION
- [ ] PROFESORADO EN EDUCACION SECUNDARIA Y SUPERIOR EN CIENCIAS DE LA ADMINISTRACION
- [ ] PROFESORADO EN FISICA
- [ ] PROFESORADO EN GEOCIENCIAS
- [ ] PROFESORADO EN GEOGRAFIA
- [ ] PROFESORADO EN HISTORIA
- [ ] PROFESORADO EN MATEMATICA
- [ ] PROFESORADO EN QUIMICA
- [ ] PROFESORADO EN QUIMICA DE LA ENSEÑANZA MEDIA
- [ ] PROFESORADO UNIVERSITARIO EN GEOGRAFIA
- [ ] TECNICATURA SUPERIOR AGRARIA EN SUELOS Y AGUAS
- [ ] TECNICATURA SUPERIOR EN ADMINISTRACION Y GESTION DE RECURSOS
- [ ] TECNICATURA UNIVERSITARIA APICOLA
- [ ] TECNICATURA UNIVERSITARIA EN ACOMPAÑAMIENTO TERAPÉUTICO
- [ ] TECNICATURA UNIVERSITARIA EN CARTOGRAFIA, TELEDETECCION Y SIG
- [ ] TECNICATURA UNIVERSITARIA EN DEPORTE
- [ ] TECNICATURA UNIVERSITARIA EN ECONOMÍA Y GESTIÓN DE EMPRESAS ALIMENTARIAS
- [ ] TECNICATURA UNIVERSITARIA EN EMPRENDIMIENTOS AGROALIMENTARIOS
- [ ] TECNICATURA UNIVERSITARIA EN EMPRENDIMIENTOS AGROPECUARIOS
- [ ] TECNICATURA UNIVERSITARIA EN EMPRENDIMIENTOS AUDIOVISUALES
- [ ] TECNICATURA UNIVERSITARIA EN GESTION CULTURAL Y EMPRENDIMIENTOS CULTURALES
- [ ] TECNICATURA UNIVERSITARIA EN MANEJO Y COMERCIALIZACION DE GRANOS
- [ ] TECNICATURA UNIVERSITARIA EN MEDIO AMBIENTE
- [ ] TECNICATURA UNIVERSITARIA EN OCEANOGRAFÍA
- [ ] TECNICATURA UNIVERSITARIA EN OPERACIONES INDUSTRIALES
- [ ] TECNICATURA UNIVERSITARIA EN OPTICA
- [ ] TECNICATURA UNIVERSITARIA EN PARQUES Y JARDINES
- [ ] TECNICATURA UNIVERSITARIA EN PETRÓLEO Y GAS
- [ ] TECNICATURA UNIVERSITARIA EN PROGRAMACIÓN WEB Y MÓVIL
- [ ] TECNICATURA UNIVERSITARIA EN SISTEMAS ELECTRÓNICOS INDUSTRIALES INTELIGENTES
