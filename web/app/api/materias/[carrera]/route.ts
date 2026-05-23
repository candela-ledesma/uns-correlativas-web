import { NextResponse } from "next/server";
import {
  formatValidationIssues,
  loadPlanData,
} from "@/lib/data/planDataLoader";

export async function GET(
  req: Request,
  context: { params: Promise<{ carrera: string }> }
) {
  try {
    const { carrera: carreraId } = await context.params;
    const requestedVersionId = new URL(req.url).searchParams.get("v");
    const result = await loadPlanData(carreraId, requestedVersionId);

    if (result.status === "not-found") {
      return NextResponse.json(
        { error: "Carrera no encontrada" },
        { status: 404 }
      );
    }

    if (result.status === "unavailable") {
      const mensaje =
        result.reason === "version-not-found"
          ? "Versión no encontrada"
          : "Plan no disponible";

      return NextResponse.json(
        { error: mensaje },
        { status: 404 }
      );
    }

    if (result.status === "invalid") {
      const includeDetails = process.env.NODE_ENV !== "production";
      const code =
        result.errorKind === "shape"
          ? "INVALID_PLAN_SHAPE"
          : "INVALID_PLAN_CONSISTENCY";
      const error =
        result.errorKind === "shape"
          ? "El plan tiene un formato inválido"
          : "El plan tiene inconsistencias internas";

      return NextResponse.json(
        {
          error,
          code,
          ...(includeDetails
            ? { details: formatValidationIssues(result.issues, 20) }
            : {}),
        },
        { status: 422 }
      );
    }

    if (result.status === "error") {
      return NextResponse.json(
        { error: "No se pudieron cargar las materias" },
        { status: 500 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error: unknown) {
    // Sanitize error logging - don't log full URL or sensitive stack traces
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[api/materias] Error loading plan data", { 
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      // Only log in development to avoid info disclosure
      ...(process.env.NODE_ENV === "development" && { errorMessage })
    });
    return NextResponse.json(
      { error: "No se pudieron cargar las materias" },
      { status: 500 }
    );
  }
}