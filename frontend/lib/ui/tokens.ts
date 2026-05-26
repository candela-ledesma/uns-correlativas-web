import type { CSSProperties } from "react";

// ── 1. Primitivos de color ─────────────────────────────────────────────────
export const TEXT         = "#e2d9f3";
export const TEXT_SEC     = "#a89bc9";
export const TEXT_DET     = "#c3b8e0";
export const ACCENT       = "#9d4edd";
export const TITLE_SHADOW = "0 2px 16px #9d4edd88";
export const BG_GRADIENT  = "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)";
export const HEADING_FONT = "Georgia, serif";

// ── 2. Escala de glass (rgba blanco con diferentes opacidades) ─────────────
// Usá estos valores en vez de strings rgba() literales dispersos en el código.
export const GLASS = {
  faint:    "rgba(255,255,255,0.03)", // fondos deshabilitados / bloqueados
  dim:      "rgba(255,255,255,0.04)", // superficie estándar
  soft:     "rgba(255,255,255,0.05)", // superficie elevada dentro de un panel
  base:     "rgba(255,255,255,0.06)", // botones, pill activos
  elevated: "rgba(255,255,255,0.07)", // inputs
  medium:   "rgba(255,255,255,0.08)", // separadores, bordes suaves
  border:   "rgba(255,255,255,0.10)", // borde de contenedor estándar
  raised:   "rgba(255,255,255,0.12)", // borde de elemento elevado
  strong:   "rgba(255,255,255,0.15)", // borde prominente, borde de input
} as const;

// ── 3. Colores de estado de materia ───────────────────────────────────────
// Semánticos: mapean significado de negocio → valores visuales.
// Usados en MateriaCard (cards, badges) y correlativas (cumple/no cumple).
export const STATUS_COLORS = {
  aprobada: {
    accent:       "#90be6d",
    cardBg:       "rgba(144,190,109,0.13)",
    cardBorder:   "rgba(144,190,109,0.35)",
    badgeBg:      "rgba(144,190,109,0.20)",
    badgeBorder:  "rgba(144,190,109,0.40)",
  },
  cursada: {
    accent:       "#4cc9f0",
    cardBg:       "rgba(76,201,240,0.10)",
    cardBorder:   "rgba(76,201,240,0.35)",
    badgeBg:      "rgba(76,201,240,0.18)",
    badgeBorder:  "rgba(76,201,240,0.40)",
  },
  disponible: {
    accent:       "#f9c74f",
    cardBg:       "rgba(249,199,79,0.10)",
    cardBorder:   "rgba(249,199,79,0.35)",
    badgeBg:      "rgba(249,199,79,0.18)",
    badgeBorder:  "rgba(249,199,79,0.40)",
  },
  /** Color de "fallo" / "no cumple" — distinto del card bloqueado (que es glass neutro). */
  danger: {
    accent:       "#e76f51",
    cardBg:       "rgba(231,111,81,0.20)",
    cardBorder:   "rgba(231,111,81,0.35)",
    badgeBg:      "rgba(231,111,81,0.20)",
    badgeBorder:  "rgba(231,111,81,0.35)",
  },
} as const;

// ── 4. Objetos de estilo base ─────────────────────────────────────────────
// Spread estos y agregá borderRadius / padding / fontSize en el call site.

/** Panel / contenedor glassmorphism estándar. */
export const SURFACE: CSSProperties = {
  background:     GLASS.dim,
  border:         `1px solid ${GLASS.border}`,
  backdropFilter: "blur(8px)",
};

/** Botón secundario / neutral. */
export const BTN: CSSProperties = {
  background: GLASS.base,
  border:     `1px solid ${GLASS.strong}`,
  color:      TEXT,
  cursor:     "pointer",
};

/** Botón primario violeta. */
export const BTN_VIOLET: CSSProperties = {
  background: "rgba(157,78,221,0.85)",
  border:     `1px solid ${ACCENT}`,
  color:      "#fff",
  cursor:     "pointer",
};

/** Botón de peligro / acción destructiva. */
export const BTN_RED: CSSProperties = {
  background: "rgba(220,38,38,0.80)",
  border:     "1px solid #ef4444",
  color:      "#fff",
  cursor:     "pointer",
};

/** Input / select oscuro. */
export const INPUT: CSSProperties = {
  background:  GLASS.elevated,
  border:      `1px solid ${GLASS.strong}`,
  color:       TEXT,
  outline:     "none",
  width:       "100%",
  boxSizing:   "border-box",
};

/** Alerta de error inline. */
export const ERROR_PANEL: CSSProperties = {
  background: "rgba(220,38,38,0.12)",
  border:     "1px solid rgba(239,68,68,0.35)",
  color:      "#fca5a5",
};
