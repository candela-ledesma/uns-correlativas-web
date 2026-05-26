import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { PROMPT_VERSION, GENERIC_SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== Role.ADMIN && session.user.realRole !== Role.ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await prisma.adminConfig.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({
    config: config
      ? { ...config, version: PROMPT_VERSION, genericPrompt: config.genericPrompt ?? GENERIC_SYSTEM_PROMPT }
      : null,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== Role.ADMIN && session.user.realRole !== Role.ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { systemPrompt, genericPrompt } = body as { systemPrompt?: unknown; genericPrompt?: unknown };
  if (typeof systemPrompt !== "string" && typeof genericPrompt !== "string") {
    return NextResponse.json({ error: "Campo requerido: systemPrompt o genericPrompt (string)" }, { status: 400 });
  }

  const config = await prisma.adminConfig.upsert({
    where: { id: "singleton" },
    update: {
      ...(typeof systemPrompt === "string" && { systemPrompt: systemPrompt.trim(), version: PROMPT_VERSION }),
      ...(typeof genericPrompt === "string" && { genericPrompt: genericPrompt.trim() }),
    },
    create: {
      id: "singleton",
      systemPrompt: typeof systemPrompt === "string" ? systemPrompt.trim() : "",
      genericPrompt: typeof genericPrompt === "string" ? genericPrompt.trim() : GENERIC_SYSTEM_PROMPT,
      version: PROMPT_VERSION,
    },
  });

  return NextResponse.json({ ok: true, version: config.version, updatedAt: config.updatedAt });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== Role.ADMIN && session.user.realRole !== Role.ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.adminConfig.deleteMany({ where: { id: "singleton" } });
  return NextResponse.json({ ok: true });
}
