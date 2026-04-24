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

import { TEXT, TEXT_SEC, SURFACE, BTN as BTN_BASE, BTN_VIOLET, BTN_RED as BTN_RED_BASE, GLASS, ERROR_PANEL } from "@/lib/tokens";
// Variantes locales con layout específico del planificador
const BTN     = { ...BTN_BASE,     borderRadius: 10, padding: "8px 16px",  fontSize: 13, fontWeight: 600 } as const;
const BTN_VIO = { ...BTN_VIOLET,   borderRadius: 10, padding: "8px 16px",  fontSize: 13, fontWeight: 700 } as const;
const BTN_RED = { ...BTN_RED_BASE, borderRadius: 8,  padding: "4px 10px", fontSize: 11, fontWeight: 700 } as const;
const BTN_SM  = { ...BTN_BASE,     borderRadius: 8,  padding: "4px 10px", fontSize: 11, fontWeight: 600 } as const;
const SLOT_LINE = `1px solid ${GLASS.soft}`;    // separador de media hora en la grilla
const COL_LINE  = `1px solid ${GLASS.medium}`;  // borde entre columnas de día

// ── Constants ──────────────────────────────────────────────────────────────
const TOTAL_SLOTS    = (HORA_FIN_GRILLA - HORA_INICIO_GRILLA) / SLOT_MINUTOS;
const GRID_HEIGHT    = TOTAL_SLOTS * SLOT_PX;
const DRAG_THRESHOLD = 5;

const TIME_LABELS: string[] = [];
for (let m = HORA_INICIO_GRILLA; m <= HORA_FIN_GRILLA; m += SLOT_MINUTOS) {
  TIME_LABELS.push(minutesToTimeString(m));
}

// ── Helpers ────────────────────────────────────────────────────────────────
function snapToSlot(m: number)                          { return Math.round(m / SLOT_MINUTOS) * SLOT_MINUTOS; }
function blockTopPx(horaInicio: number)                 { return ((horaInicio - HORA_INICIO_GRILLA) / SLOT_MINUTOS) * SLOT_PX; }
function blockHeightPx(ini: number, fin: number)        { return ((fin - ini) / SLOT_MINUTOS) * SLOT_PX; }

// ── Types ──────────────────────────────────────────────────────────────────
type Panel =
  | { type: "create"; prefill?: { dia: number; horaInicio: number } }
  | { type: "edit"; block: ScheduleBlock };

type ActiveBlock = { id: string; confirming: boolean };

type DragState = {
  blockId: string; block: ScheduleBlock;
  duration: number; grabOffsetMinutes: number;
  startX: number; startY: number;
};

type Ghost = { dia: number; horaInicio: number; horaFin: number; hasConflict: boolean; color: string };

type Props = { careerId: string; planId: string; versionId: string; materias: Materia[] };

// ── Component ──────────────────────────────────────────────────────────────
export default function WeeklySchedule({ careerId, planId, versionId, materias }: Props) {
  const { status: sessionStatus } = useSession();
  const { blocks, isLoading, error, createBlock, updateBlock, deleteBlock } = useSchedule({ careerId, planId, versionId });

  const [panel,       setPanel]       = useState<Panel | null>(null);
  const [activeBlock, setActiveBlock] = useState<ActiveBlock | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [draggingId,  setDraggingId]  = useState<string | null>(null);
  const [ghost,       setGhost]       = useState<Ghost | null>(null);

  const dragRef             = useRef<DragState | null>(null);
  const suppressClickRef    = useRef(false);
  const columnRefs          = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null]);
  const gridRef             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") { setActiveBlock(null); setPanel(null); } }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const materiaOptions = materias
    .filter((m) => m.tipo !== "agrupador")
    .map((m) => ({ id: String(m.id), nombre: m.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // ── Drag ──────────────────────────────────────────────────────────────────

  function getHit(cx: number, cy: number): { dia: number; y: number } | null {
    for (let i = 0; i < columnRefs.current.length; i++) {
      const r = columnRefs.current[i]?.getBoundingClientRect();
      if (r && cx >= r.left && cx <= r.right) return { dia: i + 1, y: cy - r.top };
    }
    return null;
  }

  function buildGhost(cx: number, cy: number, drag: DragState, prev: Ghost | null): Ghost {
    const hit = getHit(cx, cy);
    let dia = prev?.dia ?? drag.block.dia;
    let y   = 0;
    if (hit) { dia = hit.dia; y = hit.y; }
    else { const r = columnRefs.current[dia - 1]?.getBoundingClientRect(); y = r ? Math.max(0, Math.min(GRID_HEIGHT, cy - r.top)) : 0; }

    const raw = HORA_INICIO_GRILLA + (y / SLOT_PX) * SLOT_MINUTOS - drag.grabOffsetMinutes;
    const ini = Math.max(HORA_INICIO_GRILLA, Math.min(HORA_FIN_GRILLA - drag.duration, snapToSlot(raw)));
    const fin = ini + drag.duration;
    const conflict = findOverlaps({ id: drag.blockId, dia, horaInicio: ini, horaFin: fin }, blocks).length > 0;
    return { dia, horaInicio: ini, horaFin: fin, hasConflict: conflict, color: drag.block.color ?? "#9d4edd" };
  }

  function onBlockPointerDown(e: React.PointerEvent, block: ScheduleBlock) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const hit = getHit(e.clientX, e.clientY);
    if (!hit) return;
    setActiveBlock(null);
    const grab = HORA_INICIO_GRILLA + (hit.y / SLOT_PX) * SLOT_MINUTOS - block.horaInicio;
    dragRef.current = { blockId: block.id, block, duration: block.horaFin - block.horaInicio, grabOffsetMinutes: grab, startX: e.clientX, startY: e.clientY };
    setDraggingId(block.id);
    gridRef.current?.setPointerCapture(e.pointerId);
  }

  function onGridPointerMove(e: React.PointerEvent) {
    const d = dragRef.current; if (!d) return;
    if (Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD && Math.abs(e.clientY - d.startY) < DRAG_THRESHOLD) return;
    setGhost((p) => buildGhost(e.clientX, e.clientY, d, p));
  }

  async function onGridPointerUp(e: React.PointerEvent) {
    const d = dragRef.current; if (!d) return;
    gridRef.current?.releasePointerCapture(e.pointerId);
    dragRef.current = null; setDraggingId(null);
    const g = ghost; setGhost(null);
    const wasDrag = Math.abs(e.clientX - d.startX) >= DRAG_THRESHOLD || Math.abs(e.clientY - d.startY) >= DRAG_THRESHOLD;
    if (wasDrag) { suppressClickRef.current = true; setTimeout(() => { suppressClickRef.current = false; }, 0); }
    if (!wasDrag || !g || g.hasConflict) return;
    const orig = blocks.find((b) => b.id === d.blockId);
    if (!orig || (orig.dia === g.dia && orig.horaInicio === g.horaInicio)) return;
    await updateBlock(d.blockId, { dia: g.dia, horaInicio: g.horaInicio, horaFin: g.horaFin });
  }

  function onGridPointerCancel() { dragRef.current = null; setDraggingId(null); setGhost(null); }

  // ── Cell click → create ───────────────────────────────────────────────────
  function onSlotClick(e: React.MouseEvent, dia: number) {
    if (draggingId) return;
    if (activeBlock) { setActiveBlock(null); return; }
    const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const raw = HORA_INICIO_GRILLA + ((e.clientY - r.top) / SLOT_PX) * SLOT_MINUTOS;
    const ini = Math.max(HORA_INICIO_GRILLA, Math.min(HORA_FIN_GRILLA - SLOT_MINUTOS, snapToSlot(raw)));
    setPanel({ type: "create", prefill: { dia, horaInicio: ini } });
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function handleCreate(data: CreateBlockInput) {
    const r = await createBlock(data); if (!r.error) setPanel(null); return r;
  }
  async function handleUpdate(id: string, data: Partial<ScheduleBlock>) {
    const r = await updateBlock(id, data); if (!r.error) setPanel(null); return r;
  }
  async function handleDelete(id: string) {
    setDeletingId(id); await deleteBlock(id); setDeletingId(null);
    setActiveBlock(null);
    if (panel?.type === "edit" && panel.block.id === id) setPanel(null);
  }

  // ── Auth guard ─────────────────────────────────────────────────────────────
  if (sessionStatus === "unauthenticated") {
    return (
      <div style={{ ...SURFACE, borderRadius: 16, padding: 32, textAlign: "center" }}>
        <p style={{ color: TEXT_SEC, fontSize: 14 }}>Iniciá sesión para usar el planificador de horarios.</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-4 min-w-0">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .ws-grid-wrap  { overflow: visible !important; background: white !important; border-color: #ddd !important; }
          .ws-col        { border-left-color: #ccc !important; }
          .ws-col-header { background: #f8f8f8 !important; border-bottom-color: #ccc !important; color: #111 !important; }
          .ws-time-label { color: #666 !important; opacity: 1 !important; }
          .ws-slot-line  { border-bottom-color: #ebebeb !important; }
          .ws-block       { background: #fff !important; border: 1px solid #999 !important; box-shadow: none !important; opacity: 1 !important; outline: none !important; filter: none !important; }
          .ws-block-title { color: #111 !important; -webkit-text-fill-color: #111 !important; text-shadow: none !important; }
          .ws-block-meta  { color: #111 !important; -webkit-text-fill-color: #111 !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2" data-no-print>
        <h2 className="flex-1 min-w-0" style={{ color: TEXT, fontSize: 16, fontWeight: 700, margin: 0 }}>
          Planificador de cuatrimestre
        </h2>
        <span className="hidden sm:inline" style={{ color: TEXT_SEC, fontSize: 12 }}>
          Clic en celda · arrastrá para mover
        </span>
        <button type="button" style={BTN_VIO}
          onClick={() => { setActiveBlock(null); setPanel({ type: "create" }); }}>
          + Agregar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ ...ERROR_PANEL, borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto rounded-2xl ws-grid-wrap" style={{ ...SURFACE }}>
        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160 }}>
            <span style={{ color: TEXT_SEC, fontSize: 14 }}>Cargando horario...</span>
          </div>
        ) : (
          <div
            ref={gridRef}
            style={{ display: "flex", userSelect: "none", cursor: draggingId ? "grabbing" : "default" }}
            onPointerMove={onGridPointerMove}
            onPointerUp={(e) => void onGridPointerUp(e)}
            onPointerCancel={onGridPointerCancel}
          >
            {/* Time axis */}
            <div style={{ width: 40, flexShrink: 0, height: GRID_HEIGHT + SLOT_PX }}>
              <div style={{ height: SLOT_PX }} />
              <div style={{ position: "relative", height: GRID_HEIGHT }}>
                {TIME_LABELS.map((label, i) => (
                  <div key={label} className="ws-time-label" style={{ position: "absolute", right: 4, top: i * SLOT_PX - 7, fontSize: 10, color: TEXT_SEC, opacity: 0.7 }}>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Day columns */}
            {DIAS_SEMANA.map((diaLabel, diaIdx) => {
              const diaNum    = diaIdx + 1;
              const diaBlocks = blocks.filter((b) => b.dia === diaNum);
              const diaGhost  = ghost?.dia === diaNum ? ghost : null;

              return (
                <div key={diaLabel} className="ws-col" style={{ display: "flex", flex: 1, flexDirection: "column", borderLeft: COL_LINE }}>
                  {/* Header */}
                  <div className="ws-col-header" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: SLOT_PX, borderBottom: COL_LINE, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: TEXT_SEC, overflow: "hidden" }}>
                    {diaLabel.slice(0, 3)}
                  </div>

                  {/* Slot area */}
                  <div
                    ref={(el) => { columnRefs.current[diaIdx] = el; }}
                    style={{ position: "relative", height: GRID_HEIGHT, cursor: draggingId ? "grabbing" : "crosshair" }}
                    onClick={(e) => onSlotClick(e, diaNum)}
                  >
                    {/* Slot lines */}
                    {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                      <div key={i} className="ws-slot-line" style={{ position: "absolute", width: "100%", top: i * SLOT_PX, height: SLOT_PX, borderBottom: SLOT_LINE }} />
                    ))}

                    {/* Ghost */}
                    {diaGhost && (
                      <div
                        className="pointer-events-none"
                        style={{
                          position: "absolute", left: 2, right: 2, borderRadius: 6,
                          top: blockTopPx(diaGhost.horaInicio) + 1,
                          height: blockHeightPx(diaGhost.horaInicio, diaGhost.horaFin) - 2,
                          background: diaGhost.hasConflict ? "rgba(220,38,38,0.15)" : `${diaGhost.color}20`,
                          border: `2px dashed ${diaGhost.hasConflict ? "#ef4444" : diaGhost.color}`,
                          zIndex: 10,
                        }}
                      />
                    )}

                    {/* Blocks */}
                    {diaBlocks.map((block) => {
                      const top       = blockTopPx(block.horaInicio);
                      const height    = blockHeightPx(block.horaInicio, block.horaFin);
                      const color     = block.color ?? "#9d4edd";
                      const isDragging = draggingId === block.id;
                      const isSelected = activeBlock?.id === block.id;
                      const isEditing  = panel?.type === "edit" && panel.block.id === block.id;

                      return (
                        <div
                          key={block.id}
                          className="ws-block"
                          style={{
                            position: "absolute", left: 2, right: 2, overflow: "hidden", borderRadius: 6,
                            top: top + 1, height: height - 2,
                            background: `${color}28`,
                            border: `1.5px solid ${color}`,
                            outline: isEditing ? `2px solid ${color}` : isSelected ? "2px solid rgba(255,255,255,0.5)" : undefined,
                            opacity: isDragging ? 0.25 : 1,
                            cursor: isDragging ? "grabbing" : "pointer",
                            zIndex: isSelected ? 15 : isDragging ? 1 : 5,
                            touchAction: "none",
                          }}
                          onPointerDown={(e) => onBlockPointerDown(e, block)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (suppressClickRef.current) return;
                            setActiveBlock((p) => p?.id === block.id ? null : { id: block.id, confirming: false });
                          }}
                        >
                          {/* Content */}
                          <div style={{ padding: "3px 6px", opacity: isSelected ? 0.2 : 1 }}>
                            <p className="ws-block-title" style={{ margin: 0, color, fontSize: 11, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {block.materiaNombre}
                            </p>
                            {height >= 40 && (
                              <p className="ws-block-meta" style={{ margin: 0, color: TEXT_SEC, fontSize: 10, lineHeight: 1.3 }}>
                                {minutesToTimeString(block.horaInicio)}–{minutesToTimeString(block.horaFin)}
                                {block.comision ? ` · ${block.comision}` : ""}
                              </p>
                            )}
                            {height >= 60 && block.notas && (
                              <p style={{ margin: "2px 0 0", color: TEXT_SEC, fontSize: 10, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {block.notas}
                              </p>
                            )}
                          </div>

                          {/* Action overlay */}
                          {isSelected && (
                            <div
                              style={{ position: "absolute", inset: 0, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 6, padding: "2px 4px", background: "rgba(10,8,20,0.92)" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {!activeBlock!.confirming ? (
                                <>
                                  <button type="button" style={BTN_SM}
                                    onClick={() => { setPanel({ type: "edit", block }); setActiveBlock(null); }}>
                                    Editar
                                  </button>
                                  <button type="button"
                                    style={{ ...BTN_SM, color: "#fca5a5", borderColor: "rgba(239,68,68,0.4)" }}
                                    onClick={() => setActiveBlock({ id: block.id, confirming: true })}>
                                    Eliminar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span style={{ color: TEXT_SEC, fontSize: 10 }}>¿Seguro?</span>
                                  <button type="button" style={BTN_RED} disabled={deletingId === block.id}
                                    onClick={() => void handleDelete(block.id)}>
                                    {deletingId === block.id ? "..." : "Sí"}
                                  </button>
                                  <button type="button" style={BTN_SM} onClick={() => setActiveBlock(null)}>No</button>
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

      {/* Modal */}
      {panel && (
        <div
          data-no-print
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setPanel(null)}
        >
          <div
            style={{
              background: "rgba(18,12,36,0.97)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 20,
              padding: "24px 24px 20px",
              width: "min(100%, 480px)",
              backdropFilter: "blur(24px)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
              maxHeight: "90dvh",
              overflowY: "auto",
              animation: "dropdownIn 160ms ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 id="schedule-modal-title" style={{ margin: 0, color: TEXT, fontSize: 16, fontWeight: 700 }}>
                {panel.type === "create" ? "Nuevo bloque" : "Editar bloque"}
              </h3>
              <button type="button" style={{ ...BTN, padding: "6px 12px", fontSize: 13 }} onClick={() => setPanel(null)} aria-label="Cerrar">✕</button>
            </div>
            <ScheduleBlockForm
              block={panel.type === "edit" ? panel.block : undefined}
              defaultDia={panel.type === "create" ? panel.prefill?.dia : undefined}
              defaultHoraInicio={panel.type === "create" ? panel.prefill?.horaInicio : undefined}
              materias={materiaOptions}
              onSave={panel.type === "create"
                ? (d) => handleCreate(d as CreateBlockInput)
                : (d) => handleUpdate(panel.block.id, d as Partial<ScheduleBlock>)}
              onCancel={() => setPanel(null)}
            />
          </div>
        </div>
      )}

      {/* Block list */}
      {blocks.length > 0 && (
        <div data-no-print style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0, color: TEXT_SEC, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {blocks.length} {blocks.length === 1 ? "bloque" : "bloques"}
          </p>
          {blocks.map((block) => (
            <div key={block.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl px-3.5 py-2.5" style={{ ...SURFACE }}>
              <span className="shrink-0" style={{ width: 10, height: 10, borderRadius: "50%", background: block.color ?? "#9d4edd" }} />
              <span className="flex-1 min-w-24" style={{ color: TEXT, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {block.materiaNombre}
              </span>
              <span className="shrink-0" style={{ color: TEXT_SEC, fontSize: 12 }}>
                {DIAS_SEMANA[block.dia - 1]} {minutesToTimeString(block.horaInicio)}–{minutesToTimeString(block.horaFin)}
                {block.comision ? ` · ${block.comision}` : ""}
              </span>
              <div className="flex gap-1 shrink-0 ml-auto">
                <button type="button" style={{ ...BTN, padding: "4px 10px", fontSize: 12 }}
                  onClick={() => { setActiveBlock(null); setPanel({ type: "edit", block }); }}>
                  Editar
                </button>
                <button type="button" disabled={deletingId === block.id}
                  style={{ ...BTN, padding: "4px 10px", fontSize: 12, color: "#fca5a5", borderColor: "rgba(239,68,68,0.35)", opacity: deletingId === block.id ? 0.5 : 1 }}
                  onClick={() => void handleDelete(block.id)}>
                  {deletingId === block.id ? "..." : "Eliminar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && blocks.length === 0 && !panel && (
        <p style={{ textAlign: "center", color: TEXT_SEC, fontSize: 13, opacity: 0.6 }}>
          No hay bloques todavía. Hacé clic en cualquier celda de la grilla para agregar uno.
        </p>
      )}
    </div>
  );
}
