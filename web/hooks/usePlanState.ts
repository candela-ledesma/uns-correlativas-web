"use client";

import { useEffect, useState } from "react";
import type { Materia, Agrupador } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/evaluarCorrelativas";
import {
  estaHabilitadaParaCursar,
  estaHabilitadaParaAprobar,
} from "@/lib/evaluarCorrelativas";
import {
  loadPlanState,
  savePlanState,
  clearPlanState,
} from "@/lib/planStorage";
import { scrollToGroup } from "@/lib/scrollToGroup";
import { getScrollTargetId } from "@/lib/getScrollTargetId";
import { getEstadoKey } from "@/lib/estadoKey";

function materiaElegidaEnOtroGrupo(
  materia: Materia,
  estados: Record<string, EstadoMateria>,
  grupoIdActual?: string
) {
  if (!grupoIdActual) return false;

  const materiaId = String(materia.id);

  return Object.entries(estados).some(([key, estado]) => {
    if (!key.includes("::")) return false;

    const [otroGrupoId, otroMateriaId] = key.split("::");

    if (otroGrupoId === grupoIdActual) return false;
    if (otroMateriaId !== materiaId) return false;

    return estado === "cursada" || estado === "aprobada";
  });
}

export function usePlanState(
  materias: Materia[],
  agrupadores: Agrupador[]
) {
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

    if (grupoId && materiaElegidaEnOtroGrupo(materia, estados, grupoId)) {
      return;
    }

    const estadoKey = getEstadoKey(materia, grupoId);

    setEstados((prev) => {
  const actual = prev[estadoKey] || "no_cursada";

  if (actual === "no_cursada") {
    const puedeCursar = estaHabilitadaParaCursar(
      materia,
      prev,
      materias,
      agrupadores,
      grupoId
    );

    if (!puedeCursar) return prev;

    return {
      ...prev,
      [estadoKey]: "cursada",
    };
  }

  if (actual === "cursada") {
    const puedeAprobar = estaHabilitadaParaAprobar(
      materia,
      prev,
      materias,
      agrupadores,
      grupoId
    );

    if (!puedeAprobar) return prev;

    return {
      ...prev,
      [estadoKey]: "aprobada",
    };
  }

  return prev;
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