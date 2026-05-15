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
  const row = await prisma.planPublicado.findUnique({ where: { slug } });
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

  const existing = await prisma.planPublicado.findUnique({ where: { slug } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.planPublicado.update({
    where: { slug },
    data: { planJson: newJson, savedBy: session.user.id },
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

// ── PATCH: cambia disponible ──────────────────────────────────────────────────
export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const { disponible }: { disponible: boolean } = await req.json();

  // Intentar actualizar en DB dinámica primero
  const updated = await prisma.carreraConfig.updateMany({
    where: { id: slug },
    data: { disponible },
  });

  if (updated.count === 0) {
    // La carrera es estática — no podemos modificar carreras.ts en prod,
    // pero sí podemos crear un override en CarreraConfig
    // (Si ya existe en estáticas, no la duplicamos — solo logeamos)
    // En este caso devolvemos ok pero indicamos que es read-only en prod
    return NextResponse.json({
      ok: true,
      slug,
      disponible,
      warning: "La carrera es estática. El cambio no persiste hasta el próximo deploy.",
    });
  }

  await createAuditEvent({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role,
    action: disponible ? "PLAN_ENABLED" : "PLAN_DISABLED",
    entityType: "plan",
    entityId: slug,
    reason: null,
    after: { disponible },
  }).catch(() => {});

  return NextResponse.json({ ok: true, slug, disponible });
}

// ── DELETE: borra el plan y la carrera de DB ──────────────────────────────────
export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;

  await Promise.all([
    prisma.planPublicado.delete({ where: { slug } }).catch(() => {}),
    prisma.planPublicado.delete({ where: { slug: `${slug}_v1_backup` } }).catch(() => {}),
    prisma.carreraConfig.delete({ where: { id: slug } }).catch(() => {}),
  ]);

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
