import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { createAuditEvent } from "@/lib/db/audit";
import { normalizeReason } from "@/lib/auth/authz";
import { Role } from "@/lib/auth/roles";

const schema = z.object({
  role: z.enum([Role.USER, Role.MODERATOR, Role.ADMIN]),
  reason: z.string().trim().min(3).max(500),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload invalido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const reason = normalizeReason(parsed.data.reason);
  if (!reason) {
    return NextResponse.json(
      { error: "El motivo es obligatorio" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });

  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const previousRole = target.role;
  if (previousRole === parsed.data.role) {
    return NextResponse.json({
      ok: true,
      user: { id: target.id, email: target.email, role: target.role },
      unchanged: true,
    });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: parsed.data.role },
  });

  await createAuditEvent({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    actorRole: session.user.role,
    authProvider: "session",
    action: "ROLE_CHANGED",
    entityType: "user",
    entityId: updated.id,
    before: { role: previousRole },
    after: { role: updated.role },
    reason,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      email: updated.email,
      role: updated.role,
    },
  });
}
