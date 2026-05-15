import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { PROMPT_VERSION } from "@/lib/ai/prompt";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await prisma.adminConfig.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({
    config: config ? { ...config, version: PROMPT_VERSION } : null,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { systemPrompt } = body as { systemPrompt?: unknown };
  if (typeof systemPrompt !== "string") {
    return NextResponse.json({ error: "Campo requerido: systemPrompt (string)" }, { status: 400 });
  }

  const config = await prisma.adminConfig.upsert({
    where: { id: "singleton" },
    update: { systemPrompt: systemPrompt.trim(), version: PROMPT_VERSION },
    create: { id: "singleton", systemPrompt: systemPrompt.trim(), version: PROMPT_VERSION },
  });

  return NextResponse.json({ ok: true, version: config.version, updatedAt: config.updatedAt });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.adminConfig.deleteMany({ where: { id: "singleton" } });
  return NextResponse.json({ ok: true });
}
