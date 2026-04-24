"use client";

import { useState } from "react";
import type { EstadoFiltro, FiltrosPlan } from "@/lib/filtrarMaterias";

import { TEXT_SEC, SURFACE, BTN as BTN_BASE, INPUT as INPUT_BASE } from "@/lib/tokens";
const INPUT = { ...INPUT_BASE, borderRadius: 10, padding: "8px 12px", fontSize: 14 } as const;
const BTN   = { ...BTN_BASE,   borderRadius: 10, padding: "6px 14px", fontSize: 13, fontWeight: 600 } as const;

type Props = {
  filtros: FiltrosPlan;
  onChange: (filtros: FiltrosPlan) => void;
  onReset?: () => void;
  canReset?: boolean;
  anios: string[];
  cuatrimestres: string[];
  orientaciones?: string[];
};

export default function PlanFilters({
  filtros, onChange, onReset, canReset = false, anios, cuatrimestres, orientaciones = [],
}: Props) {
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  function actualizar<K extends keyof FiltrosPlan>(campo: K, valor: FiltrosPlan[K]) {
    onChange({ ...filtros, [campo]: valor });
  }

  return (
    <section data-no-print style={{ ...SURFACE, borderRadius: 16, padding: 16, marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ color: TEXT_SEC, fontSize: 13, fontWeight: 600 }}>Filtros</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
          <button
            type="button"
            data-testid="toggle-filtros-btn"
            aria-expanded={mostrarFiltros}
            onClick={() => setMostrarFiltros((p) => !p)}
            style={{ ...BTN, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
            </svg>
            {mostrarFiltros ? "Ocultar filtros" : "Mostrar filtros"}
          </button>
        </div>
      </div>

      {mostrarFiltros && (
        <div style={{ marginTop: 16, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: TEXT_SEC }}>
            <span>Código o nombre</span>
            <input
              data-testid="filtro-codigo"
              style={INPUT}
              type="search"
              inputMode="numeric"
              placeholder="Ej: 5793 o Análisis"
              value={filtros.codigo}
              onChange={(e) => actualizar("codigo", e.target.value)}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: TEXT_SEC }}>
            <span>Año</span>
            <select data-testid="filtro-anio" style={INPUT} value={filtros.anio} onChange={(e) => actualizar("anio", e.target.value)}>
              <option value="todos">Todos</option>
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: TEXT_SEC }}>
            <span>Cuatrimestre</span>
            <select data-testid="filtro-cuatrimestre" style={INPUT} value={filtros.cuatrimestre} onChange={(e) => actualizar("cuatrimestre", e.target.value)}>
              <option value="todos">Todos</option>
              {cuatrimestres.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: TEXT_SEC }}>
            <span>Estado</span>
            <select data-testid="filtro-estado" style={INPUT} value={filtros.estado} onChange={(e) => actualizar("estado", e.target.value as EstadoFiltro)}>
              <option value="todas">Todas</option>
              <option value="aprobadas">Aprobadas</option>
              <option value="cursadas">Cursadas</option>
              <option value="disponibles">Disponibles</option>
              <option value="bloqueadas">Bloqueadas</option>
            </select>
          </label>

          {orientaciones.length > 0 && (
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: TEXT_SEC }}>
              <span>Orientación</span>
              <select data-testid="filtro-orientacion" style={INPUT} value={filtros.orientacion} onChange={(e) => actualizar("orientacion", e.target.value)}>
                <option value="todas">Todas</option>
                {orientaciones.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
    </section>
  );
}
