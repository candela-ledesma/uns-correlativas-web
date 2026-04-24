import { prisma } from "@/lib/db/prisma";

function safeJsonStringify(value: unknown) {
  if (typeof value === "undefined") return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "metadata-no-serializable" });
  }
}

export async function createUserActivity(input: {
  userId: string;
  type:
    | "MATERIA_STATUS_CHANGED"
    | "ACTIVE_CAREER_CHANGED"
    | "PLAN_OPENED"
    | "ONBOARDING_COMPLETED"
    | "ONBOARDING_DISMISSED"
    | "ONBOARDING_RESET";
  careerId?: string | null;
  planId?: string | null;
  versionId?: string | null;
  materiaKey?: string | null;
  fromState?: string | null;
  toState?: string | null;
  metadata?: unknown;
}) {
  await prisma.userActivity.create({
    data: {
      userId:      input.userId,
      type:        input.type,
      careerId:    input.careerId    ?? null,
      planId:      input.planId      ?? null,
      versionId:   input.versionId   ?? null,
      materiaKey:  input.materiaKey  ?? null,
      fromState:   input.fromState   ?? null,
      toState:     input.toState     ?? null,
      metadataJson: safeJsonStringify(input.metadata),
    },
  });
}
