import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import path from "path";
import fs from "fs/promises";
import { createAuditEvent } from "@/lib/db/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR_GEMINI = path.join(process.cwd(), "data", "gemini");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const filePath = path.join(DATA_DIR_GEMINI, `${slug}_pendiente.json`);

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return new Response(raw, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const filePath = path.join(DATA_DIR_GEMINI, `${slug}_pendiente.json`);

  const { motivo } = await req.json().catch(() => ({ motivo: undefined })) as { motivo?: string };

  try {
    await fs.unlink(filePath);
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await createAuditEvent({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role,
    action: "PLAN_DISCARDED",
    entityType: "plan",
    entityId: slug,
    reason: motivo ?? null,
    after: null,
  }).catch(() => {});

  return NextResponse.json({ ok: true, slug });
}
