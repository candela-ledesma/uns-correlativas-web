import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { getCarreras } from "@/lib/db/carreraRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [carreras, dbPlanes] = await Promise.all([
    getCarreras({ soloDisponibles: false }),
    prisma.plan.findMany({
      where: { estado: "PUBLICADO", esBackup: false },
      select: { slug: true, fuente: true, createdAt: true, planJson: true },
    }),
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
