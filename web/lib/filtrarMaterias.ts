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
  const materiasPorId = new Map(materias.map((m) => [String(m.id), m]));

  return materias.filter((materia) => {
    const vm = getMateriaViewModel({
      materia,
      estados,
      todasLasMaterias: materias,
      agrupadores,
      idsAgrupadores,
    });

    // Para materias agrupadas (optativas/idiomas/seminarios), el año/cuatrimestre "real"
    // es el del agrupador (Gxxxx / etc). En algunos PDFs las opciones pueden venir con
    // año/cuatrimestre inconsistentes, y eso rompe el puntero + el render del grupo.
    const placeholder = materia.grupo_opcion
      ? materiasPorId.get(String(materia.grupo_opcion))
      : undefined;

    const anioParaFiltro = placeholder?.año ?? materia.año;
    const cuatrimestreParaFiltro = placeholder?.cuatrimestre ?? materia.cuatrimestre;

    if (filtros.anio !== "todos" && anioParaFiltro !== filtros.anio) {
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
      cuatrimestreParaFiltro !== filtros.cuatrimestre
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