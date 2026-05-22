import { describe, expect, it } from "vitest";

import type { Agrupador, Materia } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";
import { calcularProgresoPlan } from "@/lib/plan/calcularProgresoPlan";
import { obtenerCorrelativasMateria } from "@/lib/plan/correlativasMateria";

function materiaBase(
  id: string,
  nombre: string,
  overrides: Partial<Materia> = {}
): Materia {
  return {
    id,
    nombre,
    año: "Primer Año",
    cuatrimestre: "Primer Cuatrimestre",
    horas: "64",
    tipo: "materia",
    categoria: "normal",
    grupo_opcion: null,
    subtipo: null,
    correlativas: {},
    ...overrides,
  };
}

describe("obtenerCorrelativasMateria", () => {
  it("resuelve nombre, estado y cumplimiento para materias y agrupadores", () => {
    const materias: Materia[] = [
      materiaBase("A1", "Álgebra"),
      materiaBase("MAT_DESTINO", "Proyecto", {
        correlativas: {
          A1: { para_cursar: "cursada", para_rendir: "aprobada" },
          G100: { para_cursar: "aprobada", para_rendir: "aprobada" },
          "9999": { para_cursar: null, para_rendir: "cursada" },
        },
      }),
    ];

    const agrupadores: Agrupador[] = [
      {
        id: "G100",
        nombre: "Grupo Idioma",
        tipo: "idioma_grupo",
        opciones: ["OPT1"],
      },
    ];

    const estados: Record<string, EstadoMateria> = {
      "X::A1": "aprobada",
      "G100::OPT1": "aprobada",
    };

    const resultado = obtenerCorrelativasMateria(
      materias[1],
      materias,
      agrupadores,
      estados
    );

    expect(resultado).toHaveLength(3);

    expect(resultado.map((item) => item.id)).toEqual(["A1", "G100", "9999"]);

    expect(resultado[0]).toMatchObject({
      id: "A1",
      nombre: "Álgebra",
      esAgrupador: false,
      estadoActual: "aprobada",
      cumpleParaCursar: true,
      cumpleParaRendir: true,
    });

    expect(resultado[1]).toMatchObject({
      id: "G100",
      nombre: "Grupo Idioma",
      esAgrupador: true,
      estadoActual: "aprobada",
      cumpleParaCursar: true,
      cumpleParaRendir: true,
    });

    expect(resultado[2]).toMatchObject({
      id: "9999",
      nombre: "Materia 9999",
      esAgrupador: false,
      estadoActual: "no_cursada",
      cumpleParaCursar: true,
      cumpleParaRendir: false,
    });
  });
});

describe("calcularProgresoPlan", () => {
  it("excluye optativas de grupo del total y computa agrupadores por estado agregado", () => {
    const materias: Materia[] = [
      materiaBase("M1", "Materia 1"),
      materiaBase("M2", "Materia 2"),
      materiaBase("G100", "Grupo Idioma", {
        tipo: "agrupador_requisito",
      }),
      materiaBase("OPT1", "Inglés", {
        categoria: "optativa",
        grupo_opcion: "G100",
      }),
    ];

    const agrupadores: Agrupador[] = [
      {
        id: "G100",
        nombre: "Grupo Idioma",
        tipo: "idioma_grupo",
        opciones: ["OPT1"],
      },
    ];

    const estados: Record<string, EstadoMateria> = {
      M1: "aprobada",
      M2: "cursada",
      "G100::OPT1": "aprobada",
    };

    const progreso = calcularProgresoPlan(materias, agrupadores, estados, 7);

    expect(progreso).toEqual({
      total: 3,
      aprobadas: 2,
      cursadas: 1,
      disponibles: 7,
    });
  });

  it("marca agrupador como cursada si no hay opciones aprobadas", () => {
    const materias: Materia[] = [
      materiaBase("G200", "Optativa", { tipo: "agrupador_requisito" }),
      materiaBase("OPT2", "Optativa 2", {
        categoria: "optativa",
        grupo_opcion: "G200",
      }),
    ];

    const agrupadores: Agrupador[] = [
      {
        id: "G200",
        nombre: "Optativa",
        tipo: "optativa_grupo",
        opciones: ["OPT2"],
      },
    ];

    const estados: Record<string, EstadoMateria> = {
      "G200::OPT2": "cursada",
    };

    const progreso = calcularProgresoPlan(materias, agrupadores, estados, 0);

    expect(progreso.total).toBe(1);
    expect(progreso.aprobadas).toBe(0);
    expect(progreso.cursadas).toBe(1);
  });
});
