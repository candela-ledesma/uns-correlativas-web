import type { Agrupador, Materia } from "@/app/types/plan";
import {
  cumpleNivel,
  estadoAgrupador,
  getEstadoMaximoPorMateria,
  getEstadoMateriaPorId,
} from "@/lib/plan/evaluarCorrelativas";
import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";

type RequisitoCorrelativa = {
  para_cursar: string | null;
  para_rendir: string | null;
};

export type CorrelativaDetalle = {
  id: string;
  nombre: string;
  paraCursar: string | null;
  paraRendir: string | null;
  esAgrupador: boolean;
  estadoActual: EstadoMateria;
  cumpleParaCursar: boolean;
  cumpleParaRendir: boolean;
};

export function obtenerCorrelativasMateria(
  materia: Materia,
  materias: Materia[],
  agrupadores: Agrupador[],
  estados: Record<string, EstadoMateria>
): CorrelativaDetalle[] {
  const correlativas = materia.correlativas || {};
  const estadoPorMateria = getEstadoMaximoPorMateria(estados);
  const idsAgrupadores = new Set(agrupadores.map((a) => String(a.id)));

  return Object.entries(correlativas)
    .map(([id, requisito]) => {
      const requisitoTipado = requisito as RequisitoCorrelativa;
      const materiaCorrelativa = materias.find((m) => String(m.id) === String(id));
      const esAgrupador = idsAgrupadores.has(String(id));

      const nombre = materiaCorrelativa?.nombre
        || agrupadores.find((a) => String(a.id) === String(id))?.nombre
        || `Materia ${id}`;

      const estadoActual = esAgrupador
        ? estadoAgrupador(String(id), agrupadores, estados)
        : (estadoPorMateria.get(String(id)) ?? "no_cursada");

      return {
        id: String(id),
        nombre,
        paraCursar: requisitoTipado.para_cursar,
        paraRendir: requisitoTipado.para_rendir,
        esAgrupador,
        estadoActual,
        cumpleParaCursar: cumpleNivel(estadoActual, requisitoTipado.para_cursar),
        cumpleParaRendir: cumpleNivel(estadoActual, requisitoTipado.para_rendir),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
