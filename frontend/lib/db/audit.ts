import { prisma } from "@/lib/db/prisma";
import type { AppRole } from "@/lib/auth/roles";

type JsonLike = Record<string, unknown> | unknown[] | null;

type AuditInput = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: AppRole | null;
  authProvider?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: JsonLike;
  after?: JsonLike;
  reason?: string | null;
  metadata?: JsonLike;
};

function safeStringify(value: JsonLike | undefined) {
  if (typeof value === "undefined") return null;

  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "no-serializable" });
  }
}

export async function createAuditEvent(input: AuditInput) {
  const reason = input.reason?.trim() || null;

  await prisma.registroAuditoria.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorEmail: input.actorEmail ?? null,
      actorRole: input.actorRole ?? null,
      authProvider: input.authProvider ?? "unknown",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: safeStringify(input.before),
      afterJson: safeStringify(input.after),
      reason,
      metadataJson: safeStringify(input.metadata),
    },
  });
}
