import { describe, expect, it } from "vitest";
import { validatePlanData } from "@/lib/planValidation";

function buildValidPlanFixture() {
  return {
    plan: {
      carrera: "Arquitectura",
      universidad: "Universidad Nacional del Sur",
      codigo_plan: "Plan 2016 - Versión 2",
    },
    materias: [
      {
        id: "M1",
        nombre: "Materia 1",
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
        id: "M2",
        nombre: "Materia 2",
        año: "Segundo Año",
        cuatrimestre: "Segundo Cuatrimestre",
        horas: "64",
        tipo: "materia",
        categoria: "optativa",
        grupo_opcion: "G1",
        subtipo: "optativa",
        correlativas: {
          M1: {
            para_cursar: "aprobada",
            para_rendir: "aprobada",
          },
        },
      },
    ],
    agrupadores: [
      {
        id: "G1",
        nombre: "Optativas",
        tipo: "optativa_grupo",
        opciones: ["M2"],
        orientacion: null,
      },
    ],
  };
}

describe("validatePlanData", () => {
  it("acepta un JSON válido", () => {
    const raw = buildValidPlanFixture();

    const result = validatePlanData(raw, {
      carreraId: "arquitectura",
      versionId: "v2",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.plan.plan_id).toBe("arquitectura");
      expect(result.data.plan.version_id).toBe("v2");
      expect(result.data.materias).toHaveLength(2);
    }
  });

  it("falla si faltan campos requeridos", () => {
    const raw = buildValidPlanFixture();
    delete (raw.plan as { carrera?: string }).carrera;

    const result = validatePlanData(raw, {
      carreraId: "arquitectura",
      versionId: "v2",
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.kind).toBe("shape");
      expect(result.issues.some((issue) => issue.path === "plan.carrera")).toBe(true);
    }
  });

  it("falla si un tipo de dato es incorrecto", () => {
    const raw = buildValidPlanFixture() as { materias: unknown };
    raw.materias = "esto-no-es-un-array";

    const result = validatePlanData(raw, {
      carreraId: "arquitectura",
      versionId: "v2",
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.kind).toBe("shape");
      expect(result.issues.some((issue) => issue.path === "materias")).toBe(true);
    }
  });

  it("detecta correlativas que apuntan a IDs inexistentes", () => {
    const raw = buildValidPlanFixture();
    raw.materias[1].correlativas = {
      M999: {
        para_cursar: "cursada",
        para_rendir: "aprobada",
      },
    };

    const result = validatePlanData(raw, {
      carreraId: "arquitectura",
      versionId: "v2",
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.kind).toBe("consistency");
      expect(
        result.issues.some((issue) => issue.message.includes("ID inexistente"))
      ).toBe(true);
    }
  });

  it("detecta IDs de materias duplicados", () => {
    const raw = buildValidPlanFixture();
    raw.materias.push({
      ...raw.materias[0],
      nombre: "Materia duplicada",
    });

    const result = validatePlanData(raw, {
      carreraId: "arquitectura",
      versionId: "v2",
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.kind).toBe("consistency");
      expect(
        result.issues.some((issue) => issue.message.includes("ID de materia duplicado"))
      ).toBe(true);
    }
  });
});
