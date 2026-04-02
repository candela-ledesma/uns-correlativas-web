"use client";

import { ButtonHTMLAttributes } from "react";
import { Materia } from "../app/types/plan";
import { EstadoMateria } from "../lib/evaluarCorrelativas";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  materia: Materia;
  estado: EstadoMateria;
  habilitada: boolean;
  bloqueada: boolean;
  onClick: () => void;
};

function getEstadoLabel(estado: EstadoMateria, bloqueada: boolean) {
  if (estado === "aprobada") return "Aprobada";
  if (estado === "cursada") return "Cursada";
  if (bloqueada) return "Bloqueada";
  return "Disponible";
}

function getCardStyles(
  estado: EstadoMateria,
  habilitada: boolean,
  bloqueada: boolean
) {
  if (bloqueada) {
    return {
      backgroundColor: "#f1f1f1",
      borderColor: "#dddddd",
      opacity: 0.75,
    };
  }

  if (estado === "aprobada") {
    return {
      backgroundColor: "#dff7df",
      borderColor: "#9fd69f",
      opacity: 1,
    };
  }

  if (estado === "cursada") {
    return {
      backgroundColor: "#e3efff",
      borderColor: "#a9c5f5",
      opacity: 1,
    };
  }

  if (habilitada) {
    return {
      backgroundColor: "#fff6cc",
      borderColor: "#e7d78a",
      opacity: 1,
    };
  }

  return {
    backgroundColor: "#ffffff",
    borderColor: "#dddddd",
    opacity: 1,
  };
}

function getBadgeStyles(estado: EstadoMateria, bloqueada: boolean) {
  if (estado === "aprobada") {
    return {
      backgroundColor: "#bde8bd",
      color: "#1f5f1f",
    };
  }

  if (estado === "cursada") {
    return {
      backgroundColor: "#cfe0ff",
      color: "#1f4d8f",
    };
  }

  if (bloqueada) {
    return {
      backgroundColor: "#e2e2e2",
      color: "#666666",
    };
  }

  return {
    backgroundColor: "#f6e7a8",
    color: "#6b5600",
  };
}

export default function MateriaCard({
  materia,
  estado,
  habilitada,
  bloqueada,
  onClick,
  ...rest
}: Props) {
  const estadoLabel = getEstadoLabel(estado, bloqueada);
  const cardStyles = getCardStyles(estado, habilitada, bloqueada);
  const badgeStyles = getBadgeStyles(estado, bloqueada);

  const ariaLabel = `${materia.nombre}. Código ${materia.id}. Estado ${estadoLabel}. ${
    materia.horas ? `Carga horaria ${materia.horas} horas.` : ""
  }`;

  return (
    <button
      {...rest}
      type="button"
      onClick={bloqueada ? undefined : onClick}
      disabled={bloqueada}
      aria-label={ariaLabel}
      style={{
        border: `1px solid ${cardStyles.borderColor}`,
        borderRadius: "16px",
        padding: "16px",
        backgroundColor: cardStyles.backgroundColor,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        textAlign: "left",
        cursor: bloqueada ? "not-allowed" : "pointer",
        width: "100%",
        opacity: cardStyles.opacity,
        transition:
          "transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease",
      }}
      onMouseEnter={(e) => {
        if (!bloqueada) {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.08)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = "3px solid #1d4ed8";
        e.currentTarget.style.outlineOffset = "2px";
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "none";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: "16px",
              lineHeight: 1.3,
              color: "#1f1f1f",
              marginBottom: "8px",
              textWrap: "balance",
            }}
          >
            {materia.nombre}
          </div>

          <div
            style={{
              fontSize: "14px",
              color: "#555",
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <span>Código {materia.id}</span>
            {materia.horas && <span>• {materia.horas} hs</span>}
          </div>
        </div>

        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            whiteSpace: "nowrap",
            borderRadius: "999px",
            padding: "6px 10px",
            fontSize: "12px",
            fontWeight: 700,
            ...badgeStyles,
          }}
        >
          {estadoLabel}
        </span>
      </div>
    </button>
  );
}