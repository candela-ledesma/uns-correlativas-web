"use client";

import { normalizarTextoBusqueda } from "@/lib/filtrarMaterias";

type Props = {
  orientaciones: string[];
  selected: string;
  onSelect: (orientacion: string) => void;
};

function buildOrientationTestId(value: string) {
  const normalized = normalizarTextoBusqueda(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "todas";
}

export default function OrientationSelector({
  orientaciones,
  selected,
  onSelect,
}: Props) {
  if (orientaciones.length === 0) return null;

  const options = ["todas", ...orientaciones];

  return (
    <section
      data-testid="orientacion-selector"
      className="mb-6 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-4 shadow-sm"
    >
      <div className="mb-3 text-sm font-semibold text-sky-900">
        Elegi una orientacion para ver tus optativas
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = selected === option;
          const label = option === "todas" ? "Todas" : option;

          return (
            <button
              key={option}
              type="button"
              data-testid={`orientacion-option-${buildOrientationTestId(option)}`}
              aria-pressed={isActive}
              onClick={() => onSelect(option)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border-sky-700 bg-sky-700 text-white"
                  : "border-zinc-300 bg-white text-zinc-800 hover:border-sky-300 hover:bg-sky-50"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
