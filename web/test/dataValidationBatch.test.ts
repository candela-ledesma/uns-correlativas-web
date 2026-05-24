import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CarreraConfig } from "@/lib/data/carreras";
import {
  formatBatchValidationReport,
  validateConfiguredPlanData,
} from "@/lib/data/dataValidationBatch";

function createTmpDataDir() {
  const root = mkdtempSync(path.join(tmpdir(), "uns-planes-"));
  const dataDir = path.join(root, "data");
  mkdirSync(dataDir, { recursive: true });

  return {
    root,
    dataDir,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function buildValidPlan(options?: { horas?: string }) {
  return {
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
  };
}

describe("validateConfiguredPlanData", () => {
  it("procesa multiples archivos y reporta por carrera/version", async () => {
    const { dataDir, cleanup } = createTmpDataDir();

    try {
      writeFileSync(
        path.join(dataDir, "ok.json"),
        JSON.stringify(buildValidPlan()),
        "utf8"
      );

      const duplicated = buildValidPlan();
      duplicated.materias.push({ ...duplicated.materias[0] });
      writeFileSync(
        path.join(dataDir, "dup.json"),
        JSON.stringify(duplicated),
        "utf8"
      );

      const carreras: CarreraConfig[] = [
        {
          id: "arquitectura",
          nombre: "Arquitectura",
          descripcion: "",
          defaultVersionId: "v1",
          versions: [
            {
              versionId: "v1",
              label: "OK",
              jsonFile: "ok.json",
              disponible: true,
            },
            {
              versionId: "v2",
              label: "Duplicado",
              jsonFile: "dup.json",
              disponible: true,
            },
          ],
          disponible: true,
        },
        {
          id: "lic_computacion" as import("@/lib/data/carreras").CarreraId,
          nombre: "Lic. Computacion",
          descripcion: "",
          defaultVersionId: "v1",
          versions: [
            {
              versionId: "v1",
              label: "Faltante",
              jsonFile: "missing.json",
              disponible: true,
            },
          ],
          disponible: true,
        },
      ];

      const report = await validateConfiguredPlanData({
        dataDir,
        carreras,
      });

      expect(report.summary.versionsChecked).toBe(3);
      expect(report.summary.versionsWithBlockingIssues).toBe(2);
      expect(report.summary.issuesByCode.DUPLICATE_MATERIA_ID).toBe(1);
      expect(report.summary.issuesByCode.FILE_NOT_FOUND).toBe(1);

      const okVersion = report.versions.find((item) => item.versionId === "v1" && item.carreraId === "arquitectura");
      expect(okVersion?.status).toBe("ok");

      const duplicatedVersion = report.versions.find((item) => item.versionId === "v2");
      expect(duplicatedVersion?.status).toBe("invalid");

      const missingVersion = report.versions.find((item) => item.carreraId === "lic_computacion");
      expect(missingVersion?.status).toBe("file-not-found");
    } finally {
      cleanup();
    }
  });

  it("clasifica duplicados como severidad critical", async () => {
    const { dataDir, cleanup } = createTmpDataDir();

    try {
      const duplicated = buildValidPlan();
      duplicated.materias.push({ ...duplicated.materias[0] });
      writeFileSync(
        path.join(dataDir, "dup.json"),
        JSON.stringify(duplicated),
        "utf8"
      );

      const carreras: CarreraConfig[] = [
        {
          id: "arquitectura",
          nombre: "Arquitectura",
          descripcion: "",
          defaultVersionId: "v1",
          versions: [
            {
              versionId: "v1",
              label: "Duplicado",
              jsonFile: "dup.json",
              disponible: true,
            },
          ],
          disponible: true,
        },
      ];

      const report = await validateConfiguredPlanData({ dataDir, carreras });
      const duplicatedIssue = report.versions[0].issues.find(
        (issue) => issue.code === "DUPLICATE_MATERIA_ID"
      );

      expect(duplicatedIssue).toBeDefined();
      expect(duplicatedIssue?.severity).toBe("critical");
      expect(duplicatedIssue?.blocking).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("respeta salida segun modo estricto para warnings", async () => {
    const { dataDir, cleanup } = createTmpDataDir();

    try {
      writeFileSync(
        path.join(dataDir, "warn.json"),
        JSON.stringify(buildValidPlan({ horas: "" })),
        "utf8"
      );

      const carreras: CarreraConfig[] = [
        {
          id: "arquitectura",
          nombre: "Arquitectura",
          descripcion: "",
          defaultVersionId: "v1",
          versions: [
            {
              versionId: "v1",
              label: "Warning",
              jsonFile: "warn.json",
              disponible: true,
            },
          ],
          disponible: true,
        },
      ];

      const nonStrict = await validateConfiguredPlanData({
        dataDir,
        carreras,
        strictWarnings: false,
      });

      expect(nonStrict.summary.issuesBySeverity.low).toBeGreaterThan(0);
      expect(nonStrict.shouldFail).toBe(false);

      const strict = await validateConfiguredPlanData({
        dataDir,
        carreras,
        strictWarnings: true,
      });

      expect(strict.summary.issuesBySeverity.low).toBeGreaterThan(0);
      expect(strict.shouldFail).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("genera salida human-readable estable", async () => {
    const { dataDir, cleanup } = createTmpDataDir();

    try {
      writeFileSync(
        path.join(dataDir, "ok.json"),
        JSON.stringify(buildValidPlan()),
        "utf8"
      );

      const carreras: CarreraConfig[] = [
        {
          id: "arquitectura",
          nombre: "Arquitectura",
          descripcion: "",
          defaultVersionId: "v1",
          versions: [
            {
              versionId: "v1",
              label: "OK",
              jsonFile: "ok.json",
              disponible: true,
            },
          ],
          disponible: true,
        },
      ];

      const report = await validateConfiguredPlanData({ dataDir, carreras });
      const output = formatBatchValidationReport(report);

      expect(output).toContain("Reporte de validacion de datos");
      expect(output).toContain("Resumen");
      expect(output).toContain("arquitectura@v1");
      expect(output).toContain("Resultado:");
    } finally {
      cleanup();
    }
  });
});
