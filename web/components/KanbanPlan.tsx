"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Materia, Agrupador } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { estaHabilitadaParaCursar } from "@/lib/evaluarCorrelativas";
import { getEstadoKey } from "@/lib/estadoKey";

import { TEXT as TEXT_BASE, TEXT_SEC, TEXT_DET as TEXT_DETAIL, TITLE_SHADOW, BG_GRADIENT, HEADING_FONT as FONT } from "@/lib/tokens";

// ── Design tokens ─────────────────────────────────────────────────────────────
const PALETTE = [
  "#f9c74f", "#f4a261", "#90be6d", "#43aa8b",
  "#577590", "#9d4edd", "#e76f51", "#4cc9f0", "#f72585",
];

// ── Types ─────────────────────────────────────────────────────────────────────
type Props = {
  materias: Materia[];
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  estados: Record<string, EstadoMateria>;
};

type DragRef = { materiaId: string; fromCol: string };

/** Slot de cuatrimestre: 1° / 2° / Anual */
type CuatrSlot = "1" | "2" | "A";

const SLOT_LABEL: Record<CuatrSlot, string> = {
  "1": "1° Cuatrimestre",
  "2": "2° Cuatrimestre",
  "A": "Anual",
};

// ── Helpers de ordenamiento ───────────────────────────────────────────────────
const ANIO_ORDER = [
  "Primer Año", "Segundo Año", "Tercer Año",
  "Cuarto Año", "Quinto Año", "Sexto Año",
];

function anioSortKey(titulo: string): number {
  const idx = ANIO_ORDER.indexOf(titulo);
  return idx === -1 ? ANIO_ORDER.length : idx;
}

const SLOT_SORT: Record<CuatrSlot, number> = { "1": 0, "2": 1, "A": 2 };

function normalizeCuatrimestre(c: string | null | undefined): CuatrSlot {
  if (!c) return "1";
  const lower = c.toLowerCase();
  if (lower.includes("anual")) return "A";
  if (lower.includes("2") || lower.includes("segundo")) return "2";
  return "1";
}

function buildInitialOrder(
  materias: Materia[],
  idsAgrupadores: Set<string>
): Record<string, string[]> {
  const porCol = new Map<string, string[]>();

  for (const m of materias) {
    if (m.categoria === "optativa" && !idsAgrupadores.has(String(m.id))) continue;
    const anio = m.año ?? "Sin año";
    const slot = normalizeCuatrimestre(m.cuatrimestre);
    const key = `${anio}|${slot}`;
    if (!porCol.has(key)) porCol.set(key, []);
    porCol.get(key)!.push(String(m.id));
  }

  // Garantizar que siempre existan slots 1 y 2 para cada año.
  // El slot A se crea solo si hay materias anuales (ya se añadió arriba).
  const years = new Set(Array.from(porCol.keys()).map((k) => k.split("|")[0]));
  for (const y of years) {
    if (!porCol.has(`${y}|1`)) porCol.set(`${y}|1`, []);
    if (!porCol.has(`${y}|2`)) porCol.set(`${y}|2`, []);
  }

  return Object.fromEntries(
    Array.from(porCol.entries()).sort(([a], [b]) => {
      const [ay, ac] = a.split("|");
      const [by, bc] = b.split("|");
      const yearDiff = anioSortKey(ay) - anioSortKey(by);
      if (yearDiff !== 0) return yearDiff;
      return (SLOT_SORT[ac as CuatrSlot] ?? 0) - (SLOT_SORT[bc as CuatrSlot] ?? 0);
    })
  );
}

function getYearsFromOrder(order: Record<string, string[]>): string[] {
  const years = new Set<string>();
  for (const key of Object.keys(order)) years.add(key.split("|")[0]);
  return Array.from(years).sort((a, b) => {
    const diff = anioSortKey(a) - anioSortKey(b);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
}

function getNextYearName(existingYears: string[]): string {
  for (const name of ANIO_ORDER) {
    if (!existingYears.includes(name)) return name;
  }
  let n = 7;
  while (existingYears.includes(`Año ${n}`)) n++;
  return `Año ${n}`;
}

function getMateriaEstado(
  materia: Materia,
  estados: Record<string, EstadoMateria>
): EstadoMateria {
  const grupoId = materia.grupo_opcion ?? undefined;
  return estados[getEstadoKey(materia, grupoId)] ?? "no_cursada";
}

function getMateriaOrientacionKey(m: Materia): string | null {
  if (m.orientacion) return m.orientacion;
  if (m.orientaciones?.length === 1) return m.orientaciones[0];
  return null;
}

// ── Helpers de orientación ────────────────────────────────────────────────────
/** Extrae la lista ordenada de orientaciones disponibles en el plan. */
function extractOrientaciones(materias: Materia[], agrupadores: Agrupador[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const m of materias) {
    const key = getMateriaOrientacionKey(m);
    if (key && !seen.has(key)) { seen.add(key); result.push(key); }
    // Materias compartidas con orientaciones[] también contribuyen
    if (m.orientaciones) {
      for (const ori of m.orientaciones) {
        if (!seen.has(ori)) { seen.add(ori); result.push(ori); }
      }
    }
  }
  for (const a of agrupadores) {
    if (a.orientacion && !seen.has(a.orientacion)) {
      seen.add(a.orientacion); result.push(a.orientacion);
    }
  }

  return result.sort();
}

/**
 * Decide si una materia debe mostrarse dado el filtro de orientación.
 * - "todas" → siempre visible
 * - Materia sin orientación específica (común) → visible para cualquier orientación
 * - Materia con orientación → visible solo si coincide
 * - Agrupador con orientación → idem
 */
function passesOrientationFilter(
  m: Materia,
  selected: string,
  idsAgrupadores: Set<string>,
  agrupadores: Agrupador[],
): boolean {
  if (selected === "todas") return true;
  if (idsAgrupadores.has(String(m.id))) {
    const ag = agrupadores.find((a) => String(a.id) === String(m.id));
    if (ag?.orientacion) return ag.orientacion === selected;
    return true; // agrupador sin orientación → común a todas
  }
  // Materia compartida explícitamente entre varias orientaciones (orientaciones[])
  if (m.orientaciones && m.orientaciones.length > 1) {
    return m.orientaciones.includes(selected);
  }
  const key = getMateriaOrientacionKey(m);
  return key === null || key === selected;
}

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
  const materiaById = useMemo(
    () => new Map(materias.map((m) => [String(m.id), m])),
    [materias]
  );

  const [localOrder, setLocalOrder] = useState<Record<string, string[]>>(() =>
    buildInitialOrder(materias, idsAgrupadores)
  );
  const [dragOver,          setDragOver]          = useState<string | null>(null);
  const [showMateriaStatus, setShowMateriaStatus]  = useState(true);
  const [selectedOrientacion, setSelectedOrientacion] = useState("todas");

  const dragRef            = useRef<DragRef | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const yearRefs           = useRef<Record<string, HTMLDivElement | null>>({});
  const [newlyAddedYear,   setNewlyAddedYear]      = useState<string | null>(null);

  const years = getYearsFromOrder(localOrder);

  const isModified =
    JSON.stringify(localOrder) !== JSON.stringify(buildInitialOrder(materias, idsAgrupadores));

  // Orientaciones disponibles en el plan (vacío = sin orientaciones)
  const orientaciones = useMemo(
    () => extractOrientaciones(materias, agrupadores),
    [materias, agrupadores]
  );
  const hasOrientaciones = orientaciones.length > 0;

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

  function handleReset()    { setLocalOrder(buildInitialOrder(materias, idsAgrupadores)); }
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
    const estado      = getMateriaEstado(materia, estados);
    const puedeCursar = estaHabilitadaParaCursar(materia, estados, agrupadores);
    return (
      <div
        key={String(materia.id)}
        draggable
        onDragStart={() => handleDragStart(String(materia.id), colKey)}
        onDragEnd={() => setDragOver(null)}
        style={{
          background:   `linear-gradient(135deg, ${color}22, transparent)`,
          borderTop:    `1px solid ${color}33`,
          borderRight:  `1px solid ${color}33`,
          borderBottom: `1px solid ${color}33`,
          borderLeft:   `4px solid ${color}`,
          borderRadius: 10, padding: "9px 10px",
          cursor: "grab", userSelect: "none", transition: "opacity 0.15s",
          opacity: !puedeCursar && estado === "no_cursada" ? 0.55 : 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: TEXT_BASE, fontWeight: "bold", fontSize: 12, lineHeight: 1.4 }}>
              {materia.nombre}
            </div>
            <div style={{ color: TEXT_DETAIL, fontSize: 11, marginTop: 2 }}>
              {materia.id}{materia.horas && ` · ${materia.horas} hs`}
            </div>
          </div>
          {showMateriaStatus && (
            <span style={getBadgeStyle(estado, puedeCursar)}>
              {getBadgeLabel(estado, puedeCursar)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0" style={{ background: BG_GRADIENT, fontFamily: FONT, borderRadius: 20, padding: 20 }}>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          [data-no-print] { display: none !important; }
          body, html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .kanban-years-container { flex-wrap: wrap !important; overflow: visible !important; overflow-x: visible !important; }
          .kanban-year-card { break-inside: avoid; page-break-inside: avoid; }
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
          <button type="button" onClick={() => window.print()}
            style={{ ...btnBase, background: "rgba(249,199,79,0.10)", border: "1px solid rgba(249,199,79,0.35)", color: "#f9c74f" }}>
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Year groups */}
      <div
        ref={scrollContainerRef}
        className="kanban-years-container flex flex-col sm:flex-row sm:overflow-x-auto gap-4 sm:gap-5 pb-4 items-start"
      >
        {years.map((anio, yearIdx) => {
          const color    = PALETTE[yearIdx % PALETTE.length];
          const hasAnual = `${anio}|A` in localOrder;

          // Columnas del año: siempre 1° y 2°, más "Anual" si existen materias anuales
          const slots: CuatrSlot[] = hasAnual ? ["1", "2", "A"] : ["1", "2"];
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
              className="kanban-year-card w-full sm:w-auto sm:flex-shrink-0"
              style={{
                background: "rgba(255,255,255,0.03)", border: `1px solid ${color}44`,
                borderRadius: 20, overflow: "hidden",
              }}
            >
              {/* Year header */}
              <div style={{ background: `${color}18`, borderBottom: `1px solid ${color}44`, padding: "10px 16px" }}>
                <div style={{ color, fontWeight: "bold", fontSize: 15, textShadow: TITLE_SHADOW }}>
                  {anio}
                </div>
                <div style={{ color: TEXT_SEC, fontSize: 11, marginTop: 6 }}>
                  {totalMaterias} materias{aprobadas > 0 && ` · ${aprobadas} aprobadas`}
                </div>
              </div>

              {/* Cuatrimestre sub-columns */}
              <div className="flex flex-col sm:flex-row">
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
                      className="flex flex-col sm:w-[220px]"
                      style={{
                        borderLeft: slotIdx > 0 ? `1px solid ${color}22` : undefined,
                        background: isDragOver ? `${color}08` : undefined,
                        boxShadow: isDragOver ? `inset 0 0 0 2px ${color}44` : undefined,
                        transition: "background 0.15s, box-shadow 0.15s",
                      }}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(colKey); }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                      onDrop={() => handleDrop(colKey)}
                    >
                      {/* Sub-header */}
                      <div style={{ padding: "8px 12px", borderBottom: `1px solid ${color}22`, background: `${color}0a` }}>
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
