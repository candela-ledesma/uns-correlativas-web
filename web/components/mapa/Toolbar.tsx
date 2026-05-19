"use client";

import { GLASS, TEXT, TEXT_SEC, ACCENT } from "@/lib/ui/tokens";
import { STATE_STYLE, type VisualEstado, type LayoutMode } from "@/lib/mapa/graphUtils";

export type FiltroEstado = "todas" | VisualEstado;

const FILTER_DOT: Record<VisualEstado, string> = {
  aprobada:   STATE_STYLE.aprobada.text,
  cursada:    STATE_STYLE.cursada.text,
  disponible: STATE_STYLE.disponible.text,
  bloqueada:  STATE_STYLE.bloqueada.text,
};

type Props = {
  filtro: FiltroEstado;
  onFiltro: (f: FiltroEstado) => void;
  busqueda: string;
  onBusqueda: (s: string) => void;
  contadores: Record<VisualEstado, number>;
  onBuscar: () => void;
  layoutMode: LayoutMode;
  onToggleLayout: () => void;
  miVistaActiva: boolean;
  onToggleMiVista: (v: boolean) => void;
  onAbrirEditor: () => void;
  simplificarGrafo: boolean;
  onToggleSimplificar: () => void;
};

export function Toolbar({
  filtro, onFiltro, busqueda, onBusqueda, contadores, onBuscar,
  layoutMode, onToggleLayout,
  miVistaActiva, onToggleMiVista, onAbrirEditor,
  simplificarGrafo, onToggleSimplificar,
}: Props) {
  const chips: { key: FiltroEstado; label: string }[] = [
    { key: "todas",      label: "Todas"      },
    { key: "aprobada",   label: "Aprobada"   },
    { key: "cursada",    label: "Cursada"    },
    { key: "disponible", label: "Disponible" },
    { key: "bloqueada",  label: "Bloqueada"  },
  ];
  const total = Object.values(contadores).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, padding: "8px 12px", background: GLASS.dim, border: `1px solid ${GLASS.raised}`, borderRadius: 10 }}>
      {/* Fila 1: búsqueda + chips de estado */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        <input
          type="text" placeholder="Buscar materia..." value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onBuscar()}
          style={{ background: GLASS.elevated, border: `1px solid ${GLASS.strong}`, borderRadius: 7, color: TEXT, fontSize: 12, padding: "5px 10px", outline: "none", width: "100%", maxWidth: 200, minWidth: 0, flex: "1 1 120px" }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {chips.map(({ key, label }) => {
            const active = filtro === key;
            const accentColor = key === "todas" ? ACCENT : STATE_STYLE[key as VisualEstado].text;
            const dotColor = key !== "todas" ? FILTER_DOT[key as VisualEstado] : null;
            return (
              <button key={key} onClick={() => onFiltro(key)} style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 6,
                border: active ? `1px solid ${accentColor}` : `1px solid ${GLASS.border}`,
                background: active ? `${accentColor}22` : GLASS.base,
                color: active ? accentColor : TEXT_SEC, cursor: "pointer", transition: "all 0.1s",
                whiteSpace: "nowrap",
              }}>
                {dotColor && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0, opacity: active ? 1 : 0.5 }} />
                )}
                {label}
                {key !== "todas" && <span style={{ opacity: 0.7 }}>{contadores[key as VisualEstado]}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fila 2: botones de vista (scroll horizontal en mobile) */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" as never }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <div style={{ display: "flex", background: GLASS.elevated, border: `1px solid ${GLASS.border}`, borderRadius: 7, overflow: "hidden", flexShrink: 0 }}>
            {(["cuatrimestre", "topologico"] as LayoutMode[]).map((mode, i) => {
              const active = layoutMode === mode;
              return (
                <button
                  key={mode}
                  onClick={onToggleLayout}
                  title={mode === "cuatrimestre" ? "Agrupar por año y cuatrimestre" : "Posicionar por nivel de dependencias"}
                  style={{
                    fontSize: 10, fontWeight: 600, padding: "3px 10px", border: "none",
                    borderLeft: i > 0 ? `1px solid ${GLASS.border}` : "none",
                    background: active ? `${ACCENT}33` : "transparent",
                    color: active ? ACCENT : TEXT_SEC, cursor: "pointer", transition: "all 0.1s",
                  }}>
                  {mode === "cuatrimestre" ? "Por cuatrimestre" : "Topológico"}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onToggleMiVista(!miVistaActiva)}
            style={{
              fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 6, flexShrink: 0,
              border: miVistaActiva ? `1px solid ${ACCENT}` : `1px solid ${GLASS.border}`,
              background: miVistaActiva ? `${ACCENT}22` : GLASS.base,
              color: miVistaActiva ? ACCENT : TEXT_SEC, cursor: "pointer", transition: "all 0.1s",
            }}>
            Mi vista
          </button>

          <button
            onClick={onToggleSimplificar}
            title="Ocultar aristas redundantes (reducción transitiva)"
            style={{
              fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 6, flexShrink: 0,
              border: simplificarGrafo ? `1px solid ${ACCENT}` : `1px solid ${GLASS.border}`,
              background: simplificarGrafo ? `${ACCENT}22` : GLASS.base,
              color: simplificarGrafo ? ACCENT : TEXT_SEC, cursor: "pointer", transition: "all 0.1s",
            }}>
            Simplificar
          </button>

          <button
            onClick={onAbrirEditor}
            title="Armar mi propia vista del mapa"
            style={{
              fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 6, flexShrink: 0,
              border: `1px solid ${GLASS.border}`, background: GLASS.base,
              color: TEXT_SEC, cursor: "pointer", transition: "all 0.1s",
            }}>
            + Editar
          </button>

          <span style={{ fontSize: 10, color: TEXT_SEC, paddingLeft: 4, flexShrink: 0 }}>
            {contadores.aprobada} aprobadas · {contadores.cursada} cursando · {contadores.disponible} disponibles · {contadores.bloqueada} bloqueadas · {total} total
          </span>
        </div>
      </div>
    </div>
  );
}
