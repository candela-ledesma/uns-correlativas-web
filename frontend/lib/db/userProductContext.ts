import { prisma } from "@/lib/db/prisma";
import { getCarreras, getCarreraById, resolveVersionPlanId } from "@/lib/db/carreraRepository";
import {
  getOrBootstrapEnrollments,
  getOrCreatePreference,
  updateEnrollments,
  upsertRecentPlan,
  updateOnboardingPreference,
  sanitizeCarreraIds,
} from "@/lib/db/userRepository";
import type {
  UserProductContextResponse,
  UserSessionSummaryResponse,
} from "@/lib/db/userProductContextTypes";

export async function getUserProductContext(
  userId: string,
): Promise<UserProductContextResponse> {
  const enrolledCareerIds = await getOrBootstrapEnrollments(userId);
  const preference = await getOrCreatePreference(userId, enrolledCareerIds);

  const [carreras, lastPlans, progressRows] = await Promise.all([
    getCarreras({ soloDisponibles: true }),
    prisma.planReciente.findMany({
      where: { userId },
      orderBy: { openedAt: "desc" },
      include: { versionPlan: { select: { carreraId: true, versionId: true } } },
    }),
    prisma.progresoPlan.findMany({
      where: { userId },
      select: {
        stateJson: true,
        versionPlan: { select: { carreraId: true } },
      },
    }),
  ]);

  const careerIdsWithProgress = Array.from(new Set(
    progressRows
      .filter((r) => {
        try {
          const s = JSON.parse(r.stateJson);
          return typeof s === "object" && s !== null && Object.keys(s).length > 0;
        } catch { return false; }
      })
      .map((r) => r.versionPlan.carreraId)
  ));

  const lastPlanByCareer = Object.fromEntries(
    lastPlans.map((row) => [
      row.careerId,
      {
        planSlug: row.versionPlan.carreraId,
        versionId: row.versionPlan.versionId,
        openedAt: row.openedAt.toISOString(),
      },
    ])
  ) as Record<string, { planSlug: string; versionId: string; openedAt: string }>;

  return {
    careers: carreras.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion,
    })),
    enrolledCareerIds,
    activeCareerId: preference.activeCareerId,
    onboardingCompletedAt: preference.onboardingCompletedAt?.toISOString() ?? null,
    onboardingDismissedAt: preference.onboardingDismissedAt?.toISOString() ?? null,
    shouldAutoShowOnboarding: !preference.onboardingCompletedAt && !preference.onboardingDismissedAt,
    lastPlanByCareer,
    careerIdsWithProgress,
  };
}

export async function getUserSessionSummary(userId: string): Promise<UserSessionSummaryResponse> {
  const context = await getUserProductContext(userId);

  const activeCareer = context.activeCareerId
    ? context.careers.find((career) => career.id === context.activeCareerId) ?? null
    : null;

  return {
    activeCareerId: context.activeCareerId,
    activeCareerName: activeCareer?.nombre ?? null,
    lastPlanByCareer: context.lastPlanByCareer,
  };
}

export async function updateUserCareerContext(input: {
  userId: string;
  enrolledCareerIds: string[];
  activeCareerId: string;
}) {
  const nextEnrolledCareerIds = await sanitizeCarreraIds(input.enrolledCareerIds);
  const sanitizedActive = await sanitizeCarreraIds([input.activeCareerId]);
  const activeCareerId = sanitizedActive[0] ?? null;

  if (nextEnrolledCareerIds.length === 0) {
    throw new Error("Debe haber al menos una carrera inscripta");
  }

  if (!activeCareerId || !nextEnrolledCareerIds.includes(activeCareerId)) {
    throw new Error("La carrera activa debe pertenecer a las carreras inscriptas");
  }

  await updateEnrollments(input.userId, nextEnrolledCareerIds, activeCareerId);

  return getUserProductContext(input.userId);
}

export async function recordPlanOpened(input: {
  userId: string;
  careerId: string;
  planSlug: string;
  versionId: string;
}) {
  const sanitized = await sanitizeCarreraIds([input.careerId]);
  const resolvedCareerId = sanitized[0];

  if (!resolvedCareerId || !(await getCarreraById(resolvedCareerId))) {
    throw new Error("Carrera invalida");
  }

  const planVersionId = await resolveVersionPlanId(input.planSlug, input.versionId);

  await upsertRecentPlan(input.userId, resolvedCareerId, planVersionId);

  return getUserProductContext(input.userId);
}

export async function updateOnboardingState(input: {
  userId: string;
  action: "dismiss" | "complete" | "reset";
}) {
  await updateOnboardingPreference(input.userId, input.action);
  return getUserProductContext(input.userId);
}
