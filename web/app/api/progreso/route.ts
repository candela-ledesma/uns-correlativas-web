import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { createAuditEvent } from "@/lib/audit";
import { getProgressSnapshot, upsertProgressSnapshot } from "@/lib/progressRepository";
import {
  resolveProgressSnapshotLww,
  sanitizeProgressState,
  type ProgressSnapshot,
} from "@/lib/progressSync";

const updateSchema = z.object({
  planId: z.string().min(1),
  versionId: z.string().min(1),
  state: z.record(z.string(), z.string()).default({}),
  clientUpdatedAt: z.string().datetime().optional(),
  reason: z.string().trim().max(500).optional(),
});

const resetSchema = z.object({
  planId: z.string().min(1),
  versionId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

function unauthorized() {
  return NextResponse.json({ error: "No autenticado" }, { status: 401 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const url = new URL(request.url);
  const planId = url.searchParams.get("planId");
  const versionId = url.searchParams.get("versionId");

  if (!planId || !versionId) {
    return NextResponse.json(
      { error: "Faltan planId y versionId" },
      { status: 400 }
    );
  }

  const snapshot = await getProgressSnapshot({
    userId: session.user.id,
    planId,
    versionId,
  });

  return NextResponse.json({
    state: snapshot.state,
    updatedAt: snapshot.updatedAt,
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) return unauthorized();

  const rawBody = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload invalido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { planId, versionId, reason } = parsed.data;
  const localState = sanitizeProgressState(parsed.data.state);

  const localSnapshot: ProgressSnapshot = {
    state: localState,
    updatedAt: parsed.data.clientUpdatedAt ?? new Date().toISOString(),
  };

  const remoteSnapshot = await getProgressSnapshot({
    userId: session.user.id,
    planId,
    versionId,
  });

  const resolution = resolveProgressSnapshotLww({
    local: localSnapshot,
    remote: remoteSnapshot,
  });

  if (resolution.source === "local") {
    await upsertProgressSnapshot({
      userId: session.user.id,
      planId,
      versionId,
      state: resolution.snapshot.state,
      updatedAt: resolution.snapshot.updatedAt ?? new Date().toISOString(),
    });

    await createAuditEvent({
      actorUserId: session.user.id,
      actorEmail: session.user.email,
      actorRole: session.user.role,
      authProvider: "session",
      action: "PROGRESS_UPDATED",
      entityType: "plan-progress",
      entityId: `${session.user.id}:${planId}:${versionId}`,
      before: remoteSnapshot.state,
      after: resolution.snapshot.state,
      reason: reason ?? "Actualizacion de progreso",
    });
  }

  return NextResponse.json({
    state: resolution.snapshot.state,
    updatedAt: resolution.snapshot.updatedAt,
    source: resolution.source,
  });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) return unauthorized();

  const rawBody = await request.json().catch(() => null);
  const parsed = resetSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload invalido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { planId, versionId, reason } = parsed.data;
  const previous = await getProgressSnapshot({
    userId: session.user.id,
    planId,
    versionId,
  });

  const updatedAt = new Date().toISOString();

  await upsertProgressSnapshot({
    userId: session.user.id,
    planId,
    versionId,
    state: {},
    updatedAt,
  });

  await createAuditEvent({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    actorRole: session.user.role,
    authProvider: "session",
    action: "PROGRESS_RESET",
    entityType: "plan-progress",
    entityId: `${session.user.id}:${planId}:${versionId}`,
    before: previous.state,
    after: {},
    reason: reason ?? "Reinicio de progreso",
  });

  return NextResponse.json({
    state: {},
    updatedAt,
  });
}
