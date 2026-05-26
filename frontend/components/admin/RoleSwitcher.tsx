"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { GLASS, TEXT_SEC } from "@/lib/ui/tokens";

type SimulatedRole = "USER" | "MODERATOR";

const ROLE_LABEL: Record<SimulatedRole, string> = {
  USER: "Usuario",
  MODERATOR: "Moderador",
};

const ROLE_COLOR: Record<SimulatedRole, string> = {
  USER: "rgba(76,201,240,0.15)",
  MODERATOR: "rgba(249,199,79,0.15)",
};

const ROLE_BORDER: Record<SimulatedRole, string> = {
  USER: "rgba(76,201,240,0.4)",
  MODERATOR: "rgba(249,199,79,0.4)",
};

const ROLE_TEXT: Record<SimulatedRole, string> = {
  USER: "#4cc9f0",
  MODERATOR: "#f9c74f",
};

export default function RoleSwitcher() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Solo visible si el rol real es ADMIN (con o sin simulación activa)
  const isRealAdmin = session?.user?.realRole === "ADMIN" || session?.user?.role === "ADMIN";
  if (!isRealAdmin) return null;

  const simulatedRole = session?.user?.realRole ? (session.user.role as SimulatedRole) : null;

  async function switchTo(role: SimulatedRole | null) {
    setLoading(true);
    await update({ effectiveRole: role });
    router.refresh();
    setLoading(false);
  }

  if (simulatedRole) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
          background: ROLE_COLOR[simulatedRole],
          border: `1px solid ${ROLE_BORDER[simulatedRole]}`,
          color: ROLE_TEXT[simulatedRole],
          letterSpacing: "0.05em",
        }}>
          Simulando {ROLE_LABEL[simulatedRole]}
        </span>
        <button
          onClick={() => switchTo(null)}
          disabled={loading}
          style={{
            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
            background: "rgba(157,78,221,0.15)",
            border: "1px solid rgba(157,78,221,0.4)",
            color: "#c084fc",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "…" : "Volver a Admin"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 10, color: TEXT_SEC, marginRight: 2 }}>Ver como</span>
      {(["USER", "MODERATOR"] as const).map((role) => (
        <button
          key={role}
          onClick={() => switchTo(role)}
          disabled={loading}
          style={{
            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
            background: GLASS.dim,
            border: `1px solid ${GLASS.border}`,
            color: TEXT_SEC,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {ROLE_LABEL[role]}
        </button>
      ))}
    </div>
  );
}
