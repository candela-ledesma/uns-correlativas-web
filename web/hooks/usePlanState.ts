"use client";

import { useEffect, useState } from "react";
import { Materia } from "@/app/types/plan";
import { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { siguienteEstado } from "@/lib/estadoMaterias";
import {
  loadPlanState,
  savePlanState,
  clearPlanState,
} from "@/lib/planStorage";
import { scrollToGroup } from "@/lib/scrollToGroup";

export function usePlanState(idsAgrupadores: Set<string>) {
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
    if (idsAgrupadores.has(materia.id)) {
        scrollToGroup(materia.id);
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