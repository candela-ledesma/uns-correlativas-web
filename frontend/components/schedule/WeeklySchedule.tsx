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
} from "@/lib/schedule/scheduleValidation";
import { useSchedule, type ScheduleBlock, type CreateBlockInput } from "@/hooks/useSchedule";
import ScheduleBlockForm from "@/components/schedule/ScheduleBlockForm";
import type { Materia } from "@/app/types/plan";

import { TEXT, TEXT_SEC, SURFACE, BTN as BTN_BASE, BTN_VIOLET, GLASS, ERROR_PANEL } from "@/lib/ui/tokens";
// Variantes locales con layout específico del planificador
const BTN     = { ...BTN_BASE,   borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600 } as const;
const BTN_VIO = { ...BTN_VIOLET, borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700 } as const;
const SLOT_LINE = `1px solid ${GLASS.soft}`;    // separador de media hora en la grilla
const COL_LINE  = `1px solid ${GLASS.medium}`;  // borde entre columnas de día

// ── Paleta de colores por materia ─────────────────────────────────────────
const BLOCK_PALETTE = [
  "#9d4edd", "#2563eb", "#059669", "#d97706", "#dc2626",
  "#7c3aed", "#0891b2", "#65a30d", "#ea580c", "#db2777",
] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function colorForMateria(nombre: string): string {
  return BLOCK_PALETTE[hashString(nombre) % BLOCK_PALETTE.length];
}

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

type DragState = {
  blockId: string; block: ScheduleBlock;
  duration: number; grabOffsetMinutes: number;
  startX: number; startY: number;
};

// Ghost is computed imperatively during drag and only stored in state at drop time
type Ghost = { dia: number; horaInicio: number; horaFin: number; hasConflict: boolean; color: string };

type Props = { careerId: string; carreraSlug: string; versionId: string; materias: Materia[] };

// ── Component ──────────────────────────────────────────────────────────────
export default function WeeklySchedule({ careerId, carreraSlug, versionId, materias }: Props) {
  const { status: sessionStatus } = useSession();
  const { blocks, isLoading, error, createBlock, updateBlock, deleteBlock } = useSchedule({ careerId, carreraSlug, versionId });

  const [panel,      setPanel]      = useState<Panel | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [gcalState,    setGcalState]    = useState<"idle" | "loading" | "deleting" | "ok" | "unlinked" | "error">("idle");
  const [gcalMsg,      setGcalMsg]      = useState<string | null>(null);
  const [gcalOpen,     setGcalOpen]     = useState(false);

  const dragRef          = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const columnRefs       = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null]);
  const gridRef          = useRef<HTMLDivElement>(null);
  // Imperative ghost: updated directly on DOM, no React state during drag
  const ghostElRef       = useRef<HTMLDivElement | null>(null);
  const ghostDataRef     = useRef<Ghost | null>(null);
  const rafRef           = useRef<number | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setPanel(null); setGcalOpen(false); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!gcalOpen) return;
    function onClickOutside() { setGcalOpen(false); }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, [gcalOpen]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    const params = new URLSearchParams({ careerId });
    fetch(`/api/planificador/exportar-gcal?${params}`)
      .then((r) => r.json())
      .then((json: { linked?: boolean; noToken?: boolean }) => {
        if (json.linked) setGcalState("ok");
        else if (json.noToken) setGcalState("unlinked");
      })
      .catch(() => undefined);
  }, [careerId, sessionStatus]);

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
    return { dia, horaInicio: ini, horaFin: fin, hasConflict: conflict, color: drag.block.color ?? colorForMateria(drag.block.materiaNombre) };
  }

  // Update the DOM ghost element directly — zero React re-renders during drag
  function applyGhostToDOM(g: Ghost) {
    const el = ghostElRef.current;
    if (!el) return;
    const col = columnRefs.current[g.dia - 1];
    if (!col) return;
    const colRect = col.getBoundingClientRect();
    const gridRect = gridRef.current?.getBoundingClientRect();
    if (!gridRect) return;

    const top    = blockTopPx(g.horaInicio);
    const height = blockHeightPx(g.horaInicio, g.horaFin);
    const left   = colRect.left - gridRect.left + 2;
    const width  = colRect.width - 4;

    el.style.display  = "block";
    el.style.top      = `${top + 1}px`;
    el.style.height   = `${height - 2}px`;
    el.style.left     = `${left}px`;
    el.style.width    = `${width}px`;
    el.style.background = g.hasConflict ? "rgba(220,38,38,0.15)" : `${g.color}20`;
    el.style.borderColor = g.hasConflict ? "#ef4444" : g.color;
  }

  function hideGhostDOM() {
    if (ghostElRef.current) ghostElRef.current.style.display = "none";
    ghostDataRef.current = null;
  }

  function onBlockPointerDown(e: React.PointerEvent, block: ScheduleBlock) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const hit = getHit(e.clientX, e.clientY);
    if (!hit) return;
    const grab = HORA_INICIO_GRILLA + (hit.y / SLOT_PX) * SLOT_MINUTOS - block.horaInicio;
    dragRef.current = { blockId: block.id, block, duration: block.horaFin - block.horaInicio, grabOffsetMinutes: grab, startX: e.clientX, startY: e.clientY };
    setDraggingId(block.id);
    gridRef.current?.setPointerCapture(e.pointerId);
    // Fix 4: hint compositor to promote this element
    const blockEl = e.currentTarget as HTMLElement;
    blockEl.style.willChange = "transform";
  }

  function onGridPointerMove(e: React.PointerEvent) {
    const d = dragRef.current; if (!d) return;
    if (Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD && Math.abs(e.clientY - d.startY) < DRAG_THRESHOLD) return;
    // Fix 3: throttle snap calculation to one per animation frame
    if (rafRef.current !== null) return;
    const cx = e.clientX; const cy = e.clientY;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const g = buildGhost(cx, cy, d, ghostDataRef.current);
      ghostDataRef.current = g;
      applyGhostToDOM(g);
    });
  }

  async function onGridPointerUp(e: React.PointerEvent) {
    const d = dragRef.current; if (!d) return;
    // Fix 3: cancel pending RAF
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    gridRef.current?.releasePointerCapture(e.pointerId);
    // Fix 4: clean up will-change on the dragged block element
    const blockEls = gridRef.current?.querySelectorAll(`[data-block-id="${d.blockId}"]`);
    blockEls?.forEach((el) => { (el as HTMLElement).style.willChange = "auto"; });
    dragRef.current = null; setDraggingId(null);
    const g = ghostDataRef.current;
    hideGhostDOM();
    const wasDrag = Math.abs(e.clientX - d.startX) >= DRAG_THRESHOLD || Math.abs(e.clientY - d.startY) >= DRAG_THRESHOLD;
    if (wasDrag) { suppressClickRef.current = true; setTimeout(() => { suppressClickRef.current = false; }, 0); }
    if (!wasDrag || !g || g.hasConflict) return;
    const orig = blocks.find((b) => b.id === d.blockId);
    if (!orig || (orig.dia === g.dia && orig.horaInicio === g.horaInicio)) return;
    await updateBlock(d.blockId, { dia: g.dia, horaInicio: g.horaInicio, horaFin: g.horaFin });
  }

  function onGridPointerCancel() {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    dragRef.current = null; setDraggingId(null);
    hideGhostDOM();
  }

  // ── Cell click → create ───────────────────────────────────────────────────
  function onSlotClick(e: React.MouseEvent, dia: number) {
    if (draggingId) return;
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
    if (panel?.type === "edit" && panel.block.id === id) setPanel(null);
  }

  // ── Google Calendar export ────────────────────────────────────────────────
  async function handleExportGCal() {
    if (gcalState === "loading" || gcalState === "deleting") return;
    setGcalState("loading");
    setGcalMsg(null);
    const params = new URLSearchParams({ careerId, planId: carreraSlug, versionId });
    const res = await fetch(`/api/planificador/exportar-gcal?${params}`, { method: "POST" }).catch(() => null);
    if (!res) { setGcalState("error"); setGcalMsg("Error de red"); return; }
    const json = await res.json().catch(() => ({})) as { created?: number; failed?: number; error?: string };
    if (!res.ok || json.error) {
      const noToken = res.status === 403;
      setGcalState(noToken ? "unlinked" : "error");
      setGcalMsg(noToken ? "Iniciá sesión con Google para exportar a Calendar." : (json.error ?? "Error al exportar"));
    } else {
      setGcalState("ok");
      const parts = [];
      if (json.created) parts.push(`${json.created} evento${json.created === 1 ? "" : "s"} exportado${json.created === 1 ? "" : "s"}`);
      if (json.failed)  parts.push(`${json.failed} fallido${json.failed === 1 ? "" : "s"}`);
      setGcalMsg(parts.length ? parts.join(" · ") : "Calendario actualizado");
    }
  }

  async function handleUnlinkGCal() {
    setGcalState("deleting");
    setGcalMsg(null);
    const params = new URLSearchParams({ careerId, planId: carreraSlug, versionId });
    const res = await fetch(`/api/planificador/exportar-gcal?${params}`, { method: "DELETE" }).catch(() => null);
    if (!res) { setGcalState("error"); setGcalMsg("Error de red"); return; }
    const json = await res.json().catch(() => ({})) as { deleted?: number; failed?: number; error?: string };
    if (!res.ok || json.error) {
      setGcalState("error");
      setGcalMsg(json.error ?? "Error al desvincular");
    } else {
      setGcalState("unlinked");
      setGcalMsg(json.deleted ? `${json.deleted} evento${json.deleted === 1 ? "" : "s"} eliminado${json.deleted === 1 ? "" : "s"} de Google Calendar` : "No había eventos para eliminar");
    }
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
    <div className="grid gap-4 min-w-0 w-full">
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
        @media (max-width: 640px) {
          .ws-block-title { font-size: 10px !important; }
          .ws-block-meta  { font-size: 9px !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="flex flex-col gap-1.5" data-no-print>
        {/* Fila 1: título */}
        <h2 style={{ color: TEXT, fontSize: 16, fontWeight: 700, margin: 0 }}>
          Planificador de cuatrimestre
        </h2>
        {/* Fila 2: badge + botón */}
        <div className="flex items-center gap-2" style={{ justifyContent: "space-between" }}>
          <span className="hidden sm:inline" style={{ color: TEXT_SEC, fontSize: 12 }}>
            Clic en celda · arrastrá para mover
          </span>

        {/* Google Calendar badge */}
        {blocks.length > 0 && (
          <div style={{ position: "relative" }}>
            <div
              role="button"
              tabIndex={0}
              aria-expanded={gcalOpen}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 99, fontSize: 12, fontWeight: 500,
                cursor: (gcalState === "loading" || gcalState === "deleting") ? "default" : "pointer",
                opacity: (gcalState === "loading" || gcalState === "deleting") ? 0.6 : 1,
                userSelect: "none",
                ...(gcalState === "error"
                  ? { background: "rgba(239,68,68,0.10)", color: "#fca5a5" }
                  : gcalState === "ok"
                    ? { background: "rgba(34,197,94,0.10)", color: "#86efac" }
                    : { background: "rgba(255,255,255,0.06)", color: TEXT_SEC }),
              }}
              onClick={(e) => {
                if (gcalState === "loading" || gcalState === "deleting") return;
                e.stopPropagation();
                setGcalOpen((o) => !o);
              }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setGcalOpen((o) => !o); } }}
            >
              {(gcalState !== "unlinked" && gcalState !== "idle") && (
                <span style={{ fontSize: 11, color: gcalState === "error" ? "#fca5a5" : gcalState === "ok" ? "#6fcf6f" : TEXT_SEC }}>
                  {gcalState === "loading" || gcalState === "deleting" ? "⏳" : gcalState === "error" ? "⚠" : "✓"}
                </span>
              )}
              {gcalState === "loading" ? "Exportando..." :
               gcalState === "deleting" ? "Desvinculando..." :
               gcalState === "error" ? "Google Calendar" :
               gcalState === "unlinked" ? "Vincular Google Calendar" :
               "Google Calendar vinculado"}
            </div>

            {gcalOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
                  background: "rgba(18,12,36,0.97)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12,
                  padding: 6,
                  minWidth: 220,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                  display: "grid", gap: 2,
                }}
              >
                {gcalState === "unlinked" ? (
                  <>
                    <p style={{ margin: 0, padding: "6px 10px", fontSize: 12, color: TEXT_SEC }}>
                      Conectá tu cuenta de Google para exportar el horario a Calendar.
                    </p>
                    <button
                      type="button"
                      style={{ ...BTN, width: "100%", textAlign: "left", justifyContent: "flex-start" }}
                      onClick={() => {
                        window.location.href = `/api/auth/google-calendar/connect?callbackUrl=${encodeURIComponent(window.location.href)}`;
                      }}
                    >
                      Conectar con Google →
                    </button>
                  </>
                ) : (
                  <>
                    {gcalMsg && (
                      <p style={{
                        margin: 0, padding: "6px 10px", fontSize: 12,
                        color: gcalState === "ok" ? "#86efac" : "#fca5a5",
                      }}>
                        {gcalMsg}
                      </p>
                    )}
                    {gcalState === "ok" && (
                      <>
                        <p style={{ margin: 0, padding: "6px 10px", fontSize: 12, color: TEXT_SEC }}>
                          Ya exportado. Re-exportar actualizará los eventos existentes.
                        </p>
                        <a
                          href="https://calendar.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ ...BTN, width: "100%", textAlign: "left", justifyContent: "flex-start", textDecoration: "none", color: "#86efac", borderColor: "rgba(134,239,172,0.3)" }}
                        >
                          Abrir Google Calendar →
                        </a>
                      </>
                    )}
                    <button
                      type="button"
                      style={{ ...BTN, width: "100%", textAlign: "left", justifyContent: "flex-start" }}
                      onClick={() => { void handleExportGCal(); setGcalOpen(false); }}
                    >
                      {gcalState === "ok" ? "Re-exportar horario" : "Exportar horario"}
                    </button>
                    <button
                      type="button"
                      style={{ ...BTN, width: "100%", textAlign: "left", justifyContent: "flex-start", color: "#fca5a5", borderColor: "rgba(239,68,68,0.35)" }}
                      onClick={() => { void handleUnlinkGCal(); setGcalOpen(false); }}
                    >
                      Eliminar eventos exportados
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

          <button
            type="button"
            style={{ ...BTN_VIO, padding: "6px 12px", fontSize: 12, whiteSpace: "nowrap", marginLeft: "auto" }}
            onClick={() => setPanel({ type: "create" })}
          >
            + Agregar materia
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ ...ERROR_PANEL, borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Grid */}
      <div
        className="rounded-2xl ws-grid-wrap max-w-full"
        style={{
          ...SURFACE,
          overflowX: "auto",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          maxHeight: "calc(100svh - 200px)",
        }}
      >
        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160 }}>
            <span style={{ color: TEXT_SEC, fontSize: 14 }}>Cargando horario...</span>
          </div>
        ) : (
          <div
            ref={gridRef}
            style={{ display: "flex", userSelect: "none", cursor: draggingId ? "grabbing" : "default", position: "relative", minWidth: "max-content" }}
            onPointerMove={onGridPointerMove}
            onPointerUp={(e) => void onGridPointerUp(e)}
            onPointerCancel={onGridPointerCancel}
          >
            {/* Imperative ghost overlay — positioned and styled directly via ghostElRef, no React re-renders */}
            <div
              ref={ghostElRef}
              className="pointer-events-none"
              style={{ display: "none", position: "absolute", borderRadius: 6, border: "2px dashed", zIndex: 20 }}
            />
            {/* Time axis — sticky en scroll horizontal */}
            <div style={{ width: 40, flexShrink: 0, height: GRID_HEIGHT + SLOT_PX, position: "sticky", left: 0, zIndex: 2, background: "inherit" }}>
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

              return (
                <div key={diaLabel} className="ws-col" style={{ display: "flex", flex: 1, flexDirection: "column", borderLeft: COL_LINE, minWidth: 64 }}>
                  {/* Header */}
                  <div className="ws-col-header" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: SLOT_PX, borderBottom: COL_LINE, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: TEXT_SEC, overflow: "hidden" }}>
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

                    {/* Blocks */}
                    {diaBlocks.map((block) => {
                      const top        = blockTopPx(block.horaInicio);
                      const height     = blockHeightPx(block.horaInicio, block.horaFin);
                      const color      = block.color ?? colorForMateria(block.materiaNombre);
                      const isDragging = draggingId === block.id;
                      const isEditing  = panel?.type === "edit" && panel.block.id === block.id;
                      const timeLabel  = `${minutesToTimeString(block.horaInicio)}–${minutesToTimeString(block.horaFin)}`;
                      const tooltipParts = [block.materiaNombre, timeLabel, block.comision, block.notas].filter(Boolean);

                      return (
                        <div
                          key={block.id}
                          data-block-id={block.id}
                          className="ws-block"
                          title={tooltipParts.join(" · ")}
                          style={{
                            position: "absolute", left: 2, right: 2, overflow: "hidden", borderRadius: 6,
                            top: top + 1, height: height - 2,
                            background: `${color}22`,
                            border: `1.5px solid ${color}`,
                            outline: isEditing ? `2px solid ${color}` : undefined,
                            opacity: isDragging ? 0.25 : 1,
                            cursor: isDragging ? "grabbing" : "pointer",
                            zIndex: isDragging ? 1 : 5,
                            touchAction: "none",
                          }}
                          onPointerDown={(e) => onBlockPointerDown(e, block)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (suppressClickRef.current) return;
                            setPanel({ type: "edit", block });
                          }}
                        >
                          <div style={{ padding: "2px 5px", display: "flex", flexDirection: "column", gap: 1 }}>
                            <p className="ws-block-title" style={{ margin: 0, color, fontSize: 10, fontWeight: 700, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {block.materiaNombre}
                            </p>
                            <p className="ws-block-meta" style={{ margin: 0, color: TEXT_SEC, fontSize: 9, lineHeight: 1.2, opacity: 0.85 }}>
                              {timeLabel}{block.comision ? ` · ${block.comision}` : ""}
                            </p>
                          </div>
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
                  onClick={() => setPanel({ type: "edit", block })}>
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
