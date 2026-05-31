import { Agrupador, Materia } from "@/app/types/plan";
import { EstadoMateria, estadoAgrupador } from "@/lib/plan/evaluarCorrelativas";

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
    const idsAgrupadores = new Set(agrupadores.map((a) => String(a.id)));

    let total = 0;
    let aprobadas = 0;
    let cursadas = 0;

    for (const materia of materias) {
    const materiaId = String(materia.id);
    const esAgrupador = idsAgrupadores.has(materiaId);
    const esOpcionDeGrupo = materia.categoria === "optativa";

    if (esOpcionDeGrupo) {
        continue;
    }

    total += 1;

    if (esAgrupador) {
        const estado = estadoAgrupador(materiaId, agrupadores, estados);

        if (estado === "aprobada") aprobadas += 1;
        else if (estado === "cursada") cursadas += 1;
    } else {
        const estado = estados[materiaId] || "no_cursada";

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