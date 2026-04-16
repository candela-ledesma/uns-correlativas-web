"use client";

import { HTMLAttributes, KeyboardEvent, MouseEvent, useState } from "react";
import { Materia } from "../app/types/plan";
import { EstadoMateria } from "../lib/evaluarCorrelativas";
import type { CorrelativaDetalle } from "@/lib/correlativasMateria";

type Props = HTMLAttributes<HTMLDivElement> & {
  materia: Materia;
  estado: EstadoMateria;
  puedeCursar: boolean;
  puedeAprobar: boolean;
  puedeClickear: boolean;
  bloqueada: boolean;
  onToggle: () => void;
  onUndo?: () => void;
  undoTestId?: string;
  correlativas?: CorrelativaDetalle[];
  verCorrelativasTestId?: string;
};

function getNivelLabel(nivel: string | null) {
  if (!nivel) return "Sin requisito";
  if (nivel === "aprobada") return "Aprobada";
  if (nivel === "cursada") return "Cursada";
  return nivel;
}

function getCumplimientoLabel(cumple: boolean) {
  return cumple ? "Cumple" : "No cumple";
}

function getCumplimientoClassName(cumple: boolean) {
  const base = "ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold";
  return cumple
    ? `${base} bg-green-100 text-green-700`
    : `${base} bg-red-100 text-red-700`;
}

function getEstadoLabel(
  estado: EstadoMateria,
  bloqueada: boolean,
  puedeAprobar: boolean
) {
  if (estado === "aprobada") return "Aprobada";
  if (estado === "cursada" && puedeAprobar) return "Cursada";
  if (estado === "cursada") return "Cursada";
  if (bloqueada) return "Bloqueada";
  return "Disponible";
}

function getCardClassName(
  estado: EstadoMateria,
  puedeCursar: boolean,
  bloqueada: boolean,
  puedeClickear: boolean
) {
  const base =
    "w-full rounded-2xl border p-4 text-left shadow-sm transition duration-150 focus:outline-none focus:ring-4 focus:ring-blue-700/30";

  if (estado === "aprobada") {
    return `${base} cursor-not-allowed border-green-300 bg-green-100 opacity-90`;
  }

  if (estado === "cursada") {
    return `${base} cursor-not-allowed border-blue-300 bg-blue-100 opacity-90`;
  }

  if (!puedeClickear || bloqueada) {
    return `${base} cursor-not-allowed border-zinc-200 bg-zinc-100 opacity-75`;
  }

  if (puedeCursar) {
    return `${base} cursor-pointer border-yellow-300 bg-yellow-100 hover:-translate-y-0.5 hover:shadow-md`;
  }

  return `${base} cursor-pointer border-zinc-200 bg-white hover:-translate-y-0.5 hover:shadow-md`;
}

function getBadgeClassName(
  estado: EstadoMateria,
  bloqueada: boolean,
  puedeAprobar: boolean
) {
  const base =
    "inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold";

  if (estado === "aprobada") {
    return `${base} bg-green-200 text-green-800`;
  }

  if (estado === "cursada" && puedeAprobar) {
    return `${base} bg-blue-200 text-blue-800`;
  }

  if (estado === "cursada") {
    return `${base} bg-blue-200 text-blue-800`;
  }

  if (bloqueada) {
    return `${base} bg-zinc-200 text-zinc-500`;
  }

  return `${base} bg-yellow-200 text-yellow-800`;
}

export default function MateriaCard({
  materia,
  estado,
  puedeCursar,
  puedeAprobar,
  puedeClickear,
  bloqueada,
  onToggle,
  onUndo,
  undoTestId,
  correlativas = [],
  verCorrelativasTestId,
  ...rest
}: Props) {
  const [mostrarCorrelativas, setMostrarCorrelativas] = useState(false);
  const estadoLabel = getEstadoLabel(estado, bloqueada, puedeAprobar);
  const canUndo = estado !== "no_cursada" && Boolean(onUndo);
  const puedeInteractuar = puedeClickear || canUndo;
  const tieneCorrelativas = correlativas.length > 0;

  const ariaLabel = `${materia.nombre}. Código ${materia.id}. Estado ${estadoLabel}. ${
    materia.horas ? `Carga horaria ${materia.horas} horas.` : ""
  }`;

  function handleCardClick() {
    if (!puedeClickear) return;
    onToggle();
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!puedeClickear) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    onToggle();
  }

  function handleUndoClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onUndo?.();
  }

  function handleCorrelativasClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setMostrarCorrelativas((prev) => !prev);
  }

  return (
    <div
      {...rest}
      role={puedeClickear ? "button" : undefined}
      tabIndex={puedeClickear ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      aria-label={ariaLabel}
      className={`group ${getCardClassName(
        estado,
        puedeCursar,
        bloqueada,
        puedeInteractuar
      )}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 text-base font-bold leading-5 text-zinc-900 [text-wrap:balance]">
            {materia.nombre}
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-zinc-600">
            <span>Código {materia.id}</span>
            {materia.horas && <span>• {materia.horas} hs</span>}
          </div>
        </div>

        <span
          aria-hidden="true"
          className={getBadgeClassName(estado, bloqueada, puedeAprobar)}
        >
          {estadoLabel}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {tieneCorrelativas && (
          <button
            type="button"
            data-testid={verCorrelativasTestId}
            onClick={handleCorrelativasClick}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
          >
            {mostrarCorrelativas ? "Ocultar correlativas" : "Ver correlativas"}
          </button>
        )}

        {canUndo && (
          <button
            type="button"
            data-testid={undoTestId}
            onClick={handleUndoClick}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 transition duration-150 hover:bg-zinc-50 md:invisible md:pointer-events-none md:opacity-0 md:group-hover:visible md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:visible md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:focus-visible:visible md:focus-visible:pointer-events-auto md:focus-visible:opacity-100"
          >
            Deshacer
          </button>
        )}
      </div>

      {tieneCorrelativas && mostrarCorrelativas && (
        <div
          className="mt-3 rounded-xl border border-zinc-200 bg-white/70 p-3"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Correlativas
          </div>

          <ul className="space-y-2">
            {correlativas.map((correlativa) => (
              <li
                key={correlativa.id}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                <div className="font-semibold text-zinc-900">
                  {correlativa.nombre} ({correlativa.id})
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  Para cursar: {getNivelLabel(correlativa.paraCursar)}
                  <span className={getCumplimientoClassName(correlativa.cumpleParaCursar)}>
                    {getCumplimientoLabel(correlativa.cumpleParaCursar)}
                  </span>
                </div>
                <div className="text-xs text-zinc-600">
                  Para rendir: {getNivelLabel(correlativa.paraRendir)}
                  <span className={getCumplimientoClassName(correlativa.cumpleParaRendir)}>
                    {getCumplimientoLabel(correlativa.cumpleParaRendir)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}