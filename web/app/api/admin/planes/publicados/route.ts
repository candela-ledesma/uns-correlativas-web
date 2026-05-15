import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { CARRERAS } from "@/lib/data/carreras";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Combina carreras estáticas (carreras.ts) + carreras dinámicas (DB)
  const [dbCarreras, dbPlanes] = await Promise.all([
    prisma.carreraConfig.findMany(),
    prisma.planPublicado.findMany({ select: { slug: true, fuente: true, savedAt: true, planJson: true } }),
  ]);

  const deptosMap = new Map(dbCarreras.map((c) => [c.id, c.departamento ?? null]));

  const planesMap = new Map(dbPlanes.map((p) => [p.slug, p]));

  // Carreras estáticas
  const staticPlanes = CARRERAS.map((carrera) => {
    const version = carrera.versions.find((v) => v.versionId === carrera.defaultVersionId) ?? carrera.versions[0];
    const slug = carrera.id as string;
    const planRow = planesMap.get(slug);

    let materias: number | null = null;
    let fuente: string | null = null;
    let savedAt: string | null = null;

    if (planRow) {
      try {
        const data = JSON.parse(planRow.planJson);
        materias = (data.materias ?? []).length;
        fuente = planRow.fuente;
        savedAt = planRow.savedAt.toISOString();
      } catch { /* skip */ }
    }

    return {
      id: slug,
      nombre: carrera.nombre,
      departamento: deptosMap.get(slug) ?? null,
      disponible: carrera.disponible ?? true,
      jsonFile: version?.jsonFile ?? `${slug}.json`,
      tieneLocal: !!planRow && planRow.fuente === "parser",
      tieneGemini: !!planRow && planRow.fuente === "gemini",
      materias,
      fuente,
      savedAt,
      _source: "static" as const,
    };
  });

  // Carreras dinámicas (solo las que no están en estáticas)
  const staticIds = new Set(CARRERAS.map((c) => c.id as string));
  const dynamicPlanes = dbCarreras
    .filter((c) => !staticIds.has(c.id))
    .map((carrera) => {
      const planRow = planesMap.get(carrera.id);
      let materias: number | null = null;
      let fuente: string | null = null;
      let savedAt: string | null = null;

      if (planRow) {
        try {
          const data = JSON.parse(planRow.planJson);
          materias = (data.materias ?? []).length;
          fuente = planRow.fuente;
          savedAt = planRow.savedAt.toISOString();
        } catch { /* skip */ }
      }

      return {
        id: carrera.id,
        nombre: carrera.nombre,
        departamento: carrera.departamento ?? null,
        disponible: carrera.disponible,
        jsonFile: carrera.jsonFile,
        tieneLocal: !!planRow && planRow.fuente === "parser",
        tieneGemini: !!planRow && planRow.fuente === "gemini",
        materias,
        fuente,
        savedAt,
        _source: "dynamic" as const,
      };
    });

  return NextResponse.json({ planes: [...staticPlanes, ...dynamicPlanes] });
}
