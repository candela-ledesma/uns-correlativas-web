import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "/";
  const error = url.searchParams.get("error");

  // Google denied or the user cancelled
  if (error || !code) {
    return NextResponse.redirect(new URL(`${state}?gcal_error=1`, url.origin));
  }

  const rawToken = await getToken({
    req: request as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  });

  if (!rawToken?.sub) {
    return NextResponse.redirect(new URL(`${state}?gcal_error=1`, url.origin));
  }

  const userId = rawToken.sub;
  const clientId = process.env.AUTH_GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.AUTH_GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri = new URL("/api/auth/google-calendar/callback", url.origin).toString();

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("[gcal-callback] Token exchange failed", { status: tokenRes.status });
    return NextResponse.redirect(new URL(`${state}?gcal_error=1`, url.origin));
  }

  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };

  if (!tokens.access_token) {
    console.error("[gcal-callback] No access_token in response");
    return NextResponse.redirect(new URL(`${state}?gcal_error=1`, url.origin));
  }

  const expiresAt = tokens.expires_in
    ? Math.floor(Date.now() / 1000) + tokens.expires_in
    : undefined;

  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "google-calendar",
        providerAccountId: userId,
      },
    },
    create: {
      userId,
      provider: "google-calendar",
      providerAccountId: userId,
      type: "oauth",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: expiresAt ?? null,
      scope: tokens.scope ?? null,
      token_type: tokens.token_type ?? null,
    },
    update: {
      access_token: tokens.access_token,
      ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
      expires_at: expiresAt ?? null,
      scope: tokens.scope ?? null,
      token_type: tokens.token_type ?? null,
    },
  });

  return NextResponse.redirect(new URL(state, url.origin));
}
