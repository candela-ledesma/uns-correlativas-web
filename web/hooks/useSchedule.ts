"use client";

import { useCallback, useEffect, useState } from "react";

export type ScheduleBlock = {
  id: string;
  materiaNombre: string;
  materiaId: string | null;
  dia: number;
  horaInicio: number;
  horaFin: number;
  comision: string | null;
  notas: string | null;
  color: string | null;
};

export type CreateBlockInput = Omit<ScheduleBlock, "id">;
export type UpdateBlockInput = Partial<Omit<ScheduleBlock, "id">>;

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; blocks: ScheduleBlock[] }
  | { status: "error"; message: string };

type PlanKey = {
  careerId: string;
  planId: string;
  versionId: string;
};

export function useSchedule({ careerId, planId, versionId }: PlanKey) {
  const [state, setState] = useState<State>({ status: "idle" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const url = `/api/planificador?careerId=${encodeURIComponent(careerId)}&planId=${encodeURIComponent(planId)}&versionId=${encodeURIComponent(versionId)}`;
    const res = await fetch(url).catch(() => null);

    if (!res?.ok) {
      const msg = res?.status === 401
        ? "Iniciá sesión para usar el planificador"
        : "Error al cargar el horario";
      setState({ status: "error", message: msg });
      return;
    }

    const json = (await res.json()) as { blocks: ScheduleBlock[] };
    setState({ status: "ready", blocks: json.blocks });
  }, [careerId, planId, versionId]);

  useEffect(() => { void load(); }, [load]);

  async function createBlock(input: CreateBlockInput): Promise<{ error?: string }> {
    const res = await fetch("/api/planificador", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ careerId, planId, versionId, ...input }),
    }).catch(() => null);

    if (!res) return { error: "Error de red" };

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { error: (json as { error?: string }).error ?? "Error al crear el bloque" };
    }

    const created = (json as { block: ScheduleBlock }).block;
    setState((prev) =>
      prev.status === "ready"
        ? { status: "ready", blocks: [...prev.blocks, created] }
        : prev,
    );
    return {};
  }

  async function updateBlock(id: string, input: UpdateBlockInput): Promise<{ error?: string }> {
    const res = await fetch(`/api/planificador/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).catch(() => null);

    if (!res) return { error: "Error de red" };

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { error: (json as { error?: string }).error ?? "Error al actualizar el bloque" };
    }

    const updated = (json as { block: ScheduleBlock }).block;
    setState((prev) =>
      prev.status === "ready"
        ? { status: "ready", blocks: prev.blocks.map((b) => (b.id === id ? updated : b)) }
        : prev,
    );
    return {};
  }

  async function deleteBlock(id: string): Promise<{ error?: string }> {
    const res = await fetch(`/api/planificador/${id}`, { method: "DELETE" }).catch(() => null);

    if (!res?.ok) {
      return { error: "Error al eliminar el bloque" };
    }

    setState((prev) =>
      prev.status === "ready"
        ? { status: "ready", blocks: prev.blocks.filter((b) => b.id !== id) }
        : prev,
    );
    return {};
  }

  return {
    state,
    blocks: state.status === "ready" ? state.blocks : [],
    isLoading: state.status === "loading" || state.status === "idle",
    error: state.status === "error" ? state.message : null,
    createBlock,
    updateBlock,
    deleteBlock,
    reload: load,
  };
}
