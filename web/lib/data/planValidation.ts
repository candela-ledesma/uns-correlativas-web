import type { Agrupador, Materia, PlanData, PlanInfo, Requisito } from "@/app/types/plan";

export type PlanValidationIssueKind = "shape" | "consistency";

export type PlanValidationIssue = {
  kind: PlanValidationIssueKind;
  path: string;
  message: string;
};

export type PlanValidationResult =
  | { ok: true; data: PlanData; warnings: PlanValidationIssue[] }
  | { ok: false; kind: PlanValidationIssueKind; issues: PlanValidationIssue[] };

type ValidationContext = {
  carreraId: string;
  versionId: string;
};

const VALID_REQUISITO_STATES = new Set(["cursada", "aprobada"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addIssue(
  issues: PlanValidationIssue[],
  kind: PlanValidationIssueKind,
  path: string,
  message: string
) {
  issues.push({ kind, path, message });
}

function asRequiredString(
  value: unknown,
  path: string,
  issues: PlanValidationIssue[],
  allowEmpty = false
): string | null {
  if (typeof value !== "string") {
    addIssue(issues, "shape", path, "Debe ser un string");
    return null;
  }

  if (!allowEmpty && value.trim().length === 0) {
    addIssue(issues, "shape", path, "No puede estar vacío");
    return null;
  }

  return value;
}

function asStringOrNull(
  value: unknown,
  path: string,
  issues: PlanValidationIssue[]
): string | null {
  if (value === null) return null;

  if (typeof value !== "string") {
    addIssue(issues, "shape", path, "Debe ser string o null");
    return null;
  }

  return value;
}

function asStringArray(
  value: unknown,
  path: string,
  issues: PlanValidationIssue[]
): string[] | null {
  if (!Array.isArray(value)) {
    addIssue(issues, "shape", path, "Debe ser un array de strings");
    return null;
  }

  const result: string[] = [];

  value.forEach((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      addIssue(issues, "shape", `${path}[${index}]`, "Debe ser un string no vacío");
      return;
    }

    result.push(item);
  });

  return result;
}

function asRequisitoState(
  value: unknown,
  path: string,
  issues: PlanValidationIssue[]
): Requisito["para_cursar"] {
  if (value === null) return null;

  if (typeof value !== "string" || !VALID_REQUISITO_STATES.has(value)) {
    addIssue(
      issues,
      "shape",
      path,
      "Debe ser 'cursada', 'aprobada' o null"
    );
    return null;
  }

  return value as Requisito["para_cursar"];
}

function parsePlanInfo(
  raw: unknown,
  context: ValidationContext,
  issues: PlanValidationIssue[]
): PlanInfo | null {
  if (!isRecord(raw)) {
    addIssue(issues, "shape", "plan", "Debe ser un objeto");
    return null;
  }

  const carrera = asRequiredString(raw.carrera, "plan.carrera", issues);
  const universidad = asRequiredString(raw.universidad, "plan.universidad", issues);
  const codigoPlan = asRequiredString(raw.codigo_plan, "plan.codigo_plan", issues);

  const rawPlanId = raw.plan_id;
  const rawVersionId = raw.version_id;

  if (rawPlanId !== undefined && typeof rawPlanId !== "string") {
    addIssue(issues, "shape", "plan.plan_id", "Debe ser un string");
  }

  if (rawVersionId !== undefined && typeof rawVersionId !== "string") {
    addIssue(issues, "shape", "plan.version_id", "Debe ser un string");
  }

  if (!carrera || !universidad || !codigoPlan) return null;

  const planId =
    typeof rawPlanId === "string" && rawPlanId.trim().length > 0
      ? rawPlanId
      : context.carreraId;

  const versionId =
    typeof rawVersionId === "string" && rawVersionId.trim().length > 0
      ? rawVersionId
      : context.versionId;

  return {
    carrera,
    universidad,
    codigo_plan: codigoPlan,
    plan_id: planId,
    version_id: versionId,
  };
}

function parseCorrelativas(
  raw: unknown,
  path: string,
  issues: PlanValidationIssue[]
): Materia["correlativas"] | null {
  if (!isRecord(raw)) {
    addIssue(issues, "shape", path, "Debe ser un objeto");
    return null;
  }

  const correlativas: Materia["correlativas"] = {};

  for (const [correlativaId, correlativaRaw] of Object.entries(raw)) {
    const requisitoPath = `${path}.${correlativaId}`;

    if (!isRecord(correlativaRaw)) {
      addIssue(issues, "shape", requisitoPath, "Debe ser un objeto");
      continue;
    }

    const paraCursar = asRequisitoState(
      correlativaRaw.para_cursar,
      `${requisitoPath}.para_cursar`,
      issues
    );
    const paraRendir = asRequisitoState(
      correlativaRaw.para_rendir,
      `${requisitoPath}.para_rendir`,
      issues
    );

    correlativas[correlativaId] = {
      para_cursar: paraCursar,
      para_rendir: paraRendir,
    };
  }

  return correlativas;
}

function parseRequisitoEspecial(
  raw: unknown,
  path: string,
  issues: PlanValidationIssue[]
): Materia["requisito_especial"] | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;

  if (!isRecord(raw)) {
    addIssue(issues, "shape", path, "Debe ser un objeto o null");
    return undefined;
  }

  const tipo = asRequiredString(raw.tipo, `${path}.tipo`, issues);
  const descripcion = asRequiredString(raw.descripcion, `${path}.descripcion`, issues);

  if (tipo === "minimo_materias_aprobadas") {
    const cantidadRaw = raw.cantidad;
    let cantidad: number | null = null;
    if (typeof cantidadRaw !== "number" || !Number.isInteger(cantidadRaw) || cantidadRaw < 1) {
      addIssue(issues, "shape", `${path}.cantidad`, "Debe ser un entero mayor o igual a 1");
    } else {
      cantidad = cantidadRaw;
    }

    if (cantidad === null || descripcion === null) {
      return undefined;
    }

    return {
      tipo,
      cantidad,
      descripcion,
    };
  } else if (tipo === "prueba_suficiencia_idioma") {
    if (descripcion === null) {
      return undefined;
    }

    return {
      tipo,
      descripcion,
    };
  } else {
    addIssue(
      issues,
      "shape",
      `${path}.tipo`,
      "Debe ser 'minimo_materias_aprobadas' o 'prueba_suficiencia_idioma'"
    );
    return undefined;
  }
}

function parseMaterias(raw: unknown, issues: PlanValidationIssue[]): Materia[] | null {
  if (!Array.isArray(raw)) {
    addIssue(issues, "shape", "materias", "Debe ser un array");
    return null;
  }

  const materias: Materia[] = [];

  raw.forEach((materiaRaw, index) => {
    const path = `materias[${index}]`;

    if (!isRecord(materiaRaw)) {
      addIssue(issues, "shape", path, "Debe ser un objeto");
      return;
    }

    const id = asRequiredString(materiaRaw.id, `${path}.id`, issues);
    const nombre = asRequiredString(materiaRaw.nombre, `${path}.nombre`, issues);
    const anio = asStringOrNull(materiaRaw.año, `${path}.año`, issues);
    const cuatrimestre = asStringOrNull(
      materiaRaw.cuatrimestre,
      `${path}.cuatrimestre`,
      issues
    );
    const horas = asRequiredString(materiaRaw.horas, `${path}.horas`, issues, true);
    const tipo = asRequiredString(materiaRaw.tipo, `${path}.tipo`, issues);
    const grupoOpcion = asStringOrNull(
      materiaRaw.grupo_opcion,
      `${path}.grupo_opcion`,
      issues
    );
    const orientacion =
      materiaRaw.orientacion === undefined
        ? undefined
        : asStringOrNull(materiaRaw.orientacion, `${path}.orientacion`, issues);
    const orientaciones =
      materiaRaw.orientaciones === undefined
        ? undefined
        : asStringArray(materiaRaw.orientaciones, `${path}.orientaciones`, issues);
    
    // Validar ubicacion (opcional, object con orientaciones como claves)
    let ubicacion: Record<string, { año: string | null; cuatrimestre: string | null }> | undefined;
    if (materiaRaw.ubicacion !== undefined) {
      if (isRecord(materiaRaw.ubicacion)) {
        ubicacion = {};
        for (const [orientacionKey, ubicacionData] of Object.entries(materiaRaw.ubicacion)) {
          if (isRecord(ubicacionData)) {
            const anioUbi = asStringOrNull(ubicacionData.año, `${path}.ubicacion.${orientacionKey}.año`, issues);
            const cuatrimestreUbi = asStringOrNull(ubicacionData.cuatrimestre, `${path}.ubicacion.${orientacionKey}.cuatrimestre`, issues);
            ubicacion[orientacionKey] = {
              año: anioUbi,
              cuatrimestre: cuatrimestreUbi,
            };
          }
        }
      }
    }
    
    const subtipo = asStringOrNull(materiaRaw.subtipo, `${path}.subtipo`, issues);
    const correlativas = parseCorrelativas(
      materiaRaw.correlativas,
      `${path}.correlativas`,
      issues
    );
    const requisitoEspecial = parseRequisitoEspecial(
      materiaRaw.requisito_especial,
      `${path}.requisito_especial`,
      issues
    );

    const categoriaRaw = materiaRaw.categoria;
    const categoria =
      categoriaRaw === "normal" || categoriaRaw === "optativa"
        ? categoriaRaw
        : null;

    if (!categoria) {
      addIssue(issues, "shape", `${path}.categoria`, "Debe ser 'normal' u 'optativa'");
    }

    if (
      id === null ||
      nombre === null ||
      anio === undefined ||
      cuatrimestre === undefined ||
      horas === null ||
      tipo === null ||
      categoria === null ||
      grupoOpcion === undefined ||
      orientaciones === null ||
      subtipo === undefined ||
      correlativas === null
    ) {
      return;
    }

    materias.push({
      id,
      nombre,
      año: anio,
      cuatrimestre,
      horas,
      tipo,
      categoria,
      grupo_opcion: grupoOpcion,
      orientacion: orientacion ?? undefined,
      orientaciones: orientaciones ?? undefined,
      ubicacion: ubicacion ?? undefined,
      subtipo,
      correlativas,
      ...(requisitoEspecial !== undefined
        ? { requisito_especial: requisitoEspecial }
        : {}),
    });
  });

  return materias;
}

function parseAgrupadores(raw: unknown, issues: PlanValidationIssue[]): Agrupador[] | null {
  if (!Array.isArray(raw)) {
    addIssue(issues, "shape", "agrupadores", "Debe ser un array");
    return null;
  }

  const agrupadores: Agrupador[] = [];

  raw.forEach((agrupadorRaw, index) => {
    const path = `agrupadores[${index}]`;

    if (!isRecord(agrupadorRaw)) {
      addIssue(issues, "shape", path, "Debe ser un objeto");
      return;
    }

    const id = asRequiredString(agrupadorRaw.id, `${path}.id`, issues);
    const nombre = asRequiredString(agrupadorRaw.nombre, `${path}.nombre`, issues);
    const tipo = asRequiredString(agrupadorRaw.tipo, `${path}.tipo`, issues);
    const orientacion =
      agrupadorRaw.orientacion === undefined
        ? undefined
        : asStringOrNull(agrupadorRaw.orientacion, `${path}.orientacion`, issues);

    const año =
      agrupadorRaw.año === undefined
        ? undefined
        : asStringOrNull(agrupadorRaw.año, `${path}.año`, issues);

    const cuatrimestre =
      agrupadorRaw.cuatrimestre === undefined
        ? undefined
        : asStringOrNull(agrupadorRaw.cuatrimestre, `${path}.cuatrimestre`, issues);

    const opcionesRaw = agrupadorRaw.opciones;
    if (!Array.isArray(opcionesRaw)) {
      addIssue(issues, "shape", `${path}.opciones`, "Debe ser un array de strings");
      return;
    }

    const opciones: string[] = [];
    opcionesRaw.forEach((opcionRaw, optionIndex) => {
      if (typeof opcionRaw !== "string" || opcionRaw.trim().length === 0) {
        addIssue(
          issues,
          "shape",
          `${path}.opciones[${optionIndex}]`,
          "Debe ser un string no vacío"
        );
        return;
      }

      opciones.push(opcionRaw);
    });

    if (!id || !nombre || !tipo) return;

    agrupadores.push({
      id,
      nombre,
      tipo,
      opciones,
      orientacion: orientacion ?? undefined,
      ...(año !== undefined ? { año } : {}),
      ...(cuatrimestre !== undefined ? { cuatrimestre } : {}),
    });
  });

  return agrupadores;
}

function addDuplicateIssues(
  values: string[],
  scopePath: string,
  messagePrefix: string,
  issues: PlanValidationIssue[]
) {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  counts.forEach((count, value) => {
    if (count > 1) {
      addIssue(
        issues,
        "consistency",
        scopePath,
        `${messagePrefix} duplicado: '${value}'`
      );
    }
  });
}

function validateConsistency(
  data: PlanData,
  context: ValidationContext,
  issues: PlanValidationIssue[],
  warnings: PlanValidationIssue[]
) {
  if (data.plan.plan_id !== context.carreraId) {
    addIssue(
      issues,
      "consistency",
      "plan.plan_id",
      `No coincide con la carrera solicitada ('${context.carreraId}')`
    );
  }

  if (data.plan.version_id !== context.versionId) {
    addIssue(
      issues,
      "consistency",
      "plan.version_id",
      `No coincide con la versión solicitada ('${context.versionId}')`
    );
  }

  addDuplicateIssues(
    data.materias.map((materia) => materia.id),
    "materias",
    "ID de materia",
    issues
  );

  addDuplicateIssues(
    data.agrupadores.map((agrupador) => agrupador.id),
    "agrupadores",
    "ID de agrupador",
    issues
  );

  const materiasById = new Map<string, Materia>();
  data.materias.forEach((materia) => {
    if (!materiasById.has(materia.id)) {
      materiasById.set(materia.id, materia);
    }
  });

  const agrupadoresById = new Map<string, Agrupador>();
  data.agrupadores.forEach((agrupador) => {
    if (!agrupadoresById.has(agrupador.id)) {
      agrupadoresById.set(agrupador.id, agrupador);
    }
  });

  data.materias.forEach((materia, materiaIndex) => {
    Object.keys(materia.correlativas).forEach((correlativaId) => {
      const existeMateria = materiasById.has(correlativaId);
      const existeAgrupador = agrupadoresById.has(correlativaId);

      if (!existeMateria && !existeAgrupador) {
        addIssue(
          issues,
          "consistency",
          `materias[${materiaIndex}].correlativas.${correlativaId}`,
          "Correlativa apunta a un ID inexistente"
        );
      }
    });

    if (materia.grupo_opcion === null) return;

    const agrupador = agrupadoresById.get(materia.grupo_opcion);
    if (!agrupador) {
      addIssue(
        issues,
        "consistency",
        `materias[${materiaIndex}].grupo_opcion`,
        "Referencia a agrupador inexistente"
      );
      return;
    }

    if (!agrupador.opciones.includes(materia.id)) {
      addIssue(
        issues,
        "consistency",
        `materias[${materiaIndex}].grupo_opcion`,
        "La materia refiere un agrupador que no la incluye en opciones"
      );
    }
  });

  data.agrupadores.forEach((agrupador, agrupadorIndex) => {
    agrupador.opciones.forEach((opcionId, opcionIndex) => {
      const materia = materiasById.get(opcionId);
      if (!materia) {
        addIssue(
          warnings,
          "consistency",
          `agrupadores[${agrupadorIndex}].opciones[${opcionIndex}]`,
          "Referencia a materia inexistente"
        );
        return;
      }

      if (materia.grupo_opcion !== agrupador.id) {
        addIssue(
          warnings,
          "consistency",
          `agrupadores[${agrupadorIndex}].opciones[${opcionIndex}]`,
          "Referencia cruzada inválida: la materia no apunta a este agrupador"
        );
      }
    });
  });
}

export function validatePlanData(
  raw: unknown,
  context: ValidationContext
): PlanValidationResult {
  const issues: PlanValidationIssue[] = [];

  if (!isRecord(raw)) {
    addIssue(issues, "shape", "$", "El JSON raíz debe ser un objeto");
    return { ok: false, kind: "shape", issues };
  }

  const plan = parsePlanInfo(raw.plan, context, issues);
  const materias = parseMaterias(raw.materias, issues);
  const agrupadores = parseAgrupadores(raw.agrupadores, issues);

  const shapeIssues = issues.filter((issue) => issue.kind === "shape");
  if (!plan || !materias || !agrupadores || shapeIssues.length > 0) {
    return {
      ok: false,
      kind: "shape",
      issues: shapeIssues,
    };
  }

  const data: PlanData = {
    plan,
    materias,
    agrupadores,
  };

  const warnings: PlanValidationIssue[] = [];
  validateConsistency(data, context, issues, warnings);

  const consistencyIssues = issues.filter((issue) => issue.kind === "consistency");
  if (consistencyIssues.length > 0) {
    return {
      ok: false,
      kind: "consistency",
      issues: consistencyIssues,
    };
  }

  return { ok: true, data, warnings };
}
