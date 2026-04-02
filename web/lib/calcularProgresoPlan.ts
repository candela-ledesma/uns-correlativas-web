import { Agrupador, Materia } from "@/app/types/plan";
import { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { estadoAgrupador } from "@/lib/evaluarCorrelativas";

type ResultadoProgreso = {
    total: number;
    aprobadas: number;
    cursadas: number;
    disponibles: number;
};

export function calcularProgresoPlan(
    materias: Materia[],
    agrupadores: Agrupador[],
    estados: Record<string, EstadoMateria>,
    disponibles: number
    ): ResultadoProgreso {
    const idsAgrupadores = new Set(agrupadores.map((a) => a.id));
    const idsOpciones = new Set(
    materias
        .filter((m) => m.grupo_opcion)
        .map((m) => m.id)
    );

    let total = 0;
    let aprobadas = 0;
    let cursadas = 0;

    for (const materia of materias) {
    const esAgrupador = idsAgrupadores.has(materia.id);
    const esOpcionDeGrupo = idsOpciones.has(materia.id);

    if (esOpcionDeGrupo) {
        continue;
    }

    total += 1;

    if (esAgrupador) {
        const estado = estadoAgrupador(materia.id, materias, estados);

        if (estado === "aprobada") aprobadas += 1;
        else if (estado === "cursada") cursadas += 1;
    } else {
        const estado = estados[materia.id] || "no_cursada";

        if (estado === "aprobada") aprobadas += 1;
        else if (estado === "cursada") cursadas += 1;
    }
    }

    return {
    total,
    aprobadas,
    cursadas,
    disponibles,
    };
}