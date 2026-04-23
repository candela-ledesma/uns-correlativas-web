/**
 * Lógica visual de MateriaCard — separada del componente para mantenerlo limpio.
 * Todo lo que depende de EstadoMateria y produce CSSProperties vive acá.
 */
import type { CSSProperties } from "react";
import type { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { TEXT, TEXT_SEC, GLASS, STATUS_COLORS } from "@/lib/tokens";

// ── Types ──────────────────────────────────────────────────────────────────
export type CardTheme  = { bg: string; borderLeft: string; border: string; opacity?: number };
export type BadgeTheme = { bg: string; color: string; border: string };

// ── Card themes ───────────────────────────────────────────────────────────
export function getCardTheme(
  estado: EstadoMateria,
  puedeCursar: boolean,
  bloqueada: boolean,
): CardTheme {
  if (estado === "aprobada") {
    const s = STATUS_COLORS.aprobada;
    return { bg: s.cardBg, borderLeft: `4px solid ${s.accent}`, border: `1px solid ${s.cardBorder}` };
  }
  if (estado === "cursada") {
    const s = STATUS_COLORS.cursada;
    return { bg: s.cardBg, borderLeft: `4px solid ${s.accent}`, border: `1px solid ${s.cardBorder}` };
  }
  if (bloqueada) {
    return {
      bg:         GLASS.faint,
      borderLeft: `4px solid ${GLASS.raised}`,
      border:     `1px solid ${GLASS.medium}`,
      opacity:    0.55,
    };
  }
  if (puedeCursar) {
    const s = STATUS_COLORS.disponible;
    return { bg: s.cardBg, borderLeft: `4px solid ${s.accent}`, border: `1px solid ${s.cardBorder}` };
  }
  return {
    bg:         GLASS.soft,
    borderLeft: `4px solid ${GLASS.strong}`,
    border:     `1px solid ${GLASS.border}`,
  };
}

// ── Badge themes ──────────────────────────────────────────────────────────
export function getBadgeTheme(
  estado: EstadoMateria,
  bloqueada: boolean,
  puedeCursar: boolean,
): BadgeTheme {
  if (estado === "aprobada") {
    const s = STATUS_COLORS.aprobada;
    return { bg: s.badgeBg, color: s.accent, border: `1px solid ${s.badgeBorder}` };
  }
  if (estado === "cursada") {
    const s = STATUS_COLORS.cursada;
    return { bg: s.badgeBg, color: s.accent, border: `1px solid ${s.badgeBorder}` };
  }
  if (bloqueada) {
    return { bg: GLASS.base, color: TEXT_SEC, border: `1px solid ${GLASS.strong}` };
  }
  if (puedeCursar) {
    const s = STATUS_COLORS.disponible;
    return { bg: s.badgeBg, color: s.accent, border: `1px solid ${s.badgeBorder}` };
  }
  return { bg: GLASS.base, color: TEXT_SEC, border: `1px solid ${GLASS.raised}` };
}

// ── Labels ────────────────────────────────────────────────────────────────
export function getEstadoLabel(estado: EstadoMateria, bloqueada: boolean): string {
  if (estado === "aprobada") return "Aprobada";
  if (estado === "cursada")  return "Cursada";
  if (bloqueada)             return "Bloqueada";
  return "Disponible";
}

export function getNivelLabel(nivel: string | null | undefined): string {
  if (!nivel)               return "Sin requisito";
  if (nivel === "aprobada") return "Aprobada";
  if (nivel === "cursada")  return "Cursada";
  return nivel;
}

// ── Correlativa badge ─────────────────────────────────────────────────────
/** Badge inline "Cumple / No cumple" para cada requisito de una correlativa. */
export function correlativaBadgeStyle(cumple: boolean): CSSProperties {
  const s = cumple ? STATUS_COLORS.aprobada : STATUS_COLORS.danger;
  return {
    marginLeft:   6,
    borderRadius: 99,
    padding:      "1px 8px",
    fontSize:     10,
    fontWeight:   700,
    background:   s.badgeBg,
    color:        s.accent,
    border:       `1px solid ${s.badgeBorder}`,
  };
}

// ── Shared sub-panel styles ────────────────────────────────────────────────
/** Panel de la lista de correlativas dentro de una card. */
export const CORRELATIVAS_PANEL: CSSProperties = {
  marginTop:    12,
  borderRadius: 10,
  padding:      12,
  background:   GLASS.soft,
  border:       `1px solid ${GLASS.border}`,
};

/** Ítem individual dentro del panel de correlativas. */
export const CORRELATIVAS_ITEM: CSSProperties = {
  borderRadius: 8,
  padding:      "8px 12px",
  background:   GLASS.dim,
  border:       `1px solid ${GLASS.medium}`,
  fontSize:     13,
};

/** Botón de acción secundaria dentro de una card (ver correlativas, deshacer). */
export const CARD_ACTION_BTN: CSSProperties = {
  borderRadius: 8,
  padding:      "6px 12px",
  fontSize:     13,
  fontWeight:   600,
  cursor:       "pointer",
  background:   GLASS.elevated,
  border:       `1px solid ${GLASS.strong}`,
  color:        TEXT,
};
