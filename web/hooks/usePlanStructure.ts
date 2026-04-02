import { useMemo } from "react";
import { agruparMaterias } from "@/lib/agruparMaterias";
import { separarMaterias } from "@/lib/separarMaterias";
import { PlanData } from "@/app/types/plan";

export function usePlanStructure(data: PlanData) {
    const { normales, optativas, idiomas, seminarios } = useMemo(
    () => separarMaterias(data.materias, data.agrupadores),
    [data]
    );

    const agrupadas = useMemo(() => agruparMaterias(normales), [normales]);

    const idsAgrupadores = useMemo(
    () => new Set(data.agrupadores.map((a) => a.id)),
    [data.agrupadores]
    );

    return {
    normales,
    optativas,
    idiomas,
    seminarios,
    agrupadas,
    idsAgrupadores,
    };
}