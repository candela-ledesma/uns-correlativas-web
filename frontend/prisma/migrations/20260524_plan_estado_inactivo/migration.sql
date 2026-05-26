-- Agrega INACTIVO al enum PlanEstado y elimina la columna publicado de Plan.
-- El estado INACTIVO reemplaza el uso previsto de publicado=false como soft-delete,
-- sin perder el historial ni requerir una segunda migration en el futuro.

ALTER TYPE "public"."PlanEstado" ADD VALUE 'INACTIVO';

ALTER TABLE "public"."Plan" DROP COLUMN "publicado";
