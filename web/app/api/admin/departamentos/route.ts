import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const carreras = await prisma.carreraConfig.findMany({ select: { id: true, departamento: true } });
  const result: Record<string, string> = {};
  for (const c of carreras) {
    if (c.departamento) result[c.id] = c.departamento;
  }

  return NextResponse.json(result);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug, departamento }: { slug: string; departamento: string } = await req.json();
  if (!slug) return NextResponse.json({ error: "Falta slug" }, { status: 400 });

  const value = departamento?.trim() || null;

  await prisma.carreraConfig.upsert({
    where: { id: slug },
    update: { departamento: value },
    create: {
      id: slug,
      nombre: slug,
      jsonFile: `${slug}.json`,
      departamento: value,
      disponible: true,
    },
  });

  return NextResponse.json({ ok: true, slug, departamento: value });
}
