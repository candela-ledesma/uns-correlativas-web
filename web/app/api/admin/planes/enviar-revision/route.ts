import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import path from "path";
import fs from "fs/promises";
import { createAuditEvent } from "@/lib/db/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR_GEMINI = path.join(process.cwd(), "data", "gemini");

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
  const filePath = path.join(DATA_DIR_GEMINI, `${slug}_pendiente.json`);

  await fs.mkdir(DATA_DIR_GEMINI, { recursive: true });

  const dataToSave = {
    ...plan,
    _estado: "pendiente_revision",
    _enviado_at: new Date().toISOString(),
    _enviado_by: session.user.id,
    _enviado_by_email: session.user.email,
    _fuente: fuente,
    ...(nota ? { _nota_revision: nota } : {}),
  };

  await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2), "utf-8");

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

  return NextResponse.json({ ok: true, slug });
}
