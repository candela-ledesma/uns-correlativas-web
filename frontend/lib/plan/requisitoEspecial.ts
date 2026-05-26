import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";

/**
 * Tipos de requisitos especiales que una materia puede tener.
 * Cada tipo es estructurado y sin información redundante.
 */
export type RequisitoEspecialType =
  | {
      tipo: "prueba_idioma";
      materiaId?: string;
      descripcion?: string;
    }
  | {
      tipo: "minimo_materias_aprobadas";
      cantidad: number;
      descripcion?: string;
    }
  | {
      tipo: "anio_aprobado";
      anio: number;
      descripcion?: string;
    }
  | {
      tipo: "cuatrimestre_cursado";
      anio: number;
      cuatrimestre: number;
      descripcion?: string;
    }
  | {
      tipo: "todas_materias_aprobadas";
      descripcion?: string;
    }
  | {
      tipo: "cgcb_aprobado";
      descripcion?: string;
    }
  | {
      tipo: "minimo_examenes_finales";
      cantidad: number;
      descripcion?: string;
    };

/**
 * Resultado de evaluar un requisito especial contra el estado actual.
 */
export type ResultadoRequisito = {
  cumple: boolean;
  detalles: {
    tipo: RequisitoEspecialType["tipo"];
    mensaje: string;
    /** Para minimo_materias_aprobadas: número actual de aprobadas */
    actual?: number;
    /** Para minimo_materias_aprobadas: cantidad requerida */
    requerido?: number;
    /** Para anio_aprobado: año requerido */
    anio?: number;
  };
};

/**
 * Evalúa un requisito especial contra el estado actual de materias.
 *
 * @param requisito - El requisito a evaluar
 * @param estadosPorMateria - Record de estados actuales
 * @param todasLasMateriasAprobadas - Total de materias aprobadas
 * @returns Resultado de la evaluación
 */
export function evaluarRequisitoEspecial(
  requisito: RequisitoEspecialType,
  estadosPorMateria: Record<string, EstadoMateria>,
  todasLasMateriasAprobadas: number
): ResultadoRequisito {
  if (requisito.tipo === "prueba_idioma") {
    // La prueba de idioma se considera cumplida simplemente si existe el requisito
    // (El usuario debe verificar manualmente si realizó la prueba)
    return {
      cumple: true, // Se asume que si llegó aquí, debe rendirla
      detalles: {
        tipo: "prueba_idioma",
        mensaje: `Debe aprobar la Prueba de Suficiencia de Idioma`,
      },
    };
  }

  if (requisito.tipo === "minimo_materias_aprobadas") {
    const cumple = todasLasMateriasAprobadas >= requisito.cantidad;
    return {
      cumple,
      detalles: {
        tipo: "minimo_materias_aprobadas",
        mensaje: `${todasLasMateriasAprobadas} de ${requisito.cantidad} materias aprobadas`,
        actual: todasLasMateriasAprobadas,
        requerido: requisito.cantidad,
      },
    };
  }

  if (requisito.tipo === "anio_aprobado") {
    return {
      cumple: false,
      detalles: {
        tipo: "anio_aprobado",
        mensaje: `Se requiere tener el año ${requisito.anio} completo/aprobado`,
        anio: requisito.anio,
      },
    };
  }

  if (requisito.tipo === "cuatrimestre_cursado") {
    return {
      cumple: false,
      detalles: {
        tipo: "cuatrimestre_cursado",
        mensaje: `Se requiere tener el ${requisito.cuatrimestre}° cuatrimestre del año ${requisito.anio} cursado`,
        anio: requisito.anio,
      },
    };
  }

  if (requisito.tipo === "todas_materias_aprobadas") {
    return {
      cumple: false,
      detalles: {
        tipo: "todas_materias_aprobadas",
        mensaje: "Se requiere tener todas las materias del plan aprobadas",
      },
    };
  }

  if (requisito.tipo === "cgcb_aprobado") {
    return {
      cumple: false,
      detalles: {
        tipo: "cgcb_aprobado",
        mensaje: "Se requiere tener aprobado el CGCB",
      },
    };
  }

  if (requisito.tipo === "minimo_examenes_finales") {
    return {
      cumple: false,
      detalles: {
        tipo: "minimo_examenes_finales",
        mensaje: `Se requiere tener ${requisito.cantidad} exámenes finales aprobados`,
        requerido: requisito.cantidad,
      },
    };
  }

  // TypeScript exhaustiveness check
  const _exhaustive: never = requisito;
  return _exhaustive;
}

/**
 * Genera el texto a mostrar para un requisito especial.
 * Usa información tipada para construir una descripción legible.
 */
export function generarTextoRequisito(
  requisito: RequisitoEspecialType,
  resultado?: ResultadoRequisito
): string {
  if (requisito.descripcion) return requisito.descripcion;

  if (requisito.tipo === "prueba_idioma") {
    return "Debe rendir la Prueba de Suficiencia de Idioma antes de aprobar";
  }

  if (requisito.tipo === "minimo_materias_aprobadas") {
    if (resultado) {
      const { actual, requerido } = resultado.detalles;
      return `Se requiere tener al menos ${requerido} materias aprobadas (actualmente: ${actual})`;
    }
    return `Se requiere tener al menos ${requisito.cantidad} materias aprobadas`;
  }

  if (requisito.tipo === "anio_aprobado") {
    const nombres = ["", "Primer", "Segundo", "Tercer", "Cuarto", "Quinto", "Sexto"];
    const label = nombres[requisito.anio] ?? `${requisito.anio}°`;
    return `Se requiere tener el ${label} Año aprobado`;
  }

  if (requisito.tipo === "cuatrimestre_cursado") {
    const nombresAnio = ["", "Primer", "Segundo", "Tercer", "Cuarto", "Quinto", "Sexto"];
    const labelAnio = nombresAnio[requisito.anio] ?? `${requisito.anio}°`;
    const labelCuatri = requisito.cuatrimestre === 1 ? "primer" : "segundo";
    return `Se requiere tener el ${labelCuatri} cuatrimestre del ${labelAnio} Año cursado`;
  }

  if (requisito.tipo === "todas_materias_aprobadas") {
    return "Se requiere tener todas las materias del plan aprobadas";
  }

  if (requisito.tipo === "cgcb_aprobado") {
    return "Se requiere tener aprobado el CGCB";
  }

  if (requisito.tipo === "minimo_examenes_finales") {
    if (resultado) {
      const { requerido } = resultado.detalles;
      return `Se requiere haber aprobado ${requerido} exámenes finales`;
    }
    return `Se requiere haber aprobado ${requisito.cantidad} exámenes finales`;
  }

  return "Requisito especial desconocido";
}

/**
 * Genera el badge/estado visual para un requisito.
 * Útil para mostrar "Cumple" / "No cumple"
 */
export function generarBadgeRequisito(resultado: ResultadoRequisito): {
  texto: string;
  cumple: boolean;
} {
  return {
    texto: resultado.cumple ? "Cumple" : "No cumple",
    cumple: resultado.cumple,
  };
}

