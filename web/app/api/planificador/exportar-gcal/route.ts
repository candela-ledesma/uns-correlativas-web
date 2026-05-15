import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const GCAL_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// dia 1=Lunes → RRULE BYDAY=MO
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

// Returns ISO date (YYYY-MM-DD) of the next occurrence of weekday (0=Mon…4=Fri) from today
function nextWeekdayDate(weekday: number): string {
  const today = new Date();
  const todayDay = (today.getDay() + 6) % 7; // JS getDay: 0=Sun → reindex to 0=Mon
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
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

async function getValidAccessToken(
  accessToken: string | undefined,
  refreshToken: string | undefined,
  expiresAt: number | undefined,
): Promise<string | null> {
  const nowSecs = Math.floor(Date.now() / 1000);
  const isExpired = expiresAt !== undefined && nowSecs >= expiresAt - 60;

  if (accessToken && !isExpired) return accessToken;
  if (refreshToken) return refreshAccessToken(refreshToken);
  return null;
}

export async function POST(request: Request) {
  const token = await getToken({
    req: request as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  });

  if (!token?.sub) return unauthorized();

  const accessToken = await getValidAccessToken(
    token.googleAccessToken as string | undefined,
    token.googleRefreshToken as string | undefined,
    token.googleTokenExpiresAt as number | undefined,
  );

  if (!accessToken) {
    return NextResponse.json(
      { error: "No hay token de Google Calendar. Iniciá sesión con Google para exportar." },
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

  const blocks = await prisma.scheduleBlock.findMany({
    where: { userId: token.sub, careerId, planId, versionId },
  });

  if (blocks.length === 0) {
    return NextResponse.json({ error: "No hay bloques para exportar" }, { status: 400 });
  }

  const results: { id: string; gcalEventId?: string; error?: string }[] = [];

  for (const block of blocks) {
    const weekdayIndex = block.dia - 1;
    const byday = DIA_TO_BYDAY[weekdayIndex];
    const dateStr = nextWeekdayDate(weekdayIndex);
    const timeZone = "America/Argentina/Buenos_Aires";

    const event = {
      summary: block.materiaNombre,
      description: [block.comision && `Comisión: ${block.comision}`, block.notas]
        .filter(Boolean)
        .join("\n") || undefined,
      start: {
        dateTime: minutesToRFC3339Time(block.horaInicio, dateStr),
        timeZone,
      },
      end: {
        dateTime: minutesToRFC3339Time(block.horaFin, dateStr),
        timeZone,
      },
      recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${byday}`],
      extendedProperties: {
        private: {
          uns_planificador: "true",
          uns_block_id: block.id,
        },
      },
    };

    const res = await fetch(GCAL_EVENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    if (res.ok) {
      const created = (await res.json()) as { id: string };
      results.push({ id: block.id, gcalEventId: created.id });
    } else {
      const errBody = await res.text().catch(() => "");
      console.error("[exportar-gcal] Google API error", res.status, errBody);
      results.push({ id: block.id, error: `Google Calendar error ${res.status}: ${errBody}` });
    }
  }

  const failed = results.filter((r) => r.error);
  const succeeded = results.filter((r) => r.gcalEventId);

  const firstError = failed[0]?.error;
  return NextResponse.json(
    {
      exported: succeeded.length,
      failed: failed.length,
      results,
      ...(failed.length > 0 && succeeded.length === 0 && firstError ? { error: firstError } : {}),
    },
    { status: failed.length > 0 && succeeded.length === 0 ? 502 : 200 },
  );
}
