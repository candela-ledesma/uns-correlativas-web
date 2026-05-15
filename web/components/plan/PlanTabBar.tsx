"use client";

import { TEXT_SEC, GLASS, ACCENT } from "@/lib/ui/tokens";

export type PlanVista = "plan" | "Plan Vista" | "Planificador" | "Mapa";

type Props = {
  vistaActiva: PlanVista;
  onChange: (vista: PlanVista) => void;
  onOpenHelp: () => void;
};

const tabBarStyle    = { background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 4 };
const tabActiveStyle = { background: "rgba(157,78,221,0.30)", color: "#e2d9f3", boxShadow: `0 1px 4px ${ACCENT}44` };
const tabIdleStyle   = { color: TEXT_SEC };
const iconBtnStyle   = { background: "transparent", border: "none", color: TEXT_SEC, cursor: "pointer", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 } as const;

export default function PlanTabBar({ vistaActiva, onChange, onOpenHelp }: Props) {
  return (
    <div className="mb-4 flex flex-col gap-2" data-no-print>
      <div className="flex flex-wrap items-center gap-2">
        {/* Segmented control */}
        <div className="flex rounded-xl" style={tabBarStyle}>
          {(["plan", "Plan Vista", "Planificador", "Mapa"] as const).map((vista) => (
            <button
              key={vista}
              type="button"
              onClick={() => onChange(vista)}
              className="rounded-lg px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold transition capitalize"
              style={vistaActiva === vista ? tabActiveStyle : tabIdleStyle}
            >
              {vista === "plan" ? "Plan" : vista}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Icon buttons: PDF + Ayuda */}
        <button
          type="button"
          title="Exportar PDF"
          aria-label="Exportar PDF"
          onClick={() => window.print()}
          style={iconBtnStyle}
        >
          ⬇
        </button>

        <button
          type="button"
          title="Ayuda rápida"
          aria-label="Ver ayuda rápida"
          onClick={onOpenHelp}
          style={iconBtnStyle}
        >
          ?
        </button>
      </div>
    </div>
  );
}
