import { NextResponse } from "next/server";
import { getCarreras } from "@/lib/db/carreraRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const carreras = await getCarreras({ soloDisponibles: true });

  return NextResponse.json({
    planes: carreras.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion,
      departamento: c.departamento ?? null,
      disponible: c.disponible,
    })),
  });
}
