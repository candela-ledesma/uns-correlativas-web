import { NextResponse } from "next/server";
import { CARRERAS } from "@/lib/data/carreras";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEPTOS_FILE = path.join(process.cwd(), "data", "departamentos.json");

async function leerDeptos(): Promise<Record<string, string>> {
  const raw = await fs.readFile(DEPTOS_FILE, "utf-8").catch(() => "{}");
  return JSON.parse(raw);
}

export async function GET() {
  const deptos = await leerDeptos();

  const planes = CARRERAS.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    descripcion: c.descripcion,
    departamento: deptos[c.id] ?? null,
    disponible: c.disponible ?? true,
  }));

  return NextResponse.json({ planes });
}
