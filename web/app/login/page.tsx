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

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto grid w-full max-w-xl gap-6">
        <h1 className="text-3xl font-extrabold text-zinc-900">Iniciar sesión</h1>
        <p className="text-sm text-zinc-600">
          Ingresá con credenciales de desarrollo para sincronizar el progreso entre dispositivos y habilitar permisos por rol.
        </p>
        <LoginActions callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
