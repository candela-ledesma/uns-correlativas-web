-- CreateEnum
CREATE TYPE "public"."PlanEstado" AS ENUM ('BORRADOR', 'PENDIENTE', 'PUBLICADO');

-- CreateEnum
CREATE TYPE "public"."PlanFuente" AS ENUM ('PARSER', 'GEMINI');

-- CreateTable
CREATE TABLE "public"."Plan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "estado" "public"."PlanEstado" NOT NULL,
    "fuente" "public"."PlanFuente" NOT NULL,
    "planJson" TEXT NOT NULL,
    "publicado" BOOLEAN NOT NULL DEFAULT true,
    "esBackup" BOOLEAN NOT NULL DEFAULT false,
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Plan_slug_estado_idx" ON "public"."Plan"("slug", "estado");

-- CreateIndex
CREATE INDEX "Plan_slug_esBackup_idx" ON "public"."Plan"("slug", "esBackup");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_slug_fuente_estado_key" ON "public"."Plan"("slug", "fuente", "estado");
