import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/authz";
import {
  getUserProductContext,
  updateUserCareerContext,
} from "@/lib/db/userProductContext";

const updateContextSchema = z.object({
  enrolledCareerIds: z.array(z.string().min(1)).min(1),
  activeCareerId: z.string().min(1),
});

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const context = await getUserProductContext(session.user.id);

  return NextResponse.json(context);
}

export async function PUT(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => null);
  const parsed = updateContextSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload invalido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const updated = await updateUserCareerContext({
      userId: session.user.id,
      enrolledCareerIds: parsed.data.enrolledCareerIds,
      activeCareerId: parsed.data.activeCareerId,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar contexto";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
