import { prisma } from "@/lib/db/prisma";
import type { Plan } from "@prisma/client";

export type FuenteEnum = "PARSER" | "GEMINI" | "MERGED";

export type BorradorConflict = {
  conflict: true;
  existing: { materias: number; fechaCarga: string; fuente: string };
};

export function diffDaysLabel(date: Date): string {
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "hace 1 día";
  return `hace ${diffDays} días`;
}

export function parseMateriaCount(planJson: string): number {
  try {
    return ((JSON.parse(planJson) as { materias?: unknown[] }).materias ?? []).length;
  } catch {
    return 0;
  }
}

export function toFuenteEnum(fuente: string): FuenteEnum {
  if (fuente === "parser") return "PARSER";
  if (fuente === "gemini") return "GEMINI";
  if (fuente === "merged") return "MERGED";
  return "PARSER";
}

// ── Borradores ────────────────────────────────────────────────────────────────

export async function getBorradorBySlug(
  slug: string,
  fuente: FuenteEnum,
): Promise<Plan | null> {
  return prisma.plan.findUnique({
    where: { slug_fuente_estado: { slug, fuente, estado: "BORRADOR" } },
  });
}

export function buildConflict(row: Plan, dateField: "updatedAt" | "createdAt" = "updatedAt"): BorradorConflict {
  return {
    conflict: true,
    existing: {
      materias: parseMateriaCount(row.planJson),
      fechaCarga: diffDaysLabel(row[dateField]),
      fuente: row.fuente.toLowerCase(),
    },
  };
}

export async function upsertBorrador(
  slug: string,
  fuente: FuenteEnum,
  planJson: string,
  autorId: string,
): Promise<Plan> {
  return prisma.plan.upsert({
    where: { slug_fuente_estado: { slug, fuente, estado: "BORRADOR" } },
    update: { planJson, updatedAt: new Date() },
    create: { slug, fuente, estado: "BORRADOR", planJson, autorId },
  });
}

// ── Publicados ────────────────────────────────────────────────────────────────

export async function getPublishedPlan(slug: string): Promise<Plan | null> {
  return prisma.plan.findFirst({ where: { slug, estado: "PUBLICADO", esBackup: false } });
}

export async function backupPublishedPlan(existing: Plan): Promise<void> {
  await prisma.plan.create({
    data: {
      slug: existing.slug,
      estado: "PUBLICADO",
      fuente: existing.fuente,
      planJson: existing.planJson,
      esBackup: true,
      autorId: existing.autorId,
    },
  }).catch(() => {});
}

export async function publishPlan(
  existing: Plan | null,
  slug: string,
  fuente: FuenteEnum,
  planJson: string,
  autorId: string,
): Promise<string> {
  if (existing) {
    const updated = await prisma.plan.update({
      where: { id: existing.id },
      data: { planJson, fuente, autorId },
    });
    return updated.id;
  }
  const created = await prisma.plan.create({
    data: { slug, estado: "PUBLICADO", fuente, planJson, autorId },
  });
  return created.id;
}

// ── Pendientes ────────────────────────────────────────────────────────────────

export async function getPendingPlans(): Promise<Plan[]> {
  return prisma.plan.findMany({ where: { estado: "PENDIENTE" }, orderBy: { createdAt: "desc" } });
}

export async function getPendingPlanBySlug(slug: string): Promise<Plan | null> {
  return prisma.plan.findFirst({ where: { slug, estado: "PENDIENTE" } });
}

export async function deletePendingBySlug(slug: string): Promise<number> {
  const result = await prisma.plan.deleteMany({ where: { slug, estado: "PENDIENTE" } });
  return result.count;
}

// ── Publicados (listas y mutaciones) ─────────────────────────────────────────

export async function getPublishedPlansRaw(): Promise<
  Pick<Plan, "slug" | "fuente" | "createdAt" | "planJson">[]
> {
  return prisma.plan.findMany({
    where: { estado: "PUBLICADO", esBackup: false },
    select: { slug: true, fuente: true, createdAt: true, planJson: true },
  });
}

export async function updatePublishedPlanJson(
  id: string,
  planJson: string,
  autorId: string,
): Promise<void> {
  await prisma.plan.update({ where: { id }, data: { planJson, autorId } });
}

export async function deletePublishedPlansBySlug(slug: string): Promise<void> {
  await prisma.plan.deleteMany({ where: { slug, estado: "PUBLICADO" } }).catch(() => {});
}
