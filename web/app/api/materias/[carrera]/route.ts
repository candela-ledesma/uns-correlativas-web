import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getCarreraById, getVersionForCarrera } from "@/lib/carreras";
import type { PlanData } from "@/app/types/plan";

function ensurePlanIdentity(
  raw: unknown,
  carreraId: string,
  versionId: string
): PlanData | null {
  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, any>;
  if (!data.plan || typeof data.plan !== "object") return null;

  const plan = data.plan as Record<string, any>;

  if (plan.plan_id && String(plan.plan_id) !== String(carreraId)) return null;
  if (plan.version_id && String(plan.version_id) !== String(versionId)) return null;

  plan.plan_id = carreraId;
  plan.version_id = versionId;

  return data as PlanData;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ carrera: string }> }
) {
  try {
    const { carrera: carreraId } = await context.params;
    const carrera = getCarreraById(carreraId);

    const requestedVersionId = new URL(req.url).searchParams.get("v");
    const version = getVersionForCarrera(carreraId, requestedVersionId);

    if (!carrera) {
      return NextResponse.json(
        { error: "Carrera no encontrada" },
        { status: 404 }
      );
    }

    if (!version || version.disponible === false) {
      return NextResponse.json(
        { error: "Versión no encontrada" },
        { status: 404 }
      );
    }

    const filePath = path.join(process.cwd(), "data", version.jsonFile);
    const fileContents = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(fileContents);

    const data = ensurePlanIdentity(parsed, carreraId, version.versionId);
    if (!data) {
      return NextResponse.json(
        { error: "Plan inválido" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return NextResponse.json(
        { error: "Plan no disponible" },
        { status: 404 }
      );
    }

    console.error("Error en API:", error);
    return NextResponse.json(
      { error: "No se pudieron cargar las materias" },
      { status: 500 }
    );
  }
}