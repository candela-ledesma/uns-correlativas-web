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

export function estaHabilitada(
  materia: Materia,
  estados: Record<string, EstadoMateria>,
  materias: Materia[]
) {
  const correlativas = materia.correlativas || {};

  for (const corId of Object.keys(correlativas)) {
    const requisito = correlativas[corId];

    const esAgrupador = materias.some((m) => m.grupo_opcion === corId);

    const estado = esAgrupador
      ? estadoAgrupador(corId, materias, estados)
      : (estados[corId] || "no_cursada");

    if (!cumpleNivel(estado, requisito.para_cursar)) {
      return false;
    }
  }

  return true;
}