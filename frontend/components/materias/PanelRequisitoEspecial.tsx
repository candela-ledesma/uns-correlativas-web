import type { RequisitoEspecialType } from "@/lib/plan/requisitoEspecial";
import {
  evaluarRequisitoEspecial,
  generarTextoRequisito,
  generarBadgeRequisito,
} from "@/lib/plan/requisitoEspecial";
import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";
import { contarMateriasCompletadas } from "@/lib/plan/evaluarCorrelativas";
import { TEXT, TEXT_SEC } from "@/lib/ui/tokens";
import { correlativaBadgeStyle } from "@/lib/ui/cardStyles";

type Props = {
  requisito: RequisitoEspecialType;
  estados: Record<string, EstadoMateria>;
};

/**
 * Componente para mostrar un requisito especial.
 * Genera el texto desde el frontend basándose en el tipo de requisito.
 */
export default function PanelRequisitoEspecial({ requisito, estados }: Props) {
  // Contar materias aprobadas para evaluar mínimos
  const { aprobadas } = contarMateriasCompletadas(estados);

  // Evaluar el requisito contra el estado actual
  const resultado = evaluarRequisitoEspecial(requisito, estados, aprobadas);
  const badge = generarBadgeRequisito(resultado);
  const texto = generarTextoRequisito(requisito, resultado);

  return (
    <div
      style={{
        marginTop: 10,
        color: TEXT_SEC,
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ color: TEXT }}>Requisito especial:</strong> {texto}

      {requisito.tipo === "minimo_materias_aprobadas" && (
        <div style={{ marginTop: 4, fontSize: 11 }}>
          <div>
            Estado: {resultado.detalles.actual} aprobadas (requiere{" "}
            {resultado.detalles.requerido})
          </div>
          <div style={{ marginTop: 2 }}>
            Para cursar:
            <span style={correlativaBadgeStyle(resultado.cumple)}>
              {badge.texto}
            </span>
          </div>
        </div>
      )}

      {requisito.tipo === "prueba_idioma" && (
        <div style={{ marginTop: 4, fontSize: 11 }}>
          <div>
            Esta materia requiere que apruebes la prueba antes de poder
            calificar.
          </div>
        </div>
      )}
    </div>
  );
}
