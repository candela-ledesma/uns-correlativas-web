import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireAuth } from "@/lib/auth/authz";
import { prisma } from "@/lib/db/prisma";
import { resolvePlanVersionId } from "@/lib/db/carreraRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  planId: z.string().min(1),
  versionId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const rawBody = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { planId, versionId } = parsed.data;

  let planVersionId: string;
  try {
    planVersionId = await resolvePlanVersionId(planId, versionId);
  } catch {
    return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
  }

  const progress = await prisma.userPlanProgress.findUnique({
    where: { userId_planVersionId: { userId: session.user.id, planVersionId } },
    select: { stateJson: true },
  });

  if (!progress) {
    return NextResponse.json({ error: "No hay progreso guardado para este plan" }, { status: 404 });
  }

  const share = await prisma.progressShare.create({
    data: {
      token: randomBytes(32).toString("hex"),
      planVersionId,
      stateJson: progress.stateJson,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({ token: share.token });
}
