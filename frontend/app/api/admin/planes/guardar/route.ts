import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { upsertCarrera, upsertPlanVersion } from "@/lib/db/carreraRepository";
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
  planId: string,
  departamentoId?: string | null,
): Promise<void> {
  await upsertCarrera({ id: slug, nombre, departamentoId });
  await upsertPlanVersion({ carreraId: slug, versionId: "v1", jsonFile, planId });
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
    departamentoId?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { plan, fuente, publicar, resolucion, motivo, departamentoId } = body;
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
      _publicado: publicar, // campo informativo dentro del JSON, no columna DB
      ...(motivo ? { _motivo_cambio: motivo } : {}),
      ...(resolucion === "nueva_version" ? { _version: "v2" } : {}),
    };
    const planJsonStr = JSON.stringify(dataToSave, null, 2);

    const fuenteEnum = fuente === "parser" ? "PARSER" : fuente === "gemini" ? "GEMINI" : "PARSER";

    // Guardar borrador (sin publicar)
    if (!publicar) {
      const existingBorrador = await prisma.plan.findUnique({
        where: { slug_fuente_estado: { slug, fuente: fuenteEnum, estado: "BORRADOR" } },
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
            fuente: existingBorrador.fuente.toLowerCase(),
          },
        });
      }

      if (resolucion === "conservar") {
        return NextResponse.json({ ok: true, slug, action: "conserved" });
      }

      await prisma.plan.upsert({
        where: { slug_fuente_estado: { slug, fuente: fuenteEnum, estado: "BORRADOR" } },
        update: { planJson: planJsonStr, updatedAt: new Date() },
        create: { slug, fuente: fuenteEnum, estado: "BORRADOR", planJson: planJsonStr, autorId: session.user.id },
      });

      return NextResponse.json({ ok: true, slug });
    }

    // Publicar: verificar conflicto con Plan publicado existente
    const existing = await prisma.plan.findFirst({ where: { slug, estado: "PUBLICADO", esBackup: false } });

    if (existing && !resolucion) {
      const diffMs = Date.now() - existing.createdAt.getTime();
      const diffDays = Math.floor(diffMs / 86400000);
      const fechaLabel = diffDays === 0 ? "hoy" : diffDays === 1 ? "hace 1 día" : `hace ${diffDays} días`;
      const existingPlan = JSON.parse(existing.planJson) as ParseResult;
      return NextResponse.json({
        conflict: true,
        existing: {
          materias: (existingPlan.materias ?? []).length,
          fechaCarga: fechaLabel,
          fuente: existing.fuente.toLowerCase(),
        },
      });
    }

    if (resolucion === "conservar") {
      return NextResponse.json({ ok: true, slug, action: "conserved" });
    }

    if (resolucion === "nueva_version" && existing) {
      // Guardar copia de seguridad del plan anterior
      await prisma.plan.create({
        data: {
          slug,
          estado: "PUBLICADO",
          fuente: existing.fuente,
          planJson: existing.planJson,
          esBackup: true,
          autorId: existing.autorId,
        },
      }).catch(() => {});
    }

    let publishedPlanId: string;
    if (existing) {
      const updated = await prisma.plan.update({
        where: { id: existing.id },
        data: { planJson: planJsonStr, fuente: fuenteEnum, autorId: session.user.id },
      });
      publishedPlanId = updated.id;
    } else {
      const created = await prisma.plan.create({
        data: { slug, estado: "PUBLICADO", fuente: fuenteEnum, planJson: planJsonStr, autorId: session.user.id },
      });
      publishedPlanId = created.id;
    }

    // Borrar pendiente si existe
    await prisma.plan.deleteMany({ where: { slug, estado: "PENDIENTE" } }).catch(() => {});

    // Registrar carrera si es nueva y vincular PlanVersion al Plan publicado
    await registrarCarreraEnDB(slug, `${slug}.json`, plan.plan.carrera, publishedPlanId, departamentoId).catch(() => {});

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
