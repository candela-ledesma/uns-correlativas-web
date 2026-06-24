import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  formatBatchValidationReport,
  validateConfiguredPlanData,
} from "@/lib/data/dataValidationBatch";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    contenidoPlan: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/carreraRepository", () => ({
  getCarreras: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
const mockFindFirst = vi.mocked(prisma.contenidoPlan.findFirst);

type TestCarrera = {
  id: string;
  nombre: string;
  versiones: { versionId: string; label: string; disponible: boolean; hidden?: boolean }[];
};

function buildValidPlanJson(options?: { horas?: string }) {
  return JSON.stringify({
    plan: {
      carrera: "Arquitectura",
      universidad: "Universidad Nacional del Sur",
      codigo_plan: "Plan Test",
    },
    materias: [
      {
        id: "M1",
        nombre: "Materia 1",
        año: "Primer Año",
        cuatrimestre: "Primer Cuatrimestre",
        horas: options?.horas ?? "64",
        tipo: "materia",
        categoria: "normal",
        grupo_opcion: null,
        subtipo: null,
        correlativas: {},
      },
    ],
    agrupadores: [],
  });
}

function buildDuplicatedPlanJson() {
  return JSON.stringify({
    plan: {
      carrera: "Arquitectura",
      universidad: "Universidad Nacional del Sur",
      codigo_plan: "Plan Test",
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
        id: "M1",
        nombre: "Materia 1 dup",
        año: "Primer Año",
        cuatrimestre: "Primer Cuatrimestre",
        horas: "64",
        tipo: "materia",
        categoria: "normal",
        grupo_opcion: null,
        subtipo: null,
        correlativas: {},
      },
    ],
    agrupadores: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateConfiguredPlanData", () => {
  it("procesa multiples carreras y reporta por carrera/version", async () => {
    const carreras: TestCarrera[] = [
      {
        id: "arquitectura",
        nombre: "Arquitectura",
        versiones: [
          { versionId: "v1", label: "OK", disponible: true },
          { versionId: "v2", label: "Duplicado", disponible: true },
        ],
      },
      {
        id: "lic_computacion",
        nombre: "Lic. Computacion",
        versiones: [{ versionId: "v1", label: "Sin plan", disponible: true }],
      },
    ];

    mockFindFirst
      .mockResolvedValueOnce({ planJson: buildValidPlanJson() } as never)
      .mockResolvedValueOnce({ planJson: buildDuplicatedPlanJson() } as never)
      .mockResolvedValueOnce(null);

    const report = await validateConfiguredPlanData({ carreras });

    expect(report.summary.versionsChecked).toBe(3);
    expect(report.summary.versionsWithBlockingIssues).toBe(2);
    expect(report.summary.issuesByCode.DUPLICATE_MATERIA_ID).toBe(1);
    expect(report.summary.issuesByCode.PLAN_NOT_FOUND).toBe(1);

    const okVersion = report.versions.find((v) => v.versionId === "v1" && v.carreraId === "arquitectura");
    expect(okVersion?.status).toBe("ok");

    const duplicatedVersion = report.versions.find((v) => v.versionId === "v2");
    expect(duplicatedVersion?.status).toBe("invalid");

    const missingVersion = report.versions.find((v) => v.carreraId === "lic_computacion");
    expect(missingVersion?.status).toBe("plan-not-found");
  });

  it("clasifica duplicados como severidad critical", async () => {
    const carreras: TestCarrera[] = [
      {
        id: "arquitectura",
        nombre: "Arquitectura",
        versiones: [{ versionId: "v1", label: "Duplicado", disponible: true }],
      },
    ];

    mockFindFirst.mockResolvedValueOnce({ planJson: buildDuplicatedPlanJson() } as never);

    const report = await validateConfiguredPlanData({ carreras });
    const duplicatedIssue = report.versions[0].issues.find(
      (issue) => issue.code === "DUPLICATE_MATERIA_ID"
    );

    expect(duplicatedIssue).toBeDefined();
    expect(duplicatedIssue?.severity).toBe("critical");
    expect(duplicatedIssue?.blocking).toBe(true);
  });

  it("respeta salida segun modo estricto para warnings", async () => {
    const carreras: TestCarrera[] = [
      {
        id: "arquitectura",
        nombre: "Arquitectura",
        versiones: [{ versionId: "v1", label: "Warning", disponible: true }],
      },
    ];

    mockFindFirst.mockResolvedValue({ planJson: buildValidPlanJson({ horas: "" }) } as never);

    const nonStrict = await validateConfiguredPlanData({ carreras, strictWarnings: false });
    expect(nonStrict.summary.issuesBySeverity.low).toBeGreaterThan(0);
    expect(nonStrict.shouldFail).toBe(false);

    const strict = await validateConfiguredPlanData({ carreras, strictWarnings: true });
    expect(strict.summary.issuesBySeverity.low).toBeGreaterThan(0);
    expect(strict.shouldFail).toBe(true);
  });

  it("genera salida human-readable estable", async () => {
    const carreras: TestCarrera[] = [
      {
        id: "arquitectura",
        nombre: "Arquitectura",
        versiones: [{ versionId: "v1", label: "OK", disponible: true }],
      },
    ];

    mockFindFirst.mockResolvedValueOnce({ planJson: buildValidPlanJson() } as never);

    const report = await validateConfiguredPlanData({ carreras });
    const output = formatBatchValidationReport(report);

    expect(output).toContain("Reporte de validacion de datos");
    expect(output).toContain("Resumen");
    expect(output).toContain("arquitectura@v1");
    expect(output).toContain("Resultado:");
  });
});
