import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;

  const share = await prisma.progressShare.findUnique({
    where: { token },
    include: { carreraVersion: { select: { carreraId: true, versionId: true } } },
  });

  if (!share) {
    return NextResponse.json({ error: "Link no encontrado o expirado" }, { status: 404 });
  }

  let state: Record<string, string>;
  try {
    state = JSON.parse(share.stateJson) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "Datos corruptos" }, { status: 500 });
  }

  return NextResponse.json({
    planId: share.carreraVersion.carreraId,
    versionId: share.carreraVersion.versionId,
    state,
    createdAt: share.createdAt,
  });
}
