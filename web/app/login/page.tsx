import LoginActions from "@/components/LoginActions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const nextParam = Array.isArray(resolved.next)
    ? resolved.next[0]
    : resolved.next;

  const callbackUrl = nextParam && nextParam.startsWith("/") ? nextParam : "/perfil";
  const isProduction = process.env.NODE_ENV === "production";
  const showDevLogin =
    process.env.AUTH_ENABLE_DEV_LOGIN === "true" ||
    (!isProduction && process.env.AUTH_ENABLE_DEV_LOGIN !== "false");
  const showGoogleLogin =
    Boolean(process.env.AUTH_GOOGLE_CLIENT_ID) &&
    Boolean(process.env.AUTH_GOOGLE_CLIENT_SECRET);

  const loginHint = showGoogleLogin
    ? "Ingresa con Google para sincronizar el progreso entre dispositivos y usar permisos por rol."
    : showDevLogin
      ? "Ingresa con credenciales de desarrollo para sincronizar el progreso entre dispositivos y habilitar permisos por rol."
      : "Este entorno no tiene proveedores de autenticacion configurados.";

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto grid w-full max-w-xl gap-6">
        <h1 className="text-3xl font-extrabold text-zinc-900">Iniciar sesión</h1>
        <p className="text-sm text-zinc-600">{loginHint}</p>
        <LoginActions callbackUrl={callbackUrl} showGoogleLogin={showGoogleLogin} />
      </div>
    </main>
  );
}
