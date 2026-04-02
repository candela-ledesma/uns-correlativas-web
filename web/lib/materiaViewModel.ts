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
    bloqueadaPorGrupo: boolean;
    testId: string;
    dataEstado: EstadoMateria;
    dataHabilitada: "si" | "no";
};

function grupoYaElegido(
    materia: Materia,
    estados: Record<string, EstadoMateria>,
    todasLasMaterias: Materia[]
    ) {
    if (!materia.grupo_opcion) return false;

    return todasLasMaterias.some((m) => {
    if (m.id === materia.id) return false;
    if (m.grupo_opcion !== materia.grupo_opcion) return false;

    const estado = estados[m.id] || "no_cursada";
    return estado === "cursada" || estado === "aprobada";
    });
}

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

    const bloqueadaPorGrupo =
    estado === "no_cursada" && grupoYaElegido(materia, estados, todasLasMaterias);

    const bloqueada =
    (!habilitada && estado === "no_cursada" && !esAgrupador) || bloqueadaPorGrupo;

    return {
    esAgrupador,
    estado,
    habilitada,
    bloqueada,
    bloqueadaPorGrupo,
    testId: `materia-${materia.id}`,
    dataEstado: estado,
    dataHabilitada: habilitada ? "si" : "no",
    };
}