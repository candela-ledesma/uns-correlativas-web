"use client";

import { ButtonHTMLAttributes } from "react";
import { Materia } from "../app/types/plan";
import { EstadoMateria } from "../lib/evaluarCorrelativas";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  materia: Materia;
  estado: EstadoMateria;
  puedeCursar: boolean;
  puedeAprobar: boolean;
  puedeClickear: boolean;
  bloqueada: boolean;
  onClick: () => void;
};

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

  if (!puedeClickear) {
    return `${base} cursor-not-allowed border-zinc-200 bg-zinc-100 opacity-75`;
  }

  if (estado === "aprobada") {
    return `${base} cursor-pointer border-green-300 bg-green-100 hover:-translate-y-0.5 hover:shadow-md`;
  }

  if (estado === "cursada") {
    return `${base} cursor-pointer border-blue-300 bg-blue-100 hover:-translate-y-0.5 hover:shadow-md`;
  }

  if (bloqueada) {
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
  onClick,
  ...rest
}: Props) {
  const estadoLabel = getEstadoLabel(estado, bloqueada, puedeAprobar);

  const ariaLabel = `${materia.nombre}. Código ${materia.id}. Estado ${estadoLabel}. ${
    materia.horas ? `Carga horaria ${materia.horas} horas.` : ""
  }`;

  return (
    <button
      {...rest}
      type="button"
      onClick={puedeClickear ? onClick : undefined}
      disabled={!puedeClickear}
      aria-label={ariaLabel}
      className={getCardClassName(
        estado,
        puedeCursar,
        bloqueada,
        puedeClickear
      )}
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
    </button>
  );
}