"use client";

import { Materia } from "../app/types/plan";


type EstadoMateria = "no_cursada" | "cursada" | "aprobada";

type Props = {
  materia: Materia;
  estado: EstadoMateria;
  habilitada: boolean;
  bloqueada: boolean;
  onClick: () => void;
};

export default function MateriaCard({
  materia,
  estado,
  habilitada,
  bloqueada,
  onClick,
}: Props) {
  let backgroundColor = "#fff";
  let opacity = 1;

  if (bloqueada) {
    backgroundColor = "#e5e5e5";
    opacity = 0.6;
  } else if (estado === "aprobada") {
    backgroundColor = "#c8f7c5";
  } else if (estado === "cursada") {
    backgroundColor = "#cfe3ff";
  } else if (habilitada) {
    backgroundColor = "#fff3b0";
  }

  return (
    <button
      onClick={bloqueada ? undefined : onClick}
      disabled={bloqueada}
      style={{
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "14px",
        backgroundColor,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        textAlign: "left",
        cursor: bloqueada ? "not-allowed" : "pointer",
        width: "100%",
        opacity,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: "6px" }}>{materia.nombre}</div>
      <div style={{ fontSize: "14px", color: "#555" }}>Código: {materia.id}</div>

      {materia.horas && (
        <div style={{ fontSize: "14px", color: "#555", marginTop: "4px" }}>
          Carga horaria: {materia.horas} hs
        </div>
      )}
    </button>
  );
}