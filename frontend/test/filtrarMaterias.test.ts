import { describe, expect, it } from "vitest";
import type { Agrupador, Materia } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";
import {
  filtrarMaterias,
  normalizarTextoBusqueda,
  type FiltrosPlan,
} from "@/lib/plan/filtrarMaterias";

function crearMateria(
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

function crearFixture() {
  const materias: Materia[] = [
    crearMateria("TRONCO", "ESTABILIDAD I"),
    crearMateria("HIDRO_TRONCO", "HIDRAULICA AGRICOLA E HIDROLOGIA", {
      año: "Cuarto Año",
      cuatrimestre: "Primer Cuatrimestre",
      orientacion: "Hidráulica",
    }),
    crearMateria("GCONSTR", "Optativa Construcciones", {
      tipo: "agrupador_requisito",
      año: "Cuarto Año",
      cuatrimestre: "Segundo Cuatrimestre",
    }),
    crearMateria("GHID", "Optativa Hidráulica", {
      tipo: "agrupador_requisito",
      año: "Cuarto Año",
      cuatrimestre: "Segundo Cuatrimestre",
    }),
    crearMateria("I0012", "Idioma de Ingeniería Civil", {
      tipo: "agrupador_requisito",
      año: "Tercer Año",
      cuatrimestre: "Segundo Cuatrimestre",
    }),
    crearMateria("OPT_CONSTR", "Durabilidad de Estructuras", {
      categoria: "optativa",
      grupo_opcion: "GCONSTR",
      año: "Quinto Año",
      cuatrimestre: "Segundo Cuatrimestre",
    }),
    crearMateria("OPT_HID", "Diseño de Estructuras Hidráulicas", {
      categoria: "optativa",
      grupo_opcion: "GHID",
      año: "Quinto Año",
      cuatrimestre: "Segundo Cuatrimestre",
    }),
    crearMateria("MEDIO_AMBIENTE", "MEDIO AMBIENTE IC", {
      año: "Quinto Año",
      cuatrimestre: "Primer Cuatrimestre",
      orientaciones: ["Construcciones", "Vías de Comunicación"],
    }),
    crearMateria("INGLES", "Examen de Suficiencia de Inglés", {
      categoria: "optativa",
      grupo_opcion: "I0012",
      subtipo: "idioma",
      año: "Quinto Año",
      cuatrimestre: "Segundo Cuatrimestre",
    }),
  ];

  const agrupadores: Agrupador[] = [
    {
      id: "GCONSTR",
      nombre: "Optativa Construcciones",
      tipo: "optativa_grupo",
      opciones: ["OPT_CONSTR"],
      orientacion: "Construcciones",
    },
    {
      id: "GHID",
      nombre: "Optativa Hidráulica",
      tipo: "optativa_grupo",
      opciones: ["OPT_HID"],
      orientacion: "Hidráulica",
    },
    {
      id: "I0012",
      nombre: "Idioma de Ingeniería Civil",
      tipo: "idioma_grupo",
      opciones: ["INGLES"],
      orientacion: null,
    },
  ];

  const idsAgrupadores = new Set(agrupadores.map((agrupador) => agrupador.id));
  const estados: Record<string, EstadoMateria> = {};

  return {
    materias,
    agrupadores,
    idsAgrupadores,
    estados,
  };
}

function filtrarConOrientacion(orientacion: string) {
  const fixture = crearFixture();
  const filtros: FiltrosPlan = {
    codigo: "",
    anio: "todos",
    cuatrimestre: "todos",
    estado: "todas",
    orientacion,
  };

  return filtrarMaterias({
    ...fixture,
    filtros,
  });
}

describe("filtrarMaterias - orientación", () => {
  it("deja materias troncales y grupos no orientados al elegir orientación", () => {
    const resultado = filtrarConOrientacion("Construcciones");
    const ids = new Set(resultado.map((materia) => materia.id));

    expect(ids.has("TRONCO")).toBe(true);
    expect(ids.has("HIDRO_TRONCO")).toBe(false);
    expect(ids.has("GCONSTR")).toBe(true);
    expect(ids.has("OPT_CONSTR")).toBe(true);

    expect(ids.has("I0012")).toBe(true);
    expect(ids.has("INGLES")).toBe(true);

    expect(ids.has("GHID")).toBe(false);
    expect(ids.has("OPT_HID")).toBe(false);
  });

  it("acepta búsqueda sin acentos para la orientación", () => {
    const resultado = filtrarConOrientacion("hidraulica");
    const ids = new Set(resultado.map((materia) => materia.id));

    expect(ids.has("GHID")).toBe(true);
    expect(ids.has("OPT_HID")).toBe(true);
    expect(ids.has("GCONSTR")).toBe(false);
    expect(ids.has("MEDIO_AMBIENTE")).toBe(false);
  });

  it("respeta orientaciones múltiples explícitas por materia", () => {
    const construcciones = new Set(
      filtrarConOrientacion("Construcciones").map((materia) => materia.id)
    );
    const vias = new Set(
      filtrarConOrientacion("vias de comunicacion").map((materia) => materia.id)
    );

    expect(construcciones.has("MEDIO_AMBIENTE")).toBe(true);
    expect(vias.has("MEDIO_AMBIENTE")).toBe(true);
  });

  it("normaliza tildes y espacios", () => {
    expect(normalizarTextoBusqueda("  Hidráulica  ")).toBe("hidraulica");
  });
});
