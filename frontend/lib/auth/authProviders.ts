/**
 * Única fuente de verdad para determinar qué providers de auth están disponibles.
 * Se llama en runtime (no en build time) para que las env vars de Vercel sean leídas correctamente.
 */
export function getAuthProviderFlags() {
  const isProduction = process.env.NODE_ENV === "production";

  const hasGoogleProvider =
    Boolean(process.env.AUTH_GOOGLE_CLIENT_ID) &&
    Boolean(process.env.AUTH_GOOGLE_CLIENT_SECRET);

  const allowDevLogin = process.env.AUTH_ENABLE_DEV_LOGIN === "true";

  return { hasGoogleProvider, allowDevLogin, isProduction };
}
