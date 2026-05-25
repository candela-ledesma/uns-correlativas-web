import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const departamentos = await prisma.departamento.findMany({ orderBy: { nombre: "asc" } });
  return NextResponse.json(departamentos);
}

// PUT: asigna un departamento (por nombre) a una carrera.
// Crea el departamento si no existe. Mantiene compatibilidad con el frontend actual.
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug, departamento }: { slug: string; departamento: string } = await req.json();
  if (!slug) return NextResponse.json({ error: "Falta slug" }, { status: 400 });

  const nombre = departamento?.trim() || null;

  if (!nombre) {
    await prisma.carrera.update({ where: { id: slug }, data: { departamentoId: null } });
    return NextResponse.json({ ok: true, slug, departamento: null });
  }

  const id = toSlug(nombre);
  await prisma.departamento.upsert({
    where: { id },
    update: { nombre },
    create: { id, nombre },
  });

  await prisma.carrera.update({ where: { id: slug }, data: { departamentoId: id } });

  return NextResponse.json({ ok: true, slug, departamento: nombre });
}
