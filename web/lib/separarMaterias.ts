import { Materia } from "../app/types/plan";

export function separarMaterias(materias: Materia[]) {
  return {
    normales: materias.filter((m) => m.categoria === "normal"),
    optativas: materias.filter(
      (m) => m.categoria === "optativa" && m.grupo_opcion === "G2324"
    ),
    idiomas: materias.filter(
      (m) => m.categoria === "optativa" && m.grupo_opcion === "I2201"
    ),
  };
}