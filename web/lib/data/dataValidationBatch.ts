import { promises as fs } from "fs";
import path from "path";
import {
  CARRERAS,
  type CarreraConfig,
  type CarreraVersionConfig,
} from "@/lib/data/carreras";
import {
  validatePlanData,
  type PlanValidationIssue,
  type PlanValidationIssueKind,
} from "@/lib/data/planValidation";
import type { PlanData } from "@/app/types/plan";

export type DataIssueSeverity = "critical" | "medium" | "low";

export type DataIssueSource = "error" | "warning" | "quality";

export type DataIssueCode =
  | "INVALID_JSON_SHAPE"
  | "PLAN_ID_MISMATCH"
  | "PLAN_VERSION_MISMATCH"
  | "DUPLICATE_MATERIA_ID"
  | "DUPLICATE_AGRUPADOR_ID"
  | "CORRELATIVA_TARGET_MISSING"
  | "MATERIA_GROUP_MISSING"
  | "MATERIA_GROUP_BACKREFERENCE_MISMATCH"
  | "LEGACY_GROUP_OPTION_MISSING_SUBJECT"
  | "LEGACY_GROUP_CROSS_REFERENCE"
  | "EMPTY_HOURS"
  | "MISSING_SCHEDULE_SLOT"
  | "OPTIONAL_SUBTYPE_MISSING"
  | "FILE_NOT_FOUND"
  | "JSON_PARSE_ERROR"
  | "IO_ERROR"
  | "UNKNOWN";

export type DataValidationIssue = {
  severity: DataIssueSeverity;
  blocking: boolean;
  source: DataIssueSource;
  code: DataIssueCode;
  kind: PlanValidationIssueKind | "quality";
  path: string;
  message: string;
};

export type VersionValidationStatus =
  | "ok"
  | "invalid"
  | "file-not-found"
  | "json-parse-error"
  | "io-error"
  | "skipped";

export type VersionValidationReport = {
  carreraId: string;
  carreraNombre: string;
  versionId: string;
  versionLabel: string;
  jsonFile: string;
  disponible: boolean;
  hidden: boolean;
  status: VersionValidationStatus;
  skipReason?: string;
  issues: DataValidationIssue[];
  blockingIssueCount: number;
  warningIssueCount: number;
};

export type BatchValidationSummary = {
  versionsChecked: number;
  versionsSkipped: number;
  versionsWithBlockingIssues: number;
  versionsWithWarnings: number;
  issuesBySeverity: Record<DataIssueSeverity, number>;
  issuesByCode: Record<string, number>;
};

export type BatchValidationReport = {
  generatedAt: string;
  strictWarnings: boolean;
  includeHidden: boolean;
  includeUnavailable: boolean;
  dataDir: string;
  summary: BatchValidationSummary;
  versions: VersionValidationReport[];
  shouldFail: boolean;
};

export type ValidateBatchOptions = {
  dataDir?: string;
  includeHidden?: boolean;
  includeUnavailable?: boolean;
  strictWarnings?: boolean;
  carreras?: CarreraConfig[];
};

function isPattern(message: string, query: string) {
  return message.toLowerCase().includes(query.toLowerCase());
}

function classifyValidationIssue(
  issue: PlanValidationIssue,
  source: DataIssueSource
): Pick<DataValidationIssue, "severity" | "blocking" | "code"> {
  if (source === "warning") {
    if (isPattern(issue.message, "Referencia a materia inexistente")) {
      return {
        severity: "medium",
        blocking: false,
        code: "LEGACY_GROUP_OPTION_MISSING_SUBJECT",
      };
    }

    if (isPattern(issue.message, "Referencia cruzada inválida")) {
      return {
        severity: "medium",
        blocking: false,
        code: "LEGACY_GROUP_CROSS_REFERENCE",
      };
    }

    return {
      severity: "medium",
      blocking: false,
      code: "UNKNOWN",
    };
  }

  if (issue.kind === "shape") {
    return {
      severity: "critical",
      blocking: true,
      code: "INVALID_JSON_SHAPE",
    };
  }

  if (isPattern(issue.message, "plan_id")) {
    return {
      severity: "critical",
      blocking: true,
      code: "PLAN_ID_MISMATCH",
    };
  }

  if (isPattern(issue.message, "versión solicitada")) {
    return {
      severity: "critical",
      blocking: true,
      code: "PLAN_VERSION_MISMATCH",
    };
  }

  if (isPattern(issue.message, "ID de materia duplicado")) {
    return {
      severity: "critical",
      blocking: true,
      code: "DUPLICATE_MATERIA_ID",
    };
  }

  if (isPattern(issue.message, "ID de agrupador duplicado")) {
    return {
      severity: "critical",
      blocking: true,
      code: "DUPLICATE_AGRUPADOR_ID",
    };
  }

  if (isPattern(issue.message, "Correlativa apunta a un ID inexistente")) {
    return {
      severity: "critical",
      blocking: true,
      code: "CORRELATIVA_TARGET_MISSING",
    };
  }

  if (isPattern(issue.message, "Referencia a agrupador inexistente")) {
    return {
      severity: "critical",
      blocking: true,
      code: "MATERIA_GROUP_MISSING",
    };
  }

  if (isPattern(issue.message, "no la incluye en opciones")) {
    return {
      severity: "medium",
      blocking: false,
      code: "MATERIA_GROUP_BACKREFERENCE_MISMATCH",
    };
  }

  return {
    severity: "medium",
    blocking: false,
    code: "UNKNOWN",
  };
}

function toDataValidationIssue(
  issue: PlanValidationIssue,
  source: DataIssueSource
): DataValidationIssue {
  const classified = classifyValidationIssue(issue, source);

  return {
    ...classified,
    source,
    kind: issue.kind,
    path: issue.path,
    message: issue.message,
  };
}

function collectDataQualityIssues(data: PlanData): DataValidationIssue[] {
  const issues: DataValidationIssue[] = [];
  const agrupadoresIds = new Set(data.agrupadores.map((agrupador) => String(agrupador.id)));

  data.materias.forEach((materia, index) => {
    const materiaPath = `materias[${index}]`;
    const esAgrupadorPlaceholder = agrupadoresIds.has(String(materia.id));

    if (materia.horas.trim().length === 0) {
      issues.push({
        severity: "low",
        blocking: false,
        source: "quality",
        code: "EMPTY_HOURS",
        kind: "quality",
        path: `${materiaPath}.horas`,
        message: "Carga horaria vacía",
      });
    }

    if (!esAgrupadorPlaceholder && (materia.año === null || materia.cuatrimestre === null)) {
      issues.push({
        severity: "low",
        blocking: false,
        source: "quality",
        code: "MISSING_SCHEDULE_SLOT",
        kind: "quality",
        path: materiaPath,
        message: "Materia sin año o cuatrimestre",
      });
    }

    if (materia.categoria === "optativa" && materia.grupo_opcion === null) {
      issues.push({
        severity: "medium",
        blocking: false,
        source: "quality",
        code: "MATERIA_GROUP_MISSING",
        kind: "quality",
        path: `${materiaPath}.grupo_opcion`,
        message: "Materia optativa sin grupo_opcion",
      });
    }

    if (materia.subtipo === null && materia.tipo !== "materia") {
      issues.push({
        severity: "low",
        blocking: false,
        source: "quality",
        code: "OPTIONAL_SUBTYPE_MISSING",
        kind: "quality",
        path: `${materiaPath}.subtipo`,
        message: "Subtipo vacío en materia no estándar",
      });
    }
  });

  return issues;
}

function buildFileErrorIssue(code: DataIssueCode, message: string): DataValidationIssue {
  return {
    severity: "critical",
    blocking: true,
    source: "error",
    code,
    kind: "shape",
    path: "$",
    message,
  };
}

function initialSummary(): BatchValidationSummary {
  return {
    versionsChecked: 0,
    versionsSkipped: 0,
    versionsWithBlockingIssues: 0,
    versionsWithWarnings: 0,
    issuesBySeverity: {
      critical: 0,
      medium: 0,
      low: 0,
    },
    issuesByCode: {},
  };
}

function updateSummaryWithIssues(
  summary: BatchValidationSummary,
  issues: DataValidationIssue[]
) {
  issues.forEach((issue) => {
    summary.issuesBySeverity[issue.severity] += 1;
    summary.issuesByCode[issue.code] = (summary.issuesByCode[issue.code] ?? 0) + 1;
  });
}

function shouldSkipVersion(
  version: CarreraVersionConfig,
  options: Required<Pick<ValidateBatchOptions, "includeHidden" | "includeUnavailable">>
): string | null {
  if (version.hidden === true && !options.includeHidden) {
    return "Version oculta";
  }

  if (version.disponible === false && !options.includeUnavailable) {
    return "Version no disponible";
  }

  return null;
}

async function validateSingleVersion(
  carrera: CarreraConfig,
  version: CarreraVersionConfig,
  dataDir: string
): Promise<{ status: VersionValidationStatus; issues: DataValidationIssue[] }> {
  const filePath = path.join(dataDir, version.jsonFile);

  let rawFile: string;
  try {
    rawFile = await fs.readFile(filePath, "utf8");
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {
        status: "file-not-found",
        issues: [buildFileErrorIssue("FILE_NOT_FOUND", "Archivo de plan no encontrado")],
      };
    }

    return {
      status: "io-error",
      issues: [buildFileErrorIssue("IO_ERROR", "No se pudo leer el archivo de plan")],
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawFile);
  } catch {
    return {
      status: "json-parse-error",
      issues: [buildFileErrorIssue("JSON_PARSE_ERROR", "JSON malformado")],
    };
  }

  const validation = validatePlanData(raw, {
    carreraId: carrera.id,
    versionId: version.versionId,
  });

  if (!validation.ok) {
    return {
      status: "invalid",
      issues: validation.issues.map((issue) => toDataValidationIssue(issue, "error")),
    };
  }

  const warningIssues = validation.warnings.map((issue) =>
    toDataValidationIssue(issue, "warning")
  );
  const qualityIssues = collectDataQualityIssues(validation.data);

  return {
    status: "ok",
    issues: [...warningIssues, ...qualityIssues],
  };
}

export async function validateConfiguredPlanData(
  options: ValidateBatchOptions = {}
): Promise<BatchValidationReport> {
  const includeHidden = options.includeHidden ?? false;
  const includeUnavailable = options.includeUnavailable ?? false;
  const strictWarnings = options.strictWarnings ?? false;
  const dataDir = options.dataDir ?? path.join(process.cwd(), "data", "local");
  const carreras = options.carreras ?? CARRERAS;

  const summary = initialSummary();
  const versions: VersionValidationReport[] = [];

  for (const carrera of carreras) {
    for (const version of carrera.versions) {
      const skipReason = shouldSkipVersion(version, {
        includeHidden,
        includeUnavailable,
      });

      if (skipReason) {
        summary.versionsSkipped += 1;
        versions.push({
          carreraId: carrera.id,
          carreraNombre: carrera.nombre,
          versionId: version.versionId,
          versionLabel: version.label,
          jsonFile: version.jsonFile,
          disponible: version.disponible !== false,
          hidden: version.hidden === true,
          status: "skipped",
          skipReason,
          issues: [],
          blockingIssueCount: 0,
          warningIssueCount: 0,
        });
        continue;
      }

      summary.versionsChecked += 1;

      const validation = await validateSingleVersion(carrera, version, dataDir);
      const issues = validation.issues;
      const blockingIssueCount = issues.filter((issue) => issue.blocking).length;
      const warningIssueCount = issues.length - blockingIssueCount;

      if (blockingIssueCount > 0) {
        summary.versionsWithBlockingIssues += 1;
      }

      if (warningIssueCount > 0) {
        summary.versionsWithWarnings += 1;
      }

      updateSummaryWithIssues(summary, issues);

      versions.push({
        carreraId: carrera.id,
        carreraNombre: carrera.nombre,
        versionId: version.versionId,
        versionLabel: version.label,
        jsonFile: version.jsonFile,
        disponible: version.disponible !== false,
        hidden: version.hidden === true,
        status: validation.status,
        issues,
        blockingIssueCount,
        warningIssueCount,
      });
    }
  }

  const totalWarnings = summary.issuesBySeverity.medium + summary.issuesBySeverity.low;
  const shouldFail = summary.issuesBySeverity.critical > 0 || (strictWarnings && totalWarnings > 0);

  return {
    generatedAt: new Date().toISOString(),
    strictWarnings,
    includeHidden,
    includeUnavailable,
    dataDir,
    summary,
    versions,
    shouldFail,
  };
}

export function formatBatchValidationReport(report: BatchValidationReport): string {
  const lines: string[] = [];

  lines.push("Reporte de validacion de datos");
  lines.push(`Generado: ${report.generatedAt}`);
  lines.push(`Data dir: ${report.dataDir}`);
  lines.push(`Opciones: strictWarnings=${report.strictWarnings}, includeHidden=${report.includeHidden}, includeUnavailable=${report.includeUnavailable}`);
  lines.push("");

  lines.push("Resumen");
  lines.push(`- Versiones chequeadas: ${report.summary.versionsChecked}`);
  lines.push(`- Versiones omitidas: ${report.summary.versionsSkipped}`);
  lines.push(`- Versiones con errores bloqueantes: ${report.summary.versionsWithBlockingIssues}`);
  lines.push(`- Versiones con warnings: ${report.summary.versionsWithWarnings}`);
  lines.push(`- Issues critical: ${report.summary.issuesBySeverity.critical}`);
  lines.push(`- Issues medium: ${report.summary.issuesBySeverity.medium}`);
  lines.push(`- Issues low: ${report.summary.issuesBySeverity.low}`);
  lines.push("");

  lines.push("Detalle por version");
  for (const version of report.versions) {
    const id = `${version.carreraId}@${version.versionId}`;

    if (version.status === "skipped") {
      lines.push(`- ${id}: SKIPPED (${version.skipReason ?? "sin motivo"})`);
      continue;
    }

    lines.push(
      `- ${id}: ${version.status.toUpperCase()} | blocking=${version.blockingIssueCount} warnings=${version.warningIssueCount}`
    );

    version.issues.slice(0, 8).forEach((issue) => {
      lines.push(
        `  - [${issue.severity}] ${issue.code} ${issue.path}: ${issue.message}`
      );
    });

    if (version.issues.length > 8) {
      lines.push(`  - ... y ${version.issues.length - 8} issue(s) mas`);
    }
  }

  lines.push("");
  lines.push(`Resultado: ${report.shouldFail ? "FAIL" : "PASS"}`);

  return lines.join("\n");
}
