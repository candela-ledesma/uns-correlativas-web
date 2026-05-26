-- Paso G: FK nullable de CarreraVersion → Plan
-- Garantiza que no pueda existir una CarreraVersion sin un Plan publicado que la respalde.
-- nullable: versiones previas a esta migración quedan con planId = NULL.
-- onDelete: SetNull — si el Plan se elimina, la FK queda nula (no se pierde la CarreraVersion).

ALTER TABLE "public"."CarreraVersion"
    ADD COLUMN "planId" TEXT;

ALTER TABLE "public"."CarreraVersion"
    ADD CONSTRAINT "CarreraVersion_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CarreraVersion_planId_idx" ON "public"."CarreraVersion"("planId");
