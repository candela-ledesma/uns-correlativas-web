import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { createAuditEvent } from "@/lib/db/audit";
import { getPendingPlanBySlug, deletePendingPlansBySlug } from "@/lib/services/planRepository";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const row = await getPendingPlanBySlug(slug);
  if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return new Response(row.planJson, { headers: { "Content-Type": "application/json; charset=utf-8" } });
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
  const { motivo } = await req.json().catch(() => ({ motivo: undefined })) as { motivo?: string };

  const count = await deletePendingPlansBySlug(slug);
  if (count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

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
