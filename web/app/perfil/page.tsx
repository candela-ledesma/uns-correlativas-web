import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function PerfilPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?next=/perfil");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto grid w-full max-w-3xl gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Perfil</h1>
        <p className="text-sm text-zinc-600">Email: {session.user.email}</p>
        <p className="text-sm text-zinc-600">Rol: {session.user.role}</p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800"
          >
            Ir al inicio
          </Link>
          <Link
            href="/planes/arquitectura"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800"
          >
            Ver plan
          </Link>
          {(session.user.role === "MODERATOR" || session.user.role === "ADMIN") && (
            <Link
              href="/moderacion"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800"
            >
              Moderación
            </Link>
          )}
          {session.user.role === "ADMIN" && (
            <Link
              href="/admin"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800"
            >
              Administración
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
