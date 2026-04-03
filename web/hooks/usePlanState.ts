"use client";

import { useEffect, useState } from "react";
import type { Materia, Agrupador } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { siguienteEstado } from "@/lib/estadoMaterias";
import {
    loadPlanState,
    savePlanState,
    clearPlanState,
} from "@/lib/planStorage";
import { scrollToGroup } from "@/lib/scrollToGroup";
import { getScrollTargetId } from "@/lib/getScrollTargetId";

export function usePlanState(agrupadores: Agrupador[]) {
    const [estados, setEstados] = useState<Record<string, EstadoMateria>>({});
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
    setEstados(loadPlanState());
    setIsHydrated(true);
    }, []);

    useEffect(() => {
    if (!isHydrated) return;
    savePlanState(estados);
    }, [estados, isHydrated]);

    function toggleMateria(materia: Materia) {
    const targetId = getScrollTargetId(materia, agrupadores);

    if (targetId) {
        scrollToGroup(targetId);
        return;
    }

    setEstados((prev) => {
        const actual = prev[materia.id] || "no_cursada";

        return {
        ...prev,
        [materia.id]: siguienteEstado(actual),
        };
    });
    }

    function resetMaterias() {
    setEstados({});
    clearPlanState();
    }

    return {
    estados,
    setEstados,
    toggleMateria,
    resetMaterias,
    isHydrated,
    };
}