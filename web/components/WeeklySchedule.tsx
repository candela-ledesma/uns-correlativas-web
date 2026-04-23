"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  DIAS_SEMANA,
  minutesToTimeString,
  HORA_INICIO_GRILLA,
  HORA_FIN_GRILLA,
  SLOT_MINUTOS,
  SLOT_PX,
} from "@/lib/scheduleValidation";
import { useSchedule, type ScheduleBlock, type CreateBlockInput } from "@/hooks/useSchedule";
import ScheduleBlockForm from "@/components/ScheduleBlockForm";
import type { Materia } from "@/app/types/plan";

const TOTAL_MINUTOS = HORA_FIN_GRILLA - HORA_INICIO_GRILLA;
const TOTAL_SLOTS = TOTAL_MINUTOS / SLOT_MINUTOS;
const GRID_HEIGHT = TOTAL_SLOTS * SLOT_PX;

type Props = {
  careerId: string;
  planId: string;
  versionId: string;
  materias: Materia[];
};

type Panel = { type: "create" } | { type: "edit"; block: ScheduleBlock };

function blockTopPx(horaInicio: number): number {
  return ((horaInicio - HORA_INICIO_GRILLA) / SLOT_MINUTOS) * SLOT_PX;
}

function blockHeightPx(horaInicio: number, horaFin: number): number {
  return ((horaFin - horaInicio) / SLOT_MINUTOS) * SLOT_PX;
}

function timeLabels(): string[] {
  const labels: string[] = [];
  for (let m = HORA_INICIO_GRILLA; m <= HORA_FIN_GRILLA; m += SLOT_MINUTOS) {
    labels.push(minutesToTimeString(m));
  }
  return labels;
}

const TIME_LABELS = timeLabels();

export default function WeeklySchedule({ careerId, planId, versionId, materias }: Props) {
  const { status: sessionStatus } = useSession();
  const { blocks, isLoading, error, createBlock, updateBlock, deleteBlock } = useSchedule({
    careerId,
    planId,
    versionId,
  });
  const [panel, setPanel] = useState<Panel | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const materiaOptions = materias
    .filter((m) => m.tipo !== "agrupador")
    .map((m) => ({ id: String(m.id), nombre: m.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  async function handleCreate(data: CreateBlockInput) {
    const result = await createBlock(data as CreateBlockInput);
    if (!result.error) setPanel(null);
    return result;
  }

  async function handleUpdate(id: string, data: Partial<ScheduleBlock>) {
    const result = await updateBlock(id, data);
    if (!result.error) setPanel(null);
    return result;
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteBlock(id);
    setDeletingId(null);
    if (panel && panel.type === "edit" && panel.block.id === id) setPanel(null);
  }

  if (sessionStatus === "unauthenticated") {
    return (
      <div className="rounded-2xl border border-zinc-700 bg-zinc-800/50 p-8 text-center">
        <p className="text-sm text-zinc-400">
          Iniciá sesión para usar el planificador de horarios.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-200">Planificador de cuatrimestre</h2>
        <button
          type="button"
          onClick={() => setPanel({ type: "create" })}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          + Agregar bloque
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Side panel */}
      {panel && (
        <div className="rounded-2xl border border-zinc-700 bg-zinc-800/80 p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-200">
            {panel.type === "create" ? "Nuevo bloque" : "Editar bloque"}
          </h3>
          <ScheduleBlockForm
            block={panel.type === "edit" ? panel.block : undefined}
            materias={materiaOptions}
            onSave={
              panel.type === "create"
                ? (d) => handleCreate(d as CreateBlockInput)
                : (d) => handleUpdate(panel.block.id, d as Partial<ScheduleBlock>)
            }
            onCancel={() => setPanel(null)}
          />
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-700 bg-zinc-900">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <span className="text-sm text-zinc-500">Cargando horario...</span>
          </div>
        ) : (
          <div className="flex min-w-[640px]">
            {/* Time axis */}
            <div className="w-14 flex-shrink-0 select-none" style={{ height: GRID_HEIGHT + SLOT_PX }}>
              <div style={{ height: SLOT_PX }} /> {/* header spacer */}
              <div className="relative" style={{ height: GRID_HEIGHT }}>
                {TIME_LABELS.map((label, i) => (
                  <div
                    key={label}
                    className="absolute right-2 text-[10px] text-zinc-500"
                    style={{ top: i * SLOT_PX - 6 }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Day columns */}
            {DIAS_SEMANA.map((dia, diaIdx) => {
              const diaNum = diaIdx + 1;
              const diaBlocks = blocks.filter((b) => b.dia === diaNum);

              return (
                <div key={dia} className="flex flex-1 flex-col border-l border-zinc-700/60">
                  {/* Header */}
                  <div
                    className="flex items-center justify-center border-b border-zinc-700/60 text-xs font-semibold uppercase tracking-wide text-zinc-400"
                    style={{ height: SLOT_PX }}
                  >
                    {dia}
                  </div>

                  {/* Slots */}
                  <div className="relative" style={{ height: GRID_HEIGHT }}>
                    {/* Background slots */}
                    {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-full border-b border-zinc-800/60"
                        style={{ top: i * SLOT_PX, height: SLOT_PX }}
                      />
                    ))}

                    {/* Blocks */}
                    {diaBlocks.map((block) => {
                      const top = blockTopPx(block.horaInicio);
                      const height = blockHeightPx(block.horaInicio, block.horaFin);
                      const bgColor = block.color ?? "#9d4edd";
                      const isEditing = panel?.type === "edit" && panel.block.id === block.id;

                      return (
                        <div
                          key={block.id}
                          className="absolute left-0.5 right-0.5 cursor-pointer overflow-hidden rounded-md px-1.5 py-1 transition hover:brightness-110"
                          style={{
                            top: top + 1,
                            height: height - 2,
                            backgroundColor: bgColor + "33",
                            border: `1.5px solid ${bgColor}`,
                            outline: isEditing ? `2px solid ${bgColor}` : undefined,
                          }}
                          onClick={() => setPanel({ type: "edit", block })}
                          title={`${block.materiaNombre} — ${minutesToTimeString(block.horaInicio)} a ${minutesToTimeString(block.horaFin)}`}
                        >
                          <p className="truncate text-[11px] font-semibold leading-tight" style={{ color: bgColor }}>
                            {block.materiaNombre}
                          </p>
                          {height >= 40 && (
                            <p className="text-[10px] leading-tight text-zinc-400">
                              {minutesToTimeString(block.horaInicio)}–{minutesToTimeString(block.horaFin)}
                              {block.comision ? ` · ${block.comision}` : ""}
                            </p>
                          )}
                          {height >= 60 && block.notas && (
                            <p className="mt-0.5 truncate text-[10px] text-zinc-500">{block.notas}</p>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDelete(block.id);
                            }}
                            disabled={deletingId === block.id}
                            className="absolute right-1 top-1 rounded text-[10px] text-zinc-400 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                            style={{ opacity: deletingId === block.id ? 0.6 : undefined }}
                            title="Eliminar"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Block list (compact) */}
      {blocks.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {blocks.length} {blocks.length === 1 ? "bloque" : "bloques"}
          </p>
          {blocks.map((block) => (
            <div
              key={block.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: block.color ?? "#9d4edd" }}
                />
                <span className="truncate text-sm font-medium text-zinc-200">{block.materiaNombre}</span>
                <span className="text-xs text-zinc-500 flex-shrink-0">
                  {DIAS_SEMANA[block.dia - 1]} {minutesToTimeString(block.horaInicio)}–{minutesToTimeString(block.horaFin)}
                  {block.comision ? ` · ${block.comision}` : ""}
                </span>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setPanel({ type: "edit", block })}
                  className="rounded px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={deletingId === block.id}
                  onClick={() => void handleDelete(block.id)}
                  className="rounded px-2 py-1 text-xs text-zinc-400 transition hover:bg-red-900/40 hover:text-red-400 disabled:opacity-50"
                >
                  {deletingId === block.id ? "..." : "Eliminar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && blocks.length === 0 && !panel && (
        <p className="text-center text-sm text-zinc-600">
          No hay bloques todavía. Hacé clic en "Agregar bloque" para empezar.
        </p>
      )}
    </div>
  );
}
