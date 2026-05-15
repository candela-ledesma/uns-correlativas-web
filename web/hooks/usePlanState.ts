"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { Materia, Agrupador } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";
import {
  estaHabilitadaParaCursar,
  estaHabilitadaParaAprobar,
} from "@/lib/plan/evaluarCorrelativas";
import {
  loadPlanStateSnapshot,
  savePlanState,
  clearPlanState,
  hasMigratedPlanState,
  markPlanStateMigrated,
} from "@/lib/plan/planStorage";
import { scrollToGroup, getScrollTargetId } from "@/lib/plan/scrollToGroup";
import { getEstadoKey } from "@/lib/plan/estadoKey";
import { materiaElegidaEnOtroGrupo } from "@/lib/plan/materiaViewModel";

type SyncStatus = "guest" | "syncing" | "synced" | "error";

const REMOTE_SYNC_DEBOUNCE_MS = 450;

export function usePlanState(
  planId: string,
  versionId: string,
  materias: Materia[],
  agrupadores: Agrupador[]
) {
  const { data: session, status: sessionStatus } = useSession();
  const [estados, setEstados] = useState<Record<string, EstadoMateria>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("guest");
  const remoteBaselineReadyRef = useRef(false);
  const lastSyncedSerializedRef = useRef<string | null>(null);

  useEffect(() => {
    setIsHydrated(false);
    const snapshot = loadPlanStateSnapshot(planId, versionId);
    setEstados(snapshot.estados);
    lastSyncedSerializedRef.current = null;
    remoteBaselineReadyRef.current = false;
    setIsHydrated(true);
  }, [planId, versionId]);

  useEffect(() => {
    if (!isHydrated) return;
    savePlanState(planId, versionId, estados);
  }, [estados, isHydrated, planId, versionId]);

  useEffect(() => {
    if (!isHydrated) return;

    const userId = session?.user?.id;

    if (sessionStatus !== "authenticated" || !userId) {
      setSyncStatus("guest");
      return;
    }

    const authenticatedUserId = userId;

    let cancelled = false;

    async function syncInitialSnapshot() {
      setSyncStatus("syncing");

      const localSnapshot = loadPlanStateSnapshot(planId, versionId);
      const migrated = hasMigratedPlanState(
        authenticatedUserId,
        planId,
        versionId
      );

      const response = await fetch("/api/progreso/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          versionId,
          localState: localSnapshot.estados,
          localUpdatedAt: localSnapshot.updatedAt,
          reason: migrated
            ? "Sincronizacion de inicio de sesion"
            : "Migracion inicial desde almacenamiento local",
        }),
      });

      if (!response.ok) {
        throw new Error(`sync-failed-${response.status}`);
      }

      const payload = (await response.json()) as {
        state: Record<string, EstadoMateria>;
        updatedAt: string | null;
      };

      if (cancelled) return;

      const mergedState = payload.state ?? {};
      const mergedUpdatedAt = payload.updatedAt ?? new Date().toISOString();

      remoteBaselineReadyRef.current = true;
      lastSyncedSerializedRef.current = JSON.stringify(mergedState);

      savePlanState(planId, versionId, mergedState, mergedUpdatedAt);
      setEstados(mergedState);
      markPlanStateMigrated(authenticatedUserId, planId, versionId);
      setSyncStatus("synced");
    }

    syncInitialSnapshot().catch(() => {
      if (cancelled) return;
      setSyncStatus("error");
    });

    return () => {
      cancelled = true;
    };
  }, [isHydrated, planId, versionId, session?.user?.id, sessionStatus]);

  useEffect(() => {
    if (!isHydrated) return;
    if (sessionStatus !== "authenticated" || !session?.user?.id) return;
    if (!remoteBaselineReadyRef.current) return;

    const serialized = JSON.stringify(estados);
    if (serialized === lastSyncedSerializedRef.current) return;

    const timeout = window.setTimeout(async () => {
      try {
        setSyncStatus("syncing");

        const clientUpdatedAt = new Date().toISOString();

        const response = await fetch("/api/progreso", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planId,
            versionId,
            state: estados,
            clientUpdatedAt,
            reason: "Actualizacion de progreso desde UI",
          }),
        });

        if (!response.ok) {
          throw new Error(`sync-put-failed-${response.status}`);
        }

        const payload = (await response.json()) as {
          state: Record<string, EstadoMateria>;
          updatedAt: string | null;
        };

        const nextState = payload.state ?? {};
        const nextSerialized = JSON.stringify(nextState);

        lastSyncedSerializedRef.current = nextSerialized;
        savePlanState(planId, versionId, nextState, payload.updatedAt ?? clientUpdatedAt);

        if (nextSerialized !== serialized) {
          setEstados(nextState);
        }

        setSyncStatus("synced");
      } catch {
        setSyncStatus("error");
      }
    }, REMOTE_SYNC_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [estados, isHydrated, planId, versionId, session?.user?.id, sessionStatus]);

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

        const { materia } = contexto;

        if (estado === "cursada") {
          const puedeSeguirCursada = estaHabilitadaParaCursar(
            materia,
            normalizados,
            agrupadores
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
            agrupadores
          );

          if (puedeSeguirAprobada) continue;

          const puedeQuedarCursada = estaHabilitadaParaCursar(
            materia,
            normalizados,
            agrupadores
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
        const puedeCursar = estaHabilitadaParaCursar(materia, prev, agrupadores);

        if (!puedeCursar) return prev;

        return {
          ...prev,
          [estadoKey]: "cursada",
        };
      }

      if (actual === "cursada") {
        const puedeAprobar = estaHabilitadaParaAprobar(materia, prev, agrupadores);

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

    if (sessionStatus === "authenticated") {
      fetch("/api/progreso", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          versionId,
          reason: "Reinicio de progreso desde UI",
        }),
      }).catch(() => {
        setSyncStatus("error");
      });
    }
  }

  return {
    estados,
    setEstados,
    toggleMateria,
    deshacerMateria,
    resetMaterias,
    isHydrated,
    syncStatus,
    isAuthenticated: sessionStatus === "authenticated",
    sessionUserRole: session?.user?.role,
  };
}