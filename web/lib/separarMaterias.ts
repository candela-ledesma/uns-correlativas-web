import { Materia } from "../app/types/plan";

export function separarMaterias(materias: Materia[]) {
  return {
    normales: materias.filter((m) => m.categoria === "normal"),
    optativas: materias.filter((m) => m.categoria === "optativa"),
    idiomas: materias.filter((m) => m.categoria === "idioma"),
    seminarios: materias.filter((m) => m.categoria === "seminario"),
  };
}