"use client";

import { useMemo, useRef, useState } from "react";
import type { Materia, Agrupador } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { estaHabilitadaParaCursar } from "@/lib/evaluarCorrelativas";
import { getEstadoKey } from "@/lib/estadoKey";

// ── Design tokens ─────────────────────────────────────────────────────────────
const PALETTE = [
  "#f9c74f", "#f4a261", "#90be6d", "#43aa8b",
  "#577590", "#9d4edd", "#e76f51", "#4cc9f0", "#f72585",
];
const BG_GRADIENT  = "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)";
const FONT         = "Georgia, serif";
const TEXT_BASE    = "#e2d9f3";
const TEXT_SEC     = "#a89bc9";
const TEXT_DETAIL  = "#c3b8e0";
const TITLE_SHADOW = "0 2px 16px #9d4edd88";

// ── Types ─────────────────────────────────────────────────────────────────────
type Props = {
  materias: Materia[];
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  estados: Record<string, EstadoMateria>;
};

type DragRef = {
  materiaId: string;
  fromCol: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const ANIO_ORDER = [
  "Primer Año", "Segundo Año", "Tercer Año",
  "Cuarto Año", "Quinto Año", "Sexto Año",
];

function anioSortKey(titulo: string): number {
  const idx = ANIO_ORDER.indexOf(titulo);
  return idx === -1 ? ANIO_ORDER.length : idx;
}

function normalizeCuatrimestre(c: string | null | undefined): "1" | "2" {
  if (!c) return "1";
  const lower = c.toLowerCase();
  if (lower.includes("2") || lower.includes("segundo")) return "2";
  return "1";
}

function buildInitialOrder(
  materias: Materia[],
  idsAgrupadores: Set<string>
): Record<string, string[]> {
  const porCol = new Map<string, string[]>();

  for (const m of materias) {
    if (idsAgrupadores.has(String(m.id))) continue;
    const anio = m.año ?? "Sin año";
    const c = normalizeCuatrimestre(m.cuatrimestre);
    const key = `${anio}|${c}`;
    if (!porCol.has(key)) porCol.set(key, []);
    porCol.get(key)!.push(String(m.id));
  }

  // Ensure both cuatrimestres exist for every year
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
      return yearDiff !== 0 ? yearDiff : (ac ?? "1").localeCompare(bc ?? "1");
    })
  );
}

function getYearsFromOrder(order: Record<string, string[]>): string[] {
  const years = new Set<string>();
  for (const key of Object.keys(order)) {
    years.add(key.split("|")[0]);
  }
  return Array.from(years).sort((a, b) => {
    const diff = anioSortKey(a) - anioSortKey(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
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

function getBadgeStyle(estado: EstadoMateria, puedeCursar: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    borderRadius: 99,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid",
  };
  if (estado === "aprobada")  return { ...base, background: "#90be6d22", color: "#90be6d", borderColor: "#90be6d66" };
  if (estado === "cursada")   return { ...base, background: "#4cc9f022", color: "#4cc9f0", borderColor: "#4cc9f066" };
  if (puedeCursar)            return { ...base, background: "#f9c74f22", color: "#f9c74f", borderColor: "#f9c74f66" };
  return { ...base, background: "rgba(255,255,255,0.06)", color: TEXT_SEC, borderColor: "rgba(255,255,255,0.15)" };
}

function getBadgeLabel(estado: EstadoMateria, puedeCursar: boolean): string {
  if (estado === "aprobada") return "Aprobada";
  if (estado === "cursada")  return "Cursada";
  if (puedeCursar)           return "Disponible";
  return "Bloqueada";
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function KanbanPlan({
  materias,
  agrupadores,
  idsAgrupadores,
  estados,
}: Props) {
  const materiaById = useMemo(
    () => new Map(materias.map((m) => [String(m.id), m])),
    [materias]
  );

  const [localOrder, setLocalOrder] = useState<Record<string, string[]>>(() =>
    buildInitialOrder(materias, idsAgrupadores)
  );
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragRef = useRef<DragRef | null>(null);

  const years = getYearsFromOrder(localOrder);

  const isModified =
    JSON.stringify(localOrder) !==
    JSON.stringify(buildInitialOrder(materias, idsAgrupadores));

  function handleReset() {
    setLocalOrder(buildInitialOrder(materias, idsAgrupadores));
  }

  function handleAddYear() {
    const newYear = getNextYearName(years);
    setLocalOrder((prev) => ({
      ...prev,
      [`${newYear}|1`]: [],
      [`${newYear}|2`]: [],
    }));
  }

  function handleDragStart(materiaId: string, fromCol: string) {
    dragRef.current = { materiaId, fromCol };
  }

  function handleDrop(toCol: string) {
    const drag = dragRef.current;
    if (!drag || drag.fromCol === toCol) {
      setDragOver(null);
      dragRef.current = null;
      return;
    }
    setLocalOrder((prev) => ({
      ...prev,
      [drag.fromCol]: (prev[drag.fromCol] ?? []).filter((id) => id !== drag.materiaId),
      [toCol]: [...(prev[toCol] ?? []), drag.materiaId],
    }));
    setDragOver(null);
    dragRef.current = null;
  }

  const btnBase: React.CSSProperties = {
    borderRadius: 10,
    padding: "6px 14px",
    fontSize: 12,
    fontFamily: FONT,
    cursor: "pointer",
  };

  return (
    <div style={{ background: BG_GRADIENT, fontFamily: FONT, borderRadius: 20, padding: 20 }}>
      {/* Header controls */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        {isModified && (
          <button
            type="button"
            onClick={handleReset}
            style={{
              ...btnBase,
              background: "rgba(157,78,221,0.10)",
              border: "1px dashed rgba(157,78,221,0.35)",
              color: "#9d4edd",
            }}
          >
            Restablecer orden original
          </button>
        )}
        <button
          type="button"
          onClick={handleAddYear}
          style={{
            ...btnBase,
            background: "rgba(76,201,240,0.10)",
            border: "1px solid rgba(76,201,240,0.35)",
            color: "#4cc9f0",
          }}
        >
          + Agregar año
        </button>
      </div>

      {/* Year groups */}
      <div style={{ display: "flex", gap: 20, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>
        {years.map((anio, yearIdx) => {
          const color = PALETTE[yearIdx % PALETTE.length];
          const c1Key = `${anio}|1`;
          const c2Key = `${anio}|2`;

          const cuatrimestres = [
            { key: c1Key, label: "1° Cuatrimestre" },
            { key: c2Key, label: "2° Cuatrimestre" },
          ];

          const totalMaterias = (localOrder[c1Key]?.length ?? 0) + (localOrder[c2Key]?.length ?? 0);
          const aprobadas = [c1Key, c2Key].flatMap((k) =>
            (localOrder[k] ?? [])
              .map((id) => materiaById.get(id))
              .filter((m): m is Materia => Boolean(m))
              .filter((m) => getMateriaEstado(m, estados) === "aprobada")
          ).length;

          return (
            <div
              key={anio}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${color}44`,
                borderRadius: 20,
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {/* Year header */}
              <div
                style={{
                  background: `${color}18`,
                  borderBottom: `1px solid ${color}44`,
                  padding: "10px 16px",
                }}
              >
                <div style={{ color, fontWeight: "bold", fontSize: 15, textShadow: TITLE_SHADOW }}>
                  {anio}
                </div>
                <div style={{ color: TEXT_SEC, fontSize: 11, marginTop: 2 }}>
                  {totalMaterias} materias
                  {aprobadas > 0 && ` · ${aprobadas} aprobadas`}
                </div>
              </div>

              {/* Two cuatrimestre sub-columns */}
              <div style={{ display: "flex", gap: 0 }}>
                {cuatrimestres.map(({ key: colKey, label }, cIdx) => {
                  const ids = localOrder[colKey] ?? [];
                  const colMaterias = ids
                    .map((id) => materiaById.get(id))
                    .filter((m): m is Materia => Boolean(m));
                  const isDragOver = dragOver === colKey;

                  const cuatrAprobadas = colMaterias.filter((m) => getMateriaEstado(m, estados) === "aprobada").length;
                  const cuatrCursadas  = colMaterias.filter((m) => getMateriaEstado(m, estados) === "cursada").length;

                  return (
                    <div
                      key={colKey}
                      style={{
                        width: 220,
                        display: "flex",
                        flexDirection: "column",
                        borderLeft: cIdx === 1 ? `1px solid ${color}22` : undefined,
                        background: isDragOver ? `${color}08` : undefined,
                        boxShadow: isDragOver ? `inset 0 0 0 2px ${color}44` : undefined,
                        transition: "background 0.15s, box-shadow 0.15s",
                      }}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(colKey); }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                      }}
                      onDrop={() => handleDrop(colKey)}
                    >
                      {/* Cuatrimestre sub-header */}
                      <div
                        style={{
                          padding: "8px 12px",
                          borderBottom: `1px solid ${color}22`,
                          background: `${color}0a`,
                        }}
                      >
                        <div style={{ color: TEXT_DETAIL, fontSize: 12, fontWeight: "bold" }}>
                          {label}
                        </div>
                        <div style={{ color: TEXT_SEC, fontSize: 11, marginTop: 1 }}>
                          {colMaterias.length} materias
                          {cuatrAprobadas > 0 && ` · ${cuatrAprobadas} ✓`}
                          {cuatrCursadas  > 0 && ` · ${cuatrCursadas} →`}
                        </div>
                      </div>

                      {/* Cards */}
                      <div
                        style={{
                          padding: 8,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          flex: 1,
                          minHeight: 60,
                        }}
                      >
                        {colMaterias.map((materia) => {
                          const estado      = getMateriaEstado(materia, estados);
                          const puedeCursar = estaHabilitadaParaCursar(materia, estados, agrupadores);

                          return (
                            <div
                              key={String(materia.id)}
                              draggable
                              onDragStart={() => handleDragStart(String(materia.id), colKey)}
                              onDragEnd={() => setDragOver(null)}
                              style={{
                                background: `linear-gradient(135deg, ${color}22, transparent)`,
                                borderTop:    `1px solid ${color}33`,
                                borderRight:  `1px solid ${color}33`,
                                borderBottom: `1px solid ${color}33`,
                                borderLeft:   `4px solid ${color}`,
                                borderRadius: 10,
                                padding: "9px 10px",
                                cursor: "grab",
                                userSelect: "none",
                                transition: "opacity 0.15s",
                                opacity: !puedeCursar && estado === "no_cursada" ? 0.55 : 1,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ color: TEXT_BASE, fontWeight: "bold", fontSize: 12, lineHeight: 1.4 }}>
                                    {materia.nombre}
                                  </div>
                                  <div style={{ color: TEXT_DETAIL, fontSize: 11, marginTop: 2 }}>
                                    {materia.id}
                                    {materia.horas && ` · ${materia.horas} hs`}
                                  </div>
                                </div>
                                <span style={getBadgeStyle(estado, puedeCursar)}>
                                  {getBadgeLabel(estado, puedeCursar)}
                                </span>
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
        })}
      </div>
    </div>
  );
}
