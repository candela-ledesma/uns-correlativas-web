import { useMemo } from "react";
import { PlanData } from "@/app/types/plan";

export function usePlanStructure(data: PlanData) {
    const idsAgrupadores = useMemo(
        () => new Set(data.agrupadores.map((a) => a.id)),
        [data.agrupadores]
    );

    return { idsAgrupadores };
}
