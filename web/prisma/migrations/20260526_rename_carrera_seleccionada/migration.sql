-- Rename UserCareerEnrollment → CarreraSeleccionada
-- El nombre anterior ("enrollment") tenía connotaciones académicas formales que no
-- reflejan la semántica real: el usuario simplemente selecciona carreras para ver en su panel.

ALTER TABLE "UserCareerEnrollment" RENAME TO "CarreraSeleccionada";
