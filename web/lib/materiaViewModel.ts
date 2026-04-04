import { Agrupador, Materia } from "@/app/types/plan";
import {
    EstadoMateria,
    estaHabilitada,
    estadoAgrupador,
} from "@/lib/evaluarCorrelativas";
import { getEstadoKey } from "@/lib/estadoKey";

type Params = {
    materia: Materia;
    estados: Record<string, EstadoMateria>;
    todasLasMaterias: Materia[];
    agrupadores: Agrupador[];
    idsAgrupadores: Set<string>;
    grupoIdRender?: string;
};

export type MateriaViewModel = {
    esAgrupador: boolean;
    estado: EstadoMateria;
    habilitada: boolean;
    bloqueada: boolean;
    bloqueadaPorGrupo: boolean;
    testId: string;
    dataEstado: EstadoMateria;
    dataHabilitada: "si" | "no";
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

export function getMateriaViewModel({
  materia,
  estados,
  todasLasMaterias,
  agrupadores,
  idsAgrupadores,
  grupoIdRender,
}: Params): MateriaViewModel {
  const materiaId = String(materia.id);
  const esAgrupador = idsAgrupadores.has(materiaId);

  const estado = esAgrupador
    ? estadoAgrupador(materiaId, agrupadores, estados)
    : estados[getEstadoKey(materia, grupoIdRender)] || "no_cursada";

  const habilitada = estaHabilitada(
    materia,
    estados,
    todasLasMaterias,
    agrupadores,
    grupoIdRender
  );

  const bloqueadaPorGrupo =
    !esAgrupador &&
    estado === "no_cursada" &&
    grupoYaElegido(materia, estados, grupoIdRender);

  const bloqueada =
    (!habilitada && estado === "no_cursada" && !esAgrupador) || bloqueadaPorGrupo;

  return {
    esAgrupador,
    estado,
    habilitada,
    bloqueada,
    bloqueadaPorGrupo,
    testId: `materia-${grupoIdRender ? `${grupoIdRender}-` : ""}${materia.id}`,
    dataEstado: estado,
    dataHabilitada: habilitada ? "si" : "no",
  };
}