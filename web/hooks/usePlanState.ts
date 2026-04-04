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
import { getEstadoKey } from "@/lib/estadoKey";

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

    function toggleMateria(materia: Materia, grupoId?: string) {
        const targetId = getScrollTargetId(materia, agrupadores);

        if (targetId && !grupoId) {
        scrollToGroup(targetId);
        return;
        }

        const estadoKey = getEstadoKey(materia, grupoId);

        setEstados((prev) => {
        const actual = prev[estadoKey] || "no_cursada";

        return {
            ...prev,
            [estadoKey]: siguienteEstado(actual),
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