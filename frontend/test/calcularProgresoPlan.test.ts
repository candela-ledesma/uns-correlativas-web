import { describe, it, expect } from "vitest";
import type { Agrupador, Materia } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";
import { calcularProgresoPlan } from "@/lib/plan/calcularProgresoPlan";

function crearMateria(id: string, overrides: Partial<Materia> = {}): Materia {
  return {
    id,
    nombre: `Materia ${id}`,
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

const agrupadores: Agrupador[] = [
  { id: "G001", nombre: "Optativa A", tipo: "optativa_grupo", opciones: ["OPT1", "OPT2"] },
  { id: "I001", nombre: "Idioma", tipo: "idioma_grupo", opciones: ["ING1"] },
];

describe("calcularProgresoPlan", () => {
  it("devuelve ceros con estados vacíos", () => {
    const materias = [crearMateria("1"), crearMateria("2")];
    const result = calcularProgresoPlan(materias, [], {}, 0);

    expect(result).toEqual({ total: 2, aprobadas: 0, cursadas: 0, disponibles: 0 });
  });

  it("cuenta aprobadas y cursadas correctamente", () => {
    const materias = [crearMateria("1"), crearMateria("2"), crearMateria("3")];
    const estados: Record<string, EstadoMateria> = {
      "1": "aprobada",
      "2": "cursada",
    };

    const result = calcularProgresoPlan(materias, [], estados, 5);

    expect(result.total).toBe(3);
    expect(result.aprobadas).toBe(1);
    expect(result.cursadas).toBe(1);
    expect(result.disponibles).toBe(5);
  });

  it("excluye materias optativas (categoria=optativa) del total", () => {
    const materias = [
      crearMateria("1"),
      crearMateria("OPT1", { categoria: "optativa", grupo_opcion: "G001" }),
      crearMateria("OPT2", { categoria: "optativa", grupo_opcion: "G001" }),
    ];
    const estados: Record<string, EstadoMateria> = { "OPT1": "aprobada" };

    const result = calcularProgresoPlan(materias, agrupadores, estados, 0);

    expect(result.total).toBe(1);
    expect(result.aprobadas).toBe(0);
  });

  it("cuenta un agrupador como aprobado cuando alguna opción está aprobada", () => {
    const materias = [
      crearMateria("G001", { tipo: "agrupador_requisito" }),
      crearMateria("OPT1", { categoria: "optativa", grupo_opcion: "G001" }),
      crearMateria("OPT2", { categoria: "optativa", grupo_opcion: "G001" }),
    ];
    const estados: Record<string, EstadoMateria> = { "G001::OPT1": "aprobada" };

    const result = calcularProgresoPlan(materias, agrupadores, estados, 0);

    expect(result.total).toBe(1);
    expect(result.aprobadas).toBe(1);
    expect(result.cursadas).toBe(0);
  });

  it("cuenta un agrupador como cursado cuando alguna opción está cursada", () => {
    const materias = [
      crearMateria("G001", { tipo: "agrupador_requisito" }),
      crearMateria("OPT1", { categoria: "optativa", grupo_opcion: "G001" }),
    ];
    const estados: Record<string, EstadoMateria> = { "G001::OPT1": "cursada" };

    const result = calcularProgresoPlan(materias, agrupadores, estados, 0);

    expect(result.aprobadas).toBe(0);
    expect(result.cursadas).toBe(1);
  });

  it("plan completamente aprobado", () => {
    const materias = [crearMateria("1"), crearMateria("2"), crearMateria("3")];
    const estados: Record<string, EstadoMateria> = {
      "1": "aprobada",
      "2": "aprobada",
      "3": "aprobada",
    };

    const result = calcularProgresoPlan(materias, [], estados, 0);

    expect(result.total).toBe(3);
    expect(result.aprobadas).toBe(3);
    expect(result.cursadas).toBe(0);
  });

  it("plan vacío devuelve ceros", () => {
    const result = calcularProgresoPlan([], [], {}, 0);
    expect(result).toEqual({ total: 0, aprobadas: 0, cursadas: 0, disponibles: 0 });
  });

  it("propaga el valor de disponibles sin modificarlo", () => {
    const result = calcularProgresoPlan([], [], {}, 42);
    expect(result.disponibles).toBe(42);
  });
});
