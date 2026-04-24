import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
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

  const logs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: ["PROGRESS_UPDATED", "PROGRESS_RESET", "PROGRESS_MIGRATED"],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto grid max-w-5xl gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Moderación</h1>
        <p className="text-sm text-zinc-600">
          Historial reciente de cambios de progreso por usuario (auditoría inmutable).
        </p>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Actor</th>
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
                  <td className="px-3 py-2">{log.action}</td>
                  <td className="px-3 py-2">{log.entityId}</td>
                  <td className="px-3 py-2">{log.reason ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
