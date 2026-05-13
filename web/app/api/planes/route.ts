import { NextResponse } from "next/server";
import { CARRERAS } from "@/lib/data/carreras";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const planes = CARRERAS.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    descripcion: c.descripcion,
    departamento: c.departamento ?? null,
    disponible: c.disponible ?? true,
  }));

  return NextResponse.json({ planes });
}
