-- Rename table CarreraSeleccionada → PlanSeleccionado
-- El rename es cosmético: el nombre anterior no reflejaba bien la semántica.
-- La FK sigue apuntando a Carrera.id (no a PlanVersion), lo cual es una
-- imprecisión conocida: no se puede rastrear qué versión del plan seleccionó
-- el usuario cuando una carrera tiene múltiples versiones.
ALTER TABLE "CarreraSeleccionada" RENAME TO "PlanSeleccionado";

-- Los índices heredan el nombre UserCareerEnrollment_* de la migración anterior
-- (20260526_rename_carrera_seleccionada solo renombró la tabla, no los índices)
ALTER INDEX "UserCareerEnrollment_pkey"                  RENAME TO "PlanSeleccionado_pkey";
ALTER INDEX "UserCareerEnrollment_userId_careerId_key"   RENAME TO "PlanSeleccionado_userId_careerId_key";
ALTER INDEX "UserCareerEnrollment_userId_createdAt_idx"  RENAME TO "PlanSeleccionado_userId_createdAt_idx";
