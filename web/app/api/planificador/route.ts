import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { validateScheduleBlock, findOverlaps } from "@/lib/schedule/scheduleValidation";
import { resolveCarreraVersionId } from "@/lib/db/carreraRepository";

function unauthorized() {
  return NextResponse.json({ error: "No autenticado" }, { status: 401 });
}

const createSchema = z.object({
  careerId: z.string().min(1),
  planId: z.string().min(1),
  versionId: z.string().min(1),
  materiaNombre: z.string().min(1).max(200),
  materiaId: z.string().nullish(),
  dia: z.number().int().min(1).max(5),
  horaInicio: z.number().int().min(0).max(1439),
  horaFin: z.number().int().min(1).max(1440),
  comision: z.string().max(100).nullish(),
  notas: z.string().max(500).nullish(),
  color: z.string().max(20).nullish(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const url = new URL(request.url);
  const careerId = url.searchParams.get("careerId");
  const planId = url.searchParams.get("planId");
  const versionId = url.searchParams.get("versionId");

  if (!careerId || !planId || !versionId) {
    return NextResponse.json(
      { error: "Faltan careerId, planId y versionId" },
      { status: 400 },
    );
  }

  let carreraVersionId: string;
  try {
    carreraVersionId = await resolveCarreraVersionId(planId, versionId);
  } catch {
    return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
  }

  const blocks = await prisma.scheduleBlock.findMany({
    where: { userId: session.user.id, careerId, carreraVersionId },
    orderBy: [{ dia: "asc" }, { horaInicio: "asc" }],
  });

  return NextResponse.json({ blocks });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const rawBody = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const validationError = validateScheduleBlock(data);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422 });
  }

  let carreraVersionId: string;
  try {
    carreraVersionId = await resolveCarreraVersionId(data.planId, data.versionId);
  } catch {
    return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
  }

  const existing = await prisma.scheduleBlock.findMany({
    where: { userId: session.user.id, careerId: data.careerId, carreraVersionId },
    select: { id: true, dia: true, horaInicio: true, horaFin: true },
  });

  const overlaps = findOverlaps(data, existing);
  if (overlaps.length > 0) {
    return NextResponse.json(
      { error: "El bloque se superpone con uno existente", overlaps },
      { status: 409 },
    );
  }

  const block = await prisma.scheduleBlock.create({
    data: {
      userId: session.user.id,
      careerId: data.careerId,
      carreraVersionId,
      materiaNombre: data.materiaNombre,
      materiaId: data.materiaId ?? null,
      dia: data.dia,
      horaInicio: data.horaInicio,
      horaFin: data.horaFin,
      comision: data.comision ?? null,
      notas: data.notas ?? null,
      color: data.color ?? null,
    },
  });

  return NextResponse.json({ block }, { status: 201 });
}
