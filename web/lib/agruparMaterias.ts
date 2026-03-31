import { Materia } from "../app/types/plan";

export function agruparMaterias(materias: Materia[]) {
  const agrupadas: Record<string, Record<string, Materia[]>> = {};

  for (const materia of materias) {
    const anio = materia.año || "Sin año";
    const cuatri = materia.cuatrimestre || "Sin cuatrimestre";

    if (!agrupadas[anio]) agrupadas[anio] = {};
    if (!agrupadas[anio][cuatri]) agrupadas[anio][cuatri] = [];

    agrupadas[anio][cuatri].push(materia);
  }

  return agrupadas;
}