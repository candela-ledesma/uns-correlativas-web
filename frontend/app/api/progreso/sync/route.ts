import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/authz";
import { createAuditEvent } from "@/lib/db/audit";
import { getProgressSnapshot, upsertProgressSnapshot } from "@/lib/db/progressRepository";
import {
  resolveProgressSnapshotLww,
  sanitizeProgressState,
  type ProgressSnapshot,
} from "@/lib/db/progressSync";

const syncSchema = z.object({
  planId: z.string().min(1),
  versionId: z.string().min(1),
  localState: z.record(z.string(), z.string()).default({}),
  localUpdatedAt: z.string().datetime().nullable().optional(),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => null);
  const parsed = syncSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload invalido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { planId, versionId, reason } = parsed.data;

  const localSnapshot: ProgressSnapshot = {
    state: sanitizeProgressState(parsed.data.localState),
    updatedAt: parsed.data.localUpdatedAt ?? new Date().toISOString(),
  };

  const remoteSnapshot = await getProgressSnapshot({
    userId: session.user.id,
    planSlug: planId,
    versionId,
  });

  const resolution = resolveProgressSnapshotLww({
    local: localSnapshot,
    remote: remoteSnapshot,
  });

  if (resolution.source === "local") {
    const resolvedUpdatedAt = resolution.snapshot.updatedAt ?? new Date().toISOString();

    await upsertProgressSnapshot({
      userId: session.user.id,
      planSlug: planId,
      versionId,
      state: resolution.snapshot.state,
      updatedAt: resolvedUpdatedAt,
    });

    await createAuditEvent({
      actorUserId: session.user.id,
      actorEmail: session.user.email,
      actorRole: session.user.role,
      authProvider: "session",
      action: "PROGRESS_MIGRATED",
      entityType: "plan-progress",
      entityId: `${session.user.id}:${planId}:${versionId}`,
      before: remoteSnapshot.state,
      after: resolution.snapshot.state,
      reason: reason ?? "Migracion inicial desde almacenamiento local",
    });

    return NextResponse.json({
      state: resolution.snapshot.state,
      updatedAt: resolvedUpdatedAt,
      source: "local",
    });
  }

  return NextResponse.json({
    state: resolution.snapshot.state,
    updatedAt: resolution.snapshot.updatedAt,
    source: "remote",
  });
}
