-- AlterTable
ALTER TABLE "public"."ProgressShare" ADD COLUMN     "planVersionId" TEXT;

-- AlterTable
ALTER TABLE "public"."ScheduleBlock" ADD COLUMN     "planVersionId" TEXT;

-- AlterTable
ALTER TABLE "public"."UserPlanProgress" ADD COLUMN     "planVersionId" TEXT;

-- AlterTable
ALTER TABLE "public"."UserRecentPlan" ADD COLUMN     "planVersionId" TEXT;

-- CreateTable
CREATE TABLE "public"."PlanVersion" (
    "id" TEXT NOT NULL,
    "planSlug" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanVersion_planSlug_idx" ON "public"."PlanVersion"("planSlug");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_planSlug_versionId_key" ON "public"."PlanVersion"("planSlug", "versionId");

-- CreateIndex
CREATE INDEX "ProgressShare_planVersionId_idx" ON "public"."ProgressShare"("planVersionId");

-- CreateIndex
CREATE INDEX "ScheduleBlock_planVersionId_idx" ON "public"."ScheduleBlock"("planVersionId");

-- CreateIndex
CREATE INDEX "UserPlanProgress_planVersionId_idx" ON "public"."UserPlanProgress"("planVersionId");

-- CreateIndex
CREATE INDEX "UserRecentPlan_planVersionId_idx" ON "public"."UserRecentPlan"("planVersionId");

-- AddForeignKey
ALTER TABLE "public"."UserRecentPlan" ADD CONSTRAINT "UserRecentPlan_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "public"."PlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPlanProgress" ADD CONSTRAINT "UserPlanProgress_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "public"."PlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "public"."PlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProgressShare" ADD CONSTRAINT "ProgressShare_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "public"."PlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
