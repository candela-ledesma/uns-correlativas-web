import { Materia } from "../app/types/plan";

export function separarMaterias(materias: Materia[]) {
  const normales = materias.filter(
    (m) => m.categoria === "normal"
  );

  return { normales };
}