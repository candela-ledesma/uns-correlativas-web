import { prisma } from "@/lib/db/prisma";
import {
  sanitizeProgressState,
  type ProgressSnapshot,
  type ProgressState,
} from "@/lib/db/progressSync";

async function resolvePlanVersionId(planSlug: string, versionId: string): Promise<string> {
  const pv = await prisma.planVersion.findUnique({
    where: { planSlug_versionId: { planSlug, versionId } },
    select: { id: true },
  });
  if (!pv) throw new Error(`Plan no encontrado: ${planSlug}@${versionId}`);
  return pv.id;
}

export async function getProgressSnapshot(params: {
  userId: string;
  planSlug: string;
  versionId: string;
}): Promise<ProgressSnapshot> {
  const planVersionId = await resolvePlanVersionId(params.planSlug, params.versionId);

  const row = await prisma.userPlanProgress.findUnique({
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
  const planVersionId = await resolvePlanVersionId(params.planSlug, params.versionId);

  return prisma.userPlanProgress.upsert({
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
