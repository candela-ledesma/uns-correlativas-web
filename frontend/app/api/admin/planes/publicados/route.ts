import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/authz";
import { getCarreras } from "@/lib/db/carreraRepository";
import { getPublishedPlansRaw } from "@/lib/db/planRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const [carreras, dbPlanes] = await Promise.all([
    getCarreras({ soloDisponibles: false }),
    getPublishedPlansRaw(),
  ]);

  const planesMap = new Map(dbPlanes.map((p) => [p.slug, p]));

  const planes = carreras.map((carrera) => {
    const version = carrera.versions.find((v) => v.versionId === carrera.defaultVersionId)
      ?? carrera.versions[0];
    const planRow = planesMap.get(carrera.id);

    let materias: number | null = null;
    let fuente: string | null = null;
    let savedAt: string | null = null;

    if (planRow) {
      try {
        const data = JSON.parse(planRow.planJson);
        materias = (data.materias ?? []).length;
        fuente = planRow.fuente;
        savedAt = planRow.createdAt.toISOString();
      } catch { /* skip */ }
    }

    return {
      id: carrera.id,
      nombre: carrera.nombre,
      departamento: carrera.departamento?.nombre ?? null,
      disponible: carrera.disponible,
      jsonFile: version?.jsonFile ?? `${carrera.id}.json`,
      tieneLocal: !!planRow && planRow.fuente === "PARSER",
      tieneGemini: !!planRow && planRow.fuente === "GEMINI",
      materias,
      fuente,
      savedAt,
    };
  });

  return NextResponse.json({ planes });
}
