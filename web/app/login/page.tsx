import LoginActions from "@/components/auth/LoginActions";
import { BG_GRADIENT } from "@/lib/tokens";
import { getAuthProviderFlags } from "@/lib/authProviders";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Error al iniciar el proceso con Google. Intentá de nuevo.",
  OAuthCallback: "Error al volver de Google. Intentá de nuevo.",
  OAuthCreateAccount: "No se pudo crear la cuenta con Google.",
  OAuthAccountNotLinked: "Este email ya está asociado a otro método de acceso.",
  Callback: "Error en el callback de autenticación.",
  Default: "Ocurrió un error al iniciar sesión. Intentá de nuevo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const nextParam = Array.isArray(resolved.next) ? resolved.next[0] : resolved.next;
  const errorParam = Array.isArray(resolved.error) ? resolved.error[0] : resolved.error;

  const callbackUrl = nextParam && nextParam.startsWith("/") ? nextParam : "/perfil";
  const authError = errorParam
    ? (AUTH_ERROR_MESSAGES[errorParam] ?? AUTH_ERROR_MESSAGES.Default)
    : null;

  const { hasGoogleProvider: showGoogleLogin, allowDevLogin: showDevLogin } = getAuthProviderFlags();

  return (
    <main style={{ minHeight: "100vh", background: BG_GRADIENT, padding: "64px 24px" }}>
      <div style={{ margin: "0 auto", maxWidth: 480, display: "grid", gap: 24 }}>
        <h1 style={{ margin: 0, color: "#e2d9f3", fontSize: "clamp(1.8rem,4vw,2.4rem)", fontWeight: 800, letterSpacing: "-0.02em", textShadow: "0 2px 16px rgba(157,78,221,0.4)" }}>
          Iniciar sesión
        </h1>

        {authError && (
          <div role="alert" style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 12, padding: "12px 16px", color: "#fca5a5", fontSize: 14 }}>
            {authError}
          </div>
        )}

        <LoginActions callbackUrl={callbackUrl} showGoogleLogin={showGoogleLogin} />
      </div>
    </main>
  );
}
