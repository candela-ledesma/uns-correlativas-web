import { prisma } from "@/lib/db/prisma";
import { resolveVersionPlanId } from "@/lib/db/carreraRepository";
import {
  sanitizeProgressState,
  type ProgressSnapshot,
  type ProgressState,
} from "@/lib/db/progressSync";

export async function getProgressSnapshot(params: {
  userId: string;
  planSlug: string;
  versionId: string;
}): Promise<ProgressSnapshot> {
  const planVersionId = await resolveVersionPlanId(params.planSlug, params.versionId);

  const row = await prisma.progresoPlan.findUnique({
    where: { userId_planVersionId: { userId: params.userId, planVersionId } },
  });

  if (!row) return { state: {}, updatedAt: null };

  let parsed: unknown = {};
  try {
    parsed = JSON.parse(row.stateJson);
  } catch {
    parsed = {};
  }

  return {
    state: sanitizeProgressState(parsed),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertProgressSnapshot(params: {
  userId: string;
  planSlug: string;
  versionId: string;
  state: ProgressState;
  updatedAt: string;
}) {
  const planVersionId = await resolveVersionPlanId(params.planSlug, params.versionId);

  return prisma.progresoPlan.upsert({
    where: { userId_planVersionId: { userId: params.userId, planVersionId } },
    update: {
      stateJson: JSON.stringify(params.state),
      updatedAt: new Date(params.updatedAt),
    },
    create: {
      userId: params.userId,
      planVersionId,
      stateJson: JSON.stringify(params.state),
      updatedAt: new Date(params.updatedAt),
    },
  });
}
