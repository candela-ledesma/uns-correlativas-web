import { prisma } from "@/lib/db/prisma";
import type { Carrera, CarreraVersion, Departamento } from "@prisma/client";

export type CarreraWithVersions = Carrera & { versions: CarreraVersion[]; departamento: Departamento | null };

const carreraInclude = {
  versions: { orderBy: { createdAt: "asc" as const } },
  departamento: true,
};

export async function getCarreras(opts?: { soloDisponibles?: boolean }): Promise<CarreraWithVersions[]> {
  return prisma.carrera.findMany({
    where: opts?.soloDisponibles !== false ? { disponible: true } : undefined,
    include: carreraInclude,
    orderBy: { nombre: "asc" },
  });
}

export async function getCarreraById(id: string): Promise<CarreraWithVersions | null> {
  return prisma.carrera.findUnique({
    where: { id },
    include: carreraInclude,
  });
}

export async function getVersionForCarrera(
  carreraId: string,
  versionId: string | null
): Promise<CarreraVersion | null> {
  const carrera = await prisma.carrera.findUnique({
    where: { id: carreraId },
    select: { defaultVersionId: true, versions: true },
  });
  if (!carrera) return null;

  const resolvedVersionId = versionId ?? carrera.defaultVersionId;
  if (!resolvedVersionId) return carrera.versions[0] ?? null;
  return carrera.versions.find((v) => v.versionId === resolvedVersionId) ?? null;
}

export async function getDefaultVersionForCarrera(carreraId: string): Promise<CarreraVersion | null> {
  return getVersionForCarrera(carreraId, null);
}

export async function resolveCarreraVersionId(carreraId: string, versionId: string): Promise<string> {
  const cv = await prisma.carreraVersion.findUnique({
    where: { carreraId_versionId: { carreraId, versionId } },
    select: { id: true },
  });
  if (!cv) throw new Error(`Versión no encontrada: ${carreraId}@${versionId}`);
  return cv.id;
}

export async function upsertCarrera(data: {
  id: string;
  nombre: string;
  descripcion?: string;
  departamentoId?: string | null;
  disponible?: boolean;
}): Promise<Carrera> {
  return prisma.carrera.upsert({
    where: { id: data.id },
    update: {
      nombre: data.nombre,
      ...(data.descripcion != null ? { descripcion: data.descripcion } : {}),
      ...(data.departamentoId !== undefined ? { departamentoId: data.departamentoId } : {}),
      ...(data.disponible != null ? { disponible: data.disponible } : {}),
    },
    create: {
      id: data.id,
      nombre: data.nombre,
      descripcion: data.descripcion ?? "Plan de estudios y correlativas.",
      departamentoId: data.departamentoId ?? null,
      disponible: data.disponible ?? true,
    },
  });
}

export async function upsertCarreraVersion(data: {
  carreraId: string;
  versionId: string;
  label?: string;
  jsonFile: string;
  planId?: string | null;
  disponible?: boolean;
}): Promise<CarreraVersion> {
  return prisma.carreraVersion.upsert({
    where: { carreraId_versionId: { carreraId: data.carreraId, versionId: data.versionId } },
    update: {
      jsonFile: data.jsonFile,
      ...(data.label != null ? { label: data.label } : {}),
      ...(data.planId !== undefined ? { planId: data.planId } : {}),
      ...(data.disponible != null ? { disponible: data.disponible } : {}),
    },
    create: {
      carreraId: data.carreraId,
      versionId: data.versionId,
      label: data.label ?? "Plan actual",
      jsonFile: data.jsonFile,
      planId: data.planId ?? null,
      disponible: data.disponible ?? true,
    },
  });
}
