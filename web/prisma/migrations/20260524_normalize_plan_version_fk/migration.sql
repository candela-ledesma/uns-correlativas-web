-- Fase 1: Eliminar columnas planId y versionId de las 4 tablas de usuario.
-- planVersionId ya tiene backfill 100% y pasa a ser la única referencia al plan.

-- UserPlanProgress
-- Reemplazar unique index (userId, planId, versionId) por (userId, planVersionId)
DROP INDEX IF EXISTS "public"."UserPlanProgress_userId_planId_versionId_key";
ALTER TABLE "public"."UserPlanProgress" ALTER COLUMN "planVersionId" SET NOT NULL;
ALTER TABLE "public"."UserPlanProgress" DROP COLUMN "planId";
ALTER TABLE "public"."UserPlanProgress" DROP COLUMN "versionId";
ALTER TABLE "public"."UserPlanProgress" DROP CONSTRAINT IF EXISTS "UserPlanProgress_planVersionId_fkey";
CREATE UNIQUE INDEX "UserPlanProgress_userId_planVersionId_key" ON "public"."UserPlanProgress"("userId", "planVersionId");
DROP INDEX IF EXISTS "public"."UserPlanProgress_planVersionId_idx";
ALTER TABLE "public"."UserPlanProgress" ADD CONSTRAINT "UserPlanProgress_planVersionId_fkey"
  FOREIGN KEY ("planVersionId") REFERENCES "public"."PlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UserRecentPlan
ALTER TABLE "public"."UserRecentPlan" ALTER COLUMN "planVersionId" SET NOT NULL;
ALTER TABLE "public"."UserRecentPlan" DROP COLUMN "planId";
ALTER TABLE "public"."UserRecentPlan" DROP COLUMN "versionId";
ALTER TABLE "public"."UserRecentPlan" DROP CONSTRAINT IF EXISTS "UserRecentPlan_planVersionId_fkey";
DROP INDEX IF EXISTS "public"."UserRecentPlan_planVersionId_idx";
ALTER TABLE "public"."UserRecentPlan" ADD CONSTRAINT "UserRecentPlan_planVersionId_fkey"
  FOREIGN KEY ("planVersionId") REFERENCES "public"."PlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ScheduleBlock
ALTER TABLE "public"."ScheduleBlock" ALTER COLUMN "planVersionId" SET NOT NULL;
ALTER TABLE "public"."ScheduleBlock" DROP COLUMN "planId";
ALTER TABLE "public"."ScheduleBlock" DROP COLUMN "versionId";
ALTER TABLE "public"."ScheduleBlock" DROP CONSTRAINT IF EXISTS "ScheduleBlock_planVersionId_fkey";
DROP INDEX IF EXISTS "public"."ScheduleBlock_planVersionId_idx";
DROP INDEX IF EXISTS "public"."ScheduleBlock_userId_careerId_planId_versionId_idx";
CREATE INDEX "ScheduleBlock_userId_careerId_planVersionId_idx" ON "public"."ScheduleBlock"("userId", "careerId", "planVersionId");
CREATE INDEX "ScheduleBlock_planVersionId_idx" ON "public"."ScheduleBlock"("planVersionId");
ALTER TABLE "public"."ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_planVersionId_fkey"
  FOREIGN KEY ("planVersionId") REFERENCES "public"."PlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ProgressShare
ALTER TABLE "public"."ProgressShare" ALTER COLUMN "planVersionId" SET NOT NULL;
ALTER TABLE "public"."ProgressShare" DROP COLUMN "planId";
ALTER TABLE "public"."ProgressShare" DROP COLUMN "versionId";
ALTER TABLE "public"."ProgressShare" DROP CONSTRAINT IF EXISTS "ProgressShare_planVersionId_fkey";
DROP INDEX IF EXISTS "public"."ProgressShare_planVersionId_idx";
ALTER TABLE "public"."ProgressShare" ADD CONSTRAINT "ProgressShare_planVersionId_fkey"
  FOREIGN KEY ("planVersionId") REFERENCES "public"."PlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
