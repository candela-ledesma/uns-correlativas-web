import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { GLASS, TEXT } from "@/lib/ui/tokens";
import AdminPanel from "@/components/admin/AdminPanel";

export const metadata = { title: "Panel de administración | UNS Correlativas" };

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?next=/admin");
  }

  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MODERATOR) {
    return (
      <main style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}>
        <div style={{
          background: "rgba(220,38,38,0.10)",
          border: "1px solid rgba(239,68,68,0.30)",
          borderRadius: 14, padding: "28px 32px",
          maxWidth: 400, textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#fca5a5", marginBottom: 8 }}>
            Acceso denegado
          </h1>
          <p style={{ fontSize: 13, color: "#a89bc9", marginBottom: 20 }}>
            Necesitás rol <strong style={{ color: "#e2d9f3" }}>moderador</strong> o <strong style={{ color: "#e2d9f3" }}>admin</strong> para acceder a este panel.
          </p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              background: `rgba(255,255,255,0.06)`,
              border: `1px solid ${GLASS.border}`,
              color: TEXT,
              borderRadius: 8,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            ← Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return <AdminPanel canPublish={session.user.role === Role.ADMIN} />;
}
