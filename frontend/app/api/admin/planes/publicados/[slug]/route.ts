import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/authz";
import { createAuditEvent } from "@/lib/db/audit";
import {
  getPublishedPlan,
  updatePublishedPlanJson,
  deletePublishedPlansBySlug,
} from "@/lib/db/planRepository";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

// ── GET: devuelve el JSON completo del plan publicado ─────────────────────────
export async function GET(_req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { slug } = await params;
  const row = await getPublishedPlan(slug);
  if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return new Response(row.planJson, { headers: { "Content-Type": "application/json; charset=utf-8" } });
}

// ── PUT: reemplaza el JSON publicado con el body recibido ─────────────────────
export async function PUT(req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { slug } = await params;

  let newJson: string;
  try {
    const body = await req.text();
    if (body.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "JSON demasiado grande" }, { status: 413 });
    }
    JSON.parse(body); // valida JSON antes de persistir
    newJson = body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const existing = await getPublishedPlan(slug);
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await updatePublishedPlanJson(existing.id, newJson, session.user.id);

  await createAuditEvent({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role,
    action: "PLAN_EDITED",
    entityType: "plan",
    entityId: slug,
    reason: null,
    after: null,
  }).catch(() => {});

  return NextResponse.json({ ok: true, slug });
}

// ── PATCH: cambia disponible, nombre, o departamentoId ───────────────────────
export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { slug } = await params;

  const patchSchema = z.object({
    disponible: z.boolean().optional(),
    nombre: z.string().min(1).max(500).optional(),
    departamentoId: z.string().max(200).nullable().optional(),
  }).refine((d) => Object.keys(d).length > 0, { message: "Sin campos para actualizar" });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const configData: Record<string, unknown> = {};
  if (body.disponible !== undefined) configData.disponible = body.disponible;
  if (body.nombre !== undefined) configData.nombre = body.nombre;
  if (body.departamentoId !== undefined) configData.departamentoId = body.departamentoId;

  const updated = await prisma.carrera.updateMany({
    where: { id: slug },
    data: configData,
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Carrera no encontrada" }, { status: 404 });
  }

  const action = body.disponible !== undefined
    ? (body.disponible ? "PLAN_ENABLED" : "PLAN_DISABLED")
    : "PLAN_EDITED";

  await createAuditEvent({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role,
    action,
    entityType: "plan",
    entityId: slug,
    reason: null,
    after: body,
  }).catch(() => {});

  return NextResponse.json({ ok: true, slug, ...body });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { slug } = await params;

  await deletePublishedPlansBySlug(slug);

  await createAuditEvent({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role,
    action: "PLAN_DELETED",
    entityType: "plan",
    entityId: slug,
    reason: null,
    after: null,
  }).catch(() => {});

  return NextResponse.json({ ok: true, slug });
}
