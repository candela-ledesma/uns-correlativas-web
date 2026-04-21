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
  orientacion: string;
};

type Params = {
  materias: Materia[];
  estados: Record<string, EstadoMateria>;
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  filtros: FiltrosPlan;
};

export function normalizarTextoBusqueda(valor: string) {
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
  const agrupadoresPorId = new Map(agrupadores.map((a) => [String(a.id), a]));

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

    if (filtros.orientacion !== "todas") {
      const idMateria = String(materia.id);
      const orientacionDirecta = materia.orientacion ?? null;
      const orientacionesDirectas = materia.orientaciones ?? null;
      const orientacionFiltro = normalizarTextoBusqueda(filtros.orientacion);
      const tieneOrientacionesDirectas =
        Array.isArray(orientacionesDirectas) && orientacionesDirectas.length > 0;

      if (tieneOrientacionesDirectas) {
        const coincide = orientacionesDirectas.some(
          (orientacion) => normalizarTextoBusqueda(orientacion) === orientacionFiltro
        );

        if (coincide) {
          return true;
        }
      } else if (orientacionDirecta) {
        const orientacionMateriaNormalizada = normalizarTextoBusqueda(orientacionDirecta);
        if (orientacionMateriaNormalizada === orientacionFiltro) {
          return true;
        }
      }

      // Buscar orientaciones en la materia misma (campos orientacion/orientaciones)
      // Si no encontró en la materia, buscar en agrupadores (para optativas)
      const grupoIdParaOrientacion = materia.grupo_opcion
        ? String(materia.grupo_opcion)
        : idsAgrupadores.has(idMateria)
          ? idMateria
          : null;

      const grupo = grupoIdParaOrientacion
        ? agrupadoresPorId.get(grupoIdParaOrientacion)
        : undefined;

      const orientacionGrupo =
        grupo?.tipo === "optativa_grupo" ? grupo.orientacion ?? null : null;

      if (orientacionGrupo) {
        const orientacionGrupoNormalizada = normalizarTextoBusqueda(orientacionGrupo);
        if (orientacionGrupoNormalizada === orientacionFiltro) {
          return true;
        }

        return false;
      }

        // Las materias comunes (sin orientación explícita o de agrupador) se muestran siempre.
      const esComun = !orientacionDirecta && !tieneOrientacionesDirectas;
      if (esComun) {
        return true;
      }

        // Materia no tiene esta orientación.
      return false;
    }

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