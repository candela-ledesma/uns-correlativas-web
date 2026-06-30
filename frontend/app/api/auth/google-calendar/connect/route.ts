import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export async function GET(request: Request) {
  const rawToken = await getToken({
    req: request as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  });

  if (!rawToken?.sub) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const clientId = process.env.AUTH_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google no configurado" }, { status: 500 });
  }

  const url = new URL(request.url);
  const callbackUrl = url.searchParams.get("callbackUrl") ?? "/";
  const redirectUri = new URL("/api/auth/google-calendar/callback", url.origin).toString();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    include_granted_scopes: "true",
    access_type: "offline",
    prompt: "consent",
    state: callbackUrl,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    302,
  );
}
