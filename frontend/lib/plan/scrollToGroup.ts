import type { Materia, Agrupador } from "@/app/types/plan";

export function getScrollTargetId(
    materia: Materia,
    agrupadores: Agrupador[]
): string | null {
    const materiaId = String(materia.id);
    const esAgrupador = agrupadores.some((a) => String(a.id) === materiaId);
    if (!esAgrupador) return null;
    return `grupo-${materiaId}`;
}

export function scrollToGroup(targetId: string) {
    const target = document.getElementById(targetId);
    if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}
