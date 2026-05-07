"use client";

import type { Materia } from "@/app/types/plan";
import { GLASS, TEXT_SEC } from "@/lib/ui/tokens";
import { STATE_STYLE, AMBER, getStateLabel, type VisualEstado } from "../graphUtils";
import type { BestPathResult, OptMode } from "../bestPath";

type Props = {
  result: BestPathResult;
  materiaById: Map<string, Materia>;
  vmById: Map<string, VisualEstado>;
  mode: OptMode;
  onModeChange: (m: OptMode) => void;
  onLimpiar: () => void;
  hasHoras: boolean;
};

export function BestPathPanel({ result, materiaById, vmById, mode, onModeChange, onLimpiar, hasHoras }: Props) {
  const divider: React.CSSProperties = { borderTop: `1px solid ${GLASS.border}`, margin: "4px 0" };

  return (
    <div style={{
      background: "rgba(15,20,50,0.96)", border: `1px solid ${AMBER.border}`,
      borderRadius: 12, padding: "14px 16px", width: 272,
      maxHeight: "75vh", overflowY: "auto",
      backdropFilter: "blur(14px)", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: AMBER.text, lineHeight: 1.3 }}>
            Mejor camino · fin de carrera
          </div>
          <div style={{ fontSize: 10, color: TEXT_SEC, marginTop: 2 }}>
            mínima cantidad de materias desde tu estado actual
          </div>
        </div>
        <button onClick={onLimpiar} style={{ background: "none", border: "none", color: TEXT_SEC, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {(["materias", "cuatrimestres", "horas"] as OptMode[]).map((m) => {
          const label =
            m === "materias" ? "Menos materias" :
            m === "cuatrimestres" ? "Menos cuatrimestres" :
            "Menos carga horaria";
          const disabled = m === "horas" && !hasHoras;
          return (
            <label
              key={m}
              style={{ display: "flex", alignItems: "center", gap: 6, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1 }}
              title={disabled ? "Tu plan no incluye datos de carga horaria" : undefined}
            >
              <input
                type="radio" name="optMode" value={m}
                checked={mode === m} disabled={disabled}
                onChange={() => onModeChange(m)}
                style={{ accentColor: AMBER.border, cursor: disabled ? "not-allowed" : "pointer" }}
              />
              <span style={{ fontSize: 11, color: mode === m ? AMBER.text : TEXT_SEC }}>{label}</span>
            </label>
          );
        })}
      </div>

      <div style={divider} />

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {result.camino.map((id) => {
          const m = materiaById.get(id);
          const ve = vmById.get(id) ?? "bloqueada";
          const isPending = ve !== "aprobada";
          return (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: isPending ? AMBER.border : STATE_STYLE.aprobada.text, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: isPending ? AMBER.text : TEXT_SEC, lineHeight: 1.3, flex: 1 }}>
                {m?.nombre ?? id}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 600, borderRadius: 4, padding: "1px 5px",
                color: isPending ? AMBER.border : STATE_STYLE[ve].text,
                background: isPending ? AMBER.bg : `${STATE_STYLE[ve].bg}99`,
                border: `1px solid ${isPending ? AMBER.border : STATE_STYLE[ve].border}`,
                flexShrink: 0,
              }}>
                {isPending ? "pendiente" : getStateLabel(ve)}
              </span>
            </div>
          );
        })}
      </div>

      <div style={divider} />

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, background: AMBER.bgStrong, border: `1px solid ${AMBER.border}44`, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: AMBER.text }}>{result.pendientes.length}</div>
          <div style={{ fontSize: 9, color: TEXT_SEC, marginTop: 2 }}>materias restantes</div>
        </div>
        <div style={{ flex: 1, background: AMBER.bgStrong, border: `1px solid ${AMBER.border}44`, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: AMBER.text }}>{result.cuatrimestresEstimados}</div>
          <div style={{ fontSize: 9, color: TEXT_SEC, marginTop: 2 }}>cuatrimestres mín.</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button
          disabled
          title="Próximamente"
          style={{ flex: 1, background: GLASS.base, border: `1px solid ${GLASS.border}`, borderRadius: 7, color: TEXT_SEC, fontSize: 11, fontWeight: 600, padding: "6px 8px", cursor: "not-allowed", opacity: 0.5 }}>
          Enviar al Planificador
        </button>
        <button
          onClick={onLimpiar}
          style={{ flex: 1, background: AMBER.bg, border: `1px solid ${AMBER.border}`, borderRadius: 7, color: AMBER.text, fontSize: 11, fontWeight: 600, padding: "6px 8px", cursor: "pointer" }}>
          Limpiar
        </button>
      </div>
    </div>
  );
}
