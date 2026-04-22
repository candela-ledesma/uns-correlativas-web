import type { Materia, Agrupador } from "@/app/types/plan";

export function getEstadoKey(
    materia: Materia,
    grupoId?: string | null
): string {
    if (grupoId) {
        return `${grupoId}::${String(materia.id)}`;
    }

    return String(materia.id);
}

export function getMateriaGroupIds(
    materiaId: string,
    agrupadores: Agrupador[]
): string[] {
    return agrupadores
        .filter((a) => a.opciones.map(String).includes(String(materiaId)))
        .map((a) => String(a.id));
}