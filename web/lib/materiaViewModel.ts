import { Materia } from "@/app/types/plan";
import {
  EstadoMateria,
  estaHabilitada,
  estadoAgrupador,
} from "@/lib/evaluarCorrelativas";

type Params = {
  materia: Materia;
  estados: Record<string, EstadoMateria>;
  todasLasMaterias: Materia[];
  idsAgrupadores: Set<string>;
};

export type MateriaViewModel = {
  esAgrupador: boolean;
  estado: EstadoMateria;
  habilitada: boolean;
  bloqueada: boolean;
  testId: string;
  dataEstado: EstadoMateria;
  dataHabilitada: "si" | "no";
};

export function getMateriaViewModel({
  materia,
  estados,
  todasLasMaterias,
  idsAgrupadores,
}: Params): MateriaViewModel {
  const esAgrupador = idsAgrupadores.has(materia.id);

  const estado = esAgrupador
    ? estadoAgrupador(materia.id, todasLasMaterias, estados)
    : estados[materia.id] || "no_cursada";

  const habilitada = estaHabilitada(materia, estados, todasLasMaterias);

  const bloqueada = !habilitada && estado === "no_cursada" && !esAgrupador;

  return {
    esAgrupador,
    estado,
    habilitada,
    bloqueada,
    testId: `materia-${materia.id}`,
    dataEstado: estado,
    dataHabilitada: habilitada ? "si" : "no",
  };
}