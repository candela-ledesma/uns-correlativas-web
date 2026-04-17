import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { recordPlanOpened } from "@/lib/userProductContext";

const planVisitSchema = z.object({
  careerId: z.string().min(1),
  planId: z.string().min(1),
  versionId: z.string().min(1),
});

function unauthorized() {
  return NextResponse.json({ error: "No autenticado" }, { status: 401 });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return unauthorized();
  }

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
      planId: parsed.data.planId,
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
