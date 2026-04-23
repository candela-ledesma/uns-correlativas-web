"use client";

import { normalizarTextoBusqueda } from "@/lib/filtrarMaterias";

import { TEXT, TEXT_SEC, SURFACE, ACCENT as PURPLE } from "@/lib/tokens";

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

export default function OrientationSelector({ orientaciones, selected, onSelect }: Props) {
  if (orientaciones.length === 0) return null;

  const options = ["todas", ...orientaciones];

  return (
    <section
      data-testid="orientacion-selector"
      style={{ ...SURFACE, borderRadius: 16, padding: 16, marginBottom: 24 }}
    >
      <div style={{ color: TEXT_SEC, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
        Elegí una orientación para ver tus optativas
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const isActive = selected === option;
          const label    = option === "todas" ? "Todas" : option;

          return (
            <button
              key={option}
              type="button"
              data-testid={`orientacion-option-${buildOrientationTestId(option)}`}
              aria-pressed={isActive}
              onClick={() => onSelect(option)}
              style={
                isActive
                  ? { background: `${PURPLE}30`, border: `1px solid ${PURPLE}88`, color: TEXT, borderRadius: 99, padding: "8px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }
                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: TEXT_SEC, borderRadius: 99, padding: "8px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }
              }
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
