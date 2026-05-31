import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { createAuditEvent } from "@/lib/db/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) return null;
  return session;
}

// ── GET: devuelve el JSON completo del plan publicado ─────────────────────────
export async function GET(_req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const row = await prisma.plan.findFirst({ where: { slug, estado: "PUBLICADO", esBackup: false } });
  if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return new Response(row.planJson, { headers: { "Content-Type": "application/json; charset=utf-8" } });
}

// ── PUT: reemplaza el JSON publicado con el body recibido ─────────────────────
export async function PUT(req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;

  let newJson: string;
  try {
    const body = await req.text();
    JSON.parse(body); // valida JSON antes de persistir
    newJson = body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const existing = await prisma.plan.findFirst({ where: { slug, estado: "PUBLICADO", esBackup: false } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.plan.update({
    where: { id: existing.id },
    data: { planJson: newJson, autorId: session.user.id },
  });

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
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const body: { disponible?: boolean; nombre?: string; departamentoId?: string | null } = await req.json();

  const configData: Record<string, unknown> = {};
  if (body.disponible !== undefined) configData.disponible = body.disponible;
  if (body.nombre !== undefined) configData.nombre = body.nombre;
  if (body.departamentoId !== undefined) configData.departamentoId = body.departamentoId;

  if (Object.keys(configData).length === 0) {
    return NextResponse.json({ error: "Sin campos para actualizar" }, { status: 400 });
  }

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
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;

  await prisma.plan.deleteMany({ where: { slug, estado: "PUBLICADO" } }).catch(() => {});

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
