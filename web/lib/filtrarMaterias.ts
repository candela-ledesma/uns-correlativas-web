import type { Agrupador, Materia } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { getMateriaViewModel } from "@/lib/materiaViewModel";

export type EstadoFiltro =
  | "todas"
  | "aprobadas"
  | "cursadas"
  | "disponibles"
  | "bloqueadas";

export type FiltrosPlan = {
  anio: string;
  cuatrimestre: string;
  estado: EstadoFiltro;
};

type Params = {
  materias: Materia[];
  estados: Record<string, EstadoMateria>;
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  filtros: FiltrosPlan;
};

export function filtrarMaterias({
  materias,
  estados,
  agrupadores,
  idsAgrupadores,
  filtros,
}: Params) {
  return materias.filter((materia) => {
    const vm = getMateriaViewModel({
      materia,
      estados,
      todasLasMaterias: materias,
      agrupadores,
      idsAgrupadores,
    });

    if (filtros.anio !== "todos" && materia.año !== filtros.anio) {
      return false;
    }

    if (
      filtros.cuatrimestre !== "todos" &&
      materia.cuatrimestre !== filtros.cuatrimestre
    ) {
      return false;
    }

    if (filtros.estado === "aprobadas") {
      return vm.estado === "aprobada";
    }

    if (filtros.estado === "cursadas") {
      return vm.estado === "cursada";
    }

    if (filtros.estado === "disponibles") {
      return vm.estado === "no_cursada" && vm.puedeCursar;
    }

    if (filtros.estado === "bloqueadas") {
      return vm.estado === "no_cursada" && vm.bloqueada;
    }

    return true;
  });
}