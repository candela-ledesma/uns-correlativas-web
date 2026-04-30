"use client";

import { TEXT, TEXT_DET, STATUS_COLORS, GLASS } from "@/lib/ui/tokens";
import { CARD_ACTION_BTN } from "@/lib/ui/cardStyles";
import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";

type Props = {
  grupoId: string;
  nombre: string;
  tipo: string;
  estado: EstadoMateria;
};

const BASURA_NOMBRE = /\s+(Optativa|Idioma|Seminario)\s+Correlativas\s+Para cursar\s+Para rendir\s*$/i;

function limpiarNombre(nombre: string): string {
  return nombre.replace(BASURA_NOMBRE, "").trim();
}

function labelTipo(tipo: string): string {
  if (tipo === "idioma_grupo") return "Idioma";
  if (tipo === "seminario_grupo") return "Seminario";
  return "Optativa";
}

function getTheme(estado: EstadoMateria) {
  if (estado === "aprobada") {
    const s = STATUS_COLORS.aprobada;
    return {
      card:  { bg: s.cardBg, border: `1px solid ${s.cardBorder}`, borderLeft: `4px solid ${s.accent}` },
      badge: { bg: s.badgeBg, color: s.accent, border: `1px solid ${s.badgeBorder}` },
      label: "Aprobada",
    };
  }
  if (estado === "cursada") {
    const s = STATUS_COLORS.cursada;
    return {
      card:  { bg: s.cardBg, border: `1px solid ${s.cardBorder}`, borderLeft: `4px solid ${s.accent}` },
      badge: { bg: s.badgeBg, color: s.accent, border: `1px solid ${s.badgeBorder}` },
      label: "Cursada",
    };
  }
  const s = STATUS_COLORS.disponible;
  return {
    card:  { bg: s.cardBg, border: `1px solid ${s.cardBorder}`, borderLeft: `4px solid ${s.accent}` },
    badge: { bg: s.badgeBg, color: s.accent, border: `1px solid ${s.badgeBorder}` },
    label: "Disponible",
  };
}

export default function AgrupadorCard({ grupoId, nombre, tipo, estado }: Props) {
  const nombreLimpio = limpiarNombre(nombre);
  const tipoLabel    = labelTipo(tipo);
  const theme        = getTheme(estado);

  const cardStyle: React.CSSProperties = {
    width:        "100%",
    borderRadius: 14,
    padding:      16,
    textAlign:    "left",
    background:   theme.card.bg,
    borderTop:    theme.card.border,
    borderRight:  theme.card.border,
    borderBottom: theme.card.border,
    borderLeft:   theme.card.borderLeft,
  };

  const badgeStyle: React.CSSProperties = {
    display:        "inline-flex",
    alignItems:     "center",
    justifyContent: "center",
    whiteSpace:     "nowrap",
    borderRadius:   99,
    padding:        "4px 12px",
    fontSize:       11,
    fontWeight:     700,
    ...theme.badge,
  };

  return (
    <div data-testid={`agrupador-card-${grupoId}`} style={cardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: TEXT, fontWeight: 700, fontSize: 15, lineHeight: 1.35, marginBottom: 6 }}>
            {nombreLimpio}
          </div>
          <div style={{ color: TEXT_DET, fontSize: 13, display: "flex", flexWrap: "wrap", gap: 6 }}>
            <span>{tipoLabel}</span>
            <span>• {grupoId}</span>
          </div>
        </div>

        <span aria-hidden="true" style={badgeStyle}>
          {theme.label}
        </span>
      </div>

      <div style={{ marginTop: 12 }}>
        <a
          href={`#grupo-${grupoId}`}
          style={{ ...CARD_ACTION_BTN, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
        >
          Ver opciones
        </a>
      </div>
    </div>
  );
}
