"use client";

import { TEXT_SEC, GLASS, ACCENT } from "@/lib/ui/tokens";

export type PlanVista = "plan" | "Plan Vista" | "Planificador";

type Props = {
  vistaActiva: PlanVista;
  onChange: (vista: PlanVista) => void;
  onOpenHelp: () => void;
};

const tabBarStyle    = { background: GLASS.base, border: `1px solid ${GLASS.raised}` };
const tabActiveStyle = { background: "rgba(157,78,221,0.30)", color: "#e2d9f3", boxShadow: `0 1px 4px ${ACCENT}44` };
const tabIdleStyle   = { color: TEXT_SEC };
const helpBtnStyle   = { background: GLASS.base, border: `1px solid ${GLASS.strong}`, color: TEXT_SEC };

export default function PlanTabBar({ vistaActiva, onChange, onOpenHelp }: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" data-no-print>
      <div className="flex p-1 rounded-xl" style={tabBarStyle}>
        {(["plan", "Plan Vista", "Planificador"] as const).map((vista) => (
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

      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide transition"
        style={{ background: "rgba(249,199,79,0.10)", border: "1px solid rgba(249,199,79,0.35)", color: "#f9c74f" }}
      >
        Exportar PDF
      </button>

      <button
        type="button"
        onClick={onOpenHelp}
        className="rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ml-auto"
        style={helpBtnStyle}
      >
        Ver ayuda rapida
      </button>
    </div>
  );
}
