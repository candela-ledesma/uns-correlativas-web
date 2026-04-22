import { describe, it, expect } from "vitest";
import {
  estadoAgrupador,
  EstadoMateria,
  estaHabilitadaParaCursar,
} from "../lib/evaluarCorrelativas";
import type { Agrupador, Materia } from "../app/types/plan";

function estadosAprobados(ids: string[]): Record<string, EstadoMateria> {
  return Object.fromEntries(ids.map((id) => [id, "aprobada"]));
}

describe("estadoAgrupador", () => {
  const agrupadores: Agrupador[] = [
    {
      id: "I2201",
      nombre: "Idioma de Arquitectura",
      tipo: "idioma_grupo",
      opciones: ["4804"],
    },
  ];

  it("devuelve no_cursada si ninguna opción fue marcada", () => {
    const estados = {};
    expect(estadoAgrupador("I2201", agrupadores, estados)).toBe("no_cursada");
  });

  it("devuelve cursada si una opción está cursada", () => {
    const estados: Record<string, EstadoMateria> = {
      "I2201::4804": "cursada",
    };
    expect(estadoAgrupador("I2201", agrupadores, estados)).toBe("cursada");
  });

  it("devuelve aprobada si una opción está aprobada", () => {
    const estados: Record<string, EstadoMateria> = {
      "I2201::4804": "aprobada",
    };
    expect(estadoAgrupador("I2201", agrupadores, estados)).toBe("aprobada");
  });
});

describe("estaHabilitada", () => {
  const materias: Materia[] = [
    {
      id: "8118",
      nombre: "MATEMATICA I ARQ",
      año: "Primer Año",
      cuatrimestre: "Primer Cuatrimestre",
      horas: "64",
      tipo: "materia",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: null,
      correlativas: {},
    },
    {
      id: "3059",
      nombre: "FISICA ARQ",
      año: "Primer Año",
      cuatrimestre: "Segundo Cuatrimestre",
      horas: "96",
      tipo: "materia",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: null,
      correlativas: {
        "8118": {
          para_cursar: "cursada",
          para_rendir: "aprobada",
        },
      },
    },
    {
      id: "3942",
      nombre: "TALLER DE ARQUITECTURA I",
      año: "Primer Año",
      cuatrimestre: "Anual",
      horas: "96",
      tipo: "materia",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: null,
      correlativas: {},
    },
    {
      id: "4719",
      nombre: "HISTORIA DEL ARTE Y LA CULTURA",
      año: "Primer Año",
      cuatrimestre: "Primer Cuatrimestre",
      horas: "96",
      tipo: "materia",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: null,
      correlativas: {},
    },
    {
      id: "3943",
      nombre: "TALLER DE ARQUITECTURA II",
      año: "Segundo Año",
      cuatrimestre: "Anual",
      horas: "96",
      tipo: "materia",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: null,
      correlativas: {
        "3942": {
          para_cursar: "aprobada",
          para_rendir: "aprobada",
        },
        "4719": {
          para_cursar: "cursada",
          para_rendir: "aprobada",
        },
      },
    },
    {
      id: "5488",
      nombre: "SISTEMAS DE REPRESENTACION I ARQ",
      año: "Primer Año",
      cuatrimestre: "Primer Cuatrimestre",
      horas: "96",
      tipo: "materia",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: null,
      correlativas: {},
    },
    {
      id: "5489",
      nombre: "SISTEMAS DE REPRESENTACION II ARQ",
      año: "Primer Año",
      cuatrimestre: "Segundo Cuatrimestre",
      horas: "96",
      tipo: "materia",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: null,
      correlativas: {
        "5488": {
          para_cursar: "cursada",
          para_rendir: "aprobada",
        },
      },
    },
    {
      id: "3820",
      nombre: "MORFOLOGIA I",
      año: "Segundo Año",
      cuatrimestre: "Primer Cuatrimestre",
      horas: "96",
      tipo: "materia",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: null,
      correlativas: {
        "5488": {
          para_cursar: "aprobada",
          para_rendir: "aprobada",
        },
        "5489": {
          para_cursar: "cursada",
          para_rendir: "aprobada",
        },
      },
    },
    {
      id: "I2201",
      nombre: "Idioma de Arquitectura",
      año: "Tercer Año",
      cuatrimestre: "Segundo Cuatrimestre",
      horas: "",
      tipo: "agrupador_requisito",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: "idioma",
      correlativas: {},
    },
    {
      id: "4804",
      nombre: "SUFICIENCIA DE IDIOMA INGLES ARQ",
      año: "Quinto Año",
      cuatrimestre: "Segundo Cuatrimestre",
      horas: "",
      tipo: "materia",
      categoria: "optativa",
      grupo_opcion: "I2201",
      subtipo: "idioma",
      correlativas: {},
    },
    {
      id: "3751",
      nombre: "HISTORIA DE LA ARQUITECTURA I",
      año: "Segundo Año",
      cuatrimestre: "Primer Cuatrimestre",
      horas: "96",
      tipo: "materia",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: null,
      correlativas: {},
    },
    {
      id: "3944",
      nombre: "TALLER DE ARQUITECTURA III",
      año: "Tercer Año",
      cuatrimestre: "Anual",
      horas: "256",
      tipo: "materia",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: null,
      correlativas: {},
    },
    {
      id: "4607",
      nombre: "FUNDAMENTOS FILOSOFICOS DEL ESPACIO",
      año: "Segundo Año",
      cuatrimestre: "Primer Cuatrimestre",
      horas: "96",
      tipo: "materia",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: null,
      correlativas: {},
    },
    {
      id: "5076",
      nombre: "CONSTRUCCIONES I",
      año: "Segundo Año",
      cuatrimestre: "Segundo Cuatrimestre",
      horas: "96",
      tipo: "materia",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: null,
      correlativas: {},
    },
    {
      id: "5205",
      nombre: "ESTRUCTURAS I",
      año: "Segundo Año",
      cuatrimestre: "Segundo Cuatrimestre",
      horas: "96",
      tipo: "materia",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: null,
      correlativas: {},
    },
    {
      id: "5287",
      nombre: "INSTALACIONES I",
      año: "Segundo Año",
      cuatrimestre: "Segundo Cuatrimestre",
      horas: "64",
      tipo: "materia",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: null,
      correlativas: {},
    },
    {
      id: "3945",
      nombre: "TALLER DE ARQUITECTURA IV",
      año: "Cuarto Año",
      cuatrimestre: "Anual",
      horas: "256",
      tipo: "materia",
      categoria: "normal",
      grupo_opcion: null,
      subtipo: null,
      correlativas: {
        "3751": { para_cursar: "aprobada", para_rendir: "aprobada" },
        "3820": { para_cursar: "aprobada", para_rendir: "aprobada" },
        "3944": { para_cursar: "aprobada", para_rendir: "aprobada" },
        "4607": { para_cursar: "aprobada", para_rendir: "aprobada" },
        "5076": { para_cursar: "aprobada", para_rendir: "aprobada" },
        "5205": { para_cursar: "aprobada", para_rendir: "aprobada" },
        "5287": { para_cursar: "aprobada", para_rendir: "aprobada" },
        "I2201": { para_cursar: "aprobada", para_rendir: "aprobada" },
      },
    },
  ];

  const agrupadores: Agrupador[] = [
    {
      id: "I2201",
      nombre: "Idioma de Arquitectura",
      tipo: "idioma_grupo",
      opciones: ["4804"],
    },
  ];

  it("habilita Fisica con Matematica I cursada", () => {
    const estados: Record<string, EstadoMateria> = {
      "8118": "cursada",
    };

    const fisica = materias.find((m) => m.id === "3059")!;
    expect(estaHabilitadaParaCursar(fisica, estados, agrupadores)).toBe(
      true
    );
  });

  it("no habilita Taller II si Taller I está solo cursada", () => {
    const estados: Record<string, EstadoMateria> = {
      "3942": "cursada",
      "4719": "cursada",
    };

    const tallerII = materias.find((m) => m.id === "3943")!;
    expect(
      estaHabilitadaParaCursar(tallerII, estados, agrupadores)
    ).toBe(false);
  });

  it("habilita Taller II si Taller I está aprobada e Historia cursada", () => {
    const estados: Record<string, EstadoMateria> = {
      "3942": "aprobada",
      "4719": "cursada",
    };

    const tallerII = materias.find((m) => m.id === "3943")!;
    expect(
      estaHabilitadaParaCursar(tallerII, estados, agrupadores)
    ).toBe(true);
  });

  it("habilita Morfologia I solo con 5488 aprobada y 5489 cursada", () => {
    const estados: Record<string, EstadoMateria> = {
      "5488": "aprobada",
      "5489": "cursada",
    };

    const morfologia = materias.find((m) => m.id === "3820")!;
    expect(
      estaHabilitadaParaCursar(morfologia, estados, agrupadores)
    ).toBe(true);
  });

  it("no habilita Morfologia I si 5488 está solo cursada", () => {
    const estados: Record<string, EstadoMateria> = {
      "5488": "cursada",
      "5489": "cursada",
    };

    const morfologia = materias.find((m) => m.id === "3820")!;
    expect(
      estaHabilitadaParaCursar(morfologia, estados, agrupadores)
    ).toBe(false);
  });

  it("no habilita Taller IV si falta idioma", () => {
    const estados = estadosAprobados([
      "3751",
      "3820",
      "3944",
      "4607",
      "5076",
      "5205",
      "5287",
    ]);

    const tallerIV = materias.find((m) => m.id === "3945")!;
    expect(
      estaHabilitadaParaCursar(tallerIV, estados, agrupadores)
    ).toBe(false);
  });

  it("habilita Taller IV cuando 4804 aprobada satisface I2201", () => {
    const estados = estadosAprobados([
      "3751",
      "3820",
      "3944",
      "4607",
      "5076",
      "5205",
      "5287",
    ]);

    estados["I2201::4804"] = "aprobada";

    const tallerIV = materias.find((m) => m.id === "3945")!;
    expect(
      estaHabilitadaParaCursar(tallerIV, estados, agrupadores)
    ).toBe(true);
  });
});