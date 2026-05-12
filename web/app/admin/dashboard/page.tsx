import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import AdminRoleManager from "@/components/profile/AdminRoleManager";
import { TEXT, TEXT_SEC, GLASS, SURFACE } from "@/lib/ui/tokens";

export const metadata = { title: "Dashboard admin | UNS Correlativas" };

const CHART_W = 600;
const CHART_H = 160;
const PAD = { top: 16, bottom: 36, left: 32, right: 16 };

function LoginBarChart({ data }: { data: [string, number][] }) {
  const sorted = [...data].sort((a, b) => a[0].localeCompare(b[0]));
  const maxVal = Math.max(...sorted.map(([, v]) => v), 1);
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const barW = Math.floor(innerW / sorted.length) - 6;

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      style={{ width: "100%", maxWidth: CHART_W, display: "block" }}
      aria-label="Logins por día"
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = PAD.top + innerH - ratio * innerH;
        return (
          <g key={ratio}>
            <line
              x1={PAD.left} x2={CHART_W - PAD.right}
              y1={y} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth={1}
            />
            {ratio > 0 && (
              <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.35)">
                {Math.round(maxVal * ratio)}
              </text>
            )}
          </g>
        );
      })}

      {/* Bars */}
      {sorted.map(([day, count], i) => {
        const x = PAD.left + i * (innerW / sorted.length) + 3;
        const barH = Math.max((count / maxVal) * innerH, 2);
        const y = PAD.top + innerH - barH;
        const label = day.slice(5); // MM-DD

        return (
          <g key={day}>
            <rect
              x={x} y={y} width={barW} height={barH}
              rx={3}
              fill="rgba(157,78,221,0.7)"
            />
            {/* count on top of bar */}
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.7)">
              {count}
            </text>
            {/* day label */}
            <text
              x={x + barW / 2} y={CHART_H - 6}
              textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.4)"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default async function AdminDashboardPage() {
  const session = await auth();

  if (!session?.user) redirect("/login?next=/admin/dashboard");
  if (session.user.role !== Role.ADMIN) redirect("/");

  const [users, loginLogs, planActivity, roleCounts] = await Promise.all([
    prisma.user.findMany({
      where: { email: { not: { contains: "@uns.local" } } },
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),

    prisma.auditLog.findMany({
      where: {
        action: { in: ["AUTH_SIGNIN", "AUTH_SIGNUP"] },
        actorEmail: { not: { contains: "@uns.local" } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { actorEmail: true, action: true, authProvider: true, createdAt: true },
    }),

    prisma.userActivity.groupBy({
      by: ["careerId"],
      where: { type: "PLAN_OPENED" },
      _count: { careerId: true },
      orderBy: { _count: { careerId: "desc" } },
      take: 10,
    }),

    prisma.user.groupBy({
      by: ["role"],
      where: { email: { not: { contains: "@uns.local" } } },
      _count: { role: true },
    }),
  ]);

  const totalUsers = users.length;
  const roleMap = Object.fromEntries(roleCounts.map((r) => [r.role, r._count.role]));

  const logsByDay = loginLogs.reduce<Record<string, number>>((acc, log) => {
    const day = log.createdAt.toISOString().slice(0, 10);
    acc[day] = (acc[day] ?? 0) + 1;
    return acc;
  }, {});
  const logsByDaySorted = Object.entries(logsByDay).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 64px", color: TEXT }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <Link href="/admin" style={{
          color: TEXT_SEC, fontSize: 13, textDecoration: "none",
          background: GLASS.elevated, border: `1px solid ${GLASS.border}`,
          borderRadius: 8, padding: "5px 12px",
        }}>
          ← Crear plan
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Dashboard</h1>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
        {[
          { label: "Usuarios totales", value: totalUsers },
          { label: "USER",      value: roleMap["USER"]      ?? 0 },
          { label: "MODERATOR", value: roleMap["MODERATOR"] ?? 0 },
          { label: "ADMIN",     value: roleMap["ADMIN"]     ?? 0 },
          { label: "Logins hoy", value: logsByDay[new Date().toISOString().slice(0, 10)] ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} style={{ ...SURFACE, borderRadius: 12, padding: "16px 18px" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: TEXT_SEC, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>{label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Logins por día — gráfico de barras SVG */}
      <section style={{ ...SURFACE, borderRadius: 12, padding: "20px 22px", marginBottom: 24 }}>
        <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: TEXT_SEC, marginBottom: 20 }}>
          Logins por día (últimos 7 días)
        </p>
        {logsByDaySorted.length === 0 ? (
          <p style={{ fontSize: 13, color: TEXT_SEC }}>Sin datos.</p>
        ) : (
          <LoginBarChart data={logsByDaySorted} />
        )}
      </section>

      {/* Planes más consultados */}
      <section style={{ ...SURFACE, borderRadius: 12, padding: "20px 22px", marginBottom: 24 }}>
        <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: TEXT_SEC, marginBottom: 14 }}>
          Planes más consultados
        </p>
        {planActivity.length === 0 ? (
          <p style={{ fontSize: 13, color: TEXT_SEC }}>Sin datos.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${GLASS.border}`, textAlign: "left" }}>
                <th style={{ padding: "6px 10px", color: TEXT_SEC, fontWeight: 500 }}>#</th>
                <th style={{ padding: "6px 10px", color: TEXT_SEC, fontWeight: 500 }}>Carrera</th>
                <th style={{ padding: "6px 10px", color: TEXT_SEC, fontWeight: 500 }}>Aperturas</th>
              </tr>
            </thead>
            <tbody>
              {planActivity.map((row, i) => (
                <tr key={row.careerId} style={{ borderBottom: `1px solid ${GLASS.faint}` }}>
                  <td style={{ padding: "6px 10px", color: TEXT_SEC }}>{i + 1}</td>
                  <td style={{ padding: "6px 10px" }}>{row.careerId}</td>
                  <td style={{ padding: "6px 10px", fontWeight: 600 }}>{row._count.careerId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Gestión de usuarios */}
      <section style={{ ...SURFACE, borderRadius: 12, padding: "20px 22px" }}>
        <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: TEXT_SEC, marginBottom: 14 }}>
          Gestión de usuarios
        </p>
        <AdminRoleManager users={users} />
      </section>
    </main>
  );
}
