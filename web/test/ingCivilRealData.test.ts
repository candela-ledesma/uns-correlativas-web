import { describe, expect, it } from "vitest";
import ingCivilRaw from "@/data/ing_civil.json";
import type { PlanData } from "@/app/types/plan";
import {
  estaHabilitadaParaAprobar,
  estaHabilitadaParaCursar,
  type EstadoMateria,
} from "@/lib/evaluarCorrelativas";
import { filtrarMaterias, type FiltrosPlan } from "@/lib/filtrarMaterias";
import { validatePlanData } from "@/lib/planValidation";

function cargarPlanIngCivil(): PlanData {
  const validacion = validatePlanData(ingCivilRaw, {
    carreraId: "ing_civil",
    versionId: "v1",
  });

  if (!validacion.ok) {
    throw new Error(
      `ing_civil.json invalido: ${validacion.issues
        .slice(0, 10)
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`
    );
  }

  return validacion.data;
}

function estados(...items: Array<[string, EstadoMateria]>) {
  return Object.fromEntries(items) as Record<string, EstadoMateria>;
}

function filtrosBase(orientacion: string): FiltrosPlan {
  return {
    codigo: "",
    anio: "todos",
    cuatrimestre: "todos",
    estado: "todas",
    orientacion,
  };
}

function idsFiltradosPorTramo(
  data: PlanData,
  orientacion: string,
  anio = "todos",
  cuatrimestre = "todos"
) {
  const idsAgrupadores = new Set(
    data.agrupadores.map((agrupador) => String(agrupador.id))
  );

  const materias = filtrarMaterias({
    materias: data.materias,
    estados: {},
    agrupadores: data.agrupadores,
    idsAgrupadores,
    filtros: {
      ...filtrosBase(orientacion),
      anio,
      cuatrimestre,
    },
  });

  return new Set(materias.map((materia) => String(materia.id)));
}

function esperarIdsPresentes(ids: Set<string>, esperados: string[]) {
  for (const id of esperados) {
    expect(ids.has(id)).toBe(true);
  }
}

describe("Ing Civil real - correlativas", () => {
  it("HIDRAULICA APLICADA (5225) exige correlativas reales para cursar y aprobar", () => {
    const data = cargarPlanIngCivil();
    const hidraulicaAplicada = data.materias.find((materia) => materia.id === "5225");

    expect(hidraulicaAplicada).toBeDefined();
    if (!hidraulicaAplicada) return;

    const baseIncompleta = estados(
      ["5006", "aprobada"],
      ["5176", "aprobada"],
      ["5462", "aprobada"],
      ["5475", "aprobada"],
      ["I0012::5175", "aprobada"]
    );

    expect(
      estaHabilitadaParaCursar(
        hidraulicaAplicada,
        baseIncompleta,
        data.materias,
        data.agrupadores
      )
    ).toBe(false);

    const paraCursar = {
      ...baseIncompleta,
      "5230": "cursada" as const,
    };

    expect(
      estaHabilitadaParaCursar(
        hidraulicaAplicada,
        paraCursar,
        data.materias,
        data.agrupadores
      )
    ).toBe(true);

    expect(
      estaHabilitadaParaAprobar(
        hidraulicaAplicada,
        paraCursar,
        data.materias,
        data.agrupadores
      )
    ).toBe(false);

    const paraAprobar = {
      ...paraCursar,
      "5230": "aprobada" as const,
    };

    expect(
      estaHabilitadaParaAprobar(
        hidraulicaAplicada,
        paraAprobar,
        data.materias,
        data.agrupadores
      )
    ).toBe(true);
  });
});

describe("Ing Civil real - orientaciones", () => {
  it("filtra materias por orientación manteniendo troncales y no orientadas", () => {
    const data = cargarPlanIngCivil();
    const idsAgrupadores = new Set(data.agrupadores.map((agrupador) => String(agrupador.id)));

    const construcciones = filtrarMaterias({
      materias: data.materias,
      estados: {},
      agrupadores: data.agrupadores,
      idsAgrupadores,
      filtros: filtrosBase("Construcciones"),
    });

    const idsConstrucciones = new Set(construcciones.map((materia) => materia.id));

    expect(idsConstrucciones.has("5131")).toBe(true);
    expect(idsConstrucciones.has("I0012")).toBe(true);
    expect(idsConstrucciones.has("5013")).toBe(true);
    expect(idsConstrucciones.has("5220")).toBe(false);
    expect(idsConstrucciones.has("5341")).toBe(false);

    const hidraulica = filtrarMaterias({
      materias: data.materias,
      estados: {},
      agrupadores: data.agrupadores,
      idsAgrupadores,
      filtros: filtrosBase("Hidráulica"),
    });

    const idsHidraulica = new Set(hidraulica.map((materia) => materia.id));

    expect(idsHidraulica.has("5220")).toBe(true);
    expect(idsHidraulica.has("5013")).toBe(true);
    expect(idsHidraulica.has("5341")).toBe(false);

    const viasSinAcentos = filtrarMaterias({
      materias: data.materias,
      estados: {},
      agrupadores: data.agrupadores,
      idsAgrupadores,
      filtros: filtrosBase("vias de comunicacion"),
    });

    const idsVias = new Set(viasSinAcentos.map((materia) => materia.id));

    expect(idsVias.has("5341")).toBe(true);
    expect(idsVias.has("5013")).toBe(true);
    expect(idsVias.has("5220")).toBe(false);
  });

  it("Construcciones incluye materias clave por tramos", () => {
    const data = cargarPlanIngCivil();

    const cuartoPrimerCuatri = idsFiltradosPorTramo(
      data,
      "Construcciones",
      "Cuarto Año",
      "Primer Cuatrimestre"
    );
    esperarIdsPresentes(cuartoPrimerCuatri, ["5080", "5134", "5225", "5375"]);

    const cuartoSegundoCuatri = idsFiltradosPorTramo(
      data,
      "Construcciones",
      "Cuarto Año",
      "Segundo Cuatrimestre"
    );
    esperarIdsPresentes(cuartoSegundoCuatri, [
      "5009",
      "5117",
      "5181",
      "5241",
      "5270",
      "G0857",
      "5405",
    ]);

    const quintoPrimerCuatri = idsFiltradosPorTramo(
      data,
      "Construcciones",
      "Quinto Año",
      "Primer Cuatrimestre"
    );
    esperarIdsPresentes(quintoPrimerCuatri, ["5044", "5242", "5013", "5410", "G0858"]);

    const quintoSegundoCuatri = idsFiltradosPorTramo(
      data,
      "Construcciones",
      "Quinto Año",
      "Segundo Cuatrimestre"
    );
    esperarIdsPresentes(quintoSegundoCuatri, ["5012", "5148", "1709", "5411"]);
  });

  it("Hidráulica incluye materias clave por tramos", () => {
    const data = cargarPlanIngCivil();

    const cuartoPrimerCuatri = idsFiltradosPorTramo(
      data,
      "Hidráulica",
      "Cuarto Año",
      "Primer Cuatrimestre"
    );
    esperarIdsPresentes(cuartoPrimerCuatri, ["5080", "5134", "5220", "5375"]);

    const cuartoSegundoCuatri = idsFiltradosPorTramo(
      data,
      "Hidráulica",
      "Cuarto Año",
      "Segundo Cuatrimestre"
    );
    esperarIdsPresentes(cuartoSegundoCuatri, ["5117", "5241", "5270", "5335", "5405"]);

    const quintoPrimerCuatri = idsFiltradosPorTramo(
      data,
      "Hidráulica",
      "Quinto Año",
      "Primer Cuatrimestre"
    );
    esperarIdsPresentes(quintoPrimerCuatri, ["5044", "5242", "5410", "G0859", "G0860"]);
    expect(quintoPrimerCuatri.has("5013")).toBe(true);

    const quintoSegundoCuatri = idsFiltradosPorTramo(
      data,
      "Hidráulica",
      "Quinto Año",
      "Segundo Cuatrimestre"
    );
    esperarIdsPresentes(quintoSegundoCuatri, ["5012", "5115", "1709", "5412"]);
  });

  it("Vías de Comunicación incluye materias clave por tramos", () => {
    const data = cargarPlanIngCivil();

    const cuartoPrimerCuatri = idsFiltradosPorTramo(
      data,
      "Vías de Comunicación",
      "Cuarto Año",
      "Primer Cuatrimestre"
    );
    esperarIdsPresentes(cuartoPrimerCuatri, ["5080", "5134", "5225", "5375"]);

    const cuartoSegundoCuatri = idsFiltradosPorTramo(
      data,
      "Vías de Comunicación",
      "Cuarto Año",
      "Segundo Cuatrimestre"
    );
    esperarIdsPresentes(cuartoSegundoCuatri, ["5117", "5180", "5241", "5270", "5405"]);

    const quintoPrimerCuatri = idsFiltradosPorTramo(
      data,
      "Vías de Comunicación",
      "Quinto Año",
      "Primer Cuatrimestre"
    );
    esperarIdsPresentes(quintoPrimerCuatri, ["5041", "5242", "5013", "5410", "G0861"]);

    const quintoSegundoCuatri = idsFiltradosPorTramo(
      data,
      "Vías de Comunicación",
      "Quinto Año",
      "Segundo Cuatrimestre"
    );
    esperarIdsPresentes(quintoSegundoCuatri, ["5012", "5042", "1709", "5412", "G0862"]);
  });

  it("las materias optativas generales del plan existen y están referenciadas en agrupadores", () => {
    const data = cargarPlanIngCivil();

    const optativasGenerales = [
      "2710",
      "5065",
      "5085",
      "5114",
      "5122",
      "5189",
      "5229",
      "5320",
      "5340",
      "5360",
      "5362",
      "5467",
      "7887",
    ];

    const materiasById = new Map(data.materias.map((materia) => [materia.id, materia]));
    const opcionesAgrupadores = new Set(
      data.agrupadores.flatMap((agrupador) => agrupador.opciones.map(String))
    );

    for (const id of optativasGenerales) {
      const materia = materiasById.get(id);

      expect(materia).toBeDefined();
      if (!materia) continue;

      expect(materia.categoria).toBe("optativa");
      expect(opcionesAgrupadores.has(id)).toBe(true);
    }
  });
});
