import { describe, expect, it } from "vitest";

import {
  evaluarRequisitoEspecial,
  generarBadgeRequisito,
  generarTextoRequisito,
  type RequisitoEspecialType,
} from "@/lib/plan/requisitoEspecial";
import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";

describe("evaluarRequisitoEspecial", () => {
  const estados: Record<string, EstadoMateria> = {
    "1001": "aprobada",
  };

  it("marca prueba_idioma como cumplida", () => {
    const requisito: RequisitoEspecialType = { tipo: "prueba_idioma" };
    const resultado = evaluarRequisitoEspecial(requisito, estados, 5);

    expect(resultado.cumple).toBe(true);
    expect(resultado.detalles.tipo).toBe("prueba_idioma");
    expect(resultado.detalles.mensaje).toContain("Prueba de Suficiencia de Idioma");
  });

  it("evalúa minimo_materias_aprobadas con actual y requerido", () => {
    const requisito: RequisitoEspecialType = {
      tipo: "minimo_materias_aprobadas",
      cantidad: 4,
    };

    const cumple = evaluarRequisitoEspecial(requisito, estados, 4);
    const noCumple = evaluarRequisitoEspecial(requisito, estados, 3);

    expect(cumple.cumple).toBe(true);
    expect(cumple.detalles.actual).toBe(4);
    expect(cumple.detalles.requerido).toBe(4);

    expect(noCumple.cumple).toBe(false);
    expect(noCumple.detalles.actual).toBe(3);
    expect(noCumple.detalles.requerido).toBe(4);
  });

  it("devuelve no_cumple para requisitos pendientes de validación manual", () => {
    const requisitos: RequisitoEspecialType[] = [
      { tipo: "anio_aprobado", anio: 3 },
      { tipo: "cuatrimestre_cursado", anio: 2, cuatrimestre: 1 },
      { tipo: "todas_materias_aprobadas" },
      { tipo: "cgcb_aprobado" },
      { tipo: "minimo_examenes_finales", cantidad: 6 },
    ];

    for (const req of requisitos) {
      const resultado = evaluarRequisitoEspecial(req, estados, 0);
      expect(resultado.cumple).toBe(false);
      expect(resultado.detalles.tipo).toBe(req.tipo);
      expect(resultado.detalles.mensaje.length).toBeGreaterThan(0);
    }
  });
});

describe("generarTextoRequisito", () => {
  it("prioriza descripción explícita", () => {
    const requisito: RequisitoEspecialType = {
      tipo: "cgcb_aprobado",
      descripcion: "Texto personalizado",
    };

    expect(generarTextoRequisito(requisito)).toBe("Texto personalizado");
  });

  it("usa nombre ordinal conocido para anio_aprobado", () => {
    const requisito: RequisitoEspecialType = { tipo: "anio_aprobado", anio: 2 };
    expect(generarTextoRequisito(requisito)).toContain("Segundo Año");
  });

  it("usa fallback ordinal para años fuera de catálogo", () => {
    const requisito: RequisitoEspecialType = { tipo: "anio_aprobado", anio: 8 };
    expect(generarTextoRequisito(requisito)).toContain("8° Año");
  });

  it("incorpora datos del resultado para mínimos", () => {
    const requisitoMaterias: RequisitoEspecialType = {
      tipo: "minimo_materias_aprobadas",
      cantidad: 10,
    };

    const resultadoMaterias = evaluarRequisitoEspecial(requisitoMaterias, {}, 7);
    expect(generarTextoRequisito(requisitoMaterias, resultadoMaterias)).toContain(
      "actualmente: 7"
    );

    const requisitoFinales: RequisitoEspecialType = {
      tipo: "minimo_examenes_finales",
      cantidad: 4,
    };
    const resultadoFinales = evaluarRequisitoEspecial(requisitoFinales, {}, 0);
    expect(generarTextoRequisito(requisitoFinales, resultadoFinales)).toContain(
      "4 exámenes finales"
    );
  });

  it("renderiza cuatrimestre_cursado con etiquetas humanas", () => {
    const requisito: RequisitoEspecialType = {
      tipo: "cuatrimestre_cursado",
      anio: 4,
      cuatrimestre: 2,
    };

    const texto = generarTextoRequisito(requisito);
    expect(texto).toContain("segundo cuatrimestre");
    expect(texto).toContain("Cuarto Año");
  });
});

describe("generarBadgeRequisito", () => {
  it("expone texto y bandera coherentes", () => {
    const badgeCumple = generarBadgeRequisito({
      cumple: true,
      detalles: { tipo: "cgcb_aprobado", mensaje: "ok" },
    });

    const badgeNoCumple = generarBadgeRequisito({
      cumple: false,
      detalles: { tipo: "cgcb_aprobado", mensaje: "pendiente" },
    });

    expect(badgeCumple).toEqual({ texto: "Cumple", cumple: true });
    expect(badgeNoCumple).toEqual({ texto: "No cumple", cumple: false });
  });
});
