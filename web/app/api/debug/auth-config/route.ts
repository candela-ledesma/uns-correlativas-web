import { NextResponse } from "next/server";

// Endpoint de diagnóstico — solo responde si AUTH_DEBUG_ENABLED=true.
// Nunca expone valores reales, solo presencia/ausencia de cada variable.
// Para usar: setear AUTH_DEBUG_ENABLED=true en Vercel, consultar, luego eliminar esa var.
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production" || process.env.AUTH_DEBUG_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hasGoogleClientId = Boolean(process.env.AUTH_GOOGLE_CLIENT_ID);
  const hasGoogleClientSecret = Boolean(process.env.AUTH_GOOGLE_CLIENT_SECRET);
  const isProduction = process.env.NODE_ENV === "production";

  return NextResponse.json({
    hasGoogleClientId,
    hasGoogleClientSecret,
    hasGoogleProvider: hasGoogleClientId && hasGoogleClientSecret,
    hasNextAuthUrl: Boolean(process.env.NEXTAUTH_URL ?? process.env.AUTH_URL),
    hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET),
    nodeEnv: process.env.NODE_ENV,
    allowDevLogin:
      process.env.AUTH_ENABLE_DEV_LOGIN === "true" ||
      (!isProduction && process.env.AUTH_ENABLE_DEV_LOGIN !== "false"),
  });
}
