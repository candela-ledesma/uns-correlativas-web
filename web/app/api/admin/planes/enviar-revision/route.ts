import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { createAuditEvent } from "@/lib/db/audit";
import { notificarRevisionPendiente } from "@/lib/email/notificar";

export const dynamic = "force-dynamic";

type ParseResult = {
  plan: { carrera: string; universidad: string; codigo_plan: string };
  materias: Array<{ id: string }>;
  agrupadores: unknown[];
  [key: string]: unknown;
};

function slugFromPlan(plan: ParseResult["plan"]): string {
  return plan.carrera
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MODERATOR) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { plan: ParseResult; fuente: "gemini" | "parser"; nota?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { plan, fuente, nota } = body;
  if (!plan?.plan?.carrera) {
    return NextResponse.json({ error: "Datos del plan inválidos" }, { status: 400 });
  }

  const slug = slugFromPlan(plan.plan);

  const dataToSave = {
    ...plan,
    _estado: "pendiente_revision",
    _enviado_at: new Date().toISOString(),
    _enviado_by: session.user.id,
    _enviado_by_email: session.user.email,
    _fuente: fuente,
    ...(nota ? { _nota_revision: nota } : {}),
  };

  await prisma.planPendiente.upsert({
    where: { slug },
    update: { planJson: JSON.stringify(dataToSave), submittedBy: session.user.id },
    create: { slug, planJson: JSON.stringify(dataToSave), submittedBy: session.user.id },
  });

  await createAuditEvent({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role,
    action: "PLAN_PENDING_REVIEW",
    entityType: "plan",
    entityId: slug,
    reason: nota ?? null,
    after: {
      carrera: plan.plan.carrera,
      universidad: plan.plan.universidad,
      codigo_plan: plan.plan.codigo_plan,
      materias: plan.materias.length,
      fuente,
    },
  });

  notificarRevisionPendiente({
    carrera: plan.plan.carrera,
    universidad: plan.plan.universidad,
    materias: plan.materias.length,
    fuente,
    enviadoPor: session.user.email ?? session.user.id,
    nota,
    slug,
  }).catch(() => {});

  return NextResponse.json({ ok: true, slug });
}
