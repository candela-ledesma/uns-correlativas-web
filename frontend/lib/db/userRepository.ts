import { prisma } from "@/lib/db/prisma";
import { getCarreras } from "@/lib/db/carreraRepository";
import type { PreferenciaUsuario } from "@prisma/client";

async function getAvailableCarreraIds(): Promise<string[]> {
  const carreras = await getCarreras({ soloDisponibles: true });
  return carreras.map((c) => c.id);
}

async function sanitizeCarreraIds(carreraIds: string[]): Promise<string[]> {
  const available = await getAvailableCarreraIds();
  const availableSet = new Set(available);
  const unique = Array.from(new Set(carreraIds));
  return unique.filter((id) => availableSet.has(id));
}

export async function getOrBootstrapEnrollments(userId: string): Promise<string[]> {
  const existing = await prisma.carreraSeleccionada.findMany({
    where: { userId },
    select: { careerId: true },
  });

  if (existing.length > 0) {
    return sanitizeCarreraIds(existing.map((item) => item.careerId));
  }

  // Primer login: inferir carreras desde el progreso existente
  const userProgressCareers = await prisma.progresoPlan.findMany({
    where: { userId },
    select: { versionPlan: { select: { carreraId: true } } },
    distinct: ["planVersionId"],
  });

  const fromProgress = await sanitizeCarreraIds(
    userProgressCareers.map((item) => item.versionPlan.carreraId)
  );

  const availableIds = await getAvailableCarreraIds();
  const fallbackCareer = availableIds[0];
  const initialCareers = fromProgress.length > 0
    ? fromProgress
    : fallbackCareer
      ? [fallbackCareer]
      : [];

  if (initialCareers.length === 0) return [];

  await prisma.carreraSeleccionada.createMany({
    data: initialCareers.map((careerId) => ({ userId, careerId })),
    skipDuplicates: true,
  });

  return initialCareers;
}

export async function getOrCreatePreference(
  userId: string,
  enrolledCareerIds: string[],
): Promise<PreferenciaUsuario> {
  const defaultActiveCareerId = enrolledCareerIds[0] ?? null;

  let preference = await prisma.preferenciaUsuario.findUnique({ where: { userId } });

  if (!preference) {
    try {
      preference = await prisma.preferenciaUsuario.create({
        data: { userId, activeCareerId: defaultActiveCareerId },
      });
    } catch (error) {
      const isUniqueRace =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002";

      if (!isUniqueRace) throw error;

      preference = await prisma.preferenciaUsuario.findUnique({ where: { userId } });
    }
  }

  if (!preference) throw new Error("No se pudo inicializar preferencias de usuario");

  const validActiveCareerId = preference.activeCareerId
    ? (await sanitizeCarreraIds([preference.activeCareerId]))[0] ?? null
    : null;

  const activeExistsInEnrollments =
    validActiveCareerId !== null && enrolledCareerIds.includes(validActiveCareerId);

  if (activeExistsInEnrollments || enrolledCareerIds.length === 0) return preference;

  return prisma.preferenciaUsuario.update({
    where: { userId },
    data: { activeCareerId: enrolledCareerIds[0] ?? null },
  });
}

export async function updateEnrollments(
  userId: string,
  nextEnrolledCareerIds: string[],
  activeCareerId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.carreraSeleccionada.deleteMany({
      where: { userId, careerId: { notIn: nextEnrolledCareerIds } },
    });

    await tx.carreraSeleccionada.createMany({
      data: nextEnrolledCareerIds.map((careerId) => ({ userId, careerId })),
      skipDuplicates: true,
    });

    await tx.preferenciaUsuario.upsert({
      where: { userId },
      update: { activeCareerId },
      create: { userId, activeCareerId },
    });
  });
}

export async function upsertRecentPlan(
  userId: string,
  careerId: string,
  planVersionId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.carreraSeleccionada.upsert({
      where: { userId_careerId: { userId, careerId } },
      update: {},
      create: { userId, careerId },
    });

    await tx.planReciente.upsert({
      where: { userId_careerId: { userId, careerId } },
      update: { planVersionId, openedAt: new Date() },
      create: { userId, careerId, planVersionId },
    });

    await tx.preferenciaUsuario.upsert({
      where: { userId },
      update: { activeCareerId: careerId },
      create: { userId, activeCareerId: careerId },
    });
  });
}

export async function updateOnboardingPreference(
  userId: string,
  action: "dismiss" | "complete" | "reset",
): Promise<void> {
  if (action === "dismiss") {
    await prisma.preferenciaUsuario.update({
      where: { userId },
      data: { onboardingDismissedAt: new Date() },
    });
  } else if (action === "complete") {
    await prisma.preferenciaUsuario.update({
      where: { userId },
      data: { onboardingCompletedAt: new Date(), onboardingDismissedAt: null },
    });
  } else if (action === "reset") {
    await prisma.preferenciaUsuario.update({
      where: { userId },
      data: { onboardingCompletedAt: null, onboardingDismissedAt: null },
    });
  }
}

export { sanitizeCarreraIds, getAvailableCarreraIds };
