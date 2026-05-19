"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Materia, Agrupador } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";
import { estaHabilitadaParaCursar } from "@/lib/plan/evaluarCorrelativas";

import { TEXT as TEXT_BASE, TEXT_SEC, TEXT_DET as TEXT_DETAIL, TITLE_SHADOW, BG_GRADIENT, HEADING_FONT as FONT } from "@/lib/ui/tokens";
import {
  type CuatrSlot,
  PALETTE, SLOT_LABEL,
  buildInitialOrder, getYearsFromOrder, getNextYearName,
  getMateriaEstado, getMateriaOrientacionKey,
  extractOrientaciones, passesOrientationFilter,
} from "@/lib/plan/kanbanUtils";

// ── Types ─────────────────────────────────────────────────────────────────────
type Props = {
  materias: Materia[];
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  estados: Record<string, EstadoMateria>;
};

type DragRef = { materiaId: string; fromCol: string };

// ── Helpers de estilo ─────────────────────────────────────────────────────────
function getBadgeStyle(estado: EstadoMateria, puedeCursar: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", whiteSpace: "nowrap",
    borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 700, border: "1px solid",
  };
  if (estado === "aprobada") return { ...base, background: "#90be6d22", color: "#90be6d", borderColor: "#90be6d66" };
  if (estado === "cursada")  return { ...base, background: "#4cc9f022", color: "#4cc9f0", borderColor: "#4cc9f066" };
  if (puedeCursar)           return { ...base, background: "#f9c74f22", color: "#f9c74f", borderColor: "#f9c74f66" };
  return { ...base, background: "rgba(255,255,255,0.06)", color: TEXT_SEC, borderColor: "rgba(255,255,255,0.15)" };
}

function getBadgeLabel(estado: EstadoMateria, puedeCursar: boolean): string {
  if (estado === "aprobada") return "Aprobada";
  if (estado === "cursada")  return "Cursada";
  if (puedeCursar)           return "Disponible";
  return "Bloqueada";
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function KanbanPlan({ materias, agrupadores, idsAgrupadores, estados }: Props) {
  const materiaById = useMemo(() => {
    const map = new Map(materias.map((m) => [String(m.id), m]));
    // Agrupadores que solo están en agrupadores[] (POSITION B) — crear entrada sintética
    for (const ag of agrupadores) {
      const id = String(ag.id);
      if (!map.has(id) && ag.año) {
        map.set(id, {
          id,
          nombre: ag.nombre ?? id,
          año: ag.año,
          cuatrimestre: ag.cuatrimestre,
          horas: "",
          tipo: "agrupador_requisito",
          categoria: "normal",
          grupo_opcion: null,
          subtipo: null,
          correlativas: {},
        } as Materia);
      }
    }
    return map;
  }, [materias, agrupadores]);

  const [localOrder, setLocalOrder] = useState<Record<string, string[]>>(() =>
    buildInitialOrder(materias, idsAgrupadores, agrupadores)
  );
  const [dragOver,          setDragOver]          = useState<string | null>(null);
  const [touchDragId,       setTouchDragId]       = useState<string | null>(null);
  const [showMateriaStatus, setShowMateriaStatus]  = useState(true);
  const [selectedOrientacion, setSelectedOrientacion] = useState("todas");

  const dragRef            = useRef<DragRef | null>(null);
  const touchStartRef      = useRef<{ x: number; y: number } | null>(null);
  const isTouchDragRef     = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const yearRefs           = useRef<Record<string, HTMLDivElement | null>>({});
  const [newlyAddedYear,   setNewlyAddedYear]      = useState<string | null>(null);

  const years = getYearsFromOrder(localOrder);

  const isModified =
    JSON.stringify(localOrder) !== JSON.stringify(buildInitialOrder(materias, idsAgrupadores, agrupadores));

  // Orientaciones disponibles en el plan (vacío = sin orientaciones)
  const orientaciones = useMemo(
    () => extractOrientaciones(materias, agrupadores),
    [materias, agrupadores]
  );
  const hasOrientaciones = orientaciones.length > 0;

  // ── Touch drag-and-drop (mobile) ─────────────────────────────────────────────
  // HTML5 draggable API doesn't fire on iOS Safari / Android touch.
  // We implement it via touchstart/touchmove/touchend + elementFromPoint.

  function onCardTouchStart(e: React.TouchEvent, materiaId: string, fromCol: string) {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    isTouchDragRef.current = false;
    dragRef.current = { materiaId, fromCol };
  }

  function onContainerTouchEnd(e: React.TouchEvent) {
    if (!dragRef.current) return;
    if (isTouchDragRef.current) {
      const t = e.changedTouches[0];
      const under = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null;
      const colEl = under?.closest("[data-colkey]") as HTMLElement | null;
      const toCol = colEl?.dataset.colkey;
      if (toCol) handleDrop(toCol);
      else { dragRef.current = null; setDragOver(null); }
    } else {
      dragRef.current = null;
    }
    touchStartRef.current = null;
    isTouchDragRef.current = false;
    setTouchDragId(null);
  }

  function onContainerTouchCancel() {
    dragRef.current = null;
    touchStartRef.current = null;
    isTouchDragRef.current = false;
    setDragOver(null);
    setTouchDragId(null);
  }

  // Non-passive touchmove so e.preventDefault() can suppress scroll while dragging
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => {
      if (!dragRef.current || !touchStartRef.current) return;
      const t = e.touches[0];
      const moved = Math.hypot(t.clientX - touchStartRef.current.x, t.clientY - touchStartRef.current.y);
      if (moved < 8) return;
      if (!isTouchDragRef.current) {
        isTouchDragRef.current = true;
        setTouchDragId(dragRef.current.materiaId);
      }
      e.preventDefault();
      const under = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null;
      const colEl = under?.closest("[data-colkey]") as HTMLElement | null;
      setDragOver(colEl?.dataset.colkey ?? null);
    };
    el.addEventListener("touchmove", handler, { passive: false });
    return () => el.removeEventListener("touchmove", handler);
  }, []);

  useEffect(() => {
    if (!newlyAddedYear) return;
    const container = scrollContainerRef.current;
    const yearEl    = yearRefs.current[newlyAddedYear];
    if (container && yearEl) {
      yearEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
    const timeout = setTimeout(() => setNewlyAddedYear(null), 500);
    return () => clearTimeout(timeout);
  }, [newlyAddedYear, years]);

  function handleReset()    { setLocalOrder(buildInitialOrder(materias, idsAgrupadores, agrupadores)); }
  function handleAddYear()  {
    const newYear = getNextYearName(years);
    setLocalOrder((prev) => ({ ...prev, [`${newYear}|1`]: [], [`${newYear}|2`]: [] }));
    setNewlyAddedYear(newYear);
  }

  function handleDragStart(materiaId: string, fromCol: string) {
    dragRef.current = { materiaId, fromCol };
  }

  function handleDrop(toCol: string) {
    const drag = dragRef.current;
    if (!drag || drag.fromCol === toCol) { setDragOver(null); dragRef.current = null; return; }
    setLocalOrder((prev) => ({
      ...prev,
      [drag.fromCol]: (prev[drag.fromCol] ?? []).filter((id) => id !== drag.materiaId),
      [toCol]: [...(prev[toCol] ?? []), drag.materiaId],
    }));
    setDragOver(null);
    dragRef.current = null;
  }

  const btnBase: React.CSSProperties = {
    borderRadius: 10, padding: "6px 14px", fontSize: 12, fontFamily: FONT, cursor: "pointer",
  };

  function renderMateriaCard(materia: Materia, colKey: string, color: string) {
    const estado         = getMateriaEstado(materia, estados);
    const puedeCursar    = estaHabilitadaParaCursar(materia, estados, agrupadores);
    const isLifted       = touchDragId === String(materia.id);
    const anyTouchActive = touchDragId !== null;
    return (
      <div
        key={String(materia.id)}
        draggable
        onDragStart={() => handleDragStart(String(materia.id), colKey)}
        onDragEnd={() => setDragOver(null)}
        onTouchStart={(e) => onCardTouchStart(e, String(materia.id), colKey)}
        className="kp-card"
        style={{
          background:   isLifted
            ? `linear-gradient(135deg, ${color}44, ${color}22)`
            : `linear-gradient(135deg, ${color}22, transparent)`,
          borderTop:    `1px solid ${isLifted ? color : `${color}33`}`,
          borderRight:  `1px solid ${isLifted ? color : `${color}33`}`,
          borderBottom: `1px solid ${isLifted ? color : `${color}33`}`,
          borderLeft:   `4px solid ${color}`,
          borderRadius: 10, padding: "9px 10px",
          cursor: "grab", userSelect: "none",
          touchAction: "none",
          transform:   isLifted ? "scale(1.04)" : undefined,
          boxShadow:   isLifted ? `0 8px 20px ${color}55, 0 0 0 1.5px ${color}` : undefined,
          zIndex:      isLifted ? 10 : undefined,
          opacity:     isLifted ? 1 : (anyTouchActive ? 0.5 : (!puedeCursar && estado === "no_cursada" ? 0.55 : 1)),
          transition:  "transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s, border-color 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              title={materia.nombre}
              style={{
                color: TEXT_BASE, fontWeight: "bold", fontSize: 12, lineHeight: 1.4,
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical", overflow: "hidden",
              } as React.CSSProperties}
            >
              {materia.nombre}
            </div>
            <div style={{ color: TEXT_DETAIL, fontSize: 11, marginTop: 2 }}>
              {materia.id}{materia.horas && ` · ${materia.horas} hs`}
            </div>
          </div>
          {showMateriaStatus && (
            <span style={{ ...getBadgeStyle(estado, puedeCursar), flexShrink: 0 }}>
              {getBadgeLabel(estado, puedeCursar)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 kp-root" style={{ background: BG_GRADIENT, fontFamily: FONT, borderRadius: 20, padding: 20 }}>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          .kanban-years-container { flex-wrap: wrap !important; overflow: visible !important; overflow-x: visible !important; }
          .kanban-year-card { break-inside: avoid; page-break-inside: avoid; }

          .kp-root           { background: white !important; }
          .kp-year-card      { background: white !important; border-color: #bbb !important; }
          .kp-year-header    { background: #f2f2f2 !important; border-bottom-color: #bbb !important; }
          .kp-year-header div { color: #111 !important; text-shadow: none !important; }
          .kp-col            { background: transparent !important; box-shadow: none !important; border-left-color: #ddd !important; }
          .kp-col-header     { background: #fafafa !important; border-bottom-color: #e0e0e0 !important; }
          .kp-col-header div { color: #444 !important; }
          .kp-card      { background: #fff !important; border: 1px solid #999 !important; box-shadow: none !important; opacity: 1 !important; transform: none !important; filter: none !important; }
          .kp-card div  { color: #111 !important; -webkit-text-fill-color: #111 !important; text-shadow: none !important; opacity: 1 !important; }
          .kp-card span { background: #fff !important; border: 1px solid #999 !important; color: #111 !important; -webkit-text-fill-color: #111 !important; }
        }
      `}</style>

      {/* Header controls */}
      <div data-no-print className="flex flex-wrap justify-end gap-2 mb-3">
        {isModified && (
          <button type="button" onClick={handleReset}
            style={{ ...btnBase, background: "rgba(157,78,221,0.10)", border: "1px dashed rgba(157,78,221,0.35)", color: "#9d4edd" }}>
            Restablecer orden original
          </button>
        )}

        {/* Selector de orientación — solo si el plan tiene orientaciones */}
        {hasOrientaciones && (
          <select
            value={selectedOrientacion}
            onChange={(e) => setSelectedOrientacion(e.target.value)}
            style={{
              ...btnBase,
              background: selectedOrientacion === "todas" ? "rgba(255,255,255,0.06)" : "rgba(157,78,221,0.15)",
              border: selectedOrientacion === "todas" ? "1px solid rgba(255,255,255,0.20)" : "1px solid rgba(157,78,221,0.45)",
              color: selectedOrientacion === "todas" ? TEXT_SEC : "#c084fc",
              paddingRight: 10,
            }}
          >
            <option value="todas">Todas las orientaciones</option>
            {orientaciones.map((ori) => (
              <option key={ori} value={ori}>{ori}</option>
            ))}
          </select>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" onClick={handleAddYear}
            style={{ ...btnBase, background: "rgba(76,201,240,0.10)", border: "1px solid rgba(76,201,240,0.35)", color: "#4cc9f0" }}>
            + Agregar año
          </button>
          <button type="button" onClick={() => setShowMateriaStatus((p) => !p)}
            style={{
              ...btnBase,
              background: showMateriaStatus ? "rgba(144,190,109,0.10)" : "rgba(255,255,255,0.06)",
              border: showMateriaStatus ? "1px solid rgba(144,190,109,0.35)" : "1px solid rgba(255,255,255,0.15)",
              color: showMateriaStatus ? "#90be6d" : TEXT_SEC,
            }}>
            {showMateriaStatus ? "Ocultar estado" : "Mostrar estado"}
          </button>
        </div>
      </div>

      {/* Year groups */}
      <div
        ref={scrollContainerRef}
        className="kanban-years-container flex flex-col sm:flex-row sm:overflow-x-auto gap-4 sm:gap-5 pb-4 items-start"
        onTouchEnd={onContainerTouchEnd}
        onTouchCancel={onContainerTouchCancel}
      >
        {years.map((anio, yearIdx) => {
          const color    = PALETTE[yearIdx % PALETTE.length];
          const hasAnual = `${anio}|A` in localOrder;

          // Columnas del año: siempre 1° y 2°, más "Anual" si existen materias anuales
          const slots: CuatrSlot[] = hasAnual ? ["A", "1", "2"] : ["1", "2"];
          const colKeys = slots.map((s) => `${anio}|${s}`);

          // Totales del año (todas las columnas, con filtro de orientación aplicado)
          const allColMaterias = colKeys.flatMap((k) =>
            (localOrder[k] ?? [])
              .map((id) => materiaById.get(id))
              .filter((m): m is Materia => m !== undefined)
              .filter((m) => passesOrientationFilter(m, selectedOrientacion, idsAgrupadores, agrupadores))
          );
          const totalMaterias = allColMaterias.length;
          const aprobadas     = allColMaterias.filter((m) => getMateriaEstado(m, estados) === "aprobada").length;

          return (
            <div
              key={anio}
              ref={(el) => { yearRefs.current[anio] = el; }}
              className="kanban-year-card kp-year-card w-full sm:w-auto sm:flex-shrink-0"
              style={{
                background: "rgba(255,255,255,0.03)", border: `1px solid ${color}44`,
                borderRadius: 20, overflow: "hidden",
              }}
            >
              {/* Year header */}
              <div className="kp-year-header" style={{ background: `${color}18`, borderBottom: `1px solid ${color}44`, padding: "10px 16px" }}>
                <div style={{ color, fontWeight: "bold", fontSize: 15, textShadow: TITLE_SHADOW }}>
                  {anio}
                </div>
                <div style={{ color: TEXT_SEC, fontSize: 11, marginTop: 6 }}>
                  {totalMaterias} materias{aprobadas > 0 && ` · ${aprobadas} aprobadas`}
                </div>
              </div>

              {/* Cuatrimestre sub-columns */}
              <div className="flex flex-col">
                {slots.map((slot, slotIdx) => {
                  const colKey      = `${anio}|${slot}`;
                  const ids         = localOrder[colKey] ?? [];
                  const isDragOver  = dragOver === colKey;

                  // Materias de esta columna filtradas por orientación
                  const colMaterias = ids
                    .map((id) => materiaById.get(id))
                    .filter((m): m is Materia => m !== undefined)
                    .filter((m) => passesOrientationFilter(m, selectedOrientacion, idsAgrupadores, agrupadores));

                  const cuatrAprobadas = colMaterias.filter((m) => getMateriaEstado(m, estados) === "aprobada").length;
                  const cuatrCursadas  = colMaterias.filter((m) => getMateriaEstado(m, estados) === "cursada").length;

                  // Separar comunes de orientadas para la sub-agrupación visual
                  const comunes   = colMaterias.filter((m) => getMateriaOrientacionKey(m) === null);
                  const oriMap    = new Map<string, Materia[]>();
                  for (const m of colMaterias) {
                    const k = getMateriaOrientacionKey(m);
                    if (k) {
                      if (!oriMap.has(k)) oriMap.set(k, []);
                      oriMap.get(k)!.push(m);
                    }
                  }
                  const oriGroups = Array.from(oriMap.entries());

                  return (
                    <div
                      key={colKey}
                      data-colkey={colKey}
                      className="flex flex-col kp-col"
                      style={{
                        borderTop: slotIdx > 0 ? `1px solid ${color}22` : undefined,
                        background: isDragOver ? `${color}18` : undefined,
                        boxShadow: isDragOver ? `inset 0 0 0 2.5px ${color}` : undefined,
                        transition: "background 0.15s, box-shadow 0.15s",
                      }}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(colKey); }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                      onDrop={() => handleDrop(colKey)}
                    >
                      {/* Sub-header */}
                      <div className="kp-col-header" style={{ padding: "8px 12px", borderBottom: `1px solid ${color}22`, background: `${color}0a` }}>
                        <div style={{ color: TEXT_DETAIL, fontSize: 12, fontWeight: "bold" }}>
                          {SLOT_LABEL[slot]}
                        </div>
                        <div style={{ color: TEXT_SEC, fontSize: 11, marginTop: 1 }}>
                          {colMaterias.length} materias
                          {cuatrAprobadas > 0 && ` · ${cuatrAprobadas} ✓`}
                          {cuatrCursadas  > 0 && ` · ${cuatrCursadas} →`}
                        </div>
                      </div>

                      {/* Cards: comunes primero, luego grupos por orientación */}
                      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        {comunes.map((m) => renderMateriaCard(m, colKey, color))}
                        {oriGroups.map(([ori, mats]) => (
                          <div
                            key={ori}
                            style={{
                              background: `${color}0a`, border: `1px solid ${color}33`,
                              borderRadius: 8, padding: 6,
                              marginTop: comunes.length > 0 ? 4 : 0,
                              display: "flex", flexDirection: "column", gap: 6,
                            }}
                          >
                            <div style={{
                              fontSize: 10, fontWeight: 700, color: TEXT_SEC,
                              textTransform: "uppercase", letterSpacing: "0.06em",
                              paddingBottom: 4, borderBottom: `1px solid ${color}22`,
                            }}>
                              {ori}
                            </div>
                            {mats.map((m) => renderMateriaCard(m, colKey, color))}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
