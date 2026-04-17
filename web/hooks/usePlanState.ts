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
  planId: string,
  versionId: string,
  materias: Materia[],
  agrupadores: Agrupador[]
) {
  const [estados, setEstados] = useState<Record<string, EstadoMateria>>({});
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(false);
    setEstados(loadPlanState(planId, versionId));
    setIsHydrated(true);
  }, [planId, versionId]);

  useEffect(() => {
    if (!isHydrated) return;
    savePlanState(planId, versionId, estados);
  }, [estados, isHydrated, planId, versionId]);

  function getMateriaContextFromKey(estadoKey: string) {
    if (estadoKey.includes("::")) {
      const [grupoId, materiaId] = estadoKey.split("::");
      const materia = materias.find((m) => String(m.id) === String(materiaId));

      if (!materia) return null;
      return { materia, grupoId };
    }

    const materia = materias.find((m) => String(m.id) === String(estadoKey));
    if (!materia) return null;

    return { materia, grupoId: undefined as string | undefined };
  }

  function normalizarEstadosConsistentes(
    estadosIniciales: Record<string, EstadoMateria>
  ) {
    const normalizados = { ...estadosIniciales };
    let huboCambios = true;

    // Repite hasta estabilizar para cubrir cascadas (A invalida B, B invalida C).
    while (huboCambios) {
      huboCambios = false;

      for (const [estadoKey, estado] of Object.entries(normalizados)) {
        const contexto = getMateriaContextFromKey(estadoKey);
        if (!contexto) continue;

        const { materia, grupoId } = contexto;

        if (estado === "cursada") {
          const puedeSeguirCursada = estaHabilitadaParaCursar(
            materia,
            normalizados,
            materias,
            agrupadores,
            grupoId
          );

          if (!puedeSeguirCursada) {
            delete normalizados[estadoKey];
            huboCambios = true;
          }

          continue;
        }

        if (estado === "aprobada") {
          const puedeSeguirAprobada = estaHabilitadaParaAprobar(
            materia,
            normalizados,
            materias,
            agrupadores,
            grupoId
          );

          if (puedeSeguirAprobada) continue;

          const puedeQuedarCursada = estaHabilitadaParaCursar(
            materia,
            normalizados,
            materias,
            agrupadores,
            grupoId
          );

          if (puedeQuedarCursada) {
            normalizados[estadoKey] = "cursada";
            huboCambios = true;
          } else {
            delete normalizados[estadoKey];
            huboCambios = true;
          }
        }
      }
    }

    return normalizados;
  }

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

  function deshacerMateria(materia: Materia, grupoId?: string) {
    const estadoKey = getEstadoKey(materia, grupoId);

    setEstados((prev) => {
      const actual = prev[estadoKey] || "no_cursada";

      if (actual === "no_cursada") return prev;

      if (actual === "aprobada") {
        const next: Record<string, EstadoMateria> = {
          ...prev,
          [estadoKey]: "cursada",
        };

        return normalizarEstadosConsistentes(next);
      }

      const next: Record<string, EstadoMateria> = { ...prev };
      delete next[estadoKey];
      return normalizarEstadosConsistentes(next);
    });
  }

  function resetMaterias() {
    setEstados({});
    clearPlanState(planId, versionId);
  }

  return {
    estados,
    setEstados,
    toggleMateria,
    deshacerMateria,
    resetMaterias,
    isHydrated,
  };
}