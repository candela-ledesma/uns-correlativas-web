import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/roles";

const MODERATOR_ACTIONS = new Set([
  "AUTH_SIGNIN",
  "AUTH_SIGNUP",
  "PROGRESS_UPDATED",
  "PROGRESS_RESET",
  "PROGRESS_MIGRATED",
]);

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (session.user.role === Role.USER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const logs = await prisma.auditLog.findMany({
    where:
      session.user.role === Role.MODERATOR
        ? {
            action: {
              in: Array.from(MODERATOR_ACTIONS),
            },
          }
        : undefined,
    orderBy: {
      createdAt: "desc",
    },
    take: Number.isFinite(limit) ? limit : 50,
  });

  return NextResponse.json({
    items: logs.map((log) => ({
      id: log.id,
      actorUserId: log.actorUserId,
      actorEmail: log.actorEmail,
      actorRole: log.actorRole,
      authProvider: log.authProvider,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      reason: log.reason,
      createdAt: log.createdAt.toISOString(),
      before: log.beforeJson ? JSON.parse(log.beforeJson) : null,
      after: log.afterJson ? JSON.parse(log.afterJson) : null,
    })),
  });
}
