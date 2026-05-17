import { NextResponse } from "next/server";
import { CARRERAS } from "@/lib/data/carreras";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const dbCarreras = await prisma.carreraConfig.findMany({ where: { disponible: true } });
  const staticIds = new Set(CARRERAS.map((c) => c.id as string));
  const depMap = new Map(dbCarreras.map((c) => [c.id, c.departamento ?? null]));

  const staticPlanes = CARRERAS.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    descripcion: c.descripcion,
    departamento: depMap.get(c.id as string) ?? null,
    disponible: c.disponible ?? true,
  }));

  const dynamicPlanes = dbCarreras
    .filter((c) => !staticIds.has(c.id))
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion,
      departamento: c.departamento ?? null,
      disponible: c.disponible,
    }));

  return NextResponse.json({ planes: [...staticPlanes, ...dynamicPlanes] });
}
