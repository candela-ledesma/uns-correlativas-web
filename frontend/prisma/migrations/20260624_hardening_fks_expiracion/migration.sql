-- FKs faltantes (las columnas ya existen, solo se agregan constraints)

ALTER TABLE "UserPreference"
  ADD CONSTRAINT "UserPreference_activeCareerId_fkey"
  FOREIGN KEY ("activeCareerId") REFERENCES "Carrera"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Plan"
  ADD CONSTRAINT "Plan_autorId_fkey"
  FOREIGN KEY ("autorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProgressShare"
  ADD CONSTRAINT "ProgressShare_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Expiración de tokens de share
ALTER TABLE "ProgressShare" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
CREATE INDEX "ProgressShare_expiresAt_idx" ON "ProgressShare"("expiresAt");

-- Tokens OAuth como TEXT (sin límite de longitud)
ALTER TABLE "Account" ALTER COLUMN "refresh_token" TYPE TEXT;
ALTER TABLE "Account" ALTER COLUMN "access_token" TYPE TEXT;
ALTER TABLE "Account" ALTER COLUMN "id_token" TYPE TEXT;
