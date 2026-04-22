import LoginActions from "@/components/LoginActions";

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

  const isProduction = process.env.NODE_ENV === "production";
  const showDevLogin =
    process.env.AUTH_ENABLE_DEV_LOGIN === "true" ||
    (!isProduction && process.env.AUTH_ENABLE_DEV_LOGIN !== "false");
  const showGoogleLogin =
    Boolean(process.env.AUTH_GOOGLE_CLIENT_ID) &&
    Boolean(process.env.AUTH_GOOGLE_CLIENT_SECRET);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto grid w-full max-w-xl gap-6">
        <h1 className="text-3xl font-extrabold text-zinc-900">Iniciar sesion</h1>

        {authError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {authError}
          </p>
        )}

        <LoginActions callbackUrl={callbackUrl} showGoogleLogin={showGoogleLogin} />
      </div>
    </main>
  );
}
