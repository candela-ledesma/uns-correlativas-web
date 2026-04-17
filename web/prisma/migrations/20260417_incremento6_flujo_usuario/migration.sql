-- CreateEnum
CREATE TYPE "UserActivityType" AS ENUM (
  'MATERIA_STATUS_CHANGED',
  'ACTIVE_CAREER_CHANGED',
  'PLAN_OPENED',
  'ONBOARDING_COMPLETED',
  'ONBOARDING_DISMISSED',
  'ONBOARDING_RESET'
);

-- CreateTable
CREATE TABLE "UserCareerEnrollment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "careerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserCareerEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
  "userId" TEXT NOT NULL,
  "activeCareerId" TEXT,
  "onboardingCompletedAt" TIMESTAMP(3),
  "onboardingDismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserRecentPlan" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "careerId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserRecentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "UserActivityType" NOT NULL,
  "careerId" TEXT,
  "planId" TEXT,
  "versionId" TEXT,
  "materiaKey" TEXT,
  "fromState" TEXT,
  "toState" TEXT,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCareerEnrollment_userId_careerId_key" ON "UserCareerEnrollment"("userId", "careerId");

-- CreateIndex
CREATE INDEX "UserCareerEnrollment_userId_createdAt_idx" ON "UserCareerEnrollment"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserRecentPlan_userId_careerId_key" ON "UserRecentPlan"("userId", "careerId");

-- CreateIndex
CREATE INDEX "UserRecentPlan_userId_openedAt_idx" ON "UserRecentPlan"("userId", "openedAt");

-- CreateIndex
CREATE INDEX "UserActivity_userId_createdAt_idx" ON "UserActivity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_userId_type_createdAt_idx" ON "UserActivity"("userId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "UserCareerEnrollment" ADD CONSTRAINT "UserCareerEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRecentPlan" ADD CONSTRAINT "UserRecentPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
