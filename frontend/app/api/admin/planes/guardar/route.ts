import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { upsertCarrera, upsertPlanVersion } from "@/lib/db/carreraRepository";
import { createAuditEvent } from "@/lib/db/audit";
import { toSlug } from "@/lib/utils/slug";
import {
  getBorradorBySlug,
  buildConflict,
  upsertBorrador,
  getPublishedPlan,
  backupPublishedPlan,
  publishPlan,
  deletePendingBySlug,
  toFuenteEnum,
  type FuenteEnum,
} from "@/lib/services/planRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ParseResult = {
  plan: { carrera: string; universidad: string; codigo_plan: string };
  materias: Array<{ id: string; nombre: string }>;
  agrupadores: unknown[];
  [key: string]: unknown;
};

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

  const slug = toSlug(plan.plan.carrera);
  const fuenteEnum = toFuenteEnum(fuente);

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

    if (!publicar) {
      const existingBorrador = await getBorradorBySlug(slug, fuenteEnum);
      if (existingBorrador && !resolucion) {
        return NextResponse.json(buildConflict(existingBorrador));
      }
      if (resolucion === "conservar") {
        return NextResponse.json({ ok: true, slug, action: "conserved" });
      }
      await upsertBorrador(slug, fuenteEnum, planJsonStr, session.user.id);
      return NextResponse.json({ ok: true, slug });
    }

    const existing = await getPublishedPlan(slug);
    if (existing && !resolucion) {
      return NextResponse.json(buildConflict(existing, "createdAt"));
    }
    if (resolucion === "conservar") {
      return NextResponse.json({ ok: true, slug, action: "conserved" });
    }
    if (resolucion === "nueva_version" && existing) {
      await backupPublishedPlan(existing);
    }

    const publishedPlanId = await publishPlan(existing, slug, fuenteEnum, planJsonStr, session.user.id);

    await deletePendingBySlug(slug);

    await upsertCarrera({ id: slug, nombre: plan.plan.carrera, departamentoId }).catch(() => {});
    await upsertPlanVersion({ carreraId: slug, versionId: "v1", jsonFile: `${slug}.json`, planId: publishedPlanId }).catch(() => {});

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
