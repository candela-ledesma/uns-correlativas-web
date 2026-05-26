-- Normalización completa de BD: unificar fuentes de carreras
-- Crea Carrera + CarreraVersion, migra datos desde CarreraConfig + PlanVersion,
-- actualiza FKs en todas las tablas de usuario, elimina tablas deprecated.

-- ============================================================
-- 1. Crear tabla Carrera
-- ============================================================
CREATE TABLE "public"."Carrera" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT 'Plan de estudios y correlativas.',
    "departamento" TEXT,
    "defaultVersionId" TEXT,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Carrera_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Carrera_disponible_idx" ON "public"."Carrera"("disponible");

-- ============================================================
-- 2. Crear tabla CarreraVersion
-- ============================================================
CREATE TABLE "public"."CarreraVersion" (
    "id" TEXT NOT NULL,
    "carreraId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "jsonFile" TEXT NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarreraVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CarreraVersion_carreraId_versionId_key" ON "public"."CarreraVersion"("carreraId", "versionId");
CREATE INDEX "CarreraVersion_carreraId_idx" ON "public"."CarreraVersion"("carreraId");

ALTER TABLE "public"."CarreraVersion"
    ADD CONSTRAINT "CarreraVersion_carreraId_fkey"
    FOREIGN KEY ("carreraId") REFERENCES "public"."Carrera"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 3. Migrar datos CarreraConfig → Carrera
-- ============================================================
INSERT INTO "public"."Carrera" ("id", "nombre", "descripcion", "departamento", "disponible", "createdAt", "updatedAt")
SELECT "id", "nombre", "descripcion", "departamento", "disponible", "createdAt", "updatedAt"
FROM "public"."CarreraConfig";

-- ============================================================
-- 3b. Insertar en Carrera las carreras que tienen PlanVersion
--     pero NO tienen fila en CarreraConfig (slugs históricos/alias).
--     Usamos ON CONFLICT DO NOTHING para no duplicar las ya migradas.
-- ============================================================
INSERT INTO "public"."Carrera" ("id", "nombre", "descripcion", "disponible", "createdAt", "updatedAt")
SELECT DISTINCT
    pv."planSlug",
    pv."planSlug",   -- nombre temporal = slug (el admin puede corregirlo luego)
    'Plan de estudios y correlativas.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "public"."PlanVersion" pv
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."Carrera" c WHERE c."id" = pv."planSlug"
)
ON CONFLICT ("id") DO NOTHING;

-- ============================================================
-- 4. Migrar datos PlanVersion → CarreraVersion
--    - La carreraId viene de PlanVersion.planSlug
--    - Todas las PlanVersion se migran (ahora todas tienen Carrera)
--    - jsonFile se obtiene de CarreraConfig si existe, o se genera como "{planSlug}.json"
--    - label por defecto "Plan actual"
-- ============================================================
INSERT INTO "public"."CarreraVersion" ("id", "carreraId", "versionId", "label", "jsonFile", "disponible", "hidden", "createdAt")
SELECT
    pv."id",
    pv."planSlug",
    pv."versionId",
    'Plan actual',
    COALESCE(cc."jsonFile", pv."planSlug" || '.json'),
    true,
    false,
    pv."createdAt"
FROM "public"."PlanVersion" pv
LEFT JOIN "public"."CarreraConfig" cc ON cc."id" = pv."planSlug";

-- ============================================================
-- 5. Agregar columna carreraVersionId a los 4 modelos afectados
-- ============================================================
ALTER TABLE "public"."UserPlanProgress" ADD COLUMN "carreraVersionId" TEXT;
ALTER TABLE "public"."UserRecentPlan"   ADD COLUMN "carreraVersionId" TEXT;
ALTER TABLE "public"."ScheduleBlock"    ADD COLUMN "carreraVersionId" TEXT;
ALTER TABLE "public"."ProgressShare"    ADD COLUMN "carreraVersionId" TEXT;

-- ============================================================
-- 6. Poblar carreraVersionId desde planVersionId
--    (los IDs son los mismos porque copiamos PlanVersion con el mismo id)
-- ============================================================
UPDATE "public"."UserPlanProgress"
SET "carreraVersionId" = "planVersionId"
WHERE "planVersionId" IS NOT NULL;

UPDATE "public"."UserRecentPlan"
SET "carreraVersionId" = "planVersionId"
WHERE "planVersionId" IS NOT NULL;

UPDATE "public"."ScheduleBlock"
SET "carreraVersionId" = "planVersionId"
WHERE "planVersionId" IS NOT NULL;

UPDATE "public"."ProgressShare"
SET "carreraVersionId" = "planVersionId"
WHERE "planVersionId" IS NOT NULL;

-- ============================================================
-- 7. Agregar FKs de carreraVersionId → CarreraVersion
--    (solo para filas que tienen carreraVersionId válido)
-- ============================================================
ALTER TABLE "public"."UserPlanProgress"
    ADD CONSTRAINT "UserPlanProgress_carreraVersionId_fkey"
    FOREIGN KEY ("carreraVersionId") REFERENCES "public"."CarreraVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."UserRecentPlan"
    ADD CONSTRAINT "UserRecentPlan_carreraVersionId_fkey"
    FOREIGN KEY ("carreraVersionId") REFERENCES "public"."CarreraVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ScheduleBlock"
    ADD CONSTRAINT "ScheduleBlock_carreraVersionId_fkey"
    FOREIGN KEY ("carreraVersionId") REFERENCES "public"."CarreraVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ProgressShare"
    ADD CONSTRAINT "ProgressShare_carreraVersionId_fkey"
    FOREIGN KEY ("carreraVersionId") REFERENCES "public"."CarreraVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 8. Agregar FKs de careerId → Carrera
--    en UserCareerEnrollment, UserRecentPlan, ScheduleBlock
--    Solo para filas cuyo careerId existe en Carrera
-- ============================================================
ALTER TABLE "public"."UserCareerEnrollment"
    ADD CONSTRAINT "UserCareerEnrollment_careerId_fkey"
    FOREIGN KEY ("careerId") REFERENCES "public"."Carrera"("id") ON UPDATE CASCADE;

ALTER TABLE "public"."UserRecentPlan"
    ADD CONSTRAINT "UserRecentPlan_careerId_fkey"
    FOREIGN KEY ("careerId") REFERENCES "public"."Carrera"("id") ON UPDATE CASCADE;

ALTER TABLE "public"."ScheduleBlock"
    ADD CONSTRAINT "ScheduleBlock_careerId_fkey"
    FOREIGN KEY ("careerId") REFERENCES "public"."Carrera"("id") ON UPDATE CASCADE;

-- ============================================================
-- 9. Agregar índices en carreraVersionId
-- ============================================================
CREATE INDEX IF NOT EXISTS "UserPlanProgress_userId_updatedAt_idx" ON "public"."UserPlanProgress"("userId", "updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "UserPlanProgress_userId_carreraVersionId_key" ON "public"."UserPlanProgress"("userId", "carreraVersionId");

CREATE INDEX IF NOT EXISTS "UserRecentPlan_userId_openedAt_idx" ON "public"."UserRecentPlan"("userId", "openedAt");
CREATE INDEX IF NOT EXISTS "UserRecentPlan_carreraVersionId_idx" ON "public"."UserRecentPlan"("carreraVersionId");

CREATE INDEX IF NOT EXISTS "ScheduleBlock_userId_careerId_carreraVersionId_idx" ON "public"."ScheduleBlock"("userId", "careerId", "carreraVersionId");
CREATE INDEX IF NOT EXISTS "ScheduleBlock_carreraVersionId_idx" ON "public"."ScheduleBlock"("carreraVersionId");

CREATE INDEX IF NOT EXISTS "ProgressShare_carreraVersionId_idx" ON "public"."ProgressShare"("carreraVersionId");

-- ============================================================
-- 10. Eliminar FKs y columnas planVersionId viejas
-- ============================================================
ALTER TABLE "public"."UserPlanProgress"
    DROP CONSTRAINT IF EXISTS "UserPlanProgress_planVersionId_fkey";
ALTER TABLE "public"."UserPlanProgress"
    DROP CONSTRAINT IF EXISTS "UserPlanProgress_userId_planVersionId_key";

ALTER TABLE "public"."UserRecentPlan"
    DROP CONSTRAINT IF EXISTS "UserRecentPlan_planVersionId_fkey";
DROP INDEX IF EXISTS "public"."UserRecentPlan_planVersionId_idx";

ALTER TABLE "public"."ScheduleBlock"
    DROP CONSTRAINT IF EXISTS "ScheduleBlock_planVersionId_fkey";
DROP INDEX IF EXISTS "public"."ScheduleBlock_planVersionId_idx";
DROP INDEX IF EXISTS "public"."ScheduleBlock_userId_careerId_planVersionId_idx";

ALTER TABLE "public"."ProgressShare"
    DROP CONSTRAINT IF EXISTS "ProgressShare_planVersionId_fkey";
DROP INDEX IF EXISTS "public"."ProgressShare_planVersionId_idx";

ALTER TABLE "public"."UserPlanProgress" DROP COLUMN IF EXISTS "planVersionId";
ALTER TABLE "public"."UserRecentPlan"   DROP COLUMN IF EXISTS "planVersionId";
ALTER TABLE "public"."ScheduleBlock"    DROP COLUMN IF EXISTS "planVersionId";
ALTER TABLE "public"."ProgressShare"    DROP COLUMN IF EXISTS "planVersionId";

-- ============================================================
-- 11. Eliminar tablas deprecated
-- ============================================================
DROP TABLE IF EXISTS "public"."PlanVersion";
DROP TABLE IF EXISTS "public"."CarreraConfig";
