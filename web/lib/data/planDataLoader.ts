import { promises as fs } from "fs";
import path from "path";
import type { PlanData } from "@/app/types/plan";
import {
  getCarreraById,
  getVersionForCarrera,
  type CarreraVersionConfig,
} from "@/lib/data/carreras";
import {
  validatePlanData,
  type PlanValidationIssue,
  type PlanValidationIssueKind,
} from "@/lib/data/planValidation";

type CarreraInfo = {
  id: string;
  nombre: string;
};

type CarreraInfoWithVersions = CarreraInfo & {
  defaultVersionId: string;
  versions: Pick<
    CarreraVersionConfig,
    "versionId" | "label" | "disponible" | "hidden"
  >[];
};

type VersionInfo = {
  versionId: string;
  label: string;
  jsonFile: string;
  disponible?: boolean;
  hidden?: boolean;
};

export type PlanLoadResult =
  | { status: "not-found"; carreraId: string }
  | {
      status: "unavailable";
      carrera: CarreraInfo;
      reason: "version-not-found" | "version-disabled" | "file-not-found";
    }
  | {
      status: "invalid";
      carrera: CarreraInfo;
      errorKind: PlanValidationIssueKind;
      issues: PlanValidationIssue[];
    }
  | {
      status: "error";
      carrera: CarreraInfo;
      message: string;
    }
  | {
      status: "ok";
      carrera: CarreraInfoWithVersions;
      version: VersionInfo;
      data: PlanData;
      warnings: PlanValidationIssue[];
    };

export function normalizeSearchParam(value: string | string[] | undefined) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function formatValidationIssues(
  issues: PlanValidationIssue[],
  max = 8
): string[] {
  return issues.slice(0, max).map((issue) => `${issue.path}: ${issue.message}`);
}

export async function loadPlanData(
  carreraId: string,
  requestedVersionId: string | null
): Promise<PlanLoadResult> {
  const carrera = getCarreraById(carreraId);
  if (!carrera) {
    return { status: "not-found", carreraId };
  }

  const carreraInfo: CarreraInfo = {
    id: carrera.id,
    nombre: carrera.nombre,
  };

  const version = getVersionForCarrera(carreraId, requestedVersionId);
  if (!version) {
    return {
      status: "unavailable",
      carrera: carreraInfo,
      reason: "version-not-found",
    };
  }

  if (version.disponible === false) {
    return {
      status: "unavailable",
      carrera: carreraInfo,
      reason: "version-disabled",
    };
  }

  try {
    const filePath = path.join(process.cwd(), "data", version.jsonFile);
    const fileContents = await fs.readFile(filePath, "utf8");

    let raw: unknown;
    try {
      raw = JSON.parse(fileContents);
    } catch {
      return {
        status: "invalid",
        carrera: carreraInfo,
        errorKind: "shape",
        issues: [
          {
            kind: "shape",
            path: "$",
            message: "El archivo no contiene JSON válido",
          },
        ],
      };
    }

    const validation = validatePlanData(raw, {
      carreraId,
      versionId: version.versionId,
    });

    if (!validation.ok) {
      return {
        status: "invalid",
        carrera: carreraInfo,
        errorKind: validation.kind,
        issues: validation.issues,
      };
    }

    if (validation.warnings.length > 0 && process.env.NODE_ENV !== "production") {
      console.warn(
        `[plan-loader] advertencias de consistencia para ${carreraId}@${version.versionId}:`,
        formatValidationIssues(validation.warnings, 20)
      );
    }

    return {
      status: "ok",
      carrera: {
        ...carreraInfo,
        defaultVersionId: carrera.defaultVersionId,
        versions: carrera.versions.map((item) => ({
          versionId: item.versionId,
          label: item.label,
          disponible: item.disponible,
          hidden: item.hidden,
        })),
      },
      version: {
        versionId: version.versionId,
        label: version.label,
        jsonFile: version.jsonFile,
        disponible: version.disponible,
        hidden: version.hidden,
      },
      data: validation.data,
      warnings: validation.warnings,
    };
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {
        status: "unavailable",
        carrera: carreraInfo,
        reason: "file-not-found",
      };
    }

    return {
      status: "error",
      carrera: carreraInfo,
      message: "No se pudo cargar el plan",
    };
  }
}
