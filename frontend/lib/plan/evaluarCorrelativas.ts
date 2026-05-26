import { Agrupador, Materia } from "@/app/types/plan";
import { getEstadoKey } from "@/lib/plan/estadoKey";

export type EstadoMateria = "no_cursada" | "cursada" | "aprobada";

type TipoCorrelativa = "para_cursar" | "para_rendir";

const ESTADO_SCORE: Record<EstadoMateria, number> = {
  no_cursada: 0,
  cursada: 1,
  aprobada: 2,
};

function getMateriaIdFromEstadoKey(estadoKey: string) {
  if (!estadoKey.includes("::")) return estadoKey;
  const parts = estadoKey.split("::");
  return parts[parts.length - 1] || estadoKey;
}

function mergeEstado(actual: EstadoMateria, siguiente: EstadoMateria) {
  return ESTADO_SCORE[siguiente] > ESTADO_SCORE[actual] ? siguiente : actual;
}

export function getEstadoMaximoPorMateria(
  estados: Record<string, EstadoMateria>
) {
  const estadoPorMateria = new Map<string, EstadoMateria>();

  Object.entries(estados).forEach(([estadoKey, estado]) => {
    const materiaId = String(getMateriaIdFromEstadoKey(estadoKey));
    const previo = estadoPorMateria.get(materiaId) ?? "no_cursada";
    estadoPorMateria.set(materiaId, mergeEstado(previo, estado));
  });

  return estadoPorMateria;
}

export function getEstadoMateriaPorId(
  materiaId: string,
  estados: Record<string, EstadoMateria>
): EstadoMateria {
  return getEstadoMaximoPorMateria(estados).get(String(materiaId)) ?? "no_cursada";
}

export function contarMateriasCompletadas(
  estados: Record<string, EstadoMateria>
) {
  const estadoPorMateria = getEstadoMaximoPorMateria(estados);

  let aprobadas = 0;
  let cursadas = 0;

  estadoPorMateria.forEach((estado) => {
    if (estado === "aprobada") {
      aprobadas += 1;
      return;
    }

    if (estado === "cursada") {
      cursadas += 1;
    }
  });

  return { aprobadas, cursadas };
}

export function cumpleNivel(estado: EstadoMateria, requisito: string | null) {
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

export function cumpleCorrelativas(
  materia: Materia,
  estados: Record<string, EstadoMateria>,
  agrupadores: Agrupador[],
  tipo: TipoCorrelativa
) {
  const correlativas = materia.correlativas || {};
  const idsAgrupadores = new Set(agrupadores.map((a) => String(a.id)));

  for (const corId of Object.keys(correlativas)) {
    const requisito = correlativas[corId];
    const esAgrupador = idsAgrupadores.has(String(corId));

    const estado = esAgrupador
      ? estadoAgrupador(String(corId), agrupadores, estados)
      : getEstadoMateriaPorId(String(corId), estados);

    if (!cumpleNivel(estado, requisito[tipo])) {
      return false;
    }
  }

  for (const req of materia.requisito_especial ?? []) {
    if (req.tipo === "minimo_materias_aprobadas") {
      const { aprobadas } = contarMateriasCompletadas(estados);
      if (aprobadas < req.cantidad) return false;
    }
  }

  return true;
}

export function estaHabilitadaParaCursar(
  materia: Materia,
  estados: Record<string, EstadoMateria>,
  agrupadores: Agrupador[]
) {
  return cumpleCorrelativas(materia, estados, agrupadores, "para_cursar");
}

export function estaHabilitadaParaAprobar(
  materia: Materia,
  estados: Record<string, EstadoMateria>,
  agrupadores: Agrupador[]
) {
  return cumpleCorrelativas(materia, estados, agrupadores, "para_rendir");
}
