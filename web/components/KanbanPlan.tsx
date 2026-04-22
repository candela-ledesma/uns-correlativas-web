"use client";

import { useMemo } from "react";
import type { Materia, Agrupador } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/evaluarCorrelativas";
import {
  estaHabilitadaParaCursar,
  estaHabilitadaParaAprobar,
} from "@/lib/evaluarCorrelativas";
import { getEstadoKey } from "@/lib/estadoKey";

type Props = {
  materias: Materia[];
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  estados: Record<string, EstadoMateria>;
  onToggle: (materia: Materia, grupoId?: string) => void;
  onUndo: (materia: Materia, grupoId?: string) => void;
};

type Columna = {
  titulo: string;
  materias: Materia[];
};

const ANIO_ORDER = [
  "Primer Año",
  "Segundo Año",
  "Tercer Año",
  "Cuarto Año",
  "Quinto Año",
  "Sexto Año",
];

function anioSortKey(titulo: string): number {
  const idx = ANIO_ORDER.indexOf(titulo);
  return idx === -1 ? ANIO_ORDER.length : idx;
}

function buildColumnas(materias: Materia[], idsAgrupadores: Set<string>): Columna[] {
  const porAnio = new Map<string, Materia[]>();

  for (const m of materias) {
    if (idsAgrupadores.has(String(m.id))) continue;
    const anio = m.año ?? "Sin año";
    if (!porAnio.has(anio)) porAnio.set(anio, []);
    porAnio.get(anio)!.push(m);
  }

  return Array.from(porAnio.entries())
    .sort(([a], [b]) => anioSortKey(a) - anioSortKey(b))
    .map(([titulo, mats]) => ({ titulo, materias: mats }));
}

function getMateriaEstado(
  materia: Materia,
  estados: Record<string, EstadoMateria>
): EstadoMateria {
  const grupoId = materia.grupo_opcion ?? undefined;
  return estados[getEstadoKey(materia, grupoId)] ?? "no_cursada";
}

function getBadgeLabel(estado: EstadoMateria, puedeCursar: boolean): string {
  if (estado === "aprobada") return "Aprobada";
  if (estado === "cursada") return "Cursada";
  if (puedeCursar) return "Disponible";
  return "Bloqueada";
}

function getBadgeClass(estado: EstadoMateria, puedeCursar: boolean): string {
  const base =
    "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold";
  if (estado === "aprobada") return `${base} bg-green-200 text-green-800`;
  if (estado === "cursada") return `${base} bg-blue-200 text-blue-800`;
  if (puedeCursar) return `${base} bg-yellow-200 text-yellow-800`;
  return `${base} bg-zinc-200 text-zinc-500`;
}

function getCardClass(
  estado: EstadoMateria,
  puedeCursar: boolean,
  bloqueada: boolean
): string {
  const base = "rounded-xl border p-3 shadow-sm transition";
  if (estado === "aprobada") return `${base} border-green-300 bg-green-100`;
  if (estado === "cursada") return `${base} border-blue-300 bg-blue-100`;
  if (bloqueada) return `${base} border-zinc-200 bg-zinc-100 opacity-75`;
  if (puedeCursar) return `${base} border-yellow-300 bg-yellow-100`;
  return `${base} border-zinc-200 bg-white`;
}

export default function KanbanPlan({
  materias,
  agrupadores,
  idsAgrupadores,
  estados,
  onToggle,
  onUndo,
}: Props) {
  const columnas = useMemo(
    () => buildColumnas(materias, idsAgrupadores),
    [materias, idsAgrupadores]
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columnas.map((col) => {
        const aprobadas = col.materias.filter(
          (m) => getMateriaEstado(m, estados) === "aprobada"
        ).length;
        const cursadas = col.materias.filter(
          (m) => getMateriaEstado(m, estados) === "cursada"
        ).length;

        return (
          <div
            key={col.titulo}
            className="flex w-72 shrink-0 flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm"
          >
            <div className="rounded-t-2xl border-b border-zinc-100 bg-zinc-50 px-4 py-3">
              <div className="font-bold text-zinc-900">{col.titulo}</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {col.materias.length} materias
                {aprobadas > 0 && ` · ${aprobadas} aprobadas`}
                {cursadas > 0 && ` · ${cursadas} cursadas`}
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3">
              {col.materias.map((materia) => {
                const estado = getMateriaEstado(materia, estados);
                const puedeCursar = estaHabilitadaParaCursar(materia, estados, agrupadores);
                const puedeAprobar = estaHabilitadaParaAprobar(materia, estados, agrupadores);
                const bloqueada = !puedeCursar && estado === "no_cursada";
                const grupoId = materia.grupo_opcion ?? undefined;

                const puedeAvanzar =
                  (estado === "no_cursada" && puedeCursar) ||
                  (estado === "cursada" && puedeAprobar);

                return (
                  <div
                    key={String(materia.id)}
                    className={getCardClass(estado, puedeCursar, bloqueada)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold leading-5 text-zinc-900">
                          {materia.nombre}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {materia.id}
                          {materia.horas && ` · ${materia.horas} hs`}
                        </div>
                      </div>
                      <span className={getBadgeClass(estado, puedeCursar)}>
                        {getBadgeLabel(estado, puedeCursar)}
                      </span>
                    </div>

                    {(puedeAvanzar || estado !== "no_cursada") && (
                      <div className="mt-2 flex gap-1.5">
                        {puedeAvanzar && (
                          <button
                            type="button"
                            onClick={() => onToggle(materia, grupoId)}
                            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                          >
                            {estado === "no_cursada" ? "Marcar cursada" : "Marcar aprobada"}
                          </button>
                        )}
                        {estado !== "no_cursada" && (
                          <button
                            type="button"
                            onClick={() => onUndo(materia, grupoId)}
                            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                          >
                            Deshacer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
