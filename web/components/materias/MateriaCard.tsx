"use client";

import { HTMLAttributes, KeyboardEvent, MouseEvent, useState } from "react";
import { Materia } from "@/app/types/plan";
import { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";
import type { CorrelativaDetalle } from "@/lib/plan/correlativasMateria";
import PanelRequisitoEspecial from "@/components/materias/PanelRequisitoEspecial";
import { TEXT, TEXT_SEC, TEXT_DET } from "@/lib/ui/tokens";
import {
  getCardTheme,
  getBadgeTheme,
  getEstadoLabel,
  getNivelLabel,
  correlativaBadgeStyle,
  CORRELATIVAS_PANEL,
  CORRELATIVAS_ITEM,
  CARD_ACTION_BTN,
} from "@/lib/ui/cardStyles";

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
  estados: Record<string, EstadoMateria>;
  verCorrelativasTestId?: string;
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function MateriaCard({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  materia, estado, puedeCursar, puedeAprobar, puedeClickear, bloqueada,
  onToggle, onUndo, undoTestId, correlativas = [], estados, verCorrelativasTestId, ...rest
}: Props) {
  const [mostrarCorrelativas, setMostrarCorrelativas] = useState(false);

  const canUndo           = estado !== "no_cursada" && Boolean(onUndo);
  const puedeInteractuar  = puedeClickear || canUndo;
  const tieneCorrelativas = correlativas.length > 0;
  const tieneRequisitoEspecial = Boolean(materia.requisito_especial);
  const mostrarPanelCorrelativas = tieneCorrelativas || tieneRequisitoEspecial;
  const estadoLabel       = getEstadoLabel(estado, bloqueada);

  const theme      = getCardTheme(estado, puedeCursar, bloqueada);
  const badgeTheme = getBadgeTheme(estado, bloqueada, puedeCursar);

  const cardStyle: React.CSSProperties = {
    width:        "100%",
    borderRadius: 14,
    padding:      16,
    textAlign:    "left",
    transition:   "box-shadow 0.15s, transform 0.15s, opacity 0.15s",
    outline:      "none",
    background:   theme.bg,
    borderTop:    theme.border,
    borderRight:  theme.border,
    borderBottom: theme.border,
    borderLeft:   theme.borderLeft,
    opacity:      theme.opacity,
    cursor:       puedeInteractuar && puedeClickear ? "pointer" : puedeInteractuar ? "default" : "not-allowed",
  };

  const ariaLabel = `${materia.nombre}. Código ${materia.id}. Estado ${estadoLabel}. ${materia.horas ? `Carga horaria ${materia.horas} horas.` : ""}`;

  function handleCardClick() { if (puedeClickear) onToggle(); }

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

  return (
    <div
      {...rest}
      role={puedeClickear ? "button" : undefined}
      tabIndex={puedeClickear ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      aria-label={ariaLabel}
      style={cardStyle}
      className="materia-card group focus:ring-4 focus:ring-[#9d4edd]/30"
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
          className="materia-card-badge"
          style={{ ...badgeTheme, display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", borderRadius: 99, padding: "4px 12px", fontSize: 11, fontWeight: 700 }}
        >
          {estadoLabel}
        </span>
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
        {mostrarPanelCorrelativas && (
          <button type="button" data-testid={verCorrelativasTestId} onClick={handleCorrelativasClick} style={CARD_ACTION_BTN}>
            {mostrarCorrelativas ? "Ocultar correlativas" : "Ver correlativas"}
          </button>
        )}
        {canUndo && (
          <button
            type="button"
            data-testid={undoTestId}
            onClick={handleUndoClick}
            style={CARD_ACTION_BTN}
            className="md:invisible md:pointer-events-none md:opacity-0 md:group-hover:visible md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:visible md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:focus-visible:visible md:focus-visible:pointer-events-auto md:focus-visible:opacity-100"
          >
            Deshacer
          </button>
        )}
      </div>

      {mostrarPanelCorrelativas && mostrarCorrelativas && (
        <div style={CORRELATIVAS_PANEL} onClick={(e) => e.stopPropagation()}>
          <div style={{ color: TEXT_SEC, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Correlativas
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {correlativas.map((correlativa) => (
              <li key={correlativa.id} style={CORRELATIVAS_ITEM}>
                <div style={{ color: TEXT, fontWeight: 600, marginBottom: 4 }}>
                  {correlativa.nombre} ({correlativa.id})
                </div>
                <div style={{ color: TEXT_SEC, fontSize: 12 }}>
                  Para cursar: {getNivelLabel(correlativa.paraCursar)}
                  <span style={correlativaBadgeStyle(correlativa.cumpleParaCursar)}>
                    {correlativa.cumpleParaCursar ? "Cumple" : "No cumple"}
                  </span>
                </div>
                <div style={{ color: TEXT_SEC, fontSize: 12 }}>
                  Para rendir: {getNivelLabel(correlativa.paraRendir)}
                  <span style={correlativaBadgeStyle(correlativa.cumpleParaRendir)}>
                    {correlativa.cumpleParaRendir ? "Cumple" : "No cumple"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {materia.requisito_especial && (
            <PanelRequisitoEspecial
              requisito={materia.requisito_especial}
              estados={estados}
            />
          )}
        </div>
      )}
    </div>
  );
}
