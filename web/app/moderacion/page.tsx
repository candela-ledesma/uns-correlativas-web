import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasRequiredRole } from "@/lib/auth/authz";
import { Role } from "@/lib/auth/roles";

export default async function ModeracionPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?next=/moderacion");
  }

  if (!hasRequiredRole(session.user.role, Role.MODERATOR)) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-red-700">Acceso denegado</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Necesitás rol moderador o admin para acceder a esta sección.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-zinc-800 underline">
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Moderación</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Desde acá podés subir y procesar planes de estudio.
        </p>
        <Link
          href="/admin"
          className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Ir al panel → Crear plan
        </Link>
      </div>
    </main>
  );
}
