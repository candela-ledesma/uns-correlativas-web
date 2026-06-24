import { prisma } from "@/lib/db/prisma";
import type { ContenidoPlan } from "@prisma/client";

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
): Promise<ContenidoPlan | null> {
  return prisma.contenidoPlan.findUnique({
    where: { slug_fuente_estado: { slug, fuente, estado: "BORRADOR" } },
  });
}

export function buildConflict(row: ContenidoPlan, dateField: "updatedAt" | "createdAt" = "updatedAt"): BorradorConflict {
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
): Promise<ContenidoPlan> {
  return prisma.contenidoPlan.upsert({
    where: { slug_fuente_estado: { slug, fuente, estado: "BORRADOR" } },
    update: { planJson, updatedAt: new Date() },
    create: { slug, fuente, estado: "BORRADOR", planJson, autorId },
  });
}

// ── Publicados ────────────────────────────────────────────────────────────────

export async function getPublishedPlan(slug: string): Promise<ContenidoPlan | null> {
  return prisma.contenidoPlan.findFirst({ where: { slug, estado: "PUBLICADO", esBackup: false } });
}

export async function backupPublishedPlan(existing: ContenidoPlan): Promise<void> {
  await prisma.contenidoPlan.create({
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
  existing: ContenidoPlan | null,
  slug: string,
  fuente: FuenteEnum,
  planJson: string,
  autorId: string,
): Promise<string> {
  if (existing) {
    const updated = await prisma.contenidoPlan.update({
      where: { id: existing.id },
      data: { planJson, fuente, autorId },
    });
    return updated.id;
  }
  const created = await prisma.contenidoPlan.create({
    data: { slug, estado: "PUBLICADO", fuente, planJson, autorId },
  });
  return created.id;
}

// ── Pendientes ────────────────────────────────────────────────────────────────

export async function getPendingPlans(): Promise<ContenidoPlan[]> {
  return prisma.contenidoPlan.findMany({ where: { estado: "PENDIENTE" }, orderBy: { createdAt: "desc" } });
}

export async function getPendingPlanBySlug(slug: string): Promise<ContenidoPlan | null> {
  return prisma.contenidoPlan.findFirst({ where: { slug, estado: "PENDIENTE" } });
}

export async function deletePendingBySlug(slug: string): Promise<number> {
  const result = await prisma.contenidoPlan.deleteMany({ where: { slug, estado: "PENDIENTE" } });
  return result.count;
}

// ── Publicados (listas y mutaciones) ─────────────────────────────────────────

export async function getPublishedPlansRaw(): Promise<
  Pick<ContenidoPlan, "slug" | "fuente" | "createdAt" | "planJson">[]
> {
  return prisma.contenidoPlan.findMany({
    where: { estado: "PUBLICADO", esBackup: false },
    select: { slug: true, fuente: true, createdAt: true, planJson: true },
  });
}

export async function updatePublishedPlanJson(
  id: string,
  planJson: string,
  autorId: string,
): Promise<void> {
  await prisma.contenidoPlan.update({ where: { id }, data: { planJson, autorId } });
}

export async function deletePublishedPlansBySlug(slug: string): Promise<void> {
  await prisma.contenidoPlan.deleteMany({ where: { slug, estado: "PUBLICADO" } }).catch(() => {});
}
