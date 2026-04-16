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
  codigo: string;
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

function normalizarTextoBusqueda(valor: string) {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

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

    const busqueda = normalizarTextoBusqueda(filtros.codigo);
    if (busqueda !== "") {
      const idMateria = normalizarTextoBusqueda(String(materia.id));
      const nombreMateria = normalizarTextoBusqueda(materia.nombre);
      const coincide =
        idMateria.includes(busqueda) || nombreMateria.includes(busqueda);

      if (!coincide) return false;
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