import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  planId: z.string().min(1),
  versionId: z.string().min(1),
  state: z.record(z.string(), z.string()),
});

export async function POST(request: Request) {
  const session = await auth();

  const rawBody = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { planId, versionId, state } = parsed.data;

  const share = await prisma.progressShare.create({
    data: {
      planId,
      versionId,
      stateJson: JSON.stringify(state),
      createdBy: session?.user?.id ?? null,
    },
  });

  return NextResponse.json({ token: share.token });
}
