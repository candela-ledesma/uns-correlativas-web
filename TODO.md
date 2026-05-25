# TODO

> Prioridades: `alta` — `media` — `baja`

---

## Normalización BD — unificar fuentes de carreras

- `alta` [ ] **Fusionar `carreras.ts` + `CarreraConfig` (DB) + `PlanVersion` en dos tablas `Carrera` y `CarreraVersion`**

  Hoy las carreras viven en dos mundos: las estáticas están hardcodeadas en `carreras.ts` (con versiones, jsonFile, label, hidden), y las dinámicas (agregadas desde el admin) están en `CarreraConfig` en DB. `PlanVersion` es un tercer nodo que existe solo para FK de integridad. Los tres representan el mismo concepto.

  **Objetivo:** una sola fuente de verdad en DB. El admin puede crear carreras y versiones sin deploys. FKs reales desde `UserCareerEnrollment`, `UserRecentPlan` y todos los modelos de progreso.

  **Schema objetivo:**
  ```
  Carrera          { id (slug), nombre, descripcion, departamento?, defaultVersionId? → CarreraVersion.id, disponible }
  CarreraVersion   { id (cuid), carreraId → Carrera.id, versionId, label, jsonFile, disponible, hidden }
  ```
  `CarreraVersion` reemplaza tanto `PlanVersion` como `CarreraVersionConfig` de `carreras.ts`.
  `UserPlanProgress`, `ScheduleBlock`, `UserRecentPlan`, `ProgressShare` pasan a apuntar a `CarreraVersion.id`.

  **Impacto:**
  - Migración de datos: seed inicial con todas las carreras de `carreras.ts`
  - Eliminar `CarreraConfig` y `PlanVersion` del schema
  - Eliminar `carreras.ts` y reemplazar sus consumidores por queries a DB
  - `CarreraId` union type de TypeScript desaparece → pasa a ser `string`
  - Panel admin: CRUD de carreras y versiones

---

## Panel admin

- `media` [ ] **Validación de schema completo** — validar contra el schema completo de `PlanData` además de chequeos estructurales básicos.

---

## Mapa de correlativas — UX y validación

- `media` [ ] **Validación del mapa** — completar validación de nodos, conexiones y estados contra el mismo ground truth del comparador.
- `media` [ ] **UX del mapa** — mejorar centrado inicial, hints de interacción (zoom/drag) y legibilidad.
- `baja` [ ] **Responsive mobile/tablet** — definir adaptación del grafo o fallback de solo desktop.

---

## Google Calendar

- `baja` [x] **Variables de entorno** — documentar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `web/.env.example`.

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
