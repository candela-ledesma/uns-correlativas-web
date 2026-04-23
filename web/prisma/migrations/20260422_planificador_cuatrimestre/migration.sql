-- CreateTable
CREATE TABLE "ScheduleBlock" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "careerId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "materiaNombre" TEXT NOT NULL,
  "materiaId" TEXT,
  "dia" INTEGER NOT NULL,
  "horaInicio" INTEGER NOT NULL,
  "horaFin" INTEGER NOT NULL,
  "comision" TEXT,
  "notas" TEXT,
  "color" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleBlock_userId_careerId_planId_versionId_idx" ON "ScheduleBlock"("userId", "careerId", "planId", "versionId");

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
