-- Rename table CarreraVersion → PlanVersion
ALTER TABLE "CarreraVersion" RENAME TO "PlanVersion";

-- Rename FK columns in dependent tables
ALTER TABLE "UserPlanProgress"  RENAME COLUMN "carreraVersionId" TO "planVersionId";
ALTER TABLE "UserRecentPlan"    RENAME COLUMN "carreraVersionId" TO "planVersionId";
ALTER TABLE "ScheduleBlock"     RENAME COLUMN "carreraVersionId" TO "planVersionId";
ALTER TABLE "ProgressShare"     RENAME COLUMN "carreraVersionId" TO "planVersionId";

-- Rename indexes that reference the old column or table name
ALTER INDEX "CarreraVersion_carreraId_versionId_key" RENAME TO "PlanVersion_carreraId_versionId_key";
ALTER INDEX "CarreraVersion_carreraId_idx"           RENAME TO "PlanVersion_carreraId_idx";
ALTER INDEX "CarreraVersion_planId_idx"              RENAME TO "PlanVersion_planId_idx";

ALTER INDEX "UserPlanProgress_userId_carreraVersionId_key" RENAME TO "UserPlanProgress_userId_planVersionId_key";
ALTER INDEX "ScheduleBlock_userId_careerId_carreraVersionId_idx" RENAME TO "ScheduleBlock_userId_careerId_planVersionId_idx";
ALTER INDEX "ScheduleBlock_carreraVersionId_idx"     RENAME TO "ScheduleBlock_planVersionId_idx";
ALTER INDEX "UserRecentPlan_carreraVersionId_idx"    RENAME TO "UserRecentPlan_planVersionId_idx";
