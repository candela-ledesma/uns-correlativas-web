"use client";

import { useState } from "react";
import { ACCENT, BG_GRADIENT, GLASS, TEXT, TEXT_SEC } from "@/lib/ui/tokens";
import CargarPlanTab from "./tabs/CargarPlanTab";
import HistorialTab from "./tabs/HistorialTab";
import ConfigTab from "./tabs/ConfigTab";

type Tab = "cargar" | "historial" | "config";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "cargar",    label: "Cargar plan",   icon: "↑" },
  { id: "historial", label: "Historial",     icon: "◷" },
  { id: "config",    label: "Configuración", icon: "⚙" },
];

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("cargar");

  return (
    <div style={{ background: BG_GRADIENT, minHeight: "100vh", fontFamily: "var(--font-body)" }}>
      {/* Topbar */}
      <header style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "0 28px", height: 52,
        borderBottom: `1px solid ${GLASS.border}`,
        background: "rgba(10,14,40,0.85)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{
          width: 28, height: 28,
          background: `linear-gradient(135deg, ${ACCENT}, #c084fc)`,
          borderRadius: 7,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14,
        }}>⚙</div>
        <span style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>Panel de administración</span>
        <span style={{
          background: "rgba(157,78,221,0.2)",
          border: `1px solid rgba(157,78,221,0.4)`,
          color: "#c084fc",
          borderRadius: 4, padding: "1px 8px",
          fontSize: 10, fontWeight: 600, letterSpacing: "0.05em",
        }}>Admin</span>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 56px" }}>
        {/* Tabs */}
        <nav style={{
          display: "flex", gap: 4,
          borderBottom: `1px solid ${GLASS.border}`,
          marginBottom: 28,
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: "none", border: "none",
                color: tab === t.id ? "#c084fc" : TEXT_SEC,
                padding: "9px 16px",
                cursor: "pointer",
                fontSize: 13, fontWeight: 500,
                borderBottom: tab === t.id ? `2px solid #c084fc` : "2px solid transparent",
                marginBottom: -1,
                transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span style={{ opacity: 0.8 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "cargar"    && <CargarPlanTab />}
        {tab === "historial" && <HistorialTab />}
        {tab === "config"    && <ConfigTab />}
      </main>
    </div>
  );
}
