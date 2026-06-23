-- CreateIndex
CREATE INDEX IF NOT EXISTS "Plan_slug_estado_esBackup_idx" ON "Plan"("slug", "estado", "esBackup");
