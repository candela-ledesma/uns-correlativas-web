import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { resolveVersionPlanId } from "@/lib/db/carreraRepository";
import { z } from "zod";

const GCAL_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const DIA_TO_BYDAY = ["MO", "TU", "WE", "TH", "FR"] as const;

const querySchema = z.object({
  careerId: z.string().min(1),
  planId: z.string().min(1),
  versionId: z.string().min(1),
});

function unauthorized() {
  return NextResponse.json({ error: "No autenticado" }, { status: 401 });
}

function minutesToRFC3339Time(minutes: number, isoDate: string): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${isoDate}T${h}:${m}:00`;
}

function nextWeekdayDate(weekday: number): string {
  const today = new Date();
  const todayDay = (today.getDay() + 6) % 7;
  const diff = (weekday - todayDay + 7) % 7 || 7;
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  return target.toISOString().slice(0, 10);
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  return data.access_token ?? null;
}

async function getCalendarAccount(userId: string) {
  return prisma.account.findFirst({
    where: { userId, provider: "google-calendar" },
  });
}

async function updateCalendarAccessToken(userId: string, accessToken: string, expiresAt: number | null) {
  await prisma.account.update({
    where: {
      provider_providerAccountId: {
        provider: "google-calendar",
        providerAccountId: userId,
      },
    },
    data: { access_token: accessToken, expires_at: expiresAt },
  });
}

async function resolveAccessToken(userId: string): Promise<{ token: string; refreshed: boolean; newExpiresAt?: number } | null> {
  const account = await getCalendarAccount(userId);
  if (!account) return null;

  const nowSecs = Math.floor(Date.now() / 1000);
  const isExpired = account.expires_at != null && nowSecs >= account.expires_at - 60;

  if (account.access_token && !isExpired) {
    return { token: account.access_token, refreshed: false };
  }

  if (!account.refresh_token) return null;

  const newToken = await refreshAccessToken(account.refresh_token);
  if (!newToken) return null;

  // expires_in not returned here, use a default 1h
  const newExpiresAt = nowSecs + 3600;
  await updateCalendarAccessToken(userId, newToken, newExpiresAt);
  return { token: newToken, refreshed: true, newExpiresAt };
}

// Busca todos los eventos exportados por esta app para una carrera específica.
async function findAllExportedEvents(accessToken: string, careerId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      privateExtendedProperty: `uns_career_id=${careerId}`,
      maxResults: "250",
      showDeleted: "false",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${GCAL_BASE}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error("[exportar-gcal] findAllExportedEvents error", { status: res.status });
      break;
    }

    const data = (await res.json()) as { items?: { id: string }[]; nextPageToken?: string };
    for (const item of data.items ?? []) ids.push(item.id);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return ids;
}

function getUserId(request: Request) {
  return getToken({
    req: request as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  });
}

// ── GET: verificar si hay eventos exportados para esta carrera ────────────

export async function GET(request: Request) {
  const rawToken = await getUserId(request);
  if (!rawToken?.sub) return unauthorized();

  const url = new URL(request.url);
  const careerId = url.searchParams.get("careerId") ?? "";
  if (!careerId) {
    return NextResponse.json({ error: "Falta careerId" }, { status: 400 });
  }

  const resolved = await resolveAccessToken(rawToken.sub);
  if (!resolved) {
    return NextResponse.json({ linked: false, noToken: true });
  }

  const params = new URLSearchParams({
    privateExtendedProperty: `uns_career_id=${careerId}`,
    maxResults: "1",
    showDeleted: "false",
  });
  const res = await fetch(`${GCAL_BASE}?${params}`, {
    headers: { Authorization: `Bearer ${resolved.token}` },
  });

  if (!res.ok) return NextResponse.json({ linked: false });

  const data = (await res.json()) as { items?: unknown[] };
  return NextResponse.json({ linked: (data.items?.length ?? 0) > 0 });
}

// ── POST: exportar (upsert) ────────────────────────────────────────────────

export async function POST(request: Request) {
  const rawToken = await getUserId(request);
  if (!rawToken?.sub) return unauthorized();

  const resolved = await resolveAccessToken(rawToken.sub);
  if (!resolved) {
    return NextResponse.json(
      { error: "No hay token de Google Calendar. Conectá tu cuenta desde el planificador." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const queryParsed = querySchema.safeParse({
    careerId: url.searchParams.get("careerId"),
    planId: url.searchParams.get("planId"),
    versionId: url.searchParams.get("versionId"),
  });
  if (!queryParsed.success) {
    return NextResponse.json({ error: "Faltan careerId, planId y versionId" }, { status: 400 });
  }

  const { careerId, planId, versionId } = queryParsed.data;

  let planVersionId: string;
  try {
    planVersionId = await resolveVersionPlanId(planId, versionId);
  } catch {
    return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
  }

  const blocks = await prisma.bloqueHorario.findMany({
    where: { userId: rawToken.sub, careerId, planVersionId },
  });

  if (blocks.length === 0) {
    return NextResponse.json({ error: "No hay bloques para exportar" }, { status: 400 });
  }

  // Eliminar eventos anteriores de esta carrera antes de crear los nuevos
  const existingIds = await findAllExportedEvents(resolved.token, careerId);
  for (const eventId of existingIds) {
    await fetch(`${GCAL_BASE}/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${resolved.token}` },
    });
  }

  const results: { id: string; gcalEventId?: string; error?: string }[] = [];

  for (const block of blocks) {
    const weekdayIndex = block.dia - 1;
    const byday = DIA_TO_BYDAY[weekdayIndex];
    const dateStr = nextWeekdayDate(weekdayIndex);
    const timeZone = "America/Argentina/Buenos_Aires";

    const eventBody = {
      summary: block.materiaNombre,
      description: [block.comision && `Comisión: ${block.comision}`, block.notas]
        .filter(Boolean)
        .join("\n") || undefined,
      start: { dateTime: minutesToRFC3339Time(block.horaInicio, dateStr), timeZone },
      end: { dateTime: minutesToRFC3339Time(block.horaFin, dateStr), timeZone },
      recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${byday}`],
      extendedProperties: {
        private: { uns_planificador: "true", uns_block_id: block.id, uns_career_id: careerId },
      },
    };

    const gcalRes = await fetch(GCAL_BASE, {
      method: "POST",
      headers: { Authorization: `Bearer ${resolved.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(eventBody),
    });

    if (gcalRes.ok) {
      const data = (await gcalRes.json()) as { id: string };
      results.push({ id: block.id, gcalEventId: data.id });
    } else {
      console.error("[exportar-gcal] Google API error", { status: gcalRes.status });
      results.push({ id: block.id, error: `Google Calendar error ${gcalRes.status}` });
    }
  }

  const failed = results.filter((r) => r.error);
  const succeeded = results.filter((r) => r.gcalEventId);

  const firstError = failed[0]?.error;
  return NextResponse.json(
    {
      created: succeeded.length,
      failed: failed.length,
      results,
      ...(failed.length > 0 && succeeded.length === 0 && firstError ? { error: firstError } : {}),
    },
    { status: failed.length > 0 && succeeded.length === 0 ? 502 : 200 },
  );
}

// ── DELETE: desvincular (eliminar todos los eventos exportados) ────────────

export async function DELETE(request: Request) {
  const rawToken = await getUserId(request);
  if (!rawToken?.sub) return unauthorized();

  const resolved = await resolveAccessToken(rawToken.sub);
  if (!resolved) {
    return NextResponse.json(
      { error: "No hay token de Google Calendar. Conectá tu cuenta desde el planificador." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const careerId = url.searchParams.get("careerId") ?? "";
  if (!careerId) {
    return NextResponse.json({ error: "Falta careerId" }, { status: 400 });
  }

  const eventIds = await findAllExportedEvents(resolved.token, careerId);

  if (eventIds.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  let deleted = 0;
  let failedCount = 0;

  for (const eventId of eventIds) {
    const res = await fetch(`${GCAL_BASE}/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${resolved.token}` },
    });
    if (res.ok || res.status === 404) {
      deleted++;
    } else {
      console.error("[exportar-gcal] Event deletion failed", { status: res.status });
      failedCount++;
    }
  }

  return NextResponse.json(
    { deleted, failed: failedCount },
    { status: failedCount > 0 && deleted === 0 ? 502 : 200 },
  );
}
