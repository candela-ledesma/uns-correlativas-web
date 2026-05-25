import { prisma } from "@/lib/db/prisma";
import { resolveCarreraVersionId } from "@/lib/db/carreraRepository";
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
  const carreraVersionId = await resolveCarreraVersionId(params.planSlug, params.versionId);

  const row = await prisma.userPlanProgress.findUnique({
    where: { userId_carreraVersionId: { userId: params.userId, carreraVersionId } },
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
  const carreraVersionId = await resolveCarreraVersionId(params.planSlug, params.versionId);

  return prisma.userPlanProgress.upsert({
    where: { userId_carreraVersionId: { userId: params.userId, carreraVersionId } },
    update: {
      stateJson: JSON.stringify(params.state),
      updatedAt: new Date(params.updatedAt),
    },
    create: {
      userId: params.userId,
      carreraVersionId,
      stateJson: JSON.stringify(params.state),
      updatedAt: new Date(params.updatedAt),
    },
  });
}
