"use client";

import type { EstadoFiltro, FiltrosPlan } from "@/lib/filtrarMaterias";

type Props = {
  filtros: FiltrosPlan;
  onChange: (filtros: FiltrosPlan) => void;
  anios: string[];
  cuatrimestres: string[];
};

export default function PlanFilters({
  filtros,
  onChange,
  anios,
  cuatrimestres,
}: Props) {
  function actualizar<K extends keyof FiltrosPlan>(campo: K, valor: FiltrosPlan[K]) {
    onChange({
      ...filtros,
      [campo]: valor,
    });
  }

  return (
    <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-zinc-700">Filtros</div>

      <div className="grid gap-4 md:grid-cols-3">
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
      </div>
    </section>
  );
}