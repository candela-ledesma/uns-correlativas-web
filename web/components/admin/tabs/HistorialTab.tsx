"use client";

import { GLASS, TEXT, TEXT_SEC, SURFACE, STATUS_COLORS } from "@/lib/ui/tokens";

const ITEMS = [
  { nombre: "farmacia_plan2025.pdf",  meta: "UNS · Farmacia · hace 1 día",         status: "ok"      },
  { nombre: "ing_civil_v2.pdf",       meta: "UNS · Ingeniería Civil · hace 3 días", status: "error"   },
  { nombre: "abogacia_plan2020.pdf",  meta: "UNS · Abogacía · hace 5 días",         status: "ok"      },
  { nombre: "sistemas_unlp.pdf",      meta: "UNLP · Ing. en Sistemas · hace 7 días",status: "pending" },
];

const BADGE: Record<string, { label: string; bg: string; border: string; color: string }> = {
  ok:      { label: "Exitoso",         bg: STATUS_COLORS.aprobada.badgeBg,   border: STATUS_COLORS.aprobada.badgeBorder,   color: STATUS_COLORS.aprobada.accent },
  error:   { label: "Error al parsear",bg: STATUS_COLORS.danger.badgeBg,     border: STATUS_COLORS.danger.badgeBorder,     color: STATUS_COLORS.danger.accent },
  pending: { label: "Pendiente",       bg: STATUS_COLORS.disponible.badgeBg, border: STATUS_COLORS.disponible.badgeBorder, color: STATUS_COLORS.disponible.accent },
};

export default function HistorialTab() {
  return (
    <div style={{ ...SURFACE, borderRadius: 12, padding: "20px 22px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: TEXT_SEC, marginBottom: 12 }}>
        Parseos anteriores
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {ITEMS.map((item, i) => {
          const b = BADGE[item.status];
          return (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 6px",
                borderBottom: i < ITEMS.length - 1 ? `1px solid ${GLASS.border}` : "none",
              }}
            >
              <span style={{ fontSize: 20, opacity: 0.6 }}>📄</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: TEXT }}>{item.nombre}</div>
                <div style={{ fontSize: 11, color: TEXT_SEC, marginTop: 2 }}>{item.meta}</div>
              </div>
              <span style={{
                background: b.bg, border: `1px solid ${b.border}`, color: b.color,
                borderRadius: 5, padding: "2px 9px", fontSize: 10, fontWeight: 600,
                flexShrink: 0,
              }}>
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
