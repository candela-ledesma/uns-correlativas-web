import { prisma } from "@/lib/db/prisma";
import { CARRERAS, getCarreraById } from "@/lib/data/carreras";
import type {
  UserProductContextResponse,
  UserSessionSummaryResponse,
} from "@/lib/db/userProductContextTypes";
import { createUserActivity } from "@/lib/db/userActivity";

const DEFAULT_ACTIVITY_LIMIT = 25;

const AVAILABLE_CARRERA_IDS = CARRERAS
  .filter((carrera) => carrera.disponible !== false)
  .map((carrera) => carrera.id);

type CarreraId = (typeof AVAILABLE_CARRERA_IDS)[number];

const CARRERA_ORDER = new Map<CarreraId, number>(
  AVAILABLE_CARRERA_IDS.map((id, index) => [id, index])
);
const AVAILABLE_CARRERA_SET = new Set<CarreraId>(AVAILABLE_CARRERA_IDS);

function isAvailableCarreraId(carreraId: string): carreraId is CarreraId {
  return AVAILABLE_CARRERA_SET.has(carreraId as CarreraId);
}

function parseMetadata(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function sanitizeCarreraIds(carreraIds: string[]): CarreraId[] {
  const unique = Array.from(new Set(carreraIds));
  return unique
    .filter(isAvailableCarreraId)
    .sort((a, b) => (CARRERA_ORDER.get(a) ?? Number.MAX_SAFE_INTEGER) - (CARRERA_ORDER.get(b) ?? Number.MAX_SAFE_INTEGER));
}

async function ensureEnrollmentBootstrap(userId: string) {
  const existing = await prisma.userCareerEnrollment.findMany({
    where: { userId },
    select: { careerId: true },
  });

  if (existing.length > 0) {
    return sanitizeCarreraIds(existing.map((item) => item.careerId));
  }

  // Primer login: inferir carreras desde el progreso existente usando planVersion.planSlug
  const userProgressCareers = await prisma.userPlanProgress.findMany({
    where: { userId },
    select: { planVersion: { select: { planSlug: true } } },
    distinct: ["planVersionId"],
  });

  const fromProgress = sanitizeCarreraIds(userProgressCareers.map((item) => item.planVersion.planSlug));
  const fallbackCareer = AVAILABLE_CARRERA_IDS[0];
  const initialCareers = fromProgress.length > 0
    ? fromProgress
    : fallbackCareer
      ? [fallbackCareer]
      : [];

  if (initialCareers.length === 0) return [];

  await prisma.userCareerEnrollment.createMany({
    data: initialCareers.map((careerId) => ({ userId, careerId })),
    skipDuplicates: true,
  });

  return initialCareers;
}

async function ensurePreferenceRow(userId: string, enrolledCareerIds: string[]) {
  const defaultActiveCareerId = enrolledCareerIds[0] ?? null;

  let preference = await prisma.userPreference.findUnique({ where: { userId } });

  if (!preference) {
    try {
      preference = await prisma.userPreference.create({
        data: { userId, activeCareerId: defaultActiveCareerId },
      });
    } catch (error) {
      const isUniqueRace =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002";

      if (!isUniqueRace) throw error;

      preference = await prisma.userPreference.findUnique({ where: { userId } });
    }
  }

  if (!preference) throw new Error("No se pudo inicializar preferencias de usuario");

  const validActiveCareerId = preference?.activeCareerId
    ? sanitizeCarreraIds([preference.activeCareerId])[0] ?? null
    : null;

  const activeExistsInEnrollments =
    validActiveCareerId !== null && enrolledCareerIds.includes(validActiveCareerId);

  if (activeExistsInEnrollments || enrolledCareerIds.length === 0) return preference;

  return prisma.userPreference.update({
    where: { userId },
    data: { activeCareerId: enrolledCareerIds[0] ?? null },
  });
}

export async function getUserProductContext(
  userId: string,
  options?: { activityLimit?: number; includeActivity?: boolean }
): Promise<UserProductContextResponse> {
  const enrolledCareerIds = await ensureEnrollmentBootstrap(userId);
  const preference = await ensurePreferenceRow(userId, enrolledCareerIds);
  const includeActivity = options?.includeActivity !== false;

  const lastPlans = await prisma.userRecentPlan.findMany({
    where: { userId },
    orderBy: { openedAt: "desc" },
    include: { planVersion: { select: { planSlug: true, versionId: true } } },
  });

  const progressRows = await prisma.userPlanProgress.findMany({
    where: { userId },
    select: {
      stateJson: true,
      planVersion: { select: { planSlug: true } },
    },
  });

  const careerIdsWithProgress = Array.from(new Set(
    progressRows
      .filter((r) => {
        try {
          const s = JSON.parse(r.stateJson);
          return typeof s === "object" && s !== null && Object.keys(s).length > 0;
        } catch { return false; }
      })
      .map((r) => r.planVersion.planSlug)
  ));

  const activities = includeActivity
    ? await prisma.userActivity.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: Math.max(1, options?.activityLimit ?? DEFAULT_ACTIVITY_LIMIT),
      })
    : [];

  const lastPlanByCareer = Object.fromEntries(
    lastPlans.map((row) => [
      row.careerId,
      {
        planSlug: row.planVersion.planSlug,
        versionId: row.planVersion.versionId,
        openedAt: row.openedAt.toISOString(),
      },
    ])
  ) as Record<string, { planSlug: string; versionId: string; openedAt: string }>;

  return {
    careers: CARRERAS.filter((carrera) => carrera.disponible !== false).map((carrera) => ({
      id: carrera.id,
      nombre: carrera.nombre,
      descripcion: carrera.descripcion,
    })),
    enrolledCareerIds,
    activeCareerId: preference.activeCareerId,
    onboardingCompletedAt: preference.onboardingCompletedAt?.toISOString() ?? null,
    onboardingDismissedAt: preference.onboardingDismissedAt?.toISOString() ?? null,
    shouldAutoShowOnboarding: !preference.onboardingCompletedAt && !preference.onboardingDismissedAt,
    lastPlanByCareer,
    recentActivity: includeActivity
      ? activities.map((item) => ({
          id: item.id,
          type: item.type,
          careerId: item.careerId,
          planSlug: item.planSlug,
          versionId: item.versionId,
          materiaKey: item.materiaKey,
          fromState: item.fromState,
          toState: item.toState,
          metadata: parseMetadata(item.metadataJson),
          createdAt: item.createdAt.toISOString(),
        }))
      : [],
    careerIdsWithProgress,
  };
}

export async function getUserSessionSummary(userId: string): Promise<UserSessionSummaryResponse> {
  const context = await getUserProductContext(userId, { includeActivity: false });

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
  const nextEnrolledCareerIds = sanitizeCarreraIds(input.enrolledCareerIds);
  const activeCareerId = sanitizeCarreraIds([input.activeCareerId])[0] ?? null;

  if (nextEnrolledCareerIds.length === 0) {
    throw new Error("Debe haber al menos una carrera inscripta");
  }

  if (!activeCareerId || !nextEnrolledCareerIds.includes(activeCareerId)) {
    throw new Error("La carrera activa debe pertenecer a las carreras inscriptas");
  }

  const currentContext = await getUserProductContext(input.userId, { activityLimit: 1 });
  const previousActiveCareerId = currentContext.activeCareerId;

  await prisma.$transaction(async (tx) => {
    await tx.userCareerEnrollment.deleteMany({
      where: { userId: input.userId, careerId: { notIn: nextEnrolledCareerIds } },
    });

    await tx.userCareerEnrollment.createMany({
      data: nextEnrolledCareerIds.map((careerId) => ({ userId: input.userId, careerId })),
      skipDuplicates: true,
    });

    await tx.userPreference.upsert({
      where: { userId: input.userId },
      update: { activeCareerId },
      create: { userId: input.userId, activeCareerId },
    });
  });

  if (previousActiveCareerId !== activeCareerId) {
    await createUserActivity({
      userId: input.userId,
      type: "ACTIVE_CAREER_CHANGED",
      careerId: activeCareerId,
      metadata: {
        previousActiveCareerId,
        nextActiveCareerId: activeCareerId,
        source: "perfil",
      },
    });
  }

  return getUserProductContext(input.userId);
}

export async function recordPlanOpened(input: {
  userId: string;
  careerId: string;
  planSlug: string;
  versionId: string;
}) {
  const resolvedCareerId = sanitizeCarreraIds([input.careerId])[0];

  if (!resolvedCareerId || !getCarreraById(resolvedCareerId)) {
    throw new Error("Carrera invalida");
  }

  const planVersion = await prisma.planVersion.findUnique({
    where: { planSlug_versionId: { planSlug: input.planSlug, versionId: input.versionId } },
    select: { id: true },
  });

  if (!planVersion) {
    throw new Error(`Plan no encontrado: ${input.planSlug}@${input.versionId}`);
  }

  const currentContext = await getUserProductContext(input.userId, { activityLimit: 1 });
  const previousActiveCareerId = currentContext.activeCareerId;

  await prisma.$transaction(async (tx) => {
    await tx.userCareerEnrollment.upsert({
      where: { userId_careerId: { userId: input.userId, careerId: resolvedCareerId } },
      update: {},
      create: { userId: input.userId, careerId: resolvedCareerId },
    });

    await tx.userRecentPlan.upsert({
      where: { userId_careerId: { userId: input.userId, careerId: resolvedCareerId } },
      update: { planVersionId: planVersion.id, openedAt: new Date() },
      create: { userId: input.userId, careerId: resolvedCareerId, planVersionId: planVersion.id },
    });

    await tx.userPreference.upsert({
      where: { userId: input.userId },
      update: { activeCareerId: resolvedCareerId },
      create: { userId: input.userId, activeCareerId: resolvedCareerId },
    });
  });

  await createUserActivity({
    userId: input.userId,
    type: "PLAN_OPENED",
    careerId: resolvedCareerId,
    planSlug: input.planSlug,
    versionId: input.versionId,
  });

  if (previousActiveCareerId !== resolvedCareerId) {
    await createUserActivity({
      userId: input.userId,
      type: "ACTIVE_CAREER_CHANGED",
      careerId: resolvedCareerId,
      metadata: {
        previousActiveCareerId,
        nextActiveCareerId: resolvedCareerId,
        source: "plan-open",
      },
    });
  }

  return getUserProductContext(input.userId, { activityLimit: 1 });
}

export async function updateOnboardingState(input: {
  userId: string;
  action: "dismiss" | "complete" | "reset";
}) {
  const context = await getUserProductContext(input.userId, { activityLimit: 1 });

  if (input.action === "dismiss") {
    await prisma.userPreference.update({
      where: { userId: input.userId },
      data: { onboardingDismissedAt: new Date() },
    });
    await createUserActivity({
      userId: input.userId,
      type: "ONBOARDING_DISMISSED",
      careerId: context.activeCareerId,
    });
  }

  if (input.action === "complete") {
    await prisma.userPreference.update({
      where: { userId: input.userId },
      data: { onboardingCompletedAt: new Date(), onboardingDismissedAt: null },
    });
    await createUserActivity({
      userId: input.userId,
      type: "ONBOARDING_COMPLETED",
      careerId: context.activeCareerId,
    });
  }

  if (input.action === "reset") {
    await prisma.userPreference.update({
      where: { userId: input.userId },
      data: { onboardingCompletedAt: null, onboardingDismissedAt: null },
    });
    await createUserActivity({
      userId: input.userId,
      type: "ONBOARDING_RESET",
      careerId: context.activeCareerId,
    });
  }

  return getUserProductContext(input.userId, { activityLimit: 1 });
}
