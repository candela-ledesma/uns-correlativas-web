import { Materia } from "@/app/types/plan";
import { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";

export function siguienteEstado(actual: EstadoMateria): EstadoMateria {
  if (actual === "no_cursada") return "cursada";
  if (actual === "cursada") return "aprobada";
  return "aprobada";
}

export function resetEstado(): EstadoMateria {
  return "no_cursada";
}

export function estadoAgrupador(
  idGrupo: string,
  materias: Materia[],
  estados: Record<string, EstadoMateria>
): EstadoMateria {
  const opciones = materias.filter((m) => m.grupo_opcion === idGrupo);

  const algunaAprobada = opciones.some(
    (m) => (estados[m.id] || "no_cursada") === "aprobada"
  );
  if (algunaAprobada) return "aprobada";

  const algunaCursada = opciones.some(
    (m) => (estados[m.id] || "no_cursada") === "cursada"
  );
  if (algunaCursada) return "cursada";

  return "no_cursada";
}