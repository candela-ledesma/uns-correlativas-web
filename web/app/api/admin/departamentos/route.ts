import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FILE = path.join(process.cwd(), "data", "departamentos.json");

async function leer(): Promise<Record<string, string>> {
  const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
  return JSON.parse(raw);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(await leer());
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug, departamento }: { slug: string; departamento: string } = await req.json();
  if (!slug) return NextResponse.json({ error: "Falta slug" }, { status: 400 });

  const datos = await leer();
  if (departamento?.trim()) {
    datos[slug] = departamento.trim();
  } else {
    delete datos[slug];
  }

  await fs.writeFile(FILE, JSON.stringify(datos, null, 2), "utf-8");
  return NextResponse.json({ ok: true, slug, departamento: datos[slug] ?? null });
}
