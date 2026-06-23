import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/authz";
import { recordPlanOpened } from "@/lib/db/userProductContext";

const planVisitSchema = z.object({
  careerId: z.string().min(1),
  planId: z.string().min(1),
  versionId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => null);
  const parsed = planVisitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload invalido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const context = await recordPlanOpened({
      userId: session.user.id,
      careerId: parsed.data.careerId,
      planSlug: parsed.data.planId,
      versionId: parsed.data.versionId,
    });

    return NextResponse.json({
      activeCareerId: context.activeCareerId,
      lastPlanByCareer: context.lastPlanByCareer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar apertura";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
