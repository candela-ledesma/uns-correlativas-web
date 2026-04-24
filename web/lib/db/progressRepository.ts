import { prisma } from "@/lib/db/prisma";
import {
  sanitizeProgressState,
  type ProgressSnapshot,
  type ProgressState,
} from "@/lib/db/progressSync";

export async function getProgressSnapshot(params: {
  userId: string;
  planId: string;
  versionId: string;
}): Promise<ProgressSnapshot> {
  const row = await prisma.userPlanProgress.findUnique({
    where: {
      userId_planId_versionId: {
        userId: params.userId,
        planId: params.planId,
        versionId: params.versionId,
      },
    },
  });

  if (!row) {
    return {
      state: {},
      updatedAt: null,
    };
  }

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
  planId: string;
  versionId: string;
  state: ProgressState;
  updatedAt: string;
}) {
  return prisma.userPlanProgress.upsert({
    where: {
      userId_planId_versionId: {
        userId: params.userId,
        planId: params.planId,
        versionId: params.versionId,
      },
    },
    update: {
      stateJson: JSON.stringify(params.state),
      updatedAt: new Date(params.updatedAt),
    },
    create: {
      userId: params.userId,
      planId: params.planId,
      versionId: params.versionId,
      stateJson: JSON.stringify(params.state),
      updatedAt: new Date(params.updatedAt),
    },
  });
}
