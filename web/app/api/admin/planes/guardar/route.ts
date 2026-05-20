import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { CARRERAS } from "@/lib/data/carreras";
import { createAuditEvent } from "@/lib/db/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ParseResult = {
  plan: { carrera: string; universidad: string; codigo_plan: string };
  materias: Array<{ id: string; nombre: string }>;
  agrupadores: unknown[];
  [key: string]: unknown;
};

function slugFromPlan(plan: ParseResult["plan"]): string {
  return plan.carrera
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function registrarCarreraEnDB(
  slug: string,
  jsonFile: string,
  nombre: string,
  departamento?: string | null,
): Promise<void> {
  const staticEntry = CARRERAS.some((c) => c.id === slug);
  if (staticEntry) return; // ya existe en el código estático

  await prisma.carreraConfig.upsert({
    where: { id: slug },
    update: { nombre, jsonFile, ...(departamento != null ? { departamento } : {}) },
    create: {
      id: slug,
      nombre,
      jsonFile,
      descripcion: "Plan de estudios y correlativas.",
      departamento: departamento ?? null,
      disponible: true,
    },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    plan: ParseResult;
    fuente: "gemini" | "parser" | "merged";
    publicar: boolean;
    resolucion: "reemplazar" | "conservar" | "nueva_version" | null;
    motivo?: string;
    departamento?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { plan, fuente, publicar, resolucion, motivo, departamento } = body;
  if (!plan?.plan?.carrera) {
    return NextResponse.json({ error: "Datos del plan inválidos" }, { status: 400 });
  }

  const slug = slugFromPlan(plan.plan);

  try {
    const dataToSave = {
      ...plan,
      _saved_at: new Date().toISOString(),
      _saved_by: session.user.id,
      _saved_fuente: fuente,
      _publicado: publicar,
      ...(motivo ? { _motivo_cambio: motivo } : {}),
      ...(resolucion === "nueva_version" ? { _version: "v2" } : {}),
    };
    const planJsonStr = JSON.stringify(dataToSave, null, 2);

    // Guardar borrador (sin publicar)
    if (!publicar) {
      const existingBorrador = await prisma.planBorrador.findUnique({
        where: { slug_fuente: { slug, fuente } },
      });

      if (existingBorrador && !resolucion) {
        const diffMs = Date.now() - existingBorrador.updatedAt.getTime();
        const diffDays = Math.floor(diffMs / 86400000);
        const fechaLabel = diffDays === 0 ? "hoy" : diffDays === 1 ? "hace 1 día" : `hace ${diffDays} días`;
        const existingPlan = JSON.parse(existingBorrador.planJson) as ParseResult;
        return NextResponse.json({
          conflict: true,
          existing: {
            materias: (existingPlan.materias ?? []).length,
            fechaCarga: fechaLabel,
            fuente: existingBorrador.fuente,
          },
        });
      }

      if (resolucion === "conservar") {
        return NextResponse.json({ ok: true, slug, action: "conserved" });
      }

      await prisma.planBorrador.upsert({
        where: { slug_fuente: { slug, fuente } },
        update: { planJson: planJsonStr, updatedAt: new Date() },
        create: { slug, fuente, planJson: planJsonStr, createdBy: session.user.id },
      });

      return NextResponse.json({ ok: true, slug });
    }

    // Publicar: verificar conflicto con PlanPublicado
    const existing = await prisma.planPublicado.findUnique({ where: { slug } });

    if (existing && !resolucion) {
      const diffMs = Date.now() - existing.savedAt.getTime();
      const diffDays = Math.floor(diffMs / 86400000);
      const fechaLabel = diffDays === 0 ? "hoy" : diffDays === 1 ? "hace 1 día" : `hace ${diffDays} días`;
      const existingPlan = JSON.parse(existing.planJson) as ParseResult;
      return NextResponse.json({
        conflict: true,
        existing: {
          materias: (existingPlan.materias ?? []).length,
          fechaCarga: fechaLabel,
          fuente: existing.fuente,
        },
      });
    }

    if (resolucion === "conservar") {
      return NextResponse.json({ ok: true, slug, action: "conserved" });
    }

    if (resolucion === "nueva_version" && existing) {
      await prisma.planPublicado.upsert({
        where: { slug: `${slug}_v1_backup` },
        update: { planJson: existing.planJson, fuente: existing.fuente },
        create: { slug: `${slug}_v1_backup`, planJson: existing.planJson, fuente: existing.fuente },
      });
    }

    await prisma.planPublicado.upsert({
      where: { slug },
      update: { planJson: planJsonStr, fuente, publicado: true, savedBy: session.user.id },
      create: { slug, planJson: planJsonStr, fuente, publicado: true, savedBy: session.user.id },
    });

    // Borrar pendiente si existe
    await prisma.planPendiente.delete({ where: { slug } }).catch(() => {});

    // Registrar carrera si es nueva (independientemente de la fuente)
    await registrarCarreraEnDB(slug, `${slug}.json`, plan.plan.carrera, departamento).catch(() => {});

    await createAuditEvent({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      actorRole: session.user.role,
      action: "PLAN_SAVED",
      entityType: "plan",
      entityId: slug,
      reason: motivo ?? null,
      after: {
        carrera: plan.plan.carrera,
        universidad: plan.plan.universidad,
        codigo_plan: plan.plan.codigo_plan,
        materias: plan.materias.length,
        fuente,
        publicar,
        resolucion: resolucion ?? "nuevo",
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
