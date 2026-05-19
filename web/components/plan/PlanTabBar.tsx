"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { TEXT_SEC, GLASS, ACCENT, STATUS_COLORS } from "@/lib/ui/tokens";

export type PlanVista = "plan" | "Plan Vista" | "Planificador" | "Mapa";
export type SyncStatus = "guest" | "syncing" | "synced" | "error";

type Props = {
  vistaActiva: PlanVista;
  onChange: (vista: PlanVista) => void;
  onOpenHelp: () => void;
  backHref: string;
  syncStatus?: SyncStatus;
};

const tabActiveStyle = { background: "rgba(157,78,221,0.30)", color: "#e2d9f3", boxShadow: `0 1px 4px ${ACCENT}44` };
const tabIdleStyle   = { color: TEXT_SEC };
const iconBtnStyle   = { background: "transparent", border: `1px solid ${GLASS.strong}`, color: TEXT_SEC, cursor: "pointer", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 } as const;

const syncStyles: Record<SyncStatus, CSSProperties> = {
  guest:   { background: GLASS.base,                        border: `1px solid ${GLASS.strong}`,                         color: TEXT_SEC },
  syncing: { background: STATUS_COLORS.disponible.badgeBg,  border: `1px solid ${STATUS_COLORS.disponible.badgeBorder}`,  color: STATUS_COLORS.disponible.accent },
  synced:  { background: STATUS_COLORS.aprobada.badgeBg,    border: `1px solid ${STATUS_COLORS.aprobada.badgeBorder}`,    color: STATUS_COLORS.aprobada.accent },
  error:   { background: STATUS_COLORS.danger.badgeBg,      border: `1px solid ${STATUS_COLORS.danger.badgeBorder}`,      color: STATUS_COLORS.danger.accent },
};
const syncLabels: Record<SyncStatus, string> = {
  guest: "Guardado local", syncing: "Sincronizando...",
  synced: "Sincronizado en nube", error: "Error de sincronizacion",
};

export default function PlanTabBar({ vistaActiva, onChange, onOpenHelp, backHref, syncStatus }: Props) {
  return (
    <div className="mb-4 flex flex-col gap-2" data-no-print>
      {/* Fila 1: navbar */}
      <div className="flex items-center gap-2">
        <Link
          href={backHref}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${GLASS.strong}`, color: TEXT_SEC, borderRadius: 8, padding: "0 12px", height: 32, fontSize: 13, fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap" }}
        >
          <span aria-hidden="true">←</span>
          <span>Inicio</span>
        </Link>

        <div className="flex-1" />

        {syncStatus && (
          <span style={{ ...syncStyles[syncStatus], borderRadius: 99, padding: "4px 12px", fontSize: 12, fontWeight: 500 }}>
            {syncLabels[syncStatus]}
          </span>
        )}

        <button
          type="button"
          title="Exportar PDF"
          aria-label="Exportar PDF"
          onClick={() => window.print()}
          style={iconBtnStyle}
        >
          ⬇
        </button>

        {vistaActiva === "plan" && (
          <button
            type="button"
            title="Ayuda rápida"
            aria-label="Ver ayuda rápida"
            onClick={onOpenHelp}
            style={iconBtnStyle}
          >
            ?
          </button>
        )}
      </div>

      {/* Fila 2: tabs */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" as never }}>
        <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 4, whiteSpace: "nowrap" }}>
          {(["plan", "Plan Vista", "Planificador", "Mapa"] as const).map((vista) => (
            <button
              key={vista}
              type="button"
              onClick={() => onChange(vista)}
              style={{
                ...(vistaActiva === vista ? tabActiveStyle : tabIdleStyle),
                border: "none",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: "clamp(11px, 3vw, 13px)",
                fontWeight: 600,
                cursor: "pointer",
                background: vistaActiva === vista ? "rgba(157,78,221,0.30)" : "transparent",
                textTransform: "capitalize",
                whiteSpace: "nowrap",
              }}
            >
              {vista === "plan" ? "Plan" : vista}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
