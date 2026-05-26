"use client";

import { useState } from "react";
import type { EstadoFiltro, FiltrosPlan } from "@/lib/plan/filtrarMaterias";
import { normalizarTextoBusqueda } from "@/lib/plan/filtrarMaterias";
import { BTN as BTN_BASE } from "@/lib/ui/tokens";

const BTN = { ...BTN_BASE, borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600 } as const;

const DIVIDER: React.CSSProperties = {
  width: "0.5px",
  height: 18,
  background: "rgba(255,255,255,0.08)",
  flexShrink: 0,
};

const INPUT_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 8,
  padding: "7px 28px 7px 34px",
  fontSize: 13,
  color: "rgba(255,255,255,0.85)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const CHIP_ACTIVE: React.CSSProperties = {
  padding: "3px 10px",
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 500,
  border: "0.5px solid #534AB7",
  color: "#AFA9EC",
  background: "rgba(127,119,221,0.15)",
  cursor: "pointer",
};

const CHIP_INACTIVE: React.CSSProperties = {
  padding: "3px 10px",
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 500,
  border: "0.5px solid rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.35)",
  background: "transparent",
  cursor: "pointer",
};

const ADVANCED_GRID: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  fontSize: 12,
  color: "rgba(255,255,255,0.45)",
};

const SELECT_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "0.5px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  padding: "4px 8px",
  fontSize: 12,
  color: "inherit",
};

function buildOrientationTestId(value: string) {
  const normalized = normalizarTextoBusqueda(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "todas";
}

type Props = {
  filtros: FiltrosPlan;
  onChange: (filtros: FiltrosPlan) => void;
  onReset?: () => void;
  canReset?: boolean;
  anios: string[];
  cuatrimestres: string[];
  orientaciones?: string[];
  selectedOrientacion?: string;
  onSelectOrientacion?: (orientacion: string) => void;
};

export default function PlanFilters({
  filtros,
  onChange,
  onReset,
  canReset = false,
  anios,
  cuatrimestres,
  orientaciones = [],
  selectedOrientacion = "todas",
  onSelectOrientacion,
}: Props) {
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  function actualizar<K extends keyof FiltrosPlan>(campo: K, valor: FiltrosPlan[K]) {
    onChange({ ...filtros, [campo]: valor });
  }

  const orientacionOptions = ["todas", ...orientaciones];
  const showOrientacionChips = orientaciones.length > 0 && onSelectOrientacion;

  return (
    <section data-no-print>
      <style>{`
        .pf-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 14px;
          background: rgba(255,255,255,0.02);
          border: 0.5px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .pf-search-wrap { position: relative; width: 220px; flex-shrink: 0; }
        .pf-search-wrap input::placeholder { color: rgba(255,255,255,0.4); }
        .pf-search-wrap input:focus { border-color: rgba(127,119,221,0.6); background: rgba(255,255,255,0.1); }
        .pf-search-wrap input::-webkit-search-cancel-button { display: none; }
        .pf-chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .pf-spacer { flex: 1; min-width: 0; }
        @media (max-width: 640px) {
          .pf-search-wrap { width: 100%; flex-basis: 100%; }
          .pf-chips { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 2px; }
          .pf-chips::-webkit-scrollbar { display: none; }
          .pf-spacer { display: none; }
        }
      `}</style>

      {/* ── Single control row ── */}
      <div className="pf-row">
        {/* Search input */}
        <div className="pf-search-wrap">
          <svg
            aria-hidden="true"
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            data-testid="filtro-busqueda"
            style={INPUT_STYLE}
            type="search"
            placeholder="Buscar materia..."
            value={filtros.codigo}
            onChange={(e) => actualizar("codigo", e.target.value)}
          />
          {filtros.codigo && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => actualizar("codigo", "")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1, padding: 2 }}
            >
              ×
            </button>
          )}
        </div>

        {/* Divider before orientation chips */}
        {showOrientacionChips && <div style={DIVIDER} />}

        {/* Orientation chips */}
        {showOrientacionChips && (
          <div className="pf-chips">
            {orientacionOptions.map((option) => {
              const isActive = selectedOrientacion === option;
              const label = option === "todas" ? "Todas" : option;
              return (
                <button
                  key={option}
                  type="button"
                  data-testid={`orientacion-option-${buildOrientationTestId(option)}`}
                  aria-pressed={isActive}
                  onClick={() => onSelectOrientacion(option)}
                  style={isActive ? CHIP_ACTIVE : CHIP_INACTIVE}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Divider before action buttons */}
        <div style={DIVIDER} />

        {/* Spacer to push buttons to the right */}
        <div className="pf-spacer" />

        {/* Restaurar filtros */}
        {onReset && (
          <button
            type="button"
            data-testid="reset-filtros-btn"
            onClick={onReset}
            disabled={!canReset}
            style={{ ...BTN, opacity: canReset ? 1 : 0.3, cursor: canReset ? "pointer" : "not-allowed" }}
          >
            Restaurar filtros
          </button>
        )}

        {/* Mostrar / Ocultar filtros */}
        <button
          type="button"
          data-testid="toggle-filtros-btn"
          aria-expanded={mostrarFiltros}
          onClick={() => setMostrarFiltros((p) => !p)}
          style={{ ...BTN, display: "inline-flex", alignItems: "center", gap: 5 }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
          </svg>
          {mostrarFiltros ? "Ocultar filtros" : "Mostrar filtros"} {mostrarFiltros ? "▲" : "▾"}
        </button>
      </div>

      {/* ── Advanced filters panel ── */}
      {mostrarFiltros && (
        <div
          style={{
            marginTop: -16,
            marginBottom: 24,
            padding: "12px 14px",
            background: "rgba(255,255,255,0.02)",
            border: "0.5px solid rgba(255,255,255,0.07)",
            borderTop: "none",
            borderRadius: "0 0 8px 8px",
          }}
        >
          <div style={ADVANCED_GRID}>
            <label style={LABEL_STYLE}>
              <span>Año</span>
              <select data-testid="filtro-anio" style={SELECT_STYLE} value={filtros.anio} onChange={(e) => actualizar("anio", e.target.value)}>
                <option value="todos">Todos</option>
                {anios.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>

            <label style={LABEL_STYLE}>
              <span>Cuatrimestre</span>
              <select data-testid="filtro-cuatrimestre" style={SELECT_STYLE} value={filtros.cuatrimestre} onChange={(e) => actualizar("cuatrimestre", e.target.value)}>
                <option value="todos">Todos</option>
                {cuatrimestres.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label style={LABEL_STYLE}>
              <span>Estado</span>
              <select data-testid="filtro-estado" style={SELECT_STYLE} value={filtros.estado} onChange={(e) => actualizar("estado", e.target.value as EstadoFiltro)}>
                <option value="todas">Todas</option>
                <option value="aprobadas">Aprobadas</option>
                <option value="cursadas">Cursadas</option>
                <option value="disponibles">Disponibles</option>
                <option value="bloqueadas">Bloqueadas</option>
              </select>
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
