import { Agrupador, Materia } from "@/app/types/plan";
import {
  EstadoMateria,
  estaHabilitadaParaCursar,
  estaHabilitadaParaAprobar,
  estadoAgrupador,
} from "@/lib/plan/evaluarCorrelativas";
import { getEstadoKey } from "@/lib/plan/estadoKey";

type Params = {
  materia: Materia;
  estados: Record<string, EstadoMateria>;
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  grupoIdRender?: string;
};

export type MateriaViewModel = {
  esAgrupador: boolean;
  estado: EstadoMateria;
  puedeCursar: boolean;
  puedeAprobar: boolean;
  puedeClickear: boolean;
  bloqueada: boolean;
  bloqueadaPorGrupo: boolean;
  testId: string;
  dataEstado: EstadoMateria;
  dataHabilitada: "si" | "no";
  dataPuedeAprobar: "si" | "no";
};

function grupoYaElegido(
  materia: Materia,
  estados: Record<string, EstadoMateria>,
  grupoIdRender?: string
) {
  if (!grupoIdRender) return false;

  const materiaId = String(materia.id);

  return Object.entries(estados).some(([key, estado]) => {
    if (!key.startsWith(`${grupoIdRender}::`)) return false;
    if (key === `${grupoIdRender}::${materiaId}`) return false;

    return estado === "cursada" || estado === "aprobada";
  });
}

export function materiaElegidaEnOtroGrupo(
  materia: Materia,
  estados: Record<string, EstadoMateria>,
  grupoIdRender?: string
) {
  if (!grupoIdRender) return false;

  const materiaId = String(materia.id);

  return Object.entries(estados).some(([key, estado]) => {
    if (!key.includes("::")) return false;

    const [otroGrupoId, otroMateriaId] = key.split("::");

    if (otroGrupoId === grupoIdRender) return false;
    if (otroMateriaId !== materiaId) return false;

    return estado === "cursada" || estado === "aprobada";
  });
}

export function getMateriaViewModel({
  materia,
  estados,
  agrupadores,
  idsAgrupadores,
  grupoIdRender,
}: Params): MateriaViewModel {
  const materiaId = String(materia.id);
  const esAgrupador = idsAgrupadores.has(materiaId);

  const estado = esAgrupador
    ? estadoAgrupador(materiaId, agrupadores, estados)
    : estados[getEstadoKey(materia, grupoIdRender)] || "no_cursada";

  const puedeCursar = estaHabilitadaParaCursar(materia, estados, agrupadores);

  const puedeAprobar = estaHabilitadaParaAprobar(materia, estados, agrupadores);

  const bloqueadaPorGrupo =
    !esAgrupador &&
    estado === "no_cursada" &&
    grupoYaElegido(materia, estados, grupoIdRender);

  const bloqueadaPorMateriaRepetida =
    !esAgrupador &&
    estado === "no_cursada" &&
    materiaElegidaEnOtroGrupo(materia, estados, grupoIdRender);

  const bloqueada =
    (!puedeCursar && estado === "no_cursada" && !esAgrupador) ||
    bloqueadaPorGrupo ||
    bloqueadaPorMateriaRepetida;

  const puedeClickear =
    estado === "cursada" ||
    (estado === "no_cursada" && !bloqueada);

  return {
    esAgrupador,
    estado,
    puedeCursar,
    puedeAprobar,
    puedeClickear,
    bloqueada,
    bloqueadaPorGrupo,
    testId: `materia-${grupoIdRender ? `${grupoIdRender}-` : ""}${materia.id}`,
    dataEstado: estado,
    dataHabilitada: puedeCursar ? "si" : "no",
    dataPuedeAprobar: puedeAprobar ? "si" : "no",
  };
}