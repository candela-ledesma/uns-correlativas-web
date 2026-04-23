"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  DIAS_SEMANA,
  minutesToTimeString,
  HORA_INICIO_GRILLA,
  HORA_FIN_GRILLA,
  SLOT_MINUTOS,
  SLOT_PX,
  findOverlaps,
} from "@/lib/scheduleValidation";
import { useSchedule, type ScheduleBlock, type CreateBlockInput } from "@/hooks/useSchedule";
import ScheduleBlockForm from "@/components/ScheduleBlockForm";
import type { Materia } from "@/app/types/plan";

// ── Constants ──────────────────────────────────────────────────────────────

const TOTAL_SLOTS = (HORA_FIN_GRILLA - HORA_INICIO_GRILLA) / SLOT_MINUTOS;
const GRID_HEIGHT = TOTAL_SLOTS * SLOT_PX;
const DRAG_THRESHOLD_PX = 5;

const TIME_LABELS: string[] = [];
for (let m = HORA_INICIO_GRILLA; m <= HORA_FIN_GRILLA; m += SLOT_MINUTOS) {
  TIME_LABELS.push(minutesToTimeString(m));
}

// ── Pure helpers ───────────────────────────────────────────────────────────

function snapToSlot(minutes: number): number {
  return Math.round(minutes / SLOT_MINUTOS) * SLOT_MINUTOS;
}
function blockTopPx(horaInicio: number): number {
  return ((horaInicio - HORA_INICIO_GRILLA) / SLOT_MINUTOS) * SLOT_PX;
}
function blockHeightPx(horaInicio: number, horaFin: number): number {
  return ((horaFin - horaInicio) / SLOT_MINUTOS) * SLOT_PX;
}

// ── Types ──────────────────────────────────────────────────────────────────

type Panel =
  | { type: "create"; prefill?: { dia: number; horaInicio: number } }
  | { type: "edit"; block: ScheduleBlock };

/** Inline action overlay state for a block */
type ActiveBlock = { id: string; confirming: boolean };

type DragState = {
  blockId: string;
  block: ScheduleBlock;
  duration: number;
  grabOffsetMinutes: number;
  startX: number;
  startY: number;
};

type Ghost = {
  dia: number;
  horaInicio: number;
  horaFin: number;
  hasConflict: boolean;
  color: string;
};

type Props = {
  careerId: string;
  planId: string;
  versionId: string;
  materias: Materia[];
};

// ── Component ──────────────────────────────────────────────────────────────

export default function WeeklySchedule({ careerId, planId, versionId, materias }: Props) {
  const { status: sessionStatus } = useSession();
  const { blocks, isLoading, error, createBlock, updateBlock, deleteBlock } = useSchedule({
    careerId,
    planId,
    versionId,
  });

  const [panel, setPanel] = useState<Panel | null>(null);
  const [activeBlock, setActiveBlock] = useState<ActiveBlock | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);

  const dragRef = useRef<DragState | null>(null);
  const suppressNextClickRef = useRef(false);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null]);
  const gridRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Scroll panel into view when it opens
  useEffect(() => {
    if (panel) {
      requestAnimationFrame(() => {
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }, [panel]);

  // Escape closes panel + overlay
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setActiveBlock(null);
      setPanel(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const materiaOptions = materias
    .filter((m) => m.tipo !== "agrupador")
    .map((m) => ({ id: String(m.id), nombre: m.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // ── Drag helpers ──────────────────────────────────────────────────────────

  function getColumnHit(clientX: number, clientY: number): { dia: number; yInColumn: number } | null {
    for (let i = 0; i < columnRefs.current.length; i++) {
      const rect = columnRefs.current[i]?.getBoundingClientRect();
      if (!rect) continue;
      if (clientX >= rect.left && clientX <= rect.right) {
        return { dia: i + 1, yInColumn: clientY - rect.top };
      }
    }
    return null;
  }

  function buildGhost(clientX: number, clientY: number, drag: DragState, prev: Ghost | null): Ghost {
    const hit = getColumnHit(clientX, clientY);
    let targetDia: number;
    let yInColumn: number;

    if (hit) {
      targetDia = hit.dia;
      yInColumn = hit.yInColumn;
    } else {
      targetDia = prev?.dia ?? drag.block.dia;
      const colRect = columnRefs.current[targetDia - 1]?.getBoundingClientRect();
      yInColumn = colRect ? Math.max(0, Math.min(GRID_HEIGHT, clientY - colRect.top)) : 0;
    }

    const minutesFromTop = (yInColumn / SLOT_PX) * SLOT_MINUTOS;
    const rawStart = HORA_INICIO_GRILLA + minutesFromTop - drag.grabOffsetMinutes;
    const horaInicio = Math.max(
      HORA_INICIO_GRILLA,
      Math.min(HORA_FIN_GRILLA - drag.duration, snapToSlot(rawStart)),
    );
    const horaFin = horaInicio + drag.duration;
    const hasConflict =
      findOverlaps({ id: drag.blockId, dia: targetDia, horaInicio, horaFin }, blocks).length > 0;

    return { dia: targetDia, horaInicio, horaFin, hasConflict, color: drag.block.color ?? "#9d4edd" };
  }

  // ── Pointer events ────────────────────────────────────────────────────────

  function onBlockPointerDown(e: React.PointerEvent, block: ScheduleBlock) {
    if (e.button !== 0) return;
    e.stopPropagation();

    const hit = getColumnHit(e.clientX, e.clientY);
    if (!hit) return;

    setActiveBlock(null); // close any open overlay before drag

    const minutesFromTop = (hit.yInColumn / SLOT_PX) * SLOT_MINUTOS;
    const grabOffsetMinutes = HORA_INICIO_GRILLA + minutesFromTop - block.horaInicio;

    dragRef.current = {
      blockId: block.id,
      block,
      duration: block.horaFin - block.horaInicio,
      grabOffsetMinutes,
      startX: e.clientX,
      startY: e.clientY,
    };

    setDraggingId(block.id);
    gridRef.current?.setPointerCapture(e.pointerId);
  }

  function onGridPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = Math.abs(e.clientX - drag.startX);
    const dy = Math.abs(e.clientY - drag.startY);
    if (dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return;
    setGhost((prev) => buildGhost(e.clientX, e.clientY, drag, prev));
  }

  async function onGridPointerUp(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;

    gridRef.current?.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setDraggingId(null);

    const currentGhost = ghost;
    setGhost(null);

    const dx = Math.abs(e.clientX - drag.startX);
    const dy = Math.abs(e.clientY - drag.startY);
    const wasDrag = dx >= DRAG_THRESHOLD_PX || dy >= DRAG_THRESHOLD_PX;

    if (wasDrag) {
      suppressNextClickRef.current = true;
      setTimeout(() => { suppressNextClickRef.current = false; }, 0);
    }

    if (!wasDrag || !currentGhost || currentGhost.hasConflict) return;

    const orig = blocks.find((b) => b.id === drag.blockId);
    if (!orig) return;
    if (orig.dia === currentGhost.dia && orig.horaInicio === currentGhost.horaInicio) return;

    await updateBlock(drag.blockId, {
      dia: currentGhost.dia,
      horaInicio: currentGhost.horaInicio,
      horaFin: currentGhost.horaFin,
    });
  }

  function onGridPointerCancel() {
    dragRef.current = null;
    setDraggingId(null);
    setGhost(null);
  }

  // ── Cell click → create ───────────────────────────────────────────────────

  function onSlotAreaClick(e: React.MouseEvent, dia: number) {
    if (draggingId) return;

    // First click dismisses any open overlay, without creating
    if (activeBlock) {
      setActiveBlock(null);
      return;
    }

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const yInColumn = e.clientY - rect.top;
    const raw = HORA_INICIO_GRILLA + (yInColumn / SLOT_PX) * SLOT_MINUTOS;
    const horaInicio = Math.max(
      HORA_INICIO_GRILLA,
      Math.min(HORA_FIN_GRILLA - SLOT_MINUTOS, snapToSlot(raw)),
    );
    setPanel({ type: "create", prefill: { dia, horaInicio } });
  }

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  async function handleCreate(data: CreateBlockInput) {
    const result = await createBlock(data);
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
    setActiveBlock(null);
    if (panel?.type === "edit" && panel.block.id === id) setPanel(null);
  }

  // ── Auth guard ─────────────────────────────────────────────────────────────

  if (sessionStatus === "unauthenticated") {
    return (
      <div className="rounded-2xl border border-zinc-700 bg-zinc-800/50 p-8 text-center">
        <p className="text-sm text-zinc-400">Iniciá sesión para usar el planificador de horarios.</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="grid gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-base font-semibold text-zinc-200">Planificador de cuatrimestre</h2>
        <p className="text-xs text-zinc-500">
          Clic en celda para agregar · clic en bloque para opciones · arrastrá para mover
        </p>
        <button
          type="button"
          onClick={() => { setActiveBlock(null); setPanel({ type: "create" }); }}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-95"
        >
          + Agregar
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Grid */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-700 bg-zinc-900">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <span className="text-sm text-zinc-500">Cargando horario...</span>
          </div>
        ) : (
          <div
            ref={gridRef}
            className="flex min-w-[640px] select-none"
            style={{ cursor: draggingId ? "grabbing" : "default" }}
            onPointerMove={onGridPointerMove}
            onPointerUp={(e) => void onGridPointerUp(e)}
            onPointerCancel={onGridPointerCancel}
          >
            {/* Time axis */}
            <div className="w-14 flex-shrink-0" style={{ height: GRID_HEIGHT + SLOT_PX }}>
              <div style={{ height: SLOT_PX }} />
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
            {DIAS_SEMANA.map((diaLabel, diaIdx) => {
              const diaNum = diaIdx + 1;
              const diaBlocks = blocks.filter((b) => b.dia === diaNum);
              const diaGhost = ghost?.dia === diaNum ? ghost : null;

              return (
                <div key={diaLabel} className="flex flex-1 flex-col border-l border-zinc-700/60">
                  {/* Header */}
                  <div
                    className="flex items-center justify-center border-b border-zinc-700/60 text-xs font-semibold uppercase tracking-wide text-zinc-400"
                    style={{ height: SLOT_PX }}
                  >
                    {diaLabel}
                  </div>

                  {/* Slot area */}
                  <div
                    ref={(el) => { columnRefs.current[diaIdx] = el; }}
                    className="relative"
                    style={{
                      height: GRID_HEIGHT,
                      cursor: draggingId ? "grabbing" : "crosshair",
                    }}
                    onClick={(e) => onSlotAreaClick(e, diaNum)}
                  >
                    {/* Slot lines */}
                    {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-full border-b border-zinc-800/60"
                        style={{ top: i * SLOT_PX, height: SLOT_PX }}
                      />
                    ))}

                    {/* Drop ghost */}
                    {diaGhost && (
                      <div
                        className="pointer-events-none absolute left-0.5 right-0.5 rounded-md"
                        style={{
                          top: blockTopPx(diaGhost.horaInicio) + 1,
                          height: blockHeightPx(diaGhost.horaInicio, diaGhost.horaFin) - 2,
                          backgroundColor: diaGhost.hasConflict ? "#dc262625" : `${diaGhost.color}25`,
                          border: `2px dashed ${diaGhost.hasConflict ? "#ef4444" : diaGhost.color}`,
                          zIndex: 10,
                        }}
                      />
                    )}

                    {/* Blocks */}
                    {diaBlocks.map((block) => {
                      const top = blockTopPx(block.horaInicio);
                      const height = blockHeightPx(block.horaInicio, block.horaFin);
                      const color = block.color ?? "#9d4edd";
                      const isDragging = draggingId === block.id;
                      const isSelected = activeBlock?.id === block.id;
                      const isEditing = panel?.type === "edit" && panel.block.id === block.id;

                      return (
                        <div
                          key={block.id}
                          className="absolute left-0.5 right-0.5 overflow-hidden rounded-md transition-opacity"
                          style={{
                            top: top + 1,
                            height: height - 2,
                            backgroundColor: color + "33",
                            border: `1.5px solid ${color}`,
                            outline: isEditing ? `2px solid ${color}` : isSelected ? `2px solid white` : undefined,
                            opacity: isDragging ? 0.25 : 1,
                            cursor: isDragging ? "grabbing" : "pointer",
                            zIndex: isSelected ? 15 : isDragging ? 1 : 5,
                            touchAction: "none",
                          }}
                          onPointerDown={(e) => onBlockPointerDown(e, block)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (suppressNextClickRef.current) return;
                            // Toggle overlay; if same block, toggle confirming off
                            setActiveBlock((prev) =>
                              prev?.id === block.id ? null : { id: block.id, confirming: false },
                            );
                          }}
                        >
                          {/* Block content */}
                          <div className="px-1.5 py-1" style={{ opacity: isSelected ? 0.3 : 1 }}>
                            <p className="truncate text-[11px] font-semibold leading-tight" style={{ color }}>
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
                          </div>

                          {/* Inline action overlay */}
                          {isSelected && (
                            <div
                              className="absolute inset-0 flex items-center justify-center gap-1 rounded-md px-1"
                              style={{ backgroundColor: "rgba(9,9,11,0.88)" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {!activeBlock!.confirming ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPanel({ type: "edit", block });
                                      setActiveBlock(null);
                                    }}
                                    className="rounded px-2 py-0.5 text-[10px] font-semibold text-zinc-200 ring-1 ring-zinc-600 transition hover:bg-zinc-700 active:scale-95"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setActiveBlock({ id: block.id, confirming: true })}
                                    className="rounded px-2 py-0.5 text-[10px] font-semibold text-red-400 ring-1 ring-red-500/50 transition hover:bg-red-950/60 active:scale-95"
                                  >
                                    Eliminar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="text-[10px] text-zinc-400">¿Seguro?</span>
                                  <button
                                    type="button"
                                    disabled={deletingId === block.id}
                                    onClick={() => void handleDelete(block.id)}
                                    className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white transition hover:bg-red-500 active:scale-95 disabled:opacity-50"
                                  >
                                    {deletingId === block.id ? "..." : "Sí"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setActiveBlock(null)}
                                    className="rounded px-2 py-0.5 text-[10px] font-semibold text-zinc-300 ring-1 ring-zinc-600 transition hover:bg-zinc-700 active:scale-95"
                                  >
                                    No
                                  </button>
                                </>
                              )}
                            </div>
                          )}
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

      {/* Side panel — below the grid so it doesn't push it around */}
      {panel && (
        <div
          ref={panelRef}
          className="rounded-2xl border border-zinc-700 bg-zinc-800/80 p-4"
          style={{ animation: "dropdownIn 140ms ease-out" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">
              {panel.type === "create" ? "Nuevo bloque" : "Editar bloque"}
            </h3>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="rounded p-1 text-zinc-500 transition hover:bg-zinc-700 hover:text-zinc-200"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <ScheduleBlockForm
            block={panel.type === "edit" ? panel.block : undefined}
            defaultDia={panel.type === "create" ? panel.prefill?.dia : undefined}
            defaultHoraInicio={panel.type === "create" ? panel.prefill?.horaInicio : undefined}
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

      {/* Block list */}
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
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: block.color ?? "#9d4edd" }}
                />
                <span className="truncate text-sm font-medium text-zinc-200">{block.materiaNombre}</span>
                <span className="flex-shrink-0 text-xs text-zinc-500">
                  {DIAS_SEMANA[block.dia - 1]}{" "}
                  {minutesToTimeString(block.horaInicio)}–{minutesToTimeString(block.horaFin)}
                  {block.comision ? ` · ${block.comision}` : ""}
                </span>
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => { setActiveBlock(null); setPanel({ type: "edit", block }); }}
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
          No hay bloques todavía. Hacé clic en cualquier celda de la grilla para agregar uno.
        </p>
      )}
    </div>
  );
}
