import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateScheduleBlock, findOverlaps } from "@/lib/scheduleValidation";

function unauthorized() {
  return NextResponse.json({ error: "No autenticado" }, { status: 401 });
}

function notFound() {
  return NextResponse.json({ error: "Bloque no encontrado" }, { status: 404 });
}

const updateSchema = z.object({
  materiaNombre: z.string().min(1).max(200).optional(),
  materiaId: z.string().nullish(),
  dia: z.number().int().min(1).max(5).optional(),
  horaInicio: z.number().int().min(0).max(1439).optional(),
  horaFin: z.number().int().min(1).max(1440).optional(),
  comision: z.string().max(100).nullish(),
  notas: z.string().max(500).nullish(),
  color: z.string().max(20).nullish(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const { id } = await params;
  const existing = await prisma.scheduleBlock.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) return notFound();

  const rawBody = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updates = parsed.data;
  const merged = {
    id,
    dia: updates.dia ?? existing.dia,
    horaInicio: updates.horaInicio ?? existing.horaInicio,
    horaFin: updates.horaFin ?? existing.horaFin,
  };

  const validationError = validateScheduleBlock(merged);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422 });
  }

  const siblings = await prisma.scheduleBlock.findMany({
    where: {
      userId: session.user.id,
      careerId: existing.careerId,
      planId: existing.planId,
      versionId: existing.versionId,
    },
    select: { id: true, dia: true, horaInicio: true, horaFin: true },
  });

  const overlaps = findOverlaps(merged, siblings);
  if (overlaps.length > 0) {
    return NextResponse.json(
      { error: "El bloque se superpone con uno existente", overlaps },
      { status: 409 },
    );
  }

  const updated = await prisma.scheduleBlock.update({
    where: { id },
    data: {
      ...(updates.materiaNombre !== undefined && { materiaNombre: updates.materiaNombre }),
      ...(updates.materiaId !== undefined && { materiaId: updates.materiaId }),
      ...(updates.dia !== undefined && { dia: updates.dia }),
      ...(updates.horaInicio !== undefined && { horaInicio: updates.horaInicio }),
      ...(updates.horaFin !== undefined && { horaFin: updates.horaFin }),
      ...(updates.comision !== undefined && { comision: updates.comision }),
      ...(updates.notas !== undefined && { notas: updates.notas }),
      ...(updates.color !== undefined && { color: updates.color }),
    },
  });

  return NextResponse.json({ block: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const { id } = await params;
  const existing = await prisma.scheduleBlock.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) return notFound();

  await prisma.scheduleBlock.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
