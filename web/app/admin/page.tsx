import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import AdminRoleManager from "@/components/profile/AdminRoleManager";
import { Role } from "@/lib/roles";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?next=/admin");
  }

  if (session.user.role !== Role.ADMIN) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-red-700">Acceso denegado</h1>
          <p className="mt-2 text-sm text-zinc-600">Necesitás rol admin para acceder.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-zinc-800 underline">
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto grid max-w-6xl gap-8">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-900">Panel de administración</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Gestión de roles y permisos. Todo cambio requiere motivo y queda auditado.
          </p>

          <div className="mt-4">
            <AdminRoleManager users={users} />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-zinc-900">Auditoría global</h2>
          <p className="mt-1 text-sm text-zinc-600">Últimos 100 eventos</p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Rol</th>
                  <th className="px-3 py-2">Acción</th>
                  <th className="px-3 py-2">Entidad</th>
                  <th className="px-3 py-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-zinc-100">
                    <td className="px-3 py-2">{log.createdAt.toISOString()}</td>
                    <td className="px-3 py-2">{log.actorEmail ?? "(sin email)"}</td>
                    <td className="px-3 py-2">{log.actorRole ?? "-"}</td>
                    <td className="px-3 py-2">{log.action}</td>
                    <td className="px-3 py-2">{log.entityType}:{log.entityId}</td>
                    <td className="px-3 py-2">{log.reason ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
