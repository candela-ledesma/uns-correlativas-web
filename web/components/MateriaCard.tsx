"use client";

import { HTMLAttributes, KeyboardEvent, MouseEvent, useState } from "react";
import { Materia } from "../app/types/plan";
import { EstadoMateria } from "../lib/evaluarCorrelativas";
import type { CorrelativaDetalle } from "@/lib/correlativasMateria";

// ── Design tokens ─────────────────────────────────────────────────────────────
const TEXT      = "#e2d9f3";
const TEXT_SEC  = "#a89bc9";
const TEXT_DET  = "#c3b8e0";

type CardTheme = { bg: string; borderLeft: string; border: string; opacity?: number };

function getCardTheme(
  estado: EstadoMateria,
  puedeCursar: boolean,
  bloqueada: boolean
): CardTheme {
  if (estado === "aprobada") return { bg: "rgba(144,190,109,0.13)", borderLeft: "4px solid #90be6d", border: "1px solid rgba(144,190,109,0.35)" };
  if (estado === "cursada")  return { bg: "rgba(76,201,240,0.10)",  borderLeft: "4px solid #4cc9f0", border: "1px solid rgba(76,201,240,0.35)"  };
  if (bloqueada)             return { bg: "rgba(255,255,255,0.03)", borderLeft: "4px solid rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.08)", opacity: 0.55 };
  if (puedeCursar)           return { bg: "rgba(249,199,79,0.10)",  borderLeft: "4px solid #f9c74f", border: "1px solid rgba(249,199,79,0.35)"  };
  return                            { bg: "rgba(255,255,255,0.05)", borderLeft: "4px solid rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.10)" };
}

type BadgeTheme = { bg: string; color: string; border: string };

function getBadgeTheme(estado: EstadoMateria, bloqueada: boolean, puedeCursar: boolean): BadgeTheme {
  if (estado === "aprobada") return { bg: "rgba(144,190,109,0.20)", color: "#90be6d", border: "1px solid rgba(144,190,109,0.40)" };
  if (estado === "cursada")  return { bg: "rgba(76,201,240,0.18)",  color: "#4cc9f0", border: "1px solid rgba(76,201,240,0.40)"  };
  if (bloqueada)             return { bg: "rgba(255,255,255,0.06)", color: TEXT_SEC,  border: "1px solid rgba(255,255,255,0.15)" };
  if (puedeCursar)           return { bg: "rgba(249,199,79,0.18)",  color: "#f9c74f", border: "1px solid rgba(249,199,79,0.40)"  };
  return                            { bg: "rgba(255,255,255,0.06)", color: TEXT_SEC,  border: "1px solid rgba(255,255,255,0.12)" };
}

function getEstadoLabel(estado: EstadoMateria, bloqueada: boolean): string {
  if (estado === "aprobada") return "Aprobada";
  if (estado === "cursada")  return "Cursada";
  if (bloqueada)             return "Bloqueada";
  return "Disponible";
}

function getNivelLabel(nivel: string | null) {
  if (!nivel)             return "Sin requisito";
  if (nivel === "aprobada") return "Aprobada";
  if (nivel === "cursada")  return "Cursada";
  return nivel;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Props = HTMLAttributes<HTMLDivElement> & {
  materia: Materia;
  estado: EstadoMateria;
  puedeCursar: boolean;
  puedeAprobar: boolean;
  puedeClickear: boolean;
  bloqueada: boolean;
  onToggle: () => void;
  onUndo?: () => void;
  undoTestId?: string;
  correlativas?: CorrelativaDetalle[];
  verCorrelativasTestId?: string;
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function MateriaCard({
  materia, estado, puedeCursar, puedeAprobar, puedeClickear, bloqueada,
  onToggle, onUndo, undoTestId, correlativas = [], verCorrelativasTestId, ...rest
}: Props) {
  const [mostrarCorrelativas, setMostrarCorrelativas] = useState(false);

  const canUndo          = estado !== "no_cursada" && Boolean(onUndo);
  const puedeInteractuar = puedeClickear || canUndo;
  const tieneCorrelativas = correlativas.length > 0;
  const estadoLabel      = getEstadoLabel(estado, bloqueada);

  const theme      = getCardTheme(estado, puedeCursar, bloqueada);
  const badgeTheme = getBadgeTheme(estado, bloqueada, puedeCursar);

  const cardStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 14,
    padding: 16,
    textAlign: "left",
    transition: "box-shadow 0.15s, transform 0.15s, opacity 0.15s",
    outline: "none",
    background: theme.bg,
    borderTop:    theme.border,
    borderRight:  theme.border,
    borderBottom: theme.border,
    borderLeft:   theme.borderLeft,
    opacity: theme.opacity,
    cursor: puedeInteractuar && puedeClickear ? "pointer" : puedeInteractuar ? "default" : "not-allowed",
  };

  const ariaLabel = `${materia.nombre}. Código ${materia.id}. Estado ${estadoLabel}. ${materia.horas ? `Carga horaria ${materia.horas} horas.` : ""}`;

  function handleCardClick() {
    if (!puedeClickear) return;
    onToggle();
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!puedeClickear) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onToggle();
  }

  function handleUndoClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onUndo?.();
  }

  function handleCorrelativasClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setMostrarCorrelativas((prev) => !prev);
  }

  const actionBtnStyle: React.CSSProperties = {
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: TEXT,
  };

  return (
    <div
      {...rest}
      role={puedeClickear ? "button" : undefined}
      tabIndex={puedeClickear ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      aria-label={ariaLabel}
      style={cardStyle}
      className="group focus:ring-4 focus:ring-[#9d4edd]/30"
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: TEXT, fontWeight: 700, fontSize: 15, lineHeight: 1.35, marginBottom: 6 }}>
            {materia.nombre}
          </div>
          <div style={{ color: TEXT_DET, fontSize: 13, display: "flex", flexWrap: "wrap", gap: 6 }}>
            <span>Código {materia.id}</span>
            {materia.horas && <span>• {materia.horas} hs</span>}
          </div>
        </div>

        <span
          aria-hidden="true"
          style={{ ...badgeTheme, display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", borderRadius: 99, padding: "4px 12px", fontSize: 11, fontWeight: 700 }}
        >
          {estadoLabel}
        </span>
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
        {tieneCorrelativas && (
          <button
            type="button"
            data-testid={verCorrelativasTestId}
            onClick={handleCorrelativasClick}
            style={actionBtnStyle}
          >
            {mostrarCorrelativas ? "Ocultar correlativas" : "Ver correlativas"}
          </button>
        )}

        {canUndo && (
          <button
            type="button"
            data-testid={undoTestId}
            onClick={handleUndoClick}
            style={actionBtnStyle}
            className="md:invisible md:pointer-events-none md:opacity-0 md:group-hover:visible md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:visible md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:focus-visible:visible md:focus-visible:pointer-events-auto md:focus-visible:opacity-100"
          >
            Deshacer
          </button>
        )}
      </div>

      {tieneCorrelativas && mostrarCorrelativas && (
        <div
          style={{ marginTop: 12, borderRadius: 10, padding: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ color: TEXT_SEC, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Correlativas
          </div>

          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {correlativas.map((correlativa) => (
              <li key={correlativa.id} style={{ borderRadius: 8, padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 13 }}>
                <div style={{ color: TEXT, fontWeight: 600, marginBottom: 4 }}>
                  {correlativa.nombre} ({correlativa.id})
                </div>
                <div style={{ color: TEXT_SEC, fontSize: 12 }}>
                  Para cursar: {getNivelLabel(correlativa.paraCursar)}
                  <span style={{ marginLeft: 6, borderRadius: 99, padding: "1px 8px", fontSize: 10, fontWeight: 700, background: correlativa.cumpleParaCursar ? "rgba(144,190,109,0.20)" : "rgba(231,111,81,0.20)", color: correlativa.cumpleParaCursar ? "#90be6d" : "#e76f51", border: `1px solid ${correlativa.cumpleParaCursar ? "rgba(144,190,109,0.35)" : "rgba(231,111,81,0.35)"}` }}>
                    {correlativa.cumpleParaCursar ? "Cumple" : "No cumple"}
                  </span>
                </div>
                <div style={{ color: TEXT_SEC, fontSize: 12 }}>
                  Para rendir: {getNivelLabel(correlativa.paraRendir)}
                  <span style={{ marginLeft: 6, borderRadius: 99, padding: "1px 8px", fontSize: 10, fontWeight: 700, background: correlativa.cumpleParaRendir ? "rgba(144,190,109,0.20)" : "rgba(231,111,81,0.20)", color: correlativa.cumpleParaRendir ? "#90be6d" : "#e76f51", border: `1px solid ${correlativa.cumpleParaRendir ? "rgba(144,190,109,0.35)" : "rgba(231,111,81,0.35)"}` }}>
                    {correlativa.cumpleParaRendir ? "Cumple" : "No cumple"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
