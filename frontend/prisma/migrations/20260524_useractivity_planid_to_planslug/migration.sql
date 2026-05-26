-- Renombra planId → planSlug en UserActivity.
-- El campo almacena el slug de la carrera (ej: "arquitectura"), no un ID generado.
-- No es FK — es un string de contexto en un log inmutable.
ALTER TABLE "public"."UserActivity" RENAME COLUMN "planId" TO "planSlug";
