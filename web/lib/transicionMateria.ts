import type { Agrupador, Materia } from "@/app/types/plan";
import {
  EstadoMateria,
  estaHabilitadaParaAprobar,
  estaHabilitadaParaCursar,
} from "@/lib/evaluarCorrelativas";

type ResultadoTransicion = {
  siguienteEstado: EstadoMateria;
  puedeInteractuar: boolean;
};

export function obtenerSiguienteEstadoMateria(
  materia: Materia,
  estadoActual: EstadoMateria,
  estados: Record<string, EstadoMateria>,
  materias: Materia[],
  agrupadores: Agrupador[],
  grupoId?: string
): ResultadoTransicion {
  if (estadoActual === "no_cursada") {
    const puedeCursar = estaHabilitadaParaCursar(
      materia,
      estados,
      materias,
      agrupadores,
      grupoId
    );

    return {
      siguienteEstado: puedeCursar ? "cursada" : "no_cursada",
      puedeInteractuar: puedeCursar,
    };
  }

  if (estadoActual === "cursada") {
    const puedeAprobar = estaHabilitadaParaAprobar(
      materia,
      estados,
      materias,
      agrupadores,
      grupoId
    );

    return {
      siguienteEstado: puedeAprobar ? "aprobada" : "cursada",
      puedeInteractuar: true,
    };
  }

  return {
    siguienteEstado: "no_cursada",
    puedeInteractuar: true,
  };
}