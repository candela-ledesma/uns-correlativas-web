"use client";

import { useMemo, useRef, useState } from "react";
import type { Materia, Agrupador } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { estaHabilitadaParaCursar } from "@/lib/evaluarCorrelativas";
import { getEstadoKey } from "@/lib/estadoKey";

type Props = {
  materias: Materia[];
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  estados: Record<string, EstadoMateria>;
};

type DragRef = {
  materiaId: string;
  fromCol: string;
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

function buildInitialOrder(
  materias: Materia[],
  idsAgrupadores: Set<string>
): Record<string, string[]> {
  const porAnio = new Map<string, string[]>();

  for (const m of materias) {
    if (idsAgrupadores.has(String(m.id))) continue;
    const anio = m.año ?? "Sin año";
    if (!porAnio.has(anio)) porAnio.set(anio, []);
    porAnio.get(anio)!.push(String(m.id));
  }

  return Object.fromEntries(
    Array.from(porAnio.entries()).sort(([a], [b]) => anioSortKey(a) - anioSortKey(b))
  );
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
  const base =
    "rounded-xl border p-3 shadow-sm transition cursor-grab active:cursor-grabbing select-none";
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
}: Props) {
  const materiaById = useMemo(
    () => new Map(materias.map((m) => [String(m.id), m])),
    [materias]
  );

  const [localOrder, setLocalOrder] = useState<Record<string, string[]>>(() =>
    buildInitialOrder(materias, idsAgrupadores)
  );
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragRef = useRef<DragRef | null>(null);

  const colTitulos = Object.keys(localOrder);

  function handleDragStart(materiaId: string, fromCol: string) {
    dragRef.current = { materiaId, fromCol };
  }

  function handleDrop(toCol: string) {
    const drag = dragRef.current;
    if (!drag || drag.fromCol === toCol) {
      setDragOver(null);
      dragRef.current = null;
      return;
    }

    setLocalOrder((prev) => ({
      ...prev,
      [drag.fromCol]: (prev[drag.fromCol] ?? []).filter((id) => id !== drag.materiaId),
      [toCol]: [...(prev[toCol] ?? []), drag.materiaId],
    }));

    setDragOver(null);
    dragRef.current = null;
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {colTitulos.map((titulo) => {
        const ids = localOrder[titulo] ?? [];
        const colMaterias = ids
          .map((id) => materiaById.get(id))
          .filter((m): m is Materia => Boolean(m));

        const aprobadas = colMaterias.filter(
          (m) => getMateriaEstado(m, estados) === "aprobada"
        ).length;
        const cursadas = colMaterias.filter(
          (m) => getMateriaEstado(m, estados) === "cursada"
        ).length;
        const isDragOver = dragOver === titulo;

        return (
          <div
            key={titulo}
            className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-white shadow-sm transition ${
              isDragOver ? "border-blue-400 ring-2 ring-blue-200" : "border-zinc-200"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(titulo);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOver(null);
              }
            }}
            onDrop={() => handleDrop(titulo)}
          >
            <div className="rounded-t-2xl border-b border-zinc-100 bg-zinc-50 px-4 py-3">
              <div className="font-bold text-zinc-900">{titulo}</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {colMaterias.length} materias
                {aprobadas > 0 && ` · ${aprobadas} aprobadas`}
                {cursadas > 0 && ` · ${cursadas} cursadas`}
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3">
              {colMaterias.map((materia) => {
                const estado = getMateriaEstado(materia, estados);
                const puedeCursar = estaHabilitadaParaCursar(materia, estados, agrupadores);
                const bloqueada = !puedeCursar && estado === "no_cursada";

                return (
                  <div
                    key={String(materia.id)}
                    draggable
                    onDragStart={() => handleDragStart(String(materia.id), titulo)}
                    onDragEnd={() => setDragOver(null)}
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
