import { Agrupador, Materia } from "../app/types/plan";
import { getEstadoKey } from "@/lib/estadoKey";

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
  agrupadorId: string,
  agrupadores: Agrupador[],
  estados: Record<string, EstadoMateria>
): EstadoMateria {
  const agrupador = agrupadores.find(
    (a) => String(a.id) === String(agrupadorId)
  );

  if (!agrupador) return "no_cursada";

  const estadosOpciones = agrupador.opciones.map((id) => {
    const fakeMateria = { id: String(id) } as Materia;
    return estados[getEstadoKey(fakeMateria, agrupadorId)] || "no_cursada";
  });

  if (estadosOpciones.includes("aprobada")) return "aprobada";
  if (estadosOpciones.includes("cursada")) return "cursada";
  return "no_cursada";
}

export function estaHabilitada(
  materia: Materia,
  estados: Record<string, EstadoMateria>,
  materias: Materia[],
  agrupadores: Agrupador[],
  grupoIdRender?: string
) {
  const correlativas = materia.correlativas || {};
  const idsAgrupadores = new Set(agrupadores.map((a) => String(a.id)));

  for (const corId of Object.keys(correlativas)) {
    const requisito = correlativas[corId];
    const esAgrupador = idsAgrupadores.has(String(corId));

    const estado = esAgrupador
      ? estadoAgrupador(String(corId), agrupadores, estados)
      : (estados[String(corId)] || "no_cursada");

    if (!cumpleNivel(estado, requisito.para_cursar)) {
      return false;
    }
  }

  return true;
}