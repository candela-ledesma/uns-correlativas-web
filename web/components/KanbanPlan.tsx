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

function buildInitialOrder(
  materias: Materia[],
  idsAgrupadores: Set<string>
): Record<string, string[]> {
  const porAnio = new Map<string, string[]>();
  for (const m of materias) {
    if (idsAgrupadores.has(String(m.id))) continue;
    const anio = m.año ?? "Sin año";
    if (!porAnio.has(anio)) porAnio.set(anio, []);
    porAnio.get(anio)!.push(String(m.id));
  }
  return Object.fromEntries(
    Array.from(porAnio.entries()).sort(([a], [b]) => anioSortKey(a) - anioSortKey(b))
  );
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

  const colTitulos = Object.keys(localOrder);

  const isModified =
    JSON.stringify(localOrder) !==
    JSON.stringify(buildInitialOrder(materias, idsAgrupadores));

  function handleReset() {
    setLocalOrder(buildInitialOrder(materias, idsAgrupadores));
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

  return (
    <div style={{ background: BG_GRADIENT, fontFamily: FONT, borderRadius: 20, padding: 20 }}>
      {/* Reset button */}
      {isModified && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            type="button"
            onClick={handleReset}
            style={{
              background: "rgba(157,78,221,0.10)",
              border: "1px dashed rgba(157,78,221,0.35)",
              color: "#9d4edd",
              borderRadius: 10,
              padding: "6px 14px",
              fontSize: 12,
              fontFamily: FONT,
              cursor: "pointer",
            }}
          >
            Restablecer orden original
          </button>
        </div>
      )}

      {/* Columns */}
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16 }}>
        {colTitulos.map((titulo, colIdx) => {
          const color = PALETTE[colIdx % PALETTE.length];
          const ids = localOrder[titulo] ?? [];
          const colMaterias = ids
            .map((id) => materiaById.get(id))
            .filter((m): m is Materia => Boolean(m));

          const aprobadas = colMaterias.filter((m) => getMateriaEstado(m, estados) === "aprobada").length;
          const cursadas  = colMaterias.filter((m) => getMateriaEstado(m, estados) === "cursada").length;
          const isDragOver = dragOver === titulo;

          return (
            <div
              key={titulo}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${isDragOver ? color : "rgba(255,255,255,0.10)"}`,
                borderRadius: 18,
                backdropFilter: "blur(8px)",
                width: 280,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                boxShadow: isDragOver ? `0 0 0 2px ${color}44` : undefined,
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(titulo); }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
              }}
              onDrop={() => handleDrop(titulo)}
            >
              {/* Column header */}
              <div
                style={{
                  background: color + "22",
                  borderBottom: `1px solid ${color}55`,
                  borderRadius: "17px 17px 0 0",
                  padding: "12px 16px",
                }}
              >
                <div style={{ color: TEXT_BASE, fontWeight: "bold", fontSize: 15, textShadow: TITLE_SHADOW }}>
                  {titulo}
                </div>
                <div style={{ color: TEXT_SEC, fontSize: 12, marginTop: 3 }}>
                  {colMaterias.length} materias
                  {aprobadas > 0 && ` · ${aprobadas} aprobadas`}
                  {cursadas  > 0 && ` · ${cursadas} cursadas`}
                </div>
              </div>

              {/* Cards */}
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {colMaterias.map((materia) => {
                  const estado     = getMateriaEstado(materia, estados);
                  const puedeCursar = estaHabilitadaParaCursar(materia, estados, agrupadores);

                  return (
                    <div
                      key={String(materia.id)}
                      draggable
                      onDragStart={() => handleDragStart(String(materia.id), titulo)}
                      onDragEnd={() => setDragOver(null)}
                      style={{
                        background: `linear-gradient(135deg, ${color}22, transparent)`,
                        borderTop:    `1px solid ${color}33`,
                        borderRight:  `1px solid ${color}33`,
                        borderBottom: `1px solid ${color}33`,
                        borderLeft:   `4px solid ${color}`,
                        borderRadius: 10,
                        padding: "10px 12px",
                        cursor: "grab",
                        userSelect: "none",
                        transition: "opacity 0.15s",
                        opacity: !puedeCursar && estado === "no_cursada" ? 0.55 : 1,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: TEXT_BASE, fontWeight: "bold", fontSize: 13, lineHeight: 1.4 }}>
                            {materia.nombre}
                          </div>
                          <div style={{ color: TEXT_DETAIL, fontSize: 11, marginTop: 3 }}>
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
}
