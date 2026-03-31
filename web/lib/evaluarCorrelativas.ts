import { Materia } from "../app/types/plan";

export type EstadoMateria = "no_cursada" | "cursada" | "aprobada";

function cumpleNivel(estado: EstadoMateria, requisito: string | null) {
  if (!requisito) return true;

  if (requisito === "cursada") {
    return estado === "cursada" || estado === "aprobada";
  }

  if (requisito === "aprobada") {
    return estado === "aprobada";
  }

  return false;
}

export function estaHabilitada(
  materia: Materia,
  estados: Record<string, EstadoMateria>
) {
  const correlativas = materia.correlativas || {};

  for (const corId of Object.keys(correlativas)) {
    const requisito = correlativas[corId];
    const estado = estados[corId] || "no_cursada";

    if (!cumpleNivel(estado, requisito.para_cursar)) {
      return false;
    }
  }

  return true;
}