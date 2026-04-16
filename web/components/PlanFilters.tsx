"use client";

import { useState } from "react";
import type { EstadoFiltro, FiltrosPlan } from "@/lib/filtrarMaterias";

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
  filtros,
  onChange,
  onReset,
  canReset = false,
  anios,
  cuatrimestres,
  orientaciones = [],
}: Props) {
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  function actualizar<K extends keyof FiltrosPlan>(campo: K, valor: FiltrosPlan[K]) {
    onChange({
      ...filtros,
      [campo]: valor,
    });
  }

  return (
    <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-zinc-700">Filtros</div>
        <div className="flex items-center gap-2">
          {onReset && (
            <button
              type="button"
              data-testid="reset-filtros-btn"
              onClick={onReset}
              disabled={!canReset}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Restaurar filtros
            </button>
          )}

          <button
            type="button"
            data-testid="toggle-filtros-btn"
            aria-expanded={mostrarFiltros}
            onClick={() => setMostrarFiltros((prev) => !prev)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
          >
            {mostrarFiltros ? "Ocultar filtros" : "Mostrar filtros"}
          </button>
        </div>
      </div>

      {mostrarFiltros && (
      <div
        className={`mt-4 grid gap-4 ${
          orientaciones.length > 0 ? "md:grid-cols-5" : "md:grid-cols-4"
        }`}
      >
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          <span>Código o nombre</span>
          <input
            data-testid="filtro-codigo"
            className="rounded-xl border border-zinc-300 px-3 py-2"
            type="search"
            inputMode="numeric"
            placeholder="Ej: 5793 o Análisis"
            value={filtros.codigo}
            onChange={(e) => actualizar("codigo", e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          <span>Año</span>
          <select
            data-testid="filtro-anio"
            className="rounded-xl border border-zinc-300 px-3 py-2"
            value={filtros.anio}
            onChange={(e) => actualizar("anio", e.target.value)}
          >
            <option value="todos">Todos</option>
            {anios.map((anio) => (
              <option key={anio} value={anio}>
                {anio}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          <span>Cuatrimestre</span>
          <select
            data-testid="filtro-cuatrimestre"
            className="rounded-xl border border-zinc-300 px-3 py-2"
            value={filtros.cuatrimestre}
            onChange={(e) => actualizar("cuatrimestre", e.target.value)}
          >
            <option value="todos">Todos</option>
            {cuatrimestres.map((cuatrimestre) => (
              <option key={cuatrimestre} value={cuatrimestre}>
                {cuatrimestre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          <span>Estado</span>
          <select
            data-testid="filtro-estado"
            className="rounded-xl border border-zinc-300 px-3 py-2"
            value={filtros.estado}
            onChange={(e) =>
              actualizar("estado", e.target.value as EstadoFiltro)
            }
          >
            <option value="todas">Todas</option>
            <option value="aprobadas">Aprobadas</option>
            <option value="cursadas">Cursadas</option>
            <option value="disponibles">Disponibles</option>
            <option value="bloqueadas">Bloqueadas</option>
          </select>
        </label>

        {orientaciones.length > 0 && (
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            <span>Orientación</span>
            <select
              data-testid="filtro-orientacion"
              className="rounded-xl border border-zinc-300 px-3 py-2"
              value={filtros.orientacion}
              onChange={(e) => actualizar("orientacion", e.target.value)}
            >
              <option value="todas">Todas</option>
              {orientaciones.map((orientacion) => (
                <option key={orientacion} value={orientacion}>
                  {orientacion}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      )}
    </section>
  );
}