import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  planId: z.string().min(1),
  versionId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { planId, versionId } = parsed.data;

  const planVersion = await prisma.planVersion.findUnique({
    where: { planSlug_versionId: { planSlug: planId, versionId } },
    select: { id: true },
  });

  if (!planVersion) {
    return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
  }

  const progress = await prisma.userPlanProgress.findUnique({
    where: { userId_planVersionId: { userId: session.user.id, planVersionId: planVersion.id } },
    select: { stateJson: true },
  });

  if (!progress) {
    return NextResponse.json({ error: "No hay progreso guardado para este plan" }, { status: 404 });
  }

  const share = await prisma.progressShare.create({
    data: {
      planVersionId: planVersion.id,
      stateJson: progress.stateJson,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({ token: share.token });
}
