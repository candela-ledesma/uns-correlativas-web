import type { Materia, Agrupador } from "@/app/types/plan";

export function getScrollTargetId(
    materia: Materia,
    agrupadores: Agrupador[]
): string | null {
    const found = agrupadores.find((g) => g.id === materia.id);
    return found ? found.id : null;
}